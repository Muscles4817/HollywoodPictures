// Practical Effects facet (docs/DESIGN_REVIEW_production_redesign.md, step 4).
// Physical spectacle done during photography — stunts, rigs, pyrotechnics,
// prosthetics — realised from money + the time the shoot actually took + crew
// skill against the film's practical-effects ambition, on the shared facet model.
// Replaces the flat practicalEffectsScore term in the Production effects blend.
//
// HEAD: the intended head is a contracted STUNT TEAM (a tiered vendor + specialties,
// spec §5.2), which isn't modelled yet — so the prototype uses a fixed
// NO_STUNT_TEAM_SKILL fallback (a competent-but-unspecialised unit). Wiring the
// Stunt Team entity in as the skill axis is the next step. Documented in spec §13.
//
// TIME: practical effects are shot on set, so this facet's time is the FILMING
// time — the finished shoot's shootingRatio (a rushed shoot leaves less time to
// get stunts and rigs right; an ample one helps). Unlike Sets (a prep-time
// planning lever), this is read from how the shoot actually went.
import type { Genre, Script } from '../types';
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
import { GENRE_PROFILES } from '../data/genres';
import { practicalEffectsT } from './productionDials';
import { clamp } from './random';
import { computeFacet, realiseFacetQuality, facetOutlook, DEFAULT_FACET_TUNING, type FacetOutlook, type FacetResult, type FacetTuning } from './facetModel';

/** Skill of the practical-effects work with no Stunt Team attached — a competent general unit. The facet's skill axis is the hired Stunt Team (engine/stuntTeams.ts); absent, this fallback. */
export const NO_STUNT_TEAM_SKILL = 42;

const SCALE_AMBITION: Record<Script['scale'], number> = { Intimate: 0.2, Medium: 0.55, Epic: 1 };

const PRACTICAL_TUNING: FacetTuning = {
  ...DEFAULT_FACET_TUNING,
  moneyWeightHigh: 0.7, // big physical spectacle needs the spend...
  timeFloorFrac: 0.55, // ...and genuinely needs shoot time to pull off safely
};

/** How demanding the practical-effects work is, 0-100, from the genre's reliance on practical spectacle + the setting's physical logistics + scale. */
export function computePracticalAmbition(genre: Genre, script: Script): number {
  const g = GENRE_PROFILES[genre];
  const p = SETTING_ARCHETYPE_PROFILES[script.primarySetting];
  const raw = clamp(0.55 * g.practicalEffectsImportance + 0.3 * p.practicalLogisticsDemand + 0.15 * SCALE_AMBITION[script.scale], 0, 1);
  return Math.round(raw * 100);
}

/** `shootingRatio` = daysElapsed/recommendedDays from the finished shoot; it's this facet's time axis (1.0 = shot to schedule). At planning time (no shoot yet) callers pass 1. `teamSkill` is the attached Stunt Team's effective skill (engine/stuntTeams.ts), defaulting to the no-team fallback. */
export function computePracticalFacet(practicalAmount: number, genre: Genre, script: Script, shootingRatio: number, teamSkill: number = NO_STUNT_TEAM_SKILL): FacetResult {
  return computeFacet(
    {
      ambition: computePracticalAmbition(genre, script),
      moneyT: practicalEffectsT(practicalAmount),
      timeRatio: clamp(shootingRatio, 0, 1.3),
      skill: teamSkill,
    },
    PRACTICAL_TUNING,
  );
}

/**
 * The delivered Practical quality once the shoot's stunt/practical events are in:
 * the deterministic base plus the execution swing (engine/facetModel.ts).
 * `practicalSignal` = the net practical event points from the shoot
 * (engine/productionExecution.ts:facetSignals.practical); defaults to 0 → base only.
 */
export function realisePracticalQuality(facet: FacetResult, teamSkill: number, practicalSignal = 0): number {
  return realiseFacetQuality(facet, teamSkill, practicalSignal);
}

/** The Stunt Team's boom-or-bust read for the planning conversation (spec §3.3). */
export function practicalOutlook(facet: FacetResult, teamSkill: number): FacetOutlook {
  return facetOutlook(facet, teamSkill);
}
