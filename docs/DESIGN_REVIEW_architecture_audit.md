# Architecture Audit: Current Codebase vs. the Agreed Domain Model

Status: **audit only - no implementation.** Compares the codebase as it
stands today against the principles agreed in
`DESIGN_REVIEW_calendar_and_release.md` and
`DESIGN_REVIEW_domain_model.md`. Every finding below was verified by reading
the actual file (not inferred) - line references are given so each one can
be checked directly. Findings are grouped by the categories you asked for;
each carries: what exists, why it conflicts, its classification, whether it
blocks future work, and how hard it would be to fix later if ignored now.

---

## Verdict up front

The foundations are **better than a two-year project usually inherits.**
The entire `engine/` layer is genuinely pure, the lazy calendar-settlement
pattern is proven correct under jump-vs-tick-by-tick testing, and the one
place the codebase already uses a discriminated union for a multi-shaped
entity (`Talent`) is exactly the pattern the domain model review recommends
generalizing. None of that should be touched.

The weaknesses cluster around **one root cause, not many unrelated ones**:
a film's identity is currently split across three storage locations
(`GameState.draft`, `Studio.productionsInProgress[]`,
`Studio.filmsReleased[]`), each with its own type and its own id scheme, and
that fragmentation has already produced a real, verifiable bug (see Identity
#3). Fixing that one thing resolves most of the "worth fixing before the
calendar" list on its own. Nearly everything else is either cosmetic,
already-known-and-accepted debt, or fine to leave for a year.

---

## State ownership

### 1. Rival studios nested inside the player's own `Studio`

**What exists:** `Studio.rivalStudios`, `Studio.rivalProductionsInProgress`,
`Studio.rivalFilmsReleased` (`types/index.ts` ~518-545) all live as fields
*on the player's Studio object*, not as siblings of it.

**Why it conflicts:** Directly violates "Studios participate in a shared
world rather than owning the world" and "reference over containment." The
player's Studio isn't just *a* participant - it's structurally *the*
container everything else hangs off.

**Classification:** Actual architectural problem (already flagged in the
calendar review as Milestone A).

**Blocks:** Every cross-studio query the calendar work needs (a shared
release schedule, competing weekends, "what's everyone releasing this
week"). Cannot be worked around - it has to be fixed before those features
have anywhere honest to read from.

**Refactor difficulty if deferred:** Grows with every new field added to
`Studio` that assumes this shape. Currently a wide-but-shallow mechanical
move (every `studio.rivalX` read site changes to `state.rivalX` or
`world.rivalX`). Cheapest it will ever be is right now, before
`scheduledReleases` exists to migrate too.

### 2. The calendar (`totalDays`) lives on `Studio`, not the world

**What exists:** `Studio.totalDays` (`types/index.ts` line ~523) is the
single source of truth for the calendar - but it's a property of one
studio, and every rival-studio calculation (`rivalStudios.ts`) reads it off
the *player's* `Studio` object passed in as a parameter, not off a shared
clock.

**Why it conflicts:** "Calendar/time is a world-level concern," almost
verbatim from your agreed principles. Today it's not even consistently
*studio*-level - it's specifically *the player's* studio, and every rival
function has to be handed that object just to know what day it is.

**Classification:** Actual architectural problem, same root cause as #1 -
these two should be fixed together, in the same pass.

**Blocks:** Same as #1.

**Refactor difficulty if deferred:** Same as #1 - do it once, do it now.

### 3. UI navigation flags living in the same state tree the simulation reducer mutates

**What exists:** `GameState.screen`, `viewingRivalStudioName`,
`viewingProductionId` sit alongside `studio`/`draft`/`rngSeed`
(`gameState.ts` ~23-40). `viewingProductionId` specifically gets explicitly
reset to `null` in **eight separate reducer cases**
(`START_NEW_FILM`, both branches of `GO_TO_STEP`, `RESUME_FOR_POST_PRODUCTION`,
`RETURN_TO_DASHBOARD`, `RESET_SAVE`, `VIEW_RIVAL_STUDIO`, `VIEW_STATS`) -
`studioReducer.ts` throughout.

**Why it conflicts:** "The simulation should represent business state
rather than UI screens." Nothing about "did a day pass" or "did a film
release" has anything to do with which rival's page the player happens to
be looking at - yet every simulation-relevant action has to remember to
also carry a UI-reset as baggage, or risk a stale view surviving past the
navigation that should have cleared it.

**Classification:** Actual architectural problem, small in isolation but
**getting worse with every new screen** - a scheduling UI (calendar review
Milestone C) will need its own transient "which release am I looking at"
state, which is exactly this pattern again, a ninth time.

**Blocks:** Nothing outright, but multiplies maintenance risk as new
screens are added - a forgotten reset is an easy, silent bug (a stale
`viewingProductionId` shadowing a live draft was explicitly the failure
mode `GameState.viewingProductionId`'s own comment warns about).

**Refactor difficulty if deferred:** Grows linearly with screen count.
Worth consolidating into one "reset transient view state" helper (or
moving it out of the reducer's persisted state entirely, into a UI-owned
layer) **before** adding the scheduling screens this milestone needs -
otherwise the boilerplate roughly triples.

### 4. `FilmDraft.furthestStepIndexCharged` is a UI-navigation workaround standing in for a real state-machine fact

**What exists:** An integer tracking "the furthest wizard-step index whose
calendar cost has already been charged," specifically to stop a
Back-then-forward round trip from double-charging (`types/index.ts` ~575,
`studioReducer.ts` `GO_TO_STEP`). Its own comment admits its origin: a real
bug, caught only by a diagnostic script, not inspection.

**Why it conflicts:** This field only needs to exist because the wizard's
*screen* order and the film's *business-stage* order are the same array
(`WIZARD_STEP_ORDER`) being asked to do two jobs: routing the UI and gating
real calendar charges. In a model where a Project has an explicit,
persisted lifecycle stage, "has this stage's cost already been charged" is
just "has the Project already moved past this stage" - free from the state
machine, no counter needed.

**Classification:** Technical debt (accidental complexity from conflating
UI routing with business-stage tracking), not urgent on its own.

**Blocks:** Nothing directly - it's an isolated, working (if awkward)
mechanism today.

**Refactor difficulty if deferred:** Low, and it likely **disappears for
free** once Project has a real `stage` field (Identity #1's fix)  rather
than needing a dedicated fix of its own.

### 5. The shared talent pool physically lives on the player's `Studio`

**What exists:** `Studio.talentPool: Record<TalentRole, Talent[]>`
(`types/index.ts` ~526) - the one roster every rival studio also casts
from - is a field of the *player's* Studio object. `settleRivalMarket`
receives the whole player `Studio` just to read/return an updated pool
(`rivalStudios.ts` `RivalMarketUpdate.talentPool`).

**Why it conflicts:** Talent is exactly the kind of shared, referenced
resource the domain model calls out as world-level, not owned by any one
studio - it just happens to work today because there is exactly one
"real" Studio object in existence.

**Classification:** Actual architectural problem, currently invisible
because there's nothing yet that would expose it (no second studio the
player can look at symmetrically).

**Blocks:** Nothing today. Would block a future "play as - or spectate - a
different studio" feature, or any world-level talent query that isn't
routed through the player's own object.

**Refactor difficulty if deferred:** Low-to-moderate - it's one field
moving one level up, same mechanical shape as #1/#2, ideally done in the
same pass since it's the same "promote to world level" motion.

### 6. What's already correctly separated (worth protecting, not fixing)

**What exists:** Purely presentational state - `App.tsx`'s `paused`,
`tickNonce`, `inboxOpen`, `speedMultiplier`; `Dashboard.tsx`'s `showGuide`,
`selectedFilm`, `collapsedFilmIds`, `editingName` - all live in local
React `useState`, never in `GameState`, never persisted.

**Why it's fine:** This is the correct line, already drawn correctly. The
problem isn't "there's UI state near the simulation" - it's specifically
that `screen`/`viewingRivalStudioName`/`viewingProductionId` (real
navigation, not local component toggles) ended up inside the persisted
reducer state instead of being treated the same way. Don't over-correct
into moving everything UI-shaped out of `GameState` - most of it already
isn't there.

**Classification:** Perfectly acceptable, should remain exactly as-is.

---

## Identity

### 1. A film's identity is fragmented across three storage locations and two id schemes

**What exists:**
- `GameState.draft: FilmDraft | null` - the single live slot.
- `Studio.productionsInProgress: FilmDraft[]` - background shoots, same
  type, different array.
- `Studio.filmsReleased: Film[]` - a **different type**, with a **new id**:
  `RELEASE_FILM` builds `id: \`film-${state.studio.filmsReleased.length + 1}-${totalDaysAfter}\``
  (`studioReducer.ts` line 649), completely unrelated to the `FilmDraft.id`
  (`d.id`) the same film carried its entire life up to that point.

**Why it conflicts:** This is precisely the fragmentation the domain model
review argues against in Q3 - "objects being recreated instead of
evolving." `FilmDraft.id` exists *specifically* to give a film a stable
identity across `productionsInProgress` (per its own comment,
`types/index.ts` ~549), and then that identity is thrown away at the exact
moment it would matter most - the transition into permanent history.

**Classification:** Actual architectural problem - the single biggest
finding in this audit, and the direct cause of Identity #3 below.

**Blocks:** `CompletedFilm`/`Scheduled` (calendar review Milestone B),
franchises/sequels (domain review Q7 - a stable id across a film's whole
life is what makes "this is a sequel to that project" a durable reference),
and any future per-film history/analytics feature.

**Refactor difficulty if deferred:** This is the one item in this audit
that gets **strictly worse, not just stale**, the longer it's left - every
milestone in the calendar review's plan that adds a new stage
(`Completed`, `Scheduled`) would otherwise add a *fourth* storage location
and a *third* id scheme on top of the two that already exist. Fix this
first.

### 2. Rival productions have their own separate identity chain - accidentally more traceable than the player's

**What exists:** `RivalStudio.id` (stable) → `RivalProductionInProgress.id`
(`rival-prod-${rival.id}-${totalDays}-${rand}`, embeds the rival id) →
`Film.id` (`rival-film-${production.id}`, embeds the production id) -
`rivalStudios.ts` lines 184, 234. Every step embeds the previous id as a
substring, so the chain is at least string-traceable end to end.

**Why it conflicts:** Same "recreated, not evolving" issue as #1, but
notably **the rival path preserves more traceability than the player's own
path does** - an accidental asymmetry between two things your agreed
principles say should eventually run under identical rules.

**Classification:** Actual architectural problem, lower severity than #1
(nothing reads these ids as if they were stable references today).

**Blocks:** Nothing today. Relevant the moment rivals need a real, stable,
non-string-parsed identity (competing-weekend logic, franchise lineage for
rival films).

**Refactor difficulty if deferred:** Low - naturally resolved by whatever
fixes #1, since a unified `Project` entity with one persistent id would
apply to rival-originated projects too.

### 3. Verified live bug: a released film's results exist as two copies that silently diverge

**What exists:** `RELEASE_FILM` freezes a snapshot into
`draft.results = releasedFilm.results` (`studioReducer.ts` line 703) - a
**second copy** of the same data that also lives, canonically, on
`state.studio.filmsReleased[n].results`. `ReleaseResults.tsx` reads
**only** the frozen `draft.results` (`const results = draft.results!;` line
11), never the canonical one. Per DESIGN.md 5.20, the background day-tick
(`ADVANCE_DAY`) **runs on the `results` screen** - and `ADVANCE_DAY`'s
reducer case never touches `state.draft` at all (confirmed - it only
updates `state.studio`).

**Consequence, verified against the existing test suite**: if a film's
box-office run is still going (hasn't finished within the first settlement
pass) and the player stays on the Results screen, the background tick keeps
advancing `state.studio.filmsReleased[n].results` toward its real final
numbers - but `draft.results`, what the screen actually displays, never
updates. `studioReducer.test.ts` line 27 asserts they're equal
**immediately after the `RELEASE_FILM` dispatch**, but no test anywhere
asserts they stay equal through a subsequent `ADVANCE_DAY` - I checked, and
they don't. A film that finishes its run while the player is still looking
at its own results screen will keep showing "still playing" / blank
profit/outcome, even though Studio History next door already has the real
numbers.

**Why it conflicts:** This is the "duplicated information / parallel
sources of truth" your Q7 asked about, made concrete and demonstrable -
directly caused by the film being *copied* into `draft` at release instead
of `draft`/`Project` continuing to point at the one canonical record.

**Classification:** Actual architectural problem, **and a real bug today**,
not just a smell. Low probability of a player actually hitting it in a
typical session (needs a longer-legged run plus lingering on that one
screen), but it's real and reachable, not hypothetical - especially with
the 4x speed control now available.

**Blocks:** Nothing new - it's an existing defect, worth fixing on its own
merits regardless of the calendar work.

**Refactor difficulty if deferred:** Trivial to patch narrowly (read the
canonical `filmsReleased` entry by id instead of `draft.results`), but the
**durable** fix is the same one Identity #1 already needs - one entity, one
home for its results, no snapshot. Worth doing as part of that pass rather
than a standalone patch that'll need revisiting anyway.

### 4. `RivalProductionInProgress` and `FilmDraft` are structurally parallel but unrelated types

**What exists:** Both carry `script`, `talent`, `productionChoices`,
`postProductionChoices`, `marketingChoices` - but as two separate
interfaces (`types/index.ts` ~504 and ~548) with no shared lineage, feeding
two entirely separate reducer/engine code paths (`rivalStudios.ts` vs
`studioReducer.ts`).

**Why it conflicts:** Your agreed principle "rival studios should
eventually operate under exactly the same simulation rules as the player"
is, today, structurally two different type hierarchies pretending to be
the same concept.

**Classification:** Actual architectural problem, but a deep one - true
unification would mean deciding what a "synthesized, not lived" production
looks like inside a single `Project` union (e.g. a `stage` variant that
skips live day-by-day photography). Not a quick fix.

**Blocks:** Long-term parity between player and AI (calendar review's
Milestone E benefits from it, but doesn't strictly require it - rivals only
need their `releaseDay` visible in a shared schedule, not a unified type).

**Refactor difficulty if deferred:** High if attempted alone; **low
marginal cost if folded into the Identity #1 fix**, since that work already
requires deciding what a unified `Project` union's variants look like.
Reasonable to defer a full year - nothing in the near-term plan strictly
requires it.

---

## World assumptions

| Assumption | Where it lives | Status |
|---|---|---|
| Only one player | `GameState.studio: Studio` (singular); rivals structurally lesser - no live shoot, no persisted reputation (`rivalStudios.ts` line 228: `studioReputation: 50 // rivals don't carry their own persistent reputation`) | **Temporary MVP shortcut**, explicitly documented as such in DESIGN.md 5.24. Not a design flaw - a deliberately deferred scope boundary. Directly blocks "rivals operate under exactly the same rules," which is on your agreed-principles list, so it's worth planning for, not fixing all at once. |
| Only one active project (player) | `GameState.draft: FilmDraft \| null`, `RESUME_FOR_POST_PRODUCTION`'s explicit "no-op while draft isn't already null" guard | Real, and the last surviving piece of "only one active film" - `productionsInProgress` already solved this for photography; post-production/marketing/scheduling are still serialized. |
| Only one draft | Same as above, at the type level (`FilmDraft \| null`, not `FilmDraft[]`) | Same root cause. |
| Immediate release | `RELEASE_FILM` (`studioReducer.ts` line 602) | The whole subject of the previous review - restated here only to note the new evidence this pass found (Identity #3's bug is a direct symptom). |
| Synchronous simulation | *(see below - this one is a strength, not a weakness)* | |

**On "synchronous simulation" specifically:** I'd push back on treating
this as a weakness. The settlement functions
(`settleBoxOfficeForAllFilms`, `settleRivalMarket`,
`settleProductionsInProgress`) are all **lazy, catch-up-based, and proven
correct under arbitrary time jumps** -
`studioReducer.test.ts`'s "a big jump matches many small ones" test
(line 66) dispatches one `ADVANCE_DAY` vs. many and asserts identical
final state. That's exactly the property a synchronous reducer needs to
*behave* like a continuous simulation, and it already has it. The
calendar/release milestone doesn't need to invent this pattern - it needs
one more sibling settlement function in the same shape
(`settleScheduledReleases`, per the previous review). This is a genuine
strength worth protecting, not a gap.

---

## Reducers doing too much

Ranked roughly by how many distinct domain events each one bundles:

### `RELEASE_FILM` (your own example, confirmed and detailed)

Bundles, in one dispatch: computing quality/critic/audience/buzz scores;
computing every cost component; constructing a brand-new `Film` with a
freshly-invented id (Identity #1); seeding its `BoxOfficeRun`; settling
**every previously-released film's** box office as an incidental side
effect; settling the rival market; settling every other background
production; deducting cash; freezing a `draft.results` snapshot that goes
stale (Identity #3); and navigating to `'results'`. At least seven
distinct concerns.

**Classification:** Mixed - the "settle everything else while we're here"
part is the *correct*, already-proven pattern (see above) and shouldn't
change. The genuinely wrong part is fusing "the player decided to commit
to releasing" with "the release event itself resolved" into one
non-separable action - exactly what the calendar review's Milestone B
splits apart.

### `GO_TO_STEP`

Bundles: deciding forward vs. backward; computing stage duration;
advancing the calendar; the same three-settlement-function fan-out as
`RELEASE_FILM`; updating `furthestStepIndexCharged`; navigating the
screen; resetting `viewingProductionId`. Arguably **more** of an offender
than `RELEASE_FILM` by frequency - it fires on nearly every wizard
transition, not once per film.

**Classification:** Actual architectural problem in the sense that "advance
the calendar" and "move the wizard forward" are two different domain
events wearing one action's name - but low urgency, since nothing today
needs to trigger one without the other.

### `ADVANCE_SHOOTING_DAY`

Bundles: rolling the live draft's own event; advancing or pausing its
photography; and - because it's also a calendar advance - the full
three-settlement fan-out for every *other* film/rival/production in the
game, none of which have anything to do with today's specific shoot.

**Classification:** Acceptable-as-is for the settlement fan-out (same
proven pattern); the naming is what's misleading - this action is really
"advance the world's calendar by one day, *and* advance this one draft's
shoot," two events sharing a dispatch.

### `RESOLVE_EVENT_CHOICE` / `FINISH_PHOTOGRAPHY`

Both have a **duplicated code path**: one branch for `action.productionId`
(an entry of `productionsInProgress`), one for the live `draft`, doing
conceptually the same thing with separately-written logic
(`studioReducer.ts` lines 546-569 for `FINISH_PHOTOGRAPHY`'s two nearly-
identical contingency-settlement branches).

**Classification:** Technical debt - a real copy-paste-drift risk (nothing
enforces the two branches stay mathematically identical if the contingency
formula ever changes), but low impact today (that formula is stable).

**Blocks:** Nothing directly. **Refactor difficulty if deferred:** Low, and
it **disappears on its own** once Identity #1's fix means there's only one
storage location to operate on, not two.

### `RETURN_TO_DASHBOARD`

Decides "discard vs. send to background vs. do nothing" by inferring from
a combination of nullable fields (`!d?.photography || d.results` -
`studioReducer.ts` line 729) rather than reading an explicit status.

**Classification:** Technical debt / fragility - works correctly today, but
nothing would stop a newly-added field from silently breaking this
inference later. Directly resolved by Identity #1's explicit stage field.

---

## Screens vs. simulation

### Wizard-step validation lives entirely in the UI, not the reducer

**What exists:** `DevelopFilm.tsx`'s `canContinue = Boolean(draft.title.trim()
&& draft.genre && draft.targetAudience && draft.script && ...)` gates the
Continue button. `GO_TO_STEP` itself performs **zero validation** on
`action.step` - it unconditionally honors any requested transition.

**Why it conflicts:** "The simulation should represent business state
rather than UI screens" - but here, the simulation's own invariant ("you
can't be hiring talent without a script") is only true *because* a button
happens to be disabled, not because the reducer enforces it. A save-file
edit, a future dev shortcut, or a bug in a disabled-state calculation could
put a `FilmDraft` in an inconsistent stage with nothing to stop it.

**Classification:** Actual architectural problem, moderate severity (no
known way to trigger it today, since the only entry point is the wizard
UI itself).

**Blocks:** Nothing directly yet - becomes more relevant once a real
lifecycle-stage state machine exists (Identity #1), since that's exactly
where "is this transition legal" naturally belongs.

**Refactor difficulty if deferred:** Low, and best done as part of
Identity #1's fix - a discriminated-union `Project` type makes illegal
transitions a compile-time or reducer-level check almost for free, rather
than a UI-only convention.

### The parallel `WIZARD_STEP_ORDER` array vs. the actual screen switch

**What exists:** `state/studioReducer.ts`'s `WIZARD_STEP_ORDER` array and
`App.tsx`'s screen-rendering switch are two independently-maintained lists
of the same seven screens, kept in sync by convention only.

**Classification:** Cosmetic/maintenance risk, not urgent - stable at seven
screens for a long time, low change frequency.

**Perfectly acceptable to leave** - fixing this proactively (e.g. deriving
one from the other) is exactly the kind of unforced refactor to avoid;
revisit only if a new wizard screen is ever actually added.

### One small, low-severity instance of a screen initializing simulation state

**What exists:** `MarketingRelease.tsx`'s mount effect dispatches
`SET_MARKETING_CHOICES` with defaults if unset (lines 31-36) - a component
reaching into the reducer to seed business-relevant state, rather than the
domain layer providing its own default.

**Classification:** Technical debt, cosmetic severity - the values are
freely overridable defaults, not a locked-in invariant.

**Blocks:** Nothing. **Safe to leave.**

### What's already right, and should stay exactly as it is

Every scoring/cost/production/box-office computation lives in `engine/` as
plain, pure functions with **zero React imports anywhere** - verified by
reading through every wizard screen: each one calls an `engine/` function
to *preview* what the reducer will do, none of them compute results
themselves. This is DESIGN.md's own stated rule (Section 5), and it's
genuinely, consistently followed. This is the single most important thing
in this codebase **not** to touch, and the small UI-state leakages above
shouldn't be read as undermining it - they're isolated, this is pervasive
and solid.

---

## Data flow

### Duplicated results (already covered under Identity #3)

Cross-referenced here as the canonical example of "parallel sources of
truth" - `draft.results` vs. `Film.results`.

### `computeCommittedSpend` vs. the real charge logic - two implementations of "what will this cost"

**What exists:** `state/selectors.ts:computeCommittedSpend` is a from-
scratch re-derivation of a film's costs so far, kept **manually in sync**
with the real charging logic spread across `BEGIN_PHOTOGRAPHY`,
`FINISH_PHOTOGRAPHY`, and `RELEASE_FILM`. Its own comment admits the risk
directly: "adding it here again would double-count spend."

**Why it conflicts:** A textbook parallel-computation risk - and not
hypothetical. DESIGN.md 5.16's own history section records a real bug from
exactly this: contingency was invisible in this preview for a period after
a related change, understating projected cost for the whole
Develop→Plan-Production stretch until caught by direct player feedback.

**Classification:** Technical debt, **already bitten once**, but the fix
each time so far has been narrow and successful.

**Blocks:** Nothing related to the calendar work specifically - this is
orthogonal to release timing.

**Refactor difficulty if deferred:** Low per-incident, but it's a
**repeat-offender pattern** - every future change to what gets charged and
when (very plausible during the calendar work, per the previous review's
open question about marketing-spend timing) needs to remember this file
exists. Worth a mental flag, not a dedicated fix pass right now.

### `Talent.bookedUntil` means two different things depending on who set it

**What exists:** A rival's booking spans production **through release**
(`bookedUntil: releaseDay`, `rivalStudios.ts` line 179). The player's own
booking (set at `RETURN_TO_DASHBOARD` when a shoot backgrounds) spans only
an **estimated wrap day** (`totalDays + recommendedDays`,
`studioReducer.ts` line 741) - it has no way to reach further into
post-production/marketing/release, because those phases don't hold a
`bookedUntil`-relevant commitment today.

**Why it conflicts:** The same field, read the same way everywhere
(`bookedUntil > totalDays`), silently means "committed for the whole
production+release window" in one case and "committed for the shoot only"
in the other. Nothing documents this as a deliberate distinction - it just
falls out of what each code path happens to compute.

**Classification:** Technical debt / latent correctness risk - could
plausibly let a rival "steal" someone the player still considers attached
to a film that's finished shooting but not yet released, once multiple
films can be mid-post/scheduled simultaneously.

**Blocks:** Nothing today (the player's own bookings are never actually
read against a rival's decision yet - the whole mechanism is one-directional).
Relevant once real actor-scheduling conflicts matter (domain review Q7).

**Refactor difficulty if deferred:** Low, and naturally addressed as part
of the calendar review's Milestone C/D (once a real `releaseDay` exists for
the player too, booking through it instead of an estimate is the same fix
both sides need).

### Full talent-pool copies threaded through settlement plumbing

**What exists:** `settleRivalMarket` takes and returns a whole
`Record<TalentRole, Talent[]>`, spread-copied (`{ ...talentPool }`) inside
a loop over every rival studio (`rivalStudios.ts` line 177 and following).

**Classification:** Perfectly acceptable at current scale - a performance
observation, not a correctness one. Six roles × ~100-200 candidates each is
nothing. Not worth touching unless roster size or settlement frequency
changes by an order of magnitude.

---

## Existing abstractions: what should definitely not be rewritten

- **`engine/` as pure functions, zero framework dependencies.** The single
  most valuable property in this codebase. Every future milestone
  (scheduled releases, franchises, awards) should keep landing here as
  more pure functions, not an excuse to introduce stateful managers.
- **The lazy, catch-up settlement pattern**
  (`settleBoxOfficeForAllFilms`/`settleRivalMarket`/`settleProductionsInProgress`),
  proven correct under arbitrary time jumps. This is the exact mechanism
  the calendar work extends (one more sibling function), never replaces.
- **`withRng`/reseed-after-every-roll.** Orthogonal to everything in this
  audit, solid, don't touch.
- **The `Talent` discriminated union** (`DirectorTalent | ActorTalent |
  CrewTalent`). Direct proof this codebase already carries the exact
  pattern the domain model review recommends for `Project` - use it as the
  literal template, don't invent a new shape.
- **`selectors.ts`'s derive-don't-store approach** (Stats page aggregates,
  `computeTopGrossingFilms`, etc. - all computed fresh from
  `filmsReleased`/`rivalFilmsReleased`, nothing duplicated into its own
  stored rollup). Exactly the instinct the domain review's Slate/
  ScheduledRelease-as-a-query recommendation is built on. Reuse this
  pattern for the release calendar view - don't store what a query already
  answers.
- **Local React `useState` for genuinely ephemeral UI state.** Already
  correctly separated from `GameState` in the vast majority of cases (see
  State Ownership #6) - the fix needed is narrower than "move more into
  local state" or "move more into the reducer," it's specifically
  relocating the handful of world-shaped fields that ended up in the wrong
  container.

---

## Summary: fix now vs. leave for a year

**Worth fixing before the calendar work begins** (each one either blocks a
near-term milestone outright, or gets structurally worse the longer it's
left):

1. Promote `totalDays`/`rivalStudios`/`rivalProductionsInProgress`/
   `rivalFilmsReleased`/`talentPool` out of `Studio` (State Ownership #1,
   #2, #5) - blocks every cross-studio query the calendar milestones need.
2. Unify a film's identity into one entity, one array, one id, across its
   whole life (Identity #1) - the fragmentation gets a third and fourth
   storage location added on top of it with every subsequent milestone if
   left alone, and it's also what fixes the live `draft.results` bug
   (Identity #3) and several of the reducer/duplicated-branch issues for
   free.
3. Consolidate the scattered UI-navigation-reset boilerplate
   (`viewingRivalStudioName`/`viewingProductionId`, State Ownership #3)
   before the scheduling UI adds a ninth place that needs it.

**Real, but genuinely fine to leave alone for another year:**

- The rival/player type asymmetry (Identity #4) - true parity is a deep
  change; nothing in the near-term plan requires it.
- `computeCommittedSpend`'s manual-sync risk (Data Flow #2) - orthogonal to
  release timing, already has a working track record.
- `bookedUntil`'s dual semantics (Data Flow #3) - gets naturally resolved
  as a side effect of Milestone C/D, not a prerequisite for them.
- `FINISH_PHOTOGRAPHY`/`RESOLVE_EVENT_CHOICE`'s duplicated branches
  (Reducers) - disappears on its own once #2 above is done; not worth a
  standalone pass.
- `WIZARD_STEP_ORDER` vs. the screen switch, talent-pool copy volume,
  `MarketingRelease.tsx`'s mount-effect default - all cosmetic or
  performance-only, no urgency, no risk to anything on the roadmap.

**Solid, don't rewrite:** the entire `engine/` layer, the lazy settlement
pattern, `withRng`, the `Talent` discriminated union, and `selectors.ts`'s
derive-don't-store style. These are the parts of this codebase that should
still look exactly like this in two years.
