// Pre-production shape harness (docs/IMPLEMENTATION_PLAN_preproduction_realism.md
// Phase 7; design §7). Observational: runs the real prep engine headless over a
// population of films and prints what it does - prep length by film kind,
// problems generated / found / fixed / carried by front, shoot days lost and
// money over to carried problems, and what prep costs against the negative -
// for comparison with docs/domain/03 §13 and 04 §1, §16. No assertions.
//
//   PREP_DIAGNOSTIC=1 npx vitest run src/engine/prep.diagnostic.test.ts --disable-console-intercept
//   env: N=300 SKILLS=20,50,80 LENGTH=1
import { describe, it } from 'vitest';
import { buildReadyDraft } from '../state/testFixtures';
import { createRng, withRng } from './random';
import { generateScriptOptions } from './scriptGenerator';
import { GENRES } from '../data/genres';
import { PREP_FRONTS, PREP_PROBLEMS } from '../data/prep';
import { derivePrepDemands } from './prep/demands';
import { buildPrepContext } from './prep/context';
import { createPreProduction, runPrepHeadless } from './prep/run';
import { carriedIncidentsFor, incidentEvent } from './prep/handoff';
import { computeDailyPrepBurn, computeDailyShootBurn, draftNegativeCost } from './cost';
import { computeRecommendedPreProductionDays, computeRecommendedShootDays } from './production';
import type { FilmDraft } from '../types';

const RUN = process.env.PREP_DIAGNOSTIC === '1';
const N = Number(process.env.N ?? 300);
const SKILLS = (process.env.SKILLS ?? '20,50,80').split(',').map(Number);
const LENGTH = Number(process.env.LENGTH ?? 1);

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))] ?? 0;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

function films(): FilmDraft[] {
  const out: FilmDraft[] = [];
  const rng = createRng(4242);
  for (let i = 0; out.length < N; i++) {
    const base = withRng(1000 + i, (r) => buildReadyDraft(r)).result;
    const script = generateScriptOptions(GENRES[i % GENRES.length], rng, 1)[0];
    out.push({ ...base, script, genre: script.genre });
  }
  return out;
}

describe.skipIf(!RUN)('pre-production shape', () => {
  it('reports', () => {
    const population = films();
    for (const skill of SKILLS) {
      const byScale: Record<string, number[]> = {};
      const gen: Record<string, number> = {};
      const found: Record<string, number> = {};
      const fixed: Record<string, number> = {};
      const carried: Record<string, number> = {};
      const lostShare: number[] = [];
      const overShare: number[] = [];
      const quality: number[] = [];
      const prepShare: number[] = [];
      const fixShare: number[] = [];
      const fixKinds: Record<string, number> = {};
      const lostByFront: Record<string, number> = {};
      for (const [i, d] of population.entries()) {
        const script = d.script!;
        const choices = d.productionChoices!;
        const demands = derivePrepDemands({ script, talent: d.talent, choices });
        const prepDays = Math.round(computeRecommendedPreProductionDays(d.talent, script, choices) * LENGTH);
        const shootDays = computeRecommendedShootDays(d.talent, script, choices);
        const shootBurn = computeDailyShootBurn(choices.shootingBudgetAmount, shootDays);
        const ctxBase = buildPrepContext({ talent: d.talent, genre: d.genre, team: null, dailyShootBurn: shootBurn, dailyPrepBurn: computeDailyPrepBurn(shootBurn), shootDays, contingencyAvailable: choices.contingencyReserveAmount ?? 0, cashPressure: 0.3 });
        const ctx = { ...ctxBase, ownerSkill: Object.fromEntries(Object.entries(ctxBase.ownerSkill).map(([k]) => [k, skill])) as typeof ctxBase.ownerSkill, reliability: skill };
        const start = createPreProduction({ demands, plan: { lengthFactor: LENGTH, activities: null, delegated: true }, prepDays, seed: 9000 + i, team: null, status: 'in-progress', difficultLead: false });
        const run = runPrepHeadless(start, ctx, { skill, seed: 9000 + i });
        (byScale[script.scale] ??= []).push(run.prep.recommendedDays / 7);
        for (const p of run.prep.problems) {
          gen[p.front] = (gen[p.front] ?? 0) + 1;
          if (p.foundOnDay !== null) found[p.front] = (found[p.front] ?? 0) + 1;
          if (p.resolution && p.resolution.option !== 'carry') {
            fixed[p.front] = (fixed[p.front] ?? 0) + 1;
            fixKinds[p.resolution.option] = (fixKinds[p.resolution.option] ?? 0) + 1;
          }
        }
        const incidents = carriedIncidentsFor(run.prep, shootDays).map((inc) => ({ inc, e: incidentEvent(inc, shootBurn) }));
        for (const { inc, e } of incidents) {
          carried[PREP_PROBLEMS[inc.kind].front] = (carried[PREP_PROBLEMS[inc.kind].front] ?? 0) + 1;
          lostByFront[PREP_PROBLEMS[inc.kind].front] = (lostByFront[PREP_PROBLEMS[inc.kind].front] ?? 0) + e.delayDaysDelta;
        }
        lostShare.push(incidents.reduce((s, x) => s + x.e.delayDaysDelta, 0) / shootDays);
        overShare.push(incidents.reduce((s, x) => s + x.e.costDelta, 0) / choices.shootingBudgetAmount);
        quality.push(incidents.reduce((s, x) => s + x.e.qualityDelta, 0) + run.prep.events.reduce((s, e) => s + e.qualityDelta, 0));
        const negative = draftNegativeCost(d);
        prepShare.push((run.prep.runningCost - run.prep.fixSpend) / negative);
        fixShare.push(run.prep.fixSpend / negative);
      }
      console.log(`\n=== owners' skill ${skill}, prep length x${LENGTH}, ${population.length} films ===`);
      for (const [scale, w] of Object.entries(byScale)) console.log(`prep weeks ${scale.padEnd(8)} n=${w.length} p10 ${q(w, 0.1).toFixed(1)} p50 ${q(w, 0.5).toFixed(1)} p90 ${q(w, 0.9).toFixed(1)}`);
      console.log('front        generated/film  found  answered(not carry)  carried(any residual)  shoot-days-lost/film');
      for (const f of PREP_FRONTS) {
        const g = gen[f] ?? 0;
        console.log(`${f.padEnd(12)} ${(g / population.length).toFixed(2).padStart(6)}       ${pct((found[f] ?? 0) / Math.max(1, g)).padStart(6)} ${pct((fixed[f] ?? 0) / Math.max(1, g)).padStart(6)} ${pct((carried[f] ?? 0) / Math.max(1, g)).padStart(6)}   ${((lostByFront[f] ?? 0) / population.length).toFixed(2)}`);
      }
      console.log(`fixes taken: ${JSON.stringify(fixKinds)}`);
      console.log(`shoot days lost to carried problems: mean ${pct(mean(lostShare))} p50 ${pct(q(lostShare, 0.5))} p90 ${pct(q(lostShare, 0.9))} (03 §13: short prep 3-10% over)`);
      console.log(`money over from carried problems:    mean ${pct(mean(overShare))} of shooting budget, p90 ${pct(q(overShare, 0.9))}`);
      console.log(`quality left on the film (event units): mean ${mean(quality).toFixed(1)} p10 ${q(quality, 0.1).toFixed(1)}`);
      console.log(`prep burn / negative: mean ${pct(mean(prepShare))}   fix spend / negative: mean ${pct(mean(fixShare))}`);
    }
  });
});
