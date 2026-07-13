import type { WizardStep } from '../../types';

const STEP_ORDER: WizardStep[] = [
  'develop',
  'talent',
  'production-planning',
  'greenlight',
  'production',
  'post-production',
  'marketing',
  'results',
];

const STEP_LABELS: Record<WizardStep, string> = {
  develop: 'Develop',
  talent: 'Hire Talent',
  'production-planning': 'Plan Production',
  greenlight: 'Greenlight',
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
