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

/**
 * The minimum campaign a release type structurally requires, whatever the
 * studio would rather spend.
 *
 * Only Wide has one, and the reason is that its floor is not a strategic
 * choice - docs/domain/09-marketing-and-distribution.md section 1.3, "What sets
 * the floor and the ceiling": to open wide you must buy enough national reach
 * to get the target audience to ~85-90% awareness, produce a full asset package
 * (teaser, trailer, 8-20 TV spots, dozens of digital cutdowns, 20-60 art
 * variants), and support an exhibitor circuit that gives you 3,500 locations
 * and "quietly notices when it isn't" advertised. None of that scales down with
 * how cheap the film was.
 *
 * The real bands that section gives, US-domestic: platform/specialty $2-15M,
 * wide independent $15-30M, studio mid-budget wide $30-60M, tentpole
 * $100-200M+ global. Measured against them the game's rival slate was low
 * everywhere and, worse, scaled the wrong way - P&A ran at 0.10x the negative
 * cost for a sub-$25M wide release, 0.44x for a mid-budget one and 0.65x for a
 * tentpole, when the real ratio is roughly flat (the domain doc's own
 * greenlight rule of thumb is 0.8x negative cost domestic, and a tentpole's
 * global marketing "often approximates the negative cost"). 47% of the game's
 * Wide releases were marketed for under $5M and a quarter for under $1M, which
 * is not a wide release at all.
 *
 * Set at the BOTTOM of the wide-independent band rather than the middle of the
 * studio one, deliberately: this figure is a single worldwide number in a model
 * with no domestic/international P&A split, and it is a hard floor applied to
 * every Wide release including the cheapest, so it should be the least any wide
 * release could conceivably open on and not the average.
 *
 * Limited and Festival First have no floor. A platform release genuinely can
 * start on very little and buy its campaign out of its own early returns, which
 * is the whole point of platforming - and it is what a film too cheap to fund a
 * wide campaign should be doing instead.
 */
export const MINIMUM_CAMPAIGN_SPEND: Record<ReleaseType, number> = {
  Wide: 18_000_000,
  Limited: 0,
  'Festival First': 0,
};

/** What this release will actually cost to market - the studio's chosen spend, or the release type's structural floor if that is higher. See MINIMUM_CAMPAIGN_SPEND. */
export function campaignSpendFor(releaseType: ReleaseType, marketingSpend: number): number {
  return Math.max(marketingSpend, MINIMUM_CAMPAIGN_SPEND[releaseType]);
}

export const MARKETING_SPEND_ANCHORS: ScaleAnchor<'buzzContribution'>[] = [
  { t: 0, values: { buzzContribution: 0 }, description: 'Essentially no marketing - whatever word of mouth happens on its own.' },
  { t: 0.25, values: { buzzContribution: 15 }, description: 'A modest local campaign - some posters, some social media.' },
  { t: 0.5, values: { buzzContribution: 32 }, description: 'A real regional campaign - trailers, press, a genuine media buy.' },
  { t: 0.75, values: { buzzContribution: 52 }, description: 'A national blitz - the kind of campaign a major theatrical release actually needs.' },
  { t: 1, values: { buzzContribution: 75 }, description: 'A global blockbuster campaign - the biggest possible push, at a cost only a genuinely wealthy studio can absorb.' },
];
