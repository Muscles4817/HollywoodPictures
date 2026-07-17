// Talent Card UX Redesign - the score-to-star and score-to-qualitative-label
// conversions a casting card leads with ("★★★★★ Excellent Match" rather than
// a raw number). No dedicated test coverage existed for this file before.
import { describe, it, expect } from 'vitest';
import { calculateStarRating, deriveHiringVerdict, deriveMatchQualityLabel } from './StarRatingConversion';

describe('calculateStarRating', () => {
  it('converts 0-100 to 0-5 stars at half-star granularity', () => {
    expect(calculateStarRating(100)).toBe(5);
    expect(calculateStarRating(0)).toBe(0);
    expect(calculateStarRating(50)).toBe(2.5);
    expect(calculateStarRating(73)).toBe(3.5); // rounds to the nearest half star
  });

  it('never leaves [0, 5] even for an out-of-range input', () => {
    expect(calculateStarRating(-20)).toBe(0);
    expect(calculateStarRating(150)).toBe(5);
  });

  it('respects a custom max', () => {
    expect(calculateStarRating(5, 10)).toBe(2.5);
  });
});

describe('deriveHiringVerdict', () => {
  it('is a monotonic five-tier ladder from Poor Fit to Excellent Match', () => {
    expect(deriveHiringVerdict(95)).toBe('Excellent Match');
    expect(deriveHiringVerdict(90)).toBe('Excellent Match');
    expect(deriveHiringVerdict(80)).toBe('Strong Choice');
    expect(deriveHiringVerdict(75)).toBe('Strong Choice');
    expect(deriveHiringVerdict(65)).toBe('Good Fit');
    expect(deriveHiringVerdict(60)).toBe('Good Fit');
    expect(deriveHiringVerdict(45)).toBe('Risky Choice');
    expect(deriveHiringVerdict(40)).toBe('Risky Choice');
    expect(deriveHiringVerdict(10)).toBe('Poor Fit');
    expect(deriveHiringVerdict(0)).toBe('Poor Fit');
  });
});

describe('deriveMatchQualityLabel', () => {
  it('is a monotonic five-tier ladder from Poor Match to Perfect Match', () => {
    expect(deriveMatchQualityLabel(95)).toBe('Perfect Match');
    expect(deriveMatchQualityLabel(90)).toBe('Perfect Match');
    expect(deriveMatchQualityLabel(80)).toBe('Strong Match');
    expect(deriveMatchQualityLabel(75)).toBe('Strong Match');
    expect(deriveMatchQualityLabel(65)).toBe('Good Match');
    expect(deriveMatchQualityLabel(60)).toBe('Good Match');
    expect(deriveMatchQualityLabel(45)).toBe('Weak Match');
    expect(deriveMatchQualityLabel(40)).toBe('Weak Match');
    expect(deriveMatchQualityLabel(10)).toBe('Poor Match');
    expect(deriveMatchQualityLabel(0)).toBe('Poor Match');
  });
});
