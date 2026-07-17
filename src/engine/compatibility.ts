import type { ActingStyle, CharacterTraitProfile, Person, ProductionRole, Script, ScriptCharacter, Tone, ToneProfile } from '../types';
import { TONES } from '../data/tones';
import { ACTING_STYLE_TONE_WEIGHTS } from '../data/actingStyle';
import { professionForProductionRole } from '../data/helpers';
import { clamp } from './random';

/**
 * How well a tone profile suits a specific script (0-100), weighted by how
 * much the script itself leans on each tone. Being weak at comedy doesn't
 * hurt on a script that isn't comedic at all, but being weak at suspense
 * hurts a lot on one that's built around it - so casting is about matching
 * this script's actual emotional needs, not maximizing an average.
 */
export function computeCompatibility(scriptTone: ToneProfile, talentTone: ToneProfile): number {
  let weightedDistance = 0;
  let weightTotal = 0;
  for (const tone of TONES) {
    const weight = scriptTone[tone];
    weightedDistance += weight * Math.abs(scriptTone[tone] - talentTone[tone]);
    weightTotal += weight;
  }
  if (weightTotal === 0) return 50; // degenerate all-zero script - shouldn't happen, neutral fallback
  return clamp(100 - weightedDistance / weightTotal, 0, 100);
}

/**
 * Translates an actor's native ActingStyle into tone-space so it can run
 * through the same computeCompatibility formula a director does, rather
 * than needing a second scoring formula. Each tone reads off a weighted
 * average of whichever acting-style axes matter for it
 * (data/actingStyle.ts:ACTING_STYLE_TONE_WEIGHTS) - a tone with no
 * contributing axis (none currently) would fall back to a neutral 50.
 */
export function deriveToneFromActingStyle(actingStyle: ActingStyle): ToneProfile {
  const profile = {} as ToneProfile;
  for (const tone of TONES) {
    const weights = ACTING_STYLE_TONE_WEIGHTS[tone];
    let weightedSum = 0;
    let weightTotal = 0;
    for (const [axis, weight] of Object.entries(weights) as Array<[keyof ActingStyle, number]>) {
      weightedSum += actingStyle[axis] * weight;
      weightTotal += weight;
    }
    profile[tone] = weightTotal > 0 ? weightedSum / weightTotal : 50;
  }
  return profile;
}

/**
 * Compatibility for whichever career `role` actually engages - Director
 * compares its ToneProfile directly, Actor (Lead or Supporting) goes
 * through deriveToneFromActingStyle first, and crew roles (Writer/Composer/
 * Editor/VFX Supervisor) have neither, so this returns null for them rather
 * than a meaningless number. `role` (not just whichever careers the person
 * happens to have) is what determines which career is read - the same
 * person could hold both an Actor and a Director career and be cast under
 * either one on different films.
 */
export function computeTalentCompatibility(person: Person, role: ProductionRole, script: Script): number | null {
  const profession = professionForProductionRole(role);
  if (profession === 'Director') {
    const career = person.careers.director;
    return career ? computeCompatibility(script.toneProfile, career.toneProfile) : null;
  }
  if (profession === 'Actor') {
    const career = person.careers.actor;
    return career ? computeCompatibility(script.toneProfile, deriveToneFromActingStyle(career.actingStyle)) : null;
  }
  return null;
}

/** One tone axis's contribution to a compatibility score - see computeCompatibilityBreakdown. */
export interface ToneCompatibilityAxis {
  tone: Tone;
  /** scriptTone[tone] - both how much the script leans on this tone and, per computeCompatibility's own formula, this axis's weight in the final score. */
  scriptValue: number;
  talentValue: number;
  /** Absolute mismatch between the two, unweighted. */
  gap: number;
  /** scriptValue * gap - the exact per-tone term computeCompatibility sums into weightedDistance before turning it into the final 0-100 score. Never exposed by computeCompatibility itself, which only returns the aggregate. */
  contribution: number;
  /** contribution as a 0-1 fraction of the total mismatch across all six tones - "how much of what's dragging this score down is this one axis," so a lopsided single-axis gap is distinguishable from a small mismatch spread evenly across all six. */
  contributionShare: number;
}

/**
 * The per-tone breakdown behind computeCompatibility's aggregate score -
 * not read anywhere in live gameplay (the game only ever needs the single
 * 0-100 number), but exposed for the Outcome Inspector
 * (components/dev/OutcomeInspector.tsx) so a developer can see *which*
 * specific tone axis is actually driving a given talent/script pairing's
 * compatibility, not just the final number - docs/DESIGN.md QoL pass. Pure
 * arithmetic restatement of computeCompatibility's own loop; deliberately
 * kept as a second function rather than changing computeCompatibility's
 * return shape, so every existing gameplay call site is untouched.
 */
export function computeCompatibilityBreakdown(scriptTone: ToneProfile, talentTone: ToneProfile): ToneCompatibilityAxis[] {
  const rows = TONES.map((tone) => {
    const scriptValue = scriptTone[tone];
    const talentValue = talentTone[tone];
    const gap = Math.abs(scriptValue - talentValue);
    return { tone, scriptValue, talentValue, gap, contribution: scriptValue * gap };
  });
  const totalContribution = rows.reduce((sum, row) => sum + row.contribution, 0);
  return rows.map((row) => ({
    ...row,
    contributionShare: totalContribution > 0 ? row.contribution / totalContribution : 0,
  }));
}

/** Role-aware wrapper mirroring computeTalentCompatibility's own dispatch - null for crew roles with no tone-comparable stat. */
export function computeTalentCompatibilityBreakdown(person: Person, role: ProductionRole, script: Script): ToneCompatibilityAxis[] | null {
  const profession = professionForProductionRole(role);
  if (profession === 'Director') {
    const career = person.careers.director;
    return career ? computeCompatibilityBreakdown(script.toneProfile, career.toneProfile) : null;
  }
  if (profession === 'Actor') {
    const career = person.careers.actor;
    return career ? computeCompatibilityBreakdown(script.toneProfile, deriveToneFromActingStyle(career.actingStyle)) : null;
  }
  return null;
}

// --- Character compatibility (Character and Setting Foundations milestone) -
//
// A second, independent compatibility reading, alongside (not instead of)
// computeTalentCompatibility above - that one asks "does this actor's whole
// style suit the film's tone," this one asks "does this actor's style suit
// the *specific role* they'd be playing." See
// docs/CHARACTER_AND_SETTING_FOUNDATIONS.md section 7.

/** ActingStyle's five axes, mapped onto the CharacterTraitProfile fields they overlap with - the only two vocabularies compared here (dramaticDepth/audienceAccessibility/distinctiveness/merchandisePotential have no actor-stat equivalent, see ScriptCharacter's own doc comment in types/index.ts). Exported so UI (components/common/TalentStats.tsx) can build a matching per-axis breakdown for the character-fit badge without duplicating this mapping. */
export const ACTING_STYLE_TO_CHARACTER_TRAIT: Record<keyof ActingStyle, keyof CharacterTraitProfile> = {
  characterTransformation: 'transformationDemand',
  emotionalPerformance: 'emotionalDemand',
  charisma: 'charismaDemand',
  comedy: 'comedyDemand',
  physicalPerformance: 'physicalDemand',
};

/**
 * How well an actor's own ActingStyle suits a *specific* Character's trait
 * demands - a direct, unweighted 1-100 comparison across the five
 * dimensions the two vocabularies share, deliberately simpler than
 * computeCompatibility's tone-weighted formula (this is explicitly a
 * first-pass calculation, see the design doc). A high-comedy actor reads as
 * a strong fit for a high-comedyDemand character regardless of what either
 * number says about drama or physicality.
 */
export function computeCharacterCompatibility(actingStyle: ActingStyle, traits: CharacterTraitProfile): number {
  const axes = Object.keys(ACTING_STYLE_TO_CHARACTER_TRAIT) as Array<keyof ActingStyle>;
  const totalGap = axes.reduce((sum, axis) => sum + Math.abs(actingStyle[axis] - traits[ACTING_STYLE_TO_CHARACTER_TRAIT[axis]]), 0);
  return clamp(100 - totalGap / axes.length, 0, 100);
}

/** Person-level wrapper - null if this person has no Actor career at all (mirrors computeTalentCompatibility's own null-for-not-applicable convention). */
export function computeActorCharacterCompatibility(person: Person, character: ScriptCharacter): number | null {
  const career = person.careers.actor;
  return career ? computeCharacterCompatibility(career.actingStyle, character.traits) : null;
}
