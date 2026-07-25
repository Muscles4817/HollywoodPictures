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

// --- Endogenous variance: the execution swing (spec §3.3/§3.4) --------------
//
// computeFacet is the deterministic base — what the plan BUYS. On top of it,
// how the facet actually CAME OUT swings around that base, and `stretch` sets
// how wide that swing can be:
//
//   - Low stretch (well-funded for the ambition) → a tight band near the base:
//     dependable, rarely spectacular.
//   - High stretch (attempting more than you comfortably funded) → a WIDE band,
//     and who you hired biases where in it you land. An elite head on an
//     under-funded, ambitious plan is a genuine boom-or-bust bet; the same plan
//     with a weak head is just a bust.
//
// The swing is a PURE, DETERMINISTIC read of already-recorded facts (the facet's
// own on-set/prep events, already rolled day by day) — no new randomness at
// scoring time, same as engine/productionExecution.ts. Two inputs shape it:
//   - eventSignal: net (resilience-mitigated) quality points from the facet's
//     own events — the endogenous roll that already happened during the shoot.
//   - skill: the head's skill (0-100) — tilts the band toward the upside; the
//     "buy the upside of the widening" lever, and it only bites under stretch.

export interface FacetSwingTuning {
  /** the widest the swing can reach (± quality points) at full stretch. */
  maxHalfWidth: number;
  /** event net points that map to a full-magnitude roll (tanh scale). */
  eventScale: number;
  /** how far the head's skill alone tilts the roll at full stretch (0..1 of the band). */
  skillTilt: number;
  /** how the band width grows with stretch (<1 = a low-stretch plan already has a little give). */
  stretchExponent: number;
}

export const DEFAULT_SWING_TUNING: FacetSwingTuning = {
  maxHalfWidth: 22,
  eventScale: 10,
  skillTilt: 0.6,
  stretchExponent: 0.85,
};

/**
 * The swing (± quality points) to add to a facet's deterministic base. Centred
 * near 0 at low stretch (a tight, dependable band); at high stretch it fans out,
 * the facet's own events roll it up or down, and skill tilts it toward the
 * upside. Bounded by the stretch-scaled band, so no single input runs away.
 */
export function executionSwing(
  stretch: number,
  skill: number,
  eventSignal: number,
  tuning: FacetSwingTuning = DEFAULT_SWING_TUNING,
): number {
  const halfWidth = Math.pow(clamp(stretch, 0, 1), tuning.stretchExponent) * tuning.maxHalfWidth;
  const roll = Math.tanh(eventSignal / tuning.eventScale); // where the events landed, -1..1
  const tilt = ((clamp(skill, 0, 100) - 50) / 50) * tuning.skillTilt; // skill's directional bias
  const position = clamp(roll + tilt, -1, 1);
  return halfWidth * position;
}

/**
 * A facet's DELIVERED quality once the shoot is done: the deterministic base
 * (what the plan bought) plus its execution swing (how it actually came out).
 * `eventSignal` defaults to 0, so a forecast — or a shoot with no events for this
 * facet — is exactly the base. Every craft facet realises through this.
 */
export function realiseFacetQuality(
  facet: FacetResult,
  skill: number,
  eventSignal = 0,
  tuning: FacetSwingTuning = DEFAULT_SWING_TUNING,
): number {
  return clamp(Math.round(facet.quality + executionSwing(facet.stretch, skill, eventSignal, tuning)), 0, 100);
}

/**
 * The boom-or-bust read of a plan, for the planning conversation (spec §3.3).
 * `spread` = how much the shoot can swing the facet around its funded base (from
 * stretch: comfortably-funded is dependable, over-reaching is a gamble). `lean` =
 * which way the head's skill tips that gamble — only meaningful when the spread
 * isn't tight. Qualitative only; the UI turns it into the head's own words.
 */
export interface FacetOutlook {
  spread: 'tight' | 'moderate' | 'wide';
  lean: 'promising' | 'even' | 'precarious';
}

export function facetOutlook(facet: FacetResult, skill: number): FacetOutlook {
  const spread = facet.stretch < 0.12 ? 'tight' : facet.stretch < 0.35 ? 'moderate' : 'wide';
  const lean = skill >= 68 ? 'promising' : skill <= 45 ? 'precarious' : 'even';
  return { spread, lean };
}
