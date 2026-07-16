import type { Person, ProductionRole } from '../types';
import { getTypicalSalaryForRole } from './person';

// Percentage bands tried in order: start tight, only widen if that leaves
// too few real options. The common case should land on the first step.
const TOLERANCE_STEPS = [0.1, 0.2, 0.35, 0.6, 1.0];
const MIN_RESULTS = 3;

export interface NearbyCandidates {
  candidates: Person[];
  /** The tolerance band that was actually needed, e.g. 0.1 for ±10%. */
  toleranceUsed: number;
}

/**
 * Filters candidates down to ones genuinely close to the target price,
 * instead of always returning "the N closest" regardless of how far away
 * even the closest ones are. Starts at a tight ±10% band; only widens if
 * that band has fewer than MIN_RESULTS candidates in it, so a sparse patch
 * of the salary range doesn't leave the player looking at an empty grid.
 * Salary is read under `role` (see engine/person.ts:getTypicalSalaryForRole)
 * - the same person can have a very different typical salary under a
 * different career, so which role they're being priced for has to be
 * explicit rather than assumed.
 */
export function findCandidatesNearPrice(candidates: Person[], role: ProductionRole, targetPrice: number, maxCount: number): NearbyCandidates {
  const salaryOf = (c: Person) => getTypicalSalaryForRole(c, role);
  for (const tolerance of TOLERANCE_STEPS) {
    const band = candidates.filter((c) => Math.abs(salaryOf(c) - targetPrice) <= targetPrice * tolerance);
    const isLastStep = tolerance === TOLERANCE_STEPS[TOLERANCE_STEPS.length - 1];
    if (band.length >= MIN_RESULTS || isLastStep) {
      const sorted = band.sort((a, b) => Math.abs(salaryOf(a) - targetPrice) - Math.abs(salaryOf(b) - targetPrice));
      return { candidates: sorted.slice(0, maxCount), toleranceUsed: tolerance };
    }
  }
  /* istanbul ignore next - unreachable: the loop always returns on its last step */
  return { candidates: [], toleranceUsed: TOLERANCE_STEPS[TOLERANCE_STEPS.length - 1] };
}
