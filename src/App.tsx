import { useEffect, useState } from 'react';
import { StudioProvider, useStudio } from './state/StudioContext';
import { ThemeToggle } from './components/common/ThemeToggle';
import { DateBar } from './components/common/DateBar';
import { Dashboard } from './components/Dashboard';
import { RivalStudioPage } from './components/RivalStudioPage';
import { DevelopFilm } from './components/wizard/DevelopFilm';
import { HireTalent } from './components/wizard/HireTalent';
import { ProductionPlanning } from './components/wizard/ProductionPlanning';
import { ProductionRun } from './components/wizard/ProductionRun';
import { PostProduction } from './components/wizard/PostProduction';
import { MarketingRelease } from './components/wizard/MarketingRelease';
import { ReleaseResults } from './components/wizard/ReleaseResults';
import type { Screen } from './types';
import { DAY_TICK_MS } from './constants';

// Every wizard screen where the player is setting choices with no clock
// pressure of its own - paused here so a slow decision never costs real
// calendar time. 'production' is excluded too, but for a different reason:
// it already runs its own faster, dedicated tick the moment photography
// begins (ProductionRun.tsx) - this background tick would otherwise double
// up with it, or fire uselessly while the player is just reviewing the
// pre-shoot risk profile.
const PLANNING_SCREENS = new Set<Screen>(['develop', 'talent', 'production-planning', 'production', 'post-production', 'marketing']);

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
  useEffect(() => {
    setPaused(false);
  }, [state.screen]);

  const ticking = !PLANNING_SCREENS.has(state.screen) && !paused;

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
    }, DAY_TICK_MS);
    return () => clearInterval(timer);
  }, [ticking, dispatch]);

  switch (state.screen) {
    case 'dashboard':
      return <Dashboard paused={paused} onTogglePause={() => setPaused((p) => !p)} tickNonce={tickNonce} />;
    case 'develop':
      return <DevelopFilm />;
    case 'talent':
      return <HireTalent />;
    case 'production-planning':
      return <ProductionPlanning />;
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
    default:
      return <Dashboard paused={paused} onTogglePause={() => setPaused((p) => !p)} tickNonce={tickNonce} />;
  }
}

function App() {
  return (
    <StudioProvider>
      <DateBar />
      <ThemeToggle />
      <Screens />
    </StudioProvider>
  );
}

export default App;
