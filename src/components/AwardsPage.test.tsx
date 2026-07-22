// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { studioReducer } from '../state/studioReducer';
import { buildStateWithReadyDraft } from '../state/testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { AWARD_CATEGORIES } from '../data/awards';
import type { AwardCategory, AwardNomination, AwardsCeremony, Film } from '../types';
import type { GameState } from '../state/gameState';

const dispatch = vi.fn();
let mockState: GameState;
vi.mock('../state/StudioContext', () => ({ useStudio: () => ({ state: mockState, dispatch }) }));

import { AwardsPage } from './AwardsPage';

function releasedState(): { state: GameState; film: Film } {
  const base = buildStateWithReadyDraft(1);
  const after = studioReducer(base, { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
  return { state: after, film: playerReleasedFilms(after.projects)[0] };
}

function categories(overrides: Partial<Record<AwardCategory, AwardNomination[]>>): AwardsCeremony['categories'] {
  const base = {} as Record<AwardCategory, AwardNomination[]>;
  for (const c of AWARD_CATEGORIES) base[c] = [];
  return { ...base, ...overrides };
}

describe('AwardsPage', () => {
  beforeEach(() => dispatch.mockClear());

  it('shows the campaign section for an open season and dispatches a preset', () => {
    const { state, film } = releasedState();
    mockState = {
      ...state,
      awards: {
        history: [],
        season: {
          year: 1,
          eligibleFilmIds: [film.id],
          campaignByFilm: {},
          pendingShows: ['golden-globes', 'sag', 'bafta', 'academy'],
          ceremonyDayByShow: {
            'golden-globes': state.totalDays + 10,
            sag: state.totalDays + 20,
            bafta: state.totalDays + 32,
            academy: state.totalDays + 45,
          },
          momentum: {},
        },
        nextSeasonDay: 731,
      },
    };
    render(<AwardsPage />);

    expect(screen.getByText(film.title)).toBeInTheDocument();
    // The next show is counted down (Globes open the season).
    expect(screen.getByText(/Golden Globes in \d+ day/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Modest/ }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_AWARDS_CAMPAIGN', filmId: film.id, amount: 1_000_000 });
  });

  it('renders a resolved ceremony with the winning film', () => {
    const { state, film } = releasedState();
    const ceremony: AwardsCeremony = {
      show: 'academy',
      year: 1,
      ceremonyDay: 410,
      categories: categories({ 'best-picture': [{ filmId: film.id, awardScore: 90, won: true }] }),
    };
    mockState = { ...state, awards: { history: [ceremony], season: null, nextSeasonDay: 731 } };
    render(<AwardsPage />);

    expect(screen.getByText(/The Academy Awards · Year 1/)).toBeInTheDocument();
    expect(screen.getByText(/1 win for you/)).toBeInTheDocument();
    expect(screen.getByText('Best Picture')).toBeInTheDocument();
    expect(screen.getByText(film.title)).toBeInTheDocument();
  });

  it('shows an empty state with no season and no history', () => {
    const { state } = releasedState();
    mockState = { ...state, awards: { history: [], season: null, nextSeasonDay: 731 } };
    render(<AwardsPage />);
    expect(screen.getByText(/No ceremonies yet/)).toBeInTheDocument();
  });
});
