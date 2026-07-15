import { describe, it, expect } from 'vitest';
import { computeBrandChange, computePrestigeChange, applyStatChange } from './reputation';

describe('computeBrandChange', () => {
  it('never reads criticScore - a profitable-but-panned film still grows Brand', () => {
    // $10m cost, $12m profit -> profitRatio 1.2, comfortably a positive-return
    // band regardless of how badly it reviewed (criticScore isn't even a param).
    const change = computeBrandChange({ profit: 12_000_000, totalCost: 10_000_000, totalBoxOffice: 20_000_000, audienceScore: 40 });
    expect(change).toBeGreaterThan(0);
  });

  it('a bigger loss produces a more negative change than a smaller loss', () => {
    const smallLoss = computeBrandChange({ profit: -1_000_000, totalCost: 10_000_000, totalBoxOffice: 20_000_000, audienceScore: 50 });
    const bigLoss = computeBrandChange({ profit: -8_000_000, totalCost: 10_000_000, totalBoxOffice: 20_000_000, audienceScore: 50 });
    expect(bigLoss).toBeLessThan(smallLoss);
  });

  it('audienceScore only nudges the result by a couple points, never flips a flop into a gain', () => {
    const lovedFlop = computeBrandChange({ profit: -5_000_000, totalCost: 10_000_000, totalBoxOffice: 5_000_000, audienceScore: 95 });
    expect(lovedFlop).toBeLessThan(0);
  });

  it('a bigger total box office (reach) produces a more positive change than a smaller one, holding profit ratio and audienceScore fixed', () => {
    const nicheHit = computeBrandChange({ profit: 5_000_000, totalCost: 10_000_000, totalBoxOffice: 20_000_000, audienceScore: 50 });
    const blockbusterHit = computeBrandChange({ profit: 5_000_000, totalCost: 10_000_000, totalBoxOffice: 800_000_000, audienceScore: 50 });
    expect(blockbusterHit).toBeGreaterThan(nicheHit);
  });
});

describe('computePrestigeChange', () => {
  it('never reads profit or audienceScore - only takes criticScore and qualityScore', () => {
    expect(computePrestigeChange({ criticScore: 90, qualityScore: 90 })).toBeGreaterThan(0);
    expect(computePrestigeChange({ criticScore: 10, qualityScore: 10 })).toBeLessThan(0);
  });

  it('weights criticScore above qualityScore - swapping which one is high vs low changes the result', () => {
    const criticHeavy = computePrestigeChange({ criticScore: 100, qualityScore: 0 });
    const qualityHeavy = computePrestigeChange({ criticScore: 0, qualityScore: 100 });
    expect(criticHeavy).toBeGreaterThan(qualityHeavy);
  });

  it('is NOT symmetric around a signal of 50 - it drops faster below 50 than it rises above it', () => {
    // Same distance from 50 (10 points either way), deliberately asymmetric bands.
    const belowFifty = computePrestigeChange({ criticScore: 40, qualityScore: 40 }); // signal 40 -> -1
    const aboveFifty = computePrestigeChange({ criticScore: 60, qualityScore: 60 }); // signal 60 -> 0
    expect(belowFifty).toBe(-1);
    expect(aboveFifty).toBe(0);
    expect(aboveFifty).not.toBe(-belowFifty);
  });

  it('never returns -0 (would fail a strict deep-equal after a JSON save/reload round-trip)', () => {
    const neutral = computePrestigeChange({ criticScore: 55, qualityScore: 55 });
    expect(neutral).toBe(0);
    expect(Object.is(neutral, -0)).toBe(false);
  });
});

describe('Brand/Prestige independence', () => {
  it('a beloved flop ("Cult Hit"-shaped: low profit, high critic/quality) grows Prestige while Brand falls', () => {
    const brandChange = computeBrandChange({ profit: -6_000_000, totalCost: 10_000_000, totalBoxOffice: 8_000_000, audienceScore: 55 });
    const prestigeChange = computePrestigeChange({ criticScore: 92, qualityScore: 88 });
    expect(brandChange).toBeLessThan(0);
    expect(prestigeChange).toBeGreaterThan(0);
  });

  it('a profitable-but-panned film grows Brand while Prestige falls', () => {
    const brandChange = computeBrandChange({ profit: 15_000_000, totalCost: 10_000_000, totalBoxOffice: 40_000_000, audienceScore: 45 });
    const prestigeChange = computePrestigeChange({ criticScore: 15, qualityScore: 20 });
    expect(brandChange).toBeGreaterThan(0);
    expect(prestigeChange).toBeLessThan(0);
  });
});

describe('applyStatChange', () => {
  it('clamps to [0, 100] independently of how large the change is', () => {
    expect(applyStatChange(95, 20)).toBe(100);
    expect(applyStatChange(5, -20)).toBe(0);
  });

  it('adds a normal in-range change verbatim', () => {
    expect(applyStatChange(50, 7)).toBe(57);
    expect(applyStatChange(50, -7)).toBe(43);
  });
});
