import { useStudio } from '../../state/StudioContext';
import { computeProductionRiskScore } from '../../engine/production';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { WizardSteps } from '../common/WizardSteps';

export function ProductionRun() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const hasFilmed = draft.events.length > 0;

  const riskScore = draft.script && draft.productionChoices
    ? computeProductionRiskScore(draft.talent, draft.script, draft.productionChoices)
    : 0;

  const totalCostDelta = draft.events.reduce((sum, e) => sum + e.costDelta, 0);
  const totalQualityDelta = draft.events.reduce((sum, e) => sum + e.qualityDelta, 0);
  const totalBuzzDelta = draft.events.reduce((sum, e) => sum + e.buzzDelta, 0);

  return (
    <div className="stack">
      <WizardSteps current="production" />
      <h1>Production</h1>

      {!hasFilmed && (
        <div className="card stack">
          <p>
            Production risk is estimated at <strong>{riskScore}/100</strong> based on your cast's reliability and ego,
            script complexity, and shooting choices. Roll the cameras and see what happens on set.
          </p>
          <div>
            <Button variant="primary" onClick={() => dispatch({ type: 'BEGIN_FILMING' })}>
              Begin Filming
            </Button>
          </div>
        </div>
      )}

      {hasFilmed && (
        <div className="stack">
          <div className="card stack">
            <h2>On-Set Events</h2>
            {draft.events.map((event, i) => (
              <div key={`${event.id}-${i}`} className="row-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span>{event.description}</span>
                <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                  Cost <Money amount={event.costDelta} signColor invertColor showSign /> &middot; Quality {event.qualityDelta >= 0 ? '+' : ''}{event.qualityDelta.toFixed(1)} &middot; Buzz {event.buzzDelta >= 0 ? '+' : ''}{event.buzzDelta.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          <div className="row">
            <div className="stat">
              <div className="stat-label">Net Cost Impact</div>
              <div className="stat-value"><Money amount={totalCostDelta} signColor invertColor showSign /></div>
            </div>
            <div className="stat">
              <div className="stat-label">Net Quality Impact</div>
              <div className="stat-value">{totalQualityDelta >= 0 ? '+' : ''}{totalQualityDelta.toFixed(1)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Net Buzz Impact</div>
              <div className="stat-value">{totalBuzzDelta >= 0 ? '+' : ''}{totalBuzzDelta.toFixed(1)}</div>
            </div>
          </div>

          <div className="row-between">
            <span />
            <Button variant="primary" onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'post-production' })}>
              Continue to Post-Production
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
