// Casting Appeal Rework - director interest. Structurally parallel to
// engine/castingAppeal.ts's actor-side computeActorAppeal (same building
// blocks: prestigeLean, computeSelectiveness, computeEffectiveMinimumSalary,
// computeSalaryFit, computeScheduleAssessment, a resolveOfferResponse-shaped
// resolution) but kept as its own file rather than folded in - that file's
// own header scopes "the one appeal function" explicitly to the three actor
// attachment paths, and a director's hard prestige-vs-fame gate has no
// actor equivalent to share a formula with.
//
// Before this file existed, Director hiring (components/wizard/RoleHiringDrawer.tsx)
// had no interest step at all - any director in a studio's price band
// attached instantly on click. That let a no-name studio instant-hire a
// director whose fame implies they'd never actually consider such an
// offer. The gate below is checked first, ahead of any scoring: below it,
// no script quality or salary makes the studio interesting to them.
import type { GameDay, Money, Person, Script, Studio } from '../types';
import { getDirectorCareer } from './person';
import { computeScriptScore } from './scoring';
import { clamp } from './random';
import {
  computeAcceptanceThreshold,
  computeEffectiveMinimumSalary,
  computeSalaryFit,
  computeScheduleAssessment,
  prestigeLean,
  type ActorScheduleAssessment,
} from './castingAppeal';

export interface DirectorAppealFactors {
  /** computeScriptScore(script), reused directly - how good the material itself reads, independent of who's offering it. */
  scriptFit: number;
  /** studio.brand, weighted by this director's own commercial lean. */
  brandFit: number;
  /** studio.prestige + script quality, weighted by this director's own prestige lean - no "director reputation" term the way an actor's prestigeFit has, since this director *is* the one being sized up here. */
  prestigeFit: number;
  /** Offered salary vs. this director's own effective minimum/typicalSalary - identical mechanism to the actor path (computeEffectiveMinimumSalary), just with no directorDraw input (a director isn't drawn to themselves). */
  salaryFit: number;
}

export type DirectorAppealResult = DirectorAppealFactors & {
  overall: number;
  schedule: ActorScheduleAssessment;
  belowSalaryFloor: boolean;
};

// A director's own fame sets a floor on how prestigious a studio has to be
// before they're interested at all, independent of script quality or
// salary - first-draft, tunable linear ramp. A brand-new studio (prestige
// 20, createInitialStudio's own starting value) only clears this for a
// director with fame under ~37; a fame-95 A-lister needs studio prestige
// north of 66.
const PRESTIGE_GATE_FAME_RATIO = 0.8;
const PRESTIGE_GATE_OFFSET = 10;

function requiredStudioPrestige(director: Person): number {
  return clamp(director.reputation.fame * PRESTIGE_GATE_FAME_RATIO - PRESTIGE_GATE_OFFSET, 0, 100);
}

function computeDirectorPrestigeSignal(studio: Studio, script: Script): number {
  return studio.prestige * 0.5 + computeScriptScore(script) * 0.5;
}

const WEIGHTS = {
  scriptFit: 0.4,
  reputationFit: 0.35,
  salaryFit: 0.25,
};

/**
 * How interested this director is in directing this script for this
 * studio, at this offered salary - null only if `person` has no Director
 * career at all. `'prestige-gate'` (checked first, ahead of any scoring)
 * means this director won't consider this studio at all right now,
 * regardless of script quality or salary - see requiredStudioPrestige.
 */
export function computeDirectorAppeal(
  person: Person,
  script: Script,
  studio: Studio,
  offeredSalary: Money,
  plannedStartDay: GameDay,
): DirectorAppealResult | 'prestige-gate' | null {
  const career = getDirectorCareer(person);
  if (!career) return null;

  if (studio.prestige < requiredStudioPrestige(person)) return 'prestige-gate';

  const lean = prestigeLean(person);
  const prestigeSignal = computeDirectorPrestigeSignal(studio, script);
  // No directorDraw term - a director isn't drawn to working with
  // themselves the way an actor can be drawn to a director already
  // attached.
  const effectiveMinimum = computeEffectiveMinimumSalary(person, career.minimumSalary, prestigeSignal, 0);

  const factors: DirectorAppealFactors = {
    scriptFit: computeScriptScore(script),
    brandFit: studio.brand * (1 - lean),
    prestigeFit: prestigeSignal * lean,
    salaryFit: computeSalaryFit(offeredSalary, effectiveMinimum, career.typicalSalary),
  };

  const reputationFit = factors.brandFit + factors.prestigeFit;
  const overall =
    factors.scriptFit * WEIGHTS.scriptFit + reputationFit * WEIGHTS.reputationFit + factors.salaryFit * WEIGHTS.salaryFit;

  return {
    ...factors,
    overall: clamp(overall, 0, 100),
    schedule: computeScheduleAssessment(person, plannedStartDay),
    belowSalaryFloor: offeredSalary < effectiveMinimum,
  };
}

export type DirectorOfferRejectionReason = 'prestige-gate' | 'script-fit' | 'brand-prestige-mismatch' | 'salary' | 'schedule';

export type DirectorOfferResponse = { status: 'accepted' } | { status: 'rejected'; reason: DirectorOfferRejectionReason };

function directorRejectionReason(factors: DirectorAppealFactors, reputationFit: number): DirectorOfferRejectionReason {
  const candidates: Array<[DirectorOfferRejectionReason, number]> = [
    ['script-fit', factors.scriptFit],
    ['brand-prestige-mismatch', reputationFit],
    ['salary', factors.salaryFit],
  ];
  return candidates.reduce((worst, candidate) => (candidate[1] < worst[1] ? candidate : worst))[0];
}

/**
 * Resolves one director offer - mirrors engine/castingAppeal.ts:resolveOfferResponse's
 * ordering exactly (prestige gate, then schedule, then the salary floor,
 * all ahead of the soft `overall`-vs-selectiveness comparison). `null` only
 * when `computeDirectorAppeal` itself returned null (no Director career).
 */
export function resolveDirectorOfferResponse(
  outcome: DirectorAppealResult | 'prestige-gate' | null,
  person: Person,
): DirectorOfferResponse | null {
  if (outcome === null) return null;
  if (outcome === 'prestige-gate') return { status: 'rejected', reason: 'prestige-gate' };
  if (outcome.schedule.status !== 'available') return { status: 'rejected', reason: 'schedule' };
  if (outcome.belowSalaryFloor) return { status: 'rejected', reason: 'salary' };
  const threshold = computeAcceptanceThreshold(person);
  if (outcome.overall >= threshold) return { status: 'accepted' };
  const reputationFit = outcome.brandFit + outcome.prestigeFit;
  return { status: 'rejected', reason: directorRejectionReason(outcome, reputationFit) };
}
