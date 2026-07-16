// Helper API for the Person model (PERSON_MODEL_REDESIGN.md) - career
// access/guards, role-aware salary/reputation lookups, and availability.
// Prefer these over reaching into person.careers.xxx directly so a new
// TalentProfession/ProductionRole can't silently go unhandled somewhere.
import type {
  ActorCareer,
  CrewCareer,
  CrewRole,
  DirectorCareer,
  GameDay,
  Money,
  NormalizedStat,
  Person,
  PersonCommitment,
  ProductionRole,
  TalentProfession,
} from '../types';
import { professionForProductionRole } from '../data/helpers';

export function getActorCareer(person: Person): ActorCareer | null {
  return person.careers.actor ?? null;
}

export function getDirectorCareer(person: Person): DirectorCareer | null {
  return person.careers.director ?? null;
}

export const CREW_CAREER_KEY: Record<CrewRole, 'writer' | 'cinematographer' | 'composer' | 'editor' | 'vfxSupervisor'> = {
  Writer: 'writer',
  Cinematographer: 'cinematographer',
  Composer: 'composer',
  Editor: 'editor',
  'VFX Supervisor': 'vfxSupervisor',
};

export function getCrewCareer(person: Person, role: CrewRole): CrewCareer<CrewRole> | null {
  return person.careers[CREW_CAREER_KEY[role]] ?? null;
}

function isCrewRole(profession: TalentProfession): profession is CrewRole {
  return profession !== 'Actor' && profession !== 'Director';
}

/** Whichever career record backs `profession` for this person, or null if they don't have one - see PersonCareers. */
export function getCareerForProfession(
  person: Person,
  profession: TalentProfession,
): ActorCareer | DirectorCareer | CrewCareer<CrewRole> | null {
  if (profession === 'Actor') return getActorCareer(person);
  if (profession === 'Director') return getDirectorCareer(person);
  return getCrewCareer(person, profession);
}

/**
 * Same lookup, but keyed by the ProductionRole a person is actually being
 * engaged under (Lead Actor/Supporting Actor both resolve to the Actor
 * career) - what most call sites have in hand (TalentAssignment.role),
 * rather than the underlying TalentProfession the talent pool is keyed by.
 */
export function getCareerForRole(
  person: Person,
  role: ProductionRole,
): ActorCareer | DirectorCareer | CrewCareer<CrewRole> | null {
  return getCareerForProfession(person, professionForProductionRole(role));
}

export function personCanPerformRole(person: Person, role: ProductionRole): boolean {
  return getCareerForRole(person, role) !== null;
}

export function getRoleReputation(person: Person, role: ProductionRole): NormalizedStat | null {
  return getCareerForRole(person, role)?.roleReputation ?? null;
}

/** 0 (never negative/undefined) if this person has no career under `role` - matches how a missing hire has always been handled at every call site (a cost sum simply doesn't include them). */
export function getTypicalSalaryForRole(person: Person, role: ProductionRole): Money {
  return getCareerForRole(person, role)?.typicalSalary ?? 0;
}

export function getMinimumSalaryForRole(person: Person, role: ProductionRole): Money {
  return getCareerForRole(person, role)?.minimumSalary ?? 0;
}

/** Every crew profession, for callers that need to enumerate them (e.g. generation). */
export const CREW_ROLES: readonly CrewRole[] = ['Writer', 'Cinematographer', 'Composer', 'Editor', 'VFX Supervisor'];

export { isCrewRole };

// --- Availability -----------------------------------------------------

/** The latest commitment end day, or undefined if there are none - a derived single-value reading for display code that predates multi-commitment availability (mirrors the old bookedUntil field exactly when there's at most one commitment). */
export function deriveBookedUntil(commitments: PersonCommitment[]): GameDay | undefined {
  if (commitments.length === 0) return undefined;
  return Math.max(...commitments.map((c) => c.endDay));
}

function commitmentsOverlap(a: { startDay: GameDay; endDay: GameDay }, b: { startDay: GameDay; endDay: GameDay }): boolean {
  return a.startDay <= b.endDay && b.startDay <= a.endDay;
}

/** Whether `person` is free to take on `proposed` - no existing commitment overlaps it in time, except another commitment on the exact same project (a person may hold more than one role on one production - see PersonCommitment). */
export function isPersonAvailableForCommitment(person: Person, proposed: PersonCommitment): boolean {
  return person.availability.commitments.every(
    (existing) => existing.projectId === proposed.projectId || !commitmentsOverlap(existing, proposed),
  );
}

/** Same check against a single point in time rather than a proposed range - what talent-pool filtering needs before a specific end day is even known (e.g. "is this person free to start casting today"). */
export function isPersonAvailableOnDay(person: Person, day: GameDay): boolean {
  return person.availability.commitments.every((c) => day < c.startDay || day > c.endDay);
}

export function withCommitment(person: Person, commitment: PersonCommitment): Person {
  return { ...person, availability: { commitments: [...person.availability.commitments, commitment] } };
}

/** Narrows to only the people from `pool` who have a career under `role` and are free on `day` - the two checks the talent pool has always needed before offering someone as a candidate. */
export function availableCandidatesForRole(pool: Person[], role: ProductionRole, day: GameDay): Person[] {
  return pool.filter((p) => personCanPerformRole(p, role) && isPersonAvailableOnDay(p, day));
}
