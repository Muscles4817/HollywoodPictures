# Design Review: Slot-Bound Casting — Cast Any Role in Any Order

Status: **Proposed** (not started). Scopes the removal of the in-order
casting constraint documented as out-of-scope in
`DESIGN_REVIEW_casting_redesign.md` ("Casting stays append-order for now …
slot-targeted recasting is out of scope this phase"). Builds directly on
already-shipped systems: the per-Character casting UI
(`components/wizard/CastingDrawer.tsx`), the `ScriptCharacter.id` +
`CastingCall.characterId` binding already in the model, and
`characterForRoleSlot`/`effectiveRoleCapacity`
(`engine/castRequirements.ts`).

---

## TL;DR

- **One field does almost all of it.** Add `characterId?: string` to
  `TalentAssignment` (`types/index.ts:1160`) and make it the source of truth
  for who plays whom, instead of inferring it from array position. Everything
  else follows from that.
- **The binding target already exists and already serializes.**
  `ScriptCharacter` carries a stable `id` (`types/index.ts:574`) and
  `CastingCall.characterId` already keys off it. This is not a new identity
  system — it's pointing the talent list at an identity the codebase already
  tracks.
- **The blast radius is tiny.** Almost the entire engine — cost, release,
  box office, buzz, marketability, awards — aggregates talent **by role
  only** and is completely unaffected. Exactly **two** engine reads
  (`computeActingScore`, `isCharacterCast`) and the **UI gate** in two
  drawers care about slot binding.
- **`RoleHiringDrawer`'s actor path is dead code** and needs zero changes
  (see §6). Actors route exclusively through `CastingDrawer`.
- **Precedent exists.** The v31→v32 save note (`persistence.ts`) already did
  the analogous "carry the slot explicitly instead of inferring it" move for
  *role*. This is that same move, one level deeper (character).
- **Keep it backward-safe with a positional fallback**, so the change is a
  no-op for existing append-order casts and seeded tests don't shift (§3).

---

## 1. The problem, precisely

`draft.talent` is a flat, append-only `TalentAssignment[]`. Which
`ScriptCharacter` an actor plays is derived purely by **array position**: the
Nth `TalentAssignment` of a role maps to the Nth same-prominence character
via `characterForRoleSlot(script, role, N)` (`engine/castRequirements.ts:33`).

Because a hire can only ever land at the next append index, the UI must
forbid confirming a later slot before an earlier one — otherwise a hire
meant for Supporting slot #3 would silently misfile into slot #1. That gate
is what the player hits:

- `CastingDrawer.tsx:139` — `canActFromHere = !alreadyCast && slotIndex === hired.length`; the Cast/Make Offer button is `disabled` otherwise, with a "Cast X first — roles cast in order" banner (`:214-220`).
- `HireTalent.tsx:122` — `isNextUp = slotIndex === hired.length`; non-next rows get `casting-row-blocked` and "Waiting — cast X first" (`:129,149-155`).

Two costs to the player: (a) you can't cast the role you care about first,
and (b) there's no way to recast a single character without tearing down
everyone hired after them.

---

## 2. The change: bind to a character, not a position

Add one optional field:

```ts
export interface TalentAssignment {
  role: ProductionRole;
  person: Person;
  characterId?: string; // ScriptCharacter.id, for Lead/Supporting Actor. Absent for crew (no character) and for legacy/rival talent (positional fallback).
}
```

The actor↔character link stops being "Nth of role → Nth character" and
becomes "this assignment names its character directly."
`characterForRoleSlot` stays — but only for **iterating** the character list
in the UI and for capacity, never again for **resolving** who plays whom.

Two rules the reducer now enforces explicitly (they were previously implicit
in append order):

1. **One actor per character.** Hiring into a `characterId` that's already
   filled *replaces* that binding (this is recasting) rather than appending.
2. **Capacity = every character of that prominence bound.** Unchanged in
   value (`effectiveRoleCapacity` still derives from
   `requiredLeads`/`requiredSupporting`), just checked against distinct bound
   characters instead of a raw count.

---

## 3. Backward-compat: the positional fallback (do not skip this)

Make `characterId` **optional**, and have every reader prefer it but fall
back to the current positional inference when absent:

```ts
// conceptual
const character = a.characterId
  ? script.cast.find((c) => c.id === a.characterId)
  : characterForRoleSlot(script, a.role, indexWithinRole);
```

This buys three things:

- **Rivals keep working.** `engine/rivalStudios.ts:630` builds cast in
  `pickMany` order; it can adopt `characterId` for correctness, but nothing
  breaks if a given path hasn't yet.
- **Existing casts score identically.** For any cast assembled in append
  order (i.e. every cast that exists today), the bound character *equals* the
  positionally-inferred one, so `computeActingScore` returns the same number.
  Only genuinely out-of-order casts — impossible before this change — differ.
  This is what keeps the seeded scoring/box-office tests green.
- **Incremental rollout.** PR 1 can write `characterId` everywhere and flip
  readers, with the fallback covering anything missed, before PR 2 exposes
  out-of-order casting in the UI.

---

## 4. What actually has to change (the small core)

| Area | File:line | Change |
|---|---|---|
| **Type** | `types/index.ts:1160` | add `characterId?: string` |
| **Primary write** | `studioReducer.ts:847` `TOGGLE_TALENT_FOR_ROLE` | action carries `characterId`; write it; gender-check against *that* character (not `characterForRoleSlot(..., current.length)` at `:864`); if the character is already bound → replace binding (recast) instead of append at `:873` |
| **Mid-shoot recast** | `studioReducer.ts:402` `resolveChoiceOnDraft` | carry `outgoing.characterId` onto the replacement `{ role, person }` so a replaced actor keeps the same character |
| **Rival cast build** | `rivalStudios.ts:630` | zip picked actors against the role's characters to assign `characterId` (keeps rival films' `computeActingScore` correct; optional thanks to the fallback, recommended for consistency) |
| **Acting score** | `scoring.ts:110-138` `actorFitScore`/`computeActingScore` | resolve the character from `a.characterId` (fallback to index `i`) instead of always inferring from `i` |
| **Cast-state check** | `castingCalls.ts:219` `isCharacterCast` | becomes `draft.talent.some((a) => a.characterId === character.id)` — order-free and simpler; drives `castingCallsAwaitingReview` (`:228`) and the Inbox |
| **Gender** | `engine/casting.ts` | `personMeetsCharacterGender` unchanged; the reducer just checks against the passed `characterId`'s character rather than the positional one — a simplification |

---

## 5. What does NOT change (the reassuring part)

Everything below reads talent **by role aggregate only** and is untouched:

- `computeTalentCost` (`cost.ts:7`) — sums salary by `.role`, order-irrelevant.
- `averageFame` (`releaseFilm.ts:24`), `computeMarketabilityScore`,
  `computeBuzzScore`, `computeGenreFitScore` (`scoring.ts`) — all average by role.
- `computeAudienceScore`/`computeCriticScore` — read `qualityScore`/aggregates.
- Awards contenders (`awards.ts:74-141`) — each performer scored individually
  via `computeTalentCompatibility` (script-level, **not**
  `characterForRoleSlot`); no "first lead = headliner."
- `computeAttachmentMomentum` (`castingAppeal.ts:116`) — sums over whole cast.
- Production day/cost math (`production.ts`) — role filters / random picks.

Confirmed: **no "position 0 is special" convention exists anywhere.** The
only meaning array order carries today is the character-slot mapping itself —
which this change replaces with something explicit. Nothing hidden to
preserve.

---

## 6. `RoleHiringDrawer`'s actor path is dead — leave it alone

`RoleHiringDrawer` is mounted in exactly one place (`HireTalent.tsx:375`),
opened via `openRole`, which is only ever set for **crew**:

- Director — `HireTalent.tsx:350`
- Mandatory crew — `crewRoles`, explicitly *minus* Director/Lead/Supporting (`:269-271`, rendered `:367`)
- Optional crew — `OPTIONAL_TALENT_ROLES` (`:370`)

Actors go through a separate path entirely: `CharacterCastingSection` →
`onOpenCharacter` → **`CastingDrawer`** (`:359-383`). So `RoleHiringDrawer`
is never invoked with `role === 'Lead Actor' | 'Supporting Actor'`, and its
`nextCharacter = characterForRoleSlot(...)` branch (`:118-120`) no-ops for
crew (`characterForRoleSlot` returns `null` for non-actor roles). The code
comments corroborate: *"the old shared-per-role RoleHiringDrawer Phase A used
as a stopgap"* (`HireTalent.tsx:176`), *"Director/crew still use that
unchanged"* (`CastingDrawer.tsx:99`).

**Implication:** `RoleHiringDrawer` needs zero changes for slot-binding. Its
vestigial actor-capable logic is now genuinely dead for its real inputs;
deleting it is a valid follow-up housekeeping pass but is deliberately kept
**out** of the slot-binding PRs to keep their diffs focused.

---

## 7. UI unlock (mechanical, PR 2)

- **`CastingDrawer.tsx:131-220`** — delete `alreadyCast`/`canActFromHere`/
  `blockingCharacter` and the "cast X first / roles cast in order" banner.
  The Cast button is always enabled (subject to gender + capacity). The
  drawer already has the concrete `character` in scope, so it passes
  `character.id` on dispatch (`:164`). The `alreadyCast` branch flips from
  "Recasting isn't supported yet" (`:211-212`) into an actual swap.
- **`HireTalent.tsx:101-158`** `CharacterCastingRow` — delete
  `isNextUp`/`casting-row-blocked`/`blockingCharacter`; each row is
  independently castable; `cast = draft.talent.find((a) => a.characterId === character.id)`.
- CSS: `casting-row-blocked` and the blocked-banner styles become dead — remove.

---

## 8. Persistence

Bump `SAVE_KEY` v41 → v42 (`persistence.ts:260`) with a new comment block, per
this file's established convention (no migration code; an incompatible save
simply regenerates a fresh studio in `loadState`). Because `characterId` is
optional with a positional fallback, an un-bumped old save would technically
still load and behave via the fallback — but bumping is the honest signal
that the stored shape changed, matching the exact precedent of the v31→v32
note.

---

## 9. Tests

- **Update literals** to attach `characterId` — and note it gets *simpler*,
  not harder, where it lands:
  - `state/testFixtures.ts:79-81` (`buildReadyDraft`).
  - `state/realFilmRegression.test.ts` `realTalent`/`weakTalent` — bind
    `characterId` straight from `script.cast` instead of relying on push
    order + `conformActorGenderToSlot(..., i)`.
  - `scoring.test.ts:130-143`, `castingCalls.test.ts:160,176,361`.
- **Unchanged:** `castRequirements.test.ts` — `characterForRoleSlot` still
  exists and still maps positionally; it's just no longer the sole resolver.
- **New behavioral tests (the point of the whole change):**
  1. Cast Supporting slot #2 before slot #1 — succeeds, binds correctly.
  2. Recast a single character — the other characters' bindings are untouched.
  3. Double-booking one character is rejected / replaces, never duplicates.
  4. Fallback parity — a cast with no `characterId` scores identically to the
     same cast with explicit bindings (locks in §3).

---

## 10. Risks

1. **Acting-score drift.** Binding makes per-actor character-fit *correct*
   rather than positional. The positional fallback neutralizes this for every
   cast that exists today; only newly-possible out-of-order casts differ.
   *Low.*
2. **Double-booking / capacity edge cases.** New explicit rules (§2) — needs
   test coverage (§9.3), but the logic is small.
3. **Recast interaction with mid-shoot events.** `resolveChoiceOnDraft:402`
   already recasts during production; the pre-release UI recast must use the
   same binding-preserving write so the two paths agree. Covered by §4 +
   §9.2.
4. **`RoleHiringDrawer` regressions.** None expected — it's untouched and
   never receives actor roles (§6).

---

## 11. Phasing

- **PR 1 — model + engine (invisible, ships green).** Add the field; thread
  `characterId` through all write sites (`TOGGLE_TALENT_FOR_ROLE`, recast,
  rivals, fixtures); flip the two readers (`computeActingScore`,
  `isCharacterCast`) with the positional fallback; save bump; fallback-parity
  test. Zero behavior change. This is where the real correctness work lives.
- **PR 2 — UI unlock (the visible win).** Remove the gates in `CastingDrawer`
  and `HireTalent`'s `CharacterCastingRow`; enable single-character recast;
  add the out-of-order + recast behavioral tests; delete the dead
  blocked-state CSS.

**Effort:** the core is genuinely small (a type field + one reducer case +
two reader tweaks). The bulk is UI ungating and test updates. Roughly one
focused day per PR.

---

## 12. Out of scope (deliberately)

- Deleting `RoleHiringDrawer`'s vestigial actor branch (housekeeping, later).
- Any change to crew hiring, casting-call generation, or the appeal/accept
  math — all of it is already per-character or role-aggregate and needs
  nothing here.
- Renaming `TOGGLE_TALENT_FOR_ROLE`/`SET_TALENT_FOR_ROLE` to a per-character
  vocabulary — the same low-value, high-diff-noise rename the casting
  redesign already parked (§ its own note); do it, if ever, as its own pass.
