import { describe, it, expect } from 'vitest';
import { pickScoredReviews, composeScoredReviews, type DepartmentScores } from './reviews';
import { createRng } from './random';
import {
  CRITIC_DEPARTMENT_LINES,
  AUDIENCE_DEPARTMENT_LINES,
  CRITIC_REVIEW_LINES,
  AUDIENCE_REVIEW_LINES,
} from '../data/reviewBlurbs';

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

describe('composeScoredReviews - department-aware premiere reviews', () => {
  const balanced: DepartmentScores = {
    scriptScore: 60,
    directionScore: 60,
    actingScore: 60,
    productionScore: 60,
    postProductionScore: 60,
  };

  const allDeptLines = (voice: 'critic' | 'audience') => {
    const bank = voice === 'critic' ? CRITIC_DEPARTMENT_LINES : AUDIENCE_DEPARTMENT_LINES;
    return new Set(Object.values(bank).flatMap((v) => [...v.praise, ...v.pan]));
  };
  const bandLines = (voice: 'critic' | 'audience') => {
    const bank = voice === 'critic' ? CRITIC_REVIEW_LINES : AUDIENCE_REVIEW_LINES;
    return new Set(Object.values(bank).flat());
  };

  it('returns exactly `count` quotes and is deterministic given the same seed', () => {
    const a = composeScoredReviews({ overallScore: 62, voice: 'critic', departments: balanced, rng: createRng(9), count: 3 });
    const b = composeScoredReviews({ overallScore: 62, voice: 'critic', departments: balanced, rng: createRng(9), count: 3 });
    expect(a).toHaveLength(3);
    expect(a).toEqual(b);
  });

  it('a perfectly balanced film draws only generic band lines (no department callouts)', () => {
    const quotes = composeScoredReviews({ overallScore: 60, voice: 'critic', departments: balanced, rng: createRng(2), count: 3 });
    const deptSet = allDeptLines('critic');
    for (const q of quotes) expect(deptSet.has(q.text)).toBe(false);
  });

  it('names a clearly weak department, and that quote reads lower than the overall score', () => {
    // Weak production (20) against an otherwise middling film; production is the only standout.
    const departments: DepartmentScores = { ...balanced, productionScore: 20 };
    const quotes = composeScoredReviews({ overallScore: 58, voice: 'critic', departments, rng: createRng(4), count: 3 });
    const panBank = new Set(CRITIC_DEPARTMENT_LINES.production.pan);
    const aspect = quotes.find((q) => panBank.has(q.text));
    expect(aspect).toBeTruthy();
    // Its star rating tracks the weak department, not the film's mean.
    expect(aspect!.score).toBeLessThan(58);
  });

  it('lets audiences praise a standout cast in their own voice', () => {
    const departments: DepartmentScores = { ...balanced, actingScore: 90 };
    const quotes = composeScoredReviews({ overallScore: 72, voice: 'audience', departments, rng: createRng(6), count: 3 });
    const praiseBank = new Set(AUDIENCE_DEPARTMENT_LINES.acting.praise);
    expect(quotes.some((q) => praiseBank.has(q.text))).toBe(true);
    // No critic-voiced lines leak into an audience review.
    const criticDept = allDeptLines('critic');
    for (const q of quotes) expect(criticDept.has(q.text)).toBe(false);
  });

  it('always keeps at least one generic overall-impression quote', () => {
    // Multiple standouts (strong acting + weak script) still leave a generic slot.
    const departments: DepartmentScores = { ...balanced, actingScore: 88, scriptScore: 20 };
    const quotes = composeScoredReviews({ overallScore: 55, voice: 'critic', departments, rng: createRng(8), count: 3 });
    const band = bandLines('critic');
    expect(quotes.some((q) => band.has(q.text))).toBe(true);
  });
});
