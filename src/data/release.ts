import type { Genre, ReleaseWindow, ReleaseType } from '../types';
import type { Range, ScaleAnchor } from '../engine/interpolate';

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
  costMultiplier: number; // scales distribution/marketing overhead
  criticBonus: number; // flat critic score bonus/penalty
  // Whether this release type's box office lives or dies on marketing -
  // informational only (drives a UI warning); the actual mechanical effect
  // of weak marketing happens naturally through Buzz -> Opening Weekend,
  // there's no separate hand-coded penalty here anymore.
  needsMarketing: boolean;
  description: string;
}

// reachMultiplier/varianceMultiplier/baseLegsMultiplier used to live here -
// inputs to the old fixed Opening Weekend/Legs formula
// (engine/boxOffice.ts), retired in docs/DESIGN.md 5.34 Milestone 5. The
// audience simulation that replaced it reinterprets "release type" as
// engine/audienceSimulationInputs.ts:RELEASE_TYPE_AUDIENCE_PROFILES
// (initial awareness share + conversion pacing) instead - a different shape
// entirely, not a 1:1 renaming of these fields, so it lives in its own
// table rather than growing this one back out.
export const RELEASE_TYPE_PROFILES: Record<ReleaseType, ReleaseTypeProfile> = {
  Limited: {
    costMultiplier: 0.5, criticBonus: 2, needsMarketing: false,
    description: 'A small number of theaters. Cheaper to support and lower risk, but caps how big the opening can get - everything rides on legs.',
  },
  Wide: {
    costMultiplier: 1.2, criticBonus: 0, needsMarketing: true,
    description: 'Everywhere at once - the biggest opening and the biggest variance. Needs real marketing spend behind it or it badly underperforms.',
  },
  'Festival First': {
    costMultiplier: 0.7, criticBonus: 6, needsMarketing: false,
    description: 'Premiere on the festival circuit before wider release. A direct critic score boost and the longest potential legs - the strongest option for a prestige/awards play.',
  },
};

// A continuous currency amount, not a fixed tier - what a given level of
// exposure costs doesn't scale with how expensive the film itself was (see
// types/index.ts:MarketingChoices). Spans the real range: a token indie
// push up to a genuine global blockbuster blitz, which only a studio
// that's already accumulated real wealth could ever afford - the top of
// the range gatekeeps itself by cost, no artificial rule needed.
export const MARKETING_SPEND_RANGE: Range = { min: 10_000, max: 150_000_000 };

export const MARKETING_SPEND_ANCHORS: ScaleAnchor<'buzzContribution'>[] = [
  { t: 0, values: { buzzContribution: 0 }, description: 'Essentially no marketing - whatever word of mouth happens on its own.' },
  { t: 0.25, values: { buzzContribution: 15 }, description: 'A modest local campaign - some posters, some social media.' },
  { t: 0.5, values: { buzzContribution: 32 }, description: 'A real regional campaign - trailers, press, a genuine media buy.' },
  { t: 0.75, values: { buzzContribution: 52 }, description: 'A national blitz - the kind of campaign a major theatrical release actually needs.' },
  { t: 1, values: { buzzContribution: 75 }, description: 'A global blockbuster campaign - the biggest possible push, at a cost only a genuinely wealthy studio can absorb.' },
];
