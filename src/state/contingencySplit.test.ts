// Money model §8 (docs/DESIGN_REVIEW_production_redesign.md): the Shooting Budget
// funds the shoot; the Contingency Reserve is a genuine buffer that is only
// consumed by overage (running past the recommended schedule) and refunded in
// full when the shoot stays on schedule. The wrap settlement reconciles the
// committed pool (shooting budget + reserve, both deducted up front) against
// what was actually burned.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { deriveGreenlightCommitment, computeCommittedSpend } from './selectors';
import { playerDraftToProject, asPlayerDraft } from '../engine/project';
import type { GameState, GameAction } from './gameState';
import type { FilmDraft, PhotographyState, ProductionChoices } from '../types';

const SHOOTING_BUDGET = 2_000_000;
const RESERVE = 800_000;
const RECOMMENDED_DAYS = 40;

const choices = (reserve = RESERVE): ProductionChoices => ({
  shootingBudgetAmount: SHOOTING_BUDGET,
  contingencyReserveAmount: reserve,
  setQualityAmount: 500_000,
  practicalEffectsAmount: 300_000,
  vfxAmount: 200_000,
  runtimeIntensity: 0.5,
});

/** A focused, mid-shoot state: photography in-progress with a hand-set runningCost, past the footage floor so FINISH_PHOTOGRAPHY is allowed. */
function midShootState(runningCost: number, reserve = RESERVE): GameState {
  const base = buildStateWithReadyDraft(1);
  const draft = asPlayerDraft(base.projects[0])!;
  const photography: PhotographyState = {
    status: 'in-progress',
    recommendedDays: RECOMMENDED_DAYS,
    daysElapsed: RECOMMENDED_DAYS,
    events: [],
    runningCost,
    pendingChoice: null,
  };
  const shooting: FilmDraft = { ...draft, productionChoices: choices(reserve), photography, postProductionScreeningReadyDay: null };
  return { ...base, screen: 'production', projects: [playerDraftToProject(shooting)], focusedProjectId: shooting.id };
}

const finish = (state: GameState): GameState =>
  studioReducer(state, { type: 'FINISH_PHOTOGRAPHY', productionId: state.focusedProjectId } as GameAction);

describe('the Contingency Reserve is untouched by a clean shoot', () => {
  it('an on-schedule shoot (runningCost == shooting budget) refunds the whole reserve', () => {
    const state = midShootState(SHOOTING_BUDGET); // burned exactly the shooting budget, no overrun
    const after = finish(state);
    // Committed pool = shooting budget + reserve; burned = shooting budget; so the
    // full reserve comes back and nothing else.
    expect(after.studio.cash - state.studio.cash).toBe(RESERVE);
  });

  it('under-running (wrapped early) refunds the unspent shooting budget PLUS the whole reserve', () => {
    const state = midShootState(SHOOTING_BUDGET - 500_000);
    const after = finish(state);
    expect(after.studio.cash - state.studio.cash).toBe(500_000 + RESERVE);
  });
});

describe('the Contingency Reserve absorbs overage', () => {
  it('a modest overrun eats into the reserve but leaves the rest to refund', () => {
    const overrun = 500_000;
    const state = midShootState(SHOOTING_BUDGET + overrun);
    const after = finish(state);
    // Reserve absorbs the 500k overrun; 300k of the 800k reserve is refunded.
    expect(after.studio.cash - state.studio.cash).toBe(RESERVE - overrun);
  });

  it('blowing through the reserve charges the excess from studio cash', () => {
    const overrun = 1_000_000; // exceeds the 800k reserve by 200k
    const state = midShootState(SHOOTING_BUDGET + overrun);
    const after = finish(state);
    expect(after.studio.cash - state.studio.cash).toBe(RESERVE - overrun); // negative: a 200k charge
  });

  it('with NO reserve, any overrun is charged straight to cash (the old behaviour)', () => {
    const overrun = 300_000;
    const state = midShootState(SHOOTING_BUDGET + overrun, 0);
    const after = finish(state);
    expect(after.studio.cash - state.studio.cash).toBe(-overrun);
  });
});

describe('the reserve is committed up front and shown in the forecast', () => {
  it('deriveGreenlightCommitment and computeCommittedSpend both include the reserve', () => {
    const base = buildStateWithReadyDraft(1);
    const draft: FilmDraft = { ...asPlayerDraft(base.projects[0])!, productionChoices: choices(), photography: null };
    const commitment = deriveGreenlightCommitment(draft, 50_000_000);
    expect(commitment.contingency).toBe(SHOOTING_BUDGET + RESERVE);

    const withReserve = computeCommittedSpend(draft);
    const withoutReserve = computeCommittedSpend({ ...draft, productionChoices: choices(0) });
    expect(withReserve - withoutReserve).toBe(RESERVE);
  });
});
