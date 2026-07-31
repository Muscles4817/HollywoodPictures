import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { selectFilmAncillary, selectUpcomingAncillary } from './selectors';
import { playerReleasedFilms } from '../engine/project';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import type { GameState } from './gameState';
import type { AncillaryPayout } from '../types';

function runToFinish(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return s;
}

const payout = (window: AncillaryPayout['window'], dueDay: number, amount: number): AncillaryPayout => ({
  filmId: 'f', filmTitle: 'F', window, dueDay, amount,
});

describe('selectUpcomingAncillary — slate cash-flow buckets', () => {
  it('is empty when nothing is scheduled', () => {
    const state = buildStateWithReadyDraft(1);
    const up = selectUpcomingAncillary(state);
    expect(up.total).toBe(0);
    expect(up.buckets).toEqual([]);
    expect(up.nextDueDay).toBeNull();
  });

  it('buckets scheduled income by in-game year, ascending, with totals and next-due', () => {
    const base = buildStateWithReadyDraft(1);
    const pipeline = [
      payout('homeEntertainment', 100, 10_000_000), // year 1
      payout('licensing', 200, 5_000_000), // year 1
      payout('merchandising', 400, 8_000_000), // year 2
      payout('catalogue', 800, 3_000_000), // year 3
    ];
    const state: GameState = { ...base, studio: { ...base.studio, ancillaryPipeline: pipeline } };

    const up = selectUpcomingAncillary(state);
    expect(up.total).toBe(26_000_000);
    expect(up.nextDueDay).toBe(100);
    expect(up.buckets.map((b) => b.year)).toEqual([1, 2, 3]);
    expect(up.buckets[0].total).toBe(15_000_000);
    expect(up.buckets[0].firstDueDay).toBe(100);
    expect(up.buckets[0].byWindow.homeEntertainment).toBe(10_000_000);
    expect(up.buckets[0].byWindow.licensing).toBe(5_000_000);
    expect(up.buckets[1].total).toBe(8_000_000);
    expect(up.buckets[2].total).toBe(3_000_000);
  });
});

describe('selectFilmAncillary — per-window breakdown', () => {
  it('splits each window into settled + pending, in display order, reconciling to the aggregate', () => {
    const released = studioReducer(buildStateWithReadyDraft(4), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const finished = runToFinish(released);
    const film = playerReleasedFilms(finished.projects)[0];
    const view = selectFilmAncillary(finished, film);

    expect(view).not.toBeNull();
    expect(view!.windows.map((w) => w.window)).toEqual(['homeEntertainment', 'licensing', 'merchandising', 'catalogue']);

    // settled is the received remainder of the window total (per-installment
    // rounding can drift the two by a few dollars, so this is the definition,
    // not an exact-total identity).
    for (const w of view!.windows) {
      expect(w.settled).toBe(Math.max(0, w.total - w.pending));
      expect(w.settled + w.pending).toBeGreaterThanOrEqual(w.total - 20);
    }
    // The per-window pending reconciles exactly to the aggregate pending.
    const pendingSum = view!.windows.reduce((sum, w) => sum + w.pending, 0);
    expect(pendingSum).toBe(view!.pending);

    // Home entertainment is always non-empty and, this soon after the run ends,
    // entirely still to come (its first window opens ~90 days out).
    const homeEnt = view!.windows.find((w) => w.window === 'homeEntertainment')!;
    expect(homeEnt.total).toBeGreaterThan(0);
    expect(homeEnt.pending).toBeGreaterThan(0);
    expect(homeEnt.nextDueDay).not.toBeNull();
  });

  it('returns null for a film with no finished theatrical numbers', () => {
    const released = studioReducer(buildStateWithReadyDraft(4), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    // Still running immediately after release.
    expect(selectFilmAncillary(released, film)).toBeNull();
  });
});
