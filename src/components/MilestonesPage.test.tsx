// @vitest-environment jsdom
//
// The Milestones page: a career record of the studio's firsts and records,
// derived from released films. Verifies it names the film behind an earned
// milestone and shows the rest as locked goals.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudioProvider } from '../state/StudioContext';
import { MilestonesPage } from './MilestonesPage';
import { studioReducer } from '../state/studioReducer';
import { buildStateWithReadyDraft } from '../state/testFixtures';
import { saveState } from '../state/persistence';
import { MAX_SIMULATION_WEEKS } from '../engine/audienceSimulationStep';
import { playerReleasedFilms } from '../engine/project';
import type { GameState } from '../state/gameState';

function advanceDays(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = studioReducer(s, { type: 'ADVANCE_DAY' });
  return s;
}

describe('MilestonesPage', () => {
  it('shows all locked with a fresh studio that has released nothing', () => {
    saveState(buildStateWithReadyDraft(1));
    render(
      <StudioProvider>
        <MilestonesPage />
      </StudioProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Milestones' })).toBeInTheDocument();
    expect(screen.getByText(/0 of \d+ earned/)).toBeInTheDocument();
    // The catalog is still listed (as goals), e.g. the opening-weekend record.
    expect(screen.getByText('Biggest Opening Weekend')).toBeInTheDocument();
  });

  it('names the film that earned a milestone after a finished release', () => {
    const released = studioReducer(buildStateWithReadyDraft(7), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const finished = advanceDays(released, MAX_SIMULATION_WEEKS * 7 + 7);
    const film = playerReleasedFilms(finished.projects)[0];
    saveState(finished);
    render(
      <StudioProvider>
        <MilestonesPage />
      </StudioProvider>,
    );

    // The debut earned at least "First Film Released"; its card names the film.
    expect(screen.getByText('First Film Released')).toBeInTheDocument();
    expect(screen.getAllByText(film.title).length).toBeGreaterThan(0);
    // Some milestones are earned now, not zero.
    expect(screen.queryByText(/^0 of/)).not.toBeInTheDocument();
  });
});
