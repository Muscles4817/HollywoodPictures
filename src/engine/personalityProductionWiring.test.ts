// Wiring formerly-cosmetic personality axes into production execution
// (SIMULATION_PHILOSOPHY.md Principle 7 - connect existing systems):
//   - temperament -> moraleRisk (a volatile cast clashes more)  [Prototype 1a]
//   - creative tension -> moraleRisk (a clashing key pairing)   [Prototype 2]
//   - pressureHandling -> execution resilience (a composed cast absorbs more) [Prototype 1b]
// Each is an additive amplifier that is ZERO at neutral personalities, so an
// all-average cast reproduces the pre-existing numbers exactly.
import { describe, it, expect } from 'vitest';
import { computeStaticProductionRisk } from './production';
import { computeExecutionResilience } from './productionExecution';
import type { Person, PersonPersonality, ProductionChoices, ProductionRole, Script, TalentAssignment } from '../types';

function person(id: string, over: Partial<PersonPersonality> = {}): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50, ...over },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 70, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {},
  };
}

function cast(over: Partial<PersonPersonality>): TalentAssignment[] {
  const roles: ProductionRole[] = ['Director', 'Lead Actor', 'Supporting Actor'];
  return roles.map((role, i) => ({ role, person: person(`${role}-${i}`, over) }));
}

// computeStaticProductionRisk only reads primarySetting + complexity off the
// script for the NON-morale dimensions; moraleRisk is a pure function of talent,
// so a minimal stub is all these morale-focused tests need.
const SCRIPT = { primarySetting: 'SingleInteriorLocation', complexity: 50 } as unknown as Script;
const CHOICES: ProductionChoices = {
  contingencyAmount: 500_000,
  setQualityAmount: 500_000,
  practicalEffectsAmount: 500_000,
  vfxAmount: 500_000,
  runtimeIntensity: 0.5,
};

function morale(over: Partial<PersonPersonality>): number {
  return computeStaticProductionRisk(cast(over), SCRIPT, CHOICES, 'Drama').moraleRisk;
}

describe('temperament -> moraleRisk (Prototype 1a)', () => {
  it('a volatile (low-temperament) cast carries more morale risk than an even-keeled one', () => {
    expect(morale({ temperament: 5 })).toBeGreaterThan(morale({ temperament: 95 }));
  });

  it('a neutral-temperament cast sits between the two extremes', () => {
    const neutral = morale({ temperament: 50 });
    expect(neutral).toBeGreaterThan(morale({ temperament: 95 }));
    expect(neutral).toBeLessThan(morale({ temperament: 5 }));
  });
});

describe('creative tension -> moraleRisk (Prototype 2)', () => {
  it('a clashing strong-willed, inflexible cast carries more morale risk than an agreeable one at the same reliability', () => {
    const clashing = morale({ ego: 95, adaptability: 5 });
    const agreeable = morale({ ego: 95, adaptability: 95 }); // same ego, but flexible -> far less tension
    expect(clashing).toBeGreaterThan(agreeable);
  });
});

describe('pressureHandling -> execution resilience (Prototype 1b)', () => {
  it('a composed (high pressure-handling) cast is more resilient than a hair-trigger one, all else equal', () => {
    expect(computeExecutionResilience(cast({ pressureHandling: 100 }), CHOICES)).toBeGreaterThan(
      computeExecutionResilience(cast({ pressureHandling: 0 }), CHOICES),
    );
  });

  it('a neutral (50) pressure-handling cast leaves resilience exactly on the reliability/contingency base (no calibration churn)', () => {
    const neutral = computeExecutionResilience(cast({ pressureHandling: 50 }), CHOICES);
    // Base: 0.55 * (reliability 70/100) + 0.45 * contingencyT(500k). We only
    // assert the composure term contributes nothing at the midpoint by bracketing
    // it symmetrically between the two tails.
    const high = computeExecutionResilience(cast({ pressureHandling: 100 }), CHOICES);
    const low = computeExecutionResilience(cast({ pressureHandling: 0 }), CHOICES);
    expect(neutral).toBeCloseTo((high + low) / 2, 5);
  });
});
