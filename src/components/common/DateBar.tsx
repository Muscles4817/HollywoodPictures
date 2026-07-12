import { useStudio } from '../../state/StudioContext';
import { formatGameDate } from '../../engine/calendar';

/** The in-game date, visible on every screen - the only other persistent chrome besides ThemeToggle (see App.tsx). */
export function DateBar() {
  const { state } = useStudio();
  return <div className="date-bar">{formatGameDate(state.totalDays)}</div>;
}
