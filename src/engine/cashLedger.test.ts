import { describe, it, expect } from 'vitest';
import { recordCashChange, CASH_LEDGER_CAP } from './cashLedger';
import type { Studio } from '../types';

// Minimal studio - recordCashChange only touches .cash and .cashLedger.
function studio(cash: number, ledger?: Studio['cashLedger']): Studio {
  return { cash, ...(ledger ? { cashLedger: ledger } : {}) } as unknown as Studio;
}

describe('recordCashChange', () => {
  it('applies the delta AND appends a matching ledger entry', () => {
    const next = recordCashChange(studio(1000), 5, -300, 'acquisition', 'Bought a script');
    expect(next.cash).toBe(700);
    expect(next.cashLedger).toEqual([{ day: 5, amount: -300, category: 'acquisition', reason: 'Bought a script' }]);
  });

  it('credits positive amounts (money in)', () => {
    const next = recordCashChange(studio(1000), 9, 250, 'awards', 'Prize money');
    expect(next.cash).toBe(1250);
    expect(next.cashLedger).toHaveLength(1);
    expect(next.cashLedger![0].amount).toBe(250);
  });

  it('is a no-op for a zero amount - no cash change, no entry', () => {
    const before = studio(1000);
    const next = recordCashChange(before, 3, 0, 'other', 'nothing');
    expect(next).toBe(before);
  });

  it('does not mutate the input studio', () => {
    const before = studio(1000, []);
    const originalLedger = before.cashLedger;
    recordCashChange(before, 1, -10, 'production', 'x');
    expect(before.cash).toBe(1000);
    expect(before.cashLedger).toBe(originalLedger);
    expect(before.cashLedger).toHaveLength(0);
  });

  it('appends most-recent-last onto an existing ledger', () => {
    const first = recordCashChange(studio(1000), 1, -100, 'acquisition', 'a');
    const second = recordCashChange(first, 2, -50, 'rewrite', 'b');
    expect(second.cashLedger!.map((e) => e.reason)).toEqual(['a', 'b']);
  });

  it('caps the ledger to the most recent CASH_LEDGER_CAP entries', () => {
    let s = studio(1_000_000);
    for (let i = 0; i < CASH_LEDGER_CAP + 20; i++) {
      s = recordCashChange(s, i, -1, 'other', `entry ${i}`);
    }
    expect(s.cashLedger).toHaveLength(CASH_LEDGER_CAP);
    // The oldest 20 were dropped; the newest is the last one written.
    expect(s.cashLedger![0].reason).toBe('entry 20');
    expect(s.cashLedger![CASH_LEDGER_CAP - 1].reason).toBe(`entry ${CASH_LEDGER_CAP + 19}`);
  });
});
