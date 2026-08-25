import { describe, it, expect } from 'vitest';
import { createRng } from './random';
import { buildReadyDraft } from '../state/testFixtures';
import {
  deliveryStanding,
  describeDeliveryStanding,
  estimateDelivery,
  standingWorsens,
} from './deliveryEstimate';
import type { FilmDraft } from '../types';

const TODAY = 400;

/** A draft that has NOT shot yet - the state a development decision is actually taken in. */
function inDevelopment(overrides: Partial<FilmDraft> = {}): FilmDraft {
  const draft = buildReadyDraft(createRng(11));
  return {
    ...draft,
    photography: null,
    preProduction: null,
    postProductionFinalReadyDay: null,
    postProductionScreeningReadyDay: null,
    testScreeningResolved: false,
    ...overrides,
  };
}

describe('estimateDelivery', () => {
  it('projects the whole remaining pipeline for a film that has not started', () => {
    const estimate = estimateDelivery(inDevelopment(), TODAY);
    expect(estimate.remaining.map((s) => s.label)).toEqual([
      'Pre-production',
      'Principal photography',
      'Post-production',
    ]);
    expect(estimate.readyOnDay).toBeGreaterThan(TODAY);
    // Nothing announced, so there is no promise to be early or late for.
    expect(estimate.slackDays).toBeNull();
    expect(deliveryStanding(estimate)).toBe('no-claim');
  });

  it('does not charge a shot film for prep or photography again', () => {
    const shot = inDevelopment({
      preProduction: { status: 'finished', recommendedDays: 30, daysElapsed: 30, events: [], runningCost: 0, pendingChoice: null },
      photography: { status: 'finished', recommendedDays: 40, daysElapsed: 40, events: [], runningCost: 0, pendingChoice: null },
    });
    expect(estimateDelivery(shot, TODAY).remaining.map((s) => s.label)).toEqual(['Post-production']);
  });

  it('counts a development pass in flight against the date', () => {
    const draft = inDevelopment();
    const without = estimateDelivery(draft, TODAY);
    const withPass = estimateDelivery(draft, TODAY, TODAY + 30);
    // The whole point of the module: the rewrite shows up in the release date.
    expect(withPass.readyOnDay - without.readyOnDay).toBe(30);
    expect(withPass.remaining[0]).toEqual({ label: 'Rewrite in progress', days: 30 });
  });

  it('ignores a pass that has already landed', () => {
    const draft = inDevelopment();
    expect(estimateDelivery(draft, TODAY, TODAY - 5).remaining[0].label).toBe('Pre-production');
  });

  it('still estimates before Production Planning, and says the plan was assumed', () => {
    // The case that matters most - a date announced pre-greenlight is exactly
    // when "one more rewrite" is tempting. Refusing to estimate here would
    // silence the warning in the only window it exists for.
    const unplanned = inDevelopment({ productionChoices: null, talent: [] });
    const estimate = estimateDelivery(unplanned, TODAY);
    expect(estimate.provisional).toBe(true);
    expect(estimate.readyOnDay).toBeGreaterThan(TODAY);
    expect(estimate.remaining.length).toBe(3);
  });

  it('is not provisional once the production has actually been planned', () => {
    expect(estimateDelivery(inDevelopment(), TODAY).provisional).toBe(false);
  });

  it('assumes the SCRIPT\'s own recommended plan, not a guess from its scale', () => {
    // Post-production is dominated by VFX, and scale says how big the cast and
    // the locations are - not how effects-led the film is. Guessing effects from
    // scale told an Epic period drama its post ran the better part of a year.
    // Two scripts of the same scale with different effects recommendations must
    // therefore project different post-production lengths.
    const base = buildReadyDraft(createRng(11));
    const script = base.script!;
    const unplanned = (effectsAmbition: number): FilmDraft => ({
      ...base,
      preProduction: null,
      photography: null,
      postProductionFinalReadyDay: null,
      postProductionScreeningReadyDay: null,
      testScreeningResolved: false,
      productionChoices: null,
      script: { ...script, effectsAmbition, effectsStrategy: { practical: 0.2, digital: 0.8 } },
    });
    const postOf = (draft: FilmDraft) =>
      estimateDelivery(draft, TODAY).remaining.find((step) => step.label === 'Post-production')!.days;

    expect(postOf(unplanned(0.9))).toBeGreaterThan(postOf(unplanned(0.1)));
  });
});

describe('deliveryStanding', () => {
  const draft = inDevelopment();
  const bare = estimateDelivery(draft, TODAY);

  const withAnnouncement = (slack: number) =>
    estimateDelivery({ ...draft, announcedReleaseDay: bare.readyOnDay + slack }, TODAY);

  it('reads the ladder from comfortable to missed', () => {
    expect(deliveryStanding(withAnnouncement(200))).toBe('comfortable');
    expect(deliveryStanding(withAnnouncement(30))).toBe('tight');
    expect(deliveryStanding(withAnnouncement(5))).toBe('at-risk');
    expect(deliveryStanding(withAnnouncement(-1))).toBe('missed');
  });

  it('describes each standing in words, never a number', () => {
    for (const slack of [200, 30, 5, -1]) {
      const text = describeDeliveryStanding(withAnnouncement(slack));
      expect(text).not.toMatch(/\d/);
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

describe('standingWorsens', () => {
  const draft = inDevelopment();
  const bare = estimateDelivery(draft, TODAY);
  const announced = { ...draft, announcedReleaseDay: bare.readyOnDay + 20 };

  it('is true when a long pass pushes a tight date out of reach', () => {
    const before = estimateDelivery(announced, TODAY);
    const after = estimateDelivery(announced, TODAY, TODAY + 60);
    expect(standingWorsens(before, after)).toBe(true);
  });

  it('is false when there is slack to absorb the pass', () => {
    const roomy = { ...draft, announcedReleaseDay: bare.readyOnDay + 400 };
    const before = estimateDelivery(roomy, TODAY);
    const after = estimateDelivery(roomy, TODAY, TODAY + 30);
    expect(standingWorsens(before, after)).toBe(false);
  });

  it('never fires when nothing has been announced - there is no date to lose', () => {
    expect(standingWorsens(estimateDelivery(draft, TODAY), estimateDelivery(draft, TODAY, TODAY + 200))).toBe(false);
  });
});
