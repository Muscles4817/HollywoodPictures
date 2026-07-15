// QoL pass (docs/DESIGN.md) - computeCompatibilityBreakdown/
// computeTalentCompatibilityBreakdown expose the per-tone weighted-mismatch
// terms computeCompatibility's own loop already computes internally, but
// never returned before this. No dedicated test coverage existed for this
// file at all beforehand.
import { describe, it, expect } from 'vitest';
import {
  computeCompatibility,
  computeCompatibilityBreakdown,
  computeTalentCompatibility,
  computeTalentCompatibilityBreakdown,
  deriveToneFromActingStyle,
} from './compatibility';
import { TONES } from '../data/tones';
import type { ActorTalent, DirectorTalent, Script, ToneProfile } from '../types';

function tone(overrides: Partial<ToneProfile> = {}): ToneProfile {
  return { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50, ...overrides };
}

describe('computeCompatibilityBreakdown', () => {
  it('has exactly one row per tone axis', () => {
    const rows = computeCompatibilityBreakdown(tone(), tone());
    expect(rows.map((r) => r.tone).sort()).toEqual([...TONES].sort());
  });

  it("each row's contribution is exactly scriptValue * gap - the same term computeCompatibility sums internally", () => {
    const scriptTone = tone({ suspense: 90, comedy: 10 });
    const talentTone = tone({ suspense: 30, comedy: 80 });
    const rows = computeCompatibilityBreakdown(scriptTone, talentTone);
    const suspenseRow = rows.find((r) => r.tone === 'suspense')!;
    expect(suspenseRow.gap).toBe(60);
    expect(suspenseRow.contribution).toBe(90 * 60);
    const comedyRow = rows.find((r) => r.tone === 'comedy')!;
    expect(comedyRow.gap).toBe(70);
    expect(comedyRow.contribution).toBe(10 * 70);
  });

  it('reconstructs the exact same aggregate score computeCompatibility returns', () => {
    const scriptTone = tone({ action: 80, drama: 20, spectacle: 90 });
    const talentTone = tone({ action: 40, drama: 70, spectacle: 30 });
    const rows = computeCompatibilityBreakdown(scriptTone, talentTone);
    const totalContribution = rows.reduce((sum, r) => sum + r.contribution, 0);
    const totalWeight = rows.reduce((sum, r) => sum + r.scriptValue, 0);
    const reconstructedScore = 100 - totalContribution / totalWeight;
    expect(reconstructedScore).toBeCloseTo(computeCompatibility(scriptTone, talentTone), 6);
  });

  it('contributionShare always sums to 1 (or every row is 0 if there is no mismatch at all)', () => {
    const rows = computeCompatibilityBreakdown(tone({ action: 90 }), tone({ action: 20 }));
    const totalShare = rows.reduce((sum, r) => sum + r.contributionShare, 0);
    expect(totalShare).toBeCloseTo(1, 6);

    const identicalRows = computeCompatibilityBreakdown(tone(), tone());
    for (const row of identicalRows) expect(row.contributionShare).toBe(0);
  });

  it('a perfect match has zero gap and zero contribution on every axis', () => {
    const rows = computeCompatibilityBreakdown(tone({ suspense: 77 }), tone({ suspense: 77 }));
    for (const row of rows) {
      expect(row.gap).toBe(0);
      expect(row.contribution).toBe(0);
    }
  });
});

describe('computeTalentCompatibilityBreakdown', () => {
  const director: DirectorTalent = {
    id: 'd1', name: 'Test Director', role: 'Director', fame: 50, reliability: 50, ego: 50, salary: 100_000,
    skill: 70, toneProfile: tone({ suspense: 80 }),
    productionStyle: { environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33 }, effectsStrategy: { practical: 0.5, digital: 0.5 } },
  };
  const actor: ActorTalent = {
    id: 'a1', name: 'Test Actor', role: 'Actor', fame: 50, reliability: 50, ego: 50, salary: 100_000,
    actingStyle: { characterTransformation: 60, emotionalPerformance: 60, charisma: 60, comedy: 20, physicalPerformance: 40 },
  };
  const script = { toneProfile: tone({ suspense: 85, comedy: 15 }) } as unknown as Script;

  it("a Director's breakdown compares the script directly against their own toneProfile - matches computeCompatibility exactly", () => {
    const rows = computeTalentCompatibilityBreakdown(director, script);
    expect(rows).not.toBeNull();
    const suspenseRow = rows!.find((r) => r.tone === 'suspense')!;
    expect(suspenseRow.talentValue).toBe(director.toneProfile.suspense);
    const score = computeTalentCompatibility(director, script);
    const total = rows!.reduce((sum, r) => sum + r.contribution, 0);
    const weight = rows!.reduce((sum, r) => sum + r.scriptValue, 0);
    expect(100 - total / weight).toBeCloseTo(score!, 6);
  });

  it("an Actor's breakdown compares the script against their tone derived from ActingStyle, not a raw toneProfile", () => {
    const rows = computeTalentCompatibilityBreakdown(actor, script);
    expect(rows).not.toBeNull();
    const derived = deriveToneFromActingStyle(actor.actingStyle);
    for (const row of rows!) {
      expect(row.talentValue).toBeCloseTo(derived[row.tone], 6);
    }
  });

  it('returns null for crew roles with no tone-comparable stat, same as computeTalentCompatibility', () => {
    const writer = { id: 'w1', name: 'Test Writer', role: 'Writer' as const, fame: 50, reliability: 50, ego: 50, salary: 50_000, skill: 60 };
    expect(computeTalentCompatibilityBreakdown(writer, script)).toBeNull();
    expect(computeTalentCompatibility(writer, script)).toBeNull();
  });
});
