/**
 * Observational harness - the ANATOMY of a fixed plan's outcome spread
 * (docs/DESIGN_REVIEW_box_office_variance_diagnosis.md).
 *
 * boxOfficeVariance.diagnostic.test.ts asserts the band shares for ONE plan;
 * this explains them. For each plan seed it resolves the same rival production
 * under N execution seeds and buckets the outcomes by ratio-to-median, printing
 * what differs between the buckets (scores, buzz, opening, run length, peak
 * word-of-mouth, realised crossover, share of the reachable audience actually
 * sold), plus the median ratio by audience-score bucket - which is where the
 * S-curve shows. No assertions.
 *
 *   BOX_OFFICE_DIAGNOSTIC=1 PLAN_SEEDS=7000,7001,7002 N=120 \
 *     npx vitest run src/engine/boxOfficeVarianceAnatomy.diagnostic.test.ts --disable-console-intercept
 *
 * captureOnePlan is copied from boxOfficeVariance.diagnostic.test.ts so the two
 * capture the same plan for the same seed (7000 is the gate's plan).
 */
import { describe, it } from 'vitest';
import { resolveRivalProduction } from './rivalStudios';
import { settleBoxOfficeForAllFilms } from './boxOfficeRun';
import { withRng, type RandomFn } from './random';
import { captureOnePlan } from './diagnosticPlans';
import { advanceToWeekWithDiagnostics, MAX_SIMULATION_WEEKS } from './audienceSimulationStep';
import { maxInterestedAudience } from './audienceSimulation';
import type { RivalProductionInProgress } from '../types';



const PLAN_SEEDS = (process.env.PLAN_SEEDS ?? '7000').split(',').map(Number);
const N = Number(process.env.N ?? 240);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function probe(plan: RivalProductionInProgress, seed: number) {
  return withRng(seed, (rng: RandomFn) => {
    const film = resolveRivalProduction(plan, 'Variance Studio', 60, 0, [], rng);
    const settled = settleBoxOfficeForAllFilms([film], film.releasedOnDay + 200);
    const f = settled.filmsReleased.find((x) => x.id === film.id)!;
    const fx = f.boxOfficeRun.fixed;
    const { diagnostics } = advanceToWeekWithDiagnostics(fx, [], MAX_SIMULATION_WEEKS);
    const peakWom = Math.max(...diagnostics.map((d) => d.womInfluence));
    const last = diagnostics[diagnostics.length - 1];
    return {
      gross: f.boxOfficeRun.cumulativeGross, critic: f.results.criticScore, aud: f.results.audienceScore, buzz: f.results.buzzScore,
      open: f.boxOfficeRun.weeks[0]?.gross ?? 0, weeks: f.boxOfficeRun.weeks.length, peakWom,
      crossShare: last.cumulativeCrossoverRealized / maxInterestedAudience(fx), events: f.events.length,
      soldShare: last.cumulativeTicketsSold / maxInterestedAudience(fx),
      fixedCritic: fx.criticScore, fixedAud: fx.audienceScore,
    };
  }).result;
}

const enabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BOX_OFFICE_DIAGNOSTIC,
);

describe.skipIf(!enabled)('box office outcome variance - anatomy', () => {
  it('prints what separates a plan\'s outcome buckets', () => {
    const pooled: number[] = [];
    for (const ps of PLAN_SEEDS) {
      const plan = captureOnePlan(ps);
      const rs = Array.from({ length: N }, (_, i) => probe(plan, 9000 + i));
      const med = median(rs.map((r) => r.gross));
      const rows = rs.map((r) => ({ ...r, ratio: r.gross / med })).sort((a, b) => a.ratio - b.ratio);
      pooled.push(...rows.map((r) => r.ratio));
      console.log(`\nPLAN seed ${ps}: ${plan.scale} ${plan.genre} ${plan.marketingChoices.releaseType}, median $${(med / 1e6).toFixed(0)}M`);
      const hist = [0, 0.6, 0.85, 1.15, 1.6, 2, 3, 5, 100];
      for (let i = 0; i < hist.length - 1; i++) {
        const b = rows.filter((r) => r.ratio >= hist[i] && r.ratio < hist[i + 1]);
        if (!b.length) { console.log(`  [${hist[i]}, ${hist[i + 1]}) 0`); continue; }
        const m = (k: string) => median(b.map((r) => (r as unknown as Record<string, number>)[k]));
        console.log(`  [${hist[i]}, ${hist[i + 1]}) n=${String(b.length).padStart(3)} critic ${m('critic').toFixed(0)} aud ${m('aud').toFixed(0)} buzz ${m('buzz').toFixed(0)} open $${(m('open') / 1e6).toFixed(0)}M wks ${m('weeks')} peakWom ${m('peakWom').toFixed(3)} cross ${m('crossShare').toFixed(3)} sold/ceil ${m('soldShare').toFixed(2)} events ${m('events')}`);
      }
      const pct = (p: number) => rows[Math.floor((rows.length - 1) * p)].ratio.toFixed(2);
      console.log(`  ratio p5 ${pct(0.05)} p25 ${pct(0.25)} p50 ${pct(0.5)} p75 ${pct(0.75)} p95 ${pct(0.95)}`);
      const byAud = new Map<number, number[]>();
      for (const r of rows) { const k = Math.floor(r.aud / 3) * 3; byAud.set(k, [...(byAud.get(k) ?? []), r.ratio]); }
      console.log('  aud bucket -> median ratio: ' + [...byAud.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${median(v).toFixed(2)}(n${v.length})`).join('  '));
    }
    // What boxOfficeVariance's bands would read pooled over every plan here,
    // each outcome taken relative to its OWN plan's median.
    const bands: [string, number, number][] = [['significantly under', 0, 0.6], ['modestly under', 0.6, 0.85], ['as expected', 0.85, 1.15], ['modestly over', 1.15, 1.6], ['breakout', 1.6, Infinity]];
    console.log(`\nPOOLED over ${PLAN_SEEDS.length} plans (${pooled.length} outcomes): ` + bands.map(([name, lo, hi]) => `${name} ${((pooled.filter((r) => r >= lo && r < hi).length / pooled.length) * 100).toFixed(1)}%`).join(' | '));
  });
});
