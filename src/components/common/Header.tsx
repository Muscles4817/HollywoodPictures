import { useStudio } from '../../state/StudioContext';
import { formatGameDate } from '../../engine/calendar';
import { inboxBadgeCount } from '../../engine/project';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';
import { TimeTickIndicator } from './TimeTickIndicator';
import type { TickSpeedMultiplier } from '../../constants';

export type DevTool = 'none' | 'recommendation' | 'outcome' | 'rival-finances';

interface HeaderProps {
  paused: boolean;
  onTogglePause: () => void;
  tickNonce: number;
  speedMultiplier: TickSpeedMultiplier;
  onSetSpeedMultiplier: (speed: TickSpeedMultiplier) => void;
  inboxOpen: boolean;
  onToggleInbox: () => void;
  devTool: DevTool;
  onSetDevTool: (tool: DevTool) => void;
}

/**
 * The one piece of persistent chrome, visible above every screen (including
 * dev tools and modals - see .app-header's z-index in index.css) and never
 * duplicated per-screen: Inbox, a Dashboard shortcut, the in-game date, the
 * background-tick pause/speed control, the dev-tool switcher, and the
 * theme toggle. All of it used to be five independently fixed-position
 * pieces (DateBar, ThemeToggle, an inline dev-tool row in App.tsx, Inbox's
 * own toggle, and TimeTickIndicator re-rendered separately inside Dashboard/
 * ProductionRun) - consolidated here as one real header now that all of it
 * is meant to be always-visible rather than screen-specific.
 */
export function Header({
  paused,
  onTogglePause,
  tickNonce,
  speedMultiplier,
  onSetSpeedMultiplier,
  inboxOpen,
  onToggleInbox,
  devTool,
  onSetDevTool,
}: HeaderProps) {
  const { state, dispatch } = useStudio();
  const { theme, toggleTheme } = useTheme();
  const badgeCount = inboxBadgeCount(state.projects, state.focusedProjectId);

  return (
    <header className="app-header">
      <div className="app-header__group">
        <Button
          className="btn-sm"
          variant={inboxOpen ? 'primary' : 'secondary'}
          onClick={onToggleInbox}
          aria-label="Open Inbox"
        >
          Inbox{badgeCount > 0 ? ` (${badgeCount})` : ''}
        </Button>

        <div className="app-header__date-pill">
          <Button
            variant="text"
            className="app-header__dashboard-button"
            onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}
          >
            Dashboard
          </Button>
          <span className="app-header__date">{formatGameDate(state.totalDays)}</span>
        </div>

        <TimeTickIndicator
          paused={paused}
          onTogglePause={onTogglePause}
          tickNonce={tickNonce}
          speedMultiplier={speedMultiplier}
          onSetSpeedMultiplier={onSetSpeedMultiplier}
        />
      </div>

      <div className="app-header__group app-header__group--dev">
        {devTool === 'none' ? (
          <>
            <Button className="btn-sm" onClick={() => onSetDevTool('recommendation')}>Dev: Recommendation Inspector</Button>
            <Button className="btn-sm" onClick={() => onSetDevTool('outcome')}>Dev: Outcome Inspector</Button>
            <Button className="btn-sm" onClick={() => onSetDevTool('rival-finances')}>Dev: Rival Finances</Button>
          </>
        ) : (
          <Button className="btn-sm" onClick={() => onSetDevTool('none')}>Back to Game</Button>
        )}
      </div>

      <div className="app-header__group">
        <Button className="btn-sm" onClick={toggleTheme} aria-label="Toggle dark mode">
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </Button>
      </div>
    </header>
  );
}
