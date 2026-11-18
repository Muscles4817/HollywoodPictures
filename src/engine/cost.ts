import type { MarketingChoices, ProductionChoices, ProductionEvent, TalentAssignment } from '../types';
import { runtimeCostMultiplier } from './productionDials';
import { RELEASE_TYPE_PROFILES, campaignSpendFor } from '../data/release';
import { assignmentCost } from './person';
import { pressTourCost } from './pressTour';

/** Sum of what every hire actually costs - their negotiated fee (TalentAssignment.agreedSalary) where one was struck, else their typical salary under the role they were cast in (engine/person.ts:assignmentCost). */
export function computeTalentCost(talent: TalentAssignment[]): number {
  return talent.reduce((sum, a) => sum + assignmentCost(a), 0);
}

/**
 * Pre-photography production spend: sets, practical effects and VFX,
 * scaled by runtime. The Shooting Budget is deliberately not part of this - it's
 * not a flat lump sum, it's spent as a daily burn rate over however many days
 * principal photography actually takes (computeDailyShootBurn below,
 * PhotographyState.runningCost) - so it genuinely costs less to wrap early and
 * more to run long, rather than being a fixed number decided before filming.
 */
export function computeProductionBudgetCost(choices: ProductionChoices): number {
  const base = choices.setQualityAmount + choices.practicalEffectsAmount + choices.vfxAmount;
  return Math.round(base * runtimeCostMultiplier(choices.runtimeIntensity));
}

/**
 * The Shooting Budget's daily spend rate during principal photography - the
 * budgeted total for the *recommended* schedule, spread evenly across it.
 * Wrapping early spends less than planned; running past the recommended count
 * keeps burning at the same rate - those overrun days are what the Contingency
 * Reserve absorbs (docs/DESIGN_REVIEW_production_redesign.md §8), which is what
 * makes "give the team more time" a genuine cost, not just a schedule abstraction.
 */
export function computeDailyShootBurn(shootingBudgetAmount: number, recommendedDays: number): number {
  return recommendedDays > 0 ? shootingBudgetAmount / recommendedDays : shootingBudgetAmount;
}

/** Net cost swing from all rolled production events (can be negative = savings). */
export function computeEventsCostDelta(events: ProductionEvent[]): number {
  return events.reduce((sum, e) => sum + e.costDelta, 0);
}

// Pre-production overhead burned per day: the core prep team - the production
// office, the department heads prepping, the scouts - priced against the film's
// own shooting day, because that is how the reference prices it (04 §1.4): "a
// prep week for the core prep team on a mid-budget studio film costs roughly
// $50-150K; a lost shooting day on the same film costs $150-400K". A prep week
// is therefore about a third to a half of a shooting day; we take 0.4. The
// builds, costumes and effects work prep commissions are not in this burn -
// they are the production budget's own lines (sets, practical, VFX), paid at
// greenlight. Replaces a share of the negative capped per scale
// (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 5), whose cap made a
// prep week on a large film cost a whole shooting day or more.

/** A prep week costs this many of the film's shooting days (04 §1.4). */
export const PREP_WEEK_IN_SHOOT_DAYS = 0.4;
/** However small the film, someone is being paid to prepare it. */
export const PREP_DAILY_BURN_FLOOR = 2_000;

/** Cash burned per calendar day of pre-production, from the film's daily shoot burn. */
export function computeDailyPrepBurn(dailyShootBurn: number): number {
  return Math.max(PREP_DAILY_BURN_FLOOR, Math.round((dailyShootBurn * PREP_WEEK_IN_SHOOT_DAYS) / 7));
}

/** What a draft has committed to its negative: cast and crew, the production plan, and the shooting budget. */
export function draftNegativeCost(draft: { talent: TalentAssignment[]; productionChoices: ProductionChoices | null }): number {
  return (
    computeTalentCost(draft.talent) +
    (draft.productionChoices ? computeProductionBudgetCost(draft.productionChoices) + draft.productionChoices.shootingBudgetAmount : 0)
  );
}

/** Marketing spend scaled by how expensive the chosen release type is to support. */
export function computeMarketingCost(choices: MarketingChoices): number {
  const releaseCostMultiplier = RELEASE_TYPE_PROFILES[choices.releaseType].costMultiplier;
  // A Wide release cannot be opened for less than a wide campaign costs, whatever
  // the studio would rather spend (data/release.ts:MINIMUM_CAMPAIGN_SPEND). The
  // floor is charged AND bought - engine/releaseFilm.ts scales the realised reach
  // by the same amount - so it is a forced purchase, never a tax.
  return Math.round(campaignSpendFor(choices.releaseType, choices.marketingSpend) * releaseCostMultiplier);
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
