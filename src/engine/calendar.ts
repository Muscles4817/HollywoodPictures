/**
 * The in-game calendar is a single running day counter (GameState.totalDays,
 * day 1 = the studio's first day) rather than a year/day pair - one source
 * of truth, no rollover bookkeeping scattered across the reducer. Year and
 * day-of-year are derived purely for display.
 */
const DAYS_PER_YEAR = 365;

export function formatGameDate(totalDays: number): string {
  const year = Math.floor((totalDays - 1) / DAYS_PER_YEAR) + 1;
  const dayOfYear = ((totalDays - 1) % DAYS_PER_YEAR) + 1;
  return `Year ${year}, Day ${dayOfYear}`;
}
