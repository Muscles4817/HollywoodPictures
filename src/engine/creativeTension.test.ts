// Creative Tension (SIMULATION_PHILOSOPHY.md Phase 5) - a clashing key creative
// pairing generates friction the cast-wide averages miss. These pin the shape:
// zero at neutral/agreeable, driven by shared ego, amplified by shared rigidity,
// dominated by the single worst pairing.
import { describe, it, expect } from 'vitest';
import { computeCreativeTension, computePairChemistry, craftPairs, pairChemistry, pairFriction, performancePairs, topCreativeClash } from './creativeTension';
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

describe('pairChemistry', () => {
  it('is zero for an average pair - neither clashing nor exceptionally easy', () => {
    expect(pairChemistry(person('a'), person('b'))).toBe(0);
  });

  it('is the negative of pairFriction for a clashing pair (the friction pole is unchanged)', () => {
    const a = person('a', { ego: 95, adaptability: 5 });
    const b = person('b', { ego: 95, adaptability: 5 });
    expect(pairChemistry(a, b)).toBeCloseTo(-pairFriction(a, b));
    expect(pairChemistry(a, b)).toBeLessThan(0);
  });

  it('is positive when both parties are easy to collaborate with (high adaptability + professionalism)', () => {
    const easy = pairChemistry(
      person('a', { adaptability: 100, professionalism: 100 }),
      person('b', { adaptability: 100, professionalism: 100 }),
    );
    expect(easy).toBeGreaterThan(0);
  });

  it('is gated on the worse party - one difficult collaborator kills the chemistry', () => {
    const easy = person('a', { adaptability: 100, professionalism: 100 });
    const difficult = person('b', { adaptability: 20, professionalism: 20 });
    expect(pairChemistry(easy, difficult)).toBe(0);
  });

  it('never reads a clashing pair as chemistry (the poles partition)', () => {
    // Two high egos: this is a clash, so it must be friction, never chemistry -
    // even though they are also adaptable.
    const clashy = pairChemistry(
      person('a', { ego: 90, adaptability: 100, professionalism: 100 }),
      person('b', { ego: 90, adaptability: 100, professionalism: 100 }),
    );
    expect(clashy).toBeLessThan(0);
  });
});

describe('computePairChemistry', () => {
  it('is zero for an average collaboration', () => {
    expect(computePairChemistry(cast(['Director', {}], ['Lead Actor', {}]))).toBe(0);
  });

  it('is zero without a director or without principal cast', () => {
    expect(computePairChemistry(cast(['Lead Actor', { adaptability: 100, professionalism: 100 }]))).toBe(0);
    expect(computePairChemistry(cast(['Director', { adaptability: 100, professionalism: 100 }], ['Editor', { adaptability: 100, professionalism: 100 }]))).toBe(0);
  });

  it('is high when an easy director and lead click', () => {
    const clicking = cast(['Director', { adaptability: 100, professionalism: 100 }], ['Lead Actor', { adaptability: 100, professionalism: 100 }]);
    expect(computePairChemistry(clicking)).toBeGreaterThan(70);
  });

  it('is driven by the single best pairing, not an average (one standout partnership defines the shoot)', () => {
    const oneClicks = cast(
      ['Director', { adaptability: 100, professionalism: 100 }],
      ['Lead Actor', { adaptability: 100, professionalism: 100 }], // clicks with the director
      ['Supporting Actor', {}], // merely average
      ['Supporting Actor', {}],
    );
    expect(computePairChemistry(oneClicks)).toBeGreaterThan(70);
  });

  // Phase 1: co-stars matter too, not just the director.
  it('is high when two co-stars click, even with an unremarkable director', () => {
    const leadsSpark = cast(
      ['Director', {}], // average - contributes no chemistry
      ['Lead Actor', { adaptability: 100, professionalism: 100 }],
      ['Lead Actor', { adaptability: 100, professionalism: 100 }],
    );
    expect(computePairChemistry(leadsSpark)).toBeGreaterThan(70);
  });

  it('reads a lead<->supporting pairing, not only lead<->lead', () => {
    const pairing = cast(
      ['Lead Actor', { adaptability: 100, professionalism: 100 }],
      ['Supporting Actor', { adaptability: 100, professionalism: 100 }],
    );
    expect(computePairChemistry(pairing)).toBeGreaterThan(70);
  });

  it('never reads a feuding co-star pair as chemistry (the poles still partition)', () => {
    const feuding = cast(
      ['Lead Actor', { ego: 95, adaptability: 5 }],
      ['Lead Actor', { ego: 95, adaptability: 5 }],
    );
    expect(computePairChemistry(feuding)).toBe(0);
  });
});

// Phase 3: the two chemistry dimensions read disjoint pairings.
describe('performancePairs / craftPairs (dimension split)', () => {
  const talent = cast(['Director', {}], ['Lead Actor', {}], ['Supporting Actor', {}], ['Editor', {}], ['Cinematographer', {}]);

  it('performancePairs are the cast pairings only (director<->principal and co-stars), never crew', () => {
    const roles = new Set(performancePairs(talent).flatMap(([a, b]) => [a.id, b.id]));
    expect(roles.has('Editor-3')).toBe(false);
    expect(roles.has('Cinematographer-4')).toBe(false);
    expect(roles.has('Lead Actor-1')).toBe(true);
  });

  it('craftPairs are the director against editor and cinematographer only, never actors', () => {
    const pairs = craftPairs(talent).map(([a, b]) => [a.id, b.id].sort().join('-')).sort();
    expect(pairs).toEqual(['Cinematographer-4-Director-0', 'Director-0-Editor-3']);
  });

  it('craftPairs is empty without a director', () => {
    expect(craftPairs(cast(['Editor', {}], ['Cinematographer', {}]))).toHaveLength(0);
  });
});

describe('topCreativeClash (legibility - names the clashing pair)', () => {
  it('is null when nobody clashes', () => {
    expect(topCreativeClash(cast(['Director', {}], ['Lead Actor', {}]))).toBeNull();
  });

  it('names the director and the specific clashing principal, matching the tension number', () => {
    const talent = cast(
      ['Director', { ego: 95, adaptability: 5 }],
      ['Lead Actor', {}], // agreeable
      ['Supporting Actor', { ego: 95, adaptability: 5 }], // the real clash
    );
    const clash = topCreativeClash(talent);
    expect(clash).not.toBeNull();
    expect(clash!.director.id).toBe('Director-0');
    expect(clash!.actor.id).toBe('Supporting Actor-2');
    expect(clash!.tension).toBe(computeCreativeTension(talent));
  });
});
