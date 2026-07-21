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

  it("each quote's score sits close to the film's own criticScore/audienceScore", () => {
    const { results } = computeReleaseResults(baseInput(), createRng(11));
    for (const quote of results.criticReviews!) {
      expect(Math.abs(quote.score - results.criticScore)).toBeLessThanOrEqual(8);
    }
    for (const quote of results.audienceReviews!) {
      expect(Math.abs(quote.score - results.audienceScore)).toBeLessThanOrEqual(8);
    }
  });

  it('leaves the existing reviewBlurbs field untouched - both systems coexist', () => {
    const { results } = computeReleaseResults(baseInput(), createRng(3));
    expect(results.reviewBlurbs.length).toBeGreaterThan(0);
  });
});
