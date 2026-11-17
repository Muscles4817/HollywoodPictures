// How long a film's pre-production actually runs - one answer for the reducer
// (GREENLIGHT_PROJECT), the greenlight confirmation and the delivery estimate,
// which used to disagree (docs/IMPLEMENTATION_PLAN_preproduction_realism.md
// Phase 1). The design window granted is one of prep's chains
// (computeRecommendedPreProductionDays), so this is that function.
import type { ProductionChoices, Script, TalentAssignment } from '../types';
import { computeRecommendedPreProductionDays } from './production';

export function effectivePreProductionDays(talent: TalentAssignment[], script: Script, choices: ProductionChoices): number {
  return computeRecommendedPreProductionDays(talent, script, choices);
}
