// Cinematography facet (docs/DESIGN_production_requirements_model.md — Layer 4
// coverage unification). The photographed image — lighting, framing, camera —
// realised from the Cinematographer's skill and the time the shoot grants,
// against how visually demanding the film is, on the shared facet model
// (engine/facetModel.ts). This is the first quality dimension the DP has ever
// had; today the Cinematographer touches box office only through awards.
//
// NOT YET WIRED INTO SCORING. This module is safe scaffolding for the gated
// cutover: the facet is built and tested in isolation, but computeProductionScore
// does not read it yet (that is the one calibrated scoring shift, staged last).
//
// AXES. Cinematography is a production-phase craft:
//   - TIME = the shoot's `shootingRatio` (a rushed shoot starves lighting and
//     camera setups) — a real signal today, this facet's primary lever.
//   - MONEY = held NEUTRAL (1.0). There is no dedicated camera/lighting budget
//     dial yet; when production budgeting gains one it becomes a real input here,
//     exactly as post-production time will for VFX (engine/vfxFacet.ts header).
//   - SKILL = the Cinematographer's skill, multiplying both (or the no-DP
//     fallback for an unmanaged camera department).
import type { Genre, Script, TalentAssignment } from '../types';
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
import { findAssignedPerson } from '../data/helpers';
import { getCrewCareer } from './person';
import { clamp } from './random';
import { computeFacet, realiseFacetQuality, facetOutlook, DEFAULT_FACET_TUNING, type FacetOutlook, type FacetResult, type FacetTuning } from './facetModel';

/** Skill of the camera work with NO Cinematographer attached — a competent but unled camera department: clean coverage, rarely a distinctive image. */
export const NO_CINEMATOGRAPHER_SKILL = 38;

const SCALE_AMBITION: Record<Script['scale'], number> = { Intimate: 0.2, Medium: 0.55, Epic: 1 };

// Cinematography leans on time + skill more than on money (an inspired DP with
// enough shoot days matters more than raw spend), so money's weight sits below
// the default and skill+time substitute for it more. A starting point; the
// money lever (and its floors) firm up when a camera-budget dial exists.
const CINEMATOGRAPHY_TUNING: FacetTuning = {
  ...DEFAULT_FACET_TUNING,
  moneyWeightLow: 0.2,
  moneyWeightHigh: 0.5,
  ceilingLow: 64, // even a modest look, shot well, reads clean
};

/**
 * How visually demanding the film is, 0-100, from the tone's spectacle/action
 * lean, the setting's environment scale + location complexity (more to light and
 * frame), and overall scale. An intimate single-location piece sits low; a
 * large-scale, spectacle-forward film shot across complex environments sits high.
 */
export function computeCinematographyAmbition(_genre: Genre, script: Script): number {
  const p = SETTING_ARCHETYPE_PROFILES[script.primarySetting];
  const spectacle01 = clamp(script.toneProfile.spectacle / 100, 0, 1);
  const action01 = clamp(script.toneProfile.action / 100, 0, 1);
  const environment = clamp(0.6 * p.environmentScale + 0.4 * p.locationComplexity, 0, 1);
  const raw = clamp(
    0.32 * spectacle01 + 0.16 * action01 + 0.27 * environment + 0.25 * SCALE_AMBITION[script.scale],
    0,
    1,
  );
  return Math.round(raw * 100);
}

/** The Cinematographer's skill (the facet's skill axis + swing tilt), or the no-DP fallback when none is attached. */
export function cinematographerSkill(talent: TalentAssignment[]): number {
  const dp = findAssignedPerson(talent, 'Cinematographer');
  return (dp && getCrewCareer(dp, 'Cinematographer')?.skill) ?? NO_CINEMATOGRAPHER_SKILL;
}

/** `shootingRatio` = daysElapsed/recommendedDays from the finished shoot; it's this facet's time axis (1.0 = shot to schedule). At planning time (no shoot yet) callers pass 1. Money is held neutral (see header). */
export function computeCinematographyFacet(talent: TalentAssignment[], genre: Genre, script: Script, shootingRatio: number): FacetResult {
  return computeFacet(
    {
      ambition: computeCinematographyAmbition(genre, script),
      moneyT: 1, // no camera/lighting budget dial yet (see header)
      timeRatio: clamp(shootingRatio, 0, 1.3),
      skill: cinematographerSkill(talent),
    },
    CINEMATOGRAPHY_TUNING,
  );
}

/**
 * The delivered cinematography quality once the shoot's camera events are in: the
 * deterministic base plus the execution swing (engine/facetModel.ts).
 * `cinematographySignal` = the net camera-department event points from the shoot;
 * defaults to 0 (a forecast, or a shoot with no camera events) → base only.
 */
export function realiseCinematographyQuality(facet: FacetResult, dpSkill: number, cinematographySignal = 0): number {
  return realiseFacetQuality(facet, dpSkill, cinematographySignal);
}

/** The Cinematographer's boom-or-bust read for the planning conversation. */
export function cinematographyOutlook(facet: FacetResult, dpSkill: number): FacetOutlook {
  return facetOutlook(facet, dpSkill);
}
