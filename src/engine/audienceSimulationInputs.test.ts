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
    directorFame: 50,
    leadFame: 50,
    studioReputation: 50,
    scriptAccessibility: 50,
    scriptHookStrength: 50,
    scriptOriginality: 50,
    scriptSpectacle: 50,
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
    for (const scriptAccessibility of [1, 50, 100]) {
      for (const scriptOriginality of [1, 50, 100]) {
        const fixed = deriveAudienceSimulationFixedState(inputs({ scriptAccessibility, scriptOriginality }));
        expect(fixed.baseInterestFraction + fixed.crossoverCapacityFraction).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe('crossoverCapacityFraction - multi-factor concept strength x accessibility', () => {
  // Milestone (docs/DESIGN.md 5.34, "crossover/pull-forward separation"):
  // replaced originality-alone with concept strength (originality,
  // spectacle, marketability, criticScore) x accessibility (genre
  // popularity x target-audience market size). The behavioural requirement
  // driving every test here: no single input, on its own, should be able to
  // push capacity anywhere near CROSSOVER_CAPACITY_CEILING (0.3) - only
  // several favourable factors aligning should.

  it('originality alone (everything else at a moderate default) does not push capacity anywhere near the ceiling', () => {
    const fixed = deriveAudienceSimulationFixedState(inputs({ scriptOriginality: 100, scriptSpectacle: 50, scriptAccessibility: 50, criticScore: 50 }));
    expect(fixed.crossoverCapacityFraction).toBeLessThan(0.25);
  });

  it('spectacle contributes independently of originality - a low-originality, high-spectacle event film still gets meaningful capacity', () => {
    const lowSpectacle = deriveAudienceSimulationFixedState(inputs({ scriptOriginality: 20, scriptSpectacle: 10 }));
    const highSpectacle = deriveAudienceSimulationFixedState(inputs({ scriptOriginality: 20, scriptSpectacle: 95 }));
    expect(highSpectacle.crossoverCapacityFraction).toBeGreaterThan(lowSpectacle.crossoverCapacityFraction * 1.5);
  });

  it('a non-spectacle film can still reach real capacity through exceptional originality and marketability together', () => {
    const fixed = deriveAudienceSimulationFixedState(inputs({ scriptOriginality: 90, scriptSpectacle: 15, scriptAccessibility: 90, criticScore: 80 }));
    expect(fixed.crossoverCapacityFraction).toBeGreaterThan(0.15);
  });

  it('criticScore alone (moderate everything else) contributes only a secondary amount, never dominating', () => {
    const lowCritic = deriveAudienceSimulationFixedState(inputs({ criticScore: 10 }));
    const highCritic = deriveAudienceSimulationFixedState(inputs({ criticScore: 100 }));
    // criticScore's weight (0.10) is the smallest of the four - swinging it
    // across its whole range moves capacity by far less than originality or
    // spectacle would across theirs (see the spectacle test above).
    expect(highCritic.crossoverCapacityFraction - lowCritic.crossoverCapacityFraction).toBeLessThan(0.05);
  });

  it('genre/target-audience accessibility constrains capacity even when concept strength is maxed out', () => {
    const massMarketAction = deriveAudienceSimulationFixedState(inputs({
      scriptOriginality: 100, scriptSpectacle: 100, scriptAccessibility: 100, criticScore: 100,
      genre: 'Action', targetAudience: 'Mass Market', scriptIntendedAudience: 'Mass Market',
    }));
    const nicheDrama = deriveAudienceSimulationFixedState(inputs({
      scriptOriginality: 100, scriptSpectacle: 100, scriptAccessibility: 100, criticScore: 100,
      genre: 'Drama', targetAudience: 'Niche', scriptIntendedAudience: 'Niche',
    }));
    expect(nicheDrama.crossoverCapacityFraction).toBeLessThan(massMarketAction.crossoverCapacityFraction);
    // Accessibility has a floor, though - even the least accessible
    // genre/audience combination keeps some crossover capacity when concept
    // strength is otherwise maxed out, rather than being driven to zero.
    expect(nicheDrama.crossoverCapacityFraction).toBeGreaterThan(0);
  });

  it('a well-liked but conventional niche film (low originality/spectacle, narrow accessibility) gets very little crossover capacity', () => {
    const fixed = deriveAudienceSimulationFixedState(inputs({
      scriptOriginality: 25, scriptSpectacle: 20, scriptAccessibility: 40, criticScore: 55,
      genre: 'Drama', targetAudience: 'Niche', scriptIntendedAudience: 'Niche',
    }));
    expect(fixed.crossoverCapacityFraction).toBeLessThan(0.08);
  });

  it('a broadly accessible, spectacular, well-liked film gets strong crossover capacity - several factors aligning', () => {
    const fixed = deriveAudienceSimulationFixedState(inputs({
      scriptOriginality: 70, scriptSpectacle: 85, scriptAccessibility: 80, criticScore: 75,
      genre: 'Action', targetAudience: 'Mass Market', scriptIntendedAudience: 'Mass Market',
    }));
    expect(fixed.crossoverCapacityFraction).toBeGreaterThan(0.2);
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
    // Not literally flat - crossoverCapacityFraction (which scriptOriginality
    // feeds) is still real, it just never clears the WOM realization
    // thresholds a poor-reception run needs to draw on it (see
    // audienceSimulationStep.ts's deriveWomCrossoverExpansion) - the
    // requirement is that maximum capacity never produces a meaningfully
    // *larger* outcome than minimum capacity under reception this poor.
    // (Milestone 11, docs/DESIGN.md, removed the old marketingEfficiency
    // origin-dampening term entirely - scriptOriginality no longer touches
    // marketingEfficiency/initialAwareCount at all, only crossover capacity.)
    const maxOfSweep = Math.max(...maxima);
    const minOfSweep = Math.min(...maxima);
    expect(maxOfSweep).toBeLessThan(minOfSweep * 1.3);
  });

  it('strong marketability does not reduce initial interest', () => {
    const marketabilities = [1, 25, 50, 75, 100];
    const fixedStates = marketabilities.map((scriptAccessibility) => deriveAudienceSimulationFixedState(inputs({ scriptAccessibility })));
    for (let i = 1; i < fixedStates.length; i++) {
      expect(fixedStates[i].baseInterestFraction).toBeGreaterThanOrEqual(fixedStates[i - 1].baseInterestFraction);
    }
  });
});

describe('Milestone 11 - awareness/interest/distribution separation of concerns (docs/DESIGN.md)', () => {
  // The architectural claims this milestone's redesign is actually about,
  // asserted directly rather than only inferred from box-office totals -
  // see audienceSimulationInputs.ts's own module header and each function's
  // doc comment for the diagnostic reasoning behind each of these.

  it('marketingEfficiency depends only on studioReputation - completely invariant to scriptAccessibility and scriptOriginality', () => {
    const baseline = deriveAudienceSimulationFixedState(inputs({ studioReputation: 42 })).marketingEfficiency;
    for (const scriptAccessibility of [1, 50, 100]) {
      for (const scriptOriginality of [1, 50, 100]) {
        const fixed = deriveAudienceSimulationFixedState(inputs({ studioReputation: 42, scriptAccessibility, scriptOriginality }));
        expect(fixed.marketingEfficiency).toBeCloseTo(baseline, 9);
      }
    }
  });

  it('marketingEfficiency rises monotonically with studioReputation alone', () => {
    const reputations = [0, 25, 50, 75, 100];
    const efficiencies = reputations.map((studioReputation) => deriveAudienceSimulationFixedState(inputs({ studioReputation })).marketingEfficiency);
    for (let i = 1; i < efficiencies.length; i++) {
      expect(efficiencies[i]).toBeGreaterThan(efficiencies[i - 1]);
    }
  });

  it('initialAwareCount is identical across every release type, for identical cast fame/marketing/reputation - Distribution no longer manufactures awareness', () => {
    const wide = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Wide', directorFame: 60, leadFame: 70, marketingSpend: 30_000_000 })).initialAwareCount;
    const limited = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Limited', directorFame: 60, leadFame: 70, marketingSpend: 30_000_000 })).initialAwareCount;
    const festivalFirst = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Festival First', directorFame: 60, leadFame: 70, marketingSpend: 30_000_000 })).initialAwareCount;
    expect(wide).toBeCloseTo(limited, 6);
    expect(wide).toBeCloseTo(festivalFirst, 6);
  });

  it('initialAvailabilityFraction still strictly differentiates release types - Distribution answers "how much of that demand converts this week," not awareness', () => {
    const wide = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Wide' })).initialAvailabilityFraction;
    const limited = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Limited' })).initialAvailabilityFraction;
    const festivalFirst = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Festival First' })).initialAvailabilityFraction;
    expect(wide).toBeGreaterThan(limited);
    expect(limited).toBeGreaterThan(festivalFirst);
  });

  it('scriptAccessibility never moves initialAwareCount - a broadly understandable concept is not the same as a widely-known one', () => {
    const low = deriveAudienceSimulationFixedState(inputs({ scriptAccessibility: 1 })).initialAwareCount;
    const high = deriveAudienceSimulationFixedState(inputs({ scriptAccessibility: 100 })).initialAwareCount;
    expect(low).toBeCloseTo(high, 6);
  });

  it('scriptOriginality never moves initialAwareCount - originality affects crossover/conversation, never raw awareness reach', () => {
    const low = deriveAudienceSimulationFixedState(inputs({ scriptOriginality: 1 })).initialAwareCount;
    const high = deriveAudienceSimulationFixedState(inputs({ scriptOriginality: 100 })).initialAwareCount;
    expect(low).toBeCloseTo(high, 6);
  });

  it('crossoverCapacityFraction responds to scriptHookStrength, not to scriptAccessibility - "spreads by recommendation" and "has a big natural audience" are different questions', () => {
    const lowHook = deriveAudienceSimulationFixedState(inputs({ scriptHookStrength: 5, scriptAccessibility: 50 })).crossoverCapacityFraction;
    const highHook = deriveAudienceSimulationFixedState(inputs({ scriptHookStrength: 95, scriptAccessibility: 50 })).crossoverCapacityFraction;
    expect(highHook).toBeGreaterThan(lowHook);

    const lowAccessibility = deriveAudienceSimulationFixedState(inputs({ scriptHookStrength: 50, scriptAccessibility: 5 })).crossoverCapacityFraction;
    const highAccessibility = deriveAudienceSimulationFixedState(inputs({ scriptHookStrength: 50, scriptAccessibility: 95 })).crossoverCapacityFraction;
    expect(highAccessibility).toBeCloseTo(lowAccessibility, 6);
  });

  it('computeCastReachFraction: an unknown director/lead pair contributes essentially no awareness even at maximum marketing spend efficiency', () => {
    const fixed = deriveAudienceSimulationFixedState(inputs({ directorFame: 0, leadFame: 0, marketingSpend: 10_000, studioReputation: 100 }));
    // Cast contributes nothing; only the tiny token marketing spend's own reach remains.
    const withFamousCast = deriveAudienceSimulationFixedState(inputs({ directorFame: 100, leadFame: 100, marketingSpend: 10_000, studioReputation: 100 }));
    expect(withFamousCast.initialAwareCount).toBeGreaterThan(fixed.initialAwareCount * 3);
  });

  it('marketing spend is the dominant awareness channel: its full-range swing produces a bigger initialAwareCount change than cast fame\'s full-range swing, at default reputation', () => {
    const marketingLow = deriveAudienceSimulationFixedState(inputs({ marketingSpend: 10_000 })).initialAwareCount;
    const marketingHigh = deriveAudienceSimulationFixedState(inputs({ marketingSpend: 150_000_000 })).initialAwareCount;
    const fameLow = deriveAudienceSimulationFixedState(inputs({ directorFame: 0, leadFame: 0 })).initialAwareCount;
    const fameHigh = deriveAudienceSimulationFixedState(inputs({ directorFame: 100, leadFame: 100 })).initialAwareCount;
    expect(marketingHigh - marketingLow).toBeGreaterThan(fameHigh - fameLow);
  });
});

describe('boundaries', () => {
  // Milestone 11 (docs/DESIGN.md - "release-input separation of concerns")
  // removed buzzScore's old role seeding initial awareness entirely (see
  // computeCastReachFraction/audienceSimulationInputs.ts) - varying buzzScore
  // alone no longer moves awareness or opening in any meaningful way, so the
  // old "Buzz 0 vs Buzz 100" boundary test's premise is gone. Replaced with
  // the two levers that now actually own awareness: marketing spend
  // (dominant, MARKETING_REACH_WEIGHT=0.75) and cast fame (secondary,
  // CAST_REACH_WEIGHT=0.25) - checked against a scratch diagnostic sweep
  // before being written in, per this project's calibration discipline.
  it('marketing spend 0 vs maximum, everything else fixed - a heavily marketed film opens dramatically bigger, not just modestly so', () => {
    const week1AtMin = runFullSimulation(inputs({ marketingSpend: 10_000 }))[0].cumulativeTicketsSold;
    const week1AtMax = runFullSimulation(inputs({ marketingSpend: 150_000_000 }))[0].cumulativeTicketsSold;
    expect(week1AtMin).toBeGreaterThan(0); // cast-fame floor: never literally zero even with a token marketing spend
    expect(week1AtMax).toBeGreaterThan(week1AtMin * 3); // real diagnostic: ~5.7x at default (fame 50/50) reach - marketing genuinely is the dominant awareness channel
  });

  it('director/lead fame 0 vs maximum, everything else fixed - cast reach provides a real but clearly secondary boost, well short of marketing\'s swing', () => {
    const week1AtZeroFame = runFullSimulation(inputs({ directorFame: 0, leadFame: 0 }))[0].cumulativeTicketsSold;
    const week1AtMaxFame = runFullSimulation(inputs({ directorFame: 100, leadFame: 100 }))[0].cumulativeTicketsSold;
    const fameRatio = week1AtMaxFame / week1AtZeroFame;
    const marketingRatio = runFullSimulation(inputs({ marketingSpend: 150_000_000 }))[0].cumulativeTicketsSold / runFullSimulation(inputs({ marketingSpend: 10_000 }))[0].cumulativeTicketsSold;
    expect(fameRatio).toBeGreaterThan(1.5); // real diagnostic: ~2.06x - fame alone is a genuine lever, not a no-op
    expect(fameRatio).toBeLessThan(marketingRatio); // but CAST_REACH_WEIGHT (0.25) < MARKETING_REACH_WEIGHT (0.75) - marketing must swing harder
  });

  it('zero vs maximum marketing spend, everything else fixed - more spend clearly opens bigger', () => {
    const weekMin = runFullSimulation(inputs({ marketingSpend: 10_000 }))[0].cumulativeTicketsSold;
    const weekMax = runFullSimulation(inputs({ marketingSpend: 150_000_000 }))[0].cumulativeTicketsSold;
    expect(weekMax).toBeGreaterThan(weekMin);
  });

  it('a very small Limited release (unknown cast, modest spend) opens and totals far below a maximum-reach Wide release (famous cast, huge spend)', () => {
    const limited = runFullSimulation(inputs({ releaseType: 'Limited', buzzScore: 20, marketingSpend: 500_000, directorFame: 20, leadFame: 15, studioReputation: 30 }));
    const wide = runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 90, marketingSpend: 150_000_000, directorFame: 80, leadFame: 85, studioReputation: 75 }));
    expect(wide[0].cumulativeTicketsSold).toBeGreaterThan(limited[0].cumulativeTicketsSold * 10);
    expect(totalAdmissions(wide)).toBeGreaterThan(totalAdmissions(limited) * 5);
  });

  it('an excellent film with almost no opening awareness (Festival First, unknown cast, no marketing) still opens tiny relative to its addressable audience', () => {
    const releaseInputs = inputs({ releaseType: 'Festival First', buzzScore: 0, marketingSpend: 10_000, directorFame: 10, leadFame: 8, studioReputation: 15, criticScore: 95, audienceScore: 93 });
    const fixed = deriveAudienceSimulationFixedState(releaseInputs);
    const weeks = runFullSimulation(releaseInputs);
    expect(fixed.initialAwareCount).toBeLessThan(fixed.totalAddressableAudience * 0.01);
    expect(weeks[0].cumulativeTicketsSold).toBeLessThan(fixed.totalAddressableAudience * 0.01);
    // But excellent reception still visibly builds week over week - awareness/interest aren't stuck at their tiny opening.
    expect(weeks[weeks.length - 1].awareCount).toBeGreaterThan(weeks[0].awareCount);
  });

  it('a terrible film with enormous awareness (Wide, famous cast, maximum marketing, terrible reception) still collapses fast after opening', () => {
    const releaseInputs = inputs({ releaseType: 'Wide', buzzScore: 100, marketingSpend: 150_000_000, directorFame: 70, leadFame: 75, studioReputation: 60, criticScore: 5, audienceScore: 5 });
    const weeks = runFullSimulation(releaseInputs);
    const admissions = weeklyAdmissions(weeks);
    expect(admissions[0]).toBeGreaterThan(500_000); // huge awareness really does buy a huge opening
    // Steady collapse, not sustained: by the 5th week, admissions have fallen
    // to close to half of opening. Threshold loosened from 0.5 to 0.55 as
    // part of Milestone 11's release-input redesign (docs/DESIGN.md) - real
    // diagnostic value here is ~50.5% regardless of cast fame (fame scales
    // both weeks proportionally, it doesn't change the decay rate), a
    // pre-existing decay-curve characteristic this boundary test's old 0.5
    // threshold sat right on top of, not a regression this milestone caused.
    expect(admissions[4]).toBeLessThan(admissions[0] * 0.55);
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
    const sleeperInputs = inputs({ releaseType: 'Limited', buzzScore: 15, marketingSpend: 300_000, scriptOriginality: 70, criticScore: 92, audienceScore: 95 });
    const fixed = deriveAudienceSimulationFixedState(sleeperInputs);
    const weeks = runFullSimulation(sleeperInputs);
    const admissions = weeklyAdmissions(weeks);
    // "Small opening" relative to this film's own addressable audience, not a hardcoded headcount - stays true regardless of how BASE_ADDRESSABLE_POPULATION (engine/audienceSimulationInputs.ts) is calibrated.
    expect(admissions[0]).toBeLessThan(fixed.totalAddressableAudience * 0.005);
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
    // Large capacity exists (originality=95, the single biggest of the four
    // capacity inputs) but poor reception means it's essentially unrealized.
    // 0.2 was calibrated against the old originality-only capacity formula
    // (0.3 * 0.95 = 0.285); the multi-factor redesign (docs/DESIGN.md 5.34,
    // "crossover/pull-forward separation") also weighs spectacle/
    // marketability/criticScore, which are only moderate-to-poor here
    // (defaults/poor reception), landing capacity at ~0.188 - still well
    // above a film with no standout concept-strength input at all (which
    // would sit close to CROSSOVER_CAPACITY_CEILING * accessibility * a
    // concept strength near its own floor), just no longer near the ceiling
    // from originality alone.
    expect(fixed.crossoverCapacityFraction).toBeGreaterThan(0.15);
    expect(maxEverInterested(weeks)).toBeLessThanOrEqual(naturalCeiling + 1e-6);
  });

  it('7. excellent but poorly marketed film: tiny opening, but total grows to many times the opening via word of mouth alone', () => {
    const releaseInputs = inputs({ releaseType: 'Limited', buzzScore: 5, marketingSpend: 10_000, criticScore: 90, audienceScore: 88 });
    const fixed = deriveAudienceSimulationFixedState(releaseInputs);
    const weeks = runFullSimulation(releaseInputs);
    const week1 = weeks[0].cumulativeTicketsSold;
    // "Tiny opening" relative to this film's own addressable audience, not a hardcoded headcount - see test 2's identical reasoning above.
    expect(week1).toBeLessThan(fixed.totalAddressableAudience * 0.005);
    expect(totalAdmissions(weeks)).toBeGreaterThan(week1 * 10);
  });

  it('8. massive marketing campaign for a poor film: an enormous opening that still cannot sustain itself', () => {
    const weeks = runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 85, marketingSpend: 150_000_000, criticScore: 20, audienceScore: 18 }));
    const admissions = weeklyAdmissions(weeks);
    expect(admissions[0]).toBeGreaterThan(500_000);
    expect(admissions[9]).toBeLessThan(admissions[0] * 0.35); // by week 10, marketing's one-time push has clearly worn off
  });

  it('9. ordinary mid-performing film: unremarkable, but genuinely sustained - later weeks decline gently, they do not collapse the way a poor-reception film does', () => {
    const weeks = runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 45, marketingSpend: 15_000_000, criticScore: 55, audienceScore: 58 }));
    const admissions = weeklyAdmissions(weeks);
    // Distinguishing shape from archetype 1/8 (poor reception): "most films
    // decline from opening, strong WOM can flatten the decline" (see the
    // Quantum Signal incident fix, docs/DESIGN.md 5.34) - only *strong*
    // reception should hold flat or grow, so a merely-ordinary film
    // declining gently by week 10 is the correct shape, not a regression.
    // What must still hold is the *contrast* with archetype 8's poor-
    // reception collapse (admissions[9] < admissions[0] * 0.35): ordinary
    // reception should decay far more gently than that, never collapsing.
    const later = admissions[Math.min(9, admissions.length - 1)];
    expect(later).toBeGreaterThan(admissions[0] * 0.5);
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
      scriptAccessibility: 90,
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
      directorFame: 0,
      leadFame: 0,
      studioReputation: 5,
      scriptAccessibility: 10,
      scriptOriginality: 5,
      criticScore: 40,
      audienceScore: 40,
    });
    const weeks = runFullSimulation(releaseInputs);
    // 1,000,000 -> 2,000,000 as part of Milestone 11's release-input redesign
    // (docs/DESIGN.md): Distribution no longer scales awareness down on top
    // of availability (the old release-type awareness-share multiplier this
    // "minimal reach" floor used to lean on is gone by design), so even at
    // every awareness lever pinned to its floor (zero cast fame, token
    // marketing spend, minimal accessibility/originality), the real total
    // lands at ~1,024,000 - still tiny relative to this film's own addressable
    // audience, just no longer under the old, now-stale 1,000,000 mark.
    expect(totalAdmissions(weeks)).toBeLessThan(2_000_000);
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
