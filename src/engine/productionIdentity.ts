import type { EffectsMethodKey, EnvironmentMethodKey, Script } from '../types';
import { dominantLean, type StrategyBreakdown } from './recommendation';

// Cross-recommendation synthesis - reads the *combination* of Environment
// and Effects Strategy, not any one recommendation in isolation. Kept
// separate from recommendation.ts on purpose: that file is deliberately
// four independent, single-purpose functions (docs/DESIGN.md 5.27); this is
// a different kind of thing - a narrative summary built from their outputs,
// meant to eventually be reusable wherever a film's "identity" matters
// beyond Plan Production (release-time reviews, awards, marketing copy -
// the original design goal this whole redesign started from).

const ENVIRONMENT_IDENTITY_ADJECTIVES: Record<EnvironmentMethodKey, string> = {
  studio: 'studio-built',
  location: 'location-heavy',
  digital: 'digitally-realized',
};

const EFFECTS_IDENTITY_ADJECTIVES: Record<EffectsMethodKey, string> = {
  practical: 'practical-effects-driven',
  digital: 'VFX-driven',
};

// How far above an even split the *final* (already damped) Environment
// value needs to sit before it earns a place in the headline sentence -
// deliberately reads the post-damping value, so a low-Ambition production
// (whose Strategy split barely matters, see engine/recommendation.ts) won't
// get an identity claim it doesn't back up with real investment.
const STRONG_LEAN_THRESHOLD = 0.15;
const AMBITIOUS_THRESHOLD = 0.6;

/**
 * A one-sentence synthesis of the whole production plan - "A location-heavy,
 * VFX-driven thriller, with the director's own instincts closely matching
 * what the screenplay calls for." Template-based, same plain-declarative
 * voice as every other reason string this engine produces, not literary
 * prose - deliberately consistent rather than more "written," so it reads
 * like the rest of the system instead of a different voice bolted on top.
 */
export function synthesizeProductionIdentity(
  script: Script,
  environment: StrategyBreakdown<EnvironmentMethodKey>,
  effects: StrategyBreakdown<EffectsMethodKey>,
): string {
  const descriptors: string[] = [];

  const envLean = dominantLean(environment.recommendation.value);
  if (envLean.overBaseline >= STRONG_LEAN_THRESHOLD) {
    descriptors.push(ENVIRONMENT_IDENTITY_ADJECTIVES[envLean.key]);
  }

  if (effects.ambition >= AMBITIOUS_THRESHOLD) {
    const fxLean = dominantLean(effects.recommendation.value);
    descriptors.push(EFFECTS_IDENTITY_ADJECTIVES[fxLean.key]);
  }

  const descriptorText = descriptors.length > 0 ? `${descriptors.join(', ')} ` : '';
  const anyTension = environment.agreementState === 'disagree' || effects.agreementState === 'disagree';
  const closing = anyTension
    ? "though the director's own instincts pull against parts of what the screenplay calls for"
    : "with the director's own instincts closely matching what the screenplay calls for";

  return `A ${descriptorText}${script.genre.toLowerCase()}, ${closing}.`;
}

/** The slim fields findBiggestTension actually needs - avoids mixing StrategyBreakdown<EnvironmentMethodKey> and StrategyBreakdown<EffectsMethodKey> in one array, which their differing K would otherwise fight over. */
export interface TensionCandidate {
  label: string;
  agreementState: 'agree' | 'disagree' | 'neutral';
  distance: number;
}

/**
 * Whichever active recommendation has the biggest script/director
 * disagreement, or null if nothing disagrees - the single most
 * producer-relevant moment on the whole screen, surfaced once rather than
 * making the player notice it buried inside a specific card (docs/DESIGN.md).
 */
export function findBiggestTension(candidates: TensionCandidate[]): TensionCandidate | null {
  const disagreements = candidates.filter((c) => c.agreementState === 'disagree');
  if (disagreements.length === 0) return null;
  return disagreements.reduce((biggest, cur) => (cur.distance > biggest.distance ? cur : biggest));
}
