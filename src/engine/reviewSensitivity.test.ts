// Reviews on the opening, by film type (data/reviewSensitivity.ts,
// docs/domain/16-critics-reviews-and-word-of-mouth.md §6).
import { describe, it, expect } from 'vitest';
import {
  computeOpeningReviewMultiplier,
  computeReviewAwarenessMultiplier,
  computeReviewSensitivity,
  reviewSignal,
} from './audienceSimulationInputs';
import { advanceToWeek, MAX_SIMULATION_WEEKS } from './audienceSimulationStep';
import { createAudienceSimulationFixedState, type AudienceSimulationFixedState } from './audienceSimulation';
import { REVIEW_SIGNAL_PIVOT } from '../data/reviewSensitivity';

const film = {
  genre: 'Drama' as const,
  targetAudience: 'Adults' as const,
  releaseType: 'Wide' as const,
  scriptFranchiseRecognition: 0,
  criticScore: 80,
};

describe('review signal', () => {
  it('is neutral at the market median and bounded', () => {
    expect(reviewSignal(REVIEW_SIGNAL_PIVOT)).toBe(0);
    expect(reviewSignal(100)).toBe(1);
    expect(reviewSignal(0)).toBe(-1);
  });
});

describe('review sensitivity follows the reference', () => {
  it('adult drama reads its reviews; horror does not', () => {
    expect(computeReviewSensitivity({ ...film }, 0)).toBeGreaterThan(0.25);
    expect(computeReviewSensitivity({ ...film, genre: 'Horror' }, 0)).toBe(0);
  });

  it('adults read reviews more than teens', () => {
    expect(computeReviewSensitivity({ ...film }, 0)).toBeGreaterThan(computeReviewSensitivity({ ...film, targetAudience: 'Teens' }, 0));
  });

  it('a pre-sold film - a franchise or an event - has largely decided before the reviews land', () => {
    const original = computeReviewSensitivity({ ...film, genre: 'Action' }, 0);
    expect(computeReviewSensitivity({ ...film, genre: 'Action', scriptFranchiseRecognition: 100 }, 0)).toBeCloseTo(original * 0.2);
    expect(computeReviewSensitivity({ ...film, genre: 'Action' }, 1)).toBeCloseTo(original * 0.2);
  });

  it('a pre-sold action tentpole opening moves by a few percent at most', () => {
    const panned = computeOpeningReviewMultiplier({ ...film, genre: 'Action', targetAudience: 'Mass Market', scriptFranchiseRecognition: 90, criticScore: 20 }, 0.6);
    expect(panned).toBeGreaterThan(0.97);
  });

  it('a wide adult drama moves within the reference\'s 10-25% for a large critical gap', () => {
    const rave = computeOpeningReviewMultiplier({ ...film, criticScore: 85 }, 0.2);
    const panned = computeOpeningReviewMultiplier({ ...film, criticScore: 25 }, 0.2);
    expect(rave).toBeGreaterThan(1.1);
    expect(rave).toBeLessThan(1.35);
    expect(panned).toBeLessThan(0.9);
    expect(panned).toBeGreaterThan(0.65);
  });
});

describe('release pattern decides how reviews act', () => {
  it('Wide: permission on the opening, no awareness effect', () => {
    expect(computeOpeningReviewMultiplier({ ...film }, 0)).toBeGreaterThan(1);
    expect(computeReviewAwarenessMultiplier({ ...film }, 0)).toBe(1);
  });

  it('Limited: awareness across the run, no week-1 spike', () => {
    const limited = { ...film, releaseType: 'Limited' as const };
    expect(computeOpeningReviewMultiplier(limited, 0)).toBe(1);
    expect(computeReviewAwarenessMultiplier(limited, 0)).toBeGreaterThan(1);
    expect(computeReviewAwarenessMultiplier({ ...limited, criticScore: 20 }, 0)).toBeLessThan(1);
  });

  it('Festival First: neither - it has its own critic gate', () => {
    const festival = { ...film, releaseType: 'Festival First' as const };
    expect(computeOpeningReviewMultiplier(festival, 0)).toBe(1);
    expect(computeReviewAwarenessMultiplier(festival, 0)).toBe(1);
  });
});

describe('the opening multiplier in the weekly step', () => {
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

  it('absent, the run is exactly as before', () => {
    expect(advanceToWeek(fixed({ openingReviewMultiplier: 1 }), [], MAX_SIMULATION_WEEKS)).toEqual(advanceToWeek(fixed(), [], MAX_SIMULATION_WEEKS));
  });

  it('moves week 1 only, in the direction of the reviews', () => {
    const base = advanceToWeek(fixed(), [], 2);
    const rave = advanceToWeek(fixed({ openingReviewMultiplier: 1.2 }), [], 2);
    const panned = advanceToWeek(fixed({ openingReviewMultiplier: 0.8 }), [], 2);
    expect(rave[0].cumulativeTicketsSold).toBeCloseTo(base[0].cumulativeTicketsSold * 1.2, 0);
    expect(panned[0].cumulativeTicketsSold).toBeCloseTo(base[0].cumulativeTicketsSold * 0.8, 0);
  });

  it('a pan loses part of its held-back opening audience for good - only a share stay to be won later', () => {
    const [base] = advanceToWeek(fixed(), [], 1);
    const [panned] = advanceToWeek(fixed({ openingReviewMultiplier: 0.75 }), [], 1);
    const heldBack = base.cumulativeTicketsSold - panned.cumulativeTicketsSold;
    expect(heldBack).toBeGreaterThan(0);
    // Without the waiters leaving, every held-back viewer would still be in the pool.
    const stillInterested = panned.interestedRemaining - base.interestedRemaining;
    expect(stillInterested).toBeLessThan(heldBack * 0.75);
    expect(stillInterested).toBeGreaterThan(0);
    // A rave takes nobody out of the pool.
    const [rave] = advanceToWeek(fixed({ openingReviewMultiplier: 1.25 }), [], 1);
    expect(rave.interestedRemaining + rave.cumulativeTicketsSold).toBeCloseTo(base.interestedRemaining + base.cumulativeTicketsSold, 0);
  });

  it('never sells more than the interested pool holds', () => {
    const weeks = advanceToWeek(fixed({ openingReviewMultiplier: 50, conversionPacingBaseline: 0.9 }), [], 1);
    expect(weeks[0].interestedRemaining).toBeGreaterThanOrEqual(0);
  });
});
