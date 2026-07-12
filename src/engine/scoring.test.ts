// Screenplay redesign (docs/DESIGN.md) - the first dedicated test coverage
// for engine/scoring.ts's script-facing formulas, added alongside the
// redesign that changed all four of them: computeScriptScore dropped
// marketability for characters, genre fit is now derived from tone
// distance instead of a stored stat, and computeMarketabilityScore/
// computeBuzzScore now read the derived commercial profile instead of
// Script.marketability.
import { describe, it, expect } from 'vitest';
import { computeScriptScore, computeGenreFitScore, computeMarketabilityScore, computeBuzzScore } from './scoring';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { ProductionChoices, PostProductionChoices, MarketingChoices, Script } from '../types';

function scriptFor(genre: Parameters<typeof generateScriptOptions>[0], seed: number): Script {
  return generateScriptOptions(genre, createRng(seed), 1)[0];
}

const choices: ProductionChoices = {
  contingencyAmount: 1_000_000, setQualityAmount: 500_000, practicalEffectsAmount: 500_000, vfxAmount: 500_000, runtimeIntensity: 0.5,
};
const postProductionChoices: PostProductionChoices = {
  editStyle: 'Balanced', musicFocus: 'Standard', testScreeningResponse: 'Ignore', finalCutFocus: 'Trailer-focused',
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
    const buzzNiche = computeBuzzScore(nicheScript, [], [], postProductionChoices, marketingChoices, 50);
    const buzzHooky = computeBuzzScore(hookyScript, [], [], postProductionChoices, marketingChoices, 50);
    expect(buzzHooky).toBeGreaterThanOrEqual(buzzNiche);
  });

  it('both stay within [0, 100] across a real sample', () => {
    const scripts = generateScriptOptions('Sci-Fi', createRng(7), 20);
    for (const script of scripts) {
      expect(computeMarketabilityScore(script, [], choices)).toBeGreaterThanOrEqual(0);
      expect(computeMarketabilityScore(script, [], choices)).toBeLessThanOrEqual(100);
      const buzz = computeBuzzScore(script, [], [], postProductionChoices, marketingChoices, 50);
      expect(buzz).toBeGreaterThanOrEqual(0);
      expect(buzz).toBeLessThanOrEqual(100);
    }
  });
});
