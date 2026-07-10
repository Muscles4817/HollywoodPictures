import type {
  Distribution,
  DirectorTalent,
  EffectsMethodKey,
  EnvironmentMethodKey,
  NormalizedScalar,
  Recommendation,
  Script,
} from '../types';
import { clamp } from './random';

// Four independent recommendation functions - Environment Strategy, Effects
// Strategy, Environment Ambition, Effects Ambition. Each is pure, callable
// on its own, and owns its own reasoning; they only share the small,
// domain-free math/phrasing utilities below (blending, distance, damping,
// lean description) - the same way computeStaticProductionRisk's four risk
// dimensions (engine/production.ts) each stay conceptually separate while
// sharing `clamp`. See docs/DESIGN.md for why Ambition has no director
// input yet - script is the sole source until a concrete gap shows up.

// --- Shared math/phrasing utilities (no recommendation-specific logic) ---

interface WeightedReason {
  text: string;
  weight: number;
}

/** Strongest-influence-first, per Recommendation<T>.reasons's contract (types/index.ts). */
function finalizeReasons(reasons: WeightedReason[]): string[] {
  return [...reasons].sort((a, b) => b.weight - a.weight).map((r) => r.text);
}

/** Half the sum of absolute per-key differences - 0 for identical distributions, 1 for two that share no weight in common at all. */
function totalVariationDistance<K extends string>(a: Distribution<K>, b: Distribution<K>): number {
  const keys = Object.keys(a) as K[];
  return keys.reduce((sum, key) => sum + Math.abs(a[key] - b[key]), 0) / 2;
}

/** Weighted average of two distributions, renormalized so float drift never leaves it off 1. */
function blendDistributions<K extends string>(
  a: Distribution<K>,
  weightA: number,
  b: Distribution<K>,
  weightB: number,
): Distribution<K> {
  const keys = Object.keys(a) as K[];
  const raw = {} as Record<K, number>;
  for (const key of keys) raw[key] = a[key] * weightA + b[key] * weightB;
  const total = keys.reduce((sum, key) => sum + raw[key], 0);
  const result = {} as Distribution<K>;
  for (const key of keys) result[key] = total > 0 ? raw[key] / total : 1 / keys.length;
  return result;
}

function uniformDistribution<K extends string>(keys: readonly K[]): Distribution<K> {
  const share = 1 / keys.length;
  return Object.fromEntries(keys.map((k) => [k, share])) as Distribution<K>;
}

/**
 * Pulls a distribution toward an even split by (1 - confidence) - a convex
 * combination of two already-normalized distributions, so it always still
 * sums to 1 without needing to renormalize. See strategyConfidence below for
 * where confidence comes from, and the false-precision note on why this
 * exists at all: a noisy-but-technically-valid 52/48 split on a film that
 * barely needs the thing at all reads as a meaningful creative choice unless
 * something pulls it back toward "doesn't matter much."
 */
function dampenTowardNeutral<K extends string>(dist: Distribution<K>, confidence: number): Distribution<K> {
  const keys = Object.keys(dist) as K[];
  const uniform = 1 / keys.length;
  const result = {} as Distribution<K>;
  for (const key of keys) result[key] = dist[key] * confidence + uniform * (1 - confidence);
  return result;
}

// Below this Ambition, a Strategy recommendation loses confidence linearly
// toward a neutral/uniform split (dampenTowardNeutral) - full trust at or
// above it, zero trust at Ambition 0.
const AMBITION_CONFIDENCE_FLOOR = 0.3;

function strategyConfidence(ambition: NormalizedScalar): number {
  return clamp(ambition / AMBITION_CONFIDENCE_FLOOR, 0, 1);
}

/** The dominant key in a distribution and how far above an even split it sits - the basis for both lean phrasing and "how opinionated is this" weighting. */
function dominantLean<K extends string>(dist: Distribution<K>): { key: K; overBaseline: number } {
  const keys = Object.keys(dist) as K[];
  const baseline = 1 / keys.length;
  let best = keys[0];
  for (const key of keys) if (dist[key] > dist[best]) best = key;
  return { key: best, overBaseline: dist[best] - baseline };
}

function leanPhrase<K extends string>(dist: Distribution<K>, labels: Record<K, string>, subject: string): string {
  const { key, overBaseline } = dominantLean(dist);
  if (overBaseline < 0.1) return `${subject} doesn't strongly favor any particular approach.`;
  if (overBaseline < 0.25) return `${subject} leans toward ${labels[key]}.`;
  return `${subject} is built around ${labels[key]}.`;
}

// Total variation distance below this reads as "the director agrees with
// the screenplay"; at or above the higher one reads as active
// disagreement/tension. Between the two, both are reported without either
// framing - a real but unremarkable difference of opinion.
const AGREEMENT_DISTANCE = 0.15;
const DISAGREEMENT_DISTANCE = 0.4;

// Same overBaseline cutoff leanPhrase uses for "doesn't strongly favor any
// particular approach" - below this, the screenplay doesn't really have a
// lean, so a "tension with the screenplay's lean toward X" sentence would
// risk citing the same option as both sides purely from rounding (a
// near-uniform script's "dominant" key can still technically be whichever
// one happens to be a fraction of a point ahead).
const SCRIPT_OPINION_THRESHOLD = 0.1;

function describeDirectorAgreement<K extends string>(
  distance: number,
  scriptDist: Distribution<K>,
  directorDist: Distribution<K>,
  labels: Record<K, string>,
): string {
  const directorLean = dominantLean(directorDist);
  const scriptLean = dominantLean(scriptDist);
  if (distance <= AGREEMENT_DISTANCE) return `The director also favors ${labels[directorLean.key]}.`;
  if (distance >= DISAGREEMENT_DISTANCE) {
    if (scriptLean.overBaseline >= SCRIPT_OPINION_THRESHOLD) {
      return `The director prefers ${labels[directorLean.key]}, in tension with the screenplay's lean toward ${labels[scriptLean.key]}.`;
    }
    return `The director has a strong preference for ${labels[directorLean.key]}, which the screenplay itself doesn't push back against.`;
  }
  return `The director has a separate preference for ${labels[directorLean.key]}.`;
}

// How much weight the screenplay's own implied approach carries in a
// Strategy blend, vs the director's - the script is the primary source of
// what the film needs (see docs/DESIGN.md), the director nudges the method
// rather than outweighing what the story itself calls for.
const SCRIPT_STRATEGY_WEIGHT = 0.65;
const DIRECTOR_STRATEGY_WEIGHT = 1 - SCRIPT_STRATEGY_WEIGHT;

function ambitionMagnitudePhrase(ambition: NormalizedScalar, domainNoun: string): string {
  if (ambition >= 0.65) return `This vision calls for a substantial ${domainNoun} investment.`;
  if (ambition >= 0.35) return `This vision calls for a moderate, workable level of ${domainNoun} investment.`;
  return `This vision doesn't call for much ${domainNoun} investment - a lean approach is appropriate here.`;
}

// --- Environment Strategy ---

const ENVIRONMENT_METHOD_KEYS: readonly EnvironmentMethodKey[] = ['studio', 'location', 'digital'];

const ENVIRONMENT_LABELS: Record<EnvironmentMethodKey, string> = {
  studio: 'a controlled studio setting',
  location: 'real-world locations',
  digital: 'digitally-built environments',
};

/**
 * How the shoot should physically happen - studio, location, or digitally
 * built - blending the screenplay's own implied approach (primary) with the
 * director's personal lean (secondary), then damping toward a neutral split
 * if Environment Ambition is low enough that the method barely matters
 * either way.
 */
export function recommendEnvironmentStrategy(
  script: Script,
  director: DirectorTalent,
): Recommendation<Distribution<EnvironmentMethodKey>> {
  const scriptDist = script.environmentStrategy;
  const directorDist = director.productionStyle.environmentStrategy;
  const reasons: WeightedReason[] = [];

  const scriptOpinion = dominantLean(scriptDist).overBaseline;
  reasons.push({
    text: leanPhrase(scriptDist, ENVIRONMENT_LABELS, 'The screenplay'),
    weight: scriptOpinion * SCRIPT_STRATEGY_WEIGHT * 4,
  });

  const blended = blendDistributions(scriptDist, SCRIPT_STRATEGY_WEIGHT, directorDist, DIRECTOR_STRATEGY_WEIGHT);
  const blendedWithoutDirector = blendDistributions(
    scriptDist,
    SCRIPT_STRATEGY_WEIGHT,
    uniformDistribution(ENVIRONMENT_METHOD_KEYS),
    DIRECTOR_STRATEGY_WEIGHT,
  );
  // Counterfactual influence: how much the blend actually moves if the
  // director's opinion is swapped for a neutral one - not their flat blend
  // weight, which would rank them identically every time regardless of
  // whether they agreed, disagreed, or had no real opinion at all.
  const directorInfluence = totalVariationDistance(blended, blendedWithoutDirector);
  const distance = totalVariationDistance(scriptDist, directorDist);
  reasons.push({
    text: describeDirectorAgreement(distance, scriptDist, directorDist, ENVIRONMENT_LABELS),
    weight: directorInfluence * 6,
  });

  const confidence = strategyConfidence(script.environmentAmbition);
  const value = dampenTowardNeutral(blended, confidence);
  if (confidence < 0.85) {
    reasons.push({
      text: 'Environment investment is minimal for this film, so this balance has little practical effect on the finished production.',
      weight: (1 - confidence) * 3,
    });
  }

  return { value, reasons: finalizeReasons(reasons) };
}

// --- Effects Strategy ---

const EFFECTS_METHOD_KEYS: readonly EffectsMethodKey[] = ['practical', 'digital'];

const EFFECTS_LABELS: Record<EffectsMethodKey, string> = {
  practical: 'practical, in-camera effects work',
  digital: 'digital effects work',
};

/** Practical vs. digital, same shape of blend/damping as Environment Strategy but kept as its own function - see the file header on why. */
export function recommendEffectsStrategy(
  script: Script,
  director: DirectorTalent,
): Recommendation<Distribution<EffectsMethodKey>> {
  const scriptDist = script.effectsStrategy;
  const directorDist = director.productionStyle.effectsStrategy;
  const reasons: WeightedReason[] = [];

  const scriptOpinion = dominantLean(scriptDist).overBaseline;
  reasons.push({
    text: leanPhrase(scriptDist, EFFECTS_LABELS, 'The screenplay'),
    weight: scriptOpinion * SCRIPT_STRATEGY_WEIGHT * 4,
  });

  const blended = blendDistributions(scriptDist, SCRIPT_STRATEGY_WEIGHT, directorDist, DIRECTOR_STRATEGY_WEIGHT);
  const blendedWithoutDirector = blendDistributions(
    scriptDist,
    SCRIPT_STRATEGY_WEIGHT,
    uniformDistribution(EFFECTS_METHOD_KEYS),
    DIRECTOR_STRATEGY_WEIGHT,
  );
  const directorInfluence = totalVariationDistance(blended, blendedWithoutDirector);
  const distance = totalVariationDistance(scriptDist, directorDist);
  reasons.push({
    text: describeDirectorAgreement(distance, scriptDist, directorDist, EFFECTS_LABELS),
    weight: directorInfluence * 6,
  });

  const confidence = strategyConfidence(script.effectsAmbition);
  const value = dampenTowardNeutral(blended, confidence);
  if (confidence < 0.85) {
    reasons.push({
      text: 'Effects investment is minimal for this film, so this balance has little practical effect on the finished production.',
      weight: (1 - confidence) * 3,
    });
  }

  return { value, reasons: finalizeReasons(reasons) };
}

// --- Environment Ambition ---

/**
 * How much investment the environment vision needs, independent of studio/
 * location/digital split. Script-only - the director shapes *how* the
 * production looks, not how much gets spent achieving it, unless Phase 3
 * demonstrates a concrete need for a director-side Ambition signal (see
 * docs/DESIGN.md). Because of that, this is deliberately a thin pass-through
 * of Script.environmentAmbition with a phrased justification, not a blend.
 */
export function recommendEnvironmentAmbition(script: Script): Recommendation<NormalizedScalar> {
  const reasons: WeightedReason[] = [
    { text: ambitionMagnitudePhrase(script.environmentAmbition, 'environment'), weight: 3 },
  ];
  if (script.complexity >= 65) {
    reasons.push({ text: "The story's complexity adds further demands here.", weight: 1 });
  }
  return { value: script.environmentAmbition, reasons: finalizeReasons(reasons) };
}

// --- Effects Ambition ---

/** Same shape as Environment Ambition - script-only, thin pass-through with a phrased justification. */
export function recommendEffectsAmbition(script: Script): Recommendation<NormalizedScalar> {
  const reasons: WeightedReason[] = [
    { text: ambitionMagnitudePhrase(script.effectsAmbition, 'effects'), weight: 3 },
  ];
  if (script.complexity >= 65) {
    reasons.push({ text: "The story's complexity adds further demands here.", weight: 1 });
  }
  return { value: script.effectsAmbition, reasons: finalizeReasons(reasons) };
}
