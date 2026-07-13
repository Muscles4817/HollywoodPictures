import { describe, it, expect } from 'vitest';
import { settleOpportunities } from './opportunities';
import { withRng } from './random';

describe('settleOpportunities - roadmap development-pipeline doc', () => {
  it('generates a fresh batch immediately when nextGenerationCheckDay is already due', () => {
    const { result } = withRng(1, (rng) => settleOpportunities([], 1, 1, rng));
    expect(result.opportunities.length).toBeGreaterThan(0);
    expect(result.nextGenerationCheckDay).toBeGreaterThan(1);
    for (const o of result.opportunities) {
      expect(o.acquisitionCost).toBeGreaterThan(0);
      expect(o.expiresOnDay).toBeGreaterThan(1);
      expect(o.script).toBeTruthy();
    }
  });

  it('generates nothing new while nextGenerationCheckDay is still in the future', () => {
    const { result } = withRng(2, (rng) => settleOpportunities([], 50, 10, rng));
    expect(result.opportunities).toEqual([]);
    expect(result.nextGenerationCheckDay).toBe(50);
  });

  it('expires anything past its own expiresOnDay, independent of the generation timer', () => {
    const stale = {
      id: 'stale-1',
      source: 'Spec Screenplay' as const,
      script: withRng(3, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities[0].script,
      acquisitionCost: 100,
      expiresOnDay: 10,
    };
    const { result } = withRng(4, (rng) => settleOpportunities([stale], 999, 20, rng));
    expect(result.opportunities.find((o) => o.id === 'stale-1')).toBeUndefined();
  });

  it('keeps an opportunity that has not expired yet, untouched, while waiting for the next generation batch', () => {
    const fresh = {
      id: 'fresh-1',
      source: 'Studio Original' as const,
      script: withRng(5, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities[0].script,
      acquisitionCost: 50,
      expiresOnDay: 100,
    };
    const { result } = withRng(6, (rng) => settleOpportunities([fresh], 999, 20, rng));
    expect(result.opportunities).toEqual([fresh]);
  });

  it('only ever generates one batch per settlement call, even when nextGenerationCheckDay is long overdue - same single-catch-up-per-call shape engine/rivalStudios.ts:settleRivalMarket already uses for spawn checks, not "replay every missed interval"', () => {
    const { result } = withRng(8, (rng) => settleOpportunities([], 1, 500, rng));
    // nextGenerationCheckDay lands soon after day 500, not accumulated from day 1.
    expect(result.nextGenerationCheckDay).toBeGreaterThan(500);
    expect(result.nextGenerationCheckDay).toBeLessThan(520);
  });
});
