// PersonTrait derivation - no consumer of Person.personality/.reputation
// ever existed before this (see this file's own header comment). First
// test coverage for the thresholds themselves.
import { describe, it, expect } from 'vitest';
import { deriveTraits } from './personTraits';
import { generateTalentCandidates } from './talentGenerator';
import { createRng } from './random';
import type { Person, PersonPersonality, PersonReputation } from '../types';

function basePerson(): Person {
  return generateTalentCandidates('Actor', createRng(1), 1)[0];
}

function withPersonality(person: Person, overrides: Partial<PersonPersonality>): Person {
  return { ...person, personality: { ...person.personality, ...overrides } };
}

function withReputation(person: Person, overrides: Partial<PersonReputation>): Person {
  return { ...person, reputation: { ...person.reputation, ...overrides } };
}

describe('deriveTraits', () => {
  it('derives DifficultToWorkWith from high ego + low temperament - the type comment\'s own worked example', () => {
    const person = withPersonality(basePerson(), { ego: 89, temperament: 31 });
    expect(deriveTraits(person)).toContain('DifficultToWorkWith');
  });

  it('does not derive DifficultToWorkWith when only one of the two conditions holds', () => {
    const highEgoOnly = withPersonality(basePerson(), { ego: 89, temperament: 80 });
    expect(deriveTraits(highEgoOnly)).not.toContain('DifficultToWorkWith');
    const lowTemperamentOnly = withPersonality(basePerson(), { ego: 20, temperament: 20 });
    expect(deriveTraits(lowTemperamentOnly)).not.toContain('DifficultToWorkWith');
  });

  it('derives ScandalProne from high controversy alone', () => {
    const person = withPersonality(basePerson(), { controversy: 85 });
    expect(deriveTraits(person)).toContain('ScandalProne');
  });

  it('derives MediaDarling from high fame + low controversy, not high fame alone', () => {
    const darling = withReputation(withPersonality(basePerson(), { controversy: 10 }), { fame: 90 });
    expect(deriveTraits(darling)).toContain('MediaDarling');
    const famousButControversial = withReputation(withPersonality(basePerson(), { controversy: 90 }), { fame: 90 });
    expect(deriveTraits(famousButControversial)).not.toContain('MediaDarling');
  });

  it('derives PrestigeFocused when prestige meaningfully outpaces fame', () => {
    const person = withReputation(basePerson(), { prestige: 80, fame: 40 });
    expect(deriveTraits(person)).toContain('PrestigeFocused');
  });

  it('derives PaychequeDriven from high ambition + low loyalty', () => {
    const person = withPersonality(basePerson(), { ambition: 85, loyalty: 15 });
    expect(deriveTraits(person)).toContain('PaychequeDriven');
  });

  it('derives Mentor from high industry respect + high loyalty + modest ego, not from respect alone', () => {
    const mentor = withReputation(withPersonality(basePerson(), { loyalty: 75, ego: 30 }), { industryRespect: 85 });
    expect(deriveTraits(mentor)).toContain('Mentor');
    const respectedButEgotistical = withReputation(withPersonality(basePerson(), { loyalty: 75, ego: 90 }), { industryRespect: 85 });
    expect(deriveTraits(respectedButEgotistical)).not.toContain('Mentor');
  });

  it('derives MultiHyphenate only when a person holds more than one active career', () => {
    const [actor] = generateTalentCandidates('Actor', createRng(2), 1);
    const [director] = generateTalentCandidates('Director', createRng(3), 1);
    expect(deriveTraits(actor)).not.toContain('MultiHyphenate');
    const doubleHyphenate: Person = { ...actor, careers: { ...actor.careers, director: director.careers.director } };
    expect(deriveTraits(doubleHyphenate)).toContain('MultiHyphenate');
  });

  it('derives MethodPerformer/NaturalImproviser from ActingStyle only for an actor career, never for a director', () => {
    const [director] = generateTalentCandidates('Director', createRng(4), 1);
    const highAdaptability = withPersonality(director, { adaptability: 90 });
    expect(deriveTraits(highAdaptability)).not.toContain('NaturalImproviser');
    expect(deriveTraits(highAdaptability)).not.toContain('MethodPerformer');

    const [actor] = generateTalentCandidates('Actor', createRng(5), 1);
    const method: Person = withPersonality(
      { ...actor, careers: { actor: { ...actor.careers.actor!, actingStyle: { ...actor.careers.actor!.actingStyle, characterTransformation: 90 } } } },
      { professionalism: 80 },
    );
    expect(deriveTraits(method)).toContain('MethodPerformer');
  });

  it('a person matching none of the thresholds derives no traits', () => {
    const bland: Person = {
      ...basePerson(),
      personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
      reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    };
    expect(deriveTraits(bland)).toEqual([]);
  });
});
