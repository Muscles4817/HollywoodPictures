/**
 * Empirical diagnostic for how much the release calendar actually matters
 * (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md section 9).
 *
 * Before building a release-date clock it is worth knowing whether the crowding
 * model it would lean on has any teeth. This drives the real rival market for
 * several in-game years, then measures the crowding a player film would face -
 * both picking an arbitrary day in its own genre, and colliding head-on with a
 * same-genre, same-audience rival.
 *
 * Skipped in the normal suite (an analysis harness, not an assertion) - run it
 * deliberately with:
 *
 *   CROWDING_DIAGNOSTIC=1 npx vitest run src/engine/releaseCrowding.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it } from 'vitest';
import { withRng, type RandomFn } from './random';
import { generateRivalStudios, settleRivalMarket, rivalAsUpcomingRelease, type RivalMarketUpdate } from './rivalStudios';
import { settleTheatricalMarket } from './marketSettlement';
import { settleOpportunities } from './opportunities';
import { generateTalentPool } from './talentGenerator';
import { computeCompetitiveCrowding, type UpcomingRelease } from './releaseCrowding';
import type { Film, RivalProductionInProgress, RivalStudio } from '../types';

const HORIZON = 1400;

const diagnosticEnabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CROWDING_DIAGNOSTIC,
);

describe.skipIf(!diagnosticEnabled)('release crowding diagnostic', () => {
  it('reports the crowding a player release actually faces', () => {
  const snapshots: UpcomingRelease[][] = [];
  withRng(3, (rng: RandomFn) => {
    let rivalStudios: RivalStudio[] = generateRivalStudios(rng);
    let talentPool = generateTalentPool(rng);
    const initial = settleOpportunities([], 1, 1, rng);
    let opportunities = initial.opportunities;
    let nextCheck = initial.nextGenerationCheckDay;
    let productionsInProgress: RivalProductionInProgress[] = [];
    let runningFilms: Film[] = [];

    for (let day = 2; day <= HORIZON; day++) {
      const settlement = settleTheatricalMarket(runningFilms, [], productionsInProgress, rivalStudios, day, 20, rng);
      runningFilms = settlement.settledFilms;
      // Credit each rival's box office, exactly as the real loop does - without
      // this they never get paid, go broke, and stop making films.
      rivalStudios = rivalStudios.map((rival) => {
        const delta = settlement.rivalDeltas.get(rival.name);
        if (!delta) return rival;
        return {
          ...rival,
          cash: rival.cash + delta.cashCredit,
          brand: Math.max(0, Math.min(100, rival.brand + delta.brandDelta)),
          prestige: Math.max(0, Math.min(100, rival.prestige + delta.prestigeDelta)),
          lifetimeRevenue: rival.lifetimeRevenue + delta.cashCredit,
        };
      });
      const opp = settleOpportunities(opportunities, nextCheck, day, rng);
      opportunities = opp.opportunities;
      nextCheck = opp.nextGenerationCheckDay;
      const current: RivalMarketUpdate = {
        rivalStudios,
        rivalProductionsInProgress: settlement.stillInProgress,
        rivalFilmsReleased: settlement.settledFilms.filter((f) => f.releasedBy !== undefined),
        talentPool,
        opportunities,
      };
      const after = settleRivalMarket(current, opp.resolvedBids.filter((b) => b.winnerId !== 'player'), day, [], rng);
      rivalStudios = after.rivalStudios;
      productionsInProgress = after.rivalProductionsInProgress;
      talentPool = after.talentPool;
      opportunities = after.opportunities;
      if (day % 200 === 0) snapshots.push(productionsInProgress.map((p) => rivalAsUpcomingRelease(p)));
    }
    return null;
  });

  const all = snapshots[snapshots.length - 1] ?? [];
  console.log(`\nrival releases upcoming at end of run: ${all.length}`);
  console.log(`per-snapshot counts: ${snapshots.map((s) => s.length).join(', ')}`);
  if (all.length) console.log(`strengths: ${all.map((u) => u.strength.toFixed(2)).sort().join(', ')}`);

  // Head-on: a player film in the SAME genre and audience, opening the same day.
  const headOn: number[] = [];
  for (const snapshot of snapshots) {
    for (const u of snapshot) {
      headOn.push(computeCompetitiveCrowding({ releaseDay: u.releaseDay, genre: u.genre, targetAudience: u.targetAudience }, snapshot, 0.6));
    }
  }
  // What a player actually faces picking an arbitrary day, in their own genre -
  // the number that decides whether the date choice matters at all.
  const arbitrary: number[] = [];
  for (const snapshot of snapshots) {
    if (!snapshot.length) continue;
    // Sample across the days rivals ACTUALLY occupy, not an arbitrary window -
    // sampling day 1-360 when the calendar sits at day 900+ would just measure
    // empty space and report it as "crowding never happens".
    const days = snapshot.map((u) => u.releaseDay);
    const lo = Math.min(...days);
    const hi = Math.max(...days);
    console.log(`  snapshot: ${snapshot.length} releases spanning days ${lo}-${hi} (${hi - lo} days)`);
    for (let day = lo; day <= hi; day += 7) {
      arbitrary.push(computeCompetitiveCrowding({ releaseDay: day, genre: snapshot[0].genre, targetAudience: snapshot[0].targetAudience }, snapshot, 0.6));
    }
  }
  arbitrary.sort((a, b) => a - b);
  const aq = (p: number) => (arbitrary.length ? arbitrary[Math.floor((arbitrary.length - 1) * p)] : 0);
  const amean = arbitrary.length ? arbitrary.reduce((a, b) => a + b, 0) / arbitrary.length : 0;
  console.log(`\narbitrary days sampled: ${arbitrary.length}`);
  console.log(`  crowding  mean ${amean.toFixed(3)}  median ${aq(0.5).toFixed(3)}  p90 ${aq(0.9).toFixed(3)}  max ${aq(1).toFixed(3)}`);
  console.log(`  best-vs-worst day availability spread: ${((1 - 0.5 * aq(0)) * 100).toFixed(1)}% vs ${((1 - 0.5 * aq(1)) * 100).toFixed(1)}%`);

  headOn.sort((a, b) => a - b);
  const q = (p: number) => (headOn.length ? headOn[Math.floor((headOn.length - 1) * p)] : 0);
  const mean = headOn.length ? headOn.reduce((a, b) => a + b, 0) / headOn.length : 0;
  console.log(`\nhead-on collisions sampled: ${headOn.length}`);
  console.log(`  crowding  mean ${mean.toFixed(3)}  median ${q(0.5).toFixed(3)}  p90 ${q(0.9).toFixed(3)}  max ${q(1).toFixed(3)}`);
  console.log(`  opening availability kept: mean ${((1 - 0.5 * mean) * 100).toFixed(1)}%, worst ${((1 - 0.5 * q(1)) * 100).toFixed(1)}%`);
  });
});
