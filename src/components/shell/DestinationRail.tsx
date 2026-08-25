import { useStudio } from '../../state/StudioContext';
import { useTheme } from '../../hooks/useTheme';
import { DESTINATION_GROUPS, activeDestinationId, destinationsInGroup } from './destinations';
import type { DevTool } from './devTools';

interface DestinationRailProps {
  devTool: DevTool;
  onSetDevTool: (tool: DevTool) => void;
  onOpenGuide: () => void;
}

/**
 * Persistent global navigation on one edge - ART_DIRECTION.md §4, principle 3,
 * which until now the game did not satisfy: seven of these screens were
 * reachable only from a button row on the Dashboard, so "go to the Talent
 * Database" meant "go to the Dashboard first".
 *
 * A left rail rather than take 09's top tab strip, for a measured reason. That
 * strip renders eight destinations at abbreviated labels ("Talent",
 * "Calendar", "Market", "Stats") and omits two of the game's outright; the
 * real set is ten at full length, and `flex-wrap: wrap` on a horizontal strip
 * means those wrap to a second row and displace the content beneath. A
 * vertical list scales with the count; a horizontal one does not. Take 08's
 * `190px 1fr` shell is where this comes from, groups and all.
 *
 * The two takes only appear to disagree: 08 has the rail and no clock; 09 has
 * the spine and no rail. The spine is about *time*, the rail about *places*.
 */
export function DestinationRail({ devTool, onSetDevTool, onOpenGuide }: DestinationRailProps) {
  const { state, dispatch } = useStudio();
  const { theme, toggleTheme } = useTheme();
  const active = activeDestinationId(state.screen);

  return (
    <nav className="rail" aria-label="Studio navigation">
      {DESTINATION_GROUPS.map((group) => (
        <div key={group} className="rail-group">
          <h2 className="rail-group__label">{group}</h2>
          {destinationsInGroup(group).map((dest) => (
            <button
              key={dest.id}
              type="button"
              className="rail-item"
              aria-current={active === dest.id ? 'page' : undefined}
              onClick={() => dispatch(dest.action)}
            >
              {dest.label}
            </button>
          ))}
        </div>
      ))}

      {/* Utilities, not destinations - they open an overlay and leave you where
          you are, so they sit apart from the three groups above rather than
          reading as an eleventh place to go. */}
      <div className="rail-group rail-group--utility">
        <h2 className="rail-group__label">Studio tools</h2>
        <button type="button" className="rail-item" onClick={onOpenGuide}>How it works</button>
        <button type="button" className="rail-item" onClick={toggleTheme}>
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
      </div>

      {import.meta.env.DEV && (
        <div className="rail-group rail-group--dev">
          <h2 className="rail-group__label">Dev</h2>
          {devTool === 'none' ? (
            <>
              <button type="button" className="rail-item" onClick={() => onSetDevTool('recommendation')}>Recommendation</button>
              <button type="button" className="rail-item" onClick={() => onSetDevTool('outcome')}>Outcome</button>
              <button type="button" className="rail-item" onClick={() => onSetDevTool('rival-finances')}>Rival finances</button>
              <button type="button" className="rail-item" onClick={() => onSetDevTool('requirement-profile')}>Requirement profile</button>
            </>
          ) : (
            <button type="button" className="rail-item" onClick={() => onSetDevTool('none')}>← Back to game</button>
          )}
        </div>
      )}
    </nav>
  );
}
