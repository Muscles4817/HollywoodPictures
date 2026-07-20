import { describe, it, expect } from 'vitest';
import { computeProfitRatio, determineCommercialOutcome, determineOutcome } from './outcome';
import type { OutcomeLabel } from '../types';

describe('computeProfitRatio', () => {
  it('is profit over total cost', () => {
    expect(computeProfitRatio(50, 100)).toBe(0.5);
    expect(computeProfitRatio(100, 100)).toBe(1);
    expect(computeProfitRatio(0, 100)).toBe(0);
    expect(computeProfitRatio(-100, 100)).toBe(-1);
  });

  it('guards divide-by-zero: a zero (or non-positive) cost yields 0, never Infinity/NaN', () => {
    expect(computeProfitRatio(100, 0)).toBe(0);
    expect(computeProfitRatio(0, 0)).toBe(0);
  });
});

describe('determineCommercialOutcome', () => {
  // Total cost fixed at 100 so `profit` reads directly as a percentage return.
  const at = (ratioPct: number, totalBoxOffice: number) => determineCommercialOutcome(ratioPct, 100, totalBoxOffice);

  it('Flop at a return of -50% or worse (boundary included)', () => {
    expect(at(-60, 10_000_000)).toBe('Flop');
    expect(at(-50, 10_000_000)).toBe('Flop'); // <= -0.5
  });

  it('Weak between -50% and +10%', () => {
    expect(at(-49, 10_000_000)).toBe('Weak');
    expect(at(0, 10_000_000)).toBe('Weak');
    expect(at(9, 10_000_000)).toBe('Weak'); // just under 0.1
  });

  it('Modest Success from +10% up to +50%', () => {
    expect(at(10, 10_000_000)).toBe('Modest Success'); // boundary 0.1
    expect(at(49, 10_000_000)).toBe('Modest Success');
  });

  it('Hit at +50% or more when reach is below blockbuster scale', () => {
    expect(at(50, 50_000_000)).toBe('Hit'); // boundary 0.5, sub-blockbuster box office
    expect(at(200, 10_000_000)).toBe('Hit'); // extraordinary ROI but tiny reach is still just a Hit
  });

  it('Blockbuster via mainstream scale + solid return (route 1)', () => {
    expect(at(50, 250_000_000)).toBe('Blockbuster');
  });

  it('Blockbuster via smaller reach + extraordinary return (route 2)', () => {
    expect(at(125, 100_000_000)).toBe('Blockbuster'); // ratio 1.25 at >=100M
    expect(at(124, 100_000_000)).toBe('Hit'); // just under route 2, not enough reach for route 1
  });

  it('Phenomenon needs BOTH massive reach and a strong return', () => {
    expect(at(100, 750_000_000)).toBe('Phenomenon'); // ratio 1 at >=750M
    expect(at(60, 800_000_000)).toBe('Blockbuster'); // huge reach but ratio < 1 -> not Phenomenon
    expect(at(300, 100_000_000)).toBe('Blockbuster'); // huge return but reach < 750M -> not Phenomenon
  });

  it('reach alone never earns a blockbuster label', () => {
    expect(at(20, 300_000_000)).toBe('Modest Success'); // big gross, weak return
  });
});

describe('determineOutcome', () => {
  const base = { profit: 50, totalCost: 100, totalBoxOffice: 50_000_000, qualityScore: 60, criticScore: 60, audienceScore: 60 };
  const outcome = (o: Partial<typeof base>): OutcomeLabel => determineOutcome({ ...base, ...o });

  it('a catastrophic Flop stays a Flop even when critics and audiences adore it', () => {
    expect(outcome({ profit: -60, qualityScore: 99, criticScore: 99, audienceScore: 99 })).toBe('Flop');
  });

  it('Masterpiece requires quality >= 85, critic >= 88 and audience >= 75 together', () => {
    expect(outcome({ qualityScore: 85, criticScore: 88, audienceScore: 75 })).toBe('Masterpiece');
    // Missing any single threshold drops back to the commercial label (here, Hit).
    expect(outcome({ qualityScore: 84, criticScore: 88, audienceScore: 75 })).toBe('Hit');
    expect(outcome({ qualityScore: 85, criticScore: 87, audienceScore: 75 })).toBe('Hit');
    expect(outcome({ qualityScore: 85, criticScore: 88, audienceScore: 74 })).toBe('Hit');
  });

  it('Cult Hit is only for commercial under-performers with strong audience love', () => {
    // Modest Success (ratio 0.2) with audience/critic over the bar.
    expect(outcome({ profit: 20, audienceScore: 80, criticScore: 65, qualityScore: 50 })).toBe('Cult Hit');
    // Boundary: audience 78, critic 60.
    expect(outcome({ profit: 20, audienceScore: 78, criticScore: 60, qualityScore: 50 })).toBe('Cult Hit');
    // A genuine Hit with the same reception is NOT a Cult Hit (not an under-performer).
    expect(outcome({ profit: 50, audienceScore: 90, criticScore: 90, qualityScore: 50 })).toBe('Hit');
    // Weak audience keeps it a plain Modest Success.
    expect(outcome({ profit: 20, audienceScore: 70, criticScore: 65, qualityScore: 50 })).toBe('Modest Success');
  });

  it('Masterpiece takes precedence over Cult Hit when both would qualify', () => {
    // Modest commercial + Masterpiece-grade reception (audience >= 75 also satisfies Cult Hit's >= 78? no) -
    // use audience 80 so both Masterpiece (>=75) and Cult Hit (>=78) conditions hold; Masterpiece wins.
    expect(outcome({ profit: 20, qualityScore: 90, criticScore: 90, audienceScore: 80 })).toBe('Masterpiece');
  });

  it('passes the commercial label through when no accolade applies', () => {
    expect(outcome({ profit: 50, totalBoxOffice: 50_000_000, qualityScore: 60, criticScore: 60, audienceScore: 60 })).toBe('Hit');
    expect(outcome({ profit: 20, qualityScore: 60, criticScore: 60, audienceScore: 60 })).toBe('Modest Success');
    expect(outcome({ profit: 0, qualityScore: 60, criticScore: 60, audienceScore: 60 })).toBe('Weak');
  });
});
