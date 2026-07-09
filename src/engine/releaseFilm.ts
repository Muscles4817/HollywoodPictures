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
import { pickReviewBlurbs, pickDepartmentBlurb } from './reviews';
import { generateStoryReport } from './storyReport';
import type { RandomFn } from './random';

export interface ReleaseComputationInput {
  title: string;
  genre: Genre;
  targetAudience: TargetAudience;
  script: Script;
  talent: Talent[];
  productionChoices: ProductionChoices;
  postProductionChoices: PostProductionChoices;
  marketingChoices: MarketingChoices;
  events: ProductionEvent[];
  // Contingency's actual daily-burn total from principal photography
  // (PhotographyState.runningCost) - not part of computeProductionBudgetCost
  // any more, since it's no longer a flat lump sum (see engine/cost.ts).
  photographyCost: number;
  // daysElapsed / recommendedDays from the finished shoot - feeds shooting
  // quality (engine/productionDials.ts:shootingQualityFromRatio) the way a
  // pre-set pace slider used to.
  shootingRatio: number;
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
    input.shootingRatio,
  );
  const criticScore = computeCriticScore(quality, input.script, input.postProductionChoices, input.marketingChoices);
  const audienceScore = computeAudienceScore(
    quality,
    input.script,
    input.talent,
    input.genre,
    input.productionChoices,
    input.postProductionChoices,
  );
  const buzzScore = computeBuzzScore(
    input.script,
    input.talent,
    input.events,
    input.postProductionChoices,
    input.marketingChoices,
    input.studioReputation,
  );

  const talentCost = computeTalentCost(input.talent);
  const productionBudgetCost = computeProductionBudgetCost(input.productionChoices);
  const eventsCostDelta = computeEventsCostDelta(input.events);
  const testScreeningCost = TEST_SCREENING_PROFILES[input.postProductionChoices.testScreeningResponse].cost;
  const productionCost = Math.max(
    0,
    input.script.cost + talentCost + productionBudgetCost + input.photographyCost + eventsCostDelta + testScreeningCost,
  );
  const marketingCost = computeMarketingCost(input.marketingChoices);
  const totalCost = productionCost + marketingCost;

  const { openingWeekend, totalBoxOffice, studioRevenue } = computeBoxOffice(
    {
      buzzScore,
      criticScore,
      audienceScore,
      targetAudience: input.targetAudience,
      genre: input.genre,
      releaseWindow: input.marketingChoices.releaseWindow,
      releaseType: input.marketingChoices.releaseType,
    },
    rng,
  );

  // Profit is computed from the studio's actual cut of the gross, not the
  // headline box office figure - see boxOffice.ts:STUDIO_BOX_OFFICE_SHARE.
  const profit = studioRevenue - totalCost;
  const outcome = determineOutcome(profit, totalCost, quality.qualityScore, criticScore, audienceScore);
  const reputationChange = computeReputationChange(outcome, criticScore);
  const departmentBlurb = pickDepartmentBlurb(quality, input.genre, rng);
  const reviewBlurbs = [...pickReviewBlurbs(criticScore, audienceScore, rng), ...(departmentBlurb ? [departmentBlurb] : [])];
  const storyReport = generateStoryReport({ title: input.title, buzzScore, criticScore, audienceScore }, rng);

  return {
    productionCost,
    marketingCost,
    totalCost,
    openingWeekend,
    totalBoxOffice,
    studioRevenue,
    profit,
    criticScore: Math.round(criticScore),
    audienceScore: Math.round(audienceScore),
    buzzScore: Math.round(buzzScore),
    qualityScore: Math.round(quality.qualityScore),
    scriptScore: Math.round(quality.scriptScore),
    directionScore: Math.round(quality.directionScore),
    actingScore: Math.round(quality.actingScore),
    productionScore: Math.round(quality.productionScore),
    postProductionScore: Math.round(quality.postProductionScore),
    eventsScore: Math.round(quality.eventsScore),
    reputationChange,
    reviewBlurbs,
    storyReport,
    outcome,
  };
}
