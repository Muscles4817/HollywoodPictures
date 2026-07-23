// Phase 1 - Production Execution: the recorded shoot history must materially,
// explainably, and deterministically shape the finished film
// (docs/DESIGN_REVIEW_production_execution.md). These tests cover the required
// Phase 1 guarantees: real leverage, typed targeting, reliability mitigation,
// no release-time jitter, legible player-facing output, and save-safe history.
import { describe, it, expect } from 'vitest';
import {
  classifyEventImpact,
  computeExecutionProfile,
  summarizeExecution,
  neutralExecutionProfile,
  type ExecutionProfileInput,
} from './productionExecution';
import { computeReleaseResults, type ReleaseComputationInput } from './releaseFilm';
import { buildReadyDraft } from '../state/testFixtures';
import { createRng, withRng } from './random';
import type { ProductionChoices, ProductionEvent, ProductionExecutionImpact, TalentAssignment } from '../types';

// --- helpers ---------------------------------------------------------------

let eventSeq = 0;
function ev(qualityDelta: number, opts: { id?: string; impact?: ProductionExecutionImpact; description?: string } = {}): ProductionEvent {
  eventSeq += 1;
  return {
    id: opts.id ?? `test-event-${eventSeq}`,
    description: opts.description ?? 'A thing happened on set.',
    severity: 'medium',
    costDelta: 0,
    qualityDelta,
    buzzDelta: 0,
    delayDaysDelta: 0,
    impact: opts.impact,
  };
}

const choices: ProductionChoices = {
  contingencyAmount: 1_000_000,
  setQualityAmount: 500_000,
  practicalEffectsAmount: 500_000,
  vfxAmount: 500_000,
  runtimeIntensity: 0.5,
};

function draftTalent(seed = 2024): TalentAssignment[] {
  return withRng(seed, (rng) => buildReadyDraft(rng)).result.talent;
}

function withReliability(talent: TalentAssignment[], reliability: number): TalentAssignment[] {
  return talent.map((a) => ({
    ...a,
    person: { ...a.person, reputation: { ...a.person.reputation, reliability } },
  }));
}

function profileInput(events: ProductionEvent[], over: Partial<ExecutionProfileInput> = {}): ExecutionProfileInput {
  return { events, shootingRatio: 1, talent: draftTalent(), productionChoices: choices, ...over };
}

// A ReleaseComputationInput from a real ready draft, with the on-set event
// history swapped for a controlled one (everything else identical), so quality
// differences are attributable purely to the shoot history.
function releaseInput(events: ProductionEvent[], over: { talent?: TalentAssignment[]; shootingRatio?: number } = {}): ReleaseComputationInput {
  const draft = withRng(2024, (rng) => buildReadyDraft(rng)).result;
  return {
    title: draft.title || 'Untitled',
    genre: draft.genre!,
    targetAudience: draft.targetAudience!,
    script: draft.script!,
    talent: over.talent ?? draft.talent,
    productionChoices: draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!,
    marketingChoices: draft.marketingChoices!,
    events,
    postProductionEvents: [],
    photographyCost: draft.photography!.runningCost,
    shootingRatio: over.shootingRatio ?? 1,
    studioBrand: 20,
    competitiveCrowding: 0,
  };
}

function quality(events: ProductionEvent[], over: { talent?: TalentAssignment[]; shootingRatio?: number } = {}): number {
  return computeReleaseResults(releaseInput(events, over), createRng(1)).results.qualityScore;
}

// Representative event histories.
const CATASTROPHIC: ProductionEvent[] = [
  ev(-13, { impact: 'performances', description: 'A morale collapse gutted the performances.' }),
  ev(-8, { impact: 'performances' }),
  ev(-10, { impact: 'coverage', description: 'Lost shoot days left scenes uncovered.' }),
  ev(-8, { impact: 'pacing' }),
  ev(-9, { impact: 'visual', description: 'A key effects sequence never came together.' }),
  ev(-7, { impact: 'general' }),
];
// A genuinely exceptional shoot - concentrated, strong positive execution
// (career-best performances, an inspired cut). Upside must be earned like this;
// a scattering of minor positives should not reach these tiers.
const EXCEPTIONAL: ProductionEvent[] = [
  ev(12, { impact: 'performances', description: 'The lead delivered a career-best performance.' }),
  ev(11, { impact: 'performances' }),
  ev(9, { impact: 'performances' }),
  ev(12, { impact: 'pacing' }),
  ev(11, { impact: 'visual' }),
  ev(9, { impact: 'general' }),
];

// ---------------------------------------------------------------------------

describe('classifyEventImpact', () => {
  it('routes representative event ids to the department they are about', () => {
    expect(classifyEventImpact({ id: 'risk-morale-neg-shouting-match' })).toBe('performances');
    expect(classifyEventImpact({ id: 'risk-schedule-neg-scene-cut-for-time' })).toBe('coverage');
    expect(classifyEventImpact({ id: 'risk-technical-neg-shot-rebuilt' })).toBe('visual');
    expect(classifyEventImpact({ id: 'risk-safety-neg-stunt-hospital' })).toBe('visual');
    expect(classifyEventImpact({ id: 'int-writer-rewrite-struggle' })).toBe('script');
    expect(classifyEventImpact({ id: 'genre-thriller-neg-twist-not-landing' })).toBe('pacing');
    expect(classifyEventImpact({ id: 'int-composer-temp-score-clash' })).toBe('pacing');
    expect(classifyEventImpact({ id: 'risk-budget-neg-ran-out' })).toBe('general');
    expect(classifyEventImpact({ id: 'genre-drama-pos-raw-take' })).toBe('performances');
  });

  it('an explicit impact always wins over id inference', () => {
    expect(classifyEventImpact({ id: 'risk-morale-neg-shouting-match', impact: 'visual' })).toBe('visual');
  });

  it('a legacy event with no impact still classifies from its id (no migration needed)', () => {
    const legacy: ProductionEvent = { id: 'risk-morale-neg-walked-off', description: 'x', severity: 'high', costDelta: 0, qualityDelta: -5, buzzDelta: 0, delayDaysDelta: 1 };
    expect(classifyEventImpact(legacy)).toBe('performances');
  });
});

describe('computeExecutionProfile', () => {
  it('an empty history is neutral (every multiplier 1, coverage = shooting ratio)', () => {
    const p = computeExecutionProfile(profileInput([], { shootingRatio: 1.1 }));
    expect(p.performanceCapture).toBe(1);
    expect(p.postExecution).toBe(1);
    expect(p.scriptExecution).toBe(1);
    expect(p.coverageRatio).toBe(1.1);
    expect(p.overall).toBe(0);
    expect(neutralExecutionProfile(1.1)).toMatchObject({ performanceCapture: 1, coverageRatio: 1.1 });
  });

  it('negative performance events lower performanceCapture; positive raise it', () => {
    const bad = computeExecutionProfile(profileInput([ev(-9, { impact: 'performances' }), ev(-8, { impact: 'performances' })]));
    const good = computeExecutionProfile(profileInput([ev(9, { impact: 'performances' }), ev(8, { impact: 'performances' })]));
    expect(bad.performanceCapture).toBeLessThan(1);
    expect(good.performanceCapture).toBeGreaterThan(1);
  });

  it('is fully deterministic - same inputs produce identical profiles', () => {
    const a = computeExecutionProfile(profileInput(CATASTROPHIC));
    const b = computeExecutionProfile(profileInput(CATASTROPHIC));
    expect(a).toEqual(b);
  });

  it('event consequences target their own department only (typed routing, no bleed)', () => {
    const scriptHit = computeExecutionProfile(profileInput([ev(-12, { impact: 'script' })]));
    expect(scriptHit.scriptExecution).toBeLessThan(1);
    expect(scriptHit.performanceCapture).toBe(1); // untouched

    const perfHit = computeExecutionProfile(profileInput([ev(-12, { impact: 'performances' })]));
    expect(perfHit.performanceCapture).toBeLessThan(1);
    expect(perfHit.scriptExecution).toBe(1); // untouched
  });

  it('reliability mitigates negative execution damage (a reliable production absorbs more)', () => {
    const reliable = computeExecutionProfile(profileInput(CATASTROPHIC, { talent: withReliability(draftTalent(), 95) }));
    const flaky = computeExecutionProfile(profileInput(CATASTROPHIC, { talent: withReliability(draftTalent(), 10) }));
    // Higher reliability => less damage => multipliers closer to 1.
    expect(reliable.performanceCapture).toBeGreaterThan(flaky.performanceCapture);
    expect(reliable.overall).toBeGreaterThan(flaky.overall);
  });
});

describe('summarizeExecution - legible, player-facing, no raw stats', () => {
  it('maps a catastrophic shoot to 1 star and an exceptional shoot to 5', () => {
    const bad = summarizeExecution(computeExecutionProfile(profileInput(CATASTROPHIC, { talent: withReliability(draftTalent(), 15) })));
    const good = summarizeExecution(computeExecutionProfile(profileInput(EXCEPTIONAL)));
    expect(bad.rating).toBe('catastrophic');
    expect(bad.stars).toBe(1);
    // Earned upside reaches the strong/exceptional tiers (4-5 stars).
    expect(good.stars).toBeGreaterThanOrEqual(4);
  });

  it('names the causes behind the outcome, strongest first', () => {
    const s = summarizeExecution(computeExecutionProfile(profileInput(CATASTROPHIC)));
    expect(s.causes.length).toBeGreaterThan(0);
    expect(s.causes[0].direction).toBe('negative');
    expect(s.causes[0].text).toContain('morale'); // the -9 performances event is strongest
  });

  it('exposes no raw internal stat values in any player-facing string', () => {
    const s = summarizeExecution(computeExecutionProfile(profileInput(CATASTROPHIC)));
    const strings = [s.headline, s.detail, ...s.causes.map((c) => c.text)];
    for (const str of strings) {
      // No bare decimals (e.g. multiplier "0.72") leaking into prose.
      expect(str).not.toMatch(/\d\.\d/);
    }
    // The numeric modifiers still exist, but only in the dedicated block.
    expect(typeof s.modifiers.performanceCapture).toBe('number');
  });
});

describe('finished film - real, explainable, deterministic leverage', () => {
  const base = quality([]);

  it('(1) a catastrophic production history materially lowers the finished film', () => {
    const drop = base - quality(CATASTROPHIC, { talent: withReliability(draftTalent(), 20) });
    expect(drop).toBeGreaterThan(8);
  });

  it('(2) an exceptional production history improves the finished film', () => {
    expect(quality(EXCEPTIONAL)).toBeGreaterThan(base + 3);
  });

  it('(3) Production execution now has substantial leverage (the old flat fold-in moved quality ~<2 pts)', () => {
    const spread = quality(EXCEPTIONAL) - quality(CATASTROPHIC, { talent: withReliability(draftTalent(), 20) });
    expect(spread).toBeGreaterThan(12);
  });

  it('(4) identical pre-production inputs with different shoot histories produce different films', () => {
    expect(quality(CATASTROPHIC)).not.toBeCloseTo(quality(EXCEPTIONAL), 1);
    expect(quality(CATASTROPHIC)).not.toBeCloseTo(base, 1);
  });

  it('(5) no release-time jitter - identical history + different rng => identical scores', () => {
    const a = computeReleaseResults(releaseInput(CATASTROPHIC), createRng(1)).results;
    const b = computeReleaseResults(releaseInput(CATASTROPHIC), createRng(999)).results;
    expect(a.qualityScore).toBe(b.qualityScore);
    expect(a.criticScore).toBe(b.criticScore);
    expect(a.audienceScore).toBe(b.audienceScore);
  });

  it('(6) reliability mitigates a rough shoot - the reliable production ships the better film', () => {
    const reliable = quality(CATASTROPHIC, { talent: withReliability(draftTalent(), 95) });
    const flaky = quality(CATASTROPHIC, { talent: withReliability(draftTalent(), 10) });
    expect(reliable).toBeGreaterThan(flaky);
  });

  it('(9) the execution outcome is attached to results and survives a JSON round-trip', () => {
    const results = computeReleaseResults(releaseInput(CATASTROPHIC), createRng(1)).results;
    expect(results.productionExecution).toBeDefined();
    const roundTripped = JSON.parse(JSON.stringify(results.productionExecution));
    expect(roundTripped).toEqual(results.productionExecution);
    expect(roundTripped.causes.length).toBeGreaterThan(0);
  });
});
