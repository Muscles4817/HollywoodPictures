// One prep, day by day (docs/IMPLEMENTATION_PLAN_preproduction_realism.md
// Phase 4): set up at greenlight, advanced a day at a time - the focused
// player's screen, the background tick and a rival's headless run all call the
// same functions - pausing at a checkpoint for the player unless the film's
// production team has been handed the prep.
import type { PreProductionState, PrepPlan, ProductionTeam, StaticProductionRisk } from '../../types';
import {
  PREP_ACTIVITIES,
  PREP_ACTIVITY_BURN,
  PREP_ACTIVITY_DEFAULT_DEMAND,
  PREP_ACTIVITY_DROP_STEP,
  PREP_ACTIVITY_FRONTS,
  PREP_CHECKPOINTS,
  PREP_RISK,
  PREP_SACRIFICE_ORDER,
  PREP_SOLVED_SEVERITY,
  type PrepActivity,
  type PrepFixKind,
  type PrepFront,
} from '../../data/prep';
import type { FrontDemand } from './demands';
import type { PrepContext } from './context';
import { generatePrepProblems } from './problems';
import { discoverOnDay } from './discovery';
import { applyFix, checkpointDaysFor, checkpointShare, checkpointTitle, fixOptions, openProblems } from './checkpoints';
import { decideProblem, type Decider } from './delegation';
import { clamp } from '../random';

/** Revealing work defaults on where its front is at least moderately live. */
export function defaultActivities(demands: FrontDemand[]): Record<PrepActivity, boolean> {
  const demandOf = new Map(demands.map((d) => [d.front, d.demand]));
  return Object.fromEntries(
    PREP_ACTIVITIES.map((a) => [a, PREP_ACTIVITY_FRONTS[a].some((f) => (demandOf.get(f) ?? 0) >= PREP_ACTIVITY_DEFAULT_DEMAND)]),
  ) as Record<PrepActivity, boolean>;
}

/** What a prep this much shorter than recommended has no time for, in the reference's sacrifice order (04 §16). */
export function activitiesDropped(lengthFactor: number): PrepActivity[] {
  const n = Math.max(0, Math.round((1 - lengthFactor) / PREP_ACTIVITY_DROP_STEP));
  return PREP_SACRIFICE_ORDER.slice(0, n);
}

/** The activities a prep actually does: those chosen, less what its length cannot fit. */
export function effectiveActivities(chosen: Record<PrepActivity, boolean>, lengthFactor: number): Record<PrepActivity, boolean> {
  const dropped = new Set(activitiesDropped(lengthFactor));
  return Object.fromEntries(PREP_ACTIVITIES.map((a) => [a, chosen[a] && !dropped.has(a)])) as Record<PrepActivity, boolean>;
}

/** The day's prep burn with this work running. */
export function prepDailyBurnWith(baseBurn: number, activities: Record<PrepActivity, boolean>): number {
  return Math.round(baseBurn * (1 + PREP_ACTIVITIES.reduce((s, a) => s + (activities[a] ? PREP_ACTIVITY_BURN[a] : 0), 0)));
}

export interface PrepStartInput {
  demands: FrontDemand[];
  plan: PrepPlan | undefined;
  /** Prep length, the plan's length factor already applied. */
  prepDays: number;
  seed: number;
  team: ProductionTeam | null;
  status: 'scheduled' | 'in-progress';
  difficultLead: boolean;
}

export function createPreProduction(input: PrepStartInput): PreProductionState {
  const lengthFactor = input.plan?.lengthFactor ?? 1;
  const chosen = input.plan?.activities ?? defaultActivities(input.demands);
  return {
    status: input.status,
    recommendedDays: input.prepDays,
    daysElapsed: 0,
    events: [],
    runningCost: 0,
    pendingChoice: null,
    team: input.team,
    problems: generatePrepProblems({ demands: input.demands, lengthFactor, difficultLead: input.difficultLead }, input.seed),
    seed: input.seed,
    checkpointDays: checkpointDaysFor(input.prepDays),
    nextCheckpoint: 0,
    pendingCheckpoint: null,
    delegated: input.plan?.delegated ?? true,
    activities: effectiveActivities(chosen, lengthFactor),
    lengthFactor,
    log: [],
    daysAdded: 0,
    fixSpend: 0,
  };
}

export interface PrepStepResult {
  prep: PreProductionState;
  /** Cash spent this step (burn and fixes). */
  cash: number;
  /** Contingency drawn this step. */
  contingency: number;
}

/** Resolves every checkpoint now due: the team decides delegated ones; otherwise prep pauses at the first with anything on the table. */
function settleDueCheckpoints(prep: PreProductionState, ctx: PrepContext, decider: Decider): PrepStepResult {
  let working = prep;
  let cash = 0;
  let contingency = 0;
  while (working.status === 'in-progress' && working.nextCheckpoint < PREP_CHECKPOINTS.length && working.daysElapsed >= working.checkpointDays[working.nextCheckpoint]) {
    const index = working.nextCheckpoint;
    const open = openProblems(working);
    if (open.length > 0 && !working.delegated) {
      return { prep: { ...working, status: 'awaiting-checkpoint', pendingCheckpoint: { index, problemIds: open.map((p) => p.id) } }, cash, contingency };
    }
    const day = working.daysElapsed;
    if (open.length > 0) working = { ...working, log: [...working.log, { day, kind: 'checkpoint', text: `${checkpointTitle(index)}: what your production team decided.` }] };
    for (const p of open) {
      const live = { ...ctx, contingencyAvailable: ctx.contingencyAvailable - contingency };
      const fix = decideProblem(p, live, checkpointShare(index), decider);
      const applied = applyFix(working, p.id, fix, day, 'team');
      working = applied.prep;
      cash += applied.cash;
      contingency += applied.contingency;
    }
    working = { ...working, nextCheckpoint: index + 1 };
  }
  return { prep: working, cash, contingency };
}

function finishIfDone(prep: PreProductionState): PreProductionState {
  return prep.status === 'in-progress' && prep.daysElapsed >= prep.recommendedDays ? { ...prep, status: 'finished' } : prep;
}

/** One prep day: the day's burn, what is found today, and any checkpoint it reaches. */
export function advancePrepDay(prep: PreProductionState, ctx: PrepContext, decider: Decider): PrepStepResult {
  if (prep.status !== 'in-progress') return { prep, cash: 0, contingency: 0 };
  const day = prep.daysElapsed + 1;
  const burn = prepDailyBurnWith(ctx.dailyPrepBurn, prep.activities);
  const found = discoverOnDay(prep, ctx, day);
  const stepped: PreProductionState = { ...found, daysElapsed: day, runningCost: found.runningCost + burn };
  const settled = settleDueCheckpoints(stepped, ctx, decider);
  return { prep: finishIfDone(settled.prep), cash: burn + settled.cash, contingency: settled.contingency };
}

/** The player's answers at a paused checkpoint; anything unanswered is carried. Resumes prep. */
export function resolvePrepCheckpoint(
  prep: PreProductionState,
  choices: Record<string, PrepFixKind>,
  ctx: PrepContext,
  decider: Decider,
  by: 'player' | 'team' = 'player',
): PrepStepResult {
  const pending = prep.pendingCheckpoint;
  if (prep.status !== 'awaiting-checkpoint' || !pending) return { prep, cash: 0, contingency: 0 };
  let working = prep;
  let cash = 0;
  let contingency = 0;
  const day = prep.daysElapsed;
  working = { ...working, log: [...working.log, { day, kind: 'checkpoint', text: `${checkpointTitle(pending.index)}: ${by === 'team' ? 'what your production team decided' : 'your decisions'}.` }] };
  for (const id of pending.problemIds) {
    const problem = working.problems.find((p) => p.id === id);
    if (!problem || problem.resolution) continue;
    const live = { ...ctx, contingencyAvailable: ctx.contingencyAvailable - contingency };
    const options = fixOptions(problem, live, checkpointShare(pending.index));
    const fix = options.find((o) => o.kind === choices[id]) ?? options[options.length - 1];
    const applied = applyFix(working, id, fix, day, by);
    working = applied.prep;
    cash += applied.cash;
    contingency += applied.contingency;
  }
  working = { ...working, status: 'in-progress', pendingCheckpoint: null, nextCheckpoint: pending.index + 1 };
  const settled = settleDueCheckpoints(working, { ...ctx, contingencyAvailable: ctx.contingencyAvailable - contingency }, decider);
  return { prep: finishIfDone(settled.prep), cash: cash + settled.cash, contingency: contingency + settled.contingency };
}

/** Runs a whole prep headless, start to finish, every checkpoint decided by `decider` (rivals; the bot's delegated films). */
export function runPrepHeadless(prep: PreProductionState, ctx: PrepContext, decider: Decider): PrepStepResult {
  let working: PreProductionState = { ...prep, status: 'in-progress', delegated: true };
  let cash = 0;
  let contingency = 0;
  // Bounded: fixes can add days, but not without end.
  for (let guard = 0; working.status === 'in-progress' && guard < 2000; guard++) {
    const step = advancePrepDay(working, { ...ctx, contingencyAvailable: ctx.contingencyAvailable - contingency }, decider);
    working = step.prep;
    cash += step.cash;
    contingency += step.contingency;
  }
  return { prep: working, cash, contingency };
}

// --- Prep's effect on the shoot's starting risk -------------------------------

const FRONT_RISK: Record<PrepFront, keyof StaticProductionRisk> = {
  breakdown: 'budgetRisk',
  design: 'technicalComplexity',
  costume: 'technicalComplexity',
  locations: 'budgetRisk',
  casting: 'moraleRisk',
  action: 'safetyRisk',
  effects: 'technicalComplexity',
  visual: 'moraleRisk',
};
const ACTIVITY_RISK: Record<PrepActivity, keyof StaticProductionRisk> = {
  scouting: 'budgetRisk',
  tests: 'technicalComplexity',
  rehearsal: 'moraleRisk',
  previs: 'safetyRisk',
};

/**
 * Per-dimension starting-risk deltas from a prep: what it left standing raises
 * its own dimension (an unrehearsed action sequence is a safety risk, a split
 * vision a morale one); the revealing work done lowers its own. Bounded.
 */
export function prepRiskAdjustments(prep: PreProductionState | null | undefined): StaticProductionRisk {
  const out: StaticProductionRisk = { moraleRisk: 0, safetyRisk: 0, technicalComplexity: 0, budgetRisk: 0 };
  if (!prep?.problems) return out;
  for (const p of prep.problems) if (p.severity > PREP_SOLVED_SEVERITY) out[FRONT_RISK[p.front]] += PREP_RISK.carriedPerSeverity * p.severity;
  for (const a of PREP_ACTIVITIES) if (prep.activities[a]) out[ACTIVITY_RISK[a]] -= PREP_RISK.activityRelief;
  for (const k of Object.keys(out) as Array<keyof StaticProductionRisk>) out[k] = clamp(out[k], -PREP_RISK.maxSwing, PREP_RISK.maxSwing);
  return out;
}

export function applyPrepRiskAdjustments(risk: StaticProductionRisk, adj: StaticProductionRisk): StaticProductionRisk {
  const f = (k: keyof StaticProductionRisk) => clamp(Math.round(risk[k] + adj[k]), 0, 100);
  return { moraleRisk: f('moraleRisk'), safetyRisk: f('safetyRisk'), technicalComplexity: f('technicalComplexity'), budgetRisk: f('budgetRisk') };
}

