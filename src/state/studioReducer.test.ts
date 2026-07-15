import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft, buildReadyDraft, buildReadyAsset, defaultMarketingChoices } from './testFixtures';
import { withRng } from '../engine/random';
import { STUDIO_BOX_OFFICE_SHARE, AVERAGE_TICKET_PRICE } from '../engine/boxOfficeRun';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { computeTalentCost, computeProductionBudgetCost } from '../engine/cost';
import { playerDraftToProject, playerReleasedFilms, findProject, asScheduled } from '../engine/project';
import { STAGE_DURATIONS } from '../data/schedule';
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
    const alreadyCharged = computeTalentCost(film.talent.map((a) => a.talent)) + computeProductionBudgetCost(film.productionChoices);
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

    const afterStep = studioReducer(withDraft, { type: 'GO_TO_STEP', step: 'talent' });
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
