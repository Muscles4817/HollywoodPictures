// @vitest-environment jsdom
//
// The first component-render regression test in the project (see
// vitest.config.ts) - added after a real bug where OutcomeInspector's
// working-copy state (script/productionChoices/postProductionChoices/
// marketingChoices) defaulted to null/empty regardless of the
// already-selected film, so the "nothing loaded yet" guard was *always*
// true on first mount. With only one released film, the film-picker
// <select> had no way to ever fire onChange (browsers don't fire change
// events for re-picking the already-selected option), so the screen was
// permanently stuck showing nothing - a bug no reducer/engine-level test
// could ever have caught, since GameState itself was completely correct;
// the defect lived entirely in React's own render/state-initialization
// order.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { OutcomeInspector } from './OutcomeInspector';
import { studioReducer } from '../../state/studioReducer';
import { saveState } from '../../state/persistence';
import { buildStateWithReadyDraft } from '../../state/testFixtures';
import { deriveFocusedDraft } from '../../state/selectors';
import { playerDraftToProject } from '../../engine/project';
import type { GameState } from '../../state/gameState';

beforeEach(() => {
  localStorage.clear();
});

function releaseOneFilm(seed: number): GameState {
  return studioReducer(buildStateWithReadyDraft(seed), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
}

describe('OutcomeInspector loads real data on first mount, without any user interaction', () => {
  it('with exactly one released film - the exact scenario that was completely broken', () => {
    saveState(releaseOneFilm(1));
    render(
      <StudioProvider>
        <OutcomeInspector />
      </StudioProvider>,
    );

    // The broken version got stuck on the bare film-picker fallback -
    // neither of these panels (nor anything below them) ever rendered.
    expect(screen.getByText('Ratings - Original → Current')).toBeInTheDocument();
    expect(screen.getByText('Box Office - Original → Current')).toBeInTheDocument();
    expect(screen.queryByText('Load a film from Studio History...')).not.toBeInTheDocument();
  });

  it('with several released films - picks the first one automatically', () => {
    let state = releaseOneFilm(2);
    state = { ...state, focusedProjectId: null, screen: 'dashboard' };
    // A second and third film, same pattern persistence.test.ts's fixtures use.
    for (const seed of [3, 4]) {
      const draft = deriveFocusedDraft(buildStateWithReadyDraft(seed))!;
      state = studioReducer(
        { ...state, projects: [...state.projects, playerDraftToProject(draft)], focusedProjectId: draft.id },
        { type: 'SCHEDULE_RELEASE', releaseDay: 1 },
      );
    }
    saveState(state);

    render(
      <StudioProvider>
        <OutcomeInspector />
      </StudioProvider>,
    );

    expect(screen.getByText('Ratings - Original → Current')).toBeInTheDocument();
    expect(screen.getByText('Box Office - Original → Current')).toBeInTheDocument();
  });

  it('shows the empty state, not a crash, when no films have been released yet', () => {
    render(
      <StudioProvider>
        <OutcomeInspector />
      </StudioProvider>,
    );
    expect(screen.getByText(/No released films yet/)).toBeInTheDocument();
  });
});

// The Outcome Inspector's weekly-trace panel has two views now (Comp
// Pressure fix) - "As Released" (a real replay of this film's actual
// settled weeks, including real competitivePressure - components/dev/AudienceSimulationDiagnostics.tsx:AsReleasedDiagnostics)
// by default, and the pre-existing "Projected (Editable)" hypothetical
// slider-driven projection, switchable via a tab pair.
describe('OutcomeInspector - As Released / Projected diagnostics tabs', () => {
  it('shows the As Released trace by default, with real data (no released-films-only-in-isolation caveat, since this film had no siblings to omit)', () => {
    saveState(releaseOneFilm(10));
    render(
      <StudioProvider>
        <OutcomeInspector />
      </StudioProvider>,
    );
    expect(screen.getByText('Audience Simulation - Weekly Diagnostics')).toBeInTheDocument();
    expect(screen.getByText(/Exactly what really happened/)).toBeInTheDocument();
    expect(screen.queryByText(/wasn't recorded/)).not.toBeInTheDocument();
  });

  it('switches to the Projected (Editable) trace on click, and back', () => {
    saveState(releaseOneFilm(11));
    render(
      <StudioProvider>
        <OutcomeInspector />
      </StudioProvider>,
    );
    fireEvent.click(screen.getByText('Projected (Editable)'));
    expect(screen.getByText(/hypothetical, editable-slider projection/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('As Released'));
    expect(screen.getByText(/Exactly what really happened/)).toBeInTheDocument();
  });
});
