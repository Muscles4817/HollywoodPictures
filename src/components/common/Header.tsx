import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { saveState } from '../../state/persistence';
import { formatGameDateWithMonth } from '../../engine/calendar';
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

  // The game already autosaves on every state change (StudioContext), so this
  // is a "save now, and tell me it happened" affordance - an explicit persist
  // plus brief confirmation, for players who want the reassurance. The label
  // flips to a confirmation for a moment, then resets.
  const [justSaved, setJustSaved] = useState(false);
  const handleSave = () => {
    saveState(state);
    setJustSaved(true);
  };
  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [justSaved]);

  return (
    <header className="app-header">
      <div className="app-header__group">
        <Button
          className="btn-sm app-header__inbox-button"
          variant={inboxOpen ? 'primary' : 'secondary'}
          onClick={onToggleInbox}
          aria-label={badgeCount > 0 ? `Open Inbox - ${badgeCount} item${badgeCount === 1 ? '' : 's'} need attention` : 'Open Inbox'}
        >
          Inbox
          {badgeCount > 0 && <span className="app-header__inbox-badge">{badgeCount}</span>}
        </Button>

        <div className="app-header__date-pill">
          <Button
            variant="text"
            className="app-header__dashboard-button"
            onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}
          >
            Dashboard
          </Button>
          <span className="app-header__date">{formatGameDateWithMonth(state.totalDays)}</span>
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
        <Button
          className="btn-sm"
          variant={justSaved ? 'primary' : 'secondary'}
          onClick={handleSave}
          aria-label="Save game now"
        >
          {justSaved ? '✓ Saved' : '💾 Save'}
        </Button>
        <Button className="btn-sm" onClick={toggleTheme} aria-label="Toggle dark mode">
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </Button>
      </div>
    </header>
  );
}
