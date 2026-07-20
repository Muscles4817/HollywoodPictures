import { describe, it, expect } from 'vitest';
import type { Genre, Person, ProducerSpecialty, Studio } from '../types';
import {
  benchCapacity,
  benchCapacityForTier,
  canUnlockOffice,
  computeProducerEffects,
  getProducerCareer,
  isOfficeUnlocked,
  isProducer,
  NEUTRAL_PRODUCER_EFFECTS,
  nextOfficeTier,
  officeTier,
  officeUpgradeCost,
  producerHiringFee,
  producerPerFilmFee,
  producersByIds,
  totalAttachedPerFilmFees,
} from './producers';
import {
  EVENT_IMPACT_MULTIPLIER_FLOOR,
  OFFICE_UNLOCK_BRAND,
  OFFICE_UNLOCK_FILMS_RELEASED,
  PRODUCER_HIRING_FEE_MULTIPLE,
  PRODUCER_POOL_SIZE,
  PRODUCER_SALARY_RANGE,
  PRODUCER_SPECIALTIES,
  PRODUCTION_COST_MULTIPLIER_FLOOR,
} from '../data/producers';
import { GENRES } from '../data/genres';
import { generateProducerPool } from './talentGenerator';
import { createRng } from './random';

let idCounter = 0;
function makeProducer(opts: {
  specialty: ProducerSpecialty;
  skill: number;
  reliability?: number;
  genreAffinity?: Genre[];
  typicalSalary?: number;
}): Person {
  const reliability = opts.reliability ?? 100;
  return {
    id: `test-producer-${idCounter++}`,
    identity: { name: 'Test Producer', appearanceTags: [] },
    personality: { professionalism: reliability, ambition: 50, loyalty: 50, ego: 30, temperament: 50, pressureHandling: 50, controversy: 20, adaptability: 50 },
    reputation: { fame: 40, prestige: 40, industryRespect: reliability, reliability, currentHeat: 40 },
    primaryRole: 'Producer',
    careers: { producer: { specialty: opts.specialty, skill: opts.skill, genreAffinity: opts.genreAffinity ?? [], typicalSalary: opts.typicalSalary ?? 500_000 } },
    availability: { commitments: [] },
    traits: [],
  };
}

function studioWithOffice(office: Studio['productionOffice']): Studio {
  return { name: 'S', cash: 5_000_000, brand: 20, prestige: 20, assets: [], productionOffice: office };
}

describe('computeProducerEffects', () => {
  it('an empty attach set is exactly neutral', () => {
    expect(computeProducerEffects([], 'Action')).toEqual(NEUTRAL_PRODUCER_EFFECTS);
  });

  it('each specialty moves only its own field', () => {
    const line = computeProducerEffects([makeProducer({ specialty: 'Line', skill: 70 })], 'Drama');
    expect(line.productionCostMultiplier).toBeLessThan(1);
    expect(line.postProductionDelta).toBe(0);
    expect(line.marketingEfficiencyMultiplier).toBe(1);
    expect(line.eventNegativeImpactMultiplier).toBe(1);

    const creative = computeProducerEffects([makeProducer({ specialty: 'Creative', skill: 70 })], 'Drama');
    expect(creative.postProductionDelta).toBeGreaterThan(0);
    expect(creative.productionCostMultiplier).toBe(1);

    const exec = computeProducerEffects([makeProducer({ specialty: 'Executive', skill: 70 })], 'Drama');
    expect(exec.marketingEfficiencyMultiplier).toBeGreaterThan(1);
    expect(exec.flatBuzzDelta).toBeGreaterThan(0);

    const fixer = computeProducerEffects([makeProducer({ specialty: 'Fixer', skill: 70 })], 'Drama');
    expect(fixer.eventNegativeImpactMultiplier).toBeLessThan(1);
    expect(fixer.postProductionDelta).toBe(0);
  });

  it('higher skill produces a stronger effect', () => {
    const weak = computeProducerEffects([makeProducer({ specialty: 'Creative', skill: 30 })], 'Drama');
    const strong = computeProducerEffects([makeProducer({ specialty: 'Creative', skill: 90 })], 'Drama');
    expect(strong.postProductionDelta).toBeGreaterThan(weak.postProductionDelta);
  });

  it('different specialties add cleanly (each field independently moved)', () => {
    const team = computeProducerEffects(
      [
        makeProducer({ specialty: 'Line', skill: 60 }),
        makeProducer({ specialty: 'Creative', skill: 60 }),
        makeProducer({ specialty: 'Executive', skill: 60 }),
        makeProducer({ specialty: 'Fixer', skill: 60 }),
      ],
      'Drama',
    );
    expect(team.productionCostMultiplier).toBeLessThan(1);
    expect(team.postProductionDelta).toBeGreaterThan(0);
    expect(team.marketingEfficiencyMultiplier).toBeGreaterThan(1);
    expect(team.flatBuzzDelta).toBeGreaterThan(0);
    expect(team.eventNegativeImpactMultiplier).toBeLessThan(1);
  });

  it('same-specialty stacking decays: two is more than one but less than double', () => {
    const one = computeProducerEffects([makeProducer({ specialty: 'Line', skill: 70 })], 'Drama');
    const two = computeProducerEffects([makeProducer({ specialty: 'Line', skill: 70 }), makeProducer({ specialty: 'Line', skill: 70 })], 'Drama');
    const reductionOne = 1 - one.productionCostMultiplier;
    const reductionTwo = 1 - two.productionCostMultiplier;
    expect(reductionTwo).toBeGreaterThan(reductionOne);
    expect(reductionTwo).toBeLessThan(reductionOne * 2);
  });

  it('genre affinity amplifies (amplify-only) - same producer, matching genre lands harder', () => {
    const producer = makeProducer({ specialty: 'Creative', skill: 70, genreAffinity: ['Horror'] });
    const onGenre = computeProducerEffects([producer], 'Horror');
    const offGenre = computeProducerEffects([producer], 'Comedy');
    const noGenre = computeProducerEffects([producer], null);
    expect(onGenre.postProductionDelta).toBeGreaterThan(offGenre.postProductionDelta);
    // Off-genre is never a penalty - it equals the un-amplified (null-genre) value.
    expect(offGenre.postProductionDelta).toBeCloseTo(noGenre.postProductionDelta, 6);
  });

  it('lower reliability dampens the effect', () => {
    const reliable = computeProducerEffects([makeProducer({ specialty: 'Fixer', skill: 70, reliability: 100 })], 'Drama');
    const flaky = computeProducerEffects([makeProducer({ specialty: 'Fixer', skill: 70, reliability: 1 })], 'Drama');
    expect(1 - flaky.eventNegativeImpactMultiplier).toBeLessThan(1 - reliable.eventNegativeImpactMultiplier);
  });

  it('stacking never breaches the safety clamps', () => {
    const manyLine = Array.from({ length: 8 }, () => makeProducer({ specialty: 'Line', skill: 100, genreAffinity: ['Action'] }));
    const manyFixer = Array.from({ length: 8 }, () => makeProducer({ specialty: 'Fixer', skill: 100, genreAffinity: ['Action'] }));
    const effects = computeProducerEffects([...manyLine, ...manyFixer], 'Action');
    expect(effects.productionCostMultiplier).toBeGreaterThanOrEqual(PRODUCTION_COST_MULTIPLIER_FLOOR);
    expect(effects.productionCostMultiplier).toBeLessThanOrEqual(1);
    expect(effects.eventNegativeImpactMultiplier).toBeGreaterThanOrEqual(EVENT_IMPACT_MULTIPLIER_FLOOR);
  });
});

describe('producer fees', () => {
  it('per-film fee is the career typicalSalary; hiring fee is a fixed multiple', () => {
    const p = makeProducer({ specialty: 'Line', skill: 50, typicalSalary: 800_000 });
    expect(producerPerFilmFee(p)).toBe(800_000);
    expect(producerHiringFee(p)).toBe(800_000 * PRODUCER_HIRING_FEE_MULTIPLE);
  });

  it('producersByIds resolves in order and drops unknown ids; fees sum', () => {
    const a = makeProducer({ specialty: 'Line', skill: 50, typicalSalary: 100_000 });
    const b = makeProducer({ specialty: 'Creative', skill: 50, typicalSalary: 250_000 });
    const pool = [a, b];
    expect(producersByIds(pool, [b.id, 'missing', a.id]).map((p) => p.id)).toEqual([b.id, a.id]);
    expect(totalAttachedPerFilmFees(pool, [a.id, b.id, 'missing'])).toBe(350_000);
  });

  it('a non-producer person has no producer career and a zero fee', () => {
    const p = makeProducer({ specialty: 'Line', skill: 50 });
    const notProducer: Person = { ...p, careers: {} };
    expect(getProducerCareer(notProducer)).toBeNull();
    expect(isProducer(notProducer)).toBe(false);
    expect(producerPerFilmFee(notProducer)).toBe(0);
  });
});

describe('office helpers', () => {
  it('reads locked vs unlocked and tier', () => {
    expect(isOfficeUnlocked(studioWithOffice(null))).toBe(false);
    expect(officeTier(studioWithOffice(null))).toBe(0);
    expect(benchCapacity(studioWithOffice(null))).toBe(0);

    const t2 = studioWithOffice({ tier: 2, benchProducerIds: [] });
    expect(isOfficeUnlocked(t2)).toBe(true);
    expect(officeTier(t2)).toBe(2);
    expect(benchCapacity(t2)).toBe(benchCapacityForTier(2));
  });

  it('bench capacity grows with tier', () => {
    expect(benchCapacityForTier(1)).toBeLessThan(benchCapacityForTier(2));
    expect(benchCapacityForTier(2)).toBeLessThan(benchCapacityForTier(3));
  });

  it('next tier and upgrade cost stop at the max tier', () => {
    expect(nextOfficeTier(studioWithOffice(null))).toBeNull(); // locked has no "next"
    expect(nextOfficeTier(studioWithOffice({ tier: 1, benchProducerIds: [] }))).toBe(2);
    expect(officeUpgradeCost(studioWithOffice({ tier: 1, benchProducerIds: [] }))).toBeGreaterThan(0);
    const maxed = studioWithOffice({ tier: 3, benchProducerIds: [] });
    expect(nextOfficeTier(maxed)).toBeNull();
    expect(officeUpgradeCost(maxed)).toBeNull();
  });

  it('unlock is earned by films shipped OR brand, and not before either', () => {
    expect(canUnlockOffice(0, OFFICE_UNLOCK_FILMS_RELEASED)).toBe(true);
    expect(canUnlockOffice(OFFICE_UNLOCK_BRAND, 0)).toBe(true);
    expect(canUnlockOffice(OFFICE_UNLOCK_BRAND - 1, OFFICE_UNLOCK_FILMS_RELEASED - 1)).toBe(false);
  });
});

describe('generateProducerPool', () => {
  it('produces a full, well-formed, in-band roster', () => {
    const pool = generateProducerPool(createRng(12345));
    expect(pool).toHaveLength(PRODUCER_POOL_SIZE);
    for (const person of pool) {
      expect(person.primaryRole).toBe('Producer');
      const career = getProducerCareer(person);
      expect(career).not.toBeNull();
      expect(PRODUCER_SPECIALTIES).toContain(career!.specialty);
      expect(career!.skill).toBeGreaterThanOrEqual(1);
      expect(career!.skill).toBeLessThanOrEqual(100);
      expect(career!.genreAffinity.length).toBeGreaterThanOrEqual(1);
      expect(career!.genreAffinity.length).toBeLessThanOrEqual(2);
      for (const g of career!.genreAffinity) expect(GENRES).toContain(g);
      expect(career!.typicalSalary).toBeGreaterThanOrEqual(PRODUCER_SALARY_RANGE.min - 1000);
      expect(career!.typicalSalary).toBeLessThanOrEqual(PRODUCER_SALARY_RANGE.max + 1000);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateProducerPool(createRng(999));
    const b = generateProducerPool(createRng(999));
    expect(a.map((p) => [getProducerCareer(p)!.specialty, getProducerCareer(p)!.skill, getProducerCareer(p)!.typicalSalary])).toEqual(
      b.map((p) => [getProducerCareer(p)!.specialty, getProducerCareer(p)!.skill, getProducerCareer(p)!.typicalSalary]),
    );
  });

  it('generates a spread across all four specialties', () => {
    const pool = generateProducerPool(createRng(7));
    const specialties = new Set(pool.map((p) => getProducerCareer(p)!.specialty));
    expect(specialties.size).toBe(4);
  });
});
