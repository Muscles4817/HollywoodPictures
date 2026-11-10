// The home window ends a slow run's tail (data/theatricalWindow.ts).
import { describe, it, expect } from 'vitest';
import { advanceToWeek, MAX_SIMULATION_WEEKS } from './audienceSimulationStep';
import { createAudienceSimulationFixedState, deriveWeeklyAdmissions, type AudienceSimulationFixedState } from './audienceSimulation';
import { HOME_WINDOW_WEEKS } from '../data/theatricalWindow';

// A slow, small platform-style run - the kind that used to ride the 20-week cap.
function fixed(overrides: Partial<AudienceSimulationFixedState> = {}): AudienceSimulationFixedState {
  return createAudienceSimulationFixedState({
    totalAddressableAudience: 1_000_000,
    baseInterestFraction: 0.25,
    marketingEfficiency: 0.6,
    crossoverCapacityFraction: 0.15,
    conversionPacingBaseline: 0.06,
    externalWeeklyAwarenessRate: 0.05,
    criticScore: 70,
    audienceScore: 72,
    initialAwareCount: 200_000,
    initialAvailabilityFraction: 0.1,
    availabilityBaseWeeklyDecay: 0.02,
    criticLedExpansionWeight: 0,
    ...overrides,
  });
}

describe('home window', () => {
  it('absent, the run is exactly as before', () => {
    expect(advanceToWeek(fixed({ homeWindowAttrition: 0 }), [], MAX_SIMULATION_WEEKS)).toEqual(advanceToWeek(fixed(), [], MAX_SIMULATION_WEEKS));
  });

  it('changes nothing inside the exclusive window', () => {
    const without = advanceToWeek(fixed(), [], HOME_WINDOW_WEEKS);
    const withWindow = advanceToWeek(fixed({ homeWindowAttrition: 0.25 }), [], HOME_WINDOW_WEEKS);
    expect(withWindow).toEqual(without);
  });

  it('after it, the tail thins out and a slow run ends sooner, with the waiters never sold to', () => {
    const without = advanceToWeek(fixed(), [], MAX_SIMULATION_WEEKS);
    const withWindow = advanceToWeek(fixed({ homeWindowAttrition: 0.25 }), [], MAX_SIMULATION_WEEKS);
    const week = (w: typeof without, i: number) => deriveWeeklyAdmissions(w, Math.min(i, w.length - 1));
    expect(week(withWindow, 10)).toBeLessThan(week(without, 10) * 0.5);
    expect(withWindow[withWindow.length - 1].cumulativeTicketsSold).toBeLessThan(without[without.length - 1].cumulativeTicketsSold);
    expect(withWindow.length).toBeLessThanOrEqual(without.length);
  });
});
