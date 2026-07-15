import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft } from '../../state/selectors';
import { BudgetTracker } from '../common/BudgetTracker';
import { Button } from '../common/Button';

/**
 * Title strip + budget tracker + Abandon Project, pinned above the
 * workspace nav - replaces the per-screen WizardHeader every pre-greenlight
 * screen used to render on its own (PRODUCER_WORKSPACE_DESIGN.md). Abandon
 * Project used to live in each screen's own footer (HireTalent.tsx,
 * ProductionPlanning.tsx, the retired Greenlight.tsx) - now that the player
 * can leave from any section, one copy here is enough. Save & Exit isn't a
 * separate control here: the global Header's own "Dashboard" button already
 * dispatches RETURN_TO_DASHBOARD, which does exactly that (unfocus, keep
 * this project resumable) - see state/studioReducer.ts.
 */
export function ProjectWorkspaceHeader() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state);
  if (!draft) return null;

  return (
    <div className="wizard-header-sticky">
      <div className="row-between" style={{ alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>{draft.title || draft.script?.title || 'Untitled Film'}</h1>
        <Button onClick={() => dispatch({ type: 'ABANDON_PROJECT' })}>Abandon Project</Button>
      </div>
      <BudgetTracker />
    </div>
  );
}
