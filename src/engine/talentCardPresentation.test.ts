// Talent Card UX Redesign (user request) - coverage for the qualitative card
// reads: the risk verdict that replaces four raw personality star rows, the
// magnitude words behind the Industry bars, the "why" line under the hiring
// verdict, and the head-to-head recommendation the comparison view leads with.
import { describe, it, expect } from 'vitest';
import {
  qualitativeMagnitude,
  isStarDraw,
  deriveRiskRead,
  deriveFitReason,
  deriveComparisonVerdict,
  type CompareSide,
} from './talentCardPresentation';
import { generateTalentCandidates } from './talentGenerator';
import { createRng } from './random';
import type { Person } from '../types';

describe('qualitativeMagnitude', () => {
  it('maps a 0-100 value to a coarse band, not a number', () => {
    expect(qualitativeMagnitude(95)).toBe('Very high');
    expect(qualitativeMagnitude(70)).toBe('High');
    expect(qualitativeMagnitude(50)).toBe('Moderate');
    expect(qualitativeMagnitude(30)).toBe('Low');
    expect(qualitativeMagnitude(10)).toBe('Very low');
  });
});

describe('isStarDraw', () => {
  it('flags a high-fame name as a draw and a low-fame one as not', () => {
    const [person] = generateTalentCandidates('Actor', createRng(1), 1);
    expect(isStarDraw({ ...person, reputation: { ...person.reputation, fame: 85 } })).toBe(true);
    expect(isStarDraw({ ...person, reputation: { ...person.reputation, fame: 40 } })).toBe(false);
  });
});

describe('deriveRiskRead', () => {
  function withPersonality(base: Person, personality: Partial<Person['personality']>, reputation: Partial<Person['reputation']> = {}): Person {
    return { ...base, personality: { ...base.personality, ...personality }, reputation: { ...base.reputation, ...reputation } };
  }

  it('reads a clean, reliable professional as Dependable', () => {
    const [base] = generateTalentCandidates('Actor', createRng(2), 1);
    const clean = withPersonality(
      base,
      { ego: 40, temperament: 70, controversy: 15, professionalism: 80 },
      { reliability: 85 },
    );
    expect(deriveRiskRead(clean).tier).toBe('dependable');
  });

  it('reads a scandal-prone, difficult name as Volatile', () => {
    const [base] = generateTalentCandidates('Actor', createRng(3), 1);
    const bad = withPersonality(
      base,
      { ego: 92, temperament: 18, controversy: 92 },
      { reliability: 40 },
    );
    expect(deriveRiskRead(bad).tier).toBe('volatile');
  });

  it('reads a middling temperament / low reliability as Some risk', () => {
    const [base] = generateTalentCandidates('Actor', createRng(4), 1);
    const mid = withPersonality(
      base,
      { ego: 50, temperament: 30, controversy: 40, professionalism: 55 },
      { reliability: 45 },
    );
    expect(deriveRiskRead(mid).tier).toBe('some-risk');
  });
});

describe('deriveFitReason', () => {
  it('names the strongest axes and flags the weakest as a caveat', () => {
    const reason = deriveFitReason([
      { label: 'Emotional Performance', matchScore: 96 },
      { label: 'Character Transformation', matchScore: 82 },
      { label: 'Charisma', matchScore: 68 },
      { label: 'Comedy', matchScore: 30 },
    ]);
    expect(reason).not.toBeNull();
    expect(reason!.strengths).toMatch(/perfect emotional performance fit/i);
    expect(reason!.strengths).toMatch(/strong character transformation fit/i);
    expect(reason!.caveat).toMatch(/lighter on comedy/i);
  });

  it('offers no caveat when even the weakest axis is a decent fit', () => {
    const reason = deriveFitReason([
      { label: 'Emotional Performance', matchScore: 88 },
      { label: 'Charisma', matchScore: 72 },
      { label: 'Comedy', matchScore: 61 },
    ]);
    expect(reason!.caveat).toBeNull();
  });

  it('still reads honestly when nothing clears the strength bar', () => {
    const reason = deriveFitReason([
      { label: 'Comedy', matchScore: 40 },
      { label: 'Charisma', matchScore: 30 },
    ]);
    expect(reason!.strengths).toMatch(/at best/i);
  });

  it('returns null when there are no rows to reason about', () => {
    expect(deriveFitReason([])).toBeNull();
  });
});

describe('deriveComparisonVerdict', () => {
  const strong: CompareSide = { name: 'Cross', fit: 84, salary: 2_400_000, availableNow: true, reliability: 82, riskTier: 'dependable', fame: 78 };

  it('names a clear pick when one leads on fit, cost, and reliability', () => {
    const weaker: CompareSide = { name: 'Vance', fit: 70, salary: 3_600_000, availableNow: true, reliability: 55, riskTier: 'some-risk', fame: 91 };
    const verdict = deriveComparisonVerdict(strong, weaker);
    expect(verdict.pick).toBe('a');
    expect(verdict.summary).toMatch(/lean cross/i);
  });

  it('treats a booked candidate as a decisive strike against them', () => {
    const booked: CompareSide = { ...strong, name: 'Vance', availableNow: false };
    const verdict = deriveComparisonVerdict({ ...strong, name: 'Cross' }, booked);
    expect(verdict.pick).toBe('a');
    expect(verdict.summary).toMatch(/vance can't start yet/i);
  });

  it('calls it close when the two trade blows evenly', () => {
    // A fits better; B is cheaper and more reliable - no clear winner.
    const a: CompareSide = { name: 'Cross', fit: 86, salary: 4_000_000, availableNow: true, reliability: 55, riskTier: 'dependable', fame: 70 };
    const b: CompareSide = { name: 'Vance', fit: 74, salary: 2_000_000, availableNow: true, reliability: 80, riskTier: 'dependable', fame: 70 };
    const verdict = deriveComparisonVerdict(a, b);
    expect(verdict.pick).toBeNull();
    expect(verdict.summary).toMatch(/close call/i);
  });
});
