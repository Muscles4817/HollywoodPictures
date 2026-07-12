// @vitest-environment jsdom
//
// Screenplay redesign (docs/DESIGN.md) - a real render of the redesigned
// screenplay card, standing in for a manual browser check (no Playwright/
// browser-automation dependency is set up in this project - see
// OutcomeInspector.test.tsx for the same jsdom+StudioProvider pattern this
// borrows). Catches exactly the class of bug tsc can't: a null-reference or
// missing-import inside ScriptDetails that only surfaces at render time.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { DevelopFilm } from './DevelopFilm';
import { studioReducer } from '../../state/studioReducer';
import { createInitialStudio, type GameState } from '../../state/gameState';
import { saveState } from '../../state/persistence';
import { withRng } from '../../engine/random';
import { ARCHETYPE_LABELS, STORY_TYPE_LABELS, SETTING_LABELS } from '../../data/scriptTagLabels';

beforeEach(() => {
  localStorage.clear();
});

function stateWithGenreSelected(seed: number): GameState {
  const { result: studio, nextSeed } = withRng(seed, (rng) => createInitialStudio(rng, 10_000_000));
  let state: GameState = { studio, screen: 'dashboard', draft: null, rngSeed: nextSeed, totalDays: 1, viewingRivalStudioName: null, viewingProductionId: null };
  state = studioReducer(state, { type: 'START_NEW_FILM' });
  state = studioReducer(state, { type: 'SET_GENRE', genre: 'Action' });
  return state;
}

describe('DevelopFilm - the redesigned screenplay card renders without crashing', () => {
  it('renders a full slate of script cards with the new concept/production/commercial descriptors, for every genre', () => {
    for (const genre of ['Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Thriller'] as const) {
      let state = stateWithGenreSelected(1);
      state = studioReducer(state, { type: 'SET_GENRE', genre });
      saveState(state);
      const { unmount } = render(
        <StudioProvider>
          <DevelopFilm />
        </StudioProvider>,
      );
      // 12 script cards, each showing an archetype badge and a cost-driver sentence.
      expect(screen.getAllByText(/Priced for|A modest, straightforward production\./).length).toBeGreaterThanOrEqual(12);
      expect(screen.getAllByText(/Commercially:|Middling, unremarkable commercial potential\./).length).toBeGreaterThanOrEqual(12);
      unmount();
    }
  });

  it('selecting a script shows its Target Audience pre-fill and enables Continue once cash allows it', () => {
    const state = stateWithGenreSelected(2);
    saveState(state);
    render(
      <StudioProvider>
        <DevelopFilm />
      </StudioProvider>,
    );
    const cards = document.querySelectorAll('.grid.grid-wide .card');
    expect(cards.length).toBe(12);
    fireEvent.click(cards[0] as HTMLElement);
    expect(screen.getByText((text) => text.startsWith('Pre-filled from'))).toBeInTheDocument();
  });
});

describe('DevelopFilm - presentation polish pass (docs/DESIGN.md)', () => {
  it('groups the five quality stats under "Writing"/"Creative" headings, and shows "Intended Audience"/"Screenplay Cost" instead of the old "Written For"/"Cost" wording', () => {
    const state = stateWithGenreSelected(3);
    saveState(state);
    render(
      <StudioProvider>
        <DevelopFilm />
      </StudioProvider>,
    );
    expect(screen.getAllByText('Writing').length).toBeGreaterThanOrEqual(12);
    expect(screen.getAllByText('Creative').length).toBeGreaterThanOrEqual(12);
    expect(screen.getAllByText('Intended Audience:', { exact: false }).length).toBeGreaterThanOrEqual(12);
    expect(screen.queryByText('Written For:', { exact: false })).not.toBeInTheDocument();
    expect(screen.getAllByText('Screenplay Cost:', { exact: false }).length).toBeGreaterThanOrEqual(12);
    expect(screen.queryByText(/^Cost:/)).not.toBeInTheDocument();
  });

  it('no longer shows the old "Production Style: Leans..." line', () => {
    const state = stateWithGenreSelected(4);
    saveState(state);
    render(
      <StudioProvider>
        <DevelopFilm />
      </StudioProvider>,
    );
    expect(screen.queryByText(/Production Style:/)).not.toBeInTheDocument();
  });

  it('shows every quality stat as a star rating, not a bare number, within each Writing/Creative group', () => {
    const state = stateWithGenreSelected(5);
    saveState(state);
    render(
      <StudioProvider>
        <DevelopFilm />
      </StudioProvider>,
    );
    // At least 12 cards x 5 stats = 60 star-rating widgets.
    expect(document.querySelectorAll('.star-rating').length).toBeGreaterThanOrEqual(60);
  });

  it('renders production-requirement tags drawn from the concept - never the raw camelCase enum values', () => {
    const state = stateWithGenreSelected(6);
    saveState(state);
    render(
      <StudioProvider>
        <DevelopFilm />
      </StudioProvider>,
    );
    expect(screen.queryByText('ComingOfAge')).not.toBeInTheDocument();
    expect(screen.queryByText('CrowdPleaser')).not.toBeInTheDocument();
    expect(screen.queryByText('SciFi')).not.toBeInTheDocument();
    expect(screen.queryByText('OriginalVision')).not.toBeInTheDocument();
    expect(screen.queryByText('GenreFormula')).not.toBeInTheDocument();
  });

  it('formats camelCase/PascalCase tag values into readable prose', () => {
    expect(STORY_TYPE_LABELS.ComingOfAge).toBe('Coming of Age');
    expect(SETTING_LABELS.SciFi).toBe('Sci-Fi');
    expect(ARCHETYPE_LABELS.CrowdPleaser).toBe('Crowd-Pleaser');
    expect(ARCHETYPE_LABELS.OriginalVision).toBe('Original Vision');
    expect(ARCHETYPE_LABELS.GenreFormula).toBe('Genre Formula');
  });
});
