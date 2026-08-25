import type { GameAction, GameState } from './gameState';
import { currentScreenFor, type ProjectCardData } from './selectors';
import { asPlayerDraft, findProject } from '../engine/project';

/**
 * What clicking a project should do. Extracted as a pure function because the
 * chassis gave the same decision a second caller: the slate
 * (components/shell/Slate.tsx) and the Projects page must open a project
 * identically, and the rule they share is subtle enough to drift if written
 * twice - a released film opens a dossier, a scheduled one opens its own
 * modal, the focused draft navigates to wherever it is in its life, and a
 * backgrounded draft can only be resumed while nothing else is focused.
 *
 * Returns an intent rather than dispatching, so the two callers keep their own
 * modal state and this stays testable without a DOM.
 */
export type ProjectOpenIntent =
  /** A released film - the caller shows its dossier. */
  | { kind: 'dossier' }
  /** Committed to a release date but not yet out - the caller shows its own modal. */
  | { kind: 'scheduled' }
  /** Already the focused project: go to whichever screen it is currently on. */
  | { kind: 'navigate'; actions: GameAction[] }
  /** Backgrounded, and nothing else is focused - pick it back up. */
  | { kind: 'resume'; actions: GameAction[] }
  /**
   * Backgrounded while a *different* project is focused. The same rule the
   * Inbox and Asset Library already apply: the UI should not offer this, and
   * if it somehow does, nothing happens rather than silently swapping context
   * out from under a half-built package.
   */
  | { kind: 'blocked' };

export function projectOpenIntent(card: ProjectCardData, state: GameState): ProjectOpenIntent {
  if (card.stage === 'in-cinemas' || card.stage === 'archived') return { kind: 'dossier' };
  if (card.stage === 'scheduled') return { kind: 'scheduled' };

  if (card.isFocused) {
    const draft = asPlayerDraft(findProject(state.projects, card.projectId));
    if (!draft) return { kind: 'blocked' };
    const screen = currentScreenFor(draft);
    if (screen === 'workspace') return { kind: 'navigate', actions: [{ type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: 'overview' }] };
    if (screen === 'pre-production') return { kind: 'navigate', actions: [{ type: 'GO_TO_PREPRODUCTION' }] };
    return { kind: 'navigate', actions: [{ type: 'GO_TO_STEP', step: screen }] };
  }

  if (state.focusedProjectId !== null) return { kind: 'blocked' };
  return { kind: 'resume', actions: [{ type: 'RESUME_PROJECT', projectId: card.projectId }] };
}
