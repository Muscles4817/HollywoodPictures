// Age/gender generation. A talent database (data/talentDatabases.ts) carries
// hand-entered gender/dateOfBirth for every person it supplies -
// generateTalentPool must never overwrite or regenerate those, only populate
// them for the generated pool sitting alongside the seeded one.
//
// These pass REAL_WORLD_TALENT_DB explicitly. The default pool is generated-only,
// so a test that wants to check seeded people survive pooling has to supply the
// roster it expects to find.
import { describe, it, expect } from 'vitest';
import { generateTalentCandidates, generateTalentPool } from './talentGenerator';
import { getPersonAge } from '../types';
import { createRng } from './random';
import { REAL_WORLD_TALENT_DB } from '../data/talentDatabases';

describe('generateTalentCandidates - gender/dateOfBirth', () => {
  it('gives every generated candidate a gender and a dateOfBirth', () => {
    const candidates = generateTalentCandidates('Actor', createRng(1), 30);
    for (const person of candidates) {
      expect(person.identity.gender).toBeDefined();
      expect(['Male', 'Female', 'NonBinary']).toContain(person.identity.gender);
      expect(person.identity.dateOfBirth).toBeDefined();
    }
  });

  it('derives a plausible working-age adult from the generated dateOfBirth', () => {
    const candidates = generateTalentCandidates('Director', createRng(2), 30);
    for (const person of candidates) {
      const age = getPersonAge(person.identity.dateOfBirth, { year: 1, month: 1, day: 1 });
      expect(age).not.toBeUndefined();
      expect(age!).toBeGreaterThanOrEqual(18);
      expect(age!).toBeLessThanOrEqual(90);
    }
  });

  it('produces more than one distinct gender across a large sample - not silently collapsing to one value', () => {
    const candidates = generateTalentCandidates('Actor', createRng(3), 60);
    const genders = new Set(candidates.map((p) => p.identity.gender));
    expect(genders.size).toBeGreaterThan(1);
  });
});

describe('generateTalentPool - every person, seeded and generated, carries gender/dateOfBirth', () => {
  it('every Actor in the pool - seeded or generated - has both fields set', () => {
    const pool = generateTalentPool(createRng(4), REAL_WORLD_TALENT_DB);
    expect(pool.Actor.length).toBeGreaterThan(0);
    for (const person of pool.Actor) {
      expect(person.identity.gender).toBeDefined();
      expect(person.identity.dateOfBirth).toBeDefined();
    }
  });

  it("never overwrites a database's own hand-entered gender/dateOfBirth", () => {
    const seeded = REAL_WORLD_TALENT_DB.peopleByRole.Actor ?? [];
    expect(seeded.length).toBeGreaterThan(0); // sanity - there really is a roster to check
    const pool = generateTalentPool(createRng(5), REAL_WORLD_TALENT_DB);
    const byId = new Map(pool.Actor.map((p) => [p.id, p]));
    for (const original of seeded) {
      const inPool = byId.get(original.id);
      expect(inPool).toBeDefined();
      expect(inPool!.identity.gender).toBe(original.identity.gender);
      expect(inPool!.identity.dateOfBirth).toEqual(original.identity.dateOfBirth);
    }
  });

  it('gives every person both fields in the generated-only default pool too', () => {
    const pool = generateTalentPool(createRng(6));
    expect(pool.Actor.length).toBeGreaterThan(0);
    for (const person of pool.Actor) {
      expect(person.identity.gender).toBeDefined();
      expect(person.identity.dateOfBirth).toBeDefined();
    }
  });
});
