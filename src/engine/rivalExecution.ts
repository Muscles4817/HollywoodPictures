// Rival Production Execution (Phase 2, docs/DESIGN_REVIEW_production_execution.md).
//
// A rival's shoot isn't lived day by day the way the player's is - but its
// finished film must still be shaped by how production actually went, through
// the *exact same* execution pipeline. This resolver synthesizes a plausible
// production HISTORY (a list of the same typed on-set events the player's shoot
// produces) from the rival's risk profile and plan, then hands it back to be
// scored by computeReleaseResults / computeExecutionProfile like any other film.
//
// The guiding principle (SIMULATION_PHILOSOPHY.md): the player and the AI differ
// only in HOW the production history is generated, never in how the finished
// film is evaluated. So this file generates history; it never computes quality.
import type { Genre, PendingEventChoice, PreProductionState, ProductionChoices, ProductionEvent, Person, Script, TalentAssignment, TalentProfession } from '../types';
import {
  applyPrepRiskDelta,
  averageProductionRisk,
  computePrepRiskDelta,
  computeRecommendedPreProductionDays,
  computeRecommendedShootDays,
  computeShootEscalation,
  computeStaticProductionRisk,
  dailyEventChance,
  pickShootEvent,
  prepQualityEvents,
  resolveEventChoice,
  rollPreProductionDayEvent,
  type FullProductionRisk,
} from './production';
import { computeExecutionResilience } from './productionExecution';
import { clamp, createRng, hashUnit, pick, randFloat, type RandomFn } from './random';

// A rival's shoot has no live schedule readout, so it uses one representative
// schedule-pressure value in place of the player's day-by-day figure. The
// player's own schedule pressure starts near 100 (nothing shot yet) and decays
// to ~30 by wrap, averaging ~75 over the shoot - and events fire more often
// early, when it's highest, so the *experienced* average is higher still. This
// value is calibrated (against productionExecution.diagnostic.test.ts's
// player-vs-rival parity block) so a rival's event count and execution-rating
// distribution match the player's lived shoot for equivalent plans.
const RIVAL_SCHEDULE_PRESSURE = 72;

// Empty pool: a rival resolves an interactive event from its base choices, so
// it never needs the world talent pool to build mid-shoot recast options.
const NO_REPLACEMENTS = {} as Record<TalentProfession, Person[]>;

// How wide the synthesized event count varies around its expectation - the
// player's own count varies run to run with the daily rolls; this reproduces
// that spread without simulating each day.
const COUNT_JITTER = 0.35;
// A troubled shoot doesn't just skew negative, it produces MORE incident
// (escalation raises the daily chance in the player's model too). Rather than
// re-simulate, we add a small negative-leaning event budget scaled by the
// resilience-dampened escalation the history ends up carrying.
const MAX_ESCALATION_BONUS_EVENTS = 4;

/** Just the production inputs execution needs - satisfied by RivalProductionInProgress and by any player draft, so the resolver can be exercised against equivalent plans in diagnostics. */
export interface RivalExecutionInput {
  talent: TalentAssignment[];
  script: Script;
  productionChoices: ProductionChoices;
  genre: Genre;
  /** The release day, when known (a RivalProductionInProgress carries it) - with the title, it seeds the pre-production's own generator. Absent reads as 0. */
  releaseDay?: number;
}

/** How often a rival takes the option a competent producer would (docs/IMPLEMENTATION_PLAN_market_realism.md Phase 2). Otherwise it takes any option at random, the best included. */
export const RIVAL_SENSIBLE_CHOICE = 0.7;

const midpoint = ([lo, hi]: [number, number]) => (lo + hi) / 2;

/**
 * The option with the best expected quality (midpoint of qualityRange), ties
 * to the lower expected cost; taken RIVAL_SENSIBLE_CHOICE of the time,
 * otherwise any option at random. Returns the option's id.
 */
export function chooseRivalOption(choices: PendingEventChoice['choices'], rng: RandomFn): string {
  const best = [...choices].sort(
    (a, b) => midpoint(b.qualityRange) - midpoint(a.qualityRange) || midpoint(a.costRange) - midpoint(b.costRange),
  )[0];
  if (rng() < RIVAL_SENSIBLE_CHOICE) return best.id;
  return pick(rng, choices).id;
}

export interface RivalPrepResult {
  /** Every event the prep produced, decisions resolved. */
  events: ProductionEvent[];
  /** The shoot's starting-risk adjustment, summed and clamped exactly as a player's prep (engine/production.ts:computePrepRiskDelta). */
  riskDelta: number;
}

/**
 * The pre-production a rival's film went through: the same daily rolls a
 * player's prep makes (engine/production.ts:rollPreProductionDayEvent), over
 * the same recommended number of days, with each decision answered as a
 * competent studio would (chooseRivalOption). Deterministic given `rng`.
 */
export function synthesizeRivalPrep(production: RivalExecutionInput, rng: RandomFn): RivalPrepResult {
  const { talent, script, productionChoices } = production;
  const days = computeRecommendedPreProductionDays(talent, script, productionChoices);
  const events: ProductionEvent[] = [];
  const usedIds = new Set<string>();
  for (let day = 0; day < days; day++) {
    const rolled = rollPreProductionDayEvent(talent, script, usedIds, rng);
    if (!rolled) continue;
    const event = 'event' in rolled ? rolled.event : resolveEventChoice(rolled.pendingChoice, chooseRivalOption(rolled.pendingChoice.choices, rng), rng);
    events.push(event);
    usedIds.add(event.id);
  }
  return { events, riskDelta: computePrepRiskDelta(finishedPrep(events, days)) };
}

/** A finished prep holding these events - the shape the player's prep readers take. */
function finishedPrep(events: ProductionEvent[], days: number): PreProductionState {
  return { status: 'finished', recommendedDays: days, daysElapsed: days, events, runningCost: 0, pendingChoice: null };
}

/**
 * The prep's own generator, seeded from the production itself (title and
 * release day), so synthesizing a prep never draws from - and never shifts -
 * the shared stream the shoot and the rest of the market roll from.
 */
export function rivalPrepRng(production: RivalExecutionInput): RandomFn {
  return createRng(Math.floor(hashUnit(`${production.script.title}|${production.releaseDay ?? 0}`) * 2 ** 31) + 1);
}

export interface RivalExecutionResult {
  /** The synthesized, typed history: the prep's quality-carrying events (cost, buzz and delay zeroed, as a player's are at release), then the shoot's - stored on the rival Film and fed straight into computeExecutionProfile, exactly like the player's. - stored on the rival Film and fed straight into computeExecutionProfile, exactly like the player's PhotographyState.events. */
  events: ProductionEvent[];
  /** daysElapsed / recommendedDays implied by the synthesized shoot (base planning variance + delays from events) - the same coverage signal the player's real shoot produces. */
  shootingRatio: number;
}

/**
 * Synthesize a rival production's execution history. Deterministic given the
 * rng. Reuses the player's own event pools, escalation, and resilience - it
 * simply compresses "months of shooting" into the events a comparable player
 * shoot might plausibly have produced.
 */
export function resolveRivalExecution(production: RivalExecutionInput, rng: RandomFn): RivalExecutionResult {
  const { talent, script, productionChoices, genre } = production;
  // A rival's shoot is preceded by a pre-production from the player's own prep
  // table; how it went moves the shoot's starting risk and joins the history.
  const prep = synthesizeRivalPrep(production, rivalPrepRng(production));
  const staticRisk = applyPrepRiskDelta(computeStaticProductionRisk(talent, script, productionChoices, genre), prep.riskDelta);
  const recommendedDays = computeRecommendedShootDays(talent, script, productionChoices);
  const resilience = computeExecutionResilience(talent, productionChoices);

  const fullRisk: FullProductionRisk = { schedulePressure: RIVAL_SCHEDULE_PRESSURE, ...staticRisk };
  const baseAvgRisk = averageProductionRisk(fullRisk);

  // Expected notable events ≈ the player's per-day odds integrated over the
  // shoot, then jittered so no two comparable shoots produce an identical count.
  const expected = recommendedDays * dailyEventChance(baseAvgRisk);
  const baseCount = Math.max(0, Math.round(expected * randFloat(rng, 1 - COUNT_JITTER, 1 + COUNT_JITTER)));

  const events: ProductionEvent[] = [];
  const usedIds = new Set<string>();
  let extraDays = 0;

  const rollOne = (): boolean => {
    const escalation = computeShootEscalation(events, resilience);
    const avgRisk = averageProductionRisk(fullRisk, escalation);
    const rolled = pickShootEvent(fullRisk, avgRisk, genre, usedIds, talent, script, NO_REPLACEMENTS, rng);
    if (!rolled) return false; // this pick came up empty (a transient pool/involvement miss)
    if ('event' in rolled) {
      events.push(rolled.event);
      usedIds.add(rolled.event.id);
      extraDays += rolled.event.delayDaysDelta;
    } else {
      // No player to decide - the rival "handles it" by picking one of the base
      // choices. resolveEventChoice rolls that choice's own outcome, so an
      // interactive setback still lands typed and causal.
      const choice = pick(rng, rolled.pendingChoice.choices);
      const resolved = resolveEventChoice(rolled.pendingChoice, choice.id, rng);
      events.push(resolved);
      usedIds.add(resolved.id);
      extraDays += resolved.delayDaysDelta;
    }
    return true;
  };

  // Draw events until we hit the target count. A single pick can come up empty
  // (a specific polarity/severity slice momentarily exhausted, or an
  // involvesRole template whose talent slot didn't resolve); retry rather than
  // stop, capped so a genuinely exhausted bank can't spin forever.
  const drawUntil = (target: number) => {
    let attempts = 0;
    const cap = target * 4 + 20;
    while (events.length < target && attempts < cap) {
      attempts += 1;
      rollOne();
    }
  };

  drawUntil(baseCount);

  // Failure begets failure: if the history it built carries real escalation, a
  // few more (now negatively-skewed) incidents pile on - bounded, and dampened
  // by resilience, exactly like the player's chains.
  const finalEscalation = computeShootEscalation(events, resilience);
  const bonusEvents = Math.round((finalEscalation / 22) * MAX_ESCALATION_BONUS_EVENTS);
  drawUntil(baseCount + bonusEvents);

  const planningVariance = randFloat(rng, 0.9, 1.08);
  const shootingRatio = clamp((recommendedDays * planningVariance + extraDays) / recommendedDays, 0.5, 2);

  const prepEvents = prepQualityEvents(finishedPrep(prep.events, prep.events.length));
  return { events: [...prepEvents, ...events], shootingRatio };
}
