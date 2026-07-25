// Talent Pairing History (docs/DESIGN_REVIEW_talent_chemistry.md Phase 2) - the
// persistent talent<->talent pairing memory and the chemistry modulation read
// over it. Covers recording (idempotent, key-pairs-only, canonical order) and
// the read (strength, the personality-baseline blend, the empty-history no-op).
import { describe, it, expect } from 'vitest';
import {
  recordFilmPairings,
  recordPlayerFilmPairings,
  pairHistory,
  effectivePairChemistry,
  computeEffectivePairChemistry,
} from './pairHistory';
import { computePairChemistry, pairChemistry } from './creativeTension';
import type { Film, PersonPersonality, Person, ProductionRole, TalentAssignment, TalentPairing } from '../types';

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
  } as unknown as Person;
}

function assignment(id: string, role: ProductionRole, over: Partial<PersonPersonality> = {}): TalentAssignment {
  return { role, person: person(id, over) };
}

function filmFixture(opts: { id: string; talent: TalentAssignment[]; criticScore: number; audienceScore: number; stars?: number }): Film {
  return {
    id: opts.id,
    talent: opts.talent,
    results: {
      criticScore: opts.criticScore,
      audienceScore: opts.audienceScore,
      ...(opts.stars !== undefined
        ? { productionExecution: { stars: opts.stars, rating: 'solid', headline: '', detail: '', causes: [], mitigation: [], modifiers: { performanceCapture: 0, postExecution: 0, scriptExecution: 0, coverageRatio: 1, overall: 0 } } }
        : {}),
    },
  } as unknown as Film;
}

/** A pairing record between two people, defaulting to a neutral outcome. */
function pairing(personA: string, personB: string, over: Partial<TalentPairing> = {}): TalentPairing {
  return { personA, personB, filmId: 'f1', day: 100, reception: 50, shootSmoothness: 3, ...over };
}

describe('recordFilmPairings', () => {
  it('records every key pairing - director<->principal and co-star<->co-star', () => {
    const film = filmFixture({
      id: 'f1',
      talent: [assignment('dir', 'Director'), assignment('lead1', 'Lead Actor'), assignment('lead2', 'Lead Actor')],
      criticScore: 60,
      audienceScore: 60,
    });
    const recorded = recordFilmPairings([], film, 100);
    // dir-lead1, dir-lead2, lead1-lead2
    expect(recorded).toHaveLength(3);
    const keys = recorded.map((p) => `${p.personA}-${p.personB}`).sort();
    expect(keys).toEqual(['dir-lead1', 'dir-lead2', 'lead1-lead2']);
  });

  it('stores the pair in canonical id order regardless of cast order', () => {
    const film = filmFixture({ id: 'f1', talent: [assignment('zeb', 'Lead Actor'), assignment('amy', 'Lead Actor')], criticScore: 50, audienceScore: 50 });
    const [rec] = recordFilmPairings([], film, 100);
    expect(rec.personA).toBe('amy'); // lower id first
    expect(rec.personB).toBe('zeb');
  });

  it('is idempotent - re-recording the same film adds nothing', () => {
    const film = filmFixture({ id: 'f1', talent: [assignment('dir', 'Director'), assignment('lead1', 'Lead Actor')], criticScore: 70, audienceScore: 70 });
    const once = recordFilmPairings([], film, 100);
    const twice = recordFilmPairings(once, film, 140);
    expect(twice).toBe(once); // same reference - no additions
  });

  it('accumulates across different films for the same pair', () => {
    const cast: TalentAssignment[] = [assignment('dir', 'Director'), assignment('lead1', 'Lead Actor')];
    const f1 = filmFixture({ id: 'f1', talent: cast, criticScore: 70, audienceScore: 70 });
    const f2 = filmFixture({ id: 'f2', talent: cast, criticScore: 40, audienceScore: 40 });
    const recorded = recordPlayerFilmPairings([], [f1, f2], 100);
    expect(recorded.filter((p) => p.personA === 'dir' && p.personB === 'lead1')).toHaveLength(2);
  });
});

describe('pairHistory', () => {
  it('is null for two people who have never worked together', () => {
    expect(pairHistory([], 'a', 'b')).toBeNull();
    expect(pairHistory([pairing('a', 'b')], 'a', 'c')).toBeNull();
  });

  it('reads positive strength from a hit that shot smoothly', () => {
    const h = pairHistory([pairing('a', 'b', { reception: 90, shootSmoothness: 5 })], 'a', 'b');
    expect(h).not.toBeNull();
    expect(h!.films).toBe(1);
    expect(h!.strength).toBeGreaterThan(0);
  });

  it('reads negative strength from a flop that blew up', () => {
    const h = pairHistory([pairing('a', 'b', { reception: 10, shootSmoothness: 1 })], 'a', 'b');
    expect(h!.strength).toBeLessThan(0);
  });

  it('is order-independent - (a,b) and (b,a) read the same history', () => {
    const list = [pairing('a', 'b', { reception: 80, shootSmoothness: 4 })];
    expect(pairHistory(list, 'a', 'b')).toEqual(pairHistory(list, 'b', 'a'));
  });
});

describe('effectivePairChemistry', () => {
  const neutralA = person('a');
  const neutralB = person('b');

  it('equals the personality baseline when the pair has no shared history', () => {
    expect(effectivePairChemistry(neutralA, neutralB, [])).toBe(pairChemistry(neutralA, neutralB));
  });

  it('lifts a neutral pairing above baseline once they have a good track record', () => {
    const good = [pairing('a', 'b', { filmId: 'f1', reception: 95, shootSmoothness: 5 })];
    expect(effectivePairChemistry(neutralA, neutralB, good)).toBeGreaterThan(pairChemistry(neutralA, neutralB));
  });

  it('drags a pairing below baseline after their films kept going wrong', () => {
    const bad = [pairing('a', 'b', { filmId: 'f1', reception: 5, shootSmoothness: 1 })];
    expect(effectivePairChemistry(neutralA, neutralB, bad)).toBeLessThan(pairChemistry(neutralA, neutralB));
  });

  it('weighs a longer shared history more heavily (converges on the track record)', () => {
    const oneGood = [pairing('a', 'b', { filmId: 'f1', reception: 95, shootSmoothness: 5 })];
    const threeGood = [
      pairing('a', 'b', { filmId: 'f1', reception: 95, shootSmoothness: 5 }),
      pairing('a', 'b', { filmId: 'f2', reception: 95, shootSmoothness: 5 }),
      pairing('a', 'b', { filmId: 'f3', reception: 95, shootSmoothness: 5 }),
    ];
    expect(effectivePairChemistry(neutralA, neutralB, threeGood)).toBeGreaterThan(effectivePairChemistry(neutralA, neutralB, oneGood));
  });
});

describe('computeEffectivePairChemistry', () => {
  const talent: TalentAssignment[] = [assignment('dir', 'Director'), assignment('lead1', 'Lead Actor')];

  it('reduces exactly to the personality-only read when there is no history (rivals, first-time casts, pre-history saves)', () => {
    expect(computeEffectivePairChemistry(talent, [])).toBe(computePairChemistry(talent));
  });

  it('reads higher than personality alone for a proven duo', () => {
    const proven = recordPlayerFilmPairings(
      [],
      [
        filmFixture({ id: 'f1', talent, criticScore: 95, audienceScore: 95, stars: 5 }),
        filmFixture({ id: 'f2', talent, criticScore: 90, audienceScore: 90, stars: 5 }),
      ],
      200,
    );
    expect(computeEffectivePairChemistry(talent, proven)).toBeGreaterThan(computePairChemistry(talent));
  });
});
