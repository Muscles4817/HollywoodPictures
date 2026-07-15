import { useStudio } from '../../state/StudioContext';
import { formatGameDate } from '../../engine/calendar';
import { Button } from './Button';

/**
 * Persistent left-side header chrome, visible on every screen (including
 * dev tools) alongside ThemeToggle - see App.tsx. A Dashboard shortcut and
 * the in-game date used to be duplicated across dozens of individual
 * screens; now that both live here permanently, those per-screen copies
 * were removed rather than kept as redundant duplicates.
 */
export function DateBar() {
  const { state, dispatch } = useStudio();
  return (
    <div className="date-bar">
      <Button
        variant="text"
        className="date-bar__dashboard-button"
        onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}
      >
        Dashboard
      </Button>
      <span className="date-bar__date">{formatGameDate(state.totalDays)}</span>
    </div>
  );
}
