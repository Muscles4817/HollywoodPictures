/**
 * Calibration harness — OUTCOME VARIANCE (endogenous).
 *
 * Encodes docs/DESIGN_box_office_calibration_targets.md §4: outcomes must not be
 * deterministic. It takes a set of fixed production plans and resolves each many
 * times, letting only the production/execution path vary (engine/rivalExecution.ts -
 * how the shoot actually went), then settles each to completion and measures the
 * spread of total gross relative to each plan's own median outcome, pooled.
 *
 * This deliberately probes variance the ENDOGENOUS way the simulation philosophy
 * demands (Principle 1): the plan is fixed, the *execution* varies, and the box
 * office reads that history - there is no release-time dice roll.
 *
 * WHAT IT ASSERTS (ratified 2026-11-10, docs/DESIGN_REVIEW_ambition_and_delivery.md
 * §4, option B): that SPREAD FOLLOWS REACH. Principle 1 says ambitious plans
 * should be wide and safe plans narrow, so asserting fixed pooled band shares
 * would tune against whichever plans the capture happened to pick. The gate
 * ranks the plans by how much they bet (scoring.ts:computeBetExposure, the same
 * value the planning readout shows) and asserts that the high-exposure plans
 * are wide, the low-exposure plans narrow, and exposure tracks spread. The
 * pooled band shares are still printed, as a population report. Opt-in, same
 * flag as the others:
 *
 *   BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeVariance.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it, expect } from 'vitest';
import { resolveRivalProduction } from './rivalStudios';
import { settleBoxOfficeForAllFilms } from './boxOfficeRun';
import { withRng, type RandomFn } from './random';
import { captureOnePlan } from './diagnosticPlans';
import { computeBetExposure } from './scoring';
import type { RivalProductionInProgress } from '../types';

// Outcome-vs-expectation bands (ratio to the plan's own median gross) and the
// population shares §4 originally targeted. REPORTED, not asserted (see header).
const BANDS: { name: string; lo: number; hi: number; target: [number, number] }[] = [
  { name: 'significantly under', lo: 0, hi: 0.6, target: [8, 22] }, // ~15%
  { name: 'modestly under', lo: 0.6, hi: 0.85, target: [22, 38] }, // ~30%
  { name: 'as expected', lo: 0.85, hi: 1.15, target: [22, 38] }, // ~30%
  { name: 'modestly over', lo: 1.15, hi: 1.6, target: [12, 28] }, // ~20%
  { name: 'breakout', lo: 1.6, hi: Infinity, target: [1, 12] }, // ~5%
];

// A POPULATION of plans, not one. The gate used to stress a single plan (seed
// 7000), which turned out to be the most volatile of sixteen measured: it read
// "34% breakouts" while the pooled population is 77% "as expected"
// (docs/DESIGN_REVIEW_box_office_variance_diagnosis.md §2). Seed 7000 is kept
// as the first plan so the old reading is still one of the inputs.
const PLAN_SEEDS = Array.from({ length: 16 }, (_, i) => 7000 + i);
const EXECUTIONS_PER_PLAN = 80;

// "Spread follows reach" thresholds (docs/DESIGN_REVIEW_ambition_and_delivery.md §3.1).
/** Median gross CV the most-exposed third of plans must reach - an ambitious plan is a real bet. */
const HIGH_EXPOSURE_MIN_CV = 0.2;
/** Median gross CV the least-exposed third must stay under - a safe plan is dependable. */
const LOW_EXPOSURE_MAX_CV = 0.12;
/** Minimum correlation between a plan's exposure and its spread. */
const MIN_EXPOSURE_SPREAD_CORR = 0.6;

const corr = (xs: number[], ys: number[]) => {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sx += (xs[i] - mx) ** 2;
    sy += (ys[i] - my) ** 2;
  }
  return sx > 0 && sy > 0 ? sxy / Math.sqrt(sx * sy) : 0;
};


/** Resolve a fixed plan under one execution seed and settle its whole run (no competitors) - returns total gross. */
function grossForResolve(plan: RivalProductionInProgress, seed: number): number {
  return withRng(seed, (rng: RandomFn) => {
    const film = resolveRivalProduction(plan, 'Variance Studio', 60, 0, [], rng);
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
  it('outcome spread follows the risk each plan took on', () => {
    // Each outcome is measured against its OWN plan's median, then every plan's
    // ratios are pooled - "how far does execution move a film from what its plan
    // would typically deliver", across a population of plans.
    const ratios: number[] = [];
    const planCvs: number[] = [];
    const exposures: number[] = [];
    const planLines: string[] = [];
    for (const planSeed of PLAN_SEEDS) {
      const plan = captureOnePlan(planSeed);
      const grosses: number[] = [];
      for (let i = 0; i < EXECUTIONS_PER_PLAN; i++) grosses.push(grossForResolve(plan, 9000 + i));
      const med = median(grosses);
      ratios.push(...grosses.map((g) => (med > 0 ? g / med : 1)));
      const mean = grosses.reduce((a, b) => a + b, 0) / grosses.length;
      const sd = Math.sqrt(grosses.reduce((a, b) => a + (b - mean) ** 2, 0) / grosses.length);
      planCvs.push(mean > 0 ? sd / mean : 0);
      const exposure = computeBetExposure(plan.script, plan.productionChoices, plan.genre, plan.talent).total;
      exposures.push(exposure);
      planLines.push(`    plan ${planSeed}: ${plan.scale} ${plan.genre} ${plan.marketingChoices.releaseType}, exposure ${exposure.toFixed(1).padStart(4)}, median $${(med / 1_000_000).toFixed(0)}M, CV ${planCvs[planCvs.length - 1].toFixed(3)}`);
    }

    const failures: string[] = [];
    const lines: string[] = [
      `\nOUTCOME VARIANCE - ${PLAN_SEEDS.length} plans x ${EXECUTIONS_PER_PLAN} execution seeds (${ratios.length} outcomes), each relative to its own plan's median`,
      ...planLines,
    ];

    // The assertion: spread follows reach.
    const byExposure = PLAN_SEEDS.map((_, i) => i).sort((a, b) => exposures[a] - exposures[b]);
    const third = Math.max(1, Math.floor(byExposure.length / 3));
    const lowCv = median(byExposure.slice(0, third).map((i) => planCvs[i]));
    const highCv = median(byExposure.slice(-third).map((i) => planCvs[i]));
    const r = corr(exposures, planCvs);
    const check = (ok: boolean, label: string) => {
      if (!ok) failures.push(label);
      lines.push(`  ${ok ? 'PASS' : 'FAIL'} ${label}`);
    };
    lines.push('  spread follows reach:');
    check(highCv >= HIGH_EXPOSURE_MIN_CV, `most-exposed third median CV ${highCv.toFixed(3)} >= ${HIGH_EXPOSURE_MIN_CV}`);
    check(lowCv <= LOW_EXPOSURE_MAX_CV, `least-exposed third median CV ${lowCv.toFixed(3)} <= ${LOW_EXPOSURE_MAX_CV}`);
    check(r >= MIN_EXPOSURE_SPREAD_CORR, `corr(exposure, CV) ${r.toFixed(2)} >= ${MIN_EXPOSURE_SPREAD_CORR}`);

    lines.push(`  pooled bands (reported, not asserted):`, `    ${'band'.padEnd(20)} ${'share%'.padStart(7)}   original target`);
    for (const b of BANDS) {
      const n = ratios.filter((x) => x >= b.lo && x < b.hi).length;
      const share = (n / ratios.length) * 100;
      lines.push(`    ${b.name.padEnd(20)} ${share.toFixed(1).padStart(7)}   [${b.target[0]}, ${b.target[1]}]`);
    }
    // Coefficient of variation per plan - the single "is there any spread at
    // all" number. Reported as the median plan's, so one volatile plan can't
    // speak for the rest (the failure mode the single-plan gate had).
    lines.push(`  median per-plan coefficient of variation: ${median(planCvs).toFixed(3)} (near 0 = deterministic)`);
    console.log(lines.join('\n'));
    expect(failures, `\n${failures.join('\n')}\n`).toEqual([]);
  });
});
