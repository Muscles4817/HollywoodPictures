/**
 * Briefing trace harness - dumps two full in-game-year simulation runs of the
 * live theatrical market (rival studios competing on one shared calendar) as
 * machine-readable JSON, for docs/BOX_OFFICE_BRIEFING.md.
 *
 * Not an assertion suite: it produces the observational data an outside reader
 * needs to reason about the box-office model's behaviour. Opt-in like every
 * other diagnostic (CLAUDE.md):
 *
 *   BOX_OFFICE_TRACE=1 npx vitest run src/engine/boxOfficeBriefingTrace.diagnostic.test.ts --disable-console-intercept
 *
 * Prints the JSON to stdout in chunks between the sentinel lines
 * BEGIN_TRACE_JSON and END_TRACE_JSON. To capture it (the app's tsconfig has no
 * Node types, so the harness deliberately writes nothing itself):
 *
 *   BOX_OFFICE_TRACE=1 npx vitest run src/engine/boxOfficeBriefingTrace.diagnostic.test.ts \
 *     --disable-console-intercept 2>&1 \
 *     | sed -n '/BEGIN_TRACE_JSON/,/END_TRACE_JSON/p' | sed '1d;$d' | tr -d '\n' > trace.json
 *
 * Drives the SAME settlement loop state/studioReducer.ts runs, mirroring
 * boxOfficeDistribution.diagnostic.test.ts:runOneSeed.
 */
import { describe, it } from 'vitest';
import { generateRivalStudios, settleRivalMarket, type RivalMarketUpdate } from './rivalStudios';
import { settleTheatricalMarket } from './marketSettlement';
import { generateTalentPool } from './talentGenerator';
import { settleOpportunities } from './opportunities';
import { withRng, type RandomFn } from './random';
import { formatGameDateWithMonth, yearOf } from './calendar';
import { advanceOneWeekWithDiagnostics, MAX_SIMULATION_WEEKS } from './audienceSimulationStep';
import { inferStudioBrandFromMarketingEfficiency } from './audienceSimulationInputs';
import { deriveCommercialProfile, deriveMarketability } from './commercialProfile';
import { maxInterestedAudience, type AudienceSimulationFixedState, type AudienceSimulationWeekState } from './audienceSimulation';
import type { Film, RivalProductionInProgress, RivalStudio } from '../types';

/**
 * What limited ATTENDANCE this week. Deliberately only two answers: either
 * exhibition capacity clipped the week's demand, or it did not and the week
 * sold exactly what its interested pool and conversion probability produced.
 *
 *  - `exhibition`  demand met or exceeded serviceable capacity - screens bound.
 *  - `demand`      capacity was never reached; nothing external constrained it.
 */
type BindingGate = 'exhibition' | 'demand';

/**
 * What limited INTEREST GROWTH this week - a different question from attendance,
 * and the one that matters for whether a film can grow beyond its opening.
 * `deriveWomNaturalInterestGrowth` multiplies three terms, so exactly one of
 * them is the smallest:
 *
 *  - `ceiling`      remaining headroom under the natural/crossover ceilings is
 *                   the smaller pool - the film has nearly everyone it could
 *                   ever have.
 *  - `awarePool`    the aware-but-not-yet-interested pool is smaller than the
 *                   headroom - growth is waiting on reach, not on capacity.
 *  - `womStrength`  neither pool is the problem: the word-of-mouth response
 *                   itself is producing almost nothing (growth fraction under
 *                   1%), so headroom is irrelevant this week.
 */
type GrowthLimiter = 'ceiling' | 'awarePool' | 'womStrength';

// engine/audienceSimulationStep.ts:NATURAL_INTEREST_RESPONSE, mirrored here so
// the harness can recompute the growth fraction from the recorded womInfluence
// without the step module having to export its own tunables.
const NATURAL_INTEREST_THRESHOLD = 0.003;
const NATURAL_INTEREST_SENSITIVITY = 55;
/** Below this, word of mouth is producing essentially no new interest regardless of how much headroom is left. */
const NEGLIGIBLE_GROWTH_FRACTION = 0.01;

/** How a run actually stopped. `safetyCap` means MAX_SIMULATION_WEEKS ended it - the simulation never reached its own organic stopping condition, so run length is reporting the constant, not the behaviour. */
type TerminationCause = 'organic' | 'safetyCap' | 'zeroOpening';

const DAYS = 730; // two in-game years

interface FilmTrace {
  id: string;
  title: string;
  studio: string;
  genre: string;
  targetAudience: string;
  releaseType: string;
  releaseWindow: string;
  releaseDay: number;
  year: number;
  date: string;
  productionCost: number;
  marketingCost: number;
  marketingSpend: number;
  totalCost: number;
  criticScore: number;
  audienceScore: number;
  buzzScore: number;
  qualityScore: number;
  internationalReachFraction: number;
  distributionKeepShare: number | null;
  fixed: {
    totalAddressableAudience: number;
    baseInterestFraction: number;
    crossoverCapacityFraction: number;
    marketingEfficiency: number;
    conversionPacingBaseline: number;
    externalWeeklyAwarenessRate: number;
    initialAwareCount: number;
    initialAvailabilityFraction: number;
    availabilityBaseWeeklyDecay: number;
    criticLedExpansionWeight: number;
  };
  /** The screenplay's own commercial properties, as the fixed state read them - what a tail-composition analysis correlates blockbuster status against. */
  concept: {
    accessibility: number;
    hookStrength: number;
    crossoverPotential: number;
    spectacle: number;
    marketability: number;
    studioBrand: number;
  };
  weeks: {
    week: number;
    gross: number;
    domesticGross: number;
    internationalGross: number;
    competitivePressure: number;
    awareCount: number;
    interestedRemaining: number;
    cumulativeTicketsSold: number;
    availabilityFraction: number;
    cumulativeCrossoverRealized: number;
    // Recovered by replay - a stored BoxOfficeWeek keeps none of these.
    weeklyAdmissions: number;
    newlyAwareFromExternal: number;
    newlyAwareFromWom: number;
    newInterestCreated: number;
    crossoverInterestCreated: number;
    womInfluence: number;
    baselineAttendanceProbability: number;
    finalAttendanceProbability: number;
    unconstrainedDemand: number;
    maxServiceableDemand: number;
    demandUtilisation: number;
    bindingGate: BindingGate;
    growthLimiter: GrowthLimiter;
  }[];
  /** Whole-run measurements the aggregation reads - each one answers "did this film run into a wall, and which wall". */
  derived: {
    /** cumulativeTicketsSold / TAA. The single "how much of its possible audience did this film activate" number. */
    activationOfTaa: number;
    /** Peak awareCount / TAA. */
    peakAwareOfTaa: number;
    /** Of the interest the film could ever have generated, how much it actually did. 1.0 = saturated. */
    interestCeilingRealised: number;
    naturalCeilingRealised: number;
    crossoverCeilingRealised: number;
    /** Awareness gained after release day, as a fraction of the release-day seed. Scale-sensitive by construction: the external trickle is a share of the *unaware*, so a small opener can nearly double its awareness while a large one cannot. */
    postReleaseAwarenessGrowth: number;
    /** The same growth as a fraction of TAA - the scale-free version, and the one to compare across films. */
    postReleaseAwarenessOfTaa: number;
    /** Whether conversionPacingBaseline hit its clamp - i.e. the film has no pacing model at all. */
    pacingClamped: boolean;
    terminationCause: TerminationCause;
    weeksAtAvailabilityFloor: number;
    weeksAtAvailabilityCeiling: number;
    weeksOfPositiveExpansion: number;
    peakAvailabilityWeek: number;
    bindingGateWeeks: Record<BindingGate, number>;
    growthLimiterWeeks: Record<GrowthLimiter, number>;
    /** Weekly shape - the things an aggregate "mean run weeks" hides. */
    openingShareOfTotal: number;
    week2Drop: number | null;
    week3Drop: number | null;
    peakGrossWeek: number;
    legs: number;
  };
  totalBoxOffice: number;
  studioRevenue: number;
  profit: number;
  outcome: string | null;
  runWeeks: number;
}

/**
 * Re-derives a finished film's full per-week diagnostics by replaying its run.
 * The audience simulation is deterministic and every settled week stored the
 * `competitivePressure` it was actually settled with (types/index.ts:BoxOfficeWeek
 * records it precisely because it is historical fact about the rest of the
 * market, not re-derivable from this film alone) - so feeding those back in
 * order reproduces the original run exactly. Same replay the dev Outcome
 * Inspector's "As Released" view performs.
 */
function replayDiagnostics(film: Film) {
  const { fixed, weeks: stored } = film.boxOfficeRun;
  const history: AudienceSimulationWeekState[] = [];
  return stored.map((w) => {
    const { next, diagnostics } = advanceOneWeekWithDiagnostics(fixed, history, undefined, w.competitivePressure ?? 0);
    history.push(next);
    return diagnostics;
  });
}

/** Everyone who has ever been interested in this film by the end of `week` - the sum the two ceilings are measured against. */
function totalEverInterested(week: AudienceSimulationWeekState): number {
  return week.interestedRemaining + week.cumulativeTicketsSold;
}

function classifyGate(d: ReturnType<typeof replayDiagnostics>[number]): BindingGate {
  return d.demandUtilisation >= 1 ? 'exhibition' : 'demand';
}

function classifyGrowthLimiter(fixed: AudienceSimulationFixedState, d: ReturnType<typeof replayDiagnostics>[number]): GrowthLimiter {
  const excess = Math.max(0, d.womInfluence - NATURAL_INTEREST_THRESHOLD);
  const growthFraction = Math.min(1, excess * excess * NATURAL_INTEREST_SENSITIVITY);
  if (growthFraction < NEGLIGIBLE_GROWTH_FRACTION) return 'womStrength';
  const everInterested = d.interestedRemaining + d.cumulativeTicketsSold;
  const naturalCeiling = fixed.baseInterestFraction * fixed.totalAddressableAudience;
  const crossoverCeiling = fixed.crossoverCapacityFraction * fixed.totalAddressableAudience;
  const headroom = Math.max(0, naturalCeiling + crossoverCeiling - everInterested);
  const awareNotYetInterested = Math.max(0, d.awareCount - everInterested);
  return headroom <= awareNotYetInterested ? 'ceiling' : 'awarePool';
}

function terminationCause(diagnostics: ReturnType<typeof replayDiagnostics>): TerminationCause {
  const opening = diagnostics[0]?.weeklyAdmissions ?? 0;
  if (opening <= 0) return 'zeroOpening';
  const latest = diagnostics[diagnostics.length - 1]?.weeklyAdmissions ?? 0;
  // hasSimulationEnded checks the organic condition BEFORE the week cap, so a
  // run that satisfies both is organic; only a run that hit the cap without
  // ever satisfying the admissions condition is reporting the constant.
  if (latest < opening * 0.02) return 'organic';
  return diagnostics.length >= MAX_SIMULATION_WEEKS ? 'safetyCap' : 'organic';
}

function traceFilm(film: Film): FilmTrace {
  const r = film.results;
  const run = film.boxOfficeRun;
  const f = run.fixed;
  const diagnostics = replayDiagnostics(film);
  const profile = deriveCommercialProfile(film.script);

  const taa = f.totalAddressableAudience;
  const naturalCeiling = f.baseInterestFraction * taa;
  const crossoverCeiling = f.crossoverCapacityFraction * taa;
  const last = run.simWeeks[run.simWeeks.length - 1];
  const everInterested = last ? totalEverInterested(last) : 0;
  const gateWeeks: Record<BindingGate, number> = { exhibition: 0, demand: 0 };
  const limiterWeeks: Record<GrowthLimiter, number> = { ceiling: 0, awarePool: 0, womStrength: 0 };
  for (const d of diagnostics) {
    gateWeeks[classifyGate(d)] += 1;
    limiterWeeks[classifyGrowthLimiter(f, d)] += 1;
  }

  const grosses = run.weeks.map((w) => w.gross);
  const opening = grosses[0] ?? 0;
  const total = run.cumulativeGross;
  const availabilities = run.simWeeks.map((w) => w.availabilityFraction);
  let positiveExpansion = 0;
  for (let i = 1; i < availabilities.length; i++) if (availabilities[i] > availabilities[i - 1]) positiveExpansion += 1;
  const peakAvailability = availabilities.reduce((best, v, i) => (v > availabilities[best] ? i : best), 0);
  const peakGross = grosses.reduce((best, v, i) => (v > grosses[best] ? i : best), 0);
  const awarenessAfterRelease = last ? last.awareCount - f.initialAwareCount : 0;

  return {
    id: film.id,
    title: film.title,
    studio: film.releasedBy ?? 'PLAYER',
    genre: film.genre,
    targetAudience: film.targetAudience,
    releaseType: film.marketingChoices.releaseType,
    releaseWindow: film.marketingChoices.releaseWindow,
    releaseDay: film.releasedOnDay,
    year: yearOf(film.releasedOnDay),
    date: formatGameDateWithMonth(film.releasedOnDay),
    productionCost: Math.round(r.productionCost),
    marketingCost: Math.round(r.marketingCost),
    marketingSpend: Math.round(film.marketingChoices.marketingSpend),
    totalCost: Math.round(r.totalCost),
    criticScore: round2(r.criticScore),
    audienceScore: round2(r.audienceScore),
    buzzScore: round2(r.buzzScore),
    qualityScore: round2(r.qualityScore),
    internationalReachFraction: r.internationalReachFraction ?? 0,
    distributionKeepShare: r.distributionKeepShare ?? null,
    fixed: {
      totalAddressableAudience: Math.round(f.totalAddressableAudience),
      baseInterestFraction: round4(f.baseInterestFraction),
      crossoverCapacityFraction: round4(f.crossoverCapacityFraction),
      marketingEfficiency: round4(f.marketingEfficiency),
      conversionPacingBaseline: round4(f.conversionPacingBaseline),
      externalWeeklyAwarenessRate: round4(f.externalWeeklyAwarenessRate),
      initialAwareCount: Math.round(f.initialAwareCount),
      initialAvailabilityFraction: round4(f.initialAvailabilityFraction),
      availabilityBaseWeeklyDecay: round4(f.availabilityBaseWeeklyDecay),
      criticLedExpansionWeight: round4(f.criticLedExpansionWeight),
    },
    concept: {
      accessibility: round2(profile.accessibility),
      hookStrength: round2(profile.hookStrength),
      crossoverPotential: round2(profile.crossoverPotential),
      spectacle: round2(film.script.toneProfile.spectacle),
      marketability: round2(deriveMarketability(film.script)),
      studioBrand: round2(inferStudioBrandFromMarketingEfficiency(f.marketingEfficiency)),
    },
    weeks: run.weeks.map((w, i) => {
      const s = run.simWeeks[i];
      const d = diagnostics[i];
      return {
        week: w.week,
        gross: w.gross,
        domesticGross: w.domesticGross ?? 0,
        internationalGross: w.internationalGross ?? 0,
        competitivePressure: round4(w.competitivePressure ?? 0),
        awareCount: s ? Math.round(s.awareCount) : 0,
        interestedRemaining: s ? Math.round(s.interestedRemaining) : 0,
        cumulativeTicketsSold: s ? Math.round(s.cumulativeTicketsSold) : 0,
        availabilityFraction: s ? round4(s.availabilityFraction) : 0,
        cumulativeCrossoverRealized: s ? Math.round(s.cumulativeCrossoverRealized) : 0,
        weeklyAdmissions: Math.round(d.weeklyAdmissions),
        newlyAwareFromExternal: Math.round(d.newlyAwareFromExternal),
        newlyAwareFromWom: Math.round(d.newlyAwareFromWom),
        newInterestCreated: Math.round(d.newInterestCreated),
        crossoverInterestCreated: Math.round(d.crossoverInterestCreated),
        womInfluence: round4(d.womInfluence),
        baselineAttendanceProbability: round4(d.baselineAttendanceProbability),
        finalAttendanceProbability: round4(d.finalAttendanceProbability),
        unconstrainedDemand: Math.round(d.unconstrainedDemand),
        maxServiceableDemand: Math.round(d.maxServiceableDemand),
        demandUtilisation: round4(d.demandUtilisation),
        bindingGate: classifyGate(d),
        growthLimiter: classifyGrowthLimiter(f, d),
      };
    }),
    derived: {
      activationOfTaa: round4(last ? last.cumulativeTicketsSold / taa : 0),
      peakAwareOfTaa: round4(last ? last.awareCount / taa : 0),
      interestCeilingRealised: round4(maxInterestedAudience(f) > 0 ? everInterested / maxInterestedAudience(f) : 0),
      naturalCeilingRealised: round4(naturalCeiling > 0 ? (everInterested - (last?.cumulativeCrossoverRealized ?? 0)) / naturalCeiling : 0),
      crossoverCeilingRealised: round4(crossoverCeiling > 0 ? (last?.cumulativeCrossoverRealized ?? 0) / crossoverCeiling : 0),
      postReleaseAwarenessGrowth: round4(f.initialAwareCount > 0 ? awarenessAfterRelease / f.initialAwareCount : 0),
      postReleaseAwarenessOfTaa: round4(awarenessAfterRelease / taa),
      pacingClamped: f.conversionPacingBaseline >= 0.9999,
      terminationCause: terminationCause(diagnostics),
      weeksAtAvailabilityFloor: availabilities.filter((v) => v <= 0.0201).length,
      weeksAtAvailabilityCeiling: availabilities.filter((v) => v >= 0.9999).length,
      weeksOfPositiveExpansion: positiveExpansion,
      peakAvailabilityWeek: peakAvailability + 1,
      bindingGateWeeks: gateWeeks,
      growthLimiterWeeks: limiterWeeks,
      openingShareOfTotal: round4(total > 0 ? opening / total : 0),
      week2Drop: grosses.length > 1 && opening > 0 ? round4(1 - grosses[1] / opening) : null,
      week3Drop: grosses.length > 2 && grosses[1] > 0 ? round4(1 - grosses[2] / grosses[1]) : null,
      peakGrossWeek: peakGross + 1,
      legs: round2(opening > 0 ? total / opening : 0),
    },
    totalBoxOffice: r.totalBoxOffice ?? run.cumulativeGross,
    studioRevenue: r.studioRevenue ?? 0,
    profit: r.profit ?? 0,
    outcome: r.outcome ?? null,
    runWeeks: run.weeks.length,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

function runOneSeed(seed: number): FilmTrace[] {
  return withRng(seed, (rng: RandomFn) => {
    let rivalStudios: RivalStudio[] = generateRivalStudios(rng);
    let talentPool = generateTalentPool(rng);
    const initialOpp = settleOpportunities([], 1, 1, rng);
    let opportunities = initialOpp.opportunities;
    let nextOpportunityCheckDay = initialOpp.nextGenerationCheckDay;
    let productionsInProgress: RivalProductionInProgress[] = [];
    let runningFilms: Film[] = [];

    const recorded = new Set<string>();
    const out: FilmTrace[] = [];

    for (let day = 2; day <= DAYS; day++) {
      const marketSettlement = settleTheatricalMarket(runningFilms, [], productionsInProgress, rivalStudios, day, 20, rng);

      for (const f of marketSettlement.settledFilms) {
        if (f.releasedBy === undefined) continue;
        if (f.boxOfficeRun.status !== 'finished') continue;
        if (recorded.has(f.id)) continue;
        recorded.add(f.id);
        out.push(traceFilm(f));
      }

      rivalStudios = rivalStudios.map((rival) => {
        const delta = marketSettlement.rivalDeltas.get(rival.name);
        if (!delta) return rival;
        return {
          ...rival,
          cash: rival.cash + delta.cashCredit,
          brand: Math.max(0, Math.min(100, rival.brand + delta.brandDelta)),
          prestige: Math.max(0, Math.min(100, rival.prestige + delta.prestigeDelta)),
          lifetimeRevenue: rival.lifetimeRevenue + delta.cashCredit,
        };
      });

      const oppSettlement = settleOpportunities(opportunities, nextOpportunityCheckDay, day, rng);
      const rivalBids = oppSettlement.resolvedBids.filter((b) => b.winnerId !== 'player');
      const current: RivalMarketUpdate = {
        rivalStudios,
        rivalProductionsInProgress: marketSettlement.stillInProgress,
        rivalFilmsReleased: marketSettlement.settledFilms.filter((f) => f.releasedBy !== undefined),
        talentPool,
        opportunities: oppSettlement.opportunities,
      };
      const rivalMarket = settleRivalMarket(current, rivalBids, day, [], rng);

      rivalStudios = rivalMarket.rivalStudios;
      productionsInProgress = rivalMarket.rivalProductionsInProgress;
      talentPool = rivalMarket.talentPool;
      opportunities = rivalMarket.opportunities;
      nextOpportunityCheckDay = oppSettlement.nextGenerationCheckDay;
      runningFilms = rivalMarket.rivalFilmsReleased.filter((f) => f.boxOfficeRun.status !== 'finished');
    }
    return out;
  }).result;
}

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const enabled = Boolean(env.BOX_OFFICE_TRACE);

describe.skipIf(!enabled)('box office briefing trace', () => {
  it('dumps two simulated years of the theatrical market', () => {
    const runs = [
      { seed: 4001, films: runOneSeed(4001) },
      { seed: 7302, films: runOneSeed(7302) },
    ];
    for (const r of runs) {
      console.log(`seed ${r.seed}: ${r.films.length} finished films over ${DAYS} days`);
    }
    // Emitted in fixed-size chunks, one console.log each: the whole payload is
    // well past the runner's per-message cap and a single log call comes back
    // silently truncated. Reassemble by stripping the newlines between the
    // sentinels (see the header for the exact command).
    const payload = JSON.stringify({ days: DAYS, runs });
    const CHUNK = 4000;
    console.log('BEGIN_TRACE_JSON');
    for (let i = 0; i < payload.length; i += CHUNK) console.log(payload.slice(i, i + CHUNK));
    console.log('END_TRACE_JSON');
  }, 600_000);
});
