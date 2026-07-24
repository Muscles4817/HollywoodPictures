import { describe, it, expect } from 'vitest';
import { computeFilmCostBreakdown } from './cost';
import { computeReleaseResults, type ReleaseComputationInput } from './releaseFilm';
import { buildReadyDraft } from '../state/testFixtures';
import { createRng, withRng } from './random';
import type { ChannelSpend } from './marketing';

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

function channels(partial: Partial<ChannelSpend>): ChannelSpend {
  return { trailers: 0, tv: 0, digital: 0, press: 0, ...partial };
}

function breakdownFor(input: ReleaseComputationInput) {
  return computeFilmCostBreakdown({
    talent: input.talent,
    productionChoices: input.productionChoices,
    photographyCost: input.photographyCost,
    events: input.events,
    postProductionEvents: input.postProductionEvents,
    marketingChoices: input.marketingChoices,
  });
}

describe('computeFilmCostBreakdown', () => {
  it('itemised terms sum to their subtotals and the total', () => {
    const b = breakdownFor(baseInput());
    expect(b.talent + b.productionBudget + b.photography + b.onSetEvents + b.postProductionInterventions + b.producerFees).toBe(
      b.productionCost,
    );
    expect(b.channelCampaign + b.pressTour).toBe(b.marketingCost);
    expect(b.productionCost + b.marketingCost).toBe(b.totalCost);
  });

  it('reconciles exactly with the totals computeReleaseResults charges (no drift)', () => {
    const input = { ...baseInput(), marketingChoices: { ...baseInput().marketingChoices, channelSpend: channels({ trailers: 20_000_000, tv: 5_000_000 }) } };
    const { results } = computeReleaseResults(input, createRng(1));
    const b = breakdownFor(input);
    expect(b.productionCost).toBe(results.productionCost);
    expect(b.marketingCost).toBe(results.marketingCost);
    expect(b.totalCost).toBe(results.totalCost);
  });

  it('folds producer fees and a cost multiplier into the production subtotal', () => {
    const input = baseInput();
    const neutral = breakdownFor(input);
    const withProducers = computeFilmCostBreakdown({
      talent: input.talent,
      productionChoices: input.productionChoices,
      photographyCost: input.photographyCost,
      events: input.events,
      postProductionEvents: input.postProductionEvents,
      marketingChoices: input.marketingChoices,
      productionCostMultiplier: 0.9,
      producerFees: 500_000,
    });
    expect(withProducers.producerFees).toBe(500_000);
    expect(withProducers.productionBudget).toBe(Math.round(neutral.productionBudget * 0.9));
    expect(withProducers.productionCost).toBe(withProducers.talent + withProducers.productionBudget + withProducers.photography + withProducers.onSetEvents + withProducers.postProductionInterventions + 500_000);
  });

  it('a distributor deal zeroes the studio channel cost, leaving only the press tour', () => {
    const input = baseInput();
    const dealMarketing = { ...input.marketingChoices, distributionPAndA: 40_000_000 };
    const b = computeFilmCostBreakdown({
      talent: input.talent,
      productionChoices: input.productionChoices,
      photographyCost: input.photographyCost,
      events: input.events,
      postProductionEvents: input.postProductionEvents,
      marketingChoices: dealMarketing,
    });
    expect(b.onDistributorDeal).toBe(true);
    expect(b.channelCampaign).toBe(0);
    expect(b.marketingCost).toBe(b.pressTour);
  });
});
