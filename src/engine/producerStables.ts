// Producer Stables (docs/DESIGN_REVIEW_delegated_staffing.md §10) - the book of
// crew heads a producer trusts and keeps going back to.
//
// The domain's own rule, one level up: "hiring a gaffer effectively hires their
// best boy" (docs/domain/05-departments-and-crew.md). A line producer arrives
// with people, and a delegated pick that comes from that book reads as a person
// making a choice rather than a function sampling a pool.
//
// THE STORAGE RULE HERE, stated once: a stable is HALF stored and HALF derived,
// and the split is deliberate.
//
//   - The seeded half (ProducerCareer.stable) is history from before the player
//     met them. It cannot be derived from anything, so it is generated once and
//     then never written again.
//   - The grown half is derived, on read, from the player's own released films:
//     a film that carried both this producer and this crew head IS the record
//     that they worked together. Storing it too would mean a second write path,
//     a second idempotency problem at six settlement sites, and two sources of
//     truth for one fact.
//
// Pure, like the rest of engine/.
import type { Film, Person, ProducerStableEntry, ProductionRole } from '../types';
import {
  DELEGABLE_CREW_ROLES,
  PRODUCER_SALARY_RANGE,
  STABLE_FEE_FLOOR,
  STABLE_SATURATION_FILMS,
  STABLE_SEED_COUNT,
  STABLE_SEED_FILMS,
  STABLE_SEED_TIER_TOLERANCE,
} from '../data/producers';
import { professionForProductionRole } from '../data/helpers';
import { getProducerCareer } from './producers';
import { getTypicalSalaryForRole } from './person';
import { ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { logT } from './interpolate';
import { clamp, randInt, type RandomFn } from './random';

/** How strongly a relationship of `films` pictures reads, 0-1, saturating. */
export function stableStrength(films: number): number {
  return clamp(films / STABLE_SATURATION_FILMS, 0, 1);
}

/**
 * This producer's book as it stands today: what they arrived with, plus every
 * crew head they have since shared a released film with, merged by person.
 * `playerFilms` should be the player's released films (engine/project.ts:
 * playerReleasedFilms); pass an empty list for the pre-first-release state.
 */
export function producerStable(producer: Person, playerFilms: readonly Film[]): ProducerStableEntry[] {
  const byPerson = new Map<string, ProducerStableEntry>();
  for (const entry of getProducerCareer(producer)?.stable ?? []) {
    byPerson.set(entry.personId, { ...entry });
  }
  for (const film of playerFilms) {
    if (!(film.attachedProducerIds ?? []).includes(producer.id)) continue;
    for (const assignment of film.talent) {
      if (!DELEGABLE_CREW_ROLES.includes(assignment.role)) continue;
      const existing = byPerson.get(assignment.person.id);
      if (existing) existing.films += 1;
      else byPerson.set(assignment.person.id, { personId: assignment.person.id, role: assignment.role, films: 1 });
    }
  }
  return [...byPerson.values()].sort((a, b) => b.films - a.films);
}

/** This producer's standing with one specific person, or null if they've never worked. */
export function stableEntryFor(
  producer: Person,
  playerFilms: readonly Film[],
  personId: string,
  role: ProductionRole,
): ProducerStableEntry | null {
  return producerStable(producer, playerFilms).find((e) => e.personId === personId && e.role === role) ?? null;
}

/**
 * The favour rate: what a regular charges as a multiple of what they'd
 * otherwise have quoted. Someone who trusts a producer takes less, saturating
 * at STABLE_FEE_FLOOR. 1 (no discount) for a stranger.
 */
export function stableFeeMultiplier(entry: ProducerStableEntry | null): number {
  if (!entry) return 1;
  return 1 - (1 - STABLE_FEE_FLOOR) * stableStrength(entry.films);
}

/** The producer's own line about a regular, for their pitch. Null for a stranger. */
export function describeStableBond(entry: ProducerStableEntry | null): string | null {
  if (!entry || entry.films < 1) return null;
  if (entry.films === 1) return "We've worked together once before.";
  if (entry.films === 2) return 'Second picture together.';
  if (entry.films < STABLE_SATURATION_FILMS) return `${entry.films} pictures together now.`;
  return `One of my regulars — ${entry.films} pictures and counting.`;
}

/** A short player-facing summary of who a producer brings with them, for the office and attach surfaces. */
export function describeStable(producer: Person, playerFilms: readonly Film[], talentPool: Record<string, Person[]>): string | null {
  const stable = producerStable(producer, playerFilms);
  if (stable.length === 0) return null;
  const named = stable.slice(0, 3).map((entry) => {
    const pool = talentPool[professionForProductionRole(entry.role)] ?? [];
    const name = pool.find((p) => p.id === entry.personId)?.identity.name;
    return name ? `${name} (${entry.role}, ${entry.films})` : null;
  });
  const shown = named.filter((n): n is string => n != null);
  if (shown.length === 0) return null;
  const more = stable.length - shown.length;
  return `${shown.join(' · ')}${more > 0 ? ` · +${more} more` : ''}`;
}

// --- Seeding ---------------------------------------------------------------

/**
 * Give every generated producer the book they arrived with. A SEPARATE PASS
 * over an already-generated pool rather than a step inside generateProducer,
 * deliberately: every new rng draw lands after all the existing producer draws,
 * so adding this does not reshuffle who the existing seeds generate.
 *
 * Whom they know tracks what they cost. A cheap producer's regulars are cheap
 * people; an expensive one's book is full of expensive ones - which is what
 * makes WHICH producer you hire a different question from how skilled they are,
 * once their regulars come at a favour rate.
 */
export function seedProducerStables(
  producerPool: Person[],
  talentPool: Record<string, Person[]>,
  rng: RandomFn,
): Person[] {
  return producerPool.map((producer) => {
    const career = getProducerCareer(producer);
    if (!career) return producer;
    const tier = clamp(logT(career.typicalSalary, PRODUCER_SALARY_RANGE), 0, 1);
    // A junior arrives with almost nobody; a seasoned producer with a full book.
    const count = Math.round(STABLE_SEED_COUNT.min + (STABLE_SEED_COUNT.max - STABLE_SEED_COUNT.min) * tier);
    if (count <= 0) return producer;

    const stable: ProducerStableEntry[] = [];
    const taken = new Set<string>();
    for (let i = 0; i < count; i++) {
      const role = DELEGABLE_CREW_ROLES[randInt(rng, 0, DELEGABLE_CREW_ROLES.length - 1)];
      const person = pickPeerFor(role, tier, talentPool, taken, rng);
      if (!person) continue;
      taken.add(person.id);
      stable.push({ personId: person.id, role, films: randInt(rng, STABLE_SEED_FILMS.min, STABLE_SEED_FILMS.max) });
    }
    if (stable.length === 0) return producer;
    return { ...producer, careers: { ...producer.careers, producer: { ...career, stable } } };
  });
}

/** Someone in this role who works at roughly the producer's own level, on the shared log-salary scale. */
function pickPeerFor(
  role: ProductionRole,
  tier: number,
  talentPool: Record<string, Person[]>,
  taken: ReadonlySet<string>,
  rng: RandomFn,
): Person | null {
  const profession = professionForProductionRole(role);
  const pool = talentPool[profession] ?? [];
  const salaryRange = ROLE_GENERATION_PROFILES[profession]?.salaryRange;
  if (pool.length === 0 || !salaryRange) return null;
  const peers = pool.filter(
    (p) =>
      !taken.has(p.id) &&
      Math.abs(clamp(logT(getTypicalSalaryForRole(p, role), salaryRange), 0, 1) - tier) <= STABLE_SEED_TIER_TOLERANCE,
  );
  const from = peers.length > 0 ? peers : pool.filter((p) => !taken.has(p.id));
  return from.length > 0 ? from[randInt(rng, 0, from.length - 1)] : null;
}
