// Critic and audience as two DIFFERENT readings of the same film
// (docs/DESIGN_REVIEW_reception_model.md §3).
//
// Both scores used to be affine in qualityScore (weights 0.78 and 0.50), which
// made them near-collinear by construction and as narrow as the blend feeding
// them - criticScore SD 7.5 against a real-world figure near 17. They are now
// an anchor plus signed deviations, and four terms carry OPPOSITE signs between
// the voices. These tests pin that inversion: it is the mechanism that lets a
// critic-adored/audience-rejected film exist at all.
import { describe, it, expect } from 'vitest';
import { computeAudienceScore, computeCriticScore, computeQualityBreakdown } from './scoring';
import { buildReadyDraft } from '../state/testFixtures';
import { withRng } from './random';
import type { Script } from '../types';

const draft = withRng(1, (rng) => buildReadyDraft(rng)).result;
const baseScript = draft.script!;

function scores(over: Partial<Script> = {}, postBonus = 0) {
  const script: Script = { ...baseScript, ...over };
  const quality = computeQualityBreakdown(
    script, draft.talent, draft.genre!, draft.productionChoices!, draft.postProductionChoices!, [], 1, postBonus,
  );
  return {
    quality: quality.qualityScore,
    critic: computeCriticScore(quality, script, draft.postProductionChoices!, draft.genre!),
    audience: computeAudienceScore(
      quality, script, draft.talent, draft.genre!, draft.productionChoices!, draft.postProductionChoices!, 'Mass Market',
    ),
  };
}

describe('reception divergence', () => {
  it('is deterministic - identical inputs always yield the identical film', () => {
    expect(scores({ originality: 88 })).toEqual(scores({ originality: 88 }));
  });

  it('reads originality with OPPOSITE signs: a formula picture is a critic problem and an audience comfort', () => {
    const original = scores({ originality: 95 });
    const formulaic = scores({ originality: 30 });
    // Critics punish the film with nothing to say...
    expect(original.critic).toBeGreaterThan(formulaic.critic);
    // ...while the audience takes the familiar one on its own terms.
    expect(formulaic.audience).toBeGreaterThan(original.audience);
  });

  it('treats ambition as a BET, not a purchase - the same originality cuts both ways on execution', () => {
    // The defect this replaced: `+ originality * 0.14` paid out regardless of
    // whether the film worked, making critical esteem buyable. Now a
    // distinctive film that came off is a major work and one that did not is a
    // pretension - and the gap between them exceeds the quality gap alone.
    const landed = scores({ originality: 95 }, 12);
    const missed = scores({ originality: 95 }, -12);
    const safeLanded = scores({ originality: 40 }, 12);
    const safeMissed = scores({ originality: 40 }, -12);
    expect(landed.critic - missed.critic).toBeGreaterThan(safeLanded.critic - safeMissed.critic);
  });

  it('charges critics franchise fatigue while the audience pays a franchise premium', () => {
    const sequel = scores({ franchiseRecognition: 85 });
    const original = scores({ franchiseRecognition: 0 });
    expect(sequel.critic).toBeLessThan(original.critic);
    expect(sequel.audience).toBeGreaterThanOrEqual(original.audience);
  });

  it('gives a narrow target audience a kinder crowd - self-selection, not quality', () => {
    // Why CinemaScore has almost nothing below a C: the people polled chose the
    // ticket. It also makes target audience a genuine trade-off rather than a
    // free reach lever.
    const script = baseScript;
    const quality = computeQualityBreakdown(
      script, draft.talent, draft.genre!, draft.productionChoices!, draft.postProductionChoices!, [], 1, 0,
    );
    const args = [quality, script, draft.talent, draft.genre!, draft.productionChoices!, draft.postProductionChoices!] as const;
    expect(computeAudienceScore(...args, 'Niche')).toBeGreaterThan(computeAudienceScore(...args, 'Mass Market'));
  });

  it('keeps the two voices correlated but not collinear', () => {
    // A good film is a good film - craft still anchors both. What differs is
    // everything else they read. Dropping the audience's craft gain decorrelated
    // them far past the real-world ~0.7.
    const good = scores({}, 15);
    const bad = scores({}, -15);
    expect(good.critic).toBeGreaterThan(bad.critic);
    expect(good.audience).toBeGreaterThan(bad.audience);
  });
});
