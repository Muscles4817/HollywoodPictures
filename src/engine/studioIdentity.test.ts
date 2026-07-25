import { describe, it, expect } from 'vitest';
import {
  genreIdentityFor,
  computeGenreIdentityChange,
  applyGenreIdentityChange,
  applyGenreIdentityDeltas,
  primaryGenre,
  IDENTITY_ESTABLISHED_THRESHOLD,
} from './studioIdentity';
import type { Genre } from '../types';

const hit = { profit: 200_000_000, totalCost: 80_000_000, audienceScore: 78 }; // ~2.5x return, well-liked
const flop = { profit: -60_000_000, totalCost: 80_000_000, audienceScore: 40 }; // lost most of its budget, disliked
const modest = { profit: 20_000_000, totalCost: 80_000_000, audienceScore: 58 }; // thin profit

describe('genreIdentityFor', () => {
  it('reads absent genres as 0', () => {
    expect(genreIdentityFor(undefined, 'Horror')).toBe(0);
    expect(genreIdentityFor({ Horror: 30 }, 'Action')).toBe(0);
    expect(genreIdentityFor({ Horror: 30 }, 'Horror')).toBe(30);
  });
});

describe('computeGenreIdentityChange', () => {
  it('a hit builds identity, a flop erodes it, a modest film barely moves it', () => {
    expect(computeGenreIdentityChange(hit)).toBeGreaterThan(3);
    expect(computeGenreIdentityChange(flop)).toBeLessThan(0);
    expect(Math.abs(computeGenreIdentityChange(modest))).toBeLessThan(2);
  });

  it('a well-reviewed hit builds more identity than a disliked one of the same profit', () => {
    const loved = { profit: 200_000_000, totalCost: 80_000_000, audienceScore: 90 };
    const tolerated = { profit: 200_000_000, totalCost: 80_000_000, audienceScore: 45 };
    expect(computeGenreIdentityChange(loved)).toBeGreaterThan(computeGenreIdentityChange(tolerated));
  });
});

describe('accumulation', () => {
  it('a studio that ships repeated horror hits becomes a horror studio, clamped to 100', () => {
    let identity: Partial<Record<Genre, number>> | undefined;
    for (let i = 0; i < 30; i++) {
      identity = applyGenreIdentityChange(identity, 'Horror', computeGenreIdentityChange(hit));
    }
    expect(genreIdentityFor(identity, 'Horror')).toBe(100); // saturates, never exceeds
    expect(genreIdentityFor(identity, 'Action')).toBe(0); // untouched genre stays 0
  });

  it('a run of costly flops erodes a genre identity back toward 0, never below', () => {
    let identity: Partial<Record<Genre, number>> = { Drama: 20 };
    for (let i = 0; i < 10; i++) {
      identity = applyGenreIdentityChange(identity, 'Drama', computeGenreIdentityChange(flop));
    }
    expect(genreIdentityFor(identity, 'Drama')).toBe(0);
  });

  it('applyGenreIdentityDeltas folds a whole batch and never mutates the input', () => {
    const before: Partial<Record<Genre, number>> = { Horror: 30 };
    const after = applyGenreIdentityDeltas(before, { Horror: 5, Action: 3 });
    expect(after.Horror).toBe(35);
    expect(after.Action).toBe(3);
    expect(before).toEqual({ Horror: 30 }); // input untouched
  });
});

describe('primaryGenre', () => {
  it('returns the strongest genre once it clears the established threshold, else null', () => {
    expect(primaryGenre(undefined)).toBeNull();
    expect(primaryGenre({ Horror: IDENTITY_ESTABLISHED_THRESHOLD - 1 })).toBeNull();
    expect(primaryGenre({ Horror: 55, Thriller: 45 })).toEqual({ genre: 'Horror', strength: 55 });
  });
});
