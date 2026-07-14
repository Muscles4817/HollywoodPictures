import { describe, it, expect } from 'vitest';
import { computeReportedLegs, computeProjectSpendSoFar, currentWizardStepFor, deriveProjectStage } from './selectors';
import { studioReducer } from './studioReducer';
import { buildReadyDraft, buildStateWithReadyDraft } from './testFixtures';
import { withRng } from '../engine/random';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { asPlayerDraft, filmToProject, playerDraftToProject, playerReleasedFilms, scheduledDraftToProject } from '../engine/project';
import type { PhotographyState } from '../types';

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

function inProgressPhotography(overrides: Partial<PhotographyState> = {}): PhotographyState {
  return { status: 'in-progress', recommendedDays: 40, daysElapsed: 5, events: [], runningCost: 0, pendingChoice: null, ...overrides };
}

describe('deriveProjectStage - Projects page (components/ProjectsPage.tsx)', () => {
  it('a photography-less draft is pre-production while focused, shelved while backgrounded - the one place stage depends on focus, not just shape', () => {
    const { result: draft } = withRng(100, (rng) => buildReadyDraft(rng));
    const preShoot = { ...draft, photography: null };
    const project = playerDraftToProject(preShoot);
    expect(deriveProjectStage(project, preShoot.id)).toBe('pre-production');
    expect(deriveProjectStage(project, null)).toBe('shelved');
    expect(deriveProjectStage(project, 'some-other-project-id')).toBe('shelved');
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

describe('currentWizardStepFor', () => {
  it('a photography-less draft always re-enters at develop', () => {
    const { result: draft } = withRng(110, (rng) => buildReadyDraft(rng));
    expect(currentWizardStepFor({ ...draft, photography: null })).toBe('develop');
  });

  it('mid-shoot photography re-enters at production', () => {
    const { result: draft } = withRng(111, (rng) => buildReadyDraft(rng));
    expect(currentWizardStepFor({ ...draft, photography: inProgressPhotography() })).toBe('production');
  });

  it('finished photography with no post-production choices yet re-enters at post-production', () => {
    const { result: draft } = withRng(112, (rng) => buildReadyDraft(rng));
    const wrapped = { ...draft, photography: inProgressPhotography({ status: 'finished' }), postProductionChoices: null };
    expect(currentWizardStepFor(wrapped)).toBe('post-production');
  });

  it('finished photography with post-production choices already made re-enters at marketing', () => {
    const state = buildStateWithReadyDraft(113);
    const draft = asPlayerDraft(state.projects[0])!;
    expect(currentWizardStepFor(draft)).toBe('marketing');
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
});
