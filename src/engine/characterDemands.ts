// What a role actually asks of the performer is a property of the SCRIPT it
// sits in, not of its character archetype alone.
//
// data/characterArchetypes.ts gives every archetype one fixed baseTraits row -
// an IdealisticHero carries physicalDemand 45 whether they're outrunning a
// fireball or sitting in a jury room for ninety minutes. That row is the right
// *starting point* (it's what makes a Villain read differently from a Mentor),
// but on its own it produced obvious nonsense: a single-interior-location
// courtroom drama with action 5 and spectacle 3 still briefed every juror with
// "physical performance demands," and the player was invited to pay for
// physicality the film could never use.
//
// So the archetype proposes and the screenplay disposes: three of the five
// acting-relevant demand axes are scaled by how much of that thing the script
// itself actually contains (its ToneProfile plus the ProductionRequirements
// that imply real physical work). Pure, deterministic, and deliberately drawing
// no randomness - it runs as a post-pass over an already-generated cast, so
// applying it never shifts a seeded rng stream (engine/scriptGenerator.ts).
import type { CharacterTraitProfile, ProductionRequirements, ScriptCharacter, ToneProfile } from '../types';
import { clamp } from './random';

/** The screenplay-side context a role's demands are read against. */
export interface DemandContext {
  toneProfile: ToneProfile;
  productionRequirements: ProductionRequirements;
}

// How far the script is allowed to move a base demand, per axis. Pressure runs
// 0-1 and is neutral at 0.5, so a perfectly middling script leaves the
// archetype's own row untouched: pressure 0 scales by (1 - weight), pressure 1
// by (1 + weight). Comedy is the most script-determined axis (a part is only a
// comic part if the film is funny), emotional the least (even a light film asks
// its leads for some feeling), with physicality in between.
const PHYSICAL_WEIGHT = 0.6;
const COMEDY_WEIGHT = 0.7;
const EMOTIONAL_WEIGHT = 0.4;

// charismaDemand and transformationDemand are deliberately NOT modulated.
// Charisma is the one generalist axis (see types/index.ts:ActingStyle) - every
// part needs presence, and no tone profile makes screen presence irrelevant.
// Transformation is about the distance between performer and part, which the
// archetype genuinely does own: a Monster or a TragicVillain is a
// transformation whatever the film's tone.

/** Physical work the script actually contains: how loud its action/spectacle axes are, plus whether the shoot really stages stunts or choreography. */
function physicalPressure({ toneProfile, productionRequirements }: DemandContext): number {
  const tone = Math.max(toneProfile.action, toneProfile.spectacle) / 100;
  const staged = Math.max(productionRequirements.stunts, productionRequirements.choreography);
  return clamp(tone * 0.6 + staged * 0.4, 0, 1);
}

/** Comic work the script contains - its comedy axis, straight through. */
function comedyPressure({ toneProfile }: DemandContext): number {
  return clamp(toneProfile.comedy / 100, 0, 1);
}

/** Emotional work the script contains - dominated by drama, with romance a real but minority contributor. */
function emotionalPressure({ toneProfile }: DemandContext): number {
  return clamp((toneProfile.drama * 0.75 + toneProfile.romance * 0.25) / 100, 0, 1);
}

/** Scale one archetype demand by how much of that thing the script contains - neutral (unchanged) at pressure 0.5. */
function modulate(base: number, pressure: number, weight: number): number {
  return clamp(Math.round(base * (1 - weight + 2 * weight * pressure)), 1, 100);
}

/** One character's archetype demands re-read against the screenplay they're actually in. */
export function scriptShapedTraits(traits: CharacterTraitProfile, context: DemandContext): CharacterTraitProfile {
  return {
    ...traits,
    physicalDemand: modulate(traits.physicalDemand, physicalPressure(context), PHYSICAL_WEIGHT),
    comedyDemand: modulate(traits.comedyDemand, comedyPressure(context), COMEDY_WEIGHT),
    emotionalDemand: modulate(traits.emotionalDemand, emotionalPressure(context), EMOTIONAL_WEIGHT),
  };
}

/** Every role in a cast re-read against its own screenplay - the post-pass every script-construction path runs before handing a cast out. */
export function scriptShapedCast(cast: ScriptCharacter[], context: DemandContext): ScriptCharacter[] {
  return cast.map((character) => ({ ...character, traits: scriptShapedTraits(character.traits, context) }));
}
