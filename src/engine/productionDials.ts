import {
  BUDGET_RANGE,
  BUDGET_ANCHORS,
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

// Thin, named wrappers around the generic interpolation helpers, one per
// production dial. Keeping these here (rather than inline in cost.ts/
// scoring.ts/production.ts) means the UI and the engine read from the same
// single source of truth for "what does this slider position mean".

export const budgetT = (amount: number) => logT(amount, BUDGET_RANGE);
export const budgetQuality = (amount: number) => interpolateScale(budgetT(amount), BUDGET_ANCHORS, 'quality');
export const budgetRisk = (amount: number) => interpolateScale(budgetT(amount), BUDGET_ANCHORS, 'risk');
export const budgetDescription = (amount: number) => describeScale(budgetT(amount), BUDGET_ANCHORS);

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

export const runtimeCostMultiplier = (intensity: number) => interpolateScale(intensity, RUNTIME_ANCHORS, 'costMultiplier');
export const runtimeMarketabilityDelta = (intensity: number) => interpolateScale(intensity, RUNTIME_ANCHORS, 'marketabilityDelta');
export const runtimeDescription = (intensity: number) => describeScale(intensity, RUNTIME_ANCHORS);

export const marketingT = (amount: number) => logT(amount, MARKETING_SPEND_RANGE);
export const marketingBuzzContribution = (amount: number) =>
  interpolateScale(marketingT(amount), MARKETING_SPEND_ANCHORS, 'buzzContribution');
export const marketingDescription = (amount: number) => describeScale(marketingT(amount), MARKETING_SPEND_ANCHORS);
