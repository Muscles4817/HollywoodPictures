import { useEffect, useRef, useState } from 'react';
import { StudioProvider, useStudio } from './state/StudioContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ThemeToggle } from './components/common/ThemeToggle';
import { DateBar } from './components/common/DateBar';
import { Inbox } from './components/common/Inbox';
import { Dashboard } from './components/Dashboard';
import { RivalStudioPage } from './components/RivalStudioPage';
import { StatsPage } from './components/StatsPage';
import { ReleaseCalendar } from './components/ReleaseCalendar';
import { RecommendationInspector } from './components/dev/RecommendationInspector';
import { OutcomeInspector } from './components/dev/OutcomeInspector';
import { RivalFinancesInspector } from './components/dev/RivalFinancesInspector';
import { Button } from './components/common/Button';
import { DevelopFilm } from './components/wizard/DevelopFilm';
import { HireTalent } from './components/wizard/HireTalent';
import { ProductionPlanning } from './components/wizard/ProductionPlanning';
import { Greenlight } from './components/wizard/Greenlight';
import { ProductionRun } from './components/wizard/ProductionRun';
import { PostProduction } from './components/wizard/PostProduction';
import { MarketingRelease } from './components/wizard/MarketingRelease';
import { ReleaseResults } from './components/wizard/ReleaseResults';
import { OpportunityMarket } from './components/OpportunityMarket';
import { AssetLibrary } from './components/AssetLibrary';
import { ProjectsPage } from './components/ProjectsPage';
import type { Screen } from './types';
import { DAY_TICK_MS, type TickSpeedMultiplier } from './constants';

// Every wizard screen where the player is setting choices with no clock
// pressure of its own - paused here so a slow decision never costs real
// calendar time. 'production' is excluded too, but for a different reason:
// it already runs its own faster, dedicated tick the moment photography
// begins (ProductionRun.tsx) - this background tick would otherwise double
// up with it, or fire uselessly while the player is just reviewing the
// pre-shoot risk profile.
const PLANNING_SCREENS = new Set<Screen>(['develop', 'talent', 'production-planning', 'greenlight', 'production', 'post-production', 'marketing']);

// Screens that are a pure read-only detour from the Dashboard - entering or
// leaving them costs no calendar time of its own (VIEW_RIVAL_STUDIO/
// VIEW_STATS/VIEW_RELEASE_CALENDAR are plain screen changes, see
// studioReducer.ts), so a pause the player set intentionally shouldn't
// silently lift just because they ducked in to check a rival's page, the
// stats table, or the release calendar.
const PAUSE_PERSISTING_SCREENS = new Set<Screen>(['rival-studio', 'stats', 'release-calendar', 'opportunity-market', 'asset-library', 'projects']);

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

function Screens() {
  const { state, dispatch } = useStudio();
  // A manual pause on the background day-tick (Dashboard's pause button) -
  // deliberately not persisted anywhere and reset on every screen change
  // (below), so it can never silently leave time stuck paused on a screen
  // the player has since moved away from and forgotten about.
  const [paused, setPaused] = useState(false);
  // Bumped every real tick so the tick-progress bar (Dashboard) can restart
  // its CSS animation in sync with the actual interval, instead of running
  // its own separate, potentially-drifting timer.
  const [tickNonce, setTickNonce] = useState(0);
  // Whether the Inbox overlay is open - folded into `ticking` below so
  // resolving a background shoot's paused decision doesn't cost real time
  // either, the same reasoning as the manual pause button.
  const [inboxOpen, setInboxOpen] = useState(false);
  // A fast-forward multiplier for the Dashboard's own tick, same
  // session-only lifetime as `paused` - it's a "how fast am I watching this
  // right now" preference, not game state, so it never persists to a save.
  // Selecting it doesn't reset on screen change like `paused` does: it just
  // has no effect anywhere but the Dashboard (see `effectiveTickMs` below),
  // so there's nothing to silently leave engaged on another screen.
  const [speedMultiplier, setSpeedMultiplier] = useState<TickSpeedMultiplier>(1);

  // Every screen switch (forward or back) starts scrolled to the top - a
  // long wizard screen doesn't otherwise reset scroll position on
  // navigation, which left the player dropped mid-page on whatever the
  // previous screen's scroll happened to be. Only fires on a genuine
  // screen change, not on every re-render within one screen (e.g. a
  // photography day ticking doesn't change state.screen).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.screen]);

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

  const viewingBackgroundProduction = isViewingBackgroundProduction(state.screen, state.viewingProductionId);
  const ticking = computeTicking(state.screen, state.viewingProductionId, paused, inboxOpen);

  // The selected speed only ever applies while actually watching a tick by -
  // Dashboard, or a backgrounded production being watched via its own
  // TimeTickIndicator (ProductionRun.tsx) - everywhere else falls back to
  // the base interval even if a faster one is selected, so leaving the
  // screen that's actually showing the indicator can't silently blow
  // through days unwatched.
  const effectiveTickMs = state.screen === 'dashboard' || viewingBackgroundProduction ? DAY_TICK_MS / speedMultiplier : DAY_TICK_MS;

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
        return (
          <Dashboard
            paused={paused}
            onTogglePause={() => setPaused((p) => !p)}
            tickNonce={tickNonce}
            speedMultiplier={speedMultiplier}
            onSetSpeedMultiplier={setSpeedMultiplier}
          />
        );
      case 'develop':
        return <DevelopFilm />;
      case 'talent':
        return <HireTalent />;
      case 'production-planning':
        return <ProductionPlanning />;
      case 'greenlight':
        return <Greenlight />;
      case 'production':
        return (
          <ProductionRun
            paused={paused}
            onTogglePause={() => setPaused((p) => !p)}
            tickNonce={tickNonce}
            speedMultiplier={speedMultiplier}
            onSetSpeedMultiplier={setSpeedMultiplier}
          />
        );
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
      default:
        return (
          <Dashboard
            paused={paused}
            onTogglePause={() => setPaused((p) => !p)}
            tickNonce={tickNonce}
            speedMultiplier={speedMultiplier}
            onSetSpeedMultiplier={setSpeedMultiplier}
          />
        );
    }
  }

  return (
    <>
      <Inbox open={inboxOpen} onOpenChange={setInboxOpen} />
      {renderScreen()}
    </>
  );
}

type DevTool = 'none' | 'recommendation' | 'outcome' | 'rival-finances';

function App() {
  // A developer-only detour, not part of the game's own screen/navigation
  // system on purpose (see components/dev/RecommendationInspector.tsx,
  // components/dev/OutcomeInspector.tsx and
  // components/dev/RivalFinancesInspector.tsx) - never mutates GameState
  // (RivalFinancesInspector reads it read-only, to inspect a real save;
  // Recommendation/Outcome Inspector don't touch it at all), never
  // persisted, reachable from any screen.
  const [devTool, setDevTool] = useState<DevTool>('none');

  return (
    <ErrorBoundary>
      <StudioProvider>
        <DateBar />
        <ThemeToggle />
        <div className="dev-inspector-toggle-fixed row" style={{ gap: 8 }}>
          {devTool === 'none' ? (
            <>
              <Button onClick={() => setDevTool('recommendation')}>Dev: Recommendation Inspector</Button>
              <Button onClick={() => setDevTool('outcome')}>Dev: Outcome Inspector</Button>
              <Button onClick={() => setDevTool('rival-finances')}>Dev: Rival Finances</Button>
            </>
          ) : (
            <Button onClick={() => setDevTool('none')}>Back to Game</Button>
          )}
        </div>
        {devTool === 'recommendation' && <RecommendationInspector />}
        {devTool === 'outcome' && <OutcomeInspector />}
        {devTool === 'rival-finances' && <RivalFinancesInspector />}
        {devTool === 'none' && <Screens />}
      </StudioProvider>
    </ErrorBoundary>
  );
}

export default App;
