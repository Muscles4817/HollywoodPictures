// @vitest-environment jsdom
//
// Regression test for the draft.results staleness bug (docs/DESIGN.md,
// architecture audit): RELEASE_FILM used to freeze a one-time snapshot into
// draft.results, which this screen read directly - but the background
// day-tick keeps running on this very screen (5.20) and only ever settled
// the canonical copy on Studio.filmsReleased, never the frozen snapshot. A
// run that finished while the player was still looking at this page would
// display "Still playing" forever, even after Studio History next door
// already had the real final numbers. Roadmap Phase 5 removed the frozen
// snapshot representation entirely - ReleaseResults.tsx now reads the same
// live GameState.projects entry Studio History does, by the id that
// survives the release transition (see engine/project.ts) - so this bug
// class can't recur structurally, but the regression coverage stays as a
// pin on the observable behavior.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { ReleaseResults } from './ReleaseResults';
import { studioReducer } from '../../state/studioReducer';
import { buildStateWithReadyDraft } from '../../state/testFixtures';
import { saveState } from '../../state/persistence';
import { MAX_SIMULATION_WEEKS } from '../../engine/audienceSimulationStep';
import { playerReleasedFilms } from '../../engine/project';
import type { GameState } from '../../state/gameState';

beforeEach(() => {
  localStorage.clear();
});

function advanceDays(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return s;
}

describe('ReleaseResults - reflects live settlement, not a frozen release-day snapshot', () => {
  it('shows the final outcome/profit once the run finishes while still sitting on this screen', () => {
    const released = studioReducer(buildStateWithReadyDraft(1), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    expect(released.screen).toBe('results');

    // Long enough to guarantee the run has finished (same bound the existing
    // box-office settlement tests use), without ever leaving 'results' -
    // ADVANCE_DAY never touches screen or focusedProjectId, only the
    // released project's own box office run.
    const finished = advanceDays(released, MAX_SIMULATION_WEEKS * 7 + 7);
    const film = playerReleasedFilms(finished.projects)[0];
    expect(film.boxOfficeRun.status).toBe('finished');
    expect(film.results.outcome).not.toBeNull();

    saveState(finished);
    render(
      <StudioProvider>
        <ReleaseResults />
      </StudioProvider>,
    );

    expect(screen.getByText(film.results.outcome!)).toBeInTheDocument();
    expect(screen.queryByText('Still playing')).not.toBeInTheDocument();
    expect(screen.queryByText(/Pending run's end/)).not.toBeInTheDocument();
  });

  it('still shows "Still playing" for a run genuinely still in progress', () => {
    const released = studioReducer(buildStateWithReadyDraft(1), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    expect(playerReleasedFilms(released.projects)[0].boxOfficeRun.status).toBe('running');
    saveState(released);
    render(
      <StudioProvider>
        <ReleaseResults />
      </StudioProvider>,
    );
    expect(screen.getByText('Still playing')).toBeInTheDocument();
  });
});
