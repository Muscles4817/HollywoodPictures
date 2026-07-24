import { describe, it, expect } from 'vitest';
import { generateRivalStudios, settleRivalMarket, type RivalMarketUpdate } from './rivalStudios';
import { settleTheatricalMarket } from './marketSettlement';
import { generateTalentPool } from './talentGenerator';
import { settleOpportunities, type ResolvedBid } from './opportunities';
import { withRng, type RandomFn } from './random';
import { MAX_SIMULATION_WEEKS } from './audienceSimulationStep';
import { computeRecommendedShootDays, computeRecommendedPostProductionDays } from './production';
import type { UpcomingRelease } from './releaseCrowding';

/**
 * Milestone: Opportunity Market bidding. A rival no longer starts a
 * production atomically inside a single settleRivalMarket call - it places
 * a bid (Phase 1, still on the existing per-tier spawn-check cadence), and
 * only actually casts/plans/starts one once that bid has won at a weekly
 * market tick (Phase 2, driven by engine/opportunities.ts:settleOpportunities's
 * own resolution). This drives both phases for real, the same order
 * state/studioReducer.ts does, rather than reimplementing the resolution
 * logic here - `bidDay` is when spawn checks place bids, `resolutionDay`
 * (>= the pool's own nextGenerationCheckDay) is when they're weighed.
 */
function bidThenResolve(
  market: RivalMarketUpdate,
  bidDay: number,
  nextGenerationCheckDay: number,
  resolutionDay: number,
  playerScheduled: UpcomingRelease[],
  rng: RandomFn,
): { afterBid: RivalMarketUpdate; afterResolve: RivalMarketUpdate; resolvedBids: ResolvedBid[] } {
  const afterBid = settleRivalMarket(market, [], bidDay, playerScheduled, rng);
  const opportunitySettlement = settleOpportunities(afterBid.opportunities, nextGenerationCheckDay, resolutionDay, rng);
  const resolvedRivalBids = opportunitySettlement.resolvedBids.filter((b) => b.winnerId !== 'player');
  const afterResolve = settleRivalMarket(
    { ...afterBid, opportunities: opportunitySettlement.opportunities },
    resolvedRivalBids,
    resolutionDay,
    playerScheduled,
    rng,
  );
  return { afterBid, afterResolve, resolvedBids: opportunitySettlement.resolvedBids };
}

/** A market with every rival forced to spawn-check on day 1, and a real freshly-generated batch of Opportunities to bid on - without the latter, considerBiddingOnOpportunity always finds nothing and every test below would be vacuous. */
function freshMarket(seed: number): { market: RivalMarketUpdate; totalDays: number } {
  const { result } = withRng(seed, (rng) => {
    const rivalStudios = generateRivalStudios(rng).map((r) => ({ ...r, nextSpawnCheckDay: 1 }));
    const talentPool = generateTalentPool(rng);
    const opportunitySettlement = settleOpportunities([], 1, 1, rng);
    return { rivalStudios, talentPool, opportunities: opportunitySettlement.opportunities, nextGenerationCheckDay: opportunitySettlement.nextGenerationCheckDay };
  });
  return {
    market: {
      rivalStudios: result.rivalStudios,
      rivalProductionsInProgress: [],
      rivalFilmsReleased: [],
      talentPool: result.talentPool,
      opportunities: result.opportunities,
    },
    totalDays: 1,
  };
}

describe('settleRivalMarket - bidding (Milestone: Opportunity Market bidding)', () => {
  it('a spawn-checking rival with spare capacity and cash places a bid instead of instantly starting a production', () => {
    const { market, totalDays } = freshMarket(1);
    const { result } = withRng(2, (rng) => settleRivalMarket(market, [], totalDays, [], rng));
    expect(result.rivalProductionsInProgress).toEqual([]); // nothing starts on the bid alone
    const totalBids = result.opportunities.reduce((sum, o) => sum + o.bids.length, 0);
    expect(totalBids).toBeGreaterThan(0);
  });

  it('a rival already carrying an outstanding bid does not place a second, parallel one at its next spawn check', () => {
    const { market, totalDays } = freshMarket(3);
    const { result: afterFirst } = withRng(4, (rng) => settleRivalMarket(market, [], totalDays, [], rng));
    const totalBidsAfterFirst = afterFirst.opportunities.reduce((sum, o) => sum + o.bids.length, 0);
    // Force every studio to check in again immediately, same market otherwise.
    const forcedRecheck: RivalMarketUpdate = { ...afterFirst, rivalStudios: afterFirst.rivalStudios.map((r) => ({ ...r, nextSpawnCheckDay: totalDays })) };
    const { result: afterSecond } = withRng(5, (rng) => settleRivalMarket(forcedRecheck, [], totalDays, [], rng));
    const totalBidsAfterSecond = afterSecond.opportunities.reduce((sum, o) => sum + o.bids.length, 0);
    // Bids can still move (a rival that already has one might raise it, still exactly one active bid of its own), but no rival exceeds one active bid.
    for (const rival of afterSecond.rivalStudios) {
      const ownBidCount = afterSecond.opportunities.filter((o) => o.bids.some((b) => b.bidderId === rival.id)).length;
      expect(ownBidCount).toBeLessThanOrEqual(1);
    }
    expect(totalBidsAfterSecond).toBeGreaterThanOrEqual(totalBidsAfterFirst);
  });

  it('once a bid wins at the weekly tick, the rival actually casts and starts a production from that exact script', () => {
    const { market, totalDays } = freshMarket(20);
    const { afterBid, afterResolve, resolvedBids } = withRng(22, (rng) =>
      bidThenResolve(market, totalDays, 8, 8, [], rng),
    ).result;
    expect(resolvedBids.length).toBeGreaterThan(0);
    expect(afterResolve.rivalProductionsInProgress.length).toBeGreaterThan(0);
    const won = resolvedBids[0];
    const started = afterResolve.rivalProductionsInProgress.find((p) => p.rivalStudioId === won.winnerId);
    expect(started).toBeDefined();
    expect(started!.script.id).toBe(won.opportunity.script.id);
    // Never both bidding AND already producing from the same win in the intermediate state.
    expect(afterBid.rivalProductionsInProgress).toEqual([]);
  });

  it("a rival that can no longer afford its own winning bid at resolution time forfeits cleanly - the opportunity re-enters the pool with bids cleared, not thrown or overspent", () => {
    const { market, totalDays } = freshMarket(22);
    // Bankrupt every rival between bidding and resolution, simulating cash
    // having moved elsewhere in the interim (another win, in real play).
    const { afterBid } = withRng(23, (rng) => bidThenResolve(market, totalDays, 8, 8, [], rng)).result;
    const brokeAfterBid: RivalMarketUpdate = { ...afterBid, rivalStudios: afterBid.rivalStudios.map((r) => ({ ...r, cash: 0 })) };
    const opportunitySettlement = withRng(24, (rng) => settleOpportunities(brokeAfterBid.opportunities, 8, 8, rng)).result;
    const resolvedRivalBids = opportunitySettlement.resolvedBids.filter((b) => b.winnerId !== 'player');
    expect(resolvedRivalBids.length).toBeGreaterThan(0); // sanity - this seed produced at least one contested opportunity
    const { result: afterResolve } = withRng(25, (rng) =>
      settleRivalMarket({ ...brokeAfterBid, opportunities: opportunitySettlement.opportunities }, resolvedRivalBids, 8, [], rng),
    );
    expect(afterResolve.rivalProductionsInProgress).toEqual([]);
    for (const resolved of resolvedRivalBids) {
      const reopened = afterResolve.opportunities.find((o) => o.id === resolved.opportunity.id);
      expect(reopened).toBeDefined();
      expect(reopened!.bids).toEqual([]);
    }
    for (const rival of afterResolve.rivalStudios) {
      expect(rival.cash).toBeGreaterThanOrEqual(0);
    }
  });
});

// Every Genre paired with a plausible strength/audience, one entry per day -
// an adversarial "the whole calendar, in every genre, is crowded" set,
// deliberately genre-exhaustive since the rival's own actual genre (which
// engine/releaseCrowding.ts:computeCompetitiveCrowding weighs heavily via
// its match/mismatch terms) isn't known ahead of a real market resolution.
const ALL_GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Thriller'] as const;
function adversarialCalendar(totalDays: number, days: number): UpcomingRelease[] {
  const entries: UpcomingRelease[] = [];
  for (let i = 0; i < days; i++) {
    for (const genre of ALL_GENRES) {
      entries.push({ releaseDay: totalDays + i, genre, targetAudience: 'Mass Market', strength: 1 });
    }
  }
  return entries;
}

describe('settleRivalMarket - shared-calendar awareness (roadmap Phase 7.4)', () => {
  it('a rival still starts a production even when the player has already claimed a huge swath of the calendar (no starvation, just a nudge)', () => {
    const { market, totalDays } = freshMarket(2);
    // Every day for the next year, every genre, at maximum strength - an
    // adversarial worst case for the light nudge
    // (engine/rivalStudios.ts:avoidCrowdedReleaseDay gives up after
    // MAX_RELEASE_DAY_NUDGES rather than looping forever).
    const { afterResolve } = withRng(4, (rng) => bidThenResolve(market, totalDays, 8, 8, adversarialCalendar(totalDays, 365), rng)).result;
    expect(afterResolve.rivalProductionsInProgress.length).toBeGreaterThan(0);
  });

  it("a rival's naive release day nudges away from a day the player already occupies with a genre/audience-matching release, landing later", () => {
    const { market, totalDays } = freshMarket(3);
    const { afterResolve: withoutPlayer } = withRng(5, (rng) => bidThenResolve(market, totalDays, 8, 8, [], rng)).result;
    const naive = withoutPlayer.rivalProductionsInProgress[0];
    expect(naive).toBeDefined();

    // Re-run the exact same rng seed, but now with the player occupying
    // that exact naive day with a release that fully matches this rival's
    // own genre/audience (guaranteeing full-weight crowding, not diluted
    // by a mismatch) - the rival's own day should move, deterministically.
    const matchingCompetitor: UpcomingRelease = { releaseDay: naive!.releaseDay, genre: naive!.genre, targetAudience: naive!.targetAudience, strength: 1 };
    const { afterResolve: withPlayer } = withRng(5, (rng) => bidThenResolve(market, totalDays, 8, 8, [matchingCompetitor], rng)).result;
    const nudgedDay = withPlayer.rivalProductionsInProgress[0]?.releaseDay;
    expect(nudgedDay).toBeDefined();
    expect(nudgedDay).not.toBe(naive!.releaseDay);
    expect(nudgedDay!).toBeGreaterThan(naive!.releaseDay);
  });

  // Post-Production Redesign, Phase C (docs/DESIGN_REVIEW_post_production_redesign.md
  // section 3) - a rival's own naive pacing used to sum the player-facing
  // STAGE_DURATIONS constant (now retired, data/schedule.ts), which would
  // have silently collapsed to zero once that happened. Reuses
  // computeRecommendedPostProductionDays directly instead, the same real
  // formula the player's own post-production estimate uses.
  it("a rival's release day always leaves room for real shoot days plus a real post-production estimate for its own cast/crew, not an invented flat constant", () => {
    const { market, totalDays } = freshMarket(6);
    const { afterResolve } = withRng(6, (rng) => bidThenResolve(market, totalDays, 8, 8, [], rng)).result;
    const production = afterResolve.rivalProductionsInProgress[0];
    expect(production).toBeDefined();

    const shootDays = computeRecommendedShootDays(production!.talent, production!.script, production!.productionChoices);
    const postProductionDays = computeRecommendedPostProductionDays(production!.talent, production!.productionChoices);
    expect(postProductionDays).toBeGreaterThan(0); // sanity - a real, non-zero estimate

    // avoidCrowdedReleaseDay only ever nudges the naive day later (never
    // earlier, see the test above), so this is a floor, not an equality.
    expect(production!.releaseDay).toBeGreaterThanOrEqual(totalDays + shootDays + postProductionDays);
  });
});

describe('settleRivalMarket - AI Studios 2.0 financial constraints', () => {
  it('every rival studio starts with real, positive cash and zero lifetime revenue/expenditure', () => {
    const { result } = withRng(100, (rng) => generateRivalStudios(rng));
    for (const rival of result) {
      expect(rival.cash).toBeGreaterThan(0);
      expect(rival.brand).toBeGreaterThan(0);
      expect(rival.prestige).toBeGreaterThan(0);
      expect(rival.lifetimeRevenue).toBe(0);
      expect(rival.lifetimeExpenditure).toBe(0);
    }
  });

  it('a studio with zero cash never places a bid at all - it has no budget to offer for even the cheapest script', () => {
    const { market, totalDays } = freshMarket(10);
    const brokeId = market.rivalStudios[0].id;
    const brokeMarket: RivalMarketUpdate = {
      ...market,
      rivalStudios: market.rivalStudios.map((r) => (r.id === brokeId ? { ...r, cash: 0 } : r)),
    };
    const { result } = withRng(11, (rng) => settleRivalMarket(brokeMarket, [], totalDays, [], rng));
    const brokeAfter = result.rivalStudios.find((r) => r.id === brokeId)!;
    expect(brokeAfter.cash).toBe(0);
    expect(result.opportunities.some((o) => o.bids.some((b) => b.bidderId === brokeId))).toBe(false);
    // The heuristic itself is untouched - it still checked in and will check again later, exactly
    // like a studio that found no available talent for a mandatory role.
    expect(brokeAfter.nextSpawnCheckDay).toBeGreaterThan(totalDays);
  });

  it('every rival whose bid wins has its own cash reduced by exactly that production\'s total commitment (bid + rest), and lifetimeExpenditure tracks the same amount - with no cross-studio bleed and never overspending', () => {
    const { market, totalDays } = freshMarket(20);
    const { afterBid, afterResolve, resolvedBids } = withRng(21, (rng) => bidThenResolve(market, totalDays, 8, 8, [], rng)).result;
    expect(resolvedBids.length).toBeGreaterThan(0); // sanity - this seed actually exercises bidding+resolution
    for (const rivalAfter of afterResolve.rivalStudios) {
      const rivalBefore = afterBid.rivalStudios.find((r) => r.id === rivalAfter.id)!;
      const started = afterResolve.rivalProductionsInProgress.find((p) => p.rivalStudioId === rivalAfter.id);
      if (started) {
        const spent = rivalBefore.cash - rivalAfter.cash;
        expect(spent).toBeGreaterThan(0);
        expect(rivalAfter.lifetimeExpenditure).toBeCloseTo(spent);
      } else {
        expect(rivalAfter.cash).toBe(rivalBefore.cash);
      }
      expect(rivalAfter.cash).toBeGreaterThanOrEqual(0); // AI should never deliberately spend money it doesn't have
    }
  });

  it("a finished run's box-office revenue and Brand/Prestige change apply to the studio that actually released the film, matching that film's own recorded studioRevenue/brandChange/prestigeChange - not mixed up with any other rival", () => {
    // Release resolution and box office settlement moved to
    // engine/marketSettlement.ts:settleTheatricalMarket (the "Live screen
    // competition" implementation plan) - settleRivalMarket itself is
    // bidding-only now, so this drives that function directly instead. No
    // spawn-check isolation needed any more either: unlike settleRivalMarket,
    // settleTheatricalMarket has no bidding/spawning logic of its own to
    // confound the tracked studio's cash delta with a second production.
    const { market, totalDays } = freshMarket(4);
    const { afterResolve: afterSpawn, resolvedBids } = withRng(5, (rng) => bidThenResolve(market, totalDays, 8, 8, [], rng)).result;
    expect(resolvedBids.length).toBeGreaterThan(0);
    const started = afterSpawn.rivalProductionsInProgress[0];
    expect(started).toBeDefined();
    const rivalName = afterSpawn.rivalStudios.find((r) => r.id === started.rivalStudioId)!.name;

    const finishDay = started.releaseDay + MAX_SIMULATION_WEEKS * 7;
    const { result: settlement } = withRng(53, (rng) => settleTheatricalMarket([], [], [started], afterSpawn.rivalStudios, finishDay, 50, rng));

    const film = settlement.settledFilms.find((f) => f.id === `rival-film-${started.id}`);
    expect(film).toBeDefined();
    expect(film!.results.totalBoxOffice).not.toBeNull();
    expect(film!.results.studioRevenue).not.toBeNull();
    expect(film!.results.brandChange).not.toBeNull();
    expect(film!.results.prestigeChange).not.toBeNull();

    const delta = settlement.rivalDeltas.get(rivalName);
    expect(delta).toBeDefined();
    // cashCredit is the sum of each settled week's own rounded studio share,
    // not a single round of the final total - the same two independently-
    // rounded figures boxOfficeRun.test.ts's own "cashCredit equals the sum
    // of each newly-settled week's gross times the studio share" test
    // documents, so they can drift by a rounding unit or two per settled
    // week rather than match results.studioRevenue exactly.
    expect(delta!.cashCredit).toBeGreaterThan(0);
    expect(Math.abs(delta!.cashCredit - film!.results.studioRevenue!)).toBeLessThanOrEqual(MAX_SIMULATION_WEEKS);
    expect(delta!.brandDelta).toBe(film!.results.brandChange);
    expect(delta!.prestigeDelta).toBe(film!.results.prestigeChange);

    // No other rival studio is credited anything from this one studio's film.
    for (const other of afterSpawn.rivalStudios) {
      if (other.id === started.rivalStudioId) continue;
      expect(settlement.rivalDeltas.has(other.name)).toBe(false);
    }
  });
});
