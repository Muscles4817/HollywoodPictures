import { describe, it, expect } from 'vitest';
import { computeCompetitiveCrowding, computeRivalReleaseStrength, computePlayerReleaseStrength, type UpcomingRelease } from './releaseCrowding';

function competitor(overrides: Partial<UpcomingRelease> = {}): UpcomingRelease {
  return { releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market', strength: 1, ...overrides };
}

describe('computeCompetitiveCrowding', () => {
  it('is 0 with no known competitors', () => {
    expect(computeCompetitiveCrowding({ releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market' }, [])).toBe(0);
  });

  it('is 0 for a competitor far enough away in time to no longer matter', () => {
    const far = competitor({ releaseDay: 100 + 200 });
    expect(computeCompetitiveCrowding({ releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market' }, [far])).toBe(0);
  });

  it('is higher for a same-genre, same-day, full-strength competitor than a different-genre one at the same day/strength', () => {
    const sameGenre = computeCompetitiveCrowding(
      { releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market' },
      [competitor({ genre: 'Action' })],
    );
    const differentGenre = computeCompetitiveCrowding(
      { releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market' },
      [competitor({ genre: 'Drama' })],
    );
    expect(sameGenre).toBeGreaterThan(differentGenre);
    expect(differentGenre).toBeGreaterThan(0); // still some baseline multiplex competition, not zero
  });

  it('a matching targetAudience adds on top of a matching genre', () => {
    // A weak, distant competitor deliberately - strong enough to compare,
    // but far enough under the clamp ceiling that the audience bonus has
    // room to actually show up in the result.
    const genreOnly = computeCompetitiveCrowding(
      { releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market' },
      [competitor({ genre: 'Action', targetAudience: 'Niche', strength: 0.2, releaseDay: 130 })],
    );
    const genreAndAudience = computeCompetitiveCrowding(
      { releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market' },
      [competitor({ genre: 'Action', targetAudience: 'Mass Market', strength: 0.2, releaseDay: 130 })],
    );
    expect(genreAndAudience).toBeGreaterThan(genreOnly);
  });

  it('decays with distance in time - a same-genre competitor a week away scores higher than one a month away', () => {
    const closeScore = computeCompetitiveCrowding(
      { releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market' },
      [competitor({ releaseDay: 107 })],
    );
    const farScore = computeCompetitiveCrowding(
      { releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market' },
      [competitor({ releaseDay: 130 })],
    );
    expect(closeScore).toBeGreaterThan(farScore);
    expect(farScore).toBeGreaterThan(0);
  });

  it('scales with the competitor\'s own strength', () => {
    const weak = computeCompetitiveCrowding(
      { releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market' },
      [competitor({ strength: 0.1 })],
    );
    const strong = computeCompetitiveCrowding(
      { releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market' },
      [competitor({ strength: 1 })],
    );
    expect(strong).toBeGreaterThan(weak);
  });

  it('saturates at 1 rather than compounding past it with many strong, close, same-genre competitors', () => {
    const many = Array.from({ length: 20 }, (_, i) => competitor({ releaseDay: 100 + i, strength: 1 }));
    const score = computeCompetitiveCrowding({ releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market' }, many);
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBe(1);
  });

  it('never returns a negative number', () => {
    const score = computeCompetitiveCrowding({ releaseDay: 100, genre: 'Horror', targetAudience: 'Niche' }, []);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('computeRivalReleaseStrength / computePlayerReleaseStrength - comparable 0-1 proxies', () => {
  it('both stay within [0, 1] across a wide range of inputs', () => {
    expect(computeRivalReleaseStrength(10_000, 'Small')).toBeGreaterThanOrEqual(0);
    expect(computeRivalReleaseStrength(150_000_000, 'Big')).toBeLessThanOrEqual(1);
    expect(computePlayerReleaseStrength(10_000, 100_000)).toBeGreaterThanOrEqual(0);
    expect(computePlayerReleaseStrength(150_000_000, 200_000_000)).toBeLessThanOrEqual(1);
  });

  it('a Big-scale rival with heavy marketing scores higher than a Small-scale rival with light marketing', () => {
    const big = computeRivalReleaseStrength(120_000_000, 'Big');
    const small = computeRivalReleaseStrength(20_000, 'Small');
    expect(big).toBeGreaterThan(small);
  });

  it('a bigger player production (marketing + budget) scores higher than a tiny one', () => {
    const big = computePlayerReleaseStrength(100_000_000, 150_000_000);
    const small = computePlayerReleaseStrength(20_000, 150_000);
    expect(big).toBeGreaterThan(small);
  });

  it('a maxed-out rival and a maxed-out player land in roughly the same strength range - the two proxies are comparable, not biased toward one side', () => {
    const rival = computeRivalReleaseStrength(150_000_000, 'Big');
    const player = computePlayerReleaseStrength(150_000_000, 200_000_000);
    expect(Math.abs(rival - player)).toBeLessThan(0.15);
  });
});
