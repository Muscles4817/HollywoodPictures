import type { Genre, ReleaseWindow, ReleaseType, MarketingSpend } from '../types';

// Multiplier applied to box office when a genre matches the seasonal window.
// Missing entries default to 1.0 (no bonus/penalty) in the engine.
export const RELEASE_WINDOW_GENRE_BONUS: Record<ReleaseWindow, Partial<Record<Genre, number>>> = {
  'Quiet Month': {},
  Summer: { Action: 1.3, 'Sci-Fi': 1.3, Fantasy: 1.2 },
  'Awards Season': { Drama: 1.35, Thriller: 1.1 },
  Halloween: { Horror: 1.45 },
  Christmas: { Fantasy: 1.25, Romance: 1.2, Comedy: 1.1 },
};

// Baseline box office multiplier for the window itself (holiday crowds etc.),
// independent of genre fit.
export const RELEASE_WINDOW_BASE_MULTIPLIER: Record<ReleaseWindow, number> = {
  'Quiet Month': 0.85,
  Summer: 1.15,
  'Awards Season': 1.0,
  Halloween: 1.05,
  Christmas: 1.2,
};

export interface ReleaseTypeProfile {
  reachMultiplier: number; // scales addressable box office pool
  costMultiplier: number; // scales distribution/marketing overhead
  criticBonus: number; // flat critic score bonus/penalty
  needsMarketing: boolean; // wide release punished hard by weak marketing
  varianceMultiplier: number; // safer (streaming) vs riskier releases
}

export const RELEASE_TYPE_PROFILES: Record<ReleaseType, ReleaseTypeProfile> = {
  Limited: { reachMultiplier: 0.45, costMultiplier: 0.5, criticBonus: 2, needsMarketing: false, varianceMultiplier: 0.8 },
  Wide: { reachMultiplier: 1.3, costMultiplier: 1.2, criticBonus: 0, needsMarketing: true, varianceMultiplier: 1.15 },
  Streaming: { reachMultiplier: 0.7, costMultiplier: 0.6, criticBonus: 0, needsMarketing: false, varianceMultiplier: 0.5 },
  'Festival First': { reachMultiplier: 0.6, costMultiplier: 0.7, criticBonus: 6, needsMarketing: false, varianceMultiplier: 0.7 },
};

export interface MarketingSpendProfile {
  cost: number; // flat cost in currency
  buzzBonus: number; // 0-100 scale contribution to buzz
  boxOfficeMultiplier: number; // multiplier applied when reach is calculated
}

// Cost scales with a film's production budget elsewhere; these are the
// baseline spend tiers players choose from.
export const MARKETING_SPEND_PROFILES: Record<MarketingSpend, MarketingSpendProfile> = {
  None: { cost: 0, buzzBonus: 0, boxOfficeMultiplier: 0.55 },
  Low: { cost: 500_000, buzzBonus: 10, boxOfficeMultiplier: 0.75 },
  Medium: { cost: 1_500_000, buzzBonus: 22, boxOfficeMultiplier: 1.0 },
  High: { cost: 3_500_000, buzzBonus: 35, boxOfficeMultiplier: 1.25 },
  Huge: { cost: 7_000_000, buzzBonus: 48, boxOfficeMultiplier: 1.5 },
};
