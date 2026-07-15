import type { FilmDraft, Talent, TalentProfession } from '../types';
import { computeStaticProductionRisk, rollDayEvent } from './production';
import { computeDailyContingencyBurn } from './cost';
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
  talentPool: Record<TalentProfession, Talent[]>,
  rng: RandomFn,
): FilmDraft[] {
  if (daysToAdvance <= 0) return productions;
  return productions.map((d) => advanceOne(d, daysToAdvance, talentPool, rng));
}

function advanceOne(d: FilmDraft, daysToAdvance: number, talentPool: Record<TalentProfession, Talent[]>, rng: RandomFn): FilmDraft {
  if (!d.photography || d.photography.status !== 'in-progress' || !d.script || !d.productionChoices || !d.genre) {
    return d;
  }

  let photography = d.photography;
  const dailyBurn = computeDailyContingencyBurn(d.productionChoices.contingencyAmount, photography.recommendedDays);

  for (let i = 0; i < daysToAdvance; i++) {
    const staticRisk = computeStaticProductionRisk(d.talent, d.script, d.productionChoices, d.genre);
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
