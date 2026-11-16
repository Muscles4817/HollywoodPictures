// The career gate (docs/IMPLEMENTATION_PLAN_market_realism.md Phase 0): one
// row per scripted player career (state/playerBot.ts), the bands of
// data/careerTargets.ts checked against a set of rows, and a per-seed table.
// Pure: a BotRun in, plain numbers out.
import type { CareerBands } from '../data/careerTargets';
import type { BotFilm, BotRun } from './playerBot';

export interface CareerRow {
  strategy: string;
  seed: number;
  startCash: number;
  /** Year-end cash, one per year. */
  cashAtYear: number[];
  minCash: number;
  brandEnd: number;
  prestigeEnd: number;
  /** Finished films (box-office run over, profit known). Every film figure below reads these. */
  films: number;
  medianQuality: number;
  qualityP10: number;
  qualityP90: number;
  profitableInCinemasPct: number;
  losingAllInPct: number;
  /** (cinema profit + after-market received) / total cost, per film. */
  allInReturnMedian: number;
  allInReturnP10: number;
  allInReturnP90: number;
  bestFilmReturn: number;
  topFifthShareOfProfitPct: number;
  /** Cash flow over the career, from BotRun.cashFlow. */
  made: number;
  cinemaNet: number;
  afterMarket: number;
  awards: number;
  facilities: number;
  stalled: boolean;
  /** Contested scripts offered on, and won (Phase 5). */
  contestedOffers: number;
  contestedWins: number;
}

/** Nearest-rank percentile (0..1) of a list; 0 for an empty list. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const pctOf = (part: number, whole: number): number => (whole === 0 ? 0 : (100 * part) / whole);

/** A film's all-in profit: what cinemas left after every cost, plus what it has earned after them. */
export function allInProfit(film: BotFilm): number {
  return (film.profit ?? 0) + film.ancillary;
}

/**
 * Share of the summed all-in profit earned by the best fifth of films (by
 * all-in profit; at least one film), as a percent. 0 when the total is not
 * positive - a career that lost money overall has no meaningful share.
 */
export function topFifthShareOfProfitPct(profits: number[]): number {
  const total = profits.reduce((sum, p) => sum + p, 0);
  if (profits.length === 0 || total <= 0) return 0;
  const best = [...profits].sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(profits.length / 5)));
  return (100 * best.reduce((sum, p) => sum + p, 0)) / total;
}

export function summariseCareer(run: Omit<BotRun, 'finalState'>, startCash: number): CareerRow {
  const flow = (...keys: string[]) => keys.reduce((sum, key) => sum + (run.cashFlow[key] ?? 0), 0);
  const finished = run.films.filter((f) => f.profit !== null);
  const returns = finished.map((f) => allInProfit(f) / Math.max(1, f.totalCost));
  const qualities = finished.map((f) => f.quality);
  const last = run.years[run.years.length - 1];
  return {
    strategy: run.strategy,
    seed: run.seed,
    startCash,
    cashAtYear: run.years.map((y) => y.cashEnd),
    minCash: run.years.length ? Math.min(...run.years.map((y) => y.cashMin)) : startCash,
    brandEnd: last?.brand ?? 0,
    prestigeEnd: last?.prestige ?? 0,
    films: finished.length,
    medianQuality: median(qualities),
    qualityP10: percentile(qualities, 0.1),
    qualityP90: percentile(qualities, 0.9),
    profitableInCinemasPct: pctOf(finished.filter((f) => (f.profit ?? 0) > 0).length, finished.length),
    losingAllInPct: pctOf(finished.filter((f) => allInProfit(f) < 0).length, finished.length),
    allInReturnMedian: median(returns),
    allInReturnP10: percentile(returns, 0.1),
    allInReturnP90: percentile(returns, 0.9),
    bestFilmReturn: returns.length ? Math.max(...returns) : 0,
    topFifthShareOfProfitPct: topFifthShareOfProfitPct(finished.map(allInProfit)),
    made: flow('production:greenlight', 'production:prep', 'production:other', 'acquisition'),
    cinemaNet: flow('theatricalNet'),
    afterMarket: flow('homeEntertainment', 'licensing', 'merchandising', 'catalogue'),
    awards: flow('awards'),
    facilities: flow('facility'),
    stalled: run.stalledOnDay !== null,
    contestedOffers: run.contestedOffers ?? 0,
    contestedWins: run.contestedWins ?? 0,
  };
}

export interface BandResult {
  measure: string;
  value: number;
  band: string;
  pass: boolean;
}

const endCash = (row: CareerRow): number => row.cashAtYear[row.cashAtYear.length - 1] ?? row.startCash;
const endMultiple = (row: CareerRow): number => endCash(row) / row.startCash;
const within = (value: number, [lo, hi]: [number, number]): boolean => value >= lo && value <= hi;

/** The bands checked against a set of careers (one strategy at one tier, normally). */
export function evaluateCareerBands(rows: CareerRow[], bands: CareerBands): BandResult[] {
  const shrinkers = rows.filter((r) => endCash(r) < r.startCash).length;
  const maxMultiple = rows.length ? Math.max(...rows.map(endMultiple)) : 0;
  const medianMultiple = median(rows.map(endMultiple));
  const films = rows.reduce((sum, r) => sum + r.films, 0);
  // Pooled across careers: each row's share weighted by its film count.
  const losingAllIn = films === 0 ? 0 : rows.reduce((sum, r) => sum + r.losingAllInPct * r.films, 0) / films;
  const topFifth = median(rows.map((r) => r.topFifthShareOfProfitPct));
  return [
    { measure: 'careers ending below start', value: shrinkers, band: `${bands.shrinkers[0]}-${bands.shrinkers[1]}`, pass: within(shrinkers, bands.shrinkers) },
    { measure: 'largest end cash / start', value: maxMultiple, band: `<= ${bands.maxEndMultiple}`, pass: maxMultiple <= bands.maxEndMultiple },
    { measure: 'median end cash / start', value: medianMultiple, band: `${bands.medianEndMultiple[0]}-${bands.medianEndMultiple[1]}`, pass: within(medianMultiple, bands.medianEndMultiple) },
    { measure: 'films losing all-in %', value: losingAllIn, band: `${bands.filmsLosingAllInPct[0]}-${bands.filmsLosingAllInPct[1]}`, pass: within(losingAllIn, bands.filmsLosingAllInPct) },
    { measure: 'best fifth share of profit %', value: topFifth, band: `> ${bands.topFifthShareOfProfitPct}`, pass: topFifth > bands.topFifthShareOfProfitPct },
  ];
}

const m = (value: number): string => `${value < 0 ? '-' : ''}${(Math.abs(value) / 1e6).toFixed(1)}`;
const pad = (text: string | number, width: number): string => String(text).padStart(width);

/** The per-seed table: one line per career, money in £M. */
export function formatCareerTable(rows: CareerRow[]): string[] {
  const header =
    `${'strategy'.padEnd(9)}${pad('seed', 5)}${pad('start', 7)}${pad('Y1', 7)}${pad('Y3', 7)}${pad('Y5', 7)}${pad('Y10', 7)}${pad('min', 7)}` +
    `${pad('brand', 6)}${pad('prest', 6)}${pad('films', 6)}${pad('q50', 5)}${pad('q10', 5)}${pad('q90', 5)}${pad('cin+%', 6)}${pad('lose%', 6)}` +
    `${pad('ret50', 7)}${pad('ret10', 7)}${pad('ret90', 7)}${pad('best', 7)}${pad('top5%', 6)}${pad('made', 8)}${pad('cinema', 8)}${pad('after', 8)}${pad('award', 7)}${pad('facil', 7)} stalled bids`;
  const lines = [header];
  for (const r of rows) {
    const at = (year: number) => (r.cashAtYear[year - 1] === undefined ? '-' : m(r.cashAtYear[year - 1]));
    lines.push(
      `${r.strategy.padEnd(9)}${pad(r.seed, 5)}${pad(m(r.startCash), 7)}${pad(at(1), 7)}${pad(at(3), 7)}${pad(at(5), 7)}${pad(m(endCash(r)), 7)}${pad(m(r.minCash), 7)}` +
        `${pad(r.brandEnd, 6)}${pad(r.prestigeEnd, 6)}${pad(r.films, 6)}${pad(Math.round(r.medianQuality), 5)}${pad(Math.round(r.qualityP10), 5)}${pad(Math.round(r.qualityP90), 5)}` +
        `${pad(Math.round(r.profitableInCinemasPct), 6)}${pad(Math.round(r.losingAllInPct), 6)}` +
        `${pad(r.allInReturnMedian.toFixed(2), 7)}${pad(r.allInReturnP10.toFixed(2), 7)}${pad(r.allInReturnP90.toFixed(2), 7)}${pad(r.bestFilmReturn.toFixed(2), 7)}${pad(Math.round(r.topFifthShareOfProfitPct), 6)}` +
        `${pad(m(r.made), 8)}${pad(m(r.cinemaNet), 8)}${pad(m(r.afterMarket), 8)}${pad(m(r.awards), 7)}${pad(m(r.facilities), 7)} ${r.stalled ? 'yes' : '-'}     ${r.contestedWins}/${r.contestedOffers}`,
    );
  }
  return lines;
}

export function formatBandResults(results: BandResult[]): string[] {
  return results.map((r) => `  ${r.pass ? 'PASS' : 'MISS'}  ${r.measure.padEnd(30)} ${(Number.isInteger(r.value) ? String(r.value) : r.value.toFixed(2)).padStart(8)}   band ${r.band}`);
}
