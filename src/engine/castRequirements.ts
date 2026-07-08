import type { Script, TalentRole } from '../types';
import { ROLE_CAPACITY, type RoleCapacity } from '../data/talentGeneration';

/**
 * Lead Actor and Supporting Actor capacity comes from the chosen script
 * once there is one - a script specifies how many named lead/supporting
 * roles it actually has (Script.requiredLeads/requiredSupporting), rather
 * than every film offering the same fixed slots. Every other role still
 * uses the static per-role capacity in data/talentGeneration.ts. Falls back
 * to that same static capacity for Lead/Supporting too before a script is
 * picked, since the wizard doesn't reach Hire Talent without one selected.
 */
export function effectiveRoleCapacity(role: TalentRole, script: Script | null): RoleCapacity {
  if (script) {
    if (role === 'Lead Actor') return { min: script.requiredLeads, max: script.requiredLeads };
    if (role === 'Supporting Actor') return { min: script.requiredSupporting, max: script.requiredSupporting };
  }
  return ROLE_CAPACITY[role];
}
