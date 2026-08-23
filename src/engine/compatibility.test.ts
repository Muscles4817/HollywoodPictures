// QoL pass (docs/DESIGN.md) - computeCompatibilityBreakdown/
// computeTalentCompatibilityBreakdown expose the per-tone weighted-mismatch
// terms computeCompatibility's own loop already computes internally, but
// never returned before this. No dedicated test coverage existed for this
// file at all beforehand.
import { describe, it, expect } from 'vitest';
import {
  computeCompatibility,
  computeCompatibilityBreakdown,
  computeCharacterCompatibility,
  computeCharacterCompatibilityBreakdown,
  computeActorCharacterCompatibility,
  computeTalentCompatibility,
  computeTalentCompatibilityBreakdown,
  deriveToneFromActingStyle,
} from './compatibility';
import { TONES } from '../data/tones';
import type { ActingStyle, CharacterTraitProfile, Person, Script, ScriptCharacter, ToneProfile } from '../types';

function tone(overrides: Partial<ToneProfile> = {}): ToneProfile {
  return { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50, ...overrides };
}

function personBase(id: string, name: string): Pick<Person, 'id' | 'identity' | 'personality' | 'reputation' | 'availability' | 'traits'> {
  return {
    id,
    identity: { name, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
  };
}

function directorPerson(id: string, name: string, skill: number, toneProfile: ToneProfile): Person {
  return {
    ...personBase(id, name),
    primaryRole: 'Director',
    careers: {
      director: {
        role: 'Director', active: true, experience: skill, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 100_000,
        skill, toneProfile,
        productionStyle: { environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33 }, effectsStrategy: { practical: 0.5, digital: 0.5 } },
      },
    },
  };
}

function actorPerson(id: string, name: string, actingStyle: ActingStyle): Person {
  return {
    ...personBase(id, name),
    primaryRole: 'Actor',
    careers: {
      actor: { role: 'Actor', active: true, experience: 50, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 100_000, actingStyle },
    },
  };
}

function writerPerson(id: string, name: string, skill: number): Person {
  return {
    ...personBase(id, name),
    primaryRole: 'Writer',
    careers: {
      writer: {
        role: 'Writer', active: true, experience: skill, roleReputation: 50, minimumSalary: 50_000, typicalSalary: 50_000, skill,
        conceptAmbition: 50, craft: { structure: 50, characters: 50, dialogue: 50 },
        toneProfile: { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 },
        genreAffinity: { Action: 50, Comedy: 50, Drama: 50, Horror: 50, Romance: 50, 'Sci-Fi': 50, Fantasy: 50, Thriller: 50 },
        commercialLean: 50, consistency: 50,
      },
    },
  };
}

describe('computeCompatibilityBreakdown', () => {
  it('has exactly one row per tone axis', () => {
    const rows = computeCompatibilityBreakdown(tone(), tone());
    expect(rows.map((r) => r.tone).sort()).toEqual([...TONES].sort());
  });

  it("each row's contribution is exactly scriptValue * gap - the same term computeCompatibility sums internally", () => {
    const scriptTone = tone({ suspense: 90, comedy: 10 });
    const talentTone = tone({ suspense: 30, comedy: 80 });
    const rows = computeCompatibilityBreakdown(scriptTone, talentTone);
    const suspenseRow = rows.find((r) => r.tone === 'suspense')!;
    expect(suspenseRow.gap).toBe(60);
    expect(suspenseRow.contribution).toBe(90 * 60);
    const comedyRow = rows.find((r) => r.tone === 'comedy')!;
    expect(comedyRow.gap).toBe(70);
    expect(comedyRow.contribution).toBe(10 * 70);
  });

  it('reconstructs the exact same aggregate score computeCompatibility returns', () => {
    const scriptTone = tone({ action: 80, drama: 20, spectacle: 90 });
    const talentTone = tone({ action: 40, drama: 70, spectacle: 30 });
    const rows = computeCompatibilityBreakdown(scriptTone, talentTone);
    const totalContribution = rows.reduce((sum, r) => sum + r.contribution, 0);
    const totalWeight = rows.reduce((sum, r) => sum + r.scriptValue, 0);
    const reconstructedScore = 100 - totalContribution / totalWeight;
    expect(reconstructedScore).toBeCloseTo(computeCompatibility(scriptTone, talentTone), 6);
  });

  it('contributionShare always sums to 1 (or every row is 0 if there is no mismatch at all)', () => {
    const rows = computeCompatibilityBreakdown(tone({ action: 90 }), tone({ action: 20 }));
    const totalShare = rows.reduce((sum, r) => sum + r.contributionShare, 0);
    expect(totalShare).toBeCloseTo(1, 6);

    const identicalRows = computeCompatibilityBreakdown(tone(), tone());
    for (const row of identicalRows) expect(row.contributionShare).toBe(0);
  });

  it('a perfect match has zero gap and zero contribution on every axis', () => {
    const rows = computeCompatibilityBreakdown(tone({ suspense: 77 }), tone({ suspense: 77 }));
    for (const row of rows) {
      expect(row.gap).toBe(0);
      expect(row.contribution).toBe(0);
    }
  });
});

describe('computeTalentCompatibilityBreakdown', () => {
  const directorToneProfile = tone({ suspense: 80 });
  const director = directorPerson('d1', 'Test Director', 70, directorToneProfile);
  const actingStyle: ActingStyle = { characterTransformation: 60, emotionalPerformance: 60, charisma: 60, comedy: 20, physicalPerformance: 40 };
  const actor = actorPerson('a1', 'Test Actor', actingStyle);
  const script = { toneProfile: tone({ suspense: 85, comedy: 15 }) } as unknown as Script;

  it("a Director's breakdown compares the script directly against their own toneProfile - matches computeCompatibility exactly", () => {
    const rows = computeTalentCompatibilityBreakdown(director, 'Director', script);
    expect(rows).not.toBeNull();
    const suspenseRow = rows!.find((r) => r.tone === 'suspense')!;
    expect(suspenseRow.talentValue).toBe(directorToneProfile.suspense);
    const score = computeTalentCompatibility(director, 'Director', script);
    const total = rows!.reduce((sum, r) => sum + r.contribution, 0);
    const weight = rows!.reduce((sum, r) => sum + r.scriptValue, 0);
    expect(100 - total / weight).toBeCloseTo(score!, 6);
  });

  it("an Actor's breakdown compares the script against their tone derived from ActingStyle, not a raw toneProfile", () => {
    const rows = computeTalentCompatibilityBreakdown(actor, 'Lead Actor', script);
    expect(rows).not.toBeNull();
    const derived = deriveToneFromActingStyle(actingStyle);
    for (const row of rows!) {
      expect(row.talentValue).toBeCloseTo(derived[row.tone], 6);
    }
  });

  it('returns null for crew roles with no tone-comparable stat, same as computeTalentCompatibility', () => {
    const writer = writerPerson('w1', 'Test Writer', 60);
    expect(computeTalentCompatibilityBreakdown(writer, 'Writer', script)).toBeNull();
    expect(computeTalentCompatibility(writer, 'Writer', script)).toBeNull();
  });
});

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

// Character and Setting Foundations milestone (docs/CHARACTER_AND_SETTING_FOUNDATIONS.md
// section 7) - "does this actor's style suit the specific role they'd play,"
// a second, independent reading from computeTalentCompatibility above.
describe('computeCharacterCompatibility', () => {
  it('scores 100 for a perfect match across all five shared axes', () => {
    const acting: ActingStyle = { characterTransformation: 70, emotionalPerformance: 60, charisma: 80, comedy: 20, physicalPerformance: 40 };
    const score = computeCharacterCompatibility(acting, traits({
      transformationDemand: 70, emotionalDemand: 60, charismaDemand: 80, comedyDemand: 20, physicalDemand: 40,
    }));
    expect(score).toBe(100);
  });

  it('a bigger mismatch on the shared axes always scores strictly lower than a smaller one', () => {
    const acting: ActingStyle = { characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50 };
    const closeFit = computeCharacterCompatibility(acting, traits({ charismaDemand: 60 }));
    const farFit = computeCharacterCompatibility(acting, traits({ charismaDemand: 95 }));
    expect(closeFit).toBeGreaterThan(farFit);
  });

  it('is unaffected by axes CharacterTraitProfile has no ActingStyle equivalent for (dramaticDepth/audienceAccessibility/distinctiveness/merchandisePotential)', () => {
    const acting: ActingStyle = { characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50 };
    const low = computeCharacterCompatibility(acting, traits({ dramaticDepth: 0, audienceAccessibility: 0, distinctiveness: 0, merchandisePotential: 0 }));
    const high = computeCharacterCompatibility(acting, traits({ dramaticDepth: 100, audienceAccessibility: 100, distinctiveness: 100, merchandisePotential: 100 }));
    expect(low).toBe(high);
  });

  // The two properties that let the generator's deliberate specialists
  // (data/talentGeneration.ts rolls 1-2 signature axes high and the rest low)
  // read as strong casting when they are cast to their strength.
  it('weights each axis by how much the ROLE demands it, so an unasked axis cannot drag a well-cast actor down', () => {
    // A comic specialist: brilliant at comedy, deliberately unremarkable elsewhere.
    const comic: ActingStyle = { characterTransformation: 25, emotionalPerformance: 22, charisma: 80, comedy: 92, physicalPerformance: 30 };
    const comicRole = traits({ transformationDemand: 15, emotionalDemand: 15, charismaDemand: 70, comedyDemand: 90, physicalDemand: 15 });
    const dramaticRole = traits({ transformationDemand: 90, emotionalDemand: 88, charismaDemand: 30, comedyDemand: 10, physicalDemand: 20 });

    expect(computeCharacterCompatibility(comic, comicRole)).toBeGreaterThan(95);
    expect(computeCharacterCompatibility(comic, dramaticRole)).toBeLessThan(60);
  });

  it('charges only for falling SHORT of a demand - exceeding it is free', () => {
    const modest: ActingStyle = { characterTransformation: 40, emotionalPerformance: 40, charisma: 40, comedy: 40, physicalPerformance: 40 };
    const gifted: ActingStyle = { ...modest, comedy: 95 };
    const role = traits({ transformationDemand: 40, emotionalDemand: 40, charismaDemand: 40, comedyDemand: 40, physicalDemand: 40 });
    // Both meet the part; the far funnier actor is not penalised for the surplus.
    expect(computeCharacterCompatibility(gifted, role)).toBe(computeCharacterCompatibility(modest, role));
  });

  it('scores 100 when the role demands nothing on any shared axis - there is no shortfall to charge for', () => {
    const acting: ActingStyle = { characterTransformation: 10, emotionalPerformance: 10, charisma: 10, comedy: 10, physicalPerformance: 10 };
    const undemanding = traits({ transformationDemand: 0, emotionalDemand: 0, charismaDemand: 0, comedyDemand: 0, physicalDemand: 0 });
    expect(computeCharacterCompatibility(acting, undemanding)).toBe(100);
  });

  it('never leaves [0, 100] even at the most extreme possible mismatch', () => {
    const acting: ActingStyle = { characterTransformation: 1, emotionalPerformance: 1, charisma: 1, comedy: 1, physicalPerformance: 1 };
    const score = computeCharacterCompatibility(acting, traits({
      transformationDemand: 100, emotionalDemand: 100, charismaDemand: 100, comedyDemand: 100, physicalDemand: 100,
    }));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// Talent Card UX Redesign - the per-axis breakdown a casting card uses to
// show "how well does the actor match the role" one dimension at a time,
// instead of two raw stat blocks the player had to compare themselves.
describe('computeCharacterCompatibilityBreakdown', () => {
  it('has exactly one row per ActingStyle axis, in the same five dimensions computeCharacterCompatibility averages', () => {
    const acting: ActingStyle = { characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50 };
    const rows = computeCharacterCompatibilityBreakdown(acting, traits());
    expect(rows.map((r) => r.axis).sort()).toEqual(
      ['characterTransformation', 'emotionalPerformance', 'charisma', 'comedy', 'physicalPerformance'].sort(),
    );
  });

  it('charges nothing for exceeding what an axis demands - gap is a shortfall, not a distance', () => {
    const acting: ActingStyle = { characterTransformation: 90, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50 };
    const rows = computeCharacterCompatibilityBreakdown(acting, traits({ transformationDemand: 20 }));
    const row = rows.find((r) => r.axis === 'characterTransformation')!;
    expect(row.actorValue).toBe(90);
    expect(row.characterValue).toBe(20);
    // Being far MORE transformative than the part asks for is not a casting error.
    expect(row.gap).toBe(0);
    expect(row.matchScore).toBe(100);
  });

  it('gap is the shortfall when the actor falls short of the demand', () => {
    const acting: ActingStyle = { characterTransformation: 20, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50 };
    const rows = computeCharacterCompatibilityBreakdown(acting, traits({ transformationDemand: 90 }));
    const row = rows.find((r) => r.axis === 'characterTransformation')!;
    expect(row.gap).toBe(70);
    expect(row.matchScore).toBe(30);
  });

  it('demandWeight is each axis\'s share of the role\'s total demand, summing to 1', () => {
    const acting: ActingStyle = { characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50 };
    const rows = computeCharacterCompatibilityBreakdown(
      acting,
      traits({ transformationDemand: 80, emotionalDemand: 20, charismaDemand: 20, comedyDemand: 20, physicalDemand: 20 }),
    );
    expect(rows.reduce((sum, r) => sum + r.demandWeight, 0)).toBeCloseTo(1, 6);
    expect(rows.find((r) => r.axis === 'characterTransformation')!.demandWeight).toBeCloseTo(0.5, 6);
  });

  it('a perfect match on an axis scores 100 (5 stars), a maximal mismatch scores 0', () => {
    const acting: ActingStyle = { characterTransformation: 50, emotionalPerformance: 1, charisma: 50, comedy: 50, physicalPerformance: 50 };
    const rows = computeCharacterCompatibilityBreakdown(acting, traits({ transformationDemand: 50, emotionalDemand: 100 }));
    expect(rows.find((r) => r.axis === 'characterTransformation')!.matchScore).toBe(100);
    expect(rows.find((r) => r.axis === 'emotionalPerformance')!.matchScore).toBe(1);
  });

  it('the demand-WEIGHTED average of every row\'s matchScore reconstructs computeCharacterCompatibility exactly', () => {
    const acting: ActingStyle = { characterTransformation: 65, emotionalPerformance: 40, charisma: 75, comedy: 30, physicalPerformance: 55 };
    const demands = traits({ transformationDemand: 70, emotionalDemand: 20, charismaDemand: 60, comedyDemand: 90, physicalDemand: 10 });
    const rows = computeCharacterCompatibilityBreakdown(acting, demands);
    const weighted = rows.reduce((sum, r) => sum + r.matchScore * r.demandWeight, 0);
    expect(weighted).toBeCloseTo(computeCharacterCompatibility(acting, demands), 6);
  });
});

describe('computeActorCharacterCompatibility', () => {
  it('matches computeCharacterCompatibility exactly for a person with an Actor career', () => {
    const actingStyle: ActingStyle = { characterTransformation: 65, emotionalPerformance: 40, charisma: 75, comedy: 30, physicalPerformance: 55 };
    const actor = actorPerson('a1', 'Test Actor', actingStyle);
    const role = character({ traits: traits({ charismaDemand: 70 }) });
    expect(computeActorCharacterCompatibility(actor, role)).toBe(computeCharacterCompatibility(actingStyle, role.traits));
  });

  it('returns null for a person with no Actor career, same null-for-not-applicable convention as computeTalentCompatibility', () => {
    const writer = writerPerson('w1', 'Test Writer', 60);
    expect(computeActorCharacterCompatibility(writer, character())).toBeNull();
  });
});
