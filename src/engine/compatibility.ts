import type { ActingStyle, Script, Talent, ToneProfile } from '../types';
import { TONES } from '../data/tones';
import { ACTING_STYLE_TONE_WEIGHTS } from '../data/actingStyle';
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
 * Compatibility for whichever talent role actually has a tone-comparable
 * stat - Director compares its ToneProfile directly, Actors go through
 * deriveToneFromActingStyle first, and crew roles (Writer/Composer/Editor/
 * VFX Supervisor) have neither, so this returns null for them rather than a
 * meaningless number.
 */
export function computeTalentCompatibility(talent: Talent, script: Script): number | null {
  if (talent.role === 'Director') return computeCompatibility(script.toneProfile, talent.toneProfile);
  if (talent.role === 'Lead Actor' || talent.role === 'Supporting Actor') {
    return computeCompatibility(script.toneProfile, deriveToneFromActingStyle(talent.actingStyle));
  }
  return null;
}
