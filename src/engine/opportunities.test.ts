import { describe, it, expect } from 'vitest';
import { settleOpportunities, placeBid, highestBid, reopenForfeitedOpportunity, WEEK_LENGTH_DAYS } from './opportunities';
import { withRng } from './random';
import type { Opportunity } from '../types';

describe('settleOpportunities - roadmap development-pipeline doc', () => {
  it('generates a fresh batch immediately when nextGenerationCheckDay is already due', () => {
    const { result } = withRng(1, (rng) => settleOpportunities([], 1, 1, rng));
    expect(result.opportunities.length).toBeGreaterThan(0);
    expect(result.nextGenerationCheckDay).toBeGreaterThan(1);
    for (const o of result.opportunities) {
      expect(o.acquisitionCost).toBeGreaterThan(0);
      expect(o.expiresOnDay).toBeGreaterThan(1);
      expect(o.script).toBeTruthy();
      expect(o.postedOnDay).toBe(1);
      expect(o.bids).toEqual([]);
    }
  });

  it('generates nothing new while nextGenerationCheckDay is still in the future', () => {
    const { result } = withRng(2, (rng) => settleOpportunities([], 50, 10, rng));
    expect(result.opportunities).toEqual([]);
    expect(result.nextGenerationCheckDay).toBe(50);
    expect(result.resolvedBids).toEqual([]);
  });

  it('expires anything past its own expiresOnDay, independent of the generation timer', () => {
    const stale: Opportunity = {
      id: 'stale-1',
      source: 'Spec Screenplay',
      script: withRng(3, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities[0].script,
      acquisitionCost: 100,
      expiresOnDay: 10,
      postedOnDay: 1,
      bids: [],
    };
    const { result } = withRng(4, (rng) => settleOpportunities([stale], 999, 20, rng));
    expect(result.opportunities.find((o) => o.id === 'stale-1')).toBeUndefined();
  });

  it('keeps an opportunity that has not expired yet, untouched, while waiting for the next generation batch', () => {
    const fresh: Opportunity = {
      id: 'fresh-1',
      source: 'Studio Original',
      script: withRng(5, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities[0].script,
      acquisitionCost: 50,
      expiresOnDay: 100,
      postedOnDay: 1,
      bids: [],
    };
    const { result } = withRng(6, (rng) => settleOpportunities([fresh], 999, 20, rng));
    expect(result.opportunities).toEqual([fresh]);
  });

  it('the weekly tick is now a fixed 7-day cadence, not the old randomized [8, 16]-day one', () => {
    const { result } = withRng(8, (rng) => settleOpportunities([], 1, 500, rng));
    expect(result.nextGenerationCheckDay).toBe(500 + WEEK_LENGTH_DAYS);
  });

  it('an uncontested (zero-bid) opportunity is completely untouched by weekly resolution - it just keeps sitting there, instant-buy-available', () => {
    const fresh: Opportunity = {
      id: 'uncontested-1',
      source: 'Studio Original',
      script: withRng(9, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities[0].script,
      acquisitionCost: 50,
      expiresOnDay: 100,
      postedOnDay: 1,
      bids: [],
    };
    const { result } = withRng(10, (rng) => settleOpportunities([fresh], 8, 8, rng)); // nextGenerationCheckDay due
    expect(result.opportunities.find((o) => o.id === 'uncontested-1')).toEqual(fresh);
    expect(result.resolvedBids).toEqual([]);
  });

  it('weekly resolution picks the highest bid on a contested opportunity, removes it from the pool, and reports it as resolved', () => {
    const script = withRng(11, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities[0].script;
    const contested: Opportunity = {
      id: 'contested-1',
      source: 'Studio Original',
      script,
      acquisitionCost: 50_000,
      expiresOnDay: 100,
      postedOnDay: 1,
      bids: [
        { bidderId: 'rival-studio-0', bidderName: 'Northbridge Pictures', amount: 60_000 },
        { bidderId: 'player', bidderName: 'Silver Reel Pictures', amount: 75_000 },
      ],
    };
    const { result } = withRng(12, (rng) => settleOpportunities([contested], 8, 8, rng));
    expect(result.opportunities.find((o) => o.id === 'contested-1')).toBeUndefined();
    expect(result.resolvedBids).toHaveLength(1);
    expect(result.resolvedBids[0]).toMatchObject({ winnerId: 'player', winnerName: 'Silver Reel Pictures', amount: 75_000 });
  });

  it('a tie goes to whichever bid was placed first (array order)', () => {
    const script = withRng(13, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities[0].script;
    const contested: Opportunity = {
      id: 'tied-1',
      source: 'Studio Original',
      script,
      acquisitionCost: 50_000,
      expiresOnDay: 100,
      postedOnDay: 1,
      bids: [
        { bidderId: 'rival-studio-0', bidderName: 'First Bidder', amount: 60_000 },
        { bidderId: 'rival-studio-1', bidderName: 'Second Bidder', amount: 60_000 },
      ],
    };
    const { result } = withRng(14, (rng) => settleOpportunities([contested], 8, 8, rng));
    expect(result.resolvedBids[0].winnerId).toBe('rival-studio-0');
  });
});

describe('placeBid', () => {
  const baseOpportunity: Opportunity = {
    id: 'opp-1',
    source: 'Studio Original',
    script: withRng(20, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities[0].script,
    acquisitionCost: 50_000,
    expiresOnDay: 100,
    postedOnDay: 1,
    bids: [],
  };

  it('appends a new bidder', () => {
    const updated = placeBid([baseOpportunity], 'opp-1', { bidderId: 'player', bidderName: 'Silver Reel Pictures', amount: 60_000 });
    expect(updated[0].bids).toEqual([{ bidderId: 'player', bidderName: 'Silver Reel Pictures', amount: 60_000 }]);
  });

  it('upserts by bidderId - a second bid from the same bidder replaces their own, rather than stacking', () => {
    const once = placeBid([baseOpportunity], 'opp-1', { bidderId: 'player', bidderName: 'Silver Reel Pictures', amount: 60_000 });
    const twice = placeBid(once, 'opp-1', { bidderId: 'player', bidderName: 'Silver Reel Pictures', amount: 80_000 });
    expect(twice[0].bids).toHaveLength(1);
    expect(twice[0].bids[0].amount).toBe(80_000);
  });

  it('leaves every other opportunity untouched', () => {
    const other: Opportunity = { ...baseOpportunity, id: 'opp-2' };
    const updated = placeBid([baseOpportunity, other], 'opp-1', { bidderId: 'player', bidderName: 'Silver Reel Pictures', amount: 60_000 });
    expect(updated[1]).toBe(other);
  });
});

describe('highestBid', () => {
  it('returns null for an uncontested opportunity', () => {
    const opp: Opportunity = {
      id: 'opp-1', source: 'Studio Original',
      script: withRng(21, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities[0].script,
      acquisitionCost: 50_000, expiresOnDay: 100, postedOnDay: 1, bids: [],
    };
    expect(highestBid(opp)).toBeNull();
  });

  it('returns the highest amount, ties going to whichever was placed first', () => {
    const opp: Opportunity = {
      id: 'opp-1', source: 'Studio Original',
      script: withRng(22, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities[0].script,
      acquisitionCost: 50_000, expiresOnDay: 100, postedOnDay: 1,
      bids: [
        { bidderId: 'a', bidderName: 'A', amount: 60_000 },
        { bidderId: 'b', bidderName: 'B', amount: 90_000 },
        { bidderId: 'c', bidderName: 'C', amount: 90_000 },
      ],
    };
    expect(highestBid(opp)?.bidderId).toBe('b');
  });
});

describe('reopenForfeitedOpportunity', () => {
  it('re-adds the original opportunity with bids cleared', () => {
    const won: Opportunity = {
      id: 'opp-1', source: 'Studio Original',
      script: withRng(23, (rng) => settleOpportunities([], 1, 1, rng)).result.opportunities[0].script,
      acquisitionCost: 50_000, expiresOnDay: 100, postedOnDay: 1,
      bids: [{ bidderId: 'rival-studio-0', bidderName: 'Northbridge Pictures', amount: 60_000 }],
    };
    const reopened = reopenForfeitedOpportunity([], won);
    expect(reopened).toHaveLength(1);
    expect(reopened[0].id).toBe('opp-1');
    expect(reopened[0].bids).toEqual([]);
  });
});
