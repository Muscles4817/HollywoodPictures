# Design Review: Core Simulation Domain Model

Status: **pure conceptual exercise - no code, no implementation.** Follow-up
to `DESIGN_REVIEW_calendar_and_release.md`, which this document partially
**revises** (see Q3 - I no longer think that review's `CompletedFilm`
proposal was the right shape, and I say why below). Nothing here is decided
until it's built and folded into `DESIGN.md`.

---

## TL;DR

- **One long-lived entity per film, not three (or four).** Today a film's
  identity is scattered across `GameState.draft` (single slot),
  `Studio.productionsInProgress[]`, and `Studio.filmsReleased[]` - three
  different arrays, three different implied shapes, for what is
  conceptually one thing living one continuous life. My previous review's
  `CompletedFilm` would have added a *fourth*. This review's answer: **one
  `Project` entity, one persistent id, one array, from greenlight to
  library** - expressed as a TypeScript discriminated union by lifecycle
  stage, not a single loosely-typed mutable blob. That gets you a stable
  identity *and* the type-safety of "a Development-stage project doesn't
  have a `results` field to accidentally read."
- **Ownership is mostly reference, not containment.** `World` truly *owns*
  its `Studios` (they don't exist independently) and a `Studio` truly owns
  its `cash`/`reputation`/`name` (nobody else's business). But `Project` and
  `Talent` should live in **flat, world-level lists**, referenced by a
  `studioId`/`talentId`, not physically nested inside whichever `Studio`
  happens to be working on them. This is what makes "what's everyone
  releasing this week" a query instead of a five-way array flatten, and
  it's the same shape the codebase already uses for `Talent` (a shared pool,
  borrowed via `bookedUntil`, never copied into a studio).
- **Yes to Industry → Calendar → Studios → Projects, with one correction:**
  don't make "Films" a separate layer under "Projects." A released film is
  just a `Project` in a late lifecycle stage - same entity, same id, same
  array. Two layers there would resurrect the exact fragmentation problem
  above.
- **Slate: emergent, not stored** - as a *list*, it's just a query
  ("this studio's Projects, sorted by stage/release day"). It only becomes
  worth its own entity if it grows a *policy* attached to it (a target
  release cadence, a genre-mix rule) that AI studios already informally have
  today (`rivalStudios.ts`'s tier-based concurrent-capacity rules) and the
  player currently doesn't. Don't build that yet; the seam is worth
  knowing about.
- Full entity list, ownership diagram, lifecycle argument (both sides,
  with a real recommendation), transition tables, and a feature-by-feature
  future-proofing pass are below.

---

## 1. Core entities, from first principles

Strip away today's code shape and ask what a simulation of a film industry
*has* to represent, structurally:

1. **Something everyone shares.** If multiple studios are going to compete,
   there has to be a shared axis they all move along (time) and shared
   resources they compete *over* (talent, audience attention). This can't
   belong to any one studio - it's the substrate everyone acts within.
   → **World** (the container) and **Calendar** (the shared clock it keeps).

2. **Actors who compete.** Each one has its own private state (money,
   reputation, roster access) and takes actions independently. The player is
   one instance of this; an AI rival is another - nothing about "being an
   actor in this economy" should be player-specific.
   → **Studio**.

3. **The thing actors produce, that takes time and changes shape as it's
   worked on.** This is the one with the most structural weight, and Q3
   below is entirely about getting its shape right.
   → **Project** (working name - a film from greenlight through its entire
   life; see Q3 for why I don't split this into several types).

4. **A shared, scarce resource actors compete for**, with its own state
   independent of any one studio (a person is either free or they're not,
   regardless of who's asking).
   → **Talent** (already modeled roughly this way today - a shared pool,
   `bookedUntil` rather than ownership).

5. **What a finished Project does once it reaches the public** - not a
   different *thing*, but a *behavior* a Project exhibits once it's in a
   late enough stage: it accrues real-time audience/revenue state.
   → **BoxOfficeRun**, as a sub-state of a Project's `Released` stage, not
   a sibling entity.

**Deliberately not promoting to first-class entities yet** (would be
building structure the game doesn't use):

- **ScheduledRelease** - this is just a `Project` in its `Scheduled` stage.
  A world-level *view* over "all Projects currently in that stage" gives you
  the release calendar; it doesn't need its own storage (see Q2/Q5 - this is
  the single most important simplification in this document).
- **Slate** - see Q5. Emergent list; possibly a real *policy* entity later,
  not a container.
- **DistributionPlan** - still deferred, per the last review. A `Project`'s
  `Scheduled`/`Released` stage carries `releaseType`/`marketingChoices`
  today; a richer per-territory/per-channel model is additive later, not a
  reason to invent the type now.
- **Franchise, Loan, Investor, AwardsCeremony** - all real, all future, all
  discussed in Q7. None of them change the shape of the five entities
  above - they *reference* Projects/Studios, they don't contain them. That's
  exactly why they're safe to defer: nothing about deferring them requires
  guessing their shape correctly today.

So: **five entities** - `World`, `Calendar` (a property/service of `World`,
not really its own lifecycle-bearing entity - see Q2), `Studio`, `Project`,
`Talent` - plus `BoxOfficeRun` as a Project sub-state. Everything else in
your example list (`Distribution`, `Scheduled Release`) is either a stage of
`Project` or a future entity that references it.

---

## 2. Ownership hierarchy

The important distinction is **containment vs. reference**. Containment
means "this can't exist independently and nothing else can point at it
directly" (a `Studio`'s `cash` value has exactly one owner, full stop).
Reference means "this lives in a shared, queryable place, and things point
at it by id" - which is what you need the instant more than one actor needs
to see the same thing (a schedule, a talent pool).

```
World                                      <- true container
 ├─ currentDay: number                      <- Calendar is a property, not a child entity
 ├─ studios: Studio[]                       <- true container (player + every AI, symmetric)
 │    each Studio owns, by containment:
 │      name, cash, reputation, reputationHistory
 │      (nothing about "being a studio" requires Projects or Talent to be
 │       physically nested inside it - see below)
 │
 ├─ talentPool: Talent[]                    <- shared, referenced by id
 │    Talent.bookedUntil / .bookedBy: studioId
 │    (a Studio doesn't own the people it hires - it holds a claim on
 │     shared talent, exactly like today's bookedUntil already models)
 │
 └─ projects: Project[]                     <- shared, referenced by id
      Project.ownerId: studioId             (who's making/made it)
      Project.stage: Development | ... | Finished
      (a Studio doesn't contain its own films - it's associated with a
       filtered view of the world-level project list)
```

**Why reference beats containment here, concretely:** the moment you want
"what's releasing this week, across every studio" (needed for competing
weekends, needed for a Top 10 chart, needed for awards eligibility), a
containment model forces you to reach into N different `Studio.projects`
arrays and flatten them - and you have to do it *every single query site*,
forever. A reference model makes it one filter over one list:
`projects.filter(p => p.stage === 'Scheduled')`. This isn't a hypothetical
- **the codebase already has this exact bug shape today**: rival studios
are nested inside the *player's own* `Studio` object
(`Studio.rivalStudios`/`rivalFilmsReleased`), which is precisely why my
previous review's Milestone A had to propose un-nesting them before a
shared schedule could exist at all. Reference-not-containment for
`Project`/`Talent` avoids ever having that problem again for anything else.

**What genuinely should stay contained:** a `Studio`'s own identity, cash,
and reputation. Nothing else in the simulation should be able to reach in
and mutate another studio's cash directly - that must stay exclusive,
single-owner data. The rule of thumb: **contain what must stay private and
mutation-exclusive to one owner; reference what other systems need to query
across owners.**

---

## 3. Film lifecycle: one long-lived object, or a chain of transformations?

This is the question my previous review answered too quickly (the
`CompletedFilm` proposal). Arguing it properly:

### Case for a single, long-lived, mutating object

- **One stable identity for the whole life of the film.** Every reference
  that needs to point at "this film" - a talent booking, a marketing spend
  commitment, eventually a franchise's "this is the sequel to that" link -
  gets to use one id forever. A chain of distinct object *types*
  (`FilmDraft` → `CompletedFilm` → `Film`) means either those ids have to be
  manually threaded through every conversion, or - worse - a new id gets
  generated at each stage and something downstream has to reconstruct the
  chain to know they're the same film.
- **No "did I copy every field correctly" bug class.** `state/studioReducer.ts`'s
  `RELEASE_FILM` case today manually re-lists every field from `FilmDraft`
  to build a new `Film` object. That's not a hypothetical risk, it's
  already the exact shape of code in this file right now - and my
  `CompletedFilm` proposal would have added a *second* such conversion,
  immediately after the first, in the same reducer.
- **Trivial lifecycle analytics.** "How many days did this film spend in
  post-production," "which stage does the player linger in longest" - all
  free if it's one record with a stage-change history, all requiring a join
  across separate object types otherwise.
- **Consistent with the one pattern that already works well here.**
  `FilmDraft` already persists through `develop → talent → planning →
  photography` as one continuously-mutated object. Extending that same
  shape further down the pipeline is *less* of a departure from what's
  already idiomatic in this codebase than introducing new types partway
  through.

### Case for distinct types per stage

- **Illegal states become unrepresentable.** A `Film` type that's *always*
  fully resolved (has `results`, has a `boxOfficeRun`) means every
  consumer - the Stats page, `FilmDetailModal`, the box-office settlement
  pass - never has to null-check "is this actually finished yet." This is
  real, present-day value: `Film.results.criticScore` is a plain number
  today specifically *because* `Film` and `FilmDraft` are separate types.
  Collapse them into one ever-mutating record with a `stage` flag and every
  read site needs its own type-narrowing check instead of the compiler just
  guaranteeing it.
- **Terminal immutability.** DESIGN.md is explicit that a `Film` is
  "immutable once created; lives forever." A single mutable record fights
  that guarantee by construction - anything holding a reference to it could
  still, in principle, see it change.
- **No dead fields.** A released film has no business carrying
  `scriptOptions`/`talentTargetPriceByRole` (draft-only fields that only
  make sense mid-development) - a single flat type either carries them
  forever as always-stale optionals, or the type grows a second axis of
  "which fields are even valid right now" on top of the stage flag, which is
  most of the complexity of separate types without the benefit.

### The resolution: one identity, expressed as a discriminated union

Both sides are right about different things, and TypeScript already has the
tool that gets you both: **one entity, one persistent id, one array
position across its entire life - but its *type* at any moment is a tagged
union variant keyed by `stage`.** Not "one interface with thirty optional
fields," and not "three unrelated types joined only by convention." A
`Development`-stage `Project` and a `Finished`-stage `Project` are
different, non-overlapping shapes - but they're variants of the *same*
type, sharing an id, and a transition is "replace this array entry with the
next variant of the same union," never "delete from one array/type, insert
into a different one."

This is also not a new pattern for this codebase - it's the exact shape
`Talent` already uses (`DirectorTalent | ActorTalent | CrewTalent`, a
discriminated union by `role`, sharing `TalentCommon`). Doing the same
thing for a film's lifecycle *stage* instead of a person's *role* is
applying an already-idiomatic pattern to a second axis, not introducing a
new one.

**Verdict: this will age better than either pure alternative.** It directly
fixes something that's *already* mildly wrong today (three storage
locations for one conceptual film-life: `draft`, `productionsInProgress`,
`filmsReleased`) rather than adding a fourth, while keeping every
type-safety property the separate-`Film`-type approach earns you today.

**One practical caveat:** at no point does this need to be one giant
`interface Project` with every field from every stage marked optional -
that would just be the worst of both worlds (no stable narrowing, no
freedom from dead fields). The union has to be a *real* tagged union, with
each variant only carrying what's true at that stage.

---

## 4. Industry vs. Studio: is "the player participates in the calendar, doesn't own it" the right mental model?

**Yes - this isn't over-engineering, it's the same correction as Q2/Q3
applied to the top of the hierarchy.** Concretely, what it means and
doesn't mean:

- **It means:** `currentDay` lives on `World`, not `Studio`. The player's
  `Studio` is one entry in `World.studios`, symmetric with every AI rival -
  not a privileged root object that happens to have some rival data bolted
  onto it (which, again, is literally today's shape:
  `Studio.rivalStudios`).
- **It doesn't mean** inventing a heavyweight `Industry` manager class with
  its own behavior. `World` can be exactly what `GameState` already is
  today - a plain data container - just with the calendar and the shared
  project/talent lists sitting at that top level instead of nested one
  layer too deep. This is the same "promote, don't wrap" point from the
  previous review's Q3 answer, extended: you don't need a new *kind* of
  object, you need the *existing* top-level object (`GameState`/`World`,
  whichever name you prefer) to actually hold the things that are
  genuinely world-scoped.

**One correction to your proposed chain.** You wrote:

```
Industry → Calendar → Studios → Projects → Films
```

I'd collapse the last two links into one. Once release becomes independent
of production (the previous review's whole subject), **there is no separate
"Films" layer** - a released film is a `Project` that has reached a late
lifecycle stage. Keeping them as one entity (Q3) means this diagram's last
arrow should read `Projects (→ eventually Released/Finished)`, not
`Projects → Films` as if a Project produces a structurally different Film
object as output. If "Films" stays useful as a *word* (it's the natural
name for "a Project once it has a script/cast/reception people talk
about"), that's fine - just don't let it become a second type.

Corrected mental model:

```
World
 └─ Calendar (a property: currentDay, deriving season/year/eligibility windows)
 └─ Studios[]          (symmetric: player and every AI rival)
 └─ Projects[]         (one per film, one id for its whole life, tagged by
                         ownerId + stage - "Films" is what you call the
                         late-stage ones, not a separate collection)
 └─ TalentPool[]       (shared, referenced by id, not owned)
```

---

## 5. Slates

**Emergent, not stored - as a list.** `World.projects.filter(p => p.ownerId
=== studioId)`, grouped by stage or sorted by release day, *is* a slate. No
separate entity needed to answer "what does this studio have coming out."
Storing a parallel `Slate` object that lists a studio's upcoming films risks
exactly the dual-write drift this whole document has been arguing against
for `ScheduledRelease` - two places that can disagree about the same fact.

**But there's a real seam here, and it's worth naming even though I
wouldn't build it yet.** A slate in the real sense you're describing
("our next three years") isn't just a list - it's a *policy*: a target
release cadence, a genre mix, a risk profile (how many tentpoles vs. how
many prestige plays at once). That's genuinely not derivable from the
project list; it's an input to *decisions about* the project list. And the
game already has an unnamed, informal version of exactly this, today, for
AI studios only: `engine/rivalStudios.ts`'s tier-based concurrent-capacity
rules (Indie: 1 Small at a time; Major: up to 2 Big *and* 4 Medium
simultaneously) are a slate-management *policy*, just hard-coded per tier
rather than expressed as data the player also gets a lever over.

**Recommendation:** don't build a `Slate` entity now. If/when a mechanic
needs a studio-level *policy* (not just a *list*) - most likely alongside
AI strategy work or a hireable-producer mechanic (already a Known
Limitation in DESIGN.md) - that's the moment a small `SlateStrategy` object
(cadence target, genre-mix preference, risk tolerance) earns its keep,
symmetric between the player and AI. Until then, it's a query, not state.

---

## 6. State transitions

First, a deliberate refinement of your proposed pipeline: I'd use **seven**
stages, not nine, collapsing two pairs that don't need their own persisted
status:

- **Development + Pre-production → `InDevelopment`.** Nothing outside the
  currently-active wizard screen needs to distinguish "still picking a
  script" from "cast hired, planning production" as separate *queryable*
  states today - they're sequential screens within one continuous process,
  the same way `Photography`'s day-by-day progress is one status
  (`daysElapsed` ticking) rather than a new status per day. A status should
  exist when something *outside* the active screen needs to observe or gate
  on it (concurrency, settlement passes, eligibility) - not for every UI
  screen boundary.
- **Finished Run + Library → `Finished`.** "Library" is what you call a
  `Finished` project once enough time has passed that it's no longer news -
  a presentation choice for the Stats page, not a different state of the
  data.

### `Project`

| From | To | Trigger | Direction | Notes |
|---|---|---|---|---|
| *(none)* | `InDevelopment` | Player/AI greenlights a script | forward only | Gets its permanent id here. |
| `InDevelopment` | `InProduction` | Cast + production plan locked, photography begins | forward only | Mirrors today's `BEGIN_PHOTOGRAPHY`. |
| `InProduction` | `InPostProduction` | Photography wrapped | forward only, **immutable after** | Shoot events/cost are now historical fact - never revisited. |
| `InPostProduction` | `Completed` | Edit/test-screening choices locked | forward only | No release commitment yet. |
| `Completed` | `Scheduled` | Release day + marketing + release type chosen | forward | The one genuinely new transition this whole arc is about. |
| `Scheduled` | `Scheduled` | Player reschedules to a different future day | **backward-compatible in place** | A real studio moves a date on a calendar without "un-completing" anything - model this as same-stage, changed `releaseDay`, not a round trip through `Completed`. |
| `Scheduled` | `Completed` | Player pulls the release entirely (no new date decided yet) | **backward** | Rarer than a simple reschedule; genuinely undecided again. |
| `Scheduled` | `Released` | `currentDay` reaches `releaseDay` | **automatic, calendar-triggered, not a player action** | The transition that generalizes what rivals already do (`releaseDay <= totalDays`). Not reversible - the day has passed, tickets have sold. |
| `Released` | `Finished` | Box office run decays below threshold or hits the run cap | automatic | Not player-controlled. |
| `Finished` | *(none)* | - | **terminal, fully immutable** | Lives forever, per today's existing rule. |

**Impossible transitions worth naming explicitly:** nothing skips a stage
(`InDevelopment` can't jump straight to `Scheduled`), and nothing goes
backward once `Released` - once the world has seen the film, its release-day
facts (critic/audience score, opening reception) are locked, matching
today's existing "release-day-knowable vs. what isn't" split almost exactly.

**A stage this table deliberately leaves room for, but doesn't spec:**
`Abandoned` - reachable from any pre-`Scheduled` stage (a script that never
gets made, a shoot that gets scrapped), never reachable from `Scheduled`
onward (you can't un-release reality). Real studios do shelve films
entirely; this becomes worth building once financing/investor pressure (Q7)
gives "cut your losses" a real cost to weigh against.

**Attributes, not states:** `ReleaseType` (Limited/Wide/Festival First) and
the derived `ReleaseWindow` are *properties of* the `Scheduled`/`Released`
stages, not alternate paths through this table. Keeping them as attributes
rather than parallel state machines is what keeps this table at seven rows
instead of multiplying by every distribution choice.

### `Talent`

| From | To | Trigger | Direction |
|---|---|---|---|
| `Available` | `Booked` | Hired onto a `Project` entering `InProduction` (or earlier, once contracts exist) | forward |
| `Booked` | `Available` | `currentDay` passes `bookedUntil` | automatic, forward |

Already close to this shape today (`Talent.bookedUntil`). Two states worth
naming for later, not now: `Injured/Unavailable` (event-driven, temporary -
a natural extension of the existing on-set event system) and `Retired`
(permanent, terminal - needs an age/career-length mechanic that doesn't
exist yet).

### `Studio`

Effectively stateless today (a `Studio` just exists once created). Worth
flagging that **financing (Q7) is what will eventually give `Studio` a real
state machine** - `Active → Distressed → (Bankrupt | Recovered)` or similar,
gated by loan/investor mechanics that don't exist yet. Not a concern for
this milestone arc; noted so it isn't a surprise later.

### `World` / Calendar

Not really a state machine - `currentDay` only ever increases. Year/season
are derived on read (`engine/calendar.ts`'s existing job), never stored,
never "transition." The one thing worth deciding explicitly: does the
calendar ever *pause* globally (vs. today's per-screen tick pausing)? I'd
say no - the per-screen pause behavior (DESIGN.md 5.20/5.22) is a UI
concern about *when the player is shown ticking*, not a fact about whether
the simulated world's clock is running. Keep those separate.

---

## 7. Future-proofing pass

| Feature | Supported as-is? | Why / what it needs |
|---|---|---|
| **Studio identity** | ✅ | Additive fields on `Studio`. Already modeled as a symmetric peer entity - no structural change. |
| **AI strategies** | ✅, better than today | World-level `Projects`/schedule means AI logic can query "my slate, everyone else's schedule" directly. Today's studio-nested rivals would have made this harder - one more reason Q2's flattening matters. |
| **Awards** | ✅, additive | Needs one new *referencing* entity (`AwardsCeremony`/nominees, pointing at `Project` ids) plus a date-range eligibility query over `Finished` projects - both trivial once `World.currentDay` and a flat `Projects` list exist. No change to `Project`'s own shape required. |
| **Franchises / sequels** | ✅, and specifically *enabled* by Q3 | A stable, permanent `Project` id across its whole life is exactly what makes "this is a sequel to that project" a durable reference (`franchiseId` + installment number). This would have been meaningfully harder under the old `Draft → CompletedFilm → Film` id-churn shape. |
| **Multiple simultaneous productions** | ✅, directly | The core subject of this document - a world-level `Projects` list with no single-slot bottleneck. |
| **Release clashes** | ✅, structurally | Grouping `Scheduled` projects by `releaseDay`/week is one filter. The *simulation math* for what a clash actually does to two films' audience pools is separate, genuinely new work (previous review's Milestone F) - the domain model doesn't need to anticipate that math, just make the query possible. |
| **Streaming** | ⚠️ needs its own model, not just a new enum value | Worth knowing: `ReleaseType` briefly wouldn't have included `Streaming` and the codebase has *already* removed it once, explicitly because there's no honest audience-simulation model for a non-theatrical release (`engine/audienceSimulationInputs.ts` deliberately excludes it at the type level, `SupportedReleaseType = Exclude<ReleaseType, 'Streaming'>`). This is good, hard-won information: streaming isn't "add a value to the enum," it needs its *own* consumption-pattern simulation (no weekly theatrical attendance curve applies), and should be scoped as that, not bolted onto the existing `ReleaseType`. |
| **Distribution (multi-territory/channel)** | ✅, additive later | `Scheduled`/`Released` stages can grow a `distributionDeals[]` (per territory/channel) in place of one flat `releaseType`, whenever that mechanic is actually designed. Deliberately not shaped now (per the previous review's take on `DistributionPlan`). |
| **Actor scheduling (real conflicts, not just vs. AI)** | ✅, directly | Falls out of "multiple simultaneous productions" - once the player can have several `Project`s in flight, `Talent.bookedUntil` conflicts become real player-vs-player-self scheduling, not just player-vs-AI. |
| **Financing / loans / investor pressure** | ✅, additive to `Studio` | New entities (`Loan`: principal/rate/term/balance; `Investor`: stake/expectations/patience), owned by `Studio`, don't touch `Project` or `World` shape at all. This is also the point where `Studio` finally gets a real state machine of its own (see Q6) - worth planning for, not urgent. |
| **Delays** | ✅, already modeled in the transition table | A `Scheduled → Scheduled` reschedule (see Q6) *is* a delay. Production-side delays already exist today via the on-set event system (`delayDaysDelta`) and need no change. |

**Net assessment:** the model holds up well against every item on the list
except streaming, which was never really a "does the domain model support
it" question - it's a "this needs its own simulation, and the codebase has
already learned that the hard way once." Everything else is additive:
either a new field on an existing entity, or a new entity that *references*
`Project`/`Studio` by id rather than requiring either of them to change
shape. That referencing pattern - not containment - is doing almost all of
the future-proofing work here.
