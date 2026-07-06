import type { MarketingChoices, ProductionChoices, ProductionEvent, Talent } from '../types';
import {
  BUDGET_LEVEL_PROFILES,
  PRACTICAL_EFFECTS_PROFILES,
  RUNTIME_TARGET_PROFILES,
  SET_QUALITY_PROFILES,
  SHOOTING_STYLE_PROFILES,
  VFX_SPEND_PROFILES,
} from '../data/production';
import { MARKETING_SPEND_PROFILES, RELEASE_TYPE_PROFILES } from '../data/release';

/** Sum of all hired talent salaries. */
export function computeTalentCost(talent: Talent[]): number {
  return talent.reduce((sum, t) => sum + t.salary, 0);
}

/** Base production spend from budget level, shooting style, sets, effects and runtime. */
export function computeProductionBudgetCost(choices: ProductionChoices): number {
  const base =
    BUDGET_LEVEL_PROFILES[choices.budgetLevel].baseCost *
    SHOOTING_STYLE_PROFILES[choices.shootingStyle].costMultiplier *
    RUNTIME_TARGET_PROFILES[choices.runtimeTarget].costMultiplier;

  const extras =
    SET_QUALITY_PROFILES[choices.setQuality].cost +
    PRACTICAL_EFFECTS_PROFILES[choices.practicalEffects].cost +
    VFX_SPEND_PROFILES[choices.vfxSpend].cost;

  return Math.round(base + extras);
}

/** Net cost swing from all rolled production events (can be negative = savings). */
export function computeEventsCostDelta(events: ProductionEvent[]): number {
  return events.reduce((sum, e) => sum + e.costDelta, 0);
}

/** Marketing spend scaled by how expensive the chosen release type is to support. */
export function computeMarketingCost(choices: MarketingChoices): number {
  const base = MARKETING_SPEND_PROFILES[choices.marketingSpend].cost;
  const releaseCostMultiplier = RELEASE_TYPE_PROFILES[choices.releaseType].costMultiplier;
  return Math.round(base * releaseCostMultiplier);
}
