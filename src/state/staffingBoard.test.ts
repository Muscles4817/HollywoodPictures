// Workstream I, Phase 2a - the staffing lifecycle derivation.
import { describe, it, expect } from 'vitest';
import { deriveStaffingBoard, type StaffingBoard } from './staffingBoard';
import { buildReadyDraft } from './testFixtures';
import { withRng } from '../engine/random';
import type { FilmDraft, Person } from '../types';

function baseDraft(): FilmDraft {
  const d = withRng(1, (rng) => buildReadyDraft(rng)).result;
  return {
    ...d,
    talent: [],
    shortlist: [],
    auditions: [],
    negotiations: [],
    castingCalls: [],
    talentTargetPriceByRole: {
      ...d.talentTargetPriceByRole,
      'Lead Actor': 5_000_000,
      'Supporting Actor': 2_000_000,
      Director: 4_000_000,
    },
  };
}
const leadCharacterId = (d: FilmDraft) => d.script!.cast.find((c) => c.prominence === 'Lead')!.id;
const rowFor = (b: StaffingBoard, key: string) => b.rows.find((r) => r.key === key)!;
const person = (name: string): Person => ({ identity: { name } }) as unknown as Person;

describe('deriveStaffingBoard', () => {
  it('reports every character and the crew heads, all unstaffed at the start', () => {
    const b = deriveStaffingBoard(baseDraft(), 10);
    expect(b.rows.every((r) => r.stage === 'unstaffed')).toBe(true);
    expect(b.rows.some((r) => r.role === 'Director')).toBe(true);
    expect(b.rows.some((r) => r.category === 'actor')).toBe(true);
  });

  it('walks the shared lifecycle for a character: searching -> candidates -> evaluating -> negotiating -> attached', () => {
    const d = baseDraft();
    const ch = leadCharacterId(d);

    const searching = deriveStaffingBoard({ ...d, shortlist: [{ characterId: ch, personId: 'p1', role: 'Lead Actor' }] }, 10);
    expect(rowFor(searching, ch).stage).toBe('searching');

    const candidates = deriveStaffingBoard(
      { ...d, castingCalls: [{ characterId: ch, role: 'Lead Actor', applicants: [{ person: person('A'), channel: 'OpenCasting', appliedOnDay: 1 }] }] as unknown as FilmDraft['castingCalls'] },
      10,
    );
    expect(rowFor(candidates, ch).stage).toBe('candidates');

    const evaluating = deriveStaffingBoard({ ...d, auditions: [{ characterId: ch, personId: 'p1', role: 'Lead Actor', requestedOnDay: 1, readyOnDay: 20 }] }, 10);
    expect(rowFor(evaluating, ch).stage).toBe('evaluating');

    const negotiating = deriveStaffingBoard(
      { ...d, negotiations: [{ characterId: ch, personId: 'p1', role: 'Lead Actor', askingPrice: 6_000_000, lastOfferedSalary: 5_000_000, status: 'countered', counterSalary: 6_000_000 }] },
      10,
    );
    expect(rowFor(negotiating, ch).stage).toBe('negotiating');
    expect(rowFor(negotiating, ch).counts.counters).toBe(1);

    const attached = deriveStaffingBoard({ ...d, talent: [{ person: person('Star'), role: 'Lead Actor', characterId: ch, agreedSalary: 5_000_000 }] as FilmDraft['talent'] }, 10);
    expect(rowFor(attached, ch).stage).toBe('attached');
    expect(rowFor(attached, ch).attached).toEqual(['Star']);
  });

  it('computes planned/committed/remaining and flags an over-budget signing', () => {
    const d = baseDraft();
    const ch = leadCharacterId(d);
    const b = deriveStaffingBoard({ ...d, talent: [{ person: person('Star'), role: 'Lead Actor', characterId: ch, agreedSalary: 8_000_000 }] as FilmDraft['talent'] }, 10);
    const row = rowFor(b, ch);
    expect(row.budget.planned).toBe(5_000_000);
    expect(row.budget.committed).toBe(8_000_000);
    expect(row.budget.remaining).toBe(0);
    expect(row.warnings).toContain('over-budget');
  });

  it('surfaces the planned shoot offset and reflects a locked role budget', () => {
    const d = { ...baseDraft(), plannedStartOffsetDays: 30, lockedRoleBudgets: ['Director' as const] };
    const b = deriveStaffingBoard(d, 10);
    expect(b.plannedStartOffsetDays).toBe(30);
    expect(rowFor(b, 'Director').budget.locked).toBe(true);
  });
});
