import { describe, it, expect } from 'vitest';
import { splitCastBudgetByImportance, ROLE_BUDGET_IMPORTANCE } from './castBudget';
import { ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import type { Person, ProductionRole, TalentAssignment } from '../types';

/** A minimal actor whose only relevant field is their quoted (typical) salary. */
function actor(id: string, typicalSalary: number): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [], gender: 'Female', dateOfBirth: { year: -35, month: 1, day: 1 } },
    personality: { professionalism: 60, ambition: 50, loyalty: 50, ego: 40, temperament: 50, pressureHandling: 50, controversy: 20, adaptability: 50 },
    reputation: { fame: 60, prestige: 55, industryRespect: 60, reliability: 70, currentHeat: 55 },
    primaryRole: 'Actor',
    careers: {
      actor: {
        role: 'Actor', active: true, experience: 50, roleReputation: 55, minimumSalary: typicalSalary, typicalSalary,
        actingStyle: { characterTransformation: 60, emotionalPerformance: 60, charisma: 60, comedy: 40, physicalPerformance: 50 },
      },
    },
    availability: { commitments: [] },
    traits: [],
  };
}

const hire = (role: ProductionRole, person: Person): TalentAssignment => ({ role, person });

describe('splitCastBudgetByImportance', () => {
  const EMPTY: Partial<Record<ProductionRole, number>> = {};

  it('gives more important roles a bigger per-head target than lesser ones', () => {
    const targets = splitCastBudgetByImportance({ totalBudget: 10_000_000, talent: [], script: null, current: EMPTY });
    // Lead actor and director carry the film; editor is below the line.
    expect(targets['Lead Actor']!).toBeGreaterThan(targets['Supporting Actor']!);
    expect(targets['Supporting Actor']!).toBeGreaterThan(targets['Editor']!);
    expect(targets['Director']!).toBeGreaterThan(targets['Editor']!);
  });

  it('is proportional to the importance weights (unclamped mid-range budget)', () => {
    const targets = splitCastBudgetByImportance({ totalBudget: 10_000_000, talent: [], script: null, current: EMPTY });
    // Lead:Editor importance ratio is 6:1, and at this budget neither hits its
    // clamp, so the per-head targets should carry that same ratio.
    const ratio = targets['Lead Actor']! / targets['Editor']!;
    expect(ratio).toBeCloseTo(ROLE_BUDGET_IMPORTANCE['Lead Actor'] / ROLE_BUDGET_IMPORTANCE['Editor'], 5);
  });

  it("subtracts a hire's own fee from the pot, so the roles left over are targeted lower", () => {
    const before = splitCastBudgetByImportance({ totalBudget: 20_000_000, talent: [], script: null, current: EMPTY });
    // Cast the lead for far more than their suggested slice.
    const lead = actor('big-star', 8_000_000);
    const after = splitCastBudgetByImportance({
      totalBudget: 20_000_000,
      talent: [hire('Lead Actor', lead)],
      script: null,
      current: EMPTY,
    });
    // The remaining roles now draw from a smaller pot, so each is targeted lower.
    expect(after['Director']!).toBeLessThan(before['Director']!);
    expect(after['Editor']!).toBeLessThan(before['Editor']!);
    // The lead is cast, so its own target is no longer part of the split.
    expect(after['Lead Actor']).toBeUndefined();
  });

  it('leaves a fully-cast role its existing target untouched', () => {
    const current: Partial<Record<ProductionRole, number>> = { 'Lead Actor': 1_234_567 };
    const after = splitCastBudgetByImportance({
      totalBudget: 10_000_000,
      talent: [hire('Lead Actor', actor('a', 500_000))],
      script: null,
      current,
    });
    expect(after['Lead Actor']).toBe(1_234_567);
  });

  it('clamps each per-head target to that role range', () => {
    // A huge budget would push every share past its ceiling without the clamp.
    const targets = splitCastBudgetByImportance({ totalBudget: 500_000_000, talent: [], script: null, current: EMPTY });
    expect(targets['Editor']!).toBeLessThanOrEqual(ROLE_GENERATION_PROFILES.Editor.salaryRange.max);
    // A tiny budget floors at each range minimum rather than going to zero.
    const tiny = splitCastBudgetByImportance({ totalBudget: 1, talent: [], script: null, current: EMPTY });
    expect(tiny['Editor']!).toBe(ROLE_GENERATION_PROFILES.Editor.salaryRange.min);
  });

  it('returns the current map unchanged once every mandatory role is cast', () => {
    // Fill all seven mandatory heads (Supporting is a single head with null script? no - max 4);
    // use a script-less capacity where Supporting needs 4, so cast those too.
    const talent: TalentAssignment[] = [
      hire('Director', actor('d', 1)),
      hire('Lead Actor', actor('l', 1)),
      hire('Supporting Actor', actor('s1', 1)),
      hire('Supporting Actor', actor('s2', 1)),
      hire('Supporting Actor', actor('s3', 1)),
      hire('Supporting Actor', actor('s4', 1)),
      hire('Writer', actor('w', 1)),
      hire('Cinematographer', actor('c', 1)),
      hire('Composer', actor('m', 1)),
      hire('Editor', actor('e', 1)),
    ];
    const current: Partial<Record<ProductionRole, number>> = { Director: 999 };
    const after = splitCastBudgetByImportance({ totalBudget: 10_000_000, talent, script: null, current });
    expect(after).toEqual(current);
  });
});
