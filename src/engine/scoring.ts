import type {
  Genre,
  MarketingChoices,
  PostProductionChoices,
  ProductionChoices,
  ProductionEvent,
  Script,
  Talent,
} from '../types';
import { GENRE_PROFILES } from '../data/genres';
import { computeCompatibility } from './compatibility';
import {
  budgetT,
  budgetQuality,
  shootingQuality,
  setQualityScore,
  practicalEffectsScore,
  vfxScore,
  runtimeMarketabilityDelta,
} from './productionDials';
import { EDIT_STYLE_PROFILES, FINAL_CUT_FOCUS_PROFILES, MUSIC_FOCUS_PROFILES, TEST_SCREENING_PROFILES } from '../data/postProduction';
import { MARKETING_SPEND_PROFILES, RELEASE_TYPE_PROFILES } from '../data/release';
import { AUDIENCE_WEIGHTS, CRITIC_WEIGHTS } from '../data/scoringWeights';
import { computeQualityWeights } from './genreWeights';
import { clamp } from './random';

function getTalent(talent: Talent[], role: Talent['role']): Talent | undefined {
  return talent.find((t) => t.role === role);
}

/** For roles that can hold more than one person (Supporting Actor). */
function getTalentsForRole(talent: Talent[], role: Talent['role']): Talent[] {
  return talent.filter((t) => t.role === role);
}

/** How well a hired talent suits this specific script's tone, not just its genre label. */
function compatibility(t: Talent | undefined, script: Script): number {
  if (!t) return 50; // no one hired for this role -> neutral default
  return computeCompatibility(script.toneProfile, t.toneProfile);
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
  const director = getTalent(talent, 'Director');
  if (!director) return 35; // no director hired is a serious quality hit
  return director.skill * 0.6 + compatibility(director, script) * 0.4;
}

/**
 * Combined lead + supporting acting quality, weighted toward the lead.
 * Supporting Actor can hold an ensemble (see data/talentGeneration.ts
 * ROLE_CAPACITY) - a bigger cast doesn't automatically raise this score,
 * it's the *average* skill/fit of everyone hired, same as one person would.
 */
export function computeActingScore(talent: Talent[], script: Script): number {
  const lead = getTalent(talent, 'Lead Actor');
  const supports = getTalentsForRole(talent, 'Supporting Actor');

  const leadScore = lead ? lead.skill * 0.65 + compatibility(lead, script) * 0.35 : 30;
  const supportScoreAvg = average(supports.map((s) => s.skill * 0.65 + compatibility(s, script) * 0.35));

  return leadScore * 0.7 + (supportScoreAvg ?? 30) * 0.3;
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
  const director = getTalent(talent, 'Director');
  const lead = getTalent(talent, 'Lead Actor');
  const talentFit = (compatibility(director, script) + compatibility(lead, script)) / 2;

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
  const lead = getTalent(talent, 'Lead Actor');
  const supports = getTalentsForRole(talent, 'Supporting Actor');
  const supportFameAvg = average(supports.map((s) => s.fame)) ?? 30;
  const fameAvg = ((lead?.fame ?? 30) + supportFameAvg) / 2;
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

/** Audience Score: entertainment-driven - genre fit, star power, marketing reach. */
export function computeAudienceScore(
  quality: QualityBreakdown,
  script: Script,
  talent: Talent[],
  genre: Genre,
  productionChoices: ProductionChoices,
  postProductionChoices: PostProductionChoices,
  marketingChoices: MarketingChoices,
): number {
  const genreFitScore = computeGenreFitScore(script, talent, genre, productionChoices);
  const lead = getTalent(talent, 'Lead Actor');
  const actorFameScore = lead?.fame ?? 30;

  const entertainmentScore = clamp(
    55 +
      EDIT_STYLE_PROFILES[postProductionChoices.editStyle].audienceDelta * 3 +
      FINAL_CUT_FOCUS_PROFILES[postProductionChoices.finalCutFocus].audienceDelta * 3 +
      (quality.qualityScore - 50) * 0.3,
    0,
    100,
  );

  const marketingScoreMap: Record<MarketingChoices['marketingSpend'], number> = {
    None: 15,
    Low: 40,
    Medium: 60,
    High: 80,
    Huge: 95,
  };
  const marketingScore = marketingScoreMap[marketingChoices.marketingSpend];

  const score =
    genreFitScore * AUDIENCE_WEIGHTS.genreFit +
    actorFameScore * AUDIENCE_WEIGHTS.actorFame +
    entertainmentScore * AUDIENCE_WEIGHTS.entertainment +
    marketingScore * AUDIENCE_WEIGHTS.marketing +
    quality.productionScore * AUDIENCE_WEIGHTS.production;

  return clamp(score, 0, 100);
}

/** Buzz Score: word-of-mouth momentum from events, post-production and marketing. */
export function computeBuzzScore(
  script: Script,
  events: ProductionEvent[],
  postProductionChoices: PostProductionChoices,
  marketingChoices: MarketingChoices,
): number {
  const eventsBuzz = events.reduce((sum, e) => sum + e.buzzDelta, 0);
  const musicBuzz = MUSIC_FOCUS_PROFILES[postProductionChoices.musicFocus].buzzDelta;
  const finalCutBuzz = FINAL_CUT_FOCUS_PROFILES[postProductionChoices.finalCutFocus].buzzDelta;
  const marketingBuzz = MARKETING_SPEND_PROFILES[marketingChoices.marketingSpend].buzzBonus;
  const scriptBuzz = (script.marketability - 50) * 0.2;

  return clamp(40 + eventsBuzz + musicBuzz + finalCutBuzz + marketingBuzz + scriptBuzz, 0, 100);
}
