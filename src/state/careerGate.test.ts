import { describe, expect, it } from 'vitest';
import { evaluateCareerBands, summariseCareer, topFifthShareOfProfitPct, type CareerRow } from './careerGate';
import { CAREFUL_BIG_STUDIO_BANDS } from '../data/careerTargets';
import type { BotFilm, BotRun } from './playerBot';

const film = (profit: number | null, ancillary: number, totalCost: number, quality = 60): BotFilm => ({
  title: `f${Math.random()}`,
  releasedOnDay: 1,
  totalCost,
  boxOffice: 1,
  profit,
  outcome: null,
  quality,
  critic: 50,
  releaseType: 'Wide',
  theatricalRevenue: 1,
  marketingCost: 0,
  ancillary,
  viaDistributor: false,
});

const run = (films: BotFilm[], cashFlow: Record<string, number> = {}, cashEnds = [100]): Omit<BotRun, 'finalState'> => ({
  strategy: 'Careful',
  tier: 'Mid-Major Studio',
  seed: 101,
  years: cashEnds.map((cashEnd, i) => ({ year: i + 1, cashEnd, cashMin: cashEnd - 10, brand: 50, prestige: 40, filmsReleased: 1 })),
  films,
  stalledOnDay: null,
  idleBrokeDays: 0,
  releaseBlockedDays: 0,
  releaseFirstBlockedOnDay: null,
  stuck: [],
  abandoned: 0,
  awardWins: 0,
  awardNominations: 0,
  facilityUpgrades: 0,
  cashFlow,
  pool: { start: {}, end: {} },
  stretchedFilms: 0,
  contestedOffers: 0,
  contestedWins: 0,
});

describe('summariseCareer', () => {
  it('sums the cash-flow lines into the right columns', () => {
    const row = summariseCareer(
      run([], {
        'production:greenlight': -10, 'production:prep': -2, 'production:other': -1, acquisition: -3,
        homeEntertainment: 4, licensing: 5, merchandising: 1, catalogue: 2,
        theatricalNet: 20, awards: 7, facility: -6,
      }),
      100,
    );
    expect(row.made).toBe(-16);
    expect(row.afterMarket).toBe(12);
    expect(row.cinemaNet).toBe(20);
    expect(row.awards).toBe(7);
    expect(row.facilities).toBe(-6);
  });

  it('reads all-in return as cinema profit plus after-market over total cost', () => {
    const row = summariseCareer(run([film(-50, 80, 100), film(null, 999, 100)]), 100);
    expect(row.films).toBe(1); // the still-running film is left out
    expect(row.allInReturnMedian).toBeCloseTo(0.3);
    expect(row.losingAllInPct).toBe(0); // loses in cinemas, profitable all-in
    expect(row.profitableInCinemasPct).toBe(0);
  });

  it('gives zeros, not NaN, for a career with no films', () => {
    const row = summariseCareer(run([]), 100);
    for (const value of Object.values(row)) {
      if (typeof value === 'number') expect(Number.isNaN(value)).toBe(false);
    }
    expect(row.medianQuality).toBe(0);
    expect(row.topFifthShareOfProfitPct).toBe(0);
    expect(row.bestFilmReturn).toBe(0);
  });

  it('takes year-end cash, the lowest point, and the last year\'s standing', () => {
    const row = summariseCareer(run([], {}, [120, 80, 150]), 100);
    expect(row.cashAtYear).toEqual([120, 80, 150]);
    expect(row.minCash).toBe(70);
    expect(row.brandEnd).toBe(50);
  });
});

describe('topFifthShareOfProfitPct', () => {
  it('is the best film over the total for five films', () => {
    expect(topFifthShareOfProfitPct([100, 20, -30, 10, 0])).toBeCloseTo(100);
    expect(topFifthShareOfProfitPct([50, 20, 10, 10, 10])).toBeCloseTo(50);
  });
  it('is above 100% when the rest lose money between them', () => {
    expect(topFifthShareOfProfitPct([200, -20, -30, -10, 10])).toBeCloseTo(133.33, 1);
  });
  it('rounds the best fifth up to at least one film', () => {
    expect(topFifthShareOfProfitPct([30, 10])).toBeCloseTo(75);
    expect(topFifthShareOfProfitPct([10, 10, 10, 10, 10, 10])).toBeCloseTo(100 * 20 / 60);
  });
  it('is 0 when the total is not positive', () => {
    expect(topFifthShareOfProfitPct([10, -10])).toBe(0);
    expect(topFifthShareOfProfitPct([])).toBe(0);
  });
});

describe('evaluateCareerBands', () => {
  const row = (end: number, losingAllInPct = 40, films = 10, topFifth = 120): CareerRow => ({
    ...summariseCareer(run([]), 100),
    cashAtYear: [end],
    losingAllInPct,
    films,
    topFifthShareOfProfitPct: topFifth,
  });
  const result = (rows: CareerRow[], measure: string) => evaluateCareerBands(rows, CAREFUL_BIG_STUDIO_BANDS).find((r) => r.measure === measure)!;
  // Ten careers ending at these multiples of start: median 1.5, max 4, two shrink.
  const base = [0.5, 0.9, 1, 1.2, 1.4, 1.6, 2, 2.5, 3, 4].map((x) => x * 100);

  it('passes everything for a career set inside every band', () => {
    expect(evaluateCareerBands(base.map((e) => row(e)), CAREFUL_BIG_STUDIO_BANDS).every((r) => r.pass)).toBe(true);
  });

  it('counts shrinkers against 1..3 at both edges', () => {
    const ends = (shrinking: number) => base.map((e, i) => (i < shrinking ? 50 : Math.max(e, 150)));
    expect(result(ends(0).map((e) => row(e)), 'careers ending below start').pass).toBe(false);
    expect(result(ends(1).map((e) => row(e)), 'careers ending below start').pass).toBe(true);
    expect(result(ends(3).map((e) => row(e)), 'careers ending below start').pass).toBe(true);
    expect(result(ends(4).map((e) => row(e)), 'careers ending below start').pass).toBe(false);
  });

  it('caps the largest career at four times start', () => {
    expect(result([row(400)], 'largest end cash / start').pass).toBe(true);
    expect(result([row(401)], 'largest end cash / start').pass).toBe(false);
  });

  it('holds the median between 1 and 2.5 times start', () => {
    expect(result([row(100)], 'median end cash / start').pass).toBe(true);
    expect(result([row(99)], 'median end cash / start').pass).toBe(false);
    expect(result([row(250)], 'median end cash / start').pass).toBe(true);
    expect(result([row(251)], 'median end cash / start').pass).toBe(false);
  });

  it('pools the losing-all-in share by film count, 35..45', () => {
    expect(result([row(100, 35)], 'films losing all-in %').pass).toBe(true);
    expect(result([row(100, 34.9)], 'films losing all-in %').pass).toBe(false);
    expect(result([row(100, 45)], 'films losing all-in %').pass).toBe(true);
    expect(result([row(100, 45.1)], 'films losing all-in %').pass).toBe(false);
    // 30% of 10 films and 60% of 20 films: 50% pooled.
    expect(result([row(100, 30, 10), row(100, 60, 20)], 'films losing all-in %').value).toBeCloseTo(50);
  });

  it('wants the best fifth to earn more than all of the profit', () => {
    expect(result([row(100, 40, 10, 100)], 'best fifth share of profit %').pass).toBe(false);
    expect(result([row(100, 40, 10, 100.1)], 'best fifth share of profit %').pass).toBe(true);
  });
});
