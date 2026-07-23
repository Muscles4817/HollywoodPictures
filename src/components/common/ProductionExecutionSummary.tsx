import type { ProductionExecutionOutcome } from '../../types';

// Player-facing summary of how the shoot shaped the finished film
// (engine/productionExecution.ts). Deliberately qualitative - stars, a
// headline, a causal sentence, and the named causes behind it. It never renders
// the raw numeric modifiers (those live on the outcome for dev inspectors/tests
// only), matching the screenplay-presentation philosophy: describe the outcome,
// don't expose the machinery.
export function ProductionExecutionSummary({ outcome }: { outcome: ProductionExecutionOutcome }) {
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
      {outcome.causes.length > 0 && (
        <ul className="stack" style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {outcome.causes.map((cause, i) => (
            <li key={i} style={{ color: cause.direction === 'positive' ? 'var(--positive, #2e7d32)' : 'var(--negative, #c62828)' }}>
              <span aria-hidden="true">{cause.direction === 'positive' ? '▲ ' : '▼ '}</span>
              <span style={{ color: 'var(--text, inherit)' }}>{cause.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
