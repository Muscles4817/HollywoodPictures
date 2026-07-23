/**
 * Empirical diagnostic for Production Execution (Phase 1). Simulates many
 * player-style shoots headlessly - the real risk model + real per-day event
 * rolls (engine/production.ts) - then scores each film twice: once with the
 * recorded execution history, once with a neutral profile (the counterfactual
 * "execution doesn't matter" world). Reports whether execution actually widened
 * the distribution, made downside real, kept upside possible, and whether
 * reliability mitigates.
 *
 * Opt-in (analysis, not assertion):
 *   PROD_EXEC_DIAGNOSTIC=1 npx vitest run src/engine/productionExecution.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it } from 'vitest';
import { buildReadyDraft } from '../state/testFixtures';
import { computeStaticProductionRisk, computeRecommendedShootDays, rollDayEvent, resolveEventChoice } from './production';
import { computeQualityBreakdown } from './scoring';
import { computeExecutionProfile, neutralExecutionProfile, summarizeExecution } from './productionExecution';
import { generateTalentPool } from './talentGenerator';
import { withRng, type RandomFn } from './random';
import type { ProductionEvent, TalentAssignment } from '../types';

const SEEDS = 400;
type Cohort = 'typical' | 'careful' | 'reckless';
const COHORTS: Cohort[] = ['typical', 'careful', 'reckless'];

interface Sample {
  cohort: Cohort;
  qualityWith: number;
  qualityNeutral: number;
  delta: number;
  rating: string;
  avgReliability: number;
}

function avgReliability(talent: TalentAssignment[]): number {
  return talent.reduce((s, a) => s + a.person.reputation.reliability, 0) / Math.max(talent.length, 1);
}

// Careful vs reckless are the SAME creative project resourced differently -
// the decisions that create (or contain) execution risk. Careful: reliable
// leadership + deep contingency. Reckless: unreliable cast + a thin reserve on
// an over-ambitious spend. This is variance emerging from decisions (Principle
// 1/6), not an injected randomness knob.
function applyCohort(draft: ReturnType<typeof buildReadyDraft>, cohort: Cohort): ReturnType<typeof buildReadyDraft> {
  if (cohort === 'typical') return draft;
  const reliability = cohort === 'careful' ? 92 : 22;
  const talent = draft.talent.map((a) => ({ ...a, person: { ...a.person, reputation: { ...a.person.reputation, reliability } } }));
  const contingencyAmount = cohort === 'careful' ? 4_000_000 : 150_000;
  return { ...draft, talent, productionChoices: { ...draft.productionChoices!, contingencyAmount } };
}

/** Drive one realistic shoot day-by-day, auto-resolving interactive events with a random choice. */
function runOneShoot(seed: number, cohort: Cohort): Sample | null {
  return withRng(seed, (rng: RandomFn): Sample | null => {
    const draft = applyCohort(buildReadyDraft(rng), cohort);
    if (!draft.script || !draft.genre || !draft.productionChoices) return null;
    const talentPool = generateTalentPool(rng);
    const staticRisk = computeStaticProductionRisk(draft.talent, draft.script, draft.productionChoices, draft.genre);
    const recommendedDays = computeRecommendedShootDays(draft.talent, draft.script, draft.productionChoices);

    const events: ProductionEvent[] = [];
    const usedIds = new Set<string>();
    let extraDays = 0;
    for (let day = 1; day <= recommendedDays; day++) {
      const rolled = rollDayEvent(staticRisk, day, recommendedDays, draft.genre, usedIds, draft.talent, draft.script, talentPool, rng);
      if (!rolled) continue;
      if ('event' in rolled) {
        events.push(rolled.event);
        usedIds.add(rolled.event.id);
        extraDays += rolled.event.delayDaysDelta;
      } else {
        const choice = rolled.pendingChoice.choices[Math.floor(rng() * rolled.pendingChoice.choices.length)];
        const resolved = resolveEventChoice(rolled.pendingChoice, choice.id, rng);
        events.push(resolved);
        usedIds.add(resolved.id);
        extraDays += resolved.delayDaysDelta;
      }
    }
    const shootingRatio = (recommendedDays + extraDays) / recommendedDays;

    const withProfile = computeExecutionProfile({ events, shootingRatio, talent: draft.talent, productionChoices: draft.productionChoices });
    const q = (profile: ReturnType<typeof computeExecutionProfile>) =>
      computeQualityBreakdown(draft.script!, draft.talent, draft.genre!, draft.productionChoices!, draft.postProductionChoices!, events, shootingRatio, 0, profile).qualityScore;

    const qualityWith = q(withProfile);
    const qualityNeutral = q(neutralExecutionProfile(shootingRatio));
    return {
      cohort,
      qualityWith,
      qualityNeutral,
      delta: qualityWith - qualityNeutral,
      rating: summarizeExecution(withProfile).rating,
      avgReliability: avgReliability(draft.talent),
    };
  }).result;
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function stdev(xs: number[]): number { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); }
function pctile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}
function share(n: number, total: number): string { return total ? `${((n / total) * 100).toFixed(1)}%` : '0%'; }

const enabled = Boolean((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PROD_EXEC_DIAGNOSTIC);

describe.skipIf(!enabled)('Production Execution diagnostic', () => {
  it('reports the distribution-widening effect of production execution', () => {
    const byCohort: Record<Cohort, Sample[]> = { typical: [], careful: [], reckless: [] };
    for (let s = 0; s < SEEDS; s++) {
      for (const cohort of COHORTS) {
        const sample = runOneShoot(5000 + s, cohort);
        if (sample) byCohort[cohort].push(sample);
      }
    }
    const all = COHORTS.flatMap((c) => byCohort[c]);

    const lines: string[] = [];
    lines.push(`\n=== PRODUCTION EXECUTION DIAGNOSTIC (${SEEDS} projects x ${COHORTS.length} resourcing cohorts) ===\n`);

    lines.push('FINISHED QUALITY BY RESOURCING DECISION (same creative projects, resourced differently)');
    lines.push(`  ${'cohort'.padEnd(10)} ${'mean'.padStart(6)} ${'stdev'.padStart(6)} ${'p10'.padStart(5)} ${'p50'.padStart(5)} ${'p90'.padStart(5)} ${'min'.padStart(5)} ${'max'.padStart(5)}`);
    for (const c of COHORTS) {
      const xs = byCohort[c].map((s) => s.qualityWith);
      lines.push(`  ${c.padEnd(10)} ${mean(xs).toFixed(1).padStart(6)} ${stdev(xs).toFixed(1).padStart(6)} ${pctile(xs, 10).toFixed(0).padStart(5)} ${pctile(xs, 50).toFixed(0).padStart(5)} ${pctile(xs, 90).toFixed(0).padStart(5)} ${Math.min(...xs).toFixed(0).padStart(5)} ${Math.max(...xs).toFixed(0).padStart(5)}`);
    }

    lines.push('\nEXECUTION EFFECT vs THE NEUTRAL COUNTERFACTUAL (quality with execution - quality if execution were cosmetic)');
    lines.push(`  ${'cohort'.padEnd(10)} ${'mean'.padStart(6)} ${'stdev'.padStart(6)} ${'drop'.padStart(6)} ${'lift'.padStart(6)}  disappoint(<-3)  overperform(>+3)`);
    for (const c of COHORTS) {
      const d = byCohort[c].map((s) => s.delta);
      lines.push(`  ${c.padEnd(10)} ${mean(d).toFixed(2).padStart(6)} ${stdev(d).toFixed(2).padStart(6)} ${Math.min(...d).toFixed(1).padStart(6)} ${Math.max(...d).toFixed(1).padStart(6)}  ${share(d.filter((x) => x < -3).length, d.length).padStart(14)}  ${share(d.filter((x) => x > 3).length, d.length).padStart(15)}`);
    }

    lines.push('\nEXECUTION RATING FREQUENCY BY COHORT');
    const ratings = ['catastrophic', 'troubled', 'solid', 'strong', 'exceptional'];
    lines.push(`  ${'cohort'.padEnd(10)} ${ratings.map((r) => r.slice(0, 5).padStart(7)).join('')}`);
    for (const c of COHORTS) {
      lines.push(`  ${c.padEnd(10)} ${ratings.map((r) => share(byCohort[c].filter((s) => s.rating === r).length, byCohort[c].length).padStart(7)).join('')}`);
    }

    const neutralStdev = stdev(all.map((s) => s.qualityNeutral));
    const execStdev = stdev(all.map((s) => s.qualityWith));
    lines.push('\nHEADLINE');
    lines.push(`  Overall finished-quality stdev: neutral ${neutralStdev.toFixed(1)} -> with execution ${execStdev.toFixed(1)}`);
    lines.push(`  Careful vs reckless mean quality gap: ${(mean(byCohort.careful.map((s) => s.qualityWith)) - mean(byCohort.reckless.map((s) => s.qualityWith))).toFixed(1)} pts`);
    lines.push(`  Reliability mitigation: reckless mean execution delta ${mean(byCohort.reckless.map((s) => s.delta)).toFixed(2)} vs careful ${mean(byCohort.careful.map((s) => s.delta)).toFixed(2)}`);

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }, 120_000);
});
