// Repeat viewing (data/repeatViewing.ts, docs/domain/10 §16).
import { describe, it, expect } from 'vitest';
import { computeRepeatability } from './audienceSimulationInputs';
import { advanceToWeek, advanceToWeekWithDiagnostics, computeRepeatViewingRate, MAX_SIMULATION_WEEKS } from './audienceSimulationStep';
import { createAudienceSimulationFixedState, uniqueViewers, type AudienceSimulationFixedState } from './audienceSimulation';
import { REPEAT_BASE_RATE } from '../data/repeatViewing';

function fixed(overrides: Partial<AudienceSimulationFixedState> = {}): AudienceSimulationFixedState {
  return createAudienceSimulationFixedState({
    totalAddressableAudience: 1_000_000,
    baseInterestFraction: 0.25,
    marketingEfficiency: 0.6,
    crossoverCapacityFraction: 0.15,
    conversionPacingBaseline: 0.12,
    externalWeeklyAwarenessRate: 0.15,
    criticScore: 90,
    audienceScore: 92,
    initialAwareCount: 200_000,
    initialAvailabilityFraction: 0.95,
    availabilityBaseWeeklyDecay: 0.18,
    criticLedExpansionWeight: 0,
    ...overrides,
  });
}

const last = <T,>(xs: T[]) => xs[xs.length - 1];

describe('repeatability', () => {
  const base = { genre: 'Drama' as const, targetAudience: 'Adults' as const, scriptSpectacle: 20, scriptFranchiseRecognition: 0 };
  it('a family fantasy spectacle with a fanbase is far more repeatable than an adult drama', () => {
    const drama = computeRepeatability(base, 0.1);
    const event = computeRepeatability({ genre: 'Fantasy', targetAudience: 'Families', scriptSpectacle: 90, scriptFranchiseRecognition: 90 }, 0.9);
    expect(event).toBeGreaterThan(drama * 2.5);
    expect(event).toBeLessThanOrEqual(1);
  });
});

describe('repeat viewing rate', () => {
  it('absent repeatability: no repeat viewing - the one-ticket-per-person model exactly as before', () => {
    expect(computeRepeatViewingRate(fixed())).toBe(0);
    const weeks = advanceToWeek(fixed(), [], MAX_SIMULATION_WEEKS);
    expect(last(weeks).cumulativeRepeatAdmissions ?? 0).toBe(0);
  });

  it('a film nobody loves gets only the ordinary base rate, however repeatable', () => {
    expect(computeRepeatViewingRate(fixed({ repeatability: 1, audienceScore: 50, criticScore: 50 }))).toBeCloseTo(REPEAT_BASE_RATE);
  });

  it('people re-watch what they love: a loved repeatable film returns far more viewers', () => {
    const loved = computeRepeatViewingRate(fixed({ repeatability: 1 }));
    const liked = computeRepeatViewingRate(fixed({ repeatability: 1, audienceScore: 72, criticScore: 65 }));
    expect(loved).toBeGreaterThan(liked * 2);
    expect(loved).toBeGreaterThan(0.3);
  });
});

describe('repeat viewing in the run', () => {
  it('adds tickets without adding people: unique viewers stay within the audience, tickets can exceed it', () => {
    const f = fixed({ repeatability: 1, totalAddressableAudience: 1_000_000, baseInterestFraction: 0.6, crossoverCapacityFraction: 0.39, initialAwareCount: 900_000 });
    const weeks = advanceToWeek(f, [], MAX_SIMULATION_WEEKS);
    const end = last(weeks);
    expect(end.cumulativeRepeatAdmissions ?? 0).toBeGreaterThan(0);
    expect(uniqueViewers(end)).toBeLessThanOrEqual(f.totalAddressableAudience + 1e-6);
    expect(end.cumulativeTicketsSold).toBeGreaterThan(uniqueViewers(end));
  });

  it('a loved repeatable film out-grosses the identical film without repeat viewing', () => {
    const withRepeat = last(advanceToWeek(fixed({ repeatability: 1 }), [], MAX_SIMULATION_WEEKS)).cumulativeTicketsSold;
    const without = last(advanceToWeek(fixed(), [], MAX_SIMULATION_WEEKS)).cumulativeTicketsSold;
    expect(withRepeat).toBeGreaterThan(without * 1.15);
  });

  it('nobody repeats in week 1, and repeat visits never draw down the interested pool', () => {
    const { diagnostics } = advanceToWeekWithDiagnostics(fixed({ repeatability: 1 }), [], 4);
    expect(diagnostics[0].repeatAdmissions).toBe(0);
    expect(diagnostics[1].repeatAdmissions).toBeGreaterThan(0);
  });
});
