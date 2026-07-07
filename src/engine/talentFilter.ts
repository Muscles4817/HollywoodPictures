import type { Talent } from '../types';

// Percentage bands tried in order: start tight, only widen if that leaves
// too few real options. The common case should land on the first step.
const TOLERANCE_STEPS = [0.1, 0.2, 0.35, 0.6, 1.0];
const MIN_RESULTS = 3;

export interface NearbyCandidates {
  candidates: Talent[];
  /** The tolerance band that was actually needed, e.g. 0.1 for ±10%. */
  toleranceUsed: number;
}

/**
 * Filters candidates down to ones genuinely close to the target price,
 * instead of always returning "the N closest" regardless of how far away
 * even the closest ones are. Starts at a tight ±10% band; only widens if
 * that band has fewer than MIN_RESULTS candidates in it, so a sparse patch
 * of the salary range doesn't leave the player looking at an empty grid.
 */
export function findCandidatesNearPrice(candidates: Talent[], targetPrice: number, maxCount: number): NearbyCandidates {
  for (const tolerance of TOLERANCE_STEPS) {
    const band = candidates.filter((c) => Math.abs(c.salary - targetPrice) <= targetPrice * tolerance);
    const isLastStep = tolerance === TOLERANCE_STEPS[TOLERANCE_STEPS.length - 1];
    if (band.length >= MIN_RESULTS || isLastStep) {
      const sorted = band.sort((a, b) => Math.abs(a.salary - targetPrice) - Math.abs(b.salary - targetPrice));
      return { candidates: sorted.slice(0, maxCount), toleranceUsed: tolerance };
    }
  }
  /* istanbul ignore next - unreachable: the loop always returns on its last step */
  return { candidates: [], toleranceUsed: TOLERANCE_STEPS[TOLERANCE_STEPS.length - 1] };
}
