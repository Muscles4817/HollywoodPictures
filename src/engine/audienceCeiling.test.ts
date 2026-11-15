// A lower ceiling on audience score (docs/IMPLEMENTATION_PLAN_market_realism.md Phase 4a).
import { describe, expect, it } from 'vitest';
import { audienceTopBound } from './scoring';

describe('audienceTopBound', () => {
  it('leaves scores at or below the knee unchanged', () => {
    for (const raw of [-5, 0, 30, 55, 71, 72]) expect(audienceTopBound(raw)).toBe(raw);
  });
  it('is monotone in the raw score', () => {
    let previous = -Infinity;
    for (let raw = 0; raw <= 200; raw += 0.5) {
      const bounded = audienceTopBound(raw);
      expect(bounded).toBeGreaterThanOrEqual(previous);
      previous = bounded;
    }
  });
  it('never exceeds the ceiling of 94', () => {
    for (const raw of [80, 95, 120, 500]) expect(audienceTopBound(raw)).toBeLessThan(94);
    expect(audienceTopBound(90)).toBeGreaterThan(80);
  });
});
