// The "What's happening" command centre used to show "Find your first project"
// whenever its activity feed was empty - even for a studio that had already
// shipped films and simply had nothing on its slate right now, or one with
// projects quietly progressing that just didn't need a decision. commandCentreEmptyState
// is the pure picker behind the three distinct messages.
import { describe, it, expect } from 'vitest';
import { commandCentreEmptyState } from './Dashboard';

describe('commandCentreEmptyState', () => {
  it('is caught-up when there is active work (nothing needs a decision, but the slate is not empty)', () => {
    expect(commandCentreEmptyState(true, false)).toBe('caught-up');
    expect(commandCentreEmptyState(true, true)).toBe('caught-up');
  });

  it('is between-projects for a studio with released films but no active work - NOT "your first project"', () => {
    expect(commandCentreEmptyState(false, true)).toBe('between-projects');
  });

  it('is first-project only for a brand-new studio with no active work and no released films', () => {
    expect(commandCentreEmptyState(false, false)).toBe('first-project');
  });
});
