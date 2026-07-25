import type { ProductionRole, Script, TalentAssignment } from '../types';
import { MANDATORY_TALENT_ROLES, ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { professionForProductionRole } from '../data/helpers';
import { effectiveRoleCapacity } from './castRequirements';
import { getTypicalSalaryForRole } from './person';
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

  // What's already been committed to hires (their own quoted fees), across every
  // role - real money out of the same pot, so it comes off the top before the
  // remainder is divided among who's still left to cast.
  const spent = talent.reduce((sum, a) => sum + getTypicalSalaryForRole(a.person, a.role), 0);
  const remaining = Math.max(0, totalBudget - spent);

  // Heads still to hire per mandatory role (max capacity minus who's already in),
  // and the total importance weight across all of those open heads.
  const openHeads: Partial<Record<ProductionRole, number>> = {};
  let totalWeight = 0;
  for (const role of MANDATORY_TALENT_ROLES) {
    const hired = talent.filter((a) => a.role === role).length;
    const open = Math.max(0, effectiveRoleCapacity(role, script).max - hired);
    openHeads[role] = open;
    totalWeight += open * ROLE_BUDGET_IMPORTANCE[role];
  }

  const updated = { ...current };
  if (totalWeight <= 0) return updated; // everyone mandatory is cast - nothing left to target.

  for (const role of MANDATORY_TALENT_ROLES) {
    if ((openHeads[role] ?? 0) <= 0) continue; // fully cast - leave its existing target alone.
    const range = ROLE_GENERATION_PROFILES[professionForProductionRole(role)].salaryRange;
    // This role's per-head share of the remaining pot, weighted by importance.
    const perHead = (remaining * ROLE_BUDGET_IMPORTANCE[role]) / totalWeight;
    updated[role] = clamp(perHead, range.min, range.max);
  }
  return updated;
}
