import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft, deriveGreenlightCommitment } from '../../state/selectors';
import { computeRecommendedPreProductionDays, computeRecommendedShootDays } from '../../engine/production';
import { Button } from '../common/Button';
import { Money } from '../common/Money';

/**
 * The last explicit confirmation before the studio actually commits -
 * replaces the retired Greenlight.tsx screen (PRODUCER_WORKSPACE_DESIGN.md),
 * now a modal reachable from Overview instead of a fixed final wizard step.
 * Reads the same deriveGreenlightCommitment (state/selectors.ts) the
 * Finance tab shows, so the numbers here are guaranteed to match exactly
 * what the player already reviewed there. GREENLIGHT_PROJECT
 * (state/studioReducer.ts) re-checks readiness itself before committing
 * anything - this modal only renders once Overview has already confirmed
 * `deriveProjectReadiness(...).ready`, so the dispatch below always
 * succeeds.
 */
export function GreenlightConfirmation({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const script = draft.script!;
  const productionChoices = draft.productionChoices!;
  const commitment = deriveGreenlightCommitment(draft, state.studio.cash);
  const preProductionDays = computeRecommendedPreProductionDays(draft.talent, script, productionChoices);
  const shootDays = computeRecommendedShootDays(draft.talent, script, productionChoices);

  function handleConfirm() {
    dispatch({ type: 'GREENLIGHT_PROJECT' });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content stack" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>Greenlight {draft.title || script.title}?</h2>
        <p style={{ margin: 0 }}>
          Talent salary, the production budget, and the full contingency reserve all leave Studio Cash the instant
          you confirm, and your cast's schedules are locked in for the shoot.
        </p>

        <div className="row">
          <div className="stat">
            <div className="stat-label">Pre-Production</div>
            <div className="stat-value">~{preProductionDays} days</div>
          </div>
          <div className="stat">
            <div className="stat-label">Recommended Principal Photography</div>
            <div className="stat-value">~{shootDays} days</div>
          </div>
        </div>

        <div className="row-between"><span>Total Commitment</span><Money amount={commitment.totalCommitment} /></div>
        <div className="row-between"><span>Studio Cash (now)</span><Money amount={state.studio.cash} /></div>
        <div className="row-between" style={{ fontWeight: 600 }}>
          <span>Studio Cash (after Greenlight)</span>
          <Money amount={commitment.cashAfter} signColor />
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9em', margin: 0 }}>
          Once greenlit, abandoning this project will not refund any of the money committed here.
        </p>

        <div className="row-between">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!commitment.canAfford} onClick={handleConfirm}>
            Confirm Greenlight
          </Button>
        </div>
      </div>
    </div>
  );
}
