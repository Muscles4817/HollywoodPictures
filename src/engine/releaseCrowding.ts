import type { Film, Genre, ProductionScale, TargetAudience } from '../types';
import { logT, type Range } from './interpolate';
import { MARKETING_SPEND_RANGE } from '../data/release';
import { computeRunningFilmStrength } from './audienceSimulationStep';

/**
 * One other release already on the shared calendar - either a player's own
 * scheduled project or a rival's in-progress production - reduced to just
 * what computeCompetitiveCrowding needs to weigh it: when, what kind of
 * film, and how strong a showing it's shaping up to be. Never a released
 * Film - crowding only ever concerns itself with what's still upcoming
 * (engine/rivalStudios.ts:avoidReleaseDayClustering already established
 * this convention for its own knownReleaseDays list).
 */
export interface UpcomingRelease {
  releaseDay: number;
  genre: Genre;
  targetAudience: TargetAudience;
  strength: number;
}

// How many days on either side of a candidate day a competing release still
// meaningfully fights for the same audience - roughly a month and a half,
// wide enough to cover "opened three weeks ago and is still strong" and
// "opens three weeks from now and is already stealing pre-release buzz."
// First-draft, tunable (see engine/calendar.ts:MONTH_RELEASE_WINDOWS's own
// note - this whole feature's numeric constants want a balance pass after
// playtesting).
const CROWDING_WINDOW_DAYS = 45;

// A competing release in the same Genre is treated as full-strength
// competition; a different genre still competes for some of the same
// screens/attention (two Wide releases the same weekend both want the same
// multiplexes, regardless of what's actually playing), just far less -
// matches AUDIENCE_MISMATCH_PENALTY's own binary-not-distance style
// (engine/audienceSimulationInputs.ts) rather than inventing a continuous
// genre-similarity metric with nothing to calibrate it against.
const GENRE_MATCH_WEIGHT = 1.0;
const GENRE_MISMATCH_WEIGHT = 0.15;
// An additive bonus (not a separate multiplicative axis) when the
// competing release also shares this film's TargetAudience - the two
// overlaps compound rather than needing independent normalization.
const AUDIENCE_MATCH_BONUS = 0.3;

/**
 * How competitive a candidate release day is, 0 (wide open) to 1 (maximally
 * crowded) - the single source of truth used identically for the rival AI's
 * own day-picking (engine/rivalStudios.ts), the box-office availability
 * penalty (engine/scheduledReleases.ts, resolveRivalProduction), and the
 * player-facing warning (components/wizard/MarketingRelease.tsx). Pure and
 * rng-free by design, same discipline avoidReleaseDayClustering already
 * had - the result only ever depends on its arguments, never a hidden
 * source of randomness, so it can be called from a rendering component
 * exactly as freely as from a settlement function.
 */
export function computeCompetitiveCrowding(
  candidate: Omit<UpcomingRelease, 'strength'>,
  known: UpcomingRelease[],
): number {
  const total = known.reduce((sum, other) => {
    const daysApart = Math.abs(candidate.releaseDay - other.releaseDay);
    const proximity = Math.max(0, 1 - daysApart / CROWDING_WINDOW_DAYS);
    if (proximity === 0) return sum;

    const genreOverlap = candidate.genre === other.genre ? GENRE_MATCH_WEIGHT : GENRE_MISMATCH_WEIGHT;
    const audienceBonus = candidate.targetAudience === other.targetAudience ? AUDIENCE_MATCH_BONUS : 0;

    return sum + proximity * (genreOverlap + audienceBonus) * other.strength;
  }, 0);

  // Several strong, close, same-genre competitors saturate the penalty
  // rather than compounding past it - crowding is a fraction of screen
  // access lost, it can't take away more than all of it.
  return Math.max(0, Math.min(1, total));
}

function marketingStrengthFraction(marketingSpend: number): number {
  return logT(marketingSpend, MARKETING_SPEND_RANGE);
}

const SCALE_STRENGTH: Record<ProductionScale, number> = {
  Small: 0.2,
  Medium: 0.5,
  Big: 0.9,
};

// A rough normalization range for computeProductionBudgetCost's output
// (engine/cost.ts - the sum of setQualityAmount/practicalEffectsAmount/
// vfxAmount, each independently log-ranged in data/production.ts) - doesn't
// need to be exact, only wide enough that logT's own clamping keeps a
// realistic budget somewhere in the middle of the curve rather than pinned
// to one end.
const PRODUCTION_BUDGET_STRENGTH_RANGE: Range = { min: 100_000, max: 200_000_000 };

// Both proxies below deliberately land in the same normalized 0-1 space
// (0.7 marketing weight + 0.3 "how big a production is this" weight) so a
// rival and a player compete on equal footing - a mismatched proxy shape
// would silently bias crowding toward whichever side's number happens to
// run hotter.

/** A not-yet-released rival production's rough competitive strength - engine/rivalStudios.ts has no simulated box office for it yet to rank by, so this stands in for one. */
export function computeRivalReleaseStrength(marketingSpend: number, scale: ProductionScale): number {
  return Math.max(0, Math.min(1, 0.7 * marketingStrengthFraction(marketingSpend) + 0.3 * SCALE_STRENGTH[scale]));
}

/** A player's own scheduled draft's rough competitive strength - the same shape as computeRivalReleaseStrength, substituting production budget (players have no ProductionScale) for scale. */
export function computePlayerReleaseStrength(marketingSpend: number, productionBudgetCost: number): number {
  return Math.max(
    0,
    Math.min(1, 0.7 * marketingStrengthFraction(marketingSpend) + 0.3 * logT(productionBudgetCost, PRODUCTION_BUDGET_STRENGTH_RANGE)),
  );
}

/**
 * A *currently-running* film's own live competitive strength - the third
 * way to build an UpcomingRelease, alongside computeRivalReleaseStrength/
 * computePlayerReleaseStrength above (both pre-release proxies for a
 * production that hasn't opened yet). engine/marketSettlement.ts calls this
 * fresh every settled week for every still-running film, so a film's pull
 * on its competitors' screen access evolves with its *actual* performance
 * instead of a one-time snapshot frozen at release - see
 * engine/audienceSimulationStep.ts:computeRunningFilmStrength's own doc
 * comment for why this is a derived read of the film's own weekly history,
 * not a new stored field (DESIGN.md 5.34's "Momentum" rejection).
 *
 * Zero for a film with no settled week yet (simWeeks.length === 0) - a
 * film that opened *this same week* hasn't sold a single ticket yet, so it
 * has no real performance to be pulling screens with; its pull on siblings
 * starts as soon as it has its own first settled week, using everything
 * settled so far (asOfWeekIndex = simWeeks.length, not simWeeks.length - 1 -
 * matching exactly how computeCurrentWomInfluence reads a film's own
 * history for its own next-week transition, e.g.
 * computeCurrentWomInfluence(fixed, weeks, weeks.length) inside
 * advanceOneWeekWithDiagnostics: deriveWordOfMouthActivity's own
 * asOfWeekIndex means "looking back from just before this index," so
 * simWeeks.length - 1 would exclude the film's own most-recent settled
 * week entirely - silently zero for any film with fewer than two settled
 * weeks). Its own opening-week access is still shaped by the existing
 * one-time computeCompetitiveCrowding dent at resolution
 * (engine/releaseFilm.ts:computeReleaseResults), unchanged - this function
 * only concerns itself with a running film's *ongoing* pull on others.
 */
export function runningFilmAsUpcomingRelease(film: Film): UpcomingRelease | null {
  const { simWeeks, fixed } = film.boxOfficeRun;
  if (simWeeks.length === 0) return null;
  return {
    releaseDay: film.releasedOnDay,
    genre: film.genre,
    targetAudience: film.targetAudience,
    strength: computeRunningFilmStrength(fixed, simWeeks, simWeeks.length),
  };
}
