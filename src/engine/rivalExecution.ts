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
import type { Genre, PreProductionState, ProductionChoices, ProductionEvent, Person, Script, TalentAssignment, TalentProfession } from '../types';
import {
  averageProductionRisk,
  computeRecommendedPreProductionDays,
  computeRecommendedShootDays,
  computeShootEscalation,
  computeStaticProductionRisk,
  dailyEventChance,
  pickShootEvent,
  prepQualityEvents,
  resolveEventChoice,
  type FullProductionRisk,
} from './production';
import { buildPrepContext } from './prep/context';
import { derivePrepDemands } from './prep/demands';
import { applyPrepRiskAdjustments, createPreProduction, prepRiskAdjustments, runPrepHeadless } from './prep/run';
import { carriedIncidentsFor, incidentEvent } from './prep/handoff';
import { computeDailyPrepBurn, computeDailyShootBurn } from './cost';
import { deriveTraits } from './personTraits';
import { NO_PRODUCTION_TEAM_SKILL } from '../data/productionTeams';
import { computeExecutionResilience } from './productionExecution';
import { clamp, createRng, forkSeed, pick, randFloat, type RandomFn } from './random';

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

export interface RivalPrepResult {
  /** The finished prep: its problems, what was found and done about each, its cuts. */
  prep: PreProductionState;
  /** Money its fixes and burn cost (reported; a rival's cash is settled elsewhere). */
  spend: number;
}

/** A rival's studio office runs its prep until Phase 6 gives rivals production teams. */
const RIVAL_PREP_CASH_PRESSURE = 0.3;

/**
 * The pre-production a rival's film went through: the same engine as a
 * player's (engine/prep/run.ts), run headless over the film's recommended prep -
 * the same problems from the same demands, found by the same people, each
 * checkpoint decided by the same rule a delegated player film uses
 * (engine/prep/delegation.ts). Deterministic given `rng` (one draw seeds it).
 */
export function synthesizeRivalPrep(production: RivalExecutionInput, rng: RandomFn): RivalPrepResult {
  const { talent, script, productionChoices, genre } = production;
  const seed = forkSeed(rng);
  const prepDays = computeRecommendedPreProductionDays(talent, script, productionChoices);
  const shootDays = computeRecommendedShootDays(talent, script, productionChoices);
  const dailyShootBurn = computeDailyShootBurn(productionChoices.shootingBudgetAmount, shootDays);
  const ctx = buildPrepContext({
    talent,
    genre,
    team: null,
    dailyShootBurn,
    dailyPrepBurn: computeDailyPrepBurn(dailyShootBurn),
    shootDays,
    contingencyAvailable: productionChoices.contingencyReserveAmount ?? 0,
    cashPressure: RIVAL_PREP_CASH_PRESSURE,
    // A rival has announced its date before it shoots.
    datedRelease: true,
  });
  const start = createPreProduction({
    demands: derivePrepDemands({ script, talent, choices: productionChoices }),
    plan: undefined,
    prepDays,
    seed,
    team: null,
    status: 'in-progress',
    difficultLead: talent.some((a) => a.role === 'Lead Actor' && deriveTraits(a.person).includes('DifficultToWorkWith')),
  });
  const run = runPrepHeadless(start, ctx, { skill: NO_PRODUCTION_TEAM_SKILL, seed });
  return { prep: run.prep, spend: run.cash + run.contingency };
}

/**
 * The prep's own generator: ONE draw from the shared stream seeds it
 * (random.ts:forkSeed), so however many rolls the prep takes, the shoot that
 * follows is insulated from them. The plan first seeded it from the
 * production alone (title and release day) to leave the shared stream
 * untouched; that made the same plan's prep identical however many times it
 * was executed, which a player's prep is not, and collapsed the variance
 * gate's spread (docs/DESIGN_REVIEW_market_realism.md §7.2).
 */
export function rivalPrepRng(rng: RandomFn): RandomFn {
  return createRng(forkSeed(rng));
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
  const { prep } = synthesizeRivalPrep(production, rivalPrepRng(rng));
  const staticRisk = applyPrepRiskAdjustments(computeStaticProductionRisk(talent, script, productionChoices, genre), prepRiskAdjustments(prep));
  const recommendedDays = computeRecommendedShootDays(talent, script, productionChoices);
  // What prep left standing happens on the shoot, as it does on a player's
  // (engine/prep/handoff.ts) - recorded first, its lost days counted.
  const dailyShootBurn = computeDailyShootBurn(productionChoices.shootingBudgetAmount, recommendedDays);
  const incidents = carriedIncidentsFor(prep, recommendedDays).map((i) => incidentEvent(i, dailyShootBurn));
  const resilience = computeExecutionResilience(talent, productionChoices);

  const fullRisk: FullProductionRisk = { schedulePressure: RIVAL_SCHEDULE_PRESSURE, ...staticRisk };
  const baseAvgRisk = averageProductionRisk(fullRisk);

  // Expected notable events ≈ the player's per-day odds integrated over the
  // shoot, then jittered so no two comparable shoots produce an identical count.
  const expected = recommendedDays * dailyEventChance(baseAvgRisk);
  // A player's shoot makes no roll of its own on a day a carried incident fires
  // (engine/prep/handoff.ts:fireCarriedIncidents), so those days' random events
  // come off the count - the incidents replace them rather than adding to them.
  const incidentDays = new Set(carriedIncidentsFor(prep, recommendedDays).map((i) => i.day)).size;
  const displaced = incidentDays * dailyEventChance(baseAvgRisk);
  const baseCount = Math.max(0, Math.round((expected - displaced) * randFloat(rng, 1 - COUNT_JITTER, 1 + COUNT_JITTER)));

  const events: ProductionEvent[] = [...incidents];
  const usedIds = new Set<string>(incidents.map((e) => e.id));
  let extraDays = incidents.reduce((sum, e) => sum + e.delayDaysDelta, 0);

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

  drawUntil(incidents.length + baseCount);

  // Failure begets failure: if the history it built carries real escalation, a
  // few more (now negatively-skewed) incidents pile on - bounded, and dampened
  // by resilience, exactly like the player's chains.
  const finalEscalation = computeShootEscalation(events, resilience);
  const bonusEvents = Math.round((finalEscalation / 22) * MAX_ESCALATION_BONUS_EVENTS);
  drawUntil(incidents.length + baseCount + bonusEvents);

  const planningVariance = randFloat(rng, 0.9, 1.08);
  const shootingRatio = clamp((recommendedDays * planningVariance + extraDays) / recommendedDays, 0.5, 2);

  const prepEvents = prepQualityEvents(prep);
  return { events: [...prepEvents, ...events], shootingRatio };
}
