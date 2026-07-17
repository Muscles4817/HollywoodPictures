import type { GameDate, ReleaseWindow } from '../types';

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

/**
 * "Year Y, Month D" - a friendlier precise reading than formatGameDate's raw
 * day-of-year, for the header's always-visible date ticker (components/common/
 * Header.tsx), where a human calendar date reads more naturally on every
 * tick than "Day 176" does. Still exact (unlike formatGameMonthYear's
 * deliberately coarser month-only reading) - built from the same
 * yearAndDayOfYear/monthIndexOfDayOfYear derivation as everything else here,
 * just with the day-of-month worked out too.
 */
export function formatGameDateWithMonth(totalDays: number): string {
  const { year, month, day } = gameDateFromTotalDays(totalDays);
  return `Year ${year}, ${MONTH_NAMES[month - 1]} ${day}`;
}

/** totalDays as a full {year, month, day} GameDate (1-indexed month) - what types/index.ts:getPersonAge needs for "today" to compare a dateOfBirth against. Extracted from formatGameDateWithMonth's own inline day-of-month math once a second caller needed the raw numbers rather than a formatted string. */
export function gameDateFromTotalDays(totalDays: number): GameDate {
  const { year, dayOfYear } = yearAndDayOfYear(totalDays);
  const monthIndex = monthIndexOfDayOfYear(dayOfYear);
  const daysBeforeMonth = MONTH_LENGTHS.slice(0, monthIndex).reduce((sum, d) => sum + d, 0);
  const day = dayOfYear - daysBeforeMonth + 1;
  return { year, month: monthIndex + 1, day };
}

// 0-indexed calendar month -> the ReleaseWindow it falls in - first-draft,
// tunable game-design numbers, not a physical fact (see docs/DESIGN.md if a
// balance pass ever revisits this). Halloween and Awards Season are
// deliberately narrow (a strong, scarce bonus that's easy to crowd out);
// Quiet Month is deliberately wide (the safe default the rest of the
// calendar falls back to) - matches RELEASE_WINDOW_DESCRIPTIONS'
// (data/release.ts) own framing of Quiet Month as "a safe, unremarkable
// baseline."
const MONTH_RELEASE_WINDOWS: readonly ReleaseWindow[] = [
  'Awards Season', // January
  'Awards Season', // February
  'Quiet Month', // March
  'Quiet Month', // April
  'Quiet Month', // May
  'Summer', // June
  'Summer', // July
  'Summer', // August
  'Quiet Month', // September
  'Halloween', // October
  'Christmas', // November
  'Christmas', // December
];

/**
 * The ReleaseWindow a given calendar day actually falls in - the single
 * source of truth for MarketingChoices.releaseWindow once a release day is
 * final (state/studioReducer.ts:SCHEDULE_RELEASE, engine/rivalStudios.ts),
 * so a chosen window can never contradict the chosen date the way an
 * independently-picked one used to (docs/DESIGN.md). Deliberately not
 * exposed as player-editable anywhere real gameplay touches it -
 * components/dev/OutcomeInspector.tsx is the one place a window is still
 * freely overridable, since it's a pure experimentation sandbox, not a real
 * release.
 */
export function deriveReleaseWindowFromDay(totalDays: number): ReleaseWindow {
  return MONTH_RELEASE_WINDOWS[monthYearOf(totalDays).monthIndex];
}
