import type { Distribution, EffectsMethodKey, NormalizedScalar, ProductionChoices } from '../types';
import { ENVIRONMENT_BUDGET_RANGE, PRACTICAL_EFFECTS_RANGE, VFX_RANGE } from '../data/production';
import { logAmount } from './interpolate';

// TEMPORARY ADAPTER, NOT THE FUTURE ARCHITECTURE. Every downstream cost/
// schedule/risk formula (engine/cost.ts, engine/production.ts,
// engine/scoring.ts) still reads the legacy ProductionChoices shape - this
// exists purely so Plan Production can let the player edit the *new*
// Strategy/Ambition model while every one of those formulas keeps working
// completely unchanged. Once those systems are migrated to read Strategy/
// Ambition natively, this file - and the ProductionChoices fields it
// derives - should be deleted, not extended. See docs/DESIGN.md.
//
// Known limitation, worth being honest about rather than hiding: Environment
// Strategy (studio/location/digital) has no cost/risk consequence at all in
// today's formulas - only Environment Ambition does, via setQualityAmount.
// The legacy model never distinguished "where you shoot" from "how nice it
// looks" as separate cost drivers. That's real information loss this
// adapter can't paper over, not a bug in it.

/**
 * Derives a full ProductionChoices from the player's Strategy/Ambition
 * choices, plus the two fields nothing in the new model replaced
 * (contingencyAmount stays entirely player-set; runtimeIntensity is
 * unexposed on Plan Production for now, defaulted, pending its own move to
 * Post-Production - see docs/DESIGN.md).
 */
export function adaptRecommendationsToProductionChoices(
  environmentAmbition: NormalizedScalar,
  effectsStrategy: Distribution<EffectsMethodKey>,
  effectsAmbition: NormalizedScalar,
  contingencyAmount: number,
  runtimeIntensity: number,
): ProductionChoices {
  return {
    contingencyAmount,
    runtimeIntensity,
    setQualityAmount: logAmount(environmentAmbition, ENVIRONMENT_BUDGET_RANGE),
    practicalEffectsAmount: logAmount(effectsAmbition * effectsStrategy.practical, PRACTICAL_EFFECTS_RANGE),
    vfxAmount: logAmount(effectsAmbition * effectsStrategy.digital, VFX_RANGE),
  };
}
