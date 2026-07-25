// Generalized craft-facet model (docs/DESIGN_REVIEW_production_redesign.md, step 4).
//
// Every production/post-production craft facet — Sets, VFX, Practical Effects,
// and later Cinematography / Score / Edit — realises its quality from the same
// three inputs, measured against an ambition target:
//
//   MONEY (buys work fast) × TIME (buys it slowly) × SKILL (multiplies both)
//   vs AMBITION (how demanding the job is)
//
// The load-bearing property, extracted from the Sets prototype: money's weight
// SCALES WITH AMBITION. On a low-ambition facet money barely matters, so skill +
// time fully substitute for it (cheap can match lavish); on a spectacle-scale
// facet money dominates and both money and time have hard floors that skill can't
// duck under. Diminishing returns on both inputs throughout.
//
// This module is the shared, tested core; each facet supplies its own ambition,
// money-t (0..1 dial position), time-ratio (fraction of the head's recommended
// time), skill, and optional per-facet tuning overrides. Pure.
import { clamp } from './random';

/** Per-facet tuning. Every facet starts from DEFAULT_FACET_TUNING and overrides only what differs (e.g. VFX raises the money floors - spectacle needs the spend). */
export interface FacetTuning {
  /** ambition(0..1) × this = the money-t floor below which money is "starved". */
  moneyFloorFrac: number;
  /** the time-ratio floor below which time is "starved" (constant across ambition). */
  timeFloorFrac: number;
  /** how hard a fully-starved input is cut (0..1). */
  starvedFloorMult: number;
  /** money's blend weight at ambition 0 and at ambition 1 (time's is 1 - money's). */
  moneyWeightLow: number;
  moneyWeightHigh: number;
  /** skill's multiplier on capability at skill 0 and skill 100. */
  skillMultMin: number;
  skillMultMax: number;
  /** capability demanded to fully realise, at ambition 0 and rising by slope×ambition. */
  demandBase: number;
  demandSlope: number;
  /** the facet's quality band: a nailed vs botched build at low and at max ambition. */
  ceilingLow: number;
  ceilingHigh: number;
  floorLow: number;
  floorHigh: number;
  /** quality added for realisation past 1.0 (an inspired, over-delivering team). */
  overDeliverBonus: number;
}

export const DEFAULT_FACET_TUNING: FacetTuning = {
  moneyFloorFrac: 0.55,
  timeFloorFrac: 0.5,
  starvedFloorMult: 0.25,
  moneyWeightLow: 0.3,
  moneyWeightHigh: 0.65,
  skillMultMin: 0.72,
  skillMultMax: 1.25,
  demandBase: 0.82,
  demandSlope: 0.6,
  ceilingLow: 62,
  ceilingHigh: 100,
  floorLow: 44,
  floorHigh: 12,
  overDeliverBonus: 18,
};

export interface FacetInput {
  /** How demanding the job is, 0-100 (the facet computes this from script/genre). */
  ambition: number;
  /** The facet's money-dial position, 0..1 (e.g. setQualityT / vfxT). */
  moneyT: number;
  /** Time granted, as a fraction of the head's recommended time. 1.0 = adequate/neutral. */
  timeRatio: number;
  /** The department head's skill, 0-100 (or a fallback when unhired). */
  skill: number;
}

export interface FacetResult {
  /** 0-100 — the facet's contribution to its department sub-score. */
  quality: number;
  /** How much of the ambition the team captured, 0..~1.15 (>1 = over-delivered). */
  realisation: number;
  /** How under-resourced the job is for its ambition, 0..1 — the endogenous-variance driver. */
  stretch: number;
  /** The ambition target this was measured against, 0-100. */
  ambition: number;
}

/** A concave (diminishing-returns) reading of a 0..~1.3 input, allowing a slight over-shoot. */
function concave(x: number): number {
  return Math.sqrt(clamp(x, 0, 1.3));
}

/** An input's contribution, concave and gated below its floor (starvation): below `floor` the contribution is cut sharply toward `starvedMult`. */
function gatedContribution(value01: number, floor: number, starvedMult: number): number {
  const c = concave(value01);
  if (floor <= 0 || value01 >= floor) return c;
  return c * clamp(starvedMult + (1 - starvedMult) * (value01 / floor), 0, 1);
}

/**
 * Realise a facet from money + time + skill against its ambition. Deterministic;
 * the endogenous variance (stretch → on-set/prep events) is layered on
 * separately by the scoring caller, not rolled here.
 */
export function computeFacet(input: FacetInput, tuning: FacetTuning = DEFAULT_FACET_TUNING): FacetResult {
  const a01 = clamp(input.ambition, 0, 100) / 100;
  const skill01 = clamp(input.skill, 0, 100) / 100;
  const moneyT = clamp(input.moneyT, 0, 1);
  const timeRatio = clamp(input.timeRatio, 0, 1.3);

  const moneyContribution = gatedContribution(moneyT, a01 * tuning.moneyFloorFrac, tuning.starvedFloorMult);
  const timeContribution = gatedContribution(timeRatio, tuning.timeFloorFrac, tuning.starvedFloorMult);

  // Money weighted more the more ambitious the job; skill multiplies both.
  const moneyWeight = tuning.moneyWeightLow + (tuning.moneyWeightHigh - tuning.moneyWeightLow) * a01;
  const timeWeight = 1 - moneyWeight;
  const skillMult = tuning.skillMultMin + (tuning.skillMultMax - tuning.skillMultMin) * skill01;
  const capability = skillMult * (moneyWeight * moneyContribution + timeWeight * timeContribution);

  const demand = tuning.demandBase + tuning.demandSlope * a01;
  const realisation = clamp(capability / demand, 0, 1.15);
  const stretch = clamp(1 - capability / demand, 0, 1);

  const ceiling = tuning.ceilingLow + (tuning.ceilingHigh - tuning.ceilingLow) * a01;
  const floor = tuning.floorLow + (tuning.floorHigh - tuning.floorLow) * a01;
  const base = floor + (ceiling - floor) * clamp(realisation, 0, 1);
  const overDeliver = realisation > 1 ? ((realisation - 1) / 0.15) * tuning.overDeliverBonus : 0;
  const quality = clamp(Math.round(base + overDeliver), 0, 100);

  return { quality, realisation, stretch, ambition: input.ambition };
}

/** The qualitative forecast a department head gives, read off `stretch` (how wide the gamble is). */
export type FacetConfidence = 'confident' | 'workable' | 'a-stretch' | 'set-up-to-fail';

export function facetConfidence(result: FacetResult): FacetConfidence {
  if (result.stretch < 0.1) return 'confident';
  if (result.stretch < 0.3) return 'workable';
  if (result.stretch < 0.5) return 'a-stretch';
  return 'set-up-to-fail';
}
