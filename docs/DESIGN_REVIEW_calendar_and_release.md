# Design Review: A Real Calendar and Independent Release Scheduling

Status: **proposal / discussion draft, nothing implemented.** Written against
the codebase as of the Milestone 6 box office redesign (`7b5ceff`) plus the
uncommitted box-office tuning pass on top of it. Cross-references `DESIGN.md`
section numbers throughout; nothing in this file should be taken as decided
until it's built and folded into `DESIGN.md` the way every other feature is.

---

## TL;DR

Agree with the direction. **Completed vs. Released should become separate
states.** But two corrections to the plan as framed:

1. **The "World vs. Studio" question (your Q3) isn't a parallel concern to
   evaluate alongside the calendar work - it's a hidden prerequisite inside
   it.** Rival studios currently live *nested inside the player's own
   `Studio` object*. The moment "release" becomes something a schedule needs
   to reason about across studios (competing weekends, an industry-wide
   calendar), that data has to already live somewhere both the player and
   every rival can see symmetrically. Do this refactor **first**, as its own
   milestone, or the calendar/release work ends up redone once rivals need
   the same schedule.

2. **Your 9-stage pipeline conflates two different state machines.**
   Development → Pre-production → Principal Photography → Post-production
   are wizard *screens* (they already exist, unchanged, as
   `FilmDraft`/`GameState.screen`). Completed → Scheduled → Released →
   Theatrical Run → Library is the lifecycle of the *artifact that comes out
   the other end*. Trying to model both as one linear enum is the kind of
   thing that forces a rewrite later. The genuinely *new* states needed are
   just two: **Completed** (post-production locked, nothing scheduled yet)
   and **Scheduled** (release day + marketing committed, counting down).
   "Theatrical Run" and "Library" already exist today (`BoxOfficeRun.status`
   and `Studio.filmsReleased` respectively) - they don't need new states,
   just a correct trigger to enter them.

The good news: the codebase already contains the exact pattern this milestone
needs to generalize. `engine/rivalStudios.ts` already schedules a rival's
release for a future day (`releaseDay = totalDays + ...`) and resolves it
lazily, off the calendar, the moment `totalDays` reaches it
(`settleRivalMarket`'s `releaseDay <= totalDays` check). That is a
`ScheduledRelease` in everything but name. The player has never had this
because `RELEASE_FILM` still does "commit marketing + compute results + seed
the box office run" as one atomic action. Milestone B below is mostly
"give the player what the AI already has."

---

## 1. Is this the correct next architectural direction?

**Yes, with one addition.** Every feature you listed as coming *after* the
calendar genuinely depends on release being decoupled from completion:

- **Rival release scheduling** *is* this milestone - there's no separate
  feature here, it's a direct consequence of Milestone C/E below.
- **Better AI studios** - reacting to the player (avoiding a competing
  weekend, timing a response film) requires a shared schedule to react
  *to*. Right now a rival's `releaseDay` is picked once, at production
  start, and never revisited against anything - there's nothing "better AI"
  could even look at.
- **Awards season** - needs a real eligibility window ("released in calendar
  year X"). `Studio.totalDays` is currently just a running counter with a
  display-only year/day derivation (`engine/calendar.ts:formatGameDate`,
  DESIGN.md 5.16) - nothing today treats "which calendar year" as a fact
  other code can query, because nothing has needed to yet.
- **Franchises** - need release *spacing* (a sequel N days/years after the
  original) - meaningless without real, player-chosen dates.
- **Studio identity** - the one item on your list that's genuinely
  independent. It could proceed in parallel without blocking on this work.
  It would still benefit from Milestone A below (a shared `World` layer is a
  natural home for reputation-over-time, industry standing, etc.) but
  doesn't require it.

**The dependency you're not quite naming**: Q3 (World vs. Studio) isn't a
design alternative to weigh against the calendar work - it's *part of* the
calendar work, because "a shared calendar and release schedule" and "rival
studios nested inside the player's own Studio object" are contradictory
today. See Milestone A.

---

## 2. What assumptions in the current code become invalid?

Audited every call site that touches `totalDays`, `releaseDay`,
`RELEASE_FILM`, `FilmDraft`, and the box-office/rival settlement passes.

### "A film releases immediately after completion"

- **`state/studioReducer.ts:RELEASE_FILM`** (~line 602) is the whole
  assumption in one place: it requires `d.marketingChoices` to already be
  set, then in a single dispatch computes `computeReleaseResults`, builds
  the `Film`, sets `releasedOnDay: totalDaysAfter` (= *today* + the
  Marketing stage's fixed duration), and immediately seeds
  `BoxOfficeRun.status: 'running'` with week 1 due right away. There is no
  path where a film finishes post-production and *waits*.
- **`components/wizard/MarketingRelease.tsx`** - "Release Film" is a single
  button; there's no date picker, because there's no concept of "later" to
  pick.
- **`data/release.ts` / `ReleaseWindow`** - this is the one that will
  surprise you most. `Quiet Month` / `Summer` / `Awards Season` / `Halloween`
  / `Christmas` already exist as a picker in `MarketingRelease.tsx`, and
  `RELEASE_WINDOW_GENRE_BONUS` / `RELEASE_WINDOW_BASE_MULTIPLIER` already
  apply real box-office multipliers for them. **But it's a flavor label with
  zero connection to `Studio.totalDays`.** A player can pick "Christmas" on
  day 47 (game-spring) and get the Christmas bonus. This isn't a bug today -
  there's no calendar date to check it against - but it means "seasonal
  releases" doesn't need to be *invented*, it needs to be **re-plumbed**:
  the picker becomes a *derived label* from an actual chosen day, not an
  independent choice. That's a real mechanic change (the player loses the
  ability to get a Christmas bonus without actually landing near Christmas),
  worth flagging as a design decision, not just a refactor.
- **`FilmResults`** - critic/audience/buzz score and the department
  breakdown are already computed release-day-instantly regardless of how
  the box office run later plays out (DESIGN.md 5.19, "release-day-knowable
  vs what isn't"). That precedent is good news: it means a `Completed` film
  can plausibly already know its own quality scores before a release date is
  even picked, *if* marketing choices are locked at completion time. But if
  release **window** genuinely needs to feed Buzz/reception (it currently
  doesn't - window only multiplies box office, not scores), that boundary
  would need revisiting.

### "Only one active film exists"

This is actually **half-fixed already**, and worth knowing before scoping
new work:

- `Studio.productionsInProgress: FilmDraft[]` (added for background
  photography) already allows **multiple concurrent Principal Photography
  shoots**. `engine/productionsInProgress.ts:settleProductionsInProgress`
  advances all of them per tick.
- **But post-production, marketing, and release are still fully
  serialized** through the single `GameState.draft` slot. A backgrounded
  shoot that finishes photography just sits at
  `photography.status: 'finished'` until `RESUME_FOR_POST_PRODUCTION` pulls
  it into the one `draft` slot - which is a no-op if `draft` isn't already
  null (i.e., the player is mid-wizard on something else). So today: you can
  have three films shooting at once, but you can only ever be *finishing*
  one at a time, and only ever have one film *scheduled or completed and
  waiting*.
- `Screen = 'dashboard' | WizardStep | 'rival-studio' | 'stats'`
  (`types/index.ts`) has no room for "which of several completed films am I
  looking at" - the wizard screens all implicitly mean "the one live
  draft."
- Rivals, by contrast, are **already fully concurrent** -
  `Studio.rivalProductionsInProgress: RivalProductionInProgress[]` is a
  plain array, no single-slot constraint. The player is the one place this
  assumption is still hard-coded.

### "Box office is resolved immediately"

- **False already, and has been since 5.19/5.34** - `Film.boxOfficeRun` is
  a live weekly process, settled lazily off `Studio.totalDays`
  (`engine/boxOfficeRun.ts:settleBoxOfficeForAllFilms`). This assumption is
  already gone for the *run itself*; what's still true is that the run can't
  *start* until `RELEASE_FILM` fires, which is the thing this milestone
  changes.
- Rival films go through the identical `Film`/`BoxOfficeRun` shape
  (`resolveRivalProduction`), so this part of the pipeline needs **no
  changes** to support scheduled player releases - it already doesn't care
  who released something or when, only that `releasedOnDay` is in the past.

### "Release is an action rather than an event in time"

- True for the player (`RELEASE_FILM`, a `GameAction` dispatched by a
  button), **false for rivals already** -
  `settleRivalMarket`'s `releaseDay <= studio.totalDays` check *is* release
  as an event in time. This is the asymmetry Milestone B/C closes: not by
  inventing a new mechanism, but by putting the player on the mechanism
  rivals already use.
- `Talent.bookedUntil` is set to a rival's `releaseDay` at production start
  (booking spans "cast until this film wraps and releases," not
  distinguishing wrap-from-release) - once Completed/Scheduled are separate
  for the player, decide whether the player's own eventual bookings (today:
  never set, per `TalentCommon.bookedUntil`'s own comment - "only one of the
  player's own films is ever in production at a time") should span past wrap
  once multiple films can be mid-post/scheduled simultaneously (Milestone
  D).

### One thing *not* on your list, but adjacent: cash timing

Worth flagging because it'll surface the moment Milestone B/C exist. Talent
salary, the production budget, and the contingency reserve are charged
**upfront at `BEGIN_PHOTOGRAPHY`** (a recent change - see the
`background photography` commit). Script cost, event cost swings, test
screening, and marketing are still charged at `RELEASE_FILM`. Once
"finished post-production" and "released" become different moments, you'll
need to decide **when marketing spend is actually charged**: at the moment
the campaign is committed (Completed → Scheduled transition - arguably the
more realistic answer, since real campaigns ramp up *before* opening), or
still at the day the film opens. Not answering this now - just flagging
that Milestone B/C will force the decision, the same way `BEGIN_PHOTOGRAPHY`
recently forced the analogous one for production costs.

---

## 3. What should become world state instead of studio state?

**Yes to the underlying instinct, no to necessarily inventing a formal
`World` class.** What's actually wrong today:

```
GameState
  studio: Studio            <- the player
    totalDays                <- should be world-scoped, not studio-scoped
    rivalStudios[]           <- not the player's studio's data at all
    rivalProductionsInProgress[]
    rivalFilmsReleased[]
```

The calendar and the competitive field are being modeled as if they belong
to the player, purely because `Studio` was the only object that existed
when they were added (5.16 added `totalDays` to `Studio` before rivals
existed at all; 5.24 then had nowhere else to put rivals *except* inside the
same `Studio`, since `GameState` itself was thin). That was the right call
at the time - it's exactly the kind of thing DESIGN.md's own priority order
("a complete, playable loop > clean, extensible architecture") says is fine
to defer. It stops being fine once a *schedule* needs to be visible to more
than one studio symmetrically.

**Recommendation: promote, don't wrap.** Move `totalDays`, `rivalStudios`,
`rivalProductionsInProgress`, and `rivalFilmsReleased` up to sibling fields
on `GameState` itself (which already sits above `Studio` and already owns
things that aren't studio-specific, like `screen` and `rngSeed`). Add the
new `scheduledReleases` list at the same level. This gets you everything a
`World` object would, without adding a new indirection layer (`state.world.X`
instead of `state.X`) that every existing call site touching `totalDays`
would need to learn.

If you'd rather have the explicit name for clarity as the state shape grows
(a reasonable call once `scheduledReleases`, industry events, etc. pile up),
a thin `World` object is a fine *alternative*, not an *addition* - either
way, the actual work is the same data migration, just choosing flat
`GameState` fields vs. one more nesting level. I'd default to flat fields now
and revisit naming once there's enough world-level state that the grouping
earns its own concept. Don't build the wrapper speculatively.

**What stays on `Studio`**: identity (`name`), `cash`, `reputation`,
`talentPool`, `filmsReleased`, `productionsInProgress` - everything that's
genuinely *one studio's own business*, whether that studio is the player or
(possibly, later) an AI. Keeping `Studio` symmetric like this is also what
would let a rival studio and the player's studio eventually share code paths
more directly - not the goal of this milestone, but a nice side effect of
getting the ownership right now instead of later.

---

## 4. How should time advance?

**Keep the existing hybrid model - it's already correct, don't replace it.**
Today: explicit stage costs charged on `GO_TO_STEP` transitions
(`STAGE_DURATIONS`), a live day-by-day tick during photography
(`ADVANCE_SHOOTING_DAY`, DESIGN.md 5.16), and a background `ADVANCE_DAY`
tick (DESIGN.md 5.20) on screens with nothing to click, paused on every
planning screen. This already solves "the player isn't the only clock in
the world" - box office settles, rivals spawn/release, and background
productions advance, all off the same lazy `Studio.totalDays` reads,
regardless of what screen the player is on. A dedicated dashboard speed
control (1x/2x/4x on the background tick) already exists too, so "let the
player skip ahead when there's nothing to do" is already solved as a UX
lever, not something this milestone needs to invent.

**What's actually missing isn't a new time-advance mechanic - it's a fourth
thing for the existing settlement pass to check.** Right now every
calendar-advancing reducer case
(`ADVANCE_DAY`, `GO_TO_STEP`, `ADVANCE_SHOOTING_DAY`, `RESOLVE_EVENT_CHOICE`,
`RELEASE_FILM`) already calls three settlement functions in the same breath:
`settleBoxOfficeForAllFilms`, `settleRivalMarket`, and
`settleProductionsInProgress`. Milestone C adds a fourth:
`settleScheduledReleases` - walk `scheduledReleases`, and for any entry whose
day has arrived, do what `RELEASE_FILM` currently does synchronously
(compute results, seed the run, fold into `filmsReleased`). This is
structurally identical to what `settleRivalMarket` already does for rivals
(`releaseDay <= totalDays`) - the same lazy, lives-alongside-everything-else
pattern, not a new one.

I'd explicitly **reject** an "Advance Time" button as the primary mechanic:
it would fight the thing that already makes this game work
(time passing *while you do other things*, not as its own standalone menu
action) and would need its own pause/interrupt semantics that the tick +
speed-control already give you for free. Keep it as exactly what it is
today: an accelerant on the existing tick, not a parallel system.

---

## 5. What new domain objects should exist?

Thinking from first principles about what's *actually* new once release is
independent of production - deliberately trying to avoid inventing more
nouns than the mechanic needs:

**`ScheduledRelease`** - the one genuinely new "future event" entity.

```ts
interface ScheduledRelease {
  id: string;
  studioName: string;        // player's Studio.name, or a rival's - symmetric, see Q3
  releaseDay: number;        // the world's totalDays this resolves on
  // Everything computeReleaseResults needs, locked in at scheduling time:
  completedFilm: CompletedFilm;
  marketingChoices: MarketingChoices;
  releaseType: ReleaseType;
  // releaseWindow is NOT stored here - see below, it's derived from releaseDay.
}
```

Lives in the world-level `scheduledReleases: ScheduledRelease[]` (Q3),
resolved by `settleScheduledReleases` the same lazy way rivals already
resolve. This is also the natural place a future "what's already opening
that weekend" UI reads from, and later, the natural place rival AI logic
(Milestone E) reads from to react to the player.

**`CompletedFilm`** - a locked, not-yet-scheduled film. Everything a
finished `FilmDraft` has *except* marketing/release choices and results:
script, cast, production choices, post-production choices, the shoot's
actual events/cost. Genuinely new - today, finishing post-production and
choosing marketing/release happen in the same screen with nothing persisted
in between.

**`ReleaseWindow`, reinterpreted, not replaced.** Keep the existing enum and
bonus tables (`data/release.ts`) - they're good, tuned content. Change what
*produces* the value: instead of a picker, `deriveReleaseWindow(releaseDay):
ReleaseWindow` reads the calendar month `releaseDay` falls in
(`engine/calendar.ts` already derives month/day-of-year for display; this is
the same derivation, just consumed by a new function instead of only
`formatGameDate`). The player's actual lever becomes "which day/week do I
release," and the window bonus falls out of that choice honestly, instead of
being picked independently of it.

**What I'd deliberately *not* build yet:**

- **`DistributionPlan`** - you listed it as an example, not a commitment,
  so: I don't think this earns its own type right now. `MarketingChoices` +
  `ReleaseType` already cover everything the simulation currently reads at
  release time. Inventing a distribution layer before there's a mechanic
  that needs one (separate marketing *channels* is already a named Known
  Limitation, DESIGN.md 8 - a good future home for this name once that
  exists) risks modeling structure the game doesn't use yet.
- **`ActiveRun`** - already exists: `Film.boxOfficeRun`
  (`status: 'running' | 'finished'`). No new type needed, just a new trigger
  for when a `Film` gets created and its run seeded (from
  `settleScheduledReleases` instead of synchronously from `RELEASE_FILM`).
- **`ReleaseSchedule` as its own aggregate/manager type** - I'd keep this as
  "the `scheduledReleases` array plus a couple of selector functions"
  (`state/selectors.ts` already has this exact pattern -
  `collectFilmStats`/`filterAndSortFilmStats` are pure functions over a
  plain array, not a manager object). A `ReleaseSchedule` *class* would be
  the first stateful manager object in a codebase where "everything in
  `engine/` is a pure function, plain data in, plain data out" (DESIGN.md
  section 5) is a deliberate, load-bearing rule. Don't break it for this.

---

## 6. What should remain unchanged?

**Untouched:**

- The entire scoring engine (`engine/scoring.ts`, `genreWeights.ts`,
  `compatibility.ts`, `outcome.ts`, `reputation.ts` - DESIGN.md 5.1-5.11).
  None of it reasons about *when* release happens, only about the finished
  film's own inputs.
- Procedural generation (`talentGenerator.ts`, `scriptGenerator.ts`,
  `premiseGenerator.ts`) and the production-dial math
  (`interpolate.ts`, `productionDials.ts`).
- Principal Photography as a live process (5.16/5.17/5.18) - the
  day-by-day shoot, on-set events, recasting. Fully orthogonal to when the
  finished film eventually opens.
- The audience simulation itself (5.34) - `TotalAddressableAudience`,
  `AwareCount`, word-of-mouth, weekly settlement math. It already only
  cares about `releasedOnDay` being in the past relative to `totalDays`;
  doesn't care who scheduled it or when the decision was made.
- The Stats page, cost model fundamentals, the wizard component patterns.

**Adapt (extend existing shape, don't rewrite):**

- `engine/boxOfficeRun.ts` / `engine/rivalStudios.ts` - add a sibling
  settlement function; the lazy-catch-up pattern they already use is
  exactly the pattern the new one needs.
- `state/gameState.ts` / `studioReducer.ts` - new `GameAction` variants
  (`COMPLETE_POST_PRODUCTION` or similar, `SCHEDULE_RELEASE`) alongside
  existing ones; `RELEASE_FILM`'s logic gets *split* between "lock the
  film" and "resolve it," not deleted.
- `FilmDraft`/`Film` types - new optional fields and a status flag, not a
  restructure. Same incremental-field-addition pattern every past save-
  version bump has already used (`persistence.ts` is on v18 and has a full
  changelog of exactly this kind of change - well-precedented process, not
  new risk).
- `MarketingRelease.tsx` → gains a date/window step; `ReleaseResults.tsx` →
  needs to handle "not resolved yet" the way it already handles "run still
  in progress" (DESIGN.md 5.19's "UI" paragraph is the template).
- Dashboard - already shows running box office and rival studios in a
  sidebar; a "coming soon" list is the same pattern again
  (`TopGrossingPanel.tsx` is a good template).

**Genuinely redesign:**

- The release step's UX (`MarketingRelease.tsx`'s single "Release Film"
  button → scheduling UI with a calendar/date picker and visibility into
  what else is landing that week).
- Where rival-studio state lives (Q3 - `Studio`-nested → `GameState`-level).
- `ReleaseWindow`'s causality (picked → derived).
- The wizard's terminal step. `'results'` currently always means "the film
  I just released." Once release can happen later than completion, you need
  a screen for "here's your completed film, choose how/when to release it"
  that isn't `'results'`, and `'results'` (or something showing final
  numbers) becomes something you might revisit later rather than something
  you land on immediately.

---

## 7. Proposed staged implementation plan

Six milestones, ordered so each one removes exactly one assumption and each
is independently shippable (the game should be fully playable and behave
identically to today at the end of every milestone except where the
milestone's whole point is a visible new choice).

### Milestone A - Promote calendar and rival state out of `Studio`

**What:** Move `totalDays`, `rivalStudios`, `rivalProductionsInProgress`,
`rivalFilmsReleased` from `Studio` to `GameState` (or a thin `World` if you
decide you want the name now - see Q3). Every read site
(`state.studio.totalDays` → `state.totalDays`, etc.) gets updated
mechanically; no behavior changes.

**Why first:** Every later milestone needs a place for schedule data that
both the player and rivals can see symmetrically. Doing this after
`scheduledReleases` already exists means migrating a list of live release
records mid-flight instead of an empty array.

**Removes:** "The calendar and the competitive field are the player's
studio's business." **Unlocks:** a correct home for
`scheduledReleases` (world-level, not studio-level) in Milestone C.

**Risk:** Pure mechanical refactor, wide but shallow (touches every
`studio.totalDays`/`studio.rivalX` read) - the highest-file-count, lowest-
design-risk milestone in this plan. Good candidate to do with a mechanical
find/replace pass plus a full save-version bump, verified by the game
playing identically before/after.

### Milestone B - Split `RELEASE_FILM` into "complete" and "resolve," same day

**What:** Introduce `CompletedFilm` and the `Completed` status. Post-
production's exit action stops going straight to Marketing-and-release-as-
one-step; instead it produces a `CompletedFilm` sitting on the studio
(single-slot is fine for now - see Milestone D). Marketing/release choices
now target a **new action** (`SCHEDULE_RELEASE`) that, for this milestone
only, *always* resolves immediately (`releaseDay = totalDays`, no picker
yet) - i.e., functionally identical to today's `RELEASE_FILM`, just routed
through the new two-step shape.

**Why here:** Smallest possible slice that proves `Completed` → `Scheduled`
→ `Released` works end to end, with zero visible gameplay change (release
day is always "now"). Isolates "does the state machine hold together" from
"can the player actually pick a future date," which is a separate, riskier
question (touches UI, touches the settlement pass, touches
`ReleaseWindow`).

**Removes:** "Release is the terminal wizard action, computed in the same
dispatch as locking marketing choices." **Unlocks:** an actual date picker
in Milestone C, with the plumbing already proven.

### Milestone C - Let the player pick a real future release day

**What:** `SCHEDULE_RELEASE` now accepts a chosen `releaseDay` (today or
later). A new `settleScheduledReleases` function joins the existing three
settlement calls at every calendar-advancing reducer case, mirroring
`settleRivalMarket`'s `releaseDay <= totalDays` pattern exactly. Results
compute and the box office run seeds **at resolution**, not at scheduling.
`ReleaseWindow` switches from picked to derived
(`deriveReleaseWindow(releaseDay)`).

**Why here:** This is the actual feature - everything before it was making
this milestone safe to build. Requires Milestone A (world-level
`scheduledReleases`) and Milestone B (a `Completed`/`Scheduled` state to
hang a date on).

**Removes:** "Results are computable the instant marketing is chosen" as a
*forced* assumption (they still can be, if you resolve marketing/critic/
audience scores at scheduling time and only defer the box-office-facing
parts - a real open sub-question, not resolved by this document). "Release
window is a free choice" (it's now a consequence of timing).

**Unlocks:** holding a film for a season, visible "coming soon" list,
seasonal strategy actually mattering.

### Milestone D - Multiple player films completed/scheduled at once

**What:** `CompletedFilm`/`ScheduledRelease` become lists, not single slots
- close the last single-slot gap (`productionsInProgress` already solved
this for photography; post-production and scheduling are the remaining
serial bottleneck, per the Q2 audit).

**Why here:** Only makes sense once B/C exist - there's no point letting
multiple films be Completed/Scheduled before Completed/Scheduled exist at
all. Deliberately *after* C, not bundled with B, so the harder "date
picker + settlement" work in C isn't also fighting a concurrency change at
the same time.

**Removes:** "Only one film can be mid-post/scheduled at a time" - the last
survivor of the "only one active film exists" assumption family.
**Unlocks:** real slate management - three films shooting, one completed
and waiting for a fall release, one already running.

### Milestone E - Rivals see and react to the shared schedule

**What:** Rival release-day selection (`startRivalProduction`) starts
reading `scheduledReleases` (world-level, from Milestone A) instead of
picking a day in a vacuum. Simplest version: bias away from a day that
already has N releases scheduled. Richer version: let a rival deliberately
target a weekend the player has announced.

**Why here:** Needs Milestone A (a schedule rivals can see) and ideally C/D
(the player's own releases are actually schedulable, so there's something
worth reacting to).

**Removes:** "The AI's release timing is independent of everything else
happening in the industry." **Unlocks:** "better AI studios" from your Q1
list, and is the literal implementation of "rival release scheduling."

### Milestone F - Competing-weekend mechanics

**What:** Decide what actually happens when two-plus releases land the same
week - contested audience pools (the audience simulation's
`TotalAddressableAudience`/`InterestedRemaining` could plausibly be split
when films chase overlapping segments), or just a softer "shared attention"
penalty. Genuinely new simulation design, not a refactor.

**Why last:** Depends on releases actually being able to collide
(Milestones C-E), and is the first milestone in this plan that changes a
*number* rather than *when something happens* - correctly the highest-risk,
most-content-driven piece, saved for when the plumbing under it is proven.

**Unlocks:** the "competing release weekends" item from your original list,
and is a reasonable on-ramp toward awards season (a released-this-year
eligibility query becomes trivial once F's world-level release ledger
exists) and franchises (release spacing becomes a real, checkable fact).

---

### Explicitly out of scope for this arc

- **Awards season, franchises, studio identity, physical studio
  facilities** - all still Known Limitations (DESIGN.md 8), all still
  their own design passes. This plan only makes their *prerequisite*
  (a real, shared calendar with real release dates) exist; it doesn't
  design any of them.
- **Marketing channels** (already a named Known Limitation) - a good
  future extension of `MarketingChoices` once `DistributionPlan`-shaped
  needs actually appear, not part of this milestone set.
