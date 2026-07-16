import type { Person, ProductionRole, TalentAssignment, TalentProfession } from "../types";

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
export function findAssignedPerson(assignments: TalentAssignment[], role: ProductionRole): Person | undefined {
  return assignments.find((a) => a.role === role)?.person;
}

/** Everyone assigned to a given ProductionRole slot on a film's cast, flattened to the underlying Person - for a multi-hire role (e.g. Supporting Actor) or role-agnostic display. */
export function filterAssignedPeople(assignments: TalentAssignment[], role: ProductionRole): Person[] {
  return assignments.filter((a) => a.role === role).map((a) => a.person);
}