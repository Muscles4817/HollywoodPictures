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
import {
  BUDGET_LEVEL_PROFILES,
  PRACTICAL_EFFECTS_PROFILES,
  RUNTIME_TARGET_PROFILES,
  SET_QUALITY_PROFILES,
  SHOOTING_STYLE_PROFILES,
  VFX_SPEND_PROFILES,
} from '../data/production';
import { EDIT_STYLE_PROFILES, FINAL_CUT_FOCUS_PROFILES, MUSIC_FOCUS_PROFILES, TEST_SCREENING_PROFILES } from '../data/postProduction';
import { MARKETING_SPEND_PROFILES, RELEASE_TYPE_PROFILES } from '../data/release';
import { AUDIENCE_WEIGHTS, CRITIC_WEIGHTS, QUALITY_WEIGHTS } from '../data/scoringWeights';
import { clamp } from './random';

function getTalent(talent: Talent[], role: Talent['role']): Talent | undefined {
  return talent.find((t) => t.role === role);
}

function genreAffinity(t: Talent | undefined, genre: Genre): number {
  if (!t) return 50; // no one hired for this role -> neutral default
  return t.genreAffinities[genre] ?? 50;
}

/** Script quality independent of genre fit (originality/structure/dialogue/marketability). */
export function computeScriptScore(script: Script): number {
  return script.originality * 0.3 + script.structure * 0.3 + script.dialogue * 0.25 + script.marketability * 0.15;
}

/** Director's contribution: raw skill plus how well they suit this genre. */
export function computeDirectionScore(talent: Talent[], genre: Genre): number {
  const director = getTalent(talent, 'Director');
  if (!director) return 35; // no director hired is a serious quality hit
  return director.skill * 0.6 + genreAffinity(director, genre) * 0.4;
}

/** Combined lead + supporting acting quality, weighted toward the lead. */
export function computeActingScore(talent: Talent[], genre: Genre): number {
  const lead = getTalent(talent, 'Lead Actor');
  const support = getTalent(talent, 'Supporting Actor');
  const leadScore = lead ? lead.skill * 0.65 + genreAffinity(lead, genre) * 0.35 : 30;
  const supportScore = support ? support.skill * 0.65 + genreAffinity(support, genre) * 0.35 : 30;
  return leadScore * 0.7 + supportScore * 0.3;
}

/**
 * Quality contributed by production choices. VFX/practical-effects weight is
 * scaled per genre - Action/Sci-Fi/Fantasy lean on VFX, Drama/Romance don't.
 */
export function computeProductionScore(choices: ProductionChoices, genre: Genre): number {
  const profile = GENRE_PROFILES[genre];
  const budget = BUDGET_LEVEL_PROFILES[choices.budgetLevel].qualityScore;
  const style = SHOOTING_STYLE_PROFILES[choices.shootingStyle].qualityScore;
  const set = SET_QUALITY_PROFILES[choices.setQuality].qualityScore;
  const practical = PRACTICAL_EFFECTS_PROFILES[choices.practicalEffects].qualityScore;
  const vfx = VFX_SPEND_PROFILES[choices.vfxSpend].qualityScore;

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
  const talentFit = (genreAffinity(director, genre) + genreAffinity(lead, genre)) / 2;

  // A cheap budget only suits genres tagged as low-budget-friendly (e.g. Horror).
  const budgetFit = choices.budgetLevel === 'Cheap' ? 30 + profile.lowBudgetFriendly * 60 : 85;

  return script.genreFit * 0.4 + talentFit * 0.35 + budgetFit * 0.25;
}

/** How sellable the film looks, independent of how it eventually gets marketed. */
export function computeMarketabilityScore(script: Script, talent: Talent[], choices: ProductionChoices): number {
  const lead = getTalent(talent, 'Lead Actor');
  const support = getTalent(talent, 'Supporting Actor');
  const fameAvg = ((lead?.fame ?? 30) + (support?.fame ?? 30)) / 2;
  const runtimeDelta = RUNTIME_TARGET_PROFILES[choices.runtimeTarget].marketabilityDelta;
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
  const directionScore = computeDirectionScore(talent, genre);
  const actingScore = computeActingScore(talent, genre);
  const productionScore = computeProductionScore(productionChoices, genre);
  const postProductionScore = computePostProductionScore(postProductionChoices);
  const eventsScore = computeEventsScore(events);

  const qualityScore =
    scriptScore * QUALITY_WEIGHTS.script +
    directionScore * QUALITY_WEIGHTS.direction +
    actingScore * QUALITY_WEIGHTS.acting +
    postProductionScore * QUALITY_WEIGHTS.postProduction +
    productionScore * QUALITY_WEIGHTS.production +
    eventsScore * QUALITY_WEIGHTS.randomEvents;

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
