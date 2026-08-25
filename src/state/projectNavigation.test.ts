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
