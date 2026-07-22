import type { Film } from '../types';
import { advanceOneWeekWithDiagnostics, hasSimulationEnded } from './audienceSimulationStep';
import { computeCompetitiveCrowding, runningFilmAsUpcomingRelease, type UpcomingRelease } from './releaseCrowding';
import { determineOutcome } from './outcome';
import { computeBrandChange, computePrestigeChange } from './reputation';

// A week's gross is settled once real in-game days accumulate to it, off
// the same calendar everything else uses (GameState.totalDays) - there's no
// dedicated ticking screen for this the way Principal Photography has one;
// it just catches up whenever totalDays advances for any reason (see
// state/studioReducer.ts, everywhere it calls settleBoxOfficeForAllFilms).
export const WEEK_LENGTH_DAYS = 7;

// The studio's actual cut of box office gross once theatrical rental fees
// and the international split are accounted for - real-world studio
// rentals average roughly 40% of worldwide gross. totalBoxOffice stays the
// big headline number (matching how box office is always reported); the
// smaller studioRevenue figure is what profit is actually computed from.
// Unchanged from the retired fixed-legs model (docs/DESIGN.md 5.34,
// Milestone 5) - this is a fact about theatrical economics, not something
// either box-office model itself decides.
export const STUDIO_BOX_OFFICE_SHARE = 0.42;

/**
 * The share of gross this film's studio actually keeps. Normally the flat
 * STUDIO_BOX_OFFICE_SHARE, but a Wide release handed to a rented distributor
 * keeps less - the distributor's fee, frozen onto the film at release
 * (engine/distribution.ts). Read here so both the weekly credit and the final
 * tally apply the same, correct keep.
 */
export function studioKeepShare(film: Film): number {
  return film.results.distributionKeepShare ?? STUDIO_BOX_OFFICE_SHARE;
}

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

/** A run that just crossed into 'finished' - computes totalBoxOffice/studioRevenue/profit/outcome/brandChange/prestigeChange from whatever its weeks actually added up to, the same job RELEASE_FILM used to do in one shot at release time. */
function finishFilm(film: Film): { film: Film; brandChange: number; prestigeChange: number } {
  const totalBoxOffice = film.boxOfficeRun.cumulativeGross;
  const studioRevenue = Math.round(totalBoxOffice * studioKeepShare(film));
  const profit = studioRevenue - film.results.totalCost;

  const outcome = determineOutcome({
    profit,
    totalCost: film.results.totalCost,
    totalBoxOffice,
    qualityScore: film.results.qualityScore,
    criticScore: film.results.criticScore,
    audienceScore: film.results.audienceScore,
  });

  const brandChange = computeBrandChange({
    profit,
    totalCost: film.results.totalCost,
    totalBoxOffice,
    audienceScore: film.results.audienceScore,
  });

  const prestigeChange = computePrestigeChange({
    criticScore: film.results.criticScore,
    qualityScore: film.results.qualityScore,
  });

  return {
    film: {
      ...film,
      results: { ...film.results, totalBoxOffice, studioRevenue, profit, outcome, brandChange, prestigeChange },
    },
    brandChange,
    prestigeChange,
  };
}

/** The real calendar day this film's *next* not-yet-settled week starts on - films are numbered from their own releasedOnDay (week 1 = release week), not a shared industry-wide Friday, so this is what orders different films' pending weeks against each other on one shared timeline. */
function nextWeekStartDay(film: Film): number {
  return film.releasedOnDay + film.boxOfficeRun.simWeeks.length * WEEK_LENGTH_DAYS;
}

/**
 * Every currently-running film's live pull on its competitors this week -
 * engine/releaseCrowding.ts:computeCompetitiveCrowding fed every *other*
 * still-running film in this same settlement batch (via
 * runningFilmAsUpcomingRelease, itself a fresh read of each film's own
 * already-stored weekly history - no new state). Reused for both the
 * ongoing per-week pressure below and could be reused identically by a
 * caller resolving a brand-new release's own one-time crowding dent against
 * this same set of running films (engine/marketSettlement.ts).
 */
export function competitivePressureOn(target: Film, others: Film[]): number {
  const known: UpcomingRelease[] = others
    .filter((f) => f.id !== target.id && f.boxOfficeRun.status === 'running')
    .map(runningFilmAsUpcomingRelease)
    .filter((u): u is UpcomingRelease => u !== null);
  return computeCompetitiveCrowding(
    { releaseDay: target.releasedOnDay, genre: target.genre, targetAudience: target.targetAudience },
    known,
  );
}

export interface NextDueFilm {
  film: Film;
  /** The real calendar day `film`'s next not-yet-settled week starts on - what engine/marketSettlement.ts compares against pending releases' own releaseDay to decide what's genuinely due soonest. */
  startDay: number;
}

/** Whichever still-running, still-behind film's next week starts soonest (by real calendar day) - null once nothing in the map is due by currentTotalDays. The shared "what's next" scan both settleBoxOfficeForAllFilms's own loop and engine/marketSettlement.ts's richer loop (which also has to compare against pending *releases*, not just already-running films) are built from. */
export function nextDueFilm(filmsById: ReadonlyMap<string, Film>, currentTotalDays: number): NextDueFilm | null {
  let next: NextDueFilm | null = null;
  for (const film of filmsById.values()) {
    if (film.boxOfficeRun.status !== 'running') continue;
    if (film.boxOfficeRun.simWeeks.length >= weeksDueByNow(film.releasedOnDay, currentTotalDays)) continue;
    const startDay = nextWeekStartDay(film);
    if (!next || startDay < next.startDay) {
      next = { film, startDay };
    }
  }
  return next;
}

export interface WeekAdvanceResult {
  filmsById: Map<string, Film>;
  /** Which film actually advanced - null (with `filmsById` returned unchanged) when nothing was due. Lets a caller that's mixing several owners together (engine/marketSettlement.ts) attribute cashCredit/brandDelta/prestigeDelta to the right one. */
  advancedFilmId: string | null;
  cashCredit: number;
  brandDelta: number;
  prestigeDelta: number;
}

/**
 * Advances exactly one film - whichever one nextDueFilm picks - by exactly
 * one week, with this week's competitivePressureOn computed fresh from
 * every other film currently in `filmsById`. The single step both
 * settleBoxOfficeForAllFilms's own loop and engine/marketSettlement.ts's
 * richer loop (which also interleaves brand-new releases becoming due
 * mid-catch-up) are built from - one implementation, not two that could
 * drift apart. Returns the *same* `filmsById` reference back (and
 * `advancedFilmId: null`) when nothing was due, so a caller can use that as
 * its own loop's exit condition.
 */
export function advanceEarliestDueFilmByOneWeek(filmsById: ReadonlyMap<string, Film>, currentTotalDays: number): WeekAdvanceResult {
  const due = nextDueFilm(filmsById, currentTotalDays);
  if (!due) return { filmsById: filmsById as Map<string, Film>, advancedFilmId: null, cashCredit: 0, brandDelta: 0, prestigeDelta: 0 };
  const { film } = due;

  const run = film.boxOfficeRun;
  const competitivePressure = competitivePressureOn(film, [...filmsById.values()]);
  const { next: nextSimWeek, diagnostics } = advanceOneWeekWithDiagnostics(run.fixed, run.simWeeks, undefined, competitivePressure);
  const gross = Math.round(diagnostics.weeklyAdmissions * AVERAGE_TICKET_PRICE);
  const simWeeks = [...run.simWeeks, nextSimWeek];
  // Recorded, not just consumed - components/dev/OutcomeInspector.tsx's
  // "As Released" replay needs the real per-week pressure history to
  // reconstruct this run's actual diagnostics later (see BoxOfficeWeek's
  // own doc comment on why this is historical fact, not re-derivable).
  const weeks = [...run.weeks, { week: nextSimWeek.week, gross, competitivePressure }];
  const cumulativeGross = run.cumulativeGross + gross;
  const cashCredit = Math.round(gross * studioKeepShare(film));

  const finished = hasSimulationEnded(simWeeks);
  const updatedRun = { ...run, simWeeks, weeks, cumulativeGross, status: finished ? ('finished' as const) : ('running' as const) };
  let updatedFilm: Film = { ...film, boxOfficeRun: updatedRun };
  let brandDelta = 0;
  let prestigeDelta = 0;

  if (finished) {
    const result = finishFilm(updatedFilm);
    updatedFilm = result.film;
    brandDelta = result.brandChange;
    prestigeDelta = result.prestigeChange;
  }

  const updated = new Map(filmsById);
  updated.set(film.id, updatedFilm);
  return { filmsById: updated, advancedFilmId: film.id, cashCredit, brandDelta, prestigeDelta };
}

/**
 * Catches every running film's BoxOfficeRun up to how many days have
 * actually passed, every film in the list mutually visible to every other
 * (nothing stops the player starting their next film while an older one is
 * still in theaters - see docs/DESIGN.md 5.19, and nothing stops a rival's
 * release from squeezing an already-running film's own screen access, the
 * live-competition gap this function used to have entirely).
 *
 * A thin loop over advanceEarliestDueFilmByOneWeek - see that function for
 * the actual per-step logic. Processing real calendar days one at a time
 * (rather than fully catching one film up before starting the next) is what
 * makes a film in week 3 feel a rival's week 1 the moment that rival's
 * first real week actually elapses, instead of only once this film's own
 * catch-up loop happens to reach it, and is also what guarantees a big
 * multi-week calendar jump settles identically to the same span done as
 * several smaller ones: every step only ever reads state that was already
 * settled *before* it runs, never anything produced later in the same call.
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
  let filmsById: Map<string, Film> = new Map(filmsReleased.map((f) => [f.id, f]));

  for (;;) {
    const step = advanceEarliestDueFilmByOneWeek(filmsById, currentTotalDays);
    if (!step.advancedFilmId) break;
    filmsById = step.filmsById;
    cashCredit += step.cashCredit;
    brandDelta += step.brandDelta;
    prestigeDelta += step.prestigeDelta;
  }

  return { filmsReleased: [...filmsById.values()], cashCredit, brandDelta, prestigeDelta };
}
