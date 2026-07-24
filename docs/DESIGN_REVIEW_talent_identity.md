# Design Review — Talent Identity on the Casting Card ("Layer 2")

Status: **shipped.** Part of a larger effort to make people feel unique and
alive rather than clinical. This is the presentation slice: lead the casting
card with *who an actor is*, so the choice reads as a person to pick between
rather than a role-fit score to sort by.

## The problem

Two "Excellent Match" candidates on the casting screen are interchangeable: the
card leads with **Role Fit** — a per-role number — and buries everything that
makes an actor a distinct person. A player rationally sorts by role fit and
takes the top, every time. Nothing surfaces *what they're uniquely good at*, how
they behave, or the trade they represent.

## What shipped

All derived from existing data — **no new stored state, no save bump.** The
engine returns categories; presentation owns the prose (house style).

- **Signature gift** (`actingModel.ts:signatureGift` → `castingPresentation.ts:
  describeSignatureGift`). An actor's standout `ActingStyle` axis, when one
  clearly stands out, as the lead line: *"A gifted comic with impeccable timing."*
  This is the "uniquely gifted at X" read — independent of the current role,
  unlike Role Fit. Two tiers (`defining` / `notable`), two phrasings each per
  axis, id-hash-selected so the same person always reads the same and different
  people diverge. Actors are spiky by construction (`generateSignatureProfile`),
  so almost every actor has one.

- **Fame-vs-craft contrast** (`actingModel.ts:fameCraftContrast` →
  `describeFameCraftContrast`). Names the marquee-vs-performance trade the sim
  already implies (fame and craft are generated on separate axes): a famous
  `coaster`, an `undiscovered` talent, or a genuine `star-and-craft`. Silent
  when fame and craft roughly agree, so it only speaks when there's a real trade.

- **Card reorder** (`TalentStats.tsx`). For actors, the identity block — gift,
  craft archetype (`describeActorCraft`), fame/craft contrast, director pairing —
  now leads, *above* the role-fit verdict. The verdict keeps its elevated block
  but gains a "How they fit this part" caption so it reads as one axis, not a
  global judgment of the person.

## Depth check

Empirically (400-actor generated pool, seed 20260724): **139 distinct identity
combinations**, gifts spread evenly across all five axes and both tiers, and the
contrast adds a second differentiating axis (~40% of actors carry one). The
"after 10 cards they all sound the same" failure mode does not occur; variety
compounds further once personality generation ("Layer 1") lands and trait chips
start firing.

## Coordination seam for "Layer 3" (studio↔person memory)

The actor identity block in `TalentStats.tsx` (`.talent-identity`) is the
intended home for a relationship read. Layer 3 should expose a
`describeRelationship(studio, person)` in `castingPresentation.ts`; this card
places it there. Layer 3 owns the read, this layer owns the placement.
