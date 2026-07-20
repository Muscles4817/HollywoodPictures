import { describe, it, expect } from 'vitest';
import { collectBidNotifications, unreadBidCount, markAllBidNotificationsRead } from './bidNotifications';
import type { ResolvedBid } from './opportunities';
import type { BidNotification, Opportunity, OpportunityBid } from '../types';

/** Minimal Opportunity - the detector only ever reads id, script.title and bids. */
function opp(id: string, title: string, bids: Array<[string, string, number]>): Opportunity {
  return {
    id,
    source: 'Spec Screenplay',
    script: { title } as Opportunity['script'],
    acquisitionCost: 1000,
    expiresOnDay: 100,
    postedOnDay: 1,
    bids: bids.map(([bidderId, bidderName, amount]): OpportunityBid => ({ bidderId, bidderName, amount })),
  };
}

function resolved(opportunity: Opportunity, winnerId: string, winnerName: string, amount: number): ResolvedBid {
  return { opportunity, winnerId, winnerName, amount };
}

const NONE = { existing: [] as BidNotification[], opportunitiesBefore: [] as Opportunity[], opportunitiesAfter: [] as Opportunity[], resolvedBids: [] as ResolvedBid[], wonOpportunityIds: new Set<string>(), day: 10 };

describe('collectBidNotifications', () => {
  it('emits a won notification when a player bid resolved AND became an owned Asset', () => {
    const o = opp('o1', 'The Deep', [['player', 'Silver Reel', 5000]]);
    const out = collectBidNotifications({
      ...NONE,
      resolvedBids: [resolved(o, 'player', 'Silver Reel', 5000)],
      wonOpportunityIds: new Set(['o1']),
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'won', opportunityId: 'o1', scriptTitle: 'The Deep', amount: 5000, read: false });
    expect(out[0].rivalName).toBeUndefined();
  });

  it('does NOT emit a won notification for a player win that was forfeited (never became an Asset)', () => {
    const o = opp('o1', 'The Deep', [['player', 'Silver Reel', 5000]]);
    const out = collectBidNotifications({
      ...NONE,
      resolvedBids: [resolved(o, 'player', 'Silver Reel', 5000)],
      wonOpportunityIds: new Set(), // affordability failed - no Asset created
    });
    expect(out).toEqual([]);
  });

  it('emits a lost notification when a player bid resolved to a rival winner', () => {
    const o = opp('o2', 'Nightfall', [['player', 'Silver Reel', 4000], ['rival-studio-1', 'Neon', 6000]]);
    const out = collectBidNotifications({
      ...NONE,
      resolvedBids: [resolved(o, 'rival-studio-1', 'Neon', 6000)],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'lost', opportunityId: 'o2', rivalName: 'Neon', amount: 6000 });
  });

  it('ignores a resolved auction the player never bid on', () => {
    const o = opp('o3', 'Other', [['rival-studio-1', 'Neon', 6000]]);
    const out = collectBidNotifications({ ...NONE, resolvedBids: [resolved(o, 'rival-studio-1', 'Neon', 6000)] });
    expect(out).toEqual([]);
  });

  it('emits an outbid notification when a rival overtakes the player on a still-open opportunity', () => {
    const before = opp('o4', 'Signal', [['player', 'Silver Reel', 5000]]);
    const after = opp('o4', 'Signal', [['player', 'Silver Reel', 5000], ['rival-studio-2', 'A24', 7000]]);
    const out = collectBidNotifications({ ...NONE, opportunitiesBefore: [before], opportunitiesAfter: [after] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'outbid', opportunityId: 'o4', rivalName: 'A24', amount: 7000 });
  });

  it('does not emit outbid when the player is still leading after the pass', () => {
    const before = opp('o4', 'Signal', [['player', 'Silver Reel', 5000]]);
    const after = opp('o4', 'Signal', [['player', 'Silver Reel', 8000], ['rival-studio-2', 'A24', 7000]]);
    const out = collectBidNotifications({ ...NONE, opportunitiesBefore: [before], opportunitiesAfter: [after] });
    expect(out).toEqual([]);
  });

  it('does not emit outbid for an opportunity that resolved away this pass (no longer in the after pool)', () => {
    const before = opp('o4', 'Signal', [['player', 'Silver Reel', 5000]]);
    // after pool no longer contains o4 (it resolved) - the resolved path handles win/loss instead.
    const out = collectBidNotifications({ ...NONE, opportunitiesBefore: [before], opportunitiesAfter: [] });
    expect(out).toEqual([]);
  });

  it('is idempotent - a notification id already present is not added twice', () => {
    const o = opp('o1', 'The Deep', [['player', 'Silver Reel', 5000]]);
    const first = collectBidNotifications({ ...NONE, resolvedBids: [resolved(o, 'player', 'Silver Reel', 5000)], wonOpportunityIds: new Set(['o1']) });
    const second = collectBidNotifications({ ...NONE, existing: first, resolvedBids: [resolved(o, 'player', 'Silver Reel', 5000)], wonOpportunityIds: new Set(['o1']) });
    expect(second).toBe(first); // unchanged reference when nothing new
  });

  it('prepends new notifications newest-first ahead of existing ones', () => {
    const older: BidNotification = { id: 'old', kind: 'won', opportunityId: 'x', scriptTitle: 'X', amount: 1, day: 1, read: true };
    const o = opp('o2', 'Nightfall', [['player', 'Silver Reel', 4000]]);
    const out = collectBidNotifications({ ...NONE, existing: [older], resolvedBids: [resolved(o, 'rival-studio-1', 'Neon', 6000)] });
    expect(out[0].opportunityId).toBe('o2'); // newest first
    expect(out[out.length - 1].id).toBe('old');
  });
});

describe('unreadBidCount / markAllBidNotificationsRead', () => {
  const notes: BidNotification[] = [
    { id: 'a', kind: 'won', opportunityId: 'x', scriptTitle: 'X', amount: 1, day: 1, read: false },
    { id: 'b', kind: 'lost', opportunityId: 'y', scriptTitle: 'Y', amount: 2, day: 2, read: true },
    { id: 'c', kind: 'outbid', opportunityId: 'z', scriptTitle: 'Z', amount: 3, day: 3, read: false },
  ];

  it('counts only unread', () => {
    expect(unreadBidCount(notes)).toBe(2);
  });

  it('marks all read and returns the same reference when already all-read', () => {
    const marked = markAllBidNotificationsRead(notes);
    expect(unreadBidCount(marked)).toBe(0);
    expect(markAllBidNotificationsRead(marked)).toBe(marked);
  });
});
