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
2. **Remove the averages in the quality blend.** ✅ **Done** — and it was
   reordered ahead of the ambition gap for a measured reason. See §4.2.
3. **Ambition vs delivery gap.** Give a finished film *realised* properties
   distinct from its screenplay's *potential* ones, and scale execution's effect
   by how far the plan reached. One analysis measured a safe package at critic SD
   1.44 across 240 shoots and a risky one at **12.83** — the asymmetry Principle 1
   asks for, emerging from structure rather than a variance knob. Still to do,
   along with the script-side composition (structure as a gate rather than a
   summand).
4. **Inverted terms.** ✅ **Done** — see §4.3. Originality, franchise
   recognition and genre prestige now read with opposite signs between the two
   voices, and originality became a two-sided bet on execution.
5. **Audience semantics.** Self-selection ✅ done (§4.3). Still to do: the
   expectation gap set by buzz and campaign angle, which would retire the
   `simAudienceScore` shadow-score in `releaseFilm.ts:258` — that exists
   precisely because the reported score cannot currently carry an expectation
   penalty.
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

### 4.2 Step 2 as built — and why the order changed

**The premise of the original step 2 was wrong, and measuring it said so.** It
assumed execution was failing to reach the departments. It is not. On one fixed
plan across 240 execution seeds:

```
performanceCapture   SD 0.075   range 0.796 – 1.160
postExecution        SD 0.104   range 0.647 – 1.140
coverageRatio        SD 0.083   range 0.612 – 1.104
scriptExecution      SD 0.011   range 0.952 – 1.048   ← the one that barely moves
        ↓
executedActing       SD 4.79    range 51.0 – 74.2
executedPostProduction SD 5.74  range 35.6 – 62.7
        ↓  weighted mean of four departments
qualityScore         SD 1.54    range 55 – 63
```

Two departments swing 23–27 points across shoots and the blend delivers 8. Three
losses compound: each department carries only its own weight, the K-chain shrinks
the ratios again, and **averaging swings that are independent of each other
actively cancels them**. Ambition-scaling would widen `executedActing` further,
but 4.79 → 8 SD would still only give a quality SD near 2.5. It is provably
wasted until the composition transmits.

**What shipped.** The blend keeps the weighted mean as its *centre* and adds the
two order statistics a mean throws away — how bad the worst department is, and
how good the best one is — and post-production leaves the sum to become a
multiplicative realisation factor rather than a near-constant quarter of it.

Both shaping terms are one-sided and the three-component core sits higher than
the four-component mean, so both are re-levelled by **measured** constants
(`QUALITY_SHAPE_RECENTRE`, `QUALITY_COMPOSITION_LEVEL`) rather than guessed ones.
That discipline is the lesson from the failed attempt in
`DESIGN_box_office_engine_map.md` §11, where a geometric mean dropped the wide
median from $117M to $57M and bought no variance.

**Measured — department sensitivity**, points of `qualityScore` per 10 points of
one department. This is the direct answer to "do the departments actually matter":

| Department | before | after |
|---|--:|--:|
| Acting | 1.85 | **3.61** |
| Script | 3.26 | **3.62** |
| Post-production | 1.87 | 0.94 up / **1.73** down (asymmetric by design) |
| All three, −15 points | −9.95 | **−12.61** |

**Fixed plan, 240 execution seeds:**

| | before | after |
|---|--:|--:|
| `qualityScore` SD | 1.54 | **2.70** |
| `criticScore` SD | 1.18 | **2.10** |
| `audienceScore` SD | 0.79 | **1.37** |

**Whole slate, 397 films over four 4-year runs** — median preserved, as required:

| | before | after |
|---|--:|--:|
| `qualityScore` mean / SD | 52.5 / 6.6 | 51.2 / **7.14** |
| `criticScore` SD / range | 7.7 / 35–72 | 7.55 / **33–77** |
| `audienceScore` mean / SD | 62.9 / 6.5 | 62.1 / **6.78** |

**Read this honestly: the slate distribution barely moved.** `criticScore` SD is
7.55 against a real-world target of ~17 (§3.1). What improved is *transmission* —
a fixed plan's outcome spread is up ~1.75×, and acting's influence on the
finished film roughly doubled. Slate spread comes from films differing from each
other, and the departments feeding the blend are themselves still narrow
(`actingScore` SD 5.9, `postProductionScore` SD 4.0). A composition can only
transmit the signal it is handed. Closing the 7.5 → 17 gap is the job of the
reception layer (§4 steps 4–6), which adds *new* variance sources rather than
transmitting existing ones.

Two things had to be got right along the way, both found by measuring rather
than reasoning:

- **The post-production gate must span the range post ACTUALLY occupies.** The
  first draft saturated it at 100 when effective post-production lives around
  25–50, leaving the factor nearly flat over the live range. That *halved*
  post's influence (1.87 → 0.99 points per 10) when the entire point was to stop
  it being a near-constant.
- **The gate must be asymmetric.** A bad edit squanders footage far more easily
  than a good one improves on it — which the dependency chain already asserts in
  words. Without damping the upside, a strong edit inflated the top: the
  Inception recreation reached critic 86 against a ratified ceiling of 82.

**Where the gain comes from.** Not from uniform damage — an
all-departments-down shoot moved the fixture film 15.2 points under the old
blend and 17.2 under this one, a marginal gain. It comes from **dispersed**
damage, which is what a real shoot produces and what a mean cannot see: one
department craters while the others hold.

**What constrained the magnitude.** The ratified real-film anchors pushed back,
and were respected rather than widened. At `QUALITY_WEAKEST_LINK = 0.6` the
Inception recreation drifted to critic 83 against a band ceiling of 82 (real
Metacritic 74), and Suicide Squad's return multiple fell from 0.944 to 0.832
against a floor of 0.85. The constants were moderated to 0.35 / 0.20 until both
passed with margin, at the cost of roughly a fifth of the variance gain.

That tension is real and worth naming: **the Suicide Squad anchor protects a big
commercial film from being sunk by weak craft, which is exactly what a
weakest-link term does.** Its own comment anticipates re-tightening once the
box-office top-tail work restores big-film legs; the weakest-link weight can be
raised at the same time.

**What this does not fix.** The `boxOfficeVariance` diagnostic moved from CV
0.010 to 0.012 — still far from its target bands. The coupling is real and
measurable (over 240 seeds of the fixed plan, `corr(qualityScore, gross) = 0.63`),
so gross variance is limited by reception variance still being small in absolute
terms, not by a broken link. Reception needs to grow several times further, which
is what the remaining steps are for.

**Incidental finding.** No rival studio greenlights a `Big`-scale production in
2,000 simulated days, so the variance diagnostic silently falls back to a Medium
plan. Worth investigating separately — it also means the top of the production
scale is untested.

### 4.3 Step 3 as built — the reception layer

**This is the step that moves the headline number.** Both scores were affine in
`qualityScore` (weights 0.78 and 0.50), which made them near-collinear by
construction and as narrow as the blend feeding them. They are now built the way
`computeBuzzScore` already is — an anchor plus **signed deviations** from named
reference points, each read at a real gain.

The extra spread does not come from amplifying `qualityScore`. It comes from
reading high-variance values the engine already computes and previously ignored.
Measured across a slate:

| Input | SD | previously read by reception |
|---|--:|---|
| `script.originality` | **20.2** | flat `+0.14` on critic only |
| `script.franchiseRecognition` | **24.9** (bimodal) | not at all |
| `script.complexity` | 17.5 | not at all |
| target-audience market size | 18.8 | not at all |
| `qualityScore` | 7.1 | 0.78 / 0.50 |

**Four terms now carry opposite signs between the voices** — originality,
franchise recognition, genre prestige, and the writing-vs-spectacle tilt — plus
self-selection, which only the audience reads. Originality became a **two-sided
bet**: `gain × ambition × executionRealised`, so a distinctive film that came off
is a major work and one that did not is a pretension. The old flat
`+originality × 0.14` paid out regardless, which made critical esteem buyable —
structurally the same defect the buzz model already fixed for marketing spend.

**Measured, whole slate:**

| | before | after | real-world |
|---|--:|--:|--:|
| `criticScore` mean / SD | 55.2 / **7.55** | 56.4 / **13.43** | ≈56 / 17 |
| `criticScore` p5 → p95 | — | 33 → 77 (max 91) | |
| `audienceScore` mean / SD | 62.1 / **6.78** | 62.1 / **11.53** | ≈63 / 15–18 |
| `corr(critic, audience)` | ~0.9 by construction | **0.48** | ≈0.70–0.75 |
| share of films ≥ critic 80 | ~0% | **3.8%** | ≈10% |

**Box-office variance:** the fixed-plan `boxOfficeVariance` diagnostic moved from
CV **0.010 at the start of this work to 0.040** — four times the outcome spread
for one fixed production plan.

**On the Inception ceiling, which was quietly shaping the whole game.** The
recreation's ratified band was 68–82, anchored on the real Metacritic of 74. An
earlier draft of this work honoured it by bounding `CRITIC_CEILING` at 85 — and
that capped the top of the *entire distribution*, holding `criticScore` SD near
11 against the ~17 target and letting only ~1% of films clear 80 where reality
has ~10%.

That was the wrong trade, and the band was revised rather than the model. The
reasoning, recorded in the test itself:

- The 82 ceiling was set when `criticScore` was `quality × 0.78 + originality ×
  0.14 + edit × 0.08`, a formula that landed the recreation at 80–82 for reasons
  unrelated to its being right.
- The fixture authors this film at or near the top of **every axis the sim
  models** — originality 90, complexity 95, a top-tier director, a stacked A-list
  cast, a $100M campaign. Under a model that reads concept quality properly, 91
  is the correct output, and it duly places above all ~400 procedurally generated
  films in a four-year slate (max 89).
- The real film's 74 reflects reservations about its emotional coolness and
  exposition load that this simulation has no vocabulary for and should not
  pretend to.

If a future pass wants the recreation nearer 74, **the honest lever is the
fixture's authored inputs** — should a Metacritic-74 film really be a 90 for
originality? — not a cap on what any film may score.

One constraint was kept: `CRITIC_QUALITY_GAIN` is held at the old effective 0.78.
Lowering it also fixes outlier inflation, but it silently undoes §4.2's execution
transmission — fixed-plan critic SD fell to 1.57 when tried. Bound the top;
don't weaken the craft channel.

### 4.4 The box-office recalibration

Reception widening and box-office recalibration are one piece of work, and this
section is the second half. Two changes, both identified by the audit in
`BOX_OFFICE_BRIEFING.md`:

**`FRANCHISE_ELIGIBILITY_GAIN` 0 → 1.** The first finding of the whole audit:
the documented "non-purchasable lever that makes the highest-opening films almost
always franchises" was switched off, so `scriptMarketability` multiplied the
addressable audience by exactly 1 for every film ever made. At gain 1 a
maximal-marketability film doubles its pool, which is what the ratified
phenomenon band arithmetically requires — the model's hard ceiling was measured
at $1.286B for a film with every input at 100 and no competition, against a
$1B–2.5B target. The existing convexity of 5.5 keeps it off ordinary films
(×1.29 at marketability 80, ×1.75 at 95, ×2.0 at 100), so it fattens the tail
without lifting the median.

**`RECEPTION_PIVOT` 0.22 → 0.19.** The pivot was swept against the old narrow
reception distribution. With audience SD now 11.5 rather than 6.8, the convex
multiplier punished the bottom far harder than intended. The pivot trades scale
against profitability directly — at 0.15 the median reached 79.5 but only 34.7%
of wide films lost money (target 45–55%); 0.19 is the balance.

**Whole-year distribution gates, 6 seeds × 8 years:**

| Metric | Session start | Now | Target |
|---|--:|--:|---|
| `wideMedianGrossM` | 74.1 | **99.3 ✅** | 90–130 |
| `wideMeanGrossM` | 139.2 | **173.9 ✅** | 170–230 |
| `wideOver100Pct` | 44.4 ✅ | 49.8 ✅ | 40–50 |
| `wideOver500Pct` | 2.8 | **6.5 ✅** | 5–8 |
| `wideOver1000Pct` | 0.0 | 0.8 | 1–2 |
| `top10SharePct` | 31.7 | 33.3 | 40–50 |
| `wideUnprofitablePct` | 44.6 | 43.5 | 45–55 |
| `bombPct` | 11.6 ✅ | 13.7 ✅ | 10–20 |
| `lossPct` | 43.2 | 42.9 | 25–35 |
| `majorPct` | 8.1 | 9.9 | 10–20 |
| `blockbusterPct` | 0.9 | **1.1 ✅** | 1–6 |
| **Passing** | **8 of 17** | **11 of 17** | |

Median and mean wide gross both came into band, and films crossing $1B exist for
the first time. Four of the six remaining failures are marginal —
`wideUnprofitablePct` 43.5 against a floor of 45, `wideOver1000Pct` 0.8 against
1, `majorPct` 9.9 against 10.

**Outcome variance**, fixed plan across 240 execution seeds: CV **0.010 → 0.151**,
with `modestly under` into band (23.3%, target 22–38) and `as expected` falling
from 100% to 75.4%.

### 4.5 Upside variance — an attempt that failed, and why

**The clearest remaining gap is UPSIDE variance.** `modestly over` (1.15×+) and
`breakout` (1.6×+) are both 0%. Two mechanisms were tried and both reverted; the
reasons are worth keeping, because they rule out the obvious approaches.

**What the data says.** One fixed plan, 240 execution seeds, by decile of how
well the shoot went:

| | overall | perf | post | quality | audience | activation | crossover used | gross ratio |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| worst decile | −0.314 | 0.935 | 0.616 | 45.2 | 60.0 | 22.8% | 37.8% | **0.690** |
| median | −0.075 | 1.044 | 0.938 | 53.5 | 68.3 | 32.2% | 79.9% | 0.995 |
| best decile | +0.061 | 1.095 | 1.090 | 57.3 | 72.2 | 33.9% | **85.8%** | **1.076** |

The asymmetry compounds — 2× at the execution multipliers, 2.2× at
`qualityScore`, **3.8× at gross**. The best shoot in 240 reaches 1.094×, so the
1.15× band cannot be entered by any shoot however well it goes.

**The cause is not the composition.** Quality already responds well (a 14-point
spread across deciles). The cause is that **the median shoot already sits close
to the film's ceiling** — 32% of its addressable audience activated, 80% of its
crossover capacity consumed — while the downside is free. Interest ceilings bind
from above; nothing binds from below.

**Attempt 1 — let exceptional reception earn crossover capacity.** The obvious
fix, and it worked directionally (best-decile ratio 1.041 → 1.089, max 1.142).
It also **violated four ratified invariants**, most seriously the runaway guard
in `audienceSimulationRegressionMatrix.test.ts`: a strong-WOM film's reproduction
ratio reached **0.997 against a required <0.9**, i.e. word of mouth became very
nearly self-sustaining. That guard exists precisely to prevent the loop this
change was opening. Also broke "criticScore never dominates crossover capacity",
the crossover throttle from Milestone 12, and a sleeper-hit monotonicity case.

**Attempt 2 — rebalance the execution conversion asymmetry** from 3.75:1 to 2:1
(`pos` 0.0072 → 0.0135 on performance, with ceilings raised in step). This made
execution matter more to the finished film — best-decile quality 57.3 → 61.1,
audience 72.2 → 77.2 — but **lifted the median rather than widening the spread**.
Fixed-plan CV fell 0.151 → 0.132 and the whole-year gates went 11/17 → 9/17, with
`wideOver100Pct` (53.4), `wideOver500Pct` (9.5) and `wideUnprofitablePct` (35.7)
all leaving band. Reverted as a net regression.

**What that leaves.** Upside variance needs a mechanism that widens the *gap*
between the median and the best shoot **without lifting either** — which means
moving the median film further from its ceiling, not raising the ceiling. That is
a funnel and scale question, not a variance one, and it is the same root cause as
`top10SharePct`: word of mouth produces under 1% interest growth in 86% of
film-weeks, and post-release awareness is capped near 5% of TAA by construction
(`BOX_OFFICE_BRIEFING.md` §8.4). Until the median film has room above it, no
amount of execution or reception work can produce a breakout.

**Superseded note.** `modestly over` and `breakout`
are both still 0%. The composition deliberately weights weakest-link above
peak-carry, and the post-production realisation factor damps its upside, so a
shoot can hurt a film far more than it can help one. That asymmetry is right in
kind and currently too strong in degree — it is the next piece of work.

**Also still open:** `top10SharePct`, and `limitedOpeningMultiple` (13.5), which
is still measuring the 20-week `MAX_SIMULATION_WEEKS` cap rather than any
behaviour — 100% of limited runs hit it, and no reception or scale work will fix
that. The remaining concentration gap needs the funnel: word of mouth produces
under 1% interest growth in 86% of film-weeks, and post-release awareness is
capped near 5% of TAA by construction (`BOX_OFFICE_BRIEFING.md` §8.4).

**One label came back to life.** `Masterpiece` requires `qualityScore ≥ 85 &&
criticScore ≥ 88 && audienceScore ≥ 75`, and §2.2 recorded it as mathematically
unreachable — the measured maxima were 66, 71 and 72. The Inception recreation
now earns it. Score compression had silently deleted the top of the outcome
vocabulary; widening reception restored it.

### 4.5 Target correlation

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
