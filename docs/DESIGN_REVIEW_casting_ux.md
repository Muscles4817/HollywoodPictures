# Design Review: Casting & Hiring UX

Status: **Overview + first QOL win shipped.** This document is a UX audit of the
talent-casting/hiring experience, plus the prioritized fixes it surfaces. The
first item — an "Available now only" filter — ships with this change; the rest
are recommendations, ordered by impact-to-effort, for follow-up.

---

## The principle underneath all of this

> **The simulation already knows why someone is — or isn't — a good candidate.
> The UI should expose that reasoning *before* asking the player to decide.**

Almost every issue below is an instance of the same gap: the appeal engine
(`engine/castingAppeal.ts`) computes a rich, named breakdown for every
candidate — how well they fit the role, whether the studio suits them, whether
the money works, who they're drawn to, whether they can even start on time — and
the UI mostly collapses all of it into one blended score and a single action
button. The player is asked to commit (make an offer, spend the slot) while the
"why" stays in the engine.

The fixes aren't about adding intelligence to the game. It's already there. The
work is **surfacing the reasoning the sim already produces** — both the negative
gates (why an offer will fail) and, just as importantly, the positive signals
(why this is a strong pick). That reframes the whole screen from *"prevent bad
clicks"* to *"support good decisions."*

---

## 0. The screens involved

Casting lives in the **Cast & Crew** hub (`components/wizard/HireTalent.tsx`),
also used as the project-workspace "Cast & Crew" section. It opens two drawers:

- **`RoleHiringDrawer.tsx`** — Director and crew ("Hire").
- **`CastingDrawer.tsx`** — actors, per named character, with **Open Casting**
  and **Direct Approach** tabs ("Cast" / "Make Offer").

What the sim already computes per actor (`engine/castingAppeal.ts:
ActorAppealFactors` + `ActorAppealResult`): `suitability` (role/character fit),
`brandFit`/`prestigeFit` (does the studio suit them), `salaryFit` (is the money
right), `attachmentMomentum` (drawn to who's already attached), a blended
`overall`, plus two hard gates — `schedule` and `belowSalaryFloor`. It even has a
plain-English renderer for the positives (`castingPresentation.ts:
describeApplicantInterest`) and the negatives (`describeOfferRejection`).

---

## 1. Shipped in this change — "Available now only" filter

Both drawers now carry a checkbox that **hides anyone not available immediately**
(`components/common/CheckboxToggle.tsx`), defaulting off. It uses
`isAvailableImmediately(person, today)` (`engine/person.ts`) — the exact reading
the card already shows as "Available immediately" vs "Busy until X". Anyone
already on the production is never hidden, and a filter-specific empty state
explains when everything's been filtered out.

This is the first, narrow instance of the principle: it stops surfacing
candidates the sim already knows are uncastable today. The sections below
generalize that idea.

---

## 2. Issues found, prioritized

### P0 — Availability messaging contradicts behavior — **fixed in this change**

`TalentStats` used to tell the player, for a booked person, **"Hiring them would
delay production by N days"** — which read as "possible, at a cost." But the sim
treats schedule as a **hard gate** (`resolveOfferResponse` rejects any
non-`available` schedule), and the two drawers didn't even agree on the surface:
CastingDrawer left the button enabled and let the offer fail; RoleHiringDrawer
**disabled** the booked candidate outright.

**Fixed (cheapest option taken):** `TalentStats` gains an opt-in
`availabilityMode`; the hiring/casting drawers pass `"blocked"`, so a booked
person now reads "Busy until {date}. You can't cast/hire them until then —
their existing commitments won't clear in time" instead of the false delay
promise. CastingDrawer now **disables** the Cast/Make Offer button for a booked
actor (and the crew drawer's compare-slot action too), matching how
RoleHiringDrawer's main list already treats them. On-set replacement keeps the
default copy — its delay is the event's own, not this booking's.

*The richer option remains open:* actually building the "delay the release to fit
them" flow that the engine's `requires-delay` status was designed for, so a
delayed hire becomes genuinely possible rather than just honestly refused.

### P1 — Explain why a candidate is *recommended*, not just why they're blocked — **shipped**

The review's negative gates (below) are only half the story. The sim already
scores *why a candidate is strong* — `suitability`, `salaryFit` (good value),
`attachmentMomentum` (drawn to the attached director/cast), reputation fit — and
`describeApplicantInterest` already turns the top factors into a sentence like
*"Drawn to the role itself and happy with the money on offer."* Today that
reasoning is under-surfaced:

- On the casting card it's a single muted line derived from the **blended top
  two factors only**; there's no at-a-glance read of *which* strengths a
  candidate has (great fit? good value? wants in?).
- `describeApplicantInterest` even personalizes the attachment factor to *"drawn
  to working with {director}"* when a director is passed — but **CastingDrawer
  calls it without the director** (`CastingDrawer.tsx`), so that line never
  fires even though the drawer has the director in hand. A concrete case of the
  sim knowing more than the UI shows.
- The "positive why" is absent entirely from the framing of Direct Approach and
  from any sort/label, so a genuinely great-fit, great-value candidate looks
  identical to a mediocre one until you read the fine print.

**Shipped.** The actor casting card now renders compact reasoning chips
(`engine/castingPresentation.ts:candidateStrengthSignals` +
`components/wizard/CastingDrawer.tsx`): the strongest few positive draws — "Great
fit," "Happy with the pay," "Keen to work with {director}" (the attachment factor
now *does* name the director), "Likes your studio" — plus a "Sought you out" chip
for the `InterestedTalent` channel. Same `ActorAppealFactors` the acceptance math
reads, strongest-first, capped to stay scannable; presentation only.

*Genuinely new sim, not just surfacing:* **chemistry / prior collaboration**
("has worked with this director before," "good on-screen pairing") does **not**
exist yet — `attachmentMomentum` is about *who's attached now*, not shared
history. The codebase already anticipates a future "collaboration system"
(`types/index.ts`), so this is the one positive signal on the wishlist that
would need real simulation work; worth calling out as a separate, later track.

### P1 — Discovery: expose browsing, sorting & filtering (search is secondary)

Casting has **no discovery controls at all** beyond the price slider and the
tab. That's the bigger gap than "no search" — most players aren't hunting a
specific name; they're expressing an *intent*: "the best available actor I can
afford," "someone available now," "highest appeal," "best value for the money."
The sim already computes every key those intents would sort/filter on
(`overall`, `salaryFit`, availability, price, fame) — they're just not exposed.

**Recommendation, in order:**
1. **Filters for the common intents** — availability (shipped), and an
   "affordable only" filter (see below). Cheap, high-use.
2. **A visible, switchable sort** — Appeal / Value / Price / Fame — replacing
   today's fixed, invisible appeal-sort so the player can *browse by what they
   care about* rather than accept one hidden ordering.
3. **Name search as a secondary override** — genuinely useful for one job:
   Direct Approach only shows a price-band window (`engine/talentFilter.ts`), so
   a specific actor you want can be invisible with no way to reach them. Search
   fixes that blind spot, but it's a targeted tool, not the headline — most
   casting is browse-and-compare, not lookup.

### P1 — Surface the blockers the sim already computed (doomed offers look live) — **shipped**

Beyond availability, Direct Approach also lists **below-salary-floor** actors
(Open Casting filters these out; Direct Approach doesn't), all hard-rejected on
click. Nothing on the card signalled "this offer can't succeed as configured" —
the reason only appeared *after* clicking.

**Shipped.** A below-floor candidate now carries a "Wants more pay" blocker chip
and a **disabled** offer (with a "raise what you're offering" tooltip), alongside
the booked-actor block from P0 — so both hard gates the engine enforces are shown
pre-click rather than discovered by a failed offer.

### P1 — No affordability signal per candidate — **shipped**

A candidate's salary showed, but was never compared to `studio.cash` on the card;
the only affordability signal was the hub footer.

**Shipped.** A candidate whose salary would push the draft's committed spend past
the studio's cash now shows an "Over your budget" **warning** chip (not a hard
block — talent salary is charged at greenlight, not at casting; recasting
correctly credits back the current occupant's salary). A dedicated "affordable
only" filter is still worth adding as one of the
discovery filters above.

### P2 — Two drawers, two vocabularies, two behaviors

Actors and crew are "staff the film" to the player but use different drawers,
verbs ("Cast"/"Make Offer" vs "Hire"), booked-state behavior (enabled-but-fails
vs disabled), and affordances (crew has **Pin to Compare**; actor casting does
not).

**Recommendation.** Converge on one interaction contract (same booked-state
treatment, same compare affordance), even if the browsing models stay distinct.

### P2 — Post-cast ergonomics

The drawer auto-closes ~500ms after a successful cast, with no undo and no
moment to review who was just cast.

**Recommendation.** Replace the timed auto-close with an explicit confirm/undo,
or hold on a "Cast ✓ — cast someone else / done" state.

### P2 — Mandatory vs optional roles read weakly

Optionality is a small "(optional)" text label and grouping only; nothing
strongly signals "you can't start production without this one."

**Recommendation.** Give required-but-unfilled roles a distinct visual state.

---

## 3. Suggested order of work

1. **(done)** Available-now filter — immediate decluttering.
2. **(done)** Fix the booked-person copy + disable the doomed Cast button —
   removes the worst contradiction; CastingDrawer now matches the crew drawer.
3. **(done)** Candidate reasoning on the actor card — *both* directions:
   positive signals (Great fit / Happy with the pay / Keen to work with
   {director} / Likes your studio / Sought you out) and pre-click blockers
   (booked / below salary floor) plus an over-budget warning. One card treatment
   delivering most of the principle.
4. **P1** Discovery controls — sort (Appeal / Value / Price / Fame) and an
   "affordable only" filter; then name search as the secondary override.
5. **P1 (small)** Extend the same reasoning chips to the director drawer via
   `DirectorAppealFactors` (this pass covered the actor card only).
6. **P2** Unify the two drawers; revisit post-cast ergonomics and required-role
   emphasis.
7. **Later / new sim** A collaboration/chemistry model (prior director–actor and
   actor–actor history) — the one wishlist signal that isn't already computed.

Everything except item 7 is presentation of reasoning the `castingAppeal` engine
already produces — which is exactly why it's worth doing: the intelligence is
built, it's just not on screen yet.
