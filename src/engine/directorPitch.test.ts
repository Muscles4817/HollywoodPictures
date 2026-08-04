import { describe, it, expect } from 'vitest';
import { generateDirectorPitch, pitchRiskPosture, pitchBoldness, describePitch } from './directorPitch';
import { generateCreativeDemands } from './creativeDemands';
import { generateScriptOptions } from './scriptGenerator';
import { createRng } from './random';
import type { DomainAptitudes, Genre, Person, Script, ToneProfile } from '../types';

function scriptOfGenre(genre: Genre, seed: number): Script {
  return generateScriptOptions(genre, createRng(seed), 1)[0];
}

const FLAT_TONE: ToneProfile = { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 };

function pitchDirector(
  id: string,
  overrides: { ego?: number; handsOn?: number; toneProfile?: ToneProfile; aptitudes?: DomainAptitudes; productionStyle?: { environmentStrategy?: Record<string, number>; effectsStrategy?: Record<string, number> } } = {},
): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: overrides.ego ?? 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Director',
    careers: {
      director: {
        role: 'Director', active: true, experience: 50, roleReputation: 50, minimumSalary: 200_000, typicalSalary: 2_000_000,
        skill: 50,
        toneProfile: overrides.toneProfile ?? { ...FLAT_TONE },
        aptitudes: overrides.aptitudes,
        handsOn: overrides.handsOn,
        productionStyle: {
          environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33, ...overrides.productionStyle?.environmentStrategy },
          effectsStrategy: { practical: 0.5, digital: 0.5, ...overrides.productionStyle?.effectsStrategy },
        },
      },
    },
  };
}

describe('generateDirectorPitch', () => {
  it('is deterministic per (director, script)', () => {
    const director = pitchDirector('det', { ego: 70, toneProfile: { action: 80, comedy: 20, romance: 30, suspense: 90, drama: 60, spectacle: 40 } });
    const script = scriptOfGenre('Drama', 40);
    expect(generateDirectorPitch(director, script)).toEqual(generateDirectorPitch(director, script));
  });

  it('nudges the film toward the director\'s own taste (positive on axes they exceed, negative where they fall short)', () => {
    const script = scriptOfGenre('Drama', 41);
    // A suspense-forward, low-spectacle director on any script pushes suspense up
    // and spectacle down relative to the script.
    const director = pitchDirector('taste', { ego: 80, handsOn: 0.8, toneProfile: { action: 50, comedy: 50, romance: 50, suspense: 100, drama: 50, spectacle: 0 } });
    const pitch = generateDirectorPitch(director, script);
    expect(Math.sign(pitch.toneShift.suspense)).toBe(Math.sign(100 - script.toneProfile.suspense));
    expect(Math.sign(pitch.toneShift.spectacle)).toBe(Math.sign(0 - script.toneProfile.spectacle));
  });

  it('a forceful director reshapes the film more than a deferential one', () => {
    const script = scriptOfGenre('Action', 42);
    const tone: ToneProfile = { action: 0, comedy: 100, romance: 90, suspense: 80, drama: 70, spectacle: 0 };
    const forceful = pitchDirector('forceful', { ego: 98, handsOn: 0.95, toneProfile: { ...tone } });
    const deferential = pitchDirector('deferential', { ego: 5, handsOn: 0.05, toneProfile: { ...tone } });
    const mean = (p: ReturnType<typeof generateDirectorPitch>) => (Object.values(p.toneShift) as number[]).reduce((s, v) => s + Math.abs(v), 0);
    expect(mean(generateDirectorPitch(forceful, script))).toBeGreaterThan(mean(generateDirectorPitch(deferential, script)));
  });

  it('conviction stays within [0, 1] and rises with ego', () => {
    const script = scriptOfGenre('Drama', 43);
    const proud = generateDirectorPitch(pitchDirector('proud', { ego: 95, handsOn: 0.8 }), script);
    const humble = generateDirectorPitch(pitchDirector('humble', { ego: 5, handsOn: 0.8 }), script);
    for (const c of [proud.conviction, humble.conviction]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
    expect(proud.conviction).toBeGreaterThan(humble.conviction);
  });

  it('previews exactly the demands the director would bring post-hire', () => {
    const director = pitchDirector('demands', { ego: 90, handsOn: 0.9, aptitudes: { story: 95, visual: 10, performance: 88, craft: 15 }, toneProfile: { action: 0, comedy: 95, romance: 90, suspense: 10, drama: 20, spectacle: 0 } });
    const script = scriptOfGenre('Action', 44);
    expect(generateDirectorPitch(director, script).previewedDemands).toEqual(generateCreativeDemands(director, script));
  });
});

describe('pitchRiskPosture', () => {
  it('a deferential, aligned director reads as a faithful (narrow-outcome) pitch', () => {
    const script = scriptOfGenre('Drama', 45);
    // Barely reshapes the film, no ego, no hands-on push -> few or no demands.
    const safe = pitchDirector('safe', { ego: 5, handsOn: 0, toneProfile: { ...script.toneProfile } });
    const pitch = generateDirectorPitch(safe, script);
    expect(pitchRiskPosture(pitch)).toBe('faithful');
  });

  it('a forceful, off-tone, spiky-aptitude director reads as a bold (wide-outcome) pitch', () => {
    const script = scriptOfGenre('Romance', 46);
    const auteur = pitchDirector('auteur', {
      ego: 98,
      handsOn: 0.95,
      aptitudes: { story: 95, visual: 5, performance: 92, craft: 10 },
      toneProfile: { action: 100, comedy: 0, romance: 0, suspense: 100, drama: 20, spectacle: 100 },
    });
    const pitch = generateDirectorPitch(auteur, script);
    expect(pitchRiskPosture(pitch)).toBe('bold');
  });

  it('boldness is ordered: bold pitch > faithful pitch', () => {
    const script = scriptOfGenre('Romance', 47);
    const safe = generateDirectorPitch(pitchDirector('safe2', { ego: 5, handsOn: 0, toneProfile: { ...script.toneProfile } }), script);
    const bold = generateDirectorPitch(pitchDirector('bold2', { ego: 98, handsOn: 0.95, aptitudes: { story: 95, visual: 5, performance: 92, craft: 10 }, toneProfile: { action: 100, comedy: 0, romance: 0, suspense: 100, drama: 20, spectacle: 100 } }), script);
    expect(pitchBoldness(bold)).toBeGreaterThan(pitchBoldness(safe));
  });
});

describe('describePitch', () => {
  it('names the tones a forceful take pushes and pulls', () => {
    const script = scriptOfGenre('Comedy', 48);
    const director = pitchDirector('takey', { ego: 90, handsOn: 0.9, toneProfile: { action: 50, comedy: 0, romance: 50, suspense: 100, drama: 50, spectacle: 50 } });
    const read = describePitch(generateDirectorPitch(director, script), director);
    // Suspense-max, comedy-zero director on a comedy script: leans into suspense, pulls back comedy.
    expect(read.take.toLowerCase()).toContain('suspense');
    expect(read.take.toLowerCase()).toContain('comedy');
  });

  it('describes the production approach from the director\'s style', () => {
    const script = scriptOfGenre('Action', 49);
    const practical = pitchDirector('practical', { productionStyle: { environmentStrategy: { studio: 0, location: 1, digital: 0 }, effectsStrategy: { practical: 1, digital: 0 } } });
    const read = describePitch(generateDirectorPitch(practical, script), practical);
    expect(read.approach.toLowerCase()).toContain('on-location');
    expect(read.approach.toLowerCase()).toContain('practical');
  });

  it("gates a demand's competence read on the relationship: a stranger can't judge it", () => {
    const director = pitchDirector('gated', { ego: 95, handsOn: 0.95, aptitudes: { story: 95, visual: 5, performance: 92, craft: 10 }, toneProfile: { action: 0, comedy: 95, romance: 90, suspense: 10, drama: 20, spectacle: 0 } });
    const script = scriptOfGenre('Action', 50);
    const read = describePitch(generateDirectorPitch(director, script), director); // NO_RELATIONSHIP
    expect(read.demands.length).toBeGreaterThan(0);
    // With a stranger, at least one competence read is the "can't judge yet" line.
    expect(read.demands.some((line) => line.includes("don't yet know"))).toBe(true);
  });

  it('always carries a risk-posture summary', () => {
    const script = scriptOfGenre('Drama', 51);
    const read = describePitch(generateDirectorPitch(pitchDirector('sum'), script), pitchDirector('sum'));
    expect(read.postureSummary.length).toBeGreaterThan(0);
    expect(['faithful', 'balanced', 'bold']).toContain(read.posture);
  });
});
