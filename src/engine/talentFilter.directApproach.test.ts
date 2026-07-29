// Casting redesign follow-up - the Direct Approach fame gate.
import { describe, it, expect } from 'vitest';
import {
  directApproachFameFloor,
  scoutableByDirectApproach,
  DIRECT_APPROACH_FAMOUS_FLOOR,
  DIRECT_APPROACH_HARD_FLOOR,
} from './talentFilter';
import { DISCOVERY_FAME_CEILING } from './castingCalls';

function actorWithFame(fame: number) {
  return { reputation: { fame } } as unknown as Parameters<typeof scoutableByDirectApproach>[0];
}

describe('directApproachFameFloor', () => {
  it('sits at the famous floor with no casting director', () => {
    expect(directApproachFameFloor(null)).toBe(DIRECT_APPROACH_FAMOUS_FLOOR);
    expect(directApproachFameFloor(0)).toBe(DIRECT_APPROACH_FAMOUS_FLOOR);
    expect(directApproachFameFloor(undefined)).toBe(DIRECT_APPROACH_FAMOUS_FLOOR);
  });

  it('drops to the hard floor with a top casting director, and monotonically in between', () => {
    expect(directApproachFameFloor(100)).toBe(DIRECT_APPROACH_HARD_FLOOR);
    const mid = directApproachFameFloor(50);
    expect(mid).toBeLessThan(DIRECT_APPROACH_FAMOUS_FLOOR);
    expect(mid).toBeGreaterThan(DIRECT_APPROACH_HARD_FLOOR);
    // Higher skill never raises the floor.
    expect(directApproachFameFloor(80)).toBeLessThanOrEqual(directApproachFameFloor(40));
  });

  it('clamps skill outside 0-100', () => {
    expect(directApproachFameFloor(-20)).toBe(DIRECT_APPROACH_FAMOUS_FLOOR);
    expect(directApproachFameFloor(999)).toBe(DIRECT_APPROACH_HARD_FLOOR);
  });

  it('partitions the pool with the casting-call discovery ceiling - no gap, no overlap', () => {
    // The lowest fame a top CD can scout is exactly one above the discovery ceiling,
    // so every actor is reachable by exactly one channel.
    expect(DIRECT_APPROACH_HARD_FLOOR).toBe(DISCOVERY_FAME_CEILING + 1);
    // A hidden gem (at the ceiling) is never scoutable, even with a perfect CD.
    expect(scoutableByDirectApproach(actorWithFame(DISCOVERY_FAME_CEILING), 100)).toBe(false);
    // One fame point above it is scoutable with a top CD.
    expect(scoutableByDirectApproach(actorWithFame(DISCOVERY_FAME_CEILING + 1), 100)).toBe(true);
  });
});

describe('scoutableByDirectApproach', () => {
  it('shows famous actors without a casting director but hides obscure ones', () => {
    expect(scoutableByDirectApproach(actorWithFame(70), null)).toBe(true); // a star
    expect(scoutableByDirectApproach(actorWithFame(50), null)).toBe(true); // established
    expect(scoutableByDirectApproach(actorWithFame(35), null)).toBe(false); // rising - needs a CD
  });

  it('surfaces a rising actor once a skilled casting director is hired', () => {
    expect(scoutableByDirectApproach(actorWithFame(35), null)).toBe(false);
    expect(scoutableByDirectApproach(actorWithFame(35), 90)).toBe(true);
  });
});
