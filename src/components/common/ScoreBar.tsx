interface ScoreBarProps {
  label: string;
  value: number; // 0-100
}

/** Horizontal 0-100 bar used for talent stats and score breakdowns. */
export function ScoreBar({ label, value }: ScoreBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="score-bar-row">
      <span className="score-bar-label">{label}</span>
      <span className="score-bar-track">
        <span className="score-bar-fill" style={{ width: `${clamped}%` }} />
      </span>
      <span className="score-bar-value">{Math.round(clamped)}</span>
    </div>
  );
}
