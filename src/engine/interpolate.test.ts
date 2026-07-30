import { describe, expect, it } from 'vitest';
import { logAmount, logT, type Range } from './interpolate';

describe('logAmount / logT with a positive floor', () => {
  const range: Range = { min: 100_000, max: 40_000_000 };

  it('maps the endpoints to 0 and 1', () => {
    expect(logT(range.min, range)).toBeCloseTo(0, 10);
    expect(logT(range.max, range)).toBeCloseTo(1, 10);
    expect(logAmount(0, range)).toBeCloseTo(range.min, 5);
    expect(logAmount(1, range)).toBeCloseTo(range.max, 5);
  });

  it('round-trips amount -> t -> amount', () => {
    for (const amount of [250_000, 1_000_000, 8_000_000, 25_000_000]) {
      expect(logAmount(logT(amount, range), range)).toBeCloseTo(amount, 3);
    }
  });
});

describe('logAmount / logT with a zero floor (Contingency Reserve)', () => {
  // The exact shape the Contingency Reserve slider uses: a legitimate £0 "no
  // buffer" floor on a log-scale currency slider. A naive geometric mapping
  // produces NaN here; the offset path must stay finite and monotonic.
  const range: Range = { min: 0, max: 40_000_000 };

  it('never produces NaN across the whole slider travel', () => {
    for (let step = 0; step <= 1000; step++) {
      const t = step / 1000;
      const amount = logAmount(t, range);
      expect(Number.isNaN(amount)).toBe(false);
      expect(Number.isNaN(logT(amount, range))).toBe(false);
    }
  });

  it('maps the £0 floor to t=0 and the max to t=1', () => {
    expect(logT(0, range)).toBeCloseTo(0, 10);
    expect(logT(range.max, range)).toBeCloseTo(1, 10);
    expect(logAmount(0, range)).toBeCloseTo(0, 5);
    expect(logAmount(1, range)).toBeCloseTo(range.max, 5);
  });

  it('is monotonic increasing in t', () => {
    let prev = -Infinity;
    for (let step = 0; step <= 100; step++) {
      const amount = logAmount(step / 100, range);
      expect(amount).toBeGreaterThan(prev);
      prev = amount;
    }
  });

  it('round-trips amount -> t -> amount, including 0', () => {
    for (const amount of [0, 500_000, 5_000_000, 20_000_000]) {
      expect(logAmount(logT(amount, range), range)).toBeCloseTo(amount, 3);
    }
  });

  it('keeps generous resolution at the cheap end (log-like, not linear)', () => {
    // Halfway along the slider should land well below the arithmetic midpoint,
    // so small reserves get plenty of travel rather than being crushed near 0.
    expect(logAmount(0.5, range)).toBeLessThan(range.max * 0.25);
  });
});
