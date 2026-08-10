# Design proposal — Casting Workspace & director pitches UX

Status: **proposal, for review** · Branch: `claude/casting-director-pitches-ux-alqr9z`

This document responds to playtest feedback on the director-pitch and casting
flow. It proposes replacing the per-role side **drawer** with a durable
**Casting Workspace** that both directors and actors flow through, and fixing
the async-visibility gaps that make the current pitch process invisible once you
leave it.

It is a proposal to react to, not a spec to build. Layout sketches are
indicative. Open questions are collected at the end.

---

## 1. What's actually wrong (grounded in the code)

The playtest raised five issues. Reading the code, they collapse into **one
design fault and three plumbing gaps**.

### The design fault: casting is a comparison workflow with no home to be one

A casting decision — director *or* actor — is the same shape every time:

> candidates **arrive over time**, you **compare** them against a role and each
> other, you **narrow** to a shortlist, and you **decide** (or ask for more).

The current director bake-off lives in a right-side **drawer**
(`RoleHiringDrawer` → `DirectorPitchPanel`, `index.css` `.role-drawer`,
`width: min(960px, 88vw)`). A drawer is a *transient* container: it wants to be
opened, acted on, and dismissed. But pitches **arrive staggered over 7–21 days**
of game time (`openDirectorPitches` sets `dueDay = totalDays + 7 + rand(14)`).
The panel copy literally instructs the player to *"Keep time running to receive
them."* — i.e. hold a drawer open across three weeks of simulation. That is the
wrong ontology. An accumulating, compare-over-time decision needs a **place you
leave and return to**, pinged when new candidates land — not a modal you babysit.

This one fault produces most of the felt symptoms:

- **"The pitches all read the same."** The pitch *prose* (`describePitch` in
  `engine/directorPitch.ts`) is fully templated. It varies along only four axes:
  which tone axes moved past a threshold (max 2), the production method, up to 3
  demand lines, and **one of exactly three** posture blurbs (`POSTURE_SUMMARY`).
  There is no per-director authored language, so two directors with similar taste
  on the same script read near-identically **by construction**. A bigger surface
  will not fix this alone — see §7.
- **"I can't see the directors as people."** Everything needed to tell them apart
  exists on the `Person`/`DirectorCareer` objects and is simply **not rendered**:
  reputation (fame / prestige / industry respect / reliability), derived traits
  (`Perfectionist`, `DifficultToWorkWith`, `Mentor`, …, from
  `engine/personTraits.ts`), `DomainAptitudes` (story / visual / performance /
  craft — directly relevant to whether a bold reinterpretation lands), skill,
  hands-on-ness, relationship standing, and their `toneProfile` /
  `productionStyle` as a direct read against the script. The `PitchCard` shows
  name + posture badge + take + 3 demands + a blurb, and nothing about *who this
  person is*.
- **"No progression — I can't shortlist, save, or request more to compare."**
  Correct. There is no shortlist and no comparison view for directors — even
  though the **actor** flow already has a `TalentComparison` pin-and-compare
  mechanic. Directors are *behind a pattern the game already established.*

### The three plumbing gaps

Each is a concrete, verifiable gap — all three are symptoms of the same root:
**the pitch process is only observable from inside the open drawer.**

1. **Director row never reflects an in-flight bake-off.**
   `deriveStaffingBoard` sets the Director row's stage to
   `attached.length > 0 ? 'attached' : 'unstaffed'` (`staffingBoard.ts:247`) and
   hands it `NO_COUNTS`. No branch inspects `draft.directorPitches`. So whether
   you've invited pitches or not, the row reads **"Unstaffed."** Meanwhile the
   board *already defines* the full lifecycle the Director should use —
   `searching / candidates / evaluating / negotiating` (`STAFFING_STAGE_ORDER`),
   with a `stageFor()` helper and a `StaffingCounts` shape. The Director role just
   opts out of it. The file's own header comment says the board is *"built to be
   EXTENSIBLE rather than casting-specific: every role reports the same
   lifecycle."* The fix is to make the Director actually use it.

2. **No email / inbox signal when pitches arrive.** `deriveInboxItems`
   (`engine/project.ts`) has categories for `casting`, `auditionsReady`,
   `wrapped`, etc. — but **none** for director pitches. Nothing tells the player
   pitches landed; if they close the drawer, the signal is gone. (Actor open
   casting *does* raise a `casting` inbox item — directors have no equivalent.)

3. **Inbox items don't deep-link to the relevant casting.** The `casting` item
   dispatches `RESUME_PROJECT`, which reopens the project wizard and lands on the
   Cast & Crew hub, but does **not** open the specific role/character the call is
   for. The player arrives on the page and has to re-find the open call by hand.

### A smaller, real one: table sectioning

The staffing table orders **all actor rows first, then Director + crew**
(`CREW_ROLE_ORDER`). Separately, on the hub, the Director *also* gets a
standalone `RoleTile` rendered **above** the character section
(`HireTalent.tsx:617`). So the Director is simultaneously "first" (standalone
tile) and "below every actor" (in the table) — two placements, two priorities.
That inconsistency is what reads as "the Director is randomly in the middle of
the pack."

---

## 2. Design principles

1. **Casting is one workflow, not two.** Directors and actors are candidate
   types within a single comparison-and-shortlist surface. Build the surface
   once; specialise the candidate card.
2. **The surface is a place, not a moment.** It survives time passing. You leave
   it, the sim advances, candidates arrive, the inbox pings you, you return to a
   fuller board. No "hold the drawer open."
3. **The table is the status hub; the workspace is where you decide.** The
   Cast & Crew table shows every role's live stage at a glance and launches you
   into the workspace for the role you pick.
4. **Show the person, not just the pitch.** Every candidate card carries enough
   identity (reputation, traits, aptitudes, relationship) to compare *people*,
   not just paragraphs.
5. **Presentation stays qualitative** (per `CLAUDE.md`): stars, prose, named
   traits and causes — never raw 0–100 stat values in player-facing UI. Dev
   inspectors may still read raw numbers.

---

## 3. The Casting Workspace

A **full-page surface** (replacing the drawer) reached by clicking any role's
"Open" / "Cast" action in the Cast & Crew table. It has room to lay candidates
out, hold a shortlist, and compare — the things a 960px drawer starves.

```
┌─ Casting: Director — "Midnight Larkspur" ────────────────── [ Back to Cast & Crew ] ┐
│                                                                                      │
│  Role brief:  Sci-fi thriller · $4.2M allocation · tone: brooding, cerebral         │
│  Status:  Evaluating · 4 pitches in · 1 still preparing (~3 days)   [ Request more ] │
│                                                                                      │
│  ┌── Candidates (4) ─────────────────────────┐   ┌── Shortlist (2) ───────────────┐ │
│  │                                            │   │  ★ A. Reyes                    │ │
│  │  ┌─────────────┐  ┌─────────────┐          │   │  ★ J. Okafor                   │ │
│  │  │ CANDIDATE   │  │ CANDIDATE   │          │   │                                │ │
│  │  │ CARD        │  │ CARD        │   …       │   │  [ Compare shortlist → ]       │ │
│  │  │ [★ shortlist]│  │ [★ shortlist]│         │   └────────────────────────────────┘ │
│  │  └─────────────┘  └─────────────┘          │                                       │
│  │                                            │   ┌── Compare (side-by-side) ──────┐ │
│  │  Sort: appeal ▾   Filter: bold takes ▾     │   │  Reyes    │  Okafor            │ │
│  └────────────────────────────────────────────┘   │  aptitude │  aptitude          │ │
│                                                    │  take     │  take              │ │
│                                                    │  demands  │  demands           │ │
│                                                    │  [Choose] │  [Choose]          │ │
│                                                    └────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Regions:

- **Header / role brief** — what's being cast, the allocation, the script's tonal
  ask, and the live stage (mirrors the table's status). `Request more` re-opens /
  widens the round (directors: invite another wave; actors: extend the call).
- **Candidates** — the arriving set. Each is a rich card (§4). Sort (appeal,
  fee, reputation) and filter (posture, trait) because the set grows over time.
- **Shortlist** — pinned candidates you're seriously weighing. Persists on the
  draft, survives leaving the page. This is the "save pitches" the player asked
  for.
- **Compare** — 2–3 shortlisted candidates side-by-side on shared rows
  (aptitude, take, demands, cost, relationship). This is the actor
  `TalentComparison` pattern, promoted out of the drawer and generalised.

Actors reuse the **same** frame: candidates are applicants/auditionees, the
brief is the character, "request more" extends the casting call or arranges
auditions. The regions and interactions are identical; only the card body and
the "arrive" mechanic differ.

### Why a page, not a bigger modal

The decision spans real game-time and competes with other studio activity
(scheduling, other roles, the calendar advancing). A page can be navigated away
from and returned to natively, appears in history, and doesn't trap the sim
behind a backdrop. A modal/drawer implies "finish this now," which is exactly
the false pressure that broke the current flow.

---

## 4. The candidate card

The card must let you compare **people**, not just pitches. Director example:

```
┌─────────────────────────────────────────────┐
│  Ava Reyes                        [Bold take]│   ← name + posture badge
│  ★★★★☆ industry standing · worked w/ you 2×  │   ← reputation (stars) + relationship
│                                              │
│  Strengths:  visual ★★★★★ · performance ★★★☆☆ │   ← DomainAptitudes as stars
│  Reads as:   Perfectionist · Prestige-focused│   ← derived traits (personTraits.ts)
│                                              │
│  Her take:   "Would lean harder into the     │   ← existing describePitch.take
│              brooding register and pull back  │
│              the comic beats…"                │
│  Approach:   On-location, practical effects   │   ← describePitch.approach
│  Will want:  • Final cut on the third act     │   ← top demands
│              • A longer location shoot        │
│                                              │
│  [ ★ Shortlist ]           [ Choose Reyes ]   │
└─────────────────────────────────────────────┘
```

New on the card (all data already available, just unrendered):

- **Reputation** as a qualitative standing (stars / label), not a number.
- **Relationship** standing ("worked with you 2×", "burned you once") via
  `playerRelationshipWith` / `describeRelationship`.
- **Aptitudes** (`DomainAptitudes`: story / visual / performance / craft) as
  stars — the single most useful comparator for "will their bold reinterpretation
  land," and completely absent today.
- **Derived traits** (`engine/personTraits.ts`) — the 1–2 top-ranked reads
  (`Mentor`, `DifficultToWorkWith`, `RiskTaker`…) that give a director a
  personality at a glance.

The existing take / approach / demands stay — they're fine, they were just
homeless and unaccompanied. Enriching the *prose itself* is §7 (later).

---

## 5. Async visibility layer (the three plumbing gaps)

These are needed under **any** UI and should land first — they make the process
real regardless of where it's rendered.

### 5.1 Director row uses the real lifecycle

Map the pitch process onto the staffing board the role already knows how to
speak. In `deriveStaffingBoard`, for the Director role, derive `counts` and
`stage` from `draft.directorPitches` instead of hardcoding:

| Pitch process state                     | Stage         | Progress summary            |
|-----------------------------------------|---------------|-----------------------------|
| no `directorPitches`                    | `unstaffed`   | —                           |
| round open, all `pending`               | `searching`   | "pitches invited"           |
| some `submitted`, some `pending`        | `candidates`  | "3 in · 1 preparing"        |
| all `submitted` (round complete)        | `evaluating`  | "4 pitches to compare"      |
| a pitch `shortlisted` (new §6 state)    | `evaluating`  | "comparing 2"               |
| `selectedDirectorPitch` set / attached  | `attached`    | director name               |

This reuses `StaffingStage`, `stageFor`'s vocabulary, and
`STAFFING_STAGE_LABELS` — no new rendering, the row just stops opting out. The
`progressSummary` helper in `HireTalent.tsx` gains a director branch.

### 5.2 Pitch email / inbox item

Add a `directorPitches` category to `InboxItems` / `deriveInboxItems`
(`engine/project.ts`), raised when `submitted.length` increases (pitches landed)
and when the round completes (all in). Grouped under **"Needs you"** when there
are pitches to review. Mirrors the existing `casting` category for actors.

### 5.3 Deep-linking

Inbox items already carry enough identity to target a role/character. Extend the
click action so a casting/pitch item resolves to `RESUME_PROJECT` **plus** a
target (role or `characterId`) that opens the Casting Workspace on that role.
Concretely: a `focusRole` / `focusCharacterId` field on the resume action that
the wizard reads on mount. Fixes both "pitch email → workspace" and the existing
"open-casting item → the actual open call."

---

## 6. State model changes

Small, additive, and (per `CLAUDE.md`) we **bump `SAVE_KEY`** rather than write
migrations — pre-launch, current schema only.

- `DirectorPitchProcess` gains **`shortlistedDirectorIds: string[]`** — the saved
  shortlist. (Actors already track a `shortlist` on the draft; directors get the
  parallel.)
- The workspace reads existing `submitted` / `pending`; shortlist and compare are
  pure selections over them.
- "Request more" opens a **new wave**: append to `pending` with fresh staggered
  `dueDay`s from the still-willing pool (respecting `MAX_PITCHES`). Needs a
  reducer action (`REQUEST_MORE_PITCHES`) and a small `directorPitches.ts` helper
  to add a wave without resetting the round.
- New reducer actions: `SHORTLIST_PITCH`, `UNSHORTLIST_PITCH`,
  `REQUEST_MORE_PITCHES`. `SELECT_DIRECTOR_PITCH` / `PASS_ON_PITCHES` unchanged.
- Inbox: new `directorPitches` category (§5.2); resume action gains a focus
  target (§5.3).

No engine simulation math changes — pitch *generation* is untouched in this
phase. This is presentation, navigation, and one new saved list.

---

## 7. Prose enrichment (later, separable)

Even with the workspace, if two similar directors generate identical
paragraphs, the cards still echo. This is a **separate, deeper** engine change
and I'd sequence it last:

- Widen `describePitch` to draw on more director-specific signal: lead with the
  director's dominant aptitude ("a performance-first director — expect the drama
  foregrounded"), vary sentence framing by trait (a `RiskTaker` vs a
  `Perfectionist` pitch the same tone shift differently), and reference the
  *specific* tonal gap in words, not just "leaned harder."
- Consider a small pool of authored sentence fragments keyed by
  (posture × dominant aptitude × top trait) so the language space is combinatorial
  rather than 3 fixed blurbs.

This is worth doing but shouldn't block the workspace; the identity data on the
card (§4) already differentiates directors even while the prose is being widened.

---

## 8. Proposed sequencing

| Phase | Scope | Player-visible outcome |
|-------|-------|------------------------|
| **1. Async visibility** | §5.1 Director lifecycle on the board · §5.2 pitch inbox email · §5.3 deep-link | The pitch process is finally observable and returnable-to from outside the drawer. Bugs gone. |
| **2. Workspace surface** | §3 page · §4 rich cards · §6 shortlist + compare + request-more · promote actors onto it | The core redesign: a real comparison-and-shortlist workspace for directors and actors. |
| **3. Table sectioning** | Neat role groups, one consistent Director placement, kill the double-tile | The Cast & Crew hub reads as an ordered status board. |
| **4. Prose enrichment** | §7 | Pitches read as different visions, not one paragraph. |

Phase 1 stands alone and de-risks the rest. Phase 2 is the bulk of the work and
where "full workspace redesign" actually lands. 3 and 4 are polish that can slip
without blocking.

---

## 9. Open questions for you

1. **Workspace vs. the wizard.** The Cast & Crew page is a step in the film
   wizard. Should the Casting Workspace be a **sub-route within the wizard**
   (keeps the film's context/chrome, natural "back to Cast & Crew"), or a
   **full-screen takeover** that returns you to the wizard on exit? I lean
   sub-route — less disorienting, keeps budget/allocation context visible.
2. **How much director stat to expose.** Aptitudes-as-stars is a clear win. Do
   you want reputation and traits on the *card* (denser, more to compare) or
   revealed on a card *expand* (cleaner grid, one extra click)? Trade-off is
   scannability vs. density.
3. **"Request more" cost/limit.** Should inviting another wave cost time, money,
   or reputation, or just be gated by the remaining willing pool
   (`MAX_PITCHES`)? Without some friction, the dominant strategy is "always
   request more."
4. **Do actors move in Phase 2, or later?** Generalising the workspace to actors
   is the whole point, but it touches the working `TalentComparison` flow. We can
   ship directors-on-the-workspace first and fold actors in right after, or do
   both together. Slightly less risk to stage them.
5. **Shortlist semantics.** Is a shortlist purely a personal marker (organise my
   thinking), or does it *do* something in-sim later (e.g. auto-notify if a
   shortlisted director's availability changes)? Affects whether it's pure UI or
   earns simulation hooks.
