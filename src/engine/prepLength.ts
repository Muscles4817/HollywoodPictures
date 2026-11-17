// How long a film's pre-production actually runs - one answer for the reducer
// (GREENLIGHT_PROJECT), the greenlight confirmation and the delivery estimate,
// which used to disagree: the reducer honoured the design-prep window, the two
// displays did not (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 1).
import type { ProductionChoices, Script, TalentAssignment } from '../types';
import { findAssignedPerson } from '../data/helpers';
import { computeRecommendedPreProductionDays } from './production';
import { computeSetsAmbition, defaultDesignPrepDays, NO_DESIGNER_SKILL } from './setsFacet';
import { getCrewCareer } from './person';

/** Prep runs at least as long as the design window granted (or the designer's own recommendation), with the scope-based estimate as a floor. */
export function effectivePreProductionDays(talent: TalentAssignment[], script: Script, choices: ProductionChoices): number {
  const designer = findAssignedPerson(talent, 'Production Designer');
  const designerSkill = (designer && getCrewCareer(designer, 'Production Designer')?.skill) ?? NO_DESIGNER_SKILL;
  const designPrepDays = choices.designPrepDays ?? defaultDesignPrepDays(computeSetsAmbition(script), designerSkill);
  return Math.max(computeRecommendedPreProductionDays(talent, script, choices), designPrepDays);
}
