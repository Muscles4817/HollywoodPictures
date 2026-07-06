import type { OutcomeLabel } from '../types';
import { clamp } from './random';

// Flat reputation swing per outcome, before the critic-score adjustment.
const OUTCOME_REPUTATION_DELTA: Record<OutcomeLabel, number> = {
  Flop: -8,
  'Cult Hit': 2,
  'Modest Success': 3,
  Hit: 6,
  Blockbuster: 10,
  Masterpiece: 15,
};

/** Reputation change: mostly the outcome label, nudged by critical reception. */
export function computeReputationChange(outcome: OutcomeLabel, criticScore: number): number {
  const criticAdjustment = Math.round((criticScore - 50) / 10); // -5..+5
  return OUTCOME_REPUTATION_DELTA[outcome] + criticAdjustment;
}

export function applyReputationChange(currentReputation: number, change: number): number {
  return clamp(currentReputation + change, 0, 100);
}
