// Visual Effects facet (docs/DESIGN_REVIEW_production_redesign.md, step 4). VFX
// quality realised from money + the VFX Supervisor's skill against the film's
// VFX ambition, on the shared facet model (engine/facetModel.ts). Replaces the
// flat vfxScore term in the Production effects blend.
//
// TIME axis: VFX's time is post-production render/finishing time, which is not a
// player-controlled lever yet (post-production days are auto-computed). So the
// prototype runs VFX on money × skill with time NEUTRAL (ratio 1.0); when
// post-production gains its own time levers (as pre-production did), VFX's
// timeRatio becomes a real input here. Documented in the spec §13.
//
// VFX_TUNING makes VFX money-heavier than Sets: a convincing digital spectacle
// genuinely needs the render/artist spend, so money's weight and floor are
// higher and skill+time substitute for it less (the ambition floor bites hard).
import type { Genre, Script, TalentAssignment } from '../types';
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
import { GENRE_PROFILES } from '../data/genres';
import { vfxT } from './productionDials';
import { findAssignedPerson } from '../data/helpers';
import { getCrewCareer } from './person';
import { clamp } from './random';
import { computeFacet, realiseFacetQuality, facetOutlook, DEFAULT_FACET_TUNING, type FacetOutlook, type FacetResult, type FacetTuning } from './facetModel';

/** Skill of the VFX work with NO VFX Supervisor — an unmanaged, outsourced pipeline: rougher than a managed one. */
export const NO_VFX_SUPERVISOR_SKILL = 35;

const SCALE_AMBITION: Record<Script['scale'], number> = { Intimate: 0.2, Medium: 0.55, Epic: 1 };

const VFX_TUNING: FacetTuning = {
  ...DEFAULT_FACET_TUNING,
  moneyWeightLow: 0.4,
  moneyWeightHigh: 0.78, // spectacle is money-driven
  moneyFloorFrac: 0.68, // a big digital build has a hard minimum spend
  ceilingLow: 66, // even modest VFX, done well, reads clean
};

/** How demanding the VFX work is, 0-100, from the genre's reliance on VFX + the setting's digital-world demand + scale. A chamber drama sits near zero; a built-world sci-fi epic sits high. */
export function computeVfxAmbition(genre: Genre, script: Script): number {
  const g = GENRE_PROFILES[genre];
  const p = SETTING_ARCHETYPE_PROFILES[script.primarySetting];
  const raw = clamp(0.6 * g.vfxImportance + 0.25 * p.vfxEnvironmentDemand + 0.15 * SCALE_AMBITION[script.scale], 0, 1);
  return Math.round(raw * 100);
}

/** The VFX Supervisor's skill (the facet's skill axis + swing tilt), or the unmanaged-pipeline fallback when none is hired. */
export function vfxSupervisorSkill(talent: TalentAssignment[]): number {
  const supervisor = findAssignedPerson(talent, 'VFX Supervisor');
  return (supervisor && getCrewCareer(supervisor, 'VFX Supervisor')?.skill) ?? NO_VFX_SUPERVISOR_SKILL;
}

export function computeVfxFacet(vfxAmount: number, talent: TalentAssignment[], genre: Genre, script: Script): FacetResult {
  return computeFacet(
    {
      ambition: computeVfxAmbition(genre, script),
      moneyT: vfxT(vfxAmount),
      timeRatio: 1, // post-production time not yet a lever (see header)
      skill: vfxSupervisorSkill(talent),
    },
    VFX_TUNING,
  );
}

/**
 * The delivered VFX quality once the shoot's VFX events are in: the deterministic
 * base plus the execution swing (engine/facetModel.ts). `vfxSignal` = the net VFX
 * event points from the shoot (engine/productionExecution.ts:facetSignals.vfx);
 * defaults to 0 (a forecast, or a shoot with no VFX events) → base only.
 */
export function realiseVfxQuality(facet: FacetResult, supervisorSkill: number, vfxSignal = 0): number {
  return realiseFacetQuality(facet, supervisorSkill, vfxSignal);
}

/** The VFX Supervisor's boom-or-bust read for the planning conversation (spec §3.3). */
export function vfxOutlook(facet: FacetResult, supervisorSkill: number): FacetOutlook {
  return facetOutlook(facet, supervisorSkill);
}
