import type { MarketingChoices, ProductionChoices, ProductionEvent, TalentAssignment } from '../types';
import { runtimeCostMultiplier } from './productionDials';
import { RELEASE_TYPE_PROFILES } from '../data/release';
import { getTypicalSalaryForRole } from './person';

/** Sum of every hired person's typical salary under the role they were actually cast in. */
export function computeTalentCost(talent: TalentAssignment[]): number {
  return talent.reduce((sum, a) => sum + getTypicalSalaryForRole(a.person, a.role), 0);
}

/**
 * Pre-photography production spend: sets, practical effects and VFX,
 * scaled by runtime. Contingency is deliberately not part of this - it's no
 * longer a flat lump sum, it's spent as a daily burn rate over however many
 * days principal photography actually takes
 * (computeDailyContingencyBurn below, PhotographyState.runningCost) - so it
 * genuinely costs less to wrap early and more to run long, rather than
 * being a fixed number decided before filming even starts.
 */
export function computeProductionBudgetCost(choices: ProductionChoices): number {
  const base = choices.setQualityAmount + choices.practicalEffectsAmount + choices.vfxAmount;
  return Math.round(base * runtimeCostMultiplier(choices.runtimeIntensity));
}

/**
 * Contingency's daily spend rate during principal photography - the
 * budgeted total for the *recommended* schedule, spread evenly across it.
 * Wrapping early spends less than planned; running past the recommended
 * count keeps burning at the same rate with no upper bound, which is what
 * makes "give the team more time" a genuine cost, not just a schedule-risk
 * abstraction.
 */
export function computeDailyContingencyBurn(contingencyAmount: number, recommendedDays: number): number {
  return recommendedDays > 0 ? contingencyAmount / recommendedDays : contingencyAmount;
}

/** Net cost swing from all rolled production events (can be negative = savings). */
export function computeEventsCostDelta(events: ProductionEvent[]): number {
  return events.reduce((sum, e) => sum + e.costDelta, 0);
}

/** Marketing spend scaled by how expensive the chosen release type is to support. */
export function computeMarketingCost(choices: MarketingChoices): number {
  const releaseCostMultiplier = RELEASE_TYPE_PROFILES[choices.releaseType].costMultiplier;
  return Math.round(choices.marketingSpend * releaseCostMultiplier);
}
