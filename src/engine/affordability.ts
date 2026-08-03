// Reserve-aware affordability - whether an outlay is COMFORTABLY affordable, not
// merely "does the balance cover it."
//
// The problem this addresses (user report): every affordability filter and
// budget dot in the UI keyed off a bare `cost <= cash` (or `<= remainingBudget`)
// comparison. That calls a pick "affordable" the moment the balance can cover
// it in full - even when paying for it would drain the studio to nothing. In
// reality nobody sinks their whole treasury (or even half of it) into a single
// hire, so the signal was useless: an "affordable only" toggle that hid nothing
// a reasonable player would ever consider unaffordable.
//
// This centralises one honest, reserve-aware read every filter and dot shares:
// a cost is only "comfortable" if paying it leaves a prudent operating reserve
// intact. The hard transaction guards (can you literally pay?) stay where they
// are, in the reducer and the greenlight/commit gates - this is the advisory
// layer that sits above them, so the player still keeps the freedom to spend big
// on purpose; the read just stops pretending that's the safe default.
//
// Pure: plain numbers in, a verdict out. All constants are first-draft, tunable.

// The operating reserve a prudent studio keeps back rather than spending down to
// zero on one commitment. Half of current cash by default - so a single outlay
// reads "comfortable" only up to (roughly) the other half - floored so a small
// studio still keeps something real in the bank. No ceiling: the fraction scales
// with cash on its own, so a large treasury naturally keeps a large cushion.
export const RESERVE_FRACTION = 0.5;
export const RESERVE_FLOOR = 500_000;

/** The cash a studio should keep in reserve rather than commit to a single outlay - a fraction of current cash, floored, never more than the cash itself. */
export function operatingReserve(cash: number): number {
  if (cash <= 0) return 0;
  return Math.min(cash, Math.max(RESERVE_FLOOR, cash * RESERVE_FRACTION));
}

/**
 * How an outlay sits against the studio's means:
 *   - `comfortable` - paying it leaves the operating reserve intact.
 *   - `tight`       - the balance covers it, but only by eating into the reserve.
 *   - `unaffordable`- the funds available can't cover it at all.
 */
export type AffordabilityTier = 'comfortable' | 'tight' | 'unaffordable';

export interface AffordabilityInput {
  /** The outlay being judged - a salary, a fee, a bid. */
  cost: number;
  /** Funds actually available for this outlay: the studio's cash, less anything already committed against the same budget, plus anything this action would free. For a standalone buy this is just the studio's cash. */
  available: number;
  /** The studio's total cash on hand - sets the size of the reserve to keep back. Defaults to `available` when the outlay isn't nested inside a larger committed budget. */
  cash?: number;
}

/** Where an outlay falls on the comfortable/tight/unaffordable scale (see AffordabilityTier). */
export function affordabilityTier({ cost, available, cash }: AffordabilityInput): AffordabilityTier {
  if (cost > available) return 'unaffordable';
  const reserve = operatingReserve(cash ?? available);
  return cost <= available - reserve ? 'comfortable' : 'tight';
}

/** The reserve-aware "can we comfortably afford this?" the affordability filters read - true only when the outlay leaves the operating reserve intact. */
export function canComfortablyAfford(input: AffordabilityInput): boolean {
  return affordabilityTier(input) === 'comfortable';
}

/** The short, qualitative budget read shown on a candidate/writer card, per house style - never a raw figure. */
export const AFFORDABILITY_LABEL: Record<AffordabilityTier, string> = {
  comfortable: 'Within budget',
  tight: 'Stretches your cash',
  unaffordable: 'Over budget',
};
