# Design Review: Casting & Hiring UX

Status: **Overview + first QOL win shipped.** This document is a UX audit of the
talent-casting/hiring experience, plus the prioritized fixes it surfaces. The
first item — an "Available now only" filter — ships with this change; the rest
are recommendations, ordered by impact-to-effort, for follow-up.

---

## 0. The screens involved

Casting lives in the **Cast & Crew** hub (`components/wizard/HireTalent.tsx`),
which is also the project-workspace "Cast & Crew" section. It opens two
different drawers:

- **`RoleHiringDrawer.tsx`** — Director and crew ("Hire").
- **`CastingDrawer.tsx`** — actors, per named character, with **Open Casting**
  and **Direct Approach** tabs ("Cast" / "Make Offer").

Availability is a `Person.availability.commitments` list; the derived
"booked until" is `deriveBookedUntil` (`engine/person.ts`). Whether an offer can
land *today* is the schedule gate in `engine/castingAppeal.ts`
(`resolveOfferResponse` rejects any non-`available` schedule).

---

## 1. Shipped in this change — "Available now only" filter

**Problem it solves.** A booked person can't actually be cast/hired today, yet
they list identically to castable ones. Both drawers now carry a **checkbox that
hides anyone not available immediately** (`components/common/CheckboxToggle.tsx`),
defaulting off. It uses `isAvailableImmediately(person, today)`
(`engine/person.ts`) — the exact reading the card already shows as "Available
immediately" vs "Busy until X", so the filter and the card can never disagree.
Anyone already on the production is never hidden, and a filter-specific empty
state explains when everything's been filtered out.

This is a mitigation, not a cure, for issues **#2/#3** below — the deeper fix is
to stop presenting doomed offers as if they were live.

---

## 2. Issues found, prioritized

### P0 — Availability messaging contradicts behavior

`TalentStats` tells the player, for a booked person, **"Hiring them would delay
production by N days"** (`components/common/TalentStats.tsx`) — which reads as
"this hire is possible, at a cost." But:

- In **CastingDrawer**, the Cast/Make Offer button is fully enabled, and the
  offer is then **hard-rejected** on the schedule gate (`castingAppeal.ts:
  resolveOfferResponse`) with "can't clear their existing commitments in time."
- In **RoleHiringDrawer**, the same booked person is instead **disabled**
  (`booked` → `disabled`), so you can't click at all.

So the same shared card promises a delayed hire, while one drawer silently
refuses the click and the other refuses the result. The `requires-delay`
schedule status exists in the engine but has no flow behind it yet.

**Recommendation.** Pick one model and make the copy tell the truth:
- *Cheapest:* change the card copy for a booked person to "Unavailable — booked
  until {date}" (drop the "would delay production" promise), and disable the
  Cast/Make Offer button for booked actors so CastingDrawer matches
  RoleHiringDrawer.
- *Richer (the feature the copy implies):* build the "shift the production /
  release later to fit them" flow the `requires-delay` status was designed for,
  so a delayed hire actually becomes possible.

### P1 — Doomed offers look identical to live ones

Beyond availability, **Direct Approach** also lists **below-salary-floor**
actors (Open Casting filters these out; Direct Approach doesn't), and they're
hard-rejected too. Nothing on the card or button signals "this offer can't
succeed as configured." The player only learns why *after* clicking.

**Recommendation.** Surface the blocker pre-click: an inline "Wants more than
you're offering" / "Booked until {date}" note and a disabled action, reusing the
same reasons `describeOfferRejection` already produces post-hoc.

### P1 — No affordability signal per candidate

A candidate's salary shows, but it's never compared to `studio.cash` on the
card. The only affordability signal is the hub footer ("You can't afford this so
far", `HireTalent.tsx`). You can make an offer to someone you can't pay.

**Recommendation.** Flag/disable candidates whose salary would push committed
spend past cash, on the card itself.

### P1 — No search; the actor you want can be invisible

Direct Approach shows up to 9 candidates inside a **price band** around your
offered salary (`engine/talentFilter.ts`). A specific actor you're hunting won't
appear unless the salary slider happens to sit near their price — and there's no
search to override it. There is no search/sort control anywhere in casting.

**Recommendation.** Add a name search (at least for Direct Approach) that
bypasses the price window, and expose the existing implicit sort (appeal / price)
as a visible, switchable control.

### P2 — Two drawers, two vocabularies, two behaviors

Actors and crew are "staff the film" to the player, but use different drawers,
verbs ("Cast"/"Make Offer" vs "Hire"), booked-state behavior (enabled-but-fails
vs disabled), and affordances (crew has **Pin to Compare**; actor casting does
not). 

**Recommendation.** Converge the two on one interaction contract (same
booked-state treatment, same compare affordance), even if the browsing models
stay distinct.

### P2 — Post-cast ergonomics

The drawer auto-closes ~500ms after a successful cast, with no undo and no
moment to review who was just cast.

**Recommendation.** Replace the timed auto-close with an explicit confirm/undo,
or keep the drawer open on a "Cast ✓ — cast someone else / done" state.

### P2 — Mandatory vs optional roles read weakly

Optionality is a small "(optional)" text label and grouping only
(`HireTalent.tsx`); nothing strongly signals "you can't start production without
this one."

**Recommendation.** Give required-but-unfilled roles a clear visual state
distinct from optional ones.

---

## 3. Suggested order of work

1. **(done)** Available-now filter — immediate decluttering.
2. **P0** Fix the booked-person copy + disable the doomed Cast button (small,
   high-trust win; removes the worst contradiction).
3. **P1** Pre-click blocker notes (availability / salary floor / affordability)
   on candidate cards.
4. **P1** Name search for Direct Approach.
5. **P2** Unify the two drawers' booked-state + compare affordances; revisit
   post-cast ergonomics and required-role emphasis.

Everything above is presentation/UX; none of it requires touching the
box-office or appeal simulation — the underlying `castingAppeal` math already
computes the reasons these fixes would surface earlier.
