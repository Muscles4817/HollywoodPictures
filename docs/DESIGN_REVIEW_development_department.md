# Design Review — Development Department MVP (Phase 3)

Status: **implemented** (save v49). Builds on the Phase 1 Asset↔Script contract
and the Phase 2 writer model. First real Development-stage *decision*: hire a
freelance writer to Rewrite or Polish an owned screenplay for cash + time.

## What it is

From the Asset Library, on an owned Asset that isn't in production, the player
commissions a freelance **Rewrite** or **Polish** pass. It costs cash (charged
now) and development time (the pass lands on a future day), and improves the
script's **craft** as a **probabilistic gamble** — a strong writer with room
reliably lifts a weak script; a weak or inconsistent writer on an already-good
script is a net-negative risk. Concept fields (genre/archetype/story/setting/
scale) can never change — the compiler enforces it via `reviseScript`'s
`Partial<ScriptCraft>`.

Nothing new was needed in the rewrite *engine*: Phase 1's `reviseScript`
(immutable new head + `revisions` + `DevelopmentEvent`) already did the core
work. Phase 3 adds the action, cost/time, the outcome roll, writer booking, and
UI around it.

## The outcome model (`engine/rewrite.ts`)

Per craft axis (originality / structure / characters / dialogue):

```
gap   = writer.craft[axis] − current[axis]
lift  = passStrength · skillFactor(skill) · max(0, gap)   // closes a gap the writer can close
noise = randFloat(−spread, +spread)                       // the gamble; can be negative
new   = clamp(current + lift + noise, 1, 100)
```

- **Diminishing returns** are free: the gap shrinks as a script approaches the
  writer's level, so a great script is hard to improve and a mediocre one has room.
- **`passStrength`**: Polish 0.25, Rewrite 0.5. **`skillFactor`**: 0.4–1.0 with skill.
- **`spread`** widens as `consistency` falls (a volatile auteur swings; a
  dependable craftsman is tight) and is larger for a rewrite than a polish.
- **Downside is real** — an axis with no room (or a weak/inconsistent writer)
  can come out slightly worse. This is what makes it a decision, not a
  money-for-stats button. Same "raise probabilities, not certainty" philosophy
  as Phase 2 generation.

The outcome is **rolled once, at commission** (deterministic via the game RNG),
stored on `Asset.pendingRewrite.craftChanges`, and applied on completion — so
settlement is deterministic and the player sees only a qualitative projection
beforehand.

## Cost & time

- **Fee** = `writer.typicalSalary × { polish: 0.15, rewrite: 0.35 }` — a pricier
  (better) writer costs more and delivers more. Charged immediately, studio-level.
- **Duration** = base (`polish 10`, `rewrite 24`) + a complexity term — the pass
  lands on `readyOnDay`, settled lazily during `runCalendarSettlement`
  (`engine/rewrite.ts:settleAssetRewrites`), the same "finishes on day N" shape
  `FilmDraft.postProductionEditingUntilDay` already uses.

## Data & flow

- `Asset.pendingRewrite?: { writerId, kind, startedOnDay, readyOnDay, craftChanges, fee }` — additive, optional.
- `REWRITE_ASSET` action → guard (missing / in-development / already-pending / unknown-or-unavailable writer / unaffordable) → charge fee → book the writer (`withCommitment`, keyed to the assetId, for the pass duration) → roll outcome → stamp `pendingRewrite`. Same guard-then-charge template as `HIRE_PRODUCER`.
- Completion (during any day-advance): `settleAssetRewrites` applies `reviseScript`, credits the rewriter alongside the original author (`writerIds` dedup — "written by X, rewrite by Y"), logs a completion `DevelopmentEvent`, clears `pendingRewrite`. The writer's commitment expires by its `endDay`.
- Guard added to `CREATE_PROJECT_FROM_ASSET`: can't start a Project while a pass is mid-flight (the head would shift under the draft).

## Presentation

Numbers stay hidden. The commission panel shows the writer's tier + "known for"
(Phase 2 `describeWriter`), a qualitative projection
(`describeRewriteProjection` — the one or two axes with most room, plus a
reliability hint), and only the concrete **fee** and **duration**. An in-flight
pass shows "In rewrite with {writer} — ready {date}."

## Scope

**In:** freelance Rewrite + Polish, cost, development time, writer booking, the
outcome gamble, revision-history reveal, guardrails, tests. **Test scripts are
rewritable** too (consistent with them being ordinary free Assets).

**Deferred (explicitly):** commissioning original scripts (P4), writer
collaboration (P5), permanent contracts / first-look (P6), sales/options (P7),
producer notes, **Asset heat decay & rights expiry** (the competitive
time-pressure valve — noted below), AI rivals doing rewrites (P-D), and the
Market-Research "tighten the estimate" fold-in. **Cut for good:** script
coverage, concept art, standalone market research.

## Known gap / next

The "trade time against outcome" tension is currently **soft**: with heat decay
and rights expiry deferred, spending development time costs little competitively
(a rival could take a contested Asset, but owned Assets sit safely). The natural
Phase-C follow-up is Asset heat decay + rights expiry, which give the time cost
real teeth without touching this mechanic.

---

# Phase 4 — Original screenplay commissions

Status: **implemented** (save v50). The inverse of the authored Opportunity
Market: instead of the market picking a writer and posting a script, the player
picks a specific writer and pays them to write a brand-new original in a chosen
genre. A premium, directed alternative to gambling cheaply on whatever the
market happens to post.

## What it is

From the Asset Library (the Development hub), a library-level **Commission an
original screenplay** action: pick a writer + a genre (pre-filled to their
strongest affinity), pay a fee, wait a development window, and a new owned Asset
authored by that writer lands in the library. Almost entirely a recombination of
existing parts — Phase 3's timed/charged/writer-booked machinery, Phase 2's
author-biased generator, Phase 1's Asset shape.

## The engine (`engine/commission.ts`)

- **Generation:** `writerProfileFromPerson(writer)` → `generateScriptOptions(genre, rng, 1, profile)[0]` — the exact Phase 2 call, minus the market's writer/genre selection (the player made both). The script's identity reflects the writer; archetype-first variance keeps even an elite's commission from being a guaranteed masterpiece.
- **Roll at commit:** the whole `Script` is generated once, under `withRng`, and stored on `PendingCommission.script` (hidden until delivery) — same deterministic-at-commit convention as a rewrite's `craftChanges`.
- `commissionFee(salary)` ≈ the writer's whole typical fee (premium vs. a rewrite's 0.15–0.35× and a Studio-Original opportunity's 0.1×) — you pay for **control**. `commissionDurationDays(script)` = base + complexity (writing from scratch takes longer than a rewrite). `settlePendingCommissions(pending, totalDays)` wraps delivered scripts as Assets.

## Data & flow

- `Studio.pendingCommissions?: PendingCommission[]` — studio-private property-in-the-making (like `assets`), not world-level (unlike `opportunities`, which are "nobody's property yet").
- `PendingCommission = { id, writerId, writerName, genre, startedOnDay, readyOnDay, script, fee }`; `DevelopmentEventKind += 'commissioned'`; action `COMMISSION_SCREENPLAY`.
- `COMMISSION_SCREENPLAY` mirrors `REWRITE_ASSET`: guard (writer exists / affordable / available) → charge → generate under RNG → book the writer (`withCommitment`) → store pending. Completion in `runCalendarSettlement` (beside `settleAssetRewrites`): the delivered Asset reuses the exact `ACQUIRE_OPPORTUNITY` shape — `source: 'Studio Original'` (the existing source, framed in the docs as "commissioned elites"), `acquisitionCost: fee`, `writerIds: [writerId]`, a `'commissioned'` founding event — so downstream it's indistinguishable from an acquired Asset and the "script cost charged once, at acquisition" invariant holds.

## Presentation

Numbers stay hidden: the commission panel shows the writer's tier + "known for"
(`describeWriter`) and a from-scratch `describeCommissionProjection(writer, genre)`
("Expect a tense, dialogue-driven thriller in their voice"), with only the fee
and a duration range exposed. In-flight commissions list "Original {genre} with
{writer} — ready {date}."

## Decisions (as approved)

Brief = **writer + genre only** (genre pre-filled to the writer's strongest
affinity, overridable); fee ≈ **full typical salary**; **no cancellation** in the
MVP; the rolled script is **stored** (deterministic; a negligible single-player
save-spoiler). MVP engages **existing pool writers only**, which sidesteps the
`nextTalentId` reload-collision gotcha (that only bites if commissions mint *new*
writers).

## Deferred

Richer briefs (scale/archetype), minting new writers for commissions,
collaboration (P5), permanent contracts / first-look (P6), sales/options (P7), AI
rivals commissioning, and cancellation/kill-fees. The soft time-pressure caveat
(heat/rights deferred) applies here too — a commission ties up cash + a writer
for weeks, but owned work sits safely until heat decay lands.

## UX polish (follow-up)

A pass over the commission experience after the MVP shipped:

- **Browsable writer picker** — the name-only dropdown became a searchable,
  budget-filterable roster of rows showing each writer's tier, "known for", and
  fee, with affordability up front (default "Within budget" on). Busy writers are
  shown disabled with "Booked until {date}" rather than hidden.
- **A delivery moment** — a commissioned script no longer appears silently. The
  Dashboard activity feed surfaces "In commission" (with the writer + ready
  month) while it's being written and a positive "Screenplay delivered" beat when
  it lands; the delivered Asset carries a "Just delivered" badge for a week
  (`isRecentlyCommissioned`), and a permanent "Commissioned" badge after.
- **Richer in-commission cards** — writer tier, fee, a progress bar
  (`commissionProgress`) and the ready date.
- **Risk in the projection** — `describeCommissionProjection` now surfaces the
  writer's reliability (a low-consistency auteur reads as "a wildcard whose
  results swing wide"), so the size of the bet is legible.
- **Framing** — one line clarifying commission vs. acquire vs. rewrite.

Still deferred: a full Inbox integration (the delivery beat lives on the
Dashboard activity feed, not the Inbox), and a richer brief. No persisted-shape
change, so no save-key bump.
