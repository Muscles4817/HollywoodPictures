import type { MarketingChoices, ProductionChoices, ProductionEvent, Talent } from '../types';
import { shootingCostMultiplier, runtimeCostMultiplier } from './productionDials';
import { MARKETING_SPEND_PROFILES, RELEASE_TYPE_PROFILES } from '../data/release';

/** Sum of all hired talent salaries. */
export function computeTalentCost(talent: Talent[]): number {
  return talent.reduce((sum, t) => sum + t.salary, 0);
}

/** Base production spend from budget, shooting pace, sets, effects and runtime. */
export function computeProductionBudgetCost(choices: ProductionChoices): number {
  const base =
    choices.budgetAmount *
    shootingCostMultiplier(choices.shootingIntensity) *
    runtimeCostMultiplier(choices.runtimeIntensity);

  const extras = choices.setQualityAmount + choices.practicalEffectsAmount + choices.vfxAmount;

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
