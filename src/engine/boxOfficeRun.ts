import type { BoxOfficeRun, Film } from '../types';
import { STUDIO_BOX_OFFICE_SHARE } from './boxOffice';
import { determineOutcome } from './outcome';
import { computeReputationChange } from './reputation';
import { randFloat, type RandomFn } from './random';

// A week's gross is settled once real in-game days accumulate to it, off
// the same calendar everything else uses (Studio.totalDays) - there's no
// dedicated ticking screen for this the way Principal Photography has one;
// it just catches up whenever totalDays advances for any reason (see
// state/studioReducer.ts, everywhere it calls settleBoxOfficeForAllFilms).
const WEEK_LENGTH_DAYS = 7;

// A run ends once its weekly gross has decayed to a trickle, or after a
// generous cap regardless of how slowly a long-legs film is decaying - real
// theatrical runs essentially never go past this in practice.
const MIN_WEEKLY_GROSS_RATIO = 0.02;
const MAX_WEEKS = 20;

// Week-to-week gross isn't perfectly geometric - a small amount of noise on
// top of the underlying retention rate, same spirit as the opening
// weekend's own variance band (engine/boxOffice.ts).
const WEEKLY_VARIANCE_BAND = 0.15;

function rollNextWeekGross(run: BoxOfficeRun, openingWeekend: number, rng: RandomFn): number {
  // Week 1 is always exactly the already-known opening weekend, not a fresh
  // roll - the decay curve only governs week 2 onward.
  if (run.weeks.length === 0) return openingWeekend;
  const lastGross = run.weeks[run.weeks.length - 1].gross;
  const variance = randFloat(rng, 1 - WEEKLY_VARIANCE_BAND, 1 + WEEKLY_VARIANCE_BAND);
  return Math.max(0, Math.round((lastGross * run.retention * variance) / 1000) * 1000);
}

// Week 1 is due immediately on release (releasedOnDay === currentTotalDays
// gives 0 elapsed weeks + 1), so the same settlement path that handles
// ongoing weekly updates also seeds the opening weekend the moment a film
// releases - no separate "first week" special case needed anywhere else.
function weeksDueByNow(releasedOnDay: number, currentTotalDays: number): number {
  return Math.floor((currentTotalDays - releasedOnDay) / WEEK_LENGTH_DAYS) + 1;
}

export interface BoxOfficeSettlement {
  filmsReleased: Film[];
  /** Total studioRevenue across every week newly settled this call, across every running film - credit straight to Studio.cash. */
  cashCredit: number;
  /** Sum of reputationChange for any film whose run finished this call - apply via applyReputationChange. */
  reputationDelta: number;
}

/**
 * Catches every running film's BoxOfficeRun up to how many days have
 * actually passed, across every film in the list at once (nothing stops
 * the player starting their next film while an older one is still in
 * theaters - see docs/DESIGN.md 5.19). A film whose run crosses into
 * 'finished' during this call gets its final totalBoxOffice/studioRevenue/
 * profit/outcome/reputationChange computed right here, from whatever its
 * weeks actually added up to - the same job RELEASE_FILM used to do in one
 * shot at release time.
 */
export function settleBoxOfficeForAllFilms(
  filmsReleased: Film[],
  currentTotalDays: number,
  rng: RandomFn,
): BoxOfficeSettlement {
  let cashCredit = 0;
  let reputationDelta = 0;

  const updatedFilms = filmsReleased.map((film): Film => {
    if (film.boxOfficeRun.status !== 'running') return film;

    let run = film.boxOfficeRun;
    const due = weeksDueByNow(film.releasedOnDay, currentTotalDays);
    while (run.status === 'running' && run.weeks.length < due) {
      const weekNumber = run.weeks.length + 1;
      const gross = rollNextWeekGross(run, film.results.openingWeekend, rng);
      const weeks = [...run.weeks, { week: weekNumber, gross }];
      const cumulativeGross = run.cumulativeGross + gross;
      cashCredit += Math.round(gross * STUDIO_BOX_OFFICE_SHARE);

      const finished = weekNumber >= MAX_WEEKS || gross < film.results.openingWeekend * MIN_WEEKLY_GROSS_RATIO || run.retention <= 0;
      run = { ...run, weeks, cumulativeGross, status: finished ? 'finished' : 'running' };
    }

    if (run === film.boxOfficeRun) return film; // nothing newly due this call

    if (run.status === 'finished') {
      const totalBoxOffice = run.cumulativeGross;
      const studioRevenue = Math.round(totalBoxOffice * STUDIO_BOX_OFFICE_SHARE);
      const profit = studioRevenue - film.results.totalCost;
      const outcome = determineOutcome(profit, film.results.totalCost, film.results.qualityScore, film.results.criticScore, film.results.audienceScore);
      const reputationChange = computeReputationChange(outcome, film.results.criticScore);
      reputationDelta += reputationChange;
      return {
        ...film,
        boxOfficeRun: run,
        results: { ...film.results, totalBoxOffice, studioRevenue, profit, outcome, reputationChange },
      };
    }

    return { ...film, boxOfficeRun: run };
  });

  return { filmsReleased: updatedFilms, cashCredit, reputationDelta };
}
