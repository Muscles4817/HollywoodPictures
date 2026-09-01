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
import { ancillaryAttributesFromFilm, deriveAncillaryProfile } from './ancillary';
import { withRng, type RandomFn } from './random';
import type { Film, RivalProductionInProgress, RivalStudio } from '../types';

// --- Ratified targets (edit here) ------------------------------------------
// $ figures are worldwide gross in millions. Bands are [min, max] inclusive.
const M = 1_000_000;
// v2, ratified: DESIGN_box_office_calibration_targets_v2_draft.md §3 and §6.
// Every profitability figure below is now measured on the WHOLE P&L - theatrical
// rentals PLUS post-theatrical revenue - against all-in cost. The v1 bands were
// asserted against FilmResults.profit, which counts theatrical rentals only,
// i.e. against roughly half of what a film actually earns (§1 of that document).
const TARGETS = {
  wideMedianGrossM: [120, 190] as [number, number],
  wideMeanGrossM: [200, 300] as [number, number],
  wideUnprofitablePct: [40, 52] as [number, number],
  wideOver100Pct: [45, 60] as [number, number],
  wideOver500Pct: [6, 12] as [number, number],
  wideOver1000Pct: [1, 3] as [number, number],
  top10SharePct: [34, 44] as [number, number],
  wideRunWeeks: [5, 8] as [number, number],
  limitedRunWeeks: [10, 20] as [number, number],
  wideOpeningMultiple: [2, 3] as [number, number],
  limitedOpeningMultiple: [5, 12] as [number, number],
  // §3 profitability bands, over WIDE releases: [min%, max%] of the field. Derived
  // from the 12-film studio slate in docs/domain/11 §5.4 - a much fatter middle
  // and thinner tails than v1 assumed, because P&A scales with ambition: on that
  // slate the $1.1B franchise sequel returns 1.81x, LESS than the $15M horror's
  // 2.42x, and nothing returns above 2.5x at all.
  //
  // Asserted over WIDE releases, where v1 asserted over the whole field. The
  // reference is a studio slate of twelve wide releases; this game's field is
  // roughly half platform and festival titles, whose economics the reference
  // says nothing about and whose returns are much more dispersed (a limited
  // release carries no campaign floor, so it neither bombs the same way nor
  // breaks even the same way). Measured over the mixed field the same model
  // reads 22% bombs and 5% break-even; over wide releases alone, which is what
  // the reference actually describes, it reads far closer to the slate's shape.
  // The all-films figures are still printed below, just not asserted.
  bombPct: [5, 12] as [number, number], // return < 0.4x
  lossPct: [30, 42] as [number, number], // 0.4-1.0x
  breakevenPct: [18, 30] as [number, number], // 1.0-1.25x
  modestPct: [18, 30] as [number, number], // 1.25-2.5x
  majorPct: [4, 10] as [number, number], // 2.5-5x
  blockbusterPct: [1, 4] as [number, number], // > 5x
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
  const gross = r.totalBoxOffice ?? film.boxOfficeRun.cumulativeGross;
  const grossM = gross / M;
  const cost = Math.max(1, r.totalCost);
  // The WHOLE P&L. FilmResults.profit/studioRevenue are theatrical rentals only;
  // state/ancillarySettlement.ts separately pays post-theatrical revenue to both
  // the player and rivals, worth ~45% of rentals. Asserting profitability
  // against rentals alone measured roughly half a film's earnings, which is what
  // v2 of the targets exists to correct. Studio prestige is not knowable from a
  // rival film and moves the multipliers only modestly, so the midpoint keeps
  // this a property of the film; this harness runs no awards season, so awards
  // are zero.
  const ancillary = deriveAncillaryProfile(
    ancillaryAttributesFromFilm(film, { studioPrestige: 50, awards: { wins: 0, nominations: 0 } }),
    gross,
  ).lifetimeTotal;
  const revenue = (r.studioRevenue ?? 0) + ancillary;
  const weeks = film.boxOfficeRun.weeks;
  const opening = weeks[0]?.gross ?? 0;
  const total = film.boxOfficeRun.cumulativeGross;
  return {
    grossM,
    returnMultiple: revenue / cost,
    profitable: revenue > cost,
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
      bombPct: share(wide.filter((r) => r.returnMultiple < 0.4).length, wide.length),
      lossPct: share(wide.filter((r) => r.returnMultiple >= 0.4 && r.returnMultiple < 1.0).length, wide.length),
      breakevenPct: share(wide.filter((r) => r.returnMultiple >= 1.0 && r.returnMultiple < 1.25).length, wide.length),
      modestPct: share(wide.filter((r) => r.returnMultiple >= 1.25 && r.returnMultiple < 2.5).length, wide.length),
      majorPct: share(wide.filter((r) => r.returnMultiple >= 2.5 && r.returnMultiple < 5).length, wide.length),
      blockbusterPct: share(wide.filter((r) => r.returnMultiple >= 5).length, wide.length),
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
    // Reported, never asserted: the same profitability shape over the whole
    // mixed field, so the wide-only basis above stays visible as a choice.
    const bandShare = (lo: number, hi: number) => share(all.filter((r) => r.returnMultiple >= lo && r.returnMultiple < hi).length, all.length);
    lines.push(
      `  (all films, incl. limited/festival - reported only: bomb ${bandShare(0, 0.4).toFixed(1)}% loss ${bandShare(0.4, 1).toFixed(1)}% ` +
        `breakeven ${bandShare(1, 1.25).toFixed(1)}% modest ${bandShare(1.25, 2.5).toFixed(1)}% major ${bandShare(2.5, 5).toFixed(1)}% blockbuster ${bandShare(5, Infinity).toFixed(1)}%)`,
    );
    console.log(lines.join('\n'));
    expect(failures, `\n${failures.join('\n')}\n`).toEqual([]);
  });
});
