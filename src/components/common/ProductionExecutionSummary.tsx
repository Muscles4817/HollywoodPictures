import type { ProductionExecutionCause, ProductionExecutionOutcome } from '../../types';

// Player-facing summary of how the shoot shaped the finished film
// (engine/productionExecution.ts). Qualitative by design - stars, a headline, a
// causal sentence, and named causes. It never renders the raw numeric modifiers
// (those live on the outcome for dev inspectors/tests only). Progressive
// disclosure: a compact card by default; a large deviation exposes an
// expandable breakdown of every major effect and what mitigation contained.
const COMPACT_CAUSE_COUNT = 2;

function Cause({ cause }: { cause: ProductionExecutionCause }) {
  return (
    <li style={{ color: cause.direction === 'positive' ? 'var(--positive, #2e7d32)' : 'var(--negative, #c62828)' }}>
      <span aria-hidden="true">{cause.direction === 'positive' ? '▲ ' : '▼ '}</span>
      <span style={{ color: 'var(--text, inherit)' }}>{cause.text}</span>
    </li>
  );
}

export function ProductionExecutionSummary({ outcome }: { outcome: ProductionExecutionOutcome }) {
  const compactCauses = outcome.causes.slice(0, COMPACT_CAUSE_COUNT);
  // Only offer the expandable breakdown when there is genuinely more to see -
  // a smooth, normal shoot stays a one-glance card, never a wall of text.
  const hasMore = outcome.causes.length > COMPACT_CAUSE_COUNT || outcome.mitigation.length > 0;

  return (
    <div className="card stack">
      <div className="row-between">
        <h2 style={{ margin: 0 }}>Production Execution</h2>
        <span className="star-rating" title={`${outcome.stars} / 5`} aria-label={`${outcome.stars} out of 5`}>
          <span className="star-rating-track">★★★★★</span>
          <span className="star-rating-fill" style={{ width: `${(outcome.stars / 5) * 100}%` }}>
            ★★★★★
          </span>
        </span>
      </div>
      <p style={{ margin: 0, fontWeight: 600 }}>{outcome.headline}</p>
      <p className="choice-description" style={{ margin: 0 }}>{outcome.detail}</p>

      {compactCauses.length > 0 && (
        <ul className="stack" style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {compactCauses.map((cause, i) => <Cause key={i} cause={cause} />)}
        </ul>
      )}

      {hasMore && (
        <details className="stack" style={{ margin: 0 }}>
          <summary style={{ cursor: 'pointer' }}>What happened on set</summary>
          <div className="stack" style={{ marginTop: '0.5rem' }}>
            <p className="choice-description" style={{ margin: 0 }}>Major effects</p>
            <ul className="stack" style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {outcome.causes.map((cause, i) => <Cause key={i} cause={cause} />)}
            </ul>
            {outcome.mitigation.length > 0 && (
              <>
                <p className="choice-description" style={{ margin: 0 }}>Mitigation</p>
                <ul className="stack" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {outcome.mitigation.map((line, i) => (
                    <li key={i} style={{ color: 'var(--positive, #2e7d32)' }}>
                      <span aria-hidden="true">✓ </span>
                      <span style={{ color: 'var(--text, inherit)' }}>{line}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
