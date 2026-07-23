// The append-only "Recent budget activity" ledger (see types/index.ts:
// CashLedgerEntry). recordCashChange is the single seam every notable
// studio-level cash movement goes through, so the money that moved and the
// reason it moved are recorded together - the player can then open the cash
// tile and see "Academy Awards prize money +£1.2m" instead of a mystery spike.
import type { CashLedgerCategory, GameDay, Money, Studio } from '../types';

/** Only the most recent movements are kept - the view is "what changed lately", not a full account history. */
export const CASH_LEDGER_CAP = 60;

/**
 * Adjust a studio's cash by `amount` (signed: negative charges, positive
 * credits) AND record why, returning a new Studio. A zero amount is a no-op
 * (no cash change, no entry). The ledger is capped to the most recent
 * CASH_LEDGER_CAP entries so it can't grow without bound.
 */
export function recordCashChange(studio: Studio, day: GameDay, amount: Money, category: CashLedgerCategory, reason: string): Studio {
  if (amount === 0) return studio;
  const ledger = [...(studio.cashLedger ?? []), { day, amount, category, reason }];
  return {
    ...studio,
    cash: studio.cash + amount,
    cashLedger: ledger.length > CASH_LEDGER_CAP ? ledger.slice(-CASH_LEDGER_CAP) : ledger,
  };
}
