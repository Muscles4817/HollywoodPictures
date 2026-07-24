# Design Review: Unified Studio Inbox

Status: **Proposed (review-only).** This document is a design and architecture
review of the current Inbox, an assessment of whether it should evolve into a
studio-wide "catch-up" surface, and a phased implementation plan. **No code is
proposed for merge here** — this is the artifact to critique before any work
starts.

Guiding question throughout: *"I have been away for six in-game weeks. Help me
understand what changed"* — not *"Tell me which productions are blocked."*

---

## 0. TL;DR

- The Inbox today is a **modal overlay with bespoke, per-category JSX** over two
  very different data sources bolted into one list: **derived** project items
  (`deriveInboxItems`) and one **stored** event type (`bidNotifications`).
- **The abstraction the task imagines as `StudioNotification` already exists** —
  it is the Dashboard's `ActivityItem` feed (`Dashboard.tsx:27`), a clean,
  tone-coded, action-carrying, derived notification model. It already covers
  wrapped films, awards nights, in-theatres films, next release, and deliveries.
  **The Inbox and the Dashboard activity feed are two parallel answers to "what
  needs attention," built from the same state with different code.** This
  duplication — not a missing abstraction — is the central architectural issue.
- The right data split is **not** actionable-vs-informational. It is
  **derivable-from-current-state vs. non-derivable point-in-time event.** Almost
  every candidate (box office, awards, milestones) is *derivable* — the state
  that proves the event still exists. Only bid outcomes are genuinely
  non-derivable (the opportunity leaves the pool). So the stored log should stay
  **small**; most of the "unified inbox" is re-surfacing derived state, not
  recording new events.
- The two confirmed gaps are cheap: box-office completion is **already derived**
  (`status === 'finished' && !acknowledged`) and already has an extracted detail
  view (`FilmDetailModal`); awards are **already derived** (`awards.history` +
  a 14-day window) and already have an archive (`AwardsPage`). Both need
  re-routing into the Inbox, not new storage.
- Recommendation: **one Inbox UI, fed by one shared derived-activity selector
  plus the existing small stored log**, grouped by urgency, routing to existing
  systems-of-record rather than duplicating them. Pause should be tied to a
  per-item *time-critical* flag, not to "any unread notification."

---

## 1. Current architecture

### 1.1 The Inbox surface

`components/common/Inbox.tsx` is a **globally-mounted modal overlay**
(`App.tsx:359`), controlled by App-level `inboxOpen` state and toggled from the
persistent Header. It sits outside the `renderScreen()` switch, so it overlays
whatever screen is active; it is not a `Screen` value. The container is the
shared `.modal-overlay` / `.modal-content` pattern (`index.css:529`): a single
560px-wide, `max-height: 85vh`, vertically-scrolling column.

Rendering is **entirely hand-written per category** — there is no notification
item component. Each of the seven sections (bid updates, now-playing, press-tour
incidents, awaiting-choice, wrapped, parked, casting) has its own bespoke JSX,
its own copy, and its own action button.

### 1.2 Two data-source paradigms in one list

**(a) Derived project items** — `engine/project.ts:deriveInboxItems` (line 143)
recomputes six categories from `state.projects` on every render:

| Category | Meaning | Actionable? |
|---|---|---|
| `awaitingChoice` | on-set / test-screening decision paused a shoot | yes |
| `wrapped` | photography done, post-production not started | yes |
| `parked` | post choices locked, needs a release day | sometimes* |
| `casting` | new applicants waiting on an uncast role | yes |
| `pressTourIncident` | scheduled film's press incident needs a response | yes |
| `nowPlaying` | opened film whose premiere hasn't been watched | informational-ish |

\*`isParkedActionable` (`project.ts:139`) — a parked film still waiting on its
test screening renders a card but must **not** light the badge.

These items have **no read state and no dismissal.** They *self-clean*: when the
underlying condition resolves, the derivation stops returning them. This is a
strength — nothing to archive, nothing to leak.

**(b) One stored event type** — `state.bidNotifications: BidNotification[]`
(`engine/bidNotifications.ts`). Bid outcomes **cannot** be derived: the moment a
bid resolves, the opportunity leaves the pool, so the outcome must be *recorded
when it happens*. This store is:

- a discriminated shape `{ id, kind: 'won'|'lost'|'outbid', opportunityId,
  scriptTitle, amount, rivalName?, day, read }`,
- **newest-first, capped at 50** (`MAX_STORED_NOTIFICATIONS`),
- carrying **read/unread** state,
- collected in the reducer's single shared settlement path
  (`studioReducer.ts:runCalendarSettlement`, line 386) so it covers *every*
  calendar-advancing action, not just the real-time tick.

### 1.3 Badge, read state, pause

- **Badge** (`Header.tsx:51`) = `inboxBadgeCount(projects, focusedProjectId)`
  (derived actionable items) **+** `unreadBidCount(bidNotifications)` (stored
  unread). One number over two paradigms.
- **Read state** exists **only** for bid notifications. Opening the Inbox
  dispatches `MARK_BID_NOTIFICATIONS_READ`. Derived items have no read concept.
- **Pause** has three interacting mechanisms (`App.tsx`):
  1. Opening the Inbox pauses the background tick (`inboxOpen` in
     `computeTicking`, line 79) — so a slow decision costs no game time.
  2. A **new** unread bid update **auto-pauses** the clock (`setPaused(true)` on
     any increase in unread count, line 183).
  3. A **resume-guard** (`shouldConfirmResume`, line 90) opens a confirm dialog
     before un-pausing while any bid mail is unread.

### 1.4 The parallel surface: the Dashboard activity feed

`Dashboard.tsx:163` builds `activityItems: ActivityItem[]` where:

```ts
type ActivityItem = {
  id: string;
  tone: 'urgent' | 'warning' | 'positive' | 'neutral';
  eyebrow: string;      // "Decision required", "Awards night", "In theatres"
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void; // dispatches a VIEW_* action or opens a modal
};
```

This feed **already** surfaces: awaiting-choice (urgent), test screening
(urgent), wrapped / post-production-ready (warning), **awards night** (positive,
14-day window via `deriveRecentAwardHighlights`), **in-theatres running films**
(positive), next release (neutral), screenplay delivered (positive), and pending
commissions. It is derived, tone-coded, routes via reducer actions, and is
recomputed each render.

**This is the notification abstraction the task hypothesizes as
`StudioNotification`.** It exists, it is clean, and it is *Dashboard-local and
un-persisted*. Wrapped films and awaiting-choice decisions appear in **both** the
Dashboard feed and the Inbox, via two independent code paths. The Inbox/Header
badge has already drifted from the derivation once (the casting undercount noted
in `project.ts:106-116`); a second parallel surface is a standing drift risk.

### 1.5 What generalises well / is tightly coupled / should stay separate

**Generalises well**
- The **stored-log pattern** (`bidNotifications`): id, kind, read, day, cap,
  newest-first, pure collector in the shared settlement path. This is a clean,
  reusable seam for *any* non-derivable event.
- The **`ActivityItem` shape**: tone + eyebrow + title + detail + optional
  action. This is exactly the right notification primitive — it just lives in
  the wrong place (Dashboard-local) and is used by only one surface.
- **`runCalendarSettlement`** as the one settlement chokepoint: any new stored
  event has exactly one place to be generated.
- **Deep-link actions** (`VIEW_PREMIERE {filmId}`, `VIEW_RIVAL_STUDIO
  {studioName}`, `VIEW_PRODUCTION {productionId}`): the "route to the specific
  entity" pattern already exists.

**Tightly coupled / showing strain**
- `Inbox.tsx` **hard-codes every category's JSX**. Adding a type means editing
  the component. There is no item renderer to reuse.
- `InboxItems` (`project.ts:117`) is **heterogeneous** — `FilmDraft[]`,
  `Film[]`, and `{production, calls}` tuples in one interface. `pressTourIncident`
  and `nowPlaying` were clearly bolted on; the shape is under tension.
- The **badge sums two paradigms** by hand; every new type must remember to add
  itself to `inboxBadgeCount`.
- **Auto-pause is wired to raw unread count**, not to whether the event is
  time-critical. Today even `won`/`lost` bids (nothing to act on) pause the
  clock.
- **No shared `Modal` component** — ~10 components hand-roll the identical
  overlay-click-to-close + stopPropagation structure, including the Inbox and
  the blocking box-office popup.

**Should stay separate**
- **Systems-of-record** must stay separate from the Inbox: `FilmDetailModal`
  (released-film dossier), `AwardsPage` (ceremony archive), `StatsPage` (all
  released films), `ReleaseCalendar`. The Inbox should *link* to these, never
  duplicate them.
- **The `bidNotifications` non-derivable log** should stay a stored log — but be
  generalised, not multiplied.

---

## 2. Behavioural classification

The task proposes an `InboxAction` vs `StudioNotification` split along
**actionable vs informational**. That axis is real for *presentation* but is the
**wrong axis for the data model.** The load-bearing distinction is:

> **Can this item be recomputed from current state, or is it a point-in-time
> event whose source data disappears?**

| Item | Actionable? | Derivable from state? | Today |
|---|---|---|---|
| on-set / test-screening decision | ✅ | ✅ (`photography.status`) | derived |
| wrapped / parked / casting | ✅ | ✅ (project fields) | derived |
| press-tour incident | ✅ | ✅ (`pressTourIncident`) | derived |
| now-playing (watch premiere) | ~ | ✅ (`premiereSeen`) | derived |
| **box office finished** | ❌ | ✅ (`status==='finished' && !acknowledged`) | blocking popup |
| **awards resolved** | ❌ | ✅ (`awards.history` + window) | Dashboard card only |
| milestone unlock | ~ | ✅ (unlock predicate) | card only |
| **bid won/lost/outbid** | outbid only | ❌ (opportunity gone) | stored log |

The important observation: **almost everything is derivable.** The two confirmed
gaps (box office, awards) are *already derived* elsewhere in the codebase — the
work is re-surfacing, not recording. Only **bid outcomes** genuinely require a
stored log.

**Recommendation:** keep **one data model with two feeds**, not two parallel
models:

1. **Derived activity** — promote the Dashboard `ActivityItem` derivation into a
   single shared selector (e.g. `state/selectors.ts:deriveStudioActivity`) that
   both the Dashboard *and* the Inbox consume. Box office and awards join here as
   derived items reusing their existing "seen" flags. This **eliminates the
   duplication** and the drift risk.
2. **Stored event log** — generalise `BidNotification` into a small
   `StudioNotification` discriminated union for the *non-derivable* tail only.
   Same stored/read/capped pattern; today only bid kinds live in it.

Both feeds render through **one** notification-item component (tone + eyebrow +
title + detail + optional action + optional deep-link). So "actionable vs
informational" survives as a **rendering/grouping** concern (tone + which group
it sorts into), while the *storage* decision is driven by derivability. This is
strictly more conservative than a fresh `StudioNotification` model: it reuses two
systems that already exist rather than building a third.

---

## 3. Inbox layout

The flat, single-column list does not scale to the six-weeks-away case. After a
long absence the player faces an undifferentiated stack where a blocking on-set
decision sits below "you were outbid three weeks ago." Order today is essentially
insertion order per category, with informational bid mail *above* actionable
decisions.

**Recommendation: group by urgency tier, newest-first within tier, collapse the
long tail.**

```
┌──────────────────────────────────────────────── Inbox ──── [Close] ┐
│                                                                     │
│  ▸ NEEDS YOU  (3)                                    always expanded │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ ● Decision required · "Neon Harbor"                            │ │
│  │   On-set event paused the shoot.            [ Resolve → ]      │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │ ● Outbid · "The Quiet Coast"                                   │ │
│  │   A rival raised to £2.1m. Auction still open. [ Raise bid → ]│ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │ ○ Ready to schedule · "Midnight Down"      [ Continue → ]      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ▾ WHILE YOU WERE AWAY  (5 new)                 expanded if unread  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🏆 Awards night · BAFTA · Year 3                              │ │
│  │   2 wins from 4 nominations. £1.2m in prizes.  [ View → ]      │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │ 🎬 Box office closed · "Skyline Fever"                         │ │
│  │   Finished its run at £48m — a hit.            [ Details → ]   │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │ 🔓 Distribution Arm available                  [ Open → ]      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ▸ EARLIER  (12)                                collapsed by default │
│                                                                     │
│  2 productions running in the background.                           │
└─────────────────────────────────────────────────────────────────────┘
```

Principles:
- **Two urgency groups + a collapsed tail.** "Needs you" (actionable, blocks a
  production) is always expanded and sorts first. "While you were away"
  (informational events since last visit) is expanded when it has unread items.
  "Earlier" collapses the read tail.
- **Tone drives the leading glyph/colour**, reusing `ActivityItem.tone`
  (`urgent`/`warning`/`positive`/`neutral`).
- **Per-group counts** in the header answer "how much happened" at a glance.
- **Every informational card ends in a deep-link** to its system-of-record, not
  an inline reproduction (§7).
- The overlay's single scroll region stays, but grouping + collapse means the
  player scans headers, not a 20-item wall.

This is deliberately not an aesthetic redesign — the only new structure is
*grouping by urgency* and *collapsing the read tail*, both directly serving the
"what changed while I was away" goal.

---

## 4. Notification lifecycle

**Action items** (blocks a production): **remain visible until resolved, then
disappear.** They already behave this way because they are derived — do **not**
add archive/read state to them. The project itself is their record. Keep as-is.

**Informational items:** **read/unread, reviewable for a bounded window, then
age out — and they link to the true system-of-record rather than being it.**

The key lifecycle recommendation: **the Inbox is a transient catch-up log, not
an archive.** Box-office history already lives in `FilmDetailModal` /
`StatsPage`; awards history already lives in `AwardsPage`. The Inbox should hold
only *headline + deep-link + read state*, and let those pages remain the
permanent record. This matches the task's own steer ("The Inbox does not
necessarily need to become the permanent archive").

Concretely:
- **Derived informational items** (box office, awards, milestones) need a notion
  of "new since I last looked" without per-item storage. Two clean options,
  cheapest first:
  - **A single `lastInboxSeenDay` marker** on `GameState`: any derived event with
    `day > lastInboxSeenDay` renders as unread; opening the Inbox advances the
    marker. One field gives *every* derived event an unread state for free, and
    naturally ages the window (the derivations already bound themselves — awards
    to 14 days, box office to `!acknowledged`).
  - Reuse **existing per-item flags** where they exist (`acknowledged`,
    `premiereSeen`) as the read signal.
- **Stored non-derivable items** (bids) keep their existing `read` flag and the
  50-item cap. That cap *is* the "age out" — no separate expiry needed.

Net lifecycle: action items self-resolve; informational items are unread → read
→ aged-out-of-window/cap, and always defer to the system-of-record for detail.

---

## 5. Pause behaviour

Today **any** increase in unread bid count auto-pauses, and **any** unread bid
blocks resume. That was designed for the one genuinely time-critical case:
`outbid` on a *still-open* auction, where the player can still act before the
next weekly tick. It is already slightly too broad — `won`/`lost` bids pause the
clock even though nothing can be done about them.

Once informational notifications expand, "every unread notification pauses" is
clearly wrong: box office closing or an awards result must **not** stop the clock
— nothing is blocked, and pausing on passive events would make time feel
hostage to the Inbox.

**Recommendation: tie pause to a per-notification `timeCritical` flag, not to
unread count.**

- **Actionable, still-actionable-only-briefly** → pause + resume-guard. Today
  this is exactly `outbid` (auction still open). Keep the existing auto-pause and
  resume-guard, but gate them on `timeCritical`, not raw unread count.
- **Actionable but self-pausing** (on-set decisions, test screenings) already
  pause their *own* production; they don't need the global clock stopped, and
  opening the Inbox pauses the tick anyway. No change.
- **Informational** (box office, awards, milestones, won/lost bids) → **appear
  without interrupting**: badge increments, item lands in "While you were away,"
  clock keeps running. Optionally a brief non-blocking toast for the highest-tone
  events, but no pause.

This is a small, well-scoped change: `shouldConfirmResume` and the auto-pause
effect switch from `unreadBidCount > 0` to "any unread **time-critical**
notification." It also *reduces* current over-pausing (won/lost).

---

## 6. Candidate notification types

Ordered by confidence. Bias is conservative — a notification that fires often or
restates derivable state the player can already see is noise.

**Add now (fixes confirmed gaps, near-zero new state):**
- **Box office finished** — derived from `status==='finished' && !acknowledged`
  (already exists). Replaces the blocking popup. Links to `FilmDetailModal`.
- **Awards resolved** — derived from `awards.history` + window (already exists as
  `deriveRecentAwardHighlights`). Links to `AwardsPage`. Note: the Dashboard
  already shows this; the decision is whether the Inbox subsumes or mirrors the
  Dashboard card (see §8, Phase 3).

**Add soon (high-signal, fires rarely, easy to miss today):**
- **Milestone unlock** — Production Office / Distribution Arm becoming available
  (`canUnlockOffice` / `canUnlockDistributionArm`). Fires once each, is currently
  only visible on the facility card, and is genuinely a "studio changed" moment.
  Derivable from the unlock predicate + an "acknowledged" marker.

**Evaluate, do not build speculatively:**
- **Rival release collision** — potentially valuable ("a rival just scheduled
  against your date") but needs a strict noise budget and a clear
  system-of-record (`ReleaseCalendar`). Recommend a design spike before
  committing; risk of firing on every rival scheduling move.
- **Release-date risk / production schedule risk** — these are *ongoing
  conditions*, not events. If surfaced at all, they belong in the **derived
  Dashboard activity** (transient, self-clearing), never the stored log, or they
  will nag.

**Avoid for now:**
- Contract expirations / talent issues — only worth it once the underlying
  systems create real stakes; high recurring-noise risk.
- Anything that fires per-film-per-week (box-office weekly numbers already live
  on the Dashboard "In theatres" card and `FilmDetailModal`).

---

## 7. Existing reusable UI — route, don't duplicate

The Inbox should be a **dispatcher to systems-of-record.** All the targets exist:

| Inbox item | Routes to | Mechanism today |
|---|---|---|
| box office finished | `FilmDetailModal` (the *extracted popup content*) | local `selectedFilm` state |
| awards resolved | `AwardsPage` | `VIEW_AWARDS` |
| now-playing premiere | `ReleaseResults` / `PremiereReveal` | `VIEW_PREMIERE {filmId}` |
| bid outbid | `OpportunityMarket` | `VIEW_OPPORTUNITY_MARKET` |
| milestone unlock | facility card / Dashboard | (card is on Dashboard) |
| any released film | `FilmDetailModal` | local `selectedFilm` state |

**One concrete blocker:** `FilmDetailModal` is opened by **local component state**
(`selectedFilm`) inside Dashboard/StatsPage/ProjectsPage — it is *not* a routable
reducer action. The Inbox (mounted at App level) cannot open it today. Fix by
adding a **`VIEW_FILM_DOSSIER {filmId}`** action (or lifting `selectedFilm` to a
shared App-level slot) so any surface, including the Inbox, can deep-link to a
film's dossier. This is small and pays off well beyond the Inbox.

The box-office case is the clearest win: the detail presentation the blocking
popup shows was **already extracted into `FilmDetailModal`** (`FilmDetailModal.tsx:376`
documents this), so the Inbox route to it is essentially free — and it lets us
delete the blocking popup rather than reproduce it.

---

## 8. Implementation plan

Each phase is independently shippable and testable. The engine/derivation work
stays pure (per `CLAUDE.md`); presentation stays qualitative. Save compatibility
is out of scope pre-launch — bump `SAVE_KEY` freely when a stored shape changes.

### Phase 0 — Foundations (no behaviour change)

**What changes:** (a) Extract a shared `<Modal>` component from the ~10 hand-rolled
overlays, starting with Inbox. (b) Promote the Dashboard `ActivityItem`
derivation into a shared `state/selectors.ts:deriveStudioActivity` selector,
consumed by the Dashboard unchanged. (c) Add `VIEW_FILM_DOSSIER {filmId}`.

**Why:** removes the structural blockers (no item renderer, no shared modal, no
film deep-link, duplicated derivation) before any feature rides on them.

**Dependencies:** none.

**Regression risks:** Dashboard activity rendering must be pixel-identical after
the selector extraction; the modal extraction touches many components. Low logic
risk, broad surface.

**Testing:** snapshot/unit the extracted selector against the current Dashboard
output; existing Dashboard and modal tests must pass unchanged; add a
`VIEW_FILM_DOSSIER` reducer test.

### Phase 1 — Generalise the stored log + retune pause

**What changes:** rename/reshape `BidNotification` → `StudioNotification`
(discriminated union, bid kinds only for now); add a `timeCritical` flag
(true only for `outbid`). Rewire auto-pause and `shouldConfirmResume` to key off
"unread **time-critical**," not raw unread count. Bump `SAVE_KEY`.

**Why:** creates the seam future non-derivable events reuse, and fixes the
current over-pausing (won/lost) before more informational types arrive.

**Dependencies:** none (parallel to Phase 0).

**Regression risks:** the auto-pause/resume-guard truth tables change — the one
behaviour players feel. Contain it behind the existing pure predicates so it
stays unit-tested.

**Testing:** extend `engine/bidNotifications.test.ts` and the `shouldConfirmResume`
truth table in `App.test.ts`; assert won/lost no longer pause and outbid still
does.

### Phase 2 — Box office into the Inbox (confirmed gap #1)

**What changes:** add a derived `box-office-finished` activity item (reusing
`status==='finished' && !acknowledged`); render it in the Inbox "While you were
away" group with a **Details →** deep-link to `FilmDetailModal` via
`VIEW_FILM_DOSSIER`. **Remove the blocking `BoxOfficeFinishedPopup`** (or demote
it to non-blocking); "Details" marks it acknowledged.

**Why:** kills the sequential-blocking-popup problem directly; the player reviews
completed runs on their own time in the surface that already holds them.

**Dependencies:** Phase 0 (`VIEW_FILM_DOSSIER`, shared item renderer).

**Regression risks:** `acknowledged` currently gates the popup cascade; repurposing
it as the read flag must not strand a film as permanently unread or permanently
hidden. Verify the multi-completion cascade is fully replaced, not doubled.

**Testing:** reducer test that a finished run yields an unread inbox item that
clears on acknowledge; assert the blocking popup no longer mounts; multi-film
"away for weeks" scenario.

### Phase 3 — Awards into the Inbox (confirmed gap #2)

**What changes:** surface `deriveRecentAwardHighlights` as an Inbox activity item
linking to `AwardsPage`. **Decide the Dashboard relationship:** recommend the
shared selector emits the item once and *both* Dashboard and Inbox render it, so
there is a single source (no third code path).

**Why:** closes the "awards feel silent" gap in the catch-up surface, while
keeping `AwardsPage` as the archive.

**Dependencies:** Phase 0 (shared selector).

**Regression risks:** double-announcing (Dashboard card + Inbox) if the selector
isn't the single source. The 14-day window must not make an item reappear as
unread after it's been read — pair with the `lastInboxSeenDay` marker (§4).

**Testing:** selector test for the window + read marker; assert one logical item
feeds both surfaces.

### Phase 4 — Inbox layout: grouping + lifecycle

**What changes:** implement the §3 grouping (Needs you / While you were away /
Earlier), per-group counts, collapse of the read tail, and the `lastInboxSeenDay`
unread marker for derived items. Fold the two-paradigm badge into one count over
the unified feed.

**Why:** delivers the actual "six weeks away" experience; earlier phases make the
data correct, this makes it legible.

**Dependencies:** Phases 0–3 (needs the unified feed populated).

**Regression risks:** badge-count parity — the new single count must equal the old
`inboxBadgeCount + unreadBidCount` for actionable items so nothing silently stops
lighting the badge. Grouping logic is the main new surface.

**Testing:** badge-parity test against the pre-refactor count; grouping/sort unit
tests; the casting-undercount regression (`project.ts:106`) as a guard.

### Phase 5 — Conservative expansion (optional)

**What changes:** add **milestone unlock** notifications (Production Office /
Distribution Arm). Spike **rival release collision** behind a noise budget before
committing. Explicitly *defer* risk-warning and talent/contract types.

**Why:** milestone unlocks are high-value, rare, and easy to miss today;
everything else needs evidence it won't nag.

**Dependencies:** Phases 0–4.

**Regression risks:** low for milestones (fire-once). Rival collision is the one
to gate carefully.

**Testing:** milestone fires exactly once per unlock and clears on view.

---

## 9. Architecture assessment (summary)

**Strengths**
- Derived items self-clean — no archive/leak problem.
- One settlement chokepoint (`runCalendarSettlement`) for stored events.
- The right notification primitive (`ActivityItem`) already exists and is clean.
- Systems-of-record (`FilmDetailModal`, `AwardsPage`, `StatsPage`) already hold
  the detail the Inbox should link to, not reproduce.

**Weaknesses / technical debt**
- **Two parallel catch-up surfaces** (Dashboard activity feed + Inbox) built from
  the same state with different code — the primary debt and drift risk.
- Inbox rendering is hard-coded per category; `InboxItems` is heterogeneous and
  strained.
- Badge sums two paradigms by hand.
- Auto-pause keys off raw unread count, not time-criticality.
- No shared `Modal`; `FilmDetailModal` isn't routable.

**Risks**
- Badge drift (has happened once) if the two surfaces aren't unified.
- Over-pausing regressions when informational types expand — mitigated by the
  `timeCritical` flag in Phase 1.
- Turning the Inbox into a second archive — mitigated by the "link, don't
  duplicate" principle and `lastInboxSeenDay`.

**Bottom line:** the unified inbox is mostly a **consolidation and re-surfacing**
exercise, not new infrastructure. Extend the two systems that already exist (the
derived `ActivityItem` feed and the small stored log), unify them behind one
Inbox UI grouped by urgency, and route to the detail pages already built. The
confirmed gaps fall out of Phases 2–3 almost for free because the underlying
state and detail views already exist.
