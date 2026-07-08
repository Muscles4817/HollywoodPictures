import type { Genre, ReleaseType, ReleaseWindow, TargetAudience } from '../types';
import { GENRE_PROFILES } from '../data/genres';
import { AUDIENCE_PROFILES } from '../data/audiences';
import { RELEASE_TYPE_PROFILES, RELEASE_WINDOW_BASE_MULTIPLIER, RELEASE_WINDOW_GENRE_BONUS } from '../data/release';
import { budgetT } from './productionDials';
import { randFloat, type RandomFn } from './random';

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
 */

// Total addressable OPENING WEEKEND potential with every reach factor maxed
// out - budget scale, hype, genre popularity, market size, release reach.
// Total lifetime gross isn't set directly at all; it's always derived from
// this via the legs multiplier below. Tuned (see the balance scenarios in
// docs/DESIGN.md) so a mid-budget, well-buzzed, well-reviewed film nets a
// real but not absurd profit once the studio revenue share is applied, and
// a mediocre film genuinely risks a loss.
const OPENING_BASE_POTENTIAL = 12_000_000;

// Bigger budgets buy wider prints/distribution independent of quality or
// hype - scales smoothly from the cheapest budget to the priciest. Wider
// than reach alone used to be, so going ultra-cheap has real teeth on the
// box office side too, not just the on-screen-quality side.
const BUDGET_SCALE_MIN = 0.4;
const BUDGET_SCALE_MAX = 1.6;
function budgetScaleFactor(budgetAmount: number): number {
  return BUDGET_SCALE_MIN + (BUDGET_SCALE_MAX - BUDGET_SCALE_MIN) * budgetT(budgetAmount);
}

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
// see state/studioReducer.ts:RELEASE_FILM.
const STUDIO_BOX_OFFICE_SHARE = 0.42;

export interface BoxOfficeInput {
  buzzScore: number; // 0-100, drives the opening
  criticScore: number; // 0-100, drives legs alongside audience
  audienceScore: number; // 0-100, drives legs, weighted higher than critic
  targetAudience: TargetAudience;
  genre: Genre;
  releaseWindow: ReleaseWindow;
  releaseType: ReleaseType;
  budgetAmount: number;
}

export interface BoxOfficeResult {
  openingWeekend: number;
  totalBoxOffice: number;
  studioRevenue: number;
}

export function computeBoxOffice(input: BoxOfficeInput, rng: RandomFn): BoxOfficeResult {
  const audienceProfile = AUDIENCE_PROFILES[input.targetAudience];
  const genreProfile = GENRE_PROFILES[input.genre];
  const windowGenreBonus = RELEASE_WINDOW_GENRE_BONUS[input.releaseWindow][input.genre] ?? 1;
  const windowBase = RELEASE_WINDOW_BASE_MULTIPLIER[input.releaseWindow];
  const releaseTypeProfile = RELEASE_TYPE_PROFILES[input.releaseType];
  const budgetScale = budgetScaleFactor(input.budgetAmount);

  const varianceBand = 0.2 * releaseTypeProfile.varianceMultiplier;
  const variance = randFloat(rng, 1 - varianceBand, 1 + varianceBand);

  const rawOpening =
    OPENING_BASE_POTENTIAL *
    audienceProfile.marketSize *
    (genreProfile.popularity / 100) *
    windowBase *
    windowGenreBonus *
    releaseTypeProfile.reachMultiplier *
    budgetScale *
    hypeFactor(input.buzzScore) *
    variance;

  const openingWeekend = Math.max(0, Math.round(rawOpening / 1000) * 1000);

  // Never let legs collapse below 1x - the worst case is the film dying
  // immediately after opening (total = opening), not somehow grossing
  // *less* than its own opening weekend.
  const legs = Math.max(
    1,
    releaseTypeProfile.baseLegsMultiplier * reviewLegsFactor(input.criticScore, input.audienceScore),
  );
  const totalBoxOffice = Math.max(openingWeekend, Math.round((openingWeekend * legs) / 1000) * 1000);
  const studioRevenue = Math.round(totalBoxOffice * STUDIO_BOX_OFFICE_SHARE);

  return { openingWeekend, totalBoxOffice, studioRevenue };
}
