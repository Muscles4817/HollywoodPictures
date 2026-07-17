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
import type { Genre, ScriptScale, Script, ScriptArchetype, ScriptCharacter, SettingArchetype, StoryType } from '../types';
import { GENRE_PROFILES } from '../data/genres';
import { STORY_TYPE_PROFILES } from '../data/storyTypes';
import { SCRIPT_SCALE_PROFILES } from '../data/scale';
import { SCRIPT_ARCHETYPE_PROFILES } from '../data/scriptArchetypes';
import { SETTING_ARCHETYPE_PROFILES } from '../data/settings';
import { clamp } from './random';

export interface CommercialProfile {
  /** How broad a natural audience this *concept* has, before reception even matters - genre/story-type/scale-driven, not craft-driven. Feeds computeAudienceScore's-adjacent formulas and the audience simulation's base-interest sizing (see releaseFilm.ts). */
  accessibility: number; // 0-100
  /** How easily this concept converts into an effective pitch/trailer - structure and character craft plus how "hooky" the story type and archetype are. Feeds Buzz Score and the display-only Marketability Score. */
  hookStrength: number; // 0-100
  /** How far positive word of mouth could plausibly travel beyond the natural audience - originality- and scale-driven. Feeds the audience simulation's crossover-capacity concept strength. */
  crossoverPotential: number; // 0-100
}

type CommercialInputs = Pick<
  Script,
  'genre' | 'archetype' | 'storyType' | 'scale' | 'structure' | 'characters' | 'originality' | 'primarySetting' | 'cast'
>;

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

/** How eye-catching the Setting Archetype itself reads, 0-1 - a striking or unusual setting (Alien World, Futuristic City) modestly helps the pitch; a familiar one (Suburban Community) doesn't hurt it either. */
function settingDistinctiveness(setting: SettingArchetype): number {
  const profile = SETTING_ARCHETYPE_PROFILES[setting];
  return (profile.environmentScale + profile.vfxEnvironmentDemand) / 2;
}

function leadCharacters(cast: ScriptCharacter[]): ScriptCharacter[] {
  return cast.filter((c) => c.prominence === 'Lead');
}

/** Average distinctiveness across the Lead characters, 0-1 - a genuinely memorable lead (a striking Antihero, a Monster) modestly helps the pitch. 0 if there are no Leads yet, rather than a fabricated neutral value. */
function leadCharacterDistinctiveness(cast: ScriptCharacter[]): number {
  const leads = leadCharacters(cast);
  if (leads.length === 0) return 0;
  return leads.reduce((sum, c) => sum + c.traits.distinctiveness, 0) / leads.length / 100;
}

/** Average audience accessibility across the Lead characters, 1-100 - falls back to a neutral 50 with no Leads yet rather than dragging accessibility toward 0. */
function leadCharacterAccessibility(cast: ScriptCharacter[]): number {
  const leads = leadCharacters(cast);
  if (leads.length === 0) return 50;
  return leads.reduce((sum, c) => sum + c.traits.audienceAccessibility, 0) / leads.length;
}

/**
 * Genre/story-type/scale/archetype-driven, same as before the Character and
 * Setting Foundations milestone, plus two small, deliberately modest
 * additions (docs/CHARACTER_AND_SETTING_FOUNDATIONS.md section 10):
 * - hookStrength gets up to +5 each from a distinctive Setting and a
 *   distinctive Lead character - "intrinsic concept appeal," never IP-level
 *   recognition, and clearly smaller than what marketing/talent fame/studio
 *   brand contribute elsewhere (engine/scoring.ts:computeBuzzScore).
 * - accessibility takes a genuine but minority (10%) share from the Leads'
 *   own audienceAccessibility, at the expense of story type's own share
 *   (down from 0.35 to 0.3) rather than inflating the total.
 * merchandisePotential deliberately has no effect here at all yet - see
 * ScriptCharacter's own doc comment in types/index.ts.
 */
export function deriveCommercialProfile(script: CommercialInputs): CommercialProfile {
  const story = storyProfileOf(script.storyType);
  const scale = scaleProfileOf(script.scale);
  const archetype = archetypeProfileOf(script.archetype);
  const popularity = genrePopularity(script.genre);
  const characterAccessibility = leadCharacterAccessibility(script.cast);

  const accessibility = clamp(
    popularity * 0.4 + story.accessibility * 0.3 + scale.reach * 0.2 + archetype.commercial.accessibility + characterAccessibility * 0.1,
    0,
    100,
  );

  const hookStrength = clamp(
    script.structure * 0.3 +
      script.characters * 0.2 +
      story.hookiness * 0.35 +
      popularity * 0.15 +
      archetype.commercial.hookiness +
      settingDistinctiveness(script.primarySetting) * 5 +
      leadCharacterDistinctiveness(script.cast) * 5,
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
