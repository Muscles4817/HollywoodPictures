import { useState } from 'react';
import { ScoreBar } from './ScoreBar';

interface CompatibilityBadgeProps {
  // The owner's own stats, for the expanded breakdown - a Director's
  // ToneProfile, an Actor's ActingStyle, or anything else that's just a
  // named set of 0-100 numbers. Deliberately generic so this one component
  // serves scripts, directors and actors without caring which.
  breakdown: Array<{ label: string; value: number }>;
  // 0-100 script-weighted compatibility figure. Omit on a script's own card,
  // where there's no talent yet to compare against - the badge falls back
  // to just labeling this as a tone/style profile with no score attached.
  score?: number;
  defaultLabel?: string;
}

/**
 * Collapsed to a single line by default so a card stays scannable - the
 * full breakdown is genuinely useful for a borderline casting call, but
 * showing it on every card at once is exactly the wall-of-stats
 * micromanagement this game is trying to avoid. Click to pin it open,
 * hover for a quick peek without committing to a click.
 */
export function CompatibilityBadge({ score, breakdown, defaultLabel = 'Tone Profile' }: CompatibilityBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const label = score !== undefined ? `Compatibility: ${Math.round(score)}` : defaultLabel;

  return (
    <div className="compat-badge">
      <button
        type="button"
        className="compat-toggle"
        aria-expanded={expanded}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
      >
        {label} {expanded ? '▴' : '▾'}
      </button>
      <div className={`compat-detail${expanded ? ' compat-detail-expanded' : ''}`}>
        {breakdown.map(({ label: axisLabel, value }) => (
          <ScoreBar key={axisLabel} label={axisLabel} value={value} />
        ))}
      </div>
    </div>
  );
}
