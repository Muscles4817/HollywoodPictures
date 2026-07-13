import type {
  ActorTalent,
  DirectorTalent,
  Genre,
  MarketingChoices,
  PostProductionChoices,
  ProductionChoices,
  ProductionEvent,
  Script,
  Talent,
} from '../types';
import { GENRE_PROFILES } from '../data/genres';
import { TONES } from '../data/tones';
import { computeTalentCompatibility } from './compatibility';
import { deriveCommercialProfile } from './commercialProfile';
import {
  contingencyQuality,
  overallSpendT,
  shootingQualityFromRatio,
  setQualityScore,
  practicalEffectsScore,
  vfxScore,
  runtimeMarketabilityDelta,
  marketingBuzzContribution,
} from './productionDials';
import { EDIT_STYLE_PROFILES, FINAL_CUT_FOCUS_PROFILES, MUSIC_FOCUS_PROFILES, TEST_SCREENING_PROFILES } from '../data/postProduction';
import { RELEASE_TYPE_PROFILES } from '../data/release';
import { AUDIENCE_WEIGHTS, CRITIC_WEIGHTS } from '../data/scoringWeights';
import { computeQualityWeights } from './genreWeights';
import { clamp } from './random';

function getDirector(talent: Talent[]): DirectorTalent | undefined {
  return talent.find((t): t is DirectorTalent => t.role === 'Director');
}

/** A script can call for more than one lead (Script.requiredLeads) - see castRequirements.ts. */
function getLeadActors(talent: Talent[]): ActorTalent[] {
  return talent.filter((t): t is ActorTalent => t.role === 'Lead Actor');
}

function getSupportingActors(talent: Talent[]): ActorTalent[] {
  return talent.filter((t): t is ActorTalent => t.role === 'Supporting Actor');
}

/** How well a hired talent suits this specific script - see computeTalentCompatibility. */
function compatibility(t: DirectorTalent | ActorTalent | undefined, script: Script): number {
  if (!t) return 50; // no one hired for this role -> neutral default
  return computeTalentCompatibility(t, script) ?? 50;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Script quality independent of genre fit - pure craft (originality,
 * structure, characters, dialogue), evenly weighted. No commercial term any
 * more (docs/DESIGN.md - screenplay redesign, "split marketability"): what
 * used to be Script.marketability's 0.15 slot here conflated "is this
 * well-written" with "is this sellable," which is exactly the "asking one
 * stat to do too much" problem the redesign set out to fix - commercial
 * appeal now only enters the scoring chain via computeMarketabilityScore/
 * computeBuzzScore below, both already-separate concepts.
 */
export function computeScriptScore(script: Script): number {
  return script.originality * 0.25 + script.structure * 0.25 + script.characters * 0.25 + script.dialogue * 0.25;
}

/**
 * How closely a screenplay's actual tone profile matches its genre's
 * canonical vector - replaces the old independently-rolled Script.genreFit
 * stat (docs/DESIGN.md - screenplay redesign). A script generated with a
 * strong flavor boost (an action-comedy, a horror-tragedy) reads as a
 * looser fit for its headline genre than a "straight" one, which is exactly
 * what genre fit is supposed to capture - derived from the same tone
 * profile the player already sees, not a second independent number.
 */
function deriveGenreFit(script: Script, genre: Genre): number {
  const canonical = GENRE_PROFILES[genre].canonicalTone;
  const totalDeviation = TONES.reduce((sum, tone) => sum + Math.abs(script.toneProfile[tone] - canonical[tone]), 0);
  return clamp(100 - totalDeviation / TONES.length, 0, 100);
}

/** Director's contribution: raw skill plus how well their style suits this script. */
export function computeDirectionScore(talent: Talent[], script: Script): number {
  const director = getDirector(talent);
  if (!director) return 35; // no director hired is a serious quality hit
  return director.skill * 0.6 + compatibility(director, script) * 0.4;
}

/**
 * Combined lead + supporting acting quality, weighted toward the leads.
 * Unlike Direction, this is compatibility alone - an actor's ActingStyle
 * has no separate "skill" number sitting next to it (see types/index.ts),
 * so how well their specific strengths suit this script IS their
 * contribution. Both Lead Actor and Supporting Actor can now hold more than
 * one person - a script's requiredLeads/requiredSupporting sets exactly how
 * many (see engine/castRequirements.ts) - and either ensemble is *averaged*,
 * not summed: a two-lead buddy film doesn't automatically outscore a
 * one-lead film, it's the average fit of whoever's cast in those roles.
 */
export function computeActingScore(talent: Talent[], script: Script): number {
  const leads = getLeadActors(talent);
  const supports = getSupportingActors(talent);

  const leadScoreAvg = average(leads.map((l) => compatibility(l, script)));
  const supportScoreAvg = average(supports.map((s) => compatibility(s, script)));

  return (leadScoreAvg ?? 30) * 0.7 + (supportScoreAvg ?? 30) * 0.3;
}

/**
 * Quality contributed by production choices. VFX/practical-effects weight is
 * scaled per genre - Action/Sci-Fi/Fantasy lean on VFX, Drama/Romance don't.
 * `shootingRatio` is daysElapsed/recommendedDays from the finished shoot
 * (PhotographyState) - shooting quality is read off how photography
 * actually went, not a pre-set pace dial (see
 * productionDials.ts:shootingQualityFromRatio).
 */
export function computeProductionScore(choices: ProductionChoices, genre: Genre, shootingRatio: number): number {
  const profile = GENRE_PROFILES[genre];
  const contingency = contingencyQuality(choices.contingencyAmount);
  const style = shootingQualityFromRatio(shootingRatio);
  const set = setQualityScore(choices.setQualityAmount);
  const practical = practicalEffectsScore(choices.practicalEffectsAmount);
  const vfx = vfxScore(choices.vfxAmount);

  const effectsWeightTotal = profile.vfxImportance + profile.practicalEffectsImportance;
  const effectsScore =
    effectsWeightTotal > 0
      ? (vfx * profile.vfxImportance + practical * profile.practicalEffectsImportance) / effectsWeightTotal
      : (vfx + practical) / 2;

  return contingency * 0.35 + style * 0.25 + set * 0.2 + effectsScore * 0.2;
}

/**
 * Net quality swing from every rolled production event (positive and
 * negative), as a display-only 0-100 reading (FilmDetailModal,
 * ReleaseResults) - not what actually feeds Quality Score any more, see
 * computeQualityBreakdown's own comment for where the raw qualityDelta sum
 * actually lands (folded into Production, unamplified).
 */
export function computeEventsScore(events: ProductionEvent[]): number {
  const totalQualityDelta = events.reduce((sum, e) => sum + e.qualityDelta, 0);
  // Each event's raw delta is small (roughly -10..+10); amplify so a
  // shoot's worth of events (however many days it actually took - no
  // longer a fixed 3-5) meaningfully moves this display reading away from a
  // neutral 50. Clamped below, so an unusually long shoot with many events
  // saturates rather than blowing past the scale.
  return clamp(50 + totalQualityDelta * 2, 0, 100);
}

/** Post-production craft score from editing, music and test-screening choices. */
export function computePostProductionScore(choices: PostProductionChoices): number {
  const base = 55;
  const testScreening = TEST_SCREENING_PROFILES[choices.testScreeningResponse].qualityDelta;
  const music = MUSIC_FOCUS_PROFILES[choices.musicFocus].qualityDelta;
  const balancedBonus = choices.editStyle === 'Balanced' ? 5 : 0;
  return clamp(base + testScreening + music + balancedBonus, 0, 100);
}

/** How well the whole package (script, key talent, budget) suits the chosen genre. */
export function computeGenreFitScore(script: Script, talent: Talent[], genre: Genre, choices: ProductionChoices): number {
  const profile = GENRE_PROFILES[genre];
  const director = getDirector(talent);
  const leads = getLeadActors(talent);
  const leadFit = average(leads.map((l) => compatibility(l, script))) ?? 50;
  const talentFit = (compatibility(director, script) + leadFit) / 2;

  // A low overall spend only suits genres tagged as low-budget-friendly (e.g.
  // Horror); the penalty tapers off linearly and is gone entirely a third of
  // the way up the spend scale. Reads overallSpendT (all four spend dials
  // averaged) rather than contingencyAmount alone - a film can't dodge this
  // by pumping money into VFX while leaving contingency at zero, or vice
  // versa; what matters is how well-resourced the production is overall.
  const CHEAP_PENALTY_CUTOFF_T = 0.35;
  const t = overallSpendT(choices);
  const cheapFit = 30 + profile.lowBudgetFriendly * 60;
  const budgetFit = t >= CHEAP_PENALTY_CUTOFF_T ? 85 : cheapFit + (85 - cheapFit) * (t / CHEAP_PENALTY_CUTOFF_T);

  return deriveGenreFit(script, genre) * 0.4 + talentFit * 0.35 + budgetFit * 0.25;
}

/** How sellable the film looks, independent of how it eventually gets marketed. */
export function computeMarketabilityScore(script: Script, talent: Talent[], choices: ProductionChoices): number {
  const leads = getLeadActors(talent);
  const supports = getSupportingActors(talent);
  const leadFameAvg = average(leads.map((l) => l.fame)) ?? 30;
  const supportFameAvg = average(supports.map((s) => s.fame)) ?? 30;
  const fameAvg = (leadFameAvg + supportFameAvg) / 2;
  const runtimeDelta = runtimeMarketabilityDelta(choices.runtimeIntensity);
  return clamp(deriveCommercialProfile(script).hookStrength * 0.5 + fameAvg * 0.45 + runtimeDelta, 0, 100);
}

export interface QualityBreakdown {
  scriptScore: number;
  directionScore: number;
  actingScore: number;
  productionScore: number;
  postProductionScore: number;
  eventsScore: number;
  qualityScore: number;
}

// Per-link independence floors for the soft-ceiling dependency chain below -
// "effective = raw * (K + (1-K) * upstreamRatio)". K=1 would mean fully
// independent (today's old additive behavior); K=0 would mean a hard
// multiplicative gate. Each link gets its own K rather than one global
// constant, tuned to how forgiving that specific relationship should be:
// a great director can still mostly save an average script (K_SCRIPT_TO_DIRECTION
// is forgiving), but an editor genuinely cannot create footage that was
// never captured (K_FOOTAGE_TO_EDITING is the strictest). None of these are
// hard caps - a downstream department always retains at least K of its own
// raw score, leaving room for future director/crew traits (improvisation,
// script doctoring) to claw back some of what upstream weakness costs.
const K_SCRIPT_TO_DIRECTION = 0.65;
const K_DIRECTION_TO_ACTING = 0.4;
const K_DIRECTION_TO_PRODUCTION = 0.4;
const K_FOOTAGE_TO_EDITING = 0.25;

// How Acting's upstream ceiling blends script (the material) against
// direction (the director's ability to get performances out of it) - director
// weighted higher since "the director's ability to get performances" is the
// more direct lever than the raw material alone.
const ACTING_UPSTREAM_SCRIPT_WEIGHT = 0.35;
const ACTING_UPSTREAM_DIRECTION_WEIGHT = 0.65;

// "Captured footage" - what Post-Production actually has to work with -
// blends direction (coverage/blocking), acting (the performances on camera)
// and production (sets/effects visibly in-frame), tilted toward direction
// as the primary driver of what gets captured.
const FOOTAGE_DIRECTION_WEIGHT = 0.4;
const FOOTAGE_ACTING_WEIGHT = 0.3;
const FOOTAGE_PRODUCTION_WEIGHT = 0.3;

/**
 * Final Quality Score: no longer six independently-weighted departments -
 * Script sets the film's potential, Direction determines how much of it
 * gets captured, Acting and Production happen within what Direction
 * captures, and Post-Production/Editing is bounded by all of that combined
 * ("captured footage") rather than Script directly, since an editor can't
 * create footage that doesn't exist. Every step is a soft ceiling (see the
 * K constants above), not a hard cap - a downstream department never drops
 * to zero just because something upstream did badly.
 *
 * Production and on-set events are deliberately *not* independent top-level
 * terms any more: Production's raw score absorbs events as a direct
 * modifier (nearly every event template - schedule/morale/safety/technical/
 * budget - is fundamentally about how the shoot itself went, see
 * data/productionEvents.ts), then Production's whole (event-adjusted) value
 * only reaches the final score via the dependency chain, the same as every
 * other non-root department - "the dependency chain determines how much
 * those changes reach the final film," not a flat direct add/subtract.
 * scriptScore/directionScore/actingScore/productionScore/postProductionScore/
 * eventsScore are all still returned as raw, pre-ceiling readings - nothing
 * about what's displayed to the player (FilmDetailModal, ReleaseResults,
 * engine/reviews.ts) changes, only how they combine into qualityScore.
 */
export function computeQualityBreakdown(
  script: Script,
  talent: Talent[],
  genre: Genre,
  productionChoices: ProductionChoices,
  postProductionChoices: PostProductionChoices,
  events: ProductionEvent[],
  shootingRatio: number,
): QualityBreakdown {
  const scriptScore = computeScriptScore(script);
  const directionScore = computeDirectionScore(talent, script);
  const actingScore = computeActingScore(talent, script);
  const productionScore = computeProductionScore(productionChoices, genre, shootingRatio);
  const postProductionScore = computePostProductionScore(postProductionChoices);
  const eventsScore = computeEventsScore(events);

  const scriptRatio = scriptScore / 100;
  const directionRatio = (directionScore / 100) * (K_SCRIPT_TO_DIRECTION + (1 - K_SCRIPT_TO_DIRECTION) * scriptRatio);

  const actingUpstream = ACTING_UPSTREAM_SCRIPT_WEIGHT * scriptRatio + ACTING_UPSTREAM_DIRECTION_WEIGHT * directionRatio;
  const actingRatio = (actingScore / 100) * (K_DIRECTION_TO_ACTING + (1 - K_DIRECTION_TO_ACTING) * actingUpstream);

  // Events fold into Production directly (no amplification, unlike the
  // display-only computeEventsScore above) - a shoot's worth of incidents
  // nudges how well the physical production actually came together.
  const eventsQualityDelta = events.reduce((sum, e) => sum + e.qualityDelta, 0);
  const productionScoreWithEvents = clamp(productionScore + eventsQualityDelta, 0, 100);
  const productionRatio =
    (productionScoreWithEvents / 100) * (K_DIRECTION_TO_PRODUCTION + (1 - K_DIRECTION_TO_PRODUCTION) * directionRatio);

  const footageRatio =
    FOOTAGE_DIRECTION_WEIGHT * directionRatio + FOOTAGE_ACTING_WEIGHT * actingRatio + FOOTAGE_PRODUCTION_WEIGHT * productionRatio;
  const postProductionRatio =
    (postProductionScore / 100) * (K_FOOTAGE_TO_EDITING + (1 - K_FOOTAGE_TO_EDITING) * footageRatio);

  const effDirection = 100 * directionRatio;
  const effActing = 100 * actingRatio;
  const effPostProduction = 100 * postProductionRatio;

  const weights = computeQualityWeights(genre);
  const qualityScore =
    scriptScore * weights.script +
    effDirection * weights.direction +
    effActing * weights.acting +
    effPostProduction * weights.postProduction;

  return { scriptScore, directionScore, actingScore, productionScore, postProductionScore, eventsScore, qualityScore };
}

/** Critic Score: craft-driven - quality, originality, direction, edit style, release type. */
export function computeCriticScore(
  quality: QualityBreakdown,
  script: Script,
  postProductionChoices: PostProductionChoices,
  marketingChoices: MarketingChoices,
): number {
  const editStyleScore = clamp(60 + EDIT_STYLE_PROFILES[postProductionChoices.editStyle].criticDelta * 3, 0, 100);
  const score =
    quality.qualityScore * CRITIC_WEIGHTS.quality +
    script.originality * CRITIC_WEIGHTS.originality +
    quality.directionScore * CRITIC_WEIGHTS.direction +
    editStyleScore * CRITIC_WEIGHTS.editStyle;
  // Festival First courts critics directly; other release types are neutral.
  const releaseTypeBonus = RELEASE_TYPE_PROFILES[marketingChoices.releaseType].criticBonus;
  return clamp(score + releaseTypeBonus, 0, 100);
}

/**
 * Audience Score: entertainment-driven - genre fit, star power, pacing.
 * Deliberately has no marketing term - marketing builds awareness, not
 * affection; whether the people who actually saw the film enjoyed it isn't
 * something a bigger ad spend can buy (see computeBuzzScore for where
 * marketing actually belongs).
 */
export function computeAudienceScore(
  quality: QualityBreakdown,
  script: Script,
  talent: Talent[],
  genre: Genre,
  productionChoices: ProductionChoices,
  postProductionChoices: PostProductionChoices,
): number {
  const genreFitScore = computeGenreFitScore(script, talent, genre, productionChoices);
  const leads = getLeadActors(talent);
  const actorFameScore = average(leads.map((l) => l.fame)) ?? 30;

  const entertainmentScore = clamp(
    55 +
      EDIT_STYLE_PROFILES[postProductionChoices.editStyle].audienceDelta * 3 +
      FINAL_CUT_FOCUS_PROFILES[postProductionChoices.finalCutFocus].audienceDelta * 3 +
      (quality.qualityScore - 50) * 0.3,
    0,
    100,
  );

  const score =
    genreFitScore * AUDIENCE_WEIGHTS.genreFit +
    actorFameScore * AUDIENCE_WEIGHTS.actorFame +
    entertainmentScore * AUDIENCE_WEIGHTS.entertainment +
    quality.productionScore * AUDIENCE_WEIGHTS.production;

  return clamp(score, 0, 100);
}

/**
 * Buzz Score: pre-release hype, not reception - this is what drives Opening
 * Weekend (engine/boxOffice.ts), separately from whether the film is
 * actually any good. Dominated by three things a studio can genuinely
 * build: how famous the director/leads are, how commercially recognised
 * the studio itself is (Brand Recognition - engine/reputation.ts), and how
 * much is spent getting the word out. Money alone (marketing) caps out
 * well short of 100 - fame and Brand aren't for sale, they're earned by
 * who you cast and how your past films performed commercially - so a
 * wealthy but unknown studio with no-name talent still can't buy its way
 * to a phenomenon. Deliberately reads Brand, never Prestige - pre-release
 * hype is a commercial-recognition question ("have people heard of this
 * studio"), not a critical-esteem one. Events/music/final-cut/script-
 * marketability stay as smaller flavor modifiers on top, same as before.
 */
export function computeBuzzScore(
  script: Script,
  talent: Talent[],
  events: ProductionEvent[],
  postProductionChoices: PostProductionChoices,
  marketingChoices: MarketingChoices,
  studioBrand: number,
): number {
  const director = getDirector(talent);
  const leads = getLeadActors(talent);
  const buzzworthyFame = [director?.fame, ...leads.map((l) => l.fame)].filter((f): f is number => f !== undefined);
  const fameAvg = average(buzzworthyFame) ?? 30;

  const fameBuzz = (fameAvg - 50) * 0.5;
  const brandBuzz = (studioBrand - 50) * 0.4;
  const marketingBuzz = marketingBuzzContribution(marketingChoices.marketingSpend);

  const eventsBuzz = events.reduce((sum, e) => sum + e.buzzDelta, 0);
  const musicBuzz = MUSIC_FOCUS_PROFILES[postProductionChoices.musicFocus].buzzDelta;
  const finalCutBuzz = FINAL_CUT_FOCUS_PROFILES[postProductionChoices.finalCutFocus].buzzDelta;
  const scriptBuzz = (deriveCommercialProfile(script).hookStrength - 50) * 0.2;

  return clamp(10 + fameBuzz + brandBuzz + marketingBuzz + eventsBuzz + musicBuzz + finalCutBuzz + scriptBuzz, 0, 100);
}
