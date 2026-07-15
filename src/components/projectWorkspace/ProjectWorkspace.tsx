import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft } from '../../state/selectors';
import { ProjectWorkspaceHeader } from './ProjectWorkspaceHeader';
import { ProjectWorkspaceNav } from './ProjectWorkspaceNav';
import { ProjectOverview } from './ProjectOverview';
import { ProjectFinance } from './ProjectFinance';
import { HireTalent } from '../wizard/HireTalent';
import { ProductionPlanning } from '../wizard/ProductionPlanning';
import './ProjectWorkspace.css';

/**
 * The Producer Workspace shell (PRODUCER_WORKSPACE_DESIGN.md) - replaces
 * the old linear Develop -> Hire Talent -> Plan Production -> Greenlight
 * wizard with free navigation between named sections, all reading/writing
 * the same FilmDraft. Cast & Crew and Production reuse HireTalent.tsx/
 * ProductionPlanning.tsx wholesale (stripped of their own header/footer
 * nav, see those files) rather than being rebuilt - only Overview and
 * Finance are genuinely new. Phase 1 deliberately keeps Director bundled
 * into Cast & Crew rather than splitting it into its own tab (see the
 * implementation plan) - a distinct Director section is deferred until
 * there's actually distinct content to put there.
 */
export function ProjectWorkspace() {
  const { state } = useStudio();
  const draft = deriveFocusedDraft(state);
  if (!draft) return null;

  return (
    <div className="stack">
      <ProjectWorkspaceHeader />
      <ProjectWorkspaceNav active={state.projectWorkspaceSection} />
      {state.projectWorkspaceSection === 'overview' && <ProjectOverview />}
      {state.projectWorkspaceSection === 'cast-and-crew' && <HireTalent />}
      {state.projectWorkspaceSection === 'production' && <ProductionPlanning />}
      {state.projectWorkspaceSection === 'finance' && <ProjectFinance />}
    </div>
  );
}
