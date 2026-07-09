import {
  CONTINGENCY_RANGE,
  CONTINGENCY_ANCHORS,
  SHOOTING_ANCHORS,
  SET_QUALITY_RANGE,
  SET_QUALITY_ANCHORS,
  PRACTICAL_EFFECTS_RANGE,
  PRACTICAL_EFFECTS_ANCHORS,
  VFX_RANGE,
  VFX_ANCHORS,
  RUNTIME_ANCHORS,
} from '../data/production';
import { MARKETING_SPEND_RANGE, MARKETING_SPEND_ANCHORS } from '../data/release';
import { logT, interpolateScale, describeScale } from './interpolate';
import type { ProductionChoices } from '../types';

// Thin, named wrappers around the generic interpolation helpers, one per
// production dial. Keeping these here (rather than inline in cost.ts/
// scoring.ts/production.ts) means the UI and the engine read from the same
// single source of truth for "what does this slider position mean".

export const contingencyT = (amount: number) => logT(amount, CONTINGENCY_RANGE);
export const contingencyQuality = (amount: number) => interpolateScale(contingencyT(amount), CONTINGENCY_ANCHORS, 'quality');
export const contingencyDescription = (amount: number) => describeScale(contingencyT(amount), CONTINGENCY_ANCHORS);

export const shootingQuality = (intensity: number) => interpolateScale(intensity, SHOOTING_ANCHORS, 'quality');
export const shootingRisk = (intensity: number) => interpolateScale(intensity, SHOOTING_ANCHORS, 'risk');
export const shootingCostMultiplier = (intensity: number) => interpolateScale(intensity, SHOOTING_ANCHORS, 'costMultiplier');
export const shootingDescription = (intensity: number) => describeScale(intensity, SHOOTING_ANCHORS);

export const setQualityT = (amount: number) => logT(amount, SET_QUALITY_RANGE);
export const setQualityScore = (amount: number) => interpolateScale(setQualityT(amount), SET_QUALITY_ANCHORS, 'quality');
export const setQualityDescription = (amount: number) => describeScale(setQualityT(amount), SET_QUALITY_ANCHORS);

export const practicalEffectsT = (amount: number) => logT(amount, PRACTICAL_EFFECTS_RANGE);
export const practicalEffectsScore = (amount: number) =>
  interpolateScale(practicalEffectsT(amount), PRACTICAL_EFFECTS_ANCHORS, 'quality');
export const practicalEffectsDescription = (amount: number) =>
  describeScale(practicalEffectsT(amount), PRACTICAL_EFFECTS_ANCHORS);

export const vfxT = (amount: number) => logT(amount, VFX_RANGE);
export const vfxScore = (amount: number) => interpolateScale(vfxT(amount), VFX_ANCHORS, 'quality');
export const vfxDescription = (amount: number) => describeScale(vfxT(amount), VFX_ANCHORS);

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
