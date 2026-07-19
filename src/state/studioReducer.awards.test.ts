import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { firstDayOfYear } from '../engine/calendar';
import type { GameState } from './gameState';
import type { Film } from '../types';

/** A state with one released player film (released on day 1, i.e. year 1). */
function releasedState(): { state: GameState; film: Film } {
  const base = buildStateWithReadyDraft(1);
  const after = studioReducer(base, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
  return { state: after, film: playerReleasedFilms(after.projects)[0] };
}

describe('Awards season opens at the year boundary', () => {
  it('an ADVANCE_DAY across the boundary opens a season for the completed year', () => {
    const { state, film } = releasedState();
    const primed: GameState = { ...state, totalDays: 365, awards: { history: [], season: null, nextSeasonDay: 366 } };

    const opened = studioReducer(primed, { type: 'ADVANCE_DAY' });

    expect(opened.awards?.season).not.toBeNull();
    expect(opened.awards?.season?.year).toBe(1);
    expect(opened.awards?.season?.eligibleFilmIds).toContain(film.id);
    // The next season is scheduled a year out; the ceremony is dated later this year.
    expect(opened.awards?.nextSeasonDay).toBe(366 + 365);
    expect(opened.awards?.season?.ceremonyDay).toBeGreaterThan(366);
  });
});

describe('Awards ceremony resolves and pays out', () => {
  it('resolves on its ceremony day, records history, and lifts Prestige', () => {
    const { state, film } = releasedState();
    const primed: GameState = {
      ...state,
      totalDays: 400,
      awards: {
        history: [],
        season: { year: 1, eligibleFilmIds: [film.id], ceremonyDay: 401, campaignByFilm: {} },
        nextSeasonDay: firstDayOfYear(3),
      },
    };
    const prestigeBefore = primed.studio.prestige;

    const resolved = studioReducer(primed, { type: 'ADVANCE_DAY' });

    expect(resolved.awards?.season).toBeNull();
    expect(resolved.awards?.history).toHaveLength(1);
    expect(resolved.awards?.history[0].year).toBe(1);
    // The sole eligible film sweeps its categories, so Prestige jumps.
    expect(resolved.studio.prestige).toBeGreaterThan(prestigeBefore);
    // Best Picture has a winner.
    expect(resolved.awards?.history[0].categories['best-picture'].some((n) => n.won && n.filmId === film.id)).toBe(true);
  });
});

describe('SET_AWARDS_CAMPAIGN', () => {
  function withOpenSeason(): { state: GameState; film: Film } {
    const { state, film } = releasedState();
    return {
      state: {
        ...state,
        awards: {
          history: [],
          season: { year: 1, eligibleFilmIds: [film.id], ceremonyDay: state.totalDays + 45, campaignByFilm: {} },
          nextSeasonDay: firstDayOfYear(3),
        },
      },
      film,
    };
  }

  it('commits a budget, deducting cash; lowering it refunds', () => {
    const { state, film } = withOpenSeason();
    const cashBefore = state.studio.cash;

    const up = studioReducer(state, { type: 'SET_AWARDS_CAMPAIGN', filmId: film.id, amount: 1_000_000 });
    expect(up.studio.cash).toBe(cashBefore - 1_000_000);
    expect(up.awards?.season?.campaignByFilm[film.id]).toBe(1_000_000);

    const down = studioReducer(up, { type: 'SET_AWARDS_CAMPAIGN', filmId: film.id, amount: 400_000 });
    expect(down.studio.cash).toBe(cashBefore - 400_000);
    expect(down.awards?.season?.campaignByFilm[film.id]).toBe(400_000);
  });

  it('no-ops with no open season, an ineligible film, or an unaffordable increase', () => {
    const { state, film } = withOpenSeason();

    const noSeason: GameState = { ...state, awards: { history: [], season: null, nextSeasonDay: firstDayOfYear(3) } };
    expect(studioReducer(noSeason, { type: 'SET_AWARDS_CAMPAIGN', filmId: film.id, amount: 100 })).toBe(noSeason);

    expect(studioReducer(state, { type: 'SET_AWARDS_CAMPAIGN', filmId: 'not-a-film', amount: 100 })).toBe(state);

    const poor: GameState = { ...state, studio: { ...state.studio, cash: 500 } };
    expect(studioReducer(poor, { type: 'SET_AWARDS_CAMPAIGN', filmId: film.id, amount: 1_000_000 })).toBe(poor);
  });
});
