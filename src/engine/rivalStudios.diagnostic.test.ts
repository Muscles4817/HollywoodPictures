/**
 * Empirical diagnostic for AI rival studio behaviour - production frequency,
 * what genres/scales each tier tends to make, and what talent they tend to
 * hire. Drives the real settlement loop (the same three functions
 * state/studioReducer.ts:runCalendarSettlement calls each day, in the same
 * order) headlessly over several in-game years and many seeds, then prints a
 * per-tier report.
 *
 * Skipped in the normal suite (it's an analysis harness, not an assertion) -
 * run it deliberately with:
 *
 *   RIVAL_DIAGNOSTIC=1 npx vitest run src/engine/rivalStudios.diagnostic.test.ts
 *
 * Findings from this harness are written up in
 * docs/DESIGN_REVIEW_ai_studio_behavior.md.
 */
import { describe, it } from 'vitest';
import { generateRivalStudios, settleRivalMarket, type RivalMarketUpdate } from './rivalStudios';
import { settleTheatricalMarket } from './marketSettlement';
import { generateTalentPool } from './talentGenerator';
import { settleOpportunities } from './opportunities';
import { computeTalentCost } from './cost';
import { withRng, type RandomFn } from './random';
import type { Film, RivalProductionInProgress, RivalStudio, StudioTier } from '../types';

const TIERS: StudioTier[] = ['Indie', 'Mid-Size', 'Major'];
const GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Thriller'] as const;
const SCALES = ['Small', 'Medium', 'Big'] as const;

const YEARS = 6;
const DAYS_PER_YEAR = 365;
const HORIZON = YEARS * DAYS_PER_YEAR;
const SEEDS = 16;

interface StudioSample {
  tier: StudioTier;
  productions: number;
  genre: Record<string, number>;
  scale: Record<string, number>;
  leadActorFame: number[];
  directorFame: number[];
  avgCastCrewFame: number[];
  talentSpend: number[];
  scriptCraft: number[];
}

function emptyStudioSample(tier: StudioTier): StudioSample {
  return {
    tier,
    productions: 0,
    genre: Object.fromEntries(GENRES.map((g) => [g, 0])),
    scale: Object.fromEntries(SCALES.map((s) => [s, 0])),
    leadActorFame: [],
    directorFame: [],
    avgCastCrewFame: [],
    talentSpend: [],
    scriptCraft: [],
  };
}

function recordProduction(sample: StudioSample, p: RivalProductionInProgress): void {
  sample.productions += 1;
  sample.genre[p.genre] += 1;
  sample.scale[p.scale] += 1;

  const lead = p.talent.find((t) => t.role === 'Lead Actor');
  const director = p.talent.find((t) => t.role === 'Director');
  if (lead) sample.leadActorFame.push(lead.person.reputation.fame);
  if (director) sample.directorFame.push(director.person.reputation.fame);

  const fames = p.talent.map((t) => t.person.reputation.fame);
  sample.avgCastCrewFame.push(fames.reduce((a, b) => a + b, 0) / Math.max(fames.length, 1));

  // Priced at each person's real per-role typical salary, then summed via the
  // exact same computeTalentCost the production's own affordability check uses.
  sample.talentSpend.push(computeTalentCost(p.talent));

  const s = p.script;
  sample.scriptCraft.push((s.originality + s.structure + s.characters + s.dialogue) / 4);
}

/** Runs one full seed and folds every started production into the per-tier accumulator. */
function runOneSeed(seed: number, acc: Record<StudioTier, StudioSample>): void {
  withRng(seed, (rng: RandomFn) => {
    let rivalStudios: RivalStudio[] = generateRivalStudios(rng);
    let talentPool = generateTalentPool(rng);
    const initialOpp = settleOpportunities([], 1, 1, rng);
    let opportunities = initialOpp.opportunities;
    let nextOpportunityCheckDay = initialOpp.nextGenerationCheckDay;
    let productionsInProgress: RivalProductionInProgress[] = [];
    let runningFilms: Film[] = [];

    const studioTierById = new Map(rivalStudios.map((r) => [r.id, r.tier]));
    const seen = new Set<string>();

    for (let day = 2; day <= HORIZON; day++) {
      const marketSettlement = settleTheatricalMarket(runningFilms, [], productionsInProgress, rivalStudios, day, 20, rng);

      rivalStudios = rivalStudios.map((rival) => {
        const delta = marketSettlement.rivalDeltas.get(rival.name);
        if (!delta) return rival;
        return {
          ...rival,
          cash: rival.cash + delta.cashCredit,
          brand: Math.max(0, Math.min(100, rival.brand + delta.brandDelta)),
          prestige: Math.max(0, Math.min(100, rival.prestige + delta.prestigeDelta)),
          lifetimeRevenue: rival.lifetimeRevenue + delta.cashCredit,
        };
      });

      const oppSettlement = settleOpportunities(opportunities, nextOpportunityCheckDay, day, rng);
      const rivalBids = oppSettlement.resolvedBids.filter((b) => b.winnerId !== 'player');

      const current: RivalMarketUpdate = {
        rivalStudios,
        rivalProductionsInProgress: marketSettlement.stillInProgress,
        rivalFilmsReleased: marketSettlement.settledFilms.filter((f) => f.releasedBy !== undefined),
        talentPool,
        opportunities: oppSettlement.opportunities,
      };
      const rivalMarket = settleRivalMarket(current, rivalBids, day, [], rng);

      rivalStudios = rivalMarket.rivalStudios;
      productionsInProgress = rivalMarket.rivalProductionsInProgress;
      talentPool = rivalMarket.talentPool;
      opportunities = rivalMarket.opportunities;
      nextOpportunityCheckDay = oppSettlement.nextGenerationCheckDay;
      // Re-feed only films still running; a finished run never settles again,
      // and dropping them keeps the theatrical pass fast over a 6-year horizon
      // without affecting production/genre/talent stats.
      runningFilms = rivalMarket.rivalFilmsReleased.filter((f) => f.boxOfficeRun.status !== 'finished');

      for (const p of productionsInProgress) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const tier = studioTierById.get(p.rivalStudioId);
        if (tier) recordProduction(acc[tier], p);
      }
    }
  });
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function pct(n: number, total: number): string {
  return total ? `${((n / total) * 100).toFixed(0)}%` : '0%';
}

const STUDIOS_PER_TIER = 4; // matches INITIAL_ROSTER_TIERS (4/4/4)

// Read without pulling in @types/node (the app tsconfig this file compiles
// under doesn't include node types) - the harness is opt-in via env flag.
const diagnosticEnabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.RIVAL_DIAGNOSTIC,
);

describe.skipIf(!diagnosticEnabled)('AI studio behaviour diagnostic', () => {
  it('reports production frequency, film kinds, and talent hiring by tier', () => {
    const acc: Record<StudioTier, StudioSample> = {
      Indie: emptyStudioSample('Indie'),
      'Mid-Size': emptyStudioSample('Mid-Size'),
      Major: emptyStudioSample('Major'),
    };

    for (let s = 0; s < SEEDS; s++) runOneSeed(1000 + s, acc);

    const lines: string[] = [];
    lines.push(`\n=== AI STUDIO BEHAVIOUR DIAGNOSTIC (${SEEDS} seeds x ${YEARS} in-game years) ===\n`);

    lines.push('PRODUCTION FREQUENCY (productions started per studio per in-game year)');
    for (const tier of TIERS) {
      const a = acc[tier];
      const perStudioPerYear = a.productions / (SEEDS * STUDIOS_PER_TIER * YEARS);
      lines.push(`  ${tier.padEnd(9)} ${perStudioPerYear.toFixed(2)}/yr   (total ${a.productions} productions across all seeds)`);
    }

    lines.push('\nGENRE MIX (share of a tier\'s productions)');
    for (const tier of TIERS) {
      const a = acc[tier];
      const parts = GENRES.map((g) => `${g} ${pct(a.genre[g], a.productions)}`);
      lines.push(`  ${tier.padEnd(9)} ${parts.join('  ')}`);
    }

    lines.push('\nSCALE MIX (share of a tier\'s productions)');
    for (const tier of TIERS) {
      const a = acc[tier];
      const parts = SCALES.map((s) => `${s} ${pct(a.scale[s], a.productions)}`);
      lines.push(`  ${tier.padEnd(9)} ${parts.join('  ')}`);
    }

    lines.push('\nTALENT HIRED (averages per production)');
    lines.push(`  ${'tier'.padEnd(9)} ${'leadFame'.padStart(9)} ${'dirFame'.padStart(8)} ${'castCrewFame'.padStart(13)} ${'talentSpend'.padStart(13)} ${'scriptCraft'.padStart(12)}`);
    for (const tier of TIERS) {
      const a = acc[tier];
      lines.push(
        `  ${tier.padEnd(9)} ${mean(a.leadActorFame).toFixed(1).padStart(9)} ${mean(a.directorFame).toFixed(1).padStart(8)} ${mean(a.avgCastCrewFame).toFixed(1).padStart(13)} ${('£' + Math.round(mean(a.talentSpend)).toLocaleString()).padStart(13)} ${mean(a.scriptCraft).toFixed(1).padStart(12)}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }, 120_000);
});
