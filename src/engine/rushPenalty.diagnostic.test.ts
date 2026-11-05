// Calibration harness for the rushed-release penalty and screen collapse
// (docs/DESIGN_REVIEW_rush_penalty_and_screen_collapse.md §7, §11). Observational:
// RUSH_DIAGNOSTIC=1 npx vitest run src/engine/rushPenalty.diagnostic.test.ts --disable-console-intercept
import { describe, it } from 'vitest';
import { computeReleaseResults, type ReleaseComputationInput } from './releaseFilm';
import { buildReadyDraft } from '../state/testFixtures';
import { createRng, withRng } from './random';
import { advanceToWeekWithDiagnostics, MAX_SIMULATION_WEEKS } from './audienceSimulationStep';
import { AVERAGE_TICKET_PRICE } from './boxOfficeRun';
import type { ProductionChoices } from '../types';
import { rolloutMomentum } from './marketing';

const RUN = process.env.RUSH_DIAGNOSTIC === '1';

function input(seed: number, budget: 'mid' | 'big', quality: 'good' | 'weak'): ReleaseComputationInput {
  const { result: draft } = withRng(seed, (rng) => buildReadyDraft(rng));
  const amt = budget === 'big' ? 60_000_000 : 12_000_000;
  const production: ProductionChoices = quality === 'good'
    ? { shootingBudgetAmount: amt, setQualityAmount: amt / 3, practicalEffectsAmount: amt / 4, vfxAmount: amt / 2, runtimeIntensity: 0.5 }
    : { shootingBudgetAmount: amt / 4, setQualityAmount: 0, practicalEffectsAmount: 0, vfxAmount: 0, runtimeIntensity: 0.5 };
  return {
    title: 'Diag', genre: draft.genre!, targetAudience: draft.targetAudience!, script: draft.script!, talent: draft.talent,
    productionChoices: production, postProductionChoices: draft.postProductionChoices!,
    marketingChoices: { ...draft.marketingChoices!, marketingSpend: budget === 'big' ? 60_000_000 : 20_000_000, channelSpend: undefined },
    events: draft.photography!.events, postProductionEvents: draft.postProductionEvents,
    photographyCost: draft.photography!.runningCost, shootingRatio: quality === 'good' ? 1 : 0.8, studioBrand: 40, competitiveCrowding: 0.3,
  };
}

function run(base: ReleaseComputationInput, releaseType: 'Wide' | 'Limited', runway: number | undefined) {
  const { results, fixed } = computeReleaseResults({ ...base, marketingChoices: { ...base.marketingChoices, releaseType }, marketingRunwayWeeks: runway, marketingRolloutMultiplier: runway === undefined ? 1 : rolloutMomentum(runway) }, createRng(1));
  const { weeks, diagnostics } = advanceToWeekWithDiagnostics(fixed, [], MAX_SIMULATION_WEEKS);
  const gross = weeks[weeks.length - 1].cumulativeTicketsSold * AVERAGE_TICKET_PRICE;
  return {
    open: weeks[0].cumulativeTicketsSold * AVERAGE_TICKET_PRICE,
    gross, weeks: weeks.length, cost: results.totalCost,
    util1: diagnostics[0].demandUtilisation, util2: diagnostics[1]?.demandUtilisation ?? NaN,
    pulled: weeks.some((w) => w.screensPulled), critic: results.criticScore, aud: results.audienceScore,
  };
}

const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * p)]; };

describe.skipIf(!RUN)('rush penalty calibration', () => {
  it('prints scenarios', () => {
    const seeds = Array.from({ length: 24 }, (_, i) => 100 + i * 7);
    const scenarios: Array<[string, 'Wide' | 'Limited', number | undefined]> = [
      ['no signal (today)', 'Wide', undefined], ['wide 8wk', 'Wide', 8], ['wide 4wk (distrib floor)', 'Wide', 4],
      ['wide 3wk', 'Wide', 3], ['wide 2wk', 'Wide', 2], ['wide 0wk', 'Wide', 0], ['limited 0wk', 'Limited', 0], ['limited 8wk', 'Limited', 8],
    ];
    for (const budget of ['mid', 'big'] as const) for (const quality of ['good', 'weak'] as const) {
      console.log(`\n=== ${budget} budget, ${quality} film`);
      for (const [name, type, runway] of scenarios) {
        const rs = seeds.map((s) => run(input(s, budget, quality), type, runway));
        const m = (f: (r: typeof rs[0]) => number) => med(rs.map(f));
        console.log(
          `${name.padEnd(26)} open $${(m((r) => r.open) / 1e6).toFixed(1)}M  gross $${(m((r) => r.gross) / 1e6).toFixed(1)}M  cost $${(m((r) => r.cost) / 1e6).toFixed(1)}M  ` +
          `g/c ${m((r) => r.gross / r.cost).toFixed(2)}x  wks ${m((r) => r.weeks)}  util1 p10/50/90 ${pct(rs.map((r) => r.util1), 0.1).toFixed(2)}/${m((r) => r.util1).toFixed(2)}/${pct(rs.map((r) => r.util1), 0.9).toFixed(2)}  ` +
          `util2 ${m((r) => r.util2).toFixed(2)}  pulled ${rs.filter((r) => r.pulled).length}/${rs.length}  crit ${m((r) => r.critic).toFixed(0)} aud ${m((r) => r.aud).toFixed(0)}`,
        );
      }
    }
  });
});
