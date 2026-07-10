import { useEffect } from 'react';
import { useStudio } from '../../state/StudioContext';
import {
  CONTINGENCY_RANGE,
  SET_QUALITY_RANGE,
  PRACTICAL_EFFECTS_RANGE,
  VFX_RANGE,
} from '../../data/production';
import {
  contingencyDescription,
  setQualityDescription,
  practicalEffectsDescription,
  vfxDescription,
  runtimeDescription,
} from '../../engine/productionDials';
import { logAmount } from '../../engine/interpolate';
import { GENRE_PROFILES } from '../../data/genres';
import { computeProductionBudgetCost, computeDailyContingencyBurn } from '../../engine/cost';
import { computeRecommendedShootDays, computeStaticProductionRisk } from '../../engine/production';
import { computeCommittedSpend } from '../../state/selectors';
import { RangeSlider } from '../common/RangeSlider';
import { Button } from '../common/Button';
import { ScoreBar } from '../common/ScoreBar';
import { Money, formatMoney } from '../common/Money';
import { WizardHeader } from '../common/WizardHeader';
import type { ProductionChoices } from '../../types';

const DEFAULT_CHOICES: ProductionChoices = {
  contingencyAmount: logAmount(0.5, CONTINGENCY_RANGE),
  setQualityAmount: logAmount(0.5, SET_QUALITY_RANGE),
  practicalEffectsAmount: logAmount(0.5, PRACTICAL_EFFECTS_RANGE),
  vfxAmount: logAmount(0.5, VFX_RANGE),
  runtimeIntensity: 0.5,
};

/** Picks a rough qualitative label for a 0-1 "pace" dial without needing bespoke text for every point. */
export function nearestLabel(t: number, labels: readonly [string, string, string]): string {
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
  const recommendedDays = draft.script ? computeRecommendedShootDays(draft.talent, draft.script, choices) : null;
  const dailyShootCost = recommendedDays ? computeDailyContingencyBurn(choices.contingencyAmount, recommendedDays) : 0;
  const totalEstimatedCost = estimatedCost + choices.contingencyAmount;
  const staticRisk =
    draft.script && draft.genre ? computeStaticProductionRisk(draft.talent, draft.script, choices, draft.genre) : null;

  return (
    <div className="stack">
      <WizardHeader current="production-planning" />
      <h1>Production Planning</h1>
      {genreProfile && draft.genre && <p className="choice-description">{genreProfile.description}</p>}
      <p className="choice-description">
        These choices don't apply flat bonuses - they shape a risk profile that determines what's actually likely to
        happen once filming starts. A rushed, underprepared, over-ambitious shoot doesn't guarantee disaster, but it
        makes disaster a lot more reachable; a well-resourced, well-paced one opens the door to good luck instead.
        There's no shooting-pace dial here any more - how long the shoot actually takes is something you'll decide
        live, day by day, once filming begins.
      </p>

      <RangeSlider
        label="Contingency Reserve"
        min={CONTINGENCY_RANGE.min}
        max={CONTINGENCY_RANGE.max}
        logScale
        value={choices.contingencyAmount}
        onChange={(v) => update('contingencyAmount', v)}
        formatValue={formatMoney}
        description={contingencyDescription(choices.contingencyAmount)}
        lowLabel="Shoestring"
        highLabel="Deep Pockets"
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

      <div className="row">
        <div className="stat">
          <div className="stat-label">Set/Effects/VFX Cost</div>
          <div className="stat-value"><Money amount={estimatedCost} /></div>
        </div>
        {recommendedDays !== null && (
          <>
            <div className="stat">
              <div className="stat-label">Recommended Principal Photography</div>
              <div className="stat-value">~{recommendedDays} days</div>
            </div>
            <div className="stat">
              <div className="stat-label">Daily Shoot Cost</div>
              <div className="stat-value"><Money amount={dailyShootCost} /></div>
            </div>
            <div className="stat">
              <div className="stat-label">Estimated Total Cost (on schedule)</div>
              <div className="stat-value"><Money amount={totalEstimatedCost} /></div>
            </div>
          </>
        )}
      </div>
      {recommendedDays !== null && (
        <p className="choice-description" style={{ margin: 0 }}>
          Principal photography burns your Contingency Reserve at <Money amount={dailyShootCost} />/day - over
          ~{recommendedDays} recommended days, that's the full <Money amount={choices.contingencyAmount} /> reserve
          spent. Wrapping early spends less than planned; running longer keeps burning at that same daily rate with
          no cap, so a shoot that drags on well past its recommended length can cost substantially more than the
          estimated total above.
        </p>
      )}
      {!canAfford && <p style={{ color: 'var(--red)' }}>This plan costs more than the studio has on hand.</p>}

      {staticRisk && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Production Risk Profile</h3>
          <p style={{ margin: 0 }}>
            A preview of how this plan (plus your cast's reliability and ego) shapes what's likely to happen on set -
            higher isn't automatically bad news, but it opens the door to worse events and closes the door on the
            better ones. Schedule Pressure isn't shown here - it depends on how photography actually goes, not on
            anything you can set in advance.
          </p>
          <ScoreBar label="Morale Risk" value={staticRisk.moraleRisk} />
          <ScoreBar label="Safety Risk" value={staticRisk.safetyRisk} />
          <ScoreBar label="Technical Complexity" value={staticRisk.technicalComplexity} />
          <ScoreBar label="Budget Risk" value={staticRisk.budgetRisk} />
        </div>
      )}

      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'talent' })}>Back</Button>
        <Button variant="primary" disabled={!canAfford} onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'production' })}>
          Continue to Filming
        </Button>
      </div>
    </div>
  );
}
