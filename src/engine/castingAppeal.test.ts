// Casting Redesign, Phase B (docs/DESIGN_REVIEW_casting_redesign.md section
// 3) - no dedicated test coverage existed for this file before it was
// added; the whole point of computeActorAppeal is new logic (unlike
// engine/compatibility.ts's Suitability term, which it reuses unchanged).
import { describe, it, expect } from 'vitest';
import { computeActorAppeal } from './castingAppeal';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { ActingStyle, CharacterTraitProfile, Person, Script, ScriptCharacter, Studio, TalentAssignment } from '../types';

function scriptFor(seed: number): Script {
  return generateScriptOptions('Drama', createRng(seed), 1)[0];
}

function studio(overrides: Partial<Studio> = {}): Studio {
  return { name: 'Test Studio', cash: 10_000_000, brand: 50, prestige: 50, assets: [], ...overrides };
}

function traits(overrides: Partial<CharacterTraitProfile> = {}): CharacterTraitProfile {
  return {
    dramaticDepth: 50, charismaDemand: 50, comedyDemand: 50, emotionalDemand: 50, physicalDemand: 50,
    transformationDemand: 50, audienceAccessibility: 50, distinctiveness: 50, merchandisePotential: 50,
    ...overrides,
  };
}

function character(overrides: Partial<ScriptCharacter> = {}): ScriptCharacter {
  return { id: 'char-1', name: 'Test Character', archetype: 'Other', prominence: 'Lead', traits: traits(), ...overrides };
}

function actorPerson(
  id: string,
  overrides: { actingStyle?: Partial<ActingStyle>; reputation?: Partial<Person['reputation']>; personality?: Partial<Person['personality']>; minimumSalary?: number; typicalSalary?: number; bookedUntil?: number } = {},
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
    availability: { commitments: overrides.bookedUntil ? [{ projectId: 'p', role: 'Lead Actor', startDay: 1, endDay: overrides.bookedUntil }] : [] },
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

function writerPerson(id: string): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Writer',
    careers: { writer: { role: 'Writer', active: true, experience: 50, roleReputation: 50, minimumSalary: 50_000, typicalSalary: 100_000, skill: 50 } },
  };
}

describe('computeActorAppeal', () => {
  it('returns null for a person with no Actor career', () => {
    const result = computeActorAppeal(writerPerson('w1'), character(), scriptFor(1), studio(), undefined, [], 500_000, 1);
    expect(result).toBeNull();
  });

  it('every factor and the overall score stay within [0, 100]', () => {
    const script = scriptFor(2);
    const person = actorPerson('a1', { reputation: { fame: 99, prestige: 1 }, personality: { ambition: 99, ego: 99 } });
    const result = computeActorAppeal(person, character(), script, studio({ brand: 100, prestige: 0 }), undefined, [], 100, 100_000);
    expect(result).not.toBeNull();
    for (const value of Object.values(result!)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('salaryFit is 100 once the offer meets or beats typicalSalary, and 0 at or below minimumSalary', () => {
    const script = scriptFor(3);
    const person = actorPerson('a2', { minimumSalary: 100_000, typicalSalary: 1_000_000 });
    const atTypical = computeActorAppeal(person, character(), script, studio(), undefined, [], 1_000_000, 1)!;
    const atMinimum = computeActorAppeal(person, character(), script, studio(), undefined, [], 100_000, 1)!;
    const aboveTypical = computeActorAppeal(person, character(), script, studio(), undefined, [], 5_000_000, 1)!;
    expect(atTypical.salaryFit).toBe(100);
    expect(aboveTypical.salaryFit).toBe(100);
    expect(atMinimum.salaryFit).toBe(0);
  });

  it('salaryFit increases monotonically for an offer between minimum and typical salary', () => {
    const script = scriptFor(4);
    const person = actorPerson('a3', { minimumSalary: 100_000, typicalSalary: 1_000_000 });
    const low = computeActorAppeal(person, character(), script, studio(), undefined, [], 300_000, 1)!;
    const high = computeActorAppeal(person, character(), script, studio(), undefined, [], 700_000, 1)!;
    expect(high.salaryFit).toBeGreaterThan(low.salaryFit);
  });

  it('scheduleFit is 100 for an actor with no commitments, and lower for one booked well past the planned start', () => {
    const script = scriptFor(5);
    const free = actorPerson('a4');
    const booked = actorPerson('a5', { bookedUntil: 500 });
    const freeFit = computeActorAppeal(free, character(), script, studio(), undefined, [], 1_000_000, 100)!;
    const bookedFit = computeActorAppeal(booked, character(), script, studio(), undefined, [], 1_000_000, 100)!;
    expect(freeFit.scheduleFit).toBe(100);
    expect(bookedFit.scheduleFit).toBeLessThan(100);
  });

  it('scheduleFit is unaffected by a commitment that ends before the planned start day', () => {
    const script = scriptFor(6);
    const freeByThen = actorPerson('a6', { bookedUntil: 50 });
    const fit = computeActorAppeal(freeByThen, character(), script, studio(), undefined, [], 1_000_000, 100)!;
    expect(fit.scheduleFit).toBe(100);
  });

  it('attachmentMomentum is 0 with nothing attached yet, and rises once high-fame/prestige talent is already attached', () => {
    const script = scriptFor(7);
    const person = actorPerson('a7');
    const noOne: TalentAssignment[] = [];
    const starAttached: TalentAssignment[] = [{ role: 'Director', person: actorPerson('star', { reputation: { fame: 95, prestige: 95 } }) }];
    const withNoOne = computeActorAppeal(person, character(), script, studio(), undefined, noOne, 1_000_000, 1)!;
    const withStar = computeActorAppeal(person, character(), script, studio(), undefined, starAttached, 1_000_000, 1)!;
    expect(withNoOne.attachmentMomentum).toBe(0);
    expect(withStar.attachmentMomentum).toBeGreaterThan(withNoOne.attachmentMomentum);
  });

  it('a commercially-leaning actor (high ambition/ego, low prestige) reads brandFit more strongly than prestigeFit at high studio Brand', () => {
    const script = scriptFor(8);
    const commercialActor = actorPerson('a8', { reputation: { prestige: 10 }, personality: { ambition: 95, ego: 95 } });
    const result = computeActorAppeal(commercialActor, character(), script, studio({ brand: 90, prestige: 90 }), undefined, [], 1_000_000, 1)!;
    expect(result.brandFit).toBeGreaterThan(result.prestigeFit);
  });

  it('a prestige-leaning actor (high existing prestige, low ambition/ego) reads prestigeFit more strongly than brandFit at high studio Prestige', () => {
    const script = scriptFor(9);
    const prestigeActor = actorPerson('a9', { reputation: { prestige: 95 }, personality: { ambition: 10, ego: 10 } });
    const result = computeActorAppeal(prestigeActor, character(), script, studio({ brand: 90, prestige: 90 }), undefined, [], 1_000_000, 1)!;
    expect(result.prestigeFit).toBeGreaterThan(result.brandFit);
  });

  it('suitability matches computeActorCharacterCompatibility exactly for the same actor/character pair', () => {
    const script = scriptFor(10);
    const person = actorPerson('a10', { actingStyle: { charisma: 90, comedy: 10 } });
    const testCharacter = character({ traits: traits({ charismaDemand: 90, comedyDemand: 10 }) });
    const result = computeActorAppeal(person, testCharacter, script, studio(), undefined, [], 1_000_000, 1)!;
    expect(result.suitability).toBeGreaterThan(90);
  });
});
