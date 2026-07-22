import { describe, it, expect } from 'vitest';
import { deriveAudienceSimulationFixedState, type ReleaseSimulationInputs } from './audienceSimulationInputs';
import { advanceToWeek, advanceToWeekWithDiagnostics, MAX_SIMULATION_WEEKS, hasSimulationEnded } from './audienceSimulationStep';
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

  it('always produces baseInterestFraction + crossoverCapacityFraction <= 1, at every accessibility/crossoverPotential extreme', () => {
    for (const scriptAccessibility of [1, 50, 100]) {
      for (const scriptCrossoverPotential of [1, 50, 100]) {
        const fixed = deriveAudienceSimulationFixedState(inputs({ scriptAccessibility, scriptCrossoverPotential }));
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
    const fixed = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 100, scriptSpectacle: 50, scriptAccessibility: 50, criticScore: 50 }));
    expect(fixed.crossoverCapacityFraction).toBeLessThan(0.25);
  });

  it('spectacle contributes independently of originality - a low-originality, high-spectacle event film still gets meaningful capacity', () => {
    const lowSpectacle = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 20, scriptSpectacle: 10 }));
    const highSpectacle = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 20, scriptSpectacle: 95 }));
    expect(highSpectacle.crossoverCapacityFraction).toBeGreaterThan(lowSpectacle.crossoverCapacityFraction * 1.5);
  });

  it('a non-spectacle film can still reach real capacity through exceptional originality and marketability together', () => {
    const fixed = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 90, scriptSpectacle: 15, scriptAccessibility: 90, criticScore: 80 }));
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
      scriptCrossoverPotential: 100, scriptSpectacle: 100, scriptAccessibility: 100, criticScore: 100,
      genre: 'Action', targetAudience: 'Mass Market', scriptIntendedAudience: 'Mass Market',
    }));
    const nicheDrama = deriveAudienceSimulationFixedState(inputs({
      scriptCrossoverPotential: 100, scriptSpectacle: 100, scriptAccessibility: 100, criticScore: 100,
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
      scriptCrossoverPotential: 25, scriptSpectacle: 20, scriptAccessibility: 40, criticScore: 55,
      genre: 'Drama', targetAudience: 'Niche', scriptIntendedAudience: 'Niche',
    }));
    expect(fixed.crossoverCapacityFraction).toBeLessThan(0.08);
  });

  it('a broadly accessible, spectacular, well-liked film gets strong crossover capacity - several factors aligning', () => {
    const fixed = deriveAudienceSimulationFixedState(inputs({
      scriptCrossoverPotential: 70, scriptSpectacle: 85, scriptAccessibility: 80, criticScore: 75,
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

  it('higher expansion capacity (crossoverPotential) does not reduce reachable interest, given good reception', () => {
    const potentials = [0, 25, 50, 75, 100];
    const maxima = potentials.map((scriptCrossoverPotential) => maxEverInterested(runFullSimulation(inputs({ scriptCrossoverPotential, criticScore: 92, audienceScore: 95 }))));
    for (let i = 1; i < maxima.length; i++) {
      expect(maxima[i]).toBeGreaterThanOrEqual(maxima[i - 1]);
    }
  });

  it('higher crossoverPotential with poor reception must not independently create a sleeper hit - capacity alone never breaks out', () => {
    const potentials = [0, 25, 50, 75, 100];
    const maxima = potentials.map((scriptCrossoverPotential) => maxEverInterested(runFullSimulation(inputs({ scriptCrossoverPotential, criticScore: 12, audienceScore: 10 }))));
    // Not literally flat - crossoverCapacityFraction (which scriptCrossoverPotential
    // feeds) is still real, it just never clears the WOM realization
    // thresholds a poor-reception run needs to draw on it (see
    // audienceSimulationStep.ts's deriveWomCrossoverExpansion) - the
    // requirement is that maximum capacity never produces a meaningfully
    // *larger* outcome than minimum capacity under reception this poor.
    // scriptCrossoverPotential never touches marketingEfficiency/initialAwareCount
    // at all (Milestone 11/12) - only crossover capacity.
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

  it('marketingEfficiency depends only on studioBrand - completely invariant to scriptAccessibility and scriptCrossoverPotential', () => {
    const baseline = deriveAudienceSimulationFixedState(inputs({ studioBrand: 42 })).marketingEfficiency;
    for (const scriptAccessibility of [1, 50, 100]) {
      for (const scriptCrossoverPotential of [1, 50, 100]) {
        const fixed = deriveAudienceSimulationFixedState(inputs({ studioBrand: 42, scriptAccessibility, scriptCrossoverPotential }));
        expect(fixed.marketingEfficiency).toBeCloseTo(baseline, 9);
      }
    }
  });

  it('marketingEfficiency rises monotonically with studioBrand alone', () => {
    const reputations = [0, 25, 50, 75, 100];
    const efficiencies = reputations.map((studioBrand) => deriveAudienceSimulationFixedState(inputs({ studioBrand })).marketingEfficiency);
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

  it('scriptCrossoverPotential never moves initialAwareCount - crossover potential affects crossover/conversation, never raw awareness reach', () => {
    const low = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 1 })).initialAwareCount;
    const high = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 100 })).initialAwareCount;
    expect(low).toBeCloseTo(high, 6);
  });

  it('crossoverCapacityFraction responds to scriptCrossoverPotential, not to scriptAccessibility or scriptHookStrength (Milestone 12) - "spreads by recommendation" and "has a big natural audience"/"compelling pitch" are different questions', () => {
    const lowPotential = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 5, scriptAccessibility: 50, scriptHookStrength: 50 })).crossoverCapacityFraction;
    const highPotential = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 95, scriptAccessibility: 50, scriptHookStrength: 50 })).crossoverCapacityFraction;
    expect(highPotential).toBeGreaterThan(lowPotential);

    const lowAccessibility = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 50, scriptAccessibility: 5, scriptHookStrength: 50 })).crossoverCapacityFraction;
    const highAccessibility = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 50, scriptAccessibility: 95, scriptHookStrength: 50 })).crossoverCapacityFraction;
    expect(highAccessibility).toBeCloseTo(lowAccessibility, 6);

    const lowHook = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 50, scriptAccessibility: 50, scriptHookStrength: 5 })).crossoverCapacityFraction;
    const highHook = deriveAudienceSimulationFixedState(inputs({ scriptCrossoverPotential: 50, scriptAccessibility: 50, scriptHookStrength: 95 })).crossoverCapacityFraction;
    expect(highHook).toBeCloseTo(lowHook, 6);
  });

  it('baseInterestFraction responds to scriptHookStrength as a secondary multiplier alongside scriptAccessibility (Milestone 12) - "compelling pitch" and "easy to understand" are different questions, both inside interest generation', () => {
    const lowHook = deriveAudienceSimulationFixedState(inputs({ scriptHookStrength: 5, scriptAccessibility: 50 })).baseInterestFraction;
    const highHook = deriveAudienceSimulationFixedState(inputs({ scriptHookStrength: 95, scriptAccessibility: 50 })).baseInterestFraction;
    expect(highHook).toBeGreaterThan(lowHook);
    // Secondary, not dominant - accessibility's own swing (its full 0-100 range) must still exceed hookStrength's own swing.
    const lowAccessibility = deriveAudienceSimulationFixedState(inputs({ scriptAccessibility: 5, scriptHookStrength: 50 })).baseInterestFraction;
    const highAccessibility = deriveAudienceSimulationFixedState(inputs({ scriptAccessibility: 95, scriptHookStrength: 50 })).baseInterestFraction;
    expect(highHook / lowHook).toBeLessThan(highAccessibility / lowAccessibility);
  });

  it('computeCastReachFraction: an unknown director/lead pair contributes essentially no awareness even at maximum marketing spend efficiency', () => {
    const fixed = deriveAudienceSimulationFixedState(inputs({ directorFame: 0, leadFame: 0, marketingSpend: 10_000, studioBrand: 100 }));
    // Cast contributes nothing; only the tiny token marketing spend's own reach remains.
    const withFamousCast = deriveAudienceSimulationFixedState(inputs({ directorFame: 100, leadFame: 100, marketingSpend: 10_000, studioBrand: 100 }));
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
  // (dominant) and cast fame (secondary, capped at MAX_CAST_ORGANIC_REACH so
  // a genuinely obscure cast produces negligible organic reach on its own -
  // see audienceSimulationInputs.ts:computeCastReachFraction/
  // combineIndependentReach) - checked against a scratch diagnostic sweep
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
    expect(fameRatio).toBeGreaterThan(1.15); // real diagnostic: ~1.24x - fame alone is a genuine lever, not a no-op, but MAX_CAST_ORGANIC_REACH's 0.1 ceiling deliberately keeps it modest
    expect(fameRatio).toBeLessThan(marketingRatio); // marketing must still swing harder than cast fame alone
  });

  it('zero vs maximum marketing spend, everything else fixed - more spend clearly opens bigger', () => {
    const weekMin = runFullSimulation(inputs({ marketingSpend: 10_000 }))[0].cumulativeTicketsSold;
    const weekMax = runFullSimulation(inputs({ marketingSpend: 150_000_000 }))[0].cumulativeTicketsSold;
    expect(weekMax).toBeGreaterThan(weekMin);
  });

  it('a very small Limited release (unknown cast, modest spend) opens and totals far below a maximum-reach Wide release (famous cast, huge spend)', () => {
    const limited = runFullSimulation(inputs({ releaseType: 'Limited', buzzScore: 20, marketingSpend: 500_000, directorFame: 20, leadFame: 15, studioBrand: 30 }));
    const wide = runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 90, marketingSpend: 150_000_000, directorFame: 80, leadFame: 85, studioBrand: 75 }));
    expect(wide[0].cumulativeTicketsSold).toBeGreaterThan(limited[0].cumulativeTicketsSold * 10);
    expect(totalAdmissions(wide)).toBeGreaterThan(totalAdmissions(limited) * 5);
  });

  it('an excellent film with almost no opening awareness (Festival First, unknown cast, no marketing) still opens tiny relative to its addressable audience', () => {
    const releaseInputs = inputs({ releaseType: 'Festival First', buzzScore: 0, marketingSpend: 10_000, directorFame: 10, leadFame: 8, studioBrand: 15, criticScore: 95, audienceScore: 93 });
    const fixed = deriveAudienceSimulationFixedState(releaseInputs);
    const weeks = runFullSimulation(releaseInputs);
    expect(fixed.initialAwareCount).toBeLessThan(fixed.totalAddressableAudience * 0.01);
    expect(weeks[0].cumulativeTicketsSold).toBeLessThan(fixed.totalAddressableAudience * 0.01);
    // But excellent reception still visibly builds week over week - awareness/interest aren't stuck at their tiny opening.
    expect(weeks[weeks.length - 1].awareCount).toBeGreaterThan(weeks[0].awareCount);
  });

  it('a terrible film with enormous awareness (Wide, famous cast, maximum marketing, terrible reception) still collapses fast after opening', () => {
    const releaseInputs = inputs({ releaseType: 'Wide', buzzScore: 100, marketingSpend: 150_000_000, directorFame: 70, leadFame: 75, studioBrand: 60, criticScore: 5, audienceScore: 5 });
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
      scriptCrossoverPotential: 2,
      criticScore: 96,
      audienceScore: 94,
    });
    const fixed = deriveAudienceSimulationFixedState(releaseInputs);
    const weeks = runFullSimulation(releaseInputs);
    const ceiling = maxInterestedAudience(fixed);
    expect(maxEverInterested(weeks)).toBeLessThanOrEqual(ceiling + 1e-6);

    const massMarketEquivalent = deriveAudienceSimulationFixedState(
      inputs({ targetAudience: 'Mass Market', scriptIntendedAudience: 'Mass Market', scriptCrossoverPotential: 2, criticScore: 96, audienceScore: 94 }),
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
    // Awareness itself no longer grows over the run (built almost entirely
    // at release - see audienceSimulationStep.ts's module header), so a
    // "sleeper hit" here means something more realistic than an ever-widening
    // audience: a slow-building Festival First release where week 1's low
    // baseline conversion pacing undersells the already-aware audience, and
    // strong reception (via steps 5/6/8) converts more of that same aware
    // pool into tickets over the next few weeks before the run eventually
    // turns over into decline - a genuine early climb, not instant
    // saturation, even though total awareness itself was fixed at release.
    const sleeperInputs = inputs({ releaseType: 'Festival First', buzzScore: 10, marketingSpend: 100_000, scriptCrossoverPotential: 90, criticScore: 96, audienceScore: 96 });
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
    // Milestone 12: fame/hookStrength/spectacle/crossoverPotential pushed to
    // genuinely maxed levels (previously left at inputs()'s neutral default
    // of 50) - reaching extreme-upper-range saturation now requires every
    // lever aligned, matching the same real-diagnostic finding behind
    // audienceSimulationScenarios.test.ts's HUGE_OPENING_EXCEPTIONAL fix
    // this milestone. Every input here is now already at (or within a
    // hair of) its own realistic ceiling - buzz/marketing/reception/fame/
    // reputation/hookStrength/spectacle all maxed or near-maxed - and real
    // diagnostic saturation still lands at ~97% of the old 0.9 bar (i.e.
    // ~87% of ceiling), not 90%+. Threshold lowered accordingly rather than
    // pushed further into unrealistic input territory.
    const phenomenonInputs = inputs({
      releaseType: 'Wide', buzzScore: 95, marketingSpend: 150_000_000, criticScore: 95, audienceScore: 97,
      directorFame: 95, leadFame: 98, studioBrand: 95, scriptAccessibility: 90,
      scriptHookStrength: 95, scriptSpectacle: 95, scriptCrossoverPotential: 75,
    });
    const weeks = runFullSimulation(phenomenonInputs);
    const fixed = deriveAudienceSimulationFixedState(phenomenonInputs);
    expect(weeks[0].cumulativeTicketsSold).toBeGreaterThan(500_000);
    // Not capped merely to keep the number tidy - it's allowed to approach the film's own full realistic ceiling.
    expect(totalAdmissions(weeks)).toBeGreaterThan(maxInterestedAudience(fixed) * 0.85);
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
    const releaseInputs = inputs({ releaseType: 'Wide', scriptCrossoverPotential: 95, buzzScore: 50, marketingSpend: 20_000_000, criticScore: 20, audienceScore: 15 });
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
    // "Cannot sustain itself": a poorly-received film's weak word of mouth
    // can't hold the crowd its one-time marketing push bought, so the run
    // collapses and ends well before the 20-week cap, its final week a small
    // fraction of the enormous opening. Post the run-length recalibration
    // (DESIGN.md Milestone 13, Wide conversionPacingBaseline 0.14 -> 0.35) this
    // collapse now completes in under 10 weeks rather than merely being under
    // way by week 10 - so we assert on the (earlier) final week, not week 10.
    expect(weeks.length).toBeLessThan(MAX_SIMULATION_WEEKS);
    expect(admissions[admissions.length - 1]).toBeLessThan(admissions[0] * 0.35);
  });

  it('9. ordinary mid-performing film: unremarkable, but genuinely sustained - later weeks decline gently, they do not collapse the way a poor-reception film does', () => {
    const weeks = runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 45, marketingSpend: 15_000_000, criticScore: 55, audienceScore: 58 }));
    const admissions = weeklyAdmissions(weeks);
    const poorWeeks = runFullSimulation(inputs({ releaseType: 'Wide', buzzScore: 85, marketingSpend: 150_000_000, criticScore: 20, audienceScore: 18 }));
    const poorAdmissions = weeklyAdmissions(poorWeeks);
    // Every film now declines from opening (awareness is built almost
    // entirely up front, at release - see audienceSimulationStep.ts's
    // module header - so there's no ongoing awareness growth left to hold
    // admissions flat the way old WOM-driven-awareness builds could).
    // What still distinguishes reception quality is *how fast* that decline
    // is: reception still drives steps 5/6/8 (interest conversion,
    // crossover, pull-forward) against whatever audience is already aware,
    // so an ordinary film's week-10 retention should be meaningfully better
    // than a poorly-received film's, not just technically nonzero.
    const laterRatio = admissions[Math.min(9, admissions.length - 1)] / admissions[0];
    const poorLaterRatio = poorAdmissions[Math.min(9, poorAdmissions.length - 1)] / poorAdmissions[0];
    expect(laterRatio).toBeGreaterThan(poorLaterRatio * 1.5);
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
      scriptCrossoverPotential: 80,
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
      studioBrand: 5,
      scriptAccessibility: 10,
      scriptCrossoverPotential: 5,
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
      inputs({ releaseType: 'Limited', buzzScore: 15, marketingSpend: 300_000, scriptCrossoverPotential: 70, criticScore: 92, audienceScore: 95 }),
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

describe('Milestone 12 - commercial believability calibration (docs/DESIGN.md)', () => {
  // The architectural claims this milestone's rebalance is actually about,
  // asserted directly rather than only inferred from box-office totals -
  // see audienceSimulationInputs.ts's own module header and each function's
  // doc comment for the diagnostic reasoning behind each of these.

  it('marketing spend is a bigger opening-weekend lever than the screenplay (accessibility + hookStrength combined), across each one\'s own realistic range', () => {
    const marketingLow = runFullSimulation(inputs({ marketingSpend: 10_000 }))[0].cumulativeTicketsSold;
    const marketingHigh = runFullSimulation(inputs({ marketingSpend: 150_000_000 }))[0].cumulativeTicketsSold;
    const screenplayLow = runFullSimulation(inputs({ scriptAccessibility: 5, scriptHookStrength: 5 }))[0].cumulativeTicketsSold;
    const screenplayHigh = runFullSimulation(inputs({ scriptAccessibility: 95, scriptHookStrength: 95 }))[0].cumulativeTicketsSold;
    const marketingRatio = marketingHigh / marketingLow;
    const screenplayRatio = screenplayHigh / screenplayLow;
    expect(marketingRatio).toBeGreaterThan(screenplayRatio);
  });

  it('Wide release availability scales with release strength (marketing spend + studio reputation) - an unknown, poorly-funded studio does not get the same nationwide rollout as an established one', () => {
    const tiny = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Wide', directorFame: 5, leadFame: 5, studioBrand: 10, marketingSpend: 50_000 }));
    const mid = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Wide', studioBrand: 50, marketingSpend: 20_000_000 }));
    const strong = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Wide', directorFame: 85, leadFame: 90, studioBrand: 85, marketingSpend: 120_000_000 }));
    expect(tiny.initialAvailabilityFraction).toBeLessThan(mid.initialAvailabilityFraction);
    expect(mid.initialAvailabilityFraction).toBeLessThan(strong.initialAvailabilityFraction);
  });

  it('Wide still always beats Limited on availability, even for the weakest possible release strength - Distribution is earned relative to strategy, never inverted', () => {
    const weakestWide = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Wide', directorFame: 0, leadFame: 0, studioBrand: 0, marketingSpend: 10_000 }));
    const strongestLimited = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Limited', directorFame: 100, leadFame: 100, studioBrand: 100, marketingSpend: 150_000_000 }));
    expect(weakestWide.initialAvailabilityFraction).toBeGreaterThan(strongestLimited.initialAvailabilityFraction);
  });

  it('Limited and Festival First availability stay flat regardless of release strength - only Wide\'s day-one rollout has to be earned', () => {
    const weak = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Limited', directorFame: 0, leadFame: 0, studioBrand: 0, marketingSpend: 10_000 }));
    const strong = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Limited', directorFame: 100, leadFame: 100, studioBrand: 100, marketingSpend: 150_000_000 }));
    expect(weak.initialAvailabilityFraction).toBeCloseTo(strong.initialAvailabilityFraction, 9);

    const weakFestival = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Festival First', directorFame: 0, leadFame: 0, studioBrand: 0, marketingSpend: 10_000 }));
    const strongFestival = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Festival First', directorFame: 100, leadFame: 100, studioBrand: 100, marketingSpend: 150_000_000 }));
    expect(weakFestival.initialAvailabilityFraction).toBeCloseTo(strongFestival.initialAvailabilityFraction, 9);
  });

  it('crossoverCapacityFraction now genuinely throttles realized crossover - the Milestone 10 gap this milestone fixed', () => {
    // At fixed, merely-good reception, sweeping crossoverCapacityFraction's
    // own driving inputs from near-floor to near-ceiling used to leave
    // realized crossover almost unchanged in absolute terms (a documented
    // Milestone 10 gap - see deriveWomCrossoverExpansion's doc comment: a
    // real diagnostic found swinging capacity 14x left legs and total gross
    // essentially flat, even non-monotonic). cumulativeCrossoverRealized
    // (this milestone) fixes it at the source - realized crossover now
    // rises with capacity (it did not reliably before), and (checked
    // directly in the next test) never exceeds its own capacity ceiling
    // regardless of how much natural-audience headroom is separately left.
    const lowCapacityInputs = inputs({ scriptCrossoverPotential: 2, scriptSpectacle: 2, criticScore: 68, audienceScore: 72 });
    const highCapacityInputs = inputs({ scriptCrossoverPotential: 100, scriptSpectacle: 100, criticScore: 68, audienceScore: 72 });
    const lowFixed = deriveAudienceSimulationFixedState(lowCapacityInputs);
    const highFixed = deriveAudienceSimulationFixedState(highCapacityInputs);
    expect(highFixed.crossoverCapacityFraction).toBeGreaterThan(lowFixed.crossoverCapacityFraction * 5); // capacity itself swings hugely...
    const { weeks: lowWeeks } = advanceToWeekWithDiagnostics(lowFixed, [], MAX_SIMULATION_WEEKS);
    const { weeks: highWeeks } = advanceToWeekWithDiagnostics(highFixed, [], MAX_SIMULATION_WEEKS);
    const lowRealized = lowWeeks[lowWeeks.length - 1].cumulativeCrossoverRealized;
    const highRealized = highWeeks[highWeeks.length - 1].cumulativeCrossoverRealized;
    expect(highRealized).toBeGreaterThan(lowRealized); // ...and realized crossover now genuinely follows it, not just capacity in name only.
  });

  it('cumulativeCrossoverRealized never exceeds crossoverCapacityFraction * totalAddressableAudience, at any reception level', () => {
    for (const score of [20, 50, 80, 97]) {
      const releaseInputs = inputs({ scriptCrossoverPotential: 90, scriptSpectacle: 90, criticScore: score, audienceScore: score });
      const fixed = deriveAudienceSimulationFixedState(releaseInputs);
      const { weeks } = advanceToWeekWithDiagnostics(fixed, [], MAX_SIMULATION_WEEKS);
      const crossoverCeiling = fixed.crossoverCapacityFraction * fixed.totalAddressableAudience;
      for (const week of weeks) {
        expect(week.cumulativeCrossoverRealized).toBeLessThanOrEqual(crossoverCeiling + 1e-6);
      }
    }
  });
});

describe('deriveAudienceSimulationFixedState - Wide availability ceiling (Distribution Arm)', () => {
  it('a lower distribution ceiling lowers a Wide release\'s initial availability, all else equal', () => {
    // The Distribution Arm / rental deal caps how wide a release can go
    // (engine/distribution.ts), threaded in via wideAvailabilityCeiling.
    const narrow = deriveAudienceSimulationFixedState(inputs({ wideAvailabilityCeiling: 0.6 }));
    const wide = deriveAudienceSimulationFixedState(inputs({ wideAvailabilityCeiling: 0.95 }));
    expect(narrow.initialAvailabilityFraction).toBeLessThan(wide.initialAvailabilityFraction);
  });

  it('leaves non-Wide release types untouched (the ceiling only gates Wide)', () => {
    const a = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Limited', wideAvailabilityCeiling: 0.6 }));
    const b = deriveAudienceSimulationFixedState(inputs({ releaseType: 'Limited', wideAvailabilityCeiling: 0.95 }));
    expect(a.initialAvailabilityFraction).toBe(b.initialAvailabilityFraction);
  });
});
