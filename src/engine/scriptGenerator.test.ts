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
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
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

        expect(SETTING_ARCHETYPE_PROFILES[script.primarySetting]).toBeDefined();

        const leads = script.cast.filter((c) => c.prominence === 'Lead');
        const supporting = script.cast.filter((c) => c.prominence === 'Supporting');
        const minor = script.cast.filter((c) => c.prominence === 'Minor');
        expect(leads.length).toBe(script.requiredLeads);
        expect(supporting.length).toBe(script.requiredSupporting);
        expect(minor.length).toBeGreaterThanOrEqual(0);
        expect(minor.length).toBeLessThanOrEqual(2);
        // Lead-then-Supporting-then-Minor ordering is a contract
        // (engine/castRequirements.ts:characterForRoleSlot relies on it) -
        // not just a coincidence of how generateCast happens to build the array.
        expect(script.cast.slice(0, leads.length).every((c) => c.prominence === 'Lead')).toBe(true);
        expect(script.cast.slice(leads.length, leads.length + supporting.length).every((c) => c.prominence === 'Supporting')).toBe(true);

        const characterIds = new Set(script.cast.map((c) => c.id));
        expect(characterIds.size).toBe(script.cast.length);
        for (const character of script.cast) {
          expect(character.name.length).toBeGreaterThan(0);
          for (const value of Object.values(character.traits)) {
            expect(value).toBeGreaterThanOrEqual(1);
            expect(value).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  it('never repeats a title within one slate', () => {
    const scripts = generateScriptOptions('Action', createRng(42), 12);
    const titles = new Set(scripts.map((s) => s.title));
    expect(titles.size).toBe(scripts.length);
  });

  it('shows near-unique synopses within a slate (slate-level de-dup)', () => {
    // The expanded, concept-aware premise pools plus per-slate de-dup make a
    // full 12-script slate show ~12 distinct log-lines. It can dip below 12
    // only when many scripts in one slate collapse onto the same narrow
    // concept pool (e.g. several same-setting Heists) - de-dup can't invent
    // log-lines a pool doesn't have. Assert the aggregate is very high and the
    // overwhelming majority of slates are perfectly unique, across every genre.
    let totalDistinct = 0;
    let slates = 0;
    let perfectSlates = 0;
    for (const genre of GENRES) {
      for (let seed = 1; seed <= 25; seed++) {
        const scripts = generateScriptOptions(genre, createRng(seed), 12);
        const distinct = new Set(scripts.map((s) => s.synopsis)).size;
        totalDistinct += distinct;
        slates += 1;
        if (distinct === scripts.length) perfectSlates += 1;
      }
    }
    expect(totalDistinct / slates).toBeGreaterThan(11.5); // avg distinct per 12-slate
    expect(perfectSlates / slates).toBeGreaterThan(0.8); // most slates fully unique
  });

  it('is deterministic - the same seed produces an identical slate, aside from the process-global id counters', () => {
    // Both `id` (nextScriptId) and each cast member's `id` (nextCharacterId)
    // are module-level monotonic counters, not derived from the rng - two
    // calls in the same test process never get the same ids even with an
    // identical seed, by design (ids just need to be unique within a
    // process, not reproducible). Every other field, including every other
    // ScriptCharacter field, is fully rng-derived and must match exactly.
    const stripId = (scripts: ReturnType<typeof generateScriptOptions>) =>
      scripts.map(({ id: _id, cast, ...rest }) => ({
        ...rest,
        cast: cast.map(({ id: _characterId, ...character }) => character),
      }));
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

  it("a script's periodSetting always matches its Setting Archetype's own periodSetting flag", () => {
    const sample = bigSample('Drama', 16, 300);
    for (const script of sample) {
      const setting = SETTING_ARCHETYPE_PROFILES[script.primarySetting];
      expect(script.productionRequirements.periodSetting).toBe(setting.periodSetting);
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

// Character and Setting Foundations milestone
// (docs/CHARACTER_AND_SETTING_FOUNDATIONS.md section 4) - Setting Archetype
// and Character Archetype generation are genre/story-type-weighted, not
// independent uniform rolls, mirroring the same coherence guarantee already
// tested above for Script Archetype/Story Type/production requirements.
describe('generateScriptOptions - genre-weighted Setting and Character generation', () => {
  it('Horror scripts land on Horror-affine settings (HauntedLocation/RuralWilderness/SingleInteriorLocation/SmallTown) far more often than Romance scripts do', () => {
    const horrorAffine = new Set(['HauntedLocation', 'RuralWilderness', 'SingleInteriorLocation', 'SmallTown']);
    const horror = bigSample('Horror', 20, 500);
    const romance = bigSample('Romance', 21, 500);
    const horrorFraction = horror.filter((s) => horrorAffine.has(s.primarySetting)).length / horror.length;
    const romanceFraction = romance.filter((s) => horrorAffine.has(s.primarySetting)).length / romance.length;
    expect(horrorFraction).toBeGreaterThan(romanceFraction);
  });

  it('Horror scripts cast Survivor/MonsterOrCreature/Outsider leads meaningfully more often than Romance scripts do', () => {
    const horrorAffineArchetypes = new Set(['Survivor', 'MonsterOrCreature', 'Outsider']);
    const horror = bigSample('Horror', 22, 500);
    const romance = bigSample('Romance', 23, 500);
    const fractionOf = (scripts: Script[]) => {
      const leads = scripts.flatMap((s) => s.cast.filter((c) => c.prominence === 'Lead'));
      return leads.filter((c) => horrorAffineArchetypes.has(c.archetype)).length / leads.length;
    };
    expect(fractionOf(horror)).toBeGreaterThan(fractionOf(romance));
  });

  it('LoveInterest characters appear meaningfully more often in Romance scripts than in War scripts', () => {
    const romance = bigSample('Romance', 24, 500);
    const war = bigSample('Drama', 25, 500).filter((s) => s.storyType === 'War');
    const fractionOf = (scripts: Script[]) => {
      const totalCast = scripts.flatMap((s) => s.cast);
      if (totalCast.length === 0) return 0;
      return totalCast.filter((c) => c.archetype === 'LoveInterest').length / totalCast.length;
    };
    expect(war.length).toBeGreaterThan(0);
    expect(fractionOf(romance)).toBeGreaterThan(fractionOf(war));
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
