// Age/gender generation - no dedicated test coverage existed for this file
// before now. PersonIdentity.gender/dateOfBirth are optional specifically
// because the handcrafted, real-named roster (data/handcraftedTalents.ts)
// deliberately leaves them unset rather than fabricate data for real people
// (see PersonIdentity's own comment, types/index.ts) - only the procedural
// generator here should ever populate them.
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

describe('generateTalentPool - handcrafted (real-named) talent is left untouched', () => {
  it('never assigns gender/dateOfBirth to the handcrafted Actor roster, only to procedurally generated ones', () => {
    const pool = generateTalentPool(createRng(4));
    const handcraftedIds = new Set(HANDCRAFTED_TALENTS_BY_ROLE.Actor?.map((p) => p.id) ?? []);
    expect(handcraftedIds.size).toBeGreaterThan(0); // sanity - there really is a handcrafted roster to check
    for (const person of pool.Actor) {
      if (handcraftedIds.has(person.id)) {
        expect(person.identity.gender).toBeUndefined();
        expect(person.identity.dateOfBirth).toBeUndefined();
      } else {
        expect(person.identity.gender).toBeDefined();
        expect(person.identity.dateOfBirth).toBeDefined();
      }
    }
  });
});
