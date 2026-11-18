// How long a film's pre-production actually runs - one answer for the reducer
// (GREENLIGHT_PROJECT), the greenlight confirmation and the delivery estimate,
// which used to disagree (docs/IMPLEMENTATION_PLAN_preproduction_realism.md
// Phase 1): the recommendation from the film's moving parts
// (computeRecommendedPreProductionDays), times the length the plan chose
// (FilmDraft.prepPlan - shorter, as recommended, or longer).
import type { FilmDraft } from '../types';
import { computeRecommendedPreProductionDays } from './production';

type PrepLengthDraft = Pick<FilmDraft, 'talent' | 'script' | 'productionChoices' | 'environmentStrategy' | 'prepPlan'>;

/** The recommendation alone, before the plan's length choice. 0 without a script and plan. */
export function recommendedPreProductionDaysFor(draft: PrepLengthDraft): number {
  if (!draft.script || !draft.productionChoices) return 0;
  return computeRecommendedPreProductionDays(draft.talent, draft.script, draft.productionChoices, draft.environmentStrategy);
}

export function effectivePreProductionDays(draft: PrepLengthDraft): number {
  return Math.max(1, Math.round(recommendedPreProductionDaysFor(draft) * (draft.prepPlan?.lengthFactor ?? 1)));
}
