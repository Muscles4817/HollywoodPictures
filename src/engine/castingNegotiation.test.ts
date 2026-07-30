// Casting Redesign, Phase E - negotiation/counter-offers
// (engine/castingNegotiation.ts). Covers the two exported pieces: the derived,
// seeded asking price and the deterministic accept/counter/reject resolution.
import { describe, it, expect } from 'vitest';
import { computeAskingPrice, resolveNegotiation } from './castingNegotiation';
import type { ActorAppealResult } from './castingAppeal';
import { createRng } from './random';
import type { RelationshipStanding } from './relationships';
import type { ActingStyle, Person } from '../types';

function actorPerson(
  id: string,
  overrides: {
    reputation?: Partial<Person['reputation']>;
    personality?: Partial<Person['personality']>;
    minimumSalary?: number;
    typicalSalary?: number;
    actingStyle?: Partial<ActingStyle>;
  } = {},
): Person {
  const actingStyle: ActingStyle = {
    characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50,
    ...overrides.actingStyle,
  };
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50, ...overrides.personality },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50, ...overrides.reputation },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {
      actor: {
        role: 'Actor', active: true, experience: 50, roleReputation: 50,
        minimumSalary: overrides.minimumSalary ?? 100_000, typicalSalary: overrides.typicalSalary ?? 1_000_000,
        actingStyle,
      },
    },
  };
}

/** A fully-controlled ActorAppealResult - lets the negotiation tests set overall/salaryFit/effectiveMinimum directly instead of steering them through computeActorAppeal's script/studio inputs. */
function appeal(overrides: Partial<ActorAppealResult> = {}): ActorAppealResult {
  return {
    suitability: 60, brandFit: 30, prestigeFit: 20, salaryFit: 50, attachmentMomentum: 0,
    overall: 65,
    schedule: { status: 'available', availableFromDay: 1, delayDays: 0 },
    belowSalaryFloor: false,
    effectiveMinimum: 300_000,
    ...overrides,
  };
}

const grudge: RelationshipStanding = { collaborations: 2, warmth: -85, tier: 'grudge', lastWorkedDay: 1 };

describe('computeAskingPrice', () => {
  it('is deterministic for a given seed', () => {
    const person = actorPerson('a');
    const a = computeAskingPrice(person, 100_000, 1_000_000, createRng(42));
    const b = computeAskingPrice(person, 100_000, 1_000_000, createRng(42));
    expect(a).toBe(b);
  });

  it('never quotes below the effective floor, even when the floor exceeds typical', () => {
    const person = actorPerson('a', { reputation: { fame: 10, currentHeat: 10 }, personality: { ego: 10, ambition: 10 } });
    for (let seed = 1; seed <= 40; seed++) {
      const ask = computeAskingPrice(person, 2_000_000, 1_000_000, createRng(seed));
      expect(ask).toBeGreaterThanOrEqual(2_000_000);
    }
  });

  it('a hot, ego-driven star quotes higher than a humble working actor at the same career numbers', () => {
    const humble = actorPerson('humble', { reputation: { fame: 10, currentHeat: 10 }, personality: { ego: 10, ambition: 10 } });
    const star = actorPerson('star', { reputation: { fame: 95, currentHeat: 95 }, personality: { ego: 90, ambition: 90 } });
    for (let seed = 1; seed <= 20; seed++) {
      const humbleAsk = computeAskingPrice(humble, 100_000, 1_000_000, createRng(seed));
      const starAsk = computeAskingPrice(star, 100_000, 1_000_000, createRng(seed));
      expect(starAsk).toBeGreaterThan(humbleAsk);
    }
  });

  it('a low-demand actor genuinely opens below their usual quote; a hot star opens at or above it', () => {
    const humble = actorPerson('humble', { reputation: { fame: 10, currentHeat: 10 }, personality: { ego: 10, ambition: 10 } });
    const star = actorPerson('star', { reputation: { fame: 95, currentHeat: 95 }, personality: { ego: 90, ambition: 90 } });
    // Averaged over seeds the wobble cancels; assert the central tendency.
    const avg = (person: Person) => {
      let sum = 0;
      for (let seed = 1; seed <= 60; seed++) sum += computeAskingPrice(person, 100_000, 1_000_000, createRng(seed));
      return sum / 60;
    };
    expect(avg(humble)).toBeLessThan(1_000_000);
    expect(avg(star)).toBeGreaterThan(1_000_000);
  });

  it('the seeded wobble stays bounded - within ~10% of the no-wobble centre', () => {
    const person = actorPerson('a');
    const asks: number[] = [];
    for (let seed = 1; seed <= 200; seed++) asks.push(computeAskingPrice(person, 100_000, 1_000_000, createRng(seed)));
    const min = Math.min(...asks);
    const max = Math.max(...asks);
    // max/min spread can't exceed the (1+w)/(1-w) ratio of the wobble bounds.
    expect(max / min).toBeLessThanOrEqual((1.1 / 0.9) + 0.001);
  });
});

describe('resolveNegotiation', () => {
  const person = actorPerson('a'); // selectiveness 50 -> acceptance threshold 57.5

  it('rejects on an unavailable schedule before money is considered', () => {
    const out = resolveNegotiation(
      appeal({ schedule: { status: 'requires-delay', availableFromDay: 100, delayDays: 90 } }),
      person, 5_000_000, 1_000_000,
    );
    expect(out).toEqual({ status: 'rejected', reason: 'schedule' });
  });

  it('rejects on a poisoned relationship regardless of a generous offer', () => {
    const out = resolveNegotiation(appeal({ overall: 90 }), person, 10_000_000, 1_000_000, grudge);
    expect(out).toEqual({ status: 'rejected', reason: 'relationship' });
  });

  it('accepts when the offer meets their asking number, closing at the offered fee', () => {
    // Offer at their ask (1M) - clearly above the ~0.9 accept fraction.
    const out = resolveNegotiation(appeal({ overall: 80 }), person, 1_000_000, 1_000_000);
    expect(out).toEqual({ status: 'accepted', agreedSalary: 1_000_000 });
  });

  it('lands the actor below their usual quote when their ASK itself is low (not by underpaying it)', () => {
    // A discounted effective floor makes their ask low (600k, below the 1M
    // typical); meeting that low ask lands them for under typical.
    const out = resolveNegotiation(appeal({ overall: 75, salaryFit: 60, effectiveMinimum: 200_000 }), person, 600_000, 600_000);
    expect(out.status).toBe('accepted');
    if (out.status === 'accepted') {
      expect(out.agreedSalary).toBe(600_000);
      expect(out.agreedSalary).toBeLessThan(1_000_000); // below the actor's typicalSalary
    }
  });

  it('counters a lowball even when the project strongly sells the actor (salary must actually be met)', () => {
    // Strong non-salary appeal (overall 90) used to make this an instant yes at
    // any in-range offer. Now the money has to be there: a 500k offer against a
    // 1M ask draws a counter, it is not accepted cheap.
    const out = resolveNegotiation(appeal({ overall: 90, salaryFit: 30 }), person, 500_000, 1_000_000);
    expect(out.status).toBe('countered');
    if (out.status === 'countered') {
      expect(out.counterSalary).toBeGreaterThan(500_000);
      expect(out.counterSalary).toBeLessThanOrEqual(1_000_000);
    }
  });

  it('counters when the actor is interested but the money is not there yet', () => {
    const out = resolveNegotiation(appeal({ overall: 50, salaryFit: 30 }), person, 500_000, 1_000_000);
    expect(out.status).toBe('countered');
    if (out.status === 'countered') {
      expect(out.reason).toBe('salary');
      expect(out.counterSalary).toBeGreaterThan(500_000); // above the offer
      expect(out.counterSalary).toBeLessThanOrEqual(1_000_000); // never above their own ask
    }
  });

  it('a more selective, ego-driven actor holds their counter closer to their asking price', () => {
    const humble = actorPerson('humble', { reputation: { fame: 50, currentHeat: 50 }, personality: { ego: 30, ambition: 30 } }); // sel 45
    const proud = actorPerson('proud', { reputation: { fame: 50, currentHeat: 50 }, personality: { ego: 90, ambition: 90 } }); // sel 70
    const a = appeal({ overall: 50, salaryFit: 30, effectiveMinimum: 300_000 });
    const humbleOut = resolveNegotiation(a, humble, 500_000, 1_000_000);
    const proudOut = resolveNegotiation(a, proud, 500_000, 1_000_000);
    expect(humbleOut.status).toBe('countered');
    expect(proudOut.status).toBe('countered');
    if (humbleOut.status === 'countered' && proudOut.status === 'countered') {
      expect(proudOut.counterSalary).toBeGreaterThan(humbleOut.counterSalary);
    }
  });

  it('walks away from an insulting lowball rather than dignifying it with a counter', () => {
    // Money could in principle close it (overall-at-ask clears), but the offer is
    // below 60% of the effective floor.
    const out = resolveNegotiation(appeal({ overall: 45, salaryFit: 10, effectiveMinimum: 1_000_000 }), person, 500_000, 1_500_000);
    expect(out).toEqual({ status: 'rejected', reason: 'salary' });
  });

  it('rejects with the real reason when even paying full ask would not sell them on the role', () => {
    // Weak suitability drags overall so low that the asking-price salaryFit can't
    // lift it over the bar - money is not the problem.
    const out = resolveNegotiation(
      appeal({ overall: 40, suitability: 15, brandFit: 40, prestigeFit: 40, salaryFit: 30 }),
      person, 800_000, 1_000_000,
    );
    expect(out).toEqual({ status: 'rejected', reason: 'suitability' });
  });
});
