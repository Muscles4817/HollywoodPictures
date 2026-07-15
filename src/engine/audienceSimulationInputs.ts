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
 * that has nothing to do with audience simulation.
 *
 * Milestone 11 (docs/DESIGN.md - "release-input separation of concerns")
 * split this interface's fields into two disjoint groups, made explicit
 * here rather than left implicit in the formulas that consume them - see
 * that milestone's DESIGN.md note for the full diagnostic evidence this
 * split was based on:
 *
 * - **Awareness inputs** ("do people know this film exists"):
 *   `marketingSpend`, `directorFame`, `leadFame`, `studioBrand`. None
 *   of these are screenplay traits - a brilliant script does not cause
 *   people to hear about a film, marketing and who's already famous does.
 *   `buzzScore` also belongs conceptually to this family (fame/Brand/
 *   marketing-driven, engine/scoring.ts:computeBuzzScore) but is kept
 *   separate below since its only remaining job here is pacing urgency, not
 *   awareness reach - see its own doc comment.
 * - **Interest inputs** ("of the people who know, how many actually want to
 *   see it"): `scriptAccessibility`, `scriptOriginality`, `scriptSpectacle`,
 *   `scriptHookStrength`, `scriptIntendedAudience`/`targetAudience`,
 *   `genre`. All screenplay/positioning traits, all feeding
 *   `baseInterestFraction`/`crossoverCapacityFraction` - never awareness.
 *
 * `scriptAccessibility` is `engine/commercialProfile.ts:deriveCommercialProfile(script).accessibility`
 * (renamed from `scriptMarketability` this milestone - the old name was a
 * holdover from the pre-screenplay-redesign `Script.marketability` field
 * and no longer describes what the value actually is); `scriptHookStrength`
 * is that same function's `.hookStrength`. Script no longer has either
 * value stored directly, so both are derived readings, not verbatim
 * pass-throughs. `criticScore`/`audienceScore` are FilmResults' verbatim
 * (0-100, engine/scoring.ts) - reused, not recomputed, same principle
 * Milestone 1 already applied to criticScore/audienceScore on
 * AudienceSimulationFixedState itself.
 */
export interface ReleaseSimulationInputs {
  /** Pre-release hype (engine/scoring.ts:computeBuzzScore), 0-100. Feeds conversionPacingBaseline's urgency boost only - see that function. Milestone 11 removed its old role seeding initial awareness (see computeCastReachFraction below for what replaced it) specifically because buzzScore already blends marketing spend into a single composite, and awareness needed marketing counted through exactly one channel, not two. Never touches WordOfMouthStrength (see computeReceptionResponseMultiplier in audienceSimulationStep.ts) either, which would double-count the same hype through a third channel once the run is underway. */
  buzzScore: number;
  /** Currency amount, data/release.ts:MARKETING_SPEND_RANGE. Awareness's dominant channel (see computeInitialAwareCount) - "marketing buys awareness, not quality" (docs/DESIGN.md Milestone 11). */
  marketingSpend: number;
  /** Director's own Talent.fame, 0-100 verbatim - one of two "existing audience awareness of the people involved" awareness inputs (see computeCastReachFraction). */
  directorFame: number;
  /** Average fame across every hired Lead Actor, 0-100 - the other half of computeCastReachFraction; weighted higher than directorFame since leads are usually the more visible face of a film's marketing. */
  leadFame: number;
  /** Studio.brand (Brand Recognition, engine/reputation.ts), 0-100 verbatim - sizes marketingEfficiency (how far a marketing pound actually goes). A brand-new studio's marketing dollar buys less attention than an established one's; this is what makes marketing effectiveness itself a genuine mid/late-game progression mechanic rather than a flat multiplier available from day one. Deliberately reads Brand, never Prestige - how far a marketing pound reaches is a commercial-recognition question, not a critical-esteem one. */
  studioBrand: number;
  /** deriveCommercialProfile(script).accessibility, 0-100 - how broad a natural audience the screenplay's *concept* has, independent of how it's marketed. The dominant driver of baseInterestFraction ("of the people who know this exists, how many are even in its natural audience") - see computeBaseInterestFraction. Never touches marketingEfficiency (Milestone 11 - a script being easy to explain doesn't mean it's easy to promote, and either way that's a marketing-side question, not a content one). */
  scriptAccessibility: number;
  /** deriveCommercialProfile(script).hookStrength, 0-100 - how compelling the marketing *proposition* itself is (trailer effectiveness, click-through, "does the pitch land") - a secondary, narrower-range multiplier on baseInterestFraction alongside scriptAccessibility (Milestone 12, see computeBaseInterestFraction). Deliberately distinct from scriptAccessibility's job: a concept can be easy to *understand* without being compellingly *pitched*, and vice versa. No longer feeds crossoverCapacityFraction (Milestone 11 briefly routed it there; Milestone 12 moved crossover onto scriptCrossoverPotential below, a purpose-built value, instead) and never touches awareness/reach - matches Milestone 11's "the screenplay should matter, but much less directly" principle by staying inside interest generation, not awareness. */
  scriptHookStrength: number;
  /** deriveCommercialProfile(script).crossoverPotential, 0-100 - "how far positive word of mouth could plausibly travel beyond the natural audience," purpose-built for exactly this question (originality/scale/genre/archetype-blended - see engine/commercialProfile.ts). Computed since the screenplay redesign but left unwired into the audience simulation until Milestone 12 (docs/DESIGN.md flagged it explicitly as future work) - crossoverCapacityFraction used to reinvent a similar signal from raw scriptOriginality instead (see computeCrossoverConceptStrength). Never touches baseInterestFraction, marketingEfficiency, criticScore/audienceScore, or any WOM-response constant - capacity is fixed at release, reception is the only thing that can realize it week over week. See "originality alone must never create a breakout" - already structurally guaranteed by Milestone 2's crossover step requiring both capacity *and* a cleared reception-driven threshold. */
  scriptCrossoverPotential: number;
  /** Script.toneProfile.spectacle, 1-100 - "must see this in cinemas" event value, one of crossoverCapacityFraction's inputs (see computeCrossoverCapacityFraction below). A low-spectacle film (a character comedy, a small drama) can still cross over on concept/reception alone, just without spectacle's contribution. */
  scriptSpectacle: number;
  /** What this film was actually written for (Script.intendedAudience) vs. who it's being marketed to (Film.targetAudience, below) - a mismatch narrows genuine taste-fit even if accessibility is otherwise strong. */
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
// baseInterestFraction driven by scriptAccessibility (dominant) and
// scriptHookStrength (secondary); crossoverCapacityFraction driven by
// scriptCrossoverPotential/scriptSpectacle/criticScore (see below) - kept
// independently capped so their *sum* can never exceed 1 regardless of
// input combination (baseInterestFraction's worst-case ceiling - accessibility
// and hookStrength both maxed - is 0.45 x 1.2 = 0.54; crossoverCapacity's
// ceiling is 0.30; 0.54 + 0.30 = 0.84, comfortably under 1) - satisfies
// AudienceSimulationFixedState's own validation (Milestone 1) by
// construction, not by clamping the sum after the fact.
//
// Milestone 12 (docs/DESIGN.md - "commercial believability calibration")
// narrowed BASE_INTEREST_FLOOR/CEILING from 0.05-0.7 (a 14x theoretical
// range) down to 0.15-0.45 (2.64x at the 5-95 sweep this was validated
// against): a diagnostic sweep found scriptAccessibility alone, at its old
// range, swung week-1 opening admissions 8.09x holding marketing/fame
// fixed - *wider* than marketing spend's own 5.72x swing across its entire
// real range (£10k-£150M) - directly contradicting "opening weekend should
// be driven primarily by marketing" (the milestone's explicit brief). A
// first attempt narrowed the range to 0.25-0.55 (same 0.3 span, floor
// raised from 0.05) - this fixed the elasticity but raised the *floor* 5x,
// which pushed a deliberately-negligible film's natural interest up too
// far (a diagnostic check found £18.7M total gross for the "negligible"
// archetype, over the believable £10M bar it used to clear comfortably).
// 0.15-0.45 keeps the same narrow span (so elasticity is still only 2.64x,
// comfortably under marketing's 5.72x) while keeping the floor low enough
// that a genuinely inaccessible, low-effort concept still reads as
// negligible. The screenplay still matters (accessibility remains the
// single largest lever inside "interest," exactly as the brief specifies:
// "the screenplay should mostly affect whether people become interested
// once they know about it"), just no longer at a magnitude that outweighs
// marketing's own realistic range.
const BASE_INTEREST_FLOOR = 0.15;
const BASE_INTEREST_CEILING = 0.45;
// scriptHookStrength's own multiplier range - deliberately narrow (a 1.5x
// spread) so it reads as a real but clearly secondary contributor to
// interest generation, never approaching scriptAccessibility's own
// dominance. Kept as a separate multiplicative factor rather than folded
// into the same additive range as accessibility specifically so each has
// its own legible, independently-tunable elasticity (docs/DESIGN.md
// Milestone 12's "each variable should have one clear responsibility").
const HOOK_STRENGTH_INTEREST_FLOOR = 0.8;
const HOOK_STRENGTH_INTEREST_CEILING = 1.2;
const CROSSOVER_CAPACITY_CEILING = 0.3;
// A film marketed to an audience its script wasn't actually written for
// loses a real (but not devastating) slice of genuine taste-fit - binary
// rather than a distance metric, since target audiences are categorical
// (DESIGN.md has no notion of "how far" Teens is from Adults).
const AUDIENCE_MISMATCH_PENALTY = 0.7;

/**
 * Interest, not awareness - "of the people who already know this film
 * exists, how many genuinely want to see it" (docs/DESIGN.md Milestone 11).
 * Driven by the screenplay's own concept and positioning fit - never by
 * marketing spend, fame, or reputation, which only ever decide whether
 * someone gets the chance to have this reaction in the first place (see
 * computeInitialAwareCount). Two screenplay inputs, two distinct jobs
 * (Milestone 12, docs/DESIGN.md - "fully separate the jobs performed by
 * marketability"): scriptAccessibility ("how easy is the premise to
 * understand") is the dominant term; scriptHookStrength ("how compelling
 * is the marketing proposition itself - does the pitch/trailer land") is a
 * narrower-range secondary multiplier on top of it - a concept can be easy
 * to *understand* without being compellingly *pitched*, and vice versa.
 * Both stay inside interest generation, never awareness/reach - matches
 * Milestone 11's "the screenplay should matter, but much less directly."
 */
function computeBaseInterestFraction(scriptAccessibility: number, scriptHookStrength: number, targetAudience: TargetAudience, scriptIntendedAudience: TargetAudience): number {
  const raw = BASE_INTEREST_FLOOR + (BASE_INTEREST_CEILING - BASE_INTEREST_FLOOR) * (scriptAccessibility / 100);
  const hookMultiplier = HOOK_STRENGTH_INTEREST_FLOOR + (HOOK_STRENGTH_INTEREST_CEILING - HOOK_STRENGTH_INTEREST_FLOOR) * (scriptHookStrength / 100);
  const fitMultiplier = targetAudience === scriptIntendedAudience ? 1 : AUDIENCE_MISMATCH_PENALTY;
  return clamp(raw * hookMultiplier * fitMultiplier, 0, 1);
}

// crossoverCapacityFraction used to be scriptOriginality alone, scaled
// straight to the ceiling - i.e. AudienceScore-adjacent reception was doing
// double duty as both "does the natural audience like it" (via womInfluence,
// audienceSimulationStep.ts) and, indirectly through originality-as-sole-
// capacity-driver, "can it reach anyone else." Redesigned per DESIGN.md
// 5.34's crossover-capacity note: capacity - the ceiling on how far a film
// COULD ever expand beyond its natural audience - is fixed at release from
// the concept and its accessibility alone, never from reception.
// deriveWomCrossoverExpansion (audienceSimulationStep.ts) still separately
// decides how much of that fixed ceiling actual WOM realizes each week
// (crossover *realisation*, driven by womInfluence) - only the ceiling's
// source changes here.
//
// conceptStrength: "is this the kind of thing an outsider would find worth
// talking about / seeing." Milestone 11 briefly routed this through
// `hookStrength` (reasoning: "how easily this concept spreads when
// recommended"); Milestone 12 (docs/DESIGN.md - "commercial believability
// calibration") moved it onto `scriptCrossoverPotential`
// (engine/commercialProfile.ts) instead - a value purpose-built for this
// exact question ("how far positive word of mouth could plausibly travel
// beyond the natural audience," originality/scale/genre/archetype-blended)
// that had been computed and tested since the screenplay redesign but left
// unwired, explicitly flagged in DESIGN.md as future work. `hookStrength`
// moved to baseInterestFraction instead (see computeBaseInterestFraction) -
// "is the pitch compelling" is an interest-generation question, not a
// crossover one. Spectacle stays a separate term (event value isn't part
// of crossoverPotential's own formula at all). CriticScore contributes
// least of all and only as a secondary, prestige-adjacent signal - never
// the dominant channel for mainstream theatrical crossover, per the
// original milestone brief.
const CROSSOVER_CONCEPT_WEIGHTS = {
  crossoverPotential: 0.55,
  spectacle: 0.3,
  criticScore: 0.15,
};

function computeCrossoverConceptStrength(scriptCrossoverPotential: number, scriptSpectacle: number, criticScore: number): number {
  return clamp(
    CROSSOVER_CONCEPT_WEIGHTS.crossoverPotential * (scriptCrossoverPotential / 100) +
      CROSSOVER_CONCEPT_WEIGHTS.spectacle * (scriptSpectacle / 100) +
      CROSSOVER_CONCEPT_WEIGHTS.criticScore * (criticScore / 100),
    0,
    1,
  );
}

// accessibility: how naturally the film's own genre/target-audience combo
// can reach beyond itself - reuses data/genres.ts:GENRE_PROFILES.popularity
// and data/audiences.ts:AUDIENCE_PROFILES.marketSize (the same tables
// totalAddressableAudience above already reads) rather than a new stat, per
// the milestone brief's "propose a clear formula using existing inputs."
// Normalized against the single most accessible genre+audience combination
// the data tables can produce (Action, popularity 75, x Mass Market,
// marketSize 1.0 = 0.75) so that combination reaches accessibility 1.0
// exactly and everything else scales down from there towards the floor -
// even the least accessible combination (Drama x Niche) still keeps some
// crossover accessibility, since a small niche film can still occasionally
// break out, just far less naturally than a mass-market genre picture.
const CROSSOVER_ACCESSIBILITY_FLOOR = 0.4;
const CROSSOVER_ACCESSIBILITY_REFERENCE = 0.75;

function computeCrossoverAccessibility(genre: Genre, targetAudience: TargetAudience): number {
  const reach = (GENRE_PROFILES[genre].popularity / 100) * AUDIENCE_PROFILES[targetAudience].marketSize;
  const normalized = clamp(reach / CROSSOVER_ACCESSIBILITY_REFERENCE, 0, 1);
  return CROSSOVER_ACCESSIBILITY_FLOOR + (1 - CROSSOVER_ACCESSIBILITY_FLOOR) * normalized;
}

function computeCrossoverCapacityFraction(
  scriptCrossoverPotential: number,
  scriptSpectacle: number,
  criticScore: number,
  genre: Genre,
  targetAudience: TargetAudience,
): number {
  const conceptStrength = computeCrossoverConceptStrength(scriptCrossoverPotential, scriptSpectacle, criticScore);
  const accessibility = computeCrossoverAccessibility(genre, targetAudience);
  return clamp(CROSSOVER_CAPACITY_CEILING * conceptStrength * accessibility, 0, CROSSOVER_CAPACITY_CEILING);
}

// --- Marketing efficiency ---------------------------------------------------
//
// "How efficiently marketing spend converts into Awareness - pitch clarity,
// not pool size" (AudienceSimulationFixedState.marketingEfficiency,
// Milestone 1). Milestone 11 (docs/DESIGN.md - "release-input separation of
// concerns") moved this off script accessibility/originality entirely -
// "does this studio's marketing dollar reach people" is a studio-side
// question, not a screenplay-side one (a script being easy to explain
// doesn't make a press release more likely to run, and a script being
// original doesn't make a media buy less effective - those were both real
// coupling bugs found via that milestone's diagnostic sweep, see its
// DESIGN.md note for the numbers). `studioBrand` (Brand Recognition,
// engine/reputation.ts - was the single Studio.reputation stat until a
// later milestone split it from Prestige) is what actually drives this
// now: a studio with strong commercial name-recognition sees its marketing
// spend go further - press pays more attention, distributors give better
// placement, a trailer from a studio with a track record gets watched -
// than an unproven newcomer's identical spend. Deliberately Brand, never
// Prestige: how far a marketing pound reaches is a commercial-recognition
// question, a critically-respected-but-commercially-unknown studio (an
// A24-shaped one) doesn't get an efficiency boost here just for being
// well-reviewed. This is also what makes marketing effectiveness itself a
// genuine progression mechanic (docs/DESIGN.md Milestone 11's "marketing
// as a progression mechanic" goal): Brand climbs from real commercial
// outcomes (engine/reputation.ts), starting at 20 (state/gameState.ts) for
// a brand-new studio, so the exact same spend buys meaningfully more
// awareness once a studio has a few hits behind it.
const MARKETING_EFFICIENCY_FLOOR = 0.3;
const MARKETING_EFFICIENCY_CEILING = 1.0;

function computeMarketingEfficiency(studioBrand: number): number {
  return clamp(MARKETING_EFFICIENCY_FLOOR + (MARKETING_EFFICIENCY_CEILING - MARKETING_EFFICIENCY_FLOOR) * (studioBrand / 100), 0, 1);
}

// --- Distribution - release type reinterpreted as its own economic/access
// concept, not an awareness lever ------------------------------------------
//
// Milestone 11 (docs/DESIGN.md - "release-input separation of concerns")
// renamed this from ReleaseTypeAudienceProfile/RELEASE_TYPE_AUDIENCE_PROFILES:
// every field that's left here is genuinely about *distribution* -
// exhibition access and how fast it can be realized - now that
// `initialAwarenessShare`/`ongoingAwarenessFactor` (this table's old
// awareness-manufacturing fields) are gone. A diagnostic sweep before this
// milestone found release type was scaling initialAwareCount by up to 30x
// between Wide (0.9) and Festival First (0.03) on top of *also* gating
// availability by a further ~47x - the same "how widely is this playing"
// question was being asked, and answered, twice, through two different
// mechanisms that fought over the same conceptual territory. "Do people
// know this film exists" and "how much of that can convert to a ticket
// this week" are different questions (exactly the reasoning Milestone 9's
// own availability system was built on - see its DESIGN.md note); this
// table only ever answers the second one now. Distribution's *cost* side
// lives one file over (data/release.ts:RELEASE_TYPE_PROFILES.costMultiplier,
// engine/cost.ts:computeMarketingCost) rather than being duplicated here -
// the same concept, split across the same isolation boundary every other
// release-day input already respects.
//
// Two release-type-shaped facts genuinely matter here:
//
// - conversionPacingBaseline: per-person weekly attendance urgency, and
//   "how quickly awareness can actually convert into admissions" (the
//   milestone brief's own phrase for Distribution's job) - Wide's
//   everywhere-at-once release creates real scarcity pressure ("see it
//   this weekend or miss the only cinema showing it nearby" energy);
//   Limited/Festival First start low and lean on word of mouth's pull-
//   forward effect (audienceSimulationStep.ts step 8) to build urgency
//   later, exactly the "platform release" shape the brief asks to emerge
//   rather than be hand-built.
// - initialAvailabilityFraction/availabilityBaseWeeklyDecay/
//   criticLedExpansionWeight (Milestone 9): exhibition access itself and
//   its expansion potential - unchanged this milestone, already correctly
//   scoped to "how much of existing demand gets realized," not awareness.
//
// A platform-style run isn't a fourth profile - it's what Limited's low
// initialAvailabilityFraction plus a strong reception's word-of-mouth
// effects (Milestone 2) and availability's own performance-driven
// expansion (Milestone 9) produce on their own, the same emergent-shape
// principle DESIGN.md 5.34 already established. Awareness is now identical
// between all three release types for the same buzz/marketing/cast inputs
// - a Festival premiere can generate just as much press/anticipation as a
// Wide release announcement; the difference is purely how much of that
// demand can be served this week, which is what distribution actually is.
interface DistributionProfile {
  conversionPacingBaseline: number;
  /**
   * Milestone 9 (docs/DESIGN.md 5.34, "availability") - release-day
   * theatrical access, AudienceSimulationFixedState.initialAvailabilityFraction's
   * source. Wide opens on nearly every screen at once; Limited on a
   * handful of theaters; Festival First on barely any general-public
   * screens at all (mostly the festival circuit itself).
   */
  initialAvailabilityFraction: number;
  /**
   * How fast this release type's availability eats into itself before any
   * performance-based modulation - AudienceSimulationFixedState.availabilityBaseWeeklyDecay's
   * source. Wide's screens get reallocated to next Friday's openers fast,
   * regardless of how well the film not-catastrophically-failing is
   * doing; Limited/Festival First aren't fighting for that same weekly
   * turnover, so a small release that's merely holding steady doesn't
   * need to actively fight decay to stay put.
   */
  availabilityBaseWeeklyDecay: number;
  /**
   * AudienceSimulationFixedState.criticLedExpansionWeight's source - 0 for
   * Wide/Limited (expansion is purely utilisation-driven), meaningfully
   * positive for Festival First (a festival film's path to wider release
   * is a critic/press-led distributor decision, not a numerically smaller
   * version of Limited's audience-driven platform expansion).
   */
  criticLedExpansionWeight: number;
}

const DISTRIBUTION_PROFILES: Record<SupportedReleaseType, DistributionProfile> = {
  Wide: {
    conversionPacingBaseline: 0.14,
    initialAvailabilityFraction: 0.95, availabilityBaseWeeklyDecay: 0.18, criticLedExpansionWeight: 0,
  },
  Limited: {
    conversionPacingBaseline: 0.06,
    initialAvailabilityFraction: 0.1, availabilityBaseWeeklyDecay: 0.02, criticLedExpansionWeight: 0,
  },
  'Festival First': {
    conversionPacingBaseline: 0.05,
    initialAvailabilityFraction: 0.02, availabilityBaseWeeklyDecay: 0.015, criticLedExpansionWeight: 0.65,
  },
};

function distributionProfile(releaseType: SupportedReleaseType): DistributionProfile {
  const profile = DISTRIBUTION_PROFILES[releaseType];
  if (!profile) {
    throw new Error(`audienceSimulationInputs: unsupported release type "${releaseType}" - Streaming has no theatrical-admissions model yet`);
  }
  return profile;
}

// --- Release strength - "the market decides how successful the strategy
// actually is" (Milestone 12, docs/DESIGN.md - "revisit release types") --
//
// A diagnostic sweep found Wide's initialAvailabilityFraction was a flat
// 0.95 for *every* studio choosing it - a tiny, unknown, poorly-funded
// studio (Brand 10, £50k marketing) got the exact same nationwide rollout
// as a major studio (Brand 85, £120M marketing) for choosing the identical
// release type, with no mechanism representing "cinemas decide whether to
// actually give you that distribution." releaseStrength reuses the same
// marketingReachFraction/marketingEfficiency signals computeInitialAwareCount
// already computes below (not reinvented) - a studio that can't back
// "Wide" with real marketing spend or Brand Recognition doesn't get to
// skip that cost, the same as it doesn't get to skip it for awareness.
// Only Wide is scaled this way - Limited/Festival First are already
// deliberately modest by design (this was never where the "free money"
// problem lived, per the diagnostic), and both already earn wider
// distribution through Milestone 9's own performance-driven expansion when
// a platform release actually takes off - Wide now follows the same
// "strategy attempted, market decides how much of it lands" principle on
// day one instead of getting it unconditionally.
const WIDE_AVAILABILITY_FLOOR = 0.4;
const RELEASE_STRENGTH_MARKETING_WEIGHT = 0.6;
const RELEASE_STRENGTH_BRAND_WEIGHT = 0.4;

function computeReleaseStrength(marketingSpend: number, marketingEfficiency: number): number {
  return clamp(
    RELEASE_STRENGTH_MARKETING_WEIGHT * marketingReachFraction(marketingSpend) + RELEASE_STRENGTH_BRAND_WEIGHT * marketingEfficiency,
    0,
    1,
  );
}

/** DISTRIBUTION_PROFILES[releaseType].initialAvailabilityFraction is Wide's *ceiling*, only reached by a genuinely strong release package - see the module note above. Limited/Festival First are untouched, always at their own flat (already-modest) value regardless of release strength. */
function computeInitialAvailabilityFraction(releaseType: SupportedReleaseType, releaseStrength: number): number {
  const ceiling = distributionProfile(releaseType).initialAvailabilityFraction;
  if (releaseType !== 'Wide') return ceiling;
  return WIDE_AVAILABILITY_FLOOR + (ceiling - WIDE_AVAILABILITY_FLOOR) * releaseStrength;
}

// --- Conversion pacing baseline: distribution + release window/genre fit
// + Buzz's event-scarcity urgency ------------------------------------------
//
// Release window's seasonal crowd and genre-specific bonus (data/release.ts,
// already the live model's single source of truth for "does Halloween
// help Horror") don't change *who* could like the film - they change how
// ready people already interested are to act *now*, which is exactly
// ConversionPacing's job description (DESIGN.md 5.34), not
// totalAddressableAudience's. Distribution remains the *primary* driver
// (DESIGN.md 5.34) - Buzz only adds a modest secondary boost, deliberately
// small (BUZZ_URGENCY_WEIGHT) so a high-buzz Limited release doesn't
// quietly become Wide's pacing in disguise, but real: an "everyone's
// talking about it, see it this weekend" event film genuinely converts its
// opening-week crowd faster than a same-release-type film nobody's
// buzzing about, independent of whatever word of mouth does afterward.
// This is buzzScore's one remaining job in this module (Milestone 11
// removed its old awareness-seeding role - see computeCastReachFraction
// below) - urgency/pacing legitimately wants the same composite "how much
// is everyone talking about this right now" reading awareness generation
// no longer does.
const BUZZ_URGENCY_WEIGHT = 0.5;
function computeConversionPacingBaseline(releaseType: SupportedReleaseType, releaseWindow: ReleaseWindow, genre: Genre, buzzScore: number): number {
  const windowBase = RELEASE_WINDOW_BASE_MULTIPLIER[releaseWindow];
  const windowGenreBonus = RELEASE_WINDOW_GENRE_BONUS[releaseWindow][genre] ?? 1;
  const buzzUrgency = 1 + BUZZ_URGENCY_WEIGHT * (buzzScore / 100);
  return clamp(distributionProfile(releaseType).conversionPacingBaseline * windowBase * windowGenreBonus * buzzUrgency, 0, 1);
}

// --- Initial (release-day) awareness seed -----------------------------------
//
// Milestone 11 (docs/DESIGN.md - "release-input separation of concerns")
// rebuilt this from the ground up around a diagnostic finding: the old
// formula fed `buzzScore` (already a composite that blends marketing spend
// in via computeBuzzScore's own `marketingBuzz` term) into one reach
// channel, and `marketingSpend` directly into a second, separate reach
// channel - the same marketing pound was silently counted twice, through
// two different curves, which diluted marketing's own relative importance
// and made it hard to reason about ("why does an unknown studio with
// average buzz and moderately famous actors already carry meaningful
// demand"). Awareness is now built from exactly three inputs, each counted
// once: marketing spend (dominant - "marketing buys awareness, not
// quality"), a direct cast/fame "who's involved" reach term (director
// + lead fame, independent of buzzScore), and marketingEfficiency
// (studioBrand-driven - see above). `buzzScore` no longer appears
// anywhere in this function.
//
// The convex low-fame floor mirrors the same shape Milestone 2's reception
// multiplier already established (own constants, not imported from
// boxOffice.ts, to keep this module's only coupling to the old model at
// the data-table level, not the formula level): a genuinely obscure cast
// must produce negligible organic reach on its own, not a respectable
// baseline.
const MAX_CAST_ORGANIC_REACH = 0.1;

function computeCastReachFraction(
  directorFame: number,
  leadFame: number,
): number {
  const combinedFame =
    clamp(directorFame, 0, 100) * 0.25 +
    clamp(leadFame, 0, 100) * 0.75;

  return (
    MAX_CAST_ORGANIC_REACH *
    (combinedFame / 100) ** 2
  );
}


// Log-scale anchors mapping a marketing spend amount (data/release.ts's
// £10k-£150M range) onto a 0-1 raw reach fraction, before marketingEfficiency
// scaling. Deliberately steeper than a naive log-linear curve would produce
// (re-picked this milestone against a diagnostic sweep, not the original
// Milestone 3 anchors - see that milestone's DESIGN.md note for the
// before/after numbers): a token campaign (a few hundred thousand pounds)
// needs to buy only a sliver of a worldwide addressable population's
// awareness, while a genuine blockbuster-scale campaign (tens/hundreds of
// millions) needs real room to keep paying off, so marketing spend reads
// as a satisfying, dramatic progression lever across a playthrough rather
// than saturating early.
const MARKETING_REACH_ANCHORS: ScaleAnchor<'reach'>[] = [
  {
    t: 0,
    values: { reach: 0 },
    description:
      'A token campaign with almost no measurable reach.',
  },
  {
    t: 0.25,
    values: { reach: 0.03 },
    description:
      'A small targeted or local campaign.',
  },
  {
    t: 0.5,
    values: { reach: 0.12 },
    description:
      'A meaningful specialist or regional campaign.',
  },
  {
    t: 0.75,
    values: { reach: 0.35 },
    description:
      'A major national campaign with broad public visibility.',
  },
  {
    t: 0.9,
    values: { reach: 0.62 },
    description:
      'A major international campaign across mass media and digital channels.',
  },
  {
    t: 1,
    values: { reach: 0.85 },
    description:
      'An exceptional global blockbuster campaign with near-ubiquitous visibility.',
  },
];


function marketingReachFraction(
  marketingSpend: number,
): number {
  const t = logT(
    marketingSpend,
    MARKETING_SPEND_RANGE,
  );

  return interpolateScale(
    t,
    MARKETING_REACH_ANCHORS,
    'reach',
  );
}

function combineIndependentReach(
  ...reachFractions: number[]
): number {
  const unreachedFraction = reachFractions.reduce(
    (remaining, reach) =>
      remaining * (1 - clamp(reach, 0, 1)),
    1,
  );

  return 1 - unreachedFraction;
}


function computeInitialAwareCount(
  fixed: {
    totalAddressableAudience: number;
    marketingEfficiency: number;
  },
  directorFame: number,
  leadFame: number,
  marketingSpend: number,
): number {
  const marketingReach = clamp(
    marketingReachFraction(marketingSpend) *
      fixed.marketingEfficiency,
    0,
    0.95,
  );

  const castReach = computeCastReachFraction(
    directorFame,
    leadFame,
  );

  const combinedReach = combineIndependentReach(
    marketingReach,
    castReach,
  );

  return Math.round(
    fixed.totalAddressableAudience *
      combinedReach,
  );
}

// --- Ongoing external awareness trickle -------------------------------------
//
// A small residual rate, distinct from the one-time seed above - continued
// press/incidental discovery during the run. Milestone 11 removed this
// function's old release-type scaling for the same reason initial awareness
// lost it: how widely a film is *playing* is a distribution question, not
// an awareness one, and there's a real, honest marketing story
// (marketingEfficiency, driven by studioBrand) still doing the actual
// scaling work here - a well-known studio's marketing keeps paying off a
// little after opening too, regardless of how many screens the film is on.
const EXTERNAL_AWARENESS_BASE_RATE = 0.03;
function computeExternalWeeklyAwarenessRate(marketingEfficiency: number): number {
  return clamp(EXTERNAL_AWARENESS_BASE_RATE * (0.5 + 0.5 * marketingEfficiency), 0, 1);
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
  const baseInterestFraction = computeBaseInterestFraction(inputs.scriptAccessibility, inputs.scriptHookStrength, inputs.targetAudience, inputs.scriptIntendedAudience);
  const crossoverCapacityFraction = computeCrossoverCapacityFraction(
    inputs.scriptCrossoverPotential,
    inputs.scriptSpectacle,
    inputs.criticScore,
    inputs.genre,
    inputs.targetAudience,
  );
  const marketingEfficiency = computeMarketingEfficiency(inputs.studioBrand);
  const conversionPacingBaseline = computeConversionPacingBaseline(inputs.releaseType, inputs.releaseWindow, inputs.genre, inputs.buzzScore);
  const externalWeeklyAwarenessRate = computeExternalWeeklyAwarenessRate(marketingEfficiency);
  const initialAwareCount = computeInitialAwareCount(
    { totalAddressableAudience, marketingEfficiency },
    inputs.directorFame,
    inputs.leadFame,
    inputs.marketingSpend,
  );

  const distribution = distributionProfile(inputs.releaseType);
  const releaseStrength = computeReleaseStrength(inputs.marketingSpend, marketingEfficiency);
  const initialAvailabilityFraction = computeInitialAvailabilityFraction(inputs.releaseType, releaseStrength);

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
    initialAvailabilityFraction,
    availabilityBaseWeeklyDecay: distribution.availabilityBaseWeeklyDecay,
    criticLedExpansionWeight: distribution.criticLedExpansionWeight,
  });
}
