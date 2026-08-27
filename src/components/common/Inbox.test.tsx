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
    totalDays: 1,
    talentPool: {},
    opportunities: [],
    bidNotifications: [],
  } as unknown as GameState;
}

describe('Inbox - parked film messaging', () => {
  it('explains the film is still awaiting its test screening when it has not resolved', () => {
    mockState = stateWith(parkedDraft(false));
    render(<Inbox open onClose={() => {}} />);
    expect(screen.getByText(/can't lock a release date until the test screening is in/i)).toBeInTheDocument();
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

// The three Cast & Crew beats: each is per-Character (or per-round), lists what
// actually arrived, and routes into the exact drawer it's about rather than
// dropping the player on the project's Overview to hunt for it.
function person(id: string, name: string) {
  return { id, identity: { name, appearanceTags: [], gender: 'Female' } } as unknown as never;
}

function castingState(): GameState {
  const draft = {
    id: 'casting-film',
    title: 'Night Shift',
    photography: null,
    talent: [],
    auditions: [],
    script: { cast: [{ id: 'char-lead', name: 'Mercedes', prominence: 'Lead' }] },
    castingCalls: [
      {
        id: 'call-1',
        characterId: 'char-lead',
        role: 'Lead Actor',
        applicants: [
          { person: person('a1', 'Rosa Vance'), appliedOnDay: 8, channel: 'OpenCasting' },
          { person: person('a2', 'Dana Pike'), appliedOnDay: 8, channel: 'InterestedTalent' },
        ],
      },
    ],
  } as unknown as FilmDraft;
  return {
    projects: [playerDraftToProject(draft)],
    focusedProjectId: null,
    totalDays: 10,
    talentPool: { Actor: [], Director: [] },
    opportunities: [],
    bidNotifications: [],
  } as unknown as GameState;
}

describe('Inbox - casting applicants', () => {
  it('names the role, lists who came in and how, and routes into that Character\'s drawer', () => {
    dispatch.mockClear();
    const onClose = vi.fn();
    mockState = castingState();
    render(<Inbox open onClose={onClose} />);

    // The card is about the role, not just the film.
    expect(screen.getByText('Mercedes · Lead role')).toBeInTheDocument();
    expect(screen.getByText(/2 new candidates/i)).toBeInTheDocument();
    // Each candidate on their own line, saying which door they came through.
    expect(screen.getByText(/Rosa Vance — answered your open casting call/)).toBeInTheDocument();
    expect(screen.getByText(/Dana Pike — approached you directly/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Review candidates' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'REVIEW_CASTING_CALL', projectId: 'casting-film', characterId: 'char-lead' });
    // ...and the overlay gets out of the way, rather than covering the screen
    // it just routed to.
    expect(onClose).toHaveBeenCalled();
  });

  it('offers a note instead of the button while a DIFFERENT project is focused', () => {
    mockState = { ...castingState(), focusedProjectId: 'some-other-film' };
    render(<Inbox open onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Review candidates' })).not.toBeInTheDocument();
    expect(screen.getByText(/Finish or leave what you're currently working on/)).toBeInTheDocument();
  });
});

describe('Inbox - director bake-off', () => {
  it('announces landed pitches by name and routes into the bake-off panel', () => {
    dispatch.mockClear();
    const onClose = vi.fn();
    const draft = {
      id: 'pitch-film',
      title: 'Cold Harbour',
      photography: null,
      talent: [],
      auditions: [],
      script: { cast: [] },
      castingCalls: [],
      directorPitches: {
        openedOnDay: 1,
        advertisedFee: 1_000_000,
        pending: [{ directorId: 'd9', dueDay: 40 }],
        submitted: [{ directorId: 'd1' }, { directorId: 'd2' }],
      },
    } as unknown as FilmDraft;
    mockState = {
      projects: [playerDraftToProject(draft)],
      focusedProjectId: null,
      totalDays: 30,
      talentPool: { Actor: [], Director: [person('d1', 'Imre Solt'), person('d2', 'Bex Farrow')] },
      opportunities: [],
      bidNotifications: [],
    } as unknown as GameState;
    render(<Inbox open onClose={onClose} />);

    expect(screen.getByText('2 director pitches are in')).toBeInTheDocument();
    expect(screen.getByText(/1 more is still being prepared/)).toBeInTheDocument();
    expect(screen.getByText('Imre Solt')).toBeInTheDocument();
    expect(screen.getByText('Bex Farrow')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Read the pitches' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'REVIEW_DIRECTOR_PITCHES', projectId: 'pitch-film' });
    expect(onClose).toHaveBeenCalled();
  });
});
