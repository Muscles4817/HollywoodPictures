# Visual Redesign Roadmap

Status: **Phases 0 and 1 landed; phases 2–6 are planning only.** Turns
`ART_DIRECTION.md` and the nine mockup takes in `docs/design/mockups/` into an
ordered sequence of reviewable steps.

`ART_DIRECTION.md` decides *what the game looks like*. This document decides
*what order we build it in, and how we know each step landed*. When the two
disagree, ART_DIRECTION wins and this file is wrong.

A rendered summary — the measured findings, the build order and the open
decisions, drawn in the game's own DESK register — is published at
https://claude.ai/code/artifact/a3ef19e9-0692-4e19-b311-3d5c6bac44dc
(same convention as the mockup takes). This file stays the authority; that
page is the readable view of it.

---

## 1. Where this actually stands

The palette swap is done, and it did more than change colours — it is worth
being precise about what it bought, because it changes what the remaining work
costs.

### 1.1 Landed

| Piece | Commit | What it means |
|---|---|---|
| Token layer re-skinned | `bfd2bb8` | Warm bone surfaces, hard corners, the three-role type stack, the `.typed` register, an eight-hue badge ramp, both themes — all behind the *existing* custom properties, so ~414 `var()` references re-skinned with no component edits |
| Accent rationed | `65173bd` | `--primary` marks state only (focus, active step, links); bars take a hueless `--bar`; primary buttons fill with ink |
| Title screen | `c9f58e5` | The marquee. The first and so far only SPECTACLE screen |
| Spine tokens | `bfd2bb8` | `--spine`, `--spine-ink`, `--spine-ink-2`, `--spine-line` exist and are themed — but only `MainMenu.css` consumes them. **The chassis they were cut for does not exist yet.** |

The token discipline that came out of this is unusually good and is the single
biggest asset the rest of the plan leans on: **every colour in the app now lives
in one block.** Raw hex outside `index.css` is confined to `PremiereReveal.css`
(19 values, deliberately outside the desk palette and commented as SPECTACLE)
and 13 inline styles in TSX. Nothing else.

### 1.2 Not landed

- **The chassis** (take 09). Navigation today is hub-and-spoke: `Dashboard.tsx`
  carries a bare `.dashboard-subnav` button row (lines 421–427) that is the
  only route to the Asset Library, Release Calendar, Stats, Talent Database,
  IP, Milestones and Awards.
  There is no persistent rail, no slate, no attention queue, no command palette.
  Time lives in a top bar rather than a spine.
- **The one sheet** (§8.4). `ProjectWorkspace.tsx` is a 40-line shell that
  renders one of five tab bodies. The player still cannot see every slot at once,
  which is §4's principles 1 and 2 unfulfilled.
- **The readiness meter.** `engine/projectReadiness.ts` already computes
  per-section status; the UI spends it on a one-character glyph beside a tab
  label.
- **The package's relational shape.** `compatibility.ts`, `pairHistory.ts`,
  `creativeTension.ts`, `directorAppeal.ts` and `relationships.ts` are surfaced
  **only inside `CastingDrawer` and `RoleHiringDrawer`** — at the moment of
  hiring. Close the drawer and the package's relationships become invisible.
  This is exactly what take 06 diagnosed.
- **SPECTACLE** anywhere except the title screen.
- **The DESK pass** on the nine remaining screens.

### 1.3 One measured contradiction

`--radius: 0px` carries this comment:

> Hard corners throughout — see ART_DIRECTION.md. Kept as a token so the
> decision is reversible in one place rather than 78 components.

That is not true today. Counted across `src/**/*.css`:

- **94** hardcoded pixel radii (35 × `999px`, 13 × `6px`, 10 × `99px`, 8 × `8px`,
  8 × `4px`, and a long tail of 1–12px)
- **36** uses of `var(--radius)`

So the "hard corners" decision is roughly **28% enforced**, and changing
`--radius` would move barely a quarter of the app. The pills in particular
(45 sites at 99/999px) are a deliberate-looking pattern that the direction
never sanctioned. This needs a decision, not a silent sweep — see Phase 0.

---

## 2. Three decisions to close before sequencing

These are `ART_DIRECTION.md` §12's open questions. Each one, left open, gets
re-litigated on every screen we touch — which is the specific failure mode that
document exists to prevent.

### 2.1 Does DESK live on newsprint or in a darkened office?

**Recommendation: the question is already answered by shipped code — record it.**
Both themes ship, both are themed at the token level, and take 07 established
that a *system* (rather than a paper object) is the only treatment that can
carry a dark theme at all. So: **DESK is theme-agnostic and both themes are
first-class. SPECTACLE is dark-only** — `MainMenu.css` already hardcodes
`var(--spine)` as its ground in both themes, which is the correct behaviour.

This also retires §5.3's film-stock question as posed. The 80s/90s split maps
onto the registers, not onto a light/dark choice.

### 2.2 How far does package assembly go as one sheet?

**Recommendation: all five sections, with the deep decisions in drawers.**
§8.3's count holds — 16–18 slots against HP2's 20+. The two heaviest sections
(`HireTalent` 665 lines, `ProductionPlanning` 744) do not need rewriting; they
need to become drawer contents behind sheet rows, which is the pattern
`CastingDrawer` (1,156) and `RoleHiringDrawer` (578) already implement.

`ProjectOverview.tsx` (530 lines) is the one that genuinely dissolves: it is
today's stand-in for the sheet, and the sheet replaces it.

### 2.3 What happens to the mockup verdicts table?

`docs/design/mockups/README.md` carries an empty per-take Keep/Reject table.
It was never filled, and take 08's synthesis table has since recorded the
individual moves kept from each take — which is what the verdicts table was for.

**Recommendation: retire it, and say why in its place.** An empty table reads as
work outstanding when the decision it was tracking has already been made
("iterate on 08 rather than adding a tenth direction").

---

## 3. The governing constraint

> **The mockups are a specification, not a source.**

Take 09 is a self-contained HTML file with its own class names (`.spine`,
`.dests`, `.proj`, `.pal`, `.attn-item`) and its own token block. The app has
392 global classes in `index.css`, 19 component stylesheets, and 414 `var()`
references. Porting a take by lifting its markup would fork the design system
into two — the app's and the mockup's — and every subsequent screen would have
to pick a side.

`bfd2bb8` already proved the alternative and it is the method for everything
below: **change the values behind the properties the app already uses, and add
shell primitives only where genuinely new structure appears.** That commit
re-skinned the entire app through one file and needed exactly one component
change (`Money.tsx`, to emit a class the CSS could catch).

Every phase below states which of the two it is doing. If a phase can only be
done by importing mockup markup wholesale, that is a signal the phase is wrong,
not that the constraint is.

---

## 4. Sequencing: the frame before the rooms

The phase order follows one argument.

**Take 09 answers the prior question.** Takes 01–08 each answered "what does *a
screen* look like". 09 answered "what frame do all fourteen screens sit in".
Any per-screen work done before the frame exists gets redone when the frame
lands — the screen's header, its return path, its relationship to time, and its
horizontal budget all change.

**The chassis is the only phase that changes information architecture.** It
makes a project a *context* rather than a peer of "Dashboard", which touches
`Screen`, the reducer's navigation actions, the browser-history wiring in
`App.tsx`, and every test that reaches a screen by clicking Dashboard's button
row. Doing that after nine screen passes means touching those nine screens
twice.

**The chassis is cheaper than it looks.** `Header.tsx` already carries the
clock, the transport, the speed control and a summed attention badge, and
`shouldConfirmResume()` already exists as a tested pure predicate in `App.tsx`.
The spine is a *promotion and relocation* of machinery that is already built and
already tested — not new machinery.

**SPECTACLE is the one phase that can run in parallel.** Those screens are
full-bleed events and should not carry the spine at all, so they have no
dependency on the chassis. If visible payoff is wanted early, Phase 4 is the
phase to pull forward — it is the only one where that is free.

---

## 5. The phases

Each phase states: what, why now, files, how we know it landed, what would make
it wrong.

### Phase 0 — Close the doc/code gap, and make the rules mechanical [DONE]

Small, and it makes every later phase cheaper to review.

**Landed.** All three items, plus two faults found on the way:

- `--radius-pill` added alongside `--radius`; all 94 hardcoded radii swept onto
  one or the other (plus 3 inline `borderRadius` in TSX). One deliberate
  exception remains: PremiereReveal's poster, which is a SPECTACLE object.
- Bars, tracks and meters took `--radius` rather than the pill, on §5's own
  "a value needs no hue" argument extended to shape. The Dashboard's KPI meter
  fill also moved from its categorical hue to the neutral `--bar`; the card's
  3px left rule keeps the hue, because that is the frame.
- **Three undefined tokens whose hardcoded fallbacks were always firing** —
  `--warn`, `--positive` and `--negative` were referenced in
  `ProductionPlanning.tsx` and `ProductionExecutionSummary.tsx` and defined
  nowhere, so a light-theme colour rendered on the dark theme. Exactly the
  fault `bfd2bb8` fixed for `--surface`/`--accent`, three instances it missed.
  Repointed at `--amber`, `--green` and `--red`.
- **One more white-on-accent** in `AssetLibrary.tsx` (`color: '#fff'` over
  `--accent`, near-unreadable on dark, where `--accent` is a light blue).
  `bfd2bb8` caught two of these; this was the third. Now `--on-accent`.
- Four dead indirections (`--compare-rail-width`, `--dashboard-accent`,
  `--dev`, `--success-bg`) collapsed to what already rendered, except the
  rail width, which names a real knob and is now defined at the 320px take 09
  settled on.
- `src/designSystem.test.ts` enforces all of it — five assertions, each
  mutation-tested by injecting its violation and confirming the failure.

Verified: 2,499 tests pass, build clean, lint warnings unchanged at 26, and
all six render states (1440/900/640 × light/dark) inspected in a real browser.

**What:**

1. **Status pass on `ART_DIRECTION.md`.** The document is now behind the code in
   three places: §5's palette is marked "PROPOSED — unvalidated until rendered"
   but has shipped and been rendered; §12 says the typeface pairing is "not yet
   chosen" but Anybody / Schibsted Grotesk / Courier Prime are in `index.html`
   and load-bearing in the token block; §5.3's film-stock question is resolved
   by §2.1 above. Move each PROPOSED→DECIDED with a decision-log line.
2. **Resolve the radius contradiction** (§1.3). Decide explicitly whether pills
   survive the hard-corners rule as a sanctioned exception, then make the token
   tell the truth: either sweep the 94 sites onto `var(--radius)` /
   `var(--radius-pill)`, or change the comment.
3. **A stylesheet validator test.** The same move as `ec14e43`'s corpus
   integrity validators, applied to the design system: assert no raw hex outside
   `index.css`'s token block and an explicit allowlist (`PremiereReveal.css`,
   commented as SPECTACLE), and no raw `border-radius` outside `index.css`. This
   is cheap *because* §1.1 is already true — the test starts green and stays
   green, which is the point.

**Why now:** §11's non-goals are currently prose, and prose does not survive
fourteen screens of implementation. The two that are mechanically checkable
should be checked mechanically before we add nine screens' worth of new CSS.

**Files:** `docs/ART_DIRECTION.md`, `docs/design/mockups/README.md`,
`src/index.css`, a new `src/designSystem.test.ts`, and the CSS files carrying
hardcoded radii.

**Landed when:** the validator passes, and every heading in ART_DIRECTION either
says DECIDED or names a question this roadmap sequences.

**Wrong if:** the validator ends up with a long allowlist. That means the rule
is wrong, not the code.

---

### Phase 1 — The chassis [DONE]

The big structural one. Take 09's spine and take 08's rail, ported through the
token layer.

**Landed.** `components/shell/` — `Spine`, `DestinationRail`, `Slate`,
`CommandPalette`, `Chrome`, and a `destinations.ts` registry that the rail, the
palette and the active-destination reading all read from, so the three cannot
drift. `common/Header.tsx` and `common/TimeTickIndicator.tsx` are gone.

Two things the work changed about the plan:

- **The test churn was not there.** This phase warned it would be the main
  cost. It was not: no test mounts the app shell — every component test renders
  its component directly, and `App.test.ts` only exercises the pure predicates.
  All 2,503 tests passed without an edit. The warning was right to be written
  and wrong on the facts; checking took ten minutes and would have been worth
  it even if the answer had gone the other way.
- **`--header-clearance` was a lie, and the chassis made it a worse one.** It
  was a hand-measured 96px (148px on a phone) for a bar whose own comment
  admitted it "was only ever measured to fit one row at desktop widths". The
  chrome now has at least four heights at any width — the slate appears only
  when something is in flight, the held-clock bar only when a bid is live — so
  `useChromeHeight.ts` measures it with a `ResizeObserver` and publishes the
  real value. The constant survives as the first-paint fallback.

Two bugs found by rendering rather than by reasoning: the slate positioned
itself at a hardcoded `top: 42px` that a wrapped spine invalidated (fixed by
stacking the three bars inside one fixed `.chrome`), and the chassis stylesheet
was appended *after* the 640px media query meant to override it, so the palette
button never hid on a phone — the precise trap `index.css` documents further up
its own file. Every responsive chassis rule now sits at the end of the file.

**What:**

- **Time becomes the spine.** `Header.tsx`'s clock, transport and speed control
  move to a permanent sticky top spine using the `--spine*` tokens that already
  exist for it. Prominence is the change, not function.
- **Destinations move to a left rail** — take 08's `190px 1fr` shell, grouped,
  with the 3px left-border active marker and its ≤900px collapse to a
  horizontal scroller. **Not** take 09's top tab strip, for a measured reason:
  09 renders 8 destinations at abbreviated labels ("Talent", "Calendar",
  "Market", "Stats") and simply omits IP Library and Milestones. The app has
  about eleven, at full length. `.dests` sets `flex-wrap: wrap`, so eleven real
  labels wrap to a second row and displace the content beneath. A vertical list
  scales with N; a horizontal strip does not.

  The two takes only *appear* to conflict here. Take 08 carries the rail and a
  topbar of KPI facts, and has no clock, transport, slate or palette at all;
  take 09 carries the time spine, the slate and the palette, and has no rail.
  The spine is about **time**; the rail is about **destinations**. 09 merged
  the two jobs into stacked bands and had to trim the destination list to make
  them fit, which is the trim showing rather than a design decision. Take both.
- **The slate stays horizontal**, as a strip below the spine. Its cards run
  ~172px minimum and carry stage and state, so they want the width — and
  keeping it on a different axis from the rail is what makes "places" and
  "films in flight" read as two registers rather than one long list.
- **The attention queue moves beside it, and guards Play.**
  `timeCriticalUnreadBidCount()` and `shouldConfirmResume()` stop being a modal
  confirmation and become a visible item that physically sits in front of the
  Play control. Same predicate, same tests — different surface.
- **Two axes.** Studio destinations are one register; the films in flight are
  another, each showing the one fact that matters about it. The slate hides on
  non-project screens.
- **A project becomes a context, not a peer.** This is the load-bearing change
  and the source of most of the risk.
- **A command palette on Ctrl-K.** 1,487 talents is well past the point where
  any menu reaches most of the game.
- **Dashboard's button row retires** — its seven navigation buttons are the
  destination rail's job now.

**Why now:** §4 above. Also, it is the phase that most changes what "one screen"
means, and Phase 2's sheet has to be designed into the horizontal budget the
chassis leaves it — take 09 settled that at `minmax(0,1fr) 320px` inside a
1560px wrap, and that number is only meaningful once the spine and rail are real.

**Method:** mostly *new structure* — this is the one phase that legitimately
adds shell primitives. Everything inside the frame stays on existing tokens.

**Files:** `src/App.tsx` (shell + history wiring), `src/components/common/
Header.tsx` (becomes the spine), a new `src/components/shell/` (spine, rail,
slate, attention queue, command palette), `src/components/Dashboard.tsx`,
`src/index.css`, `src/state/gameState.ts` (navigation actions), `src/types/
index.ts` (`Screen`).

**Budget the test churn explicitly.** Component tests reach screens by clicking
Dashboard's button row. Moving navigation to a rail breaks them, and that should
be a planned line item in the phase rather than a surprise discovered on the
first red run. Expect churn in `Dashboard.test.ts`, `AssetLibrary.test.tsx`,
`AwardsPage.test.tsx`, `MilestonesPage.test.tsx`, `ReleaseCalendar.test.tsx`,
`TalentDatabase.test.tsx`, and the navigation-restore tests in `App`.

**Landed when:** every destination is reachable in one click from anywhere;
the clock is visible on every screen; a time-critical bid visibly blocks Play
without a modal; Ctrl-K reaches a named talent; the full suite is green.

**Wrong if:** the rail becomes a corridor (§3's test), or the spine costs enough
horizontal space that the sheet in Phase 2 no longer fits at 1280px.

---

### Phase 2 — The one sheet

§8.4: the sheet is the map, the drawer is the depth.

**What:** `ProjectWorkspace`'s five tabs become one production sheet showing
every slot and its state — empty, filled, who occupies it, what it cost.
Clicking a slot opens a drawer over the sheet. The **Package Readiness meter**
becomes the sheet's headline, spending `deriveProjectReadiness()` properly for
the first time.

**Why now:** it is the screen that most defines the game, and the expensive half
of it already exists. `CastingDrawer` and `RoleHiringDrawer` *are* the drawer
pattern; `HireTalent` and `ProductionPlanning` become drawer bodies rather than
rewrites; `projectReadiness.ts` is already the meter's data source.
`ProjectOverview.tsx` is the only piece that genuinely dissolves.

**Method:** *new structure* for the sheet; existing components relocated, not
rewritten.

**Files:** `src/components/projectWorkspace/*` (the shell, the nav, Overview),
`src/components/wizard/HireTalent.tsx`, `ProductionPlanning.tsx`,
`src/index.css`, `ProjectWorkspace.css`.

**§8.2 stays true:** execution remains a chronology. `WizardStep` is time
passing, not form steps, and no layout flattens causality. The sheet is the
*package*, not the film's whole life.

**Landed when:** every slot is visible without scrolling at 1440px; empty slots
are shaped, not absent; the meter reads distance-to-done at a glance; the
stacked fallback works at 640px.

**Wrong if:** the sheet needs to scroll to show its own shape, or the 640px
fallback is a scaled-down sheet rather than a stacked one (§8.5 names this
specifically).

---

### Phase 3 — What an empty slot says

The phase with the most *game* value in the whole roadmap, and the easiest to
mistake for polish.

Take 08's synthesis resolved five takes into one line of copy:

> *blocks 3 shooting days · 2 relationships unreadable · offer needed by 30 Sept.*

Three readings of one absence — 03's "what does this block", 06's "relationships
that cannot be read until the part is cast", 05's "an absence with a deadline".

**Why this is not polish:** §1.2 measured it. The relationship engines are
surfaced *only inside the two hiring drawers*. The player sees compatibility,
pair history and creative tension at the instant they hire someone, and never
again. The package's relational shape — where this simulation's actual depth
lives — is invisible on the sheet that is supposed to be the map.

**What:** the three readings on every open slot; take 06's relationship web as a
**toggleable lens on the sheet**, not a screen of its own; take 08's right-hand
side panels; per-person notes on roster rows; take 04's voice rationed to **one
line** ("the desk's read"); take 01's rubber stamp on a greenlit package.

**Method:** presentation over existing engine output. No new simulation.

**Files:** the Phase 2 sheet components, `src/engine/` read-only.

**Landed when:** an uncast supporting role carries all three readings at once,
and the lens toggle draws the web without leaving the sheet.

**Wrong if:** any of the three readings needs a new engine module. They are all
derivable from what `compatibility.ts`, `pairHistory.ts`, `creativeTension.ts`,
`directorAppeal.ts`, `projectReadiness.ts` and the schedule already return —
if one isn't, that is a simulation question and belongs in a different document.

---

### Phase 4 — SPECTACLE

Cheap, Tier 1, high payoff, and **independent of Phases 1–3**. Pull it forward
if visible progress is wanted early; that is free here and nowhere else.

**Screens** (§6): box-office results reveal, awards night, marketing/release,
save-selection poster wall. The title screen is done.

**Rules, from §11:** no more than one neon accent per SPECTACLE screen; these
screens drop the spine entirely (they are events, not places); halation, bloom
and grain are permitted here and **nowhere else**.

**Prior art in the codebase:** `PremiereReveal.css`'s genre posters are already
flagged as SPECTACLE and already sit outside the desk palette — that comment is
the pattern for the whole phase.

**Files:** `wizard/ReleaseResults.css`, `wizard/MarketingRelease.css`,
`AwardsPage.css`, `MainMenu.css` (poster wall), `src/index.css` (a SPECTACLE
token block, if the four screens want more than the spine tokens give them).

**Landed when:** the weekly rhythm §6 describes is real — the player spends
their week on the trade pages and release weekend turns the screen into a poster.

**Wrong if:** SPECTACLE leaks onto a surface with numbers on it. That is §2.3,
and it is the rule the whole two-register system rests on.

---

### Phase 5 — The DESK long tail

Nine screens. This is where an estimate blows out if it is treated as one phase,
so it is a **checklist with a per-screen definition of done**, not a phase.

| Screen | Stylesheet today | Note |
|---|---|---|
| Dashboard | `Dashboard.css` | The exec's desk / trade front page. Loses its nav row in Phase 1 |
| Talent database | `TalentDatabase.css` | Agency headshot files. Interacts with Phase 6 |
| Release calendar | `ReleaseCalendar.css` | Wall planner |
| Asset library | `AssetLibrary.css` | |
| Awards | `AwardsPage.css` | SPECTACLE — belongs to Phase 4 |
| Milestones / stats | `MilestonesPage.css`, none | |
| Opportunity market | **none** | Trade classifieds |
| Projects | **none** | Largely absorbed by Phase 1's slate |
| IP library | **none** | |
| Rival studio | **none** | |

Five screens have no dedicated stylesheet and live entirely on `index.css`
globals. That is good news — they inherited the palette swap for free and may
need nothing but a density and rule-weight pass.

**Per-screen definition of done:** renders correctly at 1440 / 900 / 640px, in
both themes; no ornament on any data surface; figures use `.typed`; tabular
figures where columns align; the validator from Phase 0 stays green.

---

### Phase 6 — Portraits and studio identity

Deferred deliberately. §9.1 ranks the options and picks **framing devices
instead of faces** — monograms or silhouettes inside an era-appropriate frame,
so the absence reads as a style choice. That is Tier 1 and it can wait until the
frame it sits in exists.

Also here: §9's "progression shown in Tier 1, not Tier 3" — grander letterhead,
a changed nameplate, the trade paper moving your studio above the fold. And
§12's open question about whether the studio-logo feature needs a *builder*,
which the poster wall (Phase 4) makes materially more visible and therefore
easier to answer with something rendered.

**Constrained by §10:** do not build portrait or headshot work around real
identities, regardless of which roster is loaded.

---

## 6. What this roadmap does not do

- **No simulation changes.** Phase 3 makes existing engine output visible; if a
  reading needs new simulation, it belongs in a `DESIGN_REVIEW_` doc, not here.
- **No save-compatibility work.** Per `CLAUDE.md`, the game is pre-launch. Bump
  `SAVE_KEY` if a schema changes and move on.
- **No new mockup takes.** `docs/design/mockups/README.md` already recorded the
  decision: iterate on 08 rather than adding a tenth direction.
- **No rename.** §10 requires "Hollywood Pictures" to be renamed before a store
  page exists. That is real and blocking for launch, and it is not a visual
  redesign task.

## 7. Verification discipline

This repository measures rather than asserts — diagnostic harnesses, "verified
in the running app", "measured in a real browser". The visual work should hold
the same line:

- Every phase renders at **1440 / 900 / 640px × light / dark** before it is
  called done. Six screenshots, not a claim.
- The Phase 0 validator runs in the normal suite, so a violation is a red test
  rather than a review comment.
- Phase 1 states its test churn up front and closes it in the same commit.

## 8. Decision log

| Date | Decision |
|---|---|
| 2026-08-25 | Roadmap drafted. Sequencing principle: the frame before the rooms — the chassis precedes all per-screen work because it is the only phase that changes information architecture. |
| 2026-08-25 | The mockups are a specification, not a source: every phase lands through the token layer, per `bfd2bb8`'s method. |
| 2026-08-25 | SPECTACLE (Phase 4) identified as the only phase independent of the chassis, and therefore the only one that can be pulled forward for early visible payoff. |
| 2026-08-25 | Phase 0 landed. Corners route through two tokens; colour and corner rules are enforced by `designSystem.test.ts` rather than by review. |
| 2026-08-25 | Bars take the surface radius and the neutral `--bar`: the "a value needs no hue" argument governs shape as well as colour. Categorical hue stays on the frame. |
| 2026-08-25 | Phase 1 takes take 08's left rail for destinations *and* take 09's top spine for time, rather than 09's merged bands. 09's top strip fits only because it was trimmed to 8 abbreviated labels; the app has ~11 at full length. |
| 2026-08-25 | Phase 1 landed. The predicted test churn did not exist - no test mounts the shell. `--header-clearance` is measured now rather than guessed. |
| 2026-08-25 | Rival studios are not a rail destination: `VIEW_RIVAL_STUDIO` needs a name and the game has no rivals index, so they stay a detour from the calendar and the competition panel. |
