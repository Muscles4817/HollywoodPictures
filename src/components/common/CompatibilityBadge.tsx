import { useState } from 'react';
import type { ToneProfile } from '../../types';
import { TONES, TONE_LABELS } from '../../data/tones';
import { ScoreBar } from './ScoreBar';

interface CompatibilityBadgeProps {
  score: number; // 0-100, the collapsed script-weighted compatibility figure
  toneProfile: ToneProfile; // the talent's own profile, for the expanded breakdown
}

/**
 * Collapsed to a single number by default so a card stays scannable - the
 * six-axis breakdown is genuinely useful for a borderline casting call, but
 * showing it on every card at once is exactly the wall-of-stats
 * micromanagement this game is trying to avoid. Click to pin it open,
 * hover for a quick peek without committing to a click.
 */
export function CompatibilityBadge({ score, toneProfile }: CompatibilityBadgeProps) {
  const [expanded, setExpanded] = useState(false);

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
        Compatibility: {Math.round(score)} {expanded ? '▴' : '▾'}
      </button>
      <div className={`compat-detail${expanded ? ' compat-detail-expanded' : ''}`}>
        {TONES.map((tone) => (
          <ScoreBar key={tone} label={TONE_LABELS[tone]} value={toneProfile[tone]} />
        ))}
      </div>
    </div>
  );
}
