// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { buildStateWithReadyDraft } from '../../state/testFixtures';
import type { GameState } from '../../state/gameState';

let mockState: GameState;
vi.mock('../../state/StudioContext', () => ({ useStudio: () => ({ state: mockState, dispatch: vi.fn() }) }));

import { ActionFeedbackProvider, useActionFeedback, type ActionNotice } from './ActionFeedback';

/** A stand-in for any screen that reports a committed action. */
function Screen({ notice }: { notice: ActionNotice }) {
  const confirmAction = useActionFeedback();
  return (
    <button type="button" onClick={() => confirmAction(notice)}>
      Commit
    </button>
  );
}

function renderWithFeedback(notice: ActionNotice) {
  return render(
    <ActionFeedbackProvider>
      <Screen notice={notice} />
    </ActionFeedbackProvider>,
  );
}

describe('ActionFeedback', () => {
  beforeEach(() => {
    mockState = buildStateWithReadyDraft(1);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes a live region before it has anything to announce', () => {
    render(
      <ActionFeedbackProvider>
        <span>screen</span>
      </ActionFeedbackProvider>,
    );
    // Assistive tech only announces changes to a region that already existed,
    // so the very first notice would be swallowed by a lazily mounted one.
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('reports the verb, the subject and the consequence', () => {
    renderWithFeedback({
      kicker: 'Acquired',
      subject: 'The Last Signal',
      detail: 'Added to your Asset Library.',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(screen.getByText('Acquired')).toBeInTheDocument();
    expect(screen.getByText('The Last Signal')).toBeInTheDocument();
    expect(screen.getByText('Added to your Asset Library.')).toBeInTheDocument();
  });

  it('quotes the money that moved and the balance it left', () => {
    mockState = { ...mockState, studio: { ...mockState.studio, cash: 4_150_000 } };
    renderWithFeedback({ kicker: 'Acquired', subject: 'The Last Signal', amount: -250_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('£250,000')).toBeInTheDocument();
    // The balance is read live rather than snapshotted at confirm() time -
    // inside the caller's click handler, state still holds the pre-action cash.
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('£4,150,000')).toBeInTheDocument();
  });

  it('omits the figures entirely when nothing moved', () => {
    renderWithFeedback({ kicker: 'Bid placed', subject: 'The Last Signal' });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(screen.queryByText('Paid')).not.toBeInTheDocument();
    expect(screen.queryByText('Balance')).not.toBeInTheDocument();
  });

  it('labels a credit as received', () => {
    renderWithFeedback({ kicker: 'Prize money', subject: 'Academy Awards', amount: 1_200_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(screen.getByText('Received')).toBeInTheDocument();
  });

  it('runs its follow-up and clears itself', () => {
    const onClick = vi.fn();
    renderWithFeedback({
      kicker: 'Acquired',
      subject: 'The Last Signal',
      action: { label: 'Open Asset Library', onClick },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Asset Library' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByText('The Last Signal')).not.toBeInTheDocument();
  });

  it('can be dismissed by hand', () => {
    renderWithFeedback({ kicker: 'Acquired', subject: 'The Last Signal' });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('The Last Signal')).not.toBeInTheDocument();
  });

  it('clears itself after a while', () => {
    renderWithFeedback({ kicker: 'Acquired', subject: 'The Last Signal' });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    act(() => void vi.advanceTimersByTime(7000));
    expect(screen.queryByText('The Last Signal')).not.toBeInTheDocument();
  });

  it('holds a notice with a follow-up longer than a plain one', () => {
    renderWithFeedback({
      kicker: 'Acquired',
      subject: 'The Last Signal',
      action: { label: 'Open Asset Library', onClick: vi.fn() },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    act(() => void vi.advanceTimersByTime(7000));
    // Dismissing an action the player has not had time to reach for is worse
    // than a slightly stale receipt.
    expect(screen.getByText('The Last Signal')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(3000));
    expect(screen.queryByText('The Last Signal')).not.toBeInTheDocument();
  });

  it('keeps only the most recent few notices', () => {
    function Rapid() {
      const confirmAction = useActionFeedback();
      return (
        <button
          type="button"
          onClick={() => {
            for (const n of [1, 2, 3, 4]) confirmAction({ kicker: 'Acquired', subject: `Script ${n}` });
          }}
        >
          Commit
        </button>
      );
    }
    render(
      <ActionFeedbackProvider>
        <Rapid />
      </ActionFeedbackProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(screen.queryByText('Script 1')).not.toBeInTheDocument();
    expect(screen.getByText('Script 2')).toBeInTheDocument();
    expect(screen.getByText('Script 4')).toBeInTheDocument();
  });

  it('is inert outside a provider rather than throwing', () => {
    // Component tests mount individual screens without the app shell; a missing
    // receipt must never be why an unrelated test fails.
    expect(() => render(<Screen notice={{ kicker: 'Acquired', subject: 'x' }} />)).not.toThrow();
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Commit' }))).not.toThrow();
  });
});
