import type { ReactNode } from 'react';
import { logAmount, logT } from '../../engine/interpolate';

interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  /** True for currency-style ranges that span orders of magnitude (cost dials); false for 0-1 style dials. */
  logScale?: boolean;
  formatValue: (value: number) => string;
  description: string;
  lowLabel?: string;
  highLabel?: string;
  extra?: ReactNode;
}

// Internal resolution of the underlying <input type="range"> - fine enough
// that every drag feels perfectly smooth regardless of the real min/max span.
const SLIDER_STEPS = 1000;

/**
 * A genuinely continuous drag slider - min to max scales smoothly with no
 * jumps, optionally across a log scale so a cheap end (e.g. a shoestring
 * indie budget) gets just as much resolution as the expensive end.
 */
export function RangeSlider({ label, min, max, value, onChange, logScale, formatValue, description, lowLabel, highLabel, extra }: RangeSliderProps) {
  const range = { min, max };
  const t = logScale ? logT(value, range) : (value - min) / (max - min);
  const sliderPosition = Math.round(t * SLIDER_STEPS);

  function handleSliderChange(rawPosition: number) {
    const newT = rawPosition / SLIDER_STEPS;
    const newValue = logScale ? logAmount(newT, range) : min + newT * (max - min);
    onChange(newValue);
  }

  return (
    <div className="card stack">
      <div className="row-between">
        <h3 style={{ margin: 0 }}>{label}</h3>
        <span style={{ fontSize: '0.95em', fontWeight: 700, color: 'var(--primary)' }}>{formatValue(value)}</span>
      </div>
      <input
        type="range"
        className="tier-slider"
        min={0}
        max={SLIDER_STEPS}
        step={1}
        value={sliderPosition}
        onChange={(e) => handleSliderChange(Number(e.target.value))}
        aria-label={label}
      />
      {(lowLabel || highLabel) && (
        <div className="tier-slider-ticks">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
      <p className="choice-description">{description}</p>
      {extra}
    </div>
  );
}
