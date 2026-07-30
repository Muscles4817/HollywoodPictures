// The hidden "how strong is the *idea*" reading - derived, never stored, the
// same "derive, don't roll and store" pattern engine/commercialProfile.ts uses
// (docs/SIMULATION_PHILOSOPHY.md Principle 8). It answers "why would studios
// fight over this screenplay," distinct from how well it's written (execution
// craft) and how easily it markets (commercial profile).
//
// Concept Strength is NOT originality. Originality is one modest INPUT among
// several (docs/DESIGN_REVIEW_source_generation_and_determinants.md): a Batman
// picture is barely original yet an enormous concept (hook + franchise), while
// an arthouse original can be highly original yet a thin commercial concept.
// The stored concept-quality inputs (hook/emotionalPremise/franchisePotential/
// originality) carry most of the weight; the categorical identity (genre/story
// type/archetype) adds a smaller nudge.
import type { Script } from '../types';
import { GENRE_PROFILES } from '../data/genres';
import { STORY_TYPE_PROFILES } from '../data/storyTypes';
import { SCRIPT_ARCHETYPE_PROFILES } from '../data/scriptArchetypes';
import { clamp } from './random';

// The concept-quality inputs plus the categorical identity this reads. A Pick,
// like commercialProfile's CommercialInputs, so any script-shaped value works.
type ConceptInputs = Pick<Script, 'genre' | 'archetype' | 'storyType' | 'hook' | 'emotionalPremise' | 'franchisePotential' | 'originality'>;

// Stored concept-quality carries the bulk; originality is a deliberately modest
// input (not the whole story); the categorical identity is a small nudge. Weights
// sum to 1, so the result stays on 0-100 without a separate normalisation.
const HOOK_WEIGHT = 0.30;
const EMOTIONAL_WEIGHT = 0.22;
const FRANCHISE_WEIGHT = 0.18;
const ORIGINALITY_WEIGHT = 0.15;
const CATEGORICAL_WEIGHT = 0.15;

/** The categorical "what kind of concept this is" nudge - how popular the genre is, how hooky the story type runs, plus the archetype's own commercial-hook bias. 0-100. */
function categoricalConceptPull(script: ConceptInputs): number {
  const story = STORY_TYPE_PROFILES[script.storyType];
  const popularity = GENRE_PROFILES[script.genre].popularity;
  const archetypeHook = SCRIPT_ARCHETYPE_PROFILES[script.archetype].commercial.hookiness; // ~-20..+20
  return clamp(story.hookiness * 0.5 + popularity * 0.5 + archetypeHook, 0, 100);
}

/**
 * How strong the idea is, 0-100 - the thing studios bid on. Derived on demand
 * from the immutable concept-quality inputs plus categorical identity; nothing
 * is stored, so rebalancing "what makes a great concept" never touches a save.
 */
export function deriveConceptStrength(script: ConceptInputs): number {
  return clamp(
    script.hook * HOOK_WEIGHT +
      script.emotionalPremise * EMOTIONAL_WEIGHT +
      script.franchisePotential * FRANCHISE_WEIGHT +
      script.originality * ORIGINALITY_WEIGHT +
      categoricalConceptPull(script) * CATEGORICAL_WEIGHT,
    0,
    100,
  );
}

// Player-facing bands - qualitative, never the raw number (CLAUDE.md: presentation
// is stars/prose/named causes, not internal stat values).
const STRENGTH_BANDS: { min: number; label: string }[] = [
  { min: 78, label: 'A powerhouse concept' },
  { min: 62, label: 'A strong concept' },
  { min: 46, label: 'A solid concept' },
  { min: 30, label: 'A modest concept' },
  { min: 0, label: 'A thin concept' },
];

/**
 * A number-free "why studios would fight over this idea" line for the Opportunity
 * Market / Script Details, in the same house style as describeCommercialAppeal:
 * an overall band plus the one-or-two named things that actually drive it.
 */
export function describeConceptStrength(script: ConceptInputs): string {
  const band = (STRENGTH_BANDS.find((b) => deriveConceptStrength(script) >= b.min) ?? STRENGTH_BANDS[STRENGTH_BANDS.length - 1]).label;
  const drivers: string[] = [];
  if (script.hook >= 65) drivers.push('an immediate hook');
  if (script.originality >= 70) drivers.push('a genuinely original premise');
  if (script.franchisePotential >= 65) drivers.push('clear franchise potential');
  if (script.emotionalPremise >= 65) drivers.push('strong emotional stakes');
  if (drivers.length === 0) return `${band}.`;
  return `${band} — ${drivers.slice(0, 2).join(', ')}.`;
}
