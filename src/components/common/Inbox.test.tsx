// @vitest-environment jsdom
// A "parked" film - photography wrapped, post-production choices locked in -
// used to always read "just needs a release day" in the Inbox, even when its
// mandatory test screening hadn't come back yet (so it genuinely could NOT be
// scheduled). The message now distinguishes the two states.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { withRng } from '../../engine/random';
import { buildReadyDraft } from '../../state/testFixtures';
import { playerDraftToProject, scheduledDraftToProject } from '../../engine/project';
import type { GameState } from '../../state/gameState';
import type { Film, FilmDraft, PressTourIncident, Project } from '../../types';

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

  it('places a production that needs attention under the "Needs you" group', () => {
    mockState = stateWith(parkedDraft(true));
    render(<Inbox open onClose={() => {}} />);
    expect(screen.getByText(/Needs you/i)).toBeInTheDocument();
    expect(screen.queryByText(/While you were away/i)).not.toBeInTheDocument();
  });
});

const INCIDENT: PressTourIncident = {
  base: { personId: 'kip', personName: 'Kip Danger', templateId: 'controversy-viral-remark', headline: 'Kip Danger’s off-the-cuff remark goes viral', story: 'It went viral for the wrong reasons.', buzzDelta: -9, fameDelta: 2, heatDelta: 16, controversyDelta: 8 },
  situation: 'It went viral for the wrong reasons.',
  polarity: 'negative',
};

function scheduledStateWithIncident(incident: PressTourIncident | null): GameState {
  const draft = { id: 'tour-film', title: 'The Big One', pressTourWindowRolled: true, pressTourIncident: incident, talent: [] } as unknown as FilmDraft;
  return {
    projects: [scheduledDraftToProject(draft, 999)],
    focusedProjectId: null,
    totalDays: 10,
    talentPool: {},
    opportunities: [],
    bidNotifications: [],
  } as unknown as GameState;
}

function boxOfficeFinishedState(): GameState {
  // A minimal 'released' project with a finished, unacknowledged run - the only
  // fields the box-office Inbox card and its derivation actually read.
  const film = {
    id: 'bo-film',
    title: 'Skyline Fever',
    boxOfficeRun: { status: 'finished', acknowledged: false, premiereSeen: true, weeks: [], simWeeks: [], cumulativeGross: 48_000_000 },
    results: { outcome: 'Hit', totalBoxOffice: 48_000_000 },
  } as unknown as Film;
  return {
    projects: [{ kind: 'released', film } as unknown as Project],
    focusedProjectId: null,
    talentPool: {},
    opportunities: [],
    bidNotifications: [],
    totalDays: 500,
  } as unknown as GameState;
}

describe('Inbox - box office finished (informational catch-up)', () => {
  it('renders a finished run and, on "View box office", acknowledges it and routes to the dossier', () => {
    dispatch.mockClear();
    const onViewFilmDossier = vi.fn();
    mockState = boxOfficeFinishedState();
    render(<Inbox open onClose={() => {}} onViewFilmDossier={onViewFilmDossier} />);

    // Grouped under "While you were away", with a brief qualitative summary.
    expect(screen.getByText(/While you were away/i)).toBeInTheDocument();
    expect(screen.getByText(/finishing as a Hit/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View box office' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'ACKNOWLEDGE_BOX_OFFICE_RESULTS', filmId: 'bo-film' });
    expect(onViewFilmDossier).toHaveBeenCalledWith('bo-film');
  });
});

describe('Inbox - press tour incident (interactive)', () => {
  it('renders a fired incident with its response options and dispatches the chosen one', () => {
    dispatch.mockClear();
    mockState = scheduledStateWithIncident(INCIDENT);
    render(<Inbox open onClose={() => {}} />);

    expect(screen.getByText('Kip Danger’s off-the-cuff remark goes viral')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Issue an apology' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Double down' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Double down' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'RESOLVE_PRESS_TOUR_INCIDENT', choiceId: 'double-down', productionId: 'tour-film' });
  });

  it('shows nothing to answer when no incident is pending', () => {
    mockState = scheduledStateWithIncident(null);
    render(<Inbox open onClose={() => {}} />);
    expect(screen.queryByText(/off-the-cuff remark/)).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing needs your attention/)).toBeInTheDocument();
  });
});
