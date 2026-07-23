import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { getWriterCareer } from '../engine/person';
import { commissionFee } from '../engine/commission';
import type { GameState } from './gameState';

function richState(seed: number): GameState {
  const base = buildStateWithReadyDraft(seed);
  return { ...base, studio: { ...base.studio, cash: 50_000_000, pendingCommissions: [] } };
}

describe('COMMISSION_SCREENPLAY', () => {
  it('commissions a screenplay: charges the fee, books the writer, and stores a pending commission', () => {
    const state = richState(1);
    const writer = state.talentPool.Writer[0];
    const fee = commissionFee(getWriterCareer(writer)!.typicalSalary);

    const after = studioReducer(state, { type: 'COMMISSION_SCREENPLAY', writerId: writer.id, genre: 'Thriller' });

    expect(after.studio.pendingCommissions).toHaveLength(1);
    const commission = after.studio.pendingCommissions![0];
    expect(commission.genre).toBe('Thriller');
    expect(commission.script.genre).toBe('Thriller');
    expect(commission.writerId).toBe(writer.id);
    expect(commission.readyOnDay).toBeGreaterThan(state.totalDays);
    expect(after.studio.cash).toBe(state.studio.cash - fee);

    const bookedWriter = after.talentPool.Writer.find((w) => w.id === writer.id)!;
    expect(bookedWriter.availability.commitments.length).toBeGreaterThan(0);
  });

  it('is a no-op when unaffordable or the writer is unknown', () => {
    const state = richState(2);
    const poor: GameState = { ...state, studio: { ...state.studio, cash: 0 } };
    expect(studioReducer(poor, { type: 'COMMISSION_SCREENPLAY', writerId: state.talentPool.Writer[0].id, genre: 'Drama' })).toBe(poor);
    expect(studioReducer(state, { type: 'COMMISSION_SCREENPLAY', writerId: 'nobody', genre: 'Drama' })).toBe(state);
  });

  it('delivers the commissioned screenplay as a new owned Asset when the term completes', () => {
    const state = richState(3);
    const writer = state.talentPool.Writer[0];
    let s = studioReducer(state, { type: 'COMMISSION_SCREENPLAY', writerId: writer.id, genre: 'Sci-Fi' });
    const commission = s.studio.pendingCommissions![0];
    const assetCountBefore = s.studio.assets.length;

    for (let day = s.totalDays; day <= commission.readyOnDay + 1; day++) s = studioReducer(s, { type: 'ADVANCE_DAY' });

    expect(s.studio.pendingCommissions ?? []).toHaveLength(0);
    const delivered = s.studio.assets.find((a) => a.id === commission.id);
    expect(delivered).toBeDefined();
    expect(delivered!.source).toBe('Studio Original');
    expect(delivered!.script.genre).toBe('Sci-Fi');
    expect(delivered!.writerIds).toContain(writer.id);
    // Net asset growth includes the delivered commission (plus any market batch,
    // which is fine - the point is our commission landed as an owned asset).
    expect(s.studio.assets.length).toBeGreaterThan(assetCountBefore);
  });
});
