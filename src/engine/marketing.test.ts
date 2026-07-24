import { describe, it, expect } from 'vitest';
import {
  campaignAngleEffect,
  campaignRolloutProgress,
  campaignRolloutWeeks,
  effectiveMarketingReach,
  marketingRolloutMultiplier,
  rolloutMomentum,
  totalMarketingSpend,
  type ChannelSpend,
} from './marketing';
import { CAMPAIGN_FULL_ROLLOUT_WEEKS, CAMPAIGN_MOMENTUM_BONUS, CHANNEL_SPEND_MAX, OPENING_HYPE_SCALE } from '../data/marketing';
import { MARKETING_SPEND_RANGE } from '../data/release';

function spend(partial: Partial<ChannelSpend>): ChannelSpend {
  return { trailers: 0, tv: 0, digital: 0, press: 0, ...partial };
}

describe('CHANNEL_SPEND_MAX (per-category dial ceilings)', () => {
  it('caps the four dials near the campaign-wide ceiling, not ~1.6x over it', () => {
    const sum = CHANNEL_SPEND_MAX.tv + CHANNEL_SPEND_MAX.trailers + CHANNEL_SPEND_MAX.digital + CHANNEL_SPEND_MAX.press;
    // The old uniform $60M cap summed to $240M, ~1.6x the $150M ceiling the
    // awareness pipeline treats as the real-world top. The rebalanced caps sit
    // within a modest band of that ceiling.
    expect(sum).toBeLessThanOrEqual(MARKETING_SPEND_RANGE.max * 1.1);
    expect(sum).toBeGreaterThanOrEqual(MARKETING_SPEND_RANGE.max * 0.9);
  });

  it('ranks the categories the way real P&A does - TV the largest, press the smallest', () => {
    expect(CHANNEL_SPEND_MAX.tv).toBeGreaterThanOrEqual(CHANNEL_SPEND_MAX.trailers);
    expect(CHANNEL_SPEND_MAX.trailers).toBeGreaterThanOrEqual(CHANNEL_SPEND_MAX.digital);
    expect(CHANNEL_SPEND_MAX.digital).toBeGreaterThan(CHANNEL_SPEND_MAX.press);
    expect(CHANNEL_SPEND_MAX.press).toBe(Math.min(...Object.values(CHANNEL_SPEND_MAX)));
  });
});

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

describe('campaignRolloutWeeks', () => {
  it('is zero for a same-day (or earlier) release and never negative', () => {
    expect(campaignRolloutWeeks(100, 100)).toBe(0);
    expect(campaignRolloutWeeks(100, 90)).toBe(0);
  });

  it('counts whole weeks of runway between commit and release', () => {
    expect(campaignRolloutWeeks(100, 100 + 7)).toBe(1);
    expect(campaignRolloutWeeks(100, 100 + 28)).toBe(4);
  });
});

describe('rolloutMomentum', () => {
  it('is exactly neutral (1.0) at zero runway - a rushed release, the baseline', () => {
    expect(rolloutMomentum(0)).toBe(1);
  });

  it('reaches the full momentum bonus at (and past) a full rollout, and never exceeds it', () => {
    expect(rolloutMomentum(CAMPAIGN_FULL_ROLLOUT_WEEKS)).toBeCloseTo(1 + CAMPAIGN_MOMENTUM_BONUS, 6);
    expect(rolloutMomentum(CAMPAIGN_FULL_ROLLOUT_WEEKS * 3)).toBeCloseTo(1 + CAMPAIGN_MOMENTUM_BONUS, 6);
  });

  it('is monotonic and always a bonus (>= 1), never a penalty', () => {
    let prev = rolloutMomentum(0);
    for (let w = 1; w <= CAMPAIGN_FULL_ROLLOUT_WEEKS; w++) {
      const now = rolloutMomentum(w);
      expect(now).toBeGreaterThanOrEqual(prev);
      expect(now).toBeGreaterThanOrEqual(1);
      prev = now;
    }
  });

  it('is concave - the earliest weeks of runway buy more than the last ones', () => {
    const firstWeekGain = rolloutMomentum(1) - rolloutMomentum(0);
    const lastWeekGain = rolloutMomentum(CAMPAIGN_FULL_ROLLOUT_WEEKS) - rolloutMomentum(CAMPAIGN_FULL_ROLLOUT_WEEKS - 1);
    expect(firstWeekGain).toBeGreaterThan(lastWeekGain);
  });
});

describe('marketingRolloutMultiplier', () => {
  it('is neutral (1.0) when no campaign start day is known - rivals, old saves, projections', () => {
    expect(marketingRolloutMultiplier(undefined, 500)).toBe(1);
  });

  it('rewards holding a release for its campaign', () => {
    const rushed = marketingRolloutMultiplier(100, 100);
    const held = marketingRolloutMultiplier(100, 100 + CAMPAIGN_FULL_ROLLOUT_WEEKS * 7);
    expect(rushed).toBe(1);
    expect(held).toBeGreaterThan(rushed);
    expect(held).toBeCloseTo(1 + CAMPAIGN_MOMENTUM_BONUS, 6);
  });
});

describe('campaignRolloutProgress', () => {
  it('reports how far a campaign has run as of today', () => {
    const start = 100;
    const release = 100 + 10 * 7; // a 10-week rollout
    const mid = campaignRolloutProgress(start, release, start + 3 * 7);
    expect(mid.totalWeeks).toBe(10);
    expect(mid.weeksElapsed).toBe(3);
    expect(mid.fraction).toBeCloseTo(0.3, 6);
  });

  it('caps elapsed at the total once the release day has arrived (or passed)', () => {
    const start = 100;
    const release = 100 + 10 * 7;
    const done = campaignRolloutProgress(start, release, release + 50);
    expect(done.weeksElapsed).toBe(10);
    expect(done.fraction).toBe(1);
  });
});
