// Sets & Design facet (docs/DESIGN_REVIEW_production_redesign.md). The physical
// look of the film — sets, locations, dressing, props — realised from money +
// prep time + Production Designer skill against the script's design ambition, on
// the shared facet model (engine/facetModel.ts). This module owns only the
// Sets-specific bits: the ambition source, the designer's ask, and the mapping
// of ProductionChoices → the generic FacetInput. Pure.
import type { Script } from '../types';
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
import { ENVIRONMENT_BUDGET_RANGE } from '../data/production';
import { setQualityT } from './productionDials';
import { logAmount } from './interpolate';
import { clamp } from './random';
import { computeFacet, executionSwing, facetConfidence, DEFAULT_FACET_TUNING, type FacetConfidence, type FacetResult } from './facetModel';

// --- Tunables --------------------------------------------------------------

/** Skill of the Sets/Design work when NO Production Designer is hired — an unmanaged art department: workable, never inspired. */
export const NO_DESIGNER_SKILL = 40;

// Sets uses the default facet tuning (the shared defaults were calibrated from
// this facet). A future pass can override here if Sets needs to diverge.
const SETS_TUNING = DEFAULT_FACET_TUNING;

// Ambition weighting: how the setting/scale demands translate to a 0-100 "how
// demanding is the physical world" target.
const SCALE_AMBITION: Record<Script['scale'], number> = { Intimate: 0.2, Medium: 0.55, Epic: 1 };

// The designer's build asks. Needed days rise with ambition; skill trims them.
const BASE_DESIGN_DAYS = 6;
const MAX_EXTRA_DESIGN_DAYS = 34; // an epic build wants ~6..40 prep days before skill
const SKILL_TIME_EFFICIENCY = 0.25; // an elite designer needs up to 25% less time
const SKILL_MONEY_EFFICIENCY = 0.18; // ...and asks ~18% less money

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

/** The Sets facet result — the shared FacetResult (kept as a named alias for existing callers). */
export type SetsFacet = FacetResult;

export interface SetsFacetInput {
  ambition: number; // 0-100 (computeSetsAmbition)
  moneyAmount: number; // £ (ProductionChoices.setQualityAmount)
  prepDays: number; // days granted to design
  designerSkill: number; // 0-100 (hired designer, or NO_DESIGNER_SKILL)
}

/** Realise the Sets facet — maps the Sets-specific inputs onto the shared facet model. */
export function computeSetsFacet(input: SetsFacetInput): SetsFacet {
  const needs = designerAsk(input.ambition, input.designerSkill);
  const timeRatio = needs.neededDays > 0 ? input.prepDays / needs.neededDays : 1;
  return computeFacet(
    {
      ambition: input.ambition,
      moneyT: setQualityT(input.moneyAmount),
      timeRatio,
      skill: input.designerSkill,
    },
    SETS_TUNING,
  );
}

// --- The delivered quality (base + how the build actually came out) ---------

/**
 * The Sets facet's DELIVERED quality once the shoot is done: the deterministic
 * base (what the plan bought) plus the execution swing (how the set/design build
 * actually came out — engine/facetModel.ts:executionSwing). The swing is scaled
 * by the facet's own `stretch`, so a comfortably-funded build lands tight to its
 * base while an over-reaching one is a boom-or-bust bet the designer's skill
 * biases. `setsSignal` = the net set/design event points from the shoot
 * (engine/productionExecution.ts:ExecutionProfile.setsSignal); it defaults to 0
 * — a forecast, or a shoot with no set events, is just the base.
 */
export function realiseSetsQuality(facet: SetsFacet, designerSkill: number, setsSignal = 0): number {
  return clamp(Math.round(facet.quality + executionSwing(facet.stretch, designerSkill, setsSignal)), 0, 100);
}

// --- The designer's confidence (the conversation's forecast) ---------------

export type DesignerConfidence = FacetConfidence;

/** The qualitative forecast the designer gives as you move the money/time dials. */
export function designerConfidence(facet: SetsFacet): DesignerConfidence {
  return facetConfidence(facet);
}

/**
 * The boom-or-bust read of the plan, for the planning conversation (spec §3.3).
 * `spread` = how much the shoot can swing the build around its funded base
 * (driven by stretch: a comfortably-funded plan is dependable; an over-reaching
 * one is a gamble). `lean` = which way the designer's skill tips that gamble —
 * only meaningful when the spread isn't tight. Qualitative only; the UI turns it
 * into the designer's own words.
 */
export interface SetsOutlook {
  spread: 'tight' | 'moderate' | 'wide';
  lean: 'promising' | 'even' | 'precarious';
}

export function setsOutlook(facet: SetsFacet, designerSkill: number): SetsOutlook {
  const spread = facet.stretch < 0.12 ? 'tight' : facet.stretch < 0.35 ? 'moderate' : 'wide';
  const lean = designerSkill >= 68 ? 'promising' : designerSkill <= 45 ? 'precarious' : 'even';
  return { spread, lean };
}
