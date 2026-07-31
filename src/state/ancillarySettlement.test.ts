import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { accrueAncillaryAwardsPremium, accrueRivalAncillary, scheduleFinishedFilmAncillary } from './ancillarySettlement';
import { ancillaryAttributesFromFilm, deriveAncillaryProfile } from '../engine/ancillary';
import { AWARDS_PREMIUM_TIMING } from '../data/ancillary';
import type { AwardsCeremony, Film, RivalStudio } from '../types';
import type { GameState } from './gameState';

// Build one genuine finished player film + its world, reused across the tests
// below (each reducer run is ~150 ticks, so we do it once).
function finishedState(seed = 4): GameState {
  let s = studioReducer(buildStateWithReadyDraft(seed), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
  for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return s;
}
const WORLD = finishedState();
const FINISHED_FILM = playerReleasedFilms(WORLD.projects)[0];

/** A finished film with its ancillary bookkeeping cleared, for scheduling from scratch. */
function unscheduled(film: Film): Film {
  return { ...film, boxOfficeRun: { ...film.boxOfficeRun, ancillaryScheduled: undefined, ancillaryAwards: undefined } };
}

/** A ceremony where `filmId` has `wins` wins among `noms` total nominations. */
function ceremony(filmId: string, wins: number, noms: number): AwardsCeremony {
  const entries = [
    ...Array.from({ length: wins }, () => ({ filmId, awardScore: 80, won: true })),
    ...Array.from({ length: noms - wins }, () => ({ filmId, awardScore: 60, won: false })),
  ];
  return { show: 'academy', year: 1, ceremonyDay: 1, categories: { 'Best Picture': entries } } as unknown as AwardsCeremony;
}

describe('scheduleFinishedFilmAncillary — awards baseline stamped', () => {
  it('schedules once and records the awards baked in (none, here)', () => {
    const studio = { ...WORLD.studio, ancillaryPipeline: [] };
    const res = scheduleFinishedFilmAncillary(studio, [unscheduled(FINISHED_FILM)], [], 1000);
    expect(res.films[0].boxOfficeRun.ancillaryScheduled).toBe(true);
    expect(res.films[0].boxOfficeRun.ancillaryAwards).toEqual({ wins: 0, nominations: 0 });
    expect((res.studio.ancillaryPipeline ?? []).length).toBeGreaterThan(0);
  });
});

describe('accrueAncillaryAwardsPremium — retroactive awards top-up', () => {
  const scheduled = scheduleFinishedFilmAncillary({ ...WORLD.studio, ancillaryPipeline: [] }, [unscheduled(FINISHED_FILM)], [], 1000);
  const CEREMONY_DAY = 3000;

  it('tops up licensing (and catalogue) when the film wins after its schedule was fixed', () => {
    const history = [ceremony(FINISHED_FILM.id, 2, 5)];
    const before = (scheduled.studio.ancillaryPipeline ?? []).length;
    const premium = accrueAncillaryAwardsPremium(scheduled.studio, scheduled.films, history, CEREMONY_DAY);

    // A licensing premium always follows a win (the 1 + awardsLift factor).
    const lic = (premium.studio.ancillaryPipeline ?? []).find((p) => p.window === 'licensing' && p.dueDay === CEREMONY_DAY + AWARDS_PREMIUM_TIMING.licensingOffset);
    expect(lic).toBeDefined();
    expect(lic!.amount).toBeGreaterThan(0);
    expect((premium.studio.ancillaryPipeline ?? []).length).toBeGreaterThan(before);

    // Any catalogue top-up is dated on the catalogue offset, never earlier.
    const cat = (premium.studio.ancillaryPipeline ?? []).find((p) => p.window === 'catalogue' && p.dueDay === CEREMONY_DAY + AWARDS_PREMIUM_TIMING.catalogueOffset);
    if (cat) expect(cat.amount).toBeGreaterThan(0);

    // The new awards record is stamped back onto the run.
    expect(premium.films[0].boxOfficeRun.ancillaryAwards).toEqual({ wins: 2, nominations: 5 });
  });

  it('is idempotent — re-running with the same awards adds nothing', () => {
    const history = [ceremony(FINISHED_FILM.id, 2, 5)];
    const once = accrueAncillaryAwardsPremium(scheduled.studio, scheduled.films, history, CEREMONY_DAY);
    const twice = accrueAncillaryAwardsPremium(once.studio, once.films, history, CEREMONY_DAY + 500);
    expect((twice.studio.ancillaryPipeline ?? []).length).toBe((once.studio.ancillaryPipeline ?? []).length);
  });

  it('does nothing to an unscheduled film', () => {
    const res = accrueAncillaryAwardsPremium(WORLD.studio, [unscheduled(FINISHED_FILM)], [ceremony(FINISHED_FILM.id, 2, 5)], CEREMONY_DAY);
    expect(res.studio.ancillaryPipeline ?? []).toEqual(WORLD.studio.ancillaryPipeline ?? []);
  });
});

describe('accrueRivalAncillary — rival afterlife credited as a lump', () => {
  const rival: RivalStudio = {
    id: 'rival-1', name: 'Meridian Pictures', tier: 'Major', nextSpawnCheckDay: 0,
    cash: 5_000_000, brand: 45, prestige: 40, lifetimeRevenue: 0, lifetimeExpenditure: 0,
  };
  const rivalFilm: Film = {
    ...FINISHED_FILM,
    id: 'rival-film-1',
    releasedBy: rival.name,
    boxOfficeRun: { ...FINISHED_FILM.boxOfficeRun, ancillaryScheduled: undefined },
  };
  const expected = deriveAncillaryProfile(
    ancillaryAttributesFromFilm(rivalFilm, { studioPrestige: rival.prestige, awards: { wins: 0, nominations: 0 } }),
    rivalFilm.results.totalBoxOffice!,
  ).lifetimeTotal;

  it('adds the whole lifetime total to the rival cash and lifetime revenue, and flags the film', () => {
    expect(expected).toBeGreaterThan(0);
    const res = accrueRivalAncillary([rival], [rivalFilm], []);
    const after = res.rivals.find((r) => r.name === rival.name)!;
    expect(after.cash).toBe(rival.cash + expected);
    expect(after.lifetimeRevenue).toBe(rival.lifetimeRevenue + expected);
    expect(res.films[0].boxOfficeRun.ancillaryScheduled).toBe(true);
  });

  it('never double-credits an already-flagged film', () => {
    const first = accrueRivalAncillary([rival], [rivalFilm], []);
    const second = accrueRivalAncillary(first.rivals, first.films, []);
    const afterFirst = first.rivals.find((r) => r.name === rival.name)!;
    const afterSecond = second.rivals.find((r) => r.name === rival.name)!;
    expect(afterSecond.cash).toBe(afterFirst.cash);
    expect(afterSecond.lifetimeRevenue).toBe(afterFirst.lifetimeRevenue);
  });

  it('ignores a rival film still in its theatrical run', () => {
    const running: Film = { ...rivalFilm, boxOfficeRun: { ...rivalFilm.boxOfficeRun, status: 'running', ancillaryScheduled: undefined } };
    const res = accrueRivalAncillary([rival], [running], []);
    expect(res.rivals.find((r) => r.name === rival.name)!.cash).toBe(rival.cash);
  });
});
