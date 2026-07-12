// Milestone 3 of the audience-based box office redesign (docs/DESIGN.md
// 5.34) - "connect release-time inputs to the isolated audience
// simulation." engine/audienceSimulation.ts (Milestone 1) and
// engine/audienceSimulationStep.ts (Milestone 2) stay exactly as isolated
// as they were - plain numbers in, plain numbers out, no import from
// Film/Script/ReleaseType or the live game. This file is the bridge: the
// only place in the codebase that turns Buzz/Marketing/Marketability/
// Originality/Target Audience/Genre/Release Window/Release Type/Critic
// & Audience Score into an AudienceSimulationFixedState. Nothing in the
// live game calls this yet (state/studioReducer.ts still runs
// engine/boxOffice.ts unchanged) - building the translation is this
// milestone's job, flipping the switch is a later one.
//
// Every constant below is a provisional placeholder, exactly like
// WOM_LOOKBACK_WEIGHTS (Milestone 1) and the WOM response thresholds
// (Milestone 2) - chosen and then checked against a diagnostic sweep
// (see the "calibration" note on each constant group) for the *shape* of
// behavior this milestone's tests require (monotonic, convex at the Buzz
// floor, capacity-gated crossover), not for real-world accuracy.
//
// Streaming is deliberately unsupported here (SupportedReleaseType
// excludes it) - forcing a streaming release through a theatrical-
// admissions model would be dishonest (no seat-selling, no "opening
// weekend" in the same sense); it stays out until a real streaming model
// exists, rather than being quietly ported through this one.

import type { Genre, ReleaseType, ReleaseWindow, TargetAudience } from '../types';
import { AUDIENCE_PROFILES } from '../data/audiences';
import { GENRE_PROFILES } from '../data/genres';
import { RELEASE_WINDOW_BASE_MULTIPLIER, RELEASE_WINDOW_GENRE_BONUS, MARKETING_SPEND_RANGE } from '../data/release';
import { logT, interpolateScale, type ScaleAnchor } from './interpolate';
import { createAudienceSimulationFixedState, type AudienceSimulationFixedState } from './audienceSimulation';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type SupportedReleaseType = Exclude<ReleaseType, 'Streaming'>;

/**
 * Everything this milestone was asked to connect, as plain named release-
 * day inputs rather than a full Film/Script object - keeps this function
 * testable without constructing talent/production/post-production state
 * that has nothing to do with audience simulation. `scriptMarketability`/
 * `scriptOriginality` are Script.marketability/originality verbatim (1-100,
 * types/index.ts); `criticScore`/`audienceScore` are FilmResults' verbatim
 * (0-100, engine/scoring.ts) - reused, not recomputed, same principle
 * Milestone 1 already applied to criticScore/audienceScore on
 * AudienceSimulationFixedState itself.
 */
export interface ReleaseSimulationInputs {
  /** Pre-release hype (engine/scoring.ts:computeBuzzScore), 0-100. Feeds initial awareness only - never WordOfMouthStrength (see computeReceptionResponseMultiplier in audienceSimulationStep.ts), which would double-count the same hype through two channels once the run is underway. */
  buzzScore: number;
  /** Currency amount, data/release.ts:MARKETING_SPEND_RANGE. Seeds initial awareness alongside Buzz, scaled by marketingEfficiency - nothing else. */
  marketingSpend: number;
  /** Script.marketability, 1-100 - sizes baseInterestFraction and (dampened by originality) marketingEfficiency. */
  scriptMarketability: number;
  /** Script.originality, 1-100 - sizes crossoverCapacityFraction (the ceiling) and dampens marketingEfficiency (a genuinely novel premise is harder to pitch). Never touches criticScore/audienceScore or any WOM-response constant - originality creates capacity, reception (below) is the only thing that can realize it. See "originality alone must never create a breakout" in the milestone brief - already structurally guaranteed by Milestone 2's crossover step requiring both capacity *and* a cleared reception-driven threshold. */
  scriptOriginality: number;
  /** What this film was actually written for (Script.intendedAudience) vs. who it's being marketed to (Film.targetAudience, below) - a mismatch narrows genuine taste-fit even if marketability is otherwise strong. */
  scriptIntendedAudience: TargetAudience;
  targetAudience: TargetAudience;
  genre: Genre;
  releaseWindow: ReleaseWindow;
  releaseType: SupportedReleaseType;
  /** FilmResults.criticScore, 0-100, reused verbatim. */
  criticScore: number;
  /** FilmResults.audienceScore, 0-100, reused verbatim. */
  audienceScore: number;
}

// --- Total addressable audience -------------------------------------------
//
// marketSize x genrePopularity, expressed as a headcount rather than money -
// reuses the same data/audiences.ts and data/genres.ts tables the rest of
// the game already reads (a genre's popularity or an audience's market size
// shouldn't have two independent numbers depending on which system reads
// it).
//
// Calibration (revised in Milestone 6 - "scenario hardening"): this figure
// has to implicitly stand in for a film's *worldwide* reachable audience,
// not a single domestic market - this project doesn't split domestic/
// international box office into separate pools yet (see DESIGN.md 5.34's
// "Future hooks"), so a single population number is all there is, and it
// has to be big enough on its own for the top of the range to mean
// anything. Milestone 3's original 40,000,000 capped even a maxed-out,
// 100%-sold-out Mass Market/top-genre film at ~£330M total gross
// (engine/boxOfficeRun.ts:AVERAGE_TICKET_PRICE x 30,000,000 people) -
// nowhere near genuine billion-scale-phenomenon territory (Milestone 6's
// own explicit requirement: "plausible inputs can produce... rare
// billion-scale phenomena"), found via a scratch diagnostic before
// touching this constant, not assumed. 250,000,000 raises that same
// maxed-out ceiling to ~£2.06B - comfortably past £1B so a true phenomenon
// still has to combine near-total market saturation with exceptional
// reception to get there (see the "extreme upper range" scenario in
// audienceSimulationScenarios.test.ts), while an ordinary or niche film's
// addressable pool scales up by the same proportion and stays exactly as
// small *relative to the ceiling* as it always was - this constant scales
// the whole range, not just the top of it.
const BASE_ADDRESSABLE_POPULATION = 250_000_000;

function computeTotalAddressableAudience(genre: Genre, targetAudience: TargetAudience): number {
  const marketSize = AUDIENCE_PROFILES[targetAudience].marketSize;
  const popularity = GENRE_PROFILES[genre].popularity / 100;
  return BASE_ADDRESSABLE_POPULATION * marketSize * popularity;
}

// --- Base interest fraction & crossover capacity ---------------------------
//
// Both driven by scriptMarketability/scriptOriginality respectively, each
// independently capped so their *sum* can never exceed 1 regardless of
// input combination (baseInterestFraction's ceiling + crossoverCapacity's
// ceiling = 0.70 + 0.30 = 1.00 exactly) - satisfies
// AudienceSimulationFixedState's own validation (Milestone 1) by
// construction, not by clamping the sum after the fact.
const BASE_INTEREST_FLOOR = 0.05;
const BASE_INTEREST_CEILING = 0.7;
const CROSSOVER_CAPACITY_CEILING = 0.3;
// A film marketed to an audience its script wasn't actually written for
// loses a real (but not devastating) slice of genuine taste-fit - binary
// rather than a distance metric, since target audiences are categorical
// (DESIGN.md has no notion of "how far" Teens is from Adults).
const AUDIENCE_MISMATCH_PENALTY = 0.7;

function computeBaseInterestFraction(scriptMarketability: number, targetAudience: TargetAudience, scriptIntendedAudience: TargetAudience): number {
  const raw = BASE_INTEREST_FLOOR + (BASE_INTEREST_CEILING - BASE_INTEREST_FLOOR) * (scriptMarketability / 100);
  const fitMultiplier = targetAudience === scriptIntendedAudience ? 1 : AUDIENCE_MISMATCH_PENALTY;
  return clamp(raw * fitMultiplier, 0, 1);
}

function computeCrossoverCapacityFraction(scriptOriginality: number): number {
  return clamp(CROSSOVER_CAPACITY_CEILING * (scriptOriginality / 100), 0, CROSSOVER_CAPACITY_CEILING);
}

// --- Marketing efficiency ---------------------------------------------------
//
// "How efficiently marketing spend converts into Awareness - pitch
// clarity, not pool size" (AudienceSimulationFixedState.marketingEfficiency,
// Milestone 1). Driven by marketability's other half, dampened by
// originality - a genuinely novel premise is harder to explain in one
// sentence even when it would appeal to plenty of people once they
// understood it (DESIGN.md 5.34).
const MARKETING_EFFICIENCY_FLOOR = 0.2;
const MARKETING_EFFICIENCY_CEILING = 0.9;
const ORIGINALITY_EFFICIENCY_DAMPENING = 0.5; // at scriptOriginality=100, efficiency is halved

function computeMarketingEfficiency(scriptMarketability: number, scriptOriginality: number): number {
  const base = MARKETING_EFFICIENCY_FLOOR + (MARKETING_EFFICIENCY_CEILING - MARKETING_EFFICIENCY_FLOOR) * (scriptMarketability / 100);
  const dampen = 1 - ORIGINALITY_EFFICIENCY_DAMPENING * (scriptOriginality / 100);
  return clamp(base * dampen, 0.05, 1);
}

// --- Release type - reinterpreted for this model, not the old reach/legs
// multipliers -----------------------------------------------------------
//
// data/release.ts:RELEASE_TYPE_PROFILES (reachMultiplier, baseLegsMultiplier,
// varianceMultiplier) belongs to the old Opening Weekend/Legs formula
// (engine/boxOffice.ts) and is deliberately *not* reused here - porting
// those numbers into a population simulation would carry over a shape
// tuned for a different mechanic entirely (Milestone 3 brief: "reinterpret
// release types for this model rather than porting old reach and legs
// multipliers"). Two release-type-shaped facts genuinely matter here
// instead:
//
// - initialAwarenessShare: what fraction of the addressable audience even
//   *could* learn about the film on day one, before Buzz/marketing decide
//   how much of that ceiling is actually realized (see
//   computeInitialAwareCount below) - Wide is everywhere at once, Limited
//   is a handful of theaters, Festival First is barely public at all yet.
// - conversionPacingBaseline: per-person weekly attendance urgency -
//   Wide's everywhere-at-once release creates real scarcity pressure ("see
//   it this weekend or miss the only cinema showing it nearby" energy);
//   Limited/Festival First start low and lean on word of mouth's pull-
//   forward effect (audienceSimulationStep.ts step 8) to build urgency
//   later, exactly the "platform release" shape the brief asks to emerge
//   rather than be hand-built.
//
// A platform-style run isn't a fourth profile - it's what Limited's low
// initialAwarenessShare plus a strong reception's word-of-mouth effects
// (Milestone 2) produce on their own, the same emergent-shape principle
// DESIGN.md 5.34 already established for the un-implemented version of
// this idea.
interface ReleaseTypeAudienceProfile {
  initialAwarenessShare: number;
  conversionPacingBaseline: number;
  /** How much the one-time release-day marketing push still echoes into ongoing weekly awareness after week 1 (AudienceSimulationFixedState.externalWeeklyAwarenessRate) - Wide's broad rollout keeps generating incidental discovery; Festival First's restricted run barely does. */
  ongoingAwarenessFactor: number;
}

const RELEASE_TYPE_AUDIENCE_PROFILES: Record<SupportedReleaseType, ReleaseTypeAudienceProfile> = {
  Wide: { initialAwarenessShare: 0.9, conversionPacingBaseline: 0.14, ongoingAwarenessFactor: 1.0 },
  Limited: { initialAwarenessShare: 0.12, conversionPacingBaseline: 0.06, ongoingAwarenessFactor: 0.6 },
  'Festival First': { initialAwarenessShare: 0.03, conversionPacingBaseline: 0.05, ongoingAwarenessFactor: 0.4 },
};

function releaseTypeProfile(releaseType: SupportedReleaseType): ReleaseTypeAudienceProfile {
  const profile = RELEASE_TYPE_AUDIENCE_PROFILES[releaseType];
  if (!profile) {
    throw new Error(`audienceSimulationInputs: unsupported release type "${releaseType}" - Streaming has no theatrical-admissions model yet`);
  }
  return profile;
}

// --- Conversion pacing baseline: release type + release window/genre fit
// + Buzz's event-scarcity urgency ------------------------------------------
//
// Release window's seasonal crowd and genre-specific bonus (data/release.ts,
// already the live model's single source of truth for "does Halloween
// help Horror") don't change *who* could like the film - they change how
// ready people already interested are to act *now*, which is exactly
// ConversionPacing's job description (DESIGN.md 5.34), not
// totalAddressableAudience's. Release Type remains the *primary* driver
// (DESIGN.md 5.34) - Buzz only adds a modest secondary boost, deliberately
// small (BUZZ_URGENCY_WEIGHT) so a high-buzz Limited release doesn't
// quietly become Wide's pacing in disguise, but real: an "everyone's
// talking about it, see it this weekend" event film genuinely converts its
// opening-week crowd faster than a same-release-type film nobody's
// buzzing about, independent of whatever word of mouth does afterward.
const BUZZ_URGENCY_WEIGHT = 0.5;
function computeConversionPacingBaseline(releaseType: SupportedReleaseType, releaseWindow: ReleaseWindow, genre: Genre, buzzScore: number): number {
  const windowBase = RELEASE_WINDOW_BASE_MULTIPLIER[releaseWindow];
  const windowGenreBonus = RELEASE_WINDOW_GENRE_BONUS[releaseWindow][genre] ?? 1;
  const buzzUrgency = 1 + BUZZ_URGENCY_WEIGHT * (buzzScore / 100);
  return clamp(releaseTypeProfile(releaseType).conversionPacingBaseline * windowBase * windowGenreBonus * buzzUrgency, 0, 1);
}

// --- Initial (release-day) awareness seed -----------------------------------
//
// Buzz and marketing spend are kept as two independently-tunable channels
// per DESIGN.md 5.34's "where each lever enters" table, not merged into
// one number: Buzz already blends fame/reputation/marketing/events into a
// single 0-100 hype reading (engine/scoring.ts:computeBuzzScore) and is
// reused verbatim; marketing spend is the direct currency lever, filtered
// through marketingEfficiency (pitch clarity) the way Buzz isn't.
//
// The convex low-Buzz floor already approved for Milestone 2's reception
// multiplier is reused here for the *same* reason boxOffice.ts's
// HYPE_FLOOR exists: zero or near-zero Buzz must produce a negligible
// opening, not a respectable baseline (own constants, not imported from
// boxOffice.ts, to keep this module's only coupling to the old model at
// the data-table level, not the formula level).
const BUZZ_REACH_FLOOR = 0.02;
function buzzReachFraction(buzzScore: number): number {
  return BUZZ_REACH_FLOOR + (1 - BUZZ_REACH_FLOOR) * (buzzScore / 100) ** 2;
}

// Log-scale anchors mapping a marketing spend amount (data/release.ts's
// £10k-£150M range) onto a 0-1 raw reach fraction, before marketingEfficiency
// scaling - same logT/interpolateScale machinery data/release.ts's own
// MARKETING_SPEND_ANCHORS already uses for Buzz's marketing contribution,
// but a separate anchor table: that one feeds computeBuzzScore, this one
// feeds initial awareness directly, and the two channels are deliberately
// allowed to both draw on the same spend amount (see module header).
const MARKETING_REACH_ANCHORS: ScaleAnchor<'reach'>[] = [
  { t: 0, values: { reach: 0 }, description: 'Essentially no marketing reach.' },
  { t: 0.25, values: { reach: 0.08 }, description: 'A modest local campaign.' },
  { t: 0.5, values: { reach: 0.2 }, description: 'A real regional campaign.' },
  { t: 0.75, values: { reach: 0.45 }, description: 'A national blitz.' },
  { t: 1, values: { reach: 0.8 }, description: 'A global blockbuster campaign.' },
];

function marketingReachFraction(marketingSpend: number): number {
  const t = logT(marketingSpend, MARKETING_SPEND_RANGE);
  return interpolateScale(t, MARKETING_REACH_ANCHORS, 'reach');
}

// Buzz-weighted higher than marketing spend: Buzz already absorbs marketing
// spend as one of several inputs (see module header), so weighting it
// higher here doesn't starve a high-Buzz, low-direct-spend film (a famous
// director/cast can carry an opening on reputation alone) while a
// marketing-only push still meaningfully moves the needle on its own.
const BUZZ_REACH_WEIGHT = 0.55;
const MARKETING_REACH_WEIGHT = 0.45;

function computeInitialAwareCount(fixed: {
  totalAddressableAudience: number;
  marketingEfficiency: number;
}, buzzScore: number, marketingSpend: number, releaseType: SupportedReleaseType): number {
  const rawReach = clamp(
    BUZZ_REACH_WEIGHT * buzzReachFraction(buzzScore) + MARKETING_REACH_WEIGHT * marketingReachFraction(marketingSpend) * fixed.marketingEfficiency,
    0,
    1,
  );
  return fixed.totalAddressableAudience * releaseTypeProfile(releaseType).initialAwarenessShare * rawReach;
}

// --- Ongoing external awareness trickle -------------------------------------
//
// A small residual rate, distinct from the one-time seed above - continued
// press/incidental discovery during the run, scaled by release type (a
// wide rollout keeps generating incidental discovery in a way a
// restricted Festival First run doesn't) and lightly by marketingEfficiency
// (a well-pitched film's marketing keeps paying off a little after
// opening too).
const EXTERNAL_AWARENESS_BASE_RATE = 0.03;
function computeExternalWeeklyAwarenessRate(releaseType: SupportedReleaseType, marketingEfficiency: number): number {
  return clamp(EXTERNAL_AWARENESS_BASE_RATE * releaseTypeProfile(releaseType).ongoingAwarenessFactor * (0.5 + 0.5 * marketingEfficiency), 0, 1);
}

/**
 * The Milestone 3 entry point: translates a film's release-time inputs
 * into a fully-validated AudienceSimulationFixedState, ready to hand to
 * engine/audienceSimulationStep.ts's advanceOneWeek/advanceToWeek. Nothing
 * here reads or writes Film/Studio/state - purely a translation, still not
 * called from anywhere in the live game (see module header).
 */
export function deriveAudienceSimulationFixedState(inputs: ReleaseSimulationInputs): AudienceSimulationFixedState {
  const totalAddressableAudience = computeTotalAddressableAudience(inputs.genre, inputs.targetAudience);
  const baseInterestFraction = computeBaseInterestFraction(inputs.scriptMarketability, inputs.targetAudience, inputs.scriptIntendedAudience);
  const crossoverCapacityFraction = computeCrossoverCapacityFraction(inputs.scriptOriginality);
  const marketingEfficiency = computeMarketingEfficiency(inputs.scriptMarketability, inputs.scriptOriginality);
  const conversionPacingBaseline = computeConversionPacingBaseline(inputs.releaseType, inputs.releaseWindow, inputs.genre, inputs.buzzScore);
  const externalWeeklyAwarenessRate = computeExternalWeeklyAwarenessRate(inputs.releaseType, marketingEfficiency);
  const initialAwareCount = computeInitialAwareCount(
    { totalAddressableAudience, marketingEfficiency },
    inputs.buzzScore,
    inputs.marketingSpend,
    inputs.releaseType,
  );

  return createAudienceSimulationFixedState({
    totalAddressableAudience,
    baseInterestFraction,
    marketingEfficiency,
    crossoverCapacityFraction,
    conversionPacingBaseline,
    externalWeeklyAwarenessRate,
    criticScore: inputs.criticScore,
    audienceScore: inputs.audienceScore,
    initialAwareCount,
  });
}
