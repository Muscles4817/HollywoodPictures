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
 * office reads that history - there is no release-time dice roll. Today's model
 * re-scores a fixed plan almost deterministically, so this is EXPECTED TO FAIL
 * (nearly everything lands in "as expected") until execution variance is made to
 * reach the finished film (plan step 3). Opt-in, same flag as the others:
 *
 *   BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeVariance.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it, expect } from 'vitest';
import { resolveRivalProduction } from './rivalStudios';
import { settleBoxOfficeForAllFilms } from './boxOfficeRun';
import { withRng, type RandomFn } from './random';
import { captureOnePlan } from './diagnosticPlans';
import type { RivalProductionInProgress } from '../types';

// Outcome-vs-expectation bands (ratio to the plan's own median gross) and their
// target population shares (§4). Edit here to ratify.
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
  it('fixed plans produce the target spread of outcomes across execution seeds', () => {
    // Each outcome is measured against its OWN plan's median, then every plan's
    // ratios are pooled - "how far does execution move a film from what its plan
    // would typically deliver", across a population of plans.
    const ratios: number[] = [];
    const planCvs: number[] = [];
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
      planLines.push(`    plan ${planSeed}: ${plan.scale} ${plan.genre} ${plan.marketingChoices.releaseType}, median $${(med / 1_000_000).toFixed(0)}M, CV ${planCvs[planCvs.length - 1].toFixed(3)}`);
    }

    const failures: string[] = [];
    const lines: string[] = [
      `\nOUTCOME VARIANCE - ${PLAN_SEEDS.length} plans x ${EXECUTIONS_PER_PLAN} execution seeds (${ratios.length} outcomes), each relative to its own plan's median`,
      ...planLines,
      `  ${'band'.padEnd(22)} ${'share%'.padStart(7)}   target`,
    ];
    for (const b of BANDS) {
      const n = ratios.filter((r) => r >= b.lo && r < b.hi).length;
      const share = (n / ratios.length) * 100;
      const ok = share >= b.target[0] && share <= b.target[1];
      if (!ok) failures.push(`${b.name}: ${share.toFixed(1)}% not in [${b.target[0]}, ${b.target[1]}]`);
      lines.push(`  ${(ok ? 'PASS ' : 'FAIL ')}${b.name.padEnd(17)} ${share.toFixed(1).padStart(7)}   [${b.target[0]}, ${b.target[1]}]`);
    }
    // Coefficient of variation per plan - the single "is there any spread at
    // all" number. Reported as the median plan's, so one volatile plan can't
    // speak for the rest (the failure mode the single-plan gate had).
    lines.push(`  median per-plan coefficient of variation: ${median(planCvs).toFixed(3)} (near 0 = deterministic)`);
    console.log(lines.join('\n'));
    expect(failures, `\n${failures.join('\n')}\n`).toEqual([]);
  });
});
