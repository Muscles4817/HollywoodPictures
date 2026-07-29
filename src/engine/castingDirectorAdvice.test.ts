// Casting Redesign, Phase 7 - the Casting Director's take (consolidated advisory).
import { describe, it, expect } from 'vitest';
import { deriveCastingDirectorTake, describeCastingDirectorTake, type CastingDirectorTakeInput } from './castingDirectorAdvice';
import type { FitRead } from './talentCardPresentation';

function fit(perceived: number): FitRead {
  return {
    perceived, confidence: 'high', low: perceived - 5, high: perceived + 5,
    verdict: 'A strong fit', confidenceLabel: 'Confident read', uncertaintyCause: null, assistNote: null,
  };
}

function input(over: Partial<CastingDirectorTakeInput> = {}): CastingDirectorTakeInput {
  return { castingDirectorSkill: 80, fit: fit(80), odds: 'likely', risk: 'dependable', affordable: true, strengths: 'Perfect emotional fit.', caveat: null, ...over };
}

describe('deriveCastingDirectorTake', () => {
  it('gives no take when no casting director is hired - the advisory is a thing you unlock', () => {
    expect(deriveCastingDirectorTake(input({ castingDirectorSkill: null }))).toBeNull();
    expect(deriveCastingDirectorTake(input({ castingDirectorSkill: 0 }))).toBeNull();
  });

  it('recommends a strong pick on a great, affordable, likely, dependable candidate', () => {
    const take = deriveCastingDirectorTake(input())!;
    expect(take.recommendation).toBe('strong-yes');
    expect(take.reasons.length).toBeGreaterThan(0);
  });

  it('passes on a poor fit or an impossible schedule', () => {
    expect(deriveCastingDirectorTake(input({ fit: fit(25) }))!.recommendation).toBe('pass');
    expect(deriveCastingDirectorTake(input({ odds: 'no' }))!.recommendation).toBe('pass');
  });

  it('downgrades a strong fit to a reach when they are volatile, over budget, or a long shot', () => {
    expect(deriveCastingDirectorTake(input({ risk: 'volatile' }))!.recommendation).not.toBe('strong-yes');
    expect(deriveCastingDirectorTake(input({ affordable: false }))!.recommendation).not.toBe('strong-yes');
    expect(deriveCastingDirectorTake(input({ odds: 'long-shot' }))!.recommendation).toBe('reach');
  });

  it('scales confidence with the casting director skill', () => {
    expect(deriveCastingDirectorTake(input({ castingDirectorSkill: 90 }))!.confidence).toBe('high');
    expect(deriveCastingDirectorTake(input({ castingDirectorSkill: 45 }))!.confidence).toBe('medium');
    expect(deriveCastingDirectorTake(input({ castingDirectorSkill: 10 }))!.confidence).toBe('low');
  });

  it('surfaces the honest caveat and the cost blocker in the reasons for a non-slam-dunk', () => {
    const take = deriveCastingDirectorTake(input({ fit: fit(65), affordable: false, caveat: 'Lighter on comedy for this part.' }))!;
    expect(take.reasons.join(' ')).toMatch(/comedy/i);
    expect(take.reasons.join(' ')).toMatch(/budget/i);
  });
});

describe('describeCastingDirectorTake', () => {
  it('renders the verdict, the reasons, and a confidence tag as one line', () => {
    const line = describeCastingDirectorTake(deriveCastingDirectorTake(input())!);
    expect(line).toMatch(/strong pick/i);
    expect(line).toMatch(/Confident\./);
  });

  it('tags a low-skill read as rough', () => {
    const line = describeCastingDirectorTake(deriveCastingDirectorTake(input({ castingDirectorSkill: 12 }))!);
    expect(line).toMatch(/rough read/i);
  });
});
