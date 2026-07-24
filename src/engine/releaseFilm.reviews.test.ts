import { describe, it, expect } from 'vitest';
import { computeReleaseResults, type ReleaseComputationInput } from './releaseFilm';
import { buildReadyDraft } from '../state/testFixtures';
import { createRng, withRng } from './random';

function baseInput(): ReleaseComputationInput {
  const { result: draft } = withRng(2024, (rng) => buildReadyDraft(rng));
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

describe('computeReleaseResults - criticReviews/audienceReviews (Premiere Reveal)', () => {
  it('populates three individually-rated quotes on each side', () => {
    const { results } = computeReleaseResults(baseInput(), createRng(7));
    expect(results.criticReviews).toHaveLength(3);
    expect(results.audienceReviews).toHaveLength(3);
  });

  it("each quote's score tracks either the film's overall reception or the department it calls out", () => {
    // Since the redesign, a quote is either an overall-impression line (score
    // near criticScore/audienceScore) or a department-anchored one (score near
    // that department's own score) - never an arbitrary number. Every quote
    // sits within the jitter band of one of those real signals.
    const { results } = computeReleaseResults(baseInput(), createRng(11));
    const departmentScores = [
      results.scriptScore,
      results.directionScore,
      results.actingScore,
      results.productionScore,
      results.postProductionScore,
    ];
    const nearSomeSignal = (score: number, overall: number) =>
      [overall, ...departmentScores].some((signal) => Math.abs(score - signal) <= 8);

    for (const quote of results.criticReviews!) {
      expect(nearSomeSignal(quote.score, results.criticScore)).toBe(true);
    }
    for (const quote of results.audienceReviews!) {
      expect(nearSomeSignal(quote.score, results.audienceScore)).toBe(true);
    }
  });

  it('leaves the existing reviewBlurbs field untouched - both systems coexist', () => {
    const { results } = computeReleaseResults(baseInput(), createRng(3));
    expect(results.reviewBlurbs.length).toBeGreaterThan(0);
  });
});
