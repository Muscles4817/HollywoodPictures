// Workstream I, Phase 2a - the staffing lifecycle derivation.
import { describe, it, expect } from 'vitest';
import { deriveStaffingBoard, appendStaffingEvent, STAFFING_LOG_CAP, type StaffingBoard } from './staffingBoard';
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

// A VFX-heavy script so the VFX department is meaningfully loaded (Layer 3), and
// a VFX Supervisor person of a given skill — for the suitability-seam tests.
function vfxHeavyDraft(): FilmDraft {
  const d = baseDraft();
  const script = {
    ...d.script!,
    genre: 'Sci-Fi' as const,
    primarySetting: 'SpacecraftOrStation' as const,
    scale: 'Epic' as const,
    effectsStrategy: { practical: 0.2, digital: 0.8 },
    environmentStrategy: { studio: 0.4, location: 0.1, digital: 0.5 },
    productionRequirements: {
      ...d.script!.productionRequirements,
      vfx: 0.95, practicalEffects: 0.3, stunts: 0.5, periodSetting: false,
    },
  };
  return { ...d, script };
}

function vfxSupervisor(name: string, skill: number, experience = 60): Person {
  return {
    identity: { name },
    careers: {
      vfxSupervisor: {
        role: 'VFX Supervisor', active: true, experience, roleReputation: 50,
        minimumSalary: 100_000, typicalSalary: 500_000, skill,
      },
    },
  } as unknown as Person;
}

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

describe('crew suitability seam (Workstream II fit-read floor)', () => {
  it('populates a suitability read on the modelled department heads, and leaves others absent', () => {
    const b = deriveStaffingBoard(vfxHeavyDraft(), 10);
    expect(rowFor(b, 'VFX Supervisor').suitability).toBeDefined();
    expect(rowFor(b, 'Production Designer').suitability).toBeDefined();
    // Director is not a modelled Layer-3 department — no fit-read yet.
    expect(rowFor(b, 'Director').suitability).toBeUndefined();
  });

  it('reads an unstaffed VFX-heavy film as an unstaffed, high-demand prompt', () => {
    const read = rowFor(deriveStaffingBoard(vfxHeavyDraft(), 10), 'VFX Supervisor').suitability!;
    expect(read.hired).toBe(false);
    expect(read.department).toBe('vfx');
    expect(['demanding', 'severe']).toContain(read.demand);
    expect(read.headline).toMatch(/Unstaffed/);
  });

  it('a stronger attached supervisor reads as more suitable than a weak one on the same film', () => {
    const d = vfxHeavyDraft();
    const weak = deriveStaffingBoard(
      { ...d, talent: [{ person: vfxSupervisor('Junior', 25), role: 'VFX Supervisor' }] as FilmDraft['talent'] }, 10,
    );
    const strong = deriveStaffingBoard(
      { ...d, talent: [{ person: vfxSupervisor('Maestro', 95), role: 'VFX Supervisor' }] as FilmDraft['talent'] }, 10,
    );
    const weakRead = rowFor(weak, 'VFX Supervisor').suitability!;
    const strongRead = rowFor(strong, 'VFX Supervisor').suitability!;
    expect(weakRead.hired).toBe(true);
    expect(strongRead.hired).toBe(true);
    expect(strongRead.margin).toBeGreaterThan(weakRead.margin);
    expect(strongRead.capabilityScore).toBeGreaterThan(weakRead.capabilityScore);
  });
});

describe('appendStaffingEvent', () => {
  it('records a meaningful event onto the draft feed without mutating the input', () => {
    const d = baseDraft();
    const next = appendStaffingEvent(d, { day: 3, kind: 'attached', subject: 'Ava', personName: 'Star', amount: 5_000_000 });
    expect(d.staffingLog ?? []).toHaveLength(0);
    expect(next.staffingLog).toHaveLength(1);
    expect(next.staffingLog![0]).toMatchObject({ kind: 'attached', subject: 'Ava', personName: 'Star' });
  });

  it('preserves order (oldest first) as events accrue', () => {
    let d = baseDraft();
    d = appendStaffingEvent(d, { day: 1, kind: 'audition', subject: 'Ava', personName: 'A' });
    d = appendStaffingEvent(d, { day: 2, kind: 'countered', subject: 'Ava', personName: 'A', amount: 6_000_000 });
    expect(d.staffingLog!.map((e) => e.kind)).toEqual(['audition', 'countered']);
  });

  it('caps the feed at STAFFING_LOG_CAP, dropping the oldest', () => {
    let d = baseDraft();
    for (let i = 0; i < STAFFING_LOG_CAP + 5; i++) {
      d = appendStaffingEvent(d, { day: i, kind: 'budget', subject: 'Director', note: 'locked' });
    }
    expect(d.staffingLog).toHaveLength(STAFFING_LOG_CAP);
    // the earliest five should have been evicted
    expect(d.staffingLog![0].day).toBe(5);
    expect(d.staffingLog![STAFFING_LOG_CAP - 1].day).toBe(STAFFING_LOG_CAP + 4);
  });
});
