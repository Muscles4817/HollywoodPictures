import type { OutcomeLabel } from '../types';

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
  const profitRatio = totalCost > 0 ? profit / totalCost : 0;

  if (profitRatio <= -0.3) return 'Flop';
  if (criticScore >= 85 && qualityScore >= 80) return 'Masterpiece';
  if (profitRatio > 2.5 && audienceScore >= 70) return 'Blockbuster';
  if (profitRatio < 0.15 && criticScore >= 65) return 'Cult Hit';
  if (profitRatio > 0.8) return 'Hit';
  return 'Modest Success';
}
