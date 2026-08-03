// Casting Appeal Rework - director interest. Before this file existed,
// Director hiring (components/wizard/RoleHiringDrawer.tsx) had no interest
// step at all: any director in a studio's price band attached instantly on
// click, regardless of how implausible it'd be for a fame-95 A-lister to
// take a no-name studio's call.
import { describe, it, expect } from 'vitest';
import { computeDirectorAppeal, computeDirectorAppetite, resolveDirectorOfferResponse } from './directorAppeal';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { Genre, Person, Script, Studio, ToneProfile } from '../types';

function scriptFor(seed: number): Script {
  return generateScriptOptions('Drama', createRng(seed), 1)[0];
}

function scriptOfGenre(genre: Genre, seed: number): Script {
  return generateScriptOptions(genre, createRng(seed), 1)[0];
}

const FLAT_TONE: ToneProfile = { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 };

/**
 * The tone that maximally opposes a script's emphasis - 0 on every axis the
 * script leans on, 100 on every axis it doesn't. A director tuned to this is a
 * genuine, unambiguous taste misfit whatever the generated script looks like
 * (a linear 100-v complement wouldn't be: an axis near 50 has a near-50
 * complement, i.e. almost no distance where the tone-fit metric weights it).
 */
function complementTone(tone: ToneProfile): ToneProfile {
  const opp = (v: number) => (v > 50 ? 0 : 100);
  return { action: opp(tone.action), comedy: opp(tone.comedy), romance: opp(tone.romance), suspense: opp(tone.suspense), drama: opp(tone.drama), spectacle: opp(tone.spectacle) };
}

function studio(overrides: Partial<Studio> = {}): Studio {
  return { name: 'Test Studio', cash: 10_000_000, brand: 50, prestige: 50, assets: [], intellectualProperties: [], ...overrides };
}

function directorPerson(
  id: string,
  overrides: {
    reputation?: Partial<Person['reputation']>;
    personality?: Partial<Person['personality']>;
    minimumSalary?: number;
    typicalSalary?: number;
    bookedUntil?: number;
    toneProfile?: ToneProfile;
    productionStyle?: { environmentStrategy?: Record<string, number>; effectsStrategy?: Record<string, number> };
  } = {},
): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50, ...overrides.personality },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50, ...overrides.reputation },
    availability: { commitments: overrides.bookedUntil ? [{ projectId: 'p', role: 'Director', startDay: 1, endDay: overrides.bookedUntil }] : [] },
    traits: [],
    primaryRole: 'Director',
    careers: {
      director: {
        role: 'Director', active: true, experience: 50, roleReputation: 50,
        minimumSalary: overrides.minimumSalary ?? 200_000, typicalSalary: overrides.typicalSalary ?? 2_000_000,
        skill: 50,
        toneProfile: overrides.toneProfile ?? { ...FLAT_TONE },
        productionStyle: {
          environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33, ...overrides.productionStyle?.environmentStrategy },
          effectsStrategy: { practical: 0.5, digital: 0.5, ...overrides.productionStyle?.effectsStrategy },
        },
      },
    },
  };
}

function actorOnlyPerson(id: string): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {
      actor: {
        role: 'Actor', active: true, experience: 50, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 1_000_000,
        actingStyle: { characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50 },
      },
    },
  };
}

describe('computeDirectorAppeal', () => {
  it('returns null for a person with no Director career', () => {
    const result = computeDirectorAppeal(actorOnlyPerson('not-a-director'), scriptFor(1), studio(), 500_000, 1);
    expect(result).toBeNull();
  });

  it("returns 'prestige-gate' for a high-fame director at a low-prestige studio, regardless of script quality or salary", () => {
    const script = scriptFor(2);
    const aLister = directorPerson('a-lister', { reputation: { fame: 95 } });
    const noNameStudio = studio({ prestige: 10 });
    const result = computeDirectorAppeal(aLister, script, noNameStudio, 50_000_000, 1);
    expect(result).toBe('prestige-gate');
  });

  it('clears the prestige gate and scores normally once studio prestige is high enough for this director\'s fame', () => {
    const script = scriptFor(3);
    const aLister = directorPerson('a-lister2', { reputation: { fame: 95 } });
    const majorStudio = studio({ prestige: 90 });
    const result = computeDirectorAppeal(aLister, script, majorStudio, 2_000_000, 1);
    expect(result).not.toBe('prestige-gate');
    expect(result).not.toBeNull();
  });

  it('a low-fame director never hits the prestige gate, even at a brand-new studio', () => {
    const script = scriptFor(4);
    const unknown = directorPerson('unknown-director', { reputation: { fame: 5 } });
    const newStudio = studio({ prestige: 20 });
    const result = computeDirectorAppeal(unknown, script, newStudio, 500_000, 1);
    expect(result).not.toBe('prestige-gate');
  });

  it('every numeric factor and the overall score stay within [0, 100] once past the gate', () => {
    const script = scriptFor(5);
    const director = directorPerson('range-check', { reputation: { fame: 40 } });
    const result = computeDirectorAppeal(director, script, studio({ prestige: 90, brand: 100 }), 100, 1);
    expect(result).not.toBe('prestige-gate');
    expect(result).not.toBeNull();
    if (result && result !== 'prestige-gate') {
      for (const value of [result.scriptFit, result.brandFit, result.prestigeFit, result.salaryFit, result.overall]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('salaryFit reads ~85 exactly at typicalSalary, mirroring the actor path', () => {
    const script = scriptFor(6);
    const director = directorPerson('salary-check', { reputation: { fame: 10 }, minimumSalary: 200_000, typicalSalary: 2_000_000 });
    const result = computeDirectorAppeal(director, script, studio(), 2_000_000, 1);
    expect(result).not.toBe('prestige-gate');
    expect(result).not.toBeNull();
    if (result && result !== 'prestige-gate') expect(result.salaryFit).toBe(85);
  });
});

describe('computeDirectorAppetite (personal script/package reaction)', () => {
  it('returns a neutral 50 for a person with no Director career', () => {
    expect(computeDirectorAppetite(actorOnlyPerson('no-career'), scriptFor(20))).toBe(50);
  });

  it('stays within [0, 100]', () => {
    const director = directorPerson('range', { toneProfile: { action: 0, comedy: 0, romance: 0, suspense: 0, drama: 100, spectacle: 0 } });
    const appetite = computeDirectorAppetite(director, scriptOfGenre('Action', 21));
    expect(appetite).toBeGreaterThanOrEqual(0);
    expect(appetite).toBeLessThanOrEqual(100);
  });

  it('a director whose taste matches the script wants it more than one whose taste is opposed', () => {
    const script = scriptOfGenre('Action', 22);
    // An action/spectacle script: the action-tuned director should have a
    // markedly higher appetite than a quiet-drama director, all else equal.
    const actionDirector = directorPerson('action', { toneProfile: { action: 95, comedy: 30, romance: 20, suspense: 60, drama: 40, spectacle: 90 } });
    const dramaDirector = directorPerson('drama', { toneProfile: { action: 15, comedy: 20, romance: 60, suspense: 40, drama: 95, spectacle: 10 } });
    expect(computeDirectorAppetite(actionDirector, script)).toBeGreaterThan(computeDirectorAppetite(dramaDirector, script));
  });

  it('the same director reacts differently to different scripts (not a global constant)', () => {
    const director = directorPerson('mixed', { toneProfile: { action: 90, comedy: 20, romance: 20, suspense: 50, drama: 30, spectacle: 85 } });
    const action = computeDirectorAppetite(director, scriptOfGenre('Action', 23));
    const romance = computeDirectorAppetite(director, scriptOfGenre('Romance', 23));
    expect(action).not.toBeCloseTo(romance, 1);
  });

  it('a production-method mismatch lowers appetite (practical director vs an all-digital script)', () => {
    const script = scriptOfGenre('Action', 24);
    const digitalScript: Script = {
      ...script,
      effectsStrategy: { practical: 0, digital: 1 },
      environmentStrategy: { studio: 0, location: 0, digital: 1 },
    };
    const practicalDirector = directorPerson('practical', {
      toneProfile: { ...FLAT_TONE },
      productionStyle: { effectsStrategy: { practical: 1, digital: 0 }, environmentStrategy: { studio: 0, location: 1, digital: 0 } },
    });
    const digitalDirector = directorPerson('digital', {
      toneProfile: { ...FLAT_TONE },
      productionStyle: { effectsStrategy: { practical: 0, digital: 1 }, environmentStrategy: { studio: 0, location: 0, digital: 1 } },
    });
    expect(computeDirectorAppetite(digitalDirector, digitalScript)).toBeGreaterThan(computeDirectorAppetite(practicalDirector, digitalScript));
  });

  it('a high-ego director recoils from off-taste material harder than a low-ego one would', () => {
    const script = scriptOfGenre('Comedy', 25);
    // Both directors are the script's exact tonal opposite; ego widens the misfit.
    const offTaste = complementTone(script.toneProfile);
    const proud = directorPerson('proud', { personality: { ego: 95 }, toneProfile: { ...offTaste } });
    const humble = directorPerson('humble', { personality: { ego: 5 }, toneProfile: { ...offTaste } });
    expect(computeDirectorAppetite(proud, script)).toBeLessThan(computeDirectorAppetite(humble, script));
  });
});

describe('individual creatives react to the package (offer path)', () => {
  it('a rich, prestigious studio can still be turned down on the wrong film for a proud auteur', () => {
    // The exact complaint Phase A fixes: prestige + money used to be enough.
    const script = scriptOfGenre('Comedy', 30);
    const auteur = directorPerson('serious-auteur', {
      reputation: { fame: 60, prestige: 80 },
      personality: { ego: 92, ambition: 70 },
      // The script's exact tonal opposite: genuinely not their film.
      toneProfile: complementTone(script.toneProfile),
      minimumSalary: 500_000,
      typicalSalary: 3_000_000,
    });
    const richStudio = studio({ prestige: 95, brand: 95, cash: 500_000_000 });
    const outcome = computeDirectorAppeal(auteur, script, richStudio, 8_000_000, 1);
    const response = resolveDirectorOfferResponse(outcome, auteur);
    expect(response).toEqual({ status: 'rejected', reason: 'script-fit' });
  });
});

describe('resolveDirectorOfferResponse', () => {
  it('rejects with the prestige-gate reason before any other consideration', () => {
    const script = scriptFor(7);
    const aLister = directorPerson('a-lister3', { reputation: { fame: 95 } });
    const noNameStudio = studio({ prestige: 10 });
    const outcome = computeDirectorAppeal(aLister, script, noNameStudio, 50_000_000, 1);
    const response = resolveDirectorOfferResponse(outcome, aLister);
    expect(response).toEqual({ status: 'rejected', reason: 'prestige-gate' });
  });

  it('accepts a generous, well-matched offer once the prestige gate is cleared', () => {
    const script = scriptFor(8);
    const director = directorPerson('acceptor', { reputation: { fame: 20, prestige: 20 }, personality: { ego: 5 }, minimumSalary: 200_000, typicalSalary: 1_000_000 });
    const majorStudio = studio({ prestige: 90, brand: 90 });
    const outcome = computeDirectorAppeal(director, script, majorStudio, 5_000_000, 1);
    const response = resolveDirectorOfferResponse(outcome, director);
    expect(response?.status).toBe('accepted');
  });

  it('returns null when computeDirectorAppeal itself returned null (no Director career)', () => {
    const outcome = computeDirectorAppeal(actorOnlyPerson('no-career'), scriptFor(9), studio(), 500_000, 1);
    expect(resolveDirectorOfferResponse(outcome, actorOnlyPerson('no-career'))).toBeNull();
  });
});
