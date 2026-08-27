import { describe, it, expect } from 'vitest';
import { projectOpenIntent } from './projectNavigation';
import { collectProjectCards } from './selectors';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';

/**
 * The rule the slate and the Projects page now share. It was only ever
 * written once, inside a click handler, and the chassis gave it a second
 * caller - so it is a pure function with its own tests rather than a
 * behaviour that exists in two places and drifts.
 */
describe('projectOpenIntent', () => {
  it('navigates the focused draft to whichever screen it is currently on', () => {
    const state = buildStateWithReadyDraft(1);
    const card = collectProjectCards(state).find((c) => c.isFocused);
    expect(card).toBeDefined();
    const intent = projectOpenIntent(card!, state);
    expect(intent.kind).toBe('navigate');
    if (intent.kind === 'navigate') expect(intent.actions.length).toBeGreaterThan(0);
  });

  it('opens a dossier for a film that has been released', () => {
    const released = studioReducer(buildStateWithReadyDraft(2), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
    let state = released;
    for (let i = 0; i < 30; i++) state = studioReducer(state, { type: 'ADVANCE_DAY' });
    const card = collectProjectCards(state).find((c) => c.stage === 'in-cinemas' || c.stage === 'archived');
    expect(card).toBeDefined();
    expect(projectOpenIntent(card!, state).kind).toBe('dossier');
  });

  it('blocks resuming a backgrounded project while a different one is focused', () => {
    const state = buildStateWithReadyDraft(3);
    const focused = collectProjectCards(state).find((c) => c.isFocused);
    expect(focused).toBeDefined();
    // A second, un-focused draft standing in for anything backgrounded: the
    // same guard the Inbox and Asset Library already apply.
    const backgrounded = { ...focused!, projectId: 'someone-else', isFocused: false, stage: 'in-development' as const };
    expect(state.focusedProjectId).not.toBeNull();
    expect(projectOpenIntent(backgrounded, state).kind).toBe('blocked');
  });

  it('resumes a backgrounded project when nothing else is focused', () => {
    const state = buildStateWithReadyDraft(4);
    const card = collectProjectCards(state).find((c) => c.isFocused);
    const backgrounded = { ...card!, projectId: 'picked-up', isFocused: false, stage: 'in-development' as const };
    const intent = projectOpenIntent(backgrounded, { ...state, focusedProjectId: null });
    expect(intent.kind).toBe('resume');
    if (intent.kind === 'resume') expect(intent.actions).toEqual([{ type: 'RESUME_PROJECT', projectId: 'picked-up' }]);
  });
});

/**
 * A focused project that has NOT been greenlit - the only state in which the
 * workspace (and so its deep-links) exists at all. `buildStateWithReadyDraft`
 * greenlights its draft, so asking it to open a workspace section is correctly
 * refused.
 */
function preGreenlightState(seed: number) {
  const base = buildStateWithReadyDraft(seed);
  return {
    ...base,
    projects: base.projects.map((p) =>
      p.kind === 'player-in-progress' && p.draft.id === base.focusedProjectId
        ? { ...p, draft: { ...p.draft, greenlitOnDay: null } }
        : p,
    ),
  };
}

describe('the sheet and the Inbox share one deep-link', () => {
  it('carries the sheet\'s requested drawer through the navigation, and drops a stale one', () => {
    // The production sheet and the Inbox each grew a way to say "open that
    // drawer" independently, and the merge folded the sheet's into the
    // Inbox's CastCrewFocus rather than keeping two fields for one job.
    // OPEN_PROJECT_WORKSPACE_SECTION clears transient view state, so the
    // request has to survive precisely the navigation that carries it.
    const state = preGreenlightState(1);

    const asked = studioReducer(state, {
      type: 'OPEN_PROJECT_WORKSPACE_SECTION',
      section: 'cast-and-crew',
      castCrewFocus: { kind: 'role', role: 'Composer' },
    });
    expect(asked.castCrewFocus).toEqual({ kind: 'role', role: 'Composer' });

    // Using the section nav afterwards must not re-open it.
    const plain = studioReducer(asked, { type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: 'production' });
    expect(plain.castCrewFocus).toBeNull();
  });

  it('consumes the request once the section has acted on it', () => {
    const asked = studioReducer(preGreenlightState(2), {
      type: 'OPEN_PROJECT_WORKSPACE_SECTION',
      section: 'cast-and-crew',
      castCrewFocus: { kind: 'character', characterId: 'whoever' },
    });
    expect(studioReducer(asked, { type: 'CLEAR_CAST_CREW_FOCUS' }).castCrewFocus).toBeNull();
  });
});
