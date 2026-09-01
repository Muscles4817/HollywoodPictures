import { describe, it, expect } from 'vitest';
import { computeEventScale, deriveAudienceSimulationFixedState, type ReleaseSimulationInputs } from './audienceSimulationInputs';
import { computeMarketPresence, computeCompetitiveCrowding, crowdingBandKey, computeRivalReleaseStrength, type UpcomingRelease } from './releaseCrowding';
import { maxInterestedAudience, type AudienceSimulationWeekState } from './audienceSimulation';
import { advanceToWeek } from './audienceSimulationStep';

/**
 * The two channels added by the "money on screen, and films that actually
 * contend" pass. Both exist to answer a measured failure, and both are pinned
 * here rather than left to the opt-in calibration diagnostics, because what
 * they guarantee is structural (a direction, an invariance) rather than a
 * calibrated level - the levels live in
 * boxOfficeDistribution.diagnostic.test.ts and are expected to move.
 */

function inputs(overrides: Partial<ReleaseSimulationInputs> = {}): ReleaseSimulationInputs {
  return {
    buzzScore: 50,
    marketingSpend: 20_000_000,
    directorFame: 50,
    leadFame: 50,
    studioBrand: 50,
    scriptAccessibility: 50,
    scriptHookStrength: 50,
    scriptCrossoverPotential: 50,
    scriptSpectacle: 50,
    scriptIntendedAudience: 'Mass Market',
    targetAudience: 'Mass Market',
    genre: 'Action',
    releaseWindow: 'Quiet Month',
    releaseType: 'Wide',
    competitiveCrowding: 0,
    criticScore: 60,
    audienceScore: 60,
    ...overrides,
  };
}

describe('event scale - what a big production buys', () => {
  it('is a no-op when no production budget is supplied, so every caller that has not opted in is byte-for-byte unchanged', () => {
    const withoutField = deriveAudienceSimulationFixedState(inputs());
    const withZero = deriveAudienceSimulationFixedState(inputs({ productionBudgetCost: 0 }));
    expect(withZero).toEqual(withoutField);
    expect(computeEventScale(0, 100)).toBe(0);
  });

  it('reads the money actually on screen, so a bigger production is more of an event than a smaller one', () => {
    expect(computeEventScale(5_000_000, 70)).toBeLessThan(computeEventScale(40_000_000, 70));
    expect(computeEventScale(40_000_000, 70)).toBeLessThan(computeEventScale(200_000_000, 70));
  });

  it('is gated on the script wanting to be an event - the same money buys a chamber drama much less of one', () => {
    const spectacle = computeEventScale(150_000_000, 95);
    const drama = computeEventScale(150_000_000, 5);
    expect(drama).toBeLessThan(spectacle);
    // Gated, never zeroed: a fortune spent on screen still shows up somewhat.
    expect(drama).toBeGreaterThan(0);
  });

  it('leaves the ordinary film alone - the whole lift is reserved for genuine scale', () => {
    // Measured medians over six seeds x eight in-game years: a wide release
    // under $25M puts ~$1.2M on screen at spectacle ~37.
    const smallFilm = deriveAudienceSimulationFixedState(inputs({ productionBudgetCost: 1_200_000, scriptSpectacle: 37 }));
    const noScale = deriveAudienceSimulationFixedState(inputs({ scriptSpectacle: 37 }));
    expect(maxInterestedAudience(smallFilm) / maxInterestedAudience(noScale)).toBeLessThan(1.02);
  });

  it('gives a tentpole a materially larger audience ceiling than an identical mid-budget film - the gap that did not exist before', () => {
    // The measured pathology this channel answers: a >$80M wide release had a
    // maxInterestedAudience of 44.0M against 41.3M for a $25-80M one, a 6%
    // larger room for three times the money.
    const mid = deriveAudienceSimulationFixedState(inputs({ productionBudgetCost: 10_000_000, scriptSpectacle: 72 }));
    const tentpole = deriveAudienceSimulationFixedState(inputs({ productionBudgetCost: 45_000_000, scriptSpectacle: 72 }));
    expect(maxInterestedAudience(tentpole)).toBeGreaterThan(maxInterestedAudience(mid) * 1.2);
  });

  it('buys a ceiling, never an audience - a badly-received tentpole is left holding the bigger empty room', () => {
    const badTentpole = inputs({ productionBudgetCost: 120_000_000, scriptSpectacle: 90, criticScore: 30, audienceScore: 32 });
    const goodTentpole = inputs({ ...badTentpole, criticScore: 85, audienceScore: 88 });
    const bad = deriveAudienceSimulationFixedState(badTentpole);
    const good = deriveAudienceSimulationFixedState(goodTentpole);

    const sold = (weeks: AudienceSimulationWeekState[]) => weeks[weeks.length - 1].cumulativeTicketsSold;
    const badSold = sold(advanceToWeek(bad, [], 12));
    const goodSold = sold(advanceToWeek(good, [], 12));

    // Both were given a large room; only the well-received one fills it.
    expect(goodSold).toBeGreaterThan(badSold * 1.5);
    expect(badSold).toBeLessThan(maxInterestedAudience(bad) * 0.6);
  });
});

describe('market presence - competitors measured against the market, not themselves', () => {
  /** A synthetic weekly history selling `perWeek` tickets every week. */
  function history(perWeek: number, weeks = 4): AudienceSimulationWeekState[] {
    return Array.from({ length: weeks }, (_, i) => ({
      week: i + 1,
      awareCount: 0,
      interestedRemaining: 0,
      cumulativeTicketsSold: perWeek * (i + 1),
      availabilityFraction: 1,
      cumulativeCrossoverRealized: 0,
    }));
  }

  it('ranks films by the admissions they are actually taking, not by how saturated their own pool is', () => {
    const tentpole = computeMarketPresence(history(15_000_000), 4);
    const midsize = computeMarketPresence(history(5_000_000), 4);
    const indie = computeMarketPresence(history(400_000), 4);
    expect(tentpole).toBeGreaterThan(midsize);
    expect(midsize).toBeGreaterThan(indie);
  });

  it('lands on the same 0-1 scale as the pre-release proxies it is compared against inside matchupWeight', () => {
    // The bug this replaced: a running film's strength was its recent
    // admissions over its OWN maximum interested audience, so it shared no
    // units with computeRivalReleaseStrength - and a saturated $9M indie
    // out-crowded a live tentpole.
    const bigProduction = computeRivalReleaseStrength(60_000_000, 'Big');
    const liveTentpole = computeMarketPresence(history(15_000_000), 4);
    expect(Math.abs(liveTentpole - bigProduction)).toBeLessThan(0.4);
  });

  it('reads as nothing for a film too small to register on the market at all', () => {
    expect(computeMarketPresence(history(50_000), 4)).toBe(0);
  });
});

describe('competition - the strong do the pushing', () => {
  const window = (strength: number): UpcomingRelease => ({ releaseDay: 100, genre: 'Action', targetAudience: 'Mass Market', strength });
  const candidate = { releaseDay: 100, genre: 'Action' as const, targetAudience: 'Mass Market' as const };

  it('crushes a small film sharing a window with a tentpole, and barely troubles the tentpole', () => {
    const tentpole = 0.85;
    const small = 0.08;
    const pressureOnSmall = computeCompetitiveCrowding(candidate, [window(tentpole)], small);
    const pressureOnTentpole = computeCompetitiveCrowding(candidate, [window(small)], tentpole);
    // Stated in BANDS rather than raw numbers, because the score is
    // density-normalised (engine/releaseCrowding.ts:CROWDING_DENSITY_REFERENCE)
    // and that divisor moves whenever the slate widens - it went 4.6 -> 6.9 at
    // the third widening. What the model promises is that the small film's
    // window reads Crowded and the tentpole's reads Clear, which is a claim
    // about the reading and survives the rescaling; a hard-coded 0.35 was a
    // claim about the divisor.
    expect(crowdingBandKey(pressureOnSmall)).toBe('high');
    expect(crowdingBandKey(pressureOnTentpole)).toBe('clear');
    // What the test is really about: the same collision is an order of magnitude
    // worse for the small film than for the tentpole.
    expect(pressureOnSmall / pressureOnTentpole).toBeGreaterThan(10);
  });

  it('makes two evenly-matched tentpoles genuinely hurt each other', () => {
    // A same-genre, same-audience tentpole on the exact day - the worst collision
    // the model can express - lands inside the "Crowded" band. Asserted as a band
    // for the same reason as above: the raw number tracks
    // CROWDING_DENSITY_REFERENCE, the reading is the contract.
    expect(crowdingBandKey(computeCompetitiveCrowding(candidate, [window(0.85)], 0.85))).toBe('high');
  });
});
