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

export function WizardSteps({ current }: { current: WizardStep }) {
  const currentIndex = STEP_ORDER.indexOf(current);
  return (
    <div className="wizard-steps">
      {STEP_ORDER.map((step, i) => {
        const classes = ['wizard-step'];
        if (step === current) classes.push('wizard-step-active');
        else if (i < currentIndex) classes.push('wizard-step-done');
        return (
          <span key={step} className={classes.join(' ')}>
            {i + 1}. {STEP_LABELS[step]}
          </span>
        );
      })}
    </div>
  );
}
