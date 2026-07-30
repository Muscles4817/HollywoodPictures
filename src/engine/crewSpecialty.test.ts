// Workstream II, Addition #1 — per-specialty crew technical capability.
import { describe, it, expect } from 'vitest';
import { crewSpecialtyCapability, specialtyWeightedCapability, SPECIALTY_LABEL, isSpecialtyDepartment, specialtyDepartmentForRole, describeStandoutSpecialty } from './crewSpecialty';
import type { Person } from '../types';
import type { WorkloadContribution } from './departmentWorkload';

function vfxHead(id: string, skill: number, specialties?: Record<string, number>): Person {
  return {
    id, identity: { name: id },
    careers: { vfxSupervisor: { role: 'VFX Supervisor', active: true, experience: skill, roleReputation: 60, minimumSalary: 1, typicalSalary: 1, skill, specialties } },
  } as unknown as Person;
}
const contrib = (key: string, load: number): WorkloadContribution => ({ key: key as WorkloadContribution['key'], label: key, weight: 1, load });

describe('crewSpecialtyCapability', () => {
  it('produces an in-range profile that is stable per person', () => {
    const caps = crewSpecialtyCapability(vfxHead('v1', 70), 'VFX Supervisor', 'vfx', 70);
    const vals = Object.values(caps);
    expect(vals.length).toBe(4);
    for (const v of vals) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(100); }
    // stable across calls
    expect(crewSpecialtyCapability(vfxHead('v1', 70), 'VFX Supervisor', 'vfx', 70)).toEqual(caps);
  });

  it('is spiky in aggregate — heads have real standouts and weaknesses', () => {
    // Population claim (robust; a single head can happen to cluster).
    const spreads = Array.from({ length: 12 }, (_, i) => {
      const vals = Object.values(crewSpecialtyCapability(vfxHead(`h${i}`, 70), 'VFX Supervisor', 'vfx', 70));
      return Math.max(...vals) - Math.min(...vals);
    });
    const avgSpread = spreads.reduce((s, x) => s + x, 0) / spreads.length;
    expect(avgSpread).toBeGreaterThan(12);
    expect(Math.max(...spreads)).toBeGreaterThan(25);
  });

  it('respects an authored specialty override', () => {
    const caps = crewSpecialtyCapability(vfxHead('v2', 70, { creatureAnimation: 95 }), 'VFX Supervisor', 'vfx', 70);
    expect(caps.creatureAnimation).toBe(95);
  });
});

describe('specialtyWeightedCapability', () => {
  const caps = { digitalEnvironments: 90, creatureAnimation: 40, compositing: 70, digitalDoubles: 70 } as Record<string, number>;

  it('reads a specialist HIGHER than overall when the film leans on their strength', () => {
    const w = specialtyWeightedCapability(caps as never, [contrib('digitalEnvironments', 0.8)], 65);
    expect(w.skill).toBeGreaterThan(65);
    expect(w.note).toMatch(new RegExp(SPECIALTY_LABEL.digitalEnvironments));
    expect(w.note).toMatch(/specialist/i);
  });

  it('reads a head LOWER than overall when the film leans on their weakness', () => {
    const w = specialtyWeightedCapability(caps as never, [contrib('creatureAnimation', 0.8)], 65);
    expect(w.skill).toBeLessThan(65);
    expect(w.note).toMatch(/weaker area/i);
  });

  it('falls back to overall skill when no contribution maps to a specialty', () => {
    const w = specialtyWeightedCapability(caps as never, [contrib('extras', 0.5)], 65);
    expect(w.skill).toBe(65);
    expect(w.note).toBeUndefined();
  });
});

describe('isSpecialtyDepartment', () => {
  it('recognises PD and VFX, not stunts', () => {
    expect(isSpecialtyDepartment('productionDesign')).toBe(true);
    expect(isSpecialtyDepartment('vfx')).toBe(true);
    expect(isSpecialtyDepartment('stunts')).toBe(false);
  });
});

describe('specialtyDepartmentForRole', () => {
  it('maps PD and VFX heads to their departments and everyone else to null', () => {
    expect(specialtyDepartmentForRole('Production Designer')).toBe('productionDesign');
    expect(specialtyDepartmentForRole('VFX Supervisor')).toBe('vfx');
    expect(specialtyDepartmentForRole('Editor')).toBeNull();
    expect(specialtyDepartmentForRole('Cinematographer')).toBeNull();
  });
});

describe('describeStandoutSpecialty', () => {
  it('names a clear standout and a real weak spot', () => {
    const head = vfxHead('spec-head', 60, { creatureAnimation: 95, compositing: 30, digitalEnvironments: 62, digitalDoubles: 58 });
    const line = describeStandoutSpecialty(head, 'VFX Supervisor');
    expect(line).toMatch(/specialist in creature animation/i);
    expect(line).toMatch(/weaker on compositing/i);
  });

  it('returns null for a role with no specialties', () => {
    expect(describeStandoutSpecialty(vfxHead('h', 60), 'Editor')).toBeNull();
  });
});
