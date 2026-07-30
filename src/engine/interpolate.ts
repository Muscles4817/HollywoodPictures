/**
 * Generic helpers for turning a continuous slider position into game
 * numbers. Used everywhere a dial (production budget, shooting style, ...)
 * needs to scale smoothly across its whole range instead of jumping between
 * a handful of discrete tiers.
 */

export interface Range {
  min: number;
  max: number;
}

/** A calibration point: at slider position `t` (0-1), these named values apply. */
export interface ScaleAnchor<K extends string> {
  t: number;
  values: Record<K, number>;
  description: string;
}

// A pure geometric (log) mapping is undefined when the low end is 0 (or
// negative): log(x / 0) is Infinity, and the ratio of two such logs is NaN -
// exactly the failure a Contingency Reserve slider hit, whose floor is a
// legitimate £0 "no buffer". For a zero/negative floor we shift the whole range
// by a small positive offset so the log is well-defined and the floor still maps
// cleanly to t = 0. The offset is a small fraction of the span, so the curve
// stays log-like across the bulk of the range (a cheap end still gets generous
// resolution) while remaining finite right down to the floor. Ranges with a
// positive floor are untouched - they take the exact geometric path as before.
const LOG_ZERO_OFFSET_FRACTION = 0.02;
function logZeroOffset(range: Range): number {
  return (range.max - range.min) * LOG_ZERO_OFFSET_FRACTION;
}

/** Maps a 0-1 slider position onto a value that spans orders of magnitude (e.g. £100k - £40M). A floor of 0 is supported (see logZeroOffset). */
export function logAmount(t: number, range: Range): number {
  const clampedT = Math.max(0, Math.min(1, t));
  if (range.min > 0) return range.min * Math.pow(range.max / range.min, clampedT);
  const off = logZeroOffset(range);
  return (range.min + off) * Math.pow((range.max + off) / (range.min + off), clampedT) - off;
}

/** Inverse of logAmount: given an amount, what slider position (0-1) produced it. A floor of 0 is supported (see logZeroOffset). */
export function logT(amount: number, range: Range): number {
  const clampedAmount = Math.max(range.min, Math.min(range.max, amount));
  if (range.min > 0) return Math.log(clampedAmount / range.min) / Math.log(range.max / range.min);
  const off = logZeroOffset(range);
  return Math.log((clampedAmount + off) / (range.min + off)) / Math.log((range.max + off) / (range.min + off));
}

/** Piecewise-linear interpolation of one named value across a sorted set of anchors. */
export function interpolateScale<K extends string>(t: number, anchors: readonly ScaleAnchor<K>[], key: K): number {
  const sorted = [...anchors].sort((a, b) => a.t - b.t);
  const clampedT = Math.max(0, Math.min(1, t));

  if (clampedT <= sorted[0].t) return sorted[0].values[key];
  if (clampedT >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].values[key];

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (clampedT >= a.t && clampedT <= b.t) {
      const frac = (clampedT - a.t) / (b.t - a.t);
      return a.values[key] + frac * (b.values[key] - a.values[key]);
    }
  }
  return sorted[sorted.length - 1].values[key];
}

/** The flavor-text description of whichever anchor is closest to the current slider position. */
export function describeScale<K extends string>(t: number, anchors: readonly ScaleAnchor<K>[]): string {
  const clampedT = Math.max(0, Math.min(1, t));
  let closest = anchors[0];
  let closestDistance = Math.abs(clampedT - closest.t);
  for (const anchor of anchors) {
    const distance = Math.abs(clampedT - anchor.t);
    if (distance < closestDistance) {
      closest = anchor;
      closestDistance = distance;
    }
  }
  return closest.description;
}
