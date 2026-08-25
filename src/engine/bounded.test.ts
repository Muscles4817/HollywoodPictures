import { describe, it, expect } from 'vitest';
import { liftTowardCeiling, stat, statAsUnit, unit } from './bounded';

describe('unit', () => {
  it('is the one place a fraction is bounded', () => {
    expect(unit(0.5)).toBe(0.5);
    expect(unit(-1)).toBe(0);
    expect(unit(1.7)).toBe(1);
    expect(unit(0)).toBe(0);
    expect(unit(1)).toBe(1);
  });

  it('maps NaN and Infinity to zero rather than letting them into the simulation', () => {
    // A NaN escaping into a settlement sum poisons everything downstream in
    // silence, and there is no fraction it could sensibly mean.
    expect(unit(Number.NaN)).toBe(0);
    expect(unit(Number.POSITIVE_INFINITY)).toBe(0);
    expect(unit(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('stat', () => {
  it('bounds the 0-100 scale, and keeps it distinct from the 0-1 one', () => {
    expect(stat(50)).toBe(50);
    expect(stat(140)).toBe(100);
    expect(stat(-3)).toBe(0);
    expect(statAsUnit(50)).toBe(0.5);
    expect(statAsUnit(140)).toBe(1);
  });
});

describe('liftTowardCeiling', () => {
  it('never exceeds the ceiling, so no caller needs a clamp behind it', () => {
    for (const base of [0, 0.25, 0.5, 0.9, 1]) {
      for (const lift of [0, 0.2, 0.5, 1]) {
        const result = liftTowardCeiling(unit(base), unit(lift));
        expect(result).toBeGreaterThanOrEqual(base);
        expect(result).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is strictly monotonic in the base, so no two inputs collapse to one output', () => {
    // The whole reason this exists instead of Math.min(1, base + lift): a hard
    // cap makes every input above the ceiling produce the same number, and the
    // distinctions those inputs carried are destroyed silently.
    const lift = unit(0.2);
    let previous = -1;
    for (const base of [0, 0.2, 0.4, 0.6, 0.8, 0.95, 1]) {
      const result = liftTowardCeiling(unit(base), lift);
      expect(result).toBeGreaterThan(previous);
      previous = result;
      // The additive form would have clamped from here on.
      if (base + 0.2 > 1) expect(result).toBeLessThanOrEqual(1);
    }
  });

  it('is a no-op at zero lift, so an unlifted caller keeps its exact calibration', () => {
    for (const base of [0, 0.37, 0.5, 1]) {
      expect(liftTowardCeiling(unit(base), unit(0))).toBe(base);
    }
  });

  it('is worth more to a film with headroom than to one already at the top', () => {
    // Not just a bounding trick - the honest model of an advantage. Being known
    // for a genre buys visibility a picture does not already have.
    const lift = unit(0.2);
    const gainAt = (base: number) => liftTowardCeiling(unit(base), lift) - base;
    expect(gainAt(0.3)).toBeGreaterThan(gainAt(0.9));
    expect(gainAt(1)).toBe(0);
  });
});
