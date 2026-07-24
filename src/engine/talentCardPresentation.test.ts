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
  deriveFitConfidence,
  perceivedFitBias,
  deriveFitRead,
  deriveFitReadAssist,
  gateKnownAxes,
  deriveComparisonVerdict,
  NO_ASSIST,
  type CompareSide,
} from './talentCardPresentation';
import { generateTalentCandidates } from './talentGenerator';
import { createRng } from './random';
import type { RelationshipStanding } from './relationships';
import type { Person } from '../types';

function history(collaborations: number): RelationshipStanding {
  return { collaborations, warmth: 0, tier: collaborations > 0 ? 'neutral' : 'none', lastWorkedDay: null };
}

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

describe('deriveFitConfidence', () => {
  function withReputation(base: Person, reputation: Partial<Person['reputation']>): Person {
    return { ...base, reputation: { ...base.reputation, ...reputation } };
  }

  it('reads an established, reliable name as a confident read with no caveat and a tight band', () => {
    const [base] = generateTalentCandidates('Actor', createRng(40), 1);
    const known = withReputation(base, { fame: 80, industryRespect: 70, currentHeat: 60, reliability: 80 });
    const unknown = withReputation(base, { fame: 20, industryRespect: 20, currentHeat: 20, reliability: 70 });
    const conf = deriveFitConfidence(known);
    expect(conf.tier).toBe('high');
    expect(conf.cause).toBeNull();
    // The whole point: an uncertain read must SHOW as a wider band than a sure one.
    expect(conf.halfWidth).toBeLessThan(deriveFitConfidence(unknown).halfWidth);
  });

  it('reads an unproven newcomer as hard to read, naming the lack of track record', () => {
    const [base] = generateTalentCandidates('Actor', createRng(41), 1);
    const unknown = withReputation(base, { fame: 20, industryRespect: 20, currentHeat: 20, reliability: 70 });
    const conf = deriveFitConfidence(unknown);
    expect(conf.tier).toBe('low');
    expect(conf.cause).toMatch(/unproven/i);
  });

  it('caps a flaky big name below a confident read however established, and blames the inconsistency', () => {
    const [base] = generateTalentCandidates('Actor', createRng(42), 1);
    const flakyStar = withReputation(base, { fame: 85, industryRespect: 70, currentHeat: 70, reliability: 25 });
    const conf = deriveFitConfidence(flakyStar);
    expect(conf.tier).toBe('medium');
    expect(conf.cause).toMatch(/hot and cold|bank on/i);
  });
});

describe('perceivedFitBias', () => {
  function asContrast(base: Person, fame: number, craftFloor: number, craftHeadroom: number): Person {
    return {
      ...base,
      reputation: { ...base.reputation, fame },
      careers: { ...base.careers, actor: { ...base.careers.actor!, craftFloor, craftHeadroom } },
    };
  }

  it('flatters a famous coaster (name outruns craft) - reads better than they are', () => {
    const [base] = generateTalentCandidates('Actor', createRng(43), 1);
    expect(perceivedFitBias(asContrast(base, 80, 40, 10))).toBeGreaterThan(0);
  });

  it('under-rates an undiscovered talent (craft outruns name) - reads worse than they are', () => {
    const [base] = generateTalentCandidates('Actor', createRng(44), 1);
    expect(perceivedFitBias(asContrast(base, 30, 70, 15))).toBeLessThan(0);
  });

  it('is honest (zero) for a genuine star whose fame and craft agree', () => {
    const [base] = generateTalentCandidates('Actor', createRng(45), 1);
    expect(perceivedFitBias(asContrast(base, 80, 80, 5))).toBe(0);
  });
});

describe('deriveFitRead', () => {
  it('shifts the perceived centre up for a coaster and down for an undiscovered talent', () => {
    const [base] = generateTalentCandidates('Actor', createRng(46), 1);
    const coaster: Person = { ...base, reputation: { ...base.reputation, fame: 80 }, careers: { ...base.careers, actor: { ...base.careers.actor!, craftFloor: 40, craftHeadroom: 10 } } };
    const undiscovered: Person = { ...base, reputation: { ...base.reputation, fame: 30 }, careers: { ...base.careers, actor: { ...base.careers.actor!, craftFloor: 70, craftHeadroom: 15 } } };
    expect(deriveFitRead(60, coaster).perceived).toBeGreaterThan(60);
    expect(deriveFitRead(60, undiscovered).perceived).toBeLessThan(60);
  });

  it('widens the band and hedges the verdict when the person is hard to read', () => {
    const [base] = generateTalentCandidates('Actor', createRng(47), 1);
    const sure: Person = { ...base, reputation: { ...base.reputation, fame: 80, industryRespect: 70, currentHeat: 60, reliability: 80 } };
    const unsure: Person = { ...base, reputation: { ...base.reputation, fame: 15, industryRespect: 15, currentHeat: 15, reliability: 70 } };
    const sureRead = deriveFitRead(72, sure);
    const unsureRead = deriveFitRead(72, unsure);
    expect(unsureRead.high - unsureRead.low).toBeGreaterThan(sureRead.high - sureRead.low);
    // No read-bias on either here (fame/craft roughly agree), so a confident read
    // is the bare quality word and an unsure one wears a hedge.
    expect(sureRead.verdict).toMatch(/^a good fit/i);
    expect(unsureRead.verdict).toMatch(/reads like/i);
  });

  it('keeps the perceived centre and band inside 0-100', () => {
    const [base] = generateTalentCandidates('Actor', createRng(48), 1);
    const coaster: Person = { ...base, reputation: { ...base.reputation, fame: 80 }, careers: { ...base.careers, actor: { ...base.careers.actor!, craftFloor: 40, craftHeadroom: 10 } } };
    const read = deriveFitRead(98, coaster);
    expect(read.perceived).toBeLessThanOrEqual(100);
    expect(read.high).toBeLessThanOrEqual(100);
    expect(read.low).toBeGreaterThanOrEqual(0);
  });
});

describe('deriveFitReadAssist', () => {
  it('reads a hired casting director as the assist for an actor', () => {
    const assist = deriveFitReadAssist(80, history(0), true);
    expect(assist.source).toBe('casting-director');
    expect(assist.level).toBeCloseTo(0.8);
  });

  it('ignores a casting director for a non-actor (they read actors, not directors or crew)', () => {
    expect(deriveFitReadAssist(80, history(0), false)).toEqual(NO_ASSIST);
  });

  it('reads history with the person as an assist, keyed off the collaboration count', () => {
    const assist = deriveFitReadAssist(undefined, history(3), true);
    expect(assist.source).toBe('history');
    expect(assist.level).toBeGreaterThan(0);
  });

  it('takes the stronger of the two ways of knowing them, not their sum', () => {
    // CD skill 40 (0.40) vs two collaborations (0.60) - history is the stronger read.
    const assist = deriveFitReadAssist(40, history(2), true);
    expect(assist.source).toBe('history');
    expect(assist.level).toBeCloseTo(0.6);
  });
});

describe('deriveFitConfidence with a studio-side assist', () => {
  it('promotes a hard-to-read newcomer and tightens the band when a strong assist is present', () => {
    const [base] = generateTalentCandidates('Actor', createRng(50), 1);
    const newcomer: Person = { ...base, reputation: { ...base.reputation, fame: 15, industryRespect: 15, currentHeat: 15, reliability: 70 } };
    const unaided = deriveFitConfidence(newcomer);
    const aided = deriveFitConfidence(newcomer, deriveFitReadAssist(90, history(0), true));
    expect(unaided.tier).toBe('low');
    expect(aided.tier).toBe('high');
    expect(aided.halfWidth).toBeLessThan(unaided.halfWidth);
    expect(aided.cause).toBeNull();
  });
});

describe('deriveFitRead with a studio-side assist', () => {
  const coaster = (base: Person): Person => ({
    ...base,
    reputation: { ...base.reputation, fame: 80 },
    careers: { ...base.careers, actor: { ...base.careers.actor!, craftFloor: 40, craftHeadroom: 10 } },
  });

  it('sees through the reputation over-read - a casting director pulls a coaster back toward the truth', () => {
    const [base] = generateTalentCandidates('Actor', createRng(51), 1);
    const c = coaster(base);
    const unaided = deriveFitRead(60, c);
    const aided = deriveFitRead(60, c, deriveFitReadAssist(90, history(0), true));
    // Both still read above the true 60 (a coaster flatters), but the CD's eye
    // shrinks the illusion toward the truth.
    expect(aided.perceived).toBeLessThan(unaided.perceived);
    expect(aided.perceived).toBeGreaterThan(60);
  });

  it('credits the assist source on the read, and stays silent with no assist', () => {
    const [base] = generateTalentCandidates('Actor', createRng(52), 1);
    expect(deriveFitRead(60, base, deriveFitReadAssist(90, history(0), true)).assistNote).toMatch(/casting director/i);
    expect(deriveFitRead(60, base, deriveFitReadAssist(undefined, history(3), true)).assistNote).toMatch(/worked together/i);
    expect(deriveFitRead(60, base).assistNote).toBeNull();
  });
});

describe('gateKnownAxes', () => {
  const rows = [
    { label: 'Emotional Performance', matchScore: 90, strength: 85 }, // a real, known strength
    { label: 'Comedy', matchScore: 88, strength: 20 }, // matches, but they're not known for it
    { label: 'Physical Performance', matchScore: 40, strength: 30 },
  ];

  it('reveals every axis for a confident read', () => {
    const gated = gateKnownAxes(rows, 'high');
    expect(gated.every((r) => r.known)).toBe(true);
  });

  it('veils the axes an unknown quantity is not actually known for', () => {
    const gated = gateKnownAxes(rows, 'low');
    const known = gated.filter((r) => r.known).map((r) => r.label);
    expect(known).toContain('Emotional Performance');
    expect(known).not.toContain('Comedy'); // high match, but low strength - a question mark
  });

  it('never hides everything - the single strongest dimension always shows', () => {
    const allWeak = [
      { label: 'Comedy', matchScore: 50, strength: 30 },
      { label: 'Charisma', matchScore: 60, strength: 44 },
    ];
    const gated = gateKnownAxes(allWeak, 'low');
    expect(gated.filter((r) => r.known)).toHaveLength(1);
    expect(gated.find((r) => r.known)!.label).toBe('Charisma'); // the strongest of the weak
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
