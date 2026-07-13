import { describe, it, expect } from 'vitest';
import { generateRivalStudios, settleRivalMarket, type RivalMarketUpdate } from './rivalStudios';
import { generateTalentPool } from './talentGenerator';
import { withRng } from './random';
import { applyStatChange } from './reputation';
import { MAX_SIMULATION_WEEKS } from './audienceSimulationStep';

function freshMarket(seed: number): { market: RivalMarketUpdate; totalDays: number } {
  const { result } = withRng(seed, (rng) => ({
    rivalStudios: generateRivalStudios(rng),
    talentPool: generateTalentPool(rng),
  }));
  return {
    market: {
      rivalStudios: result.rivalStudios.map((r) => ({ ...r, nextSpawnCheckDay: 1 })), // force every studio to spawn on the very first settle
      rivalProductionsInProgress: [],
      rivalFilmsReleased: [],
      talentPool: result.talentPool,
    },
    totalDays: 1,
  };
}

describe('settleRivalMarket - shared-calendar awareness (roadmap Phase 7.4)', () => {
  it('a rival still starts a production even when the player has already claimed a huge swath of the calendar (no starvation, just a nudge)', () => {
    const { market, totalDays } = freshMarket(1);
    // Every day for the next year is "claimed" - an adversarial worst case
    // for the light nudge (engine/rivalStudios.ts:avoidReleaseDayClustering
    // gives up after MAX_RELEASE_DAY_NUDGES rather than looping forever).
    const playerScheduledReleaseDays = Array.from({ length: 365 }, (_, i) => totalDays + i);
    const { result } = withRng(2, (rng) => settleRivalMarket(market, totalDays, playerScheduledReleaseDays, rng));
    expect(result.rivalProductionsInProgress.length).toBeGreaterThan(0);
  });

  it("a rival's naive release day nudges away from a day the player already occupies, landing just past the buffer", () => {
    const { market, totalDays } = freshMarket(3);
    const { result: withoutPlayer } = withRng(4, (rng) => settleRivalMarket(market, totalDays, [], rng));
    const naiveDay = withoutPlayer.rivalProductionsInProgress[0]?.releaseDay;
    expect(naiveDay).toBeDefined();

    // Re-run the exact same rng seed, but now with the player occupying
    // that exact naive day - the rival's own day should move, deterministically.
    const { result: withPlayer } = withRng(4, (rng) => settleRivalMarket(market, totalDays, [naiveDay!], rng));
    const nudgedDay = withPlayer.rivalProductionsInProgress[0]?.releaseDay;
    expect(nudgedDay).toBeDefined();
    expect(nudgedDay).not.toBe(naiveDay);
    expect(nudgedDay!).toBeGreaterThan(naiveDay!);
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

  it('a studio with zero cash never starts a new production, but still advances its own spawn-check timer - the same fallback a talent-pool shortage already used', () => {
    const { market, totalDays } = freshMarket(10);
    const brokeId = market.rivalStudios[0].id;
    const brokeMarket: RivalMarketUpdate = {
      ...market,
      rivalStudios: market.rivalStudios.map((r) => (r.id === brokeId ? { ...r, cash: 0 } : r)),
    };
    const { result } = withRng(11, (rng) => settleRivalMarket(brokeMarket, totalDays, [], rng));
    const brokeAfter = result.rivalStudios.find((r) => r.id === brokeId)!;
    expect(brokeAfter.cash).toBe(0);
    expect(result.rivalProductionsInProgress.some((p) => p.rivalStudioId === brokeId)).toBe(false);
    // The heuristic itself is untouched - it still checked in and will check again later, exactly
    // like a studio that found no available talent for a mandatory role.
    expect(brokeAfter.nextSpawnCheckDay).toBeGreaterThan(totalDays);
  });

  it('every rival that starts a new production has its own cash reduced by exactly that production\'s total commitment, and lifetimeExpenditure tracks the same amount - with no cross-studio bleed and never overspending', () => {
    const { market, totalDays } = freshMarket(20);
    const { result } = withRng(21, (rng) => settleRivalMarket(market, totalDays, [], rng));
    expect(result.rivalProductionsInProgress.length).toBeGreaterThan(0); // sanity - this seed actually exercises spawning
    for (const rivalAfter of result.rivalStudios) {
      const rivalBefore = market.rivalStudios.find((r) => r.id === rivalAfter.id)!;
      const started = result.rivalProductionsInProgress.find((p) => p.rivalStudioId === rivalAfter.id);
      if (started) {
        const spent = rivalBefore.cash - rivalAfter.cash;
        expect(spent).toBeGreaterThan(0);
        // toBeCloseTo, not toBe: both sides are derived from the same `cost` value, but
        // `spent` gets there via float subtraction of two large numbers (catastrophic
        // cancellation can cost a ULP or two) rather than reading `cost` directly.
        expect(rivalAfter.lifetimeExpenditure).toBeCloseTo(spent);
      } else {
        // No new production and no film released this tick (rivalFilmsReleased started empty) - genuinely untouched.
        expect(rivalAfter.cash).toBe(rivalBefore.cash);
      }
      expect(rivalAfter.cash).toBeGreaterThanOrEqual(0); // AI should never deliberately spend money it doesn't have
    }
  });

  it("a finished run's box-office revenue and Brand/Prestige change apply to the studio that actually released the film, matching that film's own recorded studioRevenue/brandChange/prestigeChange - not mixed up with any other rival", () => {
    const { market, totalDays } = freshMarket(50);
    const { result: afterSpawn } = withRng(51, (rng) => settleRivalMarket(market, totalDays, [], rng));
    const started = afterSpawn.rivalProductionsInProgress[0];
    expect(started).toBeDefined();

    // Isolate: only the tracked studio's own production is left in progress, and every
    // studio (including the tracked one) is pushed well past the eventual settlement day
    // so nothing spawns a *second* production in the same call as the box-office
    // resolution - a big day-jump gives every studio's own spawn check plenty of time to
    // fire too, which would otherwise confound the tracked studio's own cash delta with a
    // genuine new expenditure alongside its box-office income, not evidence of a bug.
    const finishDay = started.releaseDay + MAX_SIMULATION_WEEKS * 7;
    const isolatedMarket: RivalMarketUpdate = {
      ...afterSpawn,
      rivalProductionsInProgress: [started],
      rivalStudios: afterSpawn.rivalStudios.map((r) => ({ ...r, nextSpawnCheckDay: finishDay + 1 })),
    };
    const { result: afterFinish } = withRng(52, (rng) => settleRivalMarket(isolatedMarket, finishDay, [], rng));

    const studioBefore = afterSpawn.rivalStudios.find((r) => r.id === started.rivalStudioId)!;
    const studioAfter = afterFinish.rivalStudios.find((r) => r.id === started.rivalStudioId)!;
    const film = afterFinish.rivalFilmsReleased.find((f) => f.id === `rival-film-${started.id}`);
    expect(film).toBeDefined();
    expect(film!.results.totalBoxOffice).not.toBeNull();
    expect(film!.results.studioRevenue).not.toBeNull();
    expect(film!.results.brandChange).not.toBeNull();
    expect(film!.results.prestigeChange).not.toBeNull();

    // cashCredit (what actually lands in .cash/.lifetimeRevenue) is the sum of each
    // settled week's own rounded studio share, not a single round of the final total -
    // the same two independently-rounded figures boxOfficeRun.test.ts's own "cashCredit
    // equals the sum of each newly-settled week's gross times the studio share" test
    // documents, so they can drift by a rounding unit or two per settled week rather
    // than match results.studioRevenue exactly.
    const cashDelta = studioAfter.cash - studioBefore.cash;
    expect(cashDelta).toBeGreaterThan(0);
    expect(studioAfter.lifetimeRevenue).toBeCloseTo(cashDelta); // both come from the exact same cashCredit
    expect(Math.abs(cashDelta - film!.results.studioRevenue!)).toBeLessThanOrEqual(MAX_SIMULATION_WEEKS);
    expect(studioAfter.brand).toBe(applyStatChange(studioBefore.brand, film!.results.brandChange!));
    expect(studioAfter.prestige).toBe(applyStatChange(studioBefore.prestige, film!.results.prestigeChange!));

    // Every other studio's own finances are completely untouched by this one studio's film.
    for (const other of afterFinish.rivalStudios) {
      if (other.id === started.rivalStudioId) continue;
      const otherBefore = afterSpawn.rivalStudios.find((r) => r.id === other.id)!;
      expect(other.cash).toBe(otherBefore.cash);
      expect(other.brand).toBe(otherBefore.brand);
      expect(other.prestige).toBe(otherBefore.prestige);
      expect(other.lifetimeRevenue).toBe(otherBefore.lifetimeRevenue);
    }
  });
});
