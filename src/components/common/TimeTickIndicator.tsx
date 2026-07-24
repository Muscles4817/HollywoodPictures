import { DAY_TICK_MS, TICK_SPEED_MULTIPLIERS, type TickSpeedMultiplier } from '../../constants';
import { Button } from './Button';

interface TimeTickIndicatorProps {
  paused: boolean;
  onTogglePause: () => void;
  /** Bumped once per real tick (App.tsx) - remounts the fill bar below so its CSS animation restarts exactly in step with the actual interval. */
  tickNonce: number;
  speedMultiplier: TickSpeedMultiplier;
  onSetSpeedMultiplier: (speed: TickSpeedMultiplier) => void;
}

/**
 * Pause control for the background day-tick (App.tsx), a 1x/2x/4x/8x
 * speed-up, and a small bar that fills up over the real tick interval -
 * without the bar, a screen that only visibly changes once every few
 * seconds reads as frozen rather than "counting down to the next day."
 * See docs/DESIGN.md 5.22.
 */
export function TimeTickIndicator({ paused, onTogglePause, tickNonce, speedMultiplier, onSetSpeedMultiplier }: TimeTickIndicatorProps) {
  return (
    <div className="time-tick-indicator">
      <Button onClick={onTogglePause}>{paused ? 'Resume Time' : 'Pause Time'}</Button>
      <div className="row" style={{ gap: 4 }}>
        {TICK_SPEED_MULTIPLIERS.map((speed) => (
          <Button
            key={speed}
            className="btn-sm"
            variant={speedMultiplier === speed ? 'primary' : 'secondary'}
            onClick={() => onSetSpeedMultiplier(speed)}
          >
            {speed}x
          </Button>
        ))}
      </div>
      <div className="time-tick-bar-track">
        {paused ? (
          <span className="time-tick-paused-label">Paused</span>
        ) : (
          <div key={tickNonce} className="time-tick-bar-fill" style={{ animationDuration: `${DAY_TICK_MS / speedMultiplier}ms` }} />
        )}
      </div>
    </div>
  );
}
