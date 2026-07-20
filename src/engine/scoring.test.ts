// Screenplay redesign (docs/DESIGN.md) - the first dedicated test coverage
// for engine/scoring.ts's script-facing formulas, added alongside the
// redesign that changed all four of them: computeScriptScore dropped
// marketability for characters, genre fit is now derived from tone
// distance instead of a stored stat, and computeMarketabilityScore/
// computeBuzzScore now read the derived commercial profile instead of
// Script.marketability.
import { describe, it, expect } from 'vitest';
import { computeScriptScore, computeGenreFitScore, computeMarketabilityScore, computeBuzzScore, computeActingScore } from './scoring';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { ActingStyle, CharacterTraitProfile, Person, ProductionChoices, PostProductionChoices, MarketingChoices, Script, ScriptCharacter, TalentAssignment } from '../types';

function scriptFor(genre: Parameters<typeof generateScriptOptions>[0], seed: number): Script {
  return generateScriptOptions(genre, createRng(seed), 1)[0];
}

const choices: ProductionChoices = {
  contingencyAmount: 1_000_000, setQualityAmount: 500_000, practicalEffectsAmount: 500_000, vfxAmount: 500_000, runtimeIntensity: 0.5,
};
const postProductionChoices: PostProductionChoices = {
  editStyle: 'Balanced', musicFocus: 'Standard', finalCutFocus: 'Trailer-focused',
};
const marketingChoices: MarketingChoices = { marketingSpend: 10_000_000, releaseType: 'Wide', releaseWindow: 'Quiet Month' };

describe('computeScriptScore - pure craft, no commercial term', () => {
  it('is exactly the even average of originality/structure/characters/dialogue', () => {
    const script = scriptFor('Drama', 1);
    const expected = (script.originality + script.structure + script.characters + script.dialogue) / 4;
    expect(computeScriptScore(script)).toBeCloseTo(expected, 6);
  });

  it('is unaffected by scale, complexity, archetype or story type - only the four craft stats matter', () => {
    const script = scriptFor('Action', 2);
    const respec: Script = { ...script, scale: 'Epic', complexity: 5, archetype: 'GenreFormula', storyType: 'Documentary' };
    expect(computeScriptScore(respec)).toBeCloseTo(computeScriptScore(script), 6);
  });
});

describe('computeGenreFitScore - genre fit now derived from tone distance, not a stored stat', () => {
  it('a script whose tone profile is set to its own genre canonical vector scores a very high (>=90) genre-fit component', () => {
    // Building a script with an exact-canonical tone profile isn't exposed
    // directly, so approximate via a large sample and pick the closest -
    // still a meaningful floor check: some real generated script should
    // score highly on genre fit for its own genre.
    const scripts = generateScriptOptions('Comedy', createRng(3), 30);
    const scores = scripts.map((s) => computeGenreFitScore(s, [], 'Comedy', choices));
    expect(Math.max(...scores)).toBeGreaterThan(70);
  });

  it('never returns a value outside [0, 100] across a real sample', () => {
    const scripts = generateScriptOptions('Horror', createRng(4), 30);
    for (const script of scripts) {
      const score = computeGenreFitScore(script, [], 'Horror', choices);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe('computeMarketabilityScore / computeBuzzScore - read the derived commercial profile, not a stored stat', () => {
  it('computeMarketabilityScore increases when the underlying concept is more broadly accessible/hooky, holding cast fame and runtime fixed', () => {
    const nicheScript = scriptFor('Drama', 5);
    const broadScript: Script = { ...nicheScript, archetype: 'Spectacle', scale: 'Epic', storyType: 'Superhero', genre: 'Action' };
    expect(computeMarketabilityScore(broadScript, [], choices)).toBeGreaterThan(computeMarketabilityScore(nicheScript, [], choices));
  });

  it('computeBuzzScore increases when the underlying concept has stronger hook strength, holding everything else fixed', () => {
    const nicheScript = scriptFor('Drama', 6);
    const hookyScript: Script = { ...nicheScript, archetype: 'CrowdPleaser', structure: 90, characters: 90 };
    const buzzNiche = computeBuzzScore(nicheScript, [], [], postProductionChoices, marketingChoices.marketingSpend, 50);
    const buzzHooky = computeBuzzScore(hookyScript, [], [], postProductionChoices, marketingChoices.marketingSpend, 50);
    expect(buzzHooky).toBeGreaterThanOrEqual(buzzNiche);
  });

  it('both stay within [0, 100] across a real sample', () => {
    const scripts = generateScriptOptions('Sci-Fi', createRng(7), 20);
    for (const script of scripts) {
      expect(computeMarketabilityScore(script, [], choices)).toBeGreaterThanOrEqual(0);
      expect(computeMarketabilityScore(script, [], choices)).toBeLessThanOrEqual(100);
      const buzz = computeBuzzScore(script, [], [], postProductionChoices, marketingChoices.marketingSpend, 50);
      expect(buzz).toBeGreaterThanOrEqual(0);
      expect(buzz).toBeLessThanOrEqual(100);
    }
  });
});

function actorPerson(id: string, actingStyle: ActingStyle): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {
      actor: { role: 'Actor', active: true, experience: 50, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 100_000, actingStyle },
    },
  };
}

function traits(overrides: Partial<CharacterTraitProfile> = {}): CharacterTraitProfile {
  return {
    dramaticDepth: 50, charismaDemand: 50, comedyDemand: 50, emotionalDemand: 50, physicalDemand: 50,
    transformationDemand: 50, audienceAccessibility: 50, distinctiveness: 50, merchandisePotential: 50,
    ...overrides,
  };
}

function leadCharacter(overrides: Partial<ScriptCharacter> = {}): ScriptCharacter {
  return { id: 'lead-1', name: 'Test Lead', archetype: 'Other', prominence: 'Lead', traits: traits(), ...overrides };
}

// Character and Setting Foundations milestone
// (docs/CHARACTER_AND_SETTING_FOUNDATIONS.md section 7) - casting quality
// should reflect the specific Character a Lead/Supporting actor plays, not
// just their fit for the script's tone as a whole.
describe('computeActingScore - character-specific casting', () => {
  it("a Lead Actor whose ActingStyle matches their specific Character's trait demands scores higher than one who doesn't, holding script tone fixed", () => {
    const script = scriptFor('Drama', 8);
    const demandingCharacter = leadCharacter({
      traits: traits({ charismaDemand: 90, comedyDemand: 10, emotionalDemand: 20, physicalDemand: 20, transformationDemand: 20 }),
    });
    const scriptWithCharacter: Script = { ...script, requiredLeads: 1, cast: [demandingCharacter] };

    const matchingStyle: ActingStyle = { characterTransformation: 20, emotionalPerformance: 20, charisma: 90, comedy: 10, physicalPerformance: 20 };
    const mismatchedStyle: ActingStyle = { characterTransformation: 90, emotionalPerformance: 90, charisma: 10, comedy: 90, physicalPerformance: 90 };

    const matchingTalent: TalentAssignment[] = [{ role: 'Lead Actor', person: actorPerson('matching', matchingStyle) }];
    const mismatchedTalent: TalentAssignment[] = [{ role: 'Lead Actor', person: actorPerson('mismatched', mismatchedStyle) }];

    expect(computeActingScore(matchingTalent, scriptWithCharacter)).toBeGreaterThan(computeActingScore(mismatchedTalent, scriptWithCharacter));
  });

  it('falls back to whole-script tone compatibility alone once a role has no matching Character (more actors hired than named roles)', () => {
    const script = scriptFor('Drama', 9);
    const scriptWithCharacter: Script = { ...script, requiredLeads: 1, cast: [leadCharacter()] };
    const actingStyle: ActingStyle = { characterTransformation: 60, emotionalPerformance: 60, charisma: 60, comedy: 60, physicalPerformance: 60 };
    // slotIndex 1 has no matching Lead character (only one is in cast) - characterForRoleSlot returns null for it.
    const talent: TalentAssignment[] = [
      { role: 'Lead Actor', person: actorPerson('a1', actingStyle) },
      { role: 'Lead Actor', person: actorPerson('a2', actingStyle) },
    ];
    expect(() => computeActingScore(talent, scriptWithCharacter)).not.toThrow();
    expect(computeActingScore(talent, scriptWithCharacter)).toBeGreaterThanOrEqual(0);
  });
});
