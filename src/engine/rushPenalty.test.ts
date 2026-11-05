// Rushed-release penalty & theatrical screen collapse
// (docs/DESIGN_REVIEW_rush_penalty_and_screen_collapse.md).
import { describe, it, expect } from 'vitest';
import {
  advanceToWeek,
  advanceToWeekWithDiagnostics,
  collapsedAvailability,
  isScreenCollapse,
  MAX_SIMULATION_WEEKS,
} from './audienceSimulationStep';
import { createAudienceSimulationFixedState, type AudienceSimulationFixedState, type AudienceSimulationWeekState } from './audienceSimulation';
import { computeRushBreadth } from './audienceSimulationInputs';
import { effectiveRushRunwayWeeks, isScreenCollapseArmed, openingRushMultiplier, rushSeverity } from './marketing';
import { MIN_DISTRIBUTOR_RUNWAY_WEEKS, RUSH_PENALTY_MAX, SCREEN_COLLAPSE_ARM_SEVERITY } from '../data/marketing';

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
    initialAwareCount: 200_000,
    initialAvailabilityFraction: 0.95,
    availabilityBaseWeeklyDecay: 0.18,
    criticLedExpansionWeight: 0,
    ...overrides,
  });
}

const total = (weeks: AudienceSimulationWeekState[]) => weeks[weeks.length - 1].cumulativeTicketsSold;
const run = (f: AudienceSimulationFixedState) => advanceToWeek(f, [], MAX_SIMULATION_WEEKS);

describe('rush severity', () => {
  it('is full for a zero-runway full-breadth release and gone at a full rollout', () => {
    expect(rushSeverity(0, 1)).toBe(1);
    expect(rushSeverity(8, 1)).toBe(0);
    expect(rushSeverity(20, 1)).toBe(0);
  });

  it('falls concavely with runway - the first weeks of campaign matter most', () => {
    const drop1 = rushSeverity(0, 1) - rushSeverity(2, 1);
    const drop2 = rushSeverity(2, 1) - rushSeverity(4, 1);
    expect(drop1).toBeGreaterThan(drop2);
  });

  it('scales with breadth - a platform release barely feels a rush', () => {
    expect(rushSeverity(0, 0)).toBe(0);
    expect(rushSeverity(0, 0.5)).toBeCloseTo(0.5);
  });

  it('maps to an opening multiplier and a collapse arm', () => {
    expect(openingRushMultiplier(0)).toBe(1);
    expect(openingRushMultiplier(1)).toBeCloseTo(1 - RUSH_PENALTY_MAX);
    expect(isScreenCollapseArmed(SCREEN_COLLAPSE_ARM_SEVERITY)).toBe(true);
    expect(isScreenCollapseArmed(SCREEN_COLLAPSE_ARM_SEVERITY - 0.01)).toBe(false);
  });
});

describe('effective runway', () => {
  it('is absent without a campaign start day (rivals, neutral projection)', () => {
    expect(effectiveRushRunwayWeeks(undefined, 100, false)).toBeUndefined();
  });

  it('is the real runway for a self-distributed release', () => {
    expect(effectiveRushRunwayWeeks(100, 100, false)).toBe(0);
    expect(effectiveRushRunwayWeeks(100, 128, false)).toBe(4);
  });

  it('is floored under a distributor deal, which keeps it below the collapse arm', () => {
    expect(effectiveRushRunwayWeeks(100, 100, true)).toBe(MIN_DISTRIBUTOR_RUNWAY_WEEKS);
    expect(effectiveRushRunwayWeeks(100, 170, true)).toBe(10);
    expect(isScreenCollapseArmed(rushSeverity(MIN_DISTRIBUTOR_RUNWAY_WEEKS, 1))).toBe(false);
  });
});

describe('rush breadth', () => {
  it('is 0 for a Limited platform release and 1 for a full Wide commitment', () => {
    expect(computeRushBreadth(0.1)).toBe(0);
    expect(computeRushBreadth(0.02)).toBe(0);
    expect(computeRushBreadth(0.95)).toBe(1);
    expect(computeRushBreadth(0.5)).toBeGreaterThan(0);
    expect(computeRushBreadth(0.5)).toBeLessThan(1);
  });
});

describe('week-1 rush penalty', () => {
  it('leaves a run without the new fields exactly as it was', () => {
    const base = run(fixed());
    expect(run(fixed({ openingRushMultiplier: 1, screenCollapseArmed: false }))).toEqual(base);
  });

  it('cuts the opening by the multiplier, week 1 only', () => {
    const base = run(fixed());
    const rushed = run(fixed({ openingRushMultiplier: 0.4 }));
    expect(rushed[0].cumulativeTicketsSold).toBeCloseTo(base[0].cumulativeTicketsSold * 0.4, 0);
  });

  it('unarmed, the forgone opening mostly rolls forward - the film still finds its audience', () => {
    const base = total(run(fixed()));
    const rushed = total(run(fixed({ openingRushMultiplier: 0.4 })));
    // Roughly unchanged either way - it can even edge past the base, since the
    // stopping rule is relative to the (now lower) opening and runs a touch
    // longer. That is exactly why an unarmed rush cannot express distribution
    // risk on its own, and the collapse below exists.
    expect(rushed).toBeGreaterThan(base * 0.8);
    expect(rushed).toBeLessThan(base * 1.1);
  });
});

describe('screen collapse', () => {
  it('pulls an armed release that plays to empty seats, ends its run early, and leaves its audience unsold', () => {
    const base = run(fixed());
    const { weeks, diagnostics } = advanceToWeekWithDiagnostics(fixed({ openingRushMultiplier: 0.1, screenCollapseArmed: true }), [], MAX_SIMULATION_WEEKS);
    expect(diagnostics[0].screensPulled).toBe(true);
    expect(weeks[0].screensPulled).toBe(true);
    // Availability decays to nothing...
    expect(weeks[weeks.length - 1].availabilityFraction).toBe(0);
    // ...the run ends well before an ordinary one...
    expect(weeks.length).toBeLessThan(base.length);
    // ...and most of the audience it would have found is never sold to.
    expect(total(weeks)).toBeLessThan(total(base) * 0.5);
    expect(weeks[weeks.length - 1].interestedRemaining).toBeGreaterThan(0);
  });

  it('the identical soft opening, unarmed, keeps its screens (the asymptotic floor) and is never pulled', () => {
    const weeks = run(fixed({ openingRushMultiplier: 0.1 }));
    expect(weeks.every((w) => !w.screensPulled)).toBe(true);
    expect(weeks.every((w) => w.availabilityFraction > 0)).toBe(true);
  });

  it('an armed release that still fills its seats is not pulled', () => {
    // A narrow screen commitment against real demand - the house is full.
    const { diagnostics } = advanceToWeekWithDiagnostics(fixed({ openingRushMultiplier: 0.9, screenCollapseArmed: true, initialAvailabilityFraction: 0.03 }), [], MAX_SIMULATION_WEEKS);
    expect(diagnostics[0].demandUtilisation).toBeGreaterThan(1);
    expect(diagnostics.every((d) => !d.screensPulled)).toBe(true);
  });

  it('is latched - a shrinking screen count that reads as selling out never re-books the film', () => {
    const f = fixed({ screenCollapseArmed: true });
    const pulledWeek = { week: 1, awareCount: 1, interestedRemaining: 0, cumulativeTicketsSold: 0, availabilityFraction: 0.5, cumulativeCrossoverRealized: 0, screensPulled: true };
    expect(isScreenCollapse(f, pulledWeek, 5, 50)).toBe(true);
  });

  it('only triggers in the opening weeks, and never when unarmed', () => {
    const notPulled = { week: 1, awareCount: 1, interestedRemaining: 0, cumulativeTicketsSold: 0, availabilityFraction: 0.5, cumulativeCrossoverRealized: 0 };
    expect(isScreenCollapse(fixed({ screenCollapseArmed: true }), notPulled, 0, 0.1)).toBe(true);
    expect(isScreenCollapse(fixed({ screenCollapseArmed: true }), notPulled, 5, 0.1)).toBe(false);
    expect(isScreenCollapse(fixed(), notPulled, 0, 0.1)).toBe(false);
  });

  it('decays availability to exactly zero', () => {
    let a = 0.95;
    for (let i = 0; i < 6; i++) a = collapsedAvailability(a);
    expect(a).toBe(0);
  });
});
