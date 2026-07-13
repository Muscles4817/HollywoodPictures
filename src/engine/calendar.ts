/**
 * The in-game calendar is a single running day counter (GameState.totalDays,
 * day 1 = the studio's first day) rather than a year/day pair - one source
 * of truth, no rollover bookkeeping scattered across the reducer. Year and
 * day-of-year (and, below, month) are derived purely for display - the
 * counter itself never changes shape.
 */
const DAYS_PER_YEAR = 365;

export function formatGameDate(totalDays: number): string {
  const year = Math.floor((totalDays - 1) / DAYS_PER_YEAR) + 1;
  const dayOfYear = ((totalDays - 1) % DAYS_PER_YEAR) + 1;
  return `Year ${year}, Day ${dayOfYear}`;
}

// A fixed, no-leap-year 12-month breakdown of DAYS_PER_YEAR (31+28+31+30+31+
// 30+31+31+30+31+30+31 = 365) - purely a coarser display grain for
// planning-oriented dates (an upcoming/expected release - see
// formatGameMonthYear below), never a new unit anything is actually stored
// in.
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function yearAndDayOfYear(totalDays: number): { year: number; dayOfYear: number } {
  const year = Math.floor((totalDays - 1) / DAYS_PER_YEAR) + 1;
  const dayOfYear = (totalDays - 1) % DAYS_PER_YEAR; // 0-indexed within the year
  return { year, dayOfYear };
}

function monthIndexOfDayOfYear(dayOfYear: number): number {
  let remaining = dayOfYear;
  for (let i = 0; i < MONTH_LENGTHS.length; i++) {
    if (remaining < MONTH_LENGTHS[i]) return i;
    remaining -= MONTH_LENGTHS[i];
  }
  return MONTH_LENGTHS.length - 1;
}

/** The (1-indexed year, 0-indexed month) totalDays falls in - the numeric form a Year/Month picker needs (see MarketingRelease.tsx); formatGameMonthYear below is just this, formatted. */
export function monthYearOf(totalDays: number): { year: number; monthIndex: number } {
  const { year, dayOfYear } = yearAndDayOfYear(totalDays);
  return { year, monthIndex: monthIndexOfDayOfYear(dayOfYear) };
}

/**
 * "Month Year" - a coarser, real-calendar-feeling display for
 * planning-oriented dates: an upcoming/expected release (the Release
 * Calendar, a scheduled project, a rival's in-progress production), never a
 * historical "this already happened on day N" record - those keep
 * formatGameDate's exact day (Studio History, FilmDetailModal, RivalStudioPage's
 * release history), since precision matters more for a record than a plan.
 */
export function formatGameMonthYear(totalDays: number): string {
  const { year, monthIndex } = monthYearOf(totalDays);
  return `${MONTH_NAMES[monthIndex]} Year ${year}`;
}

/** The 1st day of the given (1-indexed year, 0-indexed month) - the inverse of monthYearOf, turning a Year/Month picker's selection back into a real totalDays. */
export function totalDaysForMonth(year: number, monthIndex: number): number {
  const daysBeforeMonth = MONTH_LENGTHS.slice(0, monthIndex).reduce((sum, d) => sum + d, 0);
  return (year - 1) * DAYS_PER_YEAR + daysBeforeMonth + 1;
}
