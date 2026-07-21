import { describe, it, expect } from 'vitest';
import { pickScoredReviews } from './reviews';
import { createRng } from './random';

describe('pickScoredReviews - individually-rated quotes for the Premiere Reveal', () => {
  it('returns `count` distinct quotes', () => {
    const quotes = pickScoredReviews(80, 'critic', createRng(1), 3);
    expect(quotes).toHaveLength(3);
    const texts = new Set(quotes.map((q) => q.text));
    expect(texts.size).toBe(3); // no repeats within one call
  });

  it('every quote score stays within the jitter band and clamped to [0, 100]', () => {
    for (const score of [0, 5, 50, 95, 100]) {
      const quotes = pickScoredReviews(score, 'audience', createRng(score), 3);
      for (const quote of quotes) {
        expect(quote.score).toBeGreaterThanOrEqual(Math.max(0, score - 8));
        expect(quote.score).toBeLessThanOrEqual(Math.min(100, score + 8));
      }
    }
  });

  it('is deterministic given the same rng seed', () => {
    const a = pickScoredReviews(72, 'critic', createRng(7), 3);
    const b = pickScoredReviews(72, 'critic', createRng(7), 3);
    expect(a).toEqual(b);
  });

  it('critic and audience voices draw from different line banks (never share exact wording)', () => {
    const critic = pickScoredReviews(60, 'critic', createRng(3), 4);
    const audience = pickScoredReviews(60, 'audience', createRng(3), 4);
    const criticTexts = new Set(critic.map((q) => q.text));
    const audienceTexts = new Set(audience.map((q) => q.text));
    for (const text of criticTexts) expect(audienceTexts.has(text)).toBe(false);
  });

  it('a savaged score and a triumphant score never share review lines', () => {
    const bad = pickScoredReviews(5, 'critic', createRng(1), 4);
    const great = pickScoredReviews(98, 'critic', createRng(1), 4);
    const badTexts = new Set(bad.map((q) => q.text));
    for (const quote of great) expect(badTexts.has(quote.text)).toBe(false);
  });
});
