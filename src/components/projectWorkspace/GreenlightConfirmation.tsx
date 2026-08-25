import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft, deriveGreenlightCommitment } from '../../state/selectors';
import { computeRecommendedPreProductionDays, computeRecommendedShootDays } from '../../engine/production';
import { professionForProductionRole } from '../../data/helpers';
import { latestCastBookingEnd } from '../../engine/person';
import { formatGameDateWithMonth } from '../../engine/calendar';
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
  // Deferred Start: if a cast member you waited for is still booked elsewhere,
  // the shoot can't begin until then - the film will be greenlit into a
  // development hold. Read the live pool so a since-cleared booking doesn't warn.
  const liveCast = draft.talent.map((a) => state.talentPool[professionForProductionRole(a.role)]?.find((t) => t.id === a.person.id) ?? a.person);
  const shootStartsOnDay = Math.max(state.totalDays, latestCastBookingEnd(liveCast, draft.id) ?? state.totalDays);
  const deferred = shootStartsOnDay > state.totalDays;

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

        {deferred && (
          <p style={{ margin: 0, padding: '8px 10px', borderRadius: 'var(--radius)', background: 'color-mix(in srgb, var(--amber) 12%, transparent)', fontSize: '0.9em' }}>
            A cast member you waited for is booked until <strong>{formatGameDateWithMonth(shootStartsOnDay)}</strong>, so
            the shoot begins then. The film is greenlit now, but waits in development until it can start.
          </p>
        )}

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
