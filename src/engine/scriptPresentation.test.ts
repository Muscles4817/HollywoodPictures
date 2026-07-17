// QoL pass (docs/DESIGN.md) - extracted from components/wizard/DevelopFilm.tsx
// so components/common/ScriptSummaryCard.tsx and FilmDetailModal.tsx could
// share the same derivations; this is the first direct (non-component)
// test coverage for them.
import { describe, it, expect } from 'vitest';
import { productionRequirementTags, describeCommercialAppeal, describeCostDrivers } from './scriptPresentation';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { Script } from '../types';

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

  it('cites epic scale as a cost driver for an Epic-scale script', () => {
    const base = scriptFor('Action', 7);
    const epic: Script = { ...base, scale: 'Epic', complexity: 10, originality: 10, structure: 10, characters: 10, dialogue: 10 };
    expect(describeCostDrivers(epic)).toContain('epic scale');
  });

  it('falls back to "a modest, straightforward production" when nothing stands out', () => {
    const base = scriptFor('Drama', 8);
    const modest: Script = { ...base, scale: 'Intimate', complexity: 10, originality: 10, structure: 10, characters: 10, dialogue: 10 };
    expect(describeCostDrivers(modest)).toBe('A modest, straightforward production.');
  });
});
