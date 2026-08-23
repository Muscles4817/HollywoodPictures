# Reception Model — diagnosis and proposed direction

**Status:** diagnosis complete and measured; direction proposed, not ratified.

`SIMULATION_PHILOSOPHY.md` opens by naming two failures: the finished film is
nearly deterministic, and the systems that should create variety are
disconnected from it. This document is the measured follow-up. It establishes
*where* the determinism comes from, with numbers, and proposes what to do.

The headline: **critic and audience scores are narrow because the pipeline
averages three times in a row, and averaging is a variance destroyer.** Nothing
about the box-office model causes it. Box office faithfully transmits the narrow
signal it is handed.

---

## 1. The measurement

Over 395 films from four 4-year simulated market runs, driving the real
settlement loop.

| Stage | SD | Range |
|---|--:|--:|
| `script.originality` / `.structure` / `.characters` / `.dialogue` | 15.6–23.1 | 12→100 |
| `scriptScore` (mean of those four) | **11.2** | 37→86 |
| `actingScore` | 5.8 | 40→84 |
| `productionScore` | 6.4 | 45→74 |
| `postProductionScore` | **4.0** | **55→68** |
| `qualityScore` (weighted mean of four departments) | **6.4** | 32→69 |
| `criticScore` | 7.4 | 35→72 |
| `audienceScore` | 6.6 | 42→77 |

Leaf spread of ~18 becomes reception spread of ~7. That is the √N cascade of
three nested means, almost exactly.

### 1.1 The control case

`computeBuzzScore` scores the **same films, same talent, same studios, same
generators** and produces **SD 30.1 spanning 0→100**. It is not smarter. It is
structurally different: it works in centred deviations, multiplies by a gate
(`marketingGate = 0.3 + 0.7 · starPower`), and passes through a soft ceiling
instead of a hard clamp.

The world is not homogeneous. The composition is the problem. This is a
controlled experiment already sitting inside the codebase.

### 1.2 Execution does not reach the finished film

One fixed production plan, resolved 240 times, varying only the execution path:

```
scriptScore          sd 0.000   range 0
directionScore       sd 0.000   range 0
actingScore          sd 0.000   range 0
postProductionScore  sd 0.000   range 0
productionScore      sd 0.483   range 2
qualityScore         sd 1.514   range 7
criticScore          sd 1.183   range 6
audienceScore        sd 0.785   range 3
buzzScore            sd 8.520   range 48
gross $M             sd 0.189   → CV 0.010
```

**Four of five departments are literally invariant to how the shoot went.** The
entire execution-variance system moves one department by two points. That is the
origin of the CV 0.010 in `boxOfficeVariance.diagnostic.test.ts` — there is
nothing to damp.

The one thing that does vary, buzz (48-point range on a fixed plan), feeds only
`conversionPacingBaseline`. Measured separately: varying pacing from 1.0 to 0.30
changes run length from 4 to 12 weeks and lifetime gross by **0.8%**. The
model's only real variance is routed exclusively into its least consequential
channel.

---

## 2. Verified defects

Each of these was confirmed against the code and the trace data, not inferred.

### 2.1 The great actors already exist; the mean hides them

`talentGenerator.ts:144` rolls **1–2 signature axes at [65,90]** and the
remaining 3–4 at **[15,50]** — deliberately building specialists.
`computeActorAbility` (`types/index.ts:361`) then averages all five.

Measured over 3,600 generated actors:

| | mean | SD | max |
|---|--:|--:|--:|
| `computeActorAbility` (mean of 5) | 45.8 | 6.2 | **63** |
| Best axis | 79.6 | 7.3 | **90** |
| 2nd best axis | 57.9 | 16.3 | 90 |
| Worst axis | 22.6 | 6.5 | 47 |

**1,171 actors (32.5%) have a signature axis at 85+. Zero have a mean at 85+.**

A generated actor with `comedy: 88, charisma: 84` is a magnetic comic star. The
mean is dominated by the three filler axes the generator *intentionally* rolled
low, and reports 46. `signatureGift()` in `actingModel.ts` already reads the
argmax and knows this; the scoring path does not.

This is the cheapest high-value fix available: read the axis the **role** demands
rather than the mean.

### 2.2 Two outcome labels are unreachable

| Label | Requires | Measured maximum |
|---|---|---|
| `Masterpiece` | `quality ≥ 85 && critic ≥ 88 && audience ≥ 75` | quality **66**, critic **71** |
| `Cult Hit` | `audience ≥ 78 && critic ≥ 60` | audience **72** |

Across 69 films in the trace, only five labels ever appear:

```
Weak 29 · Hit 12 · Modest Success 12 · Flop 12 · Blockbuster 4
```

Score compression has silently deleted the top of the outcome vocabulary. The
same applies to the prestige bands in `reputation.ts`, whose `+1/+2/+3` tiers
essentially never fire against a signal with SD 6.

### 2.3 The default post-production choice is already maxed

`DEFAULT_POST_PRODUCTION_CHOICES` is Balanced + Trailer-focused:

```
briefAudienceEditScore = 50 + 3×5 + 8×5 = 105 → clamped to 100
```

Every player who changes nothing receives the ceiling. `Artistic` clamps on the
critic side too (`50 + 12×5 = 110 → 100`). The one axis on which critics and
audiences currently diverge is a dropdown, and it is partly inert.

### 2.4 `CRITIC_WEIGHTS` and `AUDIENCE_WEIGHTS` are dead

Defined and exported in `data/scoringWeights.ts`; referenced by no engine code.

### 2.5 `TargetAudience` has zero effect on `audienceScore`

The player's most explicit statement of who a film is for is invisible to the
number measuring whether they liked it. Likewise marketing: `computeAudienceScore`
deliberately excludes it, on the reasoning that "marketing builds awareness, not
affection." Half right — marketing cannot buy affection, but overselling
destroys it, and that is the dominant real-world mechanism behind catastrophic
audience scores.

### 2.6 A note on `reviews.ts`

`QUOTE_SCORE_JITTER = 8` applies `randInt(rng, -8, +8)` to displayed quote
scores. This is in the **presentation layer** — `criticScore` and `audienceScore`
remain deterministic, so Principle 1 is not violated. It is nonetheless a design
smell: the UI fabricates disagreement because the engine gives it nothing real
to show.

---

## 3. What reception should model

Four independent analyses were commissioned — two constrained to existing values,
two free to propose new ones. Their points of agreement are the substance of
this section; convergence from independent work is the strongest evidence
available.

### 3.1 Critics evaluate against cinema; audiences evaluate against the promise

This single asymmetry generates almost every real divergence, and the current
model expresses none of it because both scores are affine in one `qualityScore`.

It implies **different distribution shapes**, which should be treated as
calibration targets:

- **Critic** — roughly symmetric, mean ≈ 56, SD ≈ 17, realistically 10→95
  (Metacritic's shape).
- **Audience** — high-mean, lower-SD, **left-skewed**, with a thin catastrophic
  tail reachable only through betrayal, not through mediocrity (CinemaScore's
  shape; it almost never goes below B−, because the people polled *chose* the
  ticket).

Currently both sit at SD ~7 and are roughly symmetric.

### 3.2 The agreed structural changes

1. **Genre fulfilment must be multiplicative**, not 25% of an average. Today
   `deriveGenreFit` has total leverage of ~10% on the headline — a film sold as
   horror that delivers a marriage drama moves the audience score by two points.
2. **Originality must be a two-sided bet interacting with execution.**
   `+originality × 0.14` makes critic esteem *purchasable* regardless of whether
   the film works — structurally the same defect the buzz model already fixed for
   marketing spend (`DESIGN_box_office_calibration_targets.md` §6).
3. **Post-production must be a realisation factor, not a summand.** A variable
   with SD 4.0 carrying 25% of the quality weight is a divisor. The dependency
   chain already half-believes this (`K_FOOTAGE_TO_EDITING = 0.25`, "an editor
   cannot cut footage that was never shot").
4. **Critic and audience must be different functionals**, not different
   weightings of one scalar.

### 3.3 What actually produces the spread

One analysis ran an ablation and reported a result against its own thesis:
replacing its order-statistic peak term with a plain mean cost only **0.3 SD**.

The spread comes overwhelmingly from **wide, un-averaged primitives** — not from
sophisticated combinators. This is the most important finding for sequencing:
**fix the inputs first, the composition second.**

### 3.4 Asymmetries worth encoding

Grounded in how reception actually works, these are the places where the same
input should read differently to the two constituencies:

| Axis | Critics | Audiences |
|---|---|---|
| Genre repetition over time | fatigue (negative) | comfort (mildly positive) |
| Ambition that misses | half-forgiven — "fascinating failure" | punished hard |
| Structure of judgement | one outstanding element can carry a film | weakest-link; a bad ending ruins it |
| Sentimentality | negative | positive |
| Genre duty (horror must scare) | disappointing if failed | **fatal** if failed |
| Narrower target audience | no effect | *raises* the score — self-selection |
| Sample size | small panel → **more** volatile | thousands → less volatile |

Note the last row inverts the current implementation, where both scores are
averages of the same average.

---

## 4. Proposed build order

Ordered by leverage per unit of cost and by dependency. Steps 1–2 are the
prerequisites; without them the later steps amplify a signal that is not there.

1. **Per-axis actor read.** ✅ **Done.** See §4.1 for what shipped and what it
   measured — including an important correction to the diagnosis in §2.1.
2. **Ambition vs delivery gap.** Give a finished film *realised* properties
   distinct from its screenplay's *potential* ones, and scale execution's effect
   by how far the plan reached. This is the determinism fix. One analysis
   measured a safe package at critic SD 1.44 across 240 shoots and a risky one at
   **12.83** — the asymmetry Principle 1 asks for, emerging from structure rather
   than a variance knob.
3. **Remove the three averages.** Structure as a gate rather than a summand;
   post-production as a multiplicative factor; peak and weakest-link order
   statistics in place of departmental means.
4. **Inverted terms.** Originality, genre conformity, franchise recognition, and
   fame-over-craft read with opposite signs between the two constituencies. The
   cheapest available decorrelation — mostly negating fields that already exist.
5. **Audience semantics.** Turnout weighting (self-selection) and an expectation
   gap set by buzz and campaign angle. Retires the `simAudienceScore` shadow-score
   in `releaseFilm.ts:258`, which exists precisely because the reported score
   cannot currently carry an expectation penalty.
6. **Calibration anchor tables.** Put the target distribution shape in `data/` as
   a piecewise-linear anchor table (the `MARKETING_SPEND_ANCHORS` pattern), so
   re-shaping reception is a data edit rather than an emergent accident.

**Deferred:** a full enumerated critic panel (12 voices × taste vectors). It is
the most elegant proposal and the most authored numbers (~290) for the least
marginal spread once 1–3 land. Revisit when the departments have real material to
disagree about.

### 4.1 Step 1 as built, and a correction to §2.1

**Correction.** §2.1 measures `computeActorAbility`, and it is accurate about
that function — but tracing the call graph shows it is **not** on the scoring
path for generated actors. `talentGenerator.ts:425` gives every generated actor
a `craftFloor`/`craftHeadroom` from `deriveCraftSeeded`, hashed from the acting
style as an *entropy source* rather than derived from it as a *function* (the
comment there explains why: style spikiness is uniformly high and would saturate
headroom). `computeActorAbility` therefore drives the Talent Database display
and handcrafted-actor craft only.

So for the ~900 generated actors in a pool, the entire path from acting style to
performance runs through **role fit**: `actorFitScore` blends whole-script tone
compatibility (60%) with `computeCharacterCompatibility` (40%). The specialism
was failing to reach performance, but through that route, not through the mean.

**What shipped.** `computeCharacterCompatibility` was an unweighted mean of
*absolute* per-axis gaps. Two defects:

- **Symmetric** — exceeding a role's demand was penalised exactly as much as
  falling short. An actor with `comedy: 88` in a role demanding 50 scored the
  same as one with `comedy: 12`.
- **Unweighted** — all five axes counted equally, so axes the part never asks
  about dragged a well-cast actor down. A two-axis specialist was penalised for
  their *second* strength.

It is now demand-weighted (each axis counts in proportion to what the role asks)
and asymmetric (only a shortfall is charged; surplus is free). Whether a broadly
comic presence suits a bleak film at all is a whole-film tone question, which
`computeCompatibility` already answers — so character fit now only ever asks
"can they meet what the part asks for."

`computeCharacterCompatibilityBreakdown` gained a `demandWeight` per axis, and
the casting card's fit prose uses it: an axis the role barely demands scores ~100
by default, and describing that as "excellent physicality fit" for a role with no
physicality in it would be a lie.

**Measured, over 1,800 generated actors cast in a role demanding their best axis
versus their worst:**

| | before | after |
|---|--:|--:|
| role fit, cast to strength | 83.6 (max 98) | **95.4 (max 100)** |
| role fit, cast against strength | 61.4 | 65.8 |
| performance delta (to strength − against) | **4.1** | **5.5** |

**And over 397 films from four 4-year market runs:**

| | before | after |
|---|--:|--:|
| `actingScore` SD / range | 5.8 / 40–84 | 5.9 / **41–87** |
| `qualityScore` SD | 6.4 | 6.6 |
| `criticScore` SD / range | 7.4 / 35–72 | 7.7 / **31–72** |
| `audienceScore` SD | 6.6 | 6.5 |

**The aggregate distribution is essentially unmoved, and that is the expected
result.** Casting to strength now pays 34% more and the fit signal is correctly
shaped, but `actingScore` is still averaged into `qualityScore` and thence into
reception. This step makes the *decision* meaningful; steps 3 and 4 are what
convert a wider input into a wider output. It is a prerequisite, not a fix, and
the measurement above is the evidence for that claim rather than an assertion of
it.

### 4.2 Target correlation

The four analyses predicted critic–audience correlations of 0.48, 0.64, 0.73 and
0.78. Real-world is ≈0.70–0.75. Treat **0.70–0.75** as the target and note that
the lowest prediction over-decorrelates.

---

## 5. Coupling risk — read before starting

**This work and the box-office recalibration are one piece of work, not two.**
All four analyses reached this independently.

`audienceScore` feeds `AudienceSimulationFixedState` and drives word of mouth
through `computeReceptionResponseMultiplier`, which is **convex**
(`RECEPTION_EXPONENT = 2`) over `(audience × 0.7 + critic × 0.3)`. Moving
audience SD from 6.6 to ~15 pushes far more films into both the shallow and the
steep parts of that curve. Legs will fan out in both directions.

Consequences to expect and re-sweep together:

- The **unprofitable tail improves** — `DESIGN_box_office_engine_map.md` §11
  notes "no WOM change can crater a film that always scores 60–75". Films will
  now genuinely score 30–45 and their legs will collapse. This is the fix for
  that documented root cause.
- The **megahit tail opens**, because films at audience 90 will exist and the
  crossover step is reception-gated. Check against
  `audienceSimulationRegressionMatrix.test.ts`'s reproduction-ratio guard.
- **`RECEPTION_PIVOT = 0.22` and `conversionPacingBaseline` were jointly swept
  against the current narrow distribution** and will need re-fitting.
  `DESIGN_box_office_engine_map.md` §9 documents that as a four-way trade-off
  frontier, not a one-line tweak.

### 5.1 Other downstream consumers

Every one of these was tuned against a dead signal and will start firing:

- `outcome.ts` — `Masterpiece` and `Cult Hit` thresholds (§2.2). Re-ratify
  deliberately rather than inheriting.
- `reputation.ts` — prestige bands, currently compressed into `−1/0`.
- `awards.ts` — `quality × 0.6 + critic × 0.4`; contenders currently sit within
  6 points of each other, making Best Picture close to arbitrary.
- `ancillary.ts` — `BELOVED_AUDIENCE_FLOOR = 75`, currently almost never reached.
- `reviews.ts`, `premiereReport.ts` — gain real inputs; the RNG jitter and the
  `DIVERGENCE_GAP` heuristic can both be retired.

Per `CLAUDE.md`, save compatibility is out of scope: bump `SAVE_KEY`, write no
migration.

---

## 6. Open questions

1. **Is `audienceScore` an opening-night exit poll or a running aggregate?**
   CinemaScore (SD ≈ 9, heavily top-compressed) and audience RT (SD ≈ 17) are
   different measures with different shapes. The choice determines the target
   distribution and is currently unstated.
2. **Should word of mouth read the mean or the recommend share?**
   `computeReceptionResponseMultiplier` squares a blended mean. The fraction who
   would recommend is arguably the more mechanistically correct diffusion driver
   and is far more discriminating.
3. **Should reception drift over a run?** In reality an audience score is the
   running aggregate of everyone who has seen it, and the crossover audience is
   systematically less satisfied than the opening-weekend one. This would explain
   leg decay mechanistically, but `AudienceSimulationFixedState`'s whole premise
   is that reception is fixed at release.
4. **Should coherence be earned or free?** If tonal consistency is simply
   "check the tone profiles match", it is a solvable puzzle rather than a bet.
   Deliberate tonal tension should probably *widen* the outcome rather than
   merely lower it.
5. **Do rivals go through the same pipeline?** `personDrivenCraft` is currently
   false for rival films, so their department scores are systematically flatter
   than the player's. Under a higher-gain reception model that gap amplifies.

---

## 7. Reproducing the measurements

```bash
# two simulated years of the theatrical market, per-film and per-week (docs/BOX_OFFICE_BRIEFING.md §8)
BOX_OFFICE_TRACE=1 npx vitest run src/engine/boxOfficeBriefingTrace.diagnostic.test.ts \
  --disable-console-intercept 2>&1 \
  | sed -n '/BEGIN_TRACE_JSON/,/END_TRACE_JSON/p' | sed '1d;$d' | tr -d '\n' > trace.json

# the fixed-plan determinism figure
BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeVariance.diagnostic.test.ts --disable-console-intercept
```

The per-stage SD cascade in §1 and the actor-axis table in §2.1 were measured with
throwaway probes over `generateTalentPool` and the rival market loop; both are
straightforward to reconstruct from the numbers given and were not kept in the
repo.
