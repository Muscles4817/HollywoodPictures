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

### 4.8 Measured result of the slice — the acceptance test does NOT yet pass

`src/engine/developmentDominance.diagnostic.test.ts` measures §4.7 directly.
Over 60 seeded runs, commissioning a pass on a packaged project with the real
settlement loop running underneath it:

```text
Scripts carrying a named concern      83%
Passes that overran their schedule    83%
Mean scheduled length                 30.5 days
Mean overrun (when it overran)        3.6 days
Actors booked by rivals during a wait 23.2 of ~890 free
Waits that cost a top-3 target        10%
```

**The mechanism works; the pressure does not yet bite.** Time is now genuinely
uncertain (83% of passes overrun) and the coexistence blocker is gone, so a pass
can run against a project holding real attachments. But the only thing that
currently *expires* is talent availability, and the talent pool is deep enough
(~890 free actors) that a month-long wait costs a specific wanted actor just 10%
of the time. Against a near-certain craft improvement, another pass is still
close to strictly correct.

This is a finding, not a defect in the three changes — it is what §2's ordering
predicted. One perishable asset class is not enough to make time expensive,
because the player can simply pick a different actor. The dilemma needs a
resource that **cannot be substituted**: a release corridor a rival will take,
which is §5's second clock. That is now the highest-priority next slice rather
than one option among several, and the diagnostic above is the instrument to
measure it against.

Secondary tuning question this surfaced: ~890 free actors makes the talent
market non-scarce in absolute terms. Whether that is correct is a separate
balance question from this phase, but it caps how much pressure *any* talent
clock can ever generate.

---

## 5. Near-term extension

Recorded, deliberately not foundational to the slice. **§4.8's measurement
promotes the first item here to the next slice** - it is what the acceptance
test is waiting on, not an equal option among the rest:

- **The release-date clock — now specified in full at §9.** The earlier sketch
  of this called it "reserving a corridor", which was wrong: nothing in the real
  industry allocates dates, and the engine's crowding model was already closer to
  the truth than that framing. See §9.
- Prep payroll burn while delaying.
- Financing, rights and rebate expiry.
- Rewrite delivery and approval rounds replacing the drawn range (§4.2).
- Shooting around unresolved material — begin production while avoiding the
  unresolved third act, unless availability or locations force shooting out of
  narrative order.
- Dailies and production discovery, with deliberately imperfect findings.
- Emergency writers; pickups and limited reshoots. The cost model for these is
  already grounded - see `docs/domain/07-postproduction.md` for how post money
  really behaves. A recut's price is set by how much finished downstream work it
  invalidates, which is section 3.6's integration debt in another department and
  the closest thing to a worked example of the principle the codebase has.

  As built (`engine/testScreening.ts`): a re-edit costs the cutting room -
  anchored on the Editor's own fee, since the room's cost is the people in it -
  plus a share of the VFX budget for what the new cut puts back in play, growing
  with each screening round as more of the finish locks. Pickups and reshoots add
  photography *on top of* that, because new footage still has to be cut in, which
  makes `re-edit < pickups < reshoots` hold at every budget by construction
  rather than by tuning.

  Cast availability can refuse additional photography outright
  (`engine/reshootAvailability.ts`), and a principal can be bought out of their
  other job - but only while that job is near its end. Past that ceiling no money
  moves them, which is deliberate: if a buy-out always worked, refusal would
  collapse back into a price and time would be buyable with cash again. Not
  modelled: waiting for a principal to free up, shooting around them, and the
  fact that a buy-out here does not alter the other production's commitment (you
  buy a window, not a contract), so a later round negotiates again.

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

---

## 9. The release-date clock (next slice)

### 9.1 Correcting the earlier framing — nobody reserves a date

An earlier sketch of this work described "reserving a release corridor", as
though a claimed date were a booked resource. **That is not how the industry
works and it is not how this engine already models it.** No authority allocates
release dates. Star Wars opening on the 4th of July does not prevent Jurassic
Park from opening the same day.

What is actually true:

- **A date announcement is a territorial claim, not a booking.** Studios announce
  years ahead precisely so everyone else reads it and steers. It works by
  deterrence, not by rule.
- **Weaker films blink.** A big date is claimed, others cluster, and as it nears
  the ones who would lose the matchup publicly move.
- **Collisions are frequently harmless.** Two tentpoles chasing different
  audiences can share a weekend and both do well. Same-audience collisions are
  the damaging ones.
- **The genuinely rivalrous resource is screens and showtimes**, not the date.
  A multiplex has finite screens; three same-audience tentpoles on one weekend
  means somebody gets fewer.

`engine/releaseCrowding.ts` already encodes all of this. A genre mismatch weighs
`0.15` against a match's `1.0` (counterprogramming), an audience match adds
`0.3`, `matchupWeight` decides who is pushing and who is being pushed, and the
saturation clamp's own comment says it outright: *"crowding is a fraction of
screen access lost."* **The substrate is right. The proposal was wrong.**

### 9.2 What the measurement says

`src/engine/releaseCrowding.diagnostic.test.ts` drives the real rival market for
~4 in-game years and measures what a player film would actually face. Result:

```text
~26 rival releases spread over ~380 days (about one a fortnight)

Arbitrary day, own genre:   mean 0.589   median 0.607   p90 1.000
Head-on, same audience:     mean 0.907   median 1.000   p90 1.000

Opening availability: best day 100%  ->  worst day 50%
```

**Crowding is not weak — it is strong and blunt.** Three readings:

1. **The magnitude is already large.** A typical day in your own genre costs
   roughly 30% of opening availability; the worst days cost the full 50%. Best
   day against worst day is a **2x lever on opening availability**. Anyone
   assuming the date barely matters is wrong about the maths.
2. **The top of the range is saturated.** Median 0.607 with p90 at the 1.000
   clamp means a large share of bad days read *identically*. There is a real
   gradient in the lower half and none in the upper, so "contested" and
   "suicidal" are indistinguishable to the player.
3. **The player is outside the matchup model.** `matchupWeight` exists and rivals
   pass their own strength to it (`rivalStudios.ts:445`), but the player's
   settlement does not (`marketSettlement.ts:108` omits the third argument). So a
   player's £200m tentpole feels exactly the same crowding as their £5m indie on
   the same day. The "am I doing the pushing or being pushed" primitive - the
   whole basis of who-blinks - **does not apply to the player at all.** The
   module's own comment flags this as a deliberate not-yet ("callers that haven't
   yet been given a candidate strength keep exactly their current numbers until
   they opt in"), so it is a known seam rather than a bug.

### 9.3 Why it still fails to bite

Given a 2x lever, why does the date feel free? Because of **when** it is chosen.

`SCHEDULE_RELEASE` gates on `testScreeningResolved`, and `SET_MARKETING_CHOICES`
sits on the same late screen. The player therefore picks a date **after the film
is finished**, with perfect information about every rival already on the
calendar, and with nothing committed against any date. Under those conditions the
rational move is trivially to scan for an empty day and take it - and since the
median day already carries 0.607 crowding while the best carries 0, that scan is
worth a great deal and costs nothing.

The lever is real. It is simply free to optimise. That is the same shape as
§4.8's finding one phase earlier: the mechanism works, the pressure does not
bite, and the cause is that nothing is committed early enough to be lost.

### 9.4 The model

Not a reservation. **A commitment, and a sunk campaign.**

| Concept | What it is |
| --- | --- |
| **Announced date** | Claimed before greenlight. Public, so rivals can see and steer around it. Binding on nobody. |
| **Committed campaign** | Marketing spend allocated against that date, and *spent* whether or not the date holds. |
| **Collision** | A rival announces onto or near your date. Already fully modelled by crowding. |
| **Moving** | Always allowed. Writes off the committed campaign to date and forfeits partner lead times. |

The decision stops being *"the slot is taken"* and becomes the real one:

> A rival has just parked a same-audience tentpole three days from your date.
> Your campaign is bought. Do you hold and split the screens, or move and eat
> the write-off?

That is incommensurable in exactly the way §2 requires - sunk marketing against
box office against schedule - and none of it requires pretending a weekend can be
reserved. What cannot be substituted is not the date. **It is the money already
spent pointing at that date.**

### 9.5 Slice

In dependency order. The first two are prerequisites the measurement exposed and
are worth doing even if the rest slips.

1. ~~**Wire the player into `matchupWeight`.**~~ **Done.** `marketSettlement.ts`
   now passes the player's own `computePlayerReleaseStrength` - deliberately the
   same expression `asUpcomingRelease` uses to present the film to rivals,
   frozen genre-identity snapshot included, so the strength a film resists a
   collision with equals the strength rivals steered around.
2. ~~**Give the upper range resolution.**~~ **Done.** `computeCompetitiveCrowding`
   splits into `computeCrowdingPressure` (raw, unbounded) and
   `crowdingFromPressure` (the response curve). Pressure below a soft knee of
   0.7 passes through untouched, so the ordinary range keeps its exact previous
   calibration; above it, crowding approaches total loss asymptotically instead
   of clamping. Strictly monotonic, so no two pressures collapse to one crowding.
3. ~~**Announce the date before greenlight**, and let rivals see it.~~ **Done** -
   see §9.5b, including the rival-scheduling limitation it exposed.
4. ~~**Recalibrate rival release scheduling**~~ **Done** - see §9.5c. Delay is
   now priced, so a film weighs a better window against the cost of reaching it
   instead of vacating on any non-zero crowding.
5. ~~**Commit marketing against the date early.**~~ **Done** - `COMMIT_CAMPAIGN`
   books a campaign against the announced date. A BOOKING, not a payment: media
   is paid close to air, so the cash is still charged at release with the rest
   of marketing. What committing buys now is that the claim reads as FUNDED to
   rivals (`announcedReleaseStrength`) rather than as a bare date.
6. ~~**Allow moving, priced at the campaign write-off.**~~ **Done** -
   `engine/campaignCommitment.ts`. Moving writes off a share of the commitment,
   flat at 15% outside the buying window and rising to effectively all of it on
   the eve of release. Charged in cash at the move so the shuffle is visible,
   and the surviving remainder is re-pointed at the new date rather than
   abandoned. Repeated shuffling compounds.

### 9.5a Measured result of steps 1-2

Same harness, after both changes. Head-on collisions, by the player's own
release strength:

```text
                    BEFORE                    AFTER
strength 0.20   crowding 0.963  92% saturated   raw 1.68 -> 0.938   10% saturated
strength 0.40   crowding 0.942  81% saturated   raw 1.35 -> 0.902    3% saturated
strength 0.60   crowding 0.907  64% saturated   raw 1.12 -> 0.856    0% saturated
strength 0.80   crowding 0.856  49% saturated   raw 0.97 -> 0.803    0% saturated
strength 0.95   crowding 0.813  32% saturated   raw 0.87 -> 0.762    0% saturated

availability kept, weakest -> strongest:  51.9%-59.4%  ->  53.1%-61.9%
```

**Saturation is gone** (92% to 10% at the weak end, 0% everywhere else), and the
raw pressures show the model was always discriminating properly - a weak film
feels 1.68 of pressure where a strong one feels 0.87, roughly double. The hard
clamp was throwing that away.

**The remaining spread is modest and deliberately left alone.** A worthless film
and a maximal tentpole now differ by 8.8 points of opening availability on a
head-on collision, up from 7.5. Widening that further means raising
`CROWDING_PENALTY_WEIGHT` (currently 0.5), which is not a resolution problem but
a **magnitude** change to a calibrated box-office input, belonging to
`docs/DESIGN_box_office_calibration_targets.md` and its own gates. Doing it here
would be recalibrating the box office under cover of a crowding fix. Left for
that work, deliberately.

Re-running `developmentDominance.diagnostic` after these two changes moves
nothing (7% of waits cost a target, against 10% before - noise). **That is the
expected result, not a failure:** steps 1-2 sharpen how a collision is *felt*,
while what makes the date matter to a production decision is steps 3-5, which
commit something early enough to lose. The re-run in §9.6 is the one that counts.

### 9.5b Measured result of step 3, and the calibration it exposed

The announcement machinery works: a project can claim a date well before
greenlight, rivals read it off the same calendar they read each other from, and
they respond to it. `announcedAsUpcomingRelease` deliberately carries no
marketing term, so a bare claim reads weaker than a funded one - which is what
gives step 4 something real to do rather than bookkeeping.

**But rivals respond by fleeing the entire window, and identically regardless of
the threat.** Measured on `chooseReleaseDay`:

```text
naive 300  ->  undisturbed 307
  matching, strength 0.9   ->  356   (+49 days)
  matching, strength 0.1   ->  356   (+49 days)
  counterprogrammed        ->  356   (+49 days)
```

The cause is in the scoring, not the announcement. `chooseReleaseDay` maximises
`seasonalDesirability(day) - 0.6 * crowding`, and seasonal desirability is nearly
flat across neighbouring weeks, so **any** non-zero crowding is enough to tip the
choice - and the cheapest way to shed crowding entirely is to step just past
`CROWDING_WINDOW_DAYS` (45). Hence +49 every time.

Two consequences this design depends on and does not yet have:

- **Counterprogramming never happens.** The 0.15 genre-mismatch weight is doing
  its job inside `computeCompetitiveCrowding`, but the day-choice throws the
  distinction away: a Romance flees an Action claim exactly as far as another
  Action would.
- **§9.4's dilemma cannot arise.** If a rival always vacates, the player never
  faces "a same-audience tentpole just parked on your date - hold or move?"

What step 3 *does* deliver is the other half: **announcing early genuinely buys a
clear window**, because a rival that steps aside leaves the whole 45 days. That
is a real and worthwhile mechanic on its own, and it is why announcing is worth
doing at all.

Getting the risk half required a rival-scheduling calibration - see §9.5c, now
done.

### 9.5c Rival scheduling: delay was free (fixed)

The cause of §9.5b was not the crowding weight. It was that **the score charged
nothing for waiting**:

```text
score = seasonalDesirability(day) - 0.6 * crowding
```

Seasonal desirability is nearly flat from one week to the next, so any non-zero
crowding made stepping forward strictly better, and the cheapest way to shed
crowding entirely is one step past `CROWDING_WINDOW_DAYS`. Hence ~49 days, every
time, whatever the threat.

A production cannot actually wait for nothing: capital is tied up, the negative
accrues interest, crew and facilities are on hold, and marketing lead-times have
been bought against a date. `SCHEDULING_DELAY_COST_PER_DAY` prices that, so the
search weighs a better window against the cost of reaching it rather than taking
any improvement however small. Calibrated against the crowding term: shedding a
full crowd justifies ~150 days, a half crowd ~75, and a counterprogrammed rival's
0.15-weighted nudge ~10 - under the weekly step, so a mismatched rival stays put.

Measured, same harness:

```text
                          BEFORE            AFTER
same-audience, strong     +49 days          +49 days   (still clears the window)
same-audience, weak       +49 days           +0 days   (opens against it)
counterprogrammed         +49 days           +0 days   (shares the weekend)

rival response to a player claim, 483 matchups:
  holds the contested window     0%  ->  70%
  flees clear                  100%  ->  30%
  holds its exact date           0%  ->  34%
```

Both consequences §9.5b named are now present: **counterprogramming happens**,
and **rivals collide with the player**, so §9.4's hold-or-move dilemma can
finally arise. Calendar density is unchanged (20-25 rival releases over ~400
days), so the slate did not thin out as a side effect.

**What this did NOT move:** `developmentDominance.diagnostic` still reports 0-10%
of waits costing a wanted actor - no better than before, and inside the noise of
a rare event counted over 60 runs on a shifted stream. That is the expected
result. This step fixes how a rival RESPONDS to a claim; what makes the date
matter to a *production* decision is steps 5-6, which commit something early
enough to lose. Nothing here touches talent windows.

### 9.6 Acceptance test

As in §4.7, the bar is disagreement rather than punishment:

> Can two rational players, holding the same finished film and facing the same
> rival announcement on their date, reasonably disagree about whether to hold or
> move?

And the §4.7 test should be re-run afterwards: the release clock is what §4.8
predicted would finally make "one more rewrite" a genuine bet, so
`developmentDominance.diagnostic` should move too. If it does not, the diagnosis
in §4.8 was wrong and needs revisiting rather than patching.

### 9.6a Measured: the decision surface

`src/engine/holdOrMove.diagnostic.test.ts` sweeps the space the decision lives
in - how close the date is, how large the committed campaign, and how strong the
colliding rival - and asks which option is cheaper at each point.

```text
HOLD better in 20/60 (33%)      MOVE better in 40/60 (67%)

  30d out:  HOLD everywhere          - the write-off is brutal, you are committed
 120d out:  flips on rival strength  - hold a 0.3 threat, move for a 0.6
 300d out:  MOVE everywhere          - nothing is placed yet, flexibility is free
```

**The acceptance test is met, in a specific and legible shape.** It is not a
coin flip - a 50/50 split would mean the inputs did not matter. It is decisive
at the extremes, which is correct (a date you have not bought against is cheap
to abandon; one you have is not), and genuinely contested in the middle band,
where the answer turns on how big the threat actually is. Two rational players
at 120 days facing rivals of different strength make different calls.

It also relocates the real decision. The interesting choice is not only at the
collision but at COMMITMENT: buying a campaign early deters rivals and costs you
the freedom to dodge. That is the incommensurable trade §2 asks for.

**A caveat on this harness, disclosed rather than buried.** Its first run read
87% MOVE, because it modelled moving as landing somewhere free. That is not the
game's situation - good windows are scarce, and a move is usually into a weaker
season or another contested date. Modelling the destination's cost is what
produced the numbers above. The conversion between crowding and campaign value
is deliberately rough: the question it answers is whether the two costs are ever
comparable, not what their exact ratio is.

### 9.7 Connecting the clock back to development

§9.6 leaves the release clock complete on its own terms: a date can be claimed,
a campaign can be committed against it, and moving costs real money. But the
whole reason for building it (§4.8) was to make "one more rewrite" a genuine
bet — and a bet needs the player to see the stake at the moment they place it.
Three things were missing.

**1. The estimate.** `engine/deliveryEstimate.ts` projects when a film will
actually be ready, phase by phase off the draft, using the *same* estimators the
real pipeline runs (`engine/production.ts`) rather than a parallel guess — so
the projection cannot drift from what happens. A development pass in flight is
counted as a step of its own, which is the point: the rewrite shows up in the
release date. Against an announced date it yields a standing —
`comfortable` / `tight` / `at-risk` / `missed` — named rather than numeric, per
the house rule.

It deliberately estimates *before* Production Planning too, assuming a plan and
flagging the result `provisional`. A date announced pre-greenlight is exactly the
window this feature exists for; refusing to estimate there would have silenced
the warning in the only case that needs it. (This is the same failure mode a code
review caught in `announcedAsUpcomingRelease` — bailing on a null
`productionChoices` made every pre-greenlight announcement invisible to rivals.)

The assumed plan is the **screenplay's own recommendation**, run through the same
adapter `SET_PRODUCTION_PLAN` uses. The first version guessed effects ambition
from the script's *scale*, and measurement caught it: an Epic Action projected
256 days of post against 75 for the same script read off its own
`effectsStrategy`/`effectsAmbition`. Scale says how big the cast and locations
are, not how effects-led the film is, and post is dominated by VFX — so a scale
guess told an Epic period drama its post ran the better part of a year, and would
have marked reachable dates unreachable. Replacing silence with a systematically
pessimistic lie is not an improvement.

**2. The stake, shown at the decision.** The Rewrite panel in the Asset Library
now prices a pass against the film's own claim: what the date looks like as
things stand, and what it looks like if this pass runs long. Priced at the
*worst* case, because that is the version of the bet that hurts — a pass that
overruns is exactly the one that takes the date away.

**3. Teeth.** Without this the warning warned about nothing.
`ANNOUNCE_RELEASE_DATE` already charged the campaign write-off when the player
moved a date deliberately, but nothing charged the player who simply blew
through the date they named, never re-announced, and opened late with the
campaign whole. `SCHEDULE_RELEASE` now applies the same write-off whenever the
film opens on a day other than the one its campaign was bought against. It is
charged rather than blocking: refusing to release a finished film over a
shortfall would be a trap, and the studio can run its cash negative.

**Still open.** A lapsed announcement stays on rivals' calendars past its own
day — the claim goes stale rather than expiring. Cheap to fix, but it needs a
hook in the daily settlement that owns player drafts, and every `ADVANCE_*`
handler would need it; recorded here rather than bolted on.

### 9.8 UI/UX review of the release calendar

Asked to check that the production process hangs together, the calendar surfaces
turned out to disagree with each other about the one thing they all display.

**Finding 1 — the planning board used a headcount, and it was wrong.**
`ReleaseCalendar.tsx` read competition as *how many titles share a calendar
month* (2 → "Some competition", 4 → "Crowded"), while the Marketing & Release
screen and the pre-greenlight announcement card both read
`engine/releaseCrowding.ts`. So the screen the player plans on could call a
month clear that settlement treats as a brawl — and, worse, it could not see
counterprogramming at all: five films in five different genres read as
"Crowded" when none of them is fighting any of the others.

Fixed by giving every `CalendarEntry` its own `strength` (from the same
converters settlement uses) and reading each entry's real crowding against the
rest of the board. A month's band is now the worst fight it contains. The three
levels and the CSS were always the right shape; only the basis underneath was
wrong. The per-card `N competing` chip — same defect, per card — became that
film's own window reading.

**Finding 2 — the player could not see their own claim.**
`deriveUpcomingReleaseEntries` emitted only *locked* player releases. Rivals
have always weighed outstanding announcements
(`playerCalendarPresence`), so the one party who had to plan around the claim was
the only one who could not see it. Announcements now appear on the board, marked
`isClaim` and labelled "Announced — not yet locked".

**Finding 3 — the two date-picking screens had drifted.** The announcement card
weighed the studio's *own* other outstanding claims; Marketing & Release did
not. A studio could book two of its own films into the same window and be warned
about it on one screen only. Both now read `deriveKnownCalendar`.

**Not changed.** The calendar remains read-only ("Opening the project from here
is coming soon"), and its month grouping is still a month bucket while crowding
runs on a 45-day window — an approximation, but now an approximation of the real
computation rather than a different model.

### 9.9 Measured: does the §4.7 acceptance test finally move?

§9.6 said the §4.7 harness should be re-run once the release clock existed, and
that if it did not move, the §4.8 diagnosis was wrong. Re-running it unchanged
gives the same reading as before:

```text
  Waits that cost a top-3 target        0%
```

**That is not evidence the diagnosis was wrong — it is evidence the instrument
cannot see the change.** The harness measures one thing: whether a rival books
an actor out from under you while a pass is in flight. It has no announced date,
no committed campaign, nothing pointed at a day. It was built to measure the
clock §4.8 concluded was the *wrong* clock, so of course replacing that clock
does not move it.

So the harness was given a second arm rather than being reinterpreted. Same
seeds, same *real* measured pass length, but now also asked what that wait does
to a date the studio has already claimed and bought a £20m campaign against:

```text
What the SAME wait costs a claimed release date

  200d of slack   changed standing   0%   went to 'missed'   0%   cost to move  £3.0m
   90d of slack   changed standing  10%   went to 'missed'   0%   cost to move £14.2m
   45d of slack   changed standing 100%   went to 'missed'  10%   cost to move £19.3m
   20d of slack   changed standing 100%   went to 'missed' 100%   cost to move £20.0m
```

**The decision surface is real, and it is a gradient rather than a coin flip.**
Passes run 30–40 days, which is why the standing flips deterministically once
slack drops below ~45 days: at that point the arithmetic is not in doubt, only
the price is. What actually varies across the whole range is the *cost*, and it
varies by nearly 7× — from £3.0m when nothing has been placed yet to the entire
campaign on the eve of the date.

That relocates the disagreement, in the same way §9.6a did. Two rational players
at 200 days of slack both take the rewrite; two at 20 days both refuse. The
genuine argument is in the middle, and it is not "will this cost me?" but "is
this improvement worth £14m?" — which is exactly the incommensurable trade §2
asks for, and something the talent clock could never produce because talent is
substitutable and money is not.

**What is still true from §4.8.** The talent arm still reads 0%, and that is a
real finding, not noise: a wait genuinely costs nothing in package terms. The
two arms are reported side by side rather than one superseding the other,
because they are answering the same question with different instruments and the
disagreement between them *is* the result.

### 9.10 The release-date decision, made legible

The clock now bites (§9.7) and the calendar now tells the truth about
competition (§9.8), but the screens that *offer* a date still asked the player to
choose from eighteen months while telling them one thing about those months. A
studio could claim a date two months out for a film that had not begun
pre-production, and nothing on screen said a word about it. The decision was
real; the information was not.

**What actually decides a release date**, and where each was:

| | Announcement card (pre-greenlight) | Marketing & Release (scheduling) |
|---|---|---|
| Can the film be finished by then | **absent** | enforced by a clamp, never explained |
| Campaign runway | **absent** | meter, selected month only |
| Season, for this genre | **absent** | window name + a ★ |
| Who else is opening | crowding band | crowding band + slated count |

`engine/releaseDateReading.ts` supplies all four as named bands, each derived from
the system that actually applies it — `engine/production.ts` for delivery,
`data/release.ts` for the seasonal multipliers, `engine/marketing.ts` for campaign
momentum, `engine/releaseCrowding.ts` for the field. Nothing in it is a new rule.
It is the existing rules, made legible at the moment of choosing.

**Two dates now headline the announcement card** before the grid rather than
being discovered after it: when the film is projected finished, and the first
date that does not shorten its own campaign (`readyOnDay` + a full rollout).
Underneath, what is still ahead, phase by phase.

**Every month cell reads on three axes** — delivery, season, field — and a month
the film cannot be finished by is dimmed and struck through. It stays
**clickable**: announcing a date you will miss is the whole premise of the
feature (§9.1), so it is marked, never forbidden. Claiming one produces a full
breakdown plus the single sentence naming the worst problem with it, ordered by
what would actually sink the release — a film that does not exist beats a rushed
campaign beats a contested date beats a dead season.

**And the grid now always offers a date the film can make.** It was a fixed
eighteen months from next month on; an effects-led epic can need most of two
years between here and a finished print, which would have left every cell struck
through and no real choice on the screen at all. It now runs to at least a year
past the first comfortable date.

**One formula, shared.** `seasonalDesirability` moved out of
`engine/rivalStudios.ts`, where it was private, into this module. The seasons the
AI chases are now provably the ones the player's screen recommends.

**And the price of moving is shown before the move.** Since §9.7, opening on a day
other than the one a campaign was bought against writes that campaign off — but
Marketing & Release did not mention it, so the charge was discovered in the cash
ledger afterwards. It now states the announced date, whether the selected month
is it, and what leaving it costs.

**Still not enforced, deliberately.** No date is blocked. Every unreachable
choice is labelled, priced and left available, because a studio announcing a date
it cannot make is the behaviour this whole phase exists to model — the player
should be able to do it knowingly, which is precisely what they could not do
before.

### 9.11 UX pass: what a real browser said about §9.10

The release-date work was built and tested in jsdom, which renders no CSS. So it
was measured for the first time in an actual browser — Chromium at 390px (phone,
touch), 768px (tablet, touch) and 1440px (desktop) — with the app's real save
seeded into `localStorage`. Four defects, all invisible to the existing tests.

**1. The nested scroll box only ever engaged where it hurts.** Both month grids
cap at `max-height: 420px`. Measured: the announcement grid is 219px at 1440px
and never reaches the cap; at 390px it is 744px, and the Marketing grid is
2148px — five screens of scroll box inside a scrolling page, driven by a thumb.
The cap was doing nothing on the viewport it was written for and swallowing
swipes on the one it was not. Lifted below 900px and on any coarse pointer (a
touch laptop at a wide viewport captures swipes exactly as a phone does); kept
on desktop, where the Marketing grid genuinely runs past it and a bounded grid
under a mouse wheel is a convenience rather than a trap.

**2. The label/value readings failed at both ends of the range.** At 1440px
`.row-between` stretched "Projected finished" to roughly 1200px from "Year 1,
August 5" — too far to cross in one eye movement. At 390px the same rows wrapped
with a 12px row gap, so the value floated free of the label it belonged to. Both
are the same rule failing in opposite directions. A dedicated `.date-reading`
block caps the measure at 32rem and, below 640px, goes deliberately two-line and
tight instead of accidentally wrapped.

**3. A month the film cannot make was advertising a prime season.** June–August
Year 1 rendered struck through and dimmed — and "Prime season" in bold green,
pulling the eye toward exactly the dates the verdict had just ruled out. Below
the verdict every reading on an unreachable cell is moot, so the band colours are
now dropped in the markup rather than painted over by a CSS descendant
override — the intent is visible where the decision is made, and it is testable.

**4. A line that said the same thing on 34 of 36 cells.** Campaign runway grows
monotonically with distance from the earliest month, so "Full campaign rollout"
appeared on almost every cell of the Marketing grid. A caption that never varies
teaches nothing; the exception is the entire value. The marker now appears only
when the runway is *not* full — which also took the phone cell from 109px to
90px, and the grid from 2148px to 1500px.

**Not changed, and worth naming.** `.btn-sm` measures 33–34px under a coarse
pointer, below the usual 44px touch guideline. That is the app's existing
convention across every screen, not something this work introduced, so changing
it here would be a global change smuggled in under a local pass. Same for
`.campaign-runway__head` on the Marketing screen, which stretches its label and
value the full card width exactly as §9.11(2) describes — it predates this work.
Both are recorded rather than quietly fixed.
