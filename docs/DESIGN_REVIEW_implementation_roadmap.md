# Implementation Roadmap: Calendar, Release Scheduling, and the Project Domain Model

Status: **planning only - no code written yet.** Turns the architecture
agreed across `DESIGN_REVIEW_calendar_and_release.md`,
`DESIGN_REVIEW_domain_model.md`, and
`DESIGN_REVIEW_architecture_audit.md` into an ordered sequence of small,
reviewable steps.

**Sequencing principle, stated up front since it explains the step count:**
this roadmap is optimized to minimize risk, not to minimize the number of
commits. Several phases below could be collapsed into fewer, larger steps -
deliberately not done, because the biggest single risk in this whole effort
(unifying a film's identity, currently spread across three storage
locations with two id schemes - audit Identity #1) is exactly the kind of
change that goes wrong quietly if done in one big leap. Every phase before
it exists specifically to shrink what that one big step has to touch.

Every step below follows the same template and satisfies all seven of your
constraints by construction: compiles, keeps the game playable, states its
behavior-change status explicitly, is scoped to name its own files, names
its own tests, and names its own compatibility layer (or "none").

---

## Phase 0 - Safety net, before touching anything

Establish a verified-correct baseline and remove the one **known live bug**
(audit Identity #3) narrowly, before it can complicate a bigger refactor's
"did I preserve behavior" question.

### Step 0.1 - Fix the `draft.results` staleness bug

- **What:** `ReleaseResults.tsx` currently reads a frozen snapshot
  (`draft.results`) instead of the canonical, continuously-updated
  `Studio.filmsReleased[n].results`. Change it to look up the real film by
  id from `studio.filmsReleased` (falling back to the frozen snapshot only
  if, somehow, the lookup fails) so the screen reflects live settlement the
  same way Studio History already does.
- **Files:** `components/wizard/ReleaseResults.tsx`. No reducer or type
  changes needed - `RELEASE_FILM` can keep freezing `draft.results` for now
  (harmless once nothing reads it as the source of truth), or stop doing so
  if that's cheaper; either is fine here.
- **Behavior change:** Yes, narrowly - fixes a real bug (a finished run can
  currently display as permanently "still playing" if the player lingers on
  the results screen). No other behavior changes.
- **New tests:** A `wizardRunThrough.test.ts` (or `studioReducer.test.ts`)
  case: release a film with short legs, dispatch enough `ADVANCE_DAY`s to
  finish its run *while remaining on the `'results'` screen*, and assert
  the film's results (however the screen now sources them) show the final
  `outcome`/`profit`, not `null`. This is the regression test the audit
  noted was missing.
- **Compatibility layer:** None.
- **Risk:** Trivial, isolated, one file. Good first commit - proves the
  "read the canonical source, not a copy" discipline before the bigger
  identity work leans on it.

---

## Phase 1 - Promote world-level state out of `Studio`

Mechanical relocation only: move fields that are genuinely world-scoped
(the calendar, the competitive field, the shared talent pool) from being
nested under the player's `Studio` to being siblings of it on `GameState`.
No shape changes, no new types - purely "which parent object holds this
field." Deliberately done **before** the Project-identity work (Phase 3-5)
so that work only has to unify identity, not simultaneously relocate data
too.

Split into three sub-steps by field group, so each diff stays reviewable
and a merge conflict in one doesn't block the others.

### Step 1.1 - Promote `totalDays` to `GameState`

- **What:** `Studio.totalDays` → `GameState.totalDays`. Every
  `state.studio.totalDays` read/write across the reducer, `rivalStudios.ts`,
  `productionsInProgress.ts`, `boxOfficeRun.ts` call sites, and every UI
  component that reads the date (`DateBar`, `Dashboard`, `FilmDetailModal`,
  `StatsPage`) becomes `state.totalDays`.
- **Files:** `types/index.ts` (move the field between interfaces),
  `state/gameState.ts` (`createInitialStudio`/`GameState` shape),
  `state/studioReducer.ts` (every case that reads/advances it - this is the
  widest single-field diff in the roadmap, but every change is the same
  mechanical substitution), `engine/rivalStudios.ts`,
  `engine/productionsInProgress.ts`, `components/common/DateBar.tsx`,
  `components/Dashboard.tsx`, `components/common/FilmDetailModal.tsx`,
  `components/StatsPage.tsx`.
- **Behavior change:** None.
- **New tests:** None new - this is exactly what the existing
  `wizardRunThrough.test.ts`/`studioReducer.test.ts` suites are for. Run
  them unchanged; if any test literally constructs
  `{ studio: { totalDays: ... } }` fixtures, update the fixture shape (not
  the assertions).
- **Compatibility layer:** Persistence only - bump `SAVE_KEY`
  (`state/persistence.ts`) per the established pattern (this codebase never
  writes JSON-migration functions; it bumps the key and lets an
  incompatible old save fall back to a fresh studio - see
  `persistence.test.ts`'s existing "old saves migrate safely" suite). Add
  one test there: a save shaped like the *old* (`Studio.totalDays`-nested)
  format is invisible under the new key and falls back cleanly, not a
  crash - the same pattern every prior version bump already has a test for.
- **Risk:** Wide but shallow - a large diff of identical, mechanical edits.
  Good candidate to do with find-and-replace plus a careful read-through,
  not hand-editing each site independently.

### Step 1.2 - Promote rival-studio state to `GameState`

- **What:** `Studio.rivalStudios` / `rivalProductionsInProgress` /
  `rivalFilmsReleased` → `GameState.rivalStudios` /
  `GameState.rivalProductionsInProgress` / `GameState.rivalFilmsReleased`.
  These three already travel together everywhere (always read/written as a
  group via `RivalMarketUpdate`), so promoting them in one step is more
  natural than splitting further.
- **Files:** `types/index.ts`, `state/gameState.ts`,
  `state/studioReducer.ts` (`applyRivalMarketSettlement` and every call
  site), `engine/rivalStudios.ts` (`settleRivalMarket`'s signature - it can
  now take the three lists directly instead of a whole `Studio`),
  `components/Dashboard.tsx`, `components/RivalStudioPage.tsx`,
  `state/selectors.ts` (`computeTopGrossingFilms`, `collectFilmStats` read
  `studio.rivalFilmsReleased` today).
- **Behavior change:** None.
- **New tests:** None new (existing rival-market tests in
  `studioReducer.test.ts` should pass unchanged once fixtures are
  reshaped).
- **Compatibility layer:** Another `SAVE_KEY` bump, same pattern as 1.1.
- **Risk:** Moderate - `engine/rivalStudios.ts`'s public function
  signatures change (no longer take a whole `Studio`), so this touches an
  `engine/` file, which the audit flagged as the one layer to be most
  careful with. Still a pure, mechanical reshape - no formula changes.

### Step 1.3 - Promote `talentPool` to `GameState`

- **What:** `Studio.talentPool` → `GameState.talentPool`. Closes audit
  State Ownership #5 (a shared resource that happened to live on the
  player's own object).
- **Files:** `types/index.ts`, `state/gameState.ts`,
  `state/studioReducer.ts` (every reducer case that reads/updates it -
  `BEGIN_PHOTOGRAPHY`, `ADVANCE_SHOOTING_DAY`, `RESOLVE_EVENT_CHOICE`,
  `RETURN_TO_DASHBOARD`), `engine/rivalStudios.ts`,
  `engine/productionsInProgress.ts`, `components/wizard/HireTalent.tsx`,
  `components/wizard/RoleHiringDrawer.tsx`.
- **Behavior change:** None.
- **New tests:** None new.
- **Compatibility layer:** Another `SAVE_KEY` bump (can be combined with
  1.2's bump into one version if these two steps land close together -
  your call at implementation time, either is fine since the established
  pattern is "reset on any incompatible shape change" either way).
- **Risk:** Low-moderate, same shape as 1.2.

**End of Phase 1 checkpoint:** `Studio` now holds only genuinely
studio-private data - `name`, `cash`, `reputation`. Play the game
end-to-end manually (new studio → full film → release → a rival releasing
something) before moving on - this is the natural point to confirm nothing
regressed before the higher-risk phases begin.

---

## Phase 2 - Consolidate the UI-navigation reset boilerplate

Closes audit State Ownership #3 - `viewingRivalStudioName` and
`viewingProductionId` currently get reset to `null` by hand in eight
separate reducer cases. Fix this **before** Phase 5 adds new
scheduling-related transient view state on top of it, or the boilerplate
triples instead of being fixed once.

### Step 2.1 - One helper for resetting transient view state

- **What:** Introduce a single small helper (e.g.
  `clearTransientView(state): Pick<GameState, 'viewingRivalStudioName' |
  'viewingProductionId'>`) and call it from every case that currently
  hand-resets these two fields, instead of repeating `viewingRivalStudioName:
  null, viewingProductionId: null` at each site. Purely a structural
  cleanup - the *values* produced are identical to today's, just computed
  in one place.
- **Files:** `state/studioReducer.ts` only.
- **Behavior change:** None.
- **New tests:** One small, direct test: for every `GameAction` type not in
  an explicit "preserves view" allow-list (mirroring today's actual
  behavior - most actions clear the view, `VIEW_RIVAL_STUDIO`/
  `VIEW_PRODUCTION`/`VIEW_STATS` deliberately set rather than clear it),
  dispatching it from a state with both view fields set results in them
  being cleared. Cheap to write, and it's the kind of test that would have
  caught a forgotten reset site in the past.
- **Compatibility layer:** None - purely internal to the reducer, no
  persisted shape change.
- **Risk:** Low. Small diff, single file, no external-facing change.

---

## Phase 3 - Introduce the `Project` type (additive, nothing reads it yet)

This is the "expand" half of an expand/migrate/contract migration - the
safest way to introduce a large type change is to add it fully formed,
verified in isolation, before anything depends on it. Nothing in this
phase changes what the game does.

### Step 3.1 - Define the `Project` discriminated union

- **What:** Add the new type(s) to `types/index.ts`, alongside (not
  replacing) `FilmDraft`/`Film`/`RivalProductionInProgress`: a `stage`
  discriminant (`InDevelopment | InProduction | InPostProduction |
  Completed | Scheduled | Released | Finished`, per the domain model
  review's seven-stage collapse) and a tagged union carrying only what's
  true at each stage, plus a shared `id`/`ownerId` on every variant.
- **Files:** `types/index.ts` only.
- **Behavior change:** None - an unused, unreferenced type addition.
- **New tests:** None yet (nothing to test - no logic reads or produces
  this type).
- **Compatibility layer:** None.
- **Risk:** Essentially zero. Good step to get eyes on the target shape
  before anything else changes.

### Step 3.2 - Pure conversion functions, each covered by a round-trip test

- **What:** One pure function per existing shape → `Project`, and back:
  `filmDraftToProject`/`projectToFilmDraft`,
  `filmToProject`/`projectToFilm`,
  `rivalProductionToProject`/`projectToRivalProduction`. These are the
  **only** place that needs to know how the old and new shapes correspond -
  every later phase reuses them instead of re-deriving the mapping.
- **Files:** New file, e.g. `engine/projectConversion.ts` (pure, no
  React/reducer dependency, consistent with the audit's "keep `engine/`
  pure" finding).
- **Behavior change:** None - pure functions, not called from live code
  yet.
- **New tests:** Round-trip identity tests: for a representative fixture of
  each existing shape (an in-progress `FilmDraft` at each wizard stage, a
  backgrounded `FilmDraft` with live photography, a finished `Film`, a
  `RivalProductionInProgress`, a rival `Film`), converting to `Project` and
  back reproduces the original exactly. This is also where the "id must
  survive the round trip" invariant - the actual point of this whole
  effort - gets its first, most direct test.
- **Compatibility layer:** None.
- **Risk:** Low - new, isolated, thoroughly unit-testable code with no
  integration surface yet.

---

## Phase 4 - Migrate read-only consumers to a derived `Project` view

Prove the new shape works for real consumers **before** touching the
source of truth or the reducer. Each step here is independently
verifiable by looking at a screen and confirming it renders identically.

### Step 4.1 - A derived, non-persisted `Project[]` selector

- **What:** `state/selectors.ts` gains `deriveProjectsView(state):
  Project[]` - built from the existing `draft` / `Studio.productionsInProgress`
  / `Studio.filmsReleased` / `rivalProductionsInProgress` /
  `rivalFilmsReleased`, via Phase 3.2's conversion functions. **Not stored
  anywhere** - computed fresh on read, same "derive, don't duplicate"
  discipline the audit praised `selectors.ts` for already having. This is
  the temporary compatibility layer for this whole phase: it lets
  new-shape-consuming code work against the still-old storage.
- **Files:** `state/selectors.ts`.
- **Behavior change:** None.
- **New tests:** For a fixture `GameState` containing one of each kind
  (live draft, a backgrounded production, a released film, a rival film),
  `deriveProjectsView` returns one `Project` per input with the right
  `stage`/`ownerId`, and its output for the "released" subset matches what
  `collectFilmStats` produces today (a direct before/after equivalence
  check).
- **Compatibility layer:** `deriveProjectsView` itself **is** the
  compatibility layer - explicitly temporary, deleted in Phase 5 once
  `projects` becomes the real field it can just return directly.
- **Risk:** Low - additive, one new function, nothing else changes yet.

### Step 4.2 - Migrate the Stats page

- **What:** `components/StatsPage.tsx` and its `selectors.ts` helpers
  (`collectFilmStats`, `collectStudioStats`, `collectPersonStats`) read
  from `deriveProjectsView` instead of directly flattening
  `filmsReleased`/`rivalFilmsReleased`.
- **Files:** `state/selectors.ts`, `components/StatsPage.tsx`.
- **Behavior change:** None - output should be pixel-identical.
- **New tests:** Extend `selectors.test.ts` to assert the Stats-page
  aggregation functions produce identical output whether fed the old
  direct-array input or `deriveProjectsView`'s output, for the same
  fixture state.
- **Compatibility layer:** Relies on 4.1's, no new one.
- **Risk:** Low - Stats page is read-only and easy to visually diff
  before/after.

### Step 4.3 - Migrate Dashboard's read-only displays

- **What:** The running-films list, the background-production cards, and
  the Rival Studios panel (`components/Dashboard.tsx`) read from
  `deriveProjectsView` for *display* purposes. Their action buttons (View,
  Finish Principal Photography, etc.) keep dispatching the existing
  actions unchanged for now - only the read/render path moves.
- **Files:** `components/Dashboard.tsx`, `components/common/TopGrossingPanel.tsx`.
- **Behavior change:** None.
- **New tests:** Manual/Playwright smoke pass (per this project's `verify`
  skill) confirming the Dashboard renders identically for a state with a
  running film, a backgrounded production, and a rival's release.
- **Compatibility layer:** None new.
- **Risk:** Low-moderate - the most visually complex screen, worth an
  actual browser check rather than reasoning about it in the abstract.

### Step 4.4 - Migrate remaining read paths: `FilmDetailModal`, `RivalStudioPage`, `Inbox`

- **What:** Same move for the remaining components that read
  `filmsReleased`/`rivalFilmsReleased`/`productionsInProgress` directly.
- **Files:** `components/common/FilmDetailModal.tsx`,
  `components/RivalStudioPage.tsx`, `components/common/Inbox.tsx` (its
  *read* path only - `awaitingChoice`/`finished` filtering; its dispatches
  stay as-is until Phase 6).
- **Behavior change:** None.
- **New tests:** Manual smoke pass, same as 4.3.
- **Compatibility layer:** None new.
- **Risk:** Low.

**End of Phase 4 checkpoint:** every screen that only *reads* film/project
data now goes through `deriveProjectsView`. Nothing writes through it yet -
that's Phase 5. This is the point to do a full manual playthrough again;
every screen should look and behave exactly as before.

---

## Phase 5 - Flip the source of truth (the highest-risk phase)

This is the one phase that can't be split further without introducing a
genuinely inconsistent intermediate state inside the reducer itself (every
case has to agree on the shape at once). Everything before this phase
exists to make this step as narrow as possible when it arrives.

### Step 5.1 - `GameState.projects: Project[]` + `focusedProjectId` become the real, persisted fields; rewrite the reducer

- **What:** `GameState` gains `projects: Project[]` (world-level, each
  entry's `ownerId` distinguishing the player from each rival) and
  `focusedProjectId: string | null` (replacing `draft`'s old dual role of
  "storage" and "which one is currently being driven through the wizard" -
  now just a pointer into the shared array). Every reducer case
  (`START_NEW_FILM`, `GO_TO_STEP`, `SELECT_SCRIPT`, `BEGIN_PHOTOGRAPHY`,
  `ADVANCE_SHOOTING_DAY`, `RESOLVE_EVENT_CHOICE`, `FINISH_PHOTOGRAPHY`,
  `RESUME_FOR_POST_PRODUCTION`, `RELEASE_FILM`, `RETURN_TO_DASHBOARD`,
  `ACKNOWLEDGE_BOX_OFFICE_RESULTS`) is rewritten to read/write `projects`
  by id instead of `draft`/`Studio.productionsInProgress`/
  `Studio.filmsReleased`. `deriveProjectsView` (4.1) collapses to
  effectively `state.projects` and can be deleted once nothing else calls
  it (fold its callers over to read `state.projects` directly in this same
  step, or immediately after).
- **A concrete, welcome side effect worth calling out explicitly:** this
  step also **fixes audit Reducer findings #`RESOLVE_EVENT_CHOICE`/
  `FINISH_PHOTOGRAPHY`'s duplicated productionId-vs-draft branches** for
  free - there's only one storage location to operate on now, so the "is
  this the live draft or a backgrounded entry" branch disappears entirely.
  It also removes the need for `FilmDraft.furthestStepIndexCharged`'s
  awkward inference role (audit State Ownership #4) - "has this stage's
  cost been charged" becomes "has this Project already moved past this
  stage," answerable directly from `stage`.
- **Files:** `types/index.ts` (finalize `Project`, remove `FilmDraft`/
  `Film`/`RivalProductionInProgress`'s old standalone status once
  superseded - or keep them as internal payload shapes *inside* the
  union's variants if that reads more cleanly; either is fine, this is an
  implementation-time call), `state/gameState.ts`,
  `state/studioReducer.ts` (the largest single-file change in this
  roadmap), `engine/projectConversion.ts` (likely shrinks - some
  conversions may no longer be needed once nothing round-trips through the
  old shapes), `state/selectors.ts` (drop the now-redundant
  `deriveProjectsView`).
- **Behavior change:** None intended - every charge, every screen
  transition, every settlement should fire at exactly the same point as
  before. This step's entire job is "same behavior, correct shape."
- **New tests:** This is where the roadmap's most important regression
  test lives: **a project's `id` is identical from `START_NEW_FILM` through
  release and into `Finished`** - the direct, end-to-end proof that audit
  Identity #1 is actually fixed, not just reshuffled. Beyond that: the
  full existing `wizardRunThrough.test.ts` and `studioReducer.test.ts`
  suites must pass with only *fixture construction* changed, never an
  assertion changed (if an assertion needs to change to pass, that's a
  signal behavior drifted, not that the test was wrong). Also add: "every
  entry in `state.projects` has a unique id," "exactly one project can have
  a given id at a time" (no accidental duplication across stages).
- **Compatibility layer:** Persistence - bump `SAVE_KEY` again (same
  established pattern). No in-code compatibility layer is introduced by
  this step itself; Phase 6 is where the *remaining* write-path UI
  temporarily keeps calling old-shaped dispatch actions against the new
  reducer internals (see below).
- **Risk:** High - this is the phase to slow down for. Practical
  de-risking: migrate one reducer case at a time internally, running the
  full test suite after each case, even though it likely lands as one
  reviewed commit/PR (an in-progress state where half the cases read the
  old fields and half read the new ones won't compile cleanly against a
  single `GameState` shape, so this has to be developed as one continuous
  effort even if it's reviewed as one unit - the safety comes from the test
  suite, not from further splitting).

### Step 5.2 - Delete the now-dead old fields and types

- **What:** Remove `GameState.draft`, `Studio.productionsInProgress`,
  `Studio.filmsReleased`, `Studio.rivalProductionsInProgress`,
  `Studio.rivalFilmsReleased` (already promoted off `Studio` in Phase 1,
  now removed entirely in favor of `projects`), and any now-unreferenced
  conversion functions.
- **Files:** `types/index.ts`, `state/gameState.ts`.
- **Behavior change:** None - if the compiler finds no remaining
  references, this step is a pure cleanup confirming 5.1 was complete.
- **New tests:** None new - a clean compile *is* the test here.
- **Compatibility layer:** None - this step exists to remove the last of
  Phase 4/5's temporary scaffolding.
- **Risk:** Low, mechanical, and self-verifying (the compiler will refuse
  to let this land if anything was missed).

---

## Phase 6 - Migrate the remaining write-path UI, then remove all scaffolding

Everything that still *dispatches* against the assumption of a single
`draft` slot (rather than an explicit project id) gets updated. Grouped by
how tightly related each cluster of screens is, not one step per file.

### Step 6.1 - Wizard screens' dispatches gain an explicit project id

- **What:** `DevelopFilm.tsx`, `HireTalent.tsx`, `ProductionPlanning.tsx`,
  `PostProduction.tsx`, `MarketingRelease.tsx` currently assume "the
  action always targets the one live draft." They now read
  `state.focusedProjectId` and include it explicitly in each dispatch
  (most reducer cases can default to `focusedProjectId` when a project id
  isn't given, keeping most call sites unchanged - only the ones that need
  to target a *different* project, per Phase 7, need to pass one
  explicitly).
- **Files:** The five wizard screens listed above.
- **Behavior change:** None.
- **New tests:** Existing wizard-flow tests should pass unchanged.
- **Compatibility layer:** None remaining after this step.
- **Risk:** Low-moderate - mostly mechanical, same shape as Phase 1's
  sweeps.

### Step 6.2 - `ProductionRun.tsx` and `Inbox.tsx`'s write paths

- **What:** These already partially support "the live draft vs. a
  backgrounded production" via `productionId`/`viewingProductionId` - now
  both paths are the same code, since every project (focused or not) lives
  in the same array. This is where the `viewingProductionId` vs.
  `focusedProjectId` distinction either collapses into one concept or is
  confirmed to still earn its keep (see the calendar-review note on this) -
  a genuinely open, small design call to make at implementation time, not
  earlier.
- **Files:** `components/wizard/ProductionRun.tsx`,
  `components/common/Inbox.tsx`, `components/common/OnSetDecisionCard.tsx`.
- **Behavior change:** None.
- **New tests:** Existing background-photography tests should pass
  unchanged.
- **Compatibility layer:** None remaining.
- **Risk:** Low-moderate.

### Step 6.3 - Full regression pass

- **What:** No code change - a dedicated verification step. Full automated
  suite, plus a manual playthrough touching every screen (new studio,
  develop → release, a second film backgrounded while the first is still
  running, a rival releasing, the Stats page, `FilmDetailModal`, the Inbox,
  a save/reload).
- **Files:** None.
- **Behavior change:** None (that's what's being verified).
- **New tests:** None new - this step exists to run everything added since
  Phase 0 together, once, as a whole.
- **Compatibility layer:** N/A.
- **Risk:** N/A - this step's entire purpose is reducing risk in
  everything that follows.

**End of Phase 6 checkpoint: the domain-model refactor is complete.**
Everything from here is the calendar/release *feature* itself, built on a
foundation that no longer fights it.

---

## Phase 7 - The calendar and release-scheduling feature

Matches the milestone sequence from `DESIGN_REVIEW_calendar_and_release.md`,
renumbered to slot in after the foundation work. Each of these **does**
introduce new behavior (that's the point of this whole roadmap) - marked
explicitly.

### Step 7.1 - Add `Completed`/`Scheduled` stages (already scaffolded)

- **What:** These two stages already exist in the `Project` union from
  Phase 3 - this step is only the reducer logic that produces and consumes
  them: post-production's exit stops going straight to marketing/release,
  producing a `Completed` project instead.
- **Files:** `state/studioReducer.ts`, `state/gameState.ts` (new
  `GameAction` variant), a new `MarketingRelease.tsx`-adjacent screen for
  "you're done - choose how/when to release."
- **Behavior change:** Yes, but narrow - a new intermediate stage appears;
  release still always resolves same-day (no picker yet), so play
  experience is unchanged until 7.2.
- **New tests:** A project reaches `Completed`, then a new
  `SCHEDULE_RELEASE`-equivalent action (still forcing `releaseDay =
  currentDay`) moves it to `Released` producing identical results to
  today's `RELEASE_FILM`.
- **Compatibility layer:** `SAVE_KEY` bump, same pattern.
- **Risk:** Low - the type-level work is already done; this is the
  smallest possible slice that proves the split holds together.

### Step 7.2 - Real future release days + `settleScheduledReleases`

- **What:** The player can pick a day later than today.
  `settleScheduledReleases` joins the existing settlement fan-out
  (`settleBoxOfficeForAllFilms`/`settleRivalMarket`/
  `settleProductionsInProgress`), resolving any `Scheduled` project whose
  day has arrived - the same lazy, catch-up-proven pattern those three
  already use (audit: "keep this pattern, extend it, don't replace it").
  `ReleaseWindow` switches from a picker to `deriveReleaseWindow(releaseDay)`.
- **Files:** New `engine/scheduledReleases.ts`, `state/studioReducer.ts`
  (every calendar-advancing case gains the fourth settlement call),
  `data/release.ts` (window derivation), the new release-scheduling screen
  (date picker).
- **Behavior change:** Yes - this is the actual feature. Player-visible:
  can hold a film for later, `ReleaseWindow` is now a consequence of
  timing, not a free choice.
- **New tests:** Mirror `boxOfficeRun.test.ts`'s existing "big jump matches
  many small ticks" test, applied to `settleScheduledReleases`. Also:
  scheduling a release for a day 40 in the future and dispatching
  `ADVANCE_DAY` 40 times resolves it exactly once, on the right day, with
  the right derived window.
- **Compatibility layer:** None beyond the routine `SAVE_KEY` bump.
- **Risk:** Moderate - new simulation-adjacent logic, but built on an
  already-proven pattern and an already-unified `Project` type.

### Step 7.3 - Confirm multi-project concurrency (largely already true)

- **What:** Because `projects` has been a flat, world-level array since
  Phase 5, several `Completed`/`Scheduled` projects coexisting is *already*
  representable - there's no single-slot bottleneck left to remove. This
  step is mostly UI: letting the Dashboard show more than one
  completed-and-waiting or scheduled film at once, and confirming
  `focusedProjectId` correctly lets the player switch which one they're
  actively driving through the wizard.
- **Files:** `components/Dashboard.tsx`.
- **Behavior change:** Yes, but small - a UI capability, not new
  simulation logic.
- **New tests:** A state with two `Completed` and one `Scheduled` project
  simultaneously renders and behaves correctly (manual/Playwright).
- **Compatibility layer:** None.
- **Risk:** Low - this is the payoff of Phase 5 being done properly; if
  this step turns out to need real reducer changes, that's a signal Phase
  5 left something single-slot that should be revisited.

### Step 7.4 - Rivals read and react to the shared schedule

- **What:** `startRivalProduction`'s release-day choice starts reading
  `state.projects` (filtered to `Scheduled`) instead of picking a day in a
  vacuum.
- **Files:** `engine/rivalStudios.ts`.
- **Behavior change:** Yes - rival behavior changes (the actual point).
- **New tests:** A rival avoids (or, in a richer version, deliberately
  targets) a day already crowded with scheduled releases.
- **Compatibility layer:** None.
- **Risk:** Moderate - `engine/rivalStudios.ts` again, same care as
  Phase 1.2.

### Step 7.5 - Competing-weekend simulation mechanics

- **What:** Decide what actually happens when multiple releases land the
  same week - new, genuinely novel simulation design (contested audience
  pools or a softer shared-attention penalty), not a refactor.
- **Files:** `engine/audienceSimulationStep.ts` and friends - deliberately
  the last phase to touch the audience-simulation engine, and worth
  explicitly *not* starting until the box-office tuning work already in
  flight (per the current uncommitted `scoring.ts`/`genreWeights.ts`/
  `scoringWeights.ts` work) has landed, to avoid two people's changes
  colliding in the same formulas.
- **Behavior change:** Yes - new simulation behavior, the final feature in
  this arc.
- **New tests:** New scenario tests in the same style as
  `audienceSimulationScenarios.test.ts`/`audienceSimulationRegressionMatrix.test.ts`.
- **Compatibility layer:** None.
- **Risk:** Highest of any step in Phase 7, correctly saved for last -
  depends on everything above already working.

---

## Summary table

| Phase | Behavior change? | Riskiest step | Compatibility layer |
|---|---|---|---|
| 0 - Safety net | Yes (bug fix only) | none | none |
| 1 - Promote world state | None | 1.2 (`engine/` signature change) | `SAVE_KEY` bumps |
| 2 - Consolidate nav state | None | none | none |
| 3 - Introduce `Project` type | None | none | none |
| 4 - Migrate read consumers | None | 4.3 (Dashboard) | `deriveProjectsView` (deleted end of Phase 5) |
| 5 - Flip source of truth | None (intended) | 5.1 | `SAVE_KEY` bump |
| 6 - Migrate write-path UI | None | none | none remaining after |
| 7 - Calendar/release feature | **Yes, throughout** | 7.5 | routine `SAVE_KEY` bumps |

Phases 0-6 are the "pay down the audit's findings" work - by design, a
player should not be able to tell the difference before and after. Phase 7
is the feature you originally set out to build, and is now the *easy* part
because nothing in it has to fight the storage model any more.
