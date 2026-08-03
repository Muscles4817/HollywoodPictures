import { describe, it, expect } from 'vitest';
import {
  affordabilityTier,
  canComfortablyAfford,
  operatingReserve,
  RESERVE_FLOOR,
  RESERVE_FRACTION,
} from './affordability';

describe('operatingReserve', () => {
  it('keeps a fraction of cash once above the floor', () => {
    expect(operatingReserve(10_000_000)).toBe(10_000_000 * RESERVE_FRACTION);
  });

  it('never reserves less than the floor for a modest balance', () => {
    // 0.5 * 600k = 300k, below the 500k floor - so the floor wins.
    expect(operatingReserve(600_000)).toBe(RESERVE_FLOOR);
  });

  it('never reserves more than the cash on hand for a near-broke studio', () => {
    expect(operatingReserve(200_000)).toBe(200_000);
  });

  it('is zero for no cash', () => {
    expect(operatingReserve(0)).toBe(0);
    expect(operatingReserve(-5)).toBe(0);
  });
});

describe('affordabilityTier', () => {
  it('is unaffordable when the funds available cannot cover the cost', () => {
    expect(affordabilityTier({ cost: 9_000_000, available: 8_000_000 })).toBe('unaffordable');
  });

  it('is comfortable when the cost leaves the reserve intact', () => {
    // reserve on 8M cash is 4M; comfortable up to 8M - 4M = 4M.
    expect(affordabilityTier({ cost: 3_000_000, available: 8_000_000, cash: 8_000_000 })).toBe('comfortable');
  });

  it('is tight when the balance covers it but only by eating the reserve', () => {
    // 5M is coverable out of 8M, but leaves only 3M - below the 4M reserve.
    expect(affordabilityTier({ cost: 5_000_000, available: 8_000_000, cash: 8_000_000 })).toBe('tight');
  });

  it('sizes the reserve from total cash, not the (smaller) committed-net available', () => {
    // available is what's left after other film commitments; the reserve is
    // still measured against the whole treasury, so a hire that would be
    // "comfortable" against the leftover alone can still read tight.
    expect(affordabilityTier({ cost: 3_000_000, available: 3_500_000, cash: 20_000_000 })).toBe('tight');
  });

  it('treats the outlay as a standalone buy when no cash is given (reserve from available)', () => {
    expect(affordabilityTier({ cost: 3_000_000, available: 8_000_000 })).toBe('comfortable');
    expect(affordabilityTier({ cost: 5_000_000, available: 8_000_000 })).toBe('tight');
  });
});

describe('canComfortablyAfford', () => {
  it('is true only for the comfortable tier', () => {
    expect(canComfortablyAfford({ cost: 3_000_000, available: 8_000_000 })).toBe(true);
    expect(canComfortablyAfford({ cost: 5_000_000, available: 8_000_000 })).toBe(false); // tight
    expect(canComfortablyAfford({ cost: 9_000_000, available: 8_000_000 })).toBe(false); // unaffordable
  });
});
