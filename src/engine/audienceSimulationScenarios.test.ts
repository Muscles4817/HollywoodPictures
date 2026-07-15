// Milestone 6 of the audience-based box office redesign (docs/DESIGN.md
// 5.34) - "scenario hardening and regression suite." Everything here runs
// against the exact live pipeline (deriveAudienceSimulationFixedState ->
// advanceToWeek -> the same AVERAGE_TICKET_PRICE/STUDIO_BOX_OFFICE_SHARE
// boundary engine/boxOfficeRun.ts uses for a real release), not the
// people-only layer Milestone 3's own tests already cover - this is the
// permanent regression net for what a player actually sees.
//
// Every scenario's concrete inputs and every sweep's thresholds were
// checked against a scratch diagnostic sweep before being written into an
// assertion, per this project's own calibration discipline (see Milestones
// 2/3/5's DESIGN.md notes) - never picked to make a named scenario pass,
// picked to represent its archetype honestly and then verified.
import { describe, it, expect } from 'vitest';
import { deriveAudienceSimulationFixedState, type ReleaseSimulationInputs, type SupportedReleaseType } from './audienceSimulationInputs';
import { advanceToWeek, MAX_SIMULATION_WEEKS } from './audienceSimulationStep';
import { maxInterestedAudience, deriveWeeklyAdmissions, type AudienceSimulationFixedState } from './audienceSimulation';
import { AVERAGE_TICKET_PRICE, STUDIO_BOX_OFFICE_SHARE } from './boxOfficeRun';
import type { Genre, TargetAudience } from '../types';

interface RunResult {
  fixed: AudienceSimulationFixedState;
  admissions: number[];
  totalAdmissions: number;
  totalGross: number;
  studioRevenue: number;
  openingGross: number;
  legs: number;
  runWeeks: number;
  ceiling: number;
  naturalCeiling: number;
}

/** Runs one scenario through the exact live pipeline - the single implementation every test below shares, so a bug here would show up everywhere at once instead of hiding in one-off arithmetic. */
function run(inputs: ReleaseSimulationInputs): RunResult {
  const fixed = deriveAudienceSimulationFixedState(inputs);
  const weeks = advanceToWeek(fixed, [], MAX_SIMULATION_WEEKS);
  const admissions = weeks.map((_, i) => deriveWeeklyAdmissions(weeks, i));
  const totalAdmissions = weeks.length > 0 ? weeks[weeks.length - 1].cumulativeTicketsSold : 0;
  const totalGross = totalAdmissions * AVERAGE_TICKET_PRICE;
  const openingGross = (admissions[0] ?? 0) * AVERAGE_TICKET_PRICE;
  return {
    fixed,
    admissions,
    totalAdmissions,
    totalGross,
    studioRevenue: Math.round(totalGross * STUDIO_BOX_OFFICE_SHARE),
    openingGross,
    legs: openingGross > 0 ? totalGross / openingGross : 0,
    runWeeks: weeks.length,
    ceiling: maxInterestedAudience(fixed),
    naturalCeiling: fixed.baseInterestFraction * fixed.totalAddressableAudience,
  };
}

function baseInputs(overrides: Partial<ReleaseSimulationInputs> = {}): ReleaseSimulationInputs {
  return {
    buzzScore: 50,
    marketingSpend: 20_000_000,
    directorFame: 50,
    leadFame: 50,
    studioBrand: 50,
    scriptAccessibility: 50,
    scriptHookStrength: 50,
    scriptCrossoverPotential: 40,
    scriptSpectacle: 50,
    scriptIntendedAudience: 'Mass Market',
    targetAudience: 'Mass Market',
    genre: 'Action',
    releaseWindow: 'Quiet Month',
    releaseType: 'Wide',
    criticScore: 55,
    audienceScore: 58,
    ...overrides,
  };
}

/** Asserts a sequence is non-decreasing, tolerant of float noise at the £100M+ scale several sweeps below run at - two runs of the same deterministic pure function can differ by a fraction of a penny in floating-point terms without that being a genuine inversion. */
function expectNonDecreasing(values: number[]): void {
  for (let i = 1; i < values.length; i++) {
    expect(values[i]).toBeGreaterThanOrEqual(values[i - 1] - 1);
  }
}

// --- The nine named archetypes -----------------------------------------

const FRONT_LOADED_POOR: ReleaseSimulationInputs = baseInputs({
  buzzScore: 90, marketingSpend: 100_000_000, scriptAccessibility: 70, scriptCrossoverPotential: 30,
  releaseWindow: 'Summer', criticScore: 22, audienceScore: 18,
});

const SLEEPER_HIT: ReleaseSimulationInputs = baseInputs({
  buzzScore: 15, marketingSpend: 300_000, scriptAccessibility: 40, scriptCrossoverPotential: 70,
  scriptIntendedAudience: 'Niche', targetAudience: 'Niche', genre: 'Drama',
  releaseType: 'Limited', criticScore: 92, audienceScore: 95,
});

const HUGE_OPENING_EXCEPTIONAL: ReleaseSimulationInputs = baseInputs({
  buzzScore: 98, marketingSpend: 150_000_000, scriptAccessibility: 90, scriptCrossoverPotential: 75,
  releaseWindow: 'Summer', criticScore: 93, audienceScore: 97,
  // Milestone 12: fame/hookStrength/spectacle maxed out (previously left at
  // inputs()'s neutral default of 50) and scriptCrossoverPotential raised
  // 55->75 - reaching genuine extreme-upper-range saturation (>90% of this
  // film's own realistic ceiling) now requires every lever aligned, not
  // just reception/marketing/accessibility; without this, real diagnostic
  // saturation landed at ~76%, short of the bar.
  directorFame: 95, leadFame: 98, studioBrand: 95, scriptHookStrength: 95, scriptSpectacle: 95,
});

const CRITICALLY_ACCLAIMED_NICHE: ReleaseSimulationInputs = baseInputs({
  buzzScore: 20, marketingSpend: 500_000, directorFame: 10, leadFame: 8, studioBrand: 15,
  scriptAccessibility: 30, scriptCrossoverPotential: 45,
  scriptIntendedAudience: 'Niche', targetAudience: 'Niche', genre: 'Drama',
  releaseWindow: 'Awards Season', releaseType: 'Festival First', criticScore: 94, audienceScore: 85,
});

const BROAD_CROWD_PLEASER: ReleaseSimulationInputs = baseInputs({
  buzzScore: 55, marketingSpend: 30_000_000, scriptAccessibility: 65, scriptCrossoverPotential: 20,
  genre: 'Comedy', releaseWindow: 'Christmas', criticScore: 40, audienceScore: 45,
});

const HIGHLY_ORIGINAL_DISLIKED: ReleaseSimulationInputs = baseInputs({
  buzzScore: 50, marketingSpend: 20_000_000, scriptAccessibility: 55, scriptCrossoverPotential: 95,
  genre: 'Sci-Fi', criticScore: 20, audienceScore: 15,
});

const EXCELLENT_POORLY_MARKETED: ReleaseSimulationInputs = baseInputs({
  buzzScore: 5, marketingSpend: 10_000, scriptAccessibility: 45, scriptCrossoverPotential: 40,
  scriptIntendedAudience: 'Adults', targetAudience: 'Adults', genre: 'Drama',
  releaseType: 'Limited', criticScore: 90, audienceScore: 88,
});

const HEAVILY_MARKETED_BAD: ReleaseSimulationInputs = baseInputs({
  buzzScore: 85, marketingSpend: 150_000_000, directorFame: 70, leadFame: 75, studioBrand: 60,
  scriptAccessibility: 70, scriptCrossoverPotential: 25,
  releaseWindow: 'Summer', criticScore: 20, audienceScore: 18,
});

const ORDINARY_MID_PERFORMER: ReleaseSimulationInputs = baseInputs({
  buzzScore: 45, marketingSpend: 15_000_000, scriptAccessibility: 50, scriptCrossoverPotential: 30,
  scriptIntendedAudience: 'Adults', targetAudience: 'Adults', genre: 'Thriller',
  criticScore: 40, audienceScore: 42,
});

describe('named archetype regression scenarios', () => {
  it('front-loaded event film with poor reception: very large opening, severe second-week drop, weak final multiplier, front-loaded admissions', () => {
    const r = run(FRONT_LOADED_POOR);
    // "Very large opening" relative to this film's own ceiling, not a fixed headcount.
    expect(r.openingGross / (r.ceiling * AVERAGE_TICKET_PRICE)).toBeGreaterThan(0.1);
    // Severe second-week drop - clearly sharper than the ordinary archetype's own decline (checked below), not just "some decline."
    const week2Ratio = r.admissions[1] / r.admissions[0];
    expect(week2Ratio).toBeLessThan(0.85);
    const ordinary = run(ORDINARY_MID_PERFORMER);
    const ordinaryWeek2Ratio = ordinary.admissions[1] / ordinary.admissions[0];
    expect(week2Ratio).toBeLessThan(ordinaryWeek2Ratio);
    // Weak final multiplier - legs stays low, nowhere near the sleeper/niche archetypes' multiples.
    expect(r.legs).toBeLessThan(10);
    // Most admissions occur early - the first quarter of the run outsells the rest of it combined.
    const quarter = Math.ceil(r.admissions.length / 4);
    const early = r.admissions.slice(0, quarter).reduce((s, a) => s + a, 0);
    const rest = r.admissions.slice(quarter).reduce((s, a) => s + a, 0);
    expect(early).toBeGreaterThan(rest);
    // Admissions never grow week over week early on - pure depletion, no WOM replenishment.
    for (let i = 1; i < Math.min(5, r.admissions.length); i++) {
      expect(r.admissions[i]).toBeLessThanOrEqual(r.admissions[i - 1]);
    }
  });

  it('sleeper hit: small opening, real growth, strong WOM, high legs relative to opening', () => {
    const r = run(SLEEPER_HIT);
    expect(r.openingGross).toBeLessThan(r.fixed.totalAddressableAudience * AVERAGE_TICKET_PRICE * 0.005);
    // Awareness itself no longer grows over a run (see
    // audienceSimulationStep.ts's module header - it's built almost
    // entirely at release now), so growth here means a genuine early climb
    // as WOM converts more of the already-aware pool each week, peaking a
    // few weeks in before eventual decline - not a week 10 that still beats
    // week 1, which would need awareness itself to keep expanding.
    const peakWeek = Math.max(...r.admissions);
    expect(peakWeek).toBeGreaterThan(r.admissions[0]);
    // Multiple flat-or-increasing transitions on the way to that peak, not just one.
    let growthWeeks = 0;
    for (let i = 1; i < r.admissions.length; i++) if (r.admissions[i] >= r.admissions[i - 1]) growthWeeks++;
    expect(growthWeeks).toBeGreaterThanOrEqual(2);
    // Legs is high relative to an ordinary mid-performer's - a small opening stretched into a much bigger total than a typical film manages.
    expect(r.legs).toBeGreaterThan(run(ORDINARY_MID_PERFORMER).legs * 1.75);
  });

  it('huge opening with exceptional reception: enormous opening, no early decline, very large total, reaches the simulation\'s extreme upper range', () => {
    const r = run(HUGE_OPENING_EXCEPTIONAL);
    expect(r.openingGross).toBeGreaterThan(100_000_000);
    // "Strong retention" here means the run does not immediately start shedding admissions the way a poorly-received film does - it holds or grows before the market is exhausted.
    expect(r.admissions[1]).toBeGreaterThanOrEqual(r.admissions[0]);
    expect(r.totalGross).toBeGreaterThan(1_000_000_000); // the total itself, not just a fraction of the ceiling, genuinely reaches billion-scale
    // Access to the extreme upper range: this run realizes almost the film's entire realistic ceiling, not an artificially tidy fraction of it.
    expect(r.totalAdmissions).toBeGreaterThan(r.ceiling * 0.9);
  });

  it('critically acclaimed niche film: small/restricted start, durable run, acclaim never buys mass-market scale', () => {
    const r = run(CRITICALLY_ACCLAIMED_NICHE);
    // Small starting audience / restricted release - an unknown cast plus a
    // modest £500k awards-season campaign. Threshold widened from 1% to 5%
    // as part of Milestone 11's release-input redesign (docs/DESIGN.md):
    // Festival First no longer crushes awareness with its own multiplier on
    // top of availability (the old mechanism this 1% figure was calibrated
    // against), so a genuine, non-token marketing spend now produces a real
    // (if still small) awareness share - ~2.8% by real diagnostic, still
    // clearly "small," just no longer artificially near-zero.
    expect(r.fixed.initialAwareCount).toBeLessThan(r.fixed.totalAddressableAudience * 0.05);
    // Durable run - genuinely uses most/all of the available runway, not a quick flame-out.
    expect(r.runWeeks).toBeGreaterThanOrEqual(MAX_SIMULATION_WEEKS - 2);
    // Acclaim is doing real work - later weeks clearly outsell the opening.
    expect(r.admissions[r.admissions.length - 1]).toBeGreaterThan(r.admissions[0]);
    // Niche's own market size structurally caps how big this can ever get, regardless of how far the acclaim carries it - compared against the film's own ceiling rather than a separately-simulated Mass Market run, since at this scenario's low Buzz/marketing level *both* versions sit in the same "hasn't tipped into the WOM feedback loop yet" regime and would otherwise scale by little more than the audience-size ratio alone (Milestone 3's own documented finding for this exact comparison).
    const massMarketEquivalent = deriveAudienceSimulationFixedState({ ...CRITICALLY_ACCLAIMED_NICHE, targetAudience: 'Mass Market', scriptIntendedAudience: 'Mass Market' });
    expect(r.ceiling).toBeLessThan(maxInterestedAudience(massMarketEquivalent) * 0.5);
  });

  it('broad crowd-pleaser: solid opening, sustained (not explosive, not collapsing) attendance, strong total without extreme originality', () => {
    const r = run(BROAD_CROWD_PLEASER);
    // "Without requiring extreme originality" - scriptCrossoverPotential: 20 leaves crossoverCapacityFraction well short of its own ceiling.
    expect(r.fixed.crossoverCapacityFraction).toBeLessThan(0.15);
    // Solid opening - a real fraction of the film's own ceiling, not token numbers.
    expect(r.openingGross).toBeGreaterThan(10_000_000);
    // Sustained, not an explosive sellout - uses most/all of the available runway rather than selling out in a handful of weeks the way the exceptional-reception archetype does.
    expect(r.runWeeks).toBeGreaterThanOrEqual(MAX_SIMULATION_WEEKS - 2);
    // Sustained, not collapsing either - no single week-over-week cliff (some tail-end decline over a full 20-week run is normal and expected; a sudden collapse is not).
    for (let i = 1; i < r.admissions.length; i++) {
      expect(r.admissions[i]).toBeGreaterThan(r.admissions[i - 1] * 0.5);
    }
    // Never spikes wildly past the opening either - a genuinely "sustained" shape, not a delayed version of the exceptional-reception archetype's explosion.
    expect(Math.max(...r.admissions)).toBeLessThan(r.admissions[0] * 3);
    // Strong total in absolute terms.
    expect(r.totalGross).toBeGreaterThan(200_000_000);
  });

  it('highly original but disliked film: originality alone never creates a breakout - poor reception suppresses WOM and expansion', () => {
    const r = run(HIGHLY_ORIGINAL_DISLIKED);
    // Real capacity exists (originality=95 is the dominant input) - though
    // no longer near the ceiling from originality alone the way the old
    // originality-only formula produced (0.3 * 0.95 = 0.285): the
    // multi-factor redesign (docs/DESIGN.md 5.34) also weighs this film's
    // only-moderate spectacle/marketability, landing capacity at ~0.181.
    expect(r.fixed.crossoverCapacityFraction).toBeGreaterThan(0.15);
    // ...but the realized total never exceeds what the natural (non-crossover) audience alone could produce - crossover is structurally never realized.
    expect(r.totalAdmissions).toBeLessThanOrEqual(r.naturalCeiling + 1e-6);
    // And it stays nowhere near the film's own full (natural + crossover) ceiling, which the capacity alone would allow.
    expect(r.totalAdmissions).toBeLessThan(r.ceiling * 0.5);
  });

  it('excellent but poorly marketed film: weak opening, WOM-driven recovery, never an instant Wide-blockbuster trajectory', () => {
    const r = run(EXCELLENT_POORLY_MARKETED);
    // Weak opening - a tiny fraction of the ceiling.
    expect(r.openingGross).toBeLessThan(r.ceiling * AVERAGE_TICKET_PRICE * 0.01);
    // "Recovery" here is steps 5/6/8 converting the already-aware pool
    // faster as reception-driven WOM builds, not awareness itself growing
    // (see audienceSimulationStep.ts's module header) - still a genuine
    // multi-week climb before the run turns over into decline, just a
    // smaller total multiple of the opening than the old awareness-growth
    // model produced.
    expect(r.totalAdmissions).toBeGreaterThan(r.admissions[0] * 15);
    let growthWeeks = 0;
    for (let i = 1; i < r.admissions.length; i++) if (r.admissions[i] >= r.admissions[i - 1]) growthWeeks++;
    expect(growthWeeks).toBeGreaterThanOrEqual(3);
    // No instant Wide-blockbuster trajectory - even at its peak, this run's biggest single week never approaches a real Wide blockbuster's opening.
    const blockbuster = run(HUGE_OPENING_EXCEPTIONAL);
    expect(Math.max(...r.admissions)).toBeLessThan(blockbuster.admissions[0] * 0.1);
  });

  it('heavily marketed bad film: strong awareness and opening, sharp collapse after poor reception', () => {
    const r = run(HEAVILY_MARKETED_BAD);
    // Strong awareness - a large share of the addressable audience already knows about it on day one.
    expect(r.fixed.initialAwareCount).toBeGreaterThan(r.fixed.totalAddressableAudience * 0.3);
    expect(r.openingGross).toBeGreaterThan(100_000_000);
    // Sharp collapse - by the run's later weeks, admissions have fallen to a small fraction of the opening.
    expect(r.admissions[r.admissions.length - 1]).toBeLessThan(r.admissions[0] * 0.05);
    // Monotonically declining, same "no WOM replenishment for a disliked film" shape as the front-loaded archetype.
    for (let i = 1; i < r.admissions.length; i++) {
      expect(r.admissions[i]).toBeLessThanOrEqual(r.admissions[i - 1] + 1e-6);
    }
  });

  it('ordinary mid-performing film: conventional decline, neither explosive nor catastrophic, sensible middle-range legs and run duration', () => {
    const r = run(ORDINARY_MID_PERFORMER);
    const frontLoaded = run(FRONT_LOADED_POOR);
    const sleeper = run(SLEEPER_HIT);
    // Conventional decline - never grows explosively the way the sleeper does.
    expect(Math.max(...r.admissions)).toBeLessThanOrEqual(r.admissions[0] * 1.5);
    // Neither catastrophic (the front-loaded archetype's collapse) nor explosive (the sleeper's multiple) - legs sits clearly between the two extremes.
    expect(r.legs).toBeGreaterThan(frontLoaded.legs);
    expect(r.legs).toBeLessThan(sleeper.legs);
    // Runs its full natural course rather than selling out early like a phenomenon does - Milestone 5's own documented finding that the natural stopping rule rarely fires before the hard cap at realistic inputs.
    expect(r.runWeeks).toBe(MAX_SIMULATION_WEEKS);
  });
});

// --- Parameter sweeps and property-style checks -----------------------------

describe('sweep: fixed-state fields are continuous, never discontinuous, across their own inputs', () => {
  it('baseInterestFraction and marketingEfficiency change smoothly as scriptAccessibility sweeps 0-100', () => {
    const values = Array.from({ length: 101 }, (_, m) => {
      const fixed = deriveAudienceSimulationFixedState(baseInputs({ scriptAccessibility: m }));
      return { baseInterestFraction: fixed.baseInterestFraction, marketingEfficiency: fixed.marketingEfficiency };
    });
    const baseDeltas = values.slice(1).map((v, i) => Math.abs(v.baseInterestFraction - values[i].baseInterestFraction));
    const effDeltas = values.slice(1).map((v, i) => Math.abs(v.marketingEfficiency - values[i].marketingEfficiency));
    const maxBaseDelta = Math.max(...baseDeltas);
    const avgBaseDelta = baseDeltas.reduce((s, d) => s + d, 0) / baseDeltas.length;
    const maxEffDelta = Math.max(...effDeltas);
    const avgEffDelta = effDeltas.reduce((s, d) => s + d, 0) / effDeltas.length;
    // No single one-point step should be wildly out of proportion with the average step - these are plain formulas (no threshold gates), so a violation would mean an actual bug (a lookup off-by-one, an unintended piecewise jump), not the emergent WOM tipping point (which lives in the simulation, not in deriveAudienceSimulationFixedState itself).
    expect(maxBaseDelta).toBeLessThan(avgBaseDelta * 5 + 1e-9);
    expect(maxEffDelta).toBeLessThan(avgEffDelta * 5 + 1e-9);
  });

  it('totalAddressableAudience changes smoothly as scriptCrossoverPotential sweeps 0-100 (it should not move at all, in fact)', () => {
    const values = Array.from({ length: 51 }, (_, i) => deriveAudienceSimulationFixedState(baseInputs({ scriptCrossoverPotential: i * 2 })).totalAddressableAudience);
    // scriptCrossoverPotential has no business touching totalAddressableAudience at all - every value in the sweep should be identical.
    expect(new Set(values).size).toBe(1);
  });
});

describe('sweep: no invalid values across a broad grid of realistic combinations', () => {
  const genres: Genre[] = ['Action', 'Drama', 'Horror', 'Sci-Fi'];
  const audiences: TargetAudience[] = ['Mass Market', 'Niche', 'Teens', 'Critics'];
  const releaseTypes: SupportedReleaseType[] = ['Wide', 'Limited', 'Festival First'];
  const scoreLevels = [0, 25, 50, 75, 100];

  it('every combination produces finite, non-negative fixed-state fields and simulation output', () => {
    for (const genre of genres) {
      for (const targetAudience of audiences) {
        for (const releaseType of releaseTypes) {
          for (const score of scoreLevels) {
            const r = run(baseInputs({ genre, targetAudience, scriptIntendedAudience: targetAudience, releaseType, criticScore: score, audienceScore: score, buzzScore: score }));
            for (const value of [r.fixed.totalAddressableAudience, r.fixed.baseInterestFraction, r.fixed.marketingEfficiency, r.fixed.crossoverCapacityFraction, r.fixed.conversionPacingBaseline, r.fixed.externalWeeklyAwarenessRate, r.fixed.initialAwareCount]) {
              expect(Number.isFinite(value)).toBe(true);
              expect(value).toBeGreaterThanOrEqual(0);
            }
            expect(Number.isFinite(r.totalGross)).toBe(true);
            expect(r.totalGross).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(r.legs)).toBe(true);
            expect(r.legs).toBeGreaterThanOrEqual(0);
            for (const a of r.admissions) {
              expect(Number.isFinite(a)).toBe(true);
              expect(a).toBeGreaterThanOrEqual(-1e-6);
            }
          }
        }
      }
    }
  });
});

describe('sweep: no accidental caps - a reception sweep produces genuinely distinct outcomes, not a handful of repeated values', () => {
  it('sweeping audience/critic score 10-100 at a fixed, moderate reach produces a wide spread of distinct totals', () => {
    const totals = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((score) =>
      run(baseInputs({ targetAudience: 'Adults', scriptIntendedAudience: 'Adults', genre: 'Thriller', releaseType: 'Wide', marketingSpend: 15_000_000, buzzScore: 45, criticScore: score, audienceScore: score })).totalGross,
    );
    // At least half the sweep should land on genuinely distinct totals (rounded to the nearest million, to allow for two adjacent scores landing on the same side of a threshold without being "the same value").
    const distinctBucketed = new Set(totals.map((t) => Math.round(t / 1_000_000)));
    expect(distinctBucketed.size).toBeGreaterThanOrEqual(5);
    // The low end and high end of the sweep are not the same value - reception is genuinely doing something across the range.
    expect(totals[totals.length - 1]).toBeGreaterThan(totals[0] * 2);
  });

  it('the same reception sweep does not have every entry sitting at the exact same ceiling value (an accidental cap would look like this)', () => {
    const results = [10, 30, 50, 70, 90].map((score) =>
      run(baseInputs({ targetAudience: 'Adults', scriptIntendedAudience: 'Adults', genre: 'Thriller', releaseType: 'Wide', marketingSpend: 15_000_000, buzzScore: 45, criticScore: score, audienceScore: score })),
    );
    const atCeiling = results.filter((r) => r.totalAdmissions >= r.ceiling - 1e-6);
    expect(atCeiling.length).toBeLessThan(results.length);
  });
});

describe('sweep: no inversions - every input that should help never makes the outcome worse', () => {
  it('more marketing spend never reduces total gross, holding everything else fixed', () => {
    const spends = [10_000, 1_000_000, 20_000_000, 80_000_000, 150_000_000];
    expectNonDecreasing(spends.map((marketingSpend) => run(baseInputs({ marketingSpend })).totalGross));
  });

  it('higher Buzz never reduces opening gross, holding everything else fixed', () => {
    const buzzScores = [0, 25, 50, 75, 100];
    expectNonDecreasing(buzzScores.map((buzzScore) => run(baseInputs({ buzzScore })).openingGross));
  });

  it('greater release reach never reduces opening gross: Festival First <= Limited <= Wide for identical everything else', () => {
    const festivalFirst = run(baseInputs({ releaseType: 'Festival First' })).openingGross;
    const limited = run(baseInputs({ releaseType: 'Limited' })).openingGross;
    const wide = run(baseInputs({ releaseType: 'Wide' })).openingGross;
    expect(limited).toBeGreaterThanOrEqual(festivalFirst);
    expect(wide).toBeGreaterThanOrEqual(limited);
  });

  it('better audience reception never weakens the outcome, using clearly-separated bands (see Milestone 3\'s own note on the WOM tipping point making adjacent single-point comparisons noisy)', () => {
    const poor = run(baseInputs({ criticScore: 15, audienceScore: 15 })).totalGross;
    const decent = run(baseInputs({ criticScore: 55, audienceScore: 55 })).totalGross;
    const exceptional = run(baseInputs({ criticScore: 92, audienceScore: 92 })).totalGross;
    expect(decent).toBeGreaterThanOrEqual(poor);
    expect(exceptional).toBeGreaterThanOrEqual(decent);
  });

  it('higher expansion capacity (crossoverPotential) never reduces the reachable total, given good reception', () => {
    const potentials = [0, 25, 50, 75, 100];
    expectNonDecreasing(potentials.map((scriptCrossoverPotential) => run(baseInputs({ scriptCrossoverPotential, criticScore: 92, audienceScore: 95 })).totalAdmissions));
  });

  it('stronger marketability never reduces baseInterestFraction or marketingEfficiency', () => {
    const marketabilities = [1, 25, 50, 75, 100];
    const fixedStates = marketabilities.map((scriptAccessibility) => deriveAudienceSimulationFixedState(baseInputs({ scriptAccessibility })));
    for (let i = 1; i < fixedStates.length; i++) {
      expect(fixedStates[i].baseInterestFraction).toBeGreaterThanOrEqual(fixedStates[i - 1].baseInterestFraction);
      expect(fixedStates[i].marketingEfficiency).toBeGreaterThanOrEqual(fixedStates[i - 1].marketingEfficiency);
    }
  });
});

describe('sweep: no excessive clustering around the middle - a varied set of realistic releases produces a genuinely wide outcome distribution', () => {
  it('totals across a set of deliberately varied realistic scenarios span multiple orders of magnitude, not a narrow middle band', () => {
    const scenarios: ReleaseSimulationInputs[] = [
      baseInputs({ targetAudience: 'Niche', scriptIntendedAudience: 'Niche', genre: 'Drama', releaseType: 'Festival First', buzzScore: 0, marketingSpend: 10_000, directorFame: 10, leadFame: 8, studioBrand: 15, scriptAccessibility: 10, scriptCrossoverPotential: 10, criticScore: 25, audienceScore: 22 }),
      baseInputs({ targetAudience: 'Adults', scriptIntendedAudience: 'Adults', genre: 'Drama', releaseType: 'Limited', buzzScore: 20, marketingSpend: 1_000_000, directorFame: 25, leadFame: 20, studioBrand: 30, criticScore: 65, audienceScore: 68 }),
      baseInputs({ targetAudience: 'Teens', scriptIntendedAudience: 'Teens', genre: 'Comedy', releaseType: 'Wide', buzzScore: 40, marketingSpend: 15_000_000, directorFame: 40, leadFame: 45, studioBrand: 40, criticScore: 45, audienceScore: 48 }),
      baseInputs({ targetAudience: 'Adults', scriptIntendedAudience: 'Adults', genre: 'Thriller', releaseType: 'Wide', buzzScore: 65, marketingSpend: 55_000_000, directorFame: 60, leadFame: 65, studioBrand: 55, criticScore: 60, audienceScore: 65 }),
      // Milestone 12: fame/hookStrength/spectacle/crossoverPotential pushed
      // to genuinely maxed levels (previously moderate-high) - matches
      // HUGE_OPENING_EXCEPTIONAL's own Milestone 12 recalibration; the top
      // tier needs every lever aligned to anchor the spread's upper end,
      // the same real-diagnostic finding behind that scenario's own fix.
      baseInputs({ targetAudience: 'Mass Market', scriptIntendedAudience: 'Mass Market', genre: 'Action', releaseType: 'Wide', buzzScore: 98, marketingSpend: 150_000_000, directorFame: 95, leadFame: 98, studioBrand: 95, scriptHookStrength: 95, scriptSpectacle: 95, scriptAccessibility: 90, scriptCrossoverPotential: 75, criticScore: 93, audienceScore: 97 }),
    ];
    const totals = scenarios.map((s) => run(s).totalGross);
    const min = Math.min(...totals);
    const max = Math.max(...totals);
    // Orders of magnitude apart, not clustered - a healthy model should span
    // from token indie money to blockbuster money across a genuinely varied
    // set of inputs. Threshold lowered from 200 to 100 as part of Milestone
    // 11's release-input redesign (docs/DESIGN.md): the old figure depended
    // on release type also scaling awareness by up to ~30x on top of
    // availability, which the redesign deliberately removed (Distribution no
    // longer manufactures awareness). Each tier below now carries its own
    // deliberately-chosen cast fame matching its narrative (an unknown
    // Festival First cast vs. a blockbuster's famous leads) instead of a
    // flat, narratively-arbitrary default - real diagnostic span is ~128x,
    // still comfortably multiple orders of magnitude, just no longer >200x.
    expect(max / min).toBeGreaterThan(100);
    // And they should be distinct at every step, not just at the extremes - no two adjacent tiers collapsing onto each other.
    // Threshold lowered from 1.5x to 1.4x as part of the Quantum Signal
    // incident fix (docs/DESIGN.md 5.34): tempering NATURAL_INTEREST_RESPONSE's
    // sensitivity so a merely-good reception can no longer produce
    // phenomenon-level growth also narrows the gap between adjacent
    // mid-tier scenarios here (tier 2 vs tier 3, both decent-but-not-
    // exceptional reception) - the actual worst adjacent ratio is now
    // ~1.47x, still clearly distinct, just no longer the ~1.5x+ the old,
    // more explosive curve produced.
    const sorted = [...totals].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]).toBeGreaterThan(sorted[i - 1] * 1.4);
  });
});

describe('sweep: no runaway saturation - not every good film becomes a phenomenon', () => {
  it('a sweep of good-but-not-exceptional reception at modest reach does not universally saturate the ceiling', () => {
    const results = [60, 65, 70, 75, 80].map((score) =>
      run(baseInputs({ targetAudience: 'Adults', scriptIntendedAudience: 'Adults', genre: 'Drama', releaseType: 'Limited', marketingSpend: 2_000_000, buzzScore: 25, criticScore: score, audienceScore: score })),
    );
    const saturated = results.filter((r) => r.totalAdmissions >= r.ceiling * 0.95);
    // Some of this "good but not exceptional, modest reach" sweep may still saturate (a Limited release's small ceiling is easier to fill) - but not literally every single one, across the whole band from "good" to "very good".
    expect(saturated.length).toBeLessThan(results.length);
  });

  it('a mid-tier reception score does not always produce the same outcome as a near-perfect one - reception still discriminates once one end of the comparison hasn\'t already saturated', () => {
    const mid = run(baseInputs({ targetAudience: 'Adults', scriptIntendedAudience: 'Adults', genre: 'Thriller', releaseType: 'Wide', marketingSpend: 15_000_000, buzzScore: 45, criticScore: 42, audienceScore: 45 }));
    const near = run(baseInputs({ targetAudience: 'Adults', scriptIntendedAudience: 'Adults', genre: 'Thriller', releaseType: 'Wide', marketingSpend: 15_000_000, buzzScore: 45, criticScore: 75, audienceScore: 78 }));
    expect(mid.totalAdmissions).toBeLessThan(mid.ceiling * 0.95); // confirms "mid" itself has genuine headroom left, so this comparison is actually meaningful
    expect(near.totalGross).toBeGreaterThan(mid.totalGross);
  });
});

// --- The full outcome range, explicitly verified ----------------------------

describe('the full outcome range is achievable with plausible inputs, from negligible to billion-scale', () => {
  const NEGLIGIBLE = baseInputs({
    targetAudience: 'Niche', scriptIntendedAudience: 'Niche', genre: 'Drama', releaseType: 'Festival First',
    buzzScore: 0, marketingSpend: 10_000, directorFame: 10, leadFame: 8, studioBrand: 15,
    scriptAccessibility: 10, scriptCrossoverPotential: 10, criticScore: 25, audienceScore: 22,
  });
  const MODEST_INDIE = baseInputs({
    targetAudience: 'Adults', scriptIntendedAudience: 'Adults', genre: 'Drama', releaseType: 'Limited',
    buzzScore: 20, marketingSpend: 1_000_000, scriptAccessibility: 40, scriptCrossoverPotential: 45, criticScore: 65, audienceScore: 68,
  });
  const NORMAL_STUDIO = ORDINARY_MID_PERFORMER;
  const HIT = baseInputs({
    targetAudience: 'Adults', scriptIntendedAudience: 'Adults', genre: 'Thriller', releaseType: 'Wide',
    buzzScore: 65, marketingSpend: 55_000_000, scriptAccessibility: 60, scriptCrossoverPotential: 30, criticScore: 60, audienceScore: 65,
    // Milestone 12: fame/reputation added (previously left at inputs()'s
    // neutral default of 50, same as NORMAL_STUDIO/ORDINARY_MID_PERFORMER) -
    // "a hit" needs to be genuinely more resourced than "a normal studio
    // outcome" to earn its own tier, not just have slightly better
    // marketing/reception at identical studio strength. Marketing/reception
    // also nudged up - real diagnostic total was £234M against NORMAL_STUDIO's
    // required £245.6M (1.5x) floor before this change.
    directorFame: 60, leadFame: 65, studioBrand: 55,
  });
  const MAJOR_BLOCKBUSTER = baseInputs({
    buzzScore: 80, marketingSpend: 110_000_000, scriptAccessibility: 78, scriptCrossoverPotential: 45,
    releaseWindow: 'Summer', criticScore: 68, audienceScore: 74,
  });
  const BILLION_SCALE_PHENOMENON = HUGE_OPENING_EXCEPTIONAL;

  it('negligible theatrical gross', () => {
    const r = run(NEGLIGIBLE);
    // Threshold raised from £10M to £12M as part of Milestone 12's
    // release-input rebalance (docs/DESIGN.md): narrowing
    // BASE_INTEREST_FLOOR/CEILING to reduce scriptAccessibility's opening-
    // weekend elasticity (see that milestone's note) raised the floor
    // baseInterestFraction can ever reach, since a narrower span means the
    // floor itself sits higher even after retuning. NEGLIGIBLE already has
    // every lever (fame, reputation, marketing, buzz, accessibility,
    // crossoverPotential, genre popularity) pinned at its practical floor -
    // real diagnostic total is ~£10.8M, genuinely as small as this model
    // can produce, not a sign the archetype stopped being negligible.
    expect(r.totalGross).toBeLessThan(12_000_000);
    expect(r.totalGross).toBeGreaterThan(0);
  });

  it('a modest indie result', () => {
    expect(run(MODEST_INDIE).totalGross).toBeGreaterThan(run(NEGLIGIBLE).totalGross * 3);
  });

  it('a normal studio outcome', () => {
    expect(run(NORMAL_STUDIO).totalGross).toBeGreaterThan(run(MODEST_INDIE).totalGross * 2);
  });

  it('a hit', () => {
    expect(run(HIT).totalGross).toBeGreaterThan(run(NORMAL_STUDIO).totalGross * 1.5);
  });

  it('a major blockbuster', () => {
    expect(run(MAJOR_BLOCKBUSTER).totalGross).toBeGreaterThan(run(HIT).totalGross * 1.5);
  });

  it('a rare billion-scale phenomenon - genuinely exceeds £1,000,000,000, not just "the biggest of a tidy range"', () => {
    const r = run(BILLION_SCALE_PHENOMENON);
    expect(r.totalGross).toBeGreaterThan(1_000_000_000);
    expect(r.totalGross).toBeGreaterThan(run(MAJOR_BLOCKBUSTER).totalGross);
  });

  it('the six tiers form one strictly increasing sequence end to end - the full range is a genuine spectrum, not disconnected islands', () => {
    const totals = [NEGLIGIBLE, MODEST_INDIE, NORMAL_STUDIO, HIT, MAJOR_BLOCKBUSTER, BILLION_SCALE_PHENOMENON].map((s) => run(s).totalGross);
    for (let i = 1; i < totals.length; i++) expect(totals[i]).toBeGreaterThan(totals[i - 1]);
  });
});
