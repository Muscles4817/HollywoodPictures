// Creative brief for post-production (docs/DESIGN_production_requirements_model.md
// — Revision 2 "Creative briefs replace the quality-proxy menus"). The player's
// music / edit / final-cut menu choices are the DIRECTOR'S INTENT — a brief the
// Composer and Editor are handed — not a quality dial. Today those choices still
// map to flat quality/critic/audience/buzz deltas (the dial), and this module is
// the single seam through which scoring reads them.
//
// THE POINT OF THIS SEAM: at the coverage-unification cutover, each accessor here
// stops returning a fixed menu delta and instead returns the hired person's
// REALISATION of the brief — how well the Composer executes a "bold, memorable"
// score, or the Editor a "fast, crowd-pleasing" cut, using scoreFacet.ts /
// editFacet.ts. The intent (the brief) stays a genuine player decision; the
// QUALITY becomes person-driven. Routing every read through this one module now,
// byte-for-byte, means that cutover is a change to these four functions alone,
// not a hunt across scoring.ts.
//
// This slice is behaviour-preserving: every accessor returns exactly the value
// scoring.ts computed inline before, so box office is byte-identical.
import type { EditStyle, MusicFocus, FinalCutFocus, PostProductionChoices } from '../types';
import { EDIT_STYLE_PROFILES, MUSIC_FOCUS_PROFILES, FINAL_CUT_FOCUS_PROFILES } from '../data/postProduction';
import { clamp } from './random';

/**
 * The director's post-production brief — the intended approach handed to the
 * Composer and Editor. A view over the persisted PostProductionChoices (the menu
 * fields stay the state; this names them as intent). Not the delivered result:
 * how well the intent is realised is the hired person's job (scoreFacet.ts /
 * editFacet.ts) once the cutover lands.
 */
export interface CreativeBrief {
  /** Intended score approach (sparse ↔ bold). */
  score: MusicFocus;
  /** Intended cut character (crowd-pleasing ↔ deliberate/artistic). */
  edit: EditStyle;
  /** Intended final-cut emphasis (what the cut is angled to sell). */
  finalCut: FinalCutFocus;
}

/** Read the brief (intent) out of the persisted post-production choices. */
export function briefFromChoices(choices: PostProductionChoices): CreativeBrief {
  return { score: choices.musicFocus, edit: choices.editStyle, finalCut: choices.finalCutFocus };
}

// --- The brief's current DIRECT contributions to each scoring channel ---------
// Each is a flat, person-independent delta today (the dial). At the cutover each
// is replaced by the hired Composer's/Editor's realisation of the brief.

/**
 * The brief's contribution to the post-production QUALITY sub-score: the score's
 * quality delta plus the balanced-cut bonus. (== the old inline
 * `MUSIC_FOCUS_PROFILES[...].qualityDelta + (editStyle==='Balanced' ? 5 : 0)`.)
 */
export function briefQualityContribution(brief: CreativeBrief): number {
  const music = MUSIC_FOCUS_PROFILES[brief.score].qualityDelta;
  const balancedBonus = brief.edit === 'Balanced' ? 5 : 0;
  return music + balancedBonus;
}

/**
 * The edit's contribution to CRITIC reception as a 0-100 term (blended into
 * computeCriticScore). (== the old inline `50 + EDIT_STYLE_PROFILES[...].criticDelta * 5`.)
 */
export function briefCriticEditScore(brief: CreativeBrief): number {
  return clamp(50 + EDIT_STYLE_PROFILES[brief.edit].criticDelta * 5, 0, 100);
}

/**
 * The edit + final-cut contribution to AUDIENCE reception as a 0-100 term (blended
 * into computeAudienceScore). (== the old inline `50 + editAudienceDelta*5 +
 * finalCutAudienceDelta*5`.)
 */
export function briefAudienceEditScore(brief: CreativeBrief): number {
  return clamp(
    50 + EDIT_STYLE_PROFILES[brief.edit].audienceDelta * 5 + FINAL_CUT_FOCUS_PROFILES[brief.finalCut].audienceDelta * 5,
    0,
    100,
  );
}

/**
 * The brief's contribution to pre-release BUZZ: the score's buzz delta plus the
 * final-cut's buzz delta. (== the old inline `musicBuzz + finalCutBuzz`.)
 */
export function briefBuzzContribution(brief: CreativeBrief): number {
  return MUSIC_FOCUS_PROFILES[brief.score].buzzDelta + FINAL_CUT_FOCUS_PROFILES[brief.finalCut].buzzDelta;
}

// --- Player-facing intent prose (qualitative; no numbers) ---------------------
// The brief expressed as what the director ASKED FOR, distinct from the profile
// descriptions' effect language ("boosts audience score"). Ready for the cutover
// surface (a composer/editor's read of the brief); not wired into UI yet.

const SCORE_INTENT: Record<MusicFocus, string> = {
  Minimal: 'a sparse, understated score',
  Standard: 'a conventional, well-produced score',
  Heavy: 'a bold, memorable score built to be talked about',
};

const EDIT_INTENT: Record<EditStyle, string> = {
  Commercial: 'a fast, crowd-pleasing cut',
  Artistic: 'a slower, more deliberate, critic-minded cut',
  Balanced: 'a cut that splits the difference',
};

const FINAL_CUT_INTENT: Record<FinalCutFocus, string> = {
  'Trailer-focused': 'angled to sell the big moments',
  'Critic-focused': 'angled to lead with craft and prestige',
  'Star-focused': 'angled to sell the cast',
  'Mystery-focused': 'angled to give nothing away',
};

export interface BriefIntent {
  score: string;
  edit: string;
  finalCut: string;
}

/** The brief as qualitative intent — what the Composer and Editor have been asked for. */
export function describeBriefIntent(brief: CreativeBrief): BriefIntent {
  return { score: SCORE_INTENT[brief.score], edit: EDIT_INTENT[brief.edit], finalCut: FINAL_CUT_INTENT[brief.finalCut] };
}
