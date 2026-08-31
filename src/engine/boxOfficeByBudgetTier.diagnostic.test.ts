/**
 * Calibration harness — PROFITABILITY BY BUDGET TIER, and against the whole P&L.
 *
 * boxOfficeDistribution.diagnostic.test.ts measures the industry in aggregate.
 * This one exists because two things are invisible to an aggregate, and both
 * turned out to be wrong:
 *
 * 1. **Tier shape.** Every band in that harness is a share of ALL wide releases,
 *    so a market where mid-budget films print money and tentpoles cannot make
 *    any can pass all of them - the two errors cancel. Measured on master before
 *    this file existed: a >$80M film cleared a median 0.86x while a $25-80M one
 *    cleared 1.74x, and `wideUnprofitablePct` sat inside its band throughout,
 *    because the cheap half of the field lost money often enough to average it
 *    out. That shape is the single loudest complaint about the model and nothing
 *    was measuring it.
 *
 * 2. **Which P&L.** `FilmResults.profit` is `studioRevenue - totalCost`, and
 *    `studioRevenue` is THEATRICAL rentals only. But the game pays post-theatrical
 *    revenue too - state/ancillarySettlement.ts credits it to the player over
 *    time and to rivals as a lump, and it is live, not staged. Measured, it is
 *    worth 79% (small) to 100% (tentpole) of theatrical rentals. So every
 *    profitability target ratified in docs/DESIGN_box_office_calibration_targets.md
 *    has been asserted against roughly HALF the revenue a film actually earns,
 *    and the calibration passes that chased those targets were tuning the wrong
 *    number. This harness reports both P&Ls side by side so that can never
 *    silently drift apart again.
 *
 * Tiers key on NEGATIVE cost (production only), never all-in, because that is
 * what "a mid-budget film" means everywhere in the industry and in
 * docs/domain/ - and because all-in tiering moves a film between tiers when the
 * marketing model changes, which makes the series incomparable across exactly
 * the passes it exists to measure.
 *
 * Opt-in, same flag as its sibling, and EXPECTED TO FAIL until the recalibration
 * lands - the harness encodes the target, not the current state:
 *
 *   BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeByBudgetTier.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it, expect } from 'vitest';
import { generateRivalStudios, settleRivalMarket, type RivalMarketUpdate } from './rivalStudios';
import { settleTheatricalMarket } from './marketSettlement';
import { generateTalentPool } from './talentGenerator';
import { settleOpportunities } from './opportunities';
import { ancillaryAttributesFromFilm, deriveAncillaryProfile } from './ancillary';
import { withRng, type RandomFn } from './random';
import type { Film, RivalProductionInProgress, RivalStudio } from '../types';

const M = 1_000_000;

// --- Tiers, by negative cost ------------------------------------------------
type Tier = 'small' | 'mid' | 'big';
const TIER_BOUNDS: Array<{ tier: Tier; label: string; maxNegative: number }> = [
  { tier: 'small', label: 'small (<$25M neg)', maxNegative: 25 * M },
  { tier: 'mid', label: 'mid ($25-80M neg)', maxNegative: 80 * M },
  { tier: 'big', label: 'big (>$80M neg)', maxNegative: Infinity },
];
const tierOf = (negativeCost: number): Tier => TIER_BOUNDS.find((t) => negativeCost < t.maxNegative)!.tier;

// --- Ratified targets (edit here) ------------------------------------------
//
// P&A as a share of negative cost. docs/domain/09-marketing-and-distribution.md
// §1: the greenlight placeholder is "often literally a rule (e.g. 0.8x negative
// cost domestic)", and a tentpole's global marketing "often approximates the
// negative cost". The load-bearing claim is that this ratio is roughly FLAT -
// the floor is structural (§1.3: national reach to ~85-90% awareness, a full
// asset package, an exhibitor circuit that notices when its 3,500 locations
// aren't advertised) and none of it scales down with how cheap the film was. A
// ratio that climbs with budget - as the model's did, 0.10 / 0.44 / 0.65 - has
// the economics backwards.
const PANDA_OVER_NEGATIVE: Record<Tier, [number, number]> = {
  small: [1.5, 2.5],
  mid: [1.0, 1.5],
  big: [0.8, 1.1],
};

// Median worldwide gross as a multiple of negative cost. Reference: the 12-film
// slate's own tiers - 12.3x for the $15M horror, 3.1x median across the six
// $25-80M films, 3.9x across the five over $80M.
const GROSS_OVER_NEGATIVE: Record<Tier, [number, number]> = {
  // Corrected from the ratified [7, 13] during implementation, because that band
  // and the small tier's own 40-55% unprofitable band cannot both hold. [7, 13]
  // was extrapolated from a single reference film - the slate's $15M horror at
  // 12.3x - which docs/domain/11 §5.4 explicitly calls "the best return on
  // capital on any slate", i.e. a winner, not a median. At the ratified P&A ratio
  // and revenue shares a small film breaks even (whole P&L) at ~4.7x, so a band
  // of [7, 13] puts the MEDIAN film at 1.5-2.8x break-even, which caps the tier
  // at roughly 20% unprofitable. Re-derived as "the median sits near its own
  // break-even", which is what the unprofitable band actually asserts, with room
  // above for the reference winner to sit in the upper tail where it belongs.
  // mid and big were checked the same way and are internally consistent.
  small: [4.5, 7],
  mid: [3, 5],
  big: [3.5, 5.5],
};

// The gross multiple at which a tier's median film breaks even THEATRICALLY -
// rentals covering negative cost plus P&A, before any post-theatrical revenue.
// The shape docs/domain/11 §6.1 makes explicit and the model had backwards in
// magnitude at every tier: it FALLS as budgets rise, because the P&A floor does
// not scale down.
//
// Theatrical, not whole-P&L, and the distinction is load-bearing. The ratified
// figures (~8.5x micro, ~5.1x mid, ~4.0x tentpole) come from worked cases whose
// arithmetic balances to zero on rentals alone: case A's $8M negative with $25M
// of distribution expense breaks even at $68M worldwide (68 x 0.485 - 25 - 8 =
// 0.0), case B's $45M with $66M at $230M (230 x 0.483 - 66 - 45 = 0.1). Measured
// against the whole P&L instead, the same films would appear to break even
// around 5x and 3.5x, and the band would be wrong by that whole factor. The v2
// targets document sourced these correctly but filed them under a whole-P&L
// heading; corrected there too.
const BREAKEVEN_MULTIPLE: Record<Tier, [number, number]> = {
  small: [7, 10],
  mid: [4.5, 6],
  big: [3.5, 4.5],
};

// §5 revenue-side ratios, over the whole field. Both were outside any defensible
// real range when v2 was drafted.
const RENTALS_OVER_GROSS_PCT: [number, number] = [44, 49];
const POST_THEATRICAL_OVER_RENTALS_PCT: [number, number] = [35, 55];

// Median return on the WHOLE P&L (theatrical rentals + post-theatrical), against
// all-in cost. The aggregate harness's ratified 45-55% unprofitable implies a
// median wide release sitting a little above break-even, and no tier should be
// far from that: the point of this band is that the tiers land in the SAME
// neighbourhood, not that any particular one is rich.
const MEDIAN_RETURN_ALL_IN: Record<Tier, [number, number]> = {
  small: [1.1, 2.4],
  mid: [0.95, 1.35],
  big: [1.0, 1.45],
};

// The complaint itself, as one number: how far the best-performing tier's median
// return outruns the worst. Real budget tiers do differ - cheap films have the
// higher ceiling on ROI, tentpoles the higher floor on gross - but a market
// where one tier earns twice what another does is one where a whole budget class
// is simply the wrong thing to make.
const MAX_TIER_RETURN_SPREAD = 1.8;

// Share of a tier's films failing to recoup, on the whole P&L. Directionally the
// aggregate 45-55%, widened per tier because tier counts are smaller.
const UNPROFITABLE_PCT: Record<Tier, [number, number]> = {
  small: [40, 55],
  mid: [40, 55],
  big: [35, 50],
};

const YEARS = 8;
const SEEDS = 6;
const HORIZON = YEARS * 365;

interface Rec {
  tier: Tier;
  negativeCost: number;
  marketingCost: number;
  gross: number;
  theatricalRevenue: number;
  ancillaryRevenue: number;
  allInCost: number;
}

function recordFinished(film: Film): Rec {
  const r = film.results;
  const gross = r.totalBoxOffice ?? film.boxOfficeRun.cumulativeGross;
  // Studio prestige is not knowable from a rival film alone and moves the
  // ancillary multipliers only modestly; the midpoint keeps this a property of
  // the film rather than of whichever studio happened to make it. Awards are
  // zeroed for the same reason - this harness runs no awards season.
  const profile = deriveAncillaryProfile(
    ancillaryAttributesFromFilm(film, { studioPrestige: 50, awards: { wins: 0, nominations: 0 } }),
    gross,
  );
  return {
    tier: tierOf(r.productionCost),
    negativeCost: r.productionCost,
    marketingCost: r.marketingCost,
    gross,
    theatricalRevenue: r.studioRevenue ?? 0,
    ancillaryRevenue: profile.lifetimeTotal,
    allInCost: Math.max(1, r.totalCost),
  };
}

/** Drives the real settlement loop for one seed. Mirrors boxOfficeDistribution.diagnostic.test.ts:runOneSeed exactly. */
function runOneSeed(seed: number): Rec[] {
  return withRng(seed, (rng: RandomFn) => {
    let rivalStudios: RivalStudio[] = generateRivalStudios(rng);
    let talentPool = generateTalentPool(rng);
    const initialOpp = settleOpportunities([], 1, 1, rng);
    let opportunities = initialOpp.opportunities;
    let nextOpportunityCheckDay = initialOpp.nextGenerationCheckDay;
    let productionsInProgress: RivalProductionInProgress[] = [];
    let runningFilms: Film[] = [];
    const recorded = new Set<string>();
    const out: Rec[] = [];

    for (let day = 2; day <= HORIZON; day++) {
      const marketSettlement = settleTheatricalMarket(runningFilms, [], productionsInProgress, rivalStudios, day, 20, rng);
      for (const f of marketSettlement.settledFilms) {
        if (f.releasedBy === undefined || f.boxOfficeRun.status !== 'finished' || recorded.has(f.id)) continue;
        if (f.marketingChoices.releaseType !== 'Wide') { recorded.add(f.id); continue; }
        recorded.add(f.id);
        out.push(recordFinished(f));
      }
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
      const current: RivalMarketUpdate = {
        rivalStudios,
        rivalProductionsInProgress: marketSettlement.stillInProgress,
        rivalFilmsReleased: marketSettlement.settledFilms.filter((f) => f.releasedBy !== undefined),
        talentPool,
        opportunities: oppSettlement.opportunities,
      };
      const rivalMarket = settleRivalMarket(current, oppSettlement.resolvedBids.filter((b) => b.winnerId !== 'player'), day, [], rng);
      rivalStudios = rivalMarket.rivalStudios;
      productionsInProgress = rivalMarket.rivalProductionsInProgress;
      talentPool = rivalMarket.talentPool;
      opportunities = rivalMarket.opportunities;
      nextOpportunityCheckDay = oppSettlement.nextGenerationCheckDay;
      runningFilms = rivalMarket.rivalFilmsReleased.filter((f) => f.boxOfficeRun.status !== 'finished');
    }
    return out;
  }).result;
}

const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
const share = (n: number, total: number) => (total ? (n / total) * 100 : 0);
const inBand = (v: number, [lo, hi]: [number, number]) => v >= lo && v <= hi;

const enabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BOX_OFFICE_DIAGNOSTIC,
);

describe.skipIf(!enabled)('box office profitability by budget tier', () => {
  it('lands in the ratified per-tier bands, measured on the whole P&L', () => {
    const all: Rec[] = [];
    for (let s = 0; s < SEEDS; s++) all.push(...runOneSeed(4001 + s * 977));

    const failures: string[] = [];
    const lines: string[] = [
      `\nPROFITABILITY BY BUDGET TIER - ${all.length} wide releases, ${SEEDS} seeds x ${YEARS}y`,
      '  tier                  n   negative      P&A   P&A/neg   gross   gross/neg |  return(theatrical)  return(ALL-IN P&L)  unprofitable',
    ];

    const medianReturnByTier: Partial<Record<Tier, number>> = {};
    for (const { tier, label } of TIER_BOUNDS) {
      const rows = all.filter((r) => r.tier === tier);
      if (rows.length === 0) { lines.push(`  ${label.padEnd(20)} (none)`); continue; }

      const negative = median(rows.map((r) => r.negativeCost));
      const panda = median(rows.map((r) => r.marketingCost));
      const gross = median(rows.map((r) => r.gross));
      const pandaRatio = median(rows.map((r) => r.marketingCost / Math.max(1, r.negativeCost)));
      const theatricalReturn = median(rows.map((r) => r.theatricalRevenue / r.allInCost));
      const allInReturn = median(rows.map((r) => (r.theatricalRevenue + r.ancillaryRevenue) / r.allInCost));
      const unprofitable = share(rows.filter((r) => r.theatricalRevenue + r.ancillaryRevenue < r.allInCost).length, rows.length);
      medianReturnByTier[tier] = allInReturn;

      lines.push(
        `  ${label.padEnd(20)} ${String(rows.length).padStart(3)}  ${(negative / M).toFixed(1).padStart(7)}M  ${(panda / M).toFixed(1).padStart(6)}M  ` +
          `${pandaRatio.toFixed(2).padStart(7)}  ${(gross / M).toFixed(0).padStart(5)}M  ${(gross / Math.max(1, negative)).toFixed(2).padStart(8)}x |  ` +
          `${theatricalReturn.toFixed(2).padStart(16)}x  ${allInReturn.toFixed(2).padStart(17)}x  ${unprofitable.toFixed(0).padStart(11)}%`,
      );

      if (!inBand(pandaRatio, PANDA_OVER_NEGATIVE[tier])) {
        failures.push(`${tier} P&A/negative: ${pandaRatio.toFixed(2)} not in [${PANDA_OVER_NEGATIVE[tier]}]`);
      }
      if (!inBand(allInReturn, MEDIAN_RETURN_ALL_IN[tier])) {
        failures.push(`${tier} median all-in return: ${allInReturn.toFixed(2)}x not in [${MEDIAN_RETURN_ALL_IN[tier]}]`);
      }
      if (!inBand(unprofitable, UNPROFITABLE_PCT[tier])) {
        failures.push(`${tier} unprofitable%: ${unprofitable.toFixed(0)} not in [${UNPROFITABLE_PCT[tier]}]`);
      }
      const grossMultiple = median(rows.map((r) => r.gross / Math.max(1, r.negativeCost)));
      if (!inBand(grossMultiple, GROSS_OVER_NEGATIVE[tier])) {
        failures.push(`${tier} median gross/negative: ${grossMultiple.toFixed(2)}x not in [${GROSS_OVER_NEGATIVE[tier]}]`);
      }
      // Where this tier's median film would have broken even theatrically: scale
      // its gross until rentals alone equal all-in cost. Rentals are proportional
      // to gross, so this is a single division.
      const breakeven = median(
        rows.map((r) => {
          const rentalsPerGross = r.theatricalRevenue / Math.max(1, r.gross);
          return rentalsPerGross > 0 ? r.allInCost / rentalsPerGross / Math.max(1, r.negativeCost) : 0;
        }),
      );
      if (!inBand(breakeven, BREAKEVEN_MULTIPLE[tier])) {
        failures.push(`${tier} theatrical break-even gross/negative: ${breakeven.toFixed(2)}x not in [${BREAKEVEN_MULTIPLE[tier]}]`);
      }
      lines.push(`      ${tier}: gross/neg ${grossMultiple.toFixed(2)}x, breaks even theatrically at ${breakeven.toFixed(2)}x`);
    }

    const returns = Object.values(medianReturnByTier).filter((v): v is number => v !== undefined && v > 0);
    if (returns.length > 1) {
      const spread = Math.max(...returns) / Math.min(...returns);
      lines.push(`\n  best tier's median return over worst: ${spread.toFixed(2)}x  (target <= ${MAX_TIER_RETURN_SPREAD})`);
      if (spread > MAX_TIER_RETURN_SPREAD) {
        failures.push(`tier return spread: ${spread.toFixed(2)}x exceeds ${MAX_TIER_RETURN_SPREAD}x - one budget class is simply the wrong thing to make`);
      }
    }

    // §5 revenue-side ratios - the arithmetic cause of any break-even gap above.
    const theatrical = all.reduce((s, r) => s + r.theatricalRevenue, 0);
    const ancillary = all.reduce((s, r) => s + r.ancillaryRevenue, 0);
    const grossTotal = all.reduce((s, r) => s + r.gross, 0);
    const rentalsPct = (100 * theatrical) / Math.max(1, grossTotal);
    const postPct = (100 * ancillary) / Math.max(1, theatrical);
    lines.push(
      `\n  theatrical rentals ÷ WW gross: ${rentalsPct.toFixed(1)}%   [${RENTALS_OVER_GROSS_PCT}]`,
      `  post-theatrical ÷ theatrical rentals: ${postPct.toFixed(0)}%   [${POST_THEATRICAL_OVER_RENTALS_PCT}]`,
    );
    if (!inBand(rentalsPct, RENTALS_OVER_GROSS_PCT)) failures.push(`rentals/gross: ${rentalsPct.toFixed(1)}% not in [${RENTALS_OVER_GROSS_PCT}]`);
    if (!inBand(postPct, POST_THEATRICAL_OVER_RENTALS_PCT)) failures.push(`post-theatrical/rentals: ${postPct.toFixed(0)}% not in [${POST_THEATRICAL_OVER_RENTALS_PCT}]`);

    console.log(lines.join('\n'));
    expect(failures, `\n${failures.join('\n')}\n`).toEqual([]);
  }, 900_000);
});
