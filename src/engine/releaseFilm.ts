import type {
  FilmResults,
  Genre,
  MarketingChoices,
  PostProductionChoices,
  ProductionChoices,
  ProductionEvent,
  Script,
  TalentAssignment,
  TargetAudience,
} from '../types';
import { computeAudienceScore, computeBuzzScore, computeCriticScore, computeQualityBreakdown } from './scoring';
import { computeEventsCostDelta, computeMarketingCost, computeProductionBudgetCost, computeTalentCost } from './cost';
import { TEST_SCREENING_PROFILES } from '../data/postProduction';
import { deriveAudienceSimulationFixedState, type SupportedReleaseType } from './audienceSimulationInputs';
import { deriveCommercialProfile } from './commercialProfile';
import { advanceOneWeek } from './audienceSimulationStep';
import { AVERAGE_TICKET_PRICE } from './boxOfficeRun';
import { pickReviewBlurbs, pickDepartmentBlurb } from './reviews';
import { generateStoryReport } from './storyReport';
import type { RandomFn } from './random';
import type { AudienceSimulationFixedState } from './audienceSimulation';

function averageFame(talent: TalentAssignment[], role: TalentAssignment['role']): number {
  const matching = talent.filter((t) => t.role === role);
  if (matching.length === 0) return 0;
  return matching.reduce((sum, t) => sum + t.person.reputation.fame, 0) / matching.length;
}

export interface ReleaseComputationInput {
  title: string;
  genre: Genre;
  targetAudience: TargetAudience;
  script: Script;
  talent: TalentAssignment[];
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
  /** Studio.brand (Brand Recognition, engine/reputation.ts) - never Prestige, see computeBuzzScore/deriveAudienceSimulationFixedState's own doc comments for why. */
  studioBrand: number;
  /** engine/releaseCrowding.ts:computeCompetitiveCrowding's output, 0-1 - pre-resolved by the caller (engine/scheduledReleases.ts, engine/rivalStudios.ts), since this orchestration point never sees a raw releaseDay itself. Threaded straight into deriveAudienceSimulationFixedState - see ReleaseSimulationInputs.competitiveCrowding's own doc comment for why it dents initialAvailabilityFraction only. */
  competitiveCrowding: number;
}

export interface ReleaseComputationResult {
  results: FilmResults;
  // The film's release-day-fixed audience-simulation state, for seeding its
  // BoxOfficeRun (state/studioReducer.ts:RELEASE_FILM) - not part of
  // FilmResults since it's a run-mechanics input (probabilities, ceilings),
  // not a result the player reads directly (the weekly numbers it drives
  // are what they actually see).
  fixed: AudienceSimulationFixedState;
}

/**
 * The single orchestration point that turns a fully-assembled film draft
 * into its release-day-knowable results. Everything it calls is a pure
 * function, so this stays easy to unit test and easy to extend (e.g.
 * awards, franchises) later. Deliberately does NOT compute totalBoxOffice/
 * studioRevenue/profit/outcome/brandChange/prestigeChange - those depend on
 * the whole theatrical run, which hasn't happened yet at the moment a film releases
 * (see engine/boxOfficeRun.ts and docs/DESIGN.md 5.19); they come back null
 * here and get filled in once the run finishes.
 */
export function computeReleaseResults(input: ReleaseComputationInput, rng: RandomFn): ReleaseComputationResult {
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
    input.studioBrand,
  );

  const talentCost = computeTalentCost(input.talent);
  const productionBudgetCost = computeProductionBudgetCost(input.productionChoices);
  const eventsCostDelta = computeEventsCostDelta(input.events);
  const testScreeningCost = TEST_SCREENING_PROFILES[input.postProductionChoices.testScreeningResponse].cost;
  // input.script.cost is deliberately NOT part of this sum - it's charged
  // once, immediately, at Opportunity acquisition (ACQUIRE_OPPORTUNITY,
  // state/studioReducer.ts), long before a Project (let alone a release)
  // might ever exist for that script - see
  // docs/DESIGN_REVIEW_development_pipeline.md. Including it here again
  // would double-charge every film's production cost by its own script's
  // price.
  const productionCost = Math.max(
    0,
    talentCost + productionBudgetCost + input.photographyCost + eventsCostDelta + testScreeningCost,
  );
  const marketingCost = computeMarketingCost(input.marketingChoices);
  const totalCost = productionCost + marketingCost;

  // Release-day-fixed audience-simulation state (docs/DESIGN.md 5.34,
  // Milestones 1-3) - computed once, here, and carried forward by the
  // caller into Film.boxOfficeRun.fixed, never recomputed. Streaming was
  // removed as a release option (types/index.ts:ReleaseType) specifically
  // so marketingChoices.releaseType is always a SupportedReleaseType here,
  // no runtime check needed.
  const commercialProfile = deriveCommercialProfile(input.script);
  const fixed = deriveAudienceSimulationFixedState({
    buzzScore,
    marketingSpend: input.marketingChoices.marketingSpend,
    directorFame: averageFame(input.talent, 'Director'),
    leadFame: averageFame(input.talent, 'Lead Actor'),
    studioBrand: input.studioBrand,
    scriptAccessibility: commercialProfile.accessibility,
    scriptHookStrength: commercialProfile.hookStrength,
    scriptCrossoverPotential: commercialProfile.crossoverPotential,
    scriptSpectacle: input.script.toneProfile.spectacle,
    scriptIntendedAudience: input.script.intendedAudience,
    targetAudience: input.targetAudience,
    genre: input.genre,
    releaseWindow: input.marketingChoices.releaseWindow,
    releaseType: input.marketingChoices.releaseType as SupportedReleaseType,
    competitiveCrowding: input.competitiveCrowding,
    criticScore,
    audienceScore,
  });
  // Week 1 is deterministic (the new model has no randomness at all) and
  // release-day-knowable, so it's safe to compute here for
  // FilmResults.openingWeekend - engine/boxOfficeRun.ts's settlement pass
  // (called immediately after RELEASE_FILM constructs the film, same as it
  // always has been) independently arrives at the exact same week 1 the
  // moment it catches this film up, since it starts from the same `fixed`
  // and an empty history. Not a second algorithm, just the one pure step
  // function called twice - see advanceOneWeek's own determinism guarantee.
  const week1 = advanceOneWeek(fixed, []);
  const openingWeekend = Math.round(week1.cumulativeTicketsSold * AVERAGE_TICKET_PRICE);

  const departmentBlurb = pickDepartmentBlurb(quality, input.genre, rng);
  const reviewBlurbs = [...pickReviewBlurbs(criticScore, audienceScore, rng), ...(departmentBlurb ? [departmentBlurb] : [])];
  const storyReport = generateStoryReport({ title: input.title, buzzScore, criticScore, audienceScore }, rng);

  const results: FilmResults = {
    productionCost,
    marketingCost,
    totalCost,
    openingWeekend,
    totalBoxOffice: null,
    studioRevenue: null,
    profit: null,
    outcome: null,
    brandChange: null,
    prestigeChange: null,
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
    reviewBlurbs,
    storyReport,
  };

  return { results, fixed };
}
