# Design Review — Acting Model: Craft, Direction, and the Unlocked Performance

A design for how acting quality should work, replacing the current "acting =
role-fit alone" model. It follows the principles in
`docs/SIMULATION_PHILOSOPHY.md` (endogenous variance, execution emerges in
production, legible causes, real trade-offs) and is intended to land **before
Studio Identity**, which depends on it.

> Status: **implemented.** The model below is live in `engine/actingModel.ts`,
> wired into `engine/scoring.ts:computeActingScore`, generated in
> `engine/talentGenerator.ts`, and surfaced qualitatively on the casting card
> (`components/common/TalentStats.tsx`). See §15 for how the implementation
> resolved the open decisions and where it departed from the first sketch.

---

## 15. Implementation notes (as built)

The shipped model matches the design's core: a fame-independent **floor** +
director-unlockable **headroom**, a director's **hands-on-ness** as leverage on
the director↔actor tonal **aim**, role-fit gating headroom in full and the floor
in part. Key specifics and departures:

- **The unlock** (`computeRealizedPerformance`): `effFloor = floor × (0.7 + 0.3 ×
  roleFit)`, `push = (BASE_INFLUENCE + handsOn × (1 − BASE_INFLUENCE)) ×
  skill/100`, `realized = effFloor + (headroom × roleFit) × push × signedAim`,
  where `signedAim` scales the negative side down (`MISMATCH_PENALTY_SCALE`) so
  the below-floor tail is real but softer than the upside. `BASE_INFLUENCE`
  landed at **0.12** (not a larger value) so a hands-off director genuinely
  leaves a performance near its floor — the point of the hands-on axis.

- **Craft source — decided during implementation.** Craft is authored *per
  actor*, decoupled from fame, but is **not** derived from acting-style
  spikiness. The style generator makes every actor spiky (1–2 signature axes),
  which saturates a spikiness-based headroom and erases the dependable-pro
  archetype. Instead craft is drawn on **two independent axes** — a triangular
  floor (~44–80, centred ~62) and a right-skewed headroom (most actors low, a
  minority high) — giving the pro/magnet/all-rounder spread §9 wants. Verified
  empirically (`actingModel.diagnostic.test.ts`): fame↔craft correlation ≈ 0,
  and the archetype curves **cross** (pro wins self-directed, magnet wins with
  its ideal hands-on director).

- **Generation without stream perturbation.** Procedural craft (and director
  `handsOn`) are derived by **hash** from stable, fame-independent per-person
  entropy (the acting style; the director's tone profile) rather than by
  consuming the rng stream. Authoring a new per-person trait must not shift
  every downstream draw — that would silently reshuffle the whole talent pool
  and break unrelated seed-specific tests. Hashing keeps craft deterministic and
  stable per person while leaving the generation stream byte-identical.
  Handcrafted talent instead derives craft from its authored style
  (`deriveCraftFromStyle`) — §9's "sensible default from existing stats" — so the
  marquee roster reads true without per-name authoring yet (still a tuning seam).

- **Open decisions (§12) resolved:** role-fit gating is as proposed (headroom
  full, floor partial at `FIT_FLOOR_GATE = 0.7`); the director-attention trade
  (§11) is **deferred to v2** as the doc assumed.

- **The double-count fix (§8) shipped:** `computeActingScore`'s upstream
  reweighting (`ACTING_UPSTREAM_SCRIPT_WEIGHT` 0.8 / `…DIRECTION_WEIGHT` 0.2)
  keeps direction from being counted twice now that direction drives the
  performance through the unlock.

- **Presentation** (§10): the casting card reads an actor as a dependable
  presence / a director-dependent talent / a capable all-rounder, a director as
  hands-on / measured / gives-room, and — when a director is attached — a
  director↔lead pairing hint (strong / workable / risky). Never raw numbers
  (`engine/castingPresentation.ts`).

- **Test note.** Because acting now carries real per-actor craft variance, the
  Phase-1 execution-calibration fixture pins its cast to a fixed, competent craft
  (the same way it already pins production/post choices) so those tests measure
  execution leverage on a controlled film rather than a random draw. The
  character-fit unit test was tightened to hold *craft* constant and vary only
  role fit, since role-fit is now one input to the performance, not the whole
  score.

## 1. The problem

Three linked shortcomings in how acting works today:

1. **No craft dimension.** `engine/scoring.ts:computeActingScore` is
   `actorFitScore` — how well an actor's `ActingStyle` suits the script tone and
   the specific character. There is deliberately **no skill/craft stat** for
   actors. So a perfectly-matched £50k unknown and a perfectly-matched £20M star
   score *identically*.
2. **Fame ≠ craft isn't expressible.** Actor salary scales with `fame`; fame
   feeds Buzz (`computeBuzzScore`), never quality. Fame and craft are already
   *economically* separate — but there's nothing on the quality side for fame to
   be separate *from*, because craft isn't modelled. The most expensive actor is
   never a worse *actor*, only a pricier one.
3. **Performance is deterministic and uniformly director-gated.** A matched
   actor with a clean shoot delivers exactly their fit-potential, every time.
   Direction does gate acting (via the dependency chain: `actingUpstream` is 65%
   direction, `K_DIRECTION_TO_ACTING = 0.4`), but *uniformly* — every actor is
   director-dependent to the same degree. Real actors differ: some are good
   almost regardless; some only ignite under the right director; and many of the
   very best are the second kind.

## 2. The model in one sentence

An actor has a reliable **floor** and a director-unlockable **headroom**; a
director's **hands-on-ness** is *leverage* that pushes the performance off the
floor toward (or, on a bad match, below) that headroom; and the variance around
the result lives in the production-execution layer.

## 3. Traits

Kept deliberately small. New traits in **bold**; everything else already exists.

### Actor

- **floor** (0–100) — the self-directed baseline: what this actor delivers left
  to their own instincts, or under neutral direction. High floor = the
  dependable pro.
- **headroom** (0–~45) — additional performance a director can *unlock* on top
  of the floor. High headroom = raw talent that transforms with the right
  director. Max potential = `floor + headroom`, reached only with ideal
  direction.
- `ego` (exists) — reused: a high-ego actor clashes with a forceful director
  (routes through existing on-set friction → the execution layer), which is how
  "over-direction can harm" is expressed without a new stat.
- `reliability` (exists) — reused: consistency / how much the captured
  performance varies day to day (already drives production risk + execution
  resilience).
- `fame` (exists) — reused: drives Buzz / opening weekend, **not** quality.

Crucially, **floor and headroom are independent, and both are generated
independently of fame/salary** (§7). That independence is the whole design: it
lets the safest actor *not* be the one with the highest achievable ceiling.

### Director

- `skill` (exists) — competence.
- `ToneProfile` / style (exists) — *what* performance they pull toward; today
  only used for director↔script fit, now also for director↔actor **aim** (§5).
- **handsOn** (0–1) — *how hard* they impose a performance. Low = "lets you
  cook"; high = "drags a specific performance out of you." This is a **leverage**
  dial, not a quality dial (see §5). (Check whether the existing director
  `Strategy`/`Ambition` fields already encode something usable before adding a
  new axis.)

## 4. Why floor + headroom (not ceiling + dependence)

An earlier framing used `ceiling + dependence` (how far an actor falls without
direction). Algebraically that's the *same line*. But parameterising as **floor
+ headroom** — and letting headroom vary *independently* of the floor — is
strictly better, because it makes the two actor types' curves **cross**:

| actor | floor (solo) | headroom | weak/absent direction | ideal direction |
|-------|-------------:|---------:|----------------------:|----------------:|
| dependable pro | 74 | 6 | 74 | 80 |
| auteur-magnet | 52 | 40 | 52 | **92** |

With weak direction the pro wins comfortably; with a great, well-matched,
hands-on director the auteur-magnet blows past them. **Neither is strictly
better — it depends on the director you pair them with.** That crossing is the
trade-off; it can't exist if "how good is this actor" is a single number.

This also kills the degenerate optimum of the ceiling+dependence framing (where
the best actor was simply "high ceiling, low dependence" — good *and* safe, no
trade-off, only cost).

## 5. The unlock function

Direction moves the performance off the actor's self-directed floor. Two
separable director quantities decide how, plus role-fit as a gate.

```
roleFit   ∈ [0,1]   actor ↔ role suitability (today's actorFitScore: style↔script↔character)
aim       ∈ [-1,1]  director ↔ actor suitability (director ToneProfile ↔ actor ActingStyle);
                    +1 well-matched, -1 confidently mismatched, ~0 neutral
push      ∈ [0,1]   how forcefully AND competently the director shapes the performance
                    push = (BASE_INFLUENCE + handsOn × (1 − BASE_INFLUENCE)) × skill/100
```

- **roleFit gates what's even available.** A miscast actor can't have their
  headroom unlocked (you can't drag a great performance out of the wrong role),
  and loses part of their floor:

  ```
  effFloor        = floor × (FIT_FLOOR_GATE + (1 − FIT_FLOOR_GATE) × roleFit)   // FIT_FLOOR_GATE ~0.7
  availHeadroom   = headroom × roleFit
  ```

- **push × aim realises the available headroom, signed by aim:**

  ```
  realized = effFloor + availHeadroom × push × signedAim
  signedAim = aim >= 0 ? aim : aim × MISMATCH_PENALTY_SCALE   // ~0.6: a wrong read hurts, but less than a right one helps
  ```

The behaviour this produces — the heart of the model:

- **hands-off (low push):** performance ≈ floor, *regardless of match*. Safe,
  low-variance, ignores both chemistry and skill. "Let you cook."
- **hands-on + well-aimed + high headroom:** realised ≈ `floor + headroom`. The
  career-best. 🎯
- **hands-on + mis-aimed:** realised drops **below floor** — a forceful director
  confidently dragging out the *wrong* performance is worse than leaving the
  actor alone. (This is where sub-floor performances come from — answering the
  "can it go below floor?" question: yes, exactly here.)
- **low-headroom pro:** barely moves under any director; hands-on effort is
  mostly wasted on them.

So **hands-on-ness is a bet**: pair a forceful director with a high-headroom
actor you're confident is a match → greatness; get the match wrong → you've
actively hurt the film. A hands-off director is the safe pairing under
uncertainty. That is a genuine, legible casting decision (Principle 6).

### Over-direction friction — free from existing systems

The "micromanaging a strong-willed star backfires" case is **not** in this
formula. It's a high-`handsOn` director meeting a high-`ego` actor, which already
raises morale risk and fires on-set conflict events — which now flow through the
production-execution layer as a captured-performance hit. We get it for free.

## 6. Variance — in the execution layer, not a stat

`realized` above is the *expected* performance. The spread around it belongs to
production execution (`engine/productionExecution.ts`), where `performanceCapture`
already lives:

- Variance grows with **unrealised headroom** — an actor whose ceiling wasn't
  locked in (hands-off or mismatched director) is volatile: they might catch
  fire or fall flat.
- Variance grows with a **rough shoot** (low morale, conflict, `reliability`) and
  shrinks with a smooth one.
- A **fully-unlocked, well-matched** performance is low-variance — it's locked
  in.

So "good actors can deliver bad performances" is endogenous and legible: it
traces to weak/mismatched direction, unrealised headroom, or a troubled shoot —
shown as causes on the Production Execution card — never a hidden roll. This is
the acting-specific expression of the execution model we already built.

## 7. Fame / craft decoupling and the archetype space

`floor`, `headroom`, and `fame` are generated on **separate axes**. That yields
the real archetypes (a 2-axis craft space × a fame axis):

| archetype | floor | headroom | fame | reads as |
|-----------|------:|---------:|-----:|----------|
| The dependable pro | high | low | any | delivers reliably; a great director is wasted on them |
| The auteur-magnet | mid | high | often high | transcendent with the right director, mediocre without |
| The famous coaster | low | low | high | fame buys the opening; caps the film's acting |
| The undiscovered talent | mid | high | low | cheap, high upside if you can direct them |

Economic consequence, cleanly split: **fame → Buzz/commercial; craft
(floor/headroom) → quality/critical.** A savvy player casts a famous coaster for
opening weekend on a spectacle, and an undiscovered high-headroom talent + a
matched hands-on director for an awards play. Being the most expensive is no
longer the safe default — sometimes it's the worst *actor* in the room.

## 8. Routing into scoring (and avoiding double-counting)

`realized` per actor replaces `actorFitScore` inside `computeActingScore`
(still averaged leads 0.7 / supporting 0.3). Then the **dependency chain must
change to avoid double-counting direction**:

- Today `actingUpstream` is 65% direction — the chain gates acting by direction
  *generically*. Now direction's influence on acting is modelled *explicitly* in
  the unlock. So the chain's `ACTING_UPSTREAM_DIRECTION_WEIGHT` should be
  **reduced (toward mostly-script)**, or direction removed from `actingUpstream`
  entirely, so direction→acting is counted once, in the unlock, not twice.
- Direction still influences the film broadly through its own top-level term and
  the footage/production paths — unchanged.

This is the one non-obvious integration point; the rebalance must be verified so
total direction leverage on final quality doesn't spike.

## 9. Generation

- Sample `floor` and `headroom` **independently**, and independently of the
  price/fame axis the generator already uses. A useful shape: most actors
  moderate on both; a minority genuinely high-floor (pros) or high-headroom
  (magnets); the two rarely both maxed (the all-time greats).
- Sample director `handsOn` across the range; correlate loosely with an
  "actor's-director vs visual-stylist" flavour if desired (see §11).
- **Handcrafted roster:** the marquee talents (`data/handcraftedTalents.ts`)
  need floor/headroom/handsOn values. Seed with a sensible default derived from
  their existing stats, then hand-tune the recognisable names so the archetypes
  read true. This is the main authoring cost; under the pre-launch save policy
  (`CLAUDE.md`) there is no migration burden.

## 10. What the player sees (qualitative, per house style)

Never raw floor/headroom/aim numbers. Instead, presentation-layer reads:

- On the casting screen: an actor reads as e.g. *"A dependable presence — steady
  in almost any hands"* vs *"Raw, director-dependent talent — soars with the
  right filmmaker, adrift without."* A director reads as *"a hands-on
  performance-driver"* vs *"gives actors room."*
- A compatibility hint for the director↔lead pairing (great match / risky match),
  the way casting compatibility is already surfaced.
- The *result* shows up in the Production Execution card we built (a career-best,
  or a performance that never came together, as a named cause).

Dev inspectors/tests may read the raw values.

## 11. Deferred / optional (explicitly out of the first pass)

- **Director attention as a budget (v2).** A director spends attention across
  *performance* and *visual/technical* execution. A performance-driver gets great
  turns but a less polished-looking film; a visual stylist the reverse. This
  makes `handsOn` *trade against* visual execution instead of being free, and
  slots directly into the typed-department execution model. Lovely, but a second
  pass — do not build it first.
- **Director↔actor collaboration history** ("their regular collaborator") — a
  later flavour layer on `aim`.

## 12. Decisions to confirm before implementation

1. **Role-fit gating** — proposed: fit gates the *headroom* fully (miscasting
   kills the upside) and the *floor* partially (`FIT_FLOOR_GATE ~0.7`, so a pro
   is still decent slightly miscast). Confirm, or prefer fit as a single flat
   multiplier on the whole performance?
2. **Director-attention trade (§11)** — confirmed **deferred to v2**? (This doc
   assumes yes.)

## 13. Testing & validation approach

Mirror the execution work: pure-function unit tests + an opt-in diagnostic.

- Unit: floor is delivered under neutral direction; a great matched hands-on
  director unlocks headroom; a mismatched hands-on director pushes below floor;
  a hands-off director ≈ floor regardless of match; a low-headroom pro barely
  moves; fame does not affect the acting score; role-fit gates headroom.
- Integration: the curves **cross** (auteur-magnet beats pro with a great
  director, loses without); direction's *total* leverage on quality doesn't spike
  after the `actingUpstream` rebalance (no double-count).
- Diagnostic: across many seeds, report the acting-score distribution by actor
  archetype × director type, and confirm the fame/craft correlation is ~zero.

## 14. Why this is the right pre-Studio-Identity foundation

Studio Identity needs something meaningful to differ *on*. With craft modelled,
a prestige house can cast for floor+headroom and pair with matched hands-on
directors (awards plays); a commercial house can cast for fame (opening weekend)
and take fewer director risks. Without this model, "casting strategy" has no
quality axis to vary — so this comes first.

## Non-goals / cautions

- **Two actor traits, one director trait.** Let variance and over-direction
  friction ride existing systems (execution layer, `ego`, `reliability`) rather
  than becoming new stats.
- **Keep role-fit meaningful** — a brilliant actor badly miscast must still
  underdeliver (headroom gated by fit).
- **Keep fame economically worth paying for** — it must still buy real Buzz, or
  famous-but-limited actors become strictly bad rather than a real trade-off.
- **Verify the direction double-count fix** (§8) — the most likely place a
  careless implementation goes wrong.
