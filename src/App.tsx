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

function Screens() {
  const { state } = useStudio();

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
