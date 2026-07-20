import { describe, it, expect } from 'vitest';
import { computeReleaseResults, type ReleaseComputationInput } from './releaseFilm';
import { NEUTRAL_PRODUCER_EFFECTS, mitigateEventQualityImpact } from './producers';
import { buildReadyDraft } from '../state/testFixtures';
import { createRng, withRng } from './random';
import type { ProductionEvent } from '../types';

/** A baseline release input built from a ready draft (built once, so the only thing that varies across a test is the producer field). */
function baseInput(): ReleaseComputationInput {
  const { result } = withRng(2024, (rng) => buildReadyDraft(rng));
  const draft = result;
  return {
    title: draft.title || 'Untitled',
    genre: draft.genre!,
    targetAudience: draft.targetAudience!,
    script: draft.script!,
    talent: draft.talent,
    productionChoices: draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!,
    marketingChoices: draft.marketingChoices!,
    events: draft.photography!.events,
    postProductionEvents: draft.postProductionEvents,
    photographyCost: draft.photography!.runningCost,
    shootingRatio: 1,
    studioBrand: 20,
    competitiveCrowding: 0,
  };
}

// Same seed for both calls so anything that reads rng (blurbs, story report)
// is identical - only the producer input differs.
function results(input: ReleaseComputationInput) {
  return computeReleaseResults(input, createRng(7)).results;
}

describe('computeReleaseResults - producer effects', () => {
  const base = baseInput();
  const baseline = results(base);

  it('with no producer input, results are identical to explicit NEUTRAL effects and zero fees', () => {
    const explicit = results({ ...base, producerEffects: NEUTRAL_PRODUCER_EFFECTS, producerFees: 0 });
    expect(explicit).toEqual(baseline);
  });

  it('per-film fees add to productionCost and totalCost, exactly', () => {
    const withFees = results({ ...base, producerFees: 500_000 });
    expect(withFees.productionCost).toBe(baseline.productionCost + 500_000);
    expect(withFees.totalCost).toBe(baseline.totalCost + 500_000);
  });

  it('Line (productionCostMultiplier) reduces productionCost', () => {
    const withLine = results({ ...base, producerEffects: { ...NEUTRAL_PRODUCER_EFFECTS, productionCostMultiplier: 0.5 } });
    expect(withLine.productionCost).toBeLessThan(baseline.productionCost);
  });

  it('Creative (postProductionDelta) lifts the post-production sub-score and overall quality', () => {
    const withCreative = results({ ...base, producerEffects: { ...NEUTRAL_PRODUCER_EFFECTS, postProductionDelta: 8 } });
    expect(withCreative.postProductionScore).toBeGreaterThan(baseline.postProductionScore);
    expect(withCreative.qualityScore).toBeGreaterThan(baseline.qualityScore);
  });

  it('Executive (flat Buzz + marketing efficiency) lifts Buzz and does not lower the opening', () => {
    const withExec = results({
      ...base,
      producerEffects: { ...NEUTRAL_PRODUCER_EFFECTS, flatBuzzDelta: 10, marketingEfficiencyMultiplier: 1.3 },
    });
    expect(withExec.buzzScore).toBeGreaterThan(baseline.buzzScore);
    expect(withExec.openingWeekend).toBeGreaterThanOrEqual(baseline.openingWeekend);
  });

  it('Fixer (event mitigation) softens a bad shoot: quality recovers, cost is untouched', () => {
    const badEvent: ProductionEvent = {
      id: 'disaster',
      description: 'A rig fell.',
      severity: 'high',
      costDelta: 400_000,
      qualityDelta: -30,
      buzzDelta: -5,
      delayDaysDelta: 2,
    };
    const withBadEvent = { ...base, events: [badEvent] };
    const noFixer = results(withBadEvent);
    const withFixer = results({ ...withBadEvent, producerEffects: { ...NEUTRAL_PRODUCER_EFFECTS, eventNegativeImpactMultiplier: 0.4 } });
    // Events fold into overall quality (not the raw production sub-score), so a
    // softened disaster shows up as a higher qualityScore.
    expect(withFixer.qualityScore).toBeGreaterThan(noFixer.qualityScore); // quality damage softened
    expect(withFixer.productionCost).toBe(noFixer.productionCost); // costs deliberately untouched
  });
});

describe('mitigateEventQualityImpact', () => {
  const events: ProductionEvent[] = [
    { id: 'bad', description: 'Bad', severity: 'high', costDelta: 100_000, qualityDelta: -20, buzzDelta: 0, delayDaysDelta: 0 },
    { id: 'good', description: 'Good', severity: 'low', costDelta: -50_000, qualityDelta: 15, buzzDelta: 0, delayDaysDelta: 0 },
  ];

  it('softens negative qualityDelta only, leaving positives and all costs untouched', () => {
    const [bad, good] = mitigateEventQualityImpact(events, 0.5);
    expect(bad.qualityDelta).toBe(-10); // -20 * 0.5
    expect(bad.costDelta).toBe(100_000); // untouched
    expect(good.qualityDelta).toBe(15); // positive untouched
    expect(good.costDelta).toBe(-50_000);
  });

  it('is a no-op at multiplier >= 1 (returns the same reference)', () => {
    expect(mitigateEventQualityImpact(events, 1)).toBe(events);
  });
});
