import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft, buildReadyDraft, buildReadyAsset, defaultMarketingChoices } from './testFixtures';
import { createInitialStudio } from './gameState';
import { withRng } from '../engine/random';
import { STUDIO_BOX_OFFICE_SHARE, AVERAGE_TICKET_PRICE } from '../engine/boxOfficeRun';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { computeTalentCost, computeProductionBudgetCost } from '../engine/cost';
import { computeRecommendedPostProductionDays, computeRecommendedPreProductionDays } from '../engine/production';
import { effectiveRoleCapacity } from '../engine/castRequirements';
import { generateTalentPool, generateTalentCandidates } from '../engine/talentGenerator';
import { playerDraftToProject, playerReleasedFilms, findProject, asScheduled, asPlayerDraft } from '../engine/project';
import { STAGE_DURATIONS } from '../data/schedule';
import { MANDATORY_TALENT_ROLES } from '../data/talentGeneration';
import { professionForProductionRole } from '../data/helpers';
import type { GameState } from './gameState';

/** Dispatches ADVANCE_DAY n times, threading state through - the same real-time background tick App.tsx fires, just driven directly instead of through a timer. */
function advanceDays(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return s;
}

/** The player's single released film in a state built by these tests - all of them release exactly one. */
function theFilm(state: GameState) {
  return playerReleasedFilms(state.projects)[0];
}

describe('RELEASE_FILM', () => {
  it('produces a coherent Film: week 1 settled immediately, and keeps the exact id the draft carried its whole life', () => {
    const state = buildStateWithReadyDraft(1);
    const draftId = state.focusedProjectId!;
    const after = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });

    expect(after.screen).toBe('results');
    const films = playerReleasedFilms(after.projects);
    expect(films).toHaveLength(1);
    const film = films[0];

    // Roadmap Phase 5's id-churn fix: the released Film keeps the exact id
    // the FilmDraft carried since START_NEW_FILM (see engine/project.ts) -
    // one stable identity, not a freshly-generated one - and
    // focusedProjectId still resolves straight to it, now as 'released'.
    expect(film.id).toBe(draftId);
    expect(after.focusedProjectId).toBe(draftId);
    expect(findProject(after.projects, draftId)?.kind).toBe('released');

    expect(film.boxOfficeRun.status).toBe('running');
    expect(film.boxOfficeRun.weeks).toHaveLength(1);
    expect(film.boxOfficeRun.simWeeks).toHaveLength(1);
    expect(film.boxOfficeRun.weeks[0].week).toBe(1);
    expect(film.boxOfficeRun.weeks[0].gross).toBe(film.results.openingWeekend);
    expect(film.boxOfficeRun.cumulativeGross).toBe(film.results.openingWeekend);

    // Not knowable until the run finishes.
    expect(film.results.totalBoxOffice).toBeNull();
    expect(film.results.studioRevenue).toBeNull();
    expect(film.results.profit).toBeNull();
    expect(film.results.outcome).toBeNull();
    expect(film.results.brandChange).toBeNull();
    expect(film.results.prestigeChange).toBeNull();
  });

  it('credits week 1\'s studio revenue share to cash as part of the same action', () => {
    const state = buildStateWithReadyDraft(2);
    const cashBefore = state.studio.cash;
    const after = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = theFilm(after);

    // Isolates the box-office revenue credit specifically, independent of
    // the (unrelated, pre-existing) production-cost bookkeeping RELEASE_FILM
    // also does in the same action: talent salary/production budget were
    // already deducted at BEGIN_PHOTOGRAPHY in the real wizard flow, so
    // computeTalentCost(talent) + computeProductionBudgetCost(productionChoices)
    // (this fixture's photography.runningCost is 0) is exactly the
    // "already charged" amount studioReducer.ts:RELEASE_FILM subtracts back
    // out of totalCost before applying it here.
    const alreadyCharged = computeTalentCost(film.talent) + computeProductionBudgetCost(film.productionChoices);
    const costChargedThisAction = film.results.totalCost - alreadyCharged;
    const expectedRevenueCredit = Math.round(film.results.openingWeekend * STUDIO_BOX_OFFICE_SHARE);
    expect(after.studio.cash).toBe(cashBefore - costChargedThisAction + expectedRevenueCredit);
  });
});

describe('advancing a calendar jump via repeated ADVANCE_DAY', () => {
  it('settles a run week by week as days pass, and a big jump matches many small ones', () => {
    const seed = 3;
    const releasedA = studioReducer(buildStateWithReadyDraft(seed), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const releasedB = studioReducer(buildStateWithReadyDraft(seed), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });

    const bigJump = advanceDays(releasedA, MAX_SIMULATION_WEEKS * 7 + 5);
    const smallSteps = advanceDays(releasedB, MAX_SIMULATION_WEEKS * 7 + 5);

    const filmBig = theFilm(bigJump);
    const filmSmall = theFilm(smallSteps);
    expect(filmBig.boxOfficeRun).toEqual(filmSmall.boxOfficeRun);
    expect(filmBig.results).toEqual(filmSmall.results);
    expect(bigJump.studio.cash).toBe(smallSteps.studio.cash);
  });

  it('a run finishes, gets its final figures filled in, and never settles again on further advances', () => {
    const released = studioReducer(buildStateWithReadyDraft(4), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const finished = advanceDays(released, MAX_SIMULATION_WEEKS * 7 + 7);
    const film = theFilm(finished);
    expect(film.boxOfficeRun.status).toBe('finished');
    expect(film.results.totalBoxOffice).toBe(film.boxOfficeRun.cumulativeGross);
    expect(film.results.outcome).not.toBeNull();

    const cashAfterFinish = finished.studio.cash;
    const evenLater = advanceDays(finished, 100);
    expect(theFilm(evenLater).boxOfficeRun).toEqual(film.boxOfficeRun);
    expect(theFilm(evenLater).results).toEqual(film.results);
    expect(evenLater.studio.cash).toBe(cashAfterFinish); // no further box-office credit once finished
  });

  it('settlement alone never reduces cash - only ever credits it', () => {
    const released = studioReducer(buildStateWithReadyDraft(5), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    let state = released;
    let previousCash = state.studio.cash;
    for (let i = 0; i < 30; i++) {
      state = studioReducer(state, { type: 'ADVANCE_DAY' });
      expect(state.studio.cash).toBeGreaterThanOrEqual(previousCash);
      previousCash = state.studio.cash;
    }
  });

  it('cash credited across a run matches the sum of settled weekly grosses times the studio share', () => {
    const released = studioReducer(buildStateWithReadyDraft(6), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const cashAfterRelease = released.studio.cash; // already includes week 1's credit, settled as part of RELEASE_FILM itself
    const finished = advanceDays(released, MAX_SIMULATION_WEEKS * 7 + 7);
    const film = theFilm(finished);
    // Only weeks 2+ are newly settled by the ADVANCE_DAY calls this test itself drives.
    const expectedCredit = film.boxOfficeRun.weeks.slice(1).reduce((sum, w) => sum + Math.round(w.gross * STUDIO_BOX_OFFICE_SHARE), 0);
    expect(finished.studio.cash - cashAfterRelease).toBe(expectedCredit);
  });

  it('a second film released mid-run settles alongside the first across further calendar jumps', () => {
    const afterFirst = studioReducer(buildStateWithReadyDraft(7), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const midRun = advanceDays(afterFirst, 21); // 3 weeks in

    const { result: secondDraft } = withRng(70, (rng) => buildReadyDraft(rng, defaultMarketingChoices({ releaseType: 'Limited' })));
    const withSecondDraft: GameState = {
      ...midRun,
      projects: [...midRun.projects, playerDraftToProject(secondDraft)],
      focusedProjectId: secondDraft.id,
    };
    const afterSecond = studioReducer(withSecondDraft, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    expect(playerReleasedFilms(afterSecond.projects)).toHaveLength(2);

    const caughtUp = advanceDays(afterSecond, MAX_SIMULATION_WEEKS * 7 + 30);
    for (const film of playerReleasedFilms(caughtUp.projects)) {
      expect(film.boxOfficeRun.status).toBe('finished');
      expect(film.boxOfficeRun.weeks.length).toBeGreaterThan(0);
      expect(film.boxOfficeRun.weeks.length).toBeLessThanOrEqual(MAX_SIMULATION_WEEKS);
    }
  });
});

describe('ACKNOWLEDGE_BOX_OFFICE_RESULTS', () => {
  it('flips acknowledged without touching anything else about the run', () => {
    const released = studioReducer(buildStateWithReadyDraft(8), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const finished = advanceDays(released, MAX_SIMULATION_WEEKS * 7 + 7);
    const filmId = theFilm(finished).id;
    expect(theFilm(finished).boxOfficeRun.acknowledged).toBe(false);

    const acknowledged = studioReducer(finished, { type: 'ACKNOWLEDGE_BOX_OFFICE_RESULTS', filmId });
    const film = theFilm(acknowledged);
    expect(film.boxOfficeRun.acknowledged).toBe(true);
    expect(film.boxOfficeRun.weeks).toEqual(theFilm(finished).boxOfficeRun.weeks);
    expect(film.results).toEqual(theFilm(finished).results);
  });
});

describe('deterministic release-day gross', () => {
  it('the same draft released twice produces the exact same opening weekend (the audience simulation has no randomness)', () => {
    const stateA = buildStateWithReadyDraft(9);
    const stateB = buildStateWithReadyDraft(9);
    const afterA = studioReducer(stateA, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const afterB = studioReducer(stateB, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    expect(theFilm(afterA).results.openingWeekend).toBe(theFilm(afterB).results.openingWeekend);
    expect(theFilm(afterA).boxOfficeRun.fixed).toEqual(theFilm(afterB).boxOfficeRun.fixed);
  });

  it('week 1 gross matches admissions * AVERAGE_TICKET_PRICE, rounded', () => {
    const state = buildStateWithReadyDraft(10);
    const after = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = theFilm(after);
    const expected = Math.round(film.boxOfficeRun.simWeeks[0].cumulativeTicketsSold * AVERAGE_TICKET_PRICE);
    expect(film.results.openingWeekend).toBe(expected);
  });
});

describe('transient view state (viewingRivalStudioName/viewingProductionId) - roadmap Phase 2.1', () => {
  // Both set at once is unrealistic in real play (the two detours are
  // mutually exclusive), but it's the most direct way to test the clearing
  // rule in isolation: whichever of these an action doesn't explicitly set,
  // it should clear.
  function stateWithBothViewsSet(): GameState {
    const base = buildStateWithReadyDraft(1);
    return { ...base, viewingRivalStudioName: 'A Rival Studio', viewingProductionId: 'some-production-id' };
  }

  it('VIEW_RIVAL_STUDIO sets viewingRivalStudioName and clears viewingProductionId', () => {
    const after = studioReducer(stateWithBothViewsSet(), { type: 'VIEW_RIVAL_STUDIO', studioName: 'Another Studio' });
    expect(after.viewingRivalStudioName).toBe('Another Studio');
    expect(after.viewingProductionId).toBeNull();
  });

  it('VIEW_PRODUCTION sets viewingProductionId and clears viewingRivalStudioName', () => {
    const after = studioReducer(stateWithBothViewsSet(), { type: 'VIEW_PRODUCTION', productionId: 'prod-42' });
    expect(after.viewingProductionId).toBe('prod-42');
    expect(after.viewingRivalStudioName).toBeNull();
  });

  it('VIEW_STATS, RESET_SAVE, and RETURN_TO_DASHBOARD all clear both, even starting from both set', () => {
    for (const action of [
      { type: 'VIEW_STATS' as const },
      { type: 'RESET_SAVE' as const, startingCash: 10_000_000 },
      { type: 'RETURN_TO_DASHBOARD' as const },
    ]) {
      const after = studioReducer(stateWithBothViewsSet(), action);
      expect(after.viewingRivalStudioName).toBeNull();
      expect(after.viewingProductionId).toBeNull();
    }
  });

  it('ordinary wizard navigation (CREATE_PROJECT_FROM_ASSET, GO_TO_STEP) clears both, not just viewingProductionId', () => {
    const { result: asset } = withRng(99, (rng) => buildReadyAsset(rng));
    const base = stateWithBothViewsSet();
    const withAsset: GameState = { ...base, studio: { ...base.studio, assets: [...base.studio.assets, asset] } };

    const withDraft = studioReducer(withAsset, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: asset.id });
    expect(withDraft.viewingRivalStudioName).toBeNull();
    expect(withDraft.viewingProductionId).toBeNull();

    const afterStep = studioReducer(withDraft, { type: 'GO_TO_STEP', step: 'production' });
    expect(afterStep.viewingRivalStudioName).toBeNull();
    expect(afterStep.viewingProductionId).toBeNull();
  });

  it('RELEASE_FILM clears both (previously left them untouched, safe since the marketing screen is unreachable while either is set)', () => {
    const state = { ...buildStateWithReadyDraft(1), viewingRivalStudioName: 'A Rival Studio' };
    const after = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    expect(after.viewingRivalStudioName).toBeNull();
    expect(after.viewingProductionId).toBeNull();
  });
});

describe('GameState.projects - roadmap Phase 5 (the flip)', () => {
  it("a project's id survives unchanged from creation (CREATE_PROJECT_FROM_ASSET) through release (SCHEDULE_RELEASE)", () => {
    const started = studioReducer(buildStateWithReadyDraft(1), { type: 'RETURN_TO_DASHBOARD' });
    const { result: asset } = withRng(101, (rng) => buildReadyAsset(rng));
    const withAsset: GameState = { ...started, studio: { ...started.studio, assets: [...started.studio.assets, asset] } };
    const afterCreate = studioReducer(withAsset, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: asset.id });
    const projectId = afterCreate.focusedProjectId!;
    expect(findProject(afterCreate.projects, projectId)?.kind).toBe('player-in-progress');

    // Fast-forward this fresh draft to release-ready using the same fixture
    // shape buildStateWithReadyDraft already trusts, just re-pointed at the
    // id CREATE_PROJECT_FROM_ASSET actually assigned - what's under test
    // here is whether that id survives the kind transition, not the wizard
    // flow itself (already covered by state/wizardRunThrough.test.ts).
    const { result: readyDraft } = withRng(1, (rng) => buildReadyDraft(rng));
    const withReadyDraft: GameState = {
      ...afterCreate,
      projects: [playerDraftToProject({ ...readyDraft, id: projectId, assetId: asset.id })],
      focusedProjectId: projectId,
    };
    const released = studioReducer(withReadyDraft, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });

    expect(released.focusedProjectId).toBe(projectId);
    const project = findProject(released.projects, projectId);
    expect(project?.kind).toBe('released');
    expect(project && project.kind === 'released' && project.film.id).toBe(projectId);
  });

  it('RETURN_TO_DASHBOARD never discards a project any more (development-pipeline doc) - only ABANDON_PROJECT does, and only pre-Greenlight', () => {
    const { result: asset } = withRng(102, (rng) => buildReadyAsset(rng));
    const base = studioReducer(buildStateWithReadyDraft(1), { type: 'RETURN_TO_DASHBOARD' });
    const withAsset: GameState = { ...base, studio: { ...base.studio, assets: [...base.studio.assets, asset] } };
    const afterCreate = studioReducer(withAsset, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: asset.id });
    const uncommittedId = afterCreate.focusedProjectId!;

    const keptUnfocused = studioReducer(afterCreate, { type: 'RETURN_TO_DASHBOARD' });
    expect(keptUnfocused.focusedProjectId).toBeNull();
    expect(findProject(keptUnfocused.projects, uncommittedId)?.kind).toBe('player-in-progress');

    const abandoned = studioReducer(afterCreate, { type: 'ABANDON_PROJECT' });
    expect(abandoned.focusedProjectId).toBeNull();
    expect(findProject(abandoned.projects, uncommittedId)).toBeNull();

    const releaseReady = buildStateWithReadyDraft(2); // photography already 'finished' - see testFixtures.ts
    const committedId = releaseReady.focusedProjectId!;
    const backgrounded = studioReducer(releaseReady, { type: 'RETURN_TO_DASHBOARD' });
    expect(backgrounded.focusedProjectId).toBeNull();
    expect(findProject(backgrounded.projects, committedId)?.kind).toBe('player-in-progress');
  });
});

describe('SCHEDULE_RELEASE - real release scheduling (roadmap Phase 7.1/7.2)', () => {
  it('a same-day pick (releaseDay <= the earliest possible day) resolves immediately, same as the old always-immediate RELEASE_FILM', () => {
    const state = buildStateWithReadyDraft(1);
    const draftId = state.focusedProjectId!;
    const after = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: state.totalDays });
    expect(after.screen).toBe('results');
    expect(after.focusedProjectId).toBe(draftId);
    expect(findProject(after.projects, draftId)?.kind).toBe('released');
  });

  it('a future pick parks the project as "scheduled", unfocused, back on the Dashboard - it does not resolve yet', () => {
    const state = buildStateWithReadyDraft(2);
    const draftId = state.focusedProjectId!;
    const farOut = state.totalDays + (STAGE_DURATIONS.marketing ?? 0) + 40;
    const after = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: farOut });
    expect(after.screen).toBe('dashboard');
    expect(after.focusedProjectId).toBeNull();
    const project = findProject(after.projects, draftId);
    expect(project?.kind).toBe('scheduled');
    expect(project && asScheduled(project)?.releaseDay).toBe(farOut);
    expect(playerReleasedFilms(after.projects)).toHaveLength(0);
  });

  it('a pick earlier than the earliest possible day is clamped up, not honored literally', () => {
    const state = buildStateWithReadyDraft(3);
    const minPossible = state.totalDays + (STAGE_DURATIONS.marketing ?? 0);
    const after = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    expect(after.totalDays).toBe(minPossible);
    expect(after.screen).toBe('results'); // 1 is always <= minPossible, so this always resolves same-day
  });

  it('advancing the calendar up to a scheduled releaseDay resolves it into a released Film with week 1 already settled, exactly once', () => {
    const state = buildStateWithReadyDraft(4);
    const draftId = state.focusedProjectId!;
    const farOut = state.totalDays + (STAGE_DURATIONS.marketing ?? 0) + 40;
    const scheduled = studioReducer(state, { type: 'SCHEDULE_RELEASE', releaseDay: farOut });
    expect(findProject(scheduled.projects, draftId)?.kind).toBe('scheduled');

    // Walk the calendar forward one real-time day at a time, well past
    // farOut, the same way the background tick actually would. Only the
    // very first tick where it's found 'released' (the transition itself)
    // is asserted on in detail - it stays 'released' for every tick after
    // that too (box office keeps settling), so re-asserting the same
    // "week 1 only" shape on later ticks would be checking the wrong thing.
    let s = scheduled;
    let releasedOnTick: number | null = null;
    for (let i = 0; i < 60; i++) {
      s = studioReducer(s, { type: 'ADVANCE_DAY' });
      const project = findProject(s.projects, draftId);
      if (project?.kind === 'released' && releasedOnTick === null) {
        releasedOnTick = i;
        expect(project.film.releasedOnDay).toBe(farOut); // the scheduled day, not whichever tick crossed it
        expect(project.film.boxOfficeRun.weeks).toHaveLength(1);
      }
    }
    expect(releasedOnTick).not.toBeNull();
    expect(playerReleasedFilms(s.projects)).toHaveLength(1);
  });

  it('reaching a scheduled releaseDay in one 60-tick run matches reaching it via two separate batches (40 then 20) - a big catch-up jump settles identically to many small ones', () => {
    const seed = 5;
    const stateA = buildStateWithReadyDraft(seed);
    const stateB = buildStateWithReadyDraft(seed);
    const farOut = stateA.totalDays + (STAGE_DURATIONS.marketing ?? 0) + 40;

    const scheduledA = studioReducer(stateA, { type: 'SCHEDULE_RELEASE', releaseDay: farOut });
    const scheduledB = studioReducer(stateB, { type: 'SCHEDULE_RELEASE', releaseDay: farOut });

    const oneRun = advanceDays(scheduledA, 60);
    const twoBatches = advanceDays(advanceDays(scheduledB, 40), 20);

    expect(playerReleasedFilms(oneRun.projects)[0].results).toEqual(playerReleasedFilms(twoBatches.projects)[0].results);
    expect(oneRun.studio.cash).toBe(twoBatches.studio.cash);
  });
});

// Producer Workspace redesign (PRODUCER_WORKSPACE_DESIGN.md, Phase 1) - free
// navigation (OPEN_PROJECT_WORKSPACE_SECTION) and GREENLIGHT_PROJECT's new
// role as a real calendar-advancing action. Charge/readiness-gate coverage
// for GREENLIGHT_PROJECT itself lives in state/developmentPipeline.test.ts;
// this file's job is the two things specific to the workspace shell: free
// navigation costs nothing, and Greenlight's new lump pre-production charge
// actually runs the same settlement machinery every other calendar advance
// does.
function freshWorkspaceState(seed: number, startingCash = 50_000_000): GameState {
  const { result, nextSeed } = withRng(seed, (rng) => ({ talentPool: generateTalentPool(rng) }));
  return {
    studio: createInitialStudio(startingCash),
    screen: 'dashboard',
    projects: [],
    focusedProjectId: null,
    projectWorkspaceSection: 'overview',
    rngSeed: nextSeed,
    totalDays: 1,
    talentPool: result.talentPool,
    rivalStudios: [],
    opportunities: [],
    nextOpportunityCheckDay: 1,
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
}

/** A freshly-created, fully-cast, planned pre-greenlight project - ready for GREENLIGHT_PROJECT to succeed. */
function stateReadyToGreenlight(seed: number, startingCash = 50_000_000): GameState {
  const { result: asset } = withRng(seed, (rng) => buildReadyAsset(rng));
  let s = freshWorkspaceState(seed, startingCash);
  s = { ...s, studio: { ...s.studio, assets: [asset] } };
  s = studioReducer(s, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: asset.id });

  const script = asPlayerDraft(findProject(s.projects, s.focusedProjectId))!.script!;
  let drawSeed = seed + 1;
  for (const role of MANDATORY_TALENT_ROLES) {
    const profession = professionForProductionRole(role);
    const need = Math.max(1, effectiveRoleCapacity(role, script).min);
    const { result: candidates } = withRng(drawSeed, (rng) => generateTalentCandidates(profession, rng, need));
    drawSeed += 1;
    for (const person of candidates) {
      s = studioReducer(s, { type: 'TOGGLE_TALENT_FOR_ROLE', role, person });
    }
  }

  s = studioReducer(s, {
    type: 'SET_PRODUCTION_PLAN',
    environmentStrategy: { studio: 0.4, location: 0.4, digital: 0.2 },
    environmentAmbition: 0.5,
    effectsStrategy: { practical: 0.5, digital: 0.5 },
    effectsAmbition: 0.5,
    contingencyAmount: 500_000,
    runtimeIntensity: 0.5,
  });
  return s;
}

describe('OPEN_PROJECT_WORKSPACE_SECTION - free navigation', () => {
  it('switches the section and screen with no calendar cost', () => {
    const s = stateReadyToGreenlight(200);
    const totalDaysBefore = s.totalDays;
    const after = studioReducer(s, { type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: 'finance' });
    expect(after.screen).toBe('workspace');
    expect(after.projectWorkspaceSection).toBe('finance');
    expect(after.totalDays).toBe(totalDaysBefore);
  });

  it('is a no-op when nothing is focused', () => {
    const s = freshWorkspaceState(201);
    const after = studioReducer(s, { type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: 'finance' });
    expect(after).toBe(s);
  });

  it('is a no-op once the focused project is already greenlit (past the workspace)', () => {
    const ready = stateReadyToGreenlight(202);
    const greenlit = studioReducer(ready, { type: 'GREENLIGHT_PROJECT' });
    expect(greenlit.screen).toBe('production'); // sanity: greenlight actually succeeded
    const after = studioReducer(greenlit, { type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: 'overview' });
    expect(after).toBe(greenlit);
  });
});

describe('GREENLIGHT_PROJECT - the new lump pre-production time charge', () => {
  it('advances totalDays by exactly computeRecommendedPreProductionDays, not a flat/zero amount', () => {
    const s = stateReadyToGreenlight(210);
    const draft = asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;
    const expectedDays = computeRecommendedPreProductionDays(draft.talent, draft.script!, draft.productionChoices!);
    expect(expectedDays).toBeGreaterThan(0);

    const after = studioReducer(s, { type: 'GREENLIGHT_PROJECT' });
    expect(after.totalDays).toBe(s.totalDays + expectedDays);
    const draftAfter = asPlayerDraft(findProject(after.projects, after.focusedProjectId))!;
    expect(draftAfter.greenlitOnDay).toBe(after.totalDays);
  });

  it('runs the same settlement machinery GO_TO_STEP does - a scheduled release due within the pre-production window actually resolves', () => {
    // An Epic-scale project at max effects ambition to guarantee a large
    // enough preProductionDays (see MAX_SCALE_PREPRODUCTION_DAYS/
    // MAX_AMBITION_PREPRODUCTION_DAYS, engine/production.ts) to exceed
    // STAGE_DURATIONS.marketing's own lead time - otherwise SCHEDULE_RELEASE
    // would clamp the second project's releaseDay past this window entirely,
    // and it could never resolve during this specific GREENLIGHT_PROJECT
    // dispatch. Only settles if GREENLIGHT_PROJECT genuinely runs
    // settleScheduledReleases, the same way advancing the calendar via
    // GO_TO_STEP already does.
    const { result: asset } = withRng(220, (rng) => buildReadyAsset(rng));
    const epicAsset = { ...asset, script: { ...asset.script, scale: 'Epic' as const } };
    let s = freshWorkspaceState(220);
    s = { ...s, studio: { ...s.studio, assets: [epicAsset] } };
    s = studioReducer(s, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: epicAsset.id });

    const script = asPlayerDraft(findProject(s.projects, s.focusedProjectId))!.script!;
    let drawSeed = 221;
    for (const role of MANDATORY_TALENT_ROLES) {
      const profession = professionForProductionRole(role);
      const need = Math.max(1, effectiveRoleCapacity(role, script).min);
      const { result: candidates } = withRng(drawSeed, (rng) => generateTalentCandidates(profession, rng, need));
      drawSeed += 1;
      for (const person of candidates) s = studioReducer(s, { type: 'TOGGLE_TALENT_FOR_ROLE', role, person });
    }
    s = studioReducer(s, {
      type: 'SET_PRODUCTION_PLAN',
      environmentStrategy: { studio: 0.4, location: 0.4, digital: 0.2 },
      environmentAmbition: 0.5,
      effectsStrategy: { practical: 0.5, digital: 0.5 },
      effectsAmbition: 1,
      contingencyAmount: 500_000,
      runtimeIntensity: 0.5,
    });
    const readyToGreenlight = s;

    const draft = asPlayerDraft(findProject(readyToGreenlight.projects, readyToGreenlight.focusedProjectId))!;
    const preProductionDays = computeRecommendedPreProductionDays(draft.talent, draft.script!, draft.productionChoices!);
    expect(preProductionDays).toBeGreaterThan(STAGE_DURATIONS.marketing ?? 0); // otherwise this test can't exercise what it's testing

    const scheduledState = buildStateWithReadyDraft(222);
    const releaseDay = readyToGreenlight.totalDays + (STAGE_DURATIONS.marketing ?? 0) + 1; // just past the earliest SCHEDULE_RELEASE will honor, so it stays 'scheduled' rather than resolving same-day
    let combined: GameState = {
      ...readyToGreenlight,
      projects: [...readyToGreenlight.projects, ...scheduledState.projects],
      focusedProjectId: scheduledState.focusedProjectId, // focus the second project so SCHEDULE_RELEASE acts on it
    };
    combined = studioReducer(combined, { type: 'SCHEDULE_RELEASE', releaseDay });
    // Refocus back onto the first, still-pre-greenlight project for GREENLIGHT_PROJECT to act on.
    combined = { ...combined, focusedProjectId: readyToGreenlight.focusedProjectId };
    expect(findProject(combined.projects, scheduledState.focusedProjectId!)?.kind).toBe('scheduled');

    const after = studioReducer(combined, { type: 'GREENLIGHT_PROJECT' });
    // SCHEDULE_RELEASE (dispatched above, against the second project) itself
    // already advanced totalDays by its own marketing lead time - that's the
    // baseline GREENLIGHT_PROJECT's own lump charge stacks on top of.
    expect(after.totalDays).toBe(combined.totalDays + preProductionDays);
    expect(findProject(after.projects, scheduledState.focusedProjectId!)?.kind).toBe('released');
  });

  it('is blocked by the readiness gate even when fully affordable - e.g. a still-missing crew role', () => {
    const s = stateReadyToGreenlight(230);
    const draft = asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;
    const withoutWriter = { ...draft, talent: draft.talent.filter((a) => a.role !== 'Writer') };
    const projects = s.projects.map((p) => (p.kind === 'player-in-progress' && p.draft.id === withoutWriter.id ? playerDraftToProject(withoutWriter) : p));
    const understaffed: GameState = { ...s, projects };

    const after = studioReducer(understaffed, { type: 'GREENLIGHT_PROJECT' });
    expect(after).toBe(understaffed);
    expect(after.screen).toBe('workspace');
  });
});

// Post-Production Redesign, Phase A
// (docs/DESIGN_REVIEW_post_production_redesign.md section 1) - the estimate
// is a snapshot computed once, at FINISH_PHOTOGRAPHY, not a live reading -
// this is what actually proves that (GREENLIGHT_PROJECT's own lump-sum
// pre-production charge above is the closest existing precedent for "one
// number, computed once, at a specific transition").
describe('FINISH_PHOTOGRAPHY - post-production estimate (Post-Production Redesign, Phase A)', () => {
  it('is null before photography finishes', () => {
    const greenlit = studioReducer(stateReadyToGreenlight(230), { type: 'GREENLIGHT_PROJECT' });
    const draft = asPlayerDraft(findProject(greenlit.projects, greenlit.focusedProjectId))!;
    expect(draft.photography?.status).toBe('in-progress'); // sanity - still shooting
    expect(draft.postProductionEstimatedCompletionDay).toBeNull();
  });

  it('is set to totalDays + computeRecommendedPostProductionDays exactly once photography finishes', () => {
    const greenlit = studioReducer(stateReadyToGreenlight(231), { type: 'GREENLIGHT_PROJECT' });
    const draftBefore = asPlayerDraft(findProject(greenlit.projects, greenlit.focusedProjectId))!;
    const expectedDays = computeRecommendedPostProductionDays(draftBefore.talent, draftBefore.productionChoices!);
    expect(expectedDays).toBeGreaterThan(0);

    const finished = studioReducer(greenlit, { type: 'FINISH_PHOTOGRAPHY', productionId: greenlit.focusedProjectId! });
    const draftAfter = asPlayerDraft(findProject(finished.projects, finished.focusedProjectId))!;
    expect(draftAfter.photography?.status).toBe('finished'); // sanity
    expect(draftAfter.postProductionEstimatedCompletionDay).toBe(finished.totalDays + expectedDays);
  });

  it('stays exactly the same value afterward - a snapshot, not something later actions recompute', () => {
    const greenlit = studioReducer(stateReadyToGreenlight(232), { type: 'GREENLIGHT_PROJECT' });
    const finished = studioReducer(greenlit, { type: 'FINISH_PHOTOGRAPHY', productionId: greenlit.focusedProjectId! });
    const estimateRightAfterFinish = asPlayerDraft(findProject(finished.projects, finished.focusedProjectId))!.postProductionEstimatedCompletionDay;

    const afterMoreDays = studioReducer(finished, { type: 'ADVANCE_DAY' });
    const estimateAfterAdvancing = asPlayerDraft(findProject(afterMoreDays.projects, afterMoreDays.focusedProjectId))!.postProductionEstimatedCompletionDay;

    expect(estimateAfterAdvancing).toBe(estimateRightAfterFinish);
  });

  it('does not change the existing 45-day flat Post-Production charge - GO_TO_STEP still charges STAGE_DURATIONS.post-production unmodified', () => {
    const greenlit = studioReducer(stateReadyToGreenlight(233), { type: 'GREENLIGHT_PROJECT' });
    const finished = studioReducer(greenlit, { type: 'FINISH_PHOTOGRAPHY', productionId: greenlit.focusedProjectId! });
    const onPostProductionScreen = studioReducer(finished, { type: 'GO_TO_STEP', step: 'post-production' });
    const totalDaysBeforeLeaving = onPostProductionScreen.totalDays;
    const afterLeaving = studioReducer(onPostProductionScreen, { type: 'GO_TO_STEP', step: 'marketing' });
    expect(afterLeaving.totalDays).toBe(totalDaysBeforeLeaving + 45);
  });
});

// Casting Redesign, Phase B (docs/DESIGN_REVIEW_casting_redesign.md
// sections 1-2) - no dedicated reducer coverage existed for OPEN_CASTING_CALL
// or the ADVANCE_DAY weekly tick before this.
function focusedDraftScript(state: GameState) {
  return asPlayerDraft(findProject(state.projects, state.focusedProjectId))!.script!;
}

/** A freshly-created project with a script but nobody cast yet - unlike stateReadyToGreenlight, Lead/Supporting Actor are deliberately left open so a casting call actually has room to generate applicants into. */
function stateWithFreshProject(seed: number, startingCash = 50_000_000): GameState {
  const { result: asset } = withRng(seed, (rng) => buildReadyAsset(rng));
  let s = freshWorkspaceState(seed, startingCash);
  s = { ...s, studio: { ...s.studio, assets: [asset] } };
  return studioReducer(s, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: asset.id });
}

describe('OPEN_CASTING_CALL', () => {
  it('adds a new, empty casting call for the given Character', () => {
    const s = stateWithFreshProject(300);
    const character = focusedDraftScript(s).cast.find((c) => c.prominence === 'Lead')!;
    const after = studioReducer(s, { type: 'OPEN_CASTING_CALL', characterId: character.id, role: 'Lead Actor' });
    const draft = asPlayerDraft(findProject(after.projects, after.focusedProjectId))!;
    expect(draft.castingCalls).toHaveLength(1);
    expect(draft.castingCalls[0].characterId).toBe(character.id);
    expect(draft.castingCalls[0].applicants).toEqual([]);
  });

  it('is a no-op if a call is already open for this Character', () => {
    const s = stateWithFreshProject(301);
    const character = focusedDraftScript(s).cast.find((c) => c.prominence === 'Lead')!;
    const once = studioReducer(s, { type: 'OPEN_CASTING_CALL', characterId: character.id, role: 'Lead Actor' });
    const twice = studioReducer(once, { type: 'OPEN_CASTING_CALL', characterId: character.id, role: 'Lead Actor' });
    expect(twice).toBe(once);
  });

  it('is a no-op when nothing is focused', () => {
    const s = freshWorkspaceState(302);
    const after = studioReducer(s, { type: 'OPEN_CASTING_CALL', characterId: 'anything', role: 'Lead Actor' });
    expect(after).toBe(s);
  });
});

describe('ADVANCE_DAY - Open Casting calls tick on the focused draft', () => {
  it('accrues applicants on the focused, still-in-Development draft once a week passes', () => {
    const s = stateWithFreshProject(303);
    const character = focusedDraftScript(s).cast.find((c) => c.prominence === 'Lead')!;
    const withCall = studioReducer(s, { type: 'OPEN_CASTING_CALL', characterId: character.id, role: 'Lead Actor' });
    const aWeekLater = advanceDays(withCall, 8);
    const draft = asPlayerDraft(findProject(aWeekLater.projects, aWeekLater.focusedProjectId))!;
    expect(draft.castingCalls[0].applicants.length).toBeGreaterThan(0);
  });

  it("doesn't touch castingCalls at all before a week has passed", () => {
    const s = stateWithFreshProject(304);
    const character = focusedDraftScript(s).cast.find((c) => c.prominence === 'Lead')!;
    const withCall = studioReducer(s, { type: 'OPEN_CASTING_CALL', characterId: character.id, role: 'Lead Actor' });
    const aFewDaysLater = advanceDays(withCall, 3);
    const draft = asPlayerDraft(findProject(aFewDaysLater.projects, aFewDaysLater.focusedProjectId))!;
    expect(draft.castingCalls[0].applicants).toEqual([]);
  });
});

// Casting Redesign, Phase C - the reducer only ever records an
// already-resolved rejection (engine/castingAppeal.ts:resolveOfferResponse
// runs client-side); no dedicated coverage existed for this action before.
describe('RECORD_CASTING_REJECTION', () => {
  it('bumps rejectionCount on an already-open call for this Character', () => {
    const s = stateWithFreshProject(305);
    const character = focusedDraftScript(s).cast.find((c) => c.prominence === 'Lead')!;
    const withCall = studioReducer(s, { type: 'OPEN_CASTING_CALL', characterId: character.id, role: 'Lead Actor' });
    const afterOneRejection = studioReducer(withCall, { type: 'RECORD_CASTING_REJECTION', characterId: character.id, role: 'Lead Actor' });
    const afterTwoRejections = studioReducer(afterOneRejection, { type: 'RECORD_CASTING_REJECTION', characterId: character.id, role: 'Lead Actor' });
    const draft = asPlayerDraft(findProject(afterTwoRejections.projects, afterTwoRejections.focusedProjectId))!;
    expect(draft.castingCalls[0].rejectionCount).toBe(2);
  });

  it('opens a fresh call (rejectionCount 1) if none existed yet - Direct Approach can reject before Open Casting ever ran', () => {
    const s = stateWithFreshProject(306);
    const character = focusedDraftScript(s).cast.find((c) => c.prominence === 'Lead')!;
    expect(asPlayerDraft(findProject(s.projects, s.focusedProjectId))!.castingCalls).toEqual([]);
    const after = studioReducer(s, { type: 'RECORD_CASTING_REJECTION', characterId: character.id, role: 'Lead Actor' });
    const draft = asPlayerDraft(findProject(after.projects, after.focusedProjectId))!;
    expect(draft.castingCalls).toHaveLength(1);
    expect(draft.castingCalls[0].rejectionCount).toBe(1);
  });

  it('is a no-op when nothing is focused', () => {
    const s = freshWorkspaceState(307);
    const after = studioReducer(s, { type: 'RECORD_CASTING_REJECTION', characterId: 'anything', role: 'Lead Actor' });
    expect(after).toBe(s);
  });
});
