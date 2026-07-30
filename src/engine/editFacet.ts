// Editing facet (docs/DESIGN_production_requirements_model.md — Layer 4 coverage
// unification). The cut — pacing, structure, assembly — realised from the
// Editor's skill against how hard the film is to cut, on the shared facet model
// (engine/facetModel.ts). This replaces the `editStyle`/`finalCutFocus`
// menu-as-dial as the source of edit QUALITY: today the cut's contribution to
// quality/critic/audience comes from the menu choice regardless of who you hired
// (engine/scoring.ts), the audit's quality-from-choices-not-hires defect.
//
// NOT YET WIRED INTO SCORING. Safe scaffolding for the gated cutover — the facet
// is built and tested in isolation; scoring still reads the menu. At the cutover
// the menu becomes a creative BRIEF (intended cut) and the Editor's realisation
// of it becomes the quality (Revision 2).
//
// A separate, already-live constraint stays as-is: an under-shot film caps the
// edit (engine/scoring.ts:editCoverageCeiling on execution.coverageRatio) — "an
// editor can't create footage that doesn't exist." That ceiling is orthogonal to
// this facet (it bounds the edit from ABOVE); this facet is how good the cut is
// WITHIN what the coverage allows.
//
// AXES. Editing is a post-production craft:
//   - TIME = held NEUTRAL (1.0). Post-production time is not a player lever yet
//     (same as VFX/Score).
//   - MONEY = held NEUTRAL (1.0). No edit-budget dial yet.
//   - SKILL = the Editor's skill vs the film's cutting difficulty — the live axis.
import type { Genre, Script, TalentAssignment } from '../types';
import { findAssignedPerson } from '../data/helpers';
import { getCrewCareer } from './person';
import { clamp } from './random';
import { computeFacet, realiseFacetQuality, facetOutlook, DEFAULT_FACET_TUNING, type FacetOutlook, type FacetResult, type FacetTuning } from './facetModel';

/** Quality of the cut with NO Editor attached — an assembly cut: coherent, never elevated. */
export const NO_EDITOR_SKILL = 42;

const SCALE_AMBITION: Record<Script['scale'], number> = { Intimate: 0.2, Medium: 0.55, Epic: 1 };

// Editing uses the default facet band — a botched cut is very visible and a great
// one genuinely elevates. Money/time knobs are moot while both axes are neutral.
const EDIT_TUNING: FacetTuning = { ...DEFAULT_FACET_TUNING };

/**
 * How hard the film is to cut, 0-100, from the script's structural complexity
 * (the dominant driver — intercut timelines, large ensembles), the action lean
 * (action needs dense, precise coverage-cutting), scale (more footage to
 * assemble), and the suspense lean (pacing/tension are made in the cut). A simple,
 * contained, low-action piece sits low; a complex, large action film sits high.
 */
export function computeEditAmbition(_genre: Genre, script: Script): number {
  const complexity01 = clamp(script.complexity / 100, 0, 1);
  const action01 = clamp(script.toneProfile.action / 100, 0, 1);
  const suspense01 = clamp(script.toneProfile.suspense / 100, 0, 1);
  const raw = clamp(
    0.35 * complexity01 + 0.25 * action01 + 0.2 * SCALE_AMBITION[script.scale] + 0.2 * suspense01,
    0,
    1,
  );
  return Math.round(raw * 100);
}

/** The Editor's skill (the facet's skill axis + swing tilt), or the no-editor fallback. */
export function editorSkill(talent: TalentAssignment[]): number {
  const editor = findAssignedPerson(talent, 'Editor');
  return (editor && getCrewCareer(editor, 'Editor')?.skill) ?? NO_EDITOR_SKILL;
}

/** Realise the Editing facet. Money and time are held neutral (see header); the live axis is the Editor's skill vs the film's cutting difficulty. */
export function computeEditFacet(talent: TalentAssignment[], genre: Genre, script: Script): FacetResult {
  return computeFacet(
    {
      ambition: computeEditAmbition(genre, script),
      moneyT: 1, // no edit-budget dial yet (see header)
      timeRatio: 1, // post-production time not a lever yet (see header)
      skill: editorSkill(talent),
    },
    EDIT_TUNING,
  );
}

/**
 * The delivered edit quality once post-production is done: the deterministic base
 * plus the execution swing (engine/facetModel.ts). `editSignal` = the net
 * editing-related event points; defaults to 0 → base only.
 */
export function realiseEditQuality(facet: FacetResult, skill: number, editSignal = 0): number {
  return realiseFacetQuality(facet, skill, editSignal);
}

/** The Editor's boom-or-bust read for the planning conversation. */
export function editOutlook(facet: FacetResult, skill: number): FacetOutlook {
  return facetOutlook(facet, skill);
}
