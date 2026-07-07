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

export const RELEASE_WINDOW_DESCRIPTIONS: Record<ReleaseWindow, string> = {
  'Quiet Month': 'No seasonal crowd and no genre bonus, but no competition for attention either. A safe, unremarkable baseline.',
  Summer: 'Big holiday crowds. A strong bonus for Action, Sci-Fi and Fantasy specifically.',
  'Awards Season': 'A prestige-minded audience out looking for serious films. A strong bonus for Drama, and a smaller one for Thriller.',
  Halloween: 'The single strongest genre-specific bonus in the game - but only if the film is Horror.',
  Christmas: 'The biggest baseline holiday crowd. A bonus for Fantasy, Romance and Comedy specifically.',
};

export interface ReleaseTypeProfile {
  reachMultiplier: number; // scales addressable box office pool
  costMultiplier: number; // scales distribution/marketing overhead
  criticBonus: number; // flat critic score bonus/penalty
  needsMarketing: boolean; // wide release punished hard by weak marketing
  varianceMultiplier: number; // safer (streaming) vs riskier releases
  description: string;
}

export const RELEASE_TYPE_PROFILES: Record<ReleaseType, ReleaseTypeProfile> = {
  Limited: {
    reachMultiplier: 0.45, costMultiplier: 0.5, criticBonus: 2, needsMarketing: false, varianceMultiplier: 0.8,
    description: 'A small number of theaters. Cheaper to support and lower risk, but caps how big the box office can get.',
  },
  Wide: {
    reachMultiplier: 1.3, costMultiplier: 1.2, criticBonus: 0, needsMarketing: true, varianceMultiplier: 1.15,
    description: 'Everywhere at once - the biggest reach and the biggest variance. Needs real marketing spend behind it or it badly underperforms.',
  },
  Streaming: {
    reachMultiplier: 0.7, costMultiplier: 0.6, criticBonus: 0, needsMarketing: false, varianceMultiplier: 0.5,
    description: 'Lower box office ceiling, but the safest, most predictable option - the smallest swing between a good and bad outcome.',
  },
  'Festival First': {
    reachMultiplier: 0.6, costMultiplier: 0.7, criticBonus: 6, needsMarketing: false, varianceMultiplier: 0.7,
    description: 'Premiere on the festival circuit before wider release. A direct critic score boost - the strongest option for a prestige/awards play.',
  },
};

export interface MarketingSpendProfile {
  cost: number; // flat cost in currency
  buzzBonus: number; // 0-100 scale contribution to buzz
  boxOfficeMultiplier: number; // multiplier applied when reach is calculated
  description: string;
}

// Cost scales with a film's production budget elsewhere; these are the
// baseline spend tiers players choose from.
export const MARKETING_SPEND_PROFILES: Record<MarketingSpend, MarketingSpendProfile> = {
  None: { cost: 0, buzzBonus: 0, boxOfficeMultiplier: 0.55, description: 'No marketing spend at all. Free, but box office reach is badly hurt - and a Wide release needs this to succeed.' },
  Low: { cost: 500_000, buzzBonus: 10, boxOfficeMultiplier: 0.75, description: 'A minimal campaign. Cheap, but still well below what a Wide release needs to perform.' },
  Medium: { cost: 1_500_000, buzzBonus: 22, boxOfficeMultiplier: 1.0, description: 'A standard, solid campaign - the baseline reach multiplier.' },
  High: { cost: 3_500_000, buzzBonus: 35, boxOfficeMultiplier: 1.25, description: 'A big push. Meaningfully boosts reach and buzz for a serious cost.' },
  Huge: { cost: 7_000_000, buzzBonus: 48, boxOfficeMultiplier: 1.5, description: 'An all-out campaign. The biggest reach and buzz boost available, at the biggest cost.' },
};
