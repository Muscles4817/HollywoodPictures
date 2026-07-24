import { describe, it, expect } from 'vitest';
import { generateTalentPool } from './talentGenerator';
import { withRng } from './random';
import { getWriterCareer } from './person';
import { pickGenreForAffinity, selectWriterForSource, sourceStandingWeight, writerProfileFromPerson, writerStanding } from './writers';
import type { Genre, WriterGenreAffinity } from '../types';

const CRAFT_AXES = ['originality', 'structure', 'characters', 'dialogue'] as const;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('generated writer creative profiles', () => {
  it('every generated writer carries a full, in-range creative profile', () => {
    const writers = withRng(1, (rng) => generateTalentPool(rng)).result.Writer;
    expect(writers.length).toBeGreaterThan(0);
    for (const w of writers) {
      const c = getWriterCareer(w)!;
      for (const axis of CRAFT_AXES) {
        expect(c.craft[axis]).toBeGreaterThanOrEqual(1);
        expect(c.craft[axis]).toBeLessThanOrEqual(100);
      }
      expect(c.commercialLean).toBeGreaterThanOrEqual(1);
      expect(c.consistency).toBeGreaterThanOrEqual(1);
      expect(Object.keys(c.genreAffinity)).toHaveLength(8);
    }
  });

  it('skill is independent of craft shape - spiky writers (wide craft spread) exist', () => {
    const writers = withRng(2, (rng) => generateTalentPool(rng)).result.Writer;
    const spreads = writers.map((w) => {
      const cr = getWriterCareer(w)!.craft;
      const vals = CRAFT_AXES.map((a) => cr[a]);
      return Math.max(...vals) - Math.min(...vals);
    });
    expect(Math.max(...spreads)).toBeGreaterThan(15);
  });
});

describe('source-appropriate writer selection', () => {
  it('sourceStandingWeight favours unknowns for spec scripts and elites for studio commissions', () => {
    expect(sourceStandingWeight('Spec Screenplay', 10)).toBeGreaterThan(sourceStandingWeight('Spec Screenplay', 90));
    expect(sourceStandingWeight('Studio Original', 90)).toBeGreaterThan(sourceStandingWeight('Studio Original', 10));
  });

  it('spec screenplays are authored by lower-standing writers than studio commissions, on average', () => {
    const writers = withRng(3, (rng) => generateTalentPool(rng)).result.Writer;
    const spec: number[] = [];
    const studio: number[] = [];
    withRng(4, (rng) => {
      for (let i = 0; i < 500; i++) spec.push(writerStanding(selectWriterForSource(writers, 'Spec Screenplay', rng)!));
      for (let i = 0; i < 500; i++) studio.push(writerStanding(selectWriterForSource(writers, 'Studio Original', rng)!));
      return null;
    });
    // Studio commissions still skew to higher-standing writers than spec
    // scripts. The margin is smaller than it once was: the writer pool is now
    // fully hand-authored (real working screenwriters, skill floored ~70), so
    // there are no skill-single-digit unknowns for spec selection to bottom
    // out on the way the old procedural pool produced - the two averages sit
    // closer together while the ordering holds firmly.
    expect(avg(studio)).toBeGreaterThan(avg(spec) + 3);
  });

  it('selectWriterForSource returns null only for an empty pool', () => {
    expect(selectWriterForSource([], 'Spec Screenplay', () => 0.5)).toBeNull();
  });

  it('writerProfileFromPerson projects a writer, and is null for a non-writer', () => {
    const pool = withRng(5, (rng) => generateTalentPool(rng)).result;
    expect(writerProfileFromPerson(pool.Writer[0])).not.toBeNull();
    expect(writerProfileFromPerson(pool.Director[0])).toBeNull();
  });

  it('pickGenreForAffinity respects a strongly-weighted profile', () => {
    const affinity: WriterGenreAffinity = { Action: 1, Comedy: 1, Drama: 1, Horror: 1, Romance: 1, 'Sci-Fi': 1, Fantasy: 1, Thriller: 95 };
    const picks: Genre[] = [];
    withRng(6, (rng) => { for (let i = 0; i < 200; i++) picks.push(pickGenreForAffinity(rng, affinity)); return null; });
    const thrillerShare = picks.filter((g) => g === 'Thriller').length / picks.length;
    expect(thrillerShare).toBeGreaterThan(0.5);
  });
});
