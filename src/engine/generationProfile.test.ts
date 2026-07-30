import { describe, it, expect } from 'vitest';
import { generateScriptOptions } from './scriptGenerator';
import { deriveConceptStrength } from './conceptStrength';
import { createRng } from './random';

// Phase 3b - "source as a generation profile". These lock the design intent that
// makes shopping the market tangibly different from commissioning: variance is
// the currency of the market. You commission for the reliable floor; you shop the
// market for a ceiling you cannot manufacture.
describe('source generation profiles', () => {
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it('a wide concept spread raises the reachable concept CEILING vs the neutral (commission) baseline', () => {
    // The neutral baseline caps each concept axis at its archetype band; a wide
    // spread can push past it, so the best concept a wide-spread source turns up
    // is stronger than anything the reliable baseline produces - the powerhouse
    // spec you could never commission.
    const wide = generateScriptOptions('Action', createRng(11), 200, undefined, { conceptSpread: 20, executionShift: 0 });
    const neutral = generateScriptOptions('Action', createRng(11), 200, undefined, { conceptSpread: 0, executionShift: 0 });
    const bestWide = Math.max(...wide.map(deriveConceptStrength));
    const bestNeutral = Math.max(...neutral.map(deriveConceptStrength));
    expect(bestWide).toBeGreaterThan(bestNeutral);
  });

  it('execution shift separates a polished Agent Package from a messy Spec', () => {
    const specLike = generateScriptOptions('Drama', createRng(7), 120, undefined, { conceptSpread: 16, executionShift: -10 });
    const agentLike = generateScriptOptions('Drama', createRng(7), 120, undefined, { conceptSpread: 3, executionShift: 10 });
    const execAvg = (s: { structure: number; characters: number; dialogue: number }) => (s.structure + s.characters + s.dialogue) / 3;
    expect(avg(agentLike.map(execAvg))).toBeGreaterThan(avg(specLike.map(execAvg)) + 10);
  });

  it('the neutral profile leaves generated stats identical to no profile at all', () => {
    // Commissioning (neutral) draws no extra rng and applies no shift, so every
    // generated stat matches the base generation exactly - the reliable floor,
    // unperturbed. (Script ids are minted outside the rng stream and so differ
    // between any two calls - they aren't part of "same generation".)
    const stats = (s: { originality: number; hook: number; emotionalPremise: number; franchisePotential: number; structure: number; characters: number; dialogue: number; complexity: number }) =>
      ({ originality: s.originality, hook: s.hook, emotionalPremise: s.emotionalPremise, franchisePotential: s.franchisePotential, structure: s.structure, characters: s.characters, dialogue: s.dialogue, complexity: s.complexity });
    const withNeutral = generateScriptOptions('Thriller', createRng(3), 20, undefined, { conceptSpread: 0, executionShift: 0 });
    const withoutProfile = generateScriptOptions('Thriller', createRng(3), 20);
    expect(withNeutral.map(stats)).toEqual(withoutProfile.map(stats));
  });
});
