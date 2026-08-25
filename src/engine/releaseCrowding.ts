import type { Film, Genre, ProductionScale, TargetAudience } from '../types';
import { logT, type Range } from './interpolate';
import { liftTowardCeiling, statAsUnit, unit, type Unit } from './bounded';
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
export const CROWDING_WINDOW_DAYS = 45;

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
  candidateStrength?: number,
): number {
  return crowdingFromPressure(computeCrowdingPressure(candidate, known, candidateStrength));
}

/**
 * The raw, UNBOUNDED competitive pressure on a candidate day - the sum before
 * it is squashed into a 0-1 fraction of lost screen access. Exported for the
 * diagnostic harness (engine/releaseCrowding.diagnostic.test.ts), which needs to
 * see the distribution before saturation to tell a genuinely contested day from
 * a ruinous one.
 */
export function computeCrowdingPressure(
  candidate: Omit<UpcomingRelease, 'strength'>,
  known: UpcomingRelease[],
  candidateStrength?: number,
): number {
  return known.reduce((sum, other) => {
    const daysApart = Math.abs(candidate.releaseDay - other.releaseDay);
    const proximity = Math.max(0, 1 - daysApart / CROWDING_WINDOW_DAYS);
    if (proximity === 0) return sum;

    const genreOverlap = candidate.genre === other.genre ? GENRE_MATCH_WEIGHT : GENRE_MISMATCH_WEIGHT;
    const audienceBonus = candidate.targetAudience === other.targetAudience ? AUDIENCE_MATCH_BONUS : 0;

    return sum + proximity * (genreOverlap + audienceBonus) * other.strength * matchupWeight(candidateStrength, other.strength);
  }, 0);
}

// --- Naming the competition -------------------------------------------------
//
// The band alone ("Crowded") says how much, never who. That matters because the
// model is RELATIVE: matchupWeight decides whether this film is the one being
// pushed out or the one doing the pushing, so two identically-"Crowded" dates
// can be a tentpole you cannot beat and three mid-size films you can
// counterprogram straight past - opposite decisions behind one word.
//
// Everything below is already computed inside computeCrowdingPressure's own
// reduce and then thrown away. None of this is a new rule; it is the same
// arithmetic with the breakdown kept.

/** How this film measures up to one competitor, from matchupWeight's own share-of-strength. */
export type CrowdingMatchup = 'outmatched' | 'even' | 'dominant';

// matchupWeight returns 0 (we displace them entirely) to 2 (they displace us
// twice over), with 1 the evenly-matched case. These split it where the
// player's decision actually changes.
const OUTMATCHED_AT = 1.15;
const DOMINANT_BELOW = 0.85;

export interface CrowdingContributor {
  /** Index into the `known` array this was computed from - the caller zips its own identity back on. */
  index: number;
  release: UpcomingRelease;
  /** Raw pressure this one competitor contributes. */
  pressure: number;
  /** Its share of the total pressure, 0-1 - what makes one competitor "the reason" for a band. */
  share: number;
  matchup: CrowdingMatchup;
  sameGenre: boolean;
  sameAudience: boolean;
  daysApart: number;
}

export interface CrowdingExplanation {
  crowding: number;
  pressure: number;
  /** Every competitor with a non-zero contribution, strongest first. */
  contributors: CrowdingContributor[];
  /**
   * True when NOTHING could be known this far ahead - the whole crowding window
   * sits past the furthest release anyone has scheduled or begun.
   *
   * This is the difference between an empty frame and an empty map, and it is
   * not decoration: measured over two simulated in-game years, the furthest
   * knowable rival release sat 356 days out while the announcement grid offers
   * eighteen months and more. Every month past that read "Clear window" with
   * exactly the confidence of a month whose field is genuinely surveyed, which
   * pushed the player toward distant dates on evidence that does not exist.
   */
  beyondKnownField: boolean;
}

/**
 * The furthest day the board reaches. Past this, crowding is silence rather than
 * good news.
 *
 * Callers should pass only what tells them about the MARKET - other studios'
 * slates. A studio's own announcement three years out says nothing whatsoever
 * about who else will be opening then, so counting it would push the horizon out
 * and quietly restore the confident "Clear window" this exists to prevent. That
 * is not hypothetical: the player's own films are in the same `known` list the
 * pressure sum reads, so the naive version silenced itself the moment the player
 * announced anything long-range.
 */
export function crowdingHorizon(known: UpcomingRelease[]): number | null {
  return known.length === 0 ? null : Math.max(...known.map((k) => k.releaseDay));
}

/**
 * Whether a candidate day's whole competitive window sits past everything
 * knowable. Uses the same CROWDING_WINDOW_DAYS the pressure sum does, so the
 * question is exactly "could any competitor have counted here?" rather than a
 * separate rule of thumb.
 *
 * `horizon` is passed in rather than derived from `known` because the two lists
 * are not the same question: `known` is everything that would crowd this date
 * (the studio's own films included - two of your own films do split a crowd),
 * while the horizon is how far the OTHER studios' slate reaches. See
 * crowdingHorizon above.
 */
export function beyondKnownField(day: number, horizon: number | null): boolean {
  return horizon === null || day - CROWDING_WINDOW_DAYS > horizon;
}

/** The crowding on a candidate day, plus who is causing it and how this film measures up to each of them. */
export function explainCrowding(
  candidate: Omit<UpcomingRelease, 'strength'>,
  known: UpcomingRelease[],
  candidateStrength?: number,
  /** How far the rest of the industry's slate reaches - see beyondKnownField. Defaults to the whole board, which is only right when `known` holds no films of the asking studio's own. */
  horizon: number | null = crowdingHorizon(known),
): CrowdingExplanation {
  const contributors: CrowdingContributor[] = [];
  known.forEach((other, index) => {
    const daysApart = Math.abs(candidate.releaseDay - other.releaseDay);
    const proximity = Math.max(0, 1 - daysApart / CROWDING_WINDOW_DAYS);
    if (proximity === 0) return;
    const sameGenre = candidate.genre === other.genre;
    const sameAudience = candidate.targetAudience === other.targetAudience;
    const weight = matchupWeight(candidateStrength, other.strength);
    const pressure =
      proximity * ((sameGenre ? GENRE_MATCH_WEIGHT : GENRE_MISMATCH_WEIGHT) + (sameAudience ? AUDIENCE_MATCH_BONUS : 0)) * other.strength * weight;
    if (pressure <= 0) return;
    contributors.push({
      index,
      release: other,
      pressure,
      share: 0, // filled in below, once the total is known
      matchup: weight >= OUTMATCHED_AT ? 'outmatched' : weight <= DOMINANT_BELOW ? 'dominant' : 'even',
      sameGenre,
      sameAudience,
      daysApart,
    });
  });

  const pressure = contributors.reduce((sum, c) => sum + c.pressure, 0);
  contributors.sort((a, b) => b.pressure - a.pressure);
  return {
    crowding: crowdingFromPressure(pressure),
    pressure,
    contributors: pressure > 0 ? contributors.map((c) => ({ ...c, share: c.pressure / pressure })) : contributors,
    beyondKnownField: beyondKnownField(candidate.releaseDay, horizon),
  };
}

/** Pressure below this passes through untouched - the ordinary range, left exactly as calibrated. */
const CROWDING_SOFT_KNEE = 0.7;

/**
 * Squashes raw pressure into the 0-1 fraction of screen access lost.
 *
 * Several strong, close, same-genre competitors saturate rather than compounding
 * past total - crowding cannot take away more than all of it. But a HARD clamp
 * at 1 threw away every distinction above it, and measurement showed that
 * mattered: on head-on collisions 92% of days sat exactly at the clamp for a
 * weak film and 32% did for a maximal one, so `matchupWeight`'s real differences
 * were being flattened into the same number and a merely-contested day read
 * identically to a ruinous one (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md
 * section 9.2).
 *
 * So pressure below CROWDING_SOFT_KNEE passes through unchanged - the ordinary
 * range keeps its existing calibration exactly - and everything above it
 * approaches 1 asymptotically without reaching it. Strictly monotonic, so no two
 * different pressures ever collapse to the same crowding again.
 */
export function crowdingFromPressure(pressure: number): number {
  if (pressure <= CROWDING_SOFT_KNEE) return Math.max(0, pressure);
  const headroom = 1 - CROWDING_SOFT_KNEE;
  return CROWDING_SOFT_KNEE + headroom * (1 - Math.exp(-(pressure - CROWDING_SOFT_KNEE) / headroom));
}

// The relative-strength matchup (docs/DESIGN_box_office_calibration_targets.md
// §6b): how much `other` actually displaces `candidate`, given their relative
// strength. Pure share-of-strength - `other`'s pull as a fraction of the two
// combined, doubled so that evenly-matched films (0.5 share) reproduce the old
// absolute weighting (1.0) while a candidate much stronger than `other` feels
// almost nothing (-> 0, it displaces `other` instead) and a much weaker one
// feels up to double (-> 2). This is the single primitive that turns crowding
// from "how much competition is nearby" into "am I the one being pushed out, or
// the one doing the pushing," reused identically by the AI's own release-window
// choice (engine/rivalStudios.ts) once it passes its candidate's strength too.
//
// `candidateStrength` undefined preserves the old candidate-blind absolute
// behaviour verbatim (weight 1) - the callers that haven't yet been given a
// candidate strength to reason about (the pre-release player warning) keep
// exactly their current numbers until they opt in.
function matchupWeight(candidateStrength: number | undefined, otherStrength: number): number {
  if (candidateStrength === undefined) return 1;
  const combined = candidateStrength + otherStrength;
  if (combined <= 0) return 1;
  return Math.max(0, Math.min(2, (2 * otherStrength) / combined));
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

// The competitor-territory effect of studio identity (engine/studioIdentity.ts):
// a studio releasing in a genre it's known for reads as a stronger presence on
// the calendar, so the relative-strength matchup (matchupWeight above) steers
// rivals away from its home turf - the "majors defend their territories, everyone
// else survives in the quiet pockets around them" behaviour.
//
// Applied as a share of the headroom left above the base reading, NOT added on
// top of it. The additive version summed to a possible 1.170 against a ceiling
// of 1.0 and relied on an outer clamp to hold the line, which measured badly:
// for a maxed-identity studio with a large budget, marketing spend could fall
// from £150M to £15M - a tenfold cut - and the strength read 1.000 at every
// point, because the clamp had eaten the entire marketing term. A mid-size film
// at full identity read exactly as strong as a tentpole. See
// docs/CODE_QUALITY.md; this is the worked example in it.
//
// The headroom form (engine/bounded.ts:liftTowardCeiling) needs no clamp, is
// strictly monotonic - so no two inputs ever collapse to the same strength
// again - and leaves identity 0 reading EXACTLY as it did before, which is
// most films and all of the existing calibration. It also says something
// truer: being known for a genre buys visibility a film does not already have,
// so it is worth more to a modest picture than to one already unmissable.
const IDENTITY_STRENGTH_BOOST = 0.2;

/** The base reading, before identity: two weights that already sum to 1, so it cannot leave [0, 1] on its own. */
const MARKETING_STRENGTH_WEIGHT = 0.7;
const PRODUCTION_STRENGTH_WEIGHT = 0.3;

function releaseStrength(marketingSpend: number, productionFraction: number, genreIdentity: number): Unit {
  const base = unit(
    MARKETING_STRENGTH_WEIGHT * marketingStrengthFraction(marketingSpend) + PRODUCTION_STRENGTH_WEIGHT * productionFraction,
  );
  return liftTowardCeiling(base, unit(IDENTITY_STRENGTH_BOOST * statAsUnit(genreIdentity)));
}

/** A not-yet-released rival production's rough competitive strength - engine/rivalStudios.ts has no simulated box office for it yet to rank by, so this stands in for one. `genreIdentity` (0-100, the releasing studio's identity in this genre) lifts an on-brand release's presence; 0 (default) is the pre-identity behaviour. */
export function computeRivalReleaseStrength(marketingSpend: number, scale: ProductionScale, genreIdentity = 0): Unit {
  return releaseStrength(marketingSpend, SCALE_STRENGTH[scale], genreIdentity);
}

/** A player's own scheduled draft's rough competitive strength - the same shape as computeRivalReleaseStrength, substituting production budget (players have no ProductionScale) for scale. `genreIdentity` lifts an on-brand release the same way. */
export function computePlayerReleaseStrength(marketingSpend: number, productionBudgetCost: number, genreIdentity = 0): Unit {
  return releaseStrength(marketingSpend, logT(productionBudgetCost, PRODUCTION_BUDGET_STRENGTH_RANGE), genreIdentity);
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

/**
 * The qualitative reading of a crowding score. Player-facing presentation is
 * qualitative by house rule (CLAUDE.md), and this lives in the engine so every
 * screen that shows a window reads it the same way.
 */
export type CrowdingBand = 'clear' | 'moderate' | 'high';

export function crowdingBandKey(score: number): CrowdingBand {
  if (score < 0.15) return 'clear';
  if (score < 0.4) return 'moderate';
  return 'high';
}

const CROWDING_BAND_LABELS: Record<CrowdingBand, string> = {
  clear: 'Clear window',
  moderate: 'Some competition',
  high: 'Crowded',
};

export function describeCrowdingBand(score: number): string {
  return CROWDING_BAND_LABELS[crowdingBandKey(score)];
}
