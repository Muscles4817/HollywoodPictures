// Creative Tension (SIMULATION_PHILOSOPHY.md Phase 5) - a clashing key creative
// pairing generates friction the cast-wide averages miss. These pin the shape:
// zero at neutral/agreeable, driven by shared ego, amplified by shared rigidity,
// dominated by the single worst pairing.
import { describe, it, expect } from 'vitest';
import { computeCreativeTension, pairFriction } from './creativeTension';
import type { Person, PersonPersonality, ProductionRole, TalentAssignment } from '../types';

function person(id: string, over: Partial<PersonPersonality> = {}): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50, ...over },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {},
  };
}

function cast(...people: Array<[ProductionRole, Partial<PersonPersonality>]>): TalentAssignment[] {
  return people.map(([role, over], i) => ({ role, person: person(`${role}-${i}`, over) }));
}

describe('pairFriction', () => {
  it('is zero when neither party is above-average ego (nobody is fighting for control)', () => {
    expect(pairFriction(person('a'), person('b'))).toBe(0);
    expect(pairFriction(person('a', { ego: 90, adaptability: 0 }), person('b', { ego: 50 }))).toBe(0);
  });

  it('needs BOTH parties strong-willed - a deferential counterpart defuses even a domineering one', () => {
    const domineering = person('a', { ego: 100, adaptability: 0 });
    const deferential = person('b', { ego: 40 });
    expect(pairFriction(domineering, deferential)).toBe(0);
  });

  it('rises with shared ego and is amplified by shared rigidity', () => {
    const flexiblePair = pairFriction(person('a', { ego: 90, adaptability: 100 }), person('b', { ego: 90, adaptability: 100 }));
    const rigidPair = pairFriction(person('a', { ego: 90, adaptability: 0 }), person('b', { ego: 90, adaptability: 0 }));
    expect(flexiblePair).toBeGreaterThan(0);
    expect(rigidPair).toBeGreaterThan(flexiblePair);
  });
});

describe('computeCreativeTension', () => {
  it('is zero for an agreeable, average collaboration', () => {
    expect(computeCreativeTension(cast(['Director', {}], ['Lead Actor', {}]))).toBe(0);
  });

  it('is zero without a director or without principal cast to clash with', () => {
    expect(computeCreativeTension(cast(['Lead Actor', { ego: 95, adaptability: 0 }]))).toBe(0);
    expect(computeCreativeTension(cast(['Director', { ego: 95, adaptability: 0 }], ['Editor', { ego: 95, adaptability: 0 }]))).toBe(0);
  });

  it('is high when a strong-willed, inflexible director and lead are set against each other', () => {
    const clashing = cast(['Director', { ego: 95, adaptability: 5 }], ['Lead Actor', { ego: 95, adaptability: 5 }]);
    expect(computeCreativeTension(clashing)).toBeGreaterThan(70);
  });

  it('is driven by the single worst pairing, not an average (one war on set defines the shoot)', () => {
    const oneClash = cast(
      ['Director', { ego: 95, adaptability: 5 }],
      ['Lead Actor', { ego: 95, adaptability: 5 }], // at war with the director
      ['Supporting Actor', {}], // perfectly agreeable
      ['Supporting Actor', {}],
    );
    expect(computeCreativeTension(oneClash)).toBeGreaterThan(70);
  });
});
