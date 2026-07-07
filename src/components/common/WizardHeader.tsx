import { WizardSteps } from './WizardSteps';
import { BudgetTracker } from './BudgetTracker';
import type { WizardStep } from '../../types';

/**
 * Step indicator + budget tracker, pinned to the top of the viewport while
 * scrolling. Several wizard screens (Hire Talent, Production Planning) get
 * long enough that the budget would otherwise scroll out of view exactly
 * when it matters most - mid-decision.
 */
export function WizardHeader({ current }: { current: WizardStep }) {
  return (
    <div className="wizard-header-sticky">
      <WizardSteps current={current} />
      <BudgetTracker />
    </div>
  );
}
