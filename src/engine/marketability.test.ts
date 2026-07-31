import { describe, it, expect } from 'vitest';
import { deriveMarketability } from './commercialProfile';
import type { Script } from '../types';

// deriveMarketability is the "draw" vector - franchise/IP pre-sold demand, the
// thing that makes the highest-opening films almost always franchises. Franchise
// potential dominates; hook is secondary; genre popularity a base. (Wired to the
// audience-sim Eligibility stage but held inert until the franchise system gives
// it a real bimodal input - see audienceSimulationInputs.ts.)
type Inputs = Pick<Script, 'genre' | 'franchisePotential' | 'hook'>;
const base: Inputs = { genre: 'Action', franchisePotential: 40, hook: 40 };

describe('deriveMarketability', () => {
  it('is dominated by franchise potential (the pre-sold audience)', () => {
    const franchiseSwing = deriveMarketability({ ...base, franchisePotential: 90 }) - deriveMarketability({ ...base, franchisePotential: 10 });
    const hookSwing = deriveMarketability({ ...base, hook: 90 }) - deriveMarketability({ ...base, hook: 10 });
    expect(franchiseSwing).toBeGreaterThan(hookSwing);
  });

  it('a franchise entry reads far more marketable than an original', () => {
    const franchise = deriveMarketability({ ...base, franchisePotential: 95, hook: 85 });
    const original = deriveMarketability({ ...base, franchisePotential: 10, hook: 45 });
    expect(franchise).toBeGreaterThan(original + 30);
  });

  it('stays within 0-100', () => {
    expect(deriveMarketability({ genre: 'Action', franchisePotential: 100, hook: 100 })).toBeLessThanOrEqual(100);
    expect(deriveMarketability({ genre: 'Drama', franchisePotential: 1, hook: 1 })).toBeGreaterThanOrEqual(0);
  });
});
