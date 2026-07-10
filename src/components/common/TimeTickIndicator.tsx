import { DAY_TICK_MS } from '../../constants';
import { Button } from './Button';

interface TimeTickIndicatorProps {
  paused: boolean;
  onTogglePause: () => void;
  /** Bumped once per real tick (App.tsx) - remounts the fill bar below so its CSS animation restarts exactly in step with the actual interval. */
  tickNonce: number;
}

/**
 * Pause control for the background day-tick (App.tsx), plus a small bar
 * that fills up over the real tick interval - without it, a screen that
 * only visibly changes once every few seconds reads as frozen rather than
 * "counting down to the next day." See docs/DESIGN.md 5.22.
 */
export function TimeTickIndicator({ paused, onTogglePause, tickNonce }: TimeTickIndicatorProps) {
  return (
    <div className="time-tick-indicator">
      <Button onClick={onTogglePause}>{paused ? 'Resume Time' : 'Pause Time'}</Button>
      <div className="time-tick-bar-track">
        {paused ? (
          <span className="time-tick-paused-label">Paused</span>
        ) : (
          <div key={tickNonce} className="time-tick-bar-fill" style={{ animationDuration: `${DAY_TICK_MS}ms` }} />
        )}
      </div>
    </div>
  );
}
