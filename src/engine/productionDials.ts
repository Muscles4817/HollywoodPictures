import {
  SHOOTING_BUDGET_RANGE,
  SHOOTING_BUDGET_ANCHORS,
  ENVIRONMENT_BUDGET_RANGE,
  ENVIRONMENT_BUDGET_ANCHORS,
  PRACTICAL_EFFECTS_RANGE,
  PRACTICAL_EFFECTS_ANCHORS,
  VFX_RANGE,
  VFX_ANCHORS,
  RUNTIME_ANCHORS,
} from '../data/production';
import { MARKETING_SPEND_RANGE, MARKETING_SPEND_ANCHORS } from '../data/release';
import { logT, interpolateScale, describeScale } from './interpolate';
import { clamp } from './random';
import type { ProductionChoices } from '../types';

// Thin, named wrappers around the generic interpolation helpers, one per
// production dial. Keeping these here (rather than inline in cost.ts/
// scoring.ts/production.ts) means the UI and the engine read from the same
// single source of truth for "what does this slider position mean".

export const contingencyT = (amount: number) => logT(amount, SHOOTING_BUDGET_RANGE);
export const contingencyQuality = (amount: number) => interpolateScale(contingencyT(amount), SHOOTING_BUDGET_ANCHORS, 'quality');
export const contingencyDescription = (amount: number) => describeScale(contingencyT(amount), SHOOTING_BUDGET_ANCHORS);

/**
 * Shooting quality is no longer a slider position - it's read off how the
 * shoot actually went, after the fact: `daysElapsed / recommendedDays`
 * (PhotographyState, see docs/DESIGN.md 5.16). Falling short of the
 * recommended schedule costs quality steeply (mirrors the old "Fast" end,
 * 40-60); meeting or comfortably exceeding it climbs toward the old
 * "Perfectionist" ceiling (85), with diminishing returns past 2.5x the
 * recommended length rather than rewarding an unbounded shoot forever -
 * the daily contingency burn (engine/production.ts) is what actually stops
 * "just keep shooting" from being free, this just stops it from being
 * infinitely *rewarding* too.
 */
export function shootingQualityFromRatio(ratio: number): number {
  if (ratio < 1) return clamp(40 + ratio * 20, 40, 60);
  const over = Math.min(ratio - 1, 1.5);
  return clamp(60 + over * (25 / 1.5), 60, 85);
}

// The footage band around a film's recommendedDays (engine/production.ts).
// recommendedDays is "enough coverage for a solid film"; below the lower bound
// there isn't enough footage for a functional cut (the shoot can't be wrapped),
// and past the upper bound there's nothing left to capture (it auto-wraps).
export const FOOTAGE_LOWER_RATIO = 0.6;
export const FOOTAGE_UPPER_RATIO = 2.5;

/**
 * The ceiling footage coverage puts on the edit (postProductionScore). An
 * editor can only cut what was actually shot: below the recommended schedule
 * the coverage caps how good the final edit can be, rising from the base edit
 * floor at the lower footage bound to no cap at all once the recommended
 * footage (ratio 1) is in the can. At or above recommended it never binds, so
 * a normally- or over-shot film's edit is judged purely on its own merits.
 */
export function editCoverageCeiling(shootingRatio: number): number {
  if (shootingRatio >= 1) return 100;
  const t = clamp((shootingRatio - FOOTAGE_LOWER_RATIO) / (1 - FOOTAGE_LOWER_RATIO), 0, 1);
  return 55 + t * 45;
}

export const setQualityT = (amount: number) => logT(amount, ENVIRONMENT_BUDGET_RANGE);
export const setQualityScore = (amount: number) => interpolateScale(setQualityT(amount), ENVIRONMENT_BUDGET_ANCHORS, 'quality');
export const setQualityDescription = (amount: number) => describeScale(setQualityT(amount), ENVIRONMENT_BUDGET_ANCHORS);

export const practicalEffectsT = (amount: number) => logT(amount, PRACTICAL_EFFECTS_RANGE);
export const practicalEffectsScore = (amount: number) =>
  interpolateScale(practicalEffectsT(amount), PRACTICAL_EFFECTS_ANCHORS, 'quality');
export const practicalEffectsDescription = (amount: number) =>
  describeScale(practicalEffectsT(amount), PRACTICAL_EFFECTS_ANCHORS);

export const vfxT = (amount: number) => logT(amount, VFX_RANGE);
export const vfxScore = (amount: number) => interpolateScale(vfxT(amount), VFX_ANCHORS, 'quality');
export const vfxDescription = (amount: number) => describeScale(vfxT(amount), VFX_ANCHORS);

// How much a VFX Supervisor's craft swings the realised value of the VFX spend:
// the money buys the shots, but the supervisor determines how well that spend is
// actually landed on screen. Centred at skill 50 (factor 1.0), so an unstaffed
// production - and every existing crew-less fixture/rival - reads exactly the
// old money-only vfxScore. A floor hire realises ~0.6x the spend, a ceiling hire
// ~1.4x, before the genre-scaled effects weighting in scoring.ts decides how much
// that matters at all (a chamber drama barely leans on VFX; an Action tentpole
// leans hard).
const VFX_SUPERVISOR_FLOOR_FACTOR = 0.6;
const VFX_SUPERVISOR_SKILL_SPAN = 0.8;

/** Realised VFX quality: the money-driven vfxScore scaled by how well the supervisor lands it (factor 1.0 at neutral skill 50). */
export function realizedVfxScore(vfxAmount: number, supervisorSkill = 50): number {
  const factor = VFX_SUPERVISOR_FLOOR_FACTOR + (supervisorSkill / 100) * VFX_SUPERVISOR_SKILL_SPAN;
  return clamp(vfxScore(vfxAmount) * factor, 0, 100);
}

/**
 * How far toward the expensive end of its *own* range each of the four
 * spend dials sits, averaged into one 0-1 "how well-resourced is this
 * production overall" figure - used by Genre Fit's cheapness check and
 * Budget Risk, in place of reading contingencyAmount alone. Each dial has
 * its own min/max, so this is a fair composite regardless of how different
 * those ranges are (a maxed-out Set Quality slider and a maxed-out VFX
 * slider both read as 1.0 here, even though the underlying pound amounts
 * are nothing alike).
 */
export const overallSpendT = (choices: ProductionChoices) =>
  (contingencyT(choices.contingencyAmount) + setQualityT(choices.setQualityAmount) +
    practicalEffectsT(choices.practicalEffectsAmount) + vfxT(choices.vfxAmount)) / 4;

export const runtimeCostMultiplier = (intensity: number) => interpolateScale(intensity, RUNTIME_ANCHORS, 'costMultiplier');
export const runtimeMarketabilityDelta = (intensity: number) => interpolateScale(intensity, RUNTIME_ANCHORS, 'marketabilityDelta');
export const runtimeDescription = (intensity: number) => describeScale(intensity, RUNTIME_ANCHORS);

export const marketingT = (amount: number) => logT(amount, MARKETING_SPEND_RANGE);
export const marketingBuzzContribution = (amount: number) =>
  interpolateScale(marketingT(amount), MARKETING_SPEND_ANCHORS, 'buzzContribution');
export const marketingDescription = (amount: number) => describeScale(marketingT(amount), MARKETING_SPEND_ANCHORS);
