import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearSavedState } from '../../state/persistence';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * The app's only safety net against an uncaught render-phase error - and
 * until this component existed, there wasn't one anywhere (no
 * componentDidCatch/getDerivedStateFromError in the whole codebase). React
 * unmounts the entire tree on an uncaught error with nothing to catch it,
 * which is exactly what happened when a stale v19 save's BoxOfficeRun
 * (missing Milestone 9's availability fields) reached studioReducer's
 * GO_TO_STEP/ADVANCE_DAY case: settleBoxOfficeForAllFilms threw deep inside
 * the audience simulation, uncaught, and the screen went black with no
 * indication anything had gone wrong (see persistence.ts's SAVE_KEY v19 ->
 * v20 comment for that specific incident). This does not replace fixing the
 * underlying bug - it's the difference between *any* future regression like
 * it showing a recoverable message instead of a silent blank page.
 *
 * Must be a class component - React has no hook-based equivalent for
 * catching errors from a subtree.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error in Hollywood Pictures:', error, info.componentStack);
  }

  private handleResetStudio = (): void => {
    clearSavedState();
    window.location.reload();
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="card stack" style={{ maxWidth: 640, margin: '80px auto', padding: 24 }}>
        <h2 style={{ margin: 0 }}>Something went wrong</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Hollywood Pictures hit an unexpected error and can't continue safely. Your last saved progress is still on
          disk - reloading will try to pick up from there. If it keeps happening, resetting the studio will clear the
          save and start fresh.
        </p>
        <p style={{ fontFamily: 'monospace', fontSize: '0.85em', color: 'var(--text-muted)', wordBreak: 'break-word' }}>
          {this.state.error.message}
        </p>
        <div className="row" style={{ gap: 8 }}>
          <Button variant="primary" onClick={this.handleReload}>Reload</Button>
          <Button onClick={this.handleResetStudio}>Reset Studio and Reload</Button>
        </div>
      </div>
    );
  }
}
