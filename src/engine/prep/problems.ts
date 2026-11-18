// The film's real prep problems, drawn once at greenlight
// (docs/DESIGN_REVIEW_preproduction_realism.md §1.3, §4.2). What a film can go
// wrong on follows from what it asks of each front: a heavy front has more and
// worse problems. A prep shorter than recommended worsens the long-lead ones -
// a chain cannot be compressed (04 §1.3) - and a longer one eases them.
// Drawn from the film's own seed, so the same film's problems replay.
import type { PrepProblem } from '../../types';
import { PREP_FRONT_LIVE_THRESHOLD, PREP_PROBLEMS, PREP_SHORTFALL_SEVERITY, type PrepProblemKind } from '../../data/prep';
import type { FrontDemand } from './demands';
import { clamp, createRng, randFloat, type RandomFn } from '../random';

/** Problems of one kind on one film are few: past this, they are one bigger problem. */
const MAX_PER_KIND = 3;

function poisson(rng: RandomFn, mean: number): number {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = rng();
  while (p > limit && k < MAX_PER_KIND) {
    k += 1;
    p *= rng();
  }
  return k;
}

export interface ProblemGenerationInput {
  demands: FrontDemand[];
  /** The prep length chosen, as a share of the recommendation. */
  lengthFactor: number;
  /** A lead known to be hard to work with (the trait the old prep bank gated its clash on). */
  difficultLead: boolean;
}

export function generatePrepProblems(input: ProblemGenerationInput, seed: number): PrepProblem[] {
  const rng = createRng(seed);
  const demandOf = new Map(input.demands.map((d) => [d.front, d.demand]));
  const problems: PrepProblem[] = [];
  for (const kind of Object.keys(PREP_PROBLEMS) as PrepProblemKind[]) {
    const spec = PREP_PROBLEMS[kind];
    const demand = demandOf.get(spec.front) ?? 0;
    // Draw for every kind, live or not, so one front's change never reshuffles another's problems.
    const count = kind === 'difficult-star' ? (input.difficultLead ? 1 : 0) : poisson(rng, spec.rate * demand);
    const severities = Array.from({ length: MAX_PER_KIND }, () => randFloat(rng, spec.severity[0], spec.severity[1]));
    if (demand < PREP_FRONT_LIVE_THRESHOLD && kind !== 'difficult-star') continue;
    for (let i = 0; i < count; i++) {
      let severity = severities[i] * (0.5 + 0.5 * demand);
      if (spec.leadTime) severity *= Math.max(0.3, 1 + PREP_SHORTFALL_SEVERITY * (1 - input.lengthFactor));
      problems.push({ id: `${kind}-${i}`, kind, front: spec.front, severity: clamp(severity, 0.05, 1), foundOnDay: null, resolution: null });
    }
  }
  return problems;
}
