/**
 * Calibration harness — OUTCOME VARIANCE (endogenous).
 *
 * Encodes docs/DESIGN_box_office_calibration_targets.md §4: outcomes must not be
 * deterministic. It takes ONE fixed production plan and resolves it many times,
 * letting only the production/execution path vary (engine/rivalExecution.ts -
 * how the shoot actually went), then settles each to completion and measures the
 * spread of total gross relative to the plan's own median outcome.
 *
 * This deliberately probes variance the ENDOGENOUS way the simulation philosophy
 * demands (Principle 1): the plan is fixed, the *execution* varies, and the box
 * office reads that history - there is no release-time dice roll. Today's model
 * re-scores a fixed plan almost deterministically, so this is EXPECTED TO FAIL
 * (nearly everything lands in "as expected") until execution variance is made to
 * reach the finished film (plan step 3). Opt-in, same flag as the others:
 *
 *   BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeVariance.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it, expect } from 'vitest';
import { generateRivalStudios, settleRivalMarket, resolveRivalProduction, type RivalMarketUpdate } from './rivalStudios';
import { settleTheatricalMarket } from './marketSettlement';
import { settleBoxOfficeForAllFilms } from './boxOfficeRun';
import { generateTalentPool } from './talentGenerator';
import { settleOpportunities } from './opportunities';
import { withRng, type RandomFn } from './random';
import type { Film, RivalProductionInProgress, RivalStudio } from '../types';

// Outcome-vs-expectation bands (ratio to the plan's own median gross) and their
// target population shares (§4). Edit here to ratify.
const BANDS: { name: string; lo: number; hi: number; target: [number, number] }[] = [
  { name: 'significantly under', lo: 0, hi: 0.6, target: [8, 22] }, // ~15%
  { name: 'modestly under', lo: 0.6, hi: 0.85, target: [22, 38] }, // ~30%
  { name: 'as expected', lo: 0.85, hi: 1.15, target: [22, 38] }, // ~30%
  { name: 'modestly over', lo: 1.15, hi: 1.6, target: [12, 28] }, // ~20%
  { name: 'breakout', lo: 1.6, hi: Infinity, target: [1, 12] }, // ~5%
];

const RESOLVES = 240;

/** Progress the rival market until an in-progress production exists, then return the first one as a fixed plan to stress. */
function captureOnePlan(seed: number): RivalProductionInProgress {
  return withRng(seed, (rng: RandomFn) => {
    let rivalStudios: RivalStudio[] = generateRivalStudios(rng);
    let talentPool = generateTalentPool(rng);
    const initialOpp = settleOpportunities([], 1, 1, rng);
    let opportunities = initialOpp.opportunities;
    let nextOpportunityCheckDay = initialOpp.nextGenerationCheckDay;
    let productionsInProgress: RivalProductionInProgress[] = [];
    let runningFilms: Film[] = [];

    for (let day = 2; day <= 400; day++) {
      const settle = settleTheatricalMarket(runningFilms, [], productionsInProgress, rivalStudios, day, 20, rng);
      rivalStudios = rivalStudios.map((r) => {
        const d = settle.rivalDeltas.get(r.name);
        return d ? { ...r, cash: r.cash + d.cashCredit } : r;
      });
      const opp = settleOpportunities(opportunities, nextOpportunityCheckDay, day, rng);
      const current: RivalMarketUpdate = {
        rivalStudios,
        rivalProductionsInProgress: settle.stillInProgress,
        rivalFilmsReleased: settle.settledFilms.filter((f) => f.releasedBy !== undefined),
        talentPool,
        opportunities: opp.opportunities,
      };
      const market = settleRivalMarket(current, opp.resolvedBids.filter((b) => b.winnerId !== 'player'), day, [], rng);
      rivalStudios = market.rivalStudios;
      productionsInProgress = market.rivalProductionsInProgress;
      talentPool = market.talentPool;
      opportunities = market.opportunities;
      nextOpportunityCheckDay = opp.nextGenerationCheckDay;
      runningFilms = market.rivalFilmsReleased.filter((f) => f.boxOfficeRun.status !== 'finished');
      // Prefer a Big-scale plan (the tentpole case the brief cares about).
      const big = productionsInProgress.find((p) => p.scale === 'Big');
      if (big) return big;
      if (productionsInProgress.length > 0 && day > 350) return productionsInProgress[0];
    }
    throw new Error('no rival production captured within horizon');
  }).result;
}

/** Resolve a fixed plan under one execution seed and settle its whole run (no competitors) - returns total gross. */
function grossForResolve(plan: RivalProductionInProgress, seed: number): number {
  return withRng(seed, (rng: RandomFn) => {
    const film = resolveRivalProduction(plan, 'Variance Studio', 60, [], rng);
    const settled = settleBoxOfficeForAllFilms([film], film.releasedOnDay + 200);
    const f = settled.filmsReleased.find((x) => x.id === film.id)!;
    return f.boxOfficeRun.cumulativeGross;
  }).result;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const enabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BOX_OFFICE_DIAGNOSTIC,
);

describe.skipIf(!enabled)('box office outcome variance calibration', () => {
  it('a fixed plan produces the target spread of outcomes across execution seeds', () => {
    const plan = captureOnePlan(7000);
    const grosses: number[] = [];
    for (let i = 0; i < RESOLVES; i++) grosses.push(grossForResolve(plan, 9000 + i));
    const med = median(grosses);
    const ratios = grosses.map((g) => (med > 0 ? g / med : 1));

    const failures: string[] = [];
    const lines: string[] = [
      `\nOUTCOME VARIANCE - plan ${plan.scale} ${plan.genre}, ${RESOLVES} execution seeds, median $${(med / 1_000_000).toFixed(0)}M`,
      `  ${'band'.padEnd(22)} ${'share%'.padStart(7)}   target`,
    ];
    for (const b of BANDS) {
      const n = ratios.filter((r) => r >= b.lo && r < b.hi).length;
      const share = (n / ratios.length) * 100;
      const ok = share >= b.target[0] && share <= b.target[1];
      if (!ok) failures.push(`${b.name}: ${share.toFixed(1)}% not in [${b.target[0]}, ${b.target[1]}]`);
      lines.push(`  ${(ok ? 'PASS ' : 'FAIL ')}${b.name.padEnd(17)} ${share.toFixed(1).padStart(7)}   [${b.target[0]}, ${b.target[1]}]`);
    }
    // Coefficient of variation - the single "is there any spread at all" number.
    const mean = grosses.reduce((a, b) => a + b, 0) / grosses.length;
    const sd = Math.sqrt(grosses.reduce((a, b) => a + (b - mean) ** 2, 0) / grosses.length);
    lines.push(`  coefficient of variation: ${(mean > 0 ? sd / mean : 0).toFixed(3)} (near 0 = deterministic)`);
    console.log(lines.join('\n'));
    expect(failures, `\n${failures.join('\n')}\n`).toEqual([]);
  });
});
