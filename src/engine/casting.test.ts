import { describe, it, expect } from 'vitest';
import { actorMeetsCharacterGender, personMeetsCharacterGender, castingGenderLabel } from './casting';
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
