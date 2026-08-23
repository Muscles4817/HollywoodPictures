# Design Review — Project Clocks & Script Openness (Phase 5)

Phase 5 of `docs/SIMULATION_PHILOSOPHY.md`: **creative disagreement as an
explicit risk amplifier, so competing creative visions widen the outcome
distribution instead of merely subtracting a few points.**

This document scopes that phase wider than its one-line entry in the philosophy
suggests, because the audit below found that the phase's stated goal is blocked
by something more basic: **the game has time, but nothing in it decays with
time.** Creative disagreement cannot amplify risk while the player can always
resolve the disagreement for free by waiting.

The through-line:

> A project accrues valuable commitments → time threatens those commitments →
> development can continue but cannot preserve everything → the player commits
> despite unresolved concerns → production reveals and responds to those
> concerns → late changes create integration debt in proportion to what has
> already been prepared or captured.

This replaces two framings that were considered and rejected: *"unfinished
scripts take a penalty"* (a flat modifier, no decision) and *"open scripts have
more variance"* (a knob, which the philosophy's own non-goals forbid).

**Deliberately out of scope for the current slice** (§5–§6 record them so they
are not lost): release corridors, prep payroll burn, financing and rebate
expiry, rewrite approval rounds, dailies, pickups and reshoots, creative
commitment graphs, and post-production reconstruction.

---

## 1. The audit — why waiting is strictly dominant

Traced through the engine as it stands.

### 1.1 The rewrite lever and the commitment machinery live in disjoint phases

This is the root cause, and it is sharper than "there are no clocks."

`Asset.pendingRewrite` (`src/types/index.ts:2080`) carries the contract in its
own doc comment:

> *While set, the Asset can't start a Project or a second pass.*

So a rewrite runs **only** on a library Asset, and an Asset with a rewrite in
flight **cannot** become a Project. Meanwhile every perishable thing in the game
— talent bookings, cast and crew attachment, spend commitments, the prep run —
attaches to a `FilmDraft`, i.e. only *after* the rewrite is finished and the
project has started.

The two systems are mutually exclusive by construction. Development happens in
the one phase of the game where nothing can be lost. That is why waiting is
dominant: it is not merely that clocks are missing, it is that **the lever and
the stakes can never be in the room at the same time.**

Every other finding below is downstream of this one.

### 1.2 Rewrite time is free and exactly knowable

`engine/rewrite.ts:rewriteDurationDays` is fully deterministic:

```text
DURATION_BASE[kind] + round((script.complexity / 100) * DURATION_COMPLEXITY[kind])
```

A polish is 10–16 days, a rewrite 24–36, computable to the day before
committing. Nothing consumes those days but the calendar. The craft outcome is
rolled once at commission and stored in `PendingRewrite.craftChanges`, which is
the correct determinism shape (§4.2 reuses it) — but the *cost* side is a known
quantity of a resource that has no other claimant.

### 1.3 Script craft carries zero production risk

`engine/production.ts:285 computeStaticProductionRisk(talent, script, choices, genre)`
returns the four dimensions — `moraleRisk`, `safetyRisk`, `technicalComplexity`,
`budgetRisk`. Of the screenplay it reads **`script.complexity` only**, which
`types/index.ts:795` explicitly documents as *production scope, not quality*.

`structure`, `characters` and `dialogue` — the three axes a rewrite exists to
improve — are read by scoring and by nothing else. A structurally broken script
and a brilliant one of equal complexity enter photography on mechanically
identical terms. The thing the player spends time and money fixing has no
consequence for the process that time and money are being taken from.

### 1.4 The release date is chosen after the film is finished

`state/studioReducer.ts:2705 SCHEDULE_RELEASE` gates on `d.testScreeningResolved`
— post-production is complete and the test screening resolved before a date can
be claimed. There is no date to be late for, and therefore no corridor to
protect. (`engine/releaseCrowding.ts` already models contested corridors; it
simply never gets to apply pressure backwards onto production.)

### 1.5 What is *already* built — more than expected

The perishability substrate is largely present and unused for this purpose:

- **Talent windows.** `engine/castingAppeal.ts:140-146` already returns
  `'available' | 'requires-delay' | 'unavailable'` with a `delayDays`, computed
  against a `plannedStartDay`. `MAX_SCHEDULE_OVERLAP_DAYS` already bounds how
  far a booked actor can be waited for.
- **A provisional start date.** `FilmDraft.plannedStartOffsetDays`
  (`types/index.ts:2684`, `state/staffingBoard.ts:124`) already lets the player
  push the planned shoot start out to wait on booked talent. **This is a target
  start in all but name.**
- **Commitment writing.** `engine/person.ts:170 addCommitment` appends to
  `PersonAvailability.commitments`, which already supports overlapping
  obligations across careers.
- **Genuine scarcity.** `engine/rivalStudios.ts:794` filters candidates on
  `isPersonAvailableOnDay` and accumulates `bookedIds`. Rivals already compete
  with the player for the same finite people.
- **Alignment.** `engine/creativeTension.ts` reads the director↔lead pairing as
  a signed relationship and feeds `moraleRisk` as a *risk amplifier, never a
  flat penalty* — its header already cites this phase. `engine/crewPhilosophy.ts`
  gives creative heads a practical↔digital / naturalistic↔stylised vector, but
  its own header notes it *"feeds the relationship reads only — never cost or
  scoring."*
- **Typed consequences.** `engine/productionExecution.ts:classifyEventImpact`
  already routes events to `script`, `pacing`, `coverage`, `performances`,
  `sets`, `vfx`, `practical`, `visual`, `general`. The `script` bucket exists
  and is already fed by `int-writer-punch-up`, `int-writer-rewrite-struggle`
  and `preprod-int-rewrite-window` in `data/productionEvents.ts`.
- **Integration debt, for exactly one case.** `scoring.ts:editCoverageCeiling`
  on `execution.coverageRatio` implements *"you cannot cut footage you did not
  shoot."* The philosophy doc already calls this *"the exact template for typed
  production consequences."* §3.5 generalises it rather than inventing anything.

The conclusion the audit forces: this phase is mostly **wiring already-modelled
signals into the same phase of the game**, per Principle 7 — not new machinery.

---

## 2. The causal model

```text
Development produces a script with KNOWN and DISPUTED concerns          [§3.2]
        ↓
The project accrues COMMITMENTS with windows and expiry                 [§3.1]
        ↓
Continuing development consumes UNCERTAIN time                          [§3.1]
        ↓
        ├─ preserve the draft, lose a commitment
        └─ preserve the commitment, carry the concern into production
        ↓
Concerns become TYPED PRODUCTION EXPOSURE, not a flat penalty           [§3.3]
        ↓
Openness policy decides what may change once shooting starts            [§3.4]
        ↓
Changes generate INTEGRATION DEBT scaled by what is already captured    [§3.5]
        ↓
Unresolved debt reads out as incoherence; resolved debt reads as a
better film than the script alone implied
```

Two properties this model must preserve, both non-negotiable:

**The engine stays deterministic.** Nothing is rolled at release. Every value
above is a read of authored project state, recorded decisions, actual production
events, personnel capability and captured footage. Uncertainty lives in *what
the player knows when they must decide*, never in *how the engine resolves what
they chose*. (Philosophy Principle 2 and its explicit non-goal.)

**Scarcity precedes uncertainty.** The decision is made interesting by
incommensurable assets — a draft, a star's window, a location's season, a
corridor — that cannot be reduced to one currency. Imperfect information is
texture applied on top of that structure. Applied *instead* of it, it would only
fog an easy decision, which is the failure Principle 3 warns against. This
ordering is why §3.2's evaluator disagreement is scoped but not in the slice.

---

## 3. Phase 5 foundations

### 3.1 Project clocks and commitments

Three distinct dates, replacing today's single implicit one:

| Date | Meaning | Commitments |
| --- | --- | --- |
| **Target start** | Provisional intent. Already exists as `plannedStartOffsetDays`. | None. Freely movable. |
| **Committed start** | Set at `GREENLIGHT_PROJECT`. Cast, crew and facilities lock around it. | Real. Moving it has consequences. |
| **Production start** | Principal photography actually begins. | Spent. |

Moving a committed start must be *possible and consequential*, never forbidden.
The intended outcome space:

- delay and retain everyone, paying extension costs;
- delay and lose one specific attachment;
- recast to preserve the start, changing the film creatively;
- reduce rewrite scope to fit the window;
- begin production with the rewrite still running.

`GREENLIGHT_PROJECT` (`studioReducer.ts:1982`) is already the moment talent is
booked and cost charged, and it already hands off to a live day-by-day prep run
rather than settling a lump of calendar. It is the natural seam for
`committedStartDay` with no restructuring.

### 3.2 Script concerns at greenlight

A concern is an **observation about the screenplay that the player can see and
that may be disputed**, not a hidden number. Concerns are derived from stored
craft axes plus tone coherence; they are not a new rolled stat (Principle 8).

The greenlight gate already has the right shape: `engine/projectReadiness.ts`
distinguishes **blockers** from **warnings**, and its
`ProjectReadinessWarningCode` union is where script concerns belong. Warnings
never block — *"underfunding an ambitious setting is a real, allowed choice,
just one the player should see coming."* Greenlighting a script with a known
structural concern is the same class of choice.

Evaluator disagreement — a story analyst who is wrong about austere drama, a
director whose confidence is not calibrated, a lead who objects to a motivation
— is the intended long-term texture, using organs that already exist
(`storyReport.ts`, `marketResearch.ts`, `testScreening.ts`, `directorPitch.ts`).
It is **explicitly deferred past the slice** per §2's ordering. Note that
`CLAUDE.md` already mandates qualitative player-facing presentation, so the
"player never sees the raw number" half is standing policy, not new work.

### 3.3 Typed production exposure

A concern must not raise a generic risk number — that would discard exactly the
typed causality Phase 1 was built to create.

Each weakness changes the probability or severity of *particular* problems:

| Concern | Production exposure |
| --- | --- |
| Weak structure | Conflicting scene purposes, coverage inflation, assembly problems |
| Weak characters | Actor objections, interpretation drift, performance inconsistency |
| Weak dialogue | Page changes, improvisation, additional takes |
| Tonal instability | Creative tension between director, cast and departments |
| Production impracticality | Schedule pressure, redesigns, budget escalation |

Shape (contributes into the existing four dimensions rather than replacing
them, so every current consumer of `StaticProductionRisk` keeps working):

```ts
export type ScriptExposureKind =
  | 'structural-instability'
  | 'character-ambiguity'
  | 'dialogue-rawness'
  | 'tonal-instability';

export interface ScriptExposure {
  kind: ScriptExposureKind;
  severity: number;   // 0-1, derived from the stored craft axes
  cause: string;      // the named, player-facing reason
}
```

`computeStaticProductionRisk` keeps its current return shape and gains these as
inputs; the exposure list is preserved alongside it for reporting and for
gating `impact: 'script'` and `impact: 'performances'` events later.

### 3.4 Script openness policy

Binary locked/open was rejected as too clean: real productions hold different
elements at different stabilities, and "script lock" is an administrative status
rather than proof that change has stopped. But the underlying model must not
become a screenplay simulator (§6).

The middle position — an authority-and-scope policy over the axes that already
exist:

| Policy | What may change during production |
| --- | --- |
| **Strict lock** | Nothing without producer approval |
| **Performance flexibility** | Dialogue and blocking; structure fixed |
| **Targeted rewrite** | One identified concern remains open |
| **Live development** | Substantial structural change permitted |
| **Emergency intervention** | Normal authority overridden to repair a crisis |

This makes "how open is this production?" a creative-management decision rather
than a binary gamble, and it gives the existing `preprod-int-rewrite-window`,
`int-writer-punch-up` and `int-writer-rewrite-struggle` events a policy context
to fire within.

**Design constraint:** openness must not be an objectively superior strategy for
well-cast productions. The earlier framing — *"open means the film is as good as
its people"* — is a useful design target but must not become the rule, because a
locked script still depends enormously on its director and cast, an open one
cannot escape a poor concept (Principle 9), and highly capable collaborators can
pull a film in incompatible directions. The rules are §3.5's three properties.

### 3.5 Adaptability, and the three properties

Absorbing change safely requires three distinct things, of which the engine
already models two:

| Property | Question | Status |
| --- | --- | --- |
| **Capability** | How good are their contributions? | Built — `skill`, craft, `actingModel.ts` |
| **Alignment** | Are they making the same film? | Built — `creativeTension.ts`, `crewPhilosophy.ts`, `compatibility.ts` |
| **Adaptability** | Can they absorb change without breaking everything else? | **Missing as a system** |

`personality.adaptability` (`types/index.ts:270`) already exists and is currently
read only as an ego-friction damper inside `creativeTension.ts`. It is the
natural carrier for the third property, exactly as `crewPhilosophy.ts` turned
otherwise-cosmetic axes into a genuine simulation input.

### 3.6 Integration debt

**Changes do not automatically cost coherence.** A well-integrated rewrite
*improves* coherence; the damage comes from conflict with work already authored,
prepared or captured. Rewriting a lead's motivation before any dependent scene
is shot is a straight improvement. Rewriting it after half those scenes are in
the can creates contradictions.

So the real variable is **when a change lands relative to what it invalidates**,
not how many changes occurred. Disruption scales with:

- how fundamental the changed element is;
- how much affected material is already prepared or already shot;
- whether the people involved understand and accept the change (§3.5 alignment);
- whether there is time and adaptability to revise downstream work;
- whether the edit can disguise what remains unresolved.

Resolution paths must include: resolve it properly, disguise it in the edit,
accept it, or leave it contradictory. Final coherence is then derived from what
remains unresolved — producing *"the revised ending was right, but there was no
time to revise the protagonist's setup scenes"* rather than *"three rewrites:
−9 coherence."*

This is `editCoverageCeiling` generalised (§1.5), not a new subsystem.

---

## 4. The current vertical slice

The minimum that closes the loop and makes waiting stop being dominant. Three
changes, in order. Anything not listed here is out of scope for the slice.

### 4.1 Change 1 — commitments and a moving script can coexist

The linchpin (§1.1). Without it the other two cannot bite.

- Lift the *"an Asset with `pendingRewrite` cannot start a Project"* restriction.
- Allow a development pass to run against a `FilmDraft` that already holds
  attachments, not only against a library `Asset`.
- Add `committedStartDay` to `FilmDraft`, set at `GREENLIGHT_PROJECT`.
- Talent commitments book against `committedStartDay`; a pass whose `readyOnDay`
  exceeds it is the situation the whole phase exists to create.

`plannedStartOffsetDays` is retained as the target start (§3.1) — no migration,
no rename.

### 4.2 Change 2 — rewrite duration becomes an estimate with named causes

Not *"randomly 24–41 days."* That would be precisely the opaque risk the
philosophy rejects; the player would feel punished because the engine picked 41.

- `estimateRewriteDuration(writer, script, kind)` returns a **range with named
  contributing factors**, shown *before* committing: base scope, script
  complexity, writer reliability, approval risk.
- The actual duration is rolled **once, at commission**, and stored — reusing
  the determinism shape `PendingRewrite.craftChanges` already establishes. It
  cannot be re-rolled by reloading.
- The resolved duration stores its **cause** and is appended to
  `developmentHistory` as a `DevelopmentEvent`, so the overrun is recorded
  history the player can read back, not an invisible dice roll.

Longer term the duration should *emerge* from delivery and approval rounds
rather than being drawn from a range (§5) — the genuinely dangerous uncertainty
is not whether typing takes 29 or 34 days, but whether the delivered draft
solves the problem and whether the people with approval authority accept it.

**Integration buffer.** A draft finished the night before the first day of
photography is not finished in time — stakeholders must read it, notes must be
reconciled, departments must consume the changes. The slice approximates this
with a small fixed buffer between `readyOnDay` and `committedStartDay`; §5
replaces it with real departmental propagation.

### 4.3 Change 3 — script craft feeds typed production exposure

Per §3.3: derive `ScriptExposure[]` from the stored craft axes and tone
coherence, contribute them into the existing four risk dimensions, and preserve
the typed list for reporting and later event gating. `computeStaticProductionRisk`
keeps its current return shape.

### 4.4 Required player-facing information

The decision is only legible if the trade is visible at the moment of choosing
(Principle 3). A commission prompt must show, qualitatively:

```text
Request one more structural rewrite — estimated 26–38 days
  Expected improvement       Moderate
  Director availability      Secure for 61 days
  Lead availability          Secure for 43 days
  Committed start            in 35 days
  Current structural concern Significant
```

Presentation stays qualitative per `CLAUDE.md`; the numbers above are days and
named bands, not internal stat values.

### 4.5 Tests

- A pass whose estimate fits the window but whose *resolved* duration does not
  threatens the committed start — and the threat is explainable from stored
  history.
- A resolved duration is stable across a save/load cycle (no re-roll).
- Two scripts of equal `complexity` but different `structure` produce different
  exposure profiles and different risk readings.
- A project can hold talent commitments while a pass is in flight.
- Existing consumers of `StaticProductionRisk` are unaffected in shape.
- Diagnostic: across a simulated field, requesting an additional pass is **not**
  a strictly dominant strategy.

### 4.6 Explicitly excluded from the slice

Openness policy (§3.4), adaptability as a system (§3.5), integration debt
(§3.6), evaluator disagreement (§3.2), release corridors, prep burn, dailies,
reshoots. The slice must ship without any of them.

### 4.7 The acceptance test

Not *"can waiting hurt?"* — a punishment is easy to add. The test is:

> **Can two rational players, looking at the same project, reasonably disagree
> about whether to request another rewrite?**

If yes, the foundation works and §5 can proceed. If the answer is still "always
rewrite" or has become "never rewrite", the slice has replaced one dominant
strategy with another and is not finished.

Per `CLAUDE.md`, bump `SAVE_KEY` in `src/state/persistence.ts`; no migration.

---

## 5. Near-term extension

Recorded, deliberately not foundational to the slice:

- Release strategies and corridors — undated development, target season,
  reserved corridor, hard franchise date, opportunistic. **Not every film should
  reserve a hard date:** a $12m original drama should not behave like the fourth
  instalment of a franchise, though it may have its own clock (an actor's
  window, awards eligibility, financing expiry, a seasonal location).
  `engine/releaseCrowding.ts` already scores corridors by contest; the work is
  moving the *claim* earlier than `SCHEDULE_RELEASE`'s current gate.
- Prep payroll burn while delaying.
- Financing, rights and rebate expiry.
- Rewrite delivery and approval rounds replacing the drawn range (§4.2).
- Shooting around unresolved material — begin production while avoiding the
  unresolved third act, unless availability or locations force shooting out of
  narrative order.
- Dailies and production discovery, with deliberately imperfect findings.
- Emergency writers; pickups and limited reshoots.

## 6. Long-term north star

Preserved without prematurely architecting it:

- **3–6 creative commitments per project**, with dependencies expressed
  *between commitments* rather than between scenes — enough authored structure
  to generate meaningful contradictions without simulating a screenplay. Note
  `data/storyBeats.ts` is a conditional prose generator for the results screen
  and is **not** a story model; this is genuinely new structure.
- Alternative actor and director interpretations that can succeed on their own
  terms — an actor replacing "emotionally isolated" with "socially charismatic
  but privately terrified" makes a *better* film if the dependent commitments
  are updated, and an incoherent one if half the production keeps performing the
  original.
- Assembly findings; post-production as reconstruction; contradiction-aware
  editing; targeted reshoots; retrospective production narratives.

## 7. Explicit rejections

This design deliberately does **not** adopt:

- full scene-level or screenplay simulation;
- a universal coherence penalty that decrements per change;
- any release-time quality roll, in any form (Philosophy non-goal);
- one global "unfinished script" modifier;
- mandatory hard release dates for every film;
- openness as an objectively superior strategy for well-cast productions;
- opaque duration randomness without stored, readable causes.

---

## 8. Relationship to the existing phasing

This is Phase 5 of `docs/SIMULATION_PHILOSOPHY.md`, not a parallel track. It
depends on Phase 1 (production execution — shipped) for typed consequences and
on Phase 3 (acting model) for the capability axis. It is independent of Phase 4
(studio identity), though a studio's risk appetite is the natural driver of
openness policy once both exist.
