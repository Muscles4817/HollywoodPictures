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

interface BrandChangeInputs {
  profit: number;
  totalCost: number;
  totalBoxOffice: number;
  audienceScore: number;
}


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
export function computeBrandChange({
  profit,
  totalCost,
  totalBoxOffice,
  audienceScore,
}: BrandChangeInputs): number {
  const profitRatio = computeProfitRatio(
    profit,
    totalCost,
  );

  const profitabilityChange =
    profitRatio <= -0.5
      ? -8
      : profitRatio < 0.1
        ? -2
        : profitRatio < 0.5
          ? 2
          : profitRatio < 1.25
            ? 5
            : 7;

  const reachChange =
    totalBoxOffice >= 750_000_000
      ? 6
      : totalBoxOffice >= 250_000_000
        ? 4
        : totalBoxOffice >= 100_000_000
          ? 2
          : totalBoxOffice >= 30_000_000
            ? 1
            : 0;

  const audienceAdjustment = clampInteger(
    Math.round((audienceScore - 50) / 15),
    -3,
    3,
  );

  return (
    profitabilityChange +
    reachChange +
    audienceAdjustment
  );
}

function clampInteger(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.max(
    minimum,
    Math.min(maximum, value),
  );
}

interface PrestigeChangeInputs {
  criticScore: number;
  qualityScore: number;
}


/**
 * Prestige change - how respected the studio is within the industry and by
 * critics. Driven by critical/craft reception alone, deliberately
 * independent of profit or audience score: a beloved-but-unprofitable film
 * ("Cult Hit"-shaped, in OutcomeLabel terms) still builds real Prestige; a
 * profitable-but-panned one erodes it regardless of how much money it made.
 * The signal blends criticScore (75%) with qualityScore (25%) rather than
 * criticScore alone, so genuine craft still counts for something even when
 * critics under- or over-shoot it. Banded around a signal of 50 (a
 * genuinely average reception), but *not* symmetric - the bands step down
 * faster below 50 than they step up above it (e.g. a signal of 40 costs -1,
 * while the mirror-image 60 is still within the 0 band), so a mediocre film
 * loses Prestige noticeably faster than an equally-mediocre-but-good film
 * gains it.
 */
export function computePrestigeChange({
  criticScore,
  qualityScore,
}: PrestigeChangeInputs): number {
  const prestigeSignal =
    criticScore * 0.75 +
    qualityScore * 0.25;

  if (prestigeSignal < 25) {
    return -6;
  }

  if (prestigeSignal < 40) {
    return -3;
  }

  if (prestigeSignal < 50) {
    return -1;
  }

  if (prestigeSignal < 65) {
    return 0;
  }

  if (prestigeSignal < 75) {
    return 1;
  }

  if (prestigeSignal < 85) {
    return 2;
  }

  if (prestigeSignal < 92) {
    return 3;
  }

  return 4;
}

export function applyStatChange(current: number, change: number): number {
  return clamp(current + change, 0, 100);
}
