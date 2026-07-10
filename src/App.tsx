import { useEffect } from 'react';
import { StudioProvider, useStudio } from './state/StudioContext';
import { ThemeToggle } from './components/common/ThemeToggle';
import { DateBar } from './components/common/DateBar';
import { Dashboard } from './components/Dashboard';
import { DevelopFilm } from './components/wizard/DevelopFilm';
import { HireTalent } from './components/wizard/HireTalent';
import { ProductionPlanning } from './components/wizard/ProductionPlanning';
import { ProductionRun } from './components/wizard/ProductionRun';
import { PostProduction } from './components/wizard/PostProduction';
import { MarketingRelease } from './components/wizard/MarketingRelease';
import { ReleaseResults } from './components/wizard/ReleaseResults';
import type { Screen } from './types';

const DAY_TICK_MS = 3000;

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

  // Every screen switch (forward or back) starts scrolled to the top - a
  // long wizard screen doesn't otherwise reset scroll position on
  // navigation, which left the player dropped mid-page on whatever the
  // previous screen's scroll happened to be. Only fires on a genuine
  // screen change, not on every re-render within one screen (e.g. a
  // photography day ticking doesn't change state.screen).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.screen]);

  // Time keeps passing on its own outside the wizard - the Dashboard and
  // the post-release results screen both just sit there otherwise, with no
  // player action available to advance the calendar (and therefore settle
  // an older film's box office) until they start something new. Paused on
  // every planning screen above so a slow decision never costs a day.
  useEffect(() => {
    if (PLANNING_SCREENS.has(state.screen)) return;
    const timer = setInterval(() => dispatch({ type: 'ADVANCE_DAY' }), DAY_TICK_MS);
    return () => clearInterval(timer);
  }, [state.screen, dispatch]);

  switch (state.screen) {
    case 'dashboard':
      return <Dashboard />;
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
    default:
      return <Dashboard />;
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
