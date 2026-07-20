import type { BidNotification, Opportunity } from '../types';
import type { ResolvedBid } from './opportunities';
import { highestBid } from './opportunities';

/**
 * Bid-activity notifications (docs/DESIGN_REVIEW_bid_inbox.md). Turns the raw
 * before/after state of one weekly settlement pass into the "emails" the
 * player sees in their Inbox about their own bidding. Three events matter:
 *
 *  - 'won'   - a bid the player placed won its weekly auction and became an
 *              owned Asset. Previously silent - the script just appeared in
 *              the Asset Library with no word of it.
 *  - 'lost'  - a bid the player placed lost its weekly auction to a rival.
 *  - 'outbid'- a rival raised above the player's still-standing bid on an
 *              opportunity that is *still open*, so the player can still
 *              respond by raising before the next weekly tick. This is the
 *              actionable one that the auto-pause is really there to surface.
 *
 * All three are derived from data the reducer's settlement pass already has
 * (engine/opportunities.ts:settleOpportunities's resolvedBids, the
 * opportunity pool before and after, and which player wins actually turned
 * into Assets), so this module stays pure - it never reads or writes state.
 */

const PLAYER_ID = 'player';

/** Newest-first cap so the store can't grow without bound across a long game - the Inbox only ever shows a recent window anyway. */
const MAX_STORED_NOTIFICATIONS = 50;

function opportunitiesPlayerLeads(opportunities: Opportunity[]): Set<string> {
  const leading = new Set<string>();
  for (const o of opportunities) {
    if (highestBid(o)?.bidderId === PLAYER_ID) leading.add(o.id);
  }
  return leading;
}

function playerHasBid(opportunity: Opportunity): boolean {
  return opportunity.bids.some((b) => b.bidderId === PLAYER_ID);
}

export interface CollectBidNotificationsParams {
  /** The already-stored notifications this pass appends to. */
  existing: BidNotification[];
  /** The opportunity pool as it was before this settlement pass ran - used to spot the player losing their lead. */
  opportunitiesBefore: Opportunity[];
  /** The opportunity pool after the full pass (resolution + this week's new rival bids) - what's still live and bid-on-able. */
  opportunitiesAfter: Opportunity[];
  /** Every bid resolved at this weekly tick (engine/opportunities.ts). Empty on days that aren't a weekly tick. */
  resolvedBids: ResolvedBid[];
  /** Opportunity ids the player actually won AND could afford (so the Asset was created) - a forfeited unaffordable win isn't a 'won'. */
  wonOpportunityIds: Set<string>;
  /** GameState.totalDays this pass advanced to. */
  day: number;
}

/**
 * Returns the full, updated notification list (existing + any new ones this
 * pass, newest first, capped). Pure: same inputs, same output.
 */
export function collectBidNotifications(params: CollectBidNotificationsParams): BidNotification[] {
  const { existing, opportunitiesBefore, opportunitiesAfter, resolvedBids, wonOpportunityIds, day } = params;
  const fresh: BidNotification[] = [];

  // Resolved auctions the player had a stake in: won (became an Asset) or lost (a rival took it).
  for (const resolved of resolvedBids) {
    if (!playerHasBid(resolved.opportunity)) continue;
    const title = resolved.opportunity.script.title;
    if (wonOpportunityIds.has(resolved.opportunity.id)) {
      fresh.push({
        id: `bid-won-${resolved.opportunity.id}-${day}`,
        kind: 'won',
        opportunityId: resolved.opportunity.id,
        scriptTitle: title,
        amount: resolved.amount,
        day,
        read: false,
      });
    } else if (resolved.winnerId !== PLAYER_ID) {
      fresh.push({
        id: `bid-lost-${resolved.opportunity.id}-${day}`,
        kind: 'lost',
        opportunityId: resolved.opportunity.id,
        scriptTitle: title,
        amount: resolved.amount,
        rivalName: resolved.winnerName,
        day,
        read: false,
      });
    }
  }

  // Still-open opportunities where the player was the leader before this pass
  // and a rival has since overtaken them - they can still raise. Only fires on
  // the transition (led before, not leading now), so a player who stays outbid
  // isn't pinged again every day.
  const ledBefore = opportunitiesPlayerLeads(opportunitiesBefore);
  for (const o of opportunitiesAfter) {
    if (!ledBefore.has(o.id)) continue;
    const leader = highestBid(o);
    if (!leader || leader.bidderId === PLAYER_ID) continue;
    fresh.push({
      id: `bid-outbid-${o.id}-${day}`,
      kind: 'outbid',
      opportunityId: o.id,
      scriptTitle: o.script.title,
      amount: leader.amount,
      rivalName: leader.bidderName,
      day,
      read: false,
    });
  }

  if (fresh.length === 0) return existing;

  // Guard against re-adding an id that's somehow already present (idempotent
  // if the same settlement day were ever reprocessed), newest first, capped.
  const existingIds = new Set(existing.map((n) => n.id));
  const deduped = fresh.filter((n) => !existingIds.has(n.id));
  if (deduped.length === 0) return existing;
  return [...deduped, ...existing].slice(0, MAX_STORED_NOTIFICATIONS);
}

/** How many stored notifications are still unread - the header badge contribution and the auto-pause / resume-guard trigger (App.tsx). */
export function unreadBidCount(notifications: BidNotification[]): number {
  return notifications.reduce((n, m) => (m.read ? n : n + 1), 0);
}

/** Marks every stored notification read - dispatched when the player opens the Inbox. */
export function markAllBidNotificationsRead(notifications: BidNotification[]): BidNotification[] {
  if (notifications.every((n) => n.read)) return notifications;
  return notifications.map((n) => (n.read ? n : { ...n, read: true }));
}
