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
 * Prints the JSON to stdout between the sentinel lines BEGIN_TRACE_JSON and
 * END_TRACE_JSON. To capture it (the app's tsconfig has no Node types, so the
 * harness deliberately writes nothing itself):
 *
 *   BOX_OFFICE_TRACE=1 npx vitest run src/engine/boxOfficeBriefingTrace.diagnostic.test.ts \
 *     --disable-console-intercept 2>&1 \
 *     | sed -n '/BEGIN_TRACE_JSON/,/END_TRACE_JSON/p' | sed '1d;$d' > trace.json
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
import type { Film, RivalProductionInProgress, RivalStudio } from '../types';

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
  }[];
  totalBoxOffice: number;
  studioRevenue: number;
  profit: number;
  outcome: string | null;
  runWeeks: number;
}

function traceFilm(film: Film): FilmTrace {
  const r = film.results;
  const run = film.boxOfficeRun;
  const f = run.fixed;
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
    weeks: run.weeks.map((w, i) => {
      const s = run.simWeeks[i];
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
      };
    }),
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
    console.log('BEGIN_TRACE_JSON');
    console.log(JSON.stringify({ days: DAYS, runs }));
    console.log('END_TRACE_JSON');
  }, 600_000);
});
