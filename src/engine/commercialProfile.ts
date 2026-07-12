// Replaces the old Script.marketability stat (docs/DESIGN.md - screenplay
// redesign, "split marketability"). Marketability used to be a single
// independently-rolled number doing several unrelated jobs at once (ease of
// marketing, natural audience size, commercial appeal) - the redesign's
// explicit instruction was to split those concepts apart and, where
// possible, make them hidden derived values instead of another displayed
// stat, so a player reads commercial potential off the screenplay's concept
// (genre, story type, scale, archetype) rather than off a raw number.
//
// Nothing here is stored on Script - every call site (engine/scoring.ts,
// engine/releaseFilm.ts, components/wizard/DevelopFilm.tsx) computes this on
// demand from fields that already exist, the same "derive, don't roll and
// store" principle Milestone 10's crossover-capacity redesign already
// established for the audience simulation (docs/DESIGN.md 5.34).
import type { Genre, ScriptScale, Script, ScriptArchetype, StoryType } from '../types';
import { GENRE_PROFILES } from '../data/genres';
import { STORY_TYPE_PROFILES } from '../data/storyTypes';
import { SCRIPT_SCALE_PROFILES } from '../data/scale';
import { SCRIPT_ARCHETYPE_PROFILES } from '../data/scriptArchetypes';
import { clamp } from './random';

export interface CommercialProfile {
  /** How broad a natural audience this *concept* has, before reception even matters - genre/story-type/scale-driven, not craft-driven. Feeds computeAudienceScore's-adjacent formulas and the audience simulation's base-interest sizing (see releaseFilm.ts). */
  accessibility: number; // 0-100
  /** How easily this concept converts into an effective pitch/trailer - structure and character craft plus how "hooky" the story type and archetype are. Feeds Buzz Score and the display-only Marketability Score. */
  hookStrength: number; // 0-100
  /** How far positive word of mouth could plausibly travel beyond the natural audience - originality- and scale-driven. Feeds the audience simulation's crossover-capacity concept strength. */
  crossoverPotential: number; // 0-100
}

type CommercialInputs = Pick<Script, 'genre' | 'archetype' | 'storyType' | 'scale' | 'structure' | 'characters' | 'originality'>;

function storyProfileOf(storyType: StoryType) {
  return STORY_TYPE_PROFILES[storyType];
}
function scaleProfileOf(scale: ScriptScale) {
  return SCRIPT_SCALE_PROFILES[scale];
}
function archetypeProfileOf(archetype: ScriptArchetype) {
  return SCRIPT_ARCHETYPE_PROFILES[archetype];
}
function genrePopularity(genre: Genre): number {
  return GENRE_PROFILES[genre].popularity;
}

export function deriveCommercialProfile(script: CommercialInputs): CommercialProfile {
  const story = storyProfileOf(script.storyType);
  const scale = scaleProfileOf(script.scale);
  const archetype = archetypeProfileOf(script.archetype);
  const popularity = genrePopularity(script.genre);

  const accessibility = clamp(
    popularity * 0.4 + story.accessibility * 0.35 + scale.reach * 0.25 + archetype.commercial.accessibility,
    0,
    100,
  );

  const hookStrength = clamp(
    script.structure * 0.3 + script.characters * 0.2 + story.hookiness * 0.35 + popularity * 0.15 + archetype.commercial.hookiness,
    0,
    100,
  );

  const crossoverPotential = clamp(
    script.originality * 0.45 + scale.reach * 0.25 + popularity * 0.15 + archetype.commercial.crossover,
    0,
    100,
  );

  return { accessibility, hookStrength, crossoverPotential };
}
