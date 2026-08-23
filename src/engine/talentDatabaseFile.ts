import type { Person, TalentDatabase, TalentProfession } from '../types';
import { ALL_TALENT_PROFESSIONS } from '../data/talentGeneration';

// Reading and writing talent databases as files, so a player can author or
// share a roster (data/talentDatabases.ts).
//
// Everything here treats its input as hostile. A database file is arbitrary
// JSON a player picked off their disk: it can be truncated, hand-edited, from a
// future version of the game, or simply not a database at all. Nothing in this
// module throws on bad input - it returns a result the UI can show - and
// nothing it returns can be a partially-valid database, because a roster that
// silently dropped half its people would look like a game bug rather than a bad
// file.

/** The on-disk shape. Deliberately the same shape the game exports, so a round trip is lossless. */
export interface TalentDatabaseFile {
  formatVersion: number;
  name: string;
  description?: string;
  containsRealPeople?: boolean;
  peopleByRole: Partial<Record<TalentProfession, Person[]>>;
}

export const TALENT_DATABASE_FORMAT_VERSION = 1;

export type TalentDatabaseParseResult =
  | { ok: true; database: TalentDatabase; warnings: string[] }
  | { ok: false; error: string };

const PROFESSIONS = new Set<string>(ALL_TALENT_PROFESSIONS);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether a value carries the fields the rest of the game will actually read off
 * a Person before it has a chance to fail.
 *
 * Deliberately shallow. A deep structural check would reject databases authored
 * against a slightly different build for fields nothing reads, which is worse
 * than useless; the pool tolerates a sparse person far better than it tolerates
 * a missing id or name.
 */
function looksLikePerson(value: unknown): value is Person {
  if (!isObject(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (!isObject(value.identity) || typeof value.identity.name !== 'string') return false;
  if (!isObject(value.careers)) return false;
  return true;
}

/**
 * Parse the text of a database file.
 *
 * `fallbackId` is used when the file names no id of its own - the caller passes
 * something stable for this import (see state/customTalentDatabases.ts), since
 * an id is what a save stores as provenance.
 */
export function parseTalentDatabaseFile(text: string, fallbackId: string): TalentDatabaseParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }

  if (!isObject(raw)) return { ok: false, error: 'A database file must be a JSON object.' };

  if (typeof raw.name !== 'string' || raw.name.trim().length === 0) {
    return { ok: false, error: 'The file is missing a "name".' };
  }

  // A newer format may have changed what the fields mean, so refuse rather than
  // guess. An older one is fine - there has only ever been version 1.
  const version = typeof raw.formatVersion === 'number' ? raw.formatVersion : 1;
  if (version > TALENT_DATABASE_FORMAT_VERSION) {
    return {
      ok: false,
      error: `That file is format version ${version}; this build understands up to ${TALENT_DATABASE_FORMAT_VERSION}.`,
    };
  }

  if (!isObject(raw.peopleByRole)) {
    return { ok: false, error: 'The file is missing a "peopleByRole" object.' };
  }

  const warnings: string[] = [];
  const peopleByRole: Partial<Record<TalentProfession, Person[]>> = {};
  const seenIds = new Set<string>();
  let total = 0;

  for (const [role, value] of Object.entries(raw.peopleByRole)) {
    if (!PROFESSIONS.has(role)) {
      // A profession this build does not have. Skipping is right - a future
      // build's roster should still be playable here - but say so, because
      // silently losing a third of a roster is exactly the kind of thing a
      // player would otherwise report as a bug.
      warnings.push(`Ignored "${role}" - not a profession in this build.`);
      continue;
    }
    if (!Array.isArray(value)) {
      return { ok: false, error: `"peopleByRole.${role}" must be an array.` };
    }

    const people: Person[] = [];
    for (const [index, candidate] of value.entries()) {
      if (!looksLikePerson(candidate)) {
        return {
          ok: false,
          error: `"peopleByRole.${role}" entry ${index} is missing an id, a name, or careers.`,
        };
      }
      // The same person may legitimately appear under several professions (a
      // writer-director), so ids are only required to be unique *within* a role.
      if (people.some((p) => p.id === candidate.id)) {
        return { ok: false, error: `"peopleByRole.${role}" lists id "${candidate.id}" twice.` };
      }
      people.push(candidate);
      seenIds.add(candidate.id);
      total += 1;
    }

    if (people.length > 0) peopleByRole[role as TalentProfession] = people;
  }

  if (total === 0) {
    return { ok: false, error: 'That database contains no people in any profession this build knows.' };
  }

  return {
    ok: true,
    warnings,
    database: {
      id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : fallbackId,
      name: raw.name.trim(),
      description: typeof raw.description === 'string' ? raw.description : `${seenIds.size} people, imported from a file.`,
      // Absent means unknown, and unknown must mean *assume real* rather than
      // assume fiction: the flag exists to warn, and a warning that is missing
      // by default is worse than one shown unnecessarily.
      containsRealPeople: raw.containsRealPeople !== false,
      peopleByRole,
    },
  };
}

/** Serialize a database back to file text - the same shape the parser accepts, so a round trip is lossless. */
export function serializeTalentDatabase(database: TalentDatabase): string {
  const file: TalentDatabaseFile = {
    formatVersion: TALENT_DATABASE_FORMAT_VERSION,
    name: database.name,
    description: database.description,
    containsRealPeople: database.containsRealPeople,
    peopleByRole: database.peopleByRole,
  };
  return JSON.stringify({ id: database.id, ...file }, null, 2);
}

/** How many people a database supplies, counting a multi-career person once. */
export function talentDatabaseSize(database: TalentDatabase): number {
  const ids = new Set<string>();
  for (const people of Object.values(database.peopleByRole)) {
    for (const person of people ?? []) ids.add(person.id);
  }
  return ids.size;
}
