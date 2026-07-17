// Age/gender generation - no dedicated test coverage existed for this file
// before now. The handcrafted, real-named roster (data/handcraftedTalents.ts)
// carries real, hand-entered gender/dateOfBirth for every person now (not
// fabricated - see that file's own entries) - generateTalentPool must never
// overwrite or regenerate those, only populate them for the procedurally
// generated pool sitting alongside the handcrafted one.
import { describe, it, expect } from 'vitest';
import { generateTalentCandidates, generateTalentPool } from './talentGenerator';
import { getPersonAge } from '../types';
import { createRng } from './random';
import { HANDCRAFTED_TALENTS_BY_ROLE } from '../data/handcraftedTalents';

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

describe('generateTalentPool - every person, handcrafted and generated, carries gender/dateOfBirth', () => {
  it('every Actor in the pool - handcrafted or generated - has both fields set', () => {
    const pool = generateTalentPool(createRng(4));
    expect(pool.Actor.length).toBeGreaterThan(0);
    for (const person of pool.Actor) {
      expect(person.identity.gender).toBeDefined();
      expect(person.identity.dateOfBirth).toBeDefined();
    }
  });

  it("never overwrites the handcrafted roster's own hand-entered gender/dateOfBirth", () => {
    const handcrafted = HANDCRAFTED_TALENTS_BY_ROLE.Actor ?? [];
    expect(handcrafted.length).toBeGreaterThan(0); // sanity - there really is a handcrafted roster to check
    const pool = generateTalentPool(createRng(5));
    const byId = new Map(pool.Actor.map((p) => [p.id, p]));
    for (const original of handcrafted) {
      const inPool = byId.get(original.id);
      expect(inPool).toBeDefined();
      expect(inPool!.identity.gender).toBe(original.identity.gender);
      expect(inPool!.identity.dateOfBirth).toEqual(original.identity.dateOfBirth);
    }
  });
});
