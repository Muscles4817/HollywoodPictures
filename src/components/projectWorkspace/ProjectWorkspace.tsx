import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft } from '../../state/selectors';
import { ProjectWorkspaceHeader } from './ProjectWorkspaceHeader';
import { ProjectWorkspaceNav } from './ProjectWorkspaceNav';
import { ProductionSheet } from './ProductionSheet';
import { ProjectOverview } from './ProjectOverview';
import { ProjectProducers } from './ProjectProducers';
import { ProjectFinance } from './ProjectFinance';
import { HireTalent } from '../wizard/HireTalent';
import { ProductionPlanning } from '../wizard/ProductionPlanning';
import './ProjectWorkspace.css';

/**
 * The Producer Workspace shell. Cast & Crew and Production reuse
 * HireTalent.tsx/ProductionPlanning.tsx wholesale rather than being rebuilt.
 *
 * The landing view is now the production sheet rather than a tab: the five
 * sections cost the player the ability to see their own film all at once, so
 * they could neither read the shape of the decision nor see where the holes
 * were. The sheet is the map; the sections behind it are the depth, reached by
 * clicking the slot that needs work.
 *
 * The sections stay individually reachable from the nav. They are where the
 * deep decisions actually live, and a sheet that could only be entered one
 * slot at a time would be its own kind of tab.
 */
export function ProjectWorkspace() {
  const { state } = useStudio();
  const draft = deriveFocusedDraft(state);
  if (!draft) return null;

  return (
    <div className="stack">
      <ProjectWorkspaceHeader />
      <ProjectWorkspaceNav active={state.projectWorkspaceSection} />
      {state.projectWorkspaceSection === 'sheet' && <ProductionSheet />}
      {state.projectWorkspaceSection === 'overview' && <ProjectOverview />}
      {state.projectWorkspaceSection === 'cast-and-crew' && <HireTalent />}
      {state.projectWorkspaceSection === 'production' && <ProductionPlanning />}
      {state.projectWorkspaceSection === 'producers' && <ProjectProducers />}
      {state.projectWorkspaceSection === 'finance' && <ProjectFinance />}
    </div>
  );
}
