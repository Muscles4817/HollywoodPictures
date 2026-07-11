import { describe, it, expect } from 'vitest';
import { deriveAudienceSimulationFixedState, type ReleaseSimulationInputs } from './audienceSimulationInputs';
import { advanceToWeek, MAX_SIMULATION_WEEKS, hasSimulationEnded } from './audienceSimulationStep';
import { maxInterestedAudience, deriveWeeklyAdmissions, type AudienceSimulationWeekState } from './audienceSimulation';

/**
 * Every constant here (buzz/marketing/reception levels, release types) was
 * chosen and cross-checked against a scratch diagnostic sweep before being
 * written into an assertion - per the explicit calibration instruction for
 * this milestone, thresholds are never asserted from a theoretical range,
 * only from what the translated, composed simulation actually produces.
 */
function inputs(overrides: Partial<ReleaseSimulationInputs> = {}): ReleaseSimulationInputs {
  return {
    buzzScore: 50,
    marketingSpend: 20_000_000,
    scriptMarketability: 50,
    scriptOriginality: 50,
    scriptIntendedAudience: 'Mass Market',
    targetAudience: 'Mass Market',
    genre: 'Action',
    releaseWindow: 'Quiet Month',
    releaseType: 'Wide',
    criticScore: 60,
    audienceScore: 60,
    ...overrides,
  };
}

/** Runs a full simulation to completion (or the hard cap) from a set of release-time inputs. */
function runFullSimulation(releaseInputs: ReleaseSimulationInputs): AudienceSimulationWeekState[] {
  const fixed = deriveAudienceSimulationFixedState(releaseInputs);
  return advanceToWeek(fixed, [], MAX_SIMULATION_WEEKS);
}

function weeklyAdmissions(weeks: AudienceSimulationWeekState[]): number[] {
  return weeks.map((_, i) => deriveWeeklyAdmissions(weeks, i));
}

function totalAdmissions(weeks: AudienceSimulationWeekState[]): number {
  return weeks.length > 0 ? weeks[weeks.length - 1].cumulativeTicketsSold : 0;
}

function maxEverInterested(weeks: AudienceSimulationWeekState[]): number {
  return Math.max(0, ...weeks.map((w) => w.interestedRemaining + w.cumulativeTicketsSold));
}

describe('deriveAudienceSimulationFixedState - basic construction', () => {
  it('produces a fixed state that passes Milestone 1 validation for a typical input', () => {
    expect(() => deriveAudienceSimulationFixedState(inputs())).not.toThrow();
  });

  it('rejects Streaming at the type level - SupportedReleaseType excludes it (compile-time, exercised here defensively at runtime)', () => {
    const streamingInputs = { ...inputs(), releaseType: 'Streaming' } as unknown as ReleaseSimulationInputs;
    expect(() => deriveAudienceSimulationFixedState(streamingInputs)).toThrow(/Streaming/);
  });

  it('always produces baseInterestFraction + crossoverCapacityFraction <= 1, at every marketability/originality extreme', () => {
    for (const scriptMarketability of [1, 50, 100]) {
      for (const scriptOriginality of [1, 50, 100]) {
        const fixed = deriveAudienceSimulationFixedState(inputs({ scriptMarketability, scriptOriginality }));
        expect(fixed.baseInterestFraction + fixed.crossoverCapacityFraction).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe('monotonicity and causality', () => {
  it('more marketing spend does not reduce initial awareness, holding everything else fixed', () => {
    const spends = [10_000, 1_000_000, 20_000_000, 150_000_000];
    const initialAwareCounts = spends.map((marketingSpend) => deriveAudienceSimulationFixedState(inputs({ marketingSpend })).initialAwareCount);
    for (let i = 1; i < initialAwareCounts.length; i++) {
      expect(initialAwareCounts[i]).toBeGreaterThanOrEqual(initialAwareCounts[i - 1]);
    }
  });

  it('higher Buzz does not reduce opening (week 1) admissions, holding everything else fixed', () => {
    const buzzScores = [0, 25, 50, 75, 100];
    const week1Admissions = buzzScores.map((buzzScore) => {
      const weeks = runFullSimulation(inputs({ buzzScore }));
      return weeks[0].cumulativeTicketsSold;
    });
    for (let i = 1; i < week1Admissions.length; i++) {
      expect(week1Admissions[i]).toBeGreaterThanOrEqual(week1Admissions[i - 1]);
    }
  });

  it('greater release reach does not reduce opening admissions - Festival First <= Limited <= Wide for identical Buzz/marketing/reception', () => {
    const festivalFirst = runFullSimulation(inputs({ releaseType: 'Festival First' }))[0].cumulativeTicketsSold;
    const limited = runFullSimulation(inputs({ releaseType: 'Limited' }))[0].cumulativeTicketsSold;
    const wide = runFullSimulation(inputs({ releaseType: 'Wide' }))[0].cumulativeTicketsSold;
    expect(limited).toBeGreaterThanOrEqual(festivalFirst);
    expect(wide).toBeGreaterThanOrEqual(limited);
  });

  it('better audience reception does not weaken WOM - clearly-separated reception bands produce non-decreasing total admissions', () => {
    // Well-separated bands rather than a fine-grained sweep: this is a
    // threshold-gated, positive-feedback system (see
    // audienceSimulationStep.ts's WOM response curves) with a genuine
    // critical-mass tipping point somewhere in the "decent" range -
    // adjacent single-point reception scores can land on either side of
    // that tip and look locally noisy, but poor/decent/exceptional bands
    // never invert.
    const poor = totalAdmissions(runFullSimulation(inputs({ criticScore: 15, audienceScore: 15 })));
    const decent = totalAdmissions(runFullSimulation(inputs({ criticScore: 55, audienceScore: 55 })));
    const exceptional = totalAdmissions(runFullSimulation(inputs({ criticScore: 92, audienceScore: 92 })));
    expect(decent).toBeGreaterThanOrEqual(poor);
    expect(exceptional).toBeGreaterThanOrEqual(decent);
  });

  it('higher expansion capacity (originality) does not reduce reachable interest, given good reception', () => {
    const originalities = [0, 25, 50, 75, 100];
    const maxima = originalities.map((scriptOriginality) => maxEverInterested(runFullSimulation(inputs({ scriptOriginality, criticScore: 92, audienceScore: 95 }))));
    for (let i = 1; i < maxima.length; i++) {
      expect(maxima[i]).toBeGreaterThanOrEqual(maxima[i - 1]);
    }
  });

  it('higher originality with poor reception must not independently create a sleeper hit - capacity alone never breaks out', () => {
    const originalities = [0, 25, 50, 75, 100];
    const maxima = originalities.map((scriptOriginality) => maxEverInterested(runFullSimulation(inputs({ scriptOriginality, criticScore: 12, audienceScore: 10 }))));
    // Not "flat" (marketingEfficiency's originality-dampening term means it
    // can even dip slightly) - the requirement is that maximum capacity
    // never produces a meaningfully *larger* outcome than minimum capacity
    // when reception never clears the WOM thresholds that would realize it.
    const maxOfSweep = Math.max(...maxima);
    const minOfSweep = Math.min(...maxima);
    expect(maxOfSweep).toBeLessThan(minOfSweep * 1.3);
  });

  it('strong marketability does not reduce initial interest or marketing efficiency', () => {
    const marketabilities = [1, 25, 50, 75, 100];
    const fixedStates = marketabilities.map((scriptMarketability) => deriveAudienceSimulationFixedState(inputs({ scriptMarketability })));
    for (let i = 1; i < fixedStates.length; i++) {
      expect(fixedStates[i].baseInterestFraction).toBeGreaterThanOrEqual(fixedStates[i - 1].baseInterestFraction);
      expect(fixedStates[i].marketingEfficiency).toBeGreaterThanOrEqual(fixedStates[i - 1].marketingEfficiency);
    }
  });
});

describe('boundaries', () => {
  it('Buzz 0 vs Buzz 100 - a fully-buzzing film opens dramatically bigger, not just modestly so', () => {
    const week1AtZero = runFullSimulation(inputs({ buzzScore: 0 }))[0].cumulativeTicketsSold;
    const week1AtMax = runFullSimulation(inputs({ buzzScore: 100 }))[0].cumulativeTicketsSold;
    expect(week1AtZero).toBeGreaterThan(0); // convex floor: never literally zero, distribution/incidental discovery alone still sells a trickle
    expect(week1AtMax).toBeGreaterThan(week1AtZero * 3); // convex low end (module header's HYPE_FLOOR-style shape): not a respectable baseline
  });

  it('zero vs maximum marketing spend, everything else fixed - more spend clearly opens bigger', () => {
    const weekMin = runFullSimulation(inputs({ marketingSpend: 10_000 }))[0].cumulativeTicketsSold;
    const weekMax = runFullSimulation(inputs({ marketingSpend: 150_000_000 }))[0].cumulativeTicketsSold;
    expect(weekMax).toBeGreaterThan(weekMin);
  });

  it('a very small Limited release (low Buzz/spend) opens and totals far below a maximum-reach Wide release (high Buzz/spend)', () => {
    const limited = runFullSimulation(inputs({ releaseType: 'Limited', buzzScore: 20, marketingSpend: 500_000 }));
    const wide = runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 90, marketingSpend: 150_000_000 }));
    expect(wide[0].cumulativeTicketsSold).toBeGreaterThan(limited[0].cumulativeTicketsSold * 10);
    expect(totalAdmissions(wide)).toBeGreaterThan(totalAdmissions(limited) * 5);
  });

  it('an excellent film with almost no opening awareness (Festival First, no Buzz/marketing) still opens tiny relative to its addressable audience', () => {
    const releaseInputs = inputs({ releaseType: 'Festival First', buzzScore: 0, marketingSpend: 10_000, criticScore: 95, audienceScore: 93 });
    const fixed = deriveAudienceSimulationFixedState(releaseInputs);
    const weeks = runFullSimulation(releaseInputs);
    expect(fixed.initialAwareCount).toBeLessThan(fixed.totalAddressableAudience * 0.01);
    expect(weeks[0].cumulativeTicketsSold).toBeLessThan(fixed.totalAddressableAudience * 0.01);
    // But excellent reception still visibly builds week over week - awareness/interest aren't stuck at their tiny opening.
    expect(weeks[weeks.length - 1].awareCount).toBeGreaterThan(weeks[0].awareCount);
  });

  it('a terrible film with enormous awareness (Wide, maximum Buzz/marketing, terrible reception) still collapses fast after opening', () => {
    const releaseInputs = inputs({ releaseType: 'Wide', buzzScore: 100, marketingSpend: 150_000_000, criticScore: 5, audienceScore: 5 });
    const weeks = runFullSimulation(releaseInputs);
    const admissions = weeklyAdmissions(weeks);
    expect(admissions[0]).toBeGreaterThan(500_000); // huge awareness really does buy a huge opening
    // Steady collapse, not sustained: by the 5th week, admissions have dropped well below half of opening.
    expect(admissions[4]).toBeLessThan(admissions[0] * 0.5);
  });

  it('a niche acclaimed film with almost no expansion capacity stays capped at its (small) ceiling, never approaching mass-market scale', () => {
    const releaseInputs = inputs({
      targetAudience: 'Niche',
      scriptIntendedAudience: 'Niche',
      scriptOriginality: 2,
      criticScore: 96,
      audienceScore: 94,
    });
    const fixed = deriveAudienceSimulationFixedState(releaseInputs);
    const weeks = runFullSimulation(releaseInputs);
    const ceiling = maxInterestedAudience(fixed);
    expect(maxEverInterested(weeks)).toBeLessThanOrEqual(ceiling + 1e-6);

    const massMarketEquivalent = deriveAudienceSimulationFixedState(
      inputs({ targetAudience: 'Mass Market', scriptIntendedAudience: 'Mass Market', scriptOriginality: 2, criticScore: 96, audienceScore: 94 }),
    );
    expect(ceiling).toBeLessThan(maxInterestedAudience(massMarketEquivalent) * 0.5);
  });
});

describe('named archetype diagnostics', () => {
  it('1. front-loaded event film, poor reception: huge opening, then a severe and uninterrupted decline', () => {
    const weeks = runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 90, marketingSpend: 100_000_000, criticScore: 25, audienceScore: 20 }));
    const admissions = weeklyAdmissions(weeks);
    for (let i = 1; i < Math.min(admissions.length, 10); i++) {
      expect(admissions[i]).toBeLessThanOrEqual(admissions[i - 1]); // never a single up-week this early - pure depletion, no WOM replenishment
    }
    // By the 5th week, admissions have fallen well below half of the opening.
    expect(admissions[4]).toBeLessThan(admissions[0] * 0.6);
  });

  it('2. sleeper hit: tiny opening, but a later week matches or exceeds an earlier one - real growth, not just a slow decline', () => {
    const weeks = runFullSimulation(
      inputs({ releaseType: 'Limited', buzzScore: 15, marketingSpend: 300_000, scriptOriginality: 70, criticScore: 92, audienceScore: 95 }),
    );
    const admissions = weeklyAdmissions(weeks);
    expect(admissions[0]).toBeLessThan(50_000); // small opening
    expect(weeks.length).toBeGreaterThanOrEqual(8); // a real, sustained run, not a quick flame-out
    const laterWeek = admissions[Math.min(9, admissions.length - 1)];
    expect(laterWeek).toBeGreaterThanOrEqual(admissions[0]); // week 10 (or the last available) at least matches week 1 - genuine growth
  });

  it('3. huge opening with exceptional reception: a genuine phenomenon - both a big opening and a big total', () => {
    const weeks = runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 95, marketingSpend: 120_000_000, criticScore: 90, audienceScore: 93 }));
    const fixed = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Wide', buzzScore: 95, marketingSpend: 120_000_000, criticScore: 90, audienceScore: 93 }));
    expect(weeks[0].cumulativeTicketsSold).toBeGreaterThan(500_000);
    // Not capped merely to keep the number tidy - it's allowed to approach the film's own full realistic ceiling.
    expect(totalAdmissions(weeks)).toBeGreaterThan(maxInterestedAudience(fixed) * 0.9);
  });

  it('4. critically acclaimed niche film: acclaim genuinely grows the run, but the absolute total stays small - Niche never buys mass-market scale', () => {
    const nicheInputs = inputs({
      releaseType: 'Festival First',
      targetAudience: 'Niche',
      scriptIntendedAudience: 'Niche',
      buzzScore: 20,
      marketingSpend: 500_000,
      criticScore: 94,
      audienceScore: 85,
    });
    const fixed = deriveAudienceSimulationFixedState(nicheInputs);
    const weeks = runFullSimulation(nicheInputs);
    const admissions = weeklyAdmissions(weeks);
    // Acclaim is genuinely doing something - the run keeps growing, not just decaying from a tiny opening.
    expect(admissions[Math.min(9, admissions.length - 1)]).toBeGreaterThan(admissions[0]);
    // But Niche's own market size (data/audiences.ts) caps how big that growth can ever get, regardless of reception -
    // the same structural ceiling the standalone boundary test above checks directly.
    expect(totalAdmissions(weeks)).toBeLessThan(fixed.totalAddressableAudience * 0.15);
    const massMarketEquivalent = deriveAudienceSimulationFixedState({ ...nicheInputs, targetAudience: 'Mass Market', scriptIntendedAudience: 'Mass Market' });
    expect(fixed.totalAddressableAudience).toBeLessThan(massMarketEquivalent.totalAddressableAudience * 0.5);
  });

  it('5. broad crowd-pleaser: solid (not necessarily exceptional) reception still clearly outperforms poor reception at the same reach', () => {
    const crowdPleaser = totalAdmissions(runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 55, marketingSpend: 30_000_000, criticScore: 65, audienceScore: 78 })));
    const poorReceptionSameReach = totalAdmissions(
      runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 55, marketingSpend: 30_000_000, criticScore: 15, audienceScore: 15 })),
    );
    expect(crowdPleaser).toBeGreaterThan(poorReceptionSameReach * 1.5);
  });

  it('6. highly original but disliked film: large crossover capacity never gets realized - stays at or below the natural ceiling', () => {
    const releaseInputs = inputs({ releaseType: 'Wide', scriptOriginality: 95, buzzScore: 50, marketingSpend: 20_000_000, criticScore: 20, audienceScore: 15 });
    const fixed = deriveAudienceSimulationFixedState(releaseInputs);
    const weeks = runFullSimulation(releaseInputs);
    const naturalCeiling = fixed.baseInterestFraction * fixed.totalAddressableAudience;
    // Large capacity exists (originality=95) but poor reception means it's essentially unrealized.
    expect(fixed.crossoverCapacityFraction).toBeGreaterThan(0.2);
    expect(maxEverInterested(weeks)).toBeLessThanOrEqual(naturalCeiling + 1e-6);
  });

  it('7. excellent but poorly marketed film: tiny opening, but total grows to many times the opening via word of mouth alone', () => {
    const releaseInputs = inputs({ releaseType: 'Limited', buzzScore: 5, marketingSpend: 10_000, criticScore: 90, audienceScore: 88 });
    const weeks = runFullSimulation(releaseInputs);
    const week1 = weeks[0].cumulativeTicketsSold;
    expect(week1).toBeLessThan(20_000);
    expect(totalAdmissions(weeks)).toBeGreaterThan(week1 * 10);
  });

  it('8. massive marketing campaign for a poor film: an enormous opening that still cannot sustain itself', () => {
    const weeks = runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 85, marketingSpend: 150_000_000, criticScore: 20, audienceScore: 18 }));
    const admissions = weeklyAdmissions(weeks);
    expect(admissions[0]).toBeGreaterThan(500_000);
    expect(admissions[9]).toBeLessThan(admissions[0] * 0.35); // by week 10, marketing's one-time push has clearly worn off
  });

  it('9. ordinary mid-performing film: unremarkable, but genuinely sustained - later weeks do not collapse the way a poor-reception film does', () => {
    const weeks = runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 45, marketingSpend: 15_000_000, criticScore: 55, audienceScore: 58 }));
    const admissions = weeklyAdmissions(weeks);
    // Distinguishing shape from archetype 1/8 (poor reception): an ordinary film's later weeks hold up or grow, they don't keep shrinking every week.
    const later = admissions[Math.min(9, admissions.length - 1)];
    expect(later).toBeGreaterThanOrEqual(admissions[0]);
  });
});

describe('the top end of the range', () => {
  it('a maximal, justified combination of inputs reaches tens of millions of admissions without any repeat-viewing mechanic', () => {
    // Mass Market, maximally popular genre, huge Buzz/marketing, Wide release, exceptional reception, real originality-driven crossover capacity.
    const releaseInputs = inputs({
      targetAudience: 'Mass Market',
      scriptIntendedAudience: 'Mass Market',
      genre: 'Action',
      releaseType: 'Wide',
      buzzScore: 100,
      marketingSpend: 150_000_000,
      scriptMarketability: 90,
      scriptOriginality: 80,
      criticScore: 96,
      audienceScore: 98,
    });
    const weeks = runFullSimulation(releaseInputs);
    // No week's cumulativeTicketsSold ever exceeds totalAddressableAudience - Milestone 1's validation already
    // guarantees this structurally (createAudienceSimulationRun would throw otherwise), asserted again here as
    // the direct "no repeat viewing" reading of the same invariant.
    const fixed = deriveAudienceSimulationFixedState(releaseInputs);
    expect(totalAdmissions(weeks)).toBeLessThanOrEqual(fixed.totalAddressableAudience);
    expect(totalAdmissions(weeks)).toBeGreaterThan(10_000_000);
  });

  it('scales down correctly too - the smallest reachable audience (Niche) with minimal reach never produces a phenomenon-scale total', () => {
    const releaseInputs = inputs({
      targetAudience: 'Niche',
      scriptIntendedAudience: 'Niche',
      releaseType: 'Festival First',
      buzzScore: 5,
      marketingSpend: 10_000,
      scriptMarketability: 10,
      scriptOriginality: 5,
      criticScore: 40,
      audienceScore: 40,
    });
    const weeks = runFullSimulation(releaseInputs);
    expect(totalAdmissions(weeks)).toBeLessThan(1_000_000);
  });
});

describe('run always terminates and stays structurally valid', () => {
  it('every named archetype input produces a run that ends within the hard cap and never violates Milestone 1 invariants', () => {
    const scenarios: ReleaseSimulationInputs[] = [
      inputs({ releaseType: 'Wide', buzzScore: 90, marketingSpend: 100_000_000, criticScore: 25, audienceScore: 20 }),
      inputs({ releaseType: 'Limited', buzzScore: 15, marketingSpend: 300_000, scriptOriginality: 70, criticScore: 92, audienceScore: 95 }),
      inputs({ releaseType: 'Festival First', buzzScore: 0, marketingSpend: 10_000, criticScore: 95, audienceScore: 93 }),
      inputs({ releaseType: 'Wide', buzzScore: 100, marketingSpend: 150_000_000, criticScore: 5, audienceScore: 5 }),
    ];
    for (const scenario of scenarios) {
      const fixed = deriveAudienceSimulationFixedState(scenario);
      const weeks = advanceToWeek(fixed, [], MAX_SIMULATION_WEEKS);
      expect(weeks.length).toBeLessThanOrEqual(MAX_SIMULATION_WEEKS);
      if (weeks.length === MAX_SIMULATION_WEEKS) {
        expect(hasSimulationEnded(weeks)).toBe(true);
      }
      for (const week of weeks) {
        expect(Number.isFinite(week.awareCount)).toBe(true);
        expect(Number.isFinite(week.interestedRemaining)).toBe(true);
        expect(Number.isFinite(week.cumulativeTicketsSold)).toBe(true);
      }
    }
  });
});
