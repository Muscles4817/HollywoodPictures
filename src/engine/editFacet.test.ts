// Editing facet (docs/DESIGN_production_requirements_model.md — Layer 4). Shared
// model math lives in facetModel.test.ts; this covers the edit-specific wiring:
// the ambition source (cutting difficulty) and the Editor's skill axis.
import { describe, it, expect } from 'vitest';
import {
  computeEditAmbition,
  computeEditFacet,
  realiseEditQuality,
  editOutlook,
  editorSkill,
  NO_EDITOR_SKILL,
} from './editFacet';
import { generateTalentCandidates } from './talentGenerator';
import { withRng } from './random';
import type { Genre, Script, TalentAssignment, Tone } from '../types';

const tone = (over: Partial<Record<Tone, number>> = {}): Record<Tone, number> => ({
  action: 20, comedy: 20, romance: 20, suspense: 20, drama: 20, spectacle: 20, ...over,
});

const script = (scale: Script['scale'], complexity: number, toneOver: Partial<Record<Tone, number>> = {}) =>
  ({ primarySetting: 'SingleInteriorLocation', scale, complexity, toneProfile: tone(toneOver) }) as unknown as Script;

function editor(seed: number, skill: number): TalentAssignment {
  const { result: person } = withRng(seed, (rng) => generateTalentCandidates('Editor', rng, 1)[0]);
  return { role: 'Editor', person: { ...person, careers: { ...person.careers, editor: { ...person.careers.editor!, skill } } } };
}

describe('computeEditAmbition', () => {
  it('a complex, large, action-heavy film is hard to cut; a simple contained low-action piece is not', () => {
    const hard = computeEditAmbition('Action', script('Epic', 90, { action: 90, suspense: 80 }));
    const easy = computeEditAmbition('Drama', script('Intimate', 15, { action: 5, suspense: 10 }));
    expect(hard).toBeGreaterThan(65);
    expect(easy).toBeLessThan(25);
  });
});

describe('the Editor is the skill axis', () => {
  const g: Genre = 'Action';
  const sc = script('Epic', 85, { action: 85, suspense: 70 });

  it('a skilled editor beats an assembly cut (no editor), all else equal', () => {
    const cut = computeEditFacet([editor(1, 92)], g, sc).quality;
    const assembly = computeEditFacet([], g, sc).quality;
    expect(cut).toBeGreaterThan(assembly + 8);
  });

  it('no editor falls back to the NO_EDITOR_SKILL floor', () => {
    const none = computeEditFacet([], g, sc).quality;
    const forcedFloor = computeEditFacet([editor(2, NO_EDITOR_SKILL)], g, sc).quality;
    expect(none).toBe(forcedFloor);
    expect(editorSkill([])).toBe(NO_EDITOR_SKILL);
  });
});

describe('realiseEditQuality / outlook', () => {
  const sc = script('Epic', 85, { action: 85, suspense: 70 });

  it('a neutral-skill forecast (no events) delivers exactly the deterministic base', () => {
    // With no events the swing carries only the skill tilt, which is zero at
    // skill 50 - so a neutral head with no events lands exactly on the base.
    const facet = computeEditFacet([editor(1, 50)], 'Action', sc);
    expect(realiseEditQuality(facet, 50, 0)).toBe(facet.quality);
  });

  it('outlook is a qualitative spread/lean read, not a number', () => {
    const facet = computeEditFacet([editor(1, 90)], 'Action', sc);
    const out = editOutlook(facet, 90);
    expect(['tight', 'moderate', 'wide']).toContain(out.spread);
    expect(['promising', 'even', 'precarious']).toContain(out.lean);
  });
});
