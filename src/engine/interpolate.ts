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

/** Maps a 0-1 slider position onto a value that spans orders of magnitude (e.g. £100k - £40M). */
export function logAmount(t: number, range: Range): number {
  const clampedT = Math.max(0, Math.min(1, t));
  return range.min * Math.pow(range.max / range.min, clampedT);
}

/** Inverse of logAmount: given an amount, what slider position (0-1) produced it. */
export function logT(amount: number, range: Range): number {
  const clampedAmount = Math.max(range.min, Math.min(range.max, amount));
  return Math.log(clampedAmount / range.min) / Math.log(range.max / range.min);
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
