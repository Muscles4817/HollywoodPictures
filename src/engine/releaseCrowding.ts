import type { Film, Genre, ProductionScale, TargetAudience } from '../types';
import { logT, type Range } from './interpolate';
import { MARKETING_SPEND_RANGE } from '../data/release';
import { deriveWordOfMouthActivity } from './audienceSimulation';

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
  return rawCrowdingPressure(candidate, known, candidateStrength) / CROWDING_DENSITY_REFERENCE;
}

// How much competition a NORMAL window holds, in the units the sum below
// produces. Dividing by it is what makes the result mean "how crowded is this
// window compared with an ordinary one" rather than "how many films happen to be
// near me" - which is what a 0-1 crowding score has always claimed to be, and
// what the bands and the soft knee below are calibrated against.
//
// Without it the score scales with how many films the industry makes, and that
// is not a hypothetical: widening the rival slate from 8.8 wide releases a year
// to 21.2 took mean pressure from 0.186 to 0.392, and widening it again to 44.0
// took it to 0.589 with a p50 of 0.633 and a p90 of 0.999 - saturated, every
// window reading "maximally crowded" and the differences between them flattened
// away. Re-pegging the two weights in engine/audienceSimulationStep.ts restored
// the average bite the first time but could not restore that lost spread, which
// is why this normalisation exists rather than a third re-peg.
//
// Calibrated so the current slate reproduces the pressure distribution the model
// was originally tuned at. It is the ONE constant that tracks slate width; the
// competition weights are back at their calibrated values and stay there.
//
// 4.6 -> 5.6 at the THIRD widening (DESIGN_REVIEW_slate_width.md §9). Measured
// on the live rival market rather than a fixture: mean pressure drifted from
// 0.334 to 0.503 as the industry widened, so the divisor moves with it and the
// distribution returns to what everything downstream is calibrated against.
//
// Re-derived from the FINAL slate, not the intermediate one. The widening's
// other half prices a studio's low-budget picture properly
// (rivalStudios.ts:SCALE_SPEND_RANGE, RIVAL_BUDGET_REALISM), which makes films
// pricier and therefore fewer, so the density this has to answer to settled
// below where it first landed - a divisor of 6.9 read 0.273 against the 0.334
// it is meant to reproduce. That is the discipline this constant needs: derive
// it from the measured pressure distribution at the end of a change, never from
// the film count and never mid-change, since what matters is how much
// competition an ordinary window actually holds.
const CROWDING_DENSITY_REFERENCE = 10.0;

function rawCrowdingPressure(
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
    // Density-normalised per contributor, exactly as the sum in
    // computeCrowdingPressure is, so each contributor's pressure is on the same
    // scale as the total it is a share of.
    const pressure =
      (proximity * ((sameGenre ? GENRE_MATCH_WEIGHT : GENRE_MISMATCH_WEIGHT) + (sameAudience ? AUDIENCE_MATCH_BONUS : 0)) * other.strength * weight) /
      CROWDING_DENSITY_REFERENCE;
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

  // The total comes from computeCrowdingPressure rather than from re-summing the
  // breakdown, so an explanation can never disagree with the score it explains -
  // summing then normalising and normalising then summing differ in the last
  // float digit, and this function's whole job is to account for that number.
  const pressure = computeCrowdingPressure(candidate, known, candidateStrength);
  contributors.sort((a, b) => b.pressure - a.pressure);
  const contributorTotal = contributors.reduce((sum, c) => sum + c.pressure, 0);
  return {
    crowding: crowdingFromPressure(pressure),
    pressure,
    contributors: contributorTotal > 0 ? contributors.map((c) => ({ ...c, share: c.pressure / contributorTotal })) : contributors,
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
// else survives in the quiet pockets around them" behaviour. Boost-only and
// modest, on the same 0-1 scale as the marketing/scale terms; the outer clamp
// keeps a maxed-identity release from ever exceeding full strength.
const IDENTITY_STRENGTH_BOOST = 0.2;

function identityStrengthLift(genreIdentity: number): number {
  return IDENTITY_STRENGTH_BOOST * (Math.max(0, Math.min(100, genreIdentity)) / 100);
}

// --- The one strength scale -------------------------------------------------
//
// All three constructors below answer the SAME question - "how much of the
// market's attention is this film commanding, 0 (nothing) to 1 (a phenomenon)"
// - because matchupWeight compares them directly. If they disagreed on units,
// the matchup would be meaningless, and it did: the two pre-release proxies are
// log-scaled presence figures with a median near 0.5, while a running film's
// strength used to be its recent admissions divided by ITS OWN maximum
// interested audience. That is a saturation figure, not a presence one. It
// measured how well a film was doing *for its size*, so a $9M indie playing to
// its whole small crowd out-crowded a live tentpole, and (measured over six
// seeds x eight in-game years) the correlation between a film's budget and the
// competitive pressure it actually felt was -0.05: everyone was pushed around
// exactly as hard as everyone else, and mean pressure across 4,581 settled
// weeks was 0.056 - an attention factor of 0.988, i.e. nothing.
//
// A running film's strength is now measured the same way the other two are
// predicted: absolute recent admissions, log-scaled against the market. The
// film's own self-normalised saturation figure still exists and still drives
// its own word of mouth (engine/audienceSimulationStep.ts:computeRunningFilmStrength)
// - that one genuinely is about a film's own crowd, and must not become
// market-relative.

// Where the log runs. Calibrated against measured recency-weighted admissions
// over the same six-seed sweep: median in-run activity was 0.48M for a wide
// release under $25M, 5.7M for a $25-80M one and 15.5M for one over $80M, with a
// p99 of 84M and an observed maximum of 123M. So MIN sits below the smallest
// real presence (a film below it registers as nothing) and MAX at genuine
// phenomenon scale, putting those three medians at 0.09 / 0.56 / 0.74 - the same
// band the marketing/scale proxies already occupy.
const MARKET_PRESENCE_RANGE: Range = { min: 300_000, max: 60_000_000 };

/** A currently-running film's live share of the market's attention, on the same 0-1 presence scale the two pre-release proxies use. */
export function computeMarketPresence(weeks: Parameters<typeof deriveWordOfMouthActivity>[0], asOfWeekIndex: number): number {
  const activity = deriveWordOfMouthActivity(weeks, asOfWeekIndex);
  return activity <= MARKET_PRESENCE_RANGE.min ? 0 : logT(activity, MARKET_PRESENCE_RANGE);
}

/** A not-yet-released rival production's rough competitive strength - engine/rivalStudios.ts has no simulated box office for it yet to rank by, so this stands in for one. `genreIdentity` (0-100, the releasing studio's identity in this genre) lifts an on-brand release's presence; 0 (default) is the pre-identity behaviour. */
export function computeRivalReleaseStrength(marketingSpend: number, scale: ProductionScale, genreIdentity = 0): number {
  return Math.max(0, Math.min(1, 0.7 * marketingStrengthFraction(marketingSpend) + 0.3 * SCALE_STRENGTH[scale] + identityStrengthLift(genreIdentity)));
}

/** A player's own scheduled draft's rough competitive strength - the same shape as computeRivalReleaseStrength, substituting production budget (players have no ProductionScale) for scale. `genreIdentity` lifts an on-brand release the same way. */
export function computePlayerReleaseStrength(marketingSpend: number, productionBudgetCost: number, genreIdentity = 0): number {
  return Math.max(
    0,
    Math.min(1, 0.7 * marketingStrengthFraction(marketingSpend) + 0.3 * logT(productionBudgetCost, PRODUCTION_BUDGET_STRENGTH_RANGE) + identityStrengthLift(genreIdentity)),
  );
}

/**
 * A *currently-running* film's own live competitive strength - the third
 * way to build an UpcomingRelease, alongside computeRivalReleaseStrength/
 * computePlayerReleaseStrength above (both pre-release proxies for a
 * production that hasn't opened yet). engine/marketSettlement.ts calls this
 * fresh every settled week for every still-running film, so a film's pull
 * on its competitors' screen access evolves with its *actual* performance
 * instead of a one-time snapshot frozen at release - see computeMarketPresence
 * above for the scale it is measured on, and
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
  const { simWeeks } = film.boxOfficeRun;
  if (simWeeks.length === 0) return null;
  return {
    releaseDay: film.releasedOnDay,
    genre: film.genre,
    targetAudience: film.targetAudience,
    strength: computeMarketPresence(simWeeks, simWeeks.length),
  };
}

/**
 * The qualitative reading of a crowding score. Player-facing presentation is
 * qualitative by house rule (CLAUDE.md), and this lives in the engine so every
 * screen that shows a window reads it the same way.
 */
export type CrowdingBand = 'clear' | 'moderate' | 'high';

// Rebanded when the score became density-normalised (CROWDING_DENSITY_REFERENCE):
// it now measures how crowded a window is RELATIVE to an ordinary one, so the
// thresholds have to sit against the distribution that produces. The bands are
// set so that a head-on collision - a same-genre, same-audience tentpole on the
// exact day - reads "Crowded", an ordinary contested window reads "Some
// competition", and only a genuinely quiet date reads "Clear window", which is
// what they said before the normalisation existed.
//
// Scaled again by 4.6/5.6 at the third widening, with the density reference
// itself: the head-on collision that anchors the top band now scores 0.20.
export function crowdingBandKey(score: number): CrowdingBand {
  if (score < 0.037) return 'clear';
  if (score < 0.092) return 'moderate';
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
