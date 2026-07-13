import type { Film } from '../types';
import { advanceOneWeekWithDiagnostics, hasSimulationEnded } from './audienceSimulationStep';
import { determineOutcome } from './outcome';
import { computeBrandChange, computePrestigeChange } from './reputation';

// A week's gross is settled once real in-game days accumulate to it, off
// the same calendar everything else uses (GameState.totalDays) - there's no
// dedicated ticking screen for this the way Principal Photography has one;
// it just catches up whenever totalDays advances for any reason (see
// state/studioReducer.ts, everywhere it calls settleBoxOfficeForAllFilms).
const WEEK_LENGTH_DAYS = 7;

// The studio's actual cut of box office gross once theatrical rental fees
// and the international split are accounted for - real-world studio
// rentals average roughly 40% of worldwide gross. totalBoxOffice stays the
// big headline number (matching how box office is always reported); the
// smaller studioRevenue figure is what profit is actually computed from.
// Unchanged from the retired fixed-legs model (docs/DESIGN.md 5.34,
// Milestone 5) - this is a fact about theatrical economics, not something
// either box-office model itself decides.
export const STUDIO_BOX_OFFICE_SHARE = 0.42;

// The people-to-money boundary for the whole audience-simulation-driven box
// office system (docs/DESIGN.md 5.34) - engine/audienceSimulationStep.ts
// itself never multiplies anything by a price ("model people, not money...
// until the very last step"). A single flat average ticket price,
// deliberately simple (no per-market/per-format breakdown yet - see
// DESIGN.md's "where international markets slot in later"), first
// introduced for Milestone 4's dev-only Outcome Inspector and promoted here
// now that live settlement needs the exact same conversion - both
// engine/releaseFilm.ts (FilmResults.openingWeekend) and this file's own
// weekly settlement read it from here, so there's one number, not two.
export const AVERAGE_TICKET_PRICE = 11;

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
  /** Sum of brandChange for any film whose run finished this call - apply via applyStatChange. */
  brandDelta: number;
  /** Sum of prestigeChange for any film whose run finished this call - apply via applyStatChange. */
  prestigeDelta: number;
}

/**
 * Catches every running film's BoxOfficeRun up to how many days have
 * actually passed, across every film in the list at once (nothing stops
 * the player starting their next film while an older one is still in
 * theaters - see docs/DESIGN.md 5.19). A film whose run crosses into
 * 'finished' during this call gets its final totalBoxOffice/studioRevenue/
 * profit/outcome/brandChange/prestigeChange computed right here, from
 * whatever its weeks actually added up to - the same job RELEASE_FILM used
 * to do in one shot at release time.
 *
 * Driven entirely by engine/audienceSimulationStep.ts's weekly step
 * (advanceOneWeekWithDiagnostics) against each run's own `fixed`/`simWeeks`
 * - no randomness anywhere in this file any more (the audience simulation
 * is fully deterministic), and no local stopping-rule logic either:
 * hasSimulationEnded is the single source of truth for "has this run
 * finished," the same function Milestones 1-4's own tests already cover.
 */
export function settleBoxOfficeForAllFilms(filmsReleased: Film[], currentTotalDays: number): BoxOfficeSettlement {
  let cashCredit = 0;
  let brandDelta = 0;
  let prestigeDelta = 0;

  const updatedFilms = filmsReleased.map((film): Film => {
    if (film.boxOfficeRun.status !== 'running') return film;

    let run = film.boxOfficeRun;
    const due = weeksDueByNow(film.releasedOnDay, currentTotalDays);
    while (run.status === 'running' && run.simWeeks.length < due) {
      const { next: nextSimWeek, diagnostics } = advanceOneWeekWithDiagnostics(run.fixed, run.simWeeks);
      const gross = Math.round(diagnostics.weeklyAdmissions * AVERAGE_TICKET_PRICE);
      const simWeeks = [...run.simWeeks, nextSimWeek];
      const weeks = [...run.weeks, { week: nextSimWeek.week, gross }];
      const cumulativeGross = run.cumulativeGross + gross;
      cashCredit += Math.round(gross * STUDIO_BOX_OFFICE_SHARE);

      const finished = hasSimulationEnded(simWeeks);
      run = { ...run, simWeeks, weeks, cumulativeGross, status: finished ? 'finished' : 'running' };
    }

    if (run === film.boxOfficeRun) return film; // nothing newly due this call

    if (run.status === 'finished') {
      const totalBoxOffice = run.cumulativeGross;
      const studioRevenue = Math.round(totalBoxOffice * STUDIO_BOX_OFFICE_SHARE);
      const profit = studioRevenue - film.results.totalCost;
      const outcome = determineOutcome(profit, film.results.totalCost, film.results.qualityScore, film.results.criticScore, film.results.audienceScore);
      const brandChange = computeBrandChange(profit, film.results.totalCost, film.results.audienceScore);
      const prestigeChange = computePrestigeChange(film.results.criticScore);
      brandDelta += brandChange;
      prestigeDelta += prestigeChange;
      return {
        ...film,
        boxOfficeRun: run,
        results: { ...film.results, totalBoxOffice, studioRevenue, profit, outcome, brandChange, prestigeChange },
      };
    }

    return { ...film, boxOfficeRun: run };
  });

  return { filmsReleased: updatedFilms, cashCredit, brandDelta, prestigeDelta };
}
