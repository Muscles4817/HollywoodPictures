import type { FilmDraft, Person, TalentProfession } from '../types';
import { beginPhotographyFromPrep, rollDayEvent, shootStartingRisk } from './production';
import { advancePrepDay } from './prep/run';
import { fireCarriedIncidents } from './prep/handoff';
import type { PrepContext } from './prep/context';
import type { Decider } from './prep/delegation';
import { computeDailyShootBurn } from './cost';
import type { RandomFn } from './random';

/**
 * Advances every backgrounded production (Studio.productionsInProgress) by
 * up to `daysToAdvance` days - the same one-day-at-a-time event roll
 * state/studioReducer.ts:ADVANCE_SHOOTING_DAY already does for the live
 * draft, just looped and applied to a list instead of a single record.
 * Called from every reducer case that can advance GameState.totalDays
 * (docs/DESIGN.md 5.x), the same call sites engine/boxOfficeRun.ts:
 * settleBoxOfficeForAllFilms and engine/rivalStudios.ts:settleRivalMarket
 * already use - a shoot progresses as a side effect of the calendar
 * advancing, not a dedicated ticking screen.
 *
 * A production hitting an interactive event flips to 'awaiting-choice' and
 * stops advancing for the rest of this call (and every subsequent one)
 * until RESOLVE_EVENT_CHOICE targets it - it simply falls behind the
 * calendar rather than trying to catch up once resolved. Anything already
 * 'awaiting-choice' or 'finished' is left untouched.
 */
export function settleProductionsInProgress(
  productions: FilmDraft[],
  daysToAdvance: number,
  talentPool: Record<TalentProfession, Person[]>,
  rng: RandomFn,
): FilmDraft[] {
  if (daysToAdvance <= 0) return productions;
  return productions.map((d) => advanceOne(d, daysToAdvance, talentPool, rng));
}

function advanceOne(d: FilmDraft, daysToAdvance: number, talentPool: Record<TalentProfession, Person[]>, rng: RandomFn): FilmDraft {
  if (!d.photography || d.photography.status !== 'in-progress' || !d.script || !d.productionChoices || !d.genre) {
    return d;
  }

  let photography = d.photography;
  const dailyBurn = computeDailyShootBurn(d.productionChoices.shootingBudgetAmount, photography.recommendedDays);
  // Same starting risk the focused shoot gets (studioReducer:ADVANCE_SHOOTING_DAY):
  // what prep left standing, plus a bold director pitch's execution-risk delta (Phase B3b).
  const staticRisk = shootStartingRisk(d);

  for (let i = 0; i < daysToAdvance; i++) {
    // A problem prep carried, due today, is today's event (engine/prep/handoff.ts).
    const fired = fireCarriedIncidents(photography, dailyBurn);
    if (fired) {
      photography = fired;
      continue;
    }
    const usedIds = new Set(photography.events.map((e) => e.id));
    const rolled = rollDayEvent(
      staticRisk,
      photography.daysElapsed + 1,
      photography.recommendedDays,
      d.genre,
      usedIds,
      d.talent,
      d.script,
      talentPool,
      rng,
    );

    if (rolled && 'pendingChoice' in rolled) {
      photography = {
        ...photography,
        status: 'awaiting-choice',
        daysElapsed: photography.daysElapsed + 1,
        runningCost: photography.runningCost + dailyBurn,
        pendingChoice: rolled.pendingChoice,
      };
      break; // paused - the rest of daysToAdvance is left unconsumed for this production
    }

    const event = rolled?.event ?? null;
    const daysAdvanced = 1 + (event?.delayDaysDelta ?? 0);
    photography = {
      ...photography,
      daysElapsed: photography.daysElapsed + daysAdvanced,
      events: event ? [...photography.events, event] : photography.events,
      runningCost: photography.runningCost + dailyBurn * daysAdvanced,
    };
  }

  return { ...d, photography };
}

/** One prep overhead charge to fold into studio cash - the backgrounded mirror of the recordCashChange the focused ADVANCE_PREPRODUCTION_DAY makes each prep day. */
export interface PreProductionCharge {
  title: string;
  amount: number;
}

export interface PreProductionSettlementResult {
  drafts: FilmDraft[];
  /** Prep spend accrued this pass (burn and fixes), per advanced draft, for the caller to charge to cash and the ledger. */
  charges: PreProductionCharge[];
}

/** What a prep needs to run a draft's day: its context and who decides delegated checkpoints (engine/prep/context.ts:prepRunFor). */
export type PrepRunLookup = (draft: FilmDraft) => { ctx: PrepContext; decider: Decider } | null;

/**
 * Advances every in-progress pre-production (FilmDraft.preProduction) by up to
 * `daysToAdvance` days - the same day the focused screen runs
 * (engine/prep/run.ts:advancePrepDay), so prep progresses as a side effect of
 * the calendar rather than only while the player watches it.
 *
 * A prep reaching a checkpoint the player must answer flips to
 * 'awaiting-checkpoint' and stops (surfaced in the Inbox); a delegated one is
 * decided by the film's production team and carries on. A prep that reaches
 * its length hands off to Principal Photography (beginPhotographyFromPrep).
 * Anything not 'in-progress' is left untouched.
 *
 * Prep spend is returned in `charges` for the reducer to apply - this stays pure.
 * Prep's rolls are hashes of the film's own seed, so nothing here draws from a
 * shared stream.
 */
export function settlePreProductionsInProgress(productions: FilmDraft[], daysToAdvance: number, runFor: PrepRunLookup): PreProductionSettlementResult {
  if (daysToAdvance <= 0) return { drafts: productions, charges: [] };
  const charges: PreProductionCharge[] = [];
  const drafts = productions.map((d) => {
    const { draft, charge } = advancePrepOne(d, daysToAdvance, runFor);
    if (charge !== 0) charges.push({ title: d.title || 'Untitled Film', amount: charge });
    return draft;
  });
  return { drafts, charges };
}

function advancePrepOne(d: FilmDraft, daysToAdvance: number, runFor: PrepRunLookup): { draft: FilmDraft; charge: number } {
  const prep = d.preProduction;
  if (!prep || prep.status !== 'in-progress' || !d.script) return { draft: d, charge: 0 };
  const run = runFor(d);
  if (!run) return { draft: d, charge: 0 };
  let working = prep;
  let charge = 0;
  let contingency = 0;
  for (let i = 0; i < daysToAdvance && working.status === 'in-progress'; i++) {
    const step = advancePrepDay(working, { ...run.ctx, contingencyAvailable: run.ctx.contingencyAvailable - contingency }, run.decider);
    working = step.prep;
    charge += step.cash;
    contingency += step.contingency;
  }
  if (working.status === 'finished') return { draft: beginPhotographyFromPrep({ ...d, preProduction: working }), charge };
  return { draft: { ...d, preProduction: working }, charge };
}
