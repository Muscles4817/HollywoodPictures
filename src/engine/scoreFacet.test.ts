// Score facet (docs/DESIGN_production_requirements_model.md — Layer 4). Shared
// model math lives in facetModel.test.ts; this covers the score-specific wiring:
// the ambition source (music-forward tones) and the Composer's skill axis.
import { describe, it, expect } from 'vitest';
import {
  computeScoreAmbition,
  computeScoreFacet,
  realiseScoreQuality,
  scoreOutlook,
  composerSkill,
  NO_COMPOSER_SKILL,
} from './scoreFacet';
import { generateTalentCandidates } from './talentGenerator';
import { withRng } from './random';
import type { Genre, Script, TalentAssignment, Tone } from '../types';

const tone = (over: Partial<Record<Tone, number>> = {}): Record<Tone, number> => ({
  action: 20, comedy: 20, romance: 20, suspense: 20, drama: 20, spectacle: 20, ...over,
});

const script = (scale: Script['scale'], toneOver: Partial<Record<Tone, number>> = {}) =>
  ({ primarySetting: 'SingleInteriorLocation', scale, complexity: 50, toneProfile: tone(toneOver) }) as unknown as Script;

function composer(seed: number, skill: number): TalentAssignment {
  const { result: person } = withRng(seed, (rng) => generateTalentCandidates('Composer', rng, 1)[0]);
  return { role: 'Composer', person: { ...person, careers: { ...person.careers, composer: { ...person.careers.composer!, skill } } } };
}

describe('computeScoreAmbition', () => {
  it('a suspenseful, dramatic epic leans hard on score; a dialogue comedy barely does', () => {
    const scored = computeScoreAmbition('Drama', script('Epic', { suspense: 90, drama: 85, spectacle: 70 }));
    const comedy = computeScoreAmbition('Comedy', script('Intimate', { comedy: 90, suspense: 5, drama: 10, spectacle: 5, romance: 5 }));
    expect(scored).toBeGreaterThan(65);
    expect(comedy).toBeLessThan(25);
  });
});

describe('the Composer is the skill axis', () => {
  const g: Genre = 'Drama';
  const sc = script('Epic', { suspense: 80, drama: 80 });

  it('a skilled composer beats temp/library music (no composer), all else equal', () => {
    const scored = computeScoreFacet([composer(1, 92)], g, sc).quality;
    const temp = computeScoreFacet([], g, sc).quality;
    expect(scored).toBeGreaterThan(temp + 8);
  });

  it('no composer falls back to the NO_COMPOSER_SKILL floor', () => {
    const none = computeScoreFacet([], g, sc).quality;
    const forcedFloor = computeScoreFacet([composer(2, NO_COMPOSER_SKILL)], g, sc).quality;
    expect(none).toBe(forcedFloor);
    expect(composerSkill([])).toBe(NO_COMPOSER_SKILL);
  });
});

describe('realiseScoreQuality / outlook', () => {
  const sc = script('Epic', { suspense: 80, drama: 80 });

  it('a neutral-skill forecast (no events) delivers exactly the deterministic base', () => {
    // With no events the swing carries only the skill tilt, which is zero at
    // skill 50 - so a neutral head with no events lands exactly on the base.
    const facet = computeScoreFacet([composer(1, 50)], 'Drama', sc);
    expect(realiseScoreQuality(facet, 50, 0)).toBe(facet.quality);
  });

  it('outlook is a qualitative spread/lean read, not a number', () => {
    const facet = computeScoreFacet([composer(1, 90)], 'Drama', sc);
    const out = scoreOutlook(facet, 90);
    expect(['tight', 'moderate', 'wide']).toContain(out.spread);
    expect(['promising', 'even', 'precarious']).toContain(out.lean);
  });
});
