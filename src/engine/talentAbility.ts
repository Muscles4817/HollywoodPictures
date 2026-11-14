// Potential, ability and growth (docs/DESIGN_talent_model.md §4.1, §4.1a, stage 6).
//
// "Talent" in the everyday sense is POTENTIAL: how good someone could become at
// each thing their job involves. It is fixed for life and nobody sees it.
// ABILITY is what that potential has been turned into so far, and it moves:
// people get better at what the work asks of them, toward their potential,
// fastest early. What they are paid is a third thing, set by standing
// (engine/careerProgress.ts), so ability and fee are no longer the same number.
//
// Where ability lives, per profession:
//   - an actor: the five ActingStyle axes (already independent of fee);
//   - a director: the four DomainAptitudes, with `skill` kept as their mean so
//     every existing reader of `skill` sees the same person;
//   - a production designer or VFX supervisor: their specialties, with `skill`
//     moved by the same amount;
//   - a writer or any other craft: `skill`.
// Potential is stored per attribute on the career (`potential`), keyed by the
// same attribute keys the studio's reads use (engine/talentKnowledge.ts).
//
// Deterministic throughout: everything is hashed from who the person is, so
// nothing here draws from the shared random stream.

import type { ActingStyle, DomainAptitudes, Person, ProductionRole } from '../types';
import { ACTING_STYLE_AXES } from '../data/actingStyle';
import { APTITUDE_DOMAINS, APTITUDE_SPREAD, deriveDirectorAptitudes, type AptitudeDomain } from './creativeAptitudes';
import { crewSpecialtyCapability, specialtyDepartmentForRole, DEPT_SPECIALTIES, SPECIALTY_SPREAD, type CrewSpecialty } from './crewSpecialty';
import { getCareerForRole } from './person';
import { gameDateFromTotalDays } from './calendar';
import { hashUnit } from './random';
import { knowledgeAttributes, knowledgeProfession } from './talentKnowledge';

// --- Tunables ----------------------------------------------------------------

/**
 * The talent spread everyone is drawn from, newcomers included (§8 decision 4):
 * about one in eight is genuinely good (75+), one in forty exceptional (88+),
 * and nothing marks them.
 */
export const POTENTIAL_MEAN = 61;
export const POTENTIAL_SPREAD = 17;
/**
 * How far a career before the game had already sorted people by price. Not
 * zero - a working market rewards ability, imperfectly - but far from the old
 * one-to-one: it puts the starting correlation between fee and ability for
 * crafts and directors near 0.35, where today's generation had it near 0.8.
 */
export const FEE_LINK = 28;
/** The floor ability is grown up from: what anyone in the job can already do. */
const ABILITY_FLOOR = 30;
/**
 * How much of the way from the floor to their potential someone has come on
 * day one of their career, and the experience at which they are all the way
 * there (unless the work never asked). Crafts are mostly accumulated craft, so
 * they start lowest; directors sit between; actors are not moved here, their
 * gift shows early and their axes are already their own.
 */
const START_MATURITY = { director: 0.45, crew: 0.4, writer: 0.5 } as const;
const MATURE_EXPERIENCE = 70;
/** Room left above an actor's present axes, at the start of a career and at full experience. */
const ACTOR_ROOM_YOUNG = 28;
const ACTOR_ROOM_VETERAN = 6;

/** Of the gap to potential, how much one film that fully tested an attribute closes. The typical pace (§8, still open): about half the room in five tested films. */
export const GROWTH_RATE = 0.12;
/** Temperament: adaptability for a new register, professionalism from any job, ambition to keep pushing (§4.1a). */
const ADAPTABILITY_WEIGHT = 0.35;
const PROFESSIONALISM_WEIGHT = 0.25;
const AMBITION_WEIGHT = 0.3;
/** A director who is strong with actors teaches more; a big ego takes less from them. */
const MENTOR_BONUS = 0.4;
const MENTOR_FROM = 70;
/** Below this a film barely counts as having asked anything. */
const MEANINGFUL_TEST = 0.2;

/** Physical performance fades with age (§4.1a): points a year after this age. */
const PHYSICAL_DECLINE_FROM = 45;
const PHYSICAL_DECLINE_PER_YEAR = 1.2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A normal deviate from two hashes. */
function hashNormal(seed: string): number {
  const u = Math.max(1e-9, hashUnit(`${seed}|n1`));
  const v = hashUnit(`${seed}|n2`);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function maturity(profession: keyof typeof START_MATURITY, experience: number): number {
  const start = START_MATURITY[profession];
  return start + (1 - start) * clamp(experience / MATURE_EXPERIENCE, 0, 1);
}

// --- Generation --------------------------------------------------------------

/**
 * After years in the job the business knows who is good: a veteran's industry
 * respect carries their ability, a newcomer's barely does (stage 6). Respect is
 * what rivals and the crafts' quotes read, so this is what keeps a track record
 * meaning something once fee no longer does.
 */
const RESPECT_FROM_ABILITY = 0.7;
function withEarnedRespect(person: Person, ability: number, m: number): Person {
  const w = RESPECT_FROM_ABILITY * clamp((m - 0.4) / 0.6, 0, 1);
  const industryRespect = Math.round(clamp((1 - w) * person.reputation.industryRespect + w * ability, 1, 100));
  return { ...person, reputation: { ...person.reputation, industryRespect } };
}

/**
 * A generated person's ability and potential, untied from what they are paid.
 * `t` is their position on the fee spread (0-1), `seed` anything stable about
 * them, `experience` their years in the job as 0-100. Actors keep the acting
 * style they were rolled and gain a potential above it; everyone else is
 * re-derived here. Pure.
 */
export function untieAbility(person: Person, t: number, seed: string): Person {
  const careers = { ...person.careers };
  const experience = (Object.values(careers)[0] as { experience?: number } | undefined)?.experience ?? 0;

  if (careers.actor) {
    const style = careers.actor.actingStyle;
    const roomScale = ACTOR_ROOM_VETERAN + (ACTOR_ROOM_YOUNG - ACTOR_ROOM_VETERAN) * (1 - clamp(experience / MATURE_EXPERIENCE, 0, 1));
    const potential: Record<string, number> = {};
    for (const axis of ACTING_STYLE_AXES) {
      // Most have a little room, a few a lot: a late bloomer nobody has seen yet.
      const room = roomScale * hashUnit(`${seed}|room|${axis}`) ** 1.5 * 1.6;
      potential[axis] = clamp(Math.round(style[axis] + room), style[axis], 100);
    }
    careers.actor = { ...careers.actor, potential };
    return { ...person, careers };
  }

  // One overall potential from the spread, a modest link to the fee, then
  // spread across the attributes the job involves.
  const overall = clamp(POTENTIAL_MEAN + POTENTIAL_SPREAD * hashNormal(`${seed}|potential`) + FEE_LINK * (t - 0.5), 15, 99);

  if (careers.director) {
    const m = maturity('director', experience);
    // Their shape across the four domains, hashed from the stable seed - not
    // from the id, which comes from a process-wide counter, so the same seed
    // must give the same person.
    const current = Object.fromEntries(APTITUDE_DOMAINS.map((d) => [d, (hashUnit(`${seed}|aptitude|${d}`) - 0.5) * APTITUDE_SPREAD])) as unknown as DomainAptitudes;
    const mean = APTITUDE_DOMAINS.reduce((s, d) => s + current[d], 0) / APTITUDE_DOMAINS.length;
    const potential: Record<string, number> = {};
    const aptitudes = {} as DomainAptitudes;
    for (const d of APTITUDE_DOMAINS) {
      const p = clamp(Math.round(overall + (current[d] - mean)), 10, 100);
      potential[d] = p;
      aptitudes[d] = clamp(Math.round(ABILITY_FLOOR + (p - ABILITY_FLOOR) * m), 1, p);
    }
    const skill = Math.round(APTITUDE_DOMAINS.reduce((s, d) => s + aptitudes[d], 0) / APTITUDE_DOMAINS.length);
    careers.director = { ...careers.director, skill, aptitudes, potential };
    return withEarnedRespect({ ...person, careers }, skill, m);
  }

  if (careers.writer) {
    const m = maturity('writer', experience);
    const p = Math.round(overall);
    const skill = clamp(Math.round(ABILITY_FLOOR + (p - ABILITY_FLOOR) * m), 1, p);
    const shift = skill - careers.writer.skill;
    const craft = Object.fromEntries(Object.entries(careers.writer.craft).map(([k, v]) => [k, clamp(Math.round(v + shift), 1, 100)])) as unknown as typeof careers.writer.craft;
    careers.writer = { ...careers.writer, skill, craft, potential: { craft: p } };
    return withEarnedRespect({ ...person, careers }, skill, m);
  }

  // Every other craft: one skill, and for the specialty departments their
  // specialties spread around it.
  const key = Object.keys(careers)[0] as keyof typeof careers;
  const career = careers[key] as unknown as { role: ProductionRole; skill: number } & Record<string, unknown>;
  const m = maturity('crew', experience);
  const p = Math.round(overall);
  const skill = clamp(Math.round(ABILITY_FLOOR + (p - ABILITY_FLOOR) * m), 1, p);
  const department = specialtyDepartmentForRole(career.role);
  if (department) {
    // Specialties spread around their potential, hashed from the stable seed (see above).
    const caps = Object.fromEntries(DEPT_SPECIALTIES[department].map((sp) => [sp, clamp(Math.round(p + (hashUnit(`${seed}|spec|${sp}`) - 0.5) * 2 * SPECIALTY_SPREAD), 1, 100)])) as Record<CrewSpecialty, number>;
    const potential: Record<string, number> = {};
    const specialties: Record<string, number> = {};
    for (const s of DEPT_SPECIALTIES[department]) {
      potential[s] = caps[s];
      specialties[s] = clamp(Math.round(ABILITY_FLOOR + (caps[s] - ABILITY_FLOOR) * m), 1, caps[s]);
    }
    (careers as Record<string, unknown>)[key] = { ...career, skill, specialties, potential };
    return withEarnedRespect({ ...person, careers }, skill, m);
  }
  (careers as Record<string, unknown>)[key] = { ...career, skill, potential: { craft: p } };
  return withEarnedRespect({ ...person, careers }, skill, m);
}

// --- Potential -------------------------------------------------------------------

/**
 * A person's potential for a role, attribute by attribute. Stored for anyone
 * generated; for the hand-written roster it is their written ability plus a
 * little room, worked out the same way every time (§8 decision 9: a written
 * value is that person's ability today).
 */
export function potentialFor(person: Person, role: ProductionRole): Record<string, number> {
  const career = getCareerForRole(person, role) as { potential?: Record<string, number>; experience?: number } | null;
  if (career?.potential) return career.potential;
  const experience = career?.experience ?? 50;
  const room = ACTOR_ROOM_VETERAN + (ACTOR_ROOM_YOUNG - ACTOR_ROOM_VETERAN) * (1 - clamp(experience / MATURE_EXPERIENCE, 0, 1));
  return Object.fromEntries(
    knowledgeAttributes(person, role).map((a) => [a.key, clamp(Math.round(a.value + room * hashUnit(`${person.id}|room|${a.key}`) ** 1.5), a.value, 100)]),
  );
}

// --- Growth ----------------------------------------------------------------------

/** How fast this person learns from a film: temperament, and who was teaching. */
export function learningPace(person: Person, mentor: Person | undefined, newRegister: boolean): number {
  const { adaptability, professionalism, ambition, ego } = person.personality;
  let pace = 1 + PROFESSIONALISM_WEIGHT * ((professionalism - 50) / 50) + AMBITION_WEIGHT * ((ambition - 50) / 50);
  if (newRegister) pace += ADAPTABILITY_WEIGHT * ((adaptability - 50) / 50);
  const teaching = mentor ? clamp((deriveDirectorAptitudes(mentor).performance - MENTOR_FROM) / (100 - MENTOR_FROM), 0, 1) : 0;
  pace *= 1 + MENTOR_BONUS * teaching * (1 - ego / 150);
  return clamp(pace, 0.3, 2);
}

/**
 * Ability after one film, grown in what the film tested. `tests` is how hard
 * the film asked of each attribute (0-1, engine/talentKnowledge.ts:creditTests);
 * `mentor` the film's director, for anyone acting under them. Pure.
 */
export function growFromFilm(person: Person, role: ProductionRole, tests: Record<string, number>, mentor: Person | undefined): Person {
  const potential = potentialFor(person, role);
  const profession = knowledgeProfession(role);
  const attributes = knowledgeAttributes(person, role);
  const strongest = attributes.reduce((best, a) => (a.value > best ? a.value : best), 0);
  const grown: Record<string, number> = {};
  for (const a of attributes) {
    const t = tests[a.key] ?? 0;
    if (t < MEANINGFUL_TEST) continue;
    const gap = Math.max(0, (potential[a.key] ?? a.value) - a.value);
    if (gap <= 0) continue;
    // A register they are weaker in is new ground: adaptability counts there.
    const pace = learningPace(person, profession === 'actor' ? mentor : undefined, a.value < strongest - 10);
    grown[a.key] = Math.min(potential[a.key] ?? 100, a.value + GROWTH_RATE * t * gap * pace);
  }
  if (Object.keys(grown).length === 0) return person;
  return withAbilities(person, role, grown);
}

/** Write new attribute values back to wherever that profession keeps them, keeping `skill` in step. */
export function withAbilities(person: Person, role: ProductionRole, values: Record<string, number>): Person {
  const profession = knowledgeProfession(role);
  const careers = { ...person.careers };
  const round1 = (v: number) => Math.round(v * 10) / 10;
  if (profession === 'actor' && careers.actor) {
    const style = { ...careers.actor.actingStyle };
    for (const axis of ACTING_STYLE_AXES) if (values[axis] !== undefined) style[axis] = round1(values[axis]);
    careers.actor = { ...careers.actor, actingStyle: style as ActingStyle, potential: careers.actor.potential ?? potentialFor(person, role) };
    return { ...person, careers };
  }
  if (profession === 'director' && careers.director) {
    const aptitudes = { ...deriveDirectorAptitudes(person) };
    for (const d of APTITUDE_DOMAINS) if (values[d] !== undefined) aptitudes[d as AptitudeDomain] = round1(values[d]);
    const skill = round1(APTITUDE_DOMAINS.reduce((s, d) => s + aptitudes[d], 0) / APTITUDE_DOMAINS.length);
    careers.director = { ...careers.director, aptitudes, skill, potential: careers.director.potential ?? potentialFor(person, role) };
    return { ...person, careers };
  }
  const career = getCareerForRole(person, role) as ({ skill: number; specialties?: Record<string, number>; potential?: Record<string, number> } & Record<string, unknown>) | null;
  if (!career) return person;
  const key = (Object.keys(careers) as Array<keyof typeof careers>).find((k) => (careers[k] as unknown) === career);
  if (!key) return person;
  const department = specialtyDepartmentForRole(role);
  let next: Record<string, unknown> = { ...career, potential: career.potential ?? potentialFor(person, role) };
  if (department) {
    const caps = { ...crewSpecialtyCapability(person, role, department, career.skill) } as Record<CrewSpecialty, number>;
    let moved = 0;
    for (const s of DEPT_SPECIALTIES[department]) {
      if (values[s] === undefined) continue;
      moved += values[s] - caps[s];
      caps[s] = round1(values[s]);
    }
    next = { ...next, specialties: caps, skill: round1(career.skill + moved / DEPT_SPECIALTIES[department].length) };
  } else if (values.craft !== undefined) {
    const shift = values.craft - career.skill;
    next = { ...next, skill: round1(values.craft) };
    if (profession === 'writer' && careers.writer) {
      const craft = Object.fromEntries(Object.entries(careers.writer.craft).map(([k, v]) => [k, clamp(round1(v + shift), 1, 100)])) as unknown as typeof careers.writer.craft;
      next = { ...next, craft };
    }
  }
  (careers as Record<string, unknown>)[key] = next;
  return { ...person, careers };
}

// --- Age -------------------------------------------------------------------------

/** A year passes: physical performance fades for actors past their forties. Everything else holds (§4.1a). */
export function ageAbility(person: Person, day: number): Person {
  const actor = person.careers.actor;
  const born = person.identity.dateOfBirth;
  if (!actor || !born) return person;
  const age = gameDateFromTotalDays(day).year - born.year;
  if (age <= PHYSICAL_DECLINE_FROM) return person;
  const physical = Math.max(1, Math.round((actor.actingStyle.physicalPerformance - PHYSICAL_DECLINE_PER_YEAR) * 10) / 10);
  return { ...person, careers: { ...person.careers, actor: { ...actor, actingStyle: { ...actor.actingStyle, physicalPerformance: physical } } } };
}

/** A year passes for the whole pool. Returns the same pool object if nobody changed. */
export function ageAbilities<P extends Record<string, Person[]>>(pool: P, day: number): P {
  let changed = false;
  const next = {} as P;
  for (const key of Object.keys(pool) as Array<keyof P>) {
    const roster = pool[key].map((person) => {
      const aged = ageAbility(person, day);
      if (aged !== person) changed = true;
      return aged;
    });
    next[key] = roster as P[keyof P];
  }
  return changed ? next : pool;
}
