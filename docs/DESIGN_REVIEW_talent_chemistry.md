# Design Review — Talent Chemistry (persistent talent↔person pairings)

Status: **proposed — draft for review.** No code written. This doc argues for
*where* the value is and *what shape* the feature should take, so the phasing
can be committed to before anyone writes an engine module.

## The one-sentence thesis

The chemistry *payoff* is already built and scattered across three
disconnected half-features; the missing piece is the **cause** — which
specific people are working together, and whether they have clicked before.
The work is mostly wiring existing signals into a causal chain
(`SIMULATION_PHILOSOPHY.md` Principle 7), plus one genuinely new piece of
persistent state (a talent-pair history), *not* a new parallel chemistry
system.

## The problem

Casting today is evaluated one seat at a time. Each hire is scored against the
*script* (`engine/compatibility.ts` — talent↔tone and actor↔character fit) and
against the *studio* (`engine/relationships.ts` — loyalty vs. grudge). Nothing
scores a hire against **the other people already in the room**, and nothing
remembers that a director and a lead made a hit together last year. Two
identical casts assembled from the same pool are interchangeable, and the
sim can't produce the single most evocative thing about how films actually get
made: the recurring partnership. There is no Scorsese–Schoonmaker, no
Burton–Depp, no two-leads-who-crackle.

Meanwhile the sim already *pays out* chemistry — it just fires it from a roll,
uncorrelated with who's on set, which is exactly the "hidden release-time roll"
the philosophy forbids (`SIMULATION_PHILOSOPHY.md` non-goals).

## What already exists (the substrate we're connecting)

Three half-built pieces, all real, none aware of each other:

1. **Chemistry as a production outcome — built end to end.**
   `data/productionEvents.ts` carries `pos-chemistry` (line 154) and a full
   romance cluster: `genre-romance-pos-chemistry`,
   `genre-romance-neg-no-chemistry`, an interactive `genre-romance-int-chemistry-window`,
   and `genre-romance-int-forced-chemistry` (lines 1006–1104).
   `engine/productionExecution.ts:48` routes the `chemistry` keyword into the
   **performances** execution channel, so "chemistry lifts captured
   performances" already flows through the normal pipeline. **But these events
   are selected from risk-weighted genre/general pools
   (`engine/production.ts:598`), blind to which two people are in the scene.**

2. **The negative pole of a pairing — built, narrow.**
   `engine/creativeTension.ts` models director↔actor *friction* from ego ×
   inflexibility (`pairFriction`, line 41; `computeCreativeTension`, line 61)
   and feeds it into `moraleRisk` as `tensionRisk`
   (`engine/production.ts:244`). It is exactly the right *shape* — a **risk
   amplifier**, not a flat penalty — but it is (a) director↔principal only,
   (b) computed fresh from personality every film, with **no memory**, and
   (c) one-sided: there is no positive counterpart.

3. **A stylistic pairing read — presentation only.**
   `engine/actingModel.ts:267 directorActorPairing()` →
   `castingPresentation.ts:136 describeDirectorActorPairing()` already tells the
   player how a director and actor suit each other in prose. It is a read, not
   a mechanic.

The studio↔person system (`engine/relationships.ts`, the flat `Collaboration`
log at `types/index.ts:2216`) is the fourth relevant piece: it is the *template*
for persistent, record-on-settlement, recomputed-on-read history — but it keys
`(studio, person)`, and chemistry keys `(person, person)`.

## Why this is the highest-value axis

Weighed against the other two things "relationships" could mean:

- **Studio↔person breadth** (widen recorded roles, give rivals a real read):
  incremental. It smooths and de-strangers hiring — a *convenience/loyalty*
  layer. Low narrative payoff per unit of work.
- **New entities** (agents, critics): high cost, unclear payoff, and a direct
  departure from Principle 7 (they don't exist to connect *to*).
- **Talent↔person chemistry**: this is the *emergent-narrative + trade-off*
  layer.
  - It creates a real decision (Principle 6): a **proven pairing** vs. a
    **better individual fit**. Keeping the band together has a cost.
  - It makes two identical scripts diverge for a legible reason (Principle 1):
    the people clicked, or they didn't, and the player can see it.
  - It is the thing players narrate to themselves. A director + editor on their
    third film together is a *story you cultivated*, not a stat you read.

## The design, in one shape

**Make specific pairings — and their accumulated history — drive the odds and
size of the chemistry events that already exist. Both poles. Symmetric with
`creativeTension`.**

Two inputs, deliberately kept separate:

- **Pairing baseline (personality, computed fresh).** Generalize what
  `creativeTension` already does from friction-only into a signed
  **pair reading**: the same ego/adaptability/style inputs can read as a
  natural fit *or* a clash. This is the per-film, no-memory term — a fresh
  pairing is a genuine gamble in both directions.
- **Pairing history (persistent, remembered).** A new talent-pair log,
  recorded on settlement exactly like `Collaboration` is. Shared history
  **modulates reliability**: a duo that has clicked before lands the good
  outcome more consistently and rides out a rough shoot; a pairing that blew up
  carries that friction forward. History narrows variance around a known
  quantity — it does not manufacture a bigger bonus.

Both feed the **risk/event layer**, never the quality total directly:

- A strong positive pairing raises the eligibility weight / severity ceiling of
  the positive chemistry events (`pos-chemistry`, the romance chemistry
  window) and lowers it for the negative ones.
- A strong negative pairing does the reverse, on top of the existing
  `tensionRisk` path it already drives.

This is the crucial guardrail: **chemistry shapes the distribution, not a flat
`quality += n`.** Upside stays earned through a positive execution event that
can still break either way (`SIMULATION_PHILOSOPHY.md:215–225`), and variance
stays inside the production where the player can watch it happen — never a
release-time roll.

## The casting-time decision surface

Everything above changes *outcomes*. The bigger gameplay lever is making
pairings change *decisions* — surfacing them while the player is still choosing
who to hire, so the roster you've already signed pulls on who you sign next.
Two levels, escalating in force:

- **Passive — affinity highlights.** When filling a role, flag candidates who
  have a strong positive pairing (baseline or history) with someone **already
  signed to this film**: *"Your director has made two hits with this
  cinematographer."* / *"These two leads have crackled before."* It reads the
  same `pairChemistry`/history the outcome layer reads, just at the casting
  card instead of on set — so the player can *deliberately assemble a band*
  rather than discover it after the fact. The negative symmetry matters too:
  quietly de-emphasise (or warn on) a candidate a signed person has a real
  grudge with, so a bad pairing is a visible cost, not an ambush.

- **Active — demands and vetoes.** A signed person can make their participation
  *conditional on a specific collaborator*. A high-ego, high-loyalty star asks
  for their trusted director or their favourite DP; refuse and their warmth
  drops, or at the extreme they walk (the hard-refusal path in
  `resolveOfferResponse` already exists — this feeds it). The veto is the mirror
  image: *"I won't do the film if they're the editor."* Now the player has a
  genuine choice with no clean answer — bring in the demanded person (who may be
  a worse individual fit, pricier, or already booked elsewhere), or hold the
  line and pay the relationship cost. That is Principle 6 (real trade-offs)
  expressed as a casting event rather than a slider.

The demand is where two otherwise-cosmetic personality axes finally do work:
**ego** decides *who is entitled to make demands at all* (a deferential
character never issues one), and **loyalty** decides *how hard they push and how
much a refusal costs* (`PersonPersonality.ego`/`loyalty`, `types/index.ts:263`,
noted as read by no formula today). Wiring them here is a clean Principle-7 win —
the same move `creativeTension` made for ego/adaptability.

Mechanically the demand should reuse the existing decision-surface pattern
(the `OnSetDecisionCard` shape, or a casting-time inbox request) rather than a
new modal — a bounded choice with a stated consequence on each branch, so it
stays legible.

## Phasing

Each phase is independently shippable and independently valuable; later phases
add pairing surfaces, not rework.

- **Phase 0 — Signed pairing baseline (no new state).** Generalize
  `creativeTension`'s `pairFriction` into a signed `pairChemistry(a, b)` on the
  director↔actor pair it already reads. Wire the positive side into the
  positive chemistry events' selection weight; keep the negative side on its
  existing `moraleRisk` path. Ships a real mechanic with **zero save impact** —
  it's all derived from personality already in the pool. Proves the event-weight
  seam before any persistence is added.

- **Phase 1 — Actor↔actor co-stars.** Extend the baseline to lead↔lead and
  lead↔supporting pairs — the evocative case for romance and ensembles, and
  where `genre-romance-*-chemistry` already wants a cause. Still no new state.

- **Phase 2 — Pairing memory (new persistent state, save bump).** Add the
  talent-pair history log and the record-on-settlement plumbing (see Open
  questions on reuse vs. parallel). History modulates the reliability of the
  Phase 0/1 baseline. This is the phase that turns a per-film modifier into a
  *relationship the player builds*. Bump `SAVE_KEY` (`persistence.ts:345`);
  **no migration** per pre-launch policy (`CLAUDE.md`).

- **Phase 3 — Crew pairings.** Director↔editor and director↔cinematographer
  (both real `ProductionRole`s — `types/index.ts:39`). The recurring-crew
  fantasy. Routes to the relevant execution channel (an editor pairing touches
  post/coverage, not performances), keeping consequences typed
  (`SIMULATION_PHILOSOPHY.md:227`).

- **Presentation (spans all phases).** A pairing read on the casting card,
  placed like `describeRelationship` — qualitative tiers and prose, never raw
  numbers (`CLAUDE.md`). The `directorActorPairing` prose is the tone template.

- **Phase 4 — Affinity highlights (passive decision surface).** The casting
  card flags candidates with strong positive (or negative) pairings against
  already-signed talent. Pure presentation over the Phase 0–3 signal; no new
  state. Lands the "assemble a band on purpose" fantasy at the point of
  decision. Best value once Phase 2 history exists, but works on the Phase 0
  baseline alone.

- **Phase 5 — Demands and vetoes (active decision surface).** A signed person
  conditions their participation on a specific collaborator, driven by ego
  (entitlement to demand) and loyalty (push/refusal cost). Reuses the
  decision-card / casting-request pattern and the existing hard-refusal path.
  This is the highest-drama phase and the one that makes the roster feel like
  people with their own agendas — sequence it last because it leans on every
  prior phase's signal being trustworthy.

## Open questions to settle before Phase 2

1. **Reuse the `Collaboration` substrate or add a parallel pair-log?** A pair
   history is a genuinely different key `(personA, personB, filmId, outcome)`
   vs. the studio-keyed `Collaboration`. Reusing means generalizing the record
   site in `studioReducer.ts`; a parallel log is cleaner-shaped but duplicates
   the idempotent-record-on-settlement plumbing. Recommendation: **parallel
   log, shared plumbing** — the keys are too different to force into one shape,
   but the record-once-on-settlement helper should be lifted and reused.

2. **How does a pairing outcome get scored?** `Collaboration` stores
   `reception` + `shootSmoothness`. A pairing wants "did *this pairing* go
   well," which is closer to the film's execution/morale result than its box
   office. Likely the same two signals, but confirm the pairing reads
   `shootSmoothness` more heavily than reception.

3. **Decay / recency.** Should a partnership fade if unused for years? The
   studio↔person system currently doesn't decay (it stores `lastWorkedDay` but
   doesn't read it). Chemistry has a stronger real-world case for it. Deferred,
   but the `lastWorkedDay` field is already there to hang it on.

4. **Rivals.** Do AI studios' recurring pairings matter (a rival that keeps a
   duo together locks them up, the same way `Collaboration.studioId` anticipates
   rival loyalty)? Out of scope for v1; the pair-log should be studio-agnostic
   so it *can* extend there without rework.

5. **How binding is a demand (Phase 5)?** Spectrum from soft (refuse and take a
   warmth hit) to hard (refuse and they walk via `relationshipRefuses`). Likely
   ego/loyalty-scaled — a mid-tier character's demand is a preference with a
   cost, a marquee star's is closer to an ultimatum. Also: does a demand fire at
   offer time, or only once they're signed and you're filling the *next* seat?
   The latter is more interesting (you already committed) but needs the casting
   flow to support a mid-assembly interruption.

6. **Demand frequency / annoyance budget.** Demands are high-drama and therefore
   easy to overuse — if every signing triggers one, they stop reading as
   character and start reading as tax. Needs a rarity gate (per-film cap, or
   only the highest-ego signed person may demand), tuned like an event rate, not
   left to fire on every eligible pair.

## Testing frequency and occurrence (Phase 5, and any rate-gated behaviour)

A demand is a rare stochastic event, so "does it fire correctly" and "does it
fire *the right amount*" are two different tests, and the second is the one that
protects the annoyance budget. The sim is deterministic under a seeded
`RandomFn`, so both are checkable:

- **Deterministic mechanics (normal suite, `npm test`).** Seeded unit tests
  asserting the *logic*: given a pairing + ego + loyalty, a demand does/doesn't
  become eligible; ego gates entitlement; loyalty scales the refusal cost;
  refusing applies the warmth hit or the walk (`relationshipRefuses`). Fixed
  seeds, exact assertions — the shape of `relationships.test.ts` and
  `creativeTension.test.ts`.

- **Statistical frequency (opt-in diagnostic harness).** A new
  `demands.diagnostic.test.ts` in the mould of the existing
  `*.diagnostic.test.ts` harnesses (env-gated, `--disable-console-intercept`,
  skipped in the normal suite — see `CLAUDE.md`). Run many seeded films / many
  seeds and assert on the *distribution*, not a single outcome:
  - demands land inside an expected per-film / per-career rate band (the
    annoyance-budget guarantee);
  - they don't cluster (no run where three fire on one film, no roster that
    demands every signing);
  - the rate *scales as designed* — a high-ego roster produces measurably more
    than a deferential one, confirming ego is actually the driver and not noise.

  These are trend assertions with tolerance bands, like the AI-stats and
  production-execution diagnostics already do — the honest home for "over time,
  this feels right," which a fixed-seed unit test can't express.

The same two-layer approach applies to the chemistry-event weighting itself
(Phases 0–1): a unit test that a strong pairing *raises* the positive event's
weight, and a diagnostic that over many shoots a proven duo actually hits the
positive chemistry event more often than a fresh pairing — the payoff the whole
feature rests on, and exactly the kind of claim that needs a distribution, not
an anecdote, to trust.

## What this deliberately is not

- Not a flat quality bonus for a good pairing (Principle: upside is earned in
  execution, not handed out).
- Not a new scoring formula parallel to `compatibility.ts` — chemistry is a
  *between-people* term feeding the *risk/event* layer, orthogonal to the
  *person↔script* fit that already exists.
- Not a hidden roll — every chemistry swing is anchored to a specific,
  inspectable pairing and surfaces on the casting card.
