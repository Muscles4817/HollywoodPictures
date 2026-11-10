// Shared by the box-office diagnostic harnesses (boxOfficeVariance,
// boxOfficeVarianceAnatomy, receptionSpread): capture a real rival production
// plan by running the rival market forward, so a harness can resolve one FIXED
// plan under many execution seeds. Not used by the game.
import { generateRivalStudios, settleRivalMarket, type RivalMarketUpdate } from './rivalStudios';
import { settleTheatricalMarket } from './marketSettlement';
import { generateTalentPool } from './talentGenerator';
import { settleOpportunities } from './opportunities';
import { withRng, type RandomFn } from './random';
import type { Film, RivalProductionInProgress, RivalStudio } from '../types';

/** Progress the rival market until an in-progress production exists, then return the first one as a fixed plan to stress. */
export function captureOnePlan(seed: number): RivalProductionInProgress {
  return withRng(seed, (rng: RandomFn) => {
    let rivalStudios: RivalStudio[] = generateRivalStudios(rng);
    let talentPool = generateTalentPool(rng);
    const initialOpp = settleOpportunities([], 1, 1, rng);
    let opportunities = initialOpp.opportunities;
    let nextOpportunityCheckDay = initialOpp.nextGenerationCheckDay;
    let productionsInProgress: RivalProductionInProgress[] = [];
    let runningFilms: Film[] = [];

    for (let day = 2; day <= 400; day++) {
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
      // Prefer a Big-scale plan (the tentpole case the brief cares about).
      const big = productionsInProgress.find((p) => p.scale === 'Big');
      if (big) return big;
      if (productionsInProgress.length > 0 && day > 350) return productionsInProgress[0];
    }
    throw new Error('no rival production captured within horizon');
  }).result;
}
