import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft, buildReadyDraft, defaultMarketingChoices } from './testFixtures';
import { withRng } from '../engine/random';
import { STUDIO_BOX_OFFICE_SHARE, AVERAGE_TICKET_PRICE } from '../engine/boxOfficeRun';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { computeTalentCost, computeProductionBudgetCost } from '../engine/cost';
import type { GameState } from './gameState';

/** Dispatches ADVANCE_DAY n times, threading state through - the same real-time background tick App.tsx fires, just driven directly instead of through a timer. */
function advanceDays(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return s;
}

describe('RELEASE_FILM', () => {
  it('produces a coherent Film: week 1 settled immediately, results consistent between the draft and Studio History', () => {
    const state = buildStateWithReadyDraft(1);
    const after = studioReducer(state, { type: 'RELEASE_FILM' });

    expect(after.screen).toBe('results');
    expect(after.studio.filmsReleased).toHaveLength(1);
    const film = after.studio.filmsReleased[0];

    // The Results screen (draft.results) and Studio History (filmsReleased[0].results) must agree - same object, same call.
    expect(after.draft?.results).toEqual(film.results);

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
    expect(film.results.reputationChange).toBeNull();
  });

  it('credits week 1\'s studio revenue share to cash as part of the same action', () => {
    const state = buildStateWithReadyDraft(2);
    const cashBefore = state.studio.cash;
    const after = studioReducer(state, { type: 'RELEASE_FILM' });
    const film = after.studio.filmsReleased[0];

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
    const releasedA = studioReducer(buildStateWithReadyDraft(seed), { type: 'RELEASE_FILM' });
    const releasedB = studioReducer(buildStateWithReadyDraft(seed), { type: 'RELEASE_FILM' });

    const bigJump = advanceDays(releasedA, MAX_SIMULATION_WEEKS * 7 + 5);
    const smallSteps = advanceDays(releasedB, MAX_SIMULATION_WEEKS * 7 + 5);

    const filmBig = bigJump.studio.filmsReleased[0];
    const filmSmall = smallSteps.studio.filmsReleased[0];
    expect(filmBig.boxOfficeRun).toEqual(filmSmall.boxOfficeRun);
    expect(filmBig.results).toEqual(filmSmall.results);
    expect(bigJump.studio.cash).toBe(smallSteps.studio.cash);
  });

  it('a run finishes, gets its final figures filled in, and never settles again on further advances', () => {
    const released = studioReducer(buildStateWithReadyDraft(4), { type: 'RELEASE_FILM' });
    const finished = advanceDays(released, MAX_SIMULATION_WEEKS * 7 + 7);
    const film = finished.studio.filmsReleased[0];
    expect(film.boxOfficeRun.status).toBe('finished');
    expect(film.results.totalBoxOffice).toBe(film.boxOfficeRun.cumulativeGross);
    expect(film.results.outcome).not.toBeNull();

    const cashAfterFinish = finished.studio.cash;
    const evenLater = advanceDays(finished, 100);
    expect(evenLater.studio.filmsReleased[0].boxOfficeRun).toEqual(film.boxOfficeRun);
    expect(evenLater.studio.filmsReleased[0].results).toEqual(film.results);
    expect(evenLater.studio.cash).toBe(cashAfterFinish); // no further box-office credit once finished
  });

  it('settlement alone never reduces cash - only ever credits it', () => {
    const released = studioReducer(buildStateWithReadyDraft(5), { type: 'RELEASE_FILM' });
    let state = released;
    let previousCash = state.studio.cash;
    for (let i = 0; i < 30; i++) {
      state = studioReducer(state, { type: 'ADVANCE_DAY' });
      expect(state.studio.cash).toBeGreaterThanOrEqual(previousCash);
      previousCash = state.studio.cash;
    }
  });

  it('cash credited across a run matches the sum of settled weekly grosses times the studio share', () => {
    const released = studioReducer(buildStateWithReadyDraft(6), { type: 'RELEASE_FILM' });
    const cashAfterRelease = released.studio.cash; // already includes week 1's credit, settled as part of RELEASE_FILM itself
    const finished = advanceDays(released, MAX_SIMULATION_WEEKS * 7 + 7);
    const film = finished.studio.filmsReleased[0];
    // Only weeks 2+ are newly settled by the ADVANCE_DAY calls this test itself drives.
    const expectedCredit = film.boxOfficeRun.weeks.slice(1).reduce((sum, w) => sum + Math.round(w.gross * STUDIO_BOX_OFFICE_SHARE), 0);
    expect(finished.studio.cash - cashAfterRelease).toBe(expectedCredit);
  });

  it('a second film released mid-run settles alongside the first across further calendar jumps', () => {
    const afterFirst = studioReducer(buildStateWithReadyDraft(7), { type: 'RELEASE_FILM' });
    const midRun = advanceDays(afterFirst, 21); // 3 weeks in

    const { result: secondDraft } = withRng(70, (rng) => buildReadyDraft(rng, defaultMarketingChoices({ releaseType: 'Limited' })));
    const withSecondDraft: GameState = { ...midRun, draft: secondDraft };
    const afterSecond = studioReducer(withSecondDraft, { type: 'RELEASE_FILM' });
    expect(afterSecond.studio.filmsReleased).toHaveLength(2);

    const caughtUp = advanceDays(afterSecond, MAX_SIMULATION_WEEKS * 7 + 30);
    for (const film of caughtUp.studio.filmsReleased) {
      expect(film.boxOfficeRun.status).toBe('finished');
      expect(film.boxOfficeRun.weeks.length).toBeGreaterThan(0);
      expect(film.boxOfficeRun.weeks.length).toBeLessThanOrEqual(MAX_SIMULATION_WEEKS);
    }
  });
});

describe('ACKNOWLEDGE_BOX_OFFICE_RESULTS', () => {
  it('flips acknowledged without touching anything else about the run', () => {
    const released = studioReducer(buildStateWithReadyDraft(8), { type: 'RELEASE_FILM' });
    const finished = advanceDays(released, MAX_SIMULATION_WEEKS * 7 + 7);
    const filmId = finished.studio.filmsReleased[0].id;
    expect(finished.studio.filmsReleased[0].boxOfficeRun.acknowledged).toBe(false);

    const acknowledged = studioReducer(finished, { type: 'ACKNOWLEDGE_BOX_OFFICE_RESULTS', filmId });
    const film = acknowledged.studio.filmsReleased[0];
    expect(film.boxOfficeRun.acknowledged).toBe(true);
    expect(film.boxOfficeRun.weeks).toEqual(finished.studio.filmsReleased[0].boxOfficeRun.weeks);
    expect(film.results).toEqual(finished.studio.filmsReleased[0].results);
  });
});

describe('deterministic release-day gross', () => {
  it('the same draft released twice produces the exact same opening weekend (the audience simulation has no randomness)', () => {
    const stateA = buildStateWithReadyDraft(9);
    const stateB = buildStateWithReadyDraft(9);
    const afterA = studioReducer(stateA, { type: 'RELEASE_FILM' });
    const afterB = studioReducer(stateB, { type: 'RELEASE_FILM' });
    expect(afterA.studio.filmsReleased[0].results.openingWeekend).toBe(afterB.studio.filmsReleased[0].results.openingWeekend);
    expect(afterA.studio.filmsReleased[0].boxOfficeRun.fixed).toEqual(afterB.studio.filmsReleased[0].boxOfficeRun.fixed);
  });

  it('week 1 gross matches admissions * AVERAGE_TICKET_PRICE, rounded', () => {
    const state = buildStateWithReadyDraft(10);
    const after = studioReducer(state, { type: 'RELEASE_FILM' });
    const film = after.studio.filmsReleased[0];
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

  it('ordinary wizard navigation (START_NEW_FILM, GO_TO_STEP) clears both, not just viewingProductionId', () => {
    const afterStart = studioReducer(stateWithBothViewsSet(), { type: 'START_NEW_FILM' });
    expect(afterStart.viewingRivalStudioName).toBeNull();
    expect(afterStart.viewingProductionId).toBeNull();

    const withDraft = studioReducer(stateWithBothViewsSet(), { type: 'START_NEW_FILM' });
    const afterStep = studioReducer(withDraft, { type: 'GO_TO_STEP', step: 'talent' });
    expect(afterStep.viewingRivalStudioName).toBeNull();
    expect(afterStep.viewingProductionId).toBeNull();
  });

  it('RELEASE_FILM clears both (previously left them untouched, safe since the marketing screen is unreachable while either is set)', () => {
    const state = { ...buildStateWithReadyDraft(1), viewingRivalStudioName: 'A Rival Studio' };
    const after = studioReducer(state, { type: 'RELEASE_FILM' });
    expect(after.viewingRivalStudioName).toBeNull();
    expect(after.viewingProductionId).toBeNull();
  });
});
