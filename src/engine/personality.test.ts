// Unit coverage for the personality-archetype derivation (engine/personality.ts):
// the six formerly-flat axes now cohere into archetypes, derived by hash (never
// rng), with professionalism/ego carried through untouched. The opt-in
// personality.diagnostic.test.ts covers the pool-wide distribution; these lock
// the properties the rest of the system relies on.
import { describe, it, expect } from 'vitest';
import {
  buildPersonality,
  isFlatDefaultPersonality,
  resolveHandcraftedPersonality,
  type FixedTraits,
} from './personality';
import type { Person, PersonPersonality } from '../types';

const FLAT: PersonPersonality = {
  professionalism: 70,
  ego: 40,
  ambition: 50,
  loyalty: 50,
  temperament: 50,
  pressureHandling: 50,
  controversy: 20,
  adaptability: 50,
};

const baseFixed: FixedTraits = {
  professionalism: 70,
  ego: 40,
  fame: 60,
  prestige: 60,
  industryRespect: 70,
  currentHeat: 60,
  age: 40,
};

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

describe('buildPersonality', () => {
  it('is deterministic - same fixed stats + seed always give the same personality', () => {
    const a = buildPersonality(baseFixed, 'seed-x');
    const b = buildPersonality(baseFixed, 'seed-x');
    expect(a).toEqual(b);
  });

  it('carries professionalism and ego through untouched', () => {
    const p = buildPersonality({ ...baseFixed, professionalism: 83, ego: 27 }, 'seed-y');
    expect(p.professionalism).toBe(83);
    expect(p.ego).toBe(27);
  });

  it('keeps every derived axis in range and off the flat sentinel', () => {
    // Across many seeds, the six derived axes stay in [1,100] and don't all
    // collapse back to the old flat 50/50/50/50/20/50.
    let anyNonFlat = false;
    for (let i = 0; i < 200; i++) {
      const p = buildPersonality(baseFixed, `seed-${i}`);
      for (const v of [p.ambition, p.loyalty, p.temperament, p.pressureHandling, p.controversy, p.adaptability]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(100);
      }
      if (!isFlatDefaultPersonality(p)) anyNonFlat = true;
    }
    expect(anyNonFlat).toBe(true);
  });

  it('produces genuine variance across seeds - not one repeated profile', () => {
    const temperaments = new Set<number>();
    for (let i = 0; i < 100; i++) temperaments.add(buildPersonality(baseFixed, `v-${i}`).temperament);
    expect(temperaments.size).toBeGreaterThan(10);
  });
});

describe('archetype coherence with fixed stats', () => {
  it('high ego + high fame skews toward a volatile prima donna (lower temperament) vs a low-ego humble profile', () => {
    const N = 400;
    const diva = mean(
      Array.from({ length: N }, (_, i) =>
        buildPersonality({ ...baseFixed, ego: 92, fame: 92 }, `d-${i}`).temperament,
      ),
    );
    const humble = mean(
      Array.from({ length: N }, (_, i) =>
        buildPersonality({ ...baseFixed, ego: 12, fame: 60, industryRespect: 90 }, `h-${i}`).temperament,
      ),
    );
    // The prima donna is meaningfully more volatile (lower even-temper) on average.
    expect(diva).toBeLessThan(humble - 8);
  });

  it('young + not-yet-famous skews toward the hungry upstart (higher ambition, lower loyalty)', () => {
    const N = 400;
    const upstart = Array.from({ length: N }, (_, i) =>
      buildPersonality({ ...baseFixed, fame: 12, age: 24, industryRespect: 40 }, `u-${i}`),
    );
    const veteran = Array.from({ length: N }, (_, i) =>
      buildPersonality({ ...baseFixed, fame: 85, age: 64, industryRespect: 90, ego: 20 }, `w-${i}`),
    );
    expect(mean(upstart.map((p) => p.ambition))).toBeGreaterThan(mean(veteran.map((p) => p.ambition)) + 8);
    expect(mean(upstart.map((p) => p.loyalty))).toBeLessThan(mean(veteran.map((p) => p.loyalty)) - 8);
  });
});

describe('isFlatDefaultPersonality', () => {
  it('detects the flat sentinel regardless of professionalism/ego', () => {
    expect(isFlatDefaultPersonality(FLAT)).toBe(true);
    expect(isFlatDefaultPersonality({ ...FLAT, professionalism: 99, ego: 5 })).toBe(true);
  });

  it('is false once any of the six derived axes is authored away from the sentinel', () => {
    expect(isFlatDefaultPersonality({ ...FLAT, ambition: 80 })).toBe(false);
    expect(isFlatDefaultPersonality({ ...FLAT, controversy: 70 })).toBe(false);
  });
});

describe('resolveHandcraftedPersonality', () => {
  const person = (personality: PersonPersonality): Person => ({
    id: 'real-test-person',
    identity: { name: 'Test Person', appearanceTags: [], gender: 'Male', dateOfBirth: { year: -45, month: 1, day: 1 } },
    personality,
    reputation: { fame: 80, prestige: 80, industryRespect: 85, reliability: 85, currentHeat: 80 },
    primaryRole: 'Actor',
    careers: {},
    availability: { commitments: [] },
    traits: [],
  });

  it('an authored marquee override wins outright', () => {
    const override: PersonPersonality = { ...FLAT, ambition: 99, controversy: 88 };
    expect(resolveHandcraftedPersonality(person(FLAT), override)).toEqual(override);
  });

  it('a non-flat inline personality is left untouched', () => {
    const authored: PersonPersonality = { ...FLAT, temperament: 22, ego: 90 };
    expect(resolveHandcraftedPersonality(person(authored))).toEqual(authored);
  });

  it('a flat person is derived to a real, non-flat personality from their own stats', () => {
    const resolved = resolveHandcraftedPersonality(person(FLAT));
    expect(isFlatDefaultPersonality(resolved)).toBe(false);
    // professionalism/ego preserved from the flat entry; the six axes derived.
    expect(resolved.professionalism).toBe(FLAT.professionalism);
    expect(resolved.ego).toBe(FLAT.ego);
  });

  it('derivation is stable per person (same id → same result)', () => {
    expect(resolveHandcraftedPersonality(person(FLAT))).toEqual(resolveHandcraftedPersonality(person(FLAT)));
  });
});
