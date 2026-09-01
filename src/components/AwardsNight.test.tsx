// @vitest-environment jsdom
//
// Phase 4's awards band. Both tests here are regressions from review: the band
// was unreachable on the one path built to reach it, and its exit dismissed
// ceremonies the player had never been shown.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioProvider } from '../state/StudioContext';
import { AwardsNight } from './AwardsNight';
import { studioReducer } from '../state/studioReducer';
import { buildStateWithReadyDraft } from '../state/testFixtures';
import { saveState } from '../state/persistence';
import { unacknowledgedAwardHighlights } from '../state/selectors';
import type { GameState } from '../state/gameState';

beforeEach(() => {
  localStorage.clear();
});

/** Run the calendar forward until a ceremony resolves and is still unseen. */
function stateOnCeremonyDay(seed: number): GameState | null {
  let s = studioReducer(buildStateWithReadyDraft(seed), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
  for (let i = 0; i < 900; i++) {
    s = studioReducer(s, { type: 'ADVANCE_DAY' });
    if (unacknowledgedAwardHighlights(s).length > 0) return s;
  }
  return null;
}

describe('the awards band', () => {
  it('renders the ceremony while it is still unacknowledged', () => {
    const state = stateOnCeremonyDay(6);
    expect(state).not.toBeNull();
    saveState({ ...state!, screen: 'awards' });
    const { container } = render(<StudioProvider><AwardsNight /></StudioProvider>);
    expect(container.querySelector('.awards-night')).not.toBeNull();
    expect(screen.getByRole('button', { name: /back to the desk/i })).toBeInTheDocument();
  });

  it('shows nothing once every ceremony has been acknowledged', () => {
    const state = stateOnCeremonyDay(6)!;
    const seen = unacknowledgedAwardHighlights(state).reduce(
      (acc, h) => studioReducer(acc, { type: 'ACKNOWLEDGE_AWARD_CEREMONY', ceremonyId: h.id }),
      state,
    );
    saveState({ ...seen, screen: 'awards' });
    const { container } = render(<StudioProvider><AwardsNight /></StudioProvider>);
    expect(container.querySelector('.awards-night')).toBeNull();
  });

  it('acknowledges only the ceremony it actually showed', () => {
    // Two shows can resolve inside the same 14-day window. Dismissing the one
    // the player was never shown is the exact failure the notification
    // contract guards against, and the first cut did it.
    const state = stateOnCeremonyDay(6)!;
    const highlights = unacknowledgedAwardHighlights(state);
    const latest = [...highlights].sort((a, b) => b.day - a.day)[0];

    saveState({ ...state, screen: 'awards' });
    render(<StudioProvider><AwardsNight /></StudioProvider>);
    fireEvent.click(screen.getByRole('button', { name: /back to the desk/i }));

    const after = studioReducer(state, { type: 'ACKNOWLEDGE_AWARD_CEREMONY', ceremonyId: latest.id });
    const stillUnseen = unacknowledgedAwardHighlights(after);
    // Everything except the one shown survives to take its own turn.
    expect(stillUnseen.map((h) => h.id)).toEqual(highlights.filter((h) => h.id !== latest.id).map((h) => h.id));
  });
});
