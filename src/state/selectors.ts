import type { FilmDraft } from '../types';
import { computeTalentCost, computeProductionBudgetCost, computeEventsCostDelta, computeMarketingCost } from '../engine/cost';
import { TEST_SCREENING_PROFILES } from '../data/postProduction';

/**
 * Sums whatever costs have been locked in so far for the film in progress.
 * Nothing here is actually deducted from studio cash until release (see
 * RELEASE_FILM in studioReducer) - this is purely a live preview so each
 * wizard screen can show "cash after this film" without any risk of
 * double-charging when the player navigates back and forth.
 */
export function computeCommittedSpend(draft: FilmDraft | null): number {
  if (!draft) return 0;

  let total = 0;
  if (draft.script) total += draft.script.cost;
  total += computeTalentCost(draft.talent);
  if (draft.productionChoices) total += computeProductionBudgetCost(draft.productionChoices);
  if (draft.photography) {
    // Contingency's daily burn accrues live as photography ticks
    // (see engine/cost.ts:computeDailyContingencyBurn), on top of whatever
    // events have fired so far - so this preview climbs in real time while
    // the player watches filming happen, the same way it always updated
    // instantly after every other choice.
    total += draft.photography.runningCost;
    total += computeEventsCostDelta(draft.photography.events);
  } else if (draft.productionChoices) {
    // Before photography starts, there's no live runningCost yet to add -
    // but leaving contingency out entirely made this screen's "Projected
    // Cash After Release" quietly omit the single biggest line item in the
    // whole film. Use the full planned reserve as the estimate (what it
    // costs to shoot for the recommended schedule, see
    // engine/production.ts:computeRecommendedShootDays) - the same number
    // ProductionPlanning.tsx shows directly, so this stays consistent with
    // what the player can already see on screen.
    total += draft.productionChoices.contingencyAmount;
  }
  if (draft.postProductionChoices) {
    total += TEST_SCREENING_PROFILES[draft.postProductionChoices.testScreeningResponse].cost;
  }
  if (draft.marketingChoices) total += computeMarketingCost(draft.marketingChoices);

  return total;
}
