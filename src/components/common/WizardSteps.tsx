import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft, deriveReachableWizardSteps } from '../../state/selectors';
import type { WizardStep } from '../../types';

// Post-greenlight only now - Develop/Hire Talent/Plan Production/Greenlight
// used to sit ahead of 'production' here, but they're the free-navigation
// Producer Workspace's territory now (PRODUCER_WORKSPACE_DESIGN.md), which
// has its own nav (components/projectWorkspace/ProjectWorkspaceNav.tsx)
// instead of this fixed numbered strip.
const STEP_ORDER: WizardStep[] = [
  'production',
  'post-production',
  'marketing',
  'results',
];

const STEP_LABELS: Record<WizardStep, string> = {
  production: 'Film It',
  'post-production': 'Post-Production',
  marketing: 'Market & Release',
  results: 'Results',
};

/**
 * Post-Production Redesign, Phase C (docs/DESIGN_REVIEW_post_production_redesign.md
 * section 3) - this used to be a purely visual step indicator (plain
 * `<span>`s, no click behavior at all). Now self-contained, the same
 * "fetches its own state" pattern components/common/BudgetTracker.tsx
 * already established inside this same WizardHeader composition, rather
 * than threading reachability/navigation props through every one of
 * WizardHeader's three callers (ProductionRun.tsx/PostProduction.tsx/
 * MarketingRelease.tsx unchanged either way). Reachable steps
 * (state/selectors.ts:deriveReachableWizardSteps) render as real buttons
 * dispatching GO_TO_STEP directly - now a free navigation for every
 * WizardStep (data/schedule.ts:STAGE_DURATIONS is empty), so there's no
 * calendar cost to a jump this nav wouldn't already reflect. Every other
 * step stays a plain, non-interactive pill, exactly as before.
 */
export function WizardSteps({ current }: { current: WizardStep }) {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state);
  const reachable = draft ? deriveReachableWizardSteps(draft) : [];
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <div className="wizard-steps">
      {STEP_ORDER.map((step, i) => {
        const classes = ['wizard-step'];
        if (step === current) classes.push('wizard-step-active');
        else if (i < currentIndex) classes.push('wizard-step-done');

        const label = `${i + 1}. ${STEP_LABELS[step]}`;
        const isClickable = step !== current && reachable.includes(step);
        if (!isClickable) {
          return (
            <span key={step} className={classes.join(' ')}>
              {label}
            </span>
          );
        }

        classes.push('wizard-step-clickable');
        return (
          <button
            key={step}
            type="button"
            className={classes.join(' ')}
            onClick={() => dispatch({ type: 'GO_TO_STEP', step })}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
