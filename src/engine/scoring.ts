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
import { computeTalentCompatibility } from './compatibility';
import {
  budgetT,
  budgetQuality,
  shootingQuality,
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

/** Script quality independent of genre fit (originality/structure/dialogue/marketability). */
export function computeScriptScore(script: Script): number {
  return script.originality * 0.3 + script.structure * 0.3 + script.dialogue * 0.25 + script.marketability * 0.15;
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
 */
export function computeProductionScore(choices: ProductionChoices, genre: Genre): number {
  const profile = GENRE_PROFILES[genre];
  const budget = budgetQuality(choices.budgetAmount);
  const style = shootingQuality(choices.shootingIntensity);
  const set = setQualityScore(choices.setQualityAmount);
  const practical = practicalEffectsScore(choices.practicalEffectsAmount);
  const vfx = vfxScore(choices.vfxAmount);

  const effectsWeightTotal = profile.vfxImportance + profile.practicalEffectsImportance;
  const effectsScore =
    effectsWeightTotal > 0
      ? (vfx * profile.vfxImportance + practical * profile.practicalEffectsImportance) / effectsWeightTotal
      : (vfx + practical) / 2;

  return budget * 0.35 + style * 0.25 + set * 0.2 + effectsScore * 0.2;
}

/** Net quality swing from every rolled production event (positive and negative). */
export function computeEventsScore(events: ProductionEvent[]): number {
  const totalQualityDelta = events.reduce((sum, e) => sum + e.qualityDelta, 0);
  // Each event's raw delta is small (roughly -10..+10); amplify so 3-5 events
  // meaningfully move this 10%-weighted bucket away from a neutral 50.
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

  // A low budget only suits genres tagged as low-budget-friendly (e.g. Horror);
  // the penalty tapers off linearly and is gone entirely by a third of the way up the budget scale.
  const CHEAP_PENALTY_CUTOFF_T = 0.35;
  const t = budgetT(choices.budgetAmount);
  const cheapFit = 30 + profile.lowBudgetFriendly * 60;
  const budgetFit = t >= CHEAP_PENALTY_CUTOFF_T ? 85 : cheapFit + (85 - cheapFit) * (t / CHEAP_PENALTY_CUTOFF_T);

  return script.genreFit * 0.4 + talentFit * 0.35 + budgetFit * 0.25;
}

/** How sellable the film looks, independent of how it eventually gets marketed. */
export function computeMarketabilityScore(script: Script, talent: Talent[], choices: ProductionChoices): number {
  const leads = getLeadActors(talent);
  const supports = getSupportingActors(talent);
  const leadFameAvg = average(leads.map((l) => l.fame)) ?? 30;
  const supportFameAvg = average(supports.map((s) => s.fame)) ?? 30;
  const fameAvg = (leadFameAvg + supportFameAvg) / 2;
  const runtimeDelta = runtimeMarketabilityDelta(choices.runtimeIntensity);
  return clamp(script.marketability * 0.5 + fameAvg * 0.45 + runtimeDelta, 0, 100);
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

/** Final Quality Score: the weighted core of the whole simulation. */
export function computeQualityBreakdown(
  script: Script,
  talent: Talent[],
  genre: Genre,
  productionChoices: ProductionChoices,
  postProductionChoices: PostProductionChoices,
  events: ProductionEvent[],
): QualityBreakdown {
  const scriptScore = computeScriptScore(script);
  const directionScore = computeDirectionScore(talent, script);
  const actingScore = computeActingScore(talent, script);
  const productionScore = computeProductionScore(productionChoices, genre);
  const postProductionScore = computePostProductionScore(postProductionChoices);
  const eventsScore = computeEventsScore(events);

  const weights = computeQualityWeights(genre);
  const qualityScore =
    scriptScore * weights.script +
    directionScore * weights.direction +
    actingScore * weights.acting +
    postProductionScore * weights.postProduction +
    productionScore * weights.production +
    eventsScore * weights.randomEvents;

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
 * build: how famous the director/leads are, how reputable the studio
 * itself is, and how much is spent getting the word out. Money alone
 * (marketing) caps out well short of 100 - fame and reputation aren't for
 * sale, they're earned by who you cast and what you've already released -
 * so a wealthy but unknown studio with no-name talent still can't buy its
 * way to a phenomenon. Events/music/final-cut/script-marketability stay as
 * smaller flavor modifiers on top, same as before.
 */
export function computeBuzzScore(
  script: Script,
  talent: Talent[],
  events: ProductionEvent[],
  postProductionChoices: PostProductionChoices,
  marketingChoices: MarketingChoices,
  studioReputation: number,
): number {
  const director = getDirector(talent);
  const leads = getLeadActors(talent);
  const buzzworthyFame = [director?.fame, ...leads.map((l) => l.fame)].filter((f): f is number => f !== undefined);
  const fameAvg = average(buzzworthyFame) ?? 30;

  const fameBuzz = (fameAvg - 50) * 0.5;
  const reputationBuzz = (studioReputation - 50) * 0.4;
  const marketingBuzz = marketingBuzzContribution(marketingChoices.marketingSpend);

  const eventsBuzz = events.reduce((sum, e) => sum + e.buzzDelta, 0);
  const musicBuzz = MUSIC_FOCUS_PROFILES[postProductionChoices.musicFocus].buzzDelta;
  const finalCutBuzz = FINAL_CUT_FOCUS_PROFILES[postProductionChoices.finalCutFocus].buzzDelta;
  const scriptBuzz = (script.marketability - 50) * 0.2;

  return clamp(10 + fameBuzz + reputationBuzz + marketingBuzz + eventsBuzz + musicBuzz + finalCutBuzz + scriptBuzz, 0, 100);
}
