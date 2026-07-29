// Workstream II, Phase B — Layer 3 of the production-requirements model
// (docs/DESIGN_production_requirements_model.md). DEPARTMENT WORKLOAD: how hard
// THIS production is for each modelled department, DERIVED from the narrative
// requirement profile (Layer 1) rather than decided independently per department.
//
// This is the connective tissue between the requirement profile and the crew
// fit-reads: a department's workload is the aggregate, over the requirements that
// route to it, of their magnitude · complexity · criticality. Two scripts with
// identical effects ambition but different approaches load entirely different
// departments — which is the whole point (a practical creature loads Stunts +
// Production Design; a CG creature loads VFX), and here it falls out for free
// because Layer 1 already resolved the approach fork into DIFFERENT leaves
// (creatureEmbodiment vs creatureAnimation), so routing is a static leaf→dept map.
//
// SCAFFOLDING slice, like Layer 1: this GENERALISES the per-facet ambition
// functions (computeSetsAmbition / computeVfxAmbition / computePracticalAmbition)
// but does NOT replace them — nothing here feeds cost or scoring yet, so it is
// calibration-safe. The PD/VFX/Stunt fit-reads (next slice) read this; wiring it
// back into the facet model's ambition inputs is a later, gated step.
//
// Modelled departments are the fit-read floor: Production Design, VFX, Stunts —
// the three that already have facets (setsFacet / vfxFacet / practicalFacet).
// Requirements that belong to as-yet-unmodelled departments (Costume, Makeup,
// Assistant Director / crowd logistics, animal wrangling) are deliberately left
// UNROUTED rather than misassigned; that coverage gap is explicit, not hidden.
import type { Script } from '../types';
import { clamp } from './random';
import {
  deriveRequirementProfile,
  type RequirementProfile,
  type RequirementLeaf,
  type RequirementLeafKey,
} from './requirementProfile';

/** The departments modelled so far — the crew fit-read floor. */
export type DepartmentId = 'productionDesign' | 'vfx' | 'stunts';

export const DEPARTMENT_IDS: DepartmentId[] = ['productionDesign', 'vfx', 'stunts'];

export const DEPARTMENT_LABELS: Record<DepartmentId, string> = {
  productionDesign: 'Production Design',
  vfx: 'Visual Effects',
  stunts: 'Stunts & Practical',
};

/** One requirement's contribution to a department's workload. */
export interface WorkloadContribution {
  key: RequirementLeafKey;
  label: string;
  weight: number; // share of the leaf's load routed to this department, 0-1
  load: number; // weight × leaf.magnitude — the raw contribution
}

/**
 * How hard this production is for one department. `magnitude` is a saturating
 * 0-1 aggregate (many requirements accumulate but never exceed 1); `complexity`
 * and `criticality` are load-weighted means of the routed requirements.
 */
export interface DepartmentWorkload {
  department: DepartmentId;
  label: string;
  magnitude: number;
  complexity: number;
  criticality: number;
  contributions: WorkloadContribution[]; // most load first
  dominantRequirements: string[]; // top requirement labels, for a quick read
}

// Routing table: which departments each requirement leaf loads, and by how much
// (the weight is the SHARE of that requirement's load going to the department;
// shares need not sum to 1 — a requirement can partially load several
// departments, and the remainder may fall to an unmodelled one). Leaves absent
// from this table route to no modelled department yet (Costume, Makeup, AD,
// animal wrangling) — an explicit coverage gap, not a silent drop.
const ROUTING: Partial<Record<RequirementLeafKey, Partial<Record<DepartmentId, number>>>> = {
  // Physical Environments → Production Design
  periodArchitecture: { productionDesign: 1.0 },
  studioBuild: { productionDesign: 1.0 },
  locationWork: { productionDesign: 0.4 }, // location dressing/augmentation
  // Character Transformation
  creatureEmbodiment: { stunts: 0.6, productionDesign: 0.4 }, // puppeteering/rigging + build integration
  digitalDoubles: { vfx: 1.0 },
  // (periodCostume → Costume; prostheticsMakeup → Makeup — unmodelled)
  // Action / Movement
  combatStunts: { stunts: 1.0 },
  vehicleAction: { stunts: 0.8, productionDesign: 0.2 }, // vehicle prep/dressing
  practicalDestruction: { stunts: 0.7, vfx: 0.2, productionDesign: 0.1 }, // SFX + cleanup + set damage
  danceChoreography: { stunts: 0.4 }, // movement coordination (interim home)
  // Digital Imagery → VFX
  digitalEnvironments: { vfx: 1.0 },
  creatureAnimation: { vfx: 1.0 },
  compositingVfx: { vfx: 1.0 },
  // Logistical Scale
  crowdWork: { stunts: 0.3, productionDesign: 0.2 }, // battle coordination + dressing (rest → AD, unmodelled)
  // (extras → AD; animals → animal unit — unmodelled)
};

// A department is reported as present once its aggregated raw load clears this;
// below it, the production makes no meaningful demand on the department.
export const DEPARTMENT_WORKLOAD_FLOOR = 0.1;

function aggregate(department: DepartmentId, profile: RequirementProfile): DepartmentWorkload | null {
  const contributions: WorkloadContribution[] = [];
  for (const leaf of profile) {
    const weight = ROUTING[leaf.key]?.[department];
    if (weight === undefined || weight <= 0) continue;
    contributions.push({ key: leaf.key, label: leaf.label, weight, load: weight * leaf.magnitude });
  }
  const rawLoad = contributions.reduce((sum, c) => sum + c.load, 0);
  if (rawLoad < DEPARTMENT_WORKLOAD_FLOOR) return null;

  const leafByKey = new Map<RequirementLeafKey, RequirementLeaf>(profile.map((l) => [l.key, l]));
  const weightedMean = (pick: (l: RequirementLeaf) => number) =>
    clamp(contributions.reduce((sum, c) => sum + c.load * pick(leafByKey.get(c.key)!), 0) / rawLoad, 0, 1);

  contributions.sort((a, b) => b.load - a.load);
  return {
    department,
    label: DEPARTMENT_LABELS[department],
    // Saturating aggregate: 1 - e^-load. Several requirements accumulate toward,
    // but never exceed, a fully-loaded department.
    magnitude: clamp(1 - Math.exp(-rawLoad), 0, 1),
    complexity: weightedMean((l) => l.complexity),
    criticality: weightedMean((l) => l.criticality),
    contributions,
    dominantRequirements: contributions.slice(0, 3).map((c) => c.label),
  };
}

/**
 * Derive the workload each modelled department carries for a given requirement
 * profile. Pure. Returns only departments the production actually loads (above
 * the floor), most-loaded first. Departments not returned have no meaningful
 * work in this film.
 */
export function deriveDepartmentWorkloads(profile: RequirementProfile): DepartmentWorkload[] {
  return DEPARTMENT_IDS
    .map((id) => aggregate(id, profile))
    .filter((w): w is DepartmentWorkload => w !== null)
    .sort((a, b) => b.magnitude - a.magnitude);
}

/** Convenience: derive the requirement profile from a script, then its department workloads. */
export function deriveDepartmentWorkloadsForScript(script: Script): DepartmentWorkload[] {
  return deriveDepartmentWorkloads(deriveRequirementProfile(script));
}

/** The workload for one department, or null if the production barely loads it. */
export function workloadFor(profile: RequirementProfile, department: DepartmentId): DepartmentWorkload | null {
  return aggregate(department, profile);
}

/** Plain-text, read-only dev/debug summary. Reads raw scalars (not player-facing). */
export function summarizeDepartmentWorkloads(workloads: DepartmentWorkload[]): string {
  if (workloads.length === 0) return 'No modelled department is meaningfully loaded.';
  const pct = (n: number) => `${Math.round(n * 100)}`;
  return workloads
    .map(
      (w) =>
        `${w.label}: load ${pct(w.magnitude)}% · cplx ${pct(w.complexity)}% · crit ${pct(w.criticality)}%\n` +
        `  ${w.contributions.map((c) => `${c.label} (${pct(c.load)})`).join(' · ')}`,
    )
    .join('\n');
}
