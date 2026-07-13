import { describe, it, expect } from 'vitest';
import { computeBrandChange, computePrestigeChange, applyStatChange } from './reputation';

describe('computeBrandChange', () => {
  it('never reads criticScore - a profitable-but-panned film still grows Brand', () => {
    // $10m cost, $12m profit -> profitRatio 1.2, comfortably a "Hit"-band
    // return regardless of how badly it reviewed.
    const change = computeBrandChange(12_000_000, 10_000_000, 40);
    expect(change).toBeGreaterThan(0);
  });

  it('a bigger loss produces a more negative change than a smaller loss', () => {
    const smallLoss = computeBrandChange(-1_000_000, 10_000_000, 50);
    const bigLoss = computeBrandChange(-8_000_000, 10_000_000, 50);
    expect(bigLoss).toBeLessThan(smallLoss);
  });

  it('audienceScore only nudges the result by a couple points, never flips a flop into a gain', () => {
    const lovedFlop = computeBrandChange(-5_000_000, 10_000_000, 95);
    expect(lovedFlop).toBeLessThan(0);
  });
});

describe('computePrestigeChange', () => {
  it('never reads profit or audienceScore - only takes criticScore', () => {
    expect(computePrestigeChange(90)).toBeGreaterThan(0);
    expect(computePrestigeChange(10)).toBeLessThan(0);
  });

  it('is symmetric around a criticScore of 50', () => {
    expect(computePrestigeChange(50)).toBe(0);
    expect(computePrestigeChange(70)).toBe(-computePrestigeChange(30));
  });

  it('never returns -0 (would fail a strict deep-equal after a JSON save/reload round-trip)', () => {
    expect(Object.is(computePrestigeChange(49.9), -0)).toBe(false);
    expect(computePrestigeChange(49.9)).toBe(0);
  });
});

describe('Brand/Prestige independence', () => {
  it('a beloved flop ("Cult Hit"-shaped: low profit, high critic score) grows Prestige while Brand falls', () => {
    const profit = -6_000_000;
    const totalCost = 10_000_000;
    const criticScore = 92;
    const audienceScore = 55;
    const brandChange = computeBrandChange(profit, totalCost, audienceScore);
    const prestigeChange = computePrestigeChange(criticScore);
    expect(brandChange).toBeLessThan(0);
    expect(prestigeChange).toBeGreaterThan(0);
  });

  it('a profitable-but-panned film grows Brand while Prestige falls', () => {
    const profit = 15_000_000;
    const totalCost = 10_000_000;
    const criticScore = 15;
    const audienceScore = 45;
    const brandChange = computeBrandChange(profit, totalCost, audienceScore);
    const prestigeChange = computePrestigeChange(criticScore);
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
