// QoL pass (docs/DESIGN.md) - extracted from components/wizard/DevelopFilm.tsx
// so components/common/ScriptSummaryCard.tsx and FilmDetailModal.tsx could
// share the same derivations; this is the first direct (non-component)
// test coverage for them.
import { describe, it, expect } from 'vitest';
import { productionRequirementTags, describeCommercialAppeal, describeCostDrivers,
  describeProductionComplexity, roleDemandProfile } from './scriptPresentation';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { Script, ScriptCharacter } from '../types';

function scriptFor(genre: Parameters<typeof generateScriptOptions>[0], seed: number): Script {
  return generateScriptOptions(genre, createRng(seed), 1)[0];
}

describe('productionRequirementTags', () => {
  it('never returns an empty list - falls back to a "contained, straightforward" tag', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const script = scriptFor('Drama', seed);
      expect(productionRequirementTags(script).length).toBeGreaterThan(0);
    }
  });

  it('tags Period Costumes and Period Sets together, only when the screenplay is set in a Historical period', () => {
    const historical: Script = { ...scriptFor('Drama', 2), primarySetting: 'HistoricalCity', productionRequirements: { ...scriptFor('Drama', 2).productionRequirements, periodSetting: true } };
    const modern: Script = { ...scriptFor('Drama', 2), primarySetting: 'ContemporaryCity', productionRequirements: { ...scriptFor('Drama', 2).productionRequirements, periodSetting: false } };
    expect(productionRequirementTags(historical)).toEqual(expect.arrayContaining(['Period Costumes', 'Period Sets']));
    expect(productionRequirementTags(modern)).not.toEqual(expect.arrayContaining(['Period Costumes']));
  });

  it('tags Constructed Worlds only when the Setting Archetype carries heavy VFX-environment demand', () => {
    const base = scriptFor('Sci-Fi', 3);
    const heavy: Script = { ...base, primarySetting: 'SpacecraftOrStation' };
    const light: Script = { ...base, primarySetting: 'SingleInteriorLocation' };
    expect(productionRequirementTags(heavy)).toContain('Constructed Worlds');
    expect(productionRequirementTags(light)).not.toContain('Constructed Worlds');
  });

  it('tags Heavy VFX only once vfx intensity crosses the heavy threshold', () => {
    const base = scriptFor('Action', 4);
    const lowVfx: Script = { ...base, productionRequirements: { ...base.productionRequirements, vfx: 0.1 } };
    const highVfx: Script = { ...base, productionRequirements: { ...base.productionRequirements, vfx: 0.9 } };
    expect(productionRequirementTags(lowVfx)).not.toContain('Heavy VFX');
    expect(productionRequirementTags(highVfx)).toContain('Heavy VFX');
  });

  it('tags Musical Numbers for a Musical story type and Nonfiction Format for a Documentary story type', () => {
    const base = scriptFor('Comedy', 5);
    const musical: Script = { ...base, storyType: 'Musical' };
    const documentary: Script = { ...base, storyType: 'Documentary' };
    expect(productionRequirementTags(musical)).toContain('Musical Numbers');
    expect(productionRequirementTags(documentary)).toContain('Nonfiction Format');
  });
});

describe('describeCommercialAppeal', () => {
  it('always returns a non-empty sentence', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(describeCommercialAppeal(scriptFor('Action', seed)).length).toBeGreaterThan(0);
    }
  });

  it('describes broad mainstream appeal for a Spectacle/Epic/Mass-Market concept', () => {
    const base = scriptFor('Action', 6);
    const broad: Script = { ...base, archetype: 'Spectacle', scale: 'Epic', genre: 'Action' };
    expect(describeCommercialAppeal(broad)).toContain('broad mainstream appeal');
  });
});

describe('describeCostDrivers', () => {
  it('always returns a non-empty sentence', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(describeCostDrivers(scriptFor('Drama', seed)).length).toBeGreaterThan(0);
    }
  });

  it('leads on broad commercial potential for a wide-open Spectacle/Epic concept', () => {
    const base = scriptFor('Action', 7);
    const broad: Script = { ...base, archetype: 'Spectacle', scale: 'Epic', genre: 'Action', complexity: 10, originality: 10, structure: 10, characters: 10, dialogue: 10 };
    expect(describeCostDrivers(broad)).toContain('broad commercial potential');
  });

  it('tells the player a narrow concept is CHEAP, rather than only saying what it lacks', () => {
    const base = scriptFor('Drama', 8);
    const narrow: Script = { ...base, archetype: 'Prestige', scale: 'Intimate', primarySetting: 'SingleInteriorLocation', complexity: 10, originality: 10, structure: 10, characters: 10, dialogue: 10 };
    expect(describeCostDrivers(narrow)).toContain('narrow commercial ceiling keeps the price down');
  });

  it('names craft as a premium ON the ceiling, never as the headline reason for the price', () => {
    const base = scriptFor('Drama', 9);
    const brilliantButNarrow: Script = { ...base, archetype: 'Prestige', scale: 'Intimate', primarySetting: 'SingleInteriorLocation', complexity: 10, originality: 95, structure: 95, characters: 95, dialogue: 95 };
    const sentence = describeCostDrivers(brilliantButNarrow);
    // Craft is always the subordinate clause - the sentence opens on what the
    // concept could earn, because that is what the price is actually built from.
    expect(sentence).toContain('with a premium for exceptional craft');
    expect(sentence.startsWith('Priced for')).toBe(false);
  });
});

describe('describeProductionComplexity', () => {
  it('reads a contained script as a simple shoot, never as a creative shortcoming', () => {
    const base = scriptFor('Drama', 10);
    expect(describeProductionComplexity({ ...base, complexity: 8 })).toBe('A simple shoot - little here can go expensively wrong.');
  });

  it('escalates with complexity', () => {
    const base = scriptFor('Action', 11);
    expect(describeProductionComplexity({ ...base, complexity: 90 })).toContain('difficult shoot');
    expect(describeProductionComplexity({ ...base, complexity: 50 })).toContain('manageable shoot');
  });
});

describe('roleDemandProfile', () => {
  const character = {
    id: 'c1', name: 'Lead', archetype: 'Other', prominence: 'Lead',
    traits: {
      dramaticDepth: 50, charismaDemand: 40, comedyDemand: 20, emotionalDemand: 90,
      physicalDemand: 60, transformationDemand: 75, audienceAccessibility: 50, distinctiveness: 50, merchandisePotential: 50,
    },
  } as ScriptCharacter;

  it('returns the five acting-relevant axes, strongest demand first, labelled as the fit breakdown labels them', () => {
    const rows = roleDemandProfile(character);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ label: 'Emotional Performance', value: 90 });
    expect(rows.map((r) => r.value)).toEqual([90, 75, 60, 40, 20]); // sorted, strongest demand first
    expect(rows.map((r) => r.label)).toContain('Character Transformation');
    // The non-acting demands (dramaticDepth/accessibility/…) are excluded.
    expect(rows.map((r) => r.label)).not.toContain('Dramatic Depth');
  });
});
