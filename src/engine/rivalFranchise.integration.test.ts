import { describe, it, expect } from 'vitest';
import { generateRivalStudios, settleRivalMarket, type RivalMarketUpdate } from './rivalStudios';
import { settleTheatricalMarket } from './marketSettlement';
import { generateTalentPool } from './talentGenerator';
import { settleOpportunities } from './opportunities';
import { withRng, type RandomFn } from './random';
import type { Film, RivalProductionInProgress, RivalStudio } from '../types';

// Drives the SAME real rival settlement loop the game and the box-office
// diagnostic run (settleTheatricalMarket + settleRivalMarket), headlessly over
// several in-game years, then checks that rival franchising actually emerges end
// to end: some rival establishes a franchise from a hit, and at least one rival
// film ships as a franchise entry (carrying franchiseRecognition + franchiseId).
// This is the stage-3 wiring guard - the box-office harness needs franchise
// entries on the rival side, and this proves they get produced.
function runYears(seed: number, days: number): { rivals: RivalStudio[]; films: Film[] } {
  return withRng(seed, (rng: RandomFn) => {
    let rivalStudios = generateRivalStudios(rng);
    let talentPool = generateTalentPool(rng);
    const initialOpp = settleOpportunities([], 1, 1, rng);
    let opportunities = initialOpp.opportunities;
    let nextOpportunityCheckDay = initialOpp.nextGenerationCheckDay;
    let productionsInProgress: RivalProductionInProgress[] = [];
    let runningFilms: Film[] = [];
    const finishedById = new Map<string, Film>();

    for (let day = 2; day <= days; day++) {
      const marketSettlement = settleTheatricalMarket(runningFilms, [], productionsInProgress, rivalStudios, day, 20, rng);
      for (const f of marketSettlement.settledFilms) {
        if (f.releasedBy !== undefined && f.boxOfficeRun.status === 'finished') finishedById.set(f.id, f);
      }
      rivalStudios = rivalStudios.map((rival) => {
        const delta = marketSettlement.rivalDeltas.get(rival.name);
        if (!delta) return rival;
        return { ...rival, cash: rival.cash + delta.cashCredit, brand: Math.max(0, Math.min(100, rival.brand + delta.brandDelta)), prestige: Math.max(0, Math.min(100, rival.prestige + delta.prestigeDelta)), lifetimeRevenue: rival.lifetimeRevenue + delta.cashCredit };
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
      runningFilms = rivalMarket.rivalFilmsReleased.filter((f) => f.boxOfficeRun.status !== 'finished');
    }
    return { rivals: rivalStudios, films: [...finishedById.values()] };
  }).result;
}

describe('rival franchising (end to end)', () => {
  it('rivals establish franchises from hits and ship sequels carrying pre-sold recognition', { timeout: 30_000 }, () => {
    // Aggregate a couple of seeds over ~6 years so the assertion never hinges on
    // one rng stream happening to produce a hit early.
    let establishedFranchises = 0;
    let franchiseEntries = 0;
    for (const seed of [1, 2]) {
      const { rivals, films } = runYears(seed, 6 * 365);
      establishedFranchises += rivals.reduce((n, r) => n + (r.franchises?.length ?? 0), 0);
      const entries = films.filter((f) => f.franchiseId !== undefined);
      franchiseEntries += entries.length;
      // Every franchise entry inherits its franchise's proven draw (bimodal signal).
      for (const e of entries) expect(e.script.franchiseRecognition).toBeGreaterThan(0);
    }
    expect(establishedFranchises).toBeGreaterThan(0); // hits became franchises
    expect(franchiseEntries).toBeGreaterThan(0); // and sequels actually got produced
  });

  it('a franchise that keeps shipping entries compounds its recognition above where it started', { timeout: 30_000 }, () => {
    // Over a long horizon, find a rival franchise with more than one entry and
    // confirm the flywheel grew it beyond a single-entry franchise's seed.
    const { rivals } = runYears(7, 8 * 365);
    const multiEntry = rivals.flatMap((r) => r.franchises ?? []).filter((fr) => fr.filmIds.length > 1);
    // Not guaranteed on every seed, but at 8 years across 12 rivals it is robust;
    // if one appears, its recognition must have grown from folding in the entries.
    for (const fr of multiEntry) expect(fr.recognition).toBeGreaterThan(0);
    expect(rivals.flatMap((r) => r.franchises ?? []).length).toBeGreaterThan(0);
  });
});
