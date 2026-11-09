// Word of mouth is set by the gap between promise and delivery
// (data/wordOfMouth.ts, docs/domain/16 §8.1).
import { describe, it, expect } from 'vitest';
import { computeExpectedReception } from './audienceSimulationInputs';
import { computeExpectationGapFactor, computeReceptionResponseMultiplier } from './audienceSimulationStep';
import { createAudienceSimulationFixedState, type AudienceSimulationFixedState } from './audienceSimulation';
import { EXPECTATION_FACTOR_MAX, EXPECTATION_FACTOR_MIN } from '../data/wordOfMouth';

function fixed(overrides: Partial<AudienceSimulationFixedState> = {}): AudienceSimulationFixedState {
  return createAudienceSimulationFixedState({
    totalAddressableAudience: 1_000_000,
    baseInterestFraction: 0.25,
    marketingEfficiency: 0.6,
    crossoverCapacityFraction: 0.15,
    conversionPacingBaseline: 0.12,
    externalWeeklyAwarenessRate: 0.15,
    criticScore: 60,
    audienceScore: 60,
    initialAwareCount: 200_000,
    initialAvailabilityFraction: 0.95,
    availabilityBaseWeeklyDecay: 0.18,
    criticLedExpansionWeight: 0,
    ...overrides,
  });
}

describe('expected reception', () => {
  it('rises with Buzz, and the market-median Buzz expects roughly what the median film delivers', () => {
    expect(computeExpectedReception(90)).toBeGreaterThan(computeExpectedReception(30));
    expect(computeExpectedReception(80)).toBeGreaterThan(58);
    expect(computeExpectedReception(80)).toBeLessThan(63);
  });
});

describe('expectation gap', () => {
  it('without a promise, word of mouth reads absolute reception exactly as before', () => {
    expect(computeExpectationGapFactor(fixed())).toBe(1);
  });

  it('meeting the promise is neutral', () => {
    expect(computeExpectationGapFactor(fixed({ expectedReception: 60 }))).toBeCloseTo(1);
  });

  it('the same film earns more word of mouth from a modest promise than from a big one', () => {
    const modest = computeReceptionResponseMultiplier(fixed({ audienceScore: 75, criticScore: 65, expectedReception: computeExpectedReception(30) }));
    const hyped = computeReceptionResponseMultiplier(fixed({ audienceScore: 75, criticScore: 65, expectedReception: computeExpectedReception(98) }));
    expect(modest).toBeGreaterThan(hyped);
  });

  it('is bounded both ways - a disappointment keeps some word of mouth, a delight cannot run away', () => {
    expect(computeExpectationGapFactor(fixed({ audienceScore: 0, criticScore: 0, expectedReception: 100 }))).toBe(EXPECTATION_FACTOR_MIN);
    expect(computeExpectationGapFactor(fixed({ audienceScore: 100, criticScore: 100, expectedReception: 0 }))).toBe(EXPECTATION_FACTOR_MAX);
  });
});
