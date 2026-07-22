import { describe, it, expect } from 'vitest';
import { computeReleaseResults, type ReleaseComputationInput } from './releaseFilm';
import { computePostProductionScore } from './scoring';
import { buildReadyDraft } from '../state/testFixtures';
import { createRng, withRng } from './random';

// Footage coverage caps the edit: an under-shot film (below the recommended
// schedule) can't be cut into a great one no matter how good the edit plan is,
// while a fully-shot film's edit is judged on its own merits.
function inputAt(shootingRatio: number): ReleaseComputationInput {
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
    shootingRatio,
    studioBrand: 20,
    competitiveCrowding: 0,
  };
}

describe('computeReleaseResults - footage coverage caps the edit', () => {
  it('an under-shot film scores a lower post-production (edit) score than a fully-shot one, all else equal', () => {
    const thin = computeReleaseResults(inputAt(0.6), createRng(1)).results;
    const full = computeReleaseResults(inputAt(1.2), createRng(1)).results;
    expect(thin.postProductionScore).toBeLessThan(full.postProductionScore);
  });

  it('at or above the recommended footage the edit is uncapped (its own raw score)', () => {
    const full = computeReleaseResults(inputAt(1), createRng(1)).results;
    const rawEdit = computePostProductionScore(inputAt(1).postProductionChoices);
    expect(full.postProductionScore).toBe(rawEdit);
  });
});
