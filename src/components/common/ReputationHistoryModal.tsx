import { formatGameDateWithMonth } from '../../engine/calendar';
import { Button } from './Button';
import type { ReputationEvent } from '../../state/selectors';

function DeltaLine({ label, delta, detail }: { label: string; delta: number; detail?: string }) {
  if (delta === 0) return null;
  return (
    <div className="row-between" style={{ gap: 12 }}>
      <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{detail ? `${label}: ${detail}` : label}</span>
      <strong className={delta > 0 ? 'money-positive' : 'money-negative'}>
        {delta > 0 ? '+' : ''}{delta}
      </strong>
    </div>
  );
}

/**
 * The full, scrollable Brand/Prestige history - opened from the Dashboard's
 * own Brand/Prestige tiles. Everything here is derived, not separately
 * persisted (state/selectors.ts:deriveReputationHistory) - the point isn't a
 * new save-format concept, it's finally showing the player the trail behind
 * a number they could already see, so a total moving in a direction they
 * didn't expect (e.g. one middling film's own -1 Prestige, while the studio
 * total went up because a different film or an awards ceremony landed a
 * bigger positive change the same week) has somewhere to be explained.
 */
export function ReputationHistoryModal({ events, onClose }: { events: ReputationEvent[]; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content stack" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2 style={{ margin: 0 }}>Brand &amp; Prestige History</h2>
        </div>
        <p className="choice-description" style={{ margin: 0 }}>
          Every film's own critical/commercial reception and every awards ceremony that moved your studio's Brand or
          Prestige, most recent first.
        </p>

        {events.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nothing's moved either number yet.</p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {events.map((event) => (
              <div key={event.id} className="card stack" style={{ gap: 6, padding: 12 }}>
                <div className="row-between">
                  <strong>{event.title}</strong>
                  <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{formatGameDateWithMonth(event.day)}</span>
                </div>
                <DeltaLine label="Prestige" delta={event.prestigeDelta} detail={event.prestigeDetail} />
                <DeltaLine label="Brand" delta={event.brandDelta} detail={event.brandDetail} />
              </div>
            ))}
          </div>
        )}

        <div className="row-between">
          <span />
          <Button variant="primary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
