import { formatGameDateWithMonth } from '../../engine/calendar';
import { Button } from './Button';
import { Money } from './Money';
import type { CashLedgerCategory, CashLedgerEntry } from '../../types';

// A short, human label for each ledger category, shown as an eyebrow on the
// row so the player can scan "what kind of thing was this" without reading the
// full reason. Mirrors the CashLedgerCategory union in types/index.ts - keep
// exhaustive so a new category can't silently fall through to a blank tag.
const CATEGORY_LABEL: Record<CashLedgerCategory, string> = {
  acquisition: 'Acquisition',
  commission: 'Commission',
  rewrite: 'Development',
  production: 'Production',
  facility: 'Facilities',
  producer: 'Producers',
  awards: 'Awards',
  awardsCampaign: 'Awards campaign',
  other: 'Other',
};

/**
 * The recent-cash-movement history - opened from the Dashboard's own Studio
 * cash tile, the same "explain a number you could already see" idea as the
 * Brand/Prestige history modal. Unlike that one, this can't be fully derived
 * (money moves through ~a dozen reducer sites, only some of which leave a
 * durable trail), so it reads Studio.cashLedger, the append-only trail written
 * by engine/cashLedger.ts:recordCashChange. It is deliberately NOT a full
 * account reconciliation - weekly box-office net and intra-shoot micro-costs
 * are left out so the notable, discrete moves (an acquisition, a commission,
 * awards prize money) don't get buried. Most recent first.
 */
export function CashHistoryModal({ entries, onClose }: { entries: CashLedgerEntry[]; onClose: () => void }) {
  const recentFirst = [...entries].reverse();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content stack" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2 style={{ margin: 0 }}>Recent Budget Activity</h2>
        </div>
        <p className="choice-description" style={{ margin: 0 }}>
          The notable moves in and out of your studio cash - acquisitions, development, production, facilities and awards
          prize money - most recent first. Weekly box-office earnings aren't itemised here; watch the box-office panel for
          those.
        </p>

        {recentFirst.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nothing notable has moved your budget yet.</p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {recentFirst.map((entry, i) => (
              <div key={`${entry.day}-${i}`} className="card stack" style={{ gap: 6, padding: 12 }}>
                <div className="row-between">
                  <span style={{ fontSize: '0.72em', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                    {CATEGORY_LABEL[entry.category]}
                  </span>
                  <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{formatGameDateWithMonth(entry.day)}</span>
                </div>
                <div className="row-between" style={{ gap: 12 }}>
                  <span style={{ fontSize: '0.9em' }}>{entry.reason}</span>
                  <strong><Money amount={entry.amount} signColor showSign /></strong>
                </div>
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
