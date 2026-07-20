import { describe, it, expect, vi } from 'vitest';
import { rollPressTourMoments } from './pressTourMoments';
import type { Person, PersonPersonality, TalentAssignment } from '../types';

function person(id: string, name: string, fame: number, personality: Partial<PersonPersonality> = {}): Person {
  return {
    id,
    identity: { name, appearanceTags: [] },
    personality: {
      professionalism: 60, ambition: 50, loyalty: 50, ego: 40, temperament: 55, pressureHandling: 60, controversy: 20, adaptability: 55,
      ...personality,
    },
    reputation: { fame, prestige: 40, industryRespect: 50, reliability: 60, currentHeat: 40 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: { actor: { role: 'Actor', active: true, experience: 50, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 100_000, actingStyle: { characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50 } } },
  };
}

/** A fully-controlled RNG that yields the given sequence, then repeats its last value. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const proStar = person('ava', 'Ava Reyes', 90, { controversy: 5, professionalism: 90, pressureHandling: 90 });
const looseCannon = person('kip', 'Kip Danger', 90, { controversy: 95, professionalism: 20, pressureHandling: 15 });
const lead = (p: Person): TalentAssignment => ({ role: 'Lead Actor', person: p });

describe('rollPressTourMoments', () => {
  it('draws nothing and returns empty when no roster is set - the rng stream is untouched', () => {
    const rng = vi.fn(() => 0);
    const out = rollPressTourMoments([lead(proStar)], undefined, rng);
    expect(out).toEqual({ buzzDelta: 0, storyBeat: null, moments: [] });
    expect(rng).not.toHaveBeenCalled();
  });

  it('a quiet tour (high roll) produces no moment', () => {
    const out = rollPressTourMoments([lead(looseCannon)], ['kip'], seq([0.99]));
    expect(out.moments).toHaveLength(0);
    expect(out.buzzDelta).toBe(0);
    expect(out.storyBeat).toBeNull();
  });

  it('a loose cannon on a low roll fires a negative moment matching their worst liability', () => {
    // controversy 95 is the dominant liability, so a fired moment is a controversy one.
    const out = rollPressTourMoments([lead(looseCannon)], ['kip'], seq([0.01, 0]));
    expect(out.moments).toHaveLength(1);
    expect(out.moments[0].templateId).toMatch(/^controversy-/);
    expect(out.moments[0].buzzDelta).toBeLessThan(0);
    expect(out.buzzDelta).toBe(out.moments[0].buzzDelta);
    // Name is substituted into both headline and story.
    expect(out.moments[0].story).toContain('Kip Danger');
    expect(out.moments[0].headline).not.toContain('{name}');
    expect(out.storyBeat).toBe(out.moments[0].story);
  });

  it('a famous, media-safe star can throw off a positive breakout (roll lands in the positive band)', () => {
    // negativeChance is ~0 for a safe star, so a small roll lands in the positive band.
    const out = rollPressTourMoments([lead(proStar)], ['ava'], seq([0.05, 0]));
    expect(out.moments).toHaveLength(1);
    expect(out.moments[0].buzzDelta).toBeGreaterThan(0);
    expect(out.moments[0].story).toContain('Ava Reyes');
  });

  it('sums buzz across multiple tourers and joins their story beats', () => {
    // Kip fires negative (0.01, pick 0); Ava stays quiet (0.99).
    const out = rollPressTourMoments([lead(looseCannon), lead(proStar)], ['kip', 'ava'], seq([0.01, 0, 0.99]));
    expect(out.moments).toHaveLength(1);
    expect(out.moments[0].personId).toBe('kip');
    expect(out.buzzDelta).toBe(out.moments[0].buzzDelta);
  });

  it('is deterministic given the same rng sequence', () => {
    const a = rollPressTourMoments([lead(looseCannon)], ['kip'], seq([0.01, 0.6]));
    const b = rollPressTourMoments([lead(looseCannon)], ['kip'], seq([0.01, 0.6]));
    expect(a).toEqual(b);
  });
});
