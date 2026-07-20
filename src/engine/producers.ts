// Production Office & Producers - pure logic (docs/DESIGN_REVIEW_production_office.md).
// Plain data in, plain data out, no React, no state - the same discipline as
// the rest of engine/. Generation lives in engine/talentGenerator.ts; the
// tunable numbers live in data/producers.ts.
import type { Genre, Money, Person, ProducerCareer, ProducerSpecialty, ProductionEvent, Studio } from '../types';
import {
  EVENT_IMPACT_MULTIPLIER_FLOOR,
  MAX_MARKETING_EFFICIENCY_MULTIPLIER,
  MAX_POST_SCORE_DELTA,
  OFFICE_BENCH_CAPACITY_BY_TIER,
  OFFICE_MAX_TIER,
  OFFICE_UNLOCK_BRAND,
  OFFICE_UNLOCK_FILMS_RELEASED,
  OFFICE_UPGRADE_COST_BY_TIER,
  PRODUCER_AFFINITY_MULTIPLIER,
  PRODUCER_EFFECT_RANGES,
  PRODUCER_HIRING_FEE_MULTIPLE,
  PRODUCER_RELIABILITY_FLOOR,
  PRODUCER_SAME_SPECIALTY_DECAY,
  PRODUCTION_COST_MULTIPLIER_FLOOR,
} from '../data/producers';
import type { Range } from './interpolate';

function lerp(range: Range, t: number): number {
  return range.min + (range.max - range.min) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// --- Person accessors ------------------------------------------------------

export function getProducerCareer(person: Person): ProducerCareer | null {
  return person.careers.producer ?? null;
}

export function isProducer(person: Person): boolean {
  return getProducerCareer(person) !== null;
}

/** The per-film fee - the producer career's typicalSalary (0 if not a producer). */
export function producerPerFilmFee(person: Person): Money {
  return getProducerCareer(person)?.typicalSalary ?? 0;
}

/** The one-time signing fee - a fixed multiple of the per-film fee (nothing stored). */
export function producerHiringFee(person: Person): Money {
  return producerPerFilmFee(person) * PRODUCER_HIRING_FEE_MULTIPLE;
}

/** Resolve producer ids against a pool, dropping any that aren't found. Order follows `ids`. */
export function producersByIds(pool: Person[], ids: readonly string[]): Person[] {
  const byId = new Map(pool.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is Person => p != null);
}

/** Total per-film fee owed for a set of attached producers - the amount RELEASE_FILM adds to the film's cost. */
export function totalAttachedPerFilmFees(pool: Person[], ids: readonly string[]): Money {
  return producersByIds(pool, ids).reduce((sum, p) => sum + producerPerFilmFee(p), 0);
}

// --- Effect computation ----------------------------------------------------

export interface ProducerEffects {
  /** Multiply the production budget cost by this (<= 1) - Line. */
  productionCostMultiplier: number;
  /** Add this to the post-production sub-score - Creative. */
  postProductionDelta: number;
  /** Multiply marketing efficiency (Buzz-per-pound) by this (>= 1) - Executive. */
  marketingEfficiencyMultiplier: number;
  /** Add this flat Buzz pre-opening - Executive. */
  flatBuzzDelta: number;
  /** Scale the *negative* portion of on-set event deltas by this (<= 1) - Fixer. */
  eventNegativeImpactMultiplier: number;
}

export const NEUTRAL_PRODUCER_EFFECTS: ProducerEffects = {
  productionCostMultiplier: 1,
  postProductionDelta: 0,
  marketingEfficiencyMultiplier: 1,
  flatBuzzDelta: 0,
  eventNegativeImpactMultiplier: 1,
};

// How much of a producer's raw effect actually lands: amplify-only genre
// affinity x deterministic reliability dampening. Never below the reliability
// floor, never a genre penalty.
function contributionMultiplier(career: ProducerCareer, reliability: number, genre: Genre | null): number {
  const affinity = genre != null && career.genreAffinity.includes(genre) ? PRODUCER_AFFINITY_MULTIPLIER : 1;
  const reliabilityFactor = lerp({ min: PRODUCER_RELIABILITY_FLOOR, max: 1 }, clamp(reliability, 1, 100) / 100);
  return affinity * reliabilityFactor;
}

// Stack same-specialty contributions with geometric decay, strongest first:
// e0 + e1*d + e2*d^2 + ...  Cross-specialty effects don't pass through here -
// they hit different systems and simply add.
function stackWithDecay(values: number[]): number {
  return [...values]
    .sort((a, b) => b - a)
    .reduce((sum, value, index) => sum + value * PRODUCER_SAME_SPECIALTY_DECAY ** index, 0);
}

function bySpecialty(producers: Person[], specialty: ProducerSpecialty): { career: ProducerCareer; reliability: number }[] {
  return producers
    .map((p) => ({ career: getProducerCareer(p), reliability: p.reputation.reliability }))
    .filter((x): x is { career: ProducerCareer; reliability: number } => x.career != null && x.career.specialty === specialty);
}

/**
 * The combined boost a set of attached producers applies to one film. Pure and
 * deterministic. `genre` gates amplify-only affinity (null = no film genre yet,
 * so no amplification). An empty set returns NEUTRAL_PRODUCER_EFFECTS. Every
 * output is clamped to a sane bound (data/producers.ts).
 */
export function computeProducerEffects(producers: Person[], genre: Genre | null): ProducerEffects {
  const contrib = (career: ProducerCareer, reliability: number) => contributionMultiplier(career, reliability, genre);

  // Line -> production cost reduction (a fraction of the budget).
  const lineReduction = stackWithDecay(
    bySpecialty(producers, 'Line').map(
      ({ career, reliability }) => lerp(PRODUCER_EFFECT_RANGES.Line.costReduction, career.skill / 100) * contrib(career, reliability),
    ),
  );

  // Creative -> flat points on the post-production sub-score.
  const postDelta = stackWithDecay(
    bySpecialty(producers, 'Creative').map(
      ({ career, reliability }) => lerp(PRODUCER_EFFECT_RANGES.Creative.postScoreDelta, career.skill / 100) * contrib(career, reliability),
    ),
  );

  // Executive -> marketing efficiency + flat Buzz (two metrics over the same group).
  const executives = bySpecialty(producers, 'Executive');
  const marketingEff = stackWithDecay(
    executives.map(({ career, reliability }) => lerp(PRODUCER_EFFECT_RANGES.Executive.marketingEfficiency, career.skill / 100) * contrib(career, reliability)),
  );
  const flatBuzz = stackWithDecay(
    executives.map(({ career, reliability }) => lerp(PRODUCER_EFFECT_RANGES.Executive.flatBuzz, career.skill / 100) * contrib(career, reliability)),
  );

  // Fixer -> removes a fraction of each negative event's impact.
  const eventMitigation = stackWithDecay(
    bySpecialty(producers, 'Fixer').map(
      ({ career, reliability }) => lerp(PRODUCER_EFFECT_RANGES.Fixer.eventMitigation, career.skill / 100) * contrib(career, reliability),
    ),
  );

  return {
    productionCostMultiplier: clamp(1 - lineReduction, PRODUCTION_COST_MULTIPLIER_FLOOR, 1),
    postProductionDelta: Math.min(postDelta, MAX_POST_SCORE_DELTA),
    marketingEfficiencyMultiplier: Math.min(1 + marketingEff, MAX_MARKETING_EFFICIENCY_MULTIPLIER),
    flatBuzzDelta: flatBuzz,
    eventNegativeImpactMultiplier: clamp(1 - eventMitigation, EVENT_IMPACT_MULTIPLIER_FLOOR, 1),
  };
}

/**
 * Apply a Fixer's mitigation to a set of events for the *quality* path only:
 * each event's negative qualityDelta is softened toward zero by the
 * multiplier; positive (good) events and all cost figures are left untouched.
 * Deliberately does not touch costDelta - on-set event cost accounting is
 * settled elsewhere and folding a mitigation into it would risk double-count
 * (docs/DESIGN_REVIEW_production_office.md §7). `multiplier` is
 * ProducerEffects.eventNegativeImpactMultiplier (1 == no mitigation).
 */
export function mitigateEventQualityImpact(events: ProductionEvent[], multiplier: number): ProductionEvent[] {
  if (multiplier >= 1) return events;
  return events.map((e) => (e.qualityDelta < 0 ? { ...e, qualityDelta: e.qualityDelta * multiplier } : e));
}

// --- Office / employment helpers -------------------------------------------

export function isOfficeUnlocked(studio: Studio): boolean {
  return studio.productionOffice != null;
}

export function officeTier(studio: Studio): number {
  return studio.productionOffice?.tier ?? 0;
}

export function benchCapacityForTier(tier: number): number {
  return OFFICE_BENCH_CAPACITY_BY_TIER[tier] ?? 0;
}

export function benchCapacity(studio: Studio): number {
  return benchCapacityForTier(officeTier(studio));
}

export function benchProducerIds(studio: Studio): string[] {
  return studio.productionOffice?.benchProducerIds ?? [];
}

/** The tier this office could next upgrade to, or null if locked or already maxed. */
export function nextOfficeTier(studio: Studio): number | null {
  const tier = officeTier(studio);
  return tier > 0 && tier < OFFICE_MAX_TIER ? tier + 1 : null;
}

/** Cash cost to reach the next tier, or null if there is no next tier. */
export function officeUpgradeCost(studio: Studio): Money | null {
  const next = nextOfficeTier(studio);
  return next != null ? (OFFICE_UPGRADE_COST_BY_TIER[next] ?? null) : null;
}

/** Whether the office's unlock milestone is met - earned (films shipped OR Brand), not bought. */
export function canUnlockOffice(brand: number, filmsReleased: number): boolean {
  return filmsReleased >= OFFICE_UNLOCK_FILMS_RELEASED || brand >= OFFICE_UNLOCK_BRAND;
}
