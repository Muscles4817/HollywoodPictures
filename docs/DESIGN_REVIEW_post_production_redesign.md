# Design Review: Post-Production Redesign — Estimates, Trade-offs, Not a Second Live Process

Status: **Phases A-C shipped**, plus a post-B architecture cleanup pass
(§Phasing's own table) - the post-production duration estimate exists, is
computed once at `FINISH_PHOTOGRAPHY`, and the test screening it triggers is
a real pending decision (§2), reusing the on-set pending-choice machinery
end to end. The field it all hangs off was renamed
`postProductionScreeningReadyDay` during Phase B (see §1's own update) - it
was never actually "estimated completion," it's "when the test screening
happens." The cleanup pass (§1a/§2a/§2b) went further: that field no longer
doubles as "final completion" once resolved either - `postProductionFinalReadyDay`
is now its own explicit field - and the resolved screening's own outcome
moved off `photography.events` onto `FilmDraft.postProductionEvents`, its
own honestly-named home, with its already-charged cost now genuinely
visible in the project finance breakdown instead of a zeroed-out event
hiding it. Phase C (§3/§4) landed as two independent efforts that turned
out to overlap and were reconciled together: this session's own decoupling
work (Marketing reachable independently of post-production completion, the
flat `STAGE_DURATIONS` charges retired) merged with a parallel session's
correctness fix closing a real bug the decoupling work would otherwise have
reopened - a film could previously be scheduled/released before its test
screening ever fired, silently orphaning the decision. See §4's own update
for exactly how the two combined. Phase D (the Post-Wrap Workspace) remains
design only - see its own row below. Round 2 of a two-pass review
(`Post_Production_Redesign_Review.md` was the original proposal; this
supersedes it with the direction agreed after Round 1's pushback against a
second live-simulation system). Builds directly on systems already shipped:
the calendar and Principal Photography as a live process (`docs/DESIGN.md`
5.16), box office as a lazy weekly settlement rather than a dedicated
ticking screen (5.19), the Producer Workspace's free navigation
(`components/projectWorkspace/`), the on-set pending-choice machinery
(`PendingEventChoice`/`EventChoiceTemplate`, `RESOLVE_EVENT_CHOICE`), the
release-scheduling-competition work (`engine/releaseCrowding.ts`,
`MarketingRelease.tsx`), and this session's own Casting Redesign and
trait-derivation work (both examples of "find an existing computed
number/unused stat and give it a real consumer or a natural-language
voice, rather than inventing a new one").

---

## TL;DR

Post-production stops being a single instant form followed by a flat
45-day calendar charge, and does **not** become a second live, ticking
Photography clone. Instead: the moment photography wraps, the game computes
an **estimated completion day** the same way it already estimates shoot
length and pre-production length (`computeRecommendedShootDays`,
`computeRecommendedPreProductionDays`) - reading runtime, Editor skill, VFX
ambition, and VFX Supervisor skill, giving those two crew stats their first
real consumer. That estimate advances lazily off the existing calendar
(`Studio.totalDays`), the same "lazy settlement, not a dedicated screen"
shape box office already proved (5.19) - no new day-by-day loop. **Marketing
choices decouple from post-production entirely** and become settable any
time after wrap, reusing `MarketingChoices` exactly as it already exists
(it was never actually coupled to `postProductionChoices` in the type
system - only in wizard step order). When the estimate's day arrives, a
**Test Screening fires as a pending decision** structurally identical to an
on-set event (`PendingEventChoice`/`EventChoiceTemplate` already has
`costRange`/`qualityRange`/`delayDaysRange` per choice - exactly the shape
"Re-edit costs X, gains Y quality, costs Z days" needs, with zero new
fields), surfaced with real qualitative language by calling the *existing*
`engine/reviews.ts:pickDepartmentBlurb`/`data/reviewBlurbs.ts` machinery
early instead of only at release. Whatever the player picks feeds a new
completion estimate, which the player then has to reconcile against
whatever release window they'd been eyeing - reusing the release-scheduling-
competition system (`engine/releaseCrowding.ts`,
`MarketingRelease.tsx`'s own month picker) exactly as built, just fed a
moved date. The whole post-wrap phase gets the same free-navigation
treatment Cast & Crew/Production/Finance already got pre-Greenlight
(`components/projectWorkspace/`) instead of staying a linear wizard.

Net new code is small: one duration formula (mirrors two that already
exist), one new `FilmDraft` field or two, a sibling to
`RESOLVE_EVENT_CHOICE` (not a rewrite of it), and a Post-Wrap Workspace
shell (mirrors one that already exists). Everything else - the quality
math, the blurb library, the crowding calculation, the choice-with-cost/
quality/delay data shape - already exists and is being asked to fire at a
different, earlier moment, not rebuilt.

---

## 0. What currently exists (the baseline this redesign changes)

Confirmed by reading the actual implementation, not assumed from the
original proposal:

- **Post-production is one instant form**, not a process:
  `PostProduction.tsx` sets four fields (`editStyle`, `musicFocus`,
  `testScreeningResponse`, `finalCutFocus`) in a single dispatch, zero
  elapsed time. Leaving the screen charges a flat 45 days
  (`data/schedule.ts:STAGE_DURATIONS`); leaving Marketing charges another
  flat 30. The code's own comment on `STAGE_DURATIONS` says this is
  *deliberate* - "not modeled as anything the player watches happen,
  that's what Principal Photography is for" - from the same milestone
  (5.16) that made Photography live. This redesign is the first real
  reconsideration of that call for the post-wrap phase specifically, not a
  reversal of it for Photography.
- **Quality is already multi-dimensional**, just not along the axes the
  original proposal named. `computeQualityBreakdown`
  (`engine/scoring.ts`) already tracks Script/Direction/Acting/Production/
  Post-Production as separate scores through a real soft-ceiling
  dependency chain (weak Script caps Direction's reach, weak Direction caps
  Acting and "captured footage," Post-Production is bounded by what got
  captured). Critic/Audience/Buzz are three separately-weighted formulas on
  top of that. Nothing here needs to change - it's the substrate everything
  below reads from.
- **The natural-language translation of that breakdown already exists and
  already works**: `engine/reviews.ts:pickDepartmentBlurb` finds the
  weakest or strongest department and returns a real, genre-flavored line
  from `data/reviewBlurbs.ts` ("Pacing is the film's biggest enemy," "A
  genuinely sharp, well-structured screenplay carries the whole film"). It
  is only ever called from `releaseFilm.ts` - after release, for critic
  quotes. Nothing about the function needs to change to make it a test
  screening voice instead; only *when* it's called does.
- **VFX ambition is a pre-shoot budget dial** (`ProductionChoices.vfxAmount`,
  set in Plan Production before Greenlight), not a post-wrap process.
  Editor and VFX Supervisor `skill` are real, hired stats that currently
  feed nothing - the same "waiting for a consumer" situation
  `PersonPersonality`'s fields were in before this session's trait work.
- **The on-set decision machinery already models "a choice with cost,
  quality, and a time cost"**: `EventChoiceTemplate` (`types/index.ts`) has
  `costRange`, `qualityRange`, `buzzRange`, *and* `delayDaysRange` per
  choice, resolved by `resolveEventChoice`/`resolveChoiceOnDraft`
  (`engine/production.ts`) and dispatched via `RESOLVE_EVENT_CHOICE`. This
  is, structurally, already "Release As-Is / Re-edit / Pickups / Major
  Reshoots" - a set of choices trading cost and delay for a quality
  outcome. `RESOLVE_EVENT_CHOICE`'s guard clause is hard-wired to
  `target.photography.pendingChoice`, though, so this needs a sibling
  reducer case reading the same helper functions against a different
  field, not a hijack of the existing one.
- **Release-day selection already has real depth**: month/year picking,
  `engine/releaseCrowding.ts:computeCompetitiveCrowding`, hold-vs-bring-
  forward, all live in `MarketingRelease.tsx` today - but strictly *after*
  Post-Production in a linear `GO_TO_STEP` wizard, and computed once
  against whatever the release day happens to be at that moment.
- **The Producer Workspace already proved the exact transition this
  redesign wants for the post-wrap phase**: Cast & Crew/Production/Finance
  used to be a linear wizard and are now free-navigation sections of one
  shell (`components/projectWorkspace/ProjectWorkspace.tsx`,
  `ProjectWorkspaceNav.tsx`) reading/writing the same `FilmDraft`. Nothing
  about post-production/marketing/release structurally requires the old
  linear order any more than Cast & Crew did - it was linear because the
  wizard was linear, not because the work is.
- **The lazy-settlement pattern already exists and is proven at scale**:
  box office replaced "one number computed the instant Release is clicked"
  with a week-by-week run the player watches happen *without* a dedicated
  ticking screen (`docs/DESIGN.md` 5.19 - "lazy weekly settlement, not a
  dedicated ticking screen," still the accurate description of the
  mechanism even after 5.34 changed the formula it drives). Casting calls
  tick the same way, off the same `ADVANCE_DAY` action. This is the
  precedent the redesign leans on to avoid a second Photography clone.

---

## 1. The core reframe: an estimate that advances, not a process that's simulated

The central mechanic, matching the framing from Round 2: **"is improving
this film worth delaying its release?"** - not "manage an editing
timeline."

`computeRecommendedShootDays` and `computeRecommendedPreProductionDays`
already establish the pattern: read a handful of signals (script
complexity, cast size, effects ambition, scale), produce one number, done.
`computeRecommendedPreProductionDays`'s own comment explains exactly why a
*lump-sum estimate* rather than a day-by-day charge is the right shape once
free navigation is in play: "the Producer Workspace's free navigation
between sections has no fixed forward order left to charge calendar time
against incrementally... this replaces that entirely with one scaled lump
sum instead of a flat total for every film." That reasoning applies
identically to post-production once it also becomes free-navigation (§8) -
this is not a new argument, it's the same one that already shipped once.

A new `computeRecommendedPostProductionDays(talent, productionChoices)`
mirrors the existing two functions exactly in shape, reading:

- **Runtime** (`productionChoices.runtimeIntensity`, already read by
  `computeRecommendedShootDays`).
- **Editor skill** (`getCrewCareer(editor, 'Editor')?.skill` - first real
  consumer of this stat anywhere in the engine).
- **VFX ambition** (`vfxT(productionChoices.vfxAmount)`, already read by
  `computeRecommendedShootDays`/`computeProductionScore`).
- **VFX Supervisor skill**, if one's hired (optional role, same "purely
  additive, works fine without one" shape Casting Director already
  established for casting - no VFX Supervisor just means a wider, less
  favorable spread on the estimate, never a hard requirement).

Computed once, at `FINISH_PHOTOGRAPHY` (the same moment `photography`
transitions to `'finished'`), and stored as a target day:
`FilmDraft.postProductionEstimatedCompletionDay: GameDay | null` -
`totalDays + computeRecommendedPostProductionDays(...)`. No day-by-day
state, no events, no tick loop of its own. As `Studio.totalDays` advances
through whatever the player is already doing (ADVANCE_DAY, same mechanism
casting calls and box office already ride), the estimate either has been
reached or hasn't - a pure comparison, not a simulation.

**Shipped (Phase A)**: `engine/production.ts:computeRecommendedPostProductionDays`
sums two independent components - editorial (baseline + runtime, scaled by
Editor skill) and VFX (`vfxT(vfxAmount)` scaled by VFX Supervisor skill, or
a fixed `NO_VFX_SUPERVISOR_MULTIPLIER` when none is hired) - rather than one
blended total, so a great Editor never nonsensically speeds up VFX
rendering nobody skilled is touching, or vice versa. No `script` parameter
(dropped from the signature entirely) - the design review's own "avoid
double-counting complexity runtime/VFX ambition already capture" ruled out
a `script.complexity` term the way the shoot-day/pre-production siblings
have one. Set inside `FINISH_PHOTOGRAPHY` exactly as designed, and shown on
the Post-Production form as an explicitly-labeled "(preview)" forecast card.

**Renamed in Phase B**: `FilmDraft.postProductionEstimatedCompletionDay` is
now `postProductionScreeningReadyDay`. Phase B's own spec caught this before
implementation - the field never meant "the film is ready for release," it
meant "the initial cut is ready for a test screening," and Phase B was about
to grow more consumers of it, so the misleading name got fixed rather than
preserved for compatibility.

**Split further in the post-B cleanup pass**: Phase B's own first cut still
had this field carry a *second*, narrower meaning once the one screening a
film gets had resolved - "when the screening happened" before resolution,
"the revised completion estimate" after. Safe in the sense that nothing
broke (Phase B is scoped to one screening per film), but still a single date
field whose meaning silently depended on whether `testScreeningResolved` was
true - exactly the kind of implicit-state smell worth fixing before Phase C
grew more readers of it. `postProductionScreeningReadyDay` is now a genuinely
fixed historical milestone, set once at `FINISH_PHOTOGRAPHY` and never
touched again; `postProductionFinalReadyDay: GameDay | null` is the new,
separate field `RESOLVE_TEST_SCREENING_CHOICE` sets once, to
`postProductionScreeningReadyDay` plus the resolved choice's `delayDaysDelta`
(zero for Release As-Is). Any future release-readiness check (Phase C) reads
`postProductionFinalReadyDay`, not the screening-day field.

---

## 2. Test Screening as a pending decision, not a menu — **Shipped (Phase B)**

Once `totalDays >= postProductionScreeningReadyDay`, a test screening
becomes available - not as a form the player navigates to (that was the old
model), but as a pending decision, structurally identical to an on-set
event. Shipped essentially as designed below, with the resolutions noted
inline.

- **The qualitative read** (`engine/testScreening.ts:generateTestScreeningPendingChoice`)
  comes from `pickDepartmentBlurb` fed a *provisional* `computeQualityBreakdown`
  - script/direction/acting/production scores are all knowable at this
  point, but `postProductionScore` itself needs a placeholder, since the
  whole point is the player hasn't locked those choices in yet. Reads the
  new shared `DEFAULT_POST_PRODUCTION_CHOICES` (`data/postProduction.ts`)
  as that placeholder - one exported constant, not a locally duplicated
  default, used identically by the real Post-Production form, this
  provisional read, and (later) Phase C's marketing-buzz preview.
- **The decision itself** is `EventChoiceTemplate[]` with four entries -
  Release As-Is / Re-edit / Pickups / Major Reshoots - `costRange`,
  `qualityRange`, `delayDaysRange` (added onto `postProductionScreeningReadyDay`
  itself), and `buzzRange`. Release As-Is is the zero-cost, zero-delay,
  zero-quality-change baseline, retiring `TEST_SCREENING_PROFILES.Ignore`
  and the old single-dropdown `testScreeningResponse` field entirely (both
  removed from `PostProductionChoices`/`data/postProduction.ts`). Re-edit,
  Pickups, and Major Reshoots are calibrated as a genuine cost/delay/risk
  ladder - see the completion report for the exact ranges - with Major
  Reshoots deliberately the only one carrying real downside risk (a
  negative quality floor), so affording it is never the mathematically
  obvious pick. All three are `skillSensitive`, reusing
  `prepareChoicesForInvolvedTalent`/`talentSkillScore` (now exported from
  `engine/production.ts`) against the film's Editor.
- **Resolution**: `resolveEventChoice` is reused as-is for the roll math.
  `resolveChoiceOnDraft` turned out to be genuinely non-reusable once
  actually read (hard-wired to `photography` mid-shoot semantics -
  advances `daysElapsed`, expects `status: 'awaiting-choice'`), confirming
  the design review's own prediction - a new `RESOLVE_TEST_SCREENING_CHOICE`
  reducer case applies the outcome instead, with one deliberate deviation
  from on-set events: the resolved cost is charged **immediately** against
  `studio.cash` (gated by affordability, the same shape `GREENLIGHT_PROJECT`
  already uses), not deferred to `RELEASE_FILM` the way on-set event costs
  and the old `testScreeningResponse` fee both were - seeing a real charge
  land the moment a $2-4.5M Major Reshoots gets picked reads as more honest
  than a silent promise to pay later. The resolved `ProductionEvent` lives
  on its own `FilmDraft.postProductionEvents` collection (post-B cleanup -
  see below; originally appended to `photography.events` with `costDelta`
  zeroed, a misleading reuse this pass retired) so its quality/buzz swing
  still flows through the existing `computeQualityBreakdown` pipeline - no
  parallel scoring path, just a second, honestly-named source feeding the
  same one. `testScreeningResolved: boolean` (new `FilmDraft` field) is the
  explicit guarantee behind "one screening per film" - without it, `totalDays`
  staying past `postProductionScreeningReadyDay` forever (a fixed date, once
  crossed, always crossed) would otherwise regenerate a pending choice on
  every later calendar tick.

### 2a. Post-B cleanup: `postProductionEvents`, not `photography.events`

Phase B's first cut appended the resolved test-screening event straight
onto `photography.events`, with `costDelta` zeroed to avoid double-charging
a cost that was actually paid immediately. Workable, but the domain state
was lying: that array means "what happened during the shoot," and a test
screening happens after `photography.status` is already `'finished'`. Fixed
by giving it a proper home:

- **`FilmDraft.postProductionEvents: ProductionEvent[]`** (and the parallel
  `Film.postProductionEvents` once released) - same `ProductionEvent` shape
  reused verbatim (`id`/`description`/`severity`/`costDelta`/`qualityDelta`/
  `buzzDelta`/`delayDaysDelta`), just stored separately. Empty until the
  screening resolves; at most one entry, same one-screening-per-film scoping
  as everything else here. `RESOLVE_TEST_SCREENING_CHOICE` appends the
  **real**, non-zeroed resolved event here now - the double-charge risk that
  used to justify zeroing it is handled by keeping this collection separate
  from `photography.events` entirely, not by lying about the event's own
  cost.
- **`engine/scoring.ts:combineProductionEvents(photographyEvents, postProductionEvents)`**
  is the one new function this required - a plain concatenation, not a new
  scoring formula. Every caller that wants quality/buzz to reflect both
  on-set and post-production events (`engine/releaseFilm.ts:computeReleaseResults`,
  `engine/testScreening.ts`'s own provisional read, `components/dev/OutcomeInspector.tsx`'s
  dev-calibration recompute) combines the two collections before calling the
  *same*, unmodified `computeQualityBreakdown`/`computeBuzzScore`/
  `computeEventsScore` - none of those three functions changed at all.
  Cost is deliberately **not** combined this way anywhere: a resolved
  intervention's cost is charged immediately, not deferred like an on-set
  event's, so cost-summing callers (`computeEventsCostDelta` at
  `RELEASE_FILM` time) read the two collections separately, on purpose.
- **Reporting vs. charging, kept honestly separate**: `computeReleaseResults`
  now folds `computeEventsCostDelta(postProductionEvents)` into
  `productionCost`/`totalCost`, purely so a film's *reported* total cost is
  its true all-in cost regardless of when each piece was actually charged
  (the same reason already-charged talent/production/contingency costs are
  still summed into `productionCost` too). This does **not** charge cash a
  second time: `engine/marketSettlement.ts:resolvePlayerRelease`'s own
  `alreadyCharged` calculation includes the exact same
  `computeEventsCostDelta(postProductionEvents)` term, so the amount
  actually deducted at settlement (`results.totalCost - alreadyCharged`)
  nets out identically whether or not an intervention resolved - see
  `marketSettlement.test.ts`'s dedicated coverage. `state/selectors.ts:computeProjectSpendSoFar`
  (the project finance breakdown) gained the same term directly, so the
  cost is visible pre-release too, not just folded silently into a released
  film's `results.totalCost`. `computeCommittedSpend` (the *not-yet-in-cash*
  preview used by `BudgetTracker`/`HireTalent`/`ProductionPlanning`)
  deliberately does **not** gain this term - an immediately-charged cost is,
  by that function's own existing logic, already a real cash movement, not
  a projection, the same reason it already excludes talent/production/
  contingency once `photography` exists.
- **UI**: `components/common/FilmDetailModal.tsx` gained a
  `PostProductionEventsSection`, distinct from the existing `EventsSection`
  ("On-Set Events" vs. "Test Screening Outcome") - satisfies "the UI can
  distinguish the type of intervention where appropriate" without merging
  the two into one ambiguous list. `components/wizard/PostProduction.tsx`'s
  forecast card also now has a resolved-state sibling showing
  `postProductionFinalReadyDay` once set, so the field's only real consumer
  isn't otherwise invisible.
- **Firing**: hooked into a new `checkTestScreeningReadiness` helper
  (`state/studioReducer.ts`), applied to the focused draft and every
  backgrounded one at each of the calendar-advancing reducer cases
  (`ADVANCE_DAY`, `GO_TO_STEP`, `GREENLIGHT_PROJECT`, `ADVANCE_SHOOTING_DAY`,
  `RESOLVE_EVENT_CHOICE`, `SCHEDULE_RELEASE`) - the same per-draft-tick
  shape `tickCastingCalls` established for Casting Redesign Phase B, just
  applied more broadly (every site, not just `ADVANCE_DAY`) since a
  screening firing on time matters more than a casting call's own
  real-time-only precedent.
- **Surfacing**: exactly the shape predicted - `Inbox.tsx`'s existing
  `awaitingChoice` category now picks either `photography.pendingChoice` or
  `testScreeningPendingChoice` per production (`engine/project.ts:deriveInboxItems`
  widened accordingly, since a pending screening can coexist with
  `postProductionChoices` already being set), and the Dashboard's activity
  feed/project rows get a dedicated "Decision required" read for it.
  `OnSetDecisionCard` itself needed exactly one small addition - an
  optional `pausedMessage` prop overriding its "Filming is paused..." line,
  since a test screening fires after photography has already wrapped.

Choosing Major Reshoots does **not** reopen live Photography, exactly as
designed - it's a larger entry in the same choice table, resolved the same
instant way every other event choice already resolves.

---

## 3. Decoupling Marketing — **Shipped (Phase C)**

`MarketingChoices` was never actually coupled to `postProductionChoices`
in the type system - the coupling was entirely in wizard sequencing
(`currentScreenFor`, `WIZARD_STEP_ORDER`) and the linear `GO_TO_STEP` flow.
Shipped as designed, via a genuinely new navigation layer rather than
restructuring the wizard's own step order:

- **`components/common/WizardSteps.tsx`** - used to be a purely visual step
  indicator (`<span>`s, no click behavior). Now self-contained (fetches its
  own state via `useStudio()`, the same pattern `BudgetTracker.tsx` already
  established inside the same `WizardHeader` composition) and renders a
  reachable step as a real `<button>` dispatching `GO_TO_STEP` directly.
  `state/selectors.ts:deriveReachableWizardSteps` is the one new derivation
  behind it: `'production'` is always reachable; `'post-production'` and
  `'marketing'` both become reachable the moment photography finishes,
  independent of whether `postProductionChoices` is locked in - exactly
  the decoupling this section asked for. `'results'` is never included -
  it's only ever reached by `SCHEDULE_RELEASE` actually resolving a
  release, never by jumping there ahead of that.
- **`STAGE_DURATIONS.post-production`/`.marketing`** - retired
  (`data/schedule.ts`, now an empty, still-typed constant) for the reason
  this section originally gave: once both stages are freely reachable
  rather than sequential wizard-transition boundaries, there's no
  `GO_TO_STEP` "leaving this stage" transition left to hang a flat lump-sum
  charge off of. `GO_TO_STEP`'s own `STAGE_DURATIONS[leavingStage]` lookup
  needed no rewrite - every step now costs nothing to leave, which is
  exactly what an empty lookup table already produces.
- **`engine/rivalStudios.ts`'s own naive release-day pacing** - previously
  summed `STAGE_DURATIONS` directly (a real, if incidental, dependency this
  section didn't originally call out) - now reuses
  `computeRecommendedPostProductionDays` directly, the same formula the
  player's own estimate uses, plus a flat marketing-lead constant kept
  local to that file. Otherwise a rival's own naive pacing would have
  silently collapsed to zero the moment `STAGE_DURATIONS` was retired.
- The provisional-buzz-during-marketing wrinkle this section flagged
  (`computeBuzzScore` reading `postProductionChoices.musicFocus`/
  `finalCutFocus` before they're genuinely locked in) turned out to have no
  live manifestation to fix - `PostProduction.tsx`'s own mount-time
  `useEffect` already defaults `postProductionChoices` the moment the
  player first visits it, and Marketing shows no buzz preview today for a
  provisional default to feed in the first place. Left alone; revisit if a
  marketing-buzz preview panel is ever added.

---

## 4. The release-window tension — **Shipped (Phase C), reconciled with a parallel correctness fix**

This is where "is improving this film worth delaying its release" actually
bites. `engine/releaseCrowding.ts:computeCompetitiveCrowding` and
`MarketingRelease.tsx`'s month/year picker with hold-vs-bring-forward
already existed, fully built, from the release-scheduling-competition
work - the tension itself needed no new modeling code, only feeding it the
*current* completion estimate instead of a flat lead time.

**What actually shipped is the union of two independent efforts that
turned out to overlap**: this session's own decoupling work (§3 above) made
Marketing reachable *before* post-production was fully resolved, which
reopened a real bug a parallel session had, separately, just closed -
`SCHEDULE_RELEASE` used to clamp the release day only to `today + a flat
marketing lead time`, never to when post-production actually finishes, so
a film could be scheduled (and release) before its test screening ever
fired. Since the screening only ever fires/resolves for a still-
player-in-progress draft (§2), releasing early silently orphaned the
pending choice - its quality/buzz effect never applied. The two fixes were
reconciled together rather than picking one:

- **`SCHEDULE_RELEASE`'s guard is now the stricter of the two**: `if
  (!d.testScreeningResolved) return state;` - a film cannot be scheduled at
  all until its test screening has actually happened and been answered,
  regardless of how the action was dispatched. This is deliberately
  stronger than this section's own original framing ("push the estimate
  later, see the collision") - closing the orphaned-screening bug takes
  priority over allowing an early commit the game can't actually honor.
- **The release day itself is clamped to `postProductionFinalReadyDay`**
  (guaranteed set once `testScreeningResolved` is true - both fields are
  set together by `RESOLVE_TEST_SCREENING_CHOICE`) rather than a flat
  lead time - a Re-edit/Pickups/Major Reshoots delay is respected exactly
  as this section originally asked.
- **`MarketingRelease.tsx` surfaces the tension inline**, per §3's
  reachability change: visiting Marketing before the screening has
  resolved shows a "Post-Production still underway" card (or, once the
  screening has actually fired, the pending decision itself, rendered via
  the same `OnSetDecisionCard` used everywhere else - resolvable right
  there without navigating away) instead of a bare disabled button. The
  earliest selectable month, and the "Release Film"/"Schedule" button
  itself, both respect the same guard the reducer enforces.

No new tension-modeling code beyond the guard itself; the crowding
calculation is unchanged, just reachable earlier and fed a real,
continuously-current floor instead of a flat constant.

---

## 5. Extending the Producer Workspace to the post-wrap phase

Every mechanic above assumes post-production, marketing, and release
scheduling are freely navigable, not a linear sequence - which is also
what makes the lump-sum estimate the right shape in the first place (§1).
`components/projectWorkspace/` already proved this exact shell pattern
once: `ProjectWorkspaceSection` (a flat union), `ProjectWorkspaceNav` (a
tab bar), and per-section components sharing one `FilmDraft`, replacing
what used to be a linear Develop→Talent→Production→Greenlight wizard.

The natural move is a second instance of the same shell for the post-wrap
phase - new sections (Post-Production Overview, Marketing, Release)
alongside a `currentScreenFor` change so a photography-finished draft
routes to this workspace instead of the old `'post-production'`/
`'marketing'` `WizardStep` screens. This is presentation-layer work
reusing an already-validated pattern, not a new one - the interesting
design question is what "Overview" shows here (completion estimate,
pending test screening if any, current department scores) rather than
whether the shell itself works, which is already answered.

---

## 6. Terminology

Consistent with the Casting Redesign's own terminology pass (§12 there):
player-facing copy should read as producer decisions, not a status page.
"Estimated ready: Day N" rather than a raw countdown; "Push back the
release" rather than "delay incurred"; a test screening surfaces as "the
audience's reaction," its blurb voiced the same way a critic review already
is, not as a dashboard metric changing.

---

## What this deliberately does not touch

- **`computeQualityBreakdown`'s dependency chain, the K-constants, or the
  five department scores themselves** - untouched. Everything here reads
  from that system; nothing here changes what it computes.
- **`data/reviewBlurbs.ts`'s content or `pickDepartmentBlurb`'s logic** -
  called earlier, not rewritten.
- **Principal Photography** - stays the one live, day-by-day process in
  the game. This redesign is explicitly not a second instance of it, even
  for Major Reshoots.
- **The Opportunity Market, casting, or any pre-Greenlight system** -
  unrelated; the Producer Workspace shell being reused is a UI pattern, not
  a shared data dependency.
- **A real distinct "VFX progress" or "Editorial progress" reading** -
  Round 1's Hidden Quality Dimensions idea, and any temptation to give
  Editorial and VFX their own separate completion percentages rather than
  one blended estimate, stays out of scope. One number, like shoot days
  and pre-production days already are.

---

## Challenges, consolidated

1. **The provisional-quality-before-choices-are-locked problem** (§2, §3)
   - needed twice (test screening blurb, marketing buzz), solved once: a
   documented default `PostProductionChoices` stand-in, already the
   literal `DEFAULT_CHOICES` `PostProduction.tsx` ships today.
2. **`RESOLVE_EVENT_CHOICE`'s guard is narrower than the helper functions
   it calls** - a sibling reducer case is needed, and it needs its own
   discipline about not creeping scope into the shoot-specific fields
   (`photography.daysElapsed`) it has no equivalent of.
3. **Where the completion estimate lives if Pickups/Major Reshoots also
   touch `FilmDraft.talent`** - `resolveChoiceOnDraft` already handles a
   recast; a Pickups/Reshoots choice reusing that path needs its
   `delayDaysRange` to land on `postProductionEstimatedCompletionDay`
   specifically, not `photography` (which no longer exists as a mutable
   concept by this point - it's `'finished'` and stays that way).
4. **Marketing's own pacing is a genuinely open question** (§3) - simplest
   default (no separate completion estimate) is recommended, but worth a
   deliberate call rather than an assumption.
5. **Save shape** - `postProductionEstimatedCompletionDay` (or equivalent)
   is new required-once-photography-finishes state; same `SAVE_KEY` bump,
   no migration code, established convention as every other shape change
   in this project.

---

## Phasing

| Phase | Ships | Player-visible behavior change | Risk |
|---|---|---|---|
| **A - Estimated completion, still the old linear flow** ✅ shipped | `computeRecommendedPostProductionDays`; `postProductionEstimatedCompletionDay` set at `FINISH_PHOTOGRAPHY`; Editor/VFX Supervisor skill get their first real read. Old `PostProduction.tsx` form still exists and still works unmodified (same instant `SET_POST_PRODUCTION_CHOICES`, same flat 45/30-day `STAGE_DURATIONS` charges), now showing a clearly-labeled "(preview)" forecast card alongside it rather than being instant. | The estimate is visible and reads real crew skill, but nothing yet forces the player to wait for it - a soft preview of the mechanic before the flow around it changes. | Low - one new formula mirroring two that already exist, one new field, no reducer/UI restructuring. Confirmed: `SAVE_KEY` bumped to v39 with a matching invisibility test, 17 new tests (9 formula, 4 reducer timing/snapshot, 1 persistence, 3 component render), full suite/tsc/oxlint clean. |
| **B - Test Screening as a real pending decision** ✅ shipped, plus a post-B cleanup pass | Field renamed `postProductionScreeningReadyDay` (§1). The four-option choice (§2) replaces `testScreeningResponse`'s single dropdown, fires once the ready day arrives (checked at every calendar-advancing reducer case), uses `pickDepartmentBlurb` for real qualitative feedback against the new shared `DEFAULT_POST_PRODUCTION_CHOICES`, reuses `resolveEventChoice` via a new `RESOLVE_TEST_SCREENING_CHOICE` reducer case (cost charged immediately, not deferred). Inbox/Dashboard/ProductionRun/PostProduction surfacing for a pending test screening; "Continue to Marketing" is blocked while one is pending. **Cleanup pass (§1/§2a)**: split the dual-meaning ready-day field into `postProductionScreeningReadyDay` (fixed) + `postProductionFinalReadyDay` (set on resolution); moved the resolved outcome off `photography.events` onto its own `FilmDraft.postProductionEvents`/`Film.postProductionEvents`, combined back in for scoring via the new `combineProductionEvents`; made the already-charged intervention cost show up in `computeProjectSpendSoFar` and a released film's `results.totalCost` without ever charging it twice. | The moment post-production stops being a form and starts being something that *happens to* the film, with a real decision attached. The cleanup pass is invisible to the player - same numbers, just no more implicit-state field or hidden cost. | Medium, landed as scoped. `resolveChoiceOnDraft` was confirmed non-reusable as predicted. Original: 26 new tests. Cleanup pass added/rewrote 9 more (2 rewritten for the new field/collection, 4 new reducer-level, 3 `marketSettlement`/`selectors` double-charge and scoring-combination coverage) - 718 total in the suite. `SAVE_KEY` bumped to v40 then v41; full suite/tsc/oxlint clean throughout. |
| **C - Marketing decoupled, release-window tension live** ✅ shipped | Marketing reachable independently of post-production completion via a new clickable `WizardSteps` nav (§3); `STAGE_DURATIONS.marketing`/`.post-production` retired; release-window picking reuses the existing crowding UI fed a moving target date, clamped to `postProductionFinalReadyDay` (§4). **Reconciled with a parallel session's fix** closing a real bug the decoupling alone would have reopened - `SCHEDULE_RELEASE` now hard-refuses until `testScreeningResolved`, not just "not currently pending," and `MarketingRelease.tsx` resolves a pending screening inline via `OnSetDecisionCard`. | The core "is this delay worth it" tension actually bites - a Test Screening choice visibly moves the earliest a film can go out, and a film can never skip its screening by scheduling too early. | Medium, landed as scoped. The buzz-provisional-defaults wrinkle turned out to have no live manifestation (no marketing-buzz preview exists yet to feed). 11 new tests (`deriveReachableWizardSteps` x4, `WizardSteps` click-nav x6, rival pacing x1) on top of the merged branch's own 862; one pre-existing test rewritten (the retired 45-day charge assertion); full suite (873) /tsc/oxlint clean. |
| **D - Post-Wrap Workspace** | Post-production/marketing/release get the same free-navigation shell Cast & Crew/Production/Finance already have (§5); `currentScreenFor` routes a finished-photography draft there instead of the old linear wizard steps. | The post-wrap phase finally *feels* like the same kind of screen the pre-Greenlight side already does - a workspace, not a sequence of forms. | Low-Medium - shell pattern is proven; main work is deciding what Overview shows and wiring existing sections into it, not inventing new mechanics. |

Recommended order as listed - each phase is independently shippable and
individually low-risk; C is the one I'd expect to need the most actual
playtesting (it's where the stated design goal - "is improving this film
worth delaying its release" - either lands or doesn't), so I'd want A and B
solid and lived-with before committing to C's exact numbers.
