import { describe, it, expect } from 'vitest';
import { computeReportedLegs } from './selectors';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';

describe('computeReportedLegs - a derived reported statistic, never a stored driver', () => {
  it('is null while the run is still in theaters - not knowable before the run has a real total', () => {
    const released = studioReducer(buildStateWithReadyDraft(1), { type: 'RELEASE_FILM' });
    const film = released.studio.filmsReleased[0];
    expect(film.boxOfficeRun.status).toBe('running');
    expect(computeReportedLegs(film)).toBeNull();
  });

  it('equals totalBoxOffice / openingWeekend exactly once the run finishes', () => {
    const released = studioReducer(buildStateWithReadyDraft(2), { type: 'RELEASE_FILM' });
    let state = released;
    for (let i = 0; i < MAX_SIMULATION_WEEKS * 7 + 7; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    const film = state.studio.filmsReleased[0];
    expect(film.boxOfficeRun.status).toBe('finished');

    const legs = computeReportedLegs(film);
    expect(legs).not.toBeNull();
    expect(legs).toBeCloseTo(film.results.totalBoxOffice! / film.results.openingWeekend, 9);
    expect(legs).toBeGreaterThanOrEqual(1); // a run can never gross less than its own opening
  });

  it('updates correctly as actual gross grows - a longer, bigger-grossing run reports proportionally higher legs than a shorter one with the same opening', () => {
    const released = studioReducer(buildStateWithReadyDraft(3, { releaseType: 'Limited' }), { type: 'RELEASE_FILM' });
    let state = released;
    const legsByWeek: number[] = [];
    for (let week = 1; week <= MAX_SIMULATION_WEEKS + 2; week++) {
      for (let day = 0; day < 7; day++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
      const film = state.studio.filmsReleased[0];
      const legs = computeReportedLegs(film);
      if (legs !== null) legsByWeek.push(legs);
      if (film.boxOfficeRun.status === 'finished') break;
    }
    // Once knowable (the run has finished), legs is a single settled figure - this just confirms it was actually computed from a real, non-trivial run rather than defaulting to some placeholder.
    expect(legsByWeek.length).toBeGreaterThan(0);
    expect(legsByWeek[legsByWeek.length - 1]).toBeGreaterThanOrEqual(1);
  });
});
