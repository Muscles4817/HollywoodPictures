// @vitest-environment jsdom
// A "parked" film - photography wrapped, post-production choices locked in -
// used to always read "just needs a release day" in the Inbox, even when its
// mandatory test screening hadn't come back yet (so it genuinely could NOT be
// scheduled). The message now distinguishes the two states.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { withRng } from '../../engine/random';
import { buildReadyDraft } from '../../state/testFixtures';
import { playerDraftToProject } from '../../engine/project';
import type { GameState } from '../../state/gameState';
import type { FilmDraft } from '../../types';

const dispatch = vi.fn();
let mockState: GameState;
vi.mock('../../state/StudioContext', () => ({ useStudio: () => ({ state: mockState, dispatch }) }));

// Imported after the mock is declared.
import { Inbox } from './Inbox';

function parkedDraft(screeningResolved: boolean): FilmDraft {
  // buildReadyDraft is a fully release-ready draft (finished photography,
  // post-production choices set, screening resolved) - overriding just the
  // resolved flag gives the "still awaiting the screening" parked state.
  return withRng(1, (rng) => ({ ...buildReadyDraft(rng), testScreeningResolved: screeningResolved })).result;
}

function stateWith(draft: FilmDraft): GameState {
  return {
    projects: [playerDraftToProject(draft)],
    focusedProjectId: null,
    talentPool: {},
    opportunities: [],
    bidNotifications: [],
  } as unknown as GameState;
}

describe('Inbox - parked film messaging', () => {
  it('explains the film is still awaiting its test screening when it has not resolved', () => {
    mockState = stateWith(parkedDraft(false));
    render(<Inbox open onClose={() => {}} />);
    expect(screen.getByText(/still wrapping up/i)).toBeInTheDocument();
    expect(screen.queryByText(/just needs a release day/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check on it' })).toBeInTheDocument();
  });

  it('says the film just needs a release day once the screening has resolved', () => {
    mockState = stateWith(parkedDraft(true));
    render(<Inbox open onClose={() => {}} />);
    expect(screen.getByText(/just needs a release day/i)).toBeInTheDocument();
    expect(screen.queryByText(/still wrapping up/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to Marketing & Release' })).toBeInTheDocument();
  });
});
