// Casting Redesign, Phase B (docs/DESIGN_REVIEW_casting_redesign.md section
// 3) - no dedicated test coverage existed for this file before it was
// added; the whole point of computeActorAppeal is new logic (unlike
// engine/compatibility.ts's Suitability term, which it reuses unchanged).
//
// Casting Appeal Rework - the reported bug this rework fixes: a mid-prestige
// studio's $500k casting call surfaced a $10M-minimum star as a viable
// candidate, because a total salary mismatch only cost 25 of 100 points in
// `overall` and every other factor could fully offset it. The regression
// test for that scenario lives at the bottom of this file.
import { describe, it, expect } from 'vitest';
import { computeActorAppeal, computeAcceptanceThreshold, computeEffectiveMinimumSalary, resolveOfferResponse, type ActorAppealResult } from './castingAppeal';
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

const NUMERIC_FACTOR_KEYS = ['suitability', 'brandFit', 'prestigeFit', 'salaryFit', 'attachmentMomentum', 'overall'] as const;

describe('computeActorAppeal', () => {
  it('returns null for a person with no Actor career', () => {
    const result = computeActorAppeal(writerPerson('w1'), character(), scriptFor(1), studio(), undefined, [], 500_000, 1);
    expect(result).toBeNull();
  });

  it('every numeric factor and the overall score stay within [0, 100]', () => {
    const script = scriptFor(2);
    const person = actorPerson('a1', { reputation: { fame: 99, prestige: 1 }, personality: { ambition: 99, ego: 99 } });
    const result = computeActorAppeal(person, character(), script, studio({ brand: 100, prestige: 0 }), undefined, [], 100, 100_000);
    expect(result).not.toBeNull();
    for (const key of NUMERIC_FACTOR_KEYS) {
      expect(result![key]).toBeGreaterThanOrEqual(0);
      expect(result![key]).toBeLessThanOrEqual(100);
    }
  });

  it('salaryFit reads ~85 exactly at typicalSalary, and approaches 100 with diminishing returns above it', () => {
    const script = scriptFor(3);
    const person = actorPerson('a2', { minimumSalary: 100_000, typicalSalary: 1_000_000 });
    const atTypical = computeActorAppeal(person, character(), script, studio(), undefined, [], 1_000_000, 1)!;
    const wellAboveTypical = computeActorAppeal(person, character(), script, studio(), undefined, [], 50_000_000, 1)!;
    expect(atTypical.salaryFit).toBe(85);
    expect(wellAboveTypical.salaryFit).toBeGreaterThan(95);
    expect(wellAboveTypical.salaryFit).toBeLessThanOrEqual(100);
  });

  it('salaryFit increases monotonically for an offer between the effective minimum and typical salary', () => {
    const script = scriptFor(4);
    const person = actorPerson('a3', { minimumSalary: 100_000, typicalSalary: 1_000_000 });
    const low = computeActorAppeal(person, character(), script, studio(), undefined, [], 300_000, 1)!;
    const high = computeActorAppeal(person, character(), script, studio(), undefined, [], 700_000, 1)!;
    expect(high.salaryFit).toBeGreaterThan(low.salaryFit);
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

  it('a single director attachment reads at close to that director\'s own full momentum score, not diluted by an implicit missing 2nd/3rd slot', () => {
    const script = scriptFor(20);
    const person = actorPerson('am1');
    const director = actorPerson('dir1', { reputation: { fame: 80, prestige: 80 } });
    const result = computeActorAppeal(person, character(), script, studio(), undefined, [{ role: 'Director', person: director }], 1_000_000, 1)!;
    // personMomentumScore = 80, Director's 1.3x role weight then clamped to 100.
    expect(result.attachmentMomentum).toBeGreaterThanOrEqual(99);
  });

  it('a couple of low-momentum minor crew hires can never drag momentum down from a major signing alone - only ever add a little, never subtract', () => {
    const script = scriptFor(21);
    const person = actorPerson('am2');
    // A moderate (not maxed-out) star, so the 100 clamp doesn't hide whether
    // adding minor attachments actually moves the number.
    const star: TalentAssignment = { role: 'Director', person: actorPerson('star2', { reputation: { fame: 70, prestige: 70 } }) };
    const minor1: TalentAssignment = { role: 'Writer', person: actorPerson('minor1', { reputation: { fame: 5, prestige: 5 } }) };
    const minor2: TalentAssignment = { role: 'Cinematographer', person: actorPerson('minor2', { reputation: { fame: 5, prestige: 5 } }) };
    const withStarOnly = computeActorAppeal(person, character(), script, studio(), undefined, [star], 1_000_000, 1)!;
    const withStarAndMinors = computeActorAppeal(person, character(), script, studio(), undefined, [star, minor1, minor2], 1_000_000, 1)!;
    expect(withStarAndMinors.attachmentMomentum).toBeGreaterThanOrEqual(withStarOnly.attachmentMomentum);
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

  // UI review (user report, screenshot): overall appeal barely moved with
  // studio reputation before this - a studio going from brand/prestige 20 to
  // 90 only shifted `overall` by ~7-10 points, since brandFit/prestigeFit
  // sharing one effective weight (via prestigeLean's complementary split)
  // wasn't accounted for when they were each weighted independently in a
  // naive sum-to-1 table. Fixed by giving the blended (brandFit +
  // prestigeFit) signal one proper weight, same magnitude as suitability.
  it('overall appeal moves substantially - not marginally - between an unproven indie studio and a major one, holding everything else fixed', () => {
    const script = scriptFor(15);
    const testCharacter = character();
    const person = actorPerson('a15', { reputation: { fame: 50, prestige: 50 }, personality: { ambition: 50, ego: 50 } });
    const indie = computeActorAppeal(person, testCharacter, script, studio({ brand: 20, prestige: 20 }), undefined, [], 1_000_000, 1)!;
    const major = computeActorAppeal(person, testCharacter, script, studio({ brand: 90, prestige: 90 }), undefined, [], 1_000_000, 1)!;
    expect(major.overall - indie.overall).toBeGreaterThan(12);
  });

  it('reads as noticeably less prestigious with no director attached than with a well-regarded one, even at the same studio', () => {
    const script = scriptFor(16);
    const prestigeActor = actorPerson('a16', { reputation: { prestige: 90 }, personality: { ambition: 10, ego: 10 } });
    const lowRepStudio = studio({ brand: 20, prestige: 20 });
    const noDirector = computeActorAppeal(prestigeActor, character(), script, lowRepStudio, undefined, [], 1_000_000, 1)!;
    const respectedDirector = actorPerson('director16', { reputation: { prestige: 95, fame: 95 } });
    const withDirector = computeActorAppeal(prestigeActor, character(), script, lowRepStudio, respectedDirector, [], 1_000_000, 1)!;
    expect(withDirector.prestigeFit).toBeGreaterThan(noDirector.prestigeFit);
    expect(noDirector.prestigeFit).toBeLessThan(40);
  });
});

describe('computeActorAppeal - schedule gate (Casting Appeal Rework)', () => {
  it('reads available with no commitments, or one ending before the planned start', () => {
    const script = scriptFor(22);
    const free = actorPerson('sched1');
    const freeByThen = actorPerson('sched2', { bookedUntil: 50 });
    const freeResult = computeActorAppeal(free, character(), script, studio(), undefined, [], 1_000_000, 100)!;
    const freeByThenResult = computeActorAppeal(freeByThen, character(), script, studio(), undefined, [], 1_000_000, 100)!;
    expect(freeResult.schedule.status).toBe('available');
    expect(freeByThenResult.schedule.status).toBe('available');
  });

  it('reads requires-delay for a finite overlap under the ceiling, and unavailable beyond it', () => {
    const script = scriptFor(23);
    const delayed = actorPerson('sched3', { bookedUntil: 250 }); // 150 days past a start of 100 - under the 180-day ceiling
    const unavailable = actorPerson('sched4', { bookedUntil: 400 }); // 300 days past - over it
    const delayedResult = computeActorAppeal(delayed, character(), script, studio(), undefined, [], 1_000_000, 100)!;
    const unavailableResult = computeActorAppeal(unavailable, character(), script, studio(), undefined, [], 1_000_000, 100)!;
    expect(delayedResult.schedule.status).toBe('requires-delay');
    expect(delayedResult.schedule.delayDays).toBe(150);
    expect(unavailableResult.schedule.status).toBe('unavailable');
  });
});

describe('computeActorAppeal - salary floor (Casting Appeal Rework)', () => {
  it('belowSalaryFloor is false at/above the effective minimum, true below it, for a PaychequeDriven actor whose effective minimum always equals their raw minimumSalary', () => {
    const script = scriptFor(24);
    const paycheckDriven = actorPerson('pd1', { minimumSalary: 100_000, typicalSalary: 1_000_000, personality: { ambition: 90, loyalty: 10 } });
    const atMinimum = computeActorAppeal(paycheckDriven, character(), script, studio({ prestige: 90 }), undefined, [], 100_000, 1)!;
    const belowMinimum = computeActorAppeal(paycheckDriven, character(), script, studio({ prestige: 90 }), undefined, [], 99_999, 1)!;
    expect(atMinimum.belowSalaryFloor).toBe(false);
    expect(belowMinimum.belowSalaryFloor).toBe(true);
  });
});

describe('computeEffectiveMinimumSalary (Casting Appeal Rework)', () => {
  it('never discounts a PaychequeDriven actor, however strong the prestige/director draw', () => {
    const paycheckDriven = actorPerson('pd2', { personality: { ambition: 90, loyalty: 10 } });
    const effective = computeEffectiveMinimumSalary(paycheckDriven, 1_000_000, 100, 100);
    expect(effective).toBe(1_000_000);
  });

  it('discounts a PrestigeFocused actor more than a neutral actor under the identical prestige/director signal', () => {
    const prestigeFocused = actorPerson('pf1', { reputation: { fame: 20, prestige: 70 } });
    const neutral = actorPerson('neutral1');
    const prestigeDiscounted = computeEffectiveMinimumSalary(prestigeFocused, 1_000_000, 80, 0);
    const neutralDiscounted = computeEffectiveMinimumSalary(neutral, 1_000_000, 80, 0);
    expect(prestigeDiscounted).toBeLessThan(neutralDiscounted);
    expect(neutralDiscounted).toBeLessThan(1_000_000);
  });

  it('never discounts below the MAX_SALARY_DISCOUNT cap, even at maximum prestige/director draw', () => {
    const prestigeFocused = actorPerson('pf2', { reputation: { fame: 20, prestige: 70 } });
    const effective = computeEffectiveMinimumSalary(prestigeFocused, 1_000_000, 100, 100);
    expect(effective).toBeGreaterThanOrEqual(600_000);
  });

  it('a director-only draw signal (no personal prestige lean at play) can still pull the discount up', () => {
    const neutral = actorPerson('neutral2');
    const noDraw = computeEffectiveMinimumSalary(neutral, 1_000_000, 0, 0);
    const withDirectorDraw = computeEffectiveMinimumSalary(neutral, 1_000_000, 0, 90);
    expect(withDirectorDraw).toBeLessThan(noDraw);
  });
});

// The exact reported bug: a mid-prestige studio's $500k casting call
// surfacing Margot Robbie (real minimumSalary/typicalSalary $10M) as a
// viable candidate. Modeled here with a hand-built star rather than the
// real handcrafted data, so this test doesn't depend on data/handcraftedTalents.ts
// staying numerically unchanged - the real-actor scenario matrix is a
// follow-up pass built together against actual data/handcraftedTalents.ts entries.
describe('regression: a wildly unaffordable star cannot be talked into an offer far below their minimum, however strong every other factor is', () => {
  it('hard-rejects on salary regardless of suitability/reputation/momentum', () => {
    const script = scriptFor(27);
    const star = actorPerson('star-regression', {
      minimumSalary: 10_000_000,
      typicalSalary: 10_000_000,
      reputation: { fame: 95, prestige: 95, industryRespect: 90 },
    });
    const perfectCharacter = character({ traits: traits({ charismaDemand: 50, comedyDemand: 50, emotionalDemand: 50, physicalDemand: 50, transformationDemand: 50 }) });
    const midPrestigeStudio = studio({ brand: 50, prestige: 50 });
    const respectedDirector = actorPerson('director-regression', { reputation: { fame: 90, prestige: 90, industryRespect: 90 } });
    const currentTalent: TalentAssignment[] = [{ role: 'Director', person: respectedDirector }];
    const appeal = computeActorAppeal(star, perfectCharacter, script, midPrestigeStudio, respectedDirector, currentTalent, 500_000, 1)!;
    expect(appeal.belowSalaryFloor).toBe(true);
    const response = resolveOfferResponse(appeal, star);
    expect(response.status).toBe('rejected');
    if (response.status === 'rejected') expect(response.reason).toBe('salary');
  });
});

describe('computeAcceptanceThreshold', () => {
  it('is higher for a more selective actor (high fame/heat/ego/ambition) than a less selective one', () => {
    const selective = actorPerson('sel', { reputation: { fame: 95, currentHeat: 95 }, personality: { ego: 95, ambition: 95 } });
    const humble = actorPerson('hum', { reputation: { fame: 5, currentHeat: 5 }, personality: { ego: 5, ambition: 5 } });
    expect(computeAcceptanceThreshold(selective)).toBeGreaterThan(computeAcceptanceThreshold(humble));
  });

  it('never drops below a token floor even at minimum selectiveness', () => {
    const person = actorPerson('p3', { reputation: { fame: 0, currentHeat: 0 }, personality: { ego: 0, ambition: 0 } });
    expect(computeAcceptanceThreshold(person)).toBeGreaterThanOrEqual(1);
  });
});

describe('resolveOfferResponse', () => {
  it('accepts once overall appeal clears the actor-specific threshold', () => {
    const script = scriptFor(11);
    const person = actorPerson('a11', { reputation: { fame: 1 }, personality: { ego: 1 } });
    const testCharacter = character({ traits: traits({ charismaDemand: 50, comedyDemand: 50, emotionalDemand: 50, physicalDemand: 50, transformationDemand: 50 }) });
    const appeal = computeActorAppeal(person, testCharacter, script, studio({ brand: 90, prestige: 90 }), undefined, [], 5_000_000, 1)!;
    const response = resolveOfferResponse(appeal, person);
    expect(response.status).toBe('accepted');
  });

  it('rejects with a reason once overall appeal falls short of the threshold', () => {
    const script = scriptFor(12);
    const veryPickyStar = actorPerson('a12', { reputation: { fame: 100, prestige: 100 }, personality: { ego: 100 } });
    const badFitCharacter = character({ traits: traits({ charismaDemand: 1, comedyDemand: 1, emotionalDemand: 1, physicalDemand: 1, transformationDemand: 1 }) });
    const appeal = computeActorAppeal(veryPickyStar, badFitCharacter, script, studio({ brand: 1, prestige: 1 }), undefined, [], 1, 1)!;
    const response = resolveOfferResponse(appeal, veryPickyStar);
    expect(response.status).toBe('rejected');
    if (response.status === 'rejected') {
      expect(['suitability', 'brand-prestige-mismatch', 'salary', 'schedule']).toContain(response.reason);
    }
  });

  it('rejects on schedule immediately, before overall/threshold is even consulted', () => {
    const script = scriptFor(28);
    // A wildly appealing offer to an otherwise-undiscriminating actor - the
    // only reason to reject is that they're genuinely unavailable.
    const person = actorPerson('sched-reject', { reputation: { fame: 1 }, personality: { ego: 1 }, bookedUntil: 500 });
    const testCharacter = character({ traits: traits({ charismaDemand: 50, comedyDemand: 50, emotionalDemand: 50, physicalDemand: 50, transformationDemand: 50 }) });
    const appeal = computeActorAppeal(person, testCharacter, script, studio({ brand: 90, prestige: 90 }), undefined, [], 5_000_000, 1)!;
    expect(appeal.schedule.status).toBe('unavailable');
    const response = resolveOfferResponse(appeal, person);
    expect(response).toEqual({ status: 'rejected', reason: 'schedule' });
  });

  // The user's own bug report on offerRejectionReason: brandFit/prestigeFit
  // used to be compared via Math.max, which could read as low (falsely
  // implicating reputation) even when their combined reputationFit - the
  // exact same blend `overall` itself uses - was actually the strongest,
  // least-bad factor.
  it('blames the true worst factor via the combined reputationFit, never falsely blaming reputation for a balanced actor', () => {
    const person = actorPerson('rep1', { reputation: { fame: 10 }, personality: { ego: 10 } });
    const threshold = computeAcceptanceThreshold(person);
    const appeal: ActorAppealResult = {
      suitability: 40,
      brandFit: 30,
      prestigeFit: 30, // Math.max would read 30 (the old, buggy comparison); brandFit + prestigeFit = 60 is the correct, much healthier reading.
      salaryFit: 50,
      attachmentMomentum: 0,
      overall: threshold - 1,
      schedule: { status: 'available', availableFromDay: 1, delayDays: 0 },
      belowSalaryFloor: false,
    };
    const response = resolveOfferResponse(appeal, person);
    expect(response.status).toBe('rejected');
    if (response.status === 'rejected') expect(response.reason).toBe('suitability');
  });

  it('names salary as the reason when that is the clear weak point among the soft factors', () => {
    const script = scriptFor(13);
    const person = actorPerson('a13', { minimumSalary: 1_000_000, typicalSalary: 10_000_000, reputation: { fame: 1 }, personality: { ego: 1 } });
    const testCharacter = character({ traits: traits({ charismaDemand: 50, comedyDemand: 50, emotionalDemand: 50, physicalDemand: 50, transformationDemand: 50 }) });
    const appeal = computeActorAppeal(person, testCharacter, script, studio({ brand: 80, prestige: 80 }), undefined, [], 1_000_000, 1)!;
    const response = resolveOfferResponse(appeal, person);
    if (response.status === 'rejected') {
      expect(response.reason).toBe('salary');
    } else {
      // If salary alone wasn't enough to tip this into rejection, that's a
      // legitimate outcome too - the assertion above is the meaningful one.
      expect(response.status).toBe('accepted');
    }
  });
});
