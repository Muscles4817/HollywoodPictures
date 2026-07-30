// Cinematography facet (docs/DESIGN_production_requirements_model.md — Layer 4).
// The shared model math is covered in facetModel.test.ts; this file covers only
// the cinematography-specific wiring: the ambition source, the shoot-time axis,
// and the Cinematographer's skill mattering.
import { describe, it, expect } from 'vitest';
import {
  computeCinematographyAmbition,
  computeCinematographyFacet,
  realiseCinematographyQuality,
  cinematographyOutlook,
  cinematographerSkill,
  NO_CINEMATOGRAPHER_SKILL,
} from './cinematographyFacet';
import { generateTalentCandidates } from './talentGenerator';
import { withRng } from './random';
import type { Genre, Script, TalentAssignment, Tone } from '../types';

const tone = (over: Partial<Record<Tone, number>> = {}): Record<Tone, number> => ({
  action: 20, comedy: 20, romance: 20, suspense: 20, drama: 20, spectacle: 20, ...over,
});

const script = (primarySetting: string, scale: Script['scale'], toneOver: Partial<Record<Tone, number>> = {}, complexity = 50) =>
  ({ primarySetting, scale, complexity, toneProfile: tone(toneOver) }) as unknown as Script;

/** A Cinematographer assignment with a forced skill, mirroring vfxFacet.test.ts. */
function dp(seed: number, skill: number): TalentAssignment {
  const { result: person } = withRng(seed, (rng) => generateTalentCandidates('Cinematographer', rng, 1)[0]);
  return { role: 'Cinematographer', person: { ...person, careers: { ...person.careers, cinematographer: { ...person.careers.cinematographer!, skill } } } };
}

describe('computeCinematographyAmbition', () => {
  it('a large-scale spectacle across complex environments demands the camera; an intimate single-room piece barely does', () => {
    const big = computeCinematographyAmbition('Action', script('FuturisticCity', 'Epic', { spectacle: 90, action: 80 }));
    const small = computeCinematographyAmbition('Drama', script('SingleInteriorLocation', 'Intimate', { spectacle: 5, action: 5 }));
    expect(big).toBeGreaterThan(65);
    expect(small).toBeLessThan(25);
  });
});

describe('the cinematography time axis', () => {
  const g: Genre = 'Action';
  const sc = script('FuturisticCity', 'Epic', { spectacle: 85 });

  it('a shoot given full time clears a badly rushed one', () => {
    const onSchedule = computeCinematographyFacet([dp(1, 70)], g, sc, 1.0).quality;
    const rushed = computeCinematographyFacet([dp(1, 70)], g, sc, 0.4).quality;
    expect(onSchedule).toBeGreaterThan(rushed + 8);
  });
});

describe('the Cinematographer is the skill axis', () => {
  const g: Genre = 'Action';
  const sc = script('FuturisticCity', 'Epic', { spectacle: 85 });

  it('a skilled DP beats an unled camera department, all else equal', () => {
    const led = computeCinematographyFacet([dp(1, 92)], g, sc, 1.0).quality;
    const unled = computeCinematographyFacet([], g, sc, 1.0).quality;
    expect(led).toBeGreaterThan(unled + 8);
  });

  it('no DP falls back to the NO_CINEMATOGRAPHER_SKILL floor', () => {
    const none = computeCinematographyFacet([], g, sc, 1.0).quality;
    const forcedFloor = computeCinematographyFacet([dp(2, NO_CINEMATOGRAPHER_SKILL)], g, sc, 1.0).quality;
    expect(none).toBe(forcedFloor);
    expect(cinematographerSkill([])).toBe(NO_CINEMATOGRAPHER_SKILL);
  });
});

describe('realiseCinematographyQuality / outlook', () => {
  const sc = script('FuturisticCity', 'Epic', { spectacle: 85 });

  it('a neutral-skill forecast (no events) delivers exactly the deterministic base', () => {
    // With no events the swing carries only the skill tilt, which is zero at
    // skill 50 - so a neutral head with no events lands exactly on the base.
    const facet = computeCinematographyFacet([dp(1, 50)], 'Action', sc, 1.0);
    expect(realiseCinematographyQuality(facet, 50, 0)).toBe(facet.quality);
  });

  it('outlook is a qualitative spread/lean read, not a number', () => {
    const facet = computeCinematographyFacet([dp(1, 90)], 'Action', sc, 1.0);
    const out = cinematographyOutlook(facet, 90);
    expect(['tight', 'moderate', 'wide']).toContain(out.spread);
    expect(['promising', 'even', 'precarious']).toContain(out.lean);
  });
});
