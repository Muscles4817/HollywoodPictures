import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { firstDayOfYear } from '../engine/calendar';
import type { GameState } from './gameState';
import type { AwardsSeasonInProgress, Film } from '../types';

/** A state with one released player film (released on day 1, i.e. year 1). */
function releasedState(): { state: GameState; film: Film } {
  const base = buildStateWithReadyDraft(1);
  const after = studioReducer(base, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
  return { state: after, film: playerReleasedFilms(after.projects)[0] };
}

/** An open season with every show scheduled for the same `day` (so one tick can resolve them all). */
function openSeason(filmId: string, day: number): AwardsSeasonInProgress {
  return {
    year: 1,
    eligibleFilmIds: [filmId],
    campaignByFilm: {},
    pendingShows: ['golden-globes', 'sag', 'bafta', 'academy'],
    ceremonyDayByShow: { 'golden-globes': day, sag: day, bafta: day, academy: day },
    momentum: {},
  };
}

describe('Awards season opens at the year boundary', () => {
  it('an ADVANCE_DAY across the boundary opens a season scheduling every show', () => {
    const { state, film } = releasedState();
    const primed: GameState = { ...state, totalDays: 365, awards: { history: [], season: null, nextSeasonDay: 366 } };

    const opened = studioReducer(primed, { type: 'ADVANCE_DAY' });

    expect(opened.awards?.season).not.toBeNull();
    expect(opened.awards?.season?.year).toBe(1);
    expect(opened.awards?.season?.eligibleFilmIds).toContain(film.id);
    // All four tentpole shows are pending, dated later this year in order.
    expect(opened.awards?.season?.pendingShows).toEqual(['golden-globes', 'sag', 'bafta', 'academy']);
    expect(opened.awards?.season?.ceremonyDayByShow['golden-globes']).toBeGreaterThan(366);
    expect(opened.awards?.season?.ceremonyDayByShow['academy']).toBeGreaterThan(
      opened.awards!.season!.ceremonyDayByShow['golden-globes'],
    );
    // The next season is scheduled a year out.
    expect(opened.awards?.nextSeasonDay).toBe(366 + 365);
  });
});

describe('Awards ceremonies resolve and pay out', () => {
  it('resolves every show whose day has arrived, records each in history, and lifts Prestige', () => {
    const { state, film } = releasedState();
    const primed: GameState = {
      ...state,
      totalDays: 400,
      awards: { history: [], season: openSeason(film.id, 401), nextSeasonDay: firstDayOfYear(3) },
    };
    const prestigeBefore = primed.studio.prestige;

    const resolved = studioReducer(primed, { type: 'ADVANCE_DAY' });

    // All four shows land the same tick, so the season closes and history holds one ceremony per show.
    expect(resolved.awards?.season).toBeNull();
    expect(resolved.awards?.history).toHaveLength(4);
    expect(resolved.awards?.history.map((c) => c.show)).toEqual(['golden-globes', 'sag', 'bafta', 'academy']);
    // The sole eligible film sweeps, so Prestige jumps.
    expect(resolved.studio.prestige).toBeGreaterThan(prestigeBefore);
    // The Academy's Best Picture has the film as its winner.
    const oscars = resolved.awards?.history.find((c) => c.show === 'academy');
    expect(oscars?.categories['best-picture']?.some((n) => n.won && n.filmId === film.id)).toBe(true);
  });

  it('resolves only the shows whose day has passed, leaving the rest pending', () => {
    const { state, film } = releasedState();
    const season = openSeason(film.id, 401);
    // Push the Oscars out past this tick; the first three land now.
    season.ceremonyDayByShow = { 'golden-globes': 401, sag: 401, bafta: 401, academy: 500 };
    const primed: GameState = { ...state, totalDays: 400, awards: { history: [], season, nextSeasonDay: firstDayOfYear(3) } };

    const resolved = studioReducer(primed, { type: 'ADVANCE_DAY' });

    expect(resolved.awards?.season).not.toBeNull();
    expect(resolved.awards?.season?.pendingShows).toEqual(['academy']);
    expect(resolved.awards?.history.map((c) => c.show)).toEqual(['golden-globes', 'sag', 'bafta']);
    // The resolved precursors have banked momentum for the Oscars still to come.
    expect(Object.keys(resolved.awards!.season!.momentum).length).toBeGreaterThan(0);
  });
});

describe('SET_AWARDS_CAMPAIGN', () => {
  function withOpenSeason(): { state: GameState; film: Film } {
    const { state, film } = releasedState();
    return {
      state: {
        ...state,
        awards: { history: [], season: openSeason(film.id, state.totalDays + 45), nextSeasonDay: firstDayOfYear(3) },
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
