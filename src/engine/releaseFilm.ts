import type {
  FilmResults,
  Genre,
  MarketingChoices,
  PostProductionChoices,
  ProductionChoices,
  ProductionEvent,
  Script,
  Talent,
  TargetAudience,
} from '../types';
import { computeAudienceScore, computeBuzzScore, computeCriticScore, computeQualityBreakdown } from './scoring';
import { computeEventsCostDelta, computeMarketingCost, computeProductionBudgetCost, computeTalentCost } from './cost';
import { TEST_SCREENING_PROFILES } from '../data/postProduction';
import { computeBoxOffice } from './boxOffice';
import { determineOutcome } from './outcome';
import { computeReputationChange } from './reputation';
import { pickReviewBlurbs } from './reviews';
import type { RandomFn } from './random';

export interface ReleaseComputationInput {
  genre: Genre;
  targetAudience: TargetAudience;
  script: Script;
  talent: Talent[];
  productionChoices: ProductionChoices;
  postProductionChoices: PostProductionChoices;
  marketingChoices: MarketingChoices;
  events: ProductionEvent[];
  studioReputation: number;
}

/**
 * The single orchestration point that turns a fully-assembled film draft into
 * final release results. Everything it calls is a pure function, so this stays
 * easy to unit test and easy to extend (e.g. awards, franchises) later.
 */
export function computeReleaseResults(input: ReleaseComputationInput, rng: RandomFn): FilmResults {
  const quality = computeQualityBreakdown(
    input.script,
    input.talent,
    input.genre,
    input.productionChoices,
    input.postProductionChoices,
    input.events,
  );
  const criticScore = computeCriticScore(quality, input.script, input.postProductionChoices);
  const audienceScore = computeAudienceScore(
    quality,
    input.script,
    input.talent,
    input.genre,
    input.productionChoices,
    input.postProductionChoices,
    input.marketingChoices,
  );
  const buzzScore = computeBuzzScore(input.script, input.events, input.postProductionChoices, input.marketingChoices);

  const talentCost = computeTalentCost(input.talent);
  const productionBudgetCost = computeProductionBudgetCost(input.productionChoices);
  const eventsCostDelta = computeEventsCostDelta(input.events);
  const testScreeningCost = TEST_SCREENING_PROFILES[input.postProductionChoices.testScreeningResponse].cost;
  const productionCost = Math.max(
    0,
    input.script.cost + talentCost + productionBudgetCost + eventsCostDelta + testScreeningCost,
  );
  const marketingCost = computeMarketingCost(input.marketingChoices);
  const totalCost = productionCost + marketingCost;

  const { openingWeekend, totalBoxOffice } = computeBoxOffice(
    {
      audienceScore,
      criticScore,
      targetAudience: input.targetAudience,
      genre: input.genre,
      releaseWindow: input.marketingChoices.releaseWindow,
      releaseType: input.marketingChoices.releaseType,
      marketingSpend: input.marketingChoices.marketingSpend,
      studioReputation: input.studioReputation,
      budgetLevel: input.productionChoices.budgetLevel,
    },
    rng,
  );

  const profit = totalBoxOffice - totalCost;
  const outcome = determineOutcome(profit, totalCost, quality.qualityScore, criticScore, audienceScore);
  const reputationChange = computeReputationChange(outcome, criticScore);
  const reviewBlurbs = pickReviewBlurbs(criticScore, audienceScore, rng);

  return {
    productionCost,
    marketingCost,
    totalCost,
    openingWeekend,
    totalBoxOffice,
    profit,
    criticScore: Math.round(criticScore),
    audienceScore: Math.round(audienceScore),
    buzzScore: Math.round(buzzScore),
    qualityScore: Math.round(quality.qualityScore),
    reputationChange,
    reviewBlurbs,
    outcome,
  };
}
