import { useEffect } from 'react';
import { useStudio } from '../../state/StudioContext';
import {
  BUDGET_RANGE,
  SET_QUALITY_RANGE,
  PRACTICAL_EFFECTS_RANGE,
  VFX_RANGE,
} from '../../data/production';
import {
  budgetDescription,
  setQualityDescription,
  practicalEffectsDescription,
  vfxDescription,
  shootingDescription,
  runtimeDescription,
} from '../../engine/productionDials';
import { logAmount } from '../../engine/interpolate';
import { GENRE_PROFILES } from '../../data/genres';
import { computeProductionBudgetCost } from '../../engine/cost';
import { computeCommittedSpend } from '../../state/selectors';
import { BudgetTracker } from '../common/BudgetTracker';
import { RangeSlider } from '../common/RangeSlider';
import { Button } from '../common/Button';
import { Money, formatMoney } from '../common/Money';
import { WizardSteps } from '../common/WizardSteps';
import type { ProductionChoices } from '../../types';

const DEFAULT_CHOICES: ProductionChoices = {
  budgetAmount: logAmount(0.5, BUDGET_RANGE),
  shootingIntensity: 0.5,
  setQualityAmount: logAmount(0.5, SET_QUALITY_RANGE),
  practicalEffectsAmount: logAmount(0.5, PRACTICAL_EFFECTS_RANGE),
  vfxAmount: logAmount(0.5, VFX_RANGE),
  runtimeIntensity: 0.5,
};

/** Picks a rough qualitative label for a 0-1 "pace" dial without needing bespoke text for every point. */
function nearestLabel(t: number, labels: readonly [string, string, string]): string {
  if (t < 1 / 3) return labels[0];
  if (t < 2 / 3) return labels[1];
  return labels[2];
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

      <RangeSlider
        label="Production Budget"
        min={BUDGET_RANGE.min}
        max={BUDGET_RANGE.max}
        logScale
        value={choices.budgetAmount}
        onChange={(v) => update('budgetAmount', v)}
        formatValue={formatMoney}
        description={budgetDescription(choices.budgetAmount)}
        lowLabel="Shoestring"
        highLabel="Blockbuster"
      />
      <RangeSlider
        label="Shooting Style"
        min={0}
        max={1}
        value={choices.shootingIntensity}
        onChange={(v) => update('shootingIntensity', v)}
        formatValue={(v) => nearestLabel(v, ['Fast', 'Balanced', 'Perfectionist'])}
        description={shootingDescription(choices.shootingIntensity)}
        lowLabel="Fast"
        highLabel="Perfectionist"
      />
      <RangeSlider
        label="Set Quality"
        min={SET_QUALITY_RANGE.min}
        max={SET_QUALITY_RANGE.max}
        logScale
        value={choices.setQualityAmount}
        onChange={(v) => update('setQualityAmount', v)}
        formatValue={formatMoney}
        description={setQualityDescription(choices.setQualityAmount)}
        lowLabel="Bare Walls"
        highLabel="Lavish"
      />
      <RangeSlider
        label="Practical Effects"
        min={PRACTICAL_EFFECTS_RANGE.min}
        max={PRACTICAL_EFFECTS_RANGE.max}
        logScale
        value={choices.practicalEffectsAmount}
        onChange={(v) => update('practicalEffectsAmount', v)}
        formatValue={formatMoney}
        description={practicalEffectsDescription(choices.practicalEffectsAmount)}
        lowLabel="Minimal"
        highLabel="Top-Tier"
      />
      <RangeSlider
        label="VFX Spend"
        min={VFX_RANGE.min}
        max={VFX_RANGE.max}
        logScale
        value={choices.vfxAmount}
        onChange={(v) => update('vfxAmount', v)}
        formatValue={formatMoney}
        description={vfxDescription(choices.vfxAmount)}
        lowLabel="None"
        highLabel="Blockbuster-Grade"
      />
      <RangeSlider
        label="Runtime Target"
        min={0}
        max={1}
        value={choices.runtimeIntensity}
        onChange={(v) => update('runtimeIntensity', v)}
        formatValue={(v) => nearestLabel(v, ['Short', 'Standard', 'Long'])}
        description={runtimeDescription(choices.runtimeIntensity)}
        lowLabel="Short"
        highLabel="Long"
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
