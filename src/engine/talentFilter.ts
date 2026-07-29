import type { Person, ProductionRole } from '../types';
import { getTypicalSalaryForRole } from './person';
import { DISCOVERY_FAME_CEILING } from './castingCalls';

// Direct Approach scouting (casting redesign follow-up). Direct Approach is for
// pursuing KNOWN talent by name and facet - the salary bar there is only your
// offer, never a filter on who's shown. Who you can even scout is gated by fame:
//
//   - With no Casting Director you can only approach genuinely famous actors
//     (fame >= DIRECT_APPROACH_FAMOUS_FLOOR - "established" and up).
//   - A Casting Director's eye lowers that floor in proportion to their skill,
//     surfacing progressively more obscure names.
//   - Even the best Casting Director can't scout past DIRECT_APPROACH_HARD_FLOOR.
//     Below it sit the "hidden gems" (fame <= DISCOVERY_FAME_CEILING) - unknowns
//     you can't find by scouting at all, only by holding a casting call, where
//     the discovery pick (engine/castingCalls.ts) can turn one up.
//
// The hard floor IS the casting-call discovery ceiling + 1, so the two channels
// partition the pool on exactly one shared line with no gap or overlap. All
// tunable first-draft values.
export const DIRECT_APPROACH_FAMOUS_FLOOR = 45;
export const DIRECT_APPROACH_HARD_FLOOR = DISCOVERY_FAME_CEILING + 1; // 26

/**
 * The minimum fame an actor needs to be scoutable by Direct Approach, given the
 * production's hired Casting Director skill (0-100, or null/0 for none). Ranges
 * from DIRECT_APPROACH_FAMOUS_FLOOR with no CD down to DIRECT_APPROACH_HARD_FLOOR
 * with a top one. Deterministic.
 */
export function directApproachFameFloor(castingDirectorSkill: number | null | undefined): number {
  const skill = Math.max(0, Math.min(100, castingDirectorSkill ?? 0));
  const t = skill / 100;
  return Math.round(DIRECT_APPROACH_FAMOUS_FLOOR - t * (DIRECT_APPROACH_FAMOUS_FLOOR - DIRECT_APPROACH_HARD_FLOOR));
}

/** Whether this actor is famous/known enough to scout by Direct Approach at the given Casting Director skill. */
export function scoutableByDirectApproach(person: Person, castingDirectorSkill: number | null | undefined): boolean {
  return person.reputation.fame >= directApproachFameFloor(castingDirectorSkill);
}

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
