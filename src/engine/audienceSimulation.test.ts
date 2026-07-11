import { describe, it, expect } from 'vitest';
import {
  createAudienceSimulationFixedState,
  createAudienceSimulationWeekState,
  createAudienceSimulationRun,
  maxInterestedAudience,
  deriveWeeklyAdmissions,
  deriveWordOfMouthActivity,
  type AudienceSimulationFixedState,
  type AudienceSimulationWeekState,
} from './audienceSimulation';

function validFixed(overrides: Partial<AudienceSimulationFixedState> = {}): AudienceSimulationFixedState {
  return {
    totalAddressableAudience: 1_000_000,
    baseInterestFraction: 0.2,
    marketingEfficiency: 0.6,
    crossoverCapacityFraction: 0.15,
    conversionPacingBaseline: 0.1,
    criticScore: 70,
    audienceScore: 75,
    ...overrides,
  };
}

describe('createAudienceSimulationFixedState', () => {
  it('accepts a well-formed fixed state', () => {
    const fixed = createAudienceSimulationFixedState(validFixed());
    expect(fixed.totalAddressableAudience).toBe(1_000_000);
  });

  it('rejects a zero or negative totalAddressableAudience', () => {
    expect(() => createAudienceSimulationFixedState(validFixed({ totalAddressableAudience: 0 }))).toThrow();
    expect(() => createAudienceSimulationFixedState(validFixed({ totalAddressableAudience: -100 }))).toThrow();
  });

  it('rejects fractions/probabilities outside 0-1', () => {
    expect(() => createAudienceSimulationFixedState(validFixed({ baseInterestFraction: -0.01 }))).toThrow();
    expect(() => createAudienceSimulationFixedState(validFixed({ baseInterestFraction: 1.01 }))).toThrow();
    expect(() => createAudienceSimulationFixedState(validFixed({ marketingEfficiency: -1 }))).toThrow();
    expect(() => createAudienceSimulationFixedState(validFixed({ crossoverCapacityFraction: 1.5 }))).toThrow();
    expect(() => createAudienceSimulationFixedState(validFixed({ conversionPacingBaseline: -0.5 }))).toThrow();
  });

  it('accepts the 0 and 1 boundary values themselves', () => {
    expect(() => createAudienceSimulationFixedState(validFixed({ baseInterestFraction: 0, crossoverCapacityFraction: 0 }))).not.toThrow();
    expect(() => createAudienceSimulationFixedState(validFixed({ baseInterestFraction: 1, crossoverCapacityFraction: 0 }))).not.toThrow();
  });

  it('rejects baseInterestFraction + crossoverCapacityFraction exceeding 1', () => {
    expect(() =>
      createAudienceSimulationFixedState(validFixed({ baseInterestFraction: 0.7, crossoverCapacityFraction: 0.4 })),
    ).toThrow();
  });

  it('rejects critic/audience scores outside 0-100', () => {
    expect(() => createAudienceSimulationFixedState(validFixed({ criticScore: -1 }))).toThrow();
    expect(() => createAudienceSimulationFixedState(validFixed({ criticScore: 101 }))).toThrow();
    expect(() => createAudienceSimulationFixedState(validFixed({ audienceScore: NaN }))).toThrow();
  });

  it('rejects NaN and Infinity anywhere', () => {
    expect(() => createAudienceSimulationFixedState(validFixed({ totalAddressableAudience: NaN }))).toThrow();
    expect(() => createAudienceSimulationFixedState(validFixed({ totalAddressableAudience: Infinity }))).toThrow();
    expect(() => createAudienceSimulationFixedState(validFixed({ marketingEfficiency: NaN }))).toThrow();
  });

  it('remains valid for a tiny addressable audience', () => {
    expect(() => createAudienceSimulationFixedState(validFixed({ totalAddressableAudience: 1 }))).not.toThrow();
  });

  it('remains valid for an extremely large addressable audience', () => {
    expect(() => createAudienceSimulationFixedState(validFixed({ totalAddressableAudience: 8_000_000_000 }))).not.toThrow();
  });
});

describe('maxInterestedAudience', () => {
  it('is base + crossover capacity, scaled by the addressable audience', () => {
    const fixed = createAudienceSimulationFixedState(
      validFixed({ totalAddressableAudience: 1000, baseInterestFraction: 0.3, crossoverCapacityFraction: 0.2 }),
    );
    expect(maxInterestedAudience(fixed)).toBe(500);
  });
});

describe('createAudienceSimulationWeekState', () => {
  const fixed = createAudienceSimulationFixedState(validFixed({ totalAddressableAudience: 1000, baseInterestFraction: 0.3, crossoverCapacityFraction: 0.1 }));

  it('accepts a well-formed week', () => {
    expect(() =>
      createAudienceSimulationWeekState(fixed, { week: 1, awareCount: 400, interestedRemaining: 300, cumulativeTicketsSold: 50 }),
    ).not.toThrow();
  });

  it('rejects a negative pool of any kind', () => {
    expect(() => createAudienceSimulationWeekState(fixed, { week: 1, awareCount: -1, interestedRemaining: 0, cumulativeTicketsSold: 0 })).toThrow();
    expect(() => createAudienceSimulationWeekState(fixed, { week: 1, awareCount: 0, interestedRemaining: -1, cumulativeTicketsSold: 0 })).toThrow();
    expect(() => createAudienceSimulationWeekState(fixed, { week: 1, awareCount: 0, interestedRemaining: 0, cumulativeTicketsSold: -1 })).toThrow();
  });

  it('rejects awareCount exceeding totalAddressableAudience', () => {
    expect(() =>
      createAudienceSimulationWeekState(fixed, { week: 1, awareCount: 1001, interestedRemaining: 0, cumulativeTicketsSold: 0 }),
    ).toThrow();
  });

  it('rejects interestedRemaining exceeding awareCount', () => {
    expect(() =>
      createAudienceSimulationWeekState(fixed, { week: 1, awareCount: 100, interestedRemaining: 150, cumulativeTicketsSold: 0 }),
    ).toThrow();
  });

  it('rejects interestedRemaining exceeding this film\'s maxInterestedAudience ceiling even when awareCount would allow it', () => {
    // ceiling here is (0.3 + 0.1) * 1000 = 400
    expect(() =>
      createAudienceSimulationWeekState(fixed, { week: 1, awareCount: 900, interestedRemaining: 450, cumulativeTicketsSold: 0 }),
    ).toThrow();
  });

  it('rejects cumulativeTicketsSold exceeding totalAddressableAudience (no repeat viewing modeled)', () => {
    expect(() =>
      createAudienceSimulationWeekState(fixed, { week: 1, awareCount: 1000, interestedRemaining: 400, cumulativeTicketsSold: 1001 }),
    ).toThrow();
  });

  it('rejects a non-positive or non-integer week number', () => {
    expect(() => createAudienceSimulationWeekState(fixed, { week: 0, awareCount: 0, interestedRemaining: 0, cumulativeTicketsSold: 0 })).toThrow();
    expect(() => createAudienceSimulationWeekState(fixed, { week: 1.5, awareCount: 0, interestedRemaining: 0, cumulativeTicketsSold: 0 })).toThrow();
  });

  it('rejects NaN/Infinity in any weekly field', () => {
    expect(() => createAudienceSimulationWeekState(fixed, { week: 1, awareCount: NaN, interestedRemaining: 0, cumulativeTicketsSold: 0 })).toThrow();
    expect(() => createAudienceSimulationWeekState(fixed, { week: 1, awareCount: Infinity, interestedRemaining: 0, cumulativeTicketsSold: 0 })).toThrow();
  });
});

describe('createAudienceSimulationRun', () => {
  const fixed = validFixed({ totalAddressableAudience: 1000, baseInterestFraction: 0.3, crossoverCapacityFraction: 0.1 });

  function week(overrides: Partial<AudienceSimulationWeekState>): AudienceSimulationWeekState {
    return { week: 1, awareCount: 400, interestedRemaining: 300, cumulativeTicketsSold: 50, ...overrides };
  }

  it('accepts a well-formed multi-week history', () => {
    const run = createAudienceSimulationRun(fixed, [
      week({ week: 1, awareCount: 400, interestedRemaining: 300, cumulativeTicketsSold: 100 }),
      week({ week: 2, awareCount: 450, interestedRemaining: 220, cumulativeTicketsSold: 170 }),
      week({ week: 3, awareCount: 460, interestedRemaining: 150, cumulativeTicketsSold: 220 }),
    ]);
    expect(run.weeks).toHaveLength(3);
  });

  it('rejects a run that does not start at week 1', () => {
    expect(() => createAudienceSimulationRun(fixed, [week({ week: 2 })])).toThrow();
  });

  it('rejects non-sequential week numbers', () => {
    expect(() =>
      createAudienceSimulationRun(fixed, [week({ week: 1 }), week({ week: 3 })]),
    ).toThrow();
  });

  it('rejects awareCount decreasing week to week', () => {
    expect(() =>
      createAudienceSimulationRun(fixed, [
        week({ week: 1, awareCount: 400, cumulativeTicketsSold: 50 }),
        week({ week: 2, awareCount: 300, cumulativeTicketsSold: 60 }),
      ]),
    ).toThrow();
  });

  it('rejects cumulativeTicketsSold decreasing week to week', () => {
    expect(() =>
      createAudienceSimulationRun(fixed, [
        week({ week: 1, awareCount: 400, cumulativeTicketsSold: 100 }),
        week({ week: 2, awareCount: 400, cumulativeTicketsSold: 90 }),
      ]),
    ).toThrow();
  });

  it('allows interestedRemaining to move non-monotonically (it both shrinks via conversion and grows via crossover)', () => {
    expect(() =>
      createAudienceSimulationRun(fixed, [
        week({ week: 1, awareCount: 400, interestedRemaining: 200, cumulativeTicketsSold: 50 }),
        week({ week: 2, awareCount: 450, interestedRemaining: 250, cumulativeTicketsSold: 90 }),
      ]),
    ).not.toThrow();
  });

  it('produces an empty-history run without error (release week not yet settled)', () => {
    expect(() => createAudienceSimulationRun(fixed, [])).not.toThrow();
  });
});

describe('deriveWeeklyAdmissions', () => {
  const fixed = validFixed({ totalAddressableAudience: 1000 });

  it('is the release week\'s full cumulative total for week 1', () => {
    const run = createAudienceSimulationRun(fixed, [
      { week: 1, awareCount: 400, interestedRemaining: 200, cumulativeTicketsSold: 120 },
    ]);
    expect(deriveWeeklyAdmissions(run.weeks, 0)).toBe(120);
  });

  it('is the difference between consecutive cumulative totals thereafter', () => {
    const run = createAudienceSimulationRun(fixed, [
      { week: 1, awareCount: 400, interestedRemaining: 200, cumulativeTicketsSold: 120 },
      { week: 2, awareCount: 420, interestedRemaining: 150, cumulativeTicketsSold: 190 },
    ]);
    expect(deriveWeeklyAdmissions(run.weeks, 1)).toBe(70);
  });

  it('throws for an out-of-range week index', () => {
    const run = createAudienceSimulationRun(fixed, [{ week: 1, awareCount: 10, interestedRemaining: 5, cumulativeTicketsSold: 5 }]);
    expect(() => deriveWeeklyAdmissions(run.weeks, 5)).toThrow();
    expect(() => deriveWeeklyAdmissions(run.weeks, -1)).toThrow();
  });
});

describe('deriveWordOfMouthActivity', () => {
  const fixed = validFixed({ totalAddressableAudience: 10_000 });

  it('is zero before any week has been settled', () => {
    const run = createAudienceSimulationRun(fixed, []);
    expect(deriveWordOfMouthActivity(run.weeks, 0)).toBe(0);
  });

  it('weights the most recent week most heavily', () => {
    // Same two admissions figures (100 and 20), just swapped between weeks 1
    // and 2 - if recency is weighted correctly, putting the bigger number in
    // the more recent week must produce a larger activity reading.
    const recentSpike = createAudienceSimulationRun(fixed, [
      { week: 1, awareCount: 1000, interestedRemaining: 500, cumulativeTicketsSold: 20 }, // +20
      { week: 2, awareCount: 1000, interestedRemaining: 400, cumulativeTicketsSold: 120 }, // +100
    ]);
    const olderSpike = createAudienceSimulationRun(fixed, [
      { week: 1, awareCount: 1000, interestedRemaining: 500, cumulativeTicketsSold: 100 }, // +100
      { week: 2, awareCount: 1000, interestedRemaining: 400, cumulativeTicketsSold: 120 }, // +20
    ]);
    expect(deriveWordOfMouthActivity(recentSpike.weeks, 2)).toBeGreaterThan(deriveWordOfMouthActivity(olderSpike.weeks, 2));
    // Exact figure: week 2's +100 at full weight (1) plus week 1's +20 at the next lookback weight (0.7).
    expect(deriveWordOfMouthActivity(recentSpike.weeks, 2)).toBeCloseTo(100 * 1 + 20 * 0.7, 5);
  });

  it('never grows unboundedly with an arbitrarily long history - only a bounded recent window contributes', () => {
    const weeks: AudienceSimulationWeekState[] = [];
    let cumulative = 0;
    for (let w = 1; w <= 20; w++) {
      cumulative += 50; // constant weekly admissions across a long run
      weeks.push({ week: w, awareCount: 5000, interestedRemaining: 1000, cumulativeTicketsSold: cumulative });
    }
    const run = createAudienceSimulationRun(fixed, weeks);
    const activityAt20 = deriveWordOfMouthActivity(run.weeks, 20);
    const activityAt10 = deriveWordOfMouthActivity(run.weeks, 10);
    // Same steady-state weekly admissions throughout, so a bounded lookback
    // should produce the same activity regardless of how long the run has
    // been going - proof this isn't secretly an unbounded cumulative sum.
    expect(activityAt20).toBeCloseTo(activityAt10, 5);
  });

  it('is a pure function of the history - calling it twice with the same input gives the same result', () => {
    const run = createAudienceSimulationRun(fixed, [
      { week: 1, awareCount: 1000, interestedRemaining: 500, cumulativeTicketsSold: 300 },
      { week: 2, awareCount: 1200, interestedRemaining: 450, cumulativeTicketsSold: 500 },
    ]);
    expect(deriveWordOfMouthActivity(run.weeks, 2)).toBe(deriveWordOfMouthActivity(run.weeks, 2));
  });
});

describe('fixed vs. evolving state stay clearly separated', () => {
  it('AudienceSimulationFixedState never varies by week - constructing many weeks against the same fixed state does not mutate it', () => {
    const fixed = createAudienceSimulationFixedState(validFixed({ totalAddressableAudience: 1000 }));
    const before = { ...fixed };
    createAudienceSimulationWeekState(fixed, { week: 1, awareCount: 500, interestedRemaining: 300, cumulativeTicketsSold: 50 });
    createAudienceSimulationWeekState(fixed, { week: 2, awareCount: 600, interestedRemaining: 250, cumulativeTicketsSold: 120 });
    expect(fixed).toEqual(before);
  });

  it('AudienceSimulationWeekState carries only the three evolving fields plus its week number - no fixed-state fields leak into it', () => {
    const fixed = createAudienceSimulationFixedState(validFixed());
    const week = createAudienceSimulationWeekState(fixed, { week: 1, awareCount: 10, interestedRemaining: 5, cumulativeTicketsSold: 1 });
    expect(Object.keys(week).sort()).toEqual(['awareCount', 'cumulativeTicketsSold', 'interestedRemaining', 'week']);
  });
});

describe('word-of-mouth activity is never present as stored duplicate state', () => {
  it('AudienceSimulationWeekState has no momentum/word-of-mouth/pulse/reaction field of any kind', () => {
    const fixed = createAudienceSimulationFixedState(validFixed());
    const week = createAudienceSimulationWeekState(fixed, { week: 1, awareCount: 10, interestedRemaining: 5, cumulativeTicketsSold: 1 });
    const forbiddenNamePattern = /momentum|wordofmouth|wom|pulse|reaction|hype|buzz/i;
    for (const key of Object.keys(week)) {
      expect(key).not.toMatch(forbiddenNamePattern);
    }
  });

  it('AudienceSimulationFixedState has no momentum/pulse/reaction field either - only criticScore/audienceScore represent reception, reused not duplicated', () => {
    const fixed = createAudienceSimulationFixedState(validFixed());
    const forbiddenNamePattern = /momentum|wordofmouth|^wom$|pulse|^reaction/i;
    for (const key of Object.keys(fixed)) {
      expect(key).not.toMatch(forbiddenNamePattern);
    }
  });

  it('deriveWordOfMouthActivity recomputes from history rather than reading a cached value - two independently-constructed but identical histories agree exactly', () => {
    const fixed = validFixed({ totalAddressableAudience: 10_000 });
    const runA = createAudienceSimulationRun(fixed, [
      { week: 1, awareCount: 1000, interestedRemaining: 500, cumulativeTicketsSold: 300 },
      { week: 2, awareCount: 1200, interestedRemaining: 450, cumulativeTicketsSold: 500 },
    ]);
    const runB = createAudienceSimulationRun(fixed, [
      { week: 1, awareCount: 1000, interestedRemaining: 500, cumulativeTicketsSold: 300 },
      { week: 2, awareCount: 1200, interestedRemaining: 450, cumulativeTicketsSold: 500 },
    ]);
    expect(deriveWordOfMouthActivity(runA.weeks, 2)).toBe(deriveWordOfMouthActivity(runB.weeks, 2));
  });
});
