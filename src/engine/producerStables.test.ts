import { describe, it, expect } from 'vitest';
import {
  describeStable,
  describeStableBond,
  producerStable,
  seedProducerStables,
  stableEntryFor,
  stableFeeMultiplier,
  stableStrength,
} from './producerStables';
import { producerCandidatePick } from './staffingBriefs';
import { buildStateWithReadyDraft } from '../state/testFixtures';
import { asPlayerDraft, findProject } from './project';
import { getTypicalSalaryForRole } from './person';
import { createRng } from './random';
import { generateProducerPool } from './talentGenerator';
import { DELEGABLE_CREW_ROLES, STABLE_FEE_FLOOR, STABLE_SATURATION_FILMS } from '../data/producers';
import type { Film, FilmDraft, Person, ProducerStableEntry, ProductionRole, TalentProfession } from '../types';

const ROLE: ProductionRole = 'Cinematographer';

function makeProducer(stable?: ProducerStableEntry[], skill = 70): Person {
  return {
    id: 'producer-1',
    identity: { name: 'Marcus Reed', appearanceTags: [] },
    personality: { professionalism: 60, ambition: 55, loyalty: 50, ego: 30, temperament: 50, pressureHandling: 55, controversy: 18, adaptability: 55 },
    reputation: { fame: 40, prestige: 40, industryRespect: 60, reliability: 90, currentHeat: 40 },
    primaryRole: 'Producer',
    careers: { producer: { specialty: 'Line', skill, genreAffinity: [], typicalSalary: 300_000, stable } },
    availability: { commitments: [] },
    traits: [],
  };
}

/** A released film carrying `producerId` and a crew head in ROLE. */
function releasedFilm(id: string, producerId: string | null, head: Person): Film {
  return {
    id,
    title: id,
    talent: [{ role: ROLE, person: head }],
    attachedProducerIds: producerId ? [producerId] : [],
  } as unknown as Film;
}

function fixture(seed = 7) {
  const state = buildStateWithReadyDraft(seed);
  const ready = asPlayerDraft(findProject(state.projects, state.focusedProjectId))!;
  const draft: FilmDraft = { ...ready, photography: null, talent: ready.talent.filter((a) => a.role !== ROLE) };
  return { draft, talentPool: state.talentPool as Record<TalentProfession, Person[]>, today: state.totalDays };
}

describe('producerStable - half seeded, half derived', () => {
  it('reads the book they arrived with', () => {
    const producer = makeProducer([{ personId: 'dp-1', role: ROLE, films: 3 }]);
    expect(producerStable(producer, [])).toEqual([{ personId: 'dp-1', role: ROLE, films: 3 }]);
  });

  it('is empty for a producer who arrived with nobody', () => {
    expect(producerStable(makeProducer(), [])).toEqual([]);
  });

  it('grows from the player\'s released films, without storing anything', () => {
    const { talentPool } = fixture();
    const head = talentPool.Cinematographer[0];
    const producer = makeProducer();
    const films = [releasedFilm('f1', producer.id, head), releasedFilm('f2', producer.id, head)];
    expect(producerStable(producer, films)).toEqual([{ personId: head.id, role: ROLE, films: 2 }]);
    // Nothing was written to the producer - the record IS the released films.
    expect(producer.careers.producer!.stable).toBeUndefined();
  });

  it('adds seeded and derived history together for the same person', () => {
    const { talentPool } = fixture();
    const head = talentPool.Cinematographer[0];
    const producer = makeProducer([{ personId: head.id, role: ROLE, films: 2 }]);
    expect(producerStable(producer, [releasedFilm('f1', producer.id, head)])[0].films).toBe(3);
  });

  it('ignores films this producer was not attached to', () => {
    const { talentPool } = fixture();
    const head = talentPool.Cinematographer[0];
    const producer = makeProducer();
    expect(producerStable(producer, [releasedFilm('f1', 'someone-else', head)])).toEqual([]);
    expect(producerStable(producer, [releasedFilm('f1', null, head)])).toEqual([]);
  });

  it('only remembers the crafts a producer can actually be handed', () => {
    const { talentPool } = fixture();
    const star = talentPool.Actor[0];
    const producer = makeProducer();
    const film = { ...releasedFilm('f1', producer.id, star), talent: [{ role: 'Lead Actor' as const, person: star }] } as Film;
    expect(producerStable(producer, [film])).toEqual([]);
  });

  it('is re-derivable - reading it twice never double-counts', () => {
    const { talentPool } = fixture();
    const head = talentPool.Cinematographer[0];
    const producer = makeProducer();
    const films = [releasedFilm('f1', producer.id, head)];
    expect(producerStable(producer, films)).toEqual(producerStable(producer, films));
  });

  it('sorts the strongest bonds first', () => {
    const producer = makeProducer([
      { personId: 'a', role: ROLE, films: 1 },
      { personId: 'b', role: ROLE, films: 5 },
    ]);
    expect(producerStable(producer, []).map((e) => e.personId)).toEqual(['b', 'a']);
  });
});

describe('the favour rate', () => {
  it('costs a stranger nothing and a saturated regular the full discount', () => {
    expect(stableFeeMultiplier(null)).toBe(1);
    expect(stableFeeMultiplier({ personId: 'a', role: ROLE, films: STABLE_SATURATION_FILMS })).toBeCloseTo(STABLE_FEE_FLOOR);
  });

  it('deepens with each shared picture, then saturates', () => {
    const at = (films: number) => stableFeeMultiplier({ personId: 'a', role: ROLE, films });
    expect(at(1)).toBeLessThan(1);
    expect(at(2)).toBeLessThan(at(1));
    expect(at(STABLE_SATURATION_FILMS * 3)).toBe(at(STABLE_SATURATION_FILMS));
  });

  it('saturates its strength at the tuned film count', () => {
    expect(stableStrength(0)).toBe(0);
    expect(stableStrength(STABLE_SATURATION_FILMS)).toBe(1);
    expect(stableStrength(STABLE_SATURATION_FILMS + 10)).toBe(1);
  });
});

describe('what a book does to the pick', () => {
  it('brings a regular back far more often than a stranger', () => {
    const { draft, talentPool, today } = fixture();
    const regular = talentPool.Cinematographer.find((p) => getTypicalSalaryForRole(p, ROLE) < 3_000_000)!;
    const withBook = makeProducer([{ personId: regular.id, role: ROLE, films: STABLE_SATURATION_FILMS }]);
    const stranger = makeProducer();

    const rate = (producer: Person) => {
      let hits = 0;
      for (let seed = 0; seed < 60; seed++) {
        const pick = producerCandidatePick(producer, ROLE, 8_000_000, draft, talentPool, today, createRng(seed));
        if (pick?.personId === regular.id) hits++;
      }
      return hits;
    };
    expect(rate(withBook)).toBeGreaterThan(rate(stranger));
  });

  it('signs a regular at the favour rate, not their standing quote', () => {
    const { draft, talentPool, today } = fixture();
    const regular = talentPool.Cinematographer.find((p) => getTypicalSalaryForRole(p, ROLE) < 3_000_000)!;
    const producer = makeProducer([{ personId: regular.id, role: ROLE, films: STABLE_SATURATION_FILMS }]);
    for (let seed = 0; seed < 120; seed++) {
      const pick = producerCandidatePick(producer, ROLE, 8_000_000, draft, talentPool, today, createRng(seed));
      if (pick?.personId !== regular.id) continue;
      // The favour rate reached the fee: what they sign for is at most what the
      // discount alone would allow, and well under their standing quote. (That
      // it stacks with the producer's own skill discount is why this is an
      // inequality rather than an equality.)
      const standing = getTypicalSalaryForRole(regular, ROLE);
      expect(pick.fee).toBeLessThanOrEqual(Math.round(standing * STABLE_FEE_FLOOR));
      expect(pick.fee).toBeLessThan(standing);
      return;
    }
    throw new Error('the regular was never picked - the preference bonus is not working');
  });

  it('one shared picture is a thumb on the scale, not a promise', () => {
    // A weak bond must NOT be enough to drag someone out of a deep field - if
    // it were, a producer's first hire would lock in every hire after it.
    const { draft, talentPool, today } = fixture();
    const regular = talentPool.Cinematographer.find((p) => getTypicalSalaryForRole(p, ROLE) < 3_000_000)!;
    const rate = (films: number) => {
      const producer = makeProducer([{ personId: regular.id, role: ROLE, films }]);
      let hits = 0;
      for (let seed = 0; seed < 60; seed++) {
        const pick = producerCandidatePick(producer, ROLE, 8_000_000, draft, talentPool, today, createRng(seed));
        if (pick?.personId === regular.id) hits++;
      }
      return hits;
    };
    expect(rate(1)).toBeLessThan(rate(STABLE_SATURATION_FILMS));
  });

  it('names the bond in the pitch - the point is that the pick reads as a choice', () => {
    const { draft, talentPool, today } = fixture();
    const regular = talentPool.Cinematographer.find((p) => getTypicalSalaryForRole(p, ROLE) < 3_000_000)!;
    const producer = makeProducer([{ personId: regular.id, role: ROLE, films: STABLE_SATURATION_FILMS }]);
    for (let seed = 0; seed < 60; seed++) {
      const pick = producerCandidatePick(producer, ROLE, 8_000_000, draft, talentPool, today, createRng(seed));
      if (pick?.personId === regular.id) {
        expect(pick.pitch[0]).toMatch(/regular/i);
        return;
      }
    }
    throw new Error('the regular was never picked - the preference bonus is not working');
  });

  it('reads the book from released films too, not just the seeded one', () => {
    const { draft, talentPool, today } = fixture();
    const regular = talentPool.Cinematographer.find((p) => getTypicalSalaryForRole(p, ROLE) < 3_000_000)!;
    const producer = makeProducer();
    const history = Array.from({ length: STABLE_SATURATION_FILMS }, (_, i) => releasedFilm(`f${i}`, producer.id, regular));
    const rate = (films: Film[]) => {
      let hits = 0;
      for (let seed = 0; seed < 60; seed++) {
        const pick = producerCandidatePick(producer, ROLE, 8_000_000, draft, talentPool, today, createRng(seed), films);
        if (pick?.personId === regular.id) hits++;
      }
      return hits;
    };
    expect(rate(history)).toBeGreaterThan(rate([]));
  });
});

describe('describeStableBond / describeStable', () => {
  it('says nothing about a stranger', () => {
    expect(describeStableBond(null)).toBeNull();
  });

  it('escalates from one picture to a regular', () => {
    const at = (films: number) => describeStableBond({ personId: 'a', role: ROLE, films })!;
    expect(at(1)).toMatch(/once/);
    expect(at(2)).toMatch(/Second/);
    expect(at(STABLE_SATURATION_FILMS)).toMatch(/regular/i);
  });

  it('names the people a producer brings with them', () => {
    const { talentPool } = fixture();
    const head = talentPool.Cinematographer[0];
    const producer = makeProducer([{ personId: head.id, role: ROLE, films: 3 }]);
    expect(describeStable(producer, [], talentPool)).toContain(head.identity.name);
  });

  it('returns nothing for a producer with an empty book', () => {
    const { talentPool } = fixture();
    expect(describeStable(makeProducer(), [], talentPool)).toBeNull();
  });
});

describe('seeding', () => {
  it('gives generated producers a book of delegable crew heads who really exist', () => {
    const { talentPool } = fixture();
    const seeded = seedProducerStables(generateProducerPool(createRng(3), 20), talentPool, createRng(4));
    const withBooks = seeded.filter((p) => (p.careers.producer?.stable ?? []).length > 0);
    expect(withBooks.length).toBeGreaterThan(0);

    for (const producer of withBooks) {
      for (const entry of producer.careers.producer!.stable!) {
        expect(DELEGABLE_CREW_ROLES).toContain(entry.role);
        expect(entry.films).toBeGreaterThan(0);
        const pool = talentPool[entry.role as TalentProfession];
        expect(pool.some((p) => p.id === entry.personId)).toBe(true);
      }
    }
  });

  it('never puts the same person in one book twice', () => {
    const { talentPool } = fixture();
    const seeded = seedProducerStables(generateProducerPool(createRng(5), 20), talentPool, createRng(6));
    for (const producer of seeded) {
      const ids = (producer.careers.producer?.stable ?? []).map((e) => e.personId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('gives a well-paid producer a bigger book than a junior', () => {
    const { talentPool } = fixture();
    const seeded = seedProducerStables(generateProducerPool(createRng(7), 40), talentPool, createRng(8));
    const bookSize = (p: Person) => (p.careers.producer?.stable ?? []).length;
    const byFee = [...seeded].sort((a, b) => a.careers.producer!.typicalSalary - b.careers.producer!.typicalSalary);
    const juniorAverage = byFee.slice(0, 10).reduce((s, p) => s + bookSize(p), 0) / 10;
    const seniorAverage = byFee.slice(-10).reduce((s, p) => s + bookSize(p), 0) / 10;
    expect(seniorAverage).toBeGreaterThan(juniorAverage);
  });

  it('is deterministic for a fixed rng', () => {
    const { talentPool } = fixture();
    const once = seedProducerStables(generateProducerPool(createRng(9), 10), talentPool, createRng(10));
    const twice = seedProducerStables(generateProducerPool(createRng(9), 10), talentPool, createRng(10));
    expect(once.map((p) => p.careers.producer?.stable)).toEqual(twice.map((p) => p.careers.producer?.stable));
  });

  it('leaves everything else about a producer untouched', () => {
    const { talentPool } = fixture();
    const before = generateProducerPool(createRng(11), 10);
    const after = seedProducerStables(before, talentPool, createRng(12));
    for (let i = 0; i < before.length; i++) {
      expect({ ...after[i], careers: undefined }).toEqual({ ...before[i], careers: undefined });
      const { stable, ...restAfter } = after[i].careers.producer!;
      expect(restAfter).toEqual(before[i].careers.producer);
      expect(stable === undefined || Array.isArray(stable)).toBe(true);
    }
  });
});

describe('stableEntryFor', () => {
  it('finds a person in the book only under the craft they are in it for', () => {
    const producer = makeProducer([{ personId: 'dp-1', role: ROLE, films: 2 }]);
    expect(stableEntryFor(producer, [], 'dp-1', ROLE)?.films).toBe(2);
    expect(stableEntryFor(producer, [], 'dp-1', 'Editor')).toBeNull();
    expect(stableEntryFor(producer, [], 'nobody', ROLE)).toBeNull();
  });
});
