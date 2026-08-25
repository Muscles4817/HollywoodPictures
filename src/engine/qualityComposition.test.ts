// The quality blend's COMPOSITION (docs/DESIGN_REVIEW_reception_model.md §4).
//
// computeQualityBreakdown used to end in a plain convex combination of four
// departments. That is the single largest reason the finished film was
// near-deterministic: measured on one fixed plan across 240 execution seeds the
// shoot swung the departments hard (executedActing SD 4.8 over a 23-point
// range, executedPostProduction SD 5.7 over 27 points) and the mean turned that
// into a qualityScore SD of 1.5.
//
// These tests pin the properties that replaced it, so a future retune has to
// break them deliberately rather than by accident.
import { describe, it, expect } from 'vitest';
import { computeQualityBreakdown } from './scoring';
import { buildReadyDraft } from '../state/testFixtures';
import { withRng } from './random';
import type { ExecutionProfile } from './productionExecution';
import type { CraftFacet } from '../types';

const draft = withRng(1, (rng) => buildReadyDraft(rng)).result;

const NO_SIGNALS: Record<CraftFacet, number> = { sets: 0, vfx: 0, practical: 0 };

/** A synthetic execution profile - the point is to drive each channel independently, which a rolled shoot cannot. */
function execution(over: Partial<ExecutionProfile> = {}): ExecutionProfile {
  return {
    performanceCapture: 1, postExecution: 1, scriptExecution: 1, coverageRatio: 1,
    facetSignals: NO_SIGNALS, overall: 0, resilience: 0.3, contributions: [],
    ...over,
  };
}

function quality(ex: ExecutionProfile): number {
  return computeQualityBreakdown(
    draft.script!, draft.talent, draft.genre!, draft.productionChoices!, draft.postProductionChoices!, [], 1, 0, ex,
  ).qualityScore;
}

describe('quality composition', () => {
  it('is deterministic - the same inputs always produce the same film', () => {
    expect(quality(execution({ performanceCapture: 0.82 }))).toBe(quality(execution({ performanceCapture: 0.82 })));
  });

  it('punishes damage CONCENTRATED in one department more than the same damage spread across two', () => {
    // A mean cannot tell these apart; a weakest-link term can. The concentrated
    // shoot ruined the performances outright, the spread one merely bruised two
    // departments - the first is the more legible failure and scores lower.
    const concentrated = quality(execution({ performanceCapture: 0.7, scriptExecution: 1 }));
    const spread = quality(execution({ performanceCapture: 0.85, scriptExecution: 0.85 }));
    expect(concentrated).toBeLessThan(spread);
  });

  it('lets post-production REALISE the footage rather than averaging against it', () => {
    // Multiplicative, not a weighted summand: the same proportional collapse in
    // the edit costs a better film MORE absolute points than a weaker one. An
    // additive term would cost both the same.
    const strongFilmDrop = quality(execution({ scriptExecution: 1.1 })) - quality(execution({ scriptExecution: 1.1, postExecution: 0.6 }));
    const weakFilmDrop = quality(execution({ scriptExecution: 0.85 })) - quality(execution({ scriptExecution: 0.85, postExecution: 0.6 }));
    expect(strongFilmDrop).toBeGreaterThan(weakFilmDrop);
  });

  it('lets a bad edit squander footage far more than a good one can improve on it', () => {
    // The asymmetry the dependency chain already asserts in words ("an editor
    // cannot cut footage that was never shot").
    //
    // Directional only. An earlier version of this test pinned the ratio at
    // 1.5x, which was invented rather than derived - and it then blocked
    // restoring enough upside for productionExecution.test.ts's ratified
    // leverage tests, which require an exceptional shoot to visibly improve the
    // finished film. The principle is that a bad edit costs more than a good
    // one gains; the exact multiple is not something this file has grounds to
    // fix. Measured ratio at the current constants: ~1.2x.
    const neutral = quality(execution());
    const gained = quality(execution({ postExecution: 1.14 })) - neutral;
    const lost = neutral - quality(execution({ postExecution: 0.86 }));
    expect(lost).toBeGreaterThan(gained);
  });

  it('transmits a shoot that ruined ONE department, which a mean would average away', () => {
    // Where the change actually pays. Uniform damage is the case a weighted
    // mean already handled: an all-departments-down profile moved this film
    // 15.2 points under the old convex combination and 17.2 under this blend, a
    // marginal gain. DISPERSED damage is what a mean cannot see, and it is what
    // a real shoot produces - one department craters while the others hold.
    // Measured on a fixed plan over 240 real execution seeds, the change lifted
    // qualityScore SD from 1.54 to 2.33.
    const evenlyBruised = quality(execution({ performanceCapture: 0.9, scriptExecution: 0.9 }));
    const oneCollapsed = quality(execution({ performanceCapture: 0.6, scriptExecution: 1.05 }));
    // Measured 3.79 at the current constants.
    expect(evenlyBruised - oneCollapsed).toBeGreaterThan(3);
  });

  it('keeps the blend from drifting off its calibrated level', () => {
    // The guard on QUALITY_SHAPE_RECENTRE / QUALITY_COMPOSITION_LEVEL. Both
    // one-sided shaping terms and the three-component core sit at a different
    // level than the four-component mean they replaced, so both are re-levelled
    // by MEASURED constants. If this fails after a retune, re-derive them - do
    // not widen the band. audienceScore feeds a convex word-of-mouth multiplier,
    // so level drift here fans out the whole box-office distribution
    // (docs/DESIGN_box_office_calibration_targets.md).
    //
    // This fixture film measures 41.7 with an undisrupted shoot. Individual
    // films DO move under the new blend (this one was 45.7 before); what is
    // preserved is the slate MEDIAN, re-levelled onto the old one.
    const neutral = quality(execution());
    expect(neutral).toBeGreaterThan(35);
    expect(neutral).toBeLessThan(50);
  });
});
