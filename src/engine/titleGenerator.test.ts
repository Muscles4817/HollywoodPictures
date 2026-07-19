import { describe, it, expect } from 'vitest';
import { generateTitle, uniqueTitle, TITLE_SHAPES } from './titleGenerator';
import { createRng } from './random';
import { GENRES } from '../data/genres';

describe('titleGenerator', () => {
  it('produces a non-empty title for every genre', () => {
    for (const genre of GENRES) {
      for (let seed = 1; seed <= 20; seed++) {
        const title = generateTitle(genre, createRng(seed));
        expect(title.length).toBeGreaterThan(0);
        expect(title.trim()).toBe(title);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    for (const genre of GENRES) {
      expect(generateTitle(genre, createRng(123))).toBe(generateTitle(genre, createRng(123)));
    }
  });

  it('spans many structural shapes, not one - single word, The, of-phrase, possessive, subtitle, and-pair, prepositional', () => {
    // Build a big sample and detect each structural marker. The whole point of
    // the generator is structural variety, so assert the shapes actually show
    // up rather than trusting the weights table alone.
    const titles: string[] = [];
    let seed = 1;
    for (const genre of GENRES) {
      for (let i = 0; i < 200; i++) titles.push(generateTitle(genre, createRng(seed++)));
    }
    const has = (pred: (t: string) => boolean) => titles.some(pred);
    expect(has((t) => !t.includes(' '))).toBe(true); // single word
    expect(has((t) => t.startsWith('The '))).toBe(true); // "The ___"
    expect(has((t) => t.includes(' of the '))).toBe(true); // "___ of the ___"
    expect(has((t) => /'s /.test(t))).toBe(true); // possessive
    expect(has((t) => t.includes(': '))).toBe(true); // colon subtitle
    expect(has((t) => / and /.test(t))).toBe(true); // "X and Y"
    expect(has((t) => /^(Into|Beyond|Beneath|After|Before|Under) the /.test(t))).toBe(true); // prepositional
    expect(has((t) => /^(A|An) /.test(t))).toBe(true); // "A ___"

    // And no single shape should dominate the way the old adjective+noun-only
    // generator did: the two-word "adjective noun" shape is now a minority.
    const twoWordPlain = titles.filter((t) => t.split(' ').length === 2 && !/[:']/.test(t) && !/^(A|An|The) /.test(t));
    expect(twoWordPlain.length / titles.length).toBeLessThan(0.25);
    expect(TITLE_SHAPES.length).toBeGreaterThanOrEqual(10);
  });

  it('de-dupes within a slate via uniqueTitle', () => {
    const used = new Set<string>();
    const rng = createRng(42);
    const titles = Array.from({ length: 12 }, () => uniqueTitle('Thriller', rng, used));
    expect(new Set(titles).size).toBe(12);
  });
});
