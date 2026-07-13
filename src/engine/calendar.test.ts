import { describe, it, expect } from 'vitest';
import { formatGameDate, formatGameMonthYear, monthYearOf, totalDaysForMonth, MONTH_NAMES } from './calendar';

describe('formatGameDate - unchanged exact-day display', () => {
  it('day 1 is Year 1, Day 1', () => {
    expect(formatGameDate(1)).toBe('Year 1, Day 1');
  });

  it('day 366 rolls over into Year 2', () => {
    expect(formatGameDate(366)).toBe('Year 2, Day 1');
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
