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
import type { Genre, ProductionChoices, ProductionEvent, Person, Script, TalentAssignment, TalentProfession } from '../types';
import {
  averageProductionRisk,
  computeRecommendedShootDays,
  computeShootEscalation,
  computeStaticProductionRisk,
  dailyEventChance,
  pickShootEvent,
  resolveEventChoice,
  type FullProductionRisk,
} from './production';
import { computeExecutionResilience } from './productionExecution';
import { clamp, pick, randFloat, type RandomFn } from './random';

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
}

export interface RivalExecutionResult {
  /** The synthesized, typed on-set history - stored on the rival Film and fed straight into computeExecutionProfile, exactly like the player's PhotographyState.events. */
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
  const staticRisk = computeStaticProductionRisk(talent, script, productionChoices, genre);
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

  return { events, shootingRatio };
}
