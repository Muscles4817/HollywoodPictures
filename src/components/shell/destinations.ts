import type { GameAction } from '../../state/gameState';
import type { Screen } from '../../types';

/**
 * The studio's destinations - one of the chassis's two navigation axes
 * (docs/design/mockups/take-09-chassis.html; roadmap Phase 1). The other axis
 * is the slate, which carries films in flight; a project is a *context*, not a
 * peer of "Dashboard", which is why it does not appear here.
 *
 * A single registry rather than a hand-written list of buttons, because three
 * separate surfaces need the same set and must not drift: the rail, the
 * command palette, and the active-destination reading. Retiring Dashboard's
 * own `.dashboard-subnav` in favour of this is the point - that row was the
 * only route to seven of these screens, and it existed on exactly one screen.
 */
export type DestinationGroup = 'Studio' | 'Market' | 'Record';

export const DESTINATION_GROUPS: DestinationGroup[] = ['Studio', 'Market', 'Record'];

export interface Destination {
  id: string;
  label: string;
  group: DestinationGroup;
  /**
   * Every screen that should read as "you are here". Most destinations own
   * exactly one; the list exists for the ones that will own more as the
   * redesign proceeds, and so the reading is data rather than a switch.
   */
  screens: Screen[];
  action: GameAction;
  /** Extra words the command palette should match on, beyond the label. */
  keywords?: string[];
}

/**
 * Rival studios are deliberately absent. `VIEW_RIVAL_STUDIO` needs a studio
 * name, and the game has no rivals *index* to land on - rivals are reached
 * from the release calendar and the competition panel, which is a detour from
 * a context rather than a destination in its own right.
 */
export const DESTINATIONS: Destination[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Studio', screens: ['dashboard'], action: { type: 'RETURN_TO_DASHBOARD' }, keywords: ['home', 'desk'] },
  { id: 'projects', label: 'Projects', group: 'Studio', screens: ['projects'], action: { type: 'VIEW_PROJECTS' }, keywords: ['slate', 'films'] },
  { id: 'talent', label: 'Talent', group: 'Studio', screens: ['talent-database'], action: { type: 'VIEW_TALENT_DATABASE' }, keywords: ['actors', 'directors', 'crew', 'casting'] },
  { id: 'assets', label: 'Asset Library', group: 'Studio', screens: ['asset-library'], action: { type: 'VIEW_ASSET_LIBRARY' }, keywords: ['scripts', 'owned'] },
  { id: 'ip', label: 'Intellectual Property', group: 'Studio', screens: ['ip-library'], action: { type: 'VIEW_IP_LIBRARY' }, keywords: ['rights', 'franchise', 'sequels'] },

  { id: 'opportunities', label: 'Opportunities', group: 'Market', screens: ['opportunity-market'], action: { type: 'VIEW_OPPORTUNITY_MARKET' }, keywords: ['market', 'acquire', 'buy', 'bid'] },
  { id: 'calendar', label: 'Release Calendar', group: 'Market', screens: ['release-calendar'], action: { type: 'VIEW_RELEASE_CALENDAR' }, keywords: ['dates', 'schedule', 'crowding'] },

  { id: 'awards', label: 'Awards', group: 'Record', screens: ['awards'], action: { type: 'VIEW_AWARDS' }, keywords: ['academy', 'ceremony', 'season'] },
  { id: 'stats', label: 'Statistics', group: 'Record', screens: ['stats'], action: { type: 'VIEW_STATS' }, keywords: ['history', 'box office', 'performance'] },
  { id: 'milestones', label: 'Milestones', group: 'Record', screens: ['milestones'], action: { type: 'VIEW_MILESTONES' }, keywords: ['records', 'achievements'] },
];

/**
 * Which destination, if any, the current screen belongs to. Returns null on a
 * project screen (workspace, the wizard chronology) on purpose: those are the
 * slate's axis, and lighting up a destination there would claim the player is
 * somewhere they are not.
 */
export function activeDestinationId(screen: Screen): string | null {
  return DESTINATIONS.find((d) => d.screens.includes(screen))?.id ?? null;
}

export function destinationsInGroup(group: DestinationGroup): Destination[] {
  return DESTINATIONS.filter((d) => d.group === group);
}
