import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { getWriterCareer } from '../engine/person';
import { commissionFee } from '../engine/commission';
import type { GameState } from './gameState';

function richState(seed: number): GameState {
  const base = buildStateWithReadyDraft(seed);
  return { ...base, studio: { ...base.studio, cash: 50_000_000, pendingCommissions: [], cashLedger: [] } };
}

// The ledger is the durable trail behind the Dashboard cash tile, so it must
// actually get written when the reducer moves money - the unit tests in
// cashLedger.test.ts prove recordCashChange itself, this proves it's wired in.
describe('cash ledger wiring', () => {
  it('COMMISSION_SCREENPLAY records the fee as an outgoing "commission" entry', () => {
    const state = richState(1);
    const writer = state.talentPool.Writer[0];
    const fee = commissionFee(getWriterCareer(writer)!.typicalSalary);

    const after = studioReducer(state, { type: 'COMMISSION_SCREENPLAY', writerId: writer.id, genre: 'Thriller' });

    const ledger = after.studio.cashLedger ?? [];
    expect(ledger).toHaveLength(1);
    expect(ledger[0].category).toBe('commission');
    expect(ledger[0].amount).toBe(-fee);
    expect(ledger[0].day).toBe(state.totalDays);
    expect(ledger[0].reason).toContain(writer.identity.name);
  });

  it('does not touch the ledger on a no-op (unaffordable) action', () => {
    const state = richState(2);
    const poor: GameState = { ...state, studio: { ...state.studio, cash: 0 } };
    const after = studioReducer(poor, { type: 'COMMISSION_SCREENPLAY', writerId: state.talentPool.Writer[0].id, genre: 'Drama' });
    expect(after).toBe(poor);
    expect(after.studio.cashLedger).toEqual([]);
  });
});
