import { StarRating } from './StarRating';

interface CompatibilityBadgeProps {
  // The owner's own stats - a Director's ToneProfile, an Actor's
  // ActingStyle, or anything else that's just a named set of 0-100
  // numbers. Deliberately generic so this one component serves scripts,
  // directors and actors without caring which.
  breakdown: Array<{ label: string; value: number }>;
  // 0-100 script-weighted compatibility figure. Omit on a script's own card,
  // where there's no talent yet to compare against - the badge falls back
  // to just labeling this as a tone/style profile with no score attached.
  score?: number;
  defaultLabel?: string;
}

/**
 * Always shows the full breakdown - this used to be collapsed behind a
 * click/hover toggle, but the interactive target was too small to
 * comfortably hit and hover doesn't work at all on touch. Showing it
 * outright also sidesteps the layout problem that motivated the toggle in
 * the first place (a card that only sometimes expands unevens out its grid
 * row) - every card in a row now renders the same amount of content, so
 * row heights stay consistent without needing a flyout trick.
 */
export function CompatibilityBadge({ score, breakdown, defaultLabel = 'Tone Profile' }: CompatibilityBadgeProps) {
  const label = score !== undefined ? `Compatibility: ${Math.round(score)}` : defaultLabel;

  return (
    <div className="compat-badge">
      <div className="compat-label">{label}</div>
      <div className="compat-detail">
        {breakdown.map(({ label: axisLabel, value }) => (
          <div className="row-between" key={axisLabel}>
            <span className="score-bar-label">{axisLabel}</span>
            <StarRating value={value} />
          </div>
        ))}
      </div>
    </div>
  );
}
