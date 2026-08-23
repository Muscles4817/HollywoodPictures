import type { TalentDatabase } from '../types';
import { HANDCRAFTED_TALENTS_BY_ROLE } from './handcraftedTalents';

// The registry of rosters a game can be started from (types/index.ts:TalentDatabase).
//
// The split exists for two reasons that happen to point the same way:
//
//  1. Legal. handcraftedTalents.ts names ~1,500 real, mostly living public
//     figures and assigns them invented personality values. Shipping that as
//     the default roster of a commercial game is a publicity-rights problem
//     (docs/ART_DIRECTION.md §10). Shipping it as a roster the player chooses
//     to load is a different thing entirely.
//  2. Design. A roster the player can swap is a feature - the same machinery
//     that makes the real-world set optional lets anyone author their own.
//
// Nothing here decides *how* a database is combined with generated talent;
// that is engine/talentGenerator.ts:generateTalentPool.

/**
 * The shipped default: no roster at all. Every person in the game is generated,
 * across each profession's full salary and fame range.
 */
export const GENERATED_TALENT_DB: TalentDatabase = {
  id: 'generated',
  name: 'Generated',
  description:
    'Every director, actor and crew member is generated fresh for this playthrough. No two studios see the same industry.',
  containsRealPeople: false,
  peopleByRole: {},
};

/**
 * The real-world roster, offered as an explicit choice rather than a default.
 *
 * `containsRealPeople` is true, and callers are expected to honour it: this
 * database must never be selected implicitly, must never be the fallback when a
 * saved id no longer resolves, and any UI offering it has to say what it is.
 */
export const REAL_WORLD_TALENT_DB: TalentDatabase = {
  id: 'real-world',
  name: 'Real World',
  description:
    'Around 1,500 real directors, actors and crew from film history, with invented stats. For personal play only - not for distribution.',
  containsRealPeople: true,
  peopleByRole: HANDCRAFTED_TALENTS_BY_ROLE,
};

export const BUILT_IN_TALENT_DATABASES: TalentDatabase[] = [
  GENERATED_TALENT_DB,
  REAL_WORLD_TALENT_DB,
];

/** What a new game uses when nothing else is chosen. Never a real-people roster. */
export const DEFAULT_TALENT_DATABASE_ID = GENERATED_TALENT_DB.id;

/**
 * Resolve a stored id back to its database.
 *
 * Returns undefined for an unknown id rather than guessing - a save that names
 * a database this build does not have should be handled deliberately by the
 * caller (see talentDatabaseOrDefault), not silently swapped for a roster the
 * player never picked.
 */
export function talentDatabaseById(id: string): TalentDatabase | undefined {
  return BUILT_IN_TALENT_DATABASES.find((db) => db.id === id);
}

/**
 * The database for an id, falling back to the generated default when the id is
 * absent or unknown.
 *
 * The fallback is deliberately the *generated* roster and never a real-people
 * one: a build that has dropped a database, or a save from a build that had
 * one, must degrade to fiction rather than silently opting the player into real
 * names they did not choose.
 */
export function talentDatabaseOrDefault(id: string | undefined): TalentDatabase {
  if (id === undefined) return GENERATED_TALENT_DB;
  return talentDatabaseById(id) ?? GENERATED_TALENT_DB;
}
