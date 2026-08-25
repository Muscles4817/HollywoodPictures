// The ledger only works if the reducer actually carries it. The engine-side
// tests prove generation honours a set it is handed; these prove ADVANCE_DAY
// hands it the same one every day and stores what came back, which is the half
// that makes it a save-wide property rather than a per-call one.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import type { GameState } from './gameState';

function advance(state: GameState, days: number): GameState {
  let next = state;
  for (let i = 0; i < days; i++) next = studioReducer(next, { type: 'ADVANCE_DAY' });
  return next;
}

describe('GameState.usedSynopses', () => {
  it('accumulates as the market generates, and never loses what it had', () => {
    const start = buildStateWithReadyDraft(2024);
    expect(start.usedSynopses ?? []).toEqual([]);

    const afterOneWeek = advance(start, 8);
    const week1 = afterOneWeek.usedSynopses ?? [];
    expect(week1.length, 'a weekly batch should have recorded its log-lines').toBeGreaterThan(0);

    const afterThree = advance(afterOneWeek, 16);
    const week3 = afterThree.usedSynopses ?? [];
    expect(week3.length).toBeGreaterThan(week1.length);
    // Strictly additive - an entry recorded in week one is still there later.
    for (const synopsis of week1) expect(week3).toContain(synopsis);
  });

  it('holds no duplicates, which is the whole point of it', () => {
    const state = advance(buildStateWithReadyDraft(7), 60);
    const ledger = state.usedSynopses ?? [];
    expect(ledger.length).toBeGreaterThan(10);
    expect(new Set(ledger).size).toBe(ledger.length);
  });

  it('survives a state built without one - an absent ledger is empty, not broken', () => {
    const { usedSynopses: _dropped, ...withoutLedger } = buildStateWithReadyDraft(11);
    const next = advance(withoutLedger as GameState, 8);
    expect(next.usedSynopses ?? []).not.toHaveLength(0);
  });
});
