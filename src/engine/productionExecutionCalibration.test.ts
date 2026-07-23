// Phase 1 (recalibrated) - behavioural acceptance tests for the production
// execution model: careful production mitigates rather than boosts, reckless
// production is genuinely dangerous, failures can chain (bounded), and Script /
// Direction / Production retain distinct leverage over the finished film.
import { describe, it, expect } from 'vitest';
import { computeExecutionProfile } from './productionExecution';
import { computeShootEscalation } from './production';
import { computeReleaseResults, type ReleaseComputationInput } from './releaseFilm';
import { buildReadyDraft } from '../state/testFixtures';
import { RISK_DIMENSION_EVENT_TEMPLATES } from '../data/productionEvents';
import { createRng, withRng } from './random';
import type { ProductionChoices, ProductionEvent, ProductionExecutionImpact, Script, TalentAssignment } from '../types';

let seq = 0;
function ev(qualityDelta: number, impact: ProductionExecutionImpact, escalates?: number): ProductionEvent {
  seq += 1;
  return { id: `t-${seq}`, description: 'x', severity: 'medium', costDelta: 0, qualityDelta, buzzDelta: 0, delayDaysDelta: 0, impact, escalates };
}

const choices: ProductionChoices = { contingencyAmount: 1_000_000, setQualityAmount: 500_000, practicalEffectsAmount: 500_000, vfxAmount: 500_000, runtimeIntensity: 0.5 };

function talent(): TalentAssignment[] {
  return withRng(2024, (rng) => buildReadyDraft(rng)).result.talent;
}
function withReliability(t: TalentAssignment[], reliability: number): TalentAssignment[] {
  return t.map((a) => ({ ...a, person: { ...a.person, reputation: { ...a.person.reputation, reliability } } }));
}

function releaseInput(events: ProductionEvent[], over: { talent?: TalentAssignment[]; scriptCraft?: number; contingencyAmount?: number } = {}): ReleaseComputationInput {
  const draft = withRng(2024, (rng) => buildReadyDraft(rng)).result;
  const script: Script = over.scriptCraft !== undefined
    ? { ...draft.script!, originality: over.scriptCraft, structure: over.scriptCraft, characters: over.scriptCraft, dialogue: over.scriptCraft }
    : draft.script!;
  return {
    title: 'Untitled', genre: draft.genre!, targetAudience: draft.targetAudience!, script,
    talent: over.talent ?? draft.talent,
    productionChoices: over.contingencyAmount !== undefined ? { ...draft.productionChoices!, contingencyAmount: over.contingencyAmount } : draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!, marketingChoices: draft.marketingChoices!,
    events, postProductionEvents: [], photographyCost: draft.photography!.runningCost, shootingRatio: 1, studioBrand: 20, competitiveCrowding: 0,
  };
}
function quality(events: ProductionEvent[], over: Parameters<typeof releaseInput>[1] = {}): number {
  return computeReleaseResults(releaseInput(events, over), createRng(1)).results.qualityScore;
}

const CATASTROPHIC: ProductionEvent[] = [ev(-14, 'performances'), ev(-9, 'performances'), ev(-12, 'coverage'), ev(-11, 'visual'), ev(-9, 'pacing')];
const POSITIVE: ProductionEvent[] = [ev(12, 'performances'), ev(11, 'performances'), ev(10, 'pacing')];

describe('careful production mitigates downside, it does not manufacture upside', () => {
  it('(1) reliability reduces the damage of a negative history but does not add positive execution', () => {
    const reliableProfile = computeExecutionProfile({ events: CATASTROPHIC, shootingRatio: 1, talent: withReliability(talent(), 95), productionChoices: choices });
    const flakyProfile = computeExecutionProfile({ events: CATASTROPHIC, shootingRatio: 1, talent: withReliability(talent(), 10), productionChoices: choices });
    // Mitigation: reliable production takes less damage.
    expect(reliableProfile.performanceCapture).toBeGreaterThan(flakyProfile.performanceCapture);
    // But reliability never pushes a multiplier above neutral - it only softens the negative.
    expect(reliableProfile.performanceCapture).toBeLessThanOrEqual(1);
  });

  it('(2) with no events, reliability changes nothing - it is not a passive quality lever', () => {
    // Contingency is deliberately held fixed: it feeds the production *dial*
    // (a legitimate baseline production-values effect), which is separate from
    // execution. Reliability's ONLY quality path is execution mitigation, so
    // with no events to mitigate it must leave the finished film untouched.
    const base = quality([]);
    const reliable = quality([], { talent: withReliability(talent(), 98) });
    const flaky = quality([], { talent: withReliability(talent(), 5) });
    expect(reliable).toBe(base);
    expect(flaky).toBe(base);
  });

  it('(3) positive execution requires positive recorded causes (no free upside)', () => {
    const noEvents = computeExecutionProfile({ events: [], shootingRatio: 1, talent: withReliability(talent(), 98), productionChoices: choices });
    const onlyNegatives = computeExecutionProfile({ events: CATASTROPHIC, shootingRatio: 1, talent: talent(), productionChoices: choices });
    expect(noEvents.performanceCapture).toBe(1);
    expect(noEvents.postExecution).toBe(1);
    expect(onlyNegatives.performanceCapture).toBeLessThan(1);
    // Upside only appears when positive events are actually recorded.
    const withPositives = computeExecutionProfile({ events: POSITIVE, shootingRatio: 1, talent: talent(), productionChoices: choices });
    expect(withPositives.performanceCapture).toBeGreaterThan(1);
  });
});

describe('reckless production is genuinely dangerous', () => {
  it('(4) major negative events materially damage the finished film and the right department', () => {
    const perfHit = computeExecutionProfile({ events: [ev(-16, 'performances')], shootingRatio: 1, talent: withReliability(talent(), 20), productionChoices: choices });
    expect(perfHit.performanceCapture).toBeLessThan(0.85);
    expect(perfHit.postExecution).toBe(1); // untouched - typed routing
    const drop = quality([]) - quality(CATASTROPHIC, { talent: withReliability(talent(), 20) });
    expect(drop).toBeGreaterThan(10); // a catastrophic shoot sheds real quality
  });

  it('(8) an excellent project can be materially damaged by a catastrophic shoot', () => {
    const excellentClean = quality([], { scriptCraft: 92 });
    const excellentRuined = quality(CATASTROPHIC, { scriptCraft: 92, talent: withReliability(talent(), 20) });
    expect(excellentClean - excellentRuined).toBeGreaterThan(10);
  });
});

describe('bounded failure chains', () => {
  it('(6) accumulated major setbacks raise escalation, capped so it never spirals without limit', () => {
    expect(computeShootEscalation([], 0.5)).toBe(0);
    const oneMajor = computeShootEscalation([ev(-14, 'performances', 0.7)], 0);
    const manyMajor = computeShootEscalation(Array.from({ length: 8 }, () => ev(-14, 'performances', 0.8)), 0);
    expect(oneMajor).toBeGreaterThan(0);
    expect(manyMajor).toBeGreaterThan(oneMajor);
    expect(manyMajor).toBeLessThanOrEqual(22); // MAX_ESCALATION_RISK - bounded
  });

  it('(7) reliability/contingency (resilience) reduce escalation', () => {
    const events = Array.from({ length: 4 }, () => ev(-12, 'visual', 0.6));
    expect(computeShootEscalation(events, 0.9)).toBeLessThan(computeShootEscalation(events, 0.1));
  });

  it('positive events never escalate', () => {
    expect(computeShootEscalation(POSITIVE, 0)).toBe(0);
  });
});

describe('execution shapes potential, it does not replace it', () => {
  it('(9) a poor screenplay cannot become a masterpiece through positive execution alone', () => {
    const poorWithGreatShoot = quality(POSITIVE, { scriptCraft: 20 });
    const excellentClean = quality([], { scriptCraft: 92 });
    expect(poorWithGreatShoot).toBeLessThan(excellentClean);
    expect(poorWithGreatShoot).toBeLessThan(70); // nowhere near masterpiece territory
  });

  it('(14) Script, Direction and Production retain distinct, meaningful leverage', () => {
    const strongScript = quality([], { scriptCraft: 92 });
    const weakScript = quality([], { scriptCraft: 30 });
    expect(strongScript - weakScript).toBeGreaterThan(10); // script still drives potential

    // A catastrophic shoot moves quality substantially - production execution matters...
    const shootSwing = quality([]) - quality(CATASTROPHIC, { talent: withReliability(talent(), 20) });
    expect(shootSwing).toBeGreaterThan(8);
    // ...but not more than the script's own range, so it hasn't swallowed the model.
    expect(shootSwing).toBeLessThan(strongScript - weakScript + 12);
  });
});

describe('typed impact ownership', () => {
  it('(10) event definitions own their impact; an inline impact overrides the bank default', () => {
    // Every risk-dimension template carries an explicit impact (definition-owned).
    for (const bank of Object.values(RISK_DIMENSION_EVENT_TEMPLATES)) {
      for (const t of [...bank.positive, ...bank.negative]) expect(t.impact).toBeDefined();
    }
    // 'unusable footage' lives in the technicalComplexity bank (default 'visual')
    // but declares impact 'coverage' inline - the definition wins over the bank.
    const unusable = RISK_DIMENSION_EVENT_TEMPLATES.technicalComplexity.negative.find((t) => t.id === 'risk-technical-neg-unusable-footage');
    expect(unusable?.impact).toBe('coverage');
  });
});
