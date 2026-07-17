import type { ProductionRole, Script, ScriptCharacter } from '../types';
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
export function effectiveRoleCapacity(role: ProductionRole, script: Script | null): RoleCapacity {
  if (script) {
    if (role === 'Lead Actor') return { min: script.requiredLeads, max: script.requiredLeads };
    if (role === 'Supporting Actor') return { min: script.requiredSupporting, max: script.requiredSupporting };
  }
  return ROLE_CAPACITY[role];
}

/**
 * Which specific Character a Lead/Supporting Actor hire at `slotIndex`
 * within their own role group is being cast as (Character and Setting
 * Foundations milestone) - `slotIndex` is that hire's position among every
 * assignment already in the same role (0 for the first Lead Actor hired, 1
 * for the second, ...), matching the position Script.cast's own Lead-then-
 * Supporting ordering guarantees (engine/scriptGenerator.ts:generateCast).
 * null for any role that isn't Lead/Supporting Actor, or once every
 * character of that prominence is already filled (a script can be cast with
 * more hires than named characters if requiredLeads/requiredSupporting ever
 * allow it, though generation currently keeps them in exact lockstep).
 */
export function characterForRoleSlot(script: Script, role: ProductionRole, slotIndex: number): ScriptCharacter | null {
  const prominence = role === 'Lead Actor' ? 'Lead' : role === 'Supporting Actor' ? 'Supporting' : null;
  if (!prominence) return null;
  const matching = script.cast.filter((c) => c.prominence === prominence);
  return matching[slotIndex] ?? null;
}
