import { useEffect, type ReactNode } from 'react';
import { useStudio } from '../../state/StudioContext';
import {
  BUDGET_LEVEL_PROFILES,
  SHOOTING_STYLE_PROFILES,
  SET_QUALITY_PROFILES,
  PRACTICAL_EFFECTS_PROFILES,
  VFX_SPEND_PROFILES,
  RUNTIME_TARGET_PROFILES,
} from '../../data/production';
import { pluckDescriptions } from '../../data/describe';
import { GENRE_PROFILES } from '../../data/genres';
import { computeProductionBudgetCost } from '../../engine/cost';
import { computeCommittedSpend } from '../../state/selectors';
import { BudgetTracker } from '../common/BudgetTracker';
import { TierSlider } from '../common/TierSlider';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { WizardSteps } from '../common/WizardSteps';
import type { BudgetLevel, EffectsLevel, ProductionChoices, RuntimeTarget, SetQuality, ShootingStyle, VfxSpend } from '../../types';

const BUDGET_LEVELS = Object.keys(BUDGET_LEVEL_PROFILES) as BudgetLevel[];
const SHOOTING_STYLES = Object.keys(SHOOTING_STYLE_PROFILES) as ShootingStyle[];
const SET_QUALITIES = Object.keys(SET_QUALITY_PROFILES) as SetQuality[];
const EFFECTS_LEVELS = Object.keys(PRACTICAL_EFFECTS_PROFILES) as EffectsLevel[];
const VFX_SPENDS = Object.keys(VFX_SPEND_PROFILES) as VfxSpend[];
const RUNTIME_TARGETS = Object.keys(RUNTIME_TARGET_PROFILES) as RuntimeTarget[];

const BUDGET_LEVEL_DESCRIPTIONS = pluckDescriptions(BUDGET_LEVEL_PROFILES);
const SHOOTING_STYLE_DESCRIPTIONS = pluckDescriptions(SHOOTING_STYLE_PROFILES);
const SET_QUALITY_DESCRIPTIONS = pluckDescriptions(SET_QUALITY_PROFILES);
const PRACTICAL_EFFECTS_DESCRIPTIONS = pluckDescriptions(PRACTICAL_EFFECTS_PROFILES);
const VFX_SPEND_DESCRIPTIONS = pluckDescriptions(VFX_SPEND_PROFILES);
const RUNTIME_TARGET_DESCRIPTIONS = pluckDescriptions(RUNTIME_TARGET_PROFILES);

const DEFAULT_CHOICES: ProductionChoices = {
  budgetLevel: 'Standard',
  shootingStyle: 'Balanced',
  setQuality: 'Good',
  practicalEffects: 'Medium',
  vfxSpend: 'Low',
  runtimeTarget: 'Standard',
};

function MutedLabel({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{children}</span>;
}

export function ProductionPlanning() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const choices = draft.productionChoices ?? DEFAULT_CHOICES;

  // Seed the draft with defaults immediately so the budget tracker (and every
  // other screen reading the draft) reflects this screen's choices from the
  // very first render, not just after the player touches a slider.
  useEffect(() => {
    if (!draft.productionChoices) {
      dispatch({ type: 'SET_PRODUCTION_CHOICES', choices: DEFAULT_CHOICES });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof ProductionChoices>(key: K, value: ProductionChoices[K]) {
    dispatch({ type: 'SET_PRODUCTION_CHOICES', choices: { ...choices, [key]: value } });
  }

  const estimatedCost = computeProductionBudgetCost(choices);
  const canAfford = state.studio.cash - computeCommittedSpend(draft) >= 0;
  const genreProfile = draft.genre ? GENRE_PROFILES[draft.genre] : null;

  return (
    <div className="stack">
      <WizardSteps current="production-planning" />
      <BudgetTracker />
      <h1>Production Planning</h1>
      {genreProfile && draft.genre && <p className="choice-description">{genreProfile.description}</p>}

      <TierSlider
        label="Production Budget"
        tiers={BUDGET_LEVELS}
        value={choices.budgetLevel}
        onChange={(v) => update('budgetLevel', v)}
        descriptions={BUDGET_LEVEL_DESCRIPTIONS}
        valueLabel={<MutedLabel>Base <Money amount={BUDGET_LEVEL_PROFILES[choices.budgetLevel].baseCost} /></MutedLabel>}
      />
      <TierSlider
        label="Shooting Style"
        tiers={SHOOTING_STYLES}
        value={choices.shootingStyle}
        onChange={(v) => update('shootingStyle', v)}
        descriptions={SHOOTING_STYLE_DESCRIPTIONS}
        valueLabel={<MutedLabel>&times;{SHOOTING_STYLE_PROFILES[choices.shootingStyle].costMultiplier} cost</MutedLabel>}
      />
      <TierSlider
        label="Set Quality"
        tiers={SET_QUALITIES}
        value={choices.setQuality}
        onChange={(v) => update('setQuality', v)}
        descriptions={SET_QUALITY_DESCRIPTIONS}
        valueLabel={<MutedLabel><Money amount={SET_QUALITY_PROFILES[choices.setQuality].cost} /></MutedLabel>}
      />
      <TierSlider
        label="Practical Effects"
        tiers={EFFECTS_LEVELS}
        value={choices.practicalEffects}
        onChange={(v) => update('practicalEffects', v)}
        descriptions={PRACTICAL_EFFECTS_DESCRIPTIONS}
        valueLabel={<MutedLabel><Money amount={PRACTICAL_EFFECTS_PROFILES[choices.practicalEffects].cost} /></MutedLabel>}
      />
      <TierSlider
        label="VFX Spend"
        tiers={VFX_SPENDS}
        value={choices.vfxSpend}
        onChange={(v) => update('vfxSpend', v)}
        descriptions={VFX_SPEND_DESCRIPTIONS}
        valueLabel={<MutedLabel><Money amount={VFX_SPEND_PROFILES[choices.vfxSpend].cost} /></MutedLabel>}
      />
      <TierSlider
        label="Runtime Target"
        tiers={RUNTIME_TARGETS}
        value={choices.runtimeTarget}
        onChange={(v) => update('runtimeTarget', v)}
        descriptions={RUNTIME_TARGET_DESCRIPTIONS}
        valueLabel={<MutedLabel>&times;{RUNTIME_TARGET_PROFILES[choices.runtimeTarget].costMultiplier} cost</MutedLabel>}
      />

      <div className="card">
        <div className="stat-label">Estimated Production Cost</div>
        <div className="stat-value"><Money amount={estimatedCost} /></div>
      </div>
      {!canAfford && <p style={{ color: 'var(--red)' }}>This plan costs more than the studio has on hand.</p>}

      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'talent' })}>Back</Button>
        <Button variant="primary" disabled={!canAfford} onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'production' })}>
          Continue to Filming
        </Button>
      </div>
    </div>
  );
}
