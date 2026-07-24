/**
 * Empirical diagnostic for the three newly-wired personality levers
 * (engine/creativeTension.ts, production.ts:moraleRisk, productionExecution.ts:
 * resilience, actingModel.ts:adaptability). It isolates each lever on an
 * otherwise-fixed EXCELLENT project and reports how many finished-quality points
 * it actually moves - the evidence for tuning the swing constants. A good lever
 * is felt but not dominant, and widens the distribution where it should.
 *
 * Opt-in:
 *   PERSONALITY_DIAGNOSTIC=1 npx vitest run src/engine/personalityWiring.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it } from 'vitest';
import { buildReadyDraft } from '../state/testFixtures';
import { computeStaticProductionRisk, computeRecommendedShootDays, computeShootEscalation, rollDayEvent, resolveEventChoice } from './production';
import { computeActingScore, computeQualityBreakdown } from './scoring';
import { computeExecutionProfile, computeExecutionResilience, neutralExecutionProfile } from './productionExecution';
import { computeCreativeTension } from './creativeTension';
import { deriveToneFromActingStyle } from './compatibility';
import { getActorCareer } from './person';
import { generateTalentPool } from './talentGenerator';
import { withRng, type RandomFn } from './random';
import type { FilmDraft, Person, PersonPersonality, ProductionChoices, ProductionEvent, ToneProfile } from '../types';

const SEEDS = 400;

function excellentDraft(rng: RandomFn): FilmDraft {
  const draft = buildReadyDraft(rng);
  const script = draft.script!;
  return { ...draft, script: { ...script, originality: 92, structure: 92, characters: 92, dialogue: 92 } };
}

/** Force every cast member's personality axes + a fixed reliability, so a cohort isolates exactly the axis under test. */
function applyCast(draft: FilmDraft, over: Partial<PersonPersonality>, reliability: number): FilmDraft {
  const talent = draft.talent.map((a) => ({
    ...a,
    person: {
      ...a.person,
      personality: { ...a.person.personality, ...over },
      reputation: { ...a.person.reputation, reliability },
    },
  }));
  return { ...draft, talent };
}

interface Sample { quality: number; delta: number; events: number; troubled: boolean; }

function runShoot(seed: number, over: Partial<PersonPersonality>, reliability: number, contingencyAmount: number): Sample | null {
  return withRng(seed, (rng: RandomFn): Sample | null => {
    let draft = excellentDraft(rng);
    if (!draft.script || !draft.genre || !draft.productionChoices) return null;
    const baseChoices = draft.productionChoices; // capture while narrowed (applyCast re-widens the draft below)
    draft = applyCast(draft, over, reliability);
    const script = draft.script!;
    const genre = draft.genre!;
    const choices: ProductionChoices = { ...baseChoices, contingencyAmount };
    const talentPool: Record<string, Person[]> = generateTalentPool(rng);
    const staticRisk = computeStaticProductionRisk(draft.talent, script, choices, genre);
    const recommendedDays = computeRecommendedShootDays(draft.talent, script, choices);
    const resilience = computeExecutionResilience(draft.talent, choices);

    const events: ProductionEvent[] = [];
    const usedIds = new Set<string>();
    let extraDays = 0;
    for (let day = 1; day <= recommendedDays; day++) {
      const escalation = computeShootEscalation(events, resilience);
      const rolled = rollDayEvent(staticRisk, day, recommendedDays, genre, usedIds, draft.talent, script, talentPool as never, rng, escalation);
      if (!rolled) continue;
      if ('event' in rolled) {
        events.push(rolled.event); usedIds.add(rolled.event.id); extraDays += rolled.event.delayDaysDelta;
      } else {
        const choice = rolled.pendingChoice.choices[Math.floor(rng() * rolled.pendingChoice.choices.length)];
        const resolved = resolveEventChoice(rolled.pendingChoice, choice.id, rng);
        events.push(resolved); usedIds.add(resolved.id); extraDays += resolved.delayDaysDelta;
      }
    }
    const shootingRatio = (recommendedDays + extraDays) / recommendedDays;
    const withProfile = computeExecutionProfile({ events, shootingRatio, talent: draft.talent, productionChoices: choices });
    const q = (profile: ReturnType<typeof computeExecutionProfile>) =>
      computeQualityBreakdown(script, draft.talent, genre, choices, draft.postProductionChoices!, events, shootingRatio, 0, profile).qualityScore;
    const quality = q(withProfile);
    const neutral = q(neutralExecutionProfile(shootingRatio));
    const rating = withProfile.overall;
    return { quality, delta: quality - neutral, events: events.length, troubled: rating <= -0.06 };
  }).result;
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function stdev(xs: number[]): number { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); }
function share(pred: boolean[]): string { const n = pred.filter(Boolean).length; return pred.length ? `${((n / pred.length) * 100).toFixed(1)}%` : '0%'; }

const NEUTRAL: Partial<PersonPersonality> = { temperament: 50, ego: 50, adaptability: 50, pressureHandling: 50 };

const enabled = Boolean((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PERSONALITY_DIAGNOSTIC);

describe.skipIf(!enabled)('Personality wiring diagnostic', () => {
  it('reports the finished-film magnitude of each lever', () => {
    const lines: string[] = [];
    const run = (over: Partial<PersonPersonality>, reliability: number, contingency: number) => {
      const s: Sample[] = [];
      for (let i = 0; i < SEEDS; i++) { const r = runShoot(5000 + i, over, reliability, contingency); if (r) s.push(r); }
      return s;
    };
    const row = (label: string, s: Sample[]) =>
      `  ${label.padEnd(22)} ${mean(s.map((x) => x.quality)).toFixed(1).padStart(6)} ${stdev(s.map((x) => x.quality)).toFixed(2).padStart(5)} ${mean(s.map((x) => x.delta)).toFixed(2).padStart(6)} ${share(s.map((x) => x.troubled)).padStart(8)} ${mean(s.map((x) => x.events)).toFixed(1).padStart(6)}`;
    const header = `  ${'cohort'.padEnd(22)} ${'meanQ'.padStart(6)} ${'sdQ'.padStart(5)} ${'exec'.padStart(6)} ${'troubled'.padStart(8)} ${'events'.padStart(6)}`;

    // --- A. MORALE: temperament (volatility) + creative tension -------------
    // Reliability/contingency fixed at mid, so only the morale amplifiers move.
    lines.push(`\n=== A. MORALE AMPLIFIERS (temperament + creative tension), reliability=60 (${SEEDS} seeds) ===`);
    lines.push(header);
    lines.push(row('calm+agreeable', run({ temperament: 90, ego: 40, adaptability: 75 }, 60, 1_000_000)));
    lines.push(row('neutral', run(NEUTRAL, 60, 1_000_000)));
    lines.push(row('volatile (temp 15)', run({ ...NEUTRAL, temperament: 15 }, 60, 1_000_000)));
    lines.push(row('clashing (ego90 adapt10)', run({ ...NEUTRAL, ego: 90, adaptability: 10 }, 60, 1_000_000)));
    lines.push(row('volatile+clashing', run({ temperament: 15, ego: 90, adaptability: 10 }, 60, 1_000_000)));
    lines.push(`  (creative tension: neutral=${computeCreativeTension(withRng(1, (r) => applyCast(excellentDraft(r), NEUTRAL, 60).talent).result)}, clashing=${computeCreativeTension(withRng(1, (r) => applyCast(excellentDraft(r), { ego: 90, adaptability: 10 }, 60).talent).result)})`);

    // --- B. COMPOSURE: pressureHandling on a rough (reliability 40) shoot ----
    lines.push(`\n=== B. COMPOSURE (pressureHandling), rough shoot reliability=40 contingency=500k ===`);
    lines.push(header);
    lines.push(row('hair-trigger (ph 5)', run({ ...NEUTRAL, pressureHandling: 5 }, 40, 500_000)));
    lines.push(row('neutral (ph 50)', run(NEUTRAL, 40, 500_000)));
    lines.push(row('composed (ph 95)', run({ ...NEUTRAL, pressureHandling: 95 }, 40, 500_000)));

    // --- C. ADAPTABILITY: acting-score ceiling + spread ---------------------
    // Adaptability only touches the acting model, so measure the acting score
    // directly (isolates it from shoot noise). Under a MATCHED director rigidity
    // should lift the mean (higher ceiling); under a MISMATCHED one it should
    // drop it further (deeper crater). The gap between the two columns per row is
    // that actor's outcome SPREAD - rigid's should be the widest.
    lines.push(`\n=== C. ADAPTABILITY (acting score, matched vs mismatched director) ===`);
    lines.push(`  ${'cohort'.padEnd(22)} ${'matched'.padStart(8)} ${'mismatch'.padStart(8)} ${'spread'.padStart(7)}`);
    // Flip the director's ToneProfile onto the lead's WEAKEST tone - a confident
    // wrong read, the same trick actingModel.test.ts uses to force aim negative.
    const mismatchDirector = (draft: FilmDraft): FilmDraft => {
      const lead = draft.talent.find((a) => a.role === 'Lead Actor')?.person;
      const style = lead && getActorCareer(lead)?.actingStyle;
      const dirAssign = draft.talent.find((a) => a.role === 'Director');
      if (!style || !dirAssign?.person.careers.director) return draft;
      const tone = deriveToneFromActingStyle(style);
      const keys = Object.keys(tone) as Array<keyof ToneProfile>;
      const weakest = keys.reduce((w, k) => (tone[k] < tone[w] ? k : w), keys[0]);
      const profile = {} as ToneProfile;
      for (const k of keys) profile[k] = k === weakest ? 100 : 0;
      const person = { ...dirAssign.person, careers: { ...dirAssign.person.careers, director: { ...dirAssign.person.careers.director, toneProfile: profile } } };
      return { ...draft, talent: draft.talent.map((a) => (a.role === 'Director' ? { ...a, person } : a)) };
    };
    const actingCohort = (label: string, adaptability: number) => {
      const matched: number[] = [];
      const mismatched: number[] = [];
      for (let i = 0; i < SEEDS; i++) {
        withRng(5000 + i, (rng) => {
          const base = applyCast(excellentDraft(rng), { adaptability }, 60);
          matched.push(computeActingScore(base.talent, base.script!));
          const mm = mismatchDirector(base);
          mismatched.push(computeActingScore(mm.talent, mm.script!));
          return 0;
        });
      }
      lines.push(`  ${label.padEnd(22)} ${mean(matched).toFixed(2).padStart(8)} ${mean(mismatched).toFixed(2).padStart(8)} ${(mean(matched) - mean(mismatched)).toFixed(2).padStart(7)}`);
    };
    actingCohort('rigid (adapt 5)', 5);
    actingCohort('neutral (adapt 50)', 50);
    actingCohort('adaptable (adapt 95)', 95);

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }, 180_000);
});
