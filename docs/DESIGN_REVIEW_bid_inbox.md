# Design Review: Bid Inbox — Notifications, Auto-Pause, and Resume-Guard

Status: **Built.** Closes an engagement gap in the Opportunity Market: bidding
happened silently in the background, so the player never learned they'd won,
lost, or been outbid until they happened to look.

---

## Problem

The Opportunity Market lets the player place bids (`PLACE_BID`) that resolve at
a weekly tick (`engine/opportunities.ts:settleOpportunities`). Before this
change, every outcome was **silent**:

- A **win** charged cash and dropped an Asset in the library with no word of it.
- A **loss** to a rival was invisible.
- Being **outbid mid-week** — the one moment the player could still respond by
  raising — passed with no signal at all.

And because the real-time clock (`App.tsx`) keeps advancing days on its own, a
contested auction could resolve while the player was looking elsewhere, with no
chance to react.

## Design

Three pieces, one per layer:

### 1. A persistent notification store (`GameState.bidNotifications`)

The existing Inbox (`engine/project.ts:deriveInboxItems`) is *derived* from
project state. Bid outcomes can't be derived — the moment a bid resolves, the
opportunity leaves the pool — so they must be **recorded when they happen**.
`BidNotification` (`types/index.ts`) is a small stored "email":
`{ kind: 'won' | 'lost' | 'outbid', opportunityId, scriptTitle, amount, rivalName?, day, read }`.
Optional on `GameState`, defaulted to `[]` (no migration, same as `awards`/
`producerPool`).

### 2. Event detection (`engine/bidNotifications.ts`)

`collectBidNotifications` is pure — it turns one settlement pass's before/after
state into new notifications:

- **won** — a resolved player bid whose opportunity actually became an owned
  Asset (a forfeited unaffordable win is *not* reported as won — detected via
  which new Asset ids appeared).
- **lost** — a resolved player bid a rival took.
- **outbid** — a rival overtook the player's still-standing bid on an
  opportunity that is *still open*. Fires only on the transition (led before,
  not leading after), so a player who stays outbid isn't pinged every day.

Wired into the reducer's one shared settlement path
(`studioReducer.ts:runCalendarSettlement`), so it covers every calendar-
advancing action, not just the real-time tick.

### 3. Surfacing + clock control (`App.tsx`, `Inbox.tsx`, `Header.tsx`)

- **Inbox** grows a "Bid updates" section; an actionable `outbid` (opportunity
  still live, player still behind) offers **"Raise your bid"** → the
  Opportunity Market.
- **Header badge** adds unread bid count to the existing project-item count.
- **Auto-pause**: a *new* unread bid update pauses the real-time clock
  (`setPaused(true)` on an increase in unread count) so it can't tick past the
  moment to respond. Reading the Inbox drops the count to 0, so it never
  re-pauses for mail already seen.
- **Resume-guard**: trying to un-pause while bid mail is unread
  (`shouldConfirmResume`, pure/tested) opens a confirm dialog — "Open Inbox" or
  "Resume anyway" — instead of silently resuming.
- Opening the Inbox dispatches `MARK_BID_NOTIFICATIONS_READ`, clearing the
  badge and the resume-guard together.

This is the "auto-pause + resume-guard" strength: engaging without being fully
modal. The clock stops on a new event and warns on resume, but the player is
never *forced* to open the Inbox to proceed.

## Testing

- `engine/bidNotifications.test.ts` — the pure detector (won/lost/outbid,
  forfeit-isn't-won, still-leading, resolved-away, dedup, unread count,
  mark-read).
- `state/developmentPipeline.test.ts` — reducer wiring: a real win records an
  unread `won` email that `MARK_BID_NOTIFICATIONS_READ` clears; a quiet week
  records nothing.
- `App.test.ts` — `shouldConfirmResume` truth table.
- Runtime smoke (browser): badge count, resume-confirm dialog, the Inbox "Bid
  updates" section + "Raise your bid", and badge-clears-on-read, all verified
  with no console errors.
