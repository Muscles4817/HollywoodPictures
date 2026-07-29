// Workstream II, Phase C — the crew fit-read floor (docs/DESIGN_crew_role_designs.md).
// Reads a department head's technical capability against the department's derived
// workload (Layer 3) and produces a QUALITATIVE suitability verdict — "how suited
// is this head to THIS film's demands", not a number. This is the first slice
// that surfaces the requirements model to the player.
//
// Calibration-safe, like the layers beneath it: it reads capability (existing
// crew `skill`) against workload (a pure Layer-3 derivation) and emits a read. It
// changes neither cost nor scoring — the facet model still decides realised
// quality; this only tells the player what the hire is walking into. Player-facing
// output is bands + prose; the raw scores are dev/test-only.
//
// v1 reads a FLAT capability (crew heads carry a single `skill`; per-specialty
// capability doesn't exist in the data yet). When heads gain specialties, this
// read refines to per-specialty without changing its shape or its consumers.
import type { DepartmentId, DepartmentWorkload } from './departmentWorkload';
import { DEPARTMENT_LABELS } from './departmentWorkload';
import { clamp } from './random';

/** How hard this film is for the department. */
export type DemandBand = 'light' | 'moderate' | 'demanding' | 'severe';

/** The head's standing relative to the demand. */
export type CrewSuitability = 'overqualified' | 'strong' | 'solid' | 'stretch' | 'outmatched';

/** How proven the read is — a known résumé vs an unproven one. */
export type FitConfidence = 'proven' | 'established' | 'unproven';

/** A head's capability as this read consumes it. */
export interface CrewCapability {
  skill: number; // 0-100 technical capability
  experience?: number; // 0-100; absent for the stunt team (no career track)
  /** false = the no-hire fallback skill (the gap the film faces with nobody attached). */
  hired: boolean;
}

export interface CrewFitRead {
  department: DepartmentId;
  departmentLabel: string;
  hired: boolean;
  demand: DemandBand;
  suitability: CrewSuitability;
  confidence: FitConfidence;
  /** The department is make-or-break for this film (high routed criticality). */
  critical: boolean;
  headline: string; // qualitative one-liner, no digits
  detail: string; // a sentence: demand vs capability + stakes
  // --- raw, dev/test only — never shown to the player ---
  demandScore: number;
  capabilityScore: number;
  margin: number;
}

const DEMAND_ADJECTIVE: Record<DemandBand, string> = {
  light: 'light',
  moderate: 'moderate',
  demanding: 'demanding',
  severe: 'severe',
};

function demandBand(score: number): DemandBand {
  if (score >= 0.7) return 'severe';
  if (score >= 0.45) return 'demanding';
  if (score >= 0.22) return 'moderate';
  return 'light';
}

function suitabilityBand(margin: number): CrewSuitability {
  if (margin >= 0.22) return 'overqualified';
  if (margin >= 0.08) return 'strong';
  if (margin >= -0.08) return 'solid';
  if (margin >= -0.22) return 'stretch';
  return 'outmatched';
}

function confidenceBand(capability: CrewCapability): FitConfidence {
  if (capability.experience === undefined) return 'established'; // a contracted team with a known record
  if (capability.experience >= 66) return 'proven';
  if (capability.experience >= 33) return 'established';
  return 'unproven';
}

// Prose for a head who IS attached — the relationship between what they can do
// and what the film asks, with the stakes (criticality) folded in.
const HIRED_HEADLINE: Record<CrewSuitability, string> = {
  overqualified: 'Comfortably beyond what this film asks',
  strong: 'A strong fit for the demands',
  solid: 'A solid match for the workload',
  stretch: 'A stretch on a demanding brief',
  outmatched: "Outmatched by this film's demands",
};

function hiredDetail(read: Pick<CrewFitRead, 'suitability' | 'demand' | 'critical' | 'departmentLabel'>): string {
  const demand = DEMAND_ADJECTIVE[read.demand];
  const stakes = read.critical ? ` ${read.departmentLabel} is central to this film, so the gap matters.` : '';
  switch (read.suitability) {
    case 'overqualified':
      return `The ${demand} ${read.departmentLabel.toLowerCase()} workload sits well within their range.`;
    case 'strong':
      return `Comfortably equal to the ${demand} workload.`;
    case 'solid':
      return `About matched to the ${demand} workload — no obvious gap.`;
    case 'stretch':
      return `The ${demand} workload will test them.${stakes}`;
    case 'outmatched':
      return `The ${demand} workload is beyond their proven range.${stakes}`;
  }
}

/**
 * Read a head's capability against a department's workload. Pure. `workload` is
 * the Layer-3 DepartmentWorkload for the department this head runs.
 */
export function deriveCrewFitRead(capability: CrewCapability, workload: DepartmentWorkload): CrewFitRead {
  const demandScore = clamp(0.6 * workload.magnitude + 0.4 * workload.complexity, 0, 1);
  const capabilityScore = clamp(capability.skill / 100, 0, 1);
  const margin = capabilityScore - demandScore;
  const demand = demandBand(demandScore);
  const suitability = suitabilityBand(margin);
  const confidence = confidenceBand(capability);
  const critical = workload.criticality >= 0.55;
  const departmentLabel = workload.label;

  let headline: string;
  let detail: string;
  if (!capability.hired) {
    headline = `Unstaffed — ${DEMAND_ADJECTIVE[demand]} ${departmentLabel.toLowerCase()} demands`;
    detail =
      demand === 'light'
        ? `This film asks little of ${departmentLabel.toLowerCase()}; a modest head will do.`
        : `This film makes ${DEMAND_ADJECTIVE[demand]} ${departmentLabel.toLowerCase()} demands — worth attaching a capable head.`;
  } else {
    headline = HIRED_HEADLINE[suitability];
    detail = hiredDetail({ suitability, demand, critical, departmentLabel });
    if (confidence === 'unproven') detail += ' Highly rated, but largely unproven.';
  }

  return {
    department: workload.department,
    departmentLabel,
    hired: capability.hired,
    demand,
    suitability,
    confidence,
    critical,
    headline,
    detail,
    demandScore,
    capabilityScore,
    margin,
  };
}

/**
 * Fit-read for a department the film does NOT meaningfully load (no workload
 * returned by Layer 3). There is nothing to be suited to — reported plainly so
 * consumers can show "not a factor on this film" rather than a false stretch.
 */
export function unloadedDepartmentRead(department: DepartmentId, hired: boolean): CrewFitRead {
  return {
    department,
    departmentLabel: DEPARTMENT_LABELS[department],
    hired,
    demand: 'light',
    suitability: 'overqualified',
    confidence: 'established',
    critical: false,
    headline: 'Barely a factor on this film',
    detail: `This film makes little demand on ${DEPARTMENT_LABELS[department].toLowerCase()}.`,
    demandScore: 0,
    capabilityScore: hired ? 1 : 0,
    margin: hired ? 1 : 0,
  };
}
