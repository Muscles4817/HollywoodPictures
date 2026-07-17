# Design Review: Post-Production Redesign — Estimates, Trade-offs, Not a Second Live Process

Status: **Phases A-B shipped** (§Phasing's own table) - the post-production
duration estimate exists, is computed once at `FINISH_PHOTOGRAPHY`, and the
test screening it triggers is a real pending decision (§2), reusing the
on-set pending-choice machinery end to end. The field it all hangs off was
renamed `postProductionScreeningReadyDay` during Phase B (see §1's own
update) - it was never actually "estimated completion," it's "when the test
screening happens." Phases C-D (decoupled Marketing, the Post-Wrap
Workspace) remain design only - see each phase's own row below. Round 2 of
a two-pass review
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
preserved for compatibility. The same field carries a second, narrower
meaning after the one screening a film gets has resolved - see §2's
Resolution bullet below - which is safe specifically because Phase B is
scoped to one screening per film, never a second reading of the same field
under two different questions.

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
  than a silent promise to pay later. The resolved `ProductionEvent` is
  still appended to `photography.events` (with `costDelta` zeroed, since it
  was already charged) purely so its quality/buzz swing flows through the
  existing `computeQualityBreakdown` pipeline - no parallel scoring path.
  `testScreeningResolved: boolean` (new `FilmDraft` field) is the explicit
  guarantee behind "one screening per film" - without it, `totalDays`
  reaching the same (now-advanced) `postProductionScreeningReadyDay` a
  second time would be genuinely ambiguous between "never fired" and
  "already resolved."
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

## 3. Decoupling Marketing

`MarketingChoices` was never actually coupled to `postProductionChoices`
in the type system - `FilmDraft.marketingChoices: MarketingChoices | null`
is independent of `FilmDraft.postProductionChoices: PostProductionChoices
| null` today. The coupling is entirely in wizard sequencing
(`currentScreenFor`, `WIZARD_STEP_ORDER`) and the linear `GO_TO_STEP` flow.
Once photography wraps, Marketing becomes reachable immediately -
`SET_MARKETING_CHOICES` already has no dependency on
`postProductionChoices` existing, so no reducer change is needed there at
all, only navigation.

The one real formula dependency worth naming: `computeBuzzScore` currently
reads `postProductionChoices.musicFocus`/`finalCutFocus` as inputs. If
marketing genuinely starts before those are locked in, buzz building
during that window needs the same provisional-defaults treatment §2's test
screening blurb already needs - not a new problem, the same one, solved
once and reused twice.

Marketing's own flat 30-day charge (`STAGE_DURATIONS.marketing`) should
retire alongside post-production's 45, for the same reason: once it's
reachable independently rather than as a wizard-transition boundary,
there's no `GO_TO_STEP` transition left to hang a lump-sum charge off of.
Whether marketing needs its own estimated-completion-day treatment (a
campaign that "finishes" ramping up) or can stay a simple "set it whenever,
it's active from then on" choice is a real open question - I'd default to
the latter (simplest thing that fits the stated goal) unless playtesting
says a campaign needs its own pacing.

---

## 4. The release-window tension

This is where "is improving this film worth delaying its release"
actually bites, and it's the one piece that needs the least new code of
anything here. `engine/releaseCrowding.ts:computeCompetitiveCrowding` and
`MarketingRelease.tsx`'s month/year picker with hold-vs-bring-forward
already exist, fully built, from the release-scheduling-competition work.
Today they run once, against whatever the release day happens to be at the
point the player reaches the Marketing screen.

Under this redesign, a target release window becomes something the player
can set *early* (as soon as Marketing is reachable, per §3) against the
*current* completion estimate. If a Test Screening decision (§2) pushes
the completion estimate past that target window, the existing crowding
calculation simply gets fed the new date - the player sees, through the
same UI they'd already be using, that their choice now collides with
whatever else is scheduled nearby, or that they've drifted into a weaker
window. No new tension-modeling code; the tension already exists, it's
just currently computed too late to be a real decision (by the time the
old flow reaches Marketing, post-production is already fully resolved).

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
| **B - Test Screening as a real pending decision** ✅ shipped | Field renamed `postProductionScreeningReadyDay` (§1). The four-option choice (§2) replaces `testScreeningResponse`'s single dropdown, fires once the ready day arrives (checked at every calendar-advancing reducer case), uses `pickDepartmentBlurb` for real qualitative feedback against the new shared `DEFAULT_POST_PRODUCTION_CHOICES`, reuses `resolveEventChoice` via a new `RESOLVE_TEST_SCREENING_CHOICE` reducer case (cost charged immediately, not deferred). Inbox/Dashboard/ProductionRun/PostProduction surfacing for a pending test screening; "Continue to Marketing" is blocked while one is pending. | The moment post-production stops being a form and starts being something that *happens to* the film, with a real decision attached. | Medium, landed as scoped. `resolveChoiceOnDraft` was confirmed non-reusable as predicted. 26 new tests (7 generator, 9 reducer firing/resolution, 2 Inbox categorization, 5 component render, 1 persistence, plus 2 UI-decision-blocking) on top of the full existing suite; `SAVE_KEY` bumped to v40; full suite/tsc/oxlint clean. |
| **C - Marketing decoupled, release-window tension live** | Marketing reachable independently of post-production completion (§3); `STAGE_DURATIONS.marketing`/`.post-production` retired; release-window picking reuses the existing crowding UI fed a moving target date (§4). | The core "is this delay worth it" tension actually bites - a Test Screening choice can now visibly threaten a release window the player already committed to. | Medium - mostly sequencing/reachability changes plus the buzz-provisional-defaults wrinkle; the crowding math itself is unchanged. |
| **D - Post-Wrap Workspace** | Post-production/marketing/release get the same free-navigation shell Cast & Crew/Production/Finance already have (§5); `currentScreenFor` routes a finished-photography draft there instead of the old linear wizard steps. | The post-wrap phase finally *feels* like the same kind of screen the pre-Greenlight side already does - a workspace, not a sequence of forms. | Low-Medium - shell pattern is proven; main work is deciding what Overview shows and wiring existing sections into it, not inventing new mechanics. |

Recommended order as listed - each phase is independently shippable and
individually low-risk; C is the one I'd expect to need the most actual
playtesting (it's where the stated design goal - "is improving this film
worth delaying its release" - either lands or doesn't), so I'd want A and B
solid and lived-with before committing to C's exact numbers.
