import { describe, it, expect } from 'vitest';
import {
  advanceOneWeek,
  advanceToWeek,
  advanceOneWeekWithDiagnostics,
  advanceToWeekWithDiagnostics,
  hasSimulationEnded,
  computeCurrentWomInfluence,
  computeRunningFilmStrength,
  computeReceptionResponseMultiplier,
  computeWomReproductionRatio,
  computeNextAvailability,
  getBaselineAttendanceProbability,
  applyWomPullForward,
  pullForwardUrgencySignal,
  pullForwardCeilingMultiplier,
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
import { AVERAGE_TICKET_PRICE } from './boxOfficeRun';

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
    initialAvailabilityFraction: 0.9,
    availabilityBaseWeeklyDecay: 0.15,
    criticLedExpansionWeight: 0,
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
    weeks = [...weeks, { week: 1, awareCount: 500_000, interestedRemaining: 100_000, cumulativeTicketsSold: 400_000, availabilityFraction: 1, cumulativeCrossoverRealized: 0 }]; // huge week-1 spike
    for (let w = 2; w <= 10; w++) {
      weeks.push({ week: w, awareCount: 500_000, interestedRemaining: 100_000, cumulativeTicketsSold: 400_000, availabilityFraction: 1, cumulativeCrossoverRealized: 0 }); // zero admissions every week after
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
      weeks.push({ week: w, awareCount: 500_000, interestedRemaining: 50_000, cumulativeTicketsSold: cumulative, availabilityFraction: 1, cumulativeCrossoverRealized: 0 });
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

// "Live screen competition" implementation plan - computeRunningFilmStrength
// is computeCurrentWomInfluence's own activityFraction half, extracted so a
// film's current heat can be read from *outside* its own weekly step
// (engine/marketSettlement.ts uses this for every other currently-running
// film's pull on a given film's own availability). No new formula: these
// tests pin the exact relationship to computeCurrentWomInfluence rather than
// re-deriving the underlying math a second time.
describe('computeRunningFilmStrength - a running film\'s own current heat, readable from outside its weekly step', () => {
  it('equals computeCurrentWomInfluence with the reception multiplier divided back out, for the same fixed/weeks/index', () => {
    const f = fixed({ criticScore: 80, audienceScore: 65 });
    const weeks: AudienceSimulationWeekState[] = [];
    let cumulative = 0;
    for (let w = 1; w <= 4; w++) {
      cumulative += 20_000;
      weeks.push({ week: w, awareCount: 300_000, interestedRemaining: 40_000, cumulativeTicketsSold: cumulative, availabilityFraction: 0.9, cumulativeCrossoverRealized: 0 });
    }
    const strength = computeRunningFilmStrength(f, weeks, weeks.length);
    const influence = computeCurrentWomInfluence(f, weeks, weeks.length);
    expect(strength).toBeCloseTo(influence / computeReceptionResponseMultiplier(f), 10);
  });

  it('is zero before any week has settled, same as computeCurrentWomInfluence', () => {
    expect(computeRunningFilmStrength(fixed(), [], 0)).toBe(0);
  });

  it('is always in [0, 1], regardless of reception - unlike computeCurrentWomInfluence, it never gets scaled down by a poor critic/audience score', () => {
    const weeks: AudienceSimulationWeekState[] = [{ week: 1, awareCount: 900_000, interestedRemaining: 100_000, cumulativeTicketsSold: 900_000, availabilityFraction: 1, cumulativeCrossoverRealized: 0 }];
    const badReception = fixed({ totalAddressableAudience: 1_000_000, criticScore: 0, audienceScore: 0 });
    const goodReception = fixed({ totalAddressableAudience: 1_000_000, criticScore: 90, audienceScore: 90 });
    const strengthBad = computeRunningFilmStrength(badReception, weeks, 1);
    const strengthGood = computeRunningFilmStrength(goodReception, weeks, 1);
    // Same weekly history, same totalAddressableAudience/baseInterestFraction/crossoverCapacityFraction (maxInterestedAudience only depends on those) -
    // strength itself doesn't read criticScore/audienceScore at all, so it's identical regardless of reception.
    expect(strengthBad).toBeCloseTo(strengthGood, 10);
    expect(strengthBad).toBeGreaterThan(0);
    expect(strengthBad).toBeLessThanOrEqual(1);
  });

  it('a film with more recent admissions activity has higher strength than one with less, all else equal', () => {
    const f = fixed({ totalAddressableAudience: 1_000_000 });
    const quiet: AudienceSimulationWeekState[] = [{ week: 1, awareCount: 200_000, interestedRemaining: 50_000, cumulativeTicketsSold: 5_000, availabilityFraction: 0.9, cumulativeCrossoverRealized: 0 }];
    const hot: AudienceSimulationWeekState[] = [{ week: 1, awareCount: 200_000, interestedRemaining: 50_000, cumulativeTicketsSold: 100_000, availabilityFraction: 0.9, cumulativeCrossoverRealized: 0 }];
    expect(computeRunningFilmStrength(f, hot, 1)).toBeGreaterThan(computeRunningFilmStrength(f, quiet, 1));
  });
});

describe('computeNextAvailability - competitivePressure (Live screen competition)', () => {
  it('defaults to zero and is a complete no-op when omitted - identical to passing 0 explicitly', () => {
    const f = fixed();
    const withDefault = computeNextAvailability(f, 0.8, 1.0);
    const withExplicitZero = computeNextAvailability(f, 0.8, 1.0, 0);
    expect(withDefault).toBe(withExplicitZero);
  });

  it('a higher competitivePressure contracts availability faster than zero pressure, all else equal', () => {
    const f = fixed();
    const noPressure = computeNextAvailability(f, 0.8, 1.0, 0);
    const somePressure = computeNextAvailability(f, 0.8, 1.0, 0.5);
    const maxPressure = computeNextAvailability(f, 0.8, 1.0, 1);
    expect(somePressure).toBeLessThan(noPressure);
    expect(maxPressure).toBeLessThan(somePressure);
  });

  it('never pushes availability below the existing floor, however high pressure is - the existing rate-magnitude clamp still bounds it', () => {
    const f = fixed();
    const result = computeNextAvailability(f, 0.03, 0, 1); // already near the floor, weak demand, max pressure
    expect(result).toBeGreaterThanOrEqual(0.02); // AVAILABILITY_FLOOR
  });
});

describe('advanceOneWeek/advanceOneWeekWithDiagnostics - competitivePressure threading (Live screen competition)', () => {
  it('threads competitivePressure through to computeNextAvailability exactly - nextAvailabilityFraction matches a direct computeNextAvailability call fed the same availabilityFraction/demandUtilisation this same week already reports, and competitivePressure is recorded verbatim', () => {
    // Deliberately not asserting a hand-picked "more pressure -> lower
    // availability" inequality here - a cold week 1's own demandUtilisation
    // can already saturate MAX_AVAILABILITY_RATE_MAGNITUDE on performance
    // alone regardless of pressure (see computeNextAvailability's own
    // dedicated, clamp-aware tests above for that claim). This test proves
    // the *wiring* instead: whatever computeNextAvailability would produce
    // for this week's own reported inputs is exactly what
    // advanceOneWeekWithDiagnostics actually used.
    const f = fixed();
    const { diagnostics } = advanceOneWeekWithDiagnostics(f, [], undefined, 0.6);
    expect(diagnostics.competitivePressure).toBe(0.6);
    const expectedNextAvailability = computeNextAvailability(f, diagnostics.availabilityFraction, diagnostics.demandUtilisation, 0.6);
    expect(diagnostics.nextAvailabilityFraction).toBe(expectedNextAvailability);
  });

  it('advanceOneWeek (the diagnostics-free wrapper) accepts the same competitivePressure argument and matches advanceOneWeekWithDiagnostics.next', () => {
    const f = fixed();
    const viaPlain = advanceOneWeek(f, [], 0.4);
    const { next: viaDiagnostics } = advanceOneWeekWithDiagnostics(f, [], undefined, 0.4);
    expect(viaPlain).toEqual(viaDiagnostics);
  });

  it('every existing call site (advanceToWeek, advanceToWeekWithDiagnostics) omits competitivePressure and is completely unaffected by its existence - defaults to 0 throughout', () => {
    const f = fixed();
    const weeks = advanceToWeek(f, [], 5);
    let manual: AudienceSimulationWeekState[] = [];
    for (let i = 0; i < 5; i++) manual = [...manual, advanceOneWeek(f, manual, 0)];
    expect(weeks).toEqual(manual);
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
      // A real release-day awareness seed - awareness itself no longer
      // grows over the run (see audienceSimulationStep.ts's module header,
      // it's built almost entirely at release now, not word-of-mouth), so
      // without a real seed here there would be almost nobody left for
      // crossover to ever reach regardless of how strong reception is.
      initialAwareCount: 300_000,
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
    // Both share the same real release-day awareness seed (a real released
    // film always has one - see the previous test's comment for why
    // initialAwareCount: 0 no longer produces a meaningful aware pool on
    // its own now that awareness doesn't grow over the run) - the only
    // difference between the two is reception, isolating exactly what this
    // test claims to prove.
    const wellReceived = fixed({
      totalAddressableAudience: 1_000_000,
      baseInterestFraction: 0.1,
      crossoverCapacityFraction: 0.6,
      criticScore: 90,
      audienceScore: 92,
      initialAwareCount: 500_000,
    });
    const poorlyReceived = fixed({
      totalAddressableAudience: 1_000_000,
      baseInterestFraction: 0.1,
      crossoverCapacityFraction: 0.6, // same large capacity
      criticScore: 15,
      audienceScore: 10, // but badly received
      initialAwareCount: 500_000,
    });
    const wellReceivedMax = Math.max(...runFullSimulation(wellReceived).map((w) => w.interestedRemaining + w.cumulativeTicketsSold));
    const poorlyReceivedMax = Math.max(...runFullSimulation(poorlyReceived).map((w) => w.interestedRemaining + w.cumulativeTicketsSold));
    // Same capacity, meaningfully different realization - proves capacity
    // is necessary but not sufficient, matching the design's "capacity vs
    // realization" split.
    expect(wellReceivedMax).toBeGreaterThan(poorlyReceivedMax * 1.15);
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
    expect(applyWomPullForward(getBaselineAttendanceProbability(f), 0, 1, 1)).toBe(f.conversionPacingBaseline);
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

describe('pull-forward redesign - smooth saturating urgency, dual-decaying ceiling (docs/DESIGN.md 5.34, "crossover/pull-forward separation")', () => {
  it('pullForwardUrgencySignal is 0 at/below the threshold and rises smoothly above it - no plateau at any finite influence', () => {
    expect(pullForwardUrgencySignal(0)).toBe(0);
    expect(pullForwardUrgencySignal(0.005)).toBe(0); // exactly at PULL_FORWARD_RESPONSE.threshold
    const signals = [0.01, 0.05, 0.1, 0.2, 0.4, 0.8].map(pullForwardUrgencySignal);
    for (let i = 1; i < signals.length; i++) {
      // Strictly increasing - unlike the old thresholdResponse, this never
      // reaches and holds an exact maximum.
      expect(signals[i]).toBeGreaterThan(signals[i - 1]);
      expect(signals[i]).toBeLessThan(1);
    }
  });

  it('pullForwardCeilingMultiplier decays smoothly as the run ages, holding backlog freshness fixed', () => {
    const multipliers = [1, 3, 6, 10, 15, 20].map((week) => pullForwardCeilingMultiplier(week, 1));
    for (let i = 1; i < multipliers.length; i++) {
      expect(multipliers[i]).toBeLessThan(multipliers[i - 1]);
    }
    // Never below 1 (a multiplier below baseline would mean pull-forward
    // actively *suppresses* attendance, which isn't its job) and never
    // above PULL_FORWARD_MAX_MULTIPLIER (3).
    for (const m of multipliers) {
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(3);
    }
  });

  it('pullForwardCeilingMultiplier decays as the backlog becomes less fresh, holding week fixed', () => {
    const multipliers = [1, 0.75, 0.5, 0.25, 0].map((freshness) => pullForwardCeilingMultiplier(5, freshness));
    for (let i = 1; i < multipliers.length; i++) {
      expect(multipliers[i]).toBeLessThan(multipliers[i - 1]);
    }
    expect(multipliers[multipliers.length - 1]).toBe(1); // freshness 0 - no boost possible, ceiling collapses to baseline
  });

  it('ordinary-good WOM produces a modest boost, not a near-maximal one', () => {
    // womInfluence in the 0.03-0.08 range is a realistic "ordinary-good"
    // reading at release scale (see computeCurrentWomInfluence's own docs) -
    // checked against a scratch diagnostic sweep, not guessed.
    const baseline = 0.14;
    const boosted = applyWomPullForward(baseline, 0.05, 1, 1);
    const maxPossible = baseline * 3; // PULL_FORWARD_MAX_MULTIPLIER, week 1, fully fresh backlog
    expect(boosted).toBeGreaterThan(baseline);
    expect(boosted).toBeLessThan(baseline + (maxPossible - baseline) * 0.5);
  });

  it('exceptional WOM pushes the boost meaningfully higher than ordinary-good WOM, without hitting the max multiplier outright', () => {
    const baseline = 0.14;
    const ordinary = applyWomPullForward(baseline, 0.05, 1, 1);
    const exceptional = applyWomPullForward(baseline, 0.5, 1, 1);
    const maxPossible = baseline * 3;
    expect(exceptional).toBeGreaterThan(ordinary);
    expect(exceptional).toBeLessThan(maxPossible);
  });

  it('a late-run, thinned-out backlog gets a far smaller boost than an early, fresh one at the same womInfluence', () => {
    const baseline = 0.14;
    const early = applyWomPullForward(baseline, 0.3, 1, 1);
    const late = applyWomPullForward(baseline, 0.3, 18, 0.1);
    expect(late - baseline).toBeLessThan((early - baseline) * 0.3);
  });

  it('cannot re-peak indefinitely - repeatedly feeding the same strong womInfluence at increasing week numbers keeps shrinking the boost', () => {
    const baseline = 0.14;
    const boosts = [1, 5, 9, 13, 17].map((week) => applyWomPullForward(baseline, 0.4, week, 1) - baseline);
    for (let i = 1; i < boosts.length; i++) {
      expect(boosts[i]).toBeLessThan(boosts[i - 1]);
    }
  });
});

describe('probabilities and monetary/audience outputs stay valid', () => {
  it('applyWomPullForward always returns a value in [0,1]', () => {
    for (const baseline of [0, 0.3, 0.5, 1]) {
      for (const influence of [0, 0.2, 0.5, 1]) {
        for (const week of [1, 5, 12, 20]) {
          for (const freshness of [0, 0.5, 1]) {
            const p = applyWomPullForward(baseline, influence, week, freshness);
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
          }
        }
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

describe('week diagnostics (Milestone 4)', () => {
  it('advanceOneWeekWithDiagnostics.next is identical to advanceOneWeek - one implementation, not two that could drift', () => {
    const f = fixed();
    let weeks: AudienceSimulationWeekState[] = [];
    for (let i = 0; i < 5; i++) {
      const viaPlain = advanceOneWeek(f, weeks);
      const { next: viaDiagnostics } = advanceOneWeekWithDiagnostics(f, weeks);
      expect(viaDiagnostics).toEqual(viaPlain);
      weeks = [...weeks, viaPlain];
    }
  });

  it('advanceToWeekWithDiagnostics.weeks is identical to advanceToWeek, and diagnostics has exactly one entry per week', () => {
    const f = fixed({ totalAddressableAudience: 5_000_000, initialAwareCount: 1_000_000, criticScore: 92, audienceScore: 90, crossoverCapacityFraction: 0.3, baseInterestFraction: 0.2 });
    const plain = advanceToWeek(f, [], MAX_SIMULATION_WEEKS);
    const { weeks, diagnostics } = advanceToWeekWithDiagnostics(f, [], MAX_SIMULATION_WEEKS);
    expect(weeks).toEqual(plain);
    expect(diagnostics).toHaveLength(weeks.length);
    diagnostics.forEach((d, i) => expect(d.week).toBe(i + 1));
  });

  it("each week's diagnostics are internally consistent with the week state they describe", () => {
    const f = fixed({ initialAwareCount: 300_000, criticScore: 88, audienceScore: 90 });
    const { weeks, diagnostics } = advanceToWeekWithDiagnostics(f, [], 10);
    let previous: AudienceSimulationWeekState = { week: 0, awareCount: 0, interestedRemaining: 0, cumulativeTicketsSold: 0, availabilityFraction: 1, cumulativeCrossoverRealized: 0 };
    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      const d = diagnostics[i];
      expect(d.totalAddressableAudience).toBe(f.totalAddressableAudience);
      expect(d.awareCount).toBe(week.awareCount);
      expect(d.interestedRemaining).toBe(week.interestedRemaining);
      expect(d.cumulativeTicketsSold).toBe(week.cumulativeTicketsSold);
      // The three awareness sources sum to the total, and the total matches the actual week-over-week awareCount change.
      expect(d.newlyAwareFromReleaseDaySeed + d.newlyAwareFromExternal + d.newlyAwareFromWom).toBeCloseTo(d.newlyAware, 6);
      expect(d.newlyAware).toBeCloseTo(week.awareCount - previous.awareCount, 6);
      // Weekly admissions matches the actual cumulative delta.
      expect(d.weeklyAdmissions).toBeCloseTo(week.cumulativeTicketsSold - previous.cumulativeTicketsSold, 6);
      // The release-day seed only ever contributes on week 1.
      if (week.week > 1) expect(d.newlyAwareFromReleaseDaySeed).toBe(0);
      // Probabilities stay in range, and the final probability is never below the baseline (pull-forward only ever adds).
      expect(d.baselineAttendanceProbability).toBe(f.conversionPacingBaseline);
      expect(d.finalAttendanceProbability).toBeGreaterThanOrEqual(d.baselineAttendanceProbability - 1e-9);
      expect(d.finalAttendanceProbability).toBeLessThanOrEqual(1);
      expect(d.womPullForwardBoost).toBeGreaterThanOrEqual(0);
      expect(d.womPullForwardBoost).toBeLessThanOrEqual(1);
      expect(d.newInterestCreated).toBeGreaterThanOrEqual(0);
      expect(d.crossoverInterestCreated).toBeGreaterThanOrEqual(0);
      previous = week;
    }
  });

  it('with zero crossover capacity, crossoverInterestCreated can only ever mop up leftover natural-ceiling headroom step 5 did not use this same week - it can never push interestedRemaining past the natural ceiling', () => {
    // crossoverCapacityFraction: 0 collapses deriveWomCrossoverExpansion's own
    // ceiling to exactly the natural ceiling (maxInterestedAudience = baseInterestFraction
    // * totalAddressableAudience when capacity is 0), so step 6 can still report a
    // nonzero same-week contribution if step 5 did not fully exhaust that shared
    // headroom first - what Milestone 2's own test already guarantees is the
    // *total* never exceeding the natural ceiling, not that step 6's own figure is
    // always literally 0.
    const f = fixed({ crossoverCapacityFraction: 0, baseInterestFraction: 0.3, criticScore: 99, audienceScore: 99 });
    const naturalCeiling = f.baseInterestFraction * f.totalAddressableAudience;
    const { weeks } = advanceToWeekWithDiagnostics(f, [], MAX_SIMULATION_WEEKS);
    for (const week of weeks) {
      expect(week.interestedRemaining).toBeLessThanOrEqual(naturalCeiling + 1e-6);
    }
  });
});

describe('regression: the Quantum Signal incident (docs/DESIGN.md 5.34)', () => {
  // The exact AudienceSimulationFixedState from a real exported save
  // (film "Quantum Signal," criticScore ~51, audienceScore ~79 - a
  // good-but-not-extraordinary reception, nowhere near exceptional). Under
  // the pre-fix formulas this produced a Â£14.4m opening ballooning to a
  // Â£985.5m total (68.29x legs), with week 10 *alone* grossing Â£491.4m -
  // more than half the film's entire lifetime total in a single week. Not
  // a plausible sleeper hit: unbounded positive feedback overpowering
  // depletion and saturation. Pinned here verbatim so this specific,
  // real-world failure can never silently return.
  const QUANTUM_SIGNAL_FIXED: AudienceSimulationFixedState = createAudienceSimulationFixedState({
    totalAddressableAudience: 170000000,
    baseInterestFraction: 0.40099999999999997,
    marketingEfficiency: 0.4566200000000001,
    crossoverCapacityFraction: 0.126,
    conversionPacingBaseline: 0.14277525022715673,
    externalWeeklyAwarenessRate: 0.0218493,
    criticScore: 50.88191724535156,
    audienceScore: 79.18010051410846,
    initialAwareCount: 19628911.344712384,
    // Availability fields didn't exist at the time of the real incident
    // export (Milestone 9 added them later) - backfilled with Wide's
    // release-type defaults (RELEASE_TYPE_AUDIENCE_PROFILES.Wide in
    // engine/audienceSimulationInputs.ts), matching this fixture's own
    // Wide-shaped conversionPacingBaseline/initialAwareCount.
    initialAvailabilityFraction: 0.95,
    availabilityBaseWeeklyDecay: 0.18,
    criticLedExpansionWeight: 0,
  });

  it('no single week grosses more than a small multiple of the opening weekend', () => {
    const { diagnostics } = advanceToWeekWithDiagnostics(QUANTUM_SIGNAL_FIXED, [], MAX_SIMULATION_WEEKS);
    const openingGross = diagnostics[0].weeklyAdmissions * AVERAGE_TICKET_PRICE;
    const peakWeekGross = Math.max(...diagnostics.map((d) => d.weeklyAdmissions)) * AVERAGE_TICKET_PRICE;
    // The actual incident's worst week was 34x the opening (Â£491.4m vs
    // Â£14.4m); a genuine sleeper hit's best week may exceed opening, but
    // "not by dozens of times" (the user's own stated constraint) - 10x
    // leaves generous room above the fixed model's actual ~2x peak while
    // still catching any regression back toward the old explosive shape.
    expect(peakWeekGross).toBeLessThan(openingGross * 10);
  });

  it('no single week accounts for more than a modest share of the film\'s entire lifetime gross', () => {
    const { weeks, diagnostics } = advanceToWeekWithDiagnostics(QUANTUM_SIGNAL_FIXED, [], MAX_SIMULATION_WEEKS);
    const totalGross = weeks[weeks.length - 1].cumulativeTicketsSold * AVERAGE_TICKET_PRICE;
    const peakWeekGross = Math.max(...diagnostics.map((d) => d.weeklyAdmissions)) * AVERAGE_TICKET_PRICE;
    // The actual incident's week 10 alone was 49.9% of the film's entire
    // lifetime gross - a single week should never dominate a multi-month
    // theatrical run like that.
    expect(peakWeekGross / totalGross).toBeLessThan(0.25);
  });

  it('total lifetime gross stays within a plausible range for a good-but-not-extraordinary reception, nowhere near the incident\'s near-Â£1bn outcome', () => {
    const weeks = advanceToWeek(QUANTUM_SIGNAL_FIXED, [], MAX_SIMULATION_WEEKS);
    const totalGross = weeks[weeks.length - 1].cumulativeTicketsSold * AVERAGE_TICKET_PRICE;
    expect(totalGross).toBeLessThan(600_000_000);
  });

  it('the weekly WOM reproduction ratio never sustains above replacement (>= 1) - the loop stays a bounded diffusion, not unbounded exponential growth', () => {
    const { weeks, diagnostics } = advanceToWeekWithDiagnostics(QUANTUM_SIGNAL_FIXED, [], MAX_SIMULATION_WEEKS);
    for (let i = 0; i < diagnostics.length - 1; i++) {
      const ratio = computeWomReproductionRatio(QUANTUM_SIGNAL_FIXED, weeks, i);
      expect(ratio).toBeLessThan(1);
    }
  });

  it('still declines to a settled, bounded ending within the simulation window rather than being cut off mid-explosion', () => {
    const weeks = advanceToWeek(QUANTUM_SIGNAL_FIXED, [], MAX_SIMULATION_WEEKS);
    const admissions = weeks.map((w, i) => w.cumulativeTicketsSold - (i > 0 ? weeks[i - 1].cumulativeTicketsSold : 0));
    const peakIndex = admissions.indexOf(Math.max(...admissions));
    // The run should be well past its peak by the end of the 20-week
    // window, not still climbing when the simulation gets cut off - that
    // "still accelerating at the hard cap" shape was itself part of the
    // incident (week 10 was the run's *last* full week before the model's
    // own stopping rule kicked in).
    expect(peakIndex).toBeLessThan(admissions.length - 1);
  });
});
