import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import type { GameState } from './gameState';
import type { AncillaryPayout } from '../types';

// Ancillary revenue Stage 2 wired through the calendar settlement: a finished
// film's post-theatrical payouts are scheduled once and drained into cash
// through the ledger as they come due. See engine/ancillary.ts and
// docs/DESIGN_REVIEW_studio_financial_model.md.

function runToFinish(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return s;
}

const forFilm = (s: GameState, filmId: string): AncillaryPayout[] =>
  (s.studio.ancillaryPipeline ?? []).filter((p) => p.filmId === filmId);

describe('ancillary pipeline — scheduling on run finish', () => {
  it("materialises a finished film's payouts exactly once and flags the run", () => {
    const released = studioReducer(buildStateWithReadyDraft(4), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const finished = runToFinish(released);
    const film = playerReleasedFilms(finished.projects)[0];

    expect(film.boxOfficeRun.status).toBe('finished');
    expect(film.boxOfficeRun.ancillaryScheduled).toBe(true);
    // Home entertainment is > 0 for any real gross, so at least those installments
    // are queued against this film after its run ends.
    expect(forFilm(finished, film.id).length).toBeGreaterThan(0);

    // Advancing again must not re-schedule (the run is flagged): the film's future
    // pipeline can only shrink as payouts come due, never grow.
    const before = forFilm(finished, film.id).length;
    const after = forFilm(studioReducer(finished, { type: 'ADVANCE_DAY' }), film.id).length;
    expect(after).toBeLessThanOrEqual(before);
  });
});

describe('ancillary pipeline — draining into cash and the ledger', () => {
  it('credits a due payout through the ledger and leaves a future one pending', () => {
    const base = buildStateWithReadyDraft(4);
    const due: AncillaryPayout = {
      filmId: 'ghost', filmTitle: 'Ghost Film', window: 'homeEntertainment', dueDay: base.totalDays + 1, amount: 5_000_000,
    };
    const future: AncillaryPayout = {
      filmId: 'ghost', filmTitle: 'Ghost Film', window: 'licensing', dueDay: base.totalDays + 999, amount: 7_000_000,
    };
    const seeded: GameState = { ...base, studio: { ...base.studio, ancillaryPipeline: [due, future] } };

    // Control run isolates the ancillary effect from any other same-day movement.
    const control = studioReducer(base, { type: 'ADVANCE_DAY' });
    const next = studioReducer(seeded, { type: 'ADVANCE_DAY' });

    expect(next.studio.cash).toBe(control.studio.cash + due.amount);

    const pipe = next.studio.ancillaryPipeline ?? [];
    expect(pipe.some((p) => p.window === 'licensing' && p.dueDay === future.dueDay)).toBe(true);
    expect(pipe.some((p) => p.window === 'homeEntertainment')).toBe(false);

    const entry = (next.studio.cashLedger ?? []).find((e) => e.category === 'homeEntertainment');
    expect(entry?.amount).toBe(due.amount);
    expect(entry?.reason).toContain('Ghost Film');
  });
});
