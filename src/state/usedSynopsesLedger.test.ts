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

  it('records every opportunity on the board, whichever action generated it', () => {
    // The invariant, rather than a per-action test. Nine of the ten reducer
    // branches that write the ledger back are NOT ADVANCE_DAY - prep days, shoot
    // days, scheduling a release all run the same calendar settlement and all
    // generate market batches - and every one of them was deletable with the
    // whole suite green.
    //
    // Asserting board-against-ledger catches the class without needing to know
    // which action produced which opportunity: anything a settlement handed to
    // the market must also have been handed to the ledger, or it is free to come
    // back later.
    let state = buildStateWithReadyDraft(2024);
    for (let i = 0; i < 20; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    const beforeCount = (state.usedSynopses ?? []).length;

    // Forced rather than hoped for: the weekly batch only generates when the
    // timer is due, so an interleaved action lands on one only by luck - and by
    // luck it did not, which is why the first version of this test passed with
    // all nine write-backs deleted. Making the timer due NOW guarantees the
    // settlement inside SCHEDULE_RELEASE generates a batch, which is the only
    // way a non-ADVANCE_DAY write-back can be observed at all.
    state = studioReducer({ ...state, nextOpportunityCheckDay: state.totalDays }, { type: 'SCHEDULE_RELEASE', releaseDay: state.totalDays + 200 });
    expect((state.usedSynopses ?? []).length, 'SCHEDULE_RELEASE generated a batch and must record it').toBeGreaterThan(beforeCount);

    const ledger = new Set(state.usedSynopses ?? []);
    expect(state.opportunities.length, 'the market should have listings by now').toBeGreaterThan(0);
    for (const opportunity of state.opportunities) {
      expect(ledger.has(opportunity.script.synopsis), `on the board but never recorded: "${opportunity.script.synopsis.slice(0, 60)}"`).toBe(true);
    }
  });

  it('is shared with commissions, so a paid-for script cannot arrive as a repeat', () => {
    // The commission path was fully revertible with the suite green. It is the
    // one place a player has spent real money on a screenplay, which makes it
    // the worst place to hand back a log-line the market already showed them.
    const state = advance(buildStateWithReadyDraft(31), 20);
    const before = state.usedSynopses ?? [];
    const writer = state.talentPool.Writer[0];
    expect(writer, 'fixture should have a writer to commission').toBeDefined();

    const rich = { ...state, studio: { ...state.studio, cash: 500_000_000 } };
    const after = studioReducer(rich, { type: 'COMMISSION_SCREENPLAY', writerId: writer!.id, genre: 'Drama' });
    expect(after.studio.pendingCommissions?.length ?? 0, 'commission should have been accepted').toBeGreaterThan(0);

    const ledger = after.usedSynopses ?? [];
    expect(ledger.length, 'the commissioned log-line must be recorded').toBe(before.length + 1);
    const commissioned = after.studio.pendingCommissions!.at(-1)!.script.synopsis;
    expect(ledger).toContain(commissioned);
    expect(before).not.toContain(commissioned);
  });
});
