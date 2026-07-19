import { useEffect, useRef, useState } from 'react';
import { StudioProvider, useStudio } from './state/StudioContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Header, type DevTool } from './components/common/Header';
import { Inbox } from './components/common/Inbox';
import { Dashboard } from './components/Dashboard';
import { RivalStudioPage } from './components/RivalStudioPage';
import { StatsPage } from './components/StatsPage';
import { AwardsPage } from './components/AwardsPage';
import { ReleaseCalendar } from './components/ReleaseCalendar';
import { RecommendationInspector } from './components/dev/RecommendationInspector';
import { OutcomeInspector } from './components/dev/OutcomeInspector';
import { RivalFinancesInspector } from './components/dev/RivalFinancesInspector';
import { ProjectWorkspace } from './components/projectWorkspace/ProjectWorkspace';
import { ProductionRun } from './components/wizard/ProductionRun';
import { PostProduction } from './components/wizard/PostProduction';
import { MarketingRelease } from './components/wizard/MarketingRelease';
import { ReleaseResults } from './components/wizard/ReleaseResults';
import { OpportunityMarket } from './components/OpportunityMarket';
import { AssetLibrary } from './components/AssetLibrary';
import { ProjectsPage } from './components/ProjectsPage';
import type { ProjectWorkspaceSection, Screen } from './types';
import { DAY_TICK_MS, type TickSpeedMultiplier } from './constants';

// Every wizard screen where the player is setting choices with no clock
// pressure of its own - paused here so a slow decision never costs real
// calendar time. 'production' is excluded too, but for a different reason:
// it already runs its own faster, dedicated tick the moment photography
// begins (ProductionRun.tsx) - this background tick would otherwise double
// up with it, or fire uselessly while the player is just reviewing the
// pre-shoot risk profile.
const PLANNING_SCREENS = new Set<Screen>(['workspace', 'production', 'post-production', 'marketing']);

// Screens that are a pure read-only detour from the Dashboard - entering or
// leaving them costs no calendar time of its own (VIEW_RIVAL_STUDIO/
// VIEW_STATS/VIEW_RELEASE_CALENDAR are plain screen changes, see
// studioReducer.ts), so a pause the player set intentionally shouldn't
// silently lift just because they ducked in to check a rival's page, the
// stats table, or the release calendar.
const PAUSE_PERSISTING_SCREENS = new Set<Screen>(['rival-studio', 'stats', 'release-calendar', 'opportunity-market', 'asset-library', 'projects', 'awards']);

/**
 * Whether the background ADVANCE_DAY tick should be running right now - a
 * pure function (not inlined in Screens() below) specifically so this can
 * be unit-tested directly, without mounting the whole app and juggling fake
 * timers. 'production' is a genuine exception to PLANNING_SCREENS' own
 * exclusion when the player is merely *viewing* a backgrounded production
 * (viewingProductionId set, reachable only from Dashboard's Shooting card -
 * see ProductionRun.tsx) rather than running their own live draft's shoot:
 * a backgrounded production has no dedicated tick of its own while it's
 * being looked at (ProductionRun.tsx's local interval deliberately refuses
 * to start when viewingProductionId is set - it only ever advances the live
 * draft), so it only ever progresses via this background tick. Without this
 * carve-out, simply opening the page to check on a background shoot froze
 * its day count for as long as the player stayed there - the same "pure
 * read-only detour" bug PAUSE_PERSISTING_SCREENS already prevents for
 * rival-studio/stats, just missed here because 'production' is normally
 * excluded for the opposite reason (own-draft filming already ticks fast
 * enough on its own). Viewing your own live draft's shoot
 * (viewingProductionId === null on 'production') is unaffected -
 * PLANNING_SCREENS still pauses this background tick there, exactly as
 * before.
 */
export function isViewingBackgroundProduction(screen: Screen, viewingProductionId: string | null): boolean {
  return screen === 'production' && viewingProductionId !== null;
}

export function computeTicking(
  screen: Screen,
  viewingProductionId: string | null,
  paused: boolean,
  inboxOpen: boolean,
): boolean {
  const backgroundProductionViewed = isViewingBackgroundProduction(screen, viewingProductionId);
  return (!PLANNING_SCREENS.has(screen) || backgroundProductionViewed) && !paused && !inboxOpen;
}

// The full "which page is the player on" reading - every field the browser
// history wiring below (and state/gameState.ts:RESTORE_NAVIGATION) treats as
// one navigable "page." Mirrors exactly the five GameState fields TOGGLE/
// VIEW_*/OPEN_PROJECT_WORKSPACE_SECTION actions themselves set, since
// restoring a workspace tab or a detour view on Back/Forward needs the same
// fields a normal in-game navigation does.
interface NavigationSnapshot {
  screen: Screen;
  focusedProjectId: string | null;
  projectWorkspaceSection: ProjectWorkspaceSection;
  viewingRivalStudioName: string | null;
  viewingProductionId: string | null;
}

function navigationSnapshotOf(state: NavigationSnapshot): NavigationSnapshot {
  return {
    screen: state.screen,
    focusedProjectId: state.focusedProjectId,
    projectWorkspaceSection: state.projectWorkspaceSection,
    viewingRivalStudioName: state.viewingRivalStudioName,
    viewingProductionId: state.viewingProductionId,
  };
}

function AppShell() {
  const { state, dispatch } = useStudio();
  // A manual pause on the background day-tick (Header's pause button) -
  // deliberately not persisted anywhere and reset on every screen change
  // (below), so it can never silently leave time stuck paused on a screen
  // the player has since moved away from and forgotten about.
  const [paused, setPaused] = useState(false);
  // Bumped every real tick so the tick-progress bar (Header) can restart
  // its CSS animation in sync with the actual interval, instead of running
  // its own separate, potentially-drifting timer.
  const [tickNonce, setTickNonce] = useState(0);
  // Whether the Inbox overlay is open - folded into `ticking` below so
  // resolving a background shoot's paused decision doesn't cost real time
  // either, the same reasoning as the manual pause button.
  const [inboxOpen, setInboxOpen] = useState(false);
  // A fast-forward multiplier for the background tick, same session-only
  // lifetime as `paused` - it's a "how fast am I watching this right now"
  // preference, not game state, so it never persists to a save.
  // Selecting it doesn't reset on screen change like `paused` does: the
  // header is always showing it, so there's nothing to silently leave
  // engaged on "another screen" the way there was when this control only
  // existed on the Dashboard.
  const [speedMultiplier, setSpeedMultiplier] = useState<TickSpeedMultiplier>(1);
  // A developer-only detour, not part of the game's own screen/navigation
  // system on purpose (see components/dev/RecommendationInspector.tsx,
  // components/dev/OutcomeInspector.tsx and
  // components/dev/RivalFinancesInspector.tsx) - never mutates GameState
  // (RivalFinancesInspector reads it read-only, to inspect a real save;
  // Recommendation/Outcome Inspector don't touch it at all), never
  // persisted, reachable from any screen via the header.
  const [devTool, setDevTool] = useState<DevTool>('none');

  // Spacebar toggles the same manual pause the header's own Pause/Resume
  // button does - a common enough game convention that it's worth wiring up
  // globally rather than only from that one button. Skipped while focus is
  // on an interactive element (a text field, a range slider, a button, ...)
  // so it doesn't hijack space's own native behavior there (typing a space,
  // dragging a slider, activating a focused button) - a focused Pause button
  // in particular would otherwise double-toggle: once from the browser's own
  // "space activates the focused button" behavior, once from this handler.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const active = document.activeElement;
      const isInteractive =
        active instanceof HTMLElement &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.tagName === 'BUTTON' ||
          active.isContentEditable);
      if (isInteractive) return;
      e.preventDefault(); // stop the page from scrolling on space
      setPaused((p) => !p);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Every screen switch (forward or back) starts scrolled to the top - a
  // long wizard screen doesn't otherwise reset scroll position on
  // navigation, which left the player dropped mid-page on whatever the
  // previous screen's scroll happened to be. Only fires on a genuine
  // screen change, not on every re-render within one screen (e.g. a
  // photography day ticking doesn't change state.screen).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.screen]);

  // Makes the browser's own Back/Forward buttons move through the game's
  // in-game navigation history instead of leaving the app (or doing nothing,
  // with no history entries of our own). Every distinct screen/focused-
  // project/workspace-tab/detour combination pushes its own history entry,
  // carrying the full NavigationSnapshot as history.state rather than just a
  // screen name; RESTORE_NAVIGATION (state/studioReducer.ts) is what
  // actually applies it once popped. Guarded by lastPushedSnapshotRef so
  // this doesn't push a *second* entry for the same navigation it's already
  // pushed one for, and - critically - doesn't push at all when the state
  // change it's reacting to was itself a pop (see the popstate handler
  // below, which updates the ref before dispatching).
  const lastPushedSnapshotRef = useRef<string | null>(null);
  const isFirstNavigationRef = useRef(true);
  useEffect(() => {
    const snapshot = navigationSnapshotOf(state);
    const key = JSON.stringify(snapshot);
    if (key === lastPushedSnapshotRef.current) return;
    lastPushedSnapshotRef.current = key;
    // The very first entry (the page's own initial load) has no state of
    // ours on it yet - replace it in place rather than pushing on top, so
    // Back from the second "page" lands on a real snapshot (the starting
    // Dashboard) instead of an empty one.
    if (isFirstNavigationRef.current) {
      isFirstNavigationRef.current = false;
      window.history.replaceState(snapshot, '');
    } else {
      window.history.pushState(snapshot, '');
    }
  }, [state.screen, state.focusedProjectId, state.projectWorkspaceSection, state.viewingRivalStudioName, state.viewingProductionId]);

  useEffect(() => {
    function handlePopState(e: PopStateEvent) {
      const snapshot = e.state as NavigationSnapshot | null;
      if (!snapshot) return; // predates our own history entries - nothing to restore
      lastPushedSnapshotRef.current = JSON.stringify(snapshot);
      dispatch({ type: 'RESTORE_NAVIGATION', ...snapshot });
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dispatch]);

  // A screen change clears any manual pause - see `paused` above. Most
  // time-costing player actions (GO_TO_STEP, RELEASE_FILM) are themselves
  // screen transitions, so this is what makes pausing "toggle off if the
  // player does something that requires time to pass" true in practice.
  // PAUSE_PERSISTING_SCREENS are the exception: entering or leaving one is a
  // pure read-only detour (VIEW_RIVAL_STUDIO/VIEW_STATS don't touch the
  // calendar, see studioReducer.ts) with no time cost of its own, same as
  // opening a modal - without this, ducking in to check a rival's page or
  // the stats table would silently resume a pause the player set
  // intentionally, resuming for real once they returned to whatever screen
  // they paused it on.
  const prevScreenRef = useRef(state.screen);
  useEffect(() => {
    const prevScreen = prevScreenRef.current;
    prevScreenRef.current = state.screen;
    const isPauseExemptDetour = PAUSE_PERSISTING_SCREENS.has(prevScreen) || PAUSE_PERSISTING_SCREENS.has(state.screen);
    if (!isPauseExemptDetour) setPaused(false);
  }, [state.screen]);

  const ticking = computeTicking(state.screen, state.viewingProductionId, paused, inboxOpen);

  // The selected speed applies on any screen where the background tick is
  // actually running - the control lives in the header now, always visible,
  // so there's no "screen actually showing the indicator" to restrict it to
  // any more (that restriction existed only because the indicator itself
  // used to be screen-scoped, see docs/DESIGN.md 5.22/5.24 history - the
  // header consolidation superseded it).
  const effectiveTickMs = DAY_TICK_MS / speedMultiplier;

  // Time keeps passing on its own outside the wizard - the Dashboard and
  // the post-release results screen both just sit there otherwise, with no
  // player action available to advance the calendar (and therefore settle
  // an older film's box office) until they start something new. Paused on
  // every planning screen above so a slow decision never costs a day, and
  // pausable by hand from the Dashboard.
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => {
      dispatch({ type: 'ADVANCE_DAY' });
      setTickNonce((n) => n + 1);
    }, effectiveTickMs);
    return () => clearInterval(timer);
  }, [ticking, effectiveTickMs, dispatch]);

  function renderScreen() {
    switch (state.screen) {
      case 'dashboard':
        return <Dashboard />;
      case 'workspace':
        return <ProjectWorkspace />;
      case 'production':
        return <ProductionRun />;
      case 'post-production':
        return <PostProduction />;
      case 'marketing':
        return <MarketingRelease />;
      case 'results':
        return <ReleaseResults />;
      case 'rival-studio':
        return <RivalStudioPage />;
      case 'stats':
        return <StatsPage />;
      case 'release-calendar':
        return <ReleaseCalendar />;
      case 'opportunity-market':
        return <OpportunityMarket />;
      case 'asset-library':
        return <AssetLibrary />;
      case 'projects':
        return <ProjectsPage />;
      case 'awards':
        return <AwardsPage />;
      default:
        return <Dashboard />;
    }
  }

  return (
    <>
      <Header
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        tickNonce={tickNonce}
        speedMultiplier={speedMultiplier}
        onSetSpeedMultiplier={setSpeedMultiplier}
        inboxOpen={inboxOpen}
        onToggleInbox={() => setInboxOpen((o) => !o)}
        devTool={devTool}
        onSetDevTool={setDevTool}
      />
      <Inbox open={inboxOpen} onClose={() => setInboxOpen(false)} />
      {devTool === 'recommendation' && <RecommendationInspector />}
      {devTool === 'outcome' && <OutcomeInspector />}
      {devTool === 'rival-finances' && <RivalFinancesInspector />}
      {devTool === 'none' && renderScreen()}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <StudioProvider>
        <AppShell />
      </StudioProvider>
    </ErrorBoundary>
  );
}

export default App;
