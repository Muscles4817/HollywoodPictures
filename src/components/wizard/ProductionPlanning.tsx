import { useEffect } from 'react';
import { useStudio } from '../../state/StudioContext';
import {
  BUDGET_LEVEL_PROFILES,
  SHOOTING_STYLE_PROFILES,
  SET_QUALITY_PROFILES,
  PRACTICAL_EFFECTS_PROFILES,
  VFX_SPEND_PROFILES,
  RUNTIME_TARGET_PROFILES,
} from '../../data/production';
import { GENRE_PROFILES } from '../../data/genres';
import { computeProductionBudgetCost } from '../../engine/cost';
import { computeCommittedSpend } from '../../state/selectors';
import { BudgetTracker } from '../common/BudgetTracker';
import { ChoiceGroup } from '../common/ChoiceGroup';
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

const DEFAULT_CHOICES: ProductionChoices = {
  budgetLevel: 'Standard',
  shootingStyle: 'Balanced',
  setQuality: 'Good',
  practicalEffects: 'Medium',
  vfxSpend: 'Low',
  runtimeTarget: 'Standard',
};

export function ProductionPlanning() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const choices = draft.productionChoices ?? DEFAULT_CHOICES;

  // Seed the draft with defaults immediately so the budget tracker (and every
  // other screen reading the draft) reflects this screen's choices from the
  // very first render, not just after the player touches a button.
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
      {genreProfile && draft.genre && (
        <p>
          {draft.genre} films {genreProfile.vfxImportance >= 0.6 ? 'benefit strongly from VFX spend. ' : ''}
          {genreProfile.actingImportance >= 0.7 ? 'They lean heavily on acting and writing quality. ' : ''}
          {genreProfile.lowBudgetFriendly >= 0.6 ? 'They can succeed on a leaner budget if originality is high.' : ''}
        </p>
      )}

      <div className="card stack">
        <ChoiceGroup label="Production Budget" options={BUDGET_LEVELS} value={choices.budgetLevel} onChange={(v) => update('budgetLevel', v)} />
        <ChoiceGroup label="Shooting Style" options={SHOOTING_STYLES} value={choices.shootingStyle} onChange={(v) => update('shootingStyle', v)} />
        <ChoiceGroup label="Set Quality" options={SET_QUALITIES} value={choices.setQuality} onChange={(v) => update('setQuality', v)} />
        <ChoiceGroup label="Practical Effects" options={EFFECTS_LEVELS} value={choices.practicalEffects} onChange={(v) => update('practicalEffects', v)} />
        <ChoiceGroup label="VFX Spend" options={VFX_SPENDS} value={choices.vfxSpend} onChange={(v) => update('vfxSpend', v)} />
        <ChoiceGroup label="Runtime Target" options={RUNTIME_TARGETS} value={choices.runtimeTarget} onChange={(v) => update('runtimeTarget', v)} />
      </div>

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
