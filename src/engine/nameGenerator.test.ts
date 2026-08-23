import { describe, it, expect } from 'vitest';
import { createRng } from './random';
import { generateFullName, generateSurname, nameOriginWeightsForRole } from './nameGenerator';
import { NAME_BANKS, DEFAULT_NAME_ORIGIN_WEIGHTS, type NameOrigin } from '../data/talentNames';
import { generateTalentCandidates } from './talentGenerator';

const ORIGINS = Object.keys(NAME_BANKS) as NameOrigin[];

/**
 * Which origin banks a surname appears in - a list, not one answer, because a
 * few surnames genuinely belong to more than one tradition ("Song" is both
 * Chinese and Korean). The check the old flat banks could never pass.
 */
function originsOfSurname(surname: string): NameOrigin[] {
  return ORIGINS.filter((o) => Object.values(NAME_BANKS[o].last).some((list) => list.includes(surname)));
}
function originOfFirstName(first: string): NameOrigin[] {
  return ORIGINS.filter((o) => NAME_BANKS[o].first.includes(first));
}

describe('generateFullName', () => {
  it('always pairs a first name and surname from the same origin', () => {
    // The bug this module exists for: drawing the halves independently made
    // ~80% of names cross-origin pairs ("Priyanka Flanagan", "Duke Suzuki").
    for (let seed = 0; seed < 400; seed++) {
      const drawn = generateFullName(createRng(seed));
      const [first, ...rest] = drawn.name.split(' ');
      const surname = rest.join(' ');
      expect(originsOfSurname(surname)).toContain(drawn.origin);
      expect(originOfFirstName(first)).toContain(drawn.origin);
    }
  });

  it('never repeats a name as its own surname', () => {
    // Some banks carry a word as both (French "Thibault"), which produced
    // "Thibault Thibault" before the collision guard.
    for (let seed = 0; seed < 600; seed++) {
      const [first, ...rest] = generateFullName(createRng(seed)).name.split(' ');
      expect(first).not.toBe(rest.join(' '));
    }
  });

  it('reports the nationality its own surname reads as, not a second draw', () => {
    for (let seed = 0; seed < 300; seed++) {
      const drawn = generateFullName(createRng(seed));
      const surname = drawn.name.split(' ').slice(1).join(' ');
      expect(NAME_BANKS[drawn.origin].last[drawn.nationality]).toContain(surname);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(generateFullName(createRng(77))).toEqual(generateFullName(createRng(77)));
  });

  it('produces a well-formed two-part name', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { name } = generateFullName(createRng(seed));
      expect(name).toMatch(/^\S+ \S/);
      expect(name.trim()).toBe(name);
    }
  });
});

describe('origin weighting follows the measured industry gradient', () => {
  // data/talentNames.ts: Anglophone share falls the further from the camera you
  // get - 62.7% on-screen, 56.8% directors, 51.3% writers, 44.0% craft.
  function anglophoneShare(role: Parameters<typeof nameOriginWeightsForRole>[0], seedBase: number): number {
    const weights = nameOriginWeightsForRole(role);
    let anglo = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const origin = generateFullName(createRng(seedBase + i), weights).origin;
      if (origin === 'anglo-american' || origin === 'british-irish') anglo++;
    }
    return anglo / N;
  }

  it('makes on-screen leads the most Anglo band and craft roles the least', () => {
    const actor = anglophoneShare('Actor', 0);
    const director = anglophoneShare('Director', 10_000);
    const writer = anglophoneShare('Writer', 20_000);
    const dp = anglophoneShare('Cinematographer', 30_000);

    expect(actor).toBeGreaterThan(director);
    expect(director).toBeGreaterThan(writer);
    expect(writer).toBeGreaterThan(dp);
    // Roughly the measured bands, with room for sampling noise.
    expect(actor).toBeGreaterThan(0.5);
    expect(actor).toBeLessThan(0.75);
    expect(dp).toBeGreaterThan(0.28);
    expect(dp).toBeLessThan(0.5);
  });

  it('keeps VFX Supervisor off the craft curve, as the survey found', () => {
    // Measured 52.5% Anglophone and British-VFX-house dominated - markedly more
    // Anglo than editing, scoring or cinematography.
    expect(anglophoneShare('VFX Supervisor', 40_000)).toBeGreaterThan(anglophoneShare('Cinematographer', 50_000));
  });

  it('gives every origin some chance under the default mix', () => {
    // The rarest groups keep a floor rather than tracking the elite-filtered
    // survey to ~0 - see data/talentNames.ts.
    for (const origin of ORIGINS) expect(DEFAULT_NAME_ORIGIN_WEIGHTS[origin]).toBeGreaterThan(0);
  });
});

describe('generated people', () => {
  it('carry a populated nationality', () => {
    // PersonIdentity.nationality existed and was displayed in TalentDatabase but
    // was never set by anything - coherent naming fills it in as a byproduct.
    for (const person of generateTalentCandidates('Actor', createRng(3), 40)) {
      expect(person.identity.nationality).toBeTruthy();
    }
  });

  it('keeps name repeats rare across a full-size pool', () => {
    const names = generateTalentCandidates('Actor', createRng(99), 300).map((p) => p.identity.name);
    // Grouping shrinks the combination space, so this is the property the old
    // flat banks bought with incoherence and must not be given up entirely.
    expect(new Set(names).size / names.length).toBeGreaterThan(0.85);
  });
});

describe('generateSurname', () => {
  it('returns a real surname from some bank', () => {
    for (let seed = 0; seed < 100; seed++) expect(originsOfSurname(generateSurname(createRng(seed)))).not.toHaveLength(0);
  });
});
