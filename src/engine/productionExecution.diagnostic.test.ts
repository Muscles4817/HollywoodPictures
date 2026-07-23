/**
 * Empirical diagnostic for Production Execution (Phase 1, recalibrated).
 * Simulates many player shoots headlessly - the real risk model, real per-day
 * event rolls, and bounded failure chains (engine/production.ts) - then scores
 * each film with the recorded execution history. Uses a fixed EXCELLENT
 * pre-production project so the question under test is isolated:
 *
 *   Take an excellent script + director + cast; vary only production planning
 *   and execution risk. How much can the shoot preserve, elevate, or damage it?
 *
 * Reports full distributions (not just means), band crossings on the game's own
 * quality scale (data/reviewBlurbs.ts:reviewBand), and downside/upside
 * probabilities, per resourcing cohort.
 *
 * Opt-in:
 *   PROD_EXEC_DIAGNOSTIC=1 npx vitest run src/engine/productionExecution.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it } from 'vitest';
import { buildReadyDraft } from '../state/testFixtures';
import { computeStaticProductionRisk, computeRecommendedShootDays, computeShootEscalation, rollDayEvent, resolveEventChoice } from './production';
import { resolveRivalExecution } from './rivalExecution';
import { computeQualityBreakdown } from './scoring';
import { computeExecutionProfile, computeExecutionResilience, neutralExecutionProfile, summarizeExecution } from './productionExecution';
import { generateTalentPool } from './talentGenerator';
import { reviewBand, type ReviewBand } from '../data/reviewBlurbs';
import { withRng, type RandomFn } from './random';
import type { FilmDraft, Person, ProductionEvent } from '../types';

const SEEDS = 500;
type Cohort = 'careful' | 'typical' | 'reckless';
const COHORTS: Cohort[] = ['careful', 'typical', 'reckless'];

interface Sample {
  qualityWith: number;
  qualityNeutral: number;
  delta: number;
  rating: string;
  eventCount: number;
}

// Force an excellent, well-matched pre-production package so the shoot is the
// only variable. Boost the key creative craft scores and cast fit inputs to the
// top of their ranges; the neutral (no-execution) quality lands high.
function excellentDraft(rng: RandomFn): FilmDraft {
  const draft = buildReadyDraft(rng);
  const script = draft.script!;
  const boostedScript = { ...script, originality: 92, structure: 92, characters: 92, dialogue: 92 };
  return { ...draft, script: boostedScript };
}

// Careful vs reckless = the same excellent project resourced differently.
function applyCohort(draft: FilmDraft, cohort: Cohort): FilmDraft {
  const reliability = cohort === 'careful' ? 92 : cohort === 'typical' ? 60 : 22;
  const talent = draft.talent.map((a) => ({ ...a, person: { ...a.person, reputation: { ...a.person.reputation, reliability } } }));
  const contingencyAmount = cohort === 'careful' ? 4_000_000 : cohort === 'typical' ? 1_000_000 : 150_000;
  return { ...draft, talent, productionChoices: { ...draft.productionChoices!, contingencyAmount } };
}

function runOneShoot(seed: number, cohort: Cohort): Sample | null {
  return withRng(seed, (rng: RandomFn): Sample | null => {
    const draft = applyCohort(excellentDraft(rng), cohort);
    if (!draft.script || !draft.genre || !draft.productionChoices) return null;
    const talentPool: Record<string, Person[]> = generateTalentPool(rng);
    const staticRisk = computeStaticProductionRisk(draft.talent, draft.script, draft.productionChoices, draft.genre);
    const recommendedDays = computeRecommendedShootDays(draft.talent, draft.script, draft.productionChoices);
    const resilience = computeExecutionResilience(draft.talent, draft.productionChoices);

    const events: ProductionEvent[] = [];
    const usedIds = new Set<string>();
    let extraDays = 0;
    for (let day = 1; day <= recommendedDays; day++) {
      const escalation = computeShootEscalation(events, resilience);
      const rolled = rollDayEvent(staticRisk, day, recommendedDays, draft.genre, usedIds, draft.talent, draft.script, talentPool as never, rng, escalation);
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
    return { qualityWith, qualityNeutral, delta: qualityWith - qualityNeutral, rating: summarizeExecution(withProfile).rating, eventCount: events.length };
  }).result;
}

// The SAME plan, but the history synthesized by the rival resolver instead of a
// lived day-by-day shoot. Parity target: this should land on ~the same
// execution-rating distribution as runOneShoot for the same cohort.
function runRivalSynth(seed: number, cohort: Cohort): Sample | null {
  return withRng(seed, (rng: RandomFn): Sample | null => {
    const draft = applyCohort(excellentDraft(rng), cohort);
    if (!draft.script || !draft.genre || !draft.productionChoices) return null;
    const { events, shootingRatio } = resolveRivalExecution(
      { talent: draft.talent, script: draft.script, productionChoices: draft.productionChoices, genre: draft.genre },
      rng,
    );
    const withProfile = computeExecutionProfile({ events, shootingRatio, talent: draft.talent, productionChoices: draft.productionChoices });
    const q = (profile: ReturnType<typeof computeExecutionProfile>) =>
      computeQualityBreakdown(draft.script!, draft.talent, draft.genre!, draft.productionChoices!, draft.postProductionChoices!, events, shootingRatio, 0, profile).qualityScore;
    const qualityWith = q(withProfile);
    const qualityNeutral = q(neutralExecutionProfile(shootingRatio));
    return { qualityWith, qualityNeutral, delta: qualityWith - qualityNeutral, rating: summarizeExecution(withProfile).rating, eventCount: events.length };
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

describe.skipIf(!enabled)('Production Execution diagnostic (excellent project x resourcing)', () => {
  it('reports full distributions, band crossings, and downside/upside probabilities', () => {
    const byCohort: Record<Cohort, Sample[]> = { careful: [], typical: [], reckless: [] };
    for (let s = 0; s < SEEDS; s++) {
      for (const cohort of COHORTS) {
        const sample = runOneShoot(7000 + s, cohort);
        if (sample) byCohort[cohort].push(sample);
      }
    }

    const lines: string[] = [];
    lines.push(`\n=== PRODUCTION EXECUTION DIAGNOSTIC - EXCELLENT PROJECT (${SEEDS} projects x ${COHORTS.length} cohorts) ===`);
    lines.push('Same excellent script/director/cast; only production resourcing + execution risk vary.\n');

    lines.push('FINISHED QUALITY DISTRIBUTION');
    lines.push(`  ${'cohort'.padEnd(9)} ${'mean'.padStart(5)} ${'sd'.padStart(4)} ${'min'.padStart(4)} ${'p5'.padStart(4)} ${'p10'.padStart(4)} ${'p25'.padStart(4)} ${'med'.padStart(4)} ${'p75'.padStart(4)} ${'p90'.padStart(4)} ${'p95'.padStart(4)} ${'max'.padStart(4)}`);
    for (const c of COHORTS) {
      const x = byCohort[c].map((s) => s.qualityWith);
      lines.push(`  ${c.padEnd(9)} ${mean(x).toFixed(1).padStart(5)} ${stdev(x).toFixed(1).padStart(4)} ${Math.min(...x).toFixed(0).padStart(4)} ${pctile(x, 5).toFixed(0).padStart(4)} ${pctile(x, 10).toFixed(0).padStart(4)} ${pctile(x, 25).toFixed(0).padStart(4)} ${pctile(x, 50).toFixed(0).padStart(4)} ${pctile(x, 75).toFixed(0).padStart(4)} ${pctile(x, 90).toFixed(0).padStart(4)} ${pctile(x, 95).toFixed(0).padStart(4)} ${Math.max(...x).toFixed(0).padStart(4)}`);
    }

    lines.push('\nEXECUTION EFFECT vs NEUTRAL (finished quality minus quality-if-execution-were-cosmetic)');
    lines.push(`  ${'cohort'.padEnd(9)} ${'mean'.padStart(6)} ${'worst'.padStart(6)} ${'best'.padStart(6)}   P(lose>=3) P(>=5) P(>=8) P(>=10)   P(gain>=3) P(>=5)`);
    for (const c of COHORTS) {
      const d = byCohort[c].map((s) => s.delta);
      const n = d.length;
      lines.push(`  ${c.padEnd(9)} ${mean(d).toFixed(2).padStart(6)} ${Math.min(...d).toFixed(1).padStart(6)} ${Math.max(...d).toFixed(1).padStart(6)}   ${share(d.filter((x) => x <= -3).length, n).padStart(9)} ${share(d.filter((x) => x <= -5).length, n).padStart(6)} ${share(d.filter((x) => x <= -8).length, n).padStart(6)} ${share(d.filter((x) => x <= -10).length, n).padStart(7)}   ${share(d.filter((x) => x >= 3).length, n).padStart(9)} ${share(d.filter((x) => x >= 5).length, n).padStart(6)}`);
    }

    const BANDS: ReviewBand[] = ['savaged', 'poor', 'mixed', 'solid', 'excellent', 'triumph'];
    lines.push('\nQUALITY BAND OF THE FINISHED FILM (data/reviewBlurbs.ts:reviewBand)');
    lines.push(`  ${'cohort'.padEnd(9)} ${BANDS.map((b) => b.slice(0, 5).padStart(7)).join('')}`);
    for (const c of COHORTS) {
      const bands = byCohort[c].map((s) => reviewBand(s.qualityWith));
      lines.push(`  ${c.padEnd(9)} ${BANDS.map((b) => share(bands.filter((x) => x === b).length, bands.length).padStart(7)).join('')}`);
    }

    lines.push('\nEXECUTION RATING FREQUENCY');
    const ratings = ['catastrophic', 'troubled', 'solid', 'strong', 'exceptional'];
    lines.push(`  ${'cohort'.padEnd(9)} ${ratings.map((r) => r.slice(0, 5).padStart(8)).join('')}   avgEvents`);
    for (const c of COHORTS) {
      lines.push(`  ${c.padEnd(9)} ${ratings.map((r) => share(byCohort[c].filter((s) => s.rating === r).length, byCohort[c].length).padStart(8)).join('')}   ${mean(byCohort[c].map((s) => s.eventCount)).toFixed(1)}`);
    }

    lines.push('\nHEADLINE');
    lines.push(`  Careful vs reckless mean quality gap: ${(mean(byCohort.careful.map((s) => s.qualityWith)) - mean(byCohort.reckless.map((s) => s.qualityWith))).toFixed(1)} pts`);
    lines.push(`  Reckless downside stdev ${stdev(byCohort.reckless.map((s) => s.qualityWith)).toFixed(1)} vs careful ${stdev(byCohort.careful.map((s) => s.qualityWith)).toFixed(1)}`);

    // --- PLAYER vs RIVAL parity (Phase 2) -----------------------------------
    // The rival resolver synthesizes a history for the SAME plans; its
    // execution-rating distribution should match the player's lived shoot.
    const rivalByCohort: Record<Cohort, Sample[]> = { careful: [], typical: [], reckless: [] };
    for (let s = 0; s < SEEDS; s++) {
      for (const cohort of COHORTS) {
        const sample = runRivalSynth(9000 + s, cohort);
        if (sample) rivalByCohort[cohort].push(sample);
      }
    }
    lines.push('\nPLAYER (lived shoot) vs RIVAL (synthesized history) - same plans, same pipeline');
    lines.push(`  ${'cohort'.padEnd(9)} ${'who'.padEnd(7)} ${'meanQ'.padStart(6)} ${'meanDelta'.padStart(9)} ${'troubled'.padStart(9)} ${'catas'.padStart(6)} ${'strong+'.padStart(8)} ${'events'.padStart(7)}`);
    for (const c of COHORTS) {
      for (const [who, arr] of [['player', byCohort[c]], ['rival', rivalByCohort[c]]] as const) {
        const troubled = arr.filter((s) => s.rating === 'troubled' || s.rating === 'catastrophic').length;
        const catas = arr.filter((s) => s.rating === 'catastrophic').length;
        const strongPlus = arr.filter((s) => s.rating === 'strong' || s.rating === 'exceptional').length;
        lines.push(`  ${c.padEnd(9)} ${who.padEnd(7)} ${mean(arr.map((s) => s.qualityWith)).toFixed(1).padStart(6)} ${mean(arr.map((s) => s.delta)).toFixed(2).padStart(9)} ${share(troubled, arr.length).padStart(9)} ${share(catas, arr.length).padStart(6)} ${share(strongPlus, arr.length).padStart(8)} ${mean(arr.map((s) => s.eventCount)).toFixed(1).padStart(7)}`);
      }
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }, 180_000);
});
