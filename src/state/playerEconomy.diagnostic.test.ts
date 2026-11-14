// The player-economy harness: scripted studios played through the real reducer
// for a career, to see what the economy does to a *player* - every other
// calibration gate measures rival films (state/playerBot.ts has the why and the
// bot's rules). Observational: it prints tables and asserts nothing, because
// there are no agreed targets for these numbers yet - producing the numbers is
// what lets targets be set.
//
//   PLAYER_ECONOMY_DIAGNOSTIC=1 npx vitest run \
//     src/state/playerEconomy.diagnostic.test.ts --disable-console-intercept
//
// Options (env): YEARS=10  SEEDS=101,102,103  TIERS=garage,indie,midmajor
//                STRATEGIES=Careful,Steady  DUMP_OUT=/tmp/player.json
// A 10-year run takes ~15-20 s, so the default matrix is several minutes;
// run one TIERS value per process to do tiers in parallel.
import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { BOT_STRATEGIES, runBot, type BotRun, type PoolStats } from './playerBot';
import { DIFFICULTY_TIERS } from '../data/difficulty';

const YEARS = Number(process.env.YEARS ?? 10);
const SEEDS = (process.env.SEEDS ?? '101,102,103').split(',').map(Number);
const TIER_IDS = (process.env.TIERS ?? 'garage,indie,midmajor').split(',');
const STRATEGY_NAMES = process.env.STRATEGIES?.split(',');

const median = (values: number[]): number => {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const money = (value: number): string => (Number.isNaN(value) ? '-' : `${value < 0 ? '-' : ''}${(Math.abs(value) / 1e6).toFixed(1)}M`);
const pct = (part: number, whole: number): string => (whole === 0 ? '-' : `${Math.round((100 * part) / whole)}%`);
const pad = (text: string | number, width: number): string => String(text).padStart(width);

function summarise(runs: BotRun[]): string[] {
  const lines: string[] = [];
  const checkpoints = [1, 2, 3, 5, 7, 10, 15].filter((y) => y <= YEARS);
  const at = (run: BotRun, year: number) => run.years[year - 1];

  lines.push(`    year   ${checkpoints.map((y) => pad(`Y${y}`, 9)).join('')}`);
  lines.push(`    cash   ${checkpoints.map((y) => pad(money(median(runs.map((r) => at(r, y).cashEnd))), 9)).join('')}   (median across seeds, year end)`);
  lines.push(`    low    ${checkpoints.map((y) => pad(money(Math.min(...runs.map((r) => at(r, y).cashMin))), 9)).join('')}   (lowest point in that year, worst seed)`);
  lines.push(`    brand  ${checkpoints.map((y) => pad(Math.round(median(runs.map((r) => at(r, y).brand))), 9)).join('')}`);
  lines.push(`    prest. ${checkpoints.map((y) => pad(Math.round(median(runs.map((r) => at(r, y).prestige))), 9)).join('')}`);

  const films = runs.flatMap((r) => r.films).filter((f) => f.profit !== null);
  const profitable = films.filter((f) => (f.profit ?? 0) > 0).length;
  const outcomes = new Map<string, number>();
  for (const film of films) outcomes.set(film.outcome ?? '?', (outcomes.get(film.outcome ?? '?') ?? 0) + 1);
  lines.push(
    `    films  ${(runs.reduce((n, r) => n + r.films.length, 0) / runs.length / YEARS).toFixed(1)}/yr` +
      ` | profitable in cinemas ${pct(profitable, films.length)}` +
      ` | median cost ${money(median(films.map((f) => f.totalCost)))}` +
      ` | median quality ${Math.round(median(films.map((f) => f.quality)))}` +
      ` | best quality ${Math.round(Math.max(0, ...films.map((f) => f.quality)))}`,
  );
  lines.push(`    outcomes ${[...outcomes.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => `${label} ${pct(n, films.length)}`).join(', ') || '-'}`);
  lines.push(
    `    awards ${median(runs.map((r) => r.awardWins))} wins / ${median(runs.map((r) => r.awardNominations))} nominations per career (median)` +
      ` | facility upgrades ${median(runs.map((r) => r.facilityUpgrades))}`,
  );

  // Where a career's money went and came from (state/playerBot.ts:BotRun.cashFlow).
  const flow = (...keys: string[]) => median(runs.map((r) => keys.reduce((sum, key) => sum + (r.cashFlow[key] ?? 0), 0)));
  lines.push(
    `    money out: greenlights ${money(flow('production:greenlight'))}, prep overhead ${money(flow('production:prep'))}, scripts ${money(flow('acquisition'))}, facilities ${money(flow('facility'))}` +
      ` | in: cinemas net of marketing ${money(flow('theatricalNet'))}, after-market ${money(flow('homeEntertainment', 'licensing', 'merchandising', 'catalogue'))}, awards ${money(flow('awards'))}`,
  );
  const viaDistributor = films.filter((f) => f.viaDistributor).length;
  const wide = films.filter((f) => f.releaseType === 'Wide').length;
  lines.push(`    releases: ${pct(wide, films.length)} wide, ${pct(viaDistributor, films.length)} through a rented distributor | median gross ${money(median(films.map((f) => f.boxOffice ?? 0)))}`);

  // Did the talent pool stay where it started? (median across seeds of end / start)
  const drift = (profession: string, pick: (s: PoolStats) => number) =>
    median(runs.map((r) => pick(r.pool.end[profession]) / Math.max(1e-9, pick(r.pool.start[profession]))));
  lines.push(
    `    pool after ${YEARS}y vs day 1: ` +
      ['Actor', 'Director', 'Cinematographer']
        .map((p) => `${p} fame x${drift(p, (s) => s.meanFame).toFixed(2)} heat x${drift(p, (s) => s.meanHeat).toFixed(2)} median fee x${drift(p, (s) => s.medianFee).toFixed(2)} top-decile fee x${drift(p, (s) => s.topDecileFee).toFixed(2)}`)
        .join(' | '),
  );

  const wentNegative = runs.filter((r) => r.years.some((y) => y.cashMin < 0)).length;
  const blocked = runs.filter((r) => r.releaseFirstBlockedOnDay !== null);
  const stalled = runs.filter((r) => r.stalledOnDay !== null);
  lines.push(
    `    trouble: cash below zero in ${wentNegative}/${runs.length} careers` +
      ` | a finished film could not be released in ${blocked.length}/${runs.length}` +
      (blocked.length ? ` (first on day ${Math.min(...blocked.map((r) => r.releaseFirstBlockedOnDay!))}, ${Math.round(median(blocked.map((r) => r.releaseBlockedDays)))} days blocked)` : '') +
      ` | stalled for good in ${stalled.length}/${runs.length}` +
      (stalled.length ? ` (from day ${Math.round(median(stalled.map((r) => r.stalledOnDay!)))})` : ''),
  );
  lines.push(
    `    bot: stretched to fund ${median(runs.map((r) => r.stretchedFilms))} films, dropped ${median(runs.map((r) => r.abandoned))} projects it could not greenlight, idle and broke ${Math.round(median(runs.map((r) => r.idleBrokeDays)))} days`,
  );
  const stuck = runs.flatMap((r) => r.stuck).filter((line) => !line.includes('cannot-afford-greenlight'));
  if (stuck.length) lines.push(`    PIPELINE DEFECTS (${stuck.length}): ${stuck.slice(0, 3).join(' ; ')}`);
  return lines;
}

describe.runIf(process.env.PLAYER_ECONOMY_DIAGNOSTIC)('player economy: scripted studios over a career', () => {
  it('prints what each strategy does at each starting tier', () => {
    const strategies = BOT_STRATEGIES.filter((s) => !STRATEGY_NAMES || STRATEGY_NAMES.includes(s.name));
    const all: Array<Omit<BotRun, 'finalState'>> = [];
    console.log(`\nPLAYER ECONOMY - ${YEARS} years, seeds ${SEEDS.join(', ')}\n`);
    for (const tierId of TIER_IDS) {
      const tier = DIFFICULTY_TIERS.find((t) => t.id === tierId);
      if (!tier) throw new Error(`unknown tier "${tierId}"`);
      console.log(`=== ${tier.label} - starts with ${money(tier.cash)}, Brand ${tier.brand}, Prestige ${tier.prestige} ===`);
      for (const strategy of strategies) {
        const runs = SEEDS.map((seed) => runBot(seed, tier, strategy, YEARS));
        console.log(`\n  ${strategy.name}: ${strategy.description}`);
        for (const line of summarise(runs)) console.log(line);
        for (const run of runs) {
          const { finalState: _finalState, ...rest } = run;
          all.push(rest);
        }
      }
      console.log('');
    }
    if (process.env.DUMP_OUT) writeFileSync(process.env.DUMP_OUT, JSON.stringify(all));
  }, 3_600_000);
});
