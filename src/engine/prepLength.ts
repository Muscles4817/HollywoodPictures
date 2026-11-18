// How long a film's pre-production actually runs - one answer for the reducer
// (GREENLIGHT_PROJECT), the greenlight confirmation and the delivery estimate,
// which used to disagree (docs/IMPLEMENTATION_PLAN_preproduction_realism.md
// Phase 1): the recommendation from the film's moving parts
// (computeRecommendedPreProductionDays), times the length the plan chose
// (FilmDraft.prepPlan - shorter, as recommended, or longer).
import type { FilmDraft } from '../types';
import { computeRecommendedPreProductionDays } from './production';
import { derivePrepDemands } from './prep/demands';
import { defaultActivities, effectiveActivities, prepDailyBurnWith } from './prep/run';
import { draftDailyPrepBurn } from './prep/context';

type PrepLengthDraft = Pick<FilmDraft, 'talent' | 'script' | 'productionChoices' | 'environmentStrategy' | 'prepPlan'>;

/** The recommendation alone, before the plan's length choice. 0 without a script and plan. */
export function recommendedPreProductionDaysFor(draft: PrepLengthDraft): number {
  if (!draft.script || !draft.productionChoices) return 0;
  return computeRecommendedPreProductionDays(draft.talent, draft.script, draft.productionChoices, draft.environmentStrategy);
}

export function effectivePreProductionDays(draft: PrepLengthDraft): number {
  return Math.max(1, Math.round(recommendedPreProductionDaysFor(draft) * (draft.prepPlan?.lengthFactor ?? 1)));
}

/**
 * What the prep is expected to cost in burn: its length times the day's burn
 * with its revealing work running. Spent day by day, not at greenlight - but the
 * studio has to be able to carry it, so the greenlight read counts it
 * (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 5). Fixes found in
 * prep are on top, and not knowable in advance.
 */
export function estimatedPrepSpend(draft: PrepLengthDraft): number {
  if (!draft.script || !draft.productionChoices) return 0;
  const plan = draft.prepPlan;
  const demands = derivePrepDemands({ script: draft.script, talent: draft.talent, choices: draft.productionChoices, environmentStrategy: draft.environmentStrategy });
  const activities = effectiveActivities(plan?.activities ?? defaultActivities(demands), plan?.lengthFactor ?? 1);
  return prepDailyBurnWith(draftDailyPrepBurn(draft), activities) * effectivePreProductionDays(draft);
}
