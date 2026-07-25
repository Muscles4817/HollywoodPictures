/**
 * Calibration harness — WHOLE-YEAR box-office distribution & profitability.
 *
 * Encodes the ratified targets in docs/DESIGN_box_office_calibration_targets.md
 * (§2 per-film, §3 whole-year, §5 profitability) as regression assertions. It
 * drives the SAME real settlement loop state/studioReducer.ts runs, headlessly
 * over several in-game years and seeds, then measures the resulting industry
 * distribution and asserts it lands in the target bands.
 *
 * It is EXPECTED TO FAIL until the funnel/scale recalibration (plan step 3) is
 * done - that is the point: the harness encodes where we're going, not where we
 * are. Opt-in (like the other diagnostics - see CLAUDE.md) so a red calibration
 * gate never blocks the normal suite mid-project:
 *
 *   BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeDistribution.diagnostic.test.ts --disable-console-intercept
 *
 * When every TARGET_* band below is satisfied, this suite goes green and the
 * whole-year shape is calibrated. All target numbers live in one block at the
 * top so ratifying/adjusting a target is a one-line edit.
 */
import { describe, it, expect } from 'vitest';
import { generateRivalStudios, settleRivalMarket, type RivalMarketUpdate } from './rivalStudios';
import { settleTheatricalMarket } from './marketSettlement';
import { generateTalentPool } from './talentGenerator';
import { settleOpportunities } from './opportunities';
import { yearOf } from './calendar';
import { withRng, type RandomFn } from './random';
import type { Film, RivalProductionInProgress, RivalStudio } from '../types';

// --- Ratified targets (edit here) ------------------------------------------
// $ figures are worldwide gross in millions. Bands are [min, max] inclusive.
const M = 1_000_000;
const TARGETS = {
  wideMedianGrossM: [90, 130] as [number, number],
  wideMeanGrossM: [170, 230] as [number, number],
  wideUnprofitablePct: [45, 55] as [number, number],
  wideOver100Pct: [40, 50] as [number, number],
  wideOver500Pct: [5, 8] as [number, number],
  wideOver1000Pct: [1, 2] as [number, number],
  top10SharePct: [40, 50] as [number, number],
  wideRunWeeks: [5, 8] as [number, number],
  limitedRunWeeks: [10, 20] as [number, number],
  wideOpeningMultiple: [2, 3] as [number, number],
  limitedOpeningMultiple: [5, 12] as [number, number],
  // §5 profitability bands, over ALL films: [min%, max%] of the field.
  bombPct: [10, 20] as [number, number], // return < 0.4x
  lossPct: [25, 35] as [number, number], // 0.4-1.0x
  breakevenPct: [8, 16] as [number, number], // 1.0-1.25x
  modestPct: [20, 30] as [number, number], // 1.25-2.5x
  majorPct: [10, 20] as [number, number], // 2.5-5x
  blockbusterPct: [1, 6] as [number, number], // > 5x
};

const YEARS = 8;
const SEEDS = 6;
const DAYS_PER_YEAR = 365;
const HORIZON = YEARS * DAYS_PER_YEAR;

interface Rec {
  grossM: number;
  returnMultiple: number;
  profitable: boolean;
  releaseType: string;
  runWeeks: number;
  openingMultiple: number;
  year: number;
}

function recordFinished(film: Film): Rec {
  const r = film.results;
  const grossM = (r.totalBoxOffice ?? film.boxOfficeRun.cumulativeGross) / M;
  const cost = Math.max(1, r.totalCost);
  const revenue = r.studioRevenue ?? 0;
  const weeks = film.boxOfficeRun.weeks;
  const opening = weeks[0]?.gross ?? 0;
  const total = film.boxOfficeRun.cumulativeGross;
  return {
    grossM,
    returnMultiple: revenue / cost,
    profitable: (r.profit ?? 0) > 0,
    releaseType: film.marketingChoices.releaseType,
    runWeeks: weeks.length,
    openingMultiple: opening > 0 ? total / opening : 0,
    year: yearOf(film.releasedOnDay),
  };
}

/** Drives the real settlement loop for one seed and returns every finished rival film. Mirrors aiStudioStats.diagnostic.test.ts:runOneSeed. */
function runOneSeed(seed: number): Rec[] {
  return withRng(seed, (rng: RandomFn) => {
    let rivalStudios: RivalStudio[] = generateRivalStudios(rng);
    let talentPool = generateTalentPool(rng);
    const initialOpp = settleOpportunities([], 1, 1, rng);
    let opportunities = initialOpp.opportunities;
    let nextOpportunityCheckDay = initialOpp.nextGenerationCheckDay;
    let productionsInProgress: RivalProductionInProgress[] = [];
    let runningFilms: Film[] = [];

    const recorded = new Set<string>();
    const out: Rec[] = [];

    for (let day = 2; day <= HORIZON; day++) {
      const marketSettlement = settleTheatricalMarket(runningFilms, [], productionsInProgress, rivalStudios, day, 20, rng);

      for (const f of marketSettlement.settledFilms) {
        if (f.releasedBy === undefined) continue;
        if (f.boxOfficeRun.status !== 'finished') continue;
        if (recorded.has(f.id)) continue;
        recorded.add(f.id);
        out.push(recordFinished(f));
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

// --- stats helpers ----------------------------------------------------------
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const share = (n: number, total: number) => (total ? (n / total) * 100 : 0);

function topNShareByYear(recs: Rec[], n: number): number {
  const byYear = new Map<number, number[]>();
  for (const r of recs) {
    const arr = byYear.get(r.year) ?? [];
    arr.push(r.grossM);
    byYear.set(r.year, arr);
  }
  const shares: number[] = [];
  for (const grosses of byYear.values()) {
    if (grosses.length < n) continue;
    const total = grosses.reduce((a, b) => a + b, 0);
    const top = [...grosses].sort((a, b) => b - a).slice(0, n).reduce((a, b) => a + b, 0);
    if (total > 0) shares.push((top / total) * 100);
  }
  return mean(shares);
}

const enabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BOX_OFFICE_DIAGNOSTIC,
);

describe.skipIf(!enabled)('box office whole-year distribution & profitability calibration', () => {
  it('lands in the ratified target bands', () => {
    const all: Rec[] = [];
    for (let s = 0; s < SEEDS; s++) all.push(...runOneSeed(4000 + s));
    const wide = all.filter((r) => r.releaseType === 'Wide');
    const limited = all.filter((r) => r.releaseType === 'Limited');

    const wideGross = wide.map((r) => r.grossM);
    const measured = {
      wideMedianGrossM: median(wideGross),
      wideMeanGrossM: mean(wideGross),
      wideUnprofitablePct: share(wide.filter((r) => !r.profitable).length, wide.length),
      wideOver100Pct: share(wide.filter((r) => r.grossM > 100).length, wide.length),
      wideOver500Pct: share(wide.filter((r) => r.grossM > 500).length, wide.length),
      wideOver1000Pct: share(wide.filter((r) => r.grossM > 1000).length, wide.length),
      top10SharePct: topNShareByYear(all, 10),
      wideRunWeeks: mean(wide.map((r) => r.runWeeks)),
      limitedRunWeeks: mean(limited.map((r) => r.runWeeks)),
      wideOpeningMultiple: mean(wide.filter((r) => r.openingMultiple > 0).map((r) => r.openingMultiple)),
      limitedOpeningMultiple: mean(limited.filter((r) => r.openingMultiple > 0).map((r) => r.openingMultiple)),
      bombPct: share(all.filter((r) => r.returnMultiple < 0.4).length, all.length),
      lossPct: share(all.filter((r) => r.returnMultiple >= 0.4 && r.returnMultiple < 1.0).length, all.length),
      breakevenPct: share(all.filter((r) => r.returnMultiple >= 1.0 && r.returnMultiple < 1.25).length, all.length),
      modestPct: share(all.filter((r) => r.returnMultiple >= 1.25 && r.returnMultiple < 2.5).length, all.length),
      majorPct: share(all.filter((r) => r.returnMultiple >= 2.5 && r.returnMultiple < 5).length, all.length),
      blockbusterPct: share(all.filter((r) => r.returnMultiple >= 5).length, all.length),
    };

    const failures: string[] = [];
    const lines: string[] = [];
    lines.push(`\nBOX OFFICE DISTRIBUTION - ${all.length} films (${wide.length} wide, ${limited.length} limited), ${SEEDS} seeds x ${YEARS}y`);
    lines.push(`  ${'metric'.padEnd(24)} ${'measured'.padStart(10)}   target`);
    for (const [key, band] of Object.entries(TARGETS)) {
      const val = (measured as Record<string, number>)[key];
      const [lo, hi] = band as [number, number];
      const ok = val >= lo && val <= hi;
      if (!ok) failures.push(`${key}: ${val.toFixed(1)} not in [${lo}, ${hi}]`);
      lines.push(`  ${(ok ? 'PASS ' : 'FAIL ')}${key.padEnd(19)} ${val.toFixed(1).padStart(10)}   [${lo}, ${hi}]`);
    }
    console.log(lines.join('\n'));
    expect(failures, `\n${failures.join('\n')}\n`).toEqual([]);
  });
});
