// @vitest-environment jsdom
//
// First IP-layer milestone - the studio's owned Intellectual Property roster.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioProvider } from '../state/StudioContext';
import { IpLibrary } from './IpLibrary';
import { studioReducer } from '../state/studioReducer';
import { buildStateWithReadyDraft } from '../state/testFixtures';
import { saveState } from '../state/persistence';
import { playerReleasedFilms } from '../engine/project';

beforeEach(() => {
  localStorage.clear();
});

describe('IpLibrary', () => {
  it('shows an empty state before anything is promoted', () => {
    saveState(buildStateWithReadyDraft(1));
    render(<StudioProvider><IpLibrary /></StudioProvider>);
    expect(screen.getByText(/don't own any intellectual property yet/i)).toBeInTheDocument();
  });

  function promotedState(name: string) {
    const released = studioReducer(buildStateWithReadyDraft(2), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    const character = film.script.cast[0];
    const promoted = studioReducer(released, {
      type: 'PROMOTE_FILM_TO_IP',
      filmId: film.id,
      characterIds: [character.id],
      name,
    });
    return { promoted, film, character };
  }

  it('lists a promoted IP with its name and characters', () => {
    const { promoted, character } = promotedState('The Silver Saga');
    saveState(promoted);

    render(<StudioProvider><IpLibrary /></StudioProvider>);

    expect(screen.getByRole('heading', { name: 'The Silver Saga' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(character.name))).toBeInTheDocument();
    expect(screen.getByText('1 owned IP')).toBeInTheDocument();
  });

  it('opens the IP detail modal with its standing and franchise history on click', () => {
    const { promoted, film } = promotedState('The Silver Saga');
    saveState(promoted);

    render(<StudioProvider><IpLibrary /></StudioProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'View details' }));

    // The bigger view surfaces the franchise standing and the per-film history.
    expect(screen.getByRole('heading', { name: 'Franchise standing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Franchise history' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(film.title))).toBeInTheDocument();
  });
});
