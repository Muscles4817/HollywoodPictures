// Brand reversion (docs/IMPLEMENTATION_PLAN_market_realism.md Phase 3).
import { describe, expect, it } from 'vitest';
import { BRAND_REVERSION_PER_YEAR, brandLevelForGross, computeBrandAnchor, driftBrand } from './reputation';

describe('computeBrandAnchor - where a studio\'s name rests', () => {
  it('is null with fewer than three films', () => {
    expect(computeBrandAnchor([])).toBeNull();
    expect(computeBrandAnchor([100e6, 100e6])).toBeNull();
  });

  it('rests £100M films at 60', () => {
    expect(computeBrandAnchor([100e6, 100e6, 100e6])).toBeCloseTo(60, 10);
  });

  it('is the mean of the levels of mixed grosses', () => {
    // 10M -> 30, 100M -> 60, 1B -> 90: mean 60.
    expect(computeBrandAnchor([10e6, 100e6, 1e9])).toBeCloseTo(60, 10);
    expect(computeBrandAnchor([1e6, 10e6, 100e6])).toBeCloseTo((10 + 30 + 60) / 3, 10);
  });

  it('uses only the newest eight', () => {
    const eight = Array(8).fill(1e9) as number[];
    expect(computeBrandAnchor([...eight, 1e6, 1e6, 1e6])).toBeCloseTo(computeBrandAnchor(eight)!, 10);
  });

  it('log-interpolates between anchors and stays within 5-95', () => {
    expect(brandLevelForGross(Math.sqrt(10e6 * 100e6))).toBeCloseTo(45, 10);
    expect(computeBrandAnchor([1, 1, 1])).toBe(5);
    expect(computeBrandAnchor([1e12, 1e12, 1e12])).toBe(95);
  });
});

describe('driftBrand - a quarter\'s pull toward the anchor', () => {
  it('moves toward the anchor from above and from below, never past it', () => {
    const down = driftBrand(80, 40, 0.25);
    expect(down).toBeLessThan(80);
    expect(down).toBeGreaterThan(40);
    const up = driftBrand(20, 60, 0.25);
    expect(up).toBeGreaterThan(20);
    expect(up).toBeLessThan(60);
    expect(driftBrand(20, 60, 100)).toBeLessThanOrEqual(60);
  });

  it('does nothing with a null anchor', () => {
    expect(driftBrand(73, null, 0.25)).toBe(73);
  });

  it('compounds four quarters to the yearly rate', () => {
    let brand = 90;
    for (let q = 0; q < 4; q++) brand = driftBrand(brand, 50, 0.25);
    expect(brand).toBeCloseTo(90 - 40 * BRAND_REVERSION_PER_YEAR, 10);
  });
});
