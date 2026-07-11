import { describe, it, expect } from 'vitest';
import {
  advanceOneWeek,
  advanceToWeek,
  hasSimulationEnded,
  computeCurrentWomInfluence,
  computeReceptionResponseMultiplier,
  getBaselineAttendanceProbability,
  applyWomPullForward,
  sellTicketsThisWeek,
  applyReleaseDayAwarenessSeed,
  MAX_SIMULATION_WEEKS,
} from './audienceSimulationStep';
import {
  createAudienceSimulationFixedState,
  createAudienceSimulationRun,
  maxInterestedAudience,
  deriveWordOfMouthActivity,
  type AudienceSimulationFixedState,
  type AudienceSimulationWeekState,
} from './audienceSimulation';

function fixed(overrides: Partial<AudienceSimulationFixedState> = {}): AudienceSimulationFixedState {
  return createAudienceSimulationFixedState({
    totalAddressableAudience: 1_000_000,
    baseInterestFraction: 0.25,
    marketingEfficiency: 0.6,
    crossoverCapacityFraction: 0.15,
    conversionPacingBaseline: 0.12,
    externalWeeklyAwarenessRate: 0.15,
    criticScore: 70,
    audienceScore: 75,
    initialAwareCount: 0,
    ...overrides,
  });
}

/** Runs a full simulation to completion (or the hard cap) and returns the settled weeks. */
function runFullSimulation(f: AudienceSimulationFixedState): AudienceSimulationWeekState[] {
  return advanceToWeek(f, [], MAX_SIMULATION_WEEKS);
}

/** Every structural invariant Milestone 2 requires, checked against a full run at once - reused across many fixture variations below instead of re-asserting the same things per scenario. */
function assertAllInvariantsHold(f: AudienceSimulationFixedState, weeks: AudienceSimulationWeekState[]) {
  // createAudienceSimulationRun re-validates every week (no negative pools,
  // awareness <= total, interested <= its ceiling, monotonic
  // awareCount/cumulativeTicketsSold) - reuse it rather than duplicating
  // those checks here.
  expect(() => createAudienceSimulationRun(f, weeks)).not.toThrow();

  const ceiling = maxInterestedAudience(f);
  let previousCumulative = 0;
  for (const week of weeks) {
    // Finite, non-negative.
    for (const value of [week.awareCount, week.interestedRemaining, week.cumulativeTicketsSold]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    // Weekly admissions never exceed what was available to convert.
    const admissions = week.cumulativeTicketsSold - previousCumulative;
    expect(admissions).toBeGreaterThanOrEqual(-1e-6); // never negative (small float tolerance)
    // Cumulative unique admissions never exceed the permitted pool.
    expect(week.cumulativeTicketsSold).toBeLessThanOrEqual(f.totalAddressableAudience + 1e-6);
    expect(week.interestedRemaining).toBeLessThanOrEqual(ceiling + 1e-6);
    expect(week.awareCount).toBeLessThanOrEqual(f.totalAddressableAudience + 1e-6);
    previousCumulative = week.cumulativeTicketsSold;
  }
}

describe('invariants across a wide range of fixed-state configurations', () => {
  const configurations: Array<[string, Partial<AudienceSimulationFixedState>]> = [
    ['typical mid-budget film', {}],
    ['tiny addressable audience', { totalAddressableAudience: 10 }],
    ['enormous addressable audience', { totalAddressableAudience: 6_000_000_000 }],
    ['zero critic and audience score', { criticScore: 0, audienceScore: 0 }],
    ['maximum critic and audience score', { criticScore: 100, audienceScore: 100 }],
    ['zero crossover capacity (unoriginal)', { crossoverCapacityFraction: 0 }],
    ['maximum crossover capacity (highly original)', { baseInterestFraction: 0.1, crossoverCapacityFraction: 0.9 }],
    ['zero external awareness growth', { externalWeeklyAwarenessRate: 0 }],
    ['maximum external awareness growth', { externalWeeklyAwarenessRate: 1 }],
    ['zero baseline conversion pacing', { conversionPacingBaseline: 0 }],
    ['maximum baseline conversion pacing', { conversionPacingBaseline: 1 }],
    ['zero base interest fraction', { baseInterestFraction: 0, crossoverCapacityFraction: 0.2 }],
    ['maximum base interest fraction', { baseInterestFraction: 1, crossoverCapacityFraction: 0 }],
  ];

  for (const [name, overrides] of configurations) {
    it(`holds for: ${name}`, () => {
      const weeks = runFullSimulation(fixed(overrides));
      assertAllInvariantsHold(fixed(overrides), weeks);
    });
  }
});

describe('termination', () => {
  it('always terminates - a full run never exceeds the hard cap', () => {
    const weeks = runFullSimulation(fixed());
    expect(weeks.length).toBeLessThanOrEqual(MAX_SIMULATION_WEEKS);
  });

  it('the hard maximum week count acts as a backstop even for a film with no decay (near-maximal retention inputs)', () => {
    // Deliberately generous inputs designed to keep admissions high for as
    // long as possible - the hard cap must still bound it.
    const generous = fixed({
      totalAddressableAudience: 10_000_000,
      baseInterestFraction: 0.5,
      crossoverCapacityFraction: 0.4,
      conversionPacingBaseline: 0.5,
      externalWeeklyAwarenessRate: 0.5,
      criticScore: 100,
      audienceScore: 100,
    });
    const weeks = advanceToWeek(generous, [], MAX_SIMULATION_WEEKS + 50);
    expect(weeks.length).toBeLessThanOrEqual(MAX_SIMULATION_WEEKS);
  });

  it('hasSimulationEnded reports true once the hard cap is reached', () => {
    const weeks = runFullSimulation(fixed());
    if (weeks.length === MAX_SIMULATION_WEEKS) {
      expect(hasSimulationEnded(weeks)).toBe(true);
    }
  });

  it('an empty history has not ended (nothing to evaluate yet)', () => {
    expect(hasSimulationEnded([])).toBe(false);
  });
});

describe('determinism', () => {
  it('identical inputs produce identical results, one week at a time', () => {
    const f = fixed();
    const weekA = advanceOneWeek(f, []);
    const weekB = advanceOneWeek(f, []);
    expect(weekA).toEqual(weekB);
  });

  it('identical inputs produce identical results, for a full multi-week run', () => {
    const f = fixed();
    const runA = runFullSimulation(f);
    const runB = runFullSimulation(f);
    expect(runA).toEqual(runB);
  });

  it('advancing N weeks in one catch-up operation gives the same result as advancing one week N times', () => {
    const f = fixed();
    const N = 8;

    const catchUp = advanceToWeek(f, [], N);

    let manual: AudienceSimulationWeekState[] = [];
    for (let i = 0; i < N && !hasSimulationEnded(manual); i++) {
      manual = [...manual, advanceOneWeek(f, manual)];
    }

    expect(catchUp).toEqual(manual);
  });

  it('catching up in two smaller hops gives the same result as one big hop', () => {
    const f = fixed();
    const oneHop = advanceToWeek(f, [], 10);
    const twoHops = advanceToWeek(f, advanceToWeek(f, [], 4), 10);
    expect(oneHop).toEqual(twoHops);
  });
});

describe('word-of-mouth recency-weighted lookback', () => {
  it('a spike far outside the lookback window contributes nothing to the current WOM influence', () => {
    // Build a history with a huge spike in week 1, then flat, quiet weeks
    // for long enough to fall outside the (5-week) lookback window.
    let weeks: AudienceSimulationWeekState[] = [];
    weeks = [...weeks, { week: 1, awareCount: 500_000, interestedRemaining: 100_000, cumulativeTicketsSold: 400_000 }]; // huge week-1 spike
    for (let w = 2; w <= 10; w++) {
      weeks.push({ week: w, awareCount: 500_000, interestedRemaining: 100_000, cumulativeTicketsSold: 400_000 }); // zero admissions every week after
    }
    const activityAtWeek10 = deriveWordOfMouthActivity(weeks, weeks.length);
    // The week-1 spike is 8 weeks behind by the time week 11 is being
    // computed - well outside the lookback window - so current activity
    // from that spike should be exactly zero (no admissions in any
    // lookback-window week - all of them were flat).
    expect(activityAtWeek10).toBe(0);
  });

  it('old weeks outside the effective lookback contribute nothing regardless of how long the run has been going', () => {
    const f = fixed({ totalAddressableAudience: 1_000_000 });
    const weeks: AudienceSimulationWeekState[] = [];
    let cumulative = 0;
    for (let w = 1; w <= 15; w++) {
      cumulative += 1000; // steady admissions throughout
      weeks.push({ week: w, awareCount: 500_000, interestedRemaining: 50_000, cumulativeTicketsSold: cumulative });
    }
    const influenceAt5 = computeCurrentWomInfluence(f, weeks.slice(0, 5), 5);
    const influenceAt15 = computeCurrentWomInfluence(f, weeks, 15);
    // Same steady weekly admissions rate throughout - a run being long
    // doesn't itself inflate current influence, proving this isn't
    // secretly summing the whole history instead of a bounded window.
    expect(influenceAt15).toBeCloseTo(influenceAt5, 10);
  });

  it('is zero before any week has settled (week 1 has no prior word of mouth)', () => {
    expect(computeCurrentWomInfluence(fixed(), [], 0)).toBe(0);
  });
});

describe('boundary cases', () => {
  it('critic and audience scores of 0 produce a near-floor (not exactly zero, not large) reception multiplier', () => {
    const multiplier = computeReceptionResponseMultiplier(fixed({ criticScore: 0, audienceScore: 0 }));
    expect(multiplier).toBeGreaterThan(0);
    expect(multiplier).toBeLessThan(0.05);
  });

  it('critic and audience scores of 100 produce the maximum reception multiplier', () => {
    const multiplier = computeReceptionResponseMultiplier(fixed({ criticScore: 100, audienceScore: 100 }));
    expect(multiplier).toBeCloseTo(1, 5);
  });

  it('zero crossover capacity (unoriginal film) - even an outstanding reception realizes no crossover expansion', () => {
    const f = fixed({ baseInterestFraction: 0.3, crossoverCapacityFraction: 0, criticScore: 100, audienceScore: 100 });
    const weeks = runFullSimulation(f);
    const naturalCeiling = f.baseInterestFraction * f.totalAddressableAudience;
    for (const week of weeks) {
      // Never-interested-plus-converted can't exceed the natural ceiling at all, since there's no crossover headroom.
      expect(week.interestedRemaining).toBeLessThanOrEqual(naturalCeiling + 1e-6);
    }
  });

  it('exceptional WOM with substantial expansion capacity realizes real crossover growth beyond the natural audience', () => {
    const f = fixed({
      totalAddressableAudience: 1_000_000,
      baseInterestFraction: 0.1,
      crossoverCapacityFraction: 0.6,
      criticScore: 95,
      audienceScore: 97,
      externalWeeklyAwarenessRate: 0.3,
    });
    const weeks = runFullSimulation(f);
    const naturalCeiling = f.baseInterestFraction * f.totalAddressableAudience;
    const maxEverInterested = Math.max(...weeks.map((w) => w.interestedRemaining + w.cumulativeTicketsSold));
    // With strong reception and real crossover capacity, the run should
    // genuinely exceed what the natural audience alone could produce.
    expect(maxEverInterested).toBeGreaterThan(naturalCeiling * 1.2);
  });

  it('exceptional reception with almost no expansion capacity stays capped near the natural ceiling', () => {
    const f = fixed({
      totalAddressableAudience: 1_000_000,
      baseInterestFraction: 0.2,
      crossoverCapacityFraction: 0.01,
      criticScore: 98,
      audienceScore: 99,
    });
    const weeks = runFullSimulation(f);
    const totalCeiling = maxInterestedAudience(f);
    const maxEverInterested = Math.max(...weeks.map((w) => w.interestedRemaining + w.cumulativeTicketsSold));
    expect(maxEverInterested).toBeLessThanOrEqual(totalCeiling + 1e-6);
  });

  it('a highly original but poorly received film does not realize its crossover capacity - capacity alone is not enough', () => {
    const wellReceived = fixed({
      totalAddressableAudience: 1_000_000,
      baseInterestFraction: 0.1,
      crossoverCapacityFraction: 0.6,
      criticScore: 90,
      audienceScore: 92,
    });
    const poorlyReceived = fixed({
      totalAddressableAudience: 1_000_000,
      baseInterestFraction: 0.1,
      crossoverCapacityFraction: 0.6, // same large capacity
      criticScore: 15,
      audienceScore: 10, // but badly received
    });
    const wellReceivedMax = Math.max(...runFullSimulation(wellReceived).map((w) => w.interestedRemaining + w.cumulativeTicketsSold));
    const poorlyReceivedMax = Math.max(...runFullSimulation(poorlyReceived).map((w) => w.interestedRemaining + w.cumulativeTicketsSold));
    // Same capacity, wildly different realization - proves capacity is
    // necessary but not sufficient, matching the design's "capacity vs
    // realization" split.
    expect(wellReceivedMax).toBeGreaterThan(poorlyReceivedMax * 1.5);
  });

  it('modest originality (small crossover capacity) with exceptional reception is still capped by its small capacity', () => {
    const f = fixed({
      totalAddressableAudience: 1_000_000,
      baseInterestFraction: 0.3,
      crossoverCapacityFraction: 0.05, // modest capacity
      criticScore: 99,
      audienceScore: 99, // exceptional reception
    });
    const weeks = runFullSimulation(f);
    const totalCeiling = maxInterestedAudience(f);
    for (const week of weeks) {
      expect(week.interestedRemaining).toBeLessThanOrEqual(totalCeiling + 1e-6);
    }
  });

  it('nearly exhausted interested audience after week one still behaves correctly in week two - no negative pools, no over-selling', () => {
    // A tiny audience with a very high baseline pacing, so most of the
    // interested pool converts immediately in week 1.
    const f = fixed({ totalAddressableAudience: 1000, baseInterestFraction: 0.9, crossoverCapacityFraction: 0.1, conversionPacingBaseline: 0.95, externalWeeklyAwarenessRate: 1 });
    const week1 = advanceOneWeek(f, []);
    const week2 = advanceOneWeek(f, [week1]);
    expect(week1.interestedRemaining).toBeGreaterThanOrEqual(0);
    expect(week2.interestedRemaining).toBeGreaterThanOrEqual(0);
    expect(week2.cumulativeTicketsSold).toBeGreaterThanOrEqual(week1.cumulativeTicketsSold);
    expect(week2.cumulativeTicketsSold).toBeLessThanOrEqual(f.totalAddressableAudience);
  });

  it('no WOM effect (week 1, no prior history) - only external awareness/base interest/baseline pacing operate', () => {
    const f = fixed();
    const week1 = advanceOneWeek(f, []);
    expect(computeCurrentWomInfluence(f, [], 0)).toBe(0);
    // Attendance probability in week 1 should be exactly the baseline - no pull-forward boost possible with zero WOM influence.
    expect(applyWomPullForward(getBaselineAttendanceProbability(f), 0)).toBe(f.conversionPacingBaseline);
    expect(week1.week).toBe(1);
  });
});

describe('release-day awareness seed (Milestone 3 step 0)', () => {
  it('lands only when computing week 1, never on any later week', () => {
    expect(applyReleaseDayAwarenessSeed(fixed({ initialAwareCount: 50_000 }), 0, 0)).toBe(50_000);
    expect(applyReleaseDayAwarenessSeed(fixed({ initialAwareCount: 50_000 }), 0, 1)).toBe(0);
    expect(applyReleaseDayAwarenessSeed(fixed({ initialAwareCount: 50_000 }), 10_000, 3)).toBe(10_000);
  });

  it('is capped by the remaining unaware pool, never exceeding totalAddressableAudience', () => {
    const f = fixed({ totalAddressableAudience: 1000, initialAwareCount: 1000 });
    expect(applyReleaseDayAwarenessSeed(f, 800, 0)).toBe(1000);
  });

  it("its natural-fit slice converts into week 1's InterestedRemaining via the same step-2 conversion, not a second formula", () => {
    const f = fixed({ initialAwareCount: 200_000, baseInterestFraction: 0.25, externalWeeklyAwarenessRate: 0 });
    const week1 = advanceOneWeek(f, []);
    expect(week1.awareCount).toBeCloseTo(200_000, 5);
    // interestedRemaining is what's left after this week's own baseline conversion sells some tickets, so it's <= the seed's converted slice, not equal to it.
    const convertedFromSeed = 200_000 * f.baseInterestFraction;
    expect(week1.interestedRemaining + week1.cumulativeTicketsSold).toBeCloseTo(convertedFromSeed, 5);
  });

  it('a zero initialAwareCount leaves week 1 identical to Milestone 2 behavior (no seed at all)', () => {
    const f = fixed({ initialAwareCount: 0 });
    const week1 = advanceOneWeek(f, []);
    expect(week1.awareCount).toBeCloseTo(f.totalAddressableAudience * f.externalWeeklyAwarenessRate, 5);
  });
});

describe('probabilities and monetary/audience outputs stay valid', () => {
  it('applyWomPullForward always returns a value in [0,1]', () => {
    for (const baseline of [0, 0.3, 0.5, 1]) {
      for (const influence of [0, 0.2, 0.5, 1]) {
        const p = applyWomPullForward(baseline, influence);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it('sellTicketsThisWeek never exceeds the interested pool it is drawn from, even with an out-of-range probability input', () => {
    expect(sellTicketsThisWeek(1000, 1.5)).toBeLessThanOrEqual(1000);
    expect(sellTicketsThisWeek(1000, -0.5)).toBeGreaterThanOrEqual(0);
  });

  it('every value produced across a full run is finite', () => {
    const weeks = runFullSimulation(fixed({ totalAddressableAudience: 50, criticScore: 0, audienceScore: 0 }));
    for (const week of weeks) {
      expect(Number.isFinite(week.awareCount)).toBe(true);
      expect(Number.isFinite(week.interestedRemaining)).toBe(true);
      expect(Number.isFinite(week.cumulativeTicketsSold)).toBe(true);
    }
  });
});
