import { Money } from './Money';

/**
 * A facility's yearly running cost, and what the next tier would run at
 * (engine/runningCosts.ts - the cost of being big). Shown before the player
 * builds or upgrades, so the bill that follows is never a surprise.
 */
export function RunningCostNote({ table, tier, hasNext }: { table: number[]; tier: number; hasNext: boolean }) {
  const now = table[tier] ?? 0;
  const next = hasNext ? (table[tier + 1] ?? null) : null;
  if (now === 0 && next === null) return null;
  return (
    <p className="office-running-cost">
      {now > 0 ? <>Costs <Money amount={now} /> a year to run.</> : <>Nothing to run yet.</>}
      {next !== null && <> {tier === 0 ? 'Once open' : 'At the next tier'}: <Money amount={next} /> a year.</>}
    </p>
  );
}
