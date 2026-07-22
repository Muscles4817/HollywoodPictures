import { describe, it, expect } from 'vitest';
import { evaluateIpViability, type IpViabilityWorld } from './ipViability';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import { createInitialStudio } from '../state/gameState';
import type { CharacterArchetype, CharacterProminence, CharacterTraitProfile, Film, Person, ScriptCharacter, SettingArchetype, Studio, TalentProfession } from '../types';

const EMPTY_WORLD: IpViabilityWorld = { talentPool: {} as Record<TalentProfession, Person[]> };

function traits(overrides: Partial<CharacterTraitProfile> = {}): CharacterTraitProfile {
  return {
    dramaticDepth: 50, charismaDemand: 50, comedyDemand: 50, emotionalDemand: 50, physicalDemand: 50,
    transformationDemand: 50, audienceAccessibility: 50, distinctiveness: 50, merchandisePotential: 50, ...overrides,
  };
}

function character(id: string, prominence: CharacterProminence, archetype: CharacterArchetype, traitOverrides: Partial<CharacterTraitProfile> = {}): ScriptCharacter {
  return { id, name: id, archetype, prominence, castingGender: 'Any', traits: traits(traitOverrides) };
}

interface FilmOverrides {
  cast?: ScriptCharacter[];
  setting?: SettingArchetype;
  releasedOnDay?: number;
  results?: Partial<Film['results']>;
  talent?: Film['talent'];
  scriptPatch?: Partial<Film['script']>;
}

function makeFilm(o: FilmOverrides = {}): Film {
  const base = generateScriptOptions('Action', createRng(1), 1)[0];
  const script = {
    ...base,
    ...(o.setting ? { primarySetting: o.setting } : {}),
    ...(o.cast ? { cast: o.cast } : {}),
    ...(o.scriptPatch ?? {}),
  };
  return {
    id: 'film-1', title: 'The Film', genre: 'Action', releasedOnDay: o.releasedOnDay ?? 1, talent: o.talent ?? [],
    script,
    results: {
      productionCost: 30_000_000, marketingCost: 20_000_000, totalCost: 50_000_000, openingWeekend: 25_000_000,
      totalBoxOffice: 150_000_000, studioRevenue: 75_000_000, profit: 25_000_000, outcome: 'Hit', brandChange: 3, prestigeChange: 2,
      criticScore: 65, audienceScore: 70, buzzScore: 55, qualityScore: 62,
      scriptScore: 60, directionScore: 60, actingScore: 60, productionScore: 60, postProductionScore: 60, eventsScore: 50,
      reviewBlurbs: [], storyReport: '',
      ...(o.results ?? {}),
    },
    boxOfficeRun: { cumulativeGross: 150_000_000 },
  } as unknown as Film;
}

const STUDIO = createInitialStudio(200_000_000);

describe('evaluateIpViability', () => {
  it('is deterministic - same inputs always give the same assessment', () => {
    const film = makeFilm();
    const a = evaluateIpViability(film, STUDIO, EMPTY_WORLD, 400);
    const b = evaluateIpViability(film, STUDIO, EMPTY_WORLD, 400);
    expect(a).toEqual(b);
  });

  it('never mutates the film or studio it inspects', () => {
    const film = makeFilm();
    const filmBefore = JSON.stringify(film);
    const studioBefore = JSON.stringify(STUDIO);
    evaluateIpViability(film, STUDIO, EMPTY_WORLD, 400);
    expect(JSON.stringify(film)).toBe(filmBefore);
    expect(JSON.stringify(STUDIO)).toBe(studioBefore);
  });

  it('separates inherent potential from current opportunity - a faded film keeps its potential but loses its timing', () => {
    const film = makeFilm({ releasedOnDay: 1 });
    const fresh = evaluateIpViability(film, STUDIO, EMPTY_WORLD, 30); // released ~a month ago
    const faded = evaluateIpViability(film, STUDIO, EMPTY_WORLD, 30 + 5 * 365); // five years later

    // Inherent material is unchanged by time...
    expect(faded.inherentPotential).toBe(fresh.inherentPotential);
    // ...but the moment has passed.
    expect(faded.currentOpportunity).toBeLessThan(fresh.currentOpportunity);
    expect(faded.concerns.some((c) => /awareness has faded/i.test(c))).toBe(true);
  });

  it('flags a distinctive Lead as a breakout but not an equally-distinctive Minor', () => {
    const strongTraits = { distinctiveness: 95, merchandisePotential: 90, audienceAccessibility: 85 };
    const film = makeFilm({
      cast: [
        character('hero', 'Lead', 'ReluctantHero', strongTraits),
        character('extra', 'Minor', 'EnsembleMember', strongTraits),
      ],
    });
    const a = evaluateIpViability(film, STUDIO, EMPTY_WORLD, 100);
    const hero = a.characters.find((c) => c.characterId === 'hero')!;
    const extra = a.characters.find((c) => c.characterId === 'extra')!;
    expect(hero.breakout).toBe(true);
    expect(extra.breakout).toBe(false);
    expect(a.strengths.some((s) => /hero/.test(s))).toBe(true);
  });

  it('recognises a memorable antagonist as a breakout even from a Supporting slot', () => {
    const film = makeFilm({
      cast: [
        character('lead', 'Lead', 'IdealisticHero', { distinctiveness: 40, merchandisePotential: 30 }),
        character('nemesis', 'Supporting', 'Villain', { distinctiveness: 95, merchandisePotential: 88, audienceAccessibility: 80 }),
      ],
    });
    const nemesis = evaluateIpViability(film, STUDIO, EMPTY_WORLD, 100).characters.find((c) => c.characterId === 'nemesis')!;
    expect(nemesis.breakout).toBe(true);
    expect(nemesis.note).toMatch(/antagonist/i);
  });

  it('weights character potential toward the breakout, not a flat average of the whole cast', () => {
    const film = makeFilm({
      cast: [
        character('star', 'Lead', 'ChosenOne', { distinctiveness: 95, merchandisePotential: 92, audienceAccessibility: 88 }),
        character('m1', 'Minor', 'EnsembleMember', { distinctiveness: 10, merchandisePotential: 5, audienceAccessibility: 20 }),
        character('m2', 'Minor', 'EnsembleMember', { distinctiveness: 10, merchandisePotential: 5, audienceAccessibility: 20 }),
      ],
    });
    const a = evaluateIpViability(film, STUDIO, EMPTY_WORLD, 100);
    const star = a.characters.find((c) => c.characterId === 'star')!;
    // A flat mean would be dragged far below the star; the aggregate stays near the standout.
    expect(a.characterPotential).toBeGreaterThanOrEqual(star.potential - 1);
  });

  it('rates an expandable setting higher than a self-contained one', () => {
    const fantasy = evaluateIpViability(makeFilm({ setting: 'FantasyRealm' }), STUDIO, EMPTY_WORLD, 100);
    const contained = evaluateIpViability(makeFilm({ setting: 'SingleInteriorLocation' }), STUDIO, EMPTY_WORLD, 100);
    expect(fantasy.settingPotential).toBeGreaterThan(contained.settingPotential);
  });

  it('raises a finances concern when the studio can barely afford another production', () => {
    const film = makeFilm({ results: { totalCost: 120_000_000 } });
    const broke = { ...STUDIO, cash: 5_000_000 } as Studio;
    const a = evaluateIpViability(film, broke, EMPTY_WORLD, 100);
    expect(a.concerns.some((c) => /finances/i.test(c))).toBe(true);
    const flush = evaluateIpViability(film, { ...STUDIO, cash: 500_000_000 } as Studio, EMPTY_WORLD, 100);
    // A cash-rich studio faces less cost risk for the same film.
    expect(flush.costRisk).toBeLessThan(a.costRisk);
  });

  it('reflects whether the original leads are still available', () => {
    const lead: Person = {
      id: 'p-lead',
      availability: { commitments: [{ projectId: 'x', role: 'Lead Actor', startDay: 1, endDay: 9_999 }] },
    } as unknown as Person;
    const film = makeFilm({ talent: [{ role: 'Lead Actor', person: lead }] });
    const world: IpViabilityWorld = { talentPool: { Actor: [lead] } as unknown as Record<TalentProfession, Person[]> };
    const a = evaluateIpViability(film, STUDIO, world, 100); // lead booked until 9999
    expect(a.concerns.some((c) => /tied up/i.test(c))).toBe(true);
  });
});
