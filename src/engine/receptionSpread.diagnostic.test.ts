/**
 * Observational harness - DOES A PLAN'S OUTCOME SPREAD TRACK THE RISK IT TOOK ON?
 * (docs/SIMULATION_PHILOSOPHY.md Principle 1; docs/DESIGN_REVIEW_reception_model.md
 * §4 step 3 "ambition vs delivery"; docs/DESIGN_REVIEW_box_office_variance_diagnosis.md §11.)
 *
 * For each captured rival plan, resolve it under N execution seeds and report,
 * next to the plan's own risk and ambition, the spread at every stage from the
 * shoot to the box office: execution rating -> department scores -> quality ->
 * critic / audience -> gross. Shows where the spread a risky plan's shoot
 * creates is lost on the way to the finished film. No assertions.
 *
 *   BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/receptionSpread.diagnostic.test.ts --disable-console-intercept
 *   (optional: SPREAD_PLAN_SEEDS=7000,7001  SPREAD_EXECUTIONS=60)
 */
import { describe, it } from 'vitest';
import { resolveRivalProduction } from './rivalStudios';
import { settleBoxOfficeForAllFilms } from './boxOfficeRun';
import { averageProductionRisk, computeStaticProductionRisk } from './production';
import { computeExecutionProfile } from './productionExecution';
import { maxInterestedAudience, uniqueViewers } from './audienceSimulation';
import { withRng, type RandomFn } from './random';
import { captureOnePlan } from './diagnosticPlans';
import { computeSetsAmbition } from './setsFacet';
import { computeVfxAmbition } from './vfxFacet';
import { computePracticalAmbition } from './practicalFacet';
import type { RivalProductionInProgress } from '../types';

const PLAN_SEEDS = (process.env.SPREAD_PLAN_SEEDS ?? Array.from({ length: 16 }, (_, i) => 7000 + i).join(',')).split(',').map(Number);
const EXECUTIONS = Number(process.env.SPREAD_EXECUTIONS ?? 60);
const RIVAL_SCHEDULE_PRESSURE = 72; // engine/rivalExecution.ts

const sd = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
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

function resolveOnce(plan: RivalProductionInProgress, seed: number) {
  return withRng(seed, (rng: RandomFn) => {
    const film = resolveRivalProduction(plan, 'Spread Studio', 60, 0, [], rng);
    const exec = computeExecutionProfile({ events: film.events, shootingRatio: 1, talent: film.talent, productionChoices: film.productionChoices });
    const settled = settleBoxOfficeForAllFilms([film], film.releasedOnDay + 200).filmsReleased.find((x) => x.id === film.id)!;
    const sw = settled.boxOfficeRun.simWeeks;
    const r = settled.results;
    return {
      exec: exec.overall,
      events: film.events.length,
      production: r.productionScore,
      acting: r.actingScore,
      post: (r as unknown as { postProductionScore: number }).postProductionScore,
      quality: r.qualityScore,
      critic: r.criticScore,
      audience: r.audienceScore,
      gross: settled.boxOfficeRun.cumulativeGross,
      sold: sw.length ? uniqueViewers(sw[sw.length - 1]) / maxInterestedAudience(settled.boxOfficeRun.fixed) : 0,
    };
  }).result;
}

const enabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BOX_OFFICE_DIAGNOSTIC,
);

describe.skipIf(!enabled)('reception spread vs plan risk', () => {
  it('prints, per plan, risk and ambition next to the spread at each stage', () => {
    const lines = ['\nRECEPTION SPREAD - per plan, SD across execution seeds (gross as CV)'];
    lines.push(`  ${'plan'.padEnd(22)} risk orig cmplx | events  exec   prod  act  post  qual | crit  aud | grossCV  sold(med)`);
    const summary: { risk: number; ambition: number; execSd: number; qualSd: number; audSd: number; grossCv: number; sold: number }[] = [];
    for (const seed of PLAN_SEEDS) {
      const plan = captureOnePlan(seed);
      const staticRisk = computeStaticProductionRisk(plan.talent, plan.script, plan.productionChoices, plan.genre);
      const risk = averageProductionRisk({ schedulePressure: RIVAL_SCHEDULE_PRESSURE, ...staticRisk });
      const rs = Array.from({ length: EXECUTIONS }, (_, i) => resolveOnce(plan, 9000 + i));
      const col = <K extends keyof (typeof rs)[0]>(k: K) => rs.map((r) => r[k] as number);
      const gross = col('gross');
      const meanGross = gross.reduce((a, b) => a + b, 0) / gross.length;
      const row = {
        risk,
        ambition: (plan.script.originality + plan.script.complexity) / 2,
        execSd: sd(col('exec')),
        qualSd: sd(col('quality')),
        audSd: sd(col('audience')),
        grossCv: sd(gross) / Math.max(1, meanGross),
        sold: median(col('sold')),
      };
      summary.push(row);
      lines.push(
        `  ${`${seed} ${plan.scale} ${plan.genre}`.padEnd(22)} ${risk.toFixed(0).padStart(4)} ${String(plan.script.originality).padStart(4)} ${String(plan.script.complexity).padStart(5)} | ` +
          `${sd(col('events')).toFixed(1).padStart(6)} ${row.execSd.toFixed(3).padStart(6)} ${sd(col('production')).toFixed(1).padStart(5)} ${sd(col('acting')).toFixed(1).padStart(4)} ${sd(col('post')).toFixed(1).padStart(5)} ${row.qualSd.toFixed(1).padStart(5)} | ` +
          `${sd(col('critic')).toFixed(1).padStart(4)} ${row.audSd.toFixed(1).padStart(4)} | ${row.grossCv.toFixed(3).padStart(7)}  ${row.sold.toFixed(2)}  (aud med ${median(col('audience')).toFixed(0)}; ambition sets/vfx/practical ${computeSetsAmbition(plan.script).toFixed(0)}/${computeVfxAmbition(plan.genre, plan.script).toFixed(0)}/${computePracticalAmbition(plan.genre, plan.script).toFixed(0)}, spectacle ${plan.script.toneProfile.spectacle})`,
      );
    }
    const c = (a: keyof (typeof summary)[0], b: keyof (typeof summary)[0]) => corr(summary.map((s) => s[a]), summary.map((s) => s[b])).toFixed(2);
    lines.push(`\n  across plans: corr(risk, execSD) ${c('risk', 'execSd')}  corr(risk, qualSD) ${c('risk', 'qualSd')}  corr(risk, audSD) ${c('risk', 'audSd')}  corr(risk, grossCV) ${c('risk', 'grossCv')}`);
    lines.push(`                corr(ambition, qualSD) ${c('ambition', 'qualSd')}  corr(ambition, grossCV) ${c('ambition', 'grossCv')}  corr(execSD, grossCV) ${c('execSd', 'grossCv')}  corr(sold, grossCV) ${c('sold', 'grossCv')}`);
    console.log(lines.join('\n'));
  });
});
