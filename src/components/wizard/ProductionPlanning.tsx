import { useEffect, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { SHOOTING_BUDGET_RANGE } from '../../data/production';
import { contingencyDescription, runtimeDescription } from '../../engine/productionDials';
import { logAmount } from '../../engine/interpolate';
import { GENRE_PROFILES } from '../../data/genres';
import { computeProductionBudgetCost, computeDailyContingencyBurn } from '../../engine/cost';
import { computeRecommendedShootDays, computeStaticProductionRisk } from '../../engine/production';
import { adaptRecommendationsToProductionChoices } from '../../engine/productionChoicesAdapter';
import {
  explainEffectsStrategy,
  explainEnvironmentStrategy,
  recommendEffectsAmbition,
  recommendEnvironmentAmbition,
  totalVariationDistance,
  type StrategyBreakdown,
} from '../../engine/recommendation';
import { synthesizeProductionIdentity, findBiggestTension } from '../../engine/productionIdentity';
import { computeCommittedSpend, deriveFocusedDraft } from '../../state/selectors';
import { findAssignedPerson } from '../../data/helpers';
import { getDirectorCareer } from '../../engine/person';
import { DistributionEditor } from '../common/DistributionEditor';
import { RangeSlider } from '../common/RangeSlider';
import { Button } from '../common/Button';
import { ScoreBar } from '../common/ScoreBar';
import { Money, formatMoney } from '../common/Money';
import { ScriptSummaryCard } from '../common/ScriptSummaryCard';
import type {
  Distribution,
  EffectsMethodKey,
  EnvironmentMethodKey,
  NormalizedScalar,
  ProductionChoices,
  Recommendation,
  Script,
  TalentAssignment,
} from '../../types';

const DEFAULT_CONTINGENCY = logAmount(0.5, SHOOTING_BUDGET_RANGE);
const DEFAULT_RUNTIME_INTENSITY = 0.5;

const ENVIRONMENT_METHOD_KEYS: readonly EnvironmentMethodKey[] = ['studio', 'location', 'digital'];
const EFFECTS_METHOD_KEYS: readonly EffectsMethodKey[] = ['practical', 'digital'];
const ENVIRONMENT_LABELS: Record<EnvironmentMethodKey, string> = { studio: 'Studio', location: 'Location', digital: 'Digital' };
const EFFECTS_LABELS: Record<EffectsMethodKey, string> = { practical: 'Practical', digital: 'Digital' };

// Below this, a card's Strategy value and the recommendation are close
// enough to call "following it" rather than "adjusted" - a small buffer
// rather than exact equality, since dragging always produces a fresh
// object even for a barely-perceptible move.
const FOLLOWING_TOLERANCE = 0.03;

// Below this Strategy confidence (see engine/recommendation.ts), the card's
// Strategy section renders visually muted - the same false-precision
// principle the engine's own damping encodes, carried into the UI's visual
// weight rather than left as a footnote only.
const MUTED_CONFIDENCE_THRESHOLD = 0.5;

/** Picks a rough qualitative label for a 0-1 "pace" dial without needing bespoke text for every point. */
export function nearestLabel(t: number, labels: readonly [string, string, string]): string {
  if (t < 1 / 3) return labels[0];
  if (t < 2 / 3) return labels[1];
  return labels[2];
}

function ambitionLabel(value: NormalizedScalar): string {
  if (value >= 0.65) return 'Substantial';
  if (value >= 0.35) return 'Moderate';
  return 'Minimal';
}

/** Cost/schedule this card's current values are responsible for - "current plan" minus "current plan with this card's contribution zeroed out," the same counterfactual idea the recommendation engine already uses for reason-ordering. */
function consequenceOf(current: ProductionChoices, withoutThisCard: ProductionChoices, talent: TalentAssignment[], script: Script) {
  const costDelta = computeProductionBudgetCost(current) - computeProductionBudgetCost(withoutThisCard);
  const daysDelta = computeRecommendedShootDays(talent, script, current) - computeRecommendedShootDays(talent, script, withoutThisCard);
  return { costDelta, daysDelta };
}

interface RecommendationCardProps<K extends string> {
  title: string;
  order: readonly K[];
  labels: Record<K, string>;
  breakdown: StrategyBreakdown<K>;
  strategyValue: Distribution<K>;
  onStrategyChange: (next: Distribution<K>) => void;
  ambitionRec: Recommendation<NormalizedScalar>;
  ambitionValue: NormalizedScalar;
  onAmbitionChange: (next: NormalizedScalar) => void;
  consequence: { costDelta: number; daysDelta: number };
}

function RecommendationCard<K extends string>({
  title,
  order,
  labels,
  breakdown,
  strategyValue,
  onStrategyChange,
  ambitionRec,
  ambitionValue,
  onAmbitionChange,
  consequence,
}: RecommendationCardProps<K>) {
  const [reasonsExpanded, setReasonsExpanded] = useState(false);
  const [ambitionExpanded, setAmbitionExpanded] = useState(false);

  const followingStrategy = totalVariationDistance(strategyValue, breakdown.recommendation.value) < FOLLOWING_TOLERANCE;
  const followingAmbition = Math.abs(ambitionValue - ambitionRec.value) < FOLLOWING_TOLERANCE;
  const adjusted = !followingStrategy || !followingAmbition;
  const muted = breakdown.confidence < MUTED_CONFIDENCE_THRESHOLD;

  const reasons = breakdown.recommendation.reasons;
  const visibleReasons = reasonsExpanded ? reasons : reasons.slice(0, 2);
  const hiddenReasonCount = reasons.length - visibleReasons.length;

  return (
    <div className={`card stack ${muted ? 'recommendation-card-muted' : ''}`}>
      <div className="recommendation-card-header">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span className="badge">{adjusted ? 'Adjusted' : 'Following Recommendation'}</span>
      </div>

      <div>
        <div className="stat-label">Recommended</div>
        <DistributionEditor order={order} value={breakdown.recommendation.value} labels={labels} disabled />
      </div>

      <div>
        <div className="stat-label">Why?</div>
        <ul className="recommendation-reasons">
          {visibleReasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        {hiddenReasonCount > 0 && (
          <Button className="btn-sm" variant="text" onClick={() => setReasonsExpanded(true)}>
            {hiddenReasonCount} more reason{hiddenReasonCount > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      <div>
        <div className="row-between">
          <div className="stat-label">Your Plan</div>
          {!followingStrategy && (
            <Button className="btn-sm" variant="text" onClick={() => onStrategyChange(breakdown.recommendation.value)}>
              Reset
            </Button>
          )}
        </div>
        <DistributionEditor
          order={order}
          value={strategyValue}
          labels={labels}
          onChange={onStrategyChange}
          recommended={breakdown.recommendation.value}
        />
      </div>

      <div>
        <button
          className="row-between"
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', font: 'inherit' }}
          onClick={() => setAmbitionExpanded((e) => !e)}
        >
          <span className="stat-label">Investment: {ambitionLabel(ambitionValue)}</span>
          <span aria-hidden>{ambitionExpanded ? '▾' : '▸'}</span>
        </button>
        {ambitionExpanded && (
          <div className="stack" style={{ marginTop: 8 }}>
            <div className="stat-label">Recommended: {ambitionLabel(ambitionRec.value)}</div>
            <ul className="recommendation-reasons">
              {ambitionRec.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>

            <div className="row-between">
              <div className="stat-label">Your Plan</div>
              {!followingAmbition && (
                <Button className="btn-sm" variant="text" onClick={() => onAmbitionChange(ambitionRec.value)}>
                  Reset
                </Button>
              )}
            </div>
            <input
              type="range"
              className="tier-slider"
              min={0}
              max={100}
              step={1}
              value={Math.round(ambitionValue * 100)}
              onChange={(e) => onAmbitionChange(Number(e.target.value) / 100)}
              aria-label={`${title} investment level`}
            />
            <div className="tier-slider-ticks">
              <span>Minimal</span>
              <span>Substantial</span>
            </div>
          </div>
        )}
      </div>

      <div className="recommendation-consequence">
        This choice: <Money amount={consequence.costDelta} />
        {consequence.daysDelta !== 0 && (
          <>
            {' '}
            &middot; {consequence.daysDelta > 0 ? '+' : ''}
            {consequence.daysDelta} shoot days
          </>
        )}
      </div>
    </div>
  );
}

export function ProductionPlanning() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const script = draft.script!;
  const genre = draft.genre!;
  const director = findAssignedPerson(draft.talent, 'Director');
  const directorCareer = director && getDirectorCareer(director);

  const envBreakdown = directorCareer ? explainEnvironmentStrategy(script, directorCareer) : null;
  const fxBreakdown = directorCareer ? explainEffectsStrategy(script, directorCareer) : null;
  const envAmbitionRec = recommendEnvironmentAmbition(script);
  const fxAmbitionRec = recommendEffectsAmbition(script);

  const environmentStrategyOrNull = draft.environmentStrategy ?? envBreakdown?.recommendation.value ?? null;
  const environmentAmbition = draft.environmentAmbition ?? envAmbitionRec.value;
  const effectsStrategyOrNull = draft.effectsStrategy ?? fxBreakdown?.recommendation.value ?? null;
  const effectsAmbition = draft.effectsAmbition ?? fxAmbitionRec.value;
  const contingencyAmount = draft.productionChoices?.contingencyAmount ?? DEFAULT_CONTINGENCY;
  const runtimeIntensity = draft.productionChoices?.runtimeIntensity ?? DEFAULT_RUNTIME_INTENSITY;

  // Seed the draft with the recommendation as a starting point the first
  // time this screen is visited - so every other screen reading the draft
  // sees real values from the first render, same reasoning the old
  // DEFAULT_CHOICES seed had, just following the recommendation instead of
  // a flat midpoint. Hooks must run unconditionally (rules of hooks), so
  // the "no director" guard below has to come after this, not before -
  // this effect just no-ops if there's genuinely nothing to seed yet.
  useEffect(() => {
    if (!draft.environmentStrategy && environmentStrategyOrNull && effectsStrategyOrNull) {
      dispatch({
        type: 'SET_PRODUCTION_PLAN',
        environmentStrategy: environmentStrategyOrNull,
        environmentAmbition,
        effectsStrategy: effectsStrategyOrNull,
        effectsAmbition,
        contingencyAmount,
        runtimeIntensity,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guaranteed by Hire Talent (Director is mandatory), but guard rather than
  // assume - a defensive render instead of a crash if that ever changes.
  if (!director || !envBreakdown || !fxBreakdown || !environmentStrategyOrNull || !effectsStrategyOrNull) {
    return (
      <div className="stack">
        <p>No director hired yet - hire one from the Cast & Crew tab first.</p>
      </div>
    );
  }

  // Rebind to explicitly non-null consts - TS's control-flow narrowing from
  // the guard above doesn't carry into updatePlan's nested closure below,
  // even though these are never reassigned.
  const environmentStrategy: Distribution<EnvironmentMethodKey> = environmentStrategyOrNull;
  const effectsStrategy: Distribution<EffectsMethodKey> = effectsStrategyOrNull;

  function updatePlan(overrides: {
    environmentStrategy?: Distribution<EnvironmentMethodKey>;
    environmentAmbition?: NormalizedScalar;
    effectsStrategy?: Distribution<EffectsMethodKey>;
    effectsAmbition?: NormalizedScalar;
    contingencyAmount?: number;
    runtimeIntensity?: number;
  }) {
    dispatch({
      type: 'SET_PRODUCTION_PLAN',
      environmentStrategy,
      environmentAmbition,
      effectsStrategy,
      effectsAmbition,
      contingencyAmount,
      runtimeIntensity,
      ...overrides,
    });
  }

  const currentChoices: ProductionChoices =
    draft.productionChoices ??
    adaptRecommendationsToProductionChoices(environmentAmbition, effectsStrategy, effectsAmbition, contingencyAmount, runtimeIntensity);

  const estimatedCost = computeProductionBudgetCost(currentChoices);
  const canAfford = state.studio.cash - computeCommittedSpend(draft) >= 0;
  const genreProfile = GENRE_PROFILES[genre];
  const recommendedDays = computeRecommendedShootDays(draft.talent, script, currentChoices);
  const dailyShootCost = computeDailyContingencyBurn(currentChoices.contingencyAmount, recommendedDays);
  const totalEstimatedCost = estimatedCost + currentChoices.contingencyAmount;
  const staticRisk = computeStaticProductionRisk(draft.talent, script, currentChoices, genre);

  const identity = synthesizeProductionIdentity(script, envBreakdown, fxBreakdown);
  const biggestTension = findBiggestTension([
    { label: 'Environment Strategy', agreementState: envBreakdown.agreementState, distance: envBreakdown.distance },
    { label: 'Effects Strategy', agreementState: fxBreakdown.agreementState, distance: fxBreakdown.distance },
  ]);

  const environmentConsequence = consequenceOf(
    currentChoices,
    adaptRecommendationsToProductionChoices(0, effectsStrategy, effectsAmbition, contingencyAmount, runtimeIntensity),
    draft.talent,
    script,
  );
  const effectsConsequence = consequenceOf(
    currentChoices,
    adaptRecommendationsToProductionChoices(environmentAmbition, effectsStrategy, 0, contingencyAmount, runtimeIntensity),
    draft.talent,
    script,
  );

  return (
    <div className="stack">
      <h1>Production Planning</h1>
      <ScriptSummaryCard script={script} />

      <p className="production-identity">{identity}</p>

      {biggestTension ? (
        <div className="card production-tension">
          <strong>Biggest Tension:</strong> your director and this screenplay disagree on {biggestTension.label}.
          See that card below for the details.
        </div>
      ) : (
        <div className="card production-tension-aligned">The team is broadly aligned on approach - no major creative tensions to resolve.</div>
      )}

      <RecommendationCard
        title="Environment Strategy"
        order={ENVIRONMENT_METHOD_KEYS}
        labels={ENVIRONMENT_LABELS}
        breakdown={envBreakdown}
        strategyValue={environmentStrategy}
        onStrategyChange={(next) => updatePlan({ environmentStrategy: next })}
        ambitionRec={envAmbitionRec}
        ambitionValue={environmentAmbition}
        onAmbitionChange={(next) => updatePlan({ environmentAmbition: next })}
        consequence={environmentConsequence}
      />

      <RecommendationCard
        title="Effects Strategy"
        order={EFFECTS_METHOD_KEYS}
        labels={EFFECTS_LABELS}
        breakdown={fxBreakdown}
        strategyValue={effectsStrategy}
        onStrategyChange={(next) => updatePlan({ effectsStrategy: next })}
        ambitionRec={fxAmbitionRec}
        ambitionValue={effectsAmbition}
        onAmbitionChange={(next) => updatePlan({ effectsAmbition: next })}
        consequence={effectsConsequence}
      />

      <RangeSlider
        label="Contingency Reserve"
        min={SHOOTING_BUDGET_RANGE.min}
        max={SHOOTING_BUDGET_RANGE.max}
        logScale
        value={contingencyAmount}
        onChange={(v) => updatePlan({ contingencyAmount: v })}
        formatValue={formatMoney}
        description={contingencyDescription(contingencyAmount)}
        lowLabel="Shoestring"
        highLabel="Deep Pockets"
      />
      <RangeSlider
        label="Runtime Target"
        min={0}
        max={1}
        value={runtimeIntensity}
        onChange={(v) => updatePlan({ runtimeIntensity: v })}
        formatValue={(v) => nearestLabel(v, ['Short', 'Standard', 'Long'])}
        description={runtimeDescription(runtimeIntensity)}
        lowLabel="Short"
        highLabel="Long"
      />

      {!canAfford && <p style={{ color: 'var(--red)' }}>This plan costs more than the studio has on hand.</p>}

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

      <div className="plan-consequence-strip row-between">
        <div className="row">
          <div className="stat">
            <div className="stat-label">Set/Effects/VFX Cost</div>
            <div className="stat-value"><Money amount={estimatedCost} /></div>
          </div>
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
        </div>
      </div>
      <p className="choice-description" style={{ margin: 0 }}>
        {genreProfile.description} Principal photography burns your Contingency Reserve at{' '}
        <Money amount={dailyShootCost} />/day - over ~{recommendedDays} recommended days, that's the full{' '}
        <Money amount={contingencyAmount} /> reserve spent. Wrapping early spends less than planned; running longer
        keeps burning at that same daily rate with no cap.
      </p>
    </div>
  );
}
