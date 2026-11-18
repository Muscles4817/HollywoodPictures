// The career gate (docs/IMPLEMENTATION_PLAN_market_realism.md §1.3, Phase 0):
// scripted player studios over a career, one per-seed row each, then the
// bands of data/careerTargets.ts and the plan's guard rails. Reports by
// default; asserts the bands only with CAREER_GATE_ASSERT=1 (Careful and
// Steady at Mid-Major and Major are what the bands are for).
//
//   CAREER_GATE=1 TIER=midmajor npx vitest run \
//     src/state/careerGate.diagnostic.test.ts --disable-console-intercept
//
// Options (env): TIER=midmajor  STRATEGIES=Careful,Steady  SEEDS=101,...,110
//                YEARS=10  DUMP_OUT=/tmp/career.json  CAREER_GATE_ASSERT=1
// A ten-seed tier takes several minutes; run one TIER per process.
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { BOT_STRATEGIES, runBot } from './playerBot';
import { DIFFICULTY_TIERS } from '../data/difficulty';
import { CAREFUL_BIG_STUDIO_BANDS } from '../data/careerTargets';
import { evaluateCareerBands, formatBandResults, formatCareerTable, summariseCareer, type CareerRow } from './careerGate';

const TIER_ID = process.env.TIER ?? 'midmajor';
const STRATEGY_NAMES = (process.env.STRATEGIES ?? 'Careful,Steady').split(',');
const SEEDS = (process.env.SEEDS ?? '101,102,103,104,105,106,107,108,109,110').split(',').map(Number);
const YEARS = Number(process.env.YEARS ?? 10);
const ASSERT = process.env.CAREER_GATE_ASSERT === '1';
const BANDED_TIERS = ['midmajor', 'major'];
const BANDED_STRATEGIES = ['Careful', 'Steady'];

describe.runIf(process.env.CAREER_GATE)('career gate: scripted player careers against the bands', () => {
  it(`${TIER_ID}: ${STRATEGY_NAMES.join(', ')}`, () => {
    const tier = DIFFICULTY_TIERS.find((t) => t.id === TIER_ID);
    if (!tier) throw new Error(`unknown tier "${TIER_ID}"`);
    const all: CareerRow[] = [];
    console.log(`\nCAREER GATE - ${tier.label}, ${YEARS} years, seeds ${SEEDS.join(',')} (money in £M)\n`);
    for (const name of STRATEGY_NAMES) {
      const strategy = BOT_STRATEGIES.find((s) => s.name === name);
      if (!strategy) throw new Error(`unknown strategy "${name}"`);
      const rows = SEEDS.map((seed) => {
        const { finalState: _finalState, ...run } = runBot(seed, tier, strategy, YEARS);
        return summariseCareer(run, tier.cash);
      });
      all.push(...rows);
      for (const line of formatCareerTable(rows)) console.log(line);
      const results = evaluateCareerBands(rows, CAREFUL_BIG_STUDIO_BANDS);
      const banded = BANDED_TIERS.includes(TIER_ID) && BANDED_STRATEGIES.includes(name);
      console.log(`  bands (${banded ? 'apply here' : 'for reference only'}):`);
      for (const line of formatBandResults(results)) console.log(line);
      const endOf = (r: CareerRow) => r.cashAtYear[r.cashAtYear.length - 1] ?? r.startCash;
      console.log(
        `  guard: below a quarter of start ${rows.filter((r) => endOf(r) < r.startCash / 4).length}/${rows.length}` +
          ` | above 4x start ${rows.filter((r) => endOf(r) > 4 * r.startCash).length}/${rows.length}` +
          ` | stalled for good ${rows.filter((r) => r.stalled).length}/${rows.length}\n`,
      );
      if (ASSERT && banded) {
        for (const result of results) expect(result.pass, `${name} ${result.measure} = ${result.value} (band ${result.band})`).toBe(true);
      }
    }
    if (process.env.DUMP_OUT) writeFileSync(process.env.DUMP_OUT, JSON.stringify(all));
  }, 7_200_000);
});
