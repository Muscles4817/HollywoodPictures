import type { Genre, ReleaseType, ReleaseWindow, TargetAudience } from '../types';
import { GENRE_PROFILES } from '../data/genres';
import { AUDIENCE_PROFILES } from '../data/audiences';
import { RELEASE_TYPE_PROFILES, RELEASE_WINDOW_BASE_MULTIPLIER, RELEASE_WINDOW_GENRE_BONUS } from '../data/release';
import { clamp, randFloat, type RandomFn } from './random';

/**
 * Box office in two stages, not one lump sum:
 *
 *   Opening Weekend = reach x hype (Buzz Score - fame, reputation, marketing)
 *   Total Box Office = Opening Weekend x legs (reviews - audience weighted over critic)
 *
 * That split is deliberate: hype gets people into the seats on day one,
 * whether or not the film is any good; whether it keeps selling tickets for
 * weeks afterward is entirely down to whether audiences (and to a lesser
 * extent critics) actually liked what they saw. A heavily-marketed, starry,
 * badly-reviewed film can still open big and then die; a small film with
 * little hype behind it but great word of mouth can have a modest opening
 * and a long, profitable run.
 *
 * Total lifetime gross isn't computed directly here at all any more - see
 * engine/boxOfficeRun.ts. Legs still comes from this file (it's a release-
 * day-knowable constant, fixed by reviews and release type - see
 * computeLegs below) but is spent gradually, week by week, as
 * Studio.totalDays actually advances, instead of being multiplied out into
 * a single number the moment the player clicks Release (docs/DESIGN.md 5.19).
 *
 * Production budget deliberately has NO direct multiplier here, even
 * though an earlier version of this formula gave it one ("bigger budgets
 * buy wider prints"). Audiences can't see how nice your sets or effects
 * look before they've bought a ticket, so it isn't something that should
 * draw an opening-weekend crowd - it's something that affects whether
 * they enjoyed what they saw once they did. Budget already has a real,
 * better-motivated path to box office: it feeds Production Score, which
 * feeds Quality, which feeds Critic/Audience Score, which feeds legs
 * (below). Giving it a second, independent lever on Opening Weekend on
 * top of that was redundant, and diluted Buzz's effect on the one number
 * it should dominate.
 */

// Total addressable OPENING WEEKEND potential with every reach factor
// maxed out - hype, genre popularity, market size, release reach. Total
// lifetime gross isn't set directly at all; it's always derived from this
// via the legs multiplier below. Tuned (see the balance scenarios in
// docs/DESIGN.md) so a mid-budget, well-buzzed, well-reviewed film nets a
// real but not absurd profit once the studio revenue share is applied, and
// a mediocre film genuinely risks a loss.
const OPENING_BASE_POTENTIAL = 24_000_000;

// How much pre-release hype (Buzz Score) turns into opening-weekend
// turnout. Buzz is already hard to max on its own (needs fame, reputation
// AND marketing all high at once - see engine/scoring.ts:computeBuzzScore),
// so this doesn't need to be a second steep gate on top of that.
const HYPE_FLOOR = 0.15;
const HYPE_CEILING = 1.5;
function hypeFactor(buzzScore: number): number {
  return HYPE_FLOOR + (buzzScore / 100) * (HYPE_CEILING - HYPE_FLOOR);
}

// How reviews stretch (or collapse) an opening weekend into a full
// theatrical run. Audience score matters more than critic score - a film
// casual audiences dislike empties out fast regardless of what critics
// said, while one they love keeps selling tickets for weeks. This is the
// single biggest swing factor in the whole formula, the same way it is in
// real box office.
const LEGS_FLOOR = 0.25;
const LEGS_CEILING = 1.85;
const AUDIENCE_LEGS_WEIGHT = 0.65;
const CRITIC_LEGS_WEIGHT = 0.35;
function reviewLegsFactor(criticScore: number, audienceScore: number): number {
  const reviewWeighted = audienceScore * AUDIENCE_LEGS_WEIGHT + criticScore * CRITIC_LEGS_WEIGHT;
  return LEGS_FLOOR + (reviewWeighted / 100) * (LEGS_CEILING - LEGS_FLOOR);
}

// The studio's actual cut of box office gross once theatrical rental fees
// and the international split are accounted for - real-world studio
// rentals average roughly 40% of worldwide gross. totalBoxOffice stays the
// big headline number (matching how box office is always reported); the
// smaller studioRevenue figure is what profit is actually computed from -
// see engine/boxOfficeRun.ts.
export const STUDIO_BOX_OFFICE_SHARE = 0.42;

export interface OpeningWeekendInput {
  buzzScore: number; // 0-100, drives the opening
  targetAudience: TargetAudience;
  genre: Genre;
  releaseWindow: ReleaseWindow;
  releaseType: ReleaseType;
}

export function computeOpeningWeekend(input: OpeningWeekendInput, rng: RandomFn): number {
  const audienceProfile = AUDIENCE_PROFILES[input.targetAudience];
  const genreProfile = GENRE_PROFILES[input.genre];
  const windowGenreBonus = RELEASE_WINDOW_GENRE_BONUS[input.releaseWindow][input.genre] ?? 1;
  const windowBase = RELEASE_WINDOW_BASE_MULTIPLIER[input.releaseWindow];
  const releaseTypeProfile = RELEASE_TYPE_PROFILES[input.releaseType];

  const varianceBand = 0.2 * releaseTypeProfile.varianceMultiplier;
  const variance = randFloat(rng, 1 - varianceBand, 1 + varianceBand);

  const rawOpening =
    OPENING_BASE_POTENTIAL *
    audienceProfile.marketSize *
    (genreProfile.popularity / 100) *
    windowBase *
    windowGenreBonus *
    releaseTypeProfile.reachMultiplier *
    hypeFactor(input.buzzScore) *
    variance;

  return Math.max(0, Math.round(rawOpening / 1000) * 1000);
}

/**
 * How many multiples of the opening weekend this film's whole run is worth,
 * fixed the moment it's released (reviews don't change afterward) - spent
 * out gradually week by week via computeWeeklyRetention rather than
 * multiplied into a lump total. Never below 1x - the worst case is the film
 * dying immediately after opening, not somehow grossing less than its own
 * opening weekend.
 */
export function computeLegs(criticScore: number, audienceScore: number, releaseType: ReleaseType): number {
  const releaseTypeProfile = RELEASE_TYPE_PROFILES[releaseType];
  return Math.max(1, releaseTypeProfile.baseLegsMultiplier * reviewLegsFactor(criticScore, audienceScore));
}

// How much of the *previous* week's gross the *next* week keeps - derived
// from legs so the two stay linked to the same tuning lever: legs=1 (the
// floor) means retention=0, the film dies right after opening; legs=8 (a
// well-reviewed Festival First release) means retention≈0.875, a long slow
// tail. Capped short of 1 so nothing runs forever even at extreme legs -
// see engine/boxOfficeRun.ts for the week cap that backs this up too.
const MAX_WEEKLY_RETENTION = 0.95;
export function computeWeeklyRetention(legs: number): number {
  return clamp(1 - 1 / legs, 0, MAX_WEEKLY_RETENTION);
}
