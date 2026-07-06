import type { Genre, MarketingChoices, ProductionChoices, ReleaseType, TargetAudience } from '../types';
import { GENRE_PROFILES } from '../data/genres';
import { AUDIENCE_PROFILES } from '../data/audiences';
import { MARKETING_SPEND_PROFILES, RELEASE_TYPE_PROFILES, RELEASE_WINDOW_BASE_MULTIPLIER, RELEASE_WINDOW_GENRE_BONUS } from '../data/release';
import { randFloat, type RandomFn } from './random';

// Total addressable box office if every dial were maxed out. Tuned so a
// mid-budget, well-reviewed film nets a healthy profit while a poorly
// reviewed film - especially an expensive one - loses real money.
const BASE_MARKET_POTENTIAL = 60_000_000;

// How much of total lifetime box office lands in the first weekend, by release type.
const OPENING_WEEKEND_FRACTION: Record<ReleaseType, number> = {
  Wide: 0.35,
  Limited: 0.15,
  Streaming: 0.25,
  'Festival First': 0.12,
};

// Coarse box-office scale factor per budget level - bigger budgets buy wider
// prints/distribution independent of quality.
const BUDGET_SCALE_FACTOR: Record<ProductionChoices['budgetLevel'], number> = {
  Cheap: 0.55,
  Standard: 0.85,
  Premium: 1.05,
  Excessive: 1.25,
};

export interface BoxOfficeInput {
  audienceScore: number; // 0-100
  criticScore: number; // 0-100
  targetAudience: TargetAudience;
  genre: Genre;
  releaseWindow: MarketingChoices['releaseWindow'];
  releaseType: ReleaseType;
  marketingSpend: MarketingChoices['marketingSpend'];
  studioReputation: number; // 0-100
  budgetLevel: ProductionChoices['budgetLevel'];
}

export interface BoxOfficeResult {
  openingWeekend: number;
  totalBoxOffice: number;
}

/**
 * Box office is a chain of multipliers on a base market potential: how big an
 * audience this genre/target/window/release-type combo can reach, scaled by
 * how good the film actually is (audience/critic score) and how reputable
 * the studio is, then finished off with random variance.
 */
export function computeBoxOffice(input: BoxOfficeInput, rng: RandomFn): BoxOfficeResult {
  const audienceProfile = AUDIENCE_PROFILES[input.targetAudience];
  const genreProfile = GENRE_PROFILES[input.genre];
  const windowGenreBonus = RELEASE_WINDOW_GENRE_BONUS[input.releaseWindow][input.genre] ?? 1;
  const windowBase = RELEASE_WINDOW_BASE_MULTIPLIER[input.releaseWindow];
  const releaseTypeProfile = RELEASE_TYPE_PROFILES[input.releaseType];
  const marketingProfile = MARKETING_SPEND_PROFILES[input.marketingSpend];
  const budgetScale = BUDGET_SCALE_FACTOR[input.budgetLevel];

  const reputationFactor = 0.7 + (input.studioReputation / 100) * 0.6; // 0.7 - 1.3
  // Low floors here are what make a genuinely bad film actually flop instead
  // of merely underperforming - quality has to matter more than reach.
  const audienceConversion = 0.1 + (input.audienceScore / 100) * 1.3; // 0.1 - 1.4
  const criticLegsFactor = 0.75 + (input.criticScore / 100) * 0.4; // 0.75 - 1.15

  let raw =
    BASE_MARKET_POTENTIAL *
    audienceProfile.marketSize *
    (genreProfile.popularity / 100) *
    windowBase *
    windowGenreBonus *
    releaseTypeProfile.reachMultiplier *
    marketingProfile.boxOfficeMultiplier *
    reputationFactor *
    budgetScale *
    audienceConversion *
    criticLegsFactor;

  // A wide release without real marketing behind it badly underperforms.
  if (releaseTypeProfile.needsMarketing && (input.marketingSpend === 'None' || input.marketingSpend === 'Low')) {
    raw *= 0.55;
  }

  const varianceBand = 0.2 * releaseTypeProfile.varianceMultiplier;
  const variance = randFloat(rng, 1 - varianceBand, 1 + varianceBand);

  const totalBoxOffice = Math.max(0, Math.round((raw * variance) / 1000) * 1000);
  const openingWeekend = Math.round(totalBoxOffice * OPENING_WEEKEND_FRACTION[input.releaseType]);

  return { openingWeekend, totalBoxOffice };
}
