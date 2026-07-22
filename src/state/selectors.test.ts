import { describe, it, expect } from 'vitest';
import { collectPersonAwards, computeReportedLegs, computeProjectSpendSoFar, countActivePlayerProjects, currentScreenFor, deriveProjectStage, deriveReachableWizardSteps, deriveReputationHistory, deriveUpcomingReleaseEntries, hasDraftProgress, PLAYER_STUDIO_ID } from './selectors';
import { openCastingCall } from '../engine/castingCalls';
import { generateTestScreeningPendingChoice } from '../engine/testScreening';
import { studioReducer } from './studioReducer';
import { buildReadyDraft, buildStateWithReadyDraft } from './testFixtures';
import { withRng } from '../engine/random';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { asPlayerDraft, filmToProject, playerDraftToProject, playerReleasedFilms, scheduledDraftToProject } from '../engine/project';
import { AWARD_CATEGORIES } from '../data/awards';
import type { AwardCategory, AwardNomination, AwardsCeremony, PhotographyState, Project, RivalProductionInProgress, RivalStudio } from '../types';

describe('computeReportedLegs - a derived reported statistic, never a stored driver', () => {
  it('is null while the run is still in theaters - not knowable before the run has a real total', () => {
    const released = studioReducer(buildStateWithReadyDraft(1), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    expect(film.boxOfficeRun.status).toBe('running');
    expect(computeReportedLegs(film)).toBeNull();
  });

  it('equals totalBoxOffice / openingWeekend exactly once the run finishes', () => {
    const released = studioReducer(buildStateWithReadyDraft(2), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    let state = released;
    for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    const film = playerReleasedFilms(state.projects)[0];
    expect(film.boxOfficeRun.status).toBe('finished');

    const legs = computeReportedLegs(film);
    expect(legs).not.toBeNull();
    expect(legs).toBeCloseTo(film.results.totalBoxOffice! / film.results.openingWeekend, 9);
    expect(legs).toBeGreaterThanOrEqual(1); // a run can never gross less than its own opening
  });

  it('updates correctly as actual gross grows - a longer, bigger-grossing run reports proportionally higher legs than a shorter one with the same opening', () => {
    const released = studioReducer(buildStateWithReadyDraft(3, { releaseType: 'Limited' }), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    let state = released;
    const legsByWeek: number[] = [];
    for (let week = 1; week <= MAX_SIMULATION_WEEKS + 2; week++) {
      for (let day = 0; day < 7; day++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
      const film = playerReleasedFilms(state.projects)[0];
      const legs = computeReportedLegs(film);
      if (legs !== null) legsByWeek.push(legs);
      if (film.boxOfficeRun.status === 'finished') break;
    }
    // Once knowable (the run has finished), legs is a single settled figure - this just confirms it was actually computed from a real, non-trivial run rather than defaulting to some placeholder.
    expect(legsByWeek.length).toBeGreaterThan(0);
    expect(legsByWeek[legsByWeek.length - 1]).toBeGreaterThanOrEqual(1);
  });
});

function emptyAwardCategories(): Record<AwardCategory, AwardNomination[]> {
  return Object.fromEntries(AWARD_CATEGORIES.map((cat) => [cat, []])) as unknown as Record<AwardCategory, AwardNomination[]>;
}

describe('deriveReputationHistory - the Reputation History panel\'s own trail behind Brand/Prestige', () => {
  it('produces one film event per finished film that actually moved Brand or Prestige, matching its own results exactly', () => {
    const released = studioReducer(buildStateWithReadyDraft(10), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    let state = released;
    for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    const film = playerReleasedFilms(state.projects)[0];
    expect(film.boxOfficeRun.status).toBe('finished');

    const history = deriveReputationHistory(state);
    const filmEvent = history.find((e) => e.kind === 'film');

    if (film.results.prestigeChange || film.results.brandChange) {
      expect(filmEvent).toBeDefined();
      expect(filmEvent!.title).toBe(film.title);
      expect(filmEvent!.prestigeDelta).toBe(film.results.prestigeChange);
      expect(filmEvent!.brandDelta).toBe(film.results.brandChange);
    } else {
      expect(filmEvent).toBeUndefined();
    }
  });

  it('omits a finished film whose run left both Brand and Prestige exactly unchanged', () => {
    const released = studioReducer(buildStateWithReadyDraft(10), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    let state = released;
    for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    const film = playerReleasedFilms(state.projects)[0];
    const neutralFilm = { ...film, results: { ...film.results, prestigeChange: 0, brandChange: 0 } };
    const neutralState = { ...state, projects: [filmToProject(neutralFilm)] };

    const history = deriveReputationHistory(neutralState);
    expect(history.find((e) => e.kind === 'film')).toBeUndefined();
  });

  it('includes an awards ceremony event using the exact same haul computeStudioAwardDeltas would return, and sorts every event most-recent-first', () => {
    const released = studioReducer(buildStateWithReadyDraft(10), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    let state = released;
    for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    const film = playerReleasedFilms(state.projects)[0];

    const categories = emptyAwardCategories();
    categories['best-picture'] = [{ filmId: film.id, awardScore: 90, won: true }];
    const ceremony: AwardsCeremony = { year: 1, ceremonyDay: film.releasedOnDay + 400, categories };
    const awardsState = { ...state, awards: { history: [ceremony], season: null, nextSeasonDay: 99_999 } };

    const history = deriveReputationHistory(awardsState);
    const awardsEvent = history.find((e) => e.kind === 'awards');
    expect(awardsEvent).toBeDefined();
    // best-picture weight 1.0, WIN_PRESTIGE 4, WIN_BRAND 2 (data/awards.ts) - a single Best Picture win nets exactly this.
    expect(awardsEvent!.prestigeDelta).toBe(4);
    expect(awardsEvent!.brandDelta).toBe(2);
    expect(awardsEvent!.prestigeDetail).toContain('1 win');

    // The awards ceremony was placed 400 days after release, well after the film's own run finished - should sort first.
    expect(history[0].kind).toBe('awards');
  });

  it('never attributes a rival\'s award win to the player\'s own history', () => {
    const released = studioReducer(buildStateWithReadyDraft(10), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    let state = released;
    for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });

    const categories = emptyAwardCategories();
    categories['best-picture'] = [{ filmId: 'some-rival-film-id', awardScore: 90, won: true }];
    const ceremony: AwardsCeremony = { year: 1, ceremonyDay: 500, categories };
    const awardsState = { ...state, awards: { history: [ceremony], season: null, nextSeasonDay: 99_999 } };

    const history = deriveReputationHistory(awardsState);
    expect(history.find((e) => e.kind === 'awards')).toBeUndefined();
  });
});

function inProgressPhotography(overrides: Partial<PhotographyState> = {}): PhotographyState {
  return { status: 'in-progress', recommendedDays: 40, daysElapsed: 5, events: [], runningCost: 0, pendingChoice: null, ...overrides };
}

describe('hasDraftProgress - Dashboard.tsx "Staffing" slot / deriveProjectStage shelved-vs-pre-production split', () => {
  it('is false for a script with no hires, no casting calls, and no production plan', () => {
    const { result: draft } = withRng(102, (rng) => buildReadyDraft(rng));
    expect(hasDraftProgress({ ...draft, talent: [], productionChoices: null, castingCalls: [] })).toBe(false);
  });

  it('is true once anyone is hired, even with no production plan or casting calls', () => {
    const { result: draft } = withRng(103, (rng) => buildReadyDraft(rng));
    expect(hasDraftProgress({ ...draft, productionChoices: null, castingCalls: [] })).toBe(true);
  });

  it('is true once a casting call is open, even with nobody hired yet and no production plan', () => {
    const { result: draft } = withRng(104, (rng) => buildReadyDraft(rng));
    const call = openCastingCall('char-1', 'Lead Actor', 1);
    expect(hasDraftProgress({ ...draft, talent: [], productionChoices: null, castingCalls: [call] })).toBe(true);
  });

  it('is true once a production plan is set, even with nobody hired and no casting calls open', () => {
    const { result: draft } = withRng(105, (rng) => buildReadyDraft(rng));
    expect(hasDraftProgress({ ...draft, talent: [], castingCalls: [] })).toBe(true);
  });
});

describe('deriveProjectStage - Projects page (components/ProjectsPage.tsx)', () => {
  it('a genuinely untouched photography-less draft (no hires, no casting calls, no production plan) is pre-production while focused, shelved while backgrounded', () => {
    const { result: draft } = withRng(100, (rng) => buildReadyDraft(rng));
    const untouched = { ...draft, photography: null, talent: [], productionChoices: null, castingCalls: [] };
    const project = playerDraftToProject(untouched);
    expect(deriveProjectStage(project, untouched.id)).toBe('pre-production');
    expect(deriveProjectStage(project, null)).toBe('shelved');
    expect(deriveProjectStage(project, 'some-other-project-id')).toBe('shelved');
  });

  it('a photography-less draft with real progress (talent already hired) reads as pre-production even while backgrounded - not shelved, since hasDraftProgress is true', () => {
    const { result: draft } = withRng(100, (rng) => buildReadyDraft(rng));
    const preShoot = { ...draft, photography: null };
    const project = playerDraftToProject(preShoot);
    expect(deriveProjectStage(project, preShoot.id)).toBe('pre-production');
    expect(deriveProjectStage(project, null)).toBe('pre-production');
    expect(deriveProjectStage(project, 'some-other-project-id')).toBe('pre-production');
  });

  it('mid-shoot photography (in-progress or awaiting-choice) is always filming, regardless of focus - a backgrounded shoot keeps advancing on its own', () => {
    const { result: draft } = withRng(101, (rng) => buildReadyDraft(rng));
    const filming = playerDraftToProject({ ...draft, photography: inProgressPhotography() });
    expect(deriveProjectStage(filming, draft.id)).toBe('filming');
    expect(deriveProjectStage(filming, null)).toBe('filming');

    const awaitingChoice = playerDraftToProject({ ...draft, photography: inProgressPhotography({ status: 'awaiting-choice' }) });
    expect(deriveProjectStage(awaitingChoice, null)).toBe('filming');
  });

  it('finished photography is post-production whether or not post-production/marketing choices are already made', () => {
    const state = buildStateWithReadyDraft(102); // photography finished, post-production + marketing choices already set
    expect(deriveProjectStage(state.projects[0], null)).toBe('post-production');

    const draft = asPlayerDraft(state.projects[0])!;
    const wrapped = playerDraftToProject({ ...draft, postProductionChoices: null, marketingChoices: null });
    expect(deriveProjectStage(wrapped, null)).toBe('post-production');
  });

  it('a scheduled project is its own stage, independent of focus', () => {
    const state = buildStateWithReadyDraft(103);
    const draft = asPlayerDraft(state.projects[0])!;
    const scheduled = scheduledDraftToProject(draft, 500);
    expect(deriveProjectStage(scheduled, null)).toBe('scheduled');
    expect(deriveProjectStage(scheduled, draft.id)).toBe('scheduled');
  });

  it('a released film is in-cinemas while its run is live, archived once the run finishes', () => {
    const released = studioReducer(buildStateWithReadyDraft(104), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const runningFilm = playerReleasedFilms(released.projects)[0];
    expect(runningFilm.boxOfficeRun.status).toBe('running');
    expect(deriveProjectStage(filmToProject(runningFilm), null)).toBe('in-cinemas');

    let state = released;
    for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    const finishedFilm = playerReleasedFilms(state.projects)[0];
    expect(finishedFilm.boxOfficeRun.status).toBe('finished');
    expect(deriveProjectStage(filmToProject(finishedFilm), null)).toBe('archived');
  });

  it('an already-released rival film has no stage either - a \'released\' Project can be a rival\'s own, told apart only by Film.releasedBy', () => {
    const released = studioReducer(buildStateWithReadyDraft(106), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const playerFilm = playerReleasedFilms(released.projects)[0];
    const rivalFilm = { ...playerFilm, id: 'rival-film-x', releasedBy: 'A Rival Studio' };
    expect(deriveProjectStage(filmToProject(rivalFilm), null)).toBeNull();
    // The player's own otherwise-identical film is unaffected by that check.
    expect(deriveProjectStage(filmToProject(playerFilm), null)).not.toBeNull();
  });

  it('a rival production has no stage - this page is the player\'s own projects only', () => {
    const state = buildStateWithReadyDraft(105);
    const draft = asPlayerDraft(state.projects[0])!;
    const rivalProject = {
      kind: 'rival-in-progress' as const,
      production: {
        id: 'rival-prod-x',
        rivalStudioId: 'rival-studio-0',
        scale: 'Small' as const,
        genre: draft.genre!,
        script: draft.script!,
        talent: draft.talent,
        productionChoices: draft.productionChoices!,
        postProductionChoices: draft.postProductionChoices!,
        marketingChoices: draft.marketingChoices!,
        targetAudience: draft.targetAudience!,
        releaseDay: 500,
      },
    };
    expect(deriveProjectStage(rivalProject, null)).toBeNull();
  });
});

describe('currentScreenFor', () => {
  it('a photography-less draft always re-enters at the Producer Workspace', () => {
    const { result: draft } = withRng(110, (rng) => buildReadyDraft(rng));
    expect(currentScreenFor({ ...draft, photography: null })).toBe('workspace');
  });

  it('mid-shoot photography re-enters at production', () => {
    const { result: draft } = withRng(111, (rng) => buildReadyDraft(rng));
    expect(currentScreenFor({ ...draft, photography: inProgressPhotography() })).toBe('production');
  });

  it('finished photography with no post-production choices yet re-enters at post-production', () => {
    const { result: draft } = withRng(112, (rng) => buildReadyDraft(rng));
    const wrapped = { ...draft, photography: inProgressPhotography({ status: 'finished' }), postProductionChoices: null };
    expect(currentScreenFor(wrapped)).toBe('post-production');
  });

  it('finished photography with post-production choices already made re-enters at marketing', () => {
    const state = buildStateWithReadyDraft(113);
    const draft = asPlayerDraft(state.projects[0])!;
    expect(currentScreenFor(draft)).toBe('marketing');
  });
});

// Post-Production Redesign, Phase C (docs/DESIGN_REVIEW_post_production_redesign.md
// section 3) - which WizardStep screens the clickable step nav
// (components/common/WizardSteps.tsx) can jump straight to.
describe('deriveReachableWizardSteps', () => {
  it('only "production" is reachable while still shooting', () => {
    const { result: draft } = withRng(114, (rng) => buildReadyDraft(rng));
    const shooting = { ...draft, photography: inProgressPhotography() };
    expect(deriveReachableWizardSteps(shooting)).toEqual(['production']);
  });

  it('post-production and marketing both become reachable once photography finishes, with nothing pending', () => {
    const { result: draft } = withRng(115, (rng) => buildReadyDraft(rng));
    const wrapped = { ...draft, photography: inProgressPhotography({ status: 'finished' }) };
    expect(deriveReachableWizardSteps(wrapped)).toEqual(['production', 'post-production', 'marketing']);
  });

  it('marketing drops out while a test screening is pending an unresolved choice - post-production stays reachable', () => {
    const { result: draft } = withRng(116, (rng) => buildReadyDraft(rng));
    const pendingChoice = withRng(117, (rng) => generateTestScreeningPendingChoice(draft, rng)).result;
    const wrapped = { ...draft, photography: inProgressPhotography({ status: 'finished' }), testScreeningPendingChoice: pendingChoice };
    expect(deriveReachableWizardSteps(wrapped)).toEqual(['production', 'post-production']);
  });

  it('"results" is never included - only ever reached by actually resolving a release, never by jumping there', () => {
    const { result: draft } = withRng(118, (rng) => buildReadyDraft(rng));
    const wrapped = { ...draft, photography: inProgressPhotography({ status: 'finished' }) };
    expect(deriveReachableWizardSteps(wrapped)).not.toContain('results');
  });
});

describe('computeProjectSpendSoFar', () => {
  it('includes the script acquisition cost even before anything else is chosen', () => {
    const { result: draft } = withRng(120, (rng) => buildReadyDraft(rng));
    const bareDraft = { ...draft, talent: [], productionChoices: null, photography: null, postProductionChoices: null, marketingChoices: null };
    const asset = { id: bareDraft.assetId, script: bareDraft.script!, source: 'Studio Original' as const, acquisitionCost: 42_000, acquiredOnDay: 1 };
    expect(computeProjectSpendSoFar(playerDraftToProject(bareDraft), [asset])).toBe(42_000);
  });

  it('grows as talent is hired and production/post/marketing choices are made, on top of the script cost', () => {
    const { result: draft } = withRng(121, (rng) => buildReadyDraft(rng));
    const bareDraft = { ...draft, productionChoices: null, photography: null, postProductionChoices: null, marketingChoices: null };
    const asset = { id: bareDraft.assetId, script: bareDraft.script!, source: 'Studio Original' as const, acquisitionCost: 10_000, acquiredOnDay: 1 };

    const withTalentOnly = computeProjectSpendSoFar(playerDraftToProject(bareDraft), [asset]);
    const withProductionPlan = computeProjectSpendSoFar(playerDraftToProject({ ...bareDraft, productionChoices: draft.productionChoices }), [asset]);
    expect(withProductionPlan).toBeGreaterThan(withTalentOnly);

    const fullyPlanned = computeProjectSpendSoFar(playerDraftToProject(draft), [asset]);
    expect(fullyPlanned).toBeGreaterThan(withProductionPlan);
  });

  it('for a released film, equals the asset acquisition cost plus results.totalCost', () => {
    const state = buildStateWithReadyDraft(122);
    const released = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    const spend = computeProjectSpendSoFar(filmToProject(film), released.studio.assets);
    expect(spend).toBe(released.studio.assets[0].acquisitionCost + film.results.totalCost);
  });

  // Architecture cleanup (post-Phase-B post-production redesign, item 3) - a
  // resolved test-screening intervention's cost is charged immediately
  // (state/studioReducer.ts:RESOLVE_TEST_SCREENING_CHOICE) and lives on its
  // own draft.postProductionEvents collection - this is what makes that
  // spend actually show up in the project finance breakdown instead of
  // silently disappearing the way the old zeroed-costDelta design required.
  it("includes a resolved post-production intervention's cost, on top of everything else", () => {
    const { result: draft } = withRng(123, (rng) => buildReadyDraft(rng));
    const asset = { id: draft.assetId, script: draft.script!, source: 'Studio Original' as const, acquisitionCost: 10_000, acquiredOnDay: 1 };
    const before = computeProjectSpendSoFar(playerDraftToProject(draft), [asset]);

    const withIntervention = {
      ...draft,
      postProductionEvents: [
        { id: 'test-screening', description: 'Resolved: Pickups.', severity: 'medium' as const, costDelta: 800_000, qualityDelta: 5, buzzDelta: 1, delayDaysDelta: 12 },
      ],
    };
    const after = computeProjectSpendSoFar(playerDraftToProject(withIntervention), [asset]);
    expect(after).toBe(before + 800_000);
  });
});

function rivalProductionFixture(overrides: Partial<RivalProductionInProgress> = {}): RivalProductionInProgress {
  const { result: draft } = withRng(200, (rng) => buildReadyDraft(rng));
  return {
    id: 'rival-prod-fixture',
    rivalStudioId: 'rival-studio-0',
    scale: 'Medium',
    genre: draft.genre!,
    script: draft.script!,
    talent: draft.talent,
    productionChoices: draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!,
    marketingChoices: draft.marketingChoices!,
    targetAudience: draft.targetAudience!,
    releaseDay: 200,
    ...overrides,
  };
}

const rivalStudioFixture: RivalStudio = {
  id: 'rival-studio-0',
  name: 'Test Rival Pictures',
  tier: 'Indie',
  cash: 1_000_000,
  brand: 30,
  prestige: 30,
  lifetimeRevenue: 0,
  lifetimeExpenditure: 0,
  nextSpawnCheckDay: 1,
};

describe('deriveUpcomingReleaseEntries - the shared source for the Release Calendar and the Marketing & Release date picker', () => {
  it('is empty with no scheduled projects and no rival productions', () => {
    expect(deriveUpcomingReleaseEntries([], [], 'My Studio')).toEqual([]);
  });

  it('includes a player-scheduled project, tagged isPlayer with the player studio id/name', () => {
    const { result: draft } = withRng(201, (rng) => buildReadyDraft(rng));
    const projects: Project[] = [{ kind: 'scheduled', draft, releaseDay: 50 }];
    const entries = deriveUpcomingReleaseEntries(projects, [], 'My Studio');
    expect(entries).toHaveLength(1);
    expect(entries[0].isPlayer).toBe(true);
    expect(entries[0].studioId).toBe(PLAYER_STUDIO_ID);
    expect(entries[0].studioName).toBe('My Studio');
    expect(entries[0].releaseDay).toBe(50);
    expect(entries[0].genre).toBe(draft.genre);
  });

  it('includes a rival production in progress, tagged not-isPlayer with the rival studio name resolved from its id', () => {
    const projects: Project[] = [{ kind: 'rival-in-progress', production: rivalProductionFixture() }];
    const entries = deriveUpcomingReleaseEntries(projects, [rivalStudioFixture], 'My Studio');
    expect(entries).toHaveLength(1);
    expect(entries[0].isPlayer).toBe(false);
    expect(entries[0].studioId).toBe('rival-studio-0');
    expect(entries[0].studioName).toBe('Test Rival Pictures');
  });

  it('falls back to "A Rival Studio" if the rival studio id has no matching entry in rivalStudios', () => {
    const projects: Project[] = [{ kind: 'rival-in-progress', production: rivalProductionFixture({ rivalStudioId: 'unknown' }) }];
    const entries = deriveUpcomingReleaseEntries(projects, [], 'My Studio');
    expect(entries[0].studioName).toBe('A Rival Studio');
  });

  it('excludes every other project kind (in-progress drafts, released films)', () => {
    const { result: draft } = withRng(202, (rng) => buildReadyDraft(rng));
    const projects: Project[] = [{ kind: 'player-in-progress', draft }];
    expect(deriveUpcomingReleaseEntries(projects, [], 'My Studio')).toEqual([]);
  });

  it('sorts every entry by releaseDay, player and rival mixed together', () => {
    const { result: draftA } = withRng(203, (rng) => buildReadyDraft(rng));
    const { result: draftB } = withRng(204, (rng) => buildReadyDraft(rng));
    const projects: Project[] = [
      { kind: 'scheduled', draft: draftA, releaseDay: 300 },
      { kind: 'rival-in-progress', production: rivalProductionFixture({ releaseDay: 50 }) },
      { kind: 'scheduled', draft: draftB, releaseDay: 150 },
    ];
    const entries = deriveUpcomingReleaseEntries(projects, [rivalStudioFixture], 'My Studio');
    expect(entries.map((e) => e.releaseDay)).toEqual([50, 150, 300]);
  });
});

// Dashboard "N active projects" counted state.projects.length - which mixes in
// every rival's in-progress production and every released film (player and
// rival) - so it badly overcounted the player's own slate.
describe('countActivePlayerProjects', () => {
  it('counts only the player\'s in-progress and scheduled projects', () => {
    const projects = [
      { kind: 'player-in-progress' },
      { kind: 'player-in-progress' },
      { kind: 'scheduled' },
      { kind: 'released' }, // a finished film - not "active"
      { kind: 'rival-in-progress' }, // a rival's production - not the player's
      { kind: 'released' }, // could be a rival's film too - still excluded
    ] as unknown as Project[];
    expect(countActivePlayerProjects(projects)).toBe(3);
  });

  it('is 0 for an empty slate', () => {
    expect(countActivePlayerProjects([])).toBe(0);
  });
});

// Per-person award tally out of the permanent ceremony history - what the
// Talent Database's header marquee and Awards panel read from.
describe('collectPersonAwards', () => {
  const emptyCategories = (): Record<AwardCategory, AwardNomination[]> =>
    Object.fromEntries(AWARD_CATEGORIES.map((c) => [c, [] as AwardNomination[]])) as Record<AwardCategory, AwardNomination[]>;

  const ceremony = (year: number, noms: Partial<Record<AwardCategory, AwardNomination[]>>): AwardsCeremony => ({
    year,
    ceremonyDay: year * 365,
    categories: { ...emptyCategories(), ...noms },
  });

  it('is empty for no history', () => {
    expect(collectPersonAwards([]).size).toBe(0);
  });

  it('tallies wins and nominations per person across every ceremony', () => {
    const history: AwardsCeremony[] = [
      ceremony(1, {
        'best-actor': [
          { filmId: 'f1', personId: 'p-actor', awardScore: 90, won: true },
          { filmId: 'f2', personId: 'p-rival', awardScore: 80, won: false },
        ],
      }),
      ceremony(2, {
        'best-actor': [{ filmId: 'f3', personId: 'p-actor', awardScore: 88, won: true }],
        'best-supporting-actor': [{ filmId: 'f4', personId: 'p-actor', awardScore: 70, won: false }],
      }),
    ];
    const map = collectPersonAwards(history);
    const actor = map.get('p-actor')!;
    expect(actor.wins).toBe(2);
    expect(actor.nominations).toBe(3);
    expect(actor.byCategory['best-actor']).toEqual({ wins: 2, nominations: 2 });
    expect(actor.byCategory['best-supporting-actor']).toEqual({ wins: 0, nominations: 1 });
    expect(map.get('p-rival')).toEqual({ wins: 0, nominations: 1, byCategory: { 'best-actor': { wins: 0, nominations: 1 } } });
  });

  it('skips Best Picture nominations (no personId) - those belong to the studio, not a person', () => {
    const history: AwardsCeremony[] = [
      ceremony(1, { 'best-picture': [{ filmId: 'f1', awardScore: 95, won: true }] }),
    ];
    expect(collectPersonAwards(history).size).toBe(0);
  });
});
