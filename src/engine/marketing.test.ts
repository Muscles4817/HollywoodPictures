import { describe, it, expect } from 'vitest';
import {
  campaignAngleEffect,
  effectiveMarketingReach,
  totalMarketingSpend,
  type ChannelSpend,
} from './marketing';
import { OPENING_HYPE_SCALE } from '../data/marketing';

function spend(partial: Partial<ChannelSpend>): ChannelSpend {
  return { trailers: 0, tv: 0, digital: 0, press: 0, ...partial };
}

describe('totalMarketingSpend', () => {
  it('sums every channel and ignores negatives', () => {
    expect(totalMarketingSpend(spend({ trailers: 1_000_000, tv: 500_000, digital: 250_000 }))).toBe(1_750_000);
    expect(totalMarketingSpend(spend({ trailers: -100, digital: 1000 }))).toBe(1000);
    expect(totalMarketingSpend(spend({}))).toBe(0);
  });
});

describe('effectiveMarketingReach', () => {
  const X = 5_000_000;

  it('no spend means no reach', () => {
    expect(effectiveMarketingReach(spend({}), 'Mass Market')).toBe(0);
  });

  it('a well-matched channel out-reaches a poorly-matched one for the same spend', () => {
    // For Teens: digital is a perfect fit (1.0), press a poor one (0.3).
    const viaDigital = effectiveMarketingReach(spend({ digital: X }), 'Teens');
    const viaPress = effectiveMarketingReach(spend({ press: X }), 'Teens');
    expect(viaDigital).toBeGreaterThan(viaPress);
  });

  it('the same channel fits different audiences differently (press: critics >> teens)', () => {
    expect(effectiveMarketingReach(spend({ press: X }), 'Critics')).toBeGreaterThan(
      effectiveMarketingReach(spend({ press: X }), 'Teens'),
    );
  });

  it('has diminishing returns within a channel', () => {
    const single = effectiveMarketingReach(spend({ trailers: X }), 'Mass Market');
    const double = effectiveMarketingReach(spend({ trailers: 2 * X }), 'Mass Market');
    expect(double).toBeGreaterThan(single);
    expect(double).toBeLessThan(2 * single); // concave
  });

  it('spreading across equally-fitting channels beats concentrating in one', () => {
    // Mass Market fits trailers and tv equally (1.0 each).
    const spread = effectiveMarketingReach(spend({ trailers: X, tv: X }), 'Mass Market');
    const concentrated = effectiveMarketingReach(spend({ trailers: 2 * X }), 'Mass Market');
    expect(spread).toBeGreaterThan(concentrated);
  });
});

describe('campaignAngleEffect', () => {
  it('faithful is neutral - no opening boost, no legs risk', () => {
    expect(campaignAngleEffect('faithful', 20)).toEqual({ openingMultiplier: 1, legsPenalty: 0 });
    expect(campaignAngleEffect('faithful', 95)).toEqual({ openingMultiplier: 1, legsPenalty: 0 });
  });

  it('a loud angle always lifts the opening, regardless of whether the film delivers', () => {
    const great = campaignAngleEffect('spectacle', 95);
    const weak = campaignAngleEffect('spectacle', 20);
    expect(great.openingMultiplier).toBeGreaterThan(1);
    expect(weak.openingMultiplier).toBe(great.openingMultiplier); // opening hype is independent of delivery
    expect(great.openingMultiplier).toBeCloseTo(1 + 1.0 * OPENING_HYPE_SCALE, 6); // spectacle hype is 1.0
  });

  it('a film that backs up its angle takes no legs penalty', () => {
    // spectacle promises 75; a film delivering 90 on production is honest enough.
    expect(campaignAngleEffect('spectacle', 90).legsPenalty).toBe(0);
  });

  it('overselling a weakness costs legs, and more so the bigger the shortfall', () => {
    const mild = campaignAngleEffect('spectacle', 60);
    const severe = campaignAngleEffect('spectacle', 20);
    expect(mild.legsPenalty).toBeGreaterThan(0);
    expect(severe.legsPenalty).toBeGreaterThan(mild.legsPenalty);
  });
});
