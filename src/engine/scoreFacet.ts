// Score facet (docs/DESIGN_production_requirements_model.md — Layer 4 coverage
// unification). The film's original music, realised from the Composer's skill
// against how much the film leans on score, on the shared facet model
// (engine/facetModel.ts). This replaces the `musicFocus` menu-as-dial as the
// source of score QUALITY: today post-production quality comes from the menu
// choice regardless of who you hired (engine/scoring.ts:computePostProductionScore),
// which the audit flagged as quality-from-choices-not-hires.
//
// NOT YET WIRED INTO SCORING. Safe scaffolding for the gated cutover — the facet
// is built and tested in isolation; computePostProductionScore still reads the
// menu. At the cutover the menu becomes a creative BRIEF (intended approach) and
// the Composer's realisation of that brief becomes the quality (Revision 2).
//
// AXES. Score is a post-production craft:
//   - TIME = held NEUTRAL (1.0). Post-production time is not a player lever yet
//     (same as VFX — engine/vfxFacet.ts header).
//   - MONEY = held NEUTRAL (1.0). No score-budget dial yet; the creative brief +
//     any resources arrive at the cutover.
//   - SKILL = the Composer's skill vs the film's score demand — the live axis.
import type { Genre, Script, TalentAssignment } from '../types';
import { findAssignedPerson } from '../data/helpers';
import { getCrewCareer } from './person';
import { clamp } from './random';
import { computeFacet, realiseFacetQuality, facetOutlook, DEFAULT_FACET_TUNING, type FacetOutlook, type FacetResult, type FacetTuning } from './facetModel';

/** Quality of the score with NO Composer attached — library/temp music: serviceable, never memorable. */
export const NO_COMPOSER_SKILL = 40;

const SCALE_AMBITION: Record<Script['scale'], number> = { Intimate: 0.2, Medium: 0.55, Epic: 1 };

// A competent score reads fine even on an undemanding film, so the low end of the
// quality band sits a little above the default. Money/time knobs are moot while
// both axes are neutral; they firm up at the cutover.
const SCORE_TUNING: FacetTuning = {
  ...DEFAULT_FACET_TUNING,
  ceilingLow: 64,
};

/**
 * How much the film leans on its score, 0-100, from the tone. Suspense and drama
 * carry the most score weight (tension and emotion are music-driven), spectacle
 * and romance a fair amount (bombast, themes), and larger films want a bigger
 * sound. A dialogue comedy leans on score the least, so it sits low.
 */
export function computeScoreAmbition(_genre: Genre, script: Script): number {
  const t = script.toneProfile;
  const suspense01 = clamp(t.suspense / 100, 0, 1);
  const drama01 = clamp(t.drama / 100, 0, 1);
  const spectacle01 = clamp(t.spectacle / 100, 0, 1);
  const romance01 = clamp(t.romance / 100, 0, 1);
  const raw = clamp(
    0.3 * suspense01 + 0.25 * drama01 + 0.2 * spectacle01 + 0.15 * romance01 + 0.1 * SCALE_AMBITION[script.scale],
    0,
    1,
  );
  return Math.round(raw * 100);
}

/** The Composer's skill (the facet's skill axis + swing tilt), or the no-composer fallback. */
export function composerSkill(talent: TalentAssignment[]): number {
  const composer = findAssignedPerson(talent, 'Composer');
  return (composer && getCrewCareer(composer, 'Composer')?.skill) ?? NO_COMPOSER_SKILL;
}

/** Realise the Score facet. Money and time are held neutral (see header); the live axis is the Composer's skill vs the film's score demand. */
export function computeScoreFacet(talent: TalentAssignment[], genre: Genre, script: Script): FacetResult {
  return computeFacet(
    {
      ambition: computeScoreAmbition(genre, script),
      moneyT: 1, // no score-budget dial yet (see header)
      timeRatio: 1, // post-production time not a lever yet (see header)
      skill: composerSkill(talent),
    },
    SCORE_TUNING,
  );
}

/**
 * The delivered score quality once post-production is done: the deterministic
 * base plus the execution swing (engine/facetModel.ts). `scoreSignal` = the net
 * scoring-related event points; defaults to 0 → base only.
 */
export function realiseScoreQuality(facet: FacetResult, skill: number, scoreSignal = 0): number {
  return realiseFacetQuality(facet, skill, scoreSignal);
}

/** The Composer's boom-or-bust read for the planning conversation. */
export function scoreOutlook(facet: FacetResult, skill: number): FacetOutlook {
  return facetOutlook(facet, skill);
}
