import { describe, it, expect } from 'vitest';
import { computeReleaseResults, type ReleaseComputationInput } from './releaseFilm';
import { buildReadyDraft } from '../state/testFixtures';
import { createRng, withRng } from './random';
import type { ChannelSpend } from './marketing';
import type { ProductionChoices } from '../types';

function baseInput(): ReleaseComputationInput {
  const { result: draft } = withRng(2024, (rng) => buildReadyDraft(rng));
  return {
    title: draft.title || 'Untitled',
    genre: draft.genre!,
    targetAudience: draft.targetAudience!, // 'Mass Market'
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

const base = baseInput();

function release(marketing: Partial<ReleaseComputationInput['marketingChoices']>) {
  return computeReleaseResults({ ...base, marketingChoices: { ...base.marketingChoices, ...marketing } }, createRng(1));
}

describe('computeReleaseResults - marketing channels', () => {
  it('is unchanged when no campaign is built (falls back to the flat marketingSpend)', () => {
    const fallback = computeReleaseResults(base, createRng(1)).results;
    const explicitAbsent = computeReleaseResults({ ...base, marketingChoices: { ...base.marketingChoices, channelSpend: undefined, campaignAngle: undefined } }, createRng(1)).results;
    expect(explicitAbsent).toEqual(fallback);
  });

  it('a well-matched channel mix opens bigger than a poorly-matched one for the same spend', () => {
    // Mass Market: trailers fit perfectly (1.0), press poorly (0.4).
    const matched = release({ channelSpend: channels({ trailers: 20_000_000 }) }).results.openingWeekend;
    const mismatched = release({ channelSpend: channels({ press: 20_000_000 }) }).results.openingWeekend;
    expect(matched).toBeGreaterThan(mismatched);
  });
});

describe('computeReleaseResults - campaign angle', () => {
  const withChannels = { channelSpend: channels({ trailers: 20_000_000 }) };

  it('a loud angle opens bigger than an honest one', () => {
    const spectacle = release({ ...withChannels, campaignAngle: 'spectacle' }).results.openingWeekend;
    const faithful = release({ ...withChannels, campaignAngle: 'faithful' }).results.openingWeekend;
    expect(spectacle).toBeGreaterThan(faithful);
  });

  it('the angle never changes the *reported* audience score', () => {
    const spectacle = release({ ...withChannels, campaignAngle: 'spectacle' }).results.audienceScore;
    const faithful = release({ ...withChannels, campaignAngle: 'faithful' }).results.audienceScore;
    expect(spectacle).toBe(faithful);
  });

  it('overselling a film that cannot deliver saps the sim word-of-mouth (worse legs)', () => {
    // A no-budget production can't back up a Spectacle campaign (production score
    // well below the promise), so the legs penalty bites.
    const noBudget: ProductionChoices = { contingencyAmount: 0, setQualityAmount: 0, practicalEffectsAmount: 0, vfxAmount: 0, runtimeIntensity: 0 };
    const oversell = computeReleaseResults({ ...base, productionChoices: noBudget, marketingChoices: { ...base.marketingChoices, ...withChannels, campaignAngle: 'spectacle' } }, createRng(1));
    const honest = computeReleaseResults({ ...base, productionChoices: noBudget, marketingChoices: { ...base.marketingChoices, ...withChannels, campaignAngle: 'faithful' } }, createRng(1));
    // The sim's audience (word-of-mouth) score is dragged down for the oversell...
    expect(oversell.fixed.audienceScore).toBeLessThan(honest.fixed.audienceScore);
    // ...but the reported score is identical.
    expect(oversell.results.audienceScore).toBe(honest.results.audienceScore);
  });
});
