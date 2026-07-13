import { describe, it, expect } from 'vitest';
import { generateRivalStudios, settleRivalMarket, type RivalMarketUpdate } from './rivalStudios';
import { generateTalentPool } from './talentGenerator';
import { withRng } from './random';

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
