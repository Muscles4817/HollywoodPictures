import type { ToneProfile } from '../types';
import { TONES } from '../data/tones';
import { clamp } from './random';

/**
 * How well a talent's tone profile suits a specific script (0-100), weighted
 * by how much the script itself leans on each tone. Being weak at comedy
 * doesn't hurt on a script that isn't comedic at all, but being weak at
 * suspense hurts a lot on one that's built around it - so casting is about
 * matching this script's actual emotional needs, not maximizing an average.
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
