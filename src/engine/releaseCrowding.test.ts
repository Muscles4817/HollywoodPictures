import { describe, it, expect } from 'vitest';
import { computeCompetitiveCrowding, computeRivalReleaseStrength, computePlayerReleaseStrength, type UpcomingRelease, crowdingFromPressure } from './releaseCrowding';

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

  it('a strong genre identity lifts an on-brand release above the same release with none - and boost-only, never below', () => {
    const bare = computeRivalReleaseStrength(30_000_000, 'Medium', 0);
    const onBrand = computeRivalReleaseStrength(30_000_000, 'Medium', 80);
    expect(onBrand).toBeGreaterThan(bare);
    expect(computeRivalReleaseStrength(30_000_000, 'Medium')).toBe(bare); // default is the no-identity behaviour
    // Same lift shape on the player side.
    expect(computePlayerReleaseStrength(30_000_000, 60_000_000, 80)).toBeGreaterThan(computePlayerReleaseStrength(30_000_000, 60_000_000, 0));
  });
});

describe('studio identity as competitor territory - rivals steer around a strong incumbent', () => {
  // An incumbent maxed out in its home genre reads as a stronger presence on
  // the calendar, so the relative-strength matchup (matchupWeight) makes a
  // same-genre challenger feel more crowded than it would against an
  // identity-less studio of otherwise identical marketing/scale. This is the
  // "majors defend their territory" behaviour, checked at the crowding layer.
  const day = 100;
  const challenger = { releaseDay: day, genre: 'Horror' as const, targetAudience: 'Mass Market' as const };
  const challengerStrength = computeRivalReleaseStrength(30_000_000, 'Medium', 0);

  it('a same-genre incumbent with a home-genre identity crowds a challenger more than an identity-less one', () => {
    const marketing = 30_000_000;
    const scale = 'Medium' as const;
    const incumbentBare: UpcomingRelease = { releaseDay: day, genre: 'Horror', targetAudience: 'Mass Market', strength: computeRivalReleaseStrength(marketing, scale, 0) };
    const incumbentOnBrand: UpcomingRelease = { releaseDay: day, genre: 'Horror', targetAudience: 'Mass Market', strength: computeRivalReleaseStrength(marketing, scale, 90) };

    const crowdingVsBare = computeCompetitiveCrowding(challenger, [incumbentBare], challengerStrength);
    const crowdingVsOnBrand = computeCompetitiveCrowding(challenger, [incumbentOnBrand], challengerStrength);
    expect(crowdingVsOnBrand).toBeGreaterThan(crowdingVsBare);
  });
});

// Section 9.2 of docs/DESIGN_REVIEW_project_clocks_and_script_openness.md: the
// old hard clamp at 1 threw away every distinction above it, flattening a
// merely-contested day and a ruinous one into the same number - and swallowing
// most of what matchupWeight was contributing.
describe('crowdingFromPressure - a soft ceiling, not a clamp', () => {
  it('leaves the ordinary range exactly as it was', () => {
    // Everything below the knee passes through untouched, so the existing
    // calibration of normal days is not disturbed at all.
    for (const p of [0, 0.1, 0.25, 0.5, 0.69]) expect(crowdingFromPressure(p)).toBeCloseTo(p, 10);
  });

  it('approaches total loss without overshooting it', () => {
    // Across every pressure a real calendar produces, crowding stays strictly
    // below total loss - there is always some screen access left. Far past that
    // (pressure 20+, which no calendar reaches) the exponential underflows to
    // exactly 1, which is the correct limit rather than a bug.
    for (const p of [1, 2, 4, 6]) {
      expect(crowdingFromPressure(p)).toBeLessThan(1);
      expect(crowdingFromPressure(p)).toBeGreaterThan(0.7);
    }
    for (const p of [20, 100]) expect(crowdingFromPressure(p)).toBeLessThanOrEqual(1);
  });

  it('is strictly monotonic, so no two pressures collapse to one crowding', () => {
    // The property the hard clamp broke, and the reason a strong film could not
    // feel a collision differently from a weak one.
    let previous = -1;
    for (let p = 0; p <= 6; p += 0.05) {
      const crowding = crowdingFromPressure(p);
      expect(crowding).toBeGreaterThan(previous);
      previous = crowding;
    }
  });

  it('clamps negative pressure to zero', () => {
    expect(crowdingFromPressure(-1)).toBe(0);
  });
});

describe('the player feels their own strength in a collision', () => {
  it('lets a strong release shrug off a competitor that would crush a weak one', () => {
    const rival: UpcomingRelease = { releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market', strength: 0.8 };
    const candidate = { releaseDay: 100, genre: 'Action' as const, targetAudience: 'Mass Market' as const };
    const weak = computeCompetitiveCrowding(candidate, [rival], 0.15);
    const strong = computeCompetitiveCrowding(candidate, [rival], 0.95);
    expect(strong).toBeLessThan(weak);
    // Both still hurt - a collision is a collision - but not equally.
    expect(strong).toBeGreaterThan(0.3);
  });
});
