import { describe, it, expect } from 'vitest';
import { formatGameDate, formatGameDateWithMonth, formatGameMonthYear, monthYearOf, totalDaysForMonth, deriveReleaseWindowFromDay, MONTH_NAMES } from './calendar';

describe('formatGameDate - unchanged exact-day display', () => {
  it('day 1 is Year 1, Day 1', () => {
    expect(formatGameDate(1)).toBe('Year 1, Day 1');
  });

  it('day 366 rolls over into Year 2', () => {
    expect(formatGameDate(366)).toBe('Year 2, Day 1');
  });
});

describe('formatGameDateWithMonth - the same exact day, as a human calendar date', () => {
  it('day 1 is Year 1, January 1', () => {
    expect(formatGameDateWithMonth(1)).toBe('Year 1, January 1');
  });

  it('day 32 (the first day past January\'s 31) is Year 1, February 1', () => {
    expect(formatGameDateWithMonth(32)).toBe('Year 1, February 1');
  });

  it('day 366 rolls over into Year 2, January 1 - not still December of Year 1', () => {
    expect(formatGameDateWithMonth(366)).toBe('Year 2, January 1');
  });

  it('the last day of the year (365) is Year 1, December 31', () => {
    expect(formatGameDateWithMonth(365)).toBe('Year 1, December 31');
  });

  it('agrees with monthYearOf on which month/year every day of a year falls in', () => {
    for (let d = 1; d <= 365; d++) {
      const totalDays = totalDaysForMonth(1, 0) + d - 1;
      const { year, monthIndex } = monthYearOf(totalDays);
      expect(formatGameDateWithMonth(totalDays)).toContain(`Year ${year}, ${MONTH_NAMES[monthIndex]} `);
    }
  });
});

describe('monthYearOf / formatGameMonthYear - a coarser display grain, never a new stored unit', () => {
  it('day 1 is January, Year 1', () => {
    expect(monthYearOf(1)).toEqual({ year: 1, monthIndex: 0 });
    expect(formatGameMonthYear(1)).toBe('January Year 1');
  });

  it('day 32 (the first day past January\'s 31) is February', () => {
    expect(monthYearOf(32)).toEqual({ year: 1, monthIndex: 1 });
    expect(formatGameMonthYear(32)).toBe('February Year 1');
  });

  it('day 366 (the first day of Year 2) is January, Year 2 - not still December, Year 1', () => {
    expect(monthYearOf(366)).toEqual({ year: 2, monthIndex: 0 });
    expect(formatGameMonthYear(366)).toBe('January Year 2');
  });

  it('the last day of the year (365) is still December, Year 1', () => {
    expect(monthYearOf(365)).toEqual({ year: 1, monthIndex: 11 });
  });
});

describe('totalDaysForMonth - the inverse of monthYearOf', () => {
  it('(1, January) is day 1', () => {
    expect(totalDaysForMonth(1, 0)).toBe(1);
  });

  it('(1, February) is day 32', () => {
    expect(totalDaysForMonth(1, 1)).toBe(32);
  });

  it('(2, January) is day 366', () => {
    expect(totalDaysForMonth(2, 0)).toBe(366);
  });

  it('round-trips through monthYearOf for the 1st of every month across three years', () => {
    for (let year = 1; year <= 3; year++) {
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const day = totalDaysForMonth(year, monthIndex);
        expect(monthYearOf(day)).toEqual({ year, monthIndex });
      }
    }
  });

  it('every month name has a corresponding valid index into MONTH_NAMES', () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe('January');
    expect(MONTH_NAMES[11]).toBe('December');
  });
});

describe('deriveReleaseWindowFromDay - the single source of truth tying ReleaseWindow to the real calendar', () => {
  it('October is Halloween, regardless of year', () => {
    expect(deriveReleaseWindowFromDay(totalDaysForMonth(1, 9))).toBe('Halloween');
    expect(deriveReleaseWindowFromDay(totalDaysForMonth(3, 9))).toBe('Halloween');
  });

  it('June/July/August are Summer', () => {
    expect(deriveReleaseWindowFromDay(totalDaysForMonth(1, 5))).toBe('Summer');
    expect(deriveReleaseWindowFromDay(totalDaysForMonth(1, 6))).toBe('Summer');
    expect(deriveReleaseWindowFromDay(totalDaysForMonth(1, 7))).toBe('Summer');
  });

  it('November/December are Christmas', () => {
    expect(deriveReleaseWindowFromDay(totalDaysForMonth(1, 10))).toBe('Christmas');
    expect(deriveReleaseWindowFromDay(totalDaysForMonth(1, 11))).toBe('Christmas');
  });

  it('January/February are Awards Season', () => {
    expect(deriveReleaseWindowFromDay(totalDaysForMonth(1, 0))).toBe('Awards Season');
    expect(deriveReleaseWindowFromDay(totalDaysForMonth(1, 1))).toBe('Awards Season');
  });

  it('every remaining month (March-May, September) is Quiet Month', () => {
    for (const monthIndex of [2, 3, 4, 8]) {
      expect(deriveReleaseWindowFromDay(totalDaysForMonth(1, monthIndex))).toBe('Quiet Month');
    }
  });

  it('every day within a month maps to the same window, not just the 1st', () => {
    const octoberFirst = totalDaysForMonth(1, 9);
    for (let d = 0; d < 31; d++) {
      expect(deriveReleaseWindowFromDay(octoberFirst + d)).toBe('Halloween');
    }
  });

  it('every calendar month maps to exactly one of the five real ReleaseWindow values', () => {
    const validWindows = new Set(['Quiet Month', 'Summer', 'Awards Season', 'Halloween', 'Christmas']);
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      expect(validWindows.has(deriveReleaseWindowFromDay(totalDaysForMonth(1, monthIndex)))).toBe(true);
    }
  });
});
