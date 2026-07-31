import { describe, it, expect } from 'vitest';
import { deriveMarketability } from './commercialProfile';
import type { Script } from '../types';

// deriveMarketability is the "draw" vector - the pre-sold demand that makes the
// highest-opening films almost always franchise entries. It is DOMINATED by
// franchiseRecognition (the proven audience a sequel inherits from its IP), so
// the signal is cleanly bimodal: originals low, franchise entries high. The
// rolled concept terms (franchisePotential/hook) are a minor component.
// (Wired to the audience-sim Eligibility stage but held inert until the franchise
// system + calibration - see audienceSimulationInputs.ts.)
type Inputs = Pick<Script, 'franchisePotential' | 'hook'> & { franchiseRecognition?: number };
const original: Inputs = { franchisePotential: 40, hook: 40 };

describe('deriveMarketability', () => {
  it('a franchise entry (proven recognition) reads far more marketable than any original', () => {
    // The whole point: even a high-concept original can't out-draw a real
    // franchise, because recognition dominates and an original's is 0.
    const sequel = deriveMarketability({ franchisePotential: 55, hook: 60, franchiseRecognition: 85 });
    const bigOriginal = deriveMarketability({ franchisePotential: 95, hook: 90 }); // no recognition
    expect(sequel).toBeGreaterThan(bigOriginal + 20);
  });

  it('originals are bimodally low - even a maxed-concept original stays modest', () => {
    const maxedOriginal = deriveMarketability({ franchisePotential: 100, hook: 100 });
    expect(maxedOriginal).toBeLessThan(35); // concept-only, no proven audience
  });

  it('rises monotonically with the inherited recognition', () => {
    expect(deriveMarketability({ ...original, franchiseRecognition: 90 }))
      .toBeGreaterThan(deriveMarketability({ ...original, franchiseRecognition: 30 }));
  });

  it('stays within 0-100 and treats absent recognition as 0 (an original)', () => {
    expect(deriveMarketability({ franchisePotential: 100, hook: 100, franchiseRecognition: 100 })).toBeLessThanOrEqual(100);
    expect(deriveMarketability({ franchisePotential: 1, hook: 1 })).toBeGreaterThanOrEqual(0);
    expect(deriveMarketability({ franchisePotential: 50, hook: 50 })).toBe(deriveMarketability({ franchisePotential: 50, hook: 50, franchiseRecognition: 0 }));
  });
});
