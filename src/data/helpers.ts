import type { ProductionRole, Talent, TalentAssignment, TalentProfession } from "../types";

export function professionForProductionRole(
  role: ProductionRole,
): TalentProfession {
  switch (role) {
    case 'Lead Actor':
    case 'Supporting Actor':
      return 'Actor';

    default:
      return role;
  }
}

/** The one person assigned to a single-hire ProductionRole slot on a film's cast (e.g. Director), or undefined if not yet cast. */
export function findAssignedTalent(assignments: TalentAssignment[], role: ProductionRole): Talent | undefined {
  return assignments.find((a) => a.role === role)?.talent;
}

/** Everyone assigned to a given ProductionRole slot on a film's cast, flattened to the underlying Talent - for a multi-hire role (e.g. Supporting Actor) or role-agnostic display. */
export function filterAssignedTalent(assignments: TalentAssignment[], role: ProductionRole): Talent[] {
  return assignments.filter((a) => a.role === role).map((a) => a.talent);
}