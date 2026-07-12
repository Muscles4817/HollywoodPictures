// Screenplay redesign (docs/DESIGN.md) - the first dedicated test coverage
// for script generation (there was none before this milestone - see that
// milestone's DESIGN.md note). Focused on the two things the redesign was
// actually asked to guarantee: every generated script is structurally valid
// (fields in range, distributions sum to 1), and the archetype-first
// pipeline actually produces coherent, differentiated concepts rather than
// independently-rolled numbers that happen to share a type.
import { describe, it, expect } from 'vitest';
import { generateScriptOptions, estimateScriptCost } from './scriptGenerator';
import { createRng } from './random';
import { GENRES } from '../data/genres';
import { SCRIPT_ARCHETYPES } from '../data/scriptArchetypes';
import { STORY_TYPES } from '../data/storyTypes';
import type { Genre, Script } from '../types';

/** A large same-genre sample to compute stable per-archetype/per-story-type/per-scale statistics from. */
function bigSample(genre: Genre, seed: number, count = 400): Script[] {
  return generateScriptOptions(genre, createRng(seed), count);
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

describe('generateScriptOptions - structural validity', () => {
  it('produces every field within its declared range, for every genre', () => {
    for (const genre of GENRES) {
      const scripts = generateScriptOptions(genre, createRng(1), 12);
      for (const script of scripts) {
        expect(script.genre).toBe(genre);
        for (const stat of [script.originality, script.structure, script.characters, script.dialogue, script.complexity]) {
          expect(stat).toBeGreaterThanOrEqual(1);
          expect(stat).toBeLessThanOrEqual(100);
        }
        expect(SCRIPT_ARCHETYPES).toContain(script.archetype);
        expect(STORY_TYPES).toContain(script.storyType);
        expect(script.cost).toBeGreaterThan(0);
        expect(script.requiredLeads).toBeGreaterThanOrEqual(1);
        expect(script.requiredSupporting).toBeGreaterThanOrEqual(0);

        const req = script.productionRequirements;
        for (const intensity of [req.extras, req.locations, req.practicalEffects, req.vfx, req.stunts, req.choreography, req.crowdWork]) {
          expect(intensity).toBeGreaterThanOrEqual(0);
          expect(intensity).toBeLessThanOrEqual(1);
        }
        expect(typeof req.periodSetting).toBe('boolean');
        expect(typeof req.vehicles).toBe('boolean');
        expect(typeof req.animals).toBe('boolean');

        const envTotal = script.environmentStrategy.studio + script.environmentStrategy.location + script.environmentStrategy.digital;
        expect(envTotal).toBeCloseTo(1, 5);
        const fxTotal = script.effectsStrategy.practical + script.effectsStrategy.digital;
        expect(fxTotal).toBeCloseTo(1, 5);
        expect(script.environmentAmbition).toBeGreaterThanOrEqual(0);
        expect(script.environmentAmbition).toBeLessThanOrEqual(1);
        expect(script.effectsAmbition).toBeGreaterThanOrEqual(0);
        expect(script.effectsAmbition).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never repeats a title within one slate', () => {
    const scripts = generateScriptOptions('Action', createRng(42), 12);
    const titles = new Set(scripts.map((s) => s.title));
    expect(titles.size).toBe(scripts.length);
  });

  it('is deterministic - the same seed produces an identical slate, aside from the process-global id counter', () => {
    // `id` is a module-level monotonic counter (nextScriptId), not derived
    // from the rng - two calls in the same test process never get the same
    // ids even with an identical seed, by design (ids just need to be
    // unique within a process, not reproducible). Every other field is
    // fully rng-derived and must match exactly.
    const stripId = (scripts: ReturnType<typeof generateScriptOptions>) => scripts.map(({ id: _id, ...rest }) => rest);
    const a = generateScriptOptions('Drama', createRng(777), 12);
    const b = generateScriptOptions('Drama', createRng(777), 12);
    expect(stripId(a)).toEqual(stripId(b));
  });
});

describe('archetype-first generation actually shapes the quality profile', () => {
  it("Spectacle scripts average meaningfully higher complexity than Prestige scripts", () => {
    const sample = [
      ...bigSample('Action', 1), ...bigSample('Sci-Fi', 2), ...bigSample('Drama', 3), ...bigSample('Comedy', 4),
    ];
    const spectacleComplexity = average(sample.filter((s) => s.archetype === 'Spectacle').map((s) => s.complexity));
    const prestigeComplexity = average(sample.filter((s) => s.archetype === 'Prestige').map((s) => s.complexity));
    expect(spectacleComplexity).toBeGreaterThan(prestigeComplexity + 15);
  });

  it('Prestige scripts average meaningfully higher Characters/Dialogue than GenreFormula scripts', () => {
    const sample = [...bigSample('Drama', 5), ...bigSample('Romance', 6), ...bigSample('Comedy', 7)];
    const prestige = sample.filter((s) => s.archetype === 'Prestige');
    const formula = sample.filter((s) => s.archetype === 'GenreFormula');
    expect(average(prestige.map((s) => s.characters))).toBeGreaterThan(average(formula.map((s) => s.characters)) + 15);
    expect(average(prestige.map((s) => s.dialogue))).toBeGreaterThan(average(formula.map((s) => s.dialogue)) + 15);
  });

  it('OriginalVision scripts average meaningfully higher originality than GenreFormula scripts', () => {
    const sample = [...bigSample('Sci-Fi', 8), ...bigSample('Horror', 9), ...bigSample('Thriller', 10)];
    const original = sample.filter((s) => s.archetype === 'OriginalVision');
    const formula = sample.filter((s) => s.archetype === 'GenreFormula');
    expect(average(original.map((s) => s.originality))).toBeGreaterThan(average(formula.map((s) => s.originality)) + 25);
  });

  it('archetype genre affinity is real - Action rolls Spectacle far more often than Prestige, Drama is the reverse', () => {
    const action = bigSample('Action', 11, 300);
    const drama = bigSample('Drama', 12, 300);
    const actionSpectacleShare = action.filter((s) => s.archetype === 'Spectacle').length / action.length;
    const actionPrestigeShare = action.filter((s) => s.archetype === 'Prestige').length / action.length;
    const dramaSpectacleShare = drama.filter((s) => s.archetype === 'Spectacle').length / drama.length;
    const dramaPrestigeShare = drama.filter((s) => s.archetype === 'Prestige').length / drama.length;
    expect(actionSpectacleShare).toBeGreaterThan(actionPrestigeShare);
    expect(dramaPrestigeShare).toBeGreaterThan(dramaSpectacleShare);
  });
});

describe('production requirements emerge from the concept, not independently', () => {
  it('Documentary scripts average a meaningfully smaller cast than the overall average', () => {
    const sample = bigSample('Drama', 13, 500);
    const documentaries = sample.filter((s) => s.storyType === 'Documentary');
    expect(documentaries.length).toBeGreaterThan(0);
    const docAvgCast = average(documentaries.map((s) => s.requiredLeads + s.requiredSupporting));
    const overallAvgCast = average(sample.map((s) => s.requiredLeads + s.requiredSupporting));
    expect(docAvgCast).toBeLessThan(overallAvgCast);
  });

  it('Superhero scripts average meaningfully higher VFX intensity than Documentary scripts', () => {
    const sample = [...bigSample('Action', 14, 400), ...bigSample('Sci-Fi', 15, 400)];
    const superhero = sample.filter((s) => s.storyType === 'Superhero');
    const documentary = sample.filter((s) => s.storyType === 'Documentary');
    expect(superhero.length).toBeGreaterThan(0);
    expect(documentary.length).toBeGreaterThan(0);
    expect(average(superhero.map((s) => s.productionRequirements.vfx))).toBeGreaterThan(
      average(documentary.map((s) => s.productionRequirements.vfx)) + 0.3,
    );
  });

  it('Historical-setting scripts always carry periodSetting: true; Modern-setting scripts never do', () => {
    const sample = bigSample('Drama', 16, 300);
    for (const script of sample) {
      if (script.setting === 'Historical') expect(script.productionRequirements.periodSetting).toBe(true);
      if (script.setting === 'Modern') expect(script.productionRequirements.periodSetting).toBe(false);
    }
  });

  it('Epic-scale scripts cost meaningfully more on average than Intimate-scale scripts, holding genre fixed', () => {
    const sample = bigSample('Action', 17, 500);
    const epic = sample.filter((s) => s.scale === 'Epic');
    const intimate = sample.filter((s) => s.scale === 'Intimate');
    expect(epic.length).toBeGreaterThan(0);
    expect(intimate.length).toBeGreaterThan(0);
    expect(average(epic.map((s) => s.cost))).toBeGreaterThan(average(intimate.map((s) => s.cost)) * 1.3);
  });
});

describe('estimateScriptCost', () => {
  const base = { originality: 50, structure: 50, dialogue: 50, characters: 50, scale: 'Medium' as const, complexity: 50 };

  it('increases with average craft quality, holding scale/complexity fixed', () => {
    const low = estimateScriptCost({ ...base, originality: 20, structure: 20, dialogue: 20, characters: 20 });
    const high = estimateScriptCost({ ...base, originality: 90, structure: 90, dialogue: 90, characters: 90 });
    expect(high).toBeGreaterThan(low);
  });

  it('increases with scale, holding craft/complexity fixed', () => {
    const intimate = estimateScriptCost({ ...base, scale: 'Intimate' });
    const epic = estimateScriptCost({ ...base, scale: 'Epic' });
    expect(epic).toBeGreaterThan(intimate);
  });

  it('increases with complexity, holding craft/scale fixed', () => {
    const low = estimateScriptCost({ ...base, complexity: 10 });
    const high = estimateScriptCost({ ...base, complexity: 100 });
    expect(high).toBeGreaterThan(low);
  });
});
