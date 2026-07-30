// Casting Redesign, Phase 2 - the pre-offer deal estimate (asking-price band +
// acceptance odds), the money half of the uncertainty model.
import { describe, it, expect } from 'vitest';
import { estimateAskingRange, estimateAcceptanceOdds, estimateDeal } from './castingEstimate';
import { askingPriceCentre } from './castingNegotiation';
import type { ActorAppealResult } from './castingAppeal';
import type { FitReadAssist } from './talentCardPresentation';
import type { RelationshipStanding } from './relationships';
import type { ActingStyle, Person } from '../types';

function actorPerson(
  id: string,
  overrides: { reputation?: Partial<Person['reputation']>; personality?: Partial<Person['personality']>; minimumSalary?: number; typicalSalary?: number; actingStyle?: Partial<ActingStyle> } = {},
): Person {
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
        actingStyle: { characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50, ...overrides.actingStyle },
      },
    },
  };
}

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

const CD_STRONG: FitReadAssist = { level: 0.9, source: 'casting-director' };
const grudge: RelationshipStanding = { collaborations: 2, warmth: -85, tier: 'grudge', lastWorkedDay: 1 };

describe('estimateAskingRange', () => {
  const known = actorPerson('known', { reputation: { fame: 90, industryRespect: 90, currentHeat: 90, prestige: 90 } });
  const unknown = actorPerson('unknown', { reputation: { fame: 10, industryRespect: 10, currentHeat: 10, prestige: 10 } });

  it('always brackets the deterministic asking centre and never dips below the floor', () => {
    for (const person of [known, unknown]) {
      const centre = askingPriceCentre(person, 300_000, 2_000_000);
      const est = estimateAskingRange(person, 300_000, 2_000_000);
      expect(est.low).toBeLessThanOrEqual(centre);
      expect(est.high).toBeGreaterThanOrEqual(centre);
      expect(est.low).toBeGreaterThanOrEqual(300_000);
    }
  });

  it('reads a well-known name far more tightly than an unknown', () => {
    const knownEst = estimateAskingRange(known, 300_000, 2_000_000);
    const unknownEst = estimateAskingRange(unknown, 300_000, 2_000_000);
    expect(knownEst.confidence).toBe('high');
    expect(unknownEst.confidence).toBe('low');
    expect(knownEst.high - knownEst.low).toBeLessThan(unknownEst.high - unknownEst.low);
  });

  it('a Casting Director sharpens the read - a tighter band than with no assist', () => {
    const bare = estimateAskingRange(unknown, 300_000, 2_000_000);
    const assisted = estimateAskingRange(unknown, 300_000, 2_000_000, CD_STRONG);
    expect(assisted.high - assisted.low).toBeLessThan(bare.high - bare.low);
  });

  it('is deterministic', () => {
    expect(estimateAskingRange(known, 300_000, 2_000_000)).toEqual(estimateAskingRange(known, 300_000, 2_000_000));
  });
});

describe('estimateAcceptanceOdds', () => {
  const person = actorPerson('a'); // threshold 57.5, centre ~825k at effMin 300k / typical 1M

  it('is a hard no on an unavailable schedule or a poisoned relationship', () => {
    expect(estimateAcceptanceOdds(appeal({ schedule: { status: 'requires-delay', availableFromDay: 90, delayDays: 80 } }), person, 900_000)).toBe('no');
    expect(estimateAcceptanceOdds(appeal({ overall: 95 }), person, 5_000_000, grudge)).toBe('no');
  });

  it('reads an offer that meets their asking number as likely', () => {
    // centre ~825k; offering at/above it should land them.
    expect(estimateAcceptanceOdds(appeal({ overall: 80 }), person, 900_000)).toBe('likely');
  });

  it('does not read a below-ask offer as likely just because the project sells them', () => {
    // Strong appeal (interested), but the offer is well short of their number -
    // mirrors resolveNegotiation, which would counter rather than accept.
    expect(estimateAcceptanceOdds(appeal({ overall: 90 }), person, 600_000)).toBe('stretch');
  });

  it('reads a project that even full pay would not sell them on as a long shot', () => {
    expect(estimateAcceptanceOdds(appeal({ overall: 40, salaryFit: 30 }), person, 800_000)).toBe('long-shot');
  });

  it('grades the money gap: even when close, a stretch further off, a long shot when nowhere near', () => {
    const interested = appeal({ overall: 50, salaryFit: 30 }); // interested, money is the gap
    expect(estimateAcceptanceOdds(interested, person, 800_000)).toBe('even'); // ~0.97 of centre
    expect(estimateAcceptanceOdds(interested, person, 600_000)).toBe('stretch'); // ~0.73
    expect(estimateAcceptanceOdds(interested, person, 400_000)).toBe('long-shot'); // ~0.48
  });
});

describe('estimateDeal', () => {
  it('bundles the asking band and the odds for a candidate', () => {
    const person = actorPerson('a');
    const deal = estimateDeal(appeal({ overall: 80 }), person, 900_000);
    expect(deal).not.toBeNull();
    expect(deal!.asking.low).toBeLessThan(deal!.asking.high);
    expect(deal!.odds).toBe('likely');
  });
});
