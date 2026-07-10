import type {
  EventChoiceTemplate,
  Genre,
  PendingEventChoice,
  ProductionChoices,
  ProductionEvent,
  Script,
  StaticProductionRisk,
  Talent,
} from '../types';
import {
  POSITIVE_EVENT_TEMPLATES,
  NEGATIVE_EVENT_TEMPLATES,
  GENRE_EVENT_TEMPLATES,
  RISK_DIMENSION_EVENT_TEMPLATES,
  type ProductionEventTemplate,
} from '../data/productionEvents';
import { GENRE_PROFILES } from '../data/genres';
import { contingencyT, practicalEffectsT, vfxT, overallSpendT } from './productionDials';
import { clamp, randFloat, randInt, type RandomFn } from './random';

const BASE_SHOOT_DAYS = 18;
const MAX_COMPLEXITY_DAYS = 35;
const MAX_CAST_SIZE_DAYS = 12;
const MAX_RUNTIME_DAYS = 12;
const MAX_EFFECTS_DAYS = 15;
const CAST_SIZE_BASELINE = 6; // roughly the mandatory-roles floor before any multi-hire roles kick in

/**
 * How many days of principal photography this film calls for - shown to
 * the player before they start shooting, and the number their actual
 * shoot length (PhotographyState.daysElapsed) is judged against once
 * they're done. Driven by the same inputs already behind the risk
 * dimensions below: a complex, ensemble, effects-heavy film needs more
 * time than a small, simple one, independent of how many days the player
 * actually gives it.
 */
export function computeRecommendedShootDays(talent: Talent[], script: Script, choices: ProductionChoices): number {
  const complexityDays = (script.complexity / 100) * MAX_COMPLEXITY_DAYS;
  const castDays = clamp((talent.length - CAST_SIZE_BASELINE) * 1.5, 0, MAX_CAST_SIZE_DAYS);
  const runtimeDays = choices.runtimeIntensity * MAX_RUNTIME_DAYS;
  const effectsDays = (practicalEffectsT(choices.practicalEffectsAmount) + vfxT(choices.vfxAmount)) * (MAX_EFFECTS_DAYS / 2);
  return Math.round(BASE_SHOOT_DAYS + complexityDays + castDays + runtimeDays + effectsDays);
}

/**
 * The four risk dimensions knowable before a single day of filming happens
 * - see types/index.ts:StaticProductionRisk for why Schedule Pressure isn't
 * one of them any more. Three of these four survived a pass checking each
 * had a genuinely distinct input and output from the other four originally
 * proposed (Pressure, Preparedness, Creative Freedom didn't and were folded
 * in or cut) - see docs/DESIGN.md 5.9 for the full reasoning.
 */
export function computeStaticProductionRisk(
  talent: Talent[],
  script: Script,
  choices: ProductionChoices,
  genre: Genre,
): StaticProductionRisk {
  const avgReliability = talent.length ? talent.reduce((sum, t) => sum + t.reliability, 0) / talent.length : 70;
  const avgEgo = talent.length ? talent.reduce((sum, t) => sum + t.ego, 0) / talent.length : 50;
  const unreliabilityRisk = 100 - avgReliability;

  // Interpersonal friction - unreliable, high-ego casts are more likely to
  // clash or flake, independent of the shoot's physical/technical demands.
  const moraleRisk = clamp(Math.round(unreliabilityRisk * 0.6 + avgEgo * 0.4), 0, 100);

  // Physical/stunt danger: how ambitious the practical-effects spend is,
  // offset by how much contingency margin exists to do it safely.
  const practicalAmbitionT = practicalEffectsT(choices.practicalEffectsAmount);
  const contingencyMitigation = contingencyT(choices.contingencyAmount);
  const safetyRisk = clamp(Math.round(20 + practicalAmbitionT * 60 - contingencyMitigation * 35), 0, 100);

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
  // "is the budget low" in isolation but low *relative to* what the
  // genre's VFX/practical importance and the script's own complexity call
  // for - an Action film and a Drama at the same spend level don't carry
  // the same risk.
  const genreProfile = GENRE_PROFILES[genre];
  const genreAmbition = (genreProfile.vfxImportance + genreProfile.practicalEffectsImportance) / 2;
  const spendT = overallSpendT(choices);
  const budgetRisk = clamp(
    Math.round(20 + (genreAmbition - spendT) * 60 + (complexityT - spendT) * 20),
    0,
    100,
  );

  return { moraleRisk, safetyRisk, technicalComplexity, budgetRisk };
}

/**
 * Schedule Pressure can't be known before the player decides how long to
 * shoot for, so unlike the other four dimensions it's computed live, from
 * how photography is actually going (daysElapsed / recommendedDays) -
 * falling short is steep, meeting or exceeding it is calm with a floor
 * (there's always *some* pressure). Same shape of curve as
 * shootingQualityFromRatio (productionDials.ts) since they're two readings
 * of the same underlying signal, just as risk instead of quality.
 */
export function computeSchedulePressure(daysElapsed: number, recommendedDays: number): number {
  const ratio = recommendedDays > 0 ? daysElapsed / recommendedDays : 1;
  if (ratio >= 1) return clamp(Math.round(30 - (ratio - 1) * 20), 5, 30);
  return clamp(Math.round(30 + (1 - ratio) * 90), 0, 100);
}

function rollSimpleEvent(template: Extract<ProductionEventTemplate, { interactive?: false }>, rng: RandomFn): ProductionEvent {
  const [costMin, costMax] = template.costRange;
  const [qMin, qMax] = template.qualityRange;
  const [bMin, bMax] = template.buzzRange;
  const [dMin, dMax] = template.delayDaysRange;
  return {
    id: template.id,
    description: template.description,
    costDelta: Math.round(randFloat(rng, costMin, costMax)),
    qualityDelta: randFloat(rng, qMin, qMax),
    buzzDelta: randFloat(rng, bMin, bMax),
    delayDaysDelta: Math.max(0, Math.round(randFloat(rng, dMin, dMax))),
  };
}

/** Rolls one of an interactive event's choices into a concrete outcome, once the player has picked it. */
export function resolveEventChoice(pending: PendingEventChoice, choiceId: string, rng: RandomFn): ProductionEvent {
  const choice = pending.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Unknown event choice "${choiceId}" for "${pending.templateId}"`);
  return rollChoiceOutcome(pending, choice, rng);
}

function rollChoiceOutcome(pending: PendingEventChoice, choice: EventChoiceTemplate, rng: RandomFn): ProductionEvent {
  const [costMin, costMax] = choice.costRange;
  const [qMin, qMax] = choice.qualityRange;
  const [bMin, bMax] = choice.buzzRange;
  const [dMin, dMax] = choice.delayDaysRange;
  return {
    id: pending.templateId,
    description: `${pending.situation} You chose: ${choice.label.toLowerCase()}.`,
    costDelta: Math.round(randFloat(rng, costMin, costMax)),
    qualityDelta: randFloat(rng, qMin, qMax),
    buzzDelta: randFloat(rng, bMin, bMax),
    delayDaysDelta: Math.max(0, Math.round(randFloat(rng, dMin, dMax))),
  };
}

const HIGH_RISK_THRESHOLD = 55;
const LOW_RISK_THRESHOLD = 35;

const MIN_DAILY_EVENT_CHANCE = 0.05;
const MAX_DAILY_EVENT_CHANCE = 0.13;

function buildEventPools(
  fullRisk: Record<'schedulePressure' | 'moraleRisk' | 'safetyRisk' | 'technicalComplexity' | 'budgetRisk', number>,
  genre: Genre,
): { positivePool: ProductionEventTemplate[]; negativePool: ProductionEventTemplate[] } {
  const genreTemplates = GENRE_EVENT_TEMPLATES[genre] ?? [];
  const positivePool = [...POSITIVE_EVENT_TEMPLATES, ...genreTemplates.filter((t) => t.polarity === 'positive')];
  const negativePool = [...NEGATIVE_EVENT_TEMPLATES, ...genreTemplates.filter((t) => t.polarity === 'negative')];

  for (const dimension of Object.keys(fullRisk) as Array<keyof typeof fullRisk>) {
    const value = fullRisk[dimension];
    const bank = RISK_DIMENSION_EVENT_TEMPLATES[dimension];
    if (value >= HIGH_RISK_THRESHOLD) negativePool.push(...bank.negative);
    else if (value <= LOW_RISK_THRESHOLD) positivePool.push(...bank.positive);
  }

  return { positivePool, negativePool };
}

/**
 * Rolls whatever happens on a single day of principal photography - most
 * days, nothing notable does. Called once per ADVANCE_SHOOTING_DAY dispatch
 * (state/studioReducer.ts). Schedule Pressure is recomputed fresh each call
 * from how many days have elapsed so far (engine/production.ts:computeSchedulePressure)
 * and folded in alongside the four static dimensions - a shoot that's
 * clearly running long or clearly on track becomes eligible for its own
 * schedule-flavored events, on top of whatever safety/technical/morale/
 * budget risk already made reachable, and both the frequency and the
 * positive/negative bias of the roll shift with it too, not just which
 * templates are available. `usedIds` (every template that's already fired
 * this shoot) is derived from the events accumulated so far, so nothing
 * repeats within one production. An interactive template (`.interactive ===
 * true`) doesn't resolve here - it comes back as a `pendingChoice` instead
 * of an `event`, which the reducer uses to pause the shoot on
 * PhotographyState.pendingChoice until the player picks one of its choices
 * (see resolveEventChoice above and state/studioReducer.ts:RESOLVE_EVENT_CHOICE).
 */
export function rollDayEvent(
  staticRisk: StaticProductionRisk,
  daysElapsed: number,
  recommendedDays: number,
  genre: Genre,
  usedIds: ReadonlySet<string>,
  rng: RandomFn,
): { event: ProductionEvent } | { pendingChoice: PendingEventChoice } | null {
  const schedulePressure = computeSchedulePressure(daysElapsed, recommendedDays);
  const fullRisk = { schedulePressure, ...staticRisk };
  const avgRisk = (fullRisk.schedulePressure + fullRisk.moraleRisk + fullRisk.safetyRisk + fullRisk.technicalComplexity + fullRisk.budgetRisk) / 5;

  const dailyChance = clamp(MIN_DAILY_EVENT_CHANCE + (avgRisk / 100) * (MAX_DAILY_EVENT_CHANCE - MIN_DAILY_EVENT_CHANCE), MIN_DAILY_EVENT_CHANCE, MAX_DAILY_EVENT_CHANCE);
  if (rng() >= dailyChance) return null;

  const { positivePool, negativePool } = buildEventPools(fullRisk, genre);
  const rollNegative = rng() * 100 < avgRisk;
  const pool = (rollNegative ? negativePool : positivePool).filter((t) => !usedIds.has(t.id));
  const fallbackPool = (rollNegative ? positivePool : negativePool).filter((t) => !usedIds.has(t.id));
  const candidates = pool.length > 0 ? pool : fallbackPool;
  if (candidates.length === 0) return null; // exhausted every template this shoot

  const template = candidates[randInt(rng, 0, candidates.length - 1)];
  if (template.interactive) {
    return {
      pendingChoice: {
        templateId: template.id,
        situation: template.situation,
        polarity: template.polarity,
        choices: template.choices,
      },
    };
  }
  return { event: rollSimpleEvent(template, rng) };
}
