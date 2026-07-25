// VFX facet (docs/DESIGN_REVIEW_production_redesign.md, step 4). The shared
// model math is covered in facetModel.test.ts; this file covers only the
// VFX-specific wiring: the ambition source, VFX being money-heavier than a
// generic facet, and the VFX Supervisor's skill mattering below saturation.
import { describe, it, expect } from 'vitest';
import { computeVfxAmbition, computeVfxFacet, NO_VFX_SUPERVISOR_SKILL } from './vfxFacet';
import { generateTalentCandidates } from './talentGenerator';
import { withRng } from './random';
import { VFX_RANGE } from '../data/production';
import type { Genre, Script, TalentAssignment } from '../types';

const script = (primarySetting: string, scale: Script['scale']) => ({ primarySetting, scale }) as unknown as Script;

/** A VFX Supervisor assignment with a forced skill, mirroring production.test.ts. */
function vfxSupervisor(seed: number, skill: number): TalentAssignment {
  const { result: person } = withRng(seed, (rng) => generateTalentCandidates('VFX Supervisor', rng, 1)[0]);
  return { role: 'VFX Supervisor', person: { ...person, careers: { ...person.careers, vfxSupervisor: { ...person.careers.vfxSupervisor!, skill } } } };
}

describe('computeVfxAmbition', () => {
  it('a built-world sci-fi epic demands VFX; a single-room drama barely does', () => {
    const epic = computeVfxAmbition('Sci-Fi', script('FuturisticCity', 'Epic'));
    const drama = computeVfxAmbition('Drama', script('SingleInteriorLocation', 'Intimate'));
    expect(epic).toBeGreaterThan(75);
    expect(drama).toBeLessThan(20);
  });
});

describe('the VFX money axis', () => {
  const g: Genre = 'Sci-Fi';
  const sc = script('FuturisticCity', 'Epic');

  it('a fully-funded digital spectacle clears a starved one by a wide margin (money-heavy facet)', () => {
    const funded = computeVfxFacet(VFX_RANGE.max, [], g, sc).quality;
    const starved = computeVfxFacet(VFX_RANGE.min, [], g, sc).quality;
    expect(funded).toBeGreaterThan(starved + 25);
  });
});

describe('the VFX Supervisor is the skill axis', () => {
  const g: Genre = 'Sci-Fi';
  const sc = script('FuturisticCity', 'Epic');
  const midSpend = (VFX_RANGE.min + VFX_RANGE.max) / 2;

  it('a skilled supervisor beats an unmanaged (no-supervisor) pipeline, all else equal', () => {
    const managed = computeVfxFacet(midSpend, [vfxSupervisor(1, 90)], g, sc).quality;
    const unmanaged = computeVfxFacet(midSpend, [], g, sc).quality;
    expect(managed).toBeGreaterThan(unmanaged + 8);
  });

  it('no supervisor falls back to the NO_VFX_SUPERVISOR_SKILL floor', () => {
    const none = computeVfxFacet(midSpend, [], g, sc).quality;
    const forcedFloor = computeVfxFacet(midSpend, [vfxSupervisor(2, NO_VFX_SUPERVISOR_SKILL)], g, sc).quality;
    expect(none).toBe(forcedFloor);
  });
});
