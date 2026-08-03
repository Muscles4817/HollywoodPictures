// Pre-production must progress on the calendar, not only while the player sits on
// the Pre-Production screen watching its local 500ms ticker. Before the fix, the
// global ADVANCE_DAY tick advanced backgrounded shoots but never prep, so a
// just-greenlit film (still "focused" after navigating to the Dashboard, since
// navigation doesn't clear focusedProjectId) froze until re-opened.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerDraftToProject, asPlayerDraft, findProject } from '../engine/project';
import type { GameState } from './gameState';
import type { FilmDraft, PreProductionState } from '../types';

// A film in active pre-production, viewed from the Dashboard (NOT the
// pre-production screen) - the exact state after greenlight → navigate away.
function backgroundedPrepState(): GameState {
  const base = buildStateWithReadyDraft(1);
  const draft = asPlayerDraft(base.projects[0])!;
  const preProduction: PreProductionState = { status: 'in-progress', recommendedDays: 40, daysElapsed: 0, events: [], runningCost: 0, pendingChoice: null };
  const prepping: FilmDraft = { ...draft, preProduction, photography: null, postProductionScreeningReadyDay: null };
  return { ...base, screen: 'dashboard', projects: [playerDraftToProject(prepping)], focusedProjectId: prepping.id };
}

describe('pre-production advances in the background (ADVANCE_DAY)', () => {
  it('advances an un-watched prep and charges its overhead - no longer frozen', () => {
    const state = backgroundedPrepState();
    const cashBefore = state.studio.cash;

    const after = studioReducer(state, { type: 'ADVANCE_DAY' });

    const prep = asPlayerDraft(findProject(after.projects, state.focusedProjectId))!.preProduction!;
    // Before the fix this stayed 0 on the Dashboard tick.
    expect(prep.daysElapsed).toBeGreaterThanOrEqual(1);
    expect(after.studio.cash).toBeLessThan(cashBefore);
  });

  it('runs prep to completion and opens photography without ever entering the prep screen', () => {
    let s = backgroundedPrepState();
    for (let guard = 0; guard < 1000; guard++) {
      const draft = asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;
      if (draft.photography) break;
      const prep = draft.preProduction!;
      if (prep.status === 'awaiting-choice' && prep.pendingChoice) {
        // Resolved the way the player would from the Inbox / Dashboard, never from the prep screen.
        s = studioReducer(s, { type: 'RESOLVE_PREPRODUCTION_CHOICE', choiceId: prep.pendingChoice.choices[0].id, productionId: draft.id });
        continue;
      }
      s = studioReducer(s, { type: 'ADVANCE_DAY' });
    }

    const done = asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;
    expect(done.preProduction!.status).toBe('finished');
    expect(done.photography?.status).toBe('in-progress');
  });
});
