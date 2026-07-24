import type { MarketingChoices, ProductionChoices, ProductionEvent, TalentAssignment } from '../types';
import { runtimeCostMultiplier } from './productionDials';
import { RELEASE_TYPE_PROFILES } from '../data/release';
import { getTypicalSalaryForRole } from './person';
import { pressTourCost } from './pressTour';

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

/**
 * Every cash line that goes into a film's all-in cost, itemised - the exact
 * same components engine/releaseFilm.ts:computeReleaseResults sums into
 * FilmResults.productionCost / marketingCost / totalCost, pulled out into their
 * own labelled terms so a breakdown can show where every pound went (per dial
 * and selection) without re-deriving the arithmetic and risking drift. The
 * itemised terms sum to the returned productionCost/marketingCost/totalCost
 * exactly (barring the same non-negative clamps releaseFilm applies).
 *
 * Producer effects are passed as plain scalars (a production-cost multiplier and
 * a flat per-film fee) rather than the ProducerEffects type, so this stays a
 * dependency-light pure helper; both default to neutral (1x, £0).
 */
export interface FilmCostBreakdown {
  // --- Production ---
  talent: number;
  productionBudget: number;
  photography: number;
  onSetEvents: number;
  postProductionInterventions: number;
  producerFees: number;
  productionCost: number;
  // --- Marketing ---
  channelCampaign: number;
  pressTour: number;
  marketingCost: number;
  // --- All-in ---
  totalCost: number;
  /** True when a distributor funds the ad campaign (its P&A), so the studio pays no channel cost up front. */
  onDistributorDeal: boolean;
}

export function computeFilmCostBreakdown(input: {
  talent: TalentAssignment[];
  productionChoices: ProductionChoices;
  /** Contingency burn from the finished shoot (engine/releaseFilm.ts:photographyCost). */
  photographyCost: number;
  /** On-set events (their net cost delta). */
  events: ProductionEvent[];
  /** Resolved test-screening / post-production interventions (their net cost delta). */
  postProductionEvents: ProductionEvent[];
  marketingChoices: MarketingChoices;
  /** Producer production-cost multiplier (engine/producers.ts). Defaults to 1 (neutral). */
  productionCostMultiplier?: number;
  /** Total attached per-film producer fees. Defaults to 0. */
  producerFees?: number;
}): FilmCostBreakdown {
  const talent = computeTalentCost(input.talent);
  const productionBudget = Math.round(computeProductionBudgetCost(input.productionChoices) * (input.productionCostMultiplier ?? 1));
  const photography = Math.max(0, Math.round(input.photographyCost));
  const onSetEvents = computeEventsCostDelta(input.events);
  const postProductionInterventions = computeEventsCostDelta(input.postProductionEvents);
  const producerFees = input.producerFees ?? 0;
  const productionCost = Math.max(0, talent + productionBudget + photography + onSetEvents + postProductionInterventions + producerFees);

  // Under a distributor deal the ad campaign is the distributor's fronted P&A
  // (recouped off the gross), so the studio's own channel outlay is nil - only
  // the press tour is the studio's marketing cash. Mirrors releaseFilm exactly.
  const onDistributorDeal = (input.marketingChoices.distributionPAndA ?? 0) > 0;
  const channelCampaign = onDistributorDeal ? 0 : computeMarketingCost(input.marketingChoices);
  const pressTour = pressTourCost(input.talent, input.marketingChoices.pressTourCast);
  const marketingCost = Math.max(0, channelCampaign + pressTour);

  return {
    talent,
    productionBudget,
    photography,
    onSetEvents,
    postProductionInterventions,
    producerFees,
    productionCost,
    channelCampaign,
    pressTour,
    marketingCost,
    totalCost: productionCost + marketingCost,
    onDistributorDeal,
  };
}
