import { computeProfitRatio } from './outcome';
import { clamp } from './random';

// Milestone: replaces the old single Reputation stat with two independent
// long-term progression stats (docs/DESIGN.md) - a studio's real-world
// reputation isn't one thing (Disney/Blumhouse: high Brand, lower
// Prestige; A24: the reverse; a new indie studio: low in both), and the
// old single `computeReputationChange(outcome, criticScore)` conflated
// them: OutcomeLabel already blends profit and critic/quality signals
// into one lossy category (e.g. "Hit" discards audienceScore entirely,
// "Masterpiece" discards profitRatio entirely), and the old formula then
// added a criticScore adjustment on top of *that* - the same critical-
// reception signal partially doing two jobs (helping decide the label,
// then nudging its own delta again) while never being tracked on its own.
// Brand and Prestige below are each computed straight from the underlying
// numbers (profitRatio, audienceScore, criticScore) rather than through
// OutcomeLabel, so nothing is lost translating through the category first
// - engine/outcome.ts's OutcomeLabel itself is untouched, still the
// player-facing narrative label ("Flop"/"Masterpiece"/...), just no
// longer what reputation math is computed *from*.

const BRAND_FLOP_DELTA = -8;
const BRAND_WEAK_DELTA = -2;
const BRAND_MODEST_DELTA = 3;
const BRAND_HIT_DELTA = 7;
const BRAND_BLOCKBUSTER_DELTA = 11;

/**
 * Brand Recognition change - how well known and commercially bankable the
 * studio is. Driven by commercial performance (profitRatio, banded to
 * mirror engine/outcome.ts:determineOutcome's own commercial-scale
 * thresholds - deliberately *not* going through OutcomeLabel itself, see
 * this module's header) plus a modest audience-approval nudge - people
 * who saw it liking it builds brand loyalty beyond the raw profit number
 * alone. Never reads criticScore: a profitable-but-panned film still
 * grows Brand (that's Prestige's loss to take, not Brand's), and Brand
 * deliberately has no "Masterpiece" tier the way the old single-stat
 * formula did - a beloved, low-budget arthouse hit growing Brand as much
 * as a true blockbuster would blur the exact distinction Brand/Prestige
 * exists to draw.
 */
export function computeBrandChange(profit: number, totalCost: number, audienceScore: number): number {
  const profitRatio = computeProfitRatio(profit, totalCost);
  const base =
    profitRatio <= -0.3 ? BRAND_FLOP_DELTA :
    profitRatio < 0.15 ? BRAND_WEAK_DELTA :
    profitRatio < 0.8 ? BRAND_MODEST_DELTA :
    profitRatio <= 2.5 ? BRAND_HIT_DELTA :
    BRAND_BLOCKBUSTER_DELTA;
  const audienceAdjustment = Math.round((audienceScore - 50) / 20); // -2..+2
  return base + audienceAdjustment;
}

/**
 * Prestige change - how respected the studio is within the industry and by
 * critics. Driven by criticScore alone, deliberately independent of profit
 * or audience score: a beloved-but-unprofitable film ("Cult Hit"-shaped,
 * in OutcomeLabel terms) still builds real Prestige; a profitable-but-panned
 * one erodes it regardless of how much money it made. Symmetric around a
 * criticScore of 50 (a genuinely average review), same shape as the old
 * formula's own critic adjustment, just no longer riding on top of an
 * outcome-label delta that was itself already partly critic-driven.
 */
export function computePrestigeChange(criticScore: number): number {
  // `+ 0` normalizes a `-0` result (criticScore just under 50) to `0` -
  // otherwise harmless, but JSON.stringify/parse (state/persistence.ts)
  // silently turns -0 into 0 on save/reload, which fails a strict toEqual
  // in state/persistence.test.ts even though nothing actually changed.
  return Math.round((criticScore - 50) / 5) + 0; // -10..+10
}

export function applyStatChange(current: number, change: number): number {
  return clamp(current + change, 0, 100);
}
