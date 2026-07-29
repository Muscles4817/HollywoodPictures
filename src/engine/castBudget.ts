import type { ProductionRole, Script, TalentAssignment } from '../types';
import { MANDATORY_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { professionForProductionRole } from '../data/helpers';
import { effectiveRoleCapacity } from './castRequirements';
import { assignmentCost } from './person';
import { clamp } from './random';

/**
 * How large a slice of the cast & crew budget each unfilled head claims,
 * relative to the others - the "importance" the master Target Cast & Crew
 * Budget dial splits along. A lead actor and the director carry a film
 * commercially, so they command the biggest shares; a supporting player less;
 * below-the-line crew least. Only the ratios between these matter, so they are
 * plain relative weights, tuned here rather than threaded through the reducer.
 */
export const ROLE_BUDGET_IMPORTANCE: Record<ProductionRole, number> = {
  'Lead Actor': 6,
  Director: 5,
  'Supporting Actor': 2.5,
  Writer: 1.5,
  Cinematographer: 1.5,
  Composer: 1.25,
  Editor: 1,
  'VFX Supervisor': 1.5,
  'Casting Director': 1,
  'Production Designer': 1.5,
};

export interface CastBudgetSplitParams {
  /** The master Target Cast & Crew Budget the player set on the dial. */
  totalBudget: number;
  /** Everyone hired so far - their own quoted fees are already committed, so they come off the top. */
  talent: TalentAssignment[];
  /** The draft's script, for per-role head counts (a script needing 3 leads has 3 lead heads). */
  script: Script | null;
  /** The current per-role targets - only unfilled mandatory roles are overwritten; everything else is preserved. */
  current: Partial<Record<ProductionRole, number>>;
  /** Phase 1b - roles the player has locked: their allocation is reserved off the pot and never overwritten by the re-split, so the rest divide only what's left. */
  locked?: ProductionRole[];
}

/**
 * Splits the master cast & crew budget across the mandatory roles still left to
 * hire, proportionally to each head's importance and net of what's already been
 * committed to the hires made so far. Two properties the old flat, even split
 * lacked:
 *
 *  - *By importance* - a lead actor's target is a much bigger slice than an
 *    editor's, per ROLE_BUDGET_IMPORTANCE, rather than every head getting an
 *    identical share.
 *  - *Individually, as you cast* - a hire's own quoted fee is subtracted from
 *    the pot before the remainder is divided among who's left, so casting your
 *    lead £500k above the suggested target leaves less for the rest and the
 *    next role you open is targeted lower to match. It isn't a one-time
 *    division frozen at the moment the dial moved.
 *
 * Returns the updated per-role target map; roles already fully cast keep their
 * existing target untouched (there is no open head to target).
 */
export function splitCastBudgetByImportance(params: CastBudgetSplitParams): Partial<Record<ProductionRole, number>> {
  const { totalBudget, talent, script, current } = params;
  const locked = new Set(params.locked ?? []);

  // What's already been committed to hires (their own quoted fees), across every
  // role - real money out of the same pot, so it comes off the top before the
  // remainder is divided among who's still left to cast.
  const spent = talent.reduce((sum, a) => sum + assignmentCost(a), 0);
  const remaining = Math.max(0, totalBudget - spent);

  // Heads still to hire per mandatory role (max capacity minus who's already in).
  const openHeads: Partial<Record<ProductionRole, number>> = {};
  for (const role of MANDATORY_TALENT_ROLES) {
    const hired = talent.filter((a) => a.role === role).length;
    openHeads[role] = Math.max(0, effectiveRoleCapacity(role, script).max - hired);
  }

  // Phase 1b - a locked role keeps its current target, and reserves that target
  // per open head off the pot; only UNLOCKED open roles share what's left, and
  // only they contribute weight. (Reserving £X for the director even when another
  // role goes over.)
  let reserved = 0;
  let totalWeight = 0;
  for (const role of MANDATORY_TALENT_ROLES) {
    const open = openHeads[role] ?? 0;
    if (open <= 0) continue;
    if (locked.has(role)) reserved += (current[role] ?? 0) * open;
    else totalWeight += open * ROLE_BUDGET_IMPORTANCE[role];
  }
  const pool = Math.max(0, remaining - reserved);

  const updated = { ...current };
  if (totalWeight <= 0) return updated; // nothing unlocked left to target - locked keep their targets.

  for (const role of MANDATORY_TALENT_ROLES) {
    if ((openHeads[role] ?? 0) <= 0 || locked.has(role)) continue; // cast or locked - leave its target alone.
    const range = ROLE_GENERATION_PROFILES[professionForProductionRole(role)].salaryRange;
    // This role's per-head share of the UNLOCKED pot, weighted by importance.
    const perHead = (pool * ROLE_BUDGET_IMPORTANCE[role]) / totalWeight;
    updated[role] = clamp(perHead, range.min, range.max);
  }
  return updated;
}
