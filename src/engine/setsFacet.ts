// Sets & Design facet — the first slice of the Production redesign
// (docs/DESIGN_REVIEW_production_redesign.md). Replaces the flat, monotonic
// `setQualityScore(setQualityAmount)` term in the Production sub-score with a
// model where the physical look of the film is realised from THREE inputs —
// money, time, and the Production Designer's skill — against an ambition target
// the script sets. This is what makes the 2×2 reachable:
//
//   spend lots + rushed/weak designer  -> money wasted, looks expensive-but-off
//   spend lots + time + great designer -> the ceiling, realised
//   spend little + rushed/weak designer -> looks cheap
//   spend little + time + great designer -> punches above its budget
//
// Bounded by AMBITION (the refinement from the spec §3.2): both money and time
// have diminishing returns AND an ambition-scaled floor. On a low/moderate-
// ambition film a skilled, patient, cheap build can FULLY match a lavish one;
// on a spectacle-scale one there is a hard minimum of both money and time that
// no amount of skill ducks under. Ambition is the master dial.
//
// Pure: plain data in, plain numbers out. Tunable first-draft constants at top.
import type { Script } from '../types';
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
import { ENVIRONMENT_BUDGET_RANGE } from '../data/production';
import { setQualityT } from './productionDials';
import { logAmount } from './interpolate';
import { clamp } from './random';

// --- Tunables --------------------------------------------------------------

/** Skill of the Sets/Design work when NO Production Designer is hired — an unmanaged art department: workable, never inspired. */
export const NO_DESIGNER_SKILL = 40;

// Ambition weighting: how the setting/scale demands translate to a 0-100 "how
// demanding is the physical world" target.
const SCALE_AMBITION: Record<Script['scale'], number> = { Intimate: 0.2, Medium: 0.55, Epic: 1 };

// The designer's build asks. Needed days rise with ambition; skill trims them.
const BASE_DESIGN_DAYS = 6;
const MAX_EXTRA_DESIGN_DAYS = 34; // an epic build wants ~6..40 prep days before skill
const SKILL_TIME_EFFICIENCY = 0.25; // an elite designer needs up to 25% less time
const SKILL_MONEY_EFFICIENCY = 0.18; // ...and asks ~18% less money

// Ambition floors (spec §3.2): below these, the input is "starved" and the
// facet can't reach its ceiling no matter the other input or skill.
const MONEY_FLOOR_FRAC = 0.55; // a max-ambition build needs >= 0.55 of the money range
const TIME_FLOOR_FRAC = 0.5;   // ...and >= 0.5 of the designer's needed prep days
const STARVED_FLOOR_MULT = 0.25; // how hard the contribution is cut at zero of its floor input

// Capability blend: money's weight SCALES WITH AMBITION (spec §3.2 - the master
// dial). On a low-ambition build money barely matters, so skill + time fully
// substitute for it (cheap can match lavish); on a spectacle-scale build money
// dominates, so it becomes mandatory (skill + time can't fully cover for it).
const MONEY_WEIGHT_LOW = 0.3; // ambition 0: time/skill-driven, money optional
const MONEY_WEIGHT_HIGH = 0.65; // ambition 1: money-driven, mandatory
const SKILL_MULT_MIN = 0.72; // a weak designer
const SKILL_MULT_MAX = 1.25; // an elite one can over-deliver

// How much capability the ambition demands to fully realise. Higher ambition
// demands more, so the same resources realise a smaller fraction of a bigger
// vision. Calibrated so an adequate/average build (mid money, adequate time,
// unmanaged art dept) lands near the old flat set-quality baseline.
const DEMAND_BASE = 0.82;
const DEMAND_SLOPE = 0.6;

// Facet score band: ambition raises BOTH the ceiling (a realised epic dazzles)
// and the downside (a botched epic is a catastrophe; a botched simple set is
// merely plain).
const CEILING_LOW = 62;   // a nailed low-ambition build — "looks good for what it is"
const CEILING_HIGH = 100; // a nailed epic build
const FLOOR_LOW = 44;     // a botched low-ambition build — still passable
const FLOOR_HIGH = 12;    // a botched epic build — a disaster
const OVER_DELIVER_BONUS = 18; // realisation past 1.0 (an inspired team) adds up to this

// --- Ambition --------------------------------------------------------------

/** How demanding the physical world/design is, 0-100, from the script's setting archetype + scale. A single-room contemporary drama sits low; a period epic or built-world spectacle sits high. */
export function computeSetsAmbition(script: Script): number {
  const p = SETTING_ARCHETYPE_PROFILES[script.primarySetting];
  const settingRaw = clamp(
    0.5 * p.setConstructionDemand + 0.3 * p.environmentScale + 0.1 * p.locationComplexity + (p.periodSetting ? 0.18 : 0),
    0,
    1,
  );
  const ambition01 = clamp(0.6 * settingRaw + 0.4 * SCALE_AMBITION[script.scale], 0, 1);
  return Math.round(ambition01 * 100);
}

// --- The designer's ask (for the conversation UX) --------------------------

export interface DesignerAsk {
  /** Recommended design budget in £ (what the designer would want for this ambition). */
  neededMoney: number;
  /** Recommended prep days to build it. */
  neededDays: number;
}

/** What the Production Designer asks for to comfortably hit the ambition — the basis of the planning conversation. A more skilled designer asks for a little less of both. */
export function designerAsk(ambition: number, designerSkill: number): DesignerAsk {
  const a01 = clamp(ambition, 0, 100) / 100;
  const skill01 = clamp(designerSkill, 0, 100) / 100;
  const neededDays = Math.round(
    (BASE_DESIGN_DAYS + a01 * MAX_EXTRA_DESIGN_DAYS) * (1 - SKILL_TIME_EFFICIENCY * skill01),
  );
  const neededMoneyT = clamp((0.2 + 0.72 * a01) * (1 - SKILL_MONEY_EFFICIENCY * skill01), 0.02, 1);
  return { neededMoney: Math.round(logAmount(neededMoneyT, ENVIRONMENT_BUDGET_RANGE)), neededDays };
}

/** The default prep days to grant when the player hasn't set an explicit design allocation — the designer's own recommended build time. */
export function defaultDesignPrepDays(ambition: number, designerSkill: number): number {
  return designerAsk(ambition, designerSkill).neededDays;
}

// --- The facet ------------------------------------------------------------

export interface SetsFacet {
  /** 0-100 — the Sets/Design contribution to the Production sub-score. */
  quality: number;
  /** How much of the ambition the team captured, 0..~1.15 (>1 = over-delivered). */
  realisation: number;
  /** How under-resourced the build is for its ambition, 0..1 — the endogenous-variance driver. */
  stretch: number;
  /** The ambition target this was measured against, 0-100. */
  ambition: number;
}

/** A concave (diminishing-returns) reading of a 0..~1.3 input, allowing a slight over-shoot. */
function concave(x: number): number {
  return Math.sqrt(clamp(x, 0, 1.3));
}

/** An input's contribution, concave and gated below its ambition floor (starvation). `floor` is the minimum fraction (of the input's own 0..1 scale) the ambition demands. */
function gatedContribution(value01: number, floor: number): number {
  const c = concave(value01);
  if (floor <= 0 || value01 >= floor) return c;
  // Below the floor, the contribution is cut sharply toward STARVED_FLOOR_MULT.
  return c * clamp(STARVED_FLOOR_MULT + (1 - STARVED_FLOOR_MULT) * (value01 / floor), 0, 1);
}

function skillMult(skill01: number): number {
  return SKILL_MULT_MIN + (SKILL_MULT_MAX - SKILL_MULT_MIN) * clamp(skill01, 0, 1);
}

export interface SetsFacetInput {
  ambition: number; // 0-100 (computeSetsAmbition)
  moneyAmount: number; // £ (ProductionChoices.setQualityAmount)
  prepDays: number; // days granted to design
  designerSkill: number; // 0-100 (hired designer, or NO_DESIGNER_SKILL)
}

/**
 * Realise the Sets facet from money + time + skill against the ambition target.
 * Deterministic; the endogenous variance (stretch → on-set/prep visual events)
 * is layered on separately by the scoring caller, not rolled here.
 */
export function computeSetsFacet(input: SetsFacetInput): SetsFacet {
  const a01 = clamp(input.ambition, 0, 100) / 100;
  const skill01 = clamp(input.designerSkill, 0, 100) / 100;
  const moneyT = setQualityT(input.moneyAmount); // 0..1 (log over the env-budget range)

  const needs = designerAsk(input.ambition, input.designerSkill);
  const timeRatio = needs.neededDays > 0 ? clamp(input.prepDays / needs.neededDays, 0, 1.3) : 1;

  // Ambition-scaled floors. Money floor is on the money's own 0..1 scale; time
  // floor is on the time RATIO (fraction of the designer's needed days).
  const moneyContribution = gatedContribution(moneyT, a01 * MONEY_FLOOR_FRAC);
  const timeContribution = gatedContribution(timeRatio, TIME_FLOOR_FRAC);

  // Money weighted more the more ambitious the build; skill multiplies both.
  const moneyWeight = MONEY_WEIGHT_LOW + (MONEY_WEIGHT_HIGH - MONEY_WEIGHT_LOW) * a01;
  const timeWeight = 1 - moneyWeight;
  const capability = skillMult(skill01) * (moneyWeight * moneyContribution + timeWeight * timeContribution);

  // Ambitious facets demand more capability to realise the same fraction.
  const demand = DEMAND_BASE + DEMAND_SLOPE * a01;
  const realisation = clamp(capability / demand, 0, 1.15);
  const stretch = clamp(1 - capability / demand, 0, 1);

  const ceiling = CEILING_LOW + (CEILING_HIGH - CEILING_LOW) * a01;
  const floor = FLOOR_LOW + (FLOOR_HIGH - FLOOR_LOW) * a01;
  const base = floor + (ceiling - floor) * clamp(realisation, 0, 1);
  const overDeliver = realisation > 1 ? (realisation - 1) / 0.15 * OVER_DELIVER_BONUS : 0;
  const quality = clamp(Math.round(base + overDeliver), 0, 100);

  return { quality, realisation, stretch, ambition: input.ambition };
}

// --- The designer's confidence (the conversation's forecast) ---------------

export type DesignerConfidence = 'confident' | 'workable' | 'a-stretch' | 'set-up-to-fail';

/**
 * The qualitative forecast the designer gives as you move the money/time dials —
 * driven by realisation (are we going to hit it?) and stretch (how wide is the
 * gamble?). This is the player's ballpark, in character rather than as a number.
 */
export function designerConfidence(facet: SetsFacet): DesignerConfidence {
  if (facet.stretch < 0.1) return 'confident';
  if (facet.stretch < 0.3) return 'workable';
  if (facet.stretch < 0.5) return 'a-stretch';
  return 'set-up-to-fail';
}
