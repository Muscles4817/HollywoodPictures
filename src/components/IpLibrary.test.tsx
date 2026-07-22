// @vitest-environment jsdom
//
// First IP-layer milestone - the studio's owned Intellectual Property roster.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('lists a promoted IP with its name, source film and characters', () => {
    const released = studioReducer(buildStateWithReadyDraft(2), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    const film = playerReleasedFilms(released.projects)[0];
    const character = film.script.cast[0];
    const promoted = studioReducer(released, {
      type: 'PROMOTE_FILM_TO_IP',
      filmId: film.id,
      characterIds: [character.id],
      name: 'The Silver Saga',
    });
    saveState(promoted);

    render(<StudioProvider><IpLibrary /></StudioProvider>);

    expect(screen.getByRole('heading', { name: 'The Silver Saga' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(film.title))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(character.name))).toBeInTheDocument();
    expect(screen.getByText('1 owned IP')).toBeInTheDocument();
  });
});
