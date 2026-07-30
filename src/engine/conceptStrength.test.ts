import { describe, it, expect } from 'vitest';
import { deriveConceptStrength, describeConceptStrength } from './conceptStrength';
import type { Script } from '../types';

// Only the fields the derivation reads - a Pick, like the function's own input.
type Inputs = Pick<Script, 'genre' | 'archetype' | 'storyType' | 'hook' | 'emotionalPremise' | 'franchisePotential' | 'originality'>;

const base: Inputs = {
  genre: 'Action',
  archetype: 'CrowdPleaser',
  storyType: 'Crime',
  hook: 50,
  emotionalPremise: 50,
  franchisePotential: 50,
  originality: 50,
};

describe('deriveConceptStrength', () => {
  it('rises with hook', () => {
    expect(deriveConceptStrength({ ...base, hook: 90 })).toBeGreaterThan(deriveConceptStrength({ ...base, hook: 20 }));
  });

  it('treats originality as a modest input, not the whole story', () => {
    // The same 60-point swing moves the score far less through originality (weight
    // 0.15) than through hook (weight 0.30) - originality is one ingredient, not
    // synonymous with concept strength (Principle 8 / the Batman case).
    const originalitySwing = deriveConceptStrength({ ...base, originality: 90 }) - deriveConceptStrength({ ...base, originality: 30 });
    const hookSwing = deriveConceptStrength({ ...base, hook: 90 }) - deriveConceptStrength({ ...base, hook: 30 });
    expect(originalitySwing).toBeGreaterThan(0);
    expect(hookSwing).toBeGreaterThan(originalitySwing);
  });

  it('lets a low-originality idea still be a powerful concept (the Batman route: hook + franchise)', () => {
    const batman: Inputs = { ...base, originality: 15, hook: 92, franchisePotential: 95, emotionalPremise: 70 };
    const arthouseThin: Inputs = { ...base, originality: 85, hook: 25, franchisePotential: 10, emotionalPremise: 30 };
    expect(deriveConceptStrength(batman)).toBeGreaterThan(deriveConceptStrength(arthouseThin));
  });

  it('stays within 0-100 at the extremes', () => {
    const max = deriveConceptStrength({ ...base, hook: 100, emotionalPremise: 100, franchisePotential: 100, originality: 100 });
    const min = deriveConceptStrength({ ...base, hook: 1, emotionalPremise: 1, franchisePotential: 1, originality: 1 });
    expect(max).toBeLessThanOrEqual(100);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeGreaterThan(min);
  });
});

describe('describeConceptStrength', () => {
  it('names the drivers behind a powerhouse concept, without a raw number', () => {
    const d = describeConceptStrength({ ...base, hook: 95, franchisePotential: 90, originality: 85, emotionalPremise: 80 });
    expect(d).toContain('powerhouse concept');
    expect(d).toContain('an immediate hook');
    expect(d).not.toMatch(/\d/); // never exposes the internal number
  });

  it('reads a weak idea as a thin concept with no named drivers', () => {
    const d = describeConceptStrength({ ...base, genre: 'Drama', archetype: 'GenreFormula', hook: 20, franchisePotential: 15, originality: 20, emotionalPremise: 25 });
    expect(d).toContain('thin concept');
    expect(d).not.toContain('—'); // no drivers clause when nothing stands out
  });
});
