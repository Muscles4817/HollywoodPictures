# The Notification Contract

Status: **Standing rule.** Unlike the `DESIGN_REVIEW_*` documents (which are
arguments about what to build), this one is a short checklist to apply *while*
building. It exists because the same omission has now shipped three times.

> **The rule in one sentence:** if a feature can change state while the player
> isn't looking at it, that feature is not finished until the player can find
> out, act on it in one click, and have the message stop.

---

## 0. Why this exists

The director bake-off (`DESIGN_director_pitch_and_bakeoff.md` §3) shipped
complete and correct: interest model, pitch generation, staggered due-days, a
review panel, selection consequences. It was also **invisible**. Pitches land on
their own due-days during the background tick, and nothing told the player — the
only way to discover a round had come in was to reopen the Director drawer and
look. The simulation was right and the feature did not exist.

Open Casting (`DESIGN_REVIEW_casting_redesign.md` §6) did surface a notification,
and got the next three things wrong instead: it lumped every role into one
run-on sentence, its button dropped the player on the project's Overview rather
than the role they were told about, and it repeated an identical message until
somebody was finally cast — because it cleared on *casting*, not on *reading*.

None of these were hard to fix. They were missed because nothing said they were
part of the job. The four obligations below are that "part of the job."

---

## 1. When this applies

Apply the checklist whenever you add or extend anything that **resolves on the
background tick or arrives unprompted**:

- something lands on a stored due-day (`readyOnDay`, `dueDay`,
  `nextApplicantCheckDay`, `releaseDay`, `expiresOnDay`, …)
- something arrives because the world acted, not because the player did (an
  applicant, a rival's bid, an incident, an unlock)
- a timed process finishes (a shoot, a cut, a run, a season)

It does **not** apply to a result the player is already looking at — anything
resolved by a click, on the screen that click was on, needs no notification.

---

## 2. The four obligations

### 2.1 Surface it — in the one shared derivation

A beat the player cannot discover has not shipped. Add a category to
`engine/project.ts:deriveInboxItems` — the single derivation that both
`components/common/Inbox.tsx` and `components/common/Header.tsx`'s badge read.
Do **not** grow a category locally in `Inbox.tsx`: the two drifted apart exactly
that way once before (the badge undercounted new casting applicants for a
stretch), which is why the shared derivation exists at all.

Then decide whether it lights the badge: `inboxBadgeCount` counts what the
player still needs to see. Count at **card granularity** — if the Inbox renders
one card per Character, the badge counts calls, not projects.

*Exception:* a genuinely non-derivable point-in-time event (a resolved bid — the
opportunity leaves the pool, so the state that proved it is gone) gets a stored
record instead, like `GameState.bidNotifications`. Keep that list small; if
current state still proves the event happened, derive it rather than store it
(`DESIGN_REVIEW_unified_inbox.md` §1.2).

### 2.2 Clear it on *read*, not on *resolution*

The item must stop once the player has **seen** it — not once the underlying
decision is finally made. A card gated on resolution repeats an identical
message every time the player looks away, which is indistinguishable from a bug.

The established shape is a per-item `acknowledged?: boolean`, set by the surface
that displays the thing (`AuditionRecord`, `CastingApplicant`, `DirectorPitch`,
and `boxOfficeRun.acknowledged` / `premiereSeen` all follow it). The
"awaiting review" derivation then counts **only unseen items**, so a fresh
arrival next week pings again while the ones already read stay quiet.

Two consequences worth stating, because both were guessed wrong before:

- **Acknowledge at the moment the content is displayed.** Usually that is an
  effect on the surface itself — the drawer opening *is* the player reviewing.
  Acknowledging on the route is only equivalent when the route lands *directly*
  on the content (box office marks read as it opens the dossier, which is the
  same moment); a route that lands merely *near* it must not. Never acknowledge
  on Inbox open: a notification marked read by anything short of showing its
  content is one the player can miss forever.
- **A read-state beat may show for the currently-focused project.** The general
  rule is that the focused project is excluded from the Inbox (its own screen is
  where it belongs), but that reasoning only holds for cards routing to the
  screen already on display. A card pointing at a *drawer* is pointing at
  something not on screen just because the project is — and since it clears on
  read, it cannot nag. Being inside a project you are casting is precisely when
  "someone new applied for the villain" is worth knowing.

An action item that blocks a production (an on-set choice, a pending screening)
is the opposite case: it is self-resolving and needs no read state at all. The
project *is* its record (`DESIGN_REVIEW_unified_inbox.md` §4).

### 2.3 Route to the decision, at the decision's own granularity

The card's button must land on the surface where the thing can actually be acted
on — not merely on the project that contains it. Two failure modes:

- **Wrong granularity.** One card per project, when the decision is per-Character,
  forces the player to re-find what the message already told them. Split the card
  the way the decision splits: one per Character, one per round, one per film.
- **Wrong destination.** `RESUME_PROJECT` lands on the workspace Overview. If the
  thing lives in a drawer, panel, or tab, the route has to open *that*.

When the target is **component-local state** (a drawer's `useState`), there is no
route to dispatch — and this is the trap, because the feature looks finished from
the reducer's side. Put a one-shot deep-link on `GameState`, have the owning
component consume and clear it, and have any navigation drop it so it can never
pop a drawer open later. `CastCrewFocus` (set by `REVIEW_CASTING_CALL` /
`REVIEW_DIRECTOR_PITCHES`, consumed by `HireTalent.tsx`, cleared by
`clearTransientView`) is the worked example; `DESIGN_REVIEW_unified_inbox.md` §7
flagged the same blocker for `FilmDetailModal` before it was ever hit.

Also: **the overlay closes on the way out.** The Inbox is full-screen; a routing
action that leaves it up hides the screen it just routed to.

Finally, **only offer a route that is reachable.** If the destination does not
exist in the project's current stage (Cast & Crew is unreachable once a film is
greenlit), do not surface the card at all — a live button that dispatches a
no-op is worse than silence.

### 2.4 Say what arrived, concretely

The card should name what actually happened, in the game's own qualitative voice
(`CLAUDE.md`: named causes, never raw stat values):

- Name the **thing it is about** in the title — the role, the round, the film.
- Name **who or what arrived**. Several arrivals go in `StudioActivity.bullets`
  (rendered as a list by `ActivityCard`), never concatenated into one sentence.
- Keep it a **notification, not a second screen** — cap the list and summarise
  the rest ("…and 3 more"). The surface it routes to is the system of record.

---

## 3. Checklist

Before calling a background-resolving feature done:

- [ ] A category in `deriveInboxItems`, not a local list in `Inbox.tsx`
- [ ] `inboxBadgeCount` counts it at the same granularity the Inbox renders it
- [ ] It clears on **read**, via a per-item `acknowledged` flag or equivalent
- [ ] The flag is set by the surface that **displays** the content
- [ ] The card routes to the exact surface the decision is made on
- [ ] Component-local targets have a deep-link on `GameState`, cleared on navigation
- [ ] The route is gated on the destination actually being reachable
- [ ] The overlay closes when the player routes away
- [ ] The card names the role/round/film and lists what arrived
- [ ] Nothing in it pauses the clock unless it is genuinely time-critical
      (`DESIGN_REVIEW_unified_inbox.md` §5)

Tests that catch the regressions above cheaply:

- [ ] Badge parity — `inboxBadgeCount` equals the cards the Inbox renders
- [ ] Clears on read — acknowledge the item, assert the category empties
- [ ] Pings again — a *new* arrival alongside an acknowledged one re-surfaces it
- [ ] Route — clicking the card dispatches the deep-link **and** closes the Inbox
- [ ] Unreachable — the beat stops once its destination is out of stage

---

## 4. Related

- `DESIGN_REVIEW_unified_inbox.md` — the architecture behind the Inbox: the
  derived-vs-stored split (§1.2), lifecycle (§4), pause behaviour (§5), and
  route-don't-duplicate (§7). Read that for *why*; this document is the *what to
  do*.
- `DESIGN_REVIEW_casting_redesign.md` §6 and
  `DESIGN_director_pitch_and_bakeoff.md` §3.1 — the two features whose shipped
  notification behaviour is recorded against this contract.
