// The roster a game draws its people from is selectable (types/index.ts:
// TalentDatabase). Two things about that are load-bearing rather than cosmetic,
// and both are pinned here:
//
//   1. A real-people roster must never be reached by accident. It can only ever
//      be the result of an explicit choice - never a default, never a fallback.
//   2. A generated-only game must still contain stars. BUDGET_TIER caps
//      generated talent below a seeded roster's floor; if that cap applied when
//      no roster was supplied, the default game would top out at ~£300k and the
//      industry would have no A-list in it at all.
import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_TALENT_DATABASES,
  DEFAULT_TALENT_DATABASE_ID,
  GENERATED_TALENT_DB,
  REAL_WORLD_TALENT_DB,
  talentDatabaseById,
  talentDatabaseOrDefault,
} from './talentDatabases';
import { generateTalentPool } from '../engine/talentGenerator';
import { createRng } from '../engine/random';

describe('the talent database registry', () => {
  it('ships a default that contains no real people', () => {
    const chosen = talentDatabaseById(DEFAULT_TALENT_DATABASE_ID);
    expect(chosen).toBeDefined();
    expect(chosen!.containsRealPeople).toBe(false);
  });

  it('gives every database a unique id', () => {
    const ids = BUILT_IN_TALENT_DATABASES.map((db) => db.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('falls back to the generated roster for an absent id, never a real-people one', () => {
    expect(talentDatabaseOrDefault(undefined).containsRealPeople).toBe(false);
    expect(talentDatabaseOrDefault(undefined).id).toBe(GENERATED_TALENT_DB.id);
  });

  it('falls back to the generated roster for an id this build does not have', () => {
    // A save naming a database that has since been removed must degrade to
    // fiction rather than quietly swapping in real names.
    const resolved = talentDatabaseOrDefault('a-database-that-does-not-exist');
    expect(resolved.id).toBe(GENERATED_TALENT_DB.id);
    expect(resolved.containsRealPeople).toBe(false);
  });

  it('resolves a real-people roster only when it is asked for by name', () => {
    expect(talentDatabaseOrDefault(REAL_WORLD_TALENT_DB.id).id).toBe(REAL_WORLD_TALENT_DB.id);
    expect(REAL_WORLD_TALENT_DB.containsRealPeople).toBe(true);
  });
});

describe('generateTalentPool - with no database', () => {
  // BUDGET_TIER's ceilings: Actor/Director/Cinematographer 300k, Writer/Composer
  // 250k, Editor 180k. A generated-only industry that respected those caps would
  // have no stars, so the pool must reach far above them.
  it('still produces talent far above the budget tier, or the game would have no A-list', () => {
    const pool = generateTalentPool(createRng(7), GENERATED_TALENT_DB);
    for (const role of ['Actor', 'Director', 'Writer', 'Cinematographer', 'Composer', 'Editor'] as const) {
      const top = Math.max(...pool[role].map((p) => p.careers[
        role === 'Actor' ? 'actor'
          : role === 'Director' ? 'director'
          : role === 'Writer' ? 'writer'
          : role === 'Cinematographer' ? 'cinematographer'
          : role === 'Composer' ? 'composer'
          : 'editor'
      ]?.typicalSalary ?? 0));
      expect(top, `${role} tops out at ${top}`).toBeGreaterThan(1_000_000);
    }
  });

  it('populates every profession', () => {
    const pool = generateTalentPool(createRng(11), GENERATED_TALENT_DB);
    for (const [role, people] of Object.entries(pool)) {
      expect(people.length, `${role} is empty`).toBeGreaterThan(0);
    }
  });

  it('is the default when no database is passed at all', () => {
    const explicit = generateTalentPool(createRng(3), GENERATED_TALENT_DB);
    const implicit = generateTalentPool(createRng(3));
    expect(implicit['Actor'].map((p) => p.identity.name))
      .toEqual(explicit['Actor'].map((p) => p.identity.name));
  });

  it('contains none of the real-world roster', () => {
    const pool = generateTalentPool(createRng(5), GENERATED_TALENT_DB);
    const generatedIds = new Set(pool['Director'].map((p) => p.id));
    const realIds = (REAL_WORLD_TALENT_DB.peopleByRole.Director ?? []).map((p) => p.id);
    expect(realIds.length).toBeGreaterThan(0);
    expect(realIds.some((id) => generatedIds.has(id))).toBe(false);
  });
});

describe('generateTalentPool - with a database', () => {
  it('seeds every person the database supplies for a role', () => {
    const pool = generateTalentPool(createRng(13), REAL_WORLD_TALENT_DB);
    const seeded = REAL_WORLD_TALENT_DB.peopleByRole.Director ?? [];
    const pooled = new Set(pool['Director'].map((p) => p.id));
    for (const person of seeded) {
      expect(pooled.has(person.id), `${person.identity.name} missing from the pool`).toBe(true);
    }
  });

  it('caps generated talent below the seeded floor for the roles it covers', () => {
    const pool = generateTalentPool(createRng(17), REAL_WORLD_TALENT_DB);
    const seededIds = new Set((REAL_WORLD_TALENT_DB.peopleByRole.Director ?? []).map((p) => p.id));
    const generated = pool['Director'].filter((p) => !seededIds.has(p.id));
    expect(generated.length).toBeGreaterThan(0);
    for (const person of generated) {
      // Director's BUDGET_TIER ceiling. Nothing generated may reach past it
      // while a curated roster occupies the tier above.
      expect(person.careers.director!.typicalSalary).toBeLessThanOrEqual(300_000);
    }
  });

  it('still generates the full range for professions the database leaves empty', () => {
    // No database covers VFX Supervisor, so it must be generated top to bottom
    // even when a database is supplied for other roles.
    const pool = generateTalentPool(createRng(19), REAL_WORLD_TALENT_DB);
    expect(REAL_WORLD_TALENT_DB.peopleByRole['VFX Supervisor'] ?? []).toHaveLength(0);
    const top = Math.max(...pool['VFX Supervisor'].map((p) => p.careers.vfxSupervisor?.typicalSalary ?? 0));
    expect(top).toBeGreaterThan(300_000);
  });
});
