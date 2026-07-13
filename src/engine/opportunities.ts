import type { Opportunity, OpportunitySource } from '../types';
import { GENRES } from '../data/genres';
import { generateScriptOptions } from './scriptGenerator';
import { pick, randInt, type RandomFn } from './random';

// docs/DESIGN_REVIEW_development_pipeline.md - source is mostly flavor
// riding on two real levers (how much it costs, how long it stays
// available), not a parallel generation system per source. Sequel/Director-
// pitch/Actor-passion-project sources are deliberately not modeled yet -
// out of scope for this MVP (no franchises, no talent pre-attachment).
const OPPORTUNITY_SOURCES: OpportunitySource[] = ['Spec Screenplay', 'Agent Package', 'Publisher Rights', 'Studio Original'];

/** acquisitionCost = script.cost * this multiplier - script.cost is still what engine/scriptGenerator.ts rolls, this just prices *access* to it differently per source. */
const SOURCE_COST_MULTIPLIER: Record<OpportunitySource, number> = {
  'Spec Screenplay': 0.4,
  'Agent Package': 0.9,
  'Publisher Rights': 1.1,
  'Studio Original': 0.1,
};

/** How many days from generation until the opportunity expires, if never acquired. */
const SOURCE_EXPIRY_DAYS: Record<OpportunitySource, [number, number]> = {
  'Spec Screenplay': [15, 30],
  'Agent Package': [10, 20],
  'Publisher Rights': [30, 60],
  'Studio Original': [45, 90],
};

/** How many days elapse, on average, between one generation batch and the next - the same per-timer shape engine/rivalStudios.ts's SPAWN_CHECK_INTERVAL_DAYS already uses, just world-level instead of per-rival. */
const GENERATION_INTERVAL_DAYS: [number, number] = [8, 16];

/** How many opportunities appear in one batch. */
const BATCH_SIZE: [number, number] = [2, 4];

function generateOpportunity(totalDays: number, rng: RandomFn): Opportunity {
  const genre = pick(rng, GENRES);
  const script = generateScriptOptions(genre, rng, 1)[0];
  const source = pick(rng, OPPORTUNITY_SOURCES);
  return {
    id: `opportunity-${totalDays}-${randInt(rng, 0, 999_999)}`,
    source,
    script,
    acquisitionCost: Math.round(script.cost * SOURCE_COST_MULTIPLIER[source]),
    expiresOnDay: totalDays + randInt(rng, ...SOURCE_EXPIRY_DAYS[source]),
  };
}

export interface OpportunitySettlement {
  opportunities: Opportunity[];
  nextGenerationCheckDay: number;
}

/**
 * Expires anything past its own `expiresOnDay`, then - once
 * `nextGenerationCheckDay` has arrived - generates a fresh batch, the same
 * lazy, catch-up-safe settlement pattern every other calendar-triggered
 * thing in this codebase already uses (settleScheduledReleases,
 * settleRivalMarket). Called from the same reducer sites those are -
 * every action that can advance GameState.totalDays.
 */
export function settleOpportunities(
  opportunities: Opportunity[],
  nextGenerationCheckDay: number,
  totalDays: number,
  rng: RandomFn,
): OpportunitySettlement {
  const active = opportunities.filter((o) => o.expiresOnDay > totalDays);
  if (nextGenerationCheckDay > totalDays) {
    return { opportunities: active, nextGenerationCheckDay };
  }
  const batchSize = randInt(rng, ...BATCH_SIZE);
  const newOnes = Array.from({ length: batchSize }, () => generateOpportunity(totalDays, rng));
  return {
    opportunities: [...active, ...newOnes],
    nextGenerationCheckDay: totalDays + randInt(rng, ...GENERATION_INTERVAL_DAYS),
  };
}
