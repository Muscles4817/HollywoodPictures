import { describe, it, expect } from 'vitest';
import {
  tourers,
  personMediaRisk,
  pressTourBuzzDelta,
  pressTourCost,
  pressTourCostForPerson,
  pressTourVolatility,
} from './pressTour';
import { PRESS_TOUR_BASE_COST_PER_PERSON, PRESS_TOUR_MAX_BUZZ_SWING } from '../data/pressTour';
import type { Person, PersonPersonality, TalentAssignment } from '../types';

function person(id: string, fame: number, personality: Partial<PersonPersonality> = {}): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
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

function lead(p: Person): TalentAssignment {
  return { role: 'Lead Actor', person: p };
}

// A steady A-lister and a famous loose cannon, for the fame-vs-risk contrast.
const safeStar = person('safe-star', 90, { controversy: 5, professionalism: 90, pressureHandling: 90 });
const looseCannon = person('loose-cannon', 90, { controversy: 95, professionalism: 20, pressureHandling: 15 });

describe('personMediaRisk', () => {
  it('is low for a consummate pro and high for a loose cannon', () => {
    expect(personMediaRisk(safeStar)).toBeLessThan(0.2);
    expect(personMediaRisk(looseCannon)).toBeGreaterThan(0.8);
  });

  it('stays within [0, 1]', () => {
    expect(personMediaRisk(safeStar)).toBeGreaterThanOrEqual(0);
    expect(personMediaRisk(looseCannon)).toBeLessThanOrEqual(1);
  });
});

describe('tourers', () => {
  const talent = [lead(safeStar), lead(looseCannon)];

  it('is empty when no roster is set', () => {
    expect(tourers(talent, undefined)).toEqual([]);
    expect(tourers(talent, [])).toEqual([]);
  });

  it('resolves ids against assigned talent and ignores stale ids', () => {
    expect(tourers(talent, [safeStar.id, 'not-cast']).map((p) => p.id)).toEqual([safeStar.id]);
  });

  it('de-dupes a person listed twice', () => {
    expect(tourers(talent, [safeStar.id, safeStar.id])).toHaveLength(1);
  });
});

describe('pressTourBuzzDelta', () => {
  const talent = [lead(safeStar), lead(looseCannon)];

  it('is zero when nobody tours', () => {
    expect(pressTourBuzzDelta(talent, undefined)).toBe(0);
  });

  it('is a solid positive bump for a famous, media-safe star', () => {
    expect(pressTourBuzzDelta(talent, [safeStar.id])).toBeGreaterThan(5);
  });

  it('a famous loose cannon is a net liability (negative delta)', () => {
    expect(pressTourBuzzDelta(talent, [looseCannon.id])).toBeLessThan(0);
  });

  it('the same-fame safe star always out-delivers the loose cannon', () => {
    expect(pressTourBuzzDelta(talent, [safeStar.id])).toBeGreaterThan(pressTourBuzzDelta(talent, [looseCannon.id]));
  });

  it('stacks with diminishing returns - a second safe star adds less than the first', () => {
    const second = person('safe-star-2', 90, { controversy: 5, professionalism: 90, pressureHandling: 90 });
    const t2 = [lead(safeStar), lead(second)];
    const one = pressTourBuzzDelta(t2, [safeStar.id]);
    const two = pressTourBuzzDelta(t2, [safeStar.id, second.id]);
    expect(two).toBeGreaterThan(one); // more is still more...
    expect(two - one).toBeLessThan(one); // ...but the marginal add is smaller than the first
  });

  it('never exceeds the swing clamp even for a huge safe roster', () => {
    const many = Array.from({ length: 12 }, (_, i) => person(`s${i}`, 100, { controversy: 0, professionalism: 100, pressureHandling: 100 }));
    const talentMany = many.map(lead);
    expect(pressTourBuzzDelta(talentMany, many.map((p) => p.id))).toBeLessThanOrEqual(PRESS_TOUR_MAX_BUZZ_SWING);
  });
});

describe('pressTourCost', () => {
  const talent = [lead(safeStar), lead(looseCannon)];

  it('is zero when nobody tours', () => {
    expect(pressTourCost(talent, undefined)).toBe(0);
  });

  it('costs more to send a more famous person', () => {
    const nobody = person('nobody', 0);
    const t = [lead(safeStar), lead(nobody)];
    expect(pressTourCostForPerson(safeStar)).toBeGreaterThan(pressTourCostForPerson(nobody));
    expect(pressTourCostForPerson(nobody)).toBe(PRESS_TOUR_BASE_COST_PER_PERSON);
    expect(pressTourCost(t, [safeStar.id, nobody.id])).toBe(pressTourCostForPerson(safeStar) + pressTourCostForPerson(nobody));
  });
});

describe('pressTourVolatility', () => {
  const talent = [lead(safeStar), lead(looseCannon)];

  it('is zero when nobody tours, low for a safe roster, high for a risky one', () => {
    expect(pressTourVolatility(talent, undefined)).toBe(0);
    expect(pressTourVolatility(talent, [safeStar.id])).toBeLessThan(0.2);
    expect(pressTourVolatility(talent, [looseCannon.id])).toBeGreaterThan(0.8);
  });
});
