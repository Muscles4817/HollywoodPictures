// What a studio's facilities cost to keep open (docs/DESIGN_REVIEW_player_economy.md
// §11 - the cost of being big).
//
// Upgrades used to be one-off purchases with nothing to pay afterwards, so a
// studio that had grown had nothing left that grew with it: a full domestic
// and international distribution operation cost £20M once, and then nothing,
// forever. A real distribution arm is staff in every territory, sales teams,
// bookers, offices; a development office is a payroll. Each facility now
// carries a yearly running cost by tier, charged a quarter at a time and shown
// on the facility's card before the player buys the next tier.
//
// Pure: plain data in, plain data out.

import type { Studio } from '../types';

/** Yearly running cost by tier (index = tier; tier 0 = not owned). */
export const DISTRIBUTION_ARM_RUNNING_BY_TIER = [0, 1_500_000, 5_000_000, 12_000_000];
export const INTERNATIONAL_RUNNING_BY_TIER = [0, 2_000_000, 5_000_000, 10_000_000];
export const PRODUCTION_OFFICE_RUNNING_BY_TIER = [0, 500_000, 1_500_000, 3_000_000];
export const MARKET_RESEARCH_RUNNING_BY_TIER = [0, 300_000, 800_000, 1_500_000];

/** Running costs are charged this often, in days. */
export const RUNNING_COST_INTERVAL_DAYS = 91;
const QUARTERS_PER_YEAR = 365 / RUNNING_COST_INTERVAL_DAYS;

const at = (table: number[], tier: number | undefined) => table[Math.max(0, Math.min(table.length - 1, tier ?? 0))] ?? 0;

export interface RunningCostLine {
  label: string;
  yearly: number;
}

/** Every facility the studio runs, with its yearly cost. Empty for a studio that owns none. */
export function runningCostLines(studio: Studio): RunningCostLine[] {
  const lines: RunningCostLine[] = [];
  const arm = studio.distributionArm;
  if (arm && arm.tier > 0) lines.push({ label: 'Distribution arm', yearly: at(DISTRIBUTION_ARM_RUNNING_BY_TIER, arm.tier) });
  if (arm && (arm.internationalTier ?? 0) > 0) lines.push({ label: 'International distribution', yearly: at(INTERNATIONAL_RUNNING_BY_TIER, arm.internationalTier) });
  const office = studio.productionOffice;
  if (office && office.tier > 0) lines.push({ label: 'Production office', yearly: at(PRODUCTION_OFFICE_RUNNING_BY_TIER, office.tier) });
  if (office && (office.marketResearchTier ?? 0) > 0) lines.push({ label: 'Market research', yearly: at(MARKET_RESEARCH_RUNNING_BY_TIER, office.marketResearchTier) });
  return lines;
}

export function yearlyRunningCost(studio: Studio): number {
  return runningCostLines(studio).reduce((sum, line) => sum + line.yearly, 0);
}

/** One quarter's bill. */
export function quarterlyRunningCost(studio: Studio): number {
  return Math.round(yearlyRunningCost(studio) / QUARTERS_PER_YEAR);
}

/** Whether a quarter's bill falls due between these two days. */
export function crossedRunningCostDay(dayBefore: number, dayAfter: number): boolean {
  return Math.floor(dayAfter / RUNNING_COST_INTERVAL_DAYS) > Math.floor(dayBefore / RUNNING_COST_INTERVAL_DAYS);
}

/** What the next tier of a facility would add to the yearly bill. */
export function runningCostIncrease(table: number[], currentTier: number): number {
  return at(table, currentTier + 1) - at(table, currentTier);
}
