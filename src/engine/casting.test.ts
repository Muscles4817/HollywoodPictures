import { describe, it, expect } from 'vitest';
import {
  actorMeetsCharacterGender,
  personMeetsCharacterGender,
  castingGenderLabel,
  actorMeetsCharacterAge,
  ageFitMultiplier,
  describeAgeFit,
  castingAgeBandLabel,
  personMeetsCharacterAge,
  AGE_BAND_RANGES,
} from './casting';
import { TEST_SCRIPT_ASSETS } from '../data/testScripts';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { CastingGender, Gender, Person, ScriptCharacter } from '../types';

function actor(gender: Gender | undefined): Person {
  return { identity: { gender, appearanceTags: [] } } as unknown as Person;
}

function character(castingGender: CastingGender | undefined): ScriptCharacter {
  return { id: 'c', name: 'C', archetype: 'Villain', prominence: 'Lead', castingGender } as ScriptCharacter;
}

describe('actorMeetsCharacterGender', () => {
  it("an 'Any' or absent requirement accepts every actor", () => {
    for (const g of ['Male', 'Female', 'NonBinary', undefined] as const) {
      expect(actorMeetsCharacterGender(g, 'Any')).toBe(true);
      expect(actorMeetsCharacterGender(g, undefined)).toBe(true);
    }
  });

  it('a specific requirement accepts only an exact match', () => {
    expect(actorMeetsCharacterGender('Female', 'Female')).toBe(true);
    expect(actorMeetsCharacterGender('Male', 'Female')).toBe(false);
    expect(actorMeetsCharacterGender('Female', 'Male')).toBe(false);
    expect(actorMeetsCharacterGender('Male', 'Male')).toBe(true);
  });

  it('a NonBinary actor matches only open roles, not gendered ones', () => {
    expect(actorMeetsCharacterGender('NonBinary', 'Any')).toBe(true);
    expect(actorMeetsCharacterGender('NonBinary', 'Male')).toBe(false);
    expect(actorMeetsCharacterGender('NonBinary', 'Female')).toBe(false);
  });

  it('an actor with no recorded gender is never blocked (missing data is not a constraint)', () => {
    expect(actorMeetsCharacterGender(undefined, 'Male')).toBe(true);
    expect(actorMeetsCharacterGender(undefined, 'Female')).toBe(true);
  });
});

describe('personMeetsCharacterGender', () => {
  it('routes a Person + Character through the same rule, and a null character is unconstrained', () => {
    expect(personMeetsCharacterGender(actor('Male'), character('Female'))).toBe(false);
    expect(personMeetsCharacterGender(actor('Female'), character('Female'))).toBe(true);
    expect(personMeetsCharacterGender(actor('Male'), character('Any'))).toBe(true);
    expect(personMeetsCharacterGender(actor('Male'), null)).toBe(true);
  });
});

describe('castingGenderLabel', () => {
  it('labels a specific requirement and treats Any/absent as open', () => {
    expect(castingGenderLabel('Female')).toBe('Female role');
    expect(castingGenderLabel('Male')).toBe('Male role');
    expect(castingGenderLabel('Any')).toBe('Any gender');
    expect(castingGenderLabel(undefined)).toBe('Any gender');
  });
});

describe('actorMeetsCharacterAge (the hard absurdity gate)', () => {
  it("an 'Any' or absent band accepts every age", () => {
    for (const age of [8, 25, 45, 80, undefined] as const) {
      expect(actorMeetsCharacterAge(age, 'Any')).toBe(true);
      expect(actorMeetsCharacterAge(age, undefined)).toBe(true);
    }
  });

  it('an actor with no known age is never blocked (missing data is not a constraint)', () => {
    expect(actorMeetsCharacterAge(undefined, 'Child')).toBe(true);
    expect(actorMeetsCharacterAge(undefined, 'Senior')).toBe(true);
  });

  it('accepts an in-band age and a moderate stretch, but refuses an absurd gap', () => {
    // YoungAdult is 20-29.
    expect(actorMeetsCharacterAge(25, 'YoungAdult')).toBe(true); // in band
    expect(actorMeetsCharacterAge(40, 'YoungAdult')).toBe(true); // 11 yrs over - a stretch, still castable
    expect(actorMeetsCharacterAge(50, 'YoungAdult')).toBe(false); // 21 yrs over - absurd
    // An adult can't play a written young child.
    expect(actorMeetsCharacterAge(40, 'Child')).toBe(false); // 28 yrs over Child's max of 12
  });
});

describe('ageFitMultiplier (the soft penalty)', () => {
  it('is a no-op (1) for an in-band age, an Any/absent band, or an unknown age', () => {
    expect(ageFitMultiplier(25, 'YoungAdult')).toBe(1);
    expect(ageFitMultiplier(40, 'Any')).toBe(1);
    expect(ageFitMultiplier(40, undefined)).toBe(1);
    expect(ageFitMultiplier(undefined, 'YoungAdult')).toBe(1);
  });

  it('decays below 1 as the actor sits further outside the band, but never punishes an in-band actor', () => {
    const slight = ageFitMultiplier(34, 'YoungAdult'); // 5 yrs over
    const bigger = ageFitMultiplier(44, 'YoungAdult'); // 15 yrs over
    expect(slight).toBeLessThan(1);
    expect(bigger).toBeLessThan(slight);
    expect(bigger).toBeGreaterThan(0.6); // stays above the floor while still castable
    // Symmetric: playing younger than written is penalised the same as older.
    expect(ageFitMultiplier(24, 'Adult')).toBeCloseTo(ageFitMultiplier(50, 'Adult'), 5); // Adult 30-44: 6 under vs 6 over
  });
});

describe('personMeetsCharacterAge', () => {
  const personBorn = (year: number): Person => ({ identity: { dateOfBirth: { year, month: 1, day: 1 }, appearanceTags: [] } } as unknown as Person);
  const agedCharacter = (band: 'Child' | 'YoungAdult'): ScriptCharacter =>
    ({ id: 'c', name: 'C', archetype: 'Villain', prominence: 'Lead', castingAgeBand: band } as ScriptCharacter);

  it('computes the actor age as of totalDays and routes it through the gate; a null character is unconstrained', () => {
    // Day 1 = Year 1, so an actor born in Year -24 is 25 as of totalDays 1.
    expect(personMeetsCharacterAge(personBorn(-24), agedCharacter('YoungAdult'), 1)).toBe(true);
    // A 45-year-old (born Year -44) is 33 years over Child's max of 12 - absurd.
    expect(personMeetsCharacterAge(personBorn(-44), agedCharacter('Child'), 1)).toBe(false);
    expect(personMeetsCharacterAge(personBorn(-24), null, 1)).toBe(true);
  });
});

describe('describeAgeFit', () => {
  it('stays silent when age is not costing anything', () => {
    expect(describeAgeFit(25, 'YoungAdult')).toBeNull(); // in band
    expect(describeAgeFit(40, 'Any')).toBeNull();
    expect(describeAgeFit(undefined, 'YoungAdult')).toBeNull();
  });

  it('names the direction and magnitude of a stretch', () => {
    expect(describeAgeFit(33, 'YoungAdult')).toBe('A slight stretch — reads older than the part'); // 4 over
    expect(describeAgeFit(38, 'YoungAdult')).toBe('A stretch — reads older than the part'); // 9 over
    expect(describeAgeFit(15, 'Adult')).toBe('A big stretch — reads younger than the part'); // 15 under Adult's min of 30
  });
});

describe('castingAgeBandLabel', () => {
  it('labels each band and treats Any/absent as open', () => {
    expect(castingAgeBandLabel('YoungAdult')).toBe('Young-adult role');
    expect(castingAgeBandLabel('Senior')).toBe('Senior role');
    expect(castingAgeBandLabel('Any')).toBe('Any age');
    expect(castingAgeBandLabel(undefined)).toBe('Any age');
  });
});

describe('data: procedurally generated characters carry a valid age band', () => {
  it('every generated character gets a castingAgeBand from the known set', () => {
    const bands = new Set(['Child', 'Teen', 'YoungAdult', 'Adult', 'MiddleAged', 'Senior', 'Any']);
    const scripts = generateScriptOptions('Action', createRng(7), 40);
    for (const script of scripts) {
      for (const c of script.cast) {
        expect(bands, `${script.title} / ${c.name}`).toContain(c.castingAgeBand);
      }
    }
  });

  it('the band ranges are ordered and non-overlapping', () => {
    const ordered = ['Child', 'Teen', 'YoungAdult', 'Adult', 'MiddleAged', 'Senior'] as const;
    for (let i = 1; i < ordered.length; i++) {
      expect(AGE_BAND_RANGES[ordered[i]].min).toBe(AGE_BAND_RANGES[ordered[i - 1]].max + 1);
    }
  });
});

describe('data: every cast character carries a casting gender', () => {
  it('every hand-authored Test Script character has a castingGender', () => {
    for (const asset of TEST_SCRIPT_ASSETS) {
      for (const c of asset.script.cast) {
        expect(c.castingGender, `${asset.script.title} / ${c.name}`).toBeDefined();
        expect(['Male', 'Female', 'Any']).toContain(c.castingGender);
      }
    }
  });

  it('a known real cast reads its expected genders', () => {
    const furyRoad = TEST_SCRIPT_ASSETS.find((a) => a.script.title === 'Mad Max: Fury Road')!.script;
    const byName = (n: string) => furyRoad.cast.find((c) => c.name === n)!;
    expect(byName('Max').castingGender).toBe('Male');
    expect(byName('Furiosa').castingGender).toBe('Female');
  });

  it('every procedurally generated character also gets a castingGender', () => {
    const scripts = generateScriptOptions('Action', createRng(7), 40);
    for (const script of scripts) {
      for (const c of script.cast) {
        expect(['Male', 'Female', 'Any']).toContain(c.castingGender);
      }
    }
  });
});
