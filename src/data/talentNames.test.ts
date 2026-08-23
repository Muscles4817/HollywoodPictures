// The generated-only roster is the shipped default (data/talentDatabases.ts),
// so name collisions are a visible quality problem rather than a theoretical
// one: two different actors called the same thing in the same Talent Database
// reads as a bug to a player.
//
// These tests measure the collision rate at the volumes the game actually
// draws, rather than trusting the combination arithmetic - the banks and the
// structural variation in engine/talentGenerator.ts can both drift, and only a
// measurement catches it.
import { describe, it, expect } from 'vitest';
import { TALENT_FIRST_NAMES, TALENT_LAST_NAMES } from './talentNames';
import { generateTalentCandidates, generateTalentPool } from '../engine/talentGenerator';
import { GENERATED_TALENT_DB } from './talentDatabases';
import { createRng } from '../engine/random';

describe('the name banks', () => {
  it('carry no duplicates within either bank', () => {
    expect(new Set(TALENT_FIRST_NAMES).size).toBe(TALENT_FIRST_NAMES.length);
    expect(new Set(TALENT_LAST_NAMES).size).toBe(TALENT_LAST_NAMES.length);
  });

  it('are large enough that plain first+last already clears half a million combinations', () => {
    expect(TALENT_FIRST_NAMES.length * TALENT_LAST_NAMES.length).toBeGreaterThan(500_000);
  });

  it('contains no empty or untrimmed entries', () => {
    for (const name of [...TALENT_FIRST_NAMES, ...TALENT_LAST_NAMES]) {
      expect(name).toBe(name.trim());
      expect(name.length).toBeGreaterThan(1);
    }
  });
});

describe('generated names at real draw volumes', () => {
  it('collides on well under 1% of a full generated industry', () => {
    // The whole default pool - every profession, the volume a real playthrough
    // sees in its Talent Database.
    const pool = generateTalentPool(createRng(101), GENERATED_TALENT_DB);
    const people = Object.values(pool).flat();
    const names = people.map((p) => p.identity.name);
    const collisions = names.length - new Set(names).size;

    expect(people.length).toBeGreaterThan(800); // sanity: there is a real industry here
    expect(collisions / names.length, `${collisions} collisions in ${names.length} people`)
      .toBeLessThan(0.01);
  });

  it('stays under 1% even at three times that volume', () => {
    // Headroom: pool sizes are a tuning knob, so the name space has to survive
    // being asked for considerably more people than it is asked for today.
    const names = generateTalentCandidates('Actor', createRng(202), 3000).map((p) => p.identity.name);
    const collisions = names.length - new Set(names).size;
    expect(collisions / names.length, `${collisions} collisions in ${names.length} draws`)
      .toBeLessThan(0.01);
  });

  it('varies structurally, not just lexically', () => {
    const names = generateTalentCandidates('Director', createRng(303), 600).map((p) => p.identity.name);
    // A middle initial on roughly a fifth, a double-barrelled surname on
    // roughly one in twenty. Loose bounds - this pins that the devices are
    // wired at all and are not firing on everybody.
    const withInitial = names.filter((n) => / [A-Z]\. /.test(n)).length;
    const hyphenated = names.filter((n) => n.includes('-')).length;
    expect(withInitial / names.length).toBeGreaterThan(0.1);
    expect(withInitial / names.length).toBeLessThan(0.35);
    expect(hyphenated / names.length).toBeGreaterThan(0.01);
    expect(hyphenated / names.length).toBeLessThan(0.12);
  });

  it('never produces a surname hyphenated with itself', () => {
    const names = generateTalentCandidates('Actor', createRng(404), 1500).map((p) => p.identity.name);
    for (const name of names.filter((n) => n.includes('-'))) {
      const [left, right] = name.split('-');
      expect(left.split(' ').pop()).not.toBe(right);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateTalentCandidates('Actor', createRng(505), 50).map((p) => p.identity.name);
    const b = generateTalentCandidates('Actor', createRng(505), 50).map((p) => p.identity.name);
    expect(a).toEqual(b);
  });
});
