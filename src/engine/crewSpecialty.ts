// Workstream II, Addition #1 — per-specialty technical capability, the THIRD
// dimension of a creative head (beside creative philosophy and the working-style
// personality axes). `skill` says how good a head is overall; this says WHAT
// they're best at. A great digital-environments house is not automatically a
// great creature animator — expressing that is the point (design: VFX/PD
// specialties are "distinct").
//
// Same discipline as crewPhilosophy: an unauthored profile is a STABLE per-person
// spiky spread around the head's overall skill (a standout and a relative
// weakness), keyed on the person id — no rng, no generated-pool shift, no save
// impact — with an optional authored `CrewCareer.specialties` override. It feeds
// the crew fit-read (specialty-vs-workload) only; never cost or scoring.
import type { Person, ProductionRole } from '../types';
import { clamp } from './random';
import { stableUnit } from './actingModel';
import { getCrewCareer } from './person';
import type { RequirementLeafKey } from './requirementProfile';
import type { WorkloadContribution } from './departmentWorkload';

/** Departments whose heads carry distinct specialties today (the crew fit-read floor, minus the stunt team, which has its own StuntSpecialty mechanic). */
export type SpecialtyDepartment = 'productionDesign' | 'vfx';

export type PdSpecialty = 'periodCraft' | 'scaleBuild' | 'locationBuild' | 'creatureBuild';
export type VfxSpecialty = 'digitalEnvironments' | 'creatureAnimation' | 'compositing' | 'digitalDoubles';
export type CrewSpecialty = PdSpecialty | VfxSpecialty;

const DEPT_SPECIALTIES: Record<SpecialtyDepartment, CrewSpecialty[]> = {
  productionDesign: ['periodCraft', 'scaleBuild', 'locationBuild', 'creatureBuild'],
  vfx: ['digitalEnvironments', 'creatureAnimation', 'compositing', 'digitalDoubles'],
};

// Which specialty a routed requirement leaf exercises, per department. A leaf
// can matter to two departments (creatureEmbodiment loads Stunts + PD); here it
// maps to the department-appropriate craft.
const LEAF_SPECIALTY: Partial<Record<RequirementLeafKey, CrewSpecialty>> = {
  // Production Design
  periodArchitecture: 'periodCraft',
  studioBuild: 'scaleBuild',
  locationWork: 'locationBuild',
  creatureEmbodiment: 'creatureBuild',
  // VFX
  digitalEnvironments: 'digitalEnvironments',
  creatureAnimation: 'creatureAnimation',
  compositingVfx: 'compositing',
  digitalDoubles: 'digitalDoubles',
};

export const SPECIALTY_LABEL: Record<CrewSpecialty, string> = {
  periodCraft: 'period craft',
  scaleBuild: 'large-scale builds',
  locationBuild: 'location work',
  creatureBuild: 'practical creatures',
  digitalEnvironments: 'digital environments',
  creatureAnimation: 'creature animation',
  compositing: 'compositing',
  digitalDoubles: 'digital doubles',
};

// How far a head's best/worst specialty can sit from their overall skill. Wide
// enough to make specialty match matter, not so wide it swamps overall level.
const SPECIALTY_SPREAD = 22;

export const isSpecialtyDepartment = (d: string): d is SpecialtyDepartment => d === 'productionDesign' || d === 'vfx';

/**
 * A head's per-specialty capability (1-100 each): the authored profile when
 * present, otherwise a stable per-person spiky spread around `overallSkill`.
 */
export function crewSpecialtyCapability(
  person: Person,
  role: ProductionRole,
  department: SpecialtyDepartment,
  overallSkill: number,
): Record<CrewSpecialty, number> {
  const authored = getCrewCareer(person, role as Parameters<typeof getCrewCareer>[1])?.specialties;
  const id = person.id ?? person.identity.name;
  const out = {} as Record<CrewSpecialty, number>;
  for (const s of DEPT_SPECIALTIES[department]) {
    if (authored?.[s] != null) {
      out[s] = clamp(Math.round(authored[s]), 1, 100);
      continue;
    }
    const delta = (stableUnit(`${id}|${role}|spec|${s}`) - 0.5) * 2 * SPECIALTY_SPREAD;
    out[s] = clamp(Math.round(overallSkill + delta), 1, 100);
  }
  return out;
}

export interface SpecialtyWeightedCapability {
  /** Load-weighted capability over the specialties this film actually demands (0-100). */
  skill: number;
  /** A short qualitative note on the head's fit for the film's dominant demand, or undefined if nothing maps. */
  note?: string;
}

/**
 * Collapse a head's per-specialty capability to a single effective capability for
 * THIS film: weight each specialty by how much the film loads it (the workload
 * contributions), so a head weak in the dominant specialty reads worse than their
 * overall skill, and a specialist in it reads better. Falls back to `overallSkill`
 * when no contribution maps to a modelled specialty.
 */
export function specialtyWeightedCapability(
  caps: Record<CrewSpecialty, number>,
  contributions: WorkloadContribution[],
  overallSkill: number,
): SpecialtyWeightedCapability {
  let num = 0;
  let den = 0;
  let dominant: { spec: CrewSpecialty; load: number } | null = null;
  for (const c of contributions) {
    const spec = LEAF_SPECIALTY[c.key];
    if (!spec || caps[spec] == null) continue;
    num += c.load * caps[spec];
    den += c.load;
    if (!dominant || c.load > dominant.load) dominant = { spec, load: c.load };
  }
  if (den === 0 || !dominant) return { skill: overallSkill };
  const skill = num / den;
  const label = SPECIALTY_LABEL[dominant.spec];
  const edge = caps[dominant.spec] - overallSkill;
  const note =
    edge >= 8
      ? `A specialist in ${label} — the film's biggest demand on them.`
      : edge <= -8
        ? `Their weaker area is ${label}, which is exactly what this film leans on.`
        : `Squarely within their range on ${label}, the film's main demand.`;
  return { skill, note };
}
