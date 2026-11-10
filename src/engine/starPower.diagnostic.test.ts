/**
 * Observational harness - WHAT A STAR BUYS, controlled
 * (docs/DESIGN_REVIEW_box_office_variance_diagnosis.md §5.2, §7 step 1).
 *
 * The whole-market cut found that at matched cost and scale, films with
 * top-fame leads open smaller and return less. That cut is observational over
 * rivals' own choices. This one is not: it takes a fixed rival plan, changes
 * ONLY its lead actors' fame, and resolves every variant under the same
 * execution seeds, so script, crew, skill, schedule and execution luck are
 * identical across rows.
 *
 * Three variants per fame level:
 *   - fame only:  fame changed, salary and marketing unchanged - what fame
 *                 itself buys in the model, free of its price.
 *   - priced:     fame changed and the leads paid the market rate for that
 *                 fame (median Lead Actor typicalSalary by fame, read off a
 *                 generated talent pool) - marketing unchanged, so cost rises.
 *   - matched:    priced, and marketing cut by exactly the salary difference -
 *                 the same total money, moved between star and campaign.
 *
 * Reports median opening, median gross, p10 gross (the floor the domain
 * reference says stars mostly buy), coefficient of variation, and the median
 * whole-P&L return the distribution gate uses. No assertions.
 *
 *   BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/starPower.diagnostic.test.ts --disable-console-intercept
 *   (optional: STAR_PLAN_SEEDS=7000,7001  STAR_EXECUTIONS=40)
 */
import { describe, it } from 'vitest';
import { generateRivalStudios, settleRivalMarket, resolveRivalProduction, type RivalMarketUpdate } from './rivalStudios';
import { settleTheatricalMarket } from './marketSettlement';
import { settleBoxOfficeForAllFilms } from './boxOfficeRun';
import { generateTalentPool } from './talentGenerator';
import { settleOpportunities } from './opportunities';
import { ancillaryAttributesFromFilm, deriveAncillaryProfile } from './ancillary';
import { getTypicalSalaryForRole } from './person';
import { computeTalentCost } from './cost';
import { withRng, type RandomFn } from './random';
import type { Film, MarketingChoices, Person, ProductionScale, RivalProductionInProgress, RivalStudio, TalentAssignment } from '../types';

const M = 1_000_000;
const FAME_LEVELS = [20, 40, 60, 80, 95];
const EXECUTIONS = Number(process.env.STAR_EXECUTIONS ?? 40);
const SCALES: ProductionScale[] = ['Small', 'Medium', 'Big'];
const PLAN_SEEDS = (process.env.STAR_PLAN_SEEDS ?? '7000,7001').split(',').map(Number);

/** Progress the rival market and capture the first in-progress plan of each scale. */
function capturePlansByScale(seed: number): Map<ProductionScale, RivalProductionInProgress> {
  return withRng(seed, (rng: RandomFn) => {
    let rivalStudios: RivalStudio[] = generateRivalStudios(rng);
    let talentPool = generateTalentPool(rng);
    const initialOpp = settleOpportunities([], 1, 1, rng);
    let opportunities = initialOpp.opportunities;
    let nextOpportunityCheckDay = initialOpp.nextGenerationCheckDay;
    let productionsInProgress: RivalProductionInProgress[] = [];
    let runningFilms: Film[] = [];
    const found = new Map<ProductionScale, RivalProductionInProgress>();
    for (let day = 2; day <= 700 && found.size < SCALES.length; day++) {
      const settle = settleTheatricalMarket(runningFilms, [], productionsInProgress, rivalStudios, day, 20, rng);
      rivalStudios = rivalStudios.map((r) => {
        const d = settle.rivalDeltas.get(r.name);
        return d ? { ...r, cash: r.cash + d.cashCredit } : r;
      });
      const opp = settleOpportunities(opportunities, nextOpportunityCheckDay, day, rng);
      const current: RivalMarketUpdate = {
        rivalStudios,
        rivalProductionsInProgress: settle.stillInProgress,
        rivalFilmsReleased: settle.settledFilms.filter((f) => f.releasedBy !== undefined),
        talentPool,
        opportunities: opp.opportunities,
      };
      const market = settleRivalMarket(current, opp.resolvedBids.filter((b) => b.winnerId !== 'player'), day, [], rng);
      rivalStudios = market.rivalStudios;
      productionsInProgress = market.rivalProductionsInProgress;
      talentPool = market.talentPool;
      opportunities = market.opportunities;
      nextOpportunityCheckDay = opp.nextGenerationCheckDay;
      runningFilms = market.rivalFilmsReleased.filter((f) => f.boxOfficeRun.status !== 'finished');
      for (const p of productionsInProgress) {
        if (p.marketingChoices.releaseType === 'Wide' && !found.has(p.scale)) found.set(p.scale, p);
      }
    }
    return found;
  }).result;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) * q)];
};

/** Market rate for a lead of a given fame: median Lead Actor typicalSalary of pool actors within +-5 fame. */
function marketRateByFame(): (fame: number) => number {
  const pool = withRng(424242, (rng) => generateTalentPool(rng)).result;
  const actors: Person[] = Object.values(pool).flat().filter((p) => getTypicalSalaryForRole(p, 'Lead Actor') > 0);
  return (fame: number) => {
    const near = actors.filter((p) => Math.abs(p.reputation.fame - fame) <= 5).map((p) => getTypicalSalaryForRole(p, 'Lead Actor'));
    return near.length ? median(near) : 0;
  };
}

function withLeadFame(talent: TalentAssignment[], fame: number, salary?: number): TalentAssignment[] {
  return talent.map((a) =>
    a.role === 'Lead Actor'
      ? { ...a, person: { ...a.person, reputation: { ...a.person.reputation, fame } }, ...(salary !== undefined ? { agreedSalary: salary } : {}) }
      : a,
  );
}

function scaledMarketing(m: MarketingChoices, newSpend: number): MarketingChoices {
  const k = m.marketingSpend > 0 ? newSpend / m.marketingSpend : 1;
  const channelSpend = m.channelSpend
    ? (Object.fromEntries(Object.entries(m.channelSpend).map(([ch, v]) => [ch, (v as number) * k])) as MarketingChoices['channelSpend'])
    : undefined;
  return { ...m, marketingSpend: newSpend, ...(channelSpend ? { channelSpend } : {}) };
}

function resolveAndSettle(plan: RivalProductionInProgress, seed: number) {
  return withRng(seed, (rng: RandomFn) => {
    const film = resolveRivalProduction(plan, 'Star Sweep Studio', 60, 0, [], rng);
    const settled = settleBoxOfficeForAllFilms([film], film.releasedOnDay + 200);
    const f = settled.filmsReleased.find((x) => x.id === film.id)!;
    const gross = f.boxOfficeRun.cumulativeGross;
    const ancillary = deriveAncillaryProfile(ancillaryAttributesFromFilm(f, { studioPrestige: 50, awards: { wins: 0, nominations: 0 } }), gross).lifetimeTotal;
    const cost = Math.max(1, f.results.totalCost);
    return { opening: f.boxOfficeRun.weeks[0]?.gross ?? 0, gross, cost, ret: ((f.results.studioRevenue ?? 0) + ancillary) / cost, buzz: f.results.buzzScore ?? 0 };
  }).result;
}

const enabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BOX_OFFICE_DIAGNOSTIC,
);

describe.skipIf(!enabled)('what a star buys - controlled sweep', () => {
  it('prints opening, gross, floor, spread and return by lead fame', () => {
    const rate = marketRateByFame();
    const lines: string[] = ['\nSTAR SWEEP - lead fame varied, everything else fixed, same execution seeds per row'];
    lines.push(`  market rate (median Lead Actor fee): ${FAME_LEVELS.map((f) => `fame ${f} $${(rate(f) / M).toFixed(1)}M`).join('  ')}`);
    for (const planSeed of PLAN_SEEDS) {
      for (const [scale, plan] of capturePlansByScale(planSeed)) {
        const leads = plan.talent.filter((a) => a.role === 'Lead Actor');
        const baseFee = computeTalentCost(leads);
        lines.push(
          `\n  plan ${planSeed} ${scale} ${plan.genre}: ${leads.length} lead(s), original fame ${leads.map((l) => l.person.reputation.fame.toFixed(0)).join('/')}, lead fees $${(baseFee / M).toFixed(1)}M, marketing $${(plan.marketingChoices.marketingSpend / M).toFixed(0)}M`,
        );
        lines.push(`    ${'variant'.padEnd(8)} fame  ${'cost'.padStart(7)} ${'buzz'.padStart(5)} ${'opening'.padStart(8)} ${'gross'.padStart(8)} ${'p10'.padStart(7)}   CV   return`);
        for (const variant of ['fame only', 'priced', 'matched'] as const) {
          for (const fame of FAME_LEVELS) {
            const fee = rate(fame);
            const salaryDelta = (fee * leads.length) - baseFee;
            const variantPlan: RivalProductionInProgress =
              variant === 'fame only'
                ? { ...plan, talent: withLeadFame(plan.talent, fame) }
                : {
                    ...plan,
                    talent: withLeadFame(plan.talent, fame, fee),
                    marketingChoices:
                      variant === 'matched'
                        ? scaledMarketing(plan.marketingChoices, Math.max(0, plan.marketingChoices.marketingSpend - salaryDelta))
                        : plan.marketingChoices,
                  };
            const rs = Array.from({ length: EXECUTIONS }, (_, i) => resolveAndSettle(variantPlan, 9000 + i));
            const gross = rs.map((r) => r.gross);
            const mean = gross.reduce((a, b) => a + b, 0) / gross.length;
            const cv = Math.sqrt(gross.reduce((a, b) => a + (b - mean) ** 2, 0) / gross.length) / Math.max(1, mean);
            lines.push(
              `    ${variant.padEnd(9)} ${String(fame).padStart(3)}  $${(median(rs.map((r) => r.cost)) / M).toFixed(0).padStart(5)}M ${median(rs.map((r) => r.buzz)).toFixed(0).padStart(5)} $${(median(rs.map((r) => r.opening)) / M).toFixed(0).padStart(6)}M $${(median(gross) / M).toFixed(0).padStart(6)}M $${(quantile(gross, 0.1) / M).toFixed(0).padStart(5)}M  ${cv.toFixed(2)}   ${median(rs.map((r) => r.ret)).toFixed(2)}`,
            );
          }
        }
      }
    }
    console.log(lines.join('\n'));
  });
});
