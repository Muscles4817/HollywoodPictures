import type { FilmDraft, Person, TalentProfession } from '../types';
import { applyPrepRiskDelta, beginPhotographyFromPrep, computePrepRiskDelta, computeStaticProductionRisk, rollDayEvent, rollPreProductionDayEvent } from './production';
import { computePitchExecutionRiskDelta } from './directorPitch';
import { computeDailyPrepBurn, computeDailyShootBurn } from './cost';
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
  // Same starting-risk adjustment the focused shoot gets (studioReducer:ADVANCE_SHOOTING_DAY):
  // prep plus a bold director pitch's execution-risk delta (Phase B3b).
  const prepRiskDelta = computePrepRiskDelta(d.preProduction) + computePitchExecutionRiskDelta(d.selectedDirectorPitch);

  for (let i = 0; i < daysToAdvance; i++) {
    const staticRisk = applyPrepRiskDelta(computeStaticProductionRisk(d.talent, d.script, d.productionChoices, d.genre), prepRiskDelta);
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
  /** Prep overhead accrued this pass, per advanced draft, for the caller to charge to cash and the ledger. */
  charges: PreProductionCharge[];
}

/**
 * Advances every in-progress pre-production (FilmDraft.preProduction) by up to
 * `daysToAdvance` days - the prep mirror of settleProductionsInProgress, and the
 * day-by-day counterpart of state/studioReducer.ts:ADVANCE_PREPRODUCTION_DAY.
 * This is what makes prep progress as a side effect of the calendar advancing
 * (the global ADVANCE_DAY tick) rather than only while the player sits on the
 * Pre-Production screen watching its local ticker - previously a backgrounded (or
 * simply un-watched) prep was frozen until re-focused.
 *
 * A prep hitting an interactive event flips to 'awaiting-choice' and stops
 * advancing until the player resolves it (surfaced on the Dashboard / Inbox),
 * exactly like a backgrounded shoot. A prep that reaches its recommended days
 * finishes and hands off to Principal Photography (beginPhotographyFromPrep).
 * Anything not 'in-progress' ('scheduled' Deferred-Start holds, 'awaiting-choice',
 * 'finished') is left untouched.
 *
 * Prep overhead is charged to cash as it is incurred (like the focused ticker),
 * so it can't touch the studio here (this stays pure) - each advanced draft's
 * accrued cost for this pass is returned in `charges` for the reducer to apply
 * via recordCashChange.
 */
export function settlePreProductionsInProgress(
  productions: FilmDraft[],
  daysToAdvance: number,
  rng: RandomFn,
): PreProductionSettlementResult {
  if (daysToAdvance <= 0) return { drafts: productions, charges: [] };
  const charges: PreProductionCharge[] = [];
  const drafts = productions.map((d) => {
    const { draft, charge } = advancePrepOne(d, daysToAdvance, rng);
    if (charge !== 0) charges.push({ title: d.title || 'Untitled Film', amount: charge });
    return draft;
  });
  return { drafts, charges };
}

function advancePrepOne(d: FilmDraft, daysToAdvance: number, rng: RandomFn): { draft: FilmDraft; charge: number } {
  const prep = d.preProduction;
  if (!prep || prep.status !== 'in-progress' || !d.script) return { draft: d, charge: 0 };

  const dailyBurn = computeDailyPrepBurn(d.script.scale);
  let working = prep;
  let charge = 0;

  for (let i = 0; i < daysToAdvance; i++) {
    const usedIds = new Set(working.events.map((e) => e.id));
    const rolled = rollPreProductionDayEvent(d.talent, d.script, usedIds, rng);

    if (rolled && 'pendingChoice' in rolled) {
      // The situation still consumes its prep day (and its overhead), then pauses.
      working = {
        ...working,
        status: 'awaiting-choice',
        daysElapsed: working.daysElapsed + 1,
        runningCost: working.runningCost + dailyBurn,
        pendingChoice: rolled.pendingChoice,
      };
      charge += dailyBurn;
      break; // paused - the rest of daysToAdvance is left unconsumed for this prep
    }

    const event = rolled?.event ?? null;
    const daysAdvanced = 1 + (event?.delayDaysDelta ?? 0);
    const prepCost = dailyBurn * daysAdvanced + (event?.costDelta ?? 0);
    working = {
      ...working,
      daysElapsed: working.daysElapsed + daysAdvanced,
      events: event ? [...working.events, event] : working.events,
      runningCost: working.runningCost + prepCost,
    };
    charge += prepCost;

    if (working.daysElapsed >= working.recommendedDays) {
      // Prep is over - open Principal Photography, same handoff the focused ticker makes.
      return { draft: beginPhotographyFromPrep({ ...d, preProduction: { ...working, status: 'finished' as const } }), charge };
    }
  }

  return { draft: { ...d, preProduction: working }, charge };
}
