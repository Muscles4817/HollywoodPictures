import type {
  EventChoiceTemplate,
  EventSeverity,
  Genre,
  PendingEventChoice,
  ProductionChoices,
  ProductionEvent,
  ProductionRole,
  Script,
  StaticProductionRisk,
  Talent,
  TalentAssignment,
  TalentProfession,
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
import { computeTalentCompatibility } from './compatibility';
import { findCandidatesNearPrice } from './talentFilter';
import { professionForProductionRole, filterAssignedTalent } from '../data/helpers';
import { clamp, pick, pickMany, randFloat, randInt, type RandomFn } from './random';

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
export function computeRecommendedShootDays(talent: TalentAssignment[], script: Script, choices: ProductionChoices): number {
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
  talent: TalentAssignment[],
  script: Script,
  choices: ProductionChoices,
  genre: Genre,
): StaticProductionRisk {
  const avgReliability = talent.length ? talent.reduce((sum, a) => sum + a.talent.reliability, 0) / talent.length : 70;
  const avgEgo = talent.length ? talent.reduce((sum, a) => sum + a.talent.ego, 0) / talent.length : 50;
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
    severity: template.severity,
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
    severity: pending.severity,
    costDelta: Math.round(randFloat(rng, costMin, costMax)),
    qualityDelta: randFloat(rng, qMin, qMax),
    buzzDelta: randFloat(rng, bMin, bMax),
    delayDaysDelta: Math.max(0, Math.round(randFloat(rng, dMin, dMax))),
  };
}

/**
 * A single 0-100 "how good are they" reading for any talent, regardless of
 * role - their plain skill for Director/Writer/Composer/Editor/VFX
 * Supervisor, or (since actors have no separate skill number, see
 * types/index.ts:ActorTalent) how well their ActingStyle actually suits
 * this script. Used to bias `skillSensitive` event choices toward a better
 * outcome for a stronger hire, worse for a weaker one.
 */
function talentSkillScore(talent: Talent | undefined, script: Script | null): number {
  if (!talent) return 50;
  if ('skill' in talent) return talent.skill;
  return (script && computeTalentCompatibility(talent, script)) ?? 50;
}

/** Picks the specific hired talent an `involvesRole` event is about - a random one, for a multi-hire role. */
function resolveInvolvedTalent(role: ProductionRole, talent: TalentAssignment[], rng: RandomFn): Talent | undefined {
  const hired = filterAssignedTalent(talent, role);
  return hired.length > 0 ? pick(rng, hired) : undefined;
}

function interpolateName(text: string, name: string): string {
  return text.replaceAll('{name}', name);
}

// How far a skillSensitive choice's range shifts at the extremes (skill 0 or
// 100) - half the choice's own range width, so a top talent doesn't turn a
// bad option into a guaranteed great one, just a meaningfully better one.
const SKILL_ADJUST_STRENGTH = 0.5;

function skillShift(range: [number, number], skillScore: number): number {
  return ((skillScore - 50) / 50) * (range[1] - range[0]) * SKILL_ADJUST_STRENGTH;
}

/** Higher skill shifts a quality range up - a better outcome either way, whether the choice is a risk or a fix. */
function adjustQualityForSkill(range: [number, number], skillScore: number): [number, number] {
  const shift = skillShift(range, skillScore);
  return [range[0] + shift, range[1] + shift];
}

/** Higher skill shifts a delay range down (floored at 0) - a stronger hire needs less extra time to sort the same problem out. */
function adjustDelayForSkill(range: [number, number], skillScore: number): [number, number] {
  const shift = skillShift(range, skillScore);
  return [Math.max(0, range[0] - shift), Math.max(0, range[1] - shift)];
}

/** Applies skillSensitive adjustments and {name} interpolation to an involvesRole template's choices, once, at roll time. */
function prepareChoicesForInvolvedTalent(
  choices: EventChoiceTemplate[],
  talentName: string,
  skillScore: number,
): EventChoiceTemplate[] {
  return choices.map((c) => ({
    ...c,
    label: interpolateName(c.label, talentName),
    description: interpolateName(c.description, talentName),
    qualityRange: c.skillSensitive ? adjustQualityForSkill(c.qualityRange, skillScore) : c.qualityRange,
    delayDaysRange: c.skillSensitive ? adjustDelayForSkill(c.delayDaysRange, skillScore) : c.delayDaysRange,
  }));
}

// A recast costs the departing hire's severance plus a rush-hire premium on
// the new person's own rate - replacing someone mid-shoot is genuinely
// expensive, not just "their salary going forward" (which already updates
// on its own once they're swapped into FilmDraft.talent - see
// state/studioReducer.ts:RESOLVE_EVENT_CHOICE).
const SEVERANCE_RATE = 0.4;
const RUSH_HIRE_PREMIUM_RATE = 0.3;
// Recasting a Lead Actor means reshooting anything they're already in;
// swapping in a new Director or crew member doesn't carry that same reshoot
// cost, just ramp-up time.
const REPLACEMENT_DELAY_DAYS: Partial<Record<ProductionRole, [number, number]>> = {
  'Lead Actor': [3, 6],
  'Supporting Actor': [2, 4],
};
const DEFAULT_REPLACEMENT_DELAY: [number, number] = [2, 4];
const REPLACEMENT_CANDIDATE_COUNT = 2;

/**
 * Builds the real "recast with X" choices for an `offersReplacementFor`
 * template - candidates pulled from the studio's actual talent pool, near
 * the departing hire's own salary (engine/talentFilter.ts), each becoming
 * its own selectable choice with that specific person's name and salary and
 * a quality swing based on how their skill compares to who's leaving. Which
 * one the player picks is what determines the cost, same as any other hire.
 */
function buildReplacementChoices(
  role: ProductionRole,
  departing: Talent,
  pool: Talent[],
  script: Script | null,
  rng: RandomFn,
): EventChoiceTemplate[] {
  const { candidates } = findCandidatesNearPrice(
    pool.filter((t) => t.id !== departing.id),
    departing.salary,
    8,
  );
  if (candidates.length === 0) return [];
  const picked = pickMany(rng, candidates, Math.min(REPLACEMENT_CANDIDATE_COUNT, candidates.length));
  const departingSkill = talentSkillScore(departing, script);
  const delayRange = REPLACEMENT_DELAY_DAYS[role] ?? DEFAULT_REPLACEMENT_DELAY;

  return picked.map((candidate) => {
    const candidateSkill = talentSkillScore(candidate, script);
    const qualitySwing = (candidateSkill - departingSkill) / 8; // modest - a recast is a gamble, not a guaranteed upgrade
    const disruptionCost = Math.round(departing.salary * SEVERANCE_RATE + candidate.salary * RUSH_HIRE_PREMIUM_RATE);
    return {
      id: `replace-with:${candidate.id}`,
      label: `Recast with ${candidate.name}`,
      description: `Severance for ${departing.name}, a rush-hire premium, and the disruption of bringing someone new in mid-shoot.`,
      costRange: [disruptionCost, disruptionCost],
      qualityRange: [qualitySwing - 2, qualitySwing + 3],
      buzzRange: [0, 0],
      delayDaysRange: delayRange,
      replacementCandidateId: candidate.id,
      replacementCandidateName: candidate.name,
      replacementCandidateSalary: candidate.salary,
    };
  });
}

const HIGH_RISK_THRESHOLD = 55;
const LOW_RISK_THRESHOLD = 35;

// Raised from an earlier 0.05-0.13: at that rate a real shoot could easily
// run its whole recommended length and see one event, maybe none - too
// sparse to build a felt sense of "things happen on set." Even the calmest
// (avgRisk=0) shoot now averages roughly one event every 8 days; a tense
// one averages closer to one every 4.
const MIN_DAILY_EVENT_CHANCE = 0.12;
const MAX_DAILY_EVENT_CHANCE = 0.27;

/**
 * How likely each severity tier is on a day that produces anything at all -
 * `low` dominates regardless of risk (it's routine set texture), `high`
 * stays genuinely rare even on a tense shoot. Risk shifts the mix toward
 * bigger stakes without ever making `low` uncommon: 70/25/5 at avgRisk=0,
 * 40/35/25 at avgRisk=100. This is the lever that makes "a couple of small
 * interactive events on a good shoot" the normal case rather than a fluke -
 * see docs/DESIGN.md 5.21.
 */
function severityWeights(avgRisk: number): Record<EventSeverity, number> {
  const t = clamp(avgRisk, 0, 100) / 100;
  return {
    low: 70 - 30 * t,
    medium: 25 + 10 * t,
    high: 5 + 20 * t,
  };
}

function pickSeverity(weights: Record<EventSeverity, number>, rng: RandomFn): EventSeverity {
  const total = weights.low + weights.medium + weights.high;
  const roll = rng() * total;
  if (roll < weights.low) return 'low';
  if (roll < weights.low + weights.medium) return 'medium';
  return 'high';
}

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
  talent: TalentAssignment[],
  script: Script | null,
  talentPool: Record<TalentProfession, Talent[]>,
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
  const polarityPool = pool.length > 0 ? pool : fallbackPool;
  if (polarityPool.length === 0) return null; // exhausted every template this shoot

  // Roll severity independently of polarity - "how big a deal" and "good
  // or bad news" are different questions. Falls back to any severity within
  // the same polarity pool if that specific tier happens to be empty (or
  // already exhausted this shoot via usedIds).
  const severity = pickSeverity(severityWeights(avgRisk), rng);
  const severityPool = polarityPool.filter((t) => t.severity === severity);
  const candidates = severityPool.length > 0 ? severityPool : polarityPool;

  const template = candidates[randInt(rng, 0, candidates.length - 1)];
  if (!template.interactive) {
    return { event: rollSimpleEvent(template, rng) };
  }

  const involved = template.involvesRole ? resolveInvolvedTalent(template.involvesRole, talent, rng) : undefined;
  // involvesRole is only ever set on templates about a mandatory role, which
  // is guaranteed hired by the time photography can begin - but if it's
  // ever missing for any reason, skip this template for today rather than
  // show a decision about someone who doesn't exist.
  if (template.involvesRole && !involved) return null;

  const skillScore = involved ? talentSkillScore(involved, script) : 50;
  let choices = involved ? prepareChoicesForInvolvedTalent(template.choices, involved.name, skillScore) : template.choices;
  const situation = involved ? interpolateName(template.situation, involved.name) : template.situation;

  if (template.offersReplacementFor && involved) {
    const replacementPool = talentPool[professionForProductionRole(template.offersReplacementFor)] ?? [];
    choices = [...choices, ...buildReplacementChoices(template.offersReplacementFor, involved, replacementPool, script, rng)];
  }

  return {
    pendingChoice: {
      templateId: template.id,
      situation,
      polarity: template.polarity,
      severity: template.severity,
      choices,
      involvedTalentId: involved?.id,
      involvedTalentName: involved?.name,
      involvedRole: template.involvesRole,
      replacementRole: template.offersReplacementFor,
    },
  };
}
