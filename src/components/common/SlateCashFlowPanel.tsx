import { Money } from './Money';
import { formatGameMonthYear } from '../../engine/calendar';
import type { UpcomingAncillary } from '../../state/selectors';

/**
 * The forward-looking planning view of a studio's post-theatrical income
 * (engine/ancillary.ts): every scheduled home-video, TV/streaming, merchandising
 * and catalogue payment across all released films, bucketed by in-game year. The
 * phased ancillary windows are what make this a cash-flow tool - a studio can see
 * a stable revenue floor arriving over the next years and fund a riskier slate
 * against it. Renders nothing when there is no scheduled income yet.
 */
export function SlateCashFlowPanel({ upcoming, maxRows = 5 }: { upcoming: UpcomingAncillary; maxRows?: number }) {
  if (upcoming.total <= 0) return null;

  const shown = upcoming.buckets.slice(0, maxRows);
  const tail = upcoming.buckets.slice(maxRows);
  const tailTotal = tail.reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row-between">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>Scheduled to arrive</span>
        <strong><Money amount={upcoming.total} /></strong>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        {shown.map((bucket) => (
          <div className="row-between" key={bucket.year} style={{ fontSize: '0.9em' }}>
            <span>
              Year {bucket.year} <small style={{ color: 'var(--text-muted)' }}>&middot; from {formatGameMonthYear(bucket.firstDueDay)}</small>
            </span>
            <Money amount={bucket.total} />
          </div>
        ))}
        {tail.length > 0 && (
          <div className="row-between" style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>
            <span>Year {tail[0].year}+ <small>&middot; {tail.length} more {tail.length === 1 ? 'year' : 'years'}</small></span>
            <Money amount={tailTotal} />
          </div>
        )}
      </div>

      {upcoming.nextDueDay != null && (
        <p className="choice-description" style={{ margin: 0 }}>
          Next payment {formatGameMonthYear(upcoming.nextDueDay)}. Home-video, TV &amp; streaming, merchandising and
          catalogue income from your released films.
        </p>
      )}
    </div>
  );
}
