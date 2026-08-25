import { useEffect, useRef, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { formatGameDateWithMonth } from '../../engine/calendar';
import { inboxBadgeCount } from '../../engine/project';
import { unreadBidCount } from '../../engine/bidNotifications';
import { unacknowledgedAwardHighlights } from '../../state/selectors';
import { Money } from '../common/Money';
import { DAY_TICK_MS, TICK_SPEED_MULTIPLIERS, type TickSpeedMultiplier } from '../../constants';

export interface SpineProps {
  paused: boolean;
  onTogglePause: () => void;
  tickNonce: number;
  speedMultiplier: TickSpeedMultiplier;
  onSetSpeedMultiplier: (speed: TickSpeedMultiplier) => void;
  inboxOpen: boolean;
  onOpenInbox: () => void;
  onOpenPalette: () => void;
  /** How many unread bid updates are still answerable - the thing that guards Play. */
  timeCriticalUnread: number;
  /** Resume anyway, past the guard. */
  onResumeAnyway: () => void;
}

/**
 * The time spine (docs/design/mockups/take-09-chassis.html; roadmap Phase 1).
 *
 * This is a promotion of `common/Header.tsx` rather than new machinery - the
 * clock, the transport, the speed control and the summed attention badge were
 * all already here, in a light bar that read as page furniture. What changes
 * is prominence and one behaviour: **a time-critical item now physically
 * guards Play.**
 *
 * That guard used to be `shouldConfirmResume()` (App.tsx) opening a modal
 * *after* the player pressed Resume - the game silently accepting the press
 * and then arguing with it. Now the reason the clock is held is visible on
 * every screen before it is pressed: the attention item sits immediately
 * before the transport, Play is marked as guarded, and pressing it opens the
 * held-clock bar rather than a dialog. The predicate is unchanged and still
 * unit-tested in App.test.ts; only the surface moved.
 */
export function Spine({
  paused,
  onTogglePause,
  tickNonce,
  speedMultiplier,
  onSetSpeedMultiplier,
  inboxOpen,
  onOpenInbox,
  onOpenPalette,
  timeCriticalUnread,
  onResumeAnyway,
}: SpineProps) {
  const { state } = useStudio();
  const [attnOpen, setAttnOpen] = useState(false);
  const attnRef = useRef<HTMLDivElement>(null);

  // The same sum the header badge always carried: project items needing
  // attention, unread bid mail, and unacknowledged award highlights - they all
  // live in the one Inbox overlay, so they share one count here.
  const badgeCount =
    inboxBadgeCount(state.projects, state.focusedProjectId, state.totalDays) +
    unreadBidCount(state.bidNotifications ?? []) +
    unacknowledgedAwardHighlights(state).length;

  const guarded = timeCriticalUnread > 0;

  // Click-away and Escape close the attention popover, the same affordances a
  // menu is expected to have.
  useEffect(() => {
    if (!attnOpen) return;
    function onDocClick(e: MouseEvent) {
      if (attnRef.current && !attnRef.current.contains(e.target as Node)) setAttnOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAttnOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [attnOpen]);

  function handlePlay() {
    // Pressing Play while the clock is held opens the reason instead of
    // arguing after the fact.
    if (paused && guarded) setAttnOpen(true);
    else if (paused) onTogglePause();
  }

  return (
    <>
      <header className="spine">
        <span className="spine-brand">{state.studio.name}</span>

        <div className="spine-clock">
          <span className="spine-clock__date typed">{formatGameDateWithMonth(state.totalDays)}</span>
          <span className="spine-clock__note">{paused ? 'Paused' : `Running ${speedMultiplier}×`}</span>
        </div>

        <div className="spine-transport" role="group" aria-label="Time">
          <button
            type="button"
            className="tbtn"
            aria-pressed={paused}
            aria-label="Pause time"
            title="Pause"
            onClick={() => !paused && onTogglePause()}
          >
            ❚❚
          </button>
          <button
            type="button"
            className={`tbtn${guarded && paused ? ' tbtn--guarded' : ''}`}
            aria-pressed={!paused}
            aria-label={guarded && paused ? 'Advance time - held, something needs you' : 'Advance time'}
            title={guarded && paused ? 'Held - something needs you' : 'Advance time'}
            onClick={handlePlay}
          >
            ▶
          </button>
          {TICK_SPEED_MULTIPLIERS.map((speed) => (
            <button
              key={speed}
              type="button"
              className="tbtn tbtn--speed"
              aria-pressed={speedMultiplier === speed}
              onClick={() => onSetSpeedMultiplier(speed)}
            >
              {speed}×
            </button>
          ))}
          {/* Fills over one real tick interval, so a screen that only changes
              every few seconds reads as counting down rather than frozen
              (docs/DESIGN.md 5.22). Remounted per tick to restart the CSS
              animation exactly in step with the interval. */}
          <span className="spine-tick" aria-hidden="true">
            {!paused && <span key={tickNonce} className="spine-tick__fill" style={{ animationDuration: `${DAY_TICK_MS / speedMultiplier}ms` }} />}
          </span>
        </div>

        <button type="button" className="spine-palette" onClick={onOpenPalette}>
          <span>Find anything…</span>
          <kbd>Ctrl K</kbd>
        </button>

        <span className="spine-cash">
          Cash <Money amount={state.studio.cash} />
        </span>

        <div className="spine-attn" ref={attnRef}>
          <button
            type="button"
            className={`attn${guarded ? ' attn--critical' : ''}`}
            aria-expanded={attnOpen}
            onClick={() => setAttnOpen((o) => !o)}
          >
            <span className="attn-dot" aria-hidden="true">●</span>
            {badgeCount > 0 ? `${badgeCount} need${badgeCount === 1 ? 's' : ''} you` : 'Nothing waiting'}
          </button>

          {attnOpen && (
            <div className="attn-pop">
              <h3>Waiting on you</h3>
              {guarded && (
                <div className="attn-item attn-item--critical">
                  <span className="attn-what">
                    Outbid on {timeCriticalUnread} auction{timeCriticalUnread === 1 ? '' : 's'} you can still win
                  </span>
                  <span className="attn-why">Holds the clock — raise before the weekly close, or let it run</span>
                </div>
              )}
              {badgeCount === 0 && !guarded && <p className="attn-empty">Nothing needs a decision right now.</p>}
              <div className="attn-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => { setAttnOpen(false); onOpenInbox(); }}>
                  {inboxOpen ? 'Inbox is open' : 'Open Inbox'}
                </button>
                {guarded && paused && (
                  <button type="button" className="btn btn-sm" onClick={() => { setAttnOpen(false); onResumeAnyway(); }}>
                    Let it run anyway
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {guarded && paused && (
        <div className="spine-guard" role="status">
          <span>
            <b>The clock is held.</b> A rival is outbidding you on {timeCriticalUnread} auction
            {timeCriticalUnread === 1 ? '' : 's'} you can still win.
          </span>
          <span className="spine-guard__actions">
            <button type="button" className="btn btn-sm" onClick={onOpenInbox}>Open Inbox</button>
            <button type="button" className="btn btn-sm" onClick={onResumeAnyway}>Let it run</button>
          </span>
        </div>
      )}
    </>
  );
}
