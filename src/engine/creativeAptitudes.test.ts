import { describe, it, expect } from 'vitest';
import {
  deriveDirectorAptitudes,
  describeDirectorAptitudes,
  APTITUDE_DOMAINS,
} from './creativeAptitudes';
import { generateTalentCandidates } from './talentGenerator';
import { withRng } from './random';
import type { DomainAptitudes, Person } from '../types';

function director(seed: number): Person {
  return withRng(seed, (rng) => generateTalentCandidates('Director', rng, 1)[0]).result;
}

/** A copy of `person` with authored director aptitudes, for exercising the override + reveal directly. */
function withAptitudes(person: Person, aptitudes: DomainAptitudes): Person {
  return { ...person, careers: { ...person.careers, director: { ...person.careers.director!, aptitudes } } };
}

const rel = (collaborations: number) => ({ collaborations, warmth: 0, tier: 'none' as const, lastWorkedDay: null });

describe('deriveDirectorAptitudes', () => {
  it('is a stable per-person derivation - same director, same aptitudes every call', () => {
    const d = director(1);
    expect(deriveDirectorAptitudes(d)).toEqual(deriveDirectorAptitudes(d));
  });

  it('respects an authored aptitude vector verbatim (clamped/rounded)', () => {
    const authored = { story: 20, visual: 95, performance: 60, craft: 45 };
    const d = withAptitudes(director(2), authored);
    expect(deriveDirectorAptitudes(d)).toEqual(authored);
  });

  it('centres derived aptitudes on overall skill, within the spread, and lets domains genuinely diverge', () => {
    for (const seed of [3, 4, 5, 6, 7]) {
      const d = director(seed);
      const skill = d.careers.director!.skill;
      const apt = deriveDirectorAptitudes(d);
      for (const domain of APTITUDE_DOMAINS) {
        expect(apt[domain]).toBeGreaterThanOrEqual(Math.max(0, skill - 26));
        expect(apt[domain]).toBeLessThanOrEqual(Math.min(100, skill + 26));
      }
    }
    // Across the four domains of a single director, they should not all be identical
    // (independent per-domain offsets) - the whole point of the Snyder shape.
    const spread = Object.values(deriveDirectorAptitudes(director(8)));
    expect(new Set(spread).size).toBeGreaterThan(1);
  });
});

describe('describeDirectorAptitudes - partial, relationship-sharpened reveal', () => {
  it('reveals more domains the more the studio has worked with the director', () => {
    const d = director(10);
    const stranger = describeDirectorAptitudes(d, rel(0));
    const familiar = describeDirectorAptitudes(d, rel(1));
    const intimate = describeDirectorAptitudes(d, rel(3));

    expect(stranger.resolution).toBe('reputation');
    expect(familiar.resolution).toBe('familiar');
    expect(intimate.resolution).toBe('intimate');

    expect(Object.keys(stranger.domains).length).toBeLessThanOrEqual(2);
    expect(Object.keys(intimate.domains).length).toBe(4);
    expect(Object.keys(stranger.domains).length).toBeLessThanOrEqual(Object.keys(intimate.domains).length);
  });

  it('never leaks raw numbers into the summary or any resolution', () => {
    const d = withAptitudes(director(11), { story: 22, visual: 95, performance: 58, craft: 41 });
    for (const collaborations of [0, 1, 3]) {
      const read = describeDirectorAptitudes(d, rel(collaborations));
      expect(read.summary).not.toMatch(/[0-9]/);
    }
  });

  it('a pronounced weakness surfaces even at arm\'s length (reputation), banded correctly at depth', () => {
    const d = withAptitudes(director(12), { story: 20, visual: 95, performance: 55, craft: 50 });
    const stranger = describeDirectorAptitudes(d, rel(0));
    // Visual is the standout strength; story is a pronounced weakness -> both named.
    expect(stranger.domains.visual).toBe('exceptional');
    expect(stranger.domains.story).toBe('weak');

    const intimate = describeDirectorAptitudes(d, rel(3));
    expect(intimate.domains).toEqual({ story: 'weak', visual: 'exceptional', performance: 'solid', craft: 'solid' });
  });

  it('hides a non-pronounced weakness at reputation level (only the strength shows)', () => {
    const d = withAptitudes(director(13), { story: 78, visual: 82, performance: 76, craft: 80 });
    const stranger = describeDirectorAptitudes(d, rel(0));
    // All strong and tightly clustered -> no standout weakness to flag.
    expect(Object.keys(stranger.domains)).toEqual(['visual']);
  });
});
