import type { OutcomeLabel } from '../types';

/** profit / totalCost, the single ratio both determineOutcome and engine/reputation.ts's computeBrandChange are driven by - one place computing it so both always agree on the divide-by-zero guard. */
export function computeProfitRatio(profit: number, totalCost: number): number {
  return totalCost > 0 ? profit / totalCost : 0;
}

/**
 * Classifies a release into a headline outcome label. Order matters - checks
 * run most-extreme-first so a film can't be both a "Flop" and a "Blockbuster".
 * Driven mainly by profit ratio (profit / totalCost) with quality/critic
 * scores breaking ties for prestige outcomes.
 */
export function determineOutcome(
  profit: number,
  totalCost: number,
  qualityScore: number,
  criticScore: number,
  audienceScore: number,
): OutcomeLabel {
  const profitRatio = computeProfitRatio(profit, totalCost);

  if (profitRatio <= -0.3) return 'Flop';
  if (criticScore >= 85 && qualityScore >= 80) return 'Masterpiece';
  if (profitRatio > 2.5 && audienceScore >= 70) return 'Blockbuster';
  if (profitRatio < 0.15 && criticScore >= 65) return 'Cult Hit';
  if (profitRatio > 0.8) return 'Hit';
  return 'Modest Success';
}
