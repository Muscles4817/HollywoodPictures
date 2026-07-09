import type { Genre, ProductionChoices, ProductionEvent, ProductionRiskProfile, Script, Talent } from '../types';
import {
  POSITIVE_EVENT_TEMPLATES,
  NEGATIVE_EVENT_TEMPLATES,
  GENRE_EVENT_TEMPLATES,
  RISK_DIMENSION_EVENT_TEMPLATES,
  type ProductionEventTemplate,
} from '../data/productionEvents';
import { GENRE_PROFILES } from '../data/genres';
import { shootingRisk, contingencyT, practicalEffectsT, vfxT, overallSpendT } from './productionDials';
import { clamp, randFloat, randInt, type RandomFn } from './random';

/**
 * Five independent-enough risk dimensions instead of one blended score -
 * each has its own real inputs and its own event pool (data/productionEvents.ts),
 * so a rushed shoot and a dangerous one aren't the same "risk" wearing
 * different event flavor text. See docs/DESIGN.md 5.9 for how each survived
 * a pass checking it had a genuinely distinct input and output from the
 * other four (three others - Pressure, Preparedness, Creative Freedom -
 * didn't and were folded in or cut).
 */
export function computeProductionRiskProfile(
  talent: Talent[],
  script: Script,
  choices: ProductionChoices,
  genre: Genre,
): ProductionRiskProfile {
  const avgReliability = talent.length ? talent.reduce((sum, t) => sum + t.reliability, 0) / talent.length : 70;
  const avgEgo = talent.length ? talent.reduce((sum, t) => sum + t.ego, 0) / talent.length : 50;
  const unreliabilityRisk = 100 - avgReliability;

  // Interpersonal friction - unreliable, high-ego casts are more likely to
  // clash or flake, independent of anything about the shoot's schedule or
  // physical/technical demands.
  const moraleRisk = clamp(Math.round(unreliabilityRisk * 0.6 + avgEgo * 0.4), 0, 100);

  // Did we have enough time? Fast pace is the dominant term (reuses the
  // existing shootingRisk curve directly); a long runtime means more to
  // shoot in the same window, and a bigger cast means more people to
  // coordinate - both add a smaller amount on top.
  const paceRisk = shootingRisk(choices.shootingIntensity);
  const castSizePressure = clamp((talent.length - 6) * 2, 0, 15);
  const runtimePressure = choices.runtimeIntensity * 15;
  const schedulePressure = clamp(Math.round(paceRisk + runtimePressure + castSizePressure), 0, 100);

  // Physical/stunt danger: how ambitious the practical-effects spend is,
  // offset by how much contingency margin exists to do it safely, plus a
  // rushed pace compounding it (corners get cut). This is the concrete
  // version of "high practical effects, low contingency, fast pace -> stunt
  // injury" from the original design brief.
  const practicalAmbitionT = practicalEffectsT(choices.practicalEffectsAmount);
  const contingencyMitigation = contingencyT(choices.contingencyAmount);
  const paceRiskT = 1 - choices.shootingIntensity;
  const safetyRisk = clamp(
    Math.round(20 + practicalAmbitionT * 50 - contingencyMitigation * 30 + paceRiskT * 25),
    0,
    100,
  );

  // Technical/creative difficulty: VFX ambition and script complexity,
  // offset by contingency margin (money helps absorb a technical hiccup,
  // just less than it helps with physical safety).
  const vfxAmbitionT = vfxT(choices.vfxAmount);
  const complexityT = script.complexity / 100;
  const technicalComplexity = clamp(
    Math.round(15 + vfxAmbitionT * 45 + complexityT * 30 - contingencyMitigation * 15),
    0,
    100,
  );

  // Is this production resourced for what it's actually trying to do? Not
  // "is the budget low" in isolation (the old budgetRisk curve) but low
  // *relative to* what the genre's VFX/practical importance and the
  // script's own complexity call for - an Action film and a Drama at the
  // same spend level don't carry the same risk.
  const genreProfile = GENRE_PROFILES[genre];
  const genreAmbition = (genreProfile.vfxImportance + genreProfile.practicalEffectsImportance) / 2;
  const spendT = overallSpendT(choices);
  const budgetRisk = clamp(
    Math.round(20 + (genreAmbition - spendT) * 60 + (complexityT - spendT) * 20),
    0,
    100,
  );

  return { schedulePressure, moraleRisk, safetyRisk, technicalComplexity, budgetRisk };
}

function rollEvent(template: ProductionEventTemplate, rng: RandomFn): ProductionEvent {
  const [costMin, costMax] = template.costRange;
  const [qMin, qMax] = template.qualityRange;
  const [bMin, bMax] = template.buzzRange;
  const [dMin, dMax] = template.delayRiskRange;
  return {
    id: template.id,
    description: template.description,
    costDelta: Math.round(randFloat(rng, costMin, costMax)),
    qualityDelta: randFloat(rng, qMin, qMax),
    buzzDelta: randFloat(rng, bMin, bMax),
    delayRiskDelta: randFloat(rng, dMin, dMax),
  };
}

const HIGH_RISK_THRESHOLD = 55;
const LOW_RISK_THRESHOLD = 35;

const RISK_DIMENSIONS = ['schedulePressure', 'moraleRisk', 'safetyRisk', 'technicalComplexity', 'budgetRisk'] as const;

/**
 * Mixes dimension-themed templates into the pools whenever a dimension is
 * clearly high or low, the same additive-pool pattern GENRE_EVENT_TEMPLATES
 * already uses - a high-Safety-risk shoot becomes eligible for stunt/injury
 * events on top of the generic pool, not instead of it; a well-prepared,
 * low-pressure shoot becomes eligible for its own positive flavor. A
 * mid-range dimension contributes nothing extra - only a clear reading in
 * either direction earns thematic events, so the pool doesn't get diluted
 * by five dimensions all being vaguely-not-quite triggered at once.
 */
function addDimensionTemplates(
  profile: ProductionRiskProfile,
  positivePool: ProductionEventTemplate[],
  negativePool: ProductionEventTemplate[],
): void {
  for (const dimension of RISK_DIMENSIONS) {
    const value = profile[dimension];
    const bank = RISK_DIMENSION_EVENT_TEMPLATES[dimension];
    if (value >= HIGH_RISK_THRESHOLD) negativePool.push(...bank.negative);
    else if (value <= LOW_RISK_THRESHOLD) positivePool.push(...bank.positive);
  }
}

/**
 * Simulates a shoot: picks 3-5 events, each rolled positive or negative
 * based on the overall risk (the five dimensions averaged), without
 * repeating the same template twice. Genre templates and now
 * risk-dimension templates are both mixed into the generic pool rather than
 * replacing it, so a shoot can still hit ordinary set drama, not just
 * genre- or risk-flavored beats.
 */
export function simulateProduction(
  talent: Talent[],
  script: Script,
  choices: ProductionChoices,
  genre: Genre,
  rng: RandomFn,
): { events: ProductionEvent[]; riskProfile: ProductionRiskProfile } {
  const riskProfile = computeProductionRiskProfile(talent, script, choices, genre);
  const overallRisk = Math.round(
    (riskProfile.schedulePressure +
      riskProfile.moraleRisk +
      riskProfile.safetyRisk +
      riskProfile.technicalComplexity +
      riskProfile.budgetRisk) /
      5,
  );
  const eventCount = randInt(rng, 3, 5);

  const genreTemplates = GENRE_EVENT_TEMPLATES[genre] ?? [];
  const positivePool = [...POSITIVE_EVENT_TEMPLATES, ...genreTemplates.filter((t) => t.polarity === 'positive')];
  const negativePool = [...NEGATIVE_EVENT_TEMPLATES, ...genreTemplates.filter((t) => t.polarity === 'negative')];
  addDimensionTemplates(riskProfile, positivePool, negativePool);

  const usedIds = new Set<string>();
  const events: ProductionEvent[] = [];

  for (let i = 0; i < eventCount; i++) {
    const rollNegative = rng() * 100 < overallRisk;
    const pool = (rollNegative ? negativePool : positivePool).filter((t) => !usedIds.has(t.id));
    const fallbackPool = (rollNegative ? positivePool : negativePool).filter((t) => !usedIds.has(t.id));
    const candidates = pool.length > 0 ? pool : fallbackPool;
    if (candidates.length === 0) break; // exhausted all templates

    const template = candidates[randInt(rng, 0, candidates.length - 1)];
    usedIds.add(template.id);
    events.push(rollEvent(template, rng));
  }

  return { events, riskProfile };
}
