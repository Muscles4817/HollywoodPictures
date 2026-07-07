import type { ReactNode } from 'react';

interface TierSliderProps<T extends string> {
  label: string;
  /** Ordered low -> high; the slider position is just this array's index. */
  tiers: readonly T[];
  value: T;
  onChange: (value: T) => void;
  descriptions: Record<T, string>;
  /** Optional extra info shown next to the heading, e.g. this tier's cost. */
  valueLabel?: ReactNode;
}

/**
 * A labeled range slider for an ordinal choice (Cheap -> Excessive, etc.),
 * used instead of a button row so the player drags along a spectrum rather
 * than mentally ranking a set of buttons. Always shows the selected tier's
 * name and a plain-English description of what it does.
 */
export function TierSlider<T extends string>({ label, tiers, value, onChange, descriptions, valueLabel }: TierSliderProps<T>) {
  const index = tiers.indexOf(value);

  return (
    <div className="card stack">
      <div className="row-between">
        <h3 style={{ margin: 0 }}>{label}</h3>
        {valueLabel}
      </div>
      <input
        type="range"
        className="tier-slider"
        min={0}
        max={tiers.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(tiers[Number(e.target.value)])}
        aria-label={label}
      />
      <div className="tier-slider-ticks">
        {tiers.map((tier) => (
          <span key={tier} className={tier === value ? 'tier-slider-tick tier-slider-tick-active' : 'tier-slider-tick'}>
            {tier}
          </span>
        ))}
      </div>
      <p className="choice-description">{descriptions[value]}</p>
    </div>
  );
}
