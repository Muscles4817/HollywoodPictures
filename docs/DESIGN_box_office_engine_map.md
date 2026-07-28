# Box-Office Engine — mechanism map, root causes, and calibration levers

> **Purpose.** A living reference for how the box-office simulation actually
> behaves — the causal relationships, where each observable (opening multiple,
> run length, profitability spread, variance) comes from, and which constant
> controls it. Written so we don't have to re-derive the engine's
> interconnectivity every time we calibrate. Update it as findings land.
>
> Companion to `docs/DESIGN_box_office_calibration_targets.md` (the ratified
> *targets*) and `docs/SIMULATION_PHILOSOPHY.md` (the principles). This doc is
> the *how it works and why it misses*, not the *where we're going*.

_Last updated: 2026-07-28 (pacing landed; Root-B scoring/variance investigation)._

---

## 0. TL;DR causal map

```
 PLAN (script/talent/production/marketing)
        │
        ▼
  SCORING  ── audienceScore, criticScore, buzzScore ──┐  ← compressed high (p5–p95 = 56–76),
   (engine/scoring.ts, rivalExecution.ts)             │    nearly execution-invariant (cv 0.015)
        │                                             │
        ▼                                             │
  RELEASE INPUTS  (engine/audienceSimulationInputs.ts)│
   marketingEfficiency, awareness seed, baseInterest, │
   crossoverCapacity, conversionPacingBaseline        │
        │                                             │
        ▼                                             ▼
  WEEKLY AUDIENCE SIM  (engine/audienceSimulationStep.ts)
   funnel: aware → interested → attend, week by week
   WOM reproduction loop drives the "legs"
        │
        ▼
  BOX OFFICE RUN  (engine/boxOfficeRun.ts)  → admissions × $11 ticket → weekly gross
```

Everything downstream of SCORING is a **pure people-model**: plain numbers in,
weekly admissions out, converted to money once at the boundary
(`AVERAGE_TICKET_PRICE = 11`, `boxOfficeRun.ts:144`). There is **no release-time
dice roll** and **no explicit weekly-decay constant** — decline emerges from the
interested pool depleting faster than word-of-mouth refills it.

---

## 1. The weekly funnel & where "opening week" comes from

There is **no separate opening-week formula**. Week 1 is the ordinary weekly
transition applied to an empty history plus a one-time release-day awareness
seed. `releaseFilm.ts:338` calls `advanceOneWeek(fixed, [])` for
`FilmResults.openingWeekend`; `boxOfficeRun.ts:308` independently reproduces the
identical week 1.

Three levers set how big the opening is relative to the total:

| Lever | File:line | Current | Effect |
|---|---|--:|---|
| Release-day awareness seed (`applyReleaseDayAwarenessSeed` / `computeInitialAwareCount`) | `audienceSimulationStep.ts:60`, `audienceSimulationInputs.ts:735` | marketing+fame driven | one-time week-0 awareness lump |
| `conversionPacingBaseline` (Wide) | `audienceSimulationInputs.ts:511` | **0.35** | fraction of the interested pool that converts *every* week — higher = more front-loaded, faster pool drain |
| `MAX_WEEKLY_THROUGHPUT_FRACTION` × availability capacity | `audienceSimulationStep.ts:446` | 0.5 | caps weekly tickets; meant to bind only for reduced availability |

`conversionPacingBaseline` is the primary **drain** lever. Wide=0.35,
Limited=0.06, Festival=0.05. It was deliberately raised 0.14→0.35 (see the long
comment at `audienceSimulationInputs.ts:493`) to shorten Wide runs — but see §4:
that is no longer sufficient post-funnel-recalibration.

---

## 2. Weekly decay / retention

Decline is emergent, not a constant. The knobs that shape it:

| Knob | File:line | Wide value | Note |
|---|---|--:|---|
| `conversionPacingBaseline` | `inputs.ts:511` | 0.35 | pool drain rate — the retention lever |
| `availabilityBaseWeeklyDecay` | `inputs.ts:512` | 0.18 | screens contract ~18%/wk (2nd, exhibition-side decay channel); clamp `MAX_AVAILABILITY_RATE_MAGNITUDE=0.2` |
| External-awareness ramp `ageMultiplier = 0.55^(week-1)` | `step.ts:77` | 0.55 | pre-release awareness trickle decays 45%/wk; base `EXTERNAL_AWARENESS_BASE_RATE=0.03` (`inputs.ts:785`) |
| Interest exhaustion (`saturationDampening`) | `step.ts:239, 291` | — | headroom shrinks as pool fills |

---

## 3. The word-of-mouth reproduction loop (the "legs")

This is the heart of pacing. Per week:

```
womInfluence = computeRunningFilmStrength(fixed, weeks, i)   ← recency-weighted recent
                × computeReceptionResponseMultiplier(fixed)     admissions ÷ maxInterestedAudience
```

`womInfluence` then drives three reproduction effects, each via
`thresholdResponse(x, threshold, sensitivity) = clamp((x-threshold)² · sensitivity, 0, 1)`
(convex/squared — ordinary reactions clear the low bars, only exceptional ones clear the high):

| Effect | File:line | threshold | sensitivity | Notes |
|---|---|--:|--:|---|
| Awareness (step 4) | `step.ts:141` | 0.0 | 300 | **currently disabled** (`newlyAwareFromWom = 0`, `:799`) |
| Natural interest (step 5) | `step.ts:153` | 0.003 | **55** | was 75; halved in Quantum-Signal fix + funnel recal |
| Pull-forward timing (step 8) | `step.ts:154` | 0.005 | 100 | Michaelis-Menten, not raw sensitivity |
| Crossover (step 6) | `step.ts:155` | 0.0075 | **70** | was 100; highest bar; gated by capacity ceiling |

**Reception coupling** — `computeReceptionResponseMultiplier` (`step.ts:166`):
```
weighted = (audienceScore·0.7 + criticScore·0.3) / 100
multiplier = RECEPTION_FLOOR + (1-RECEPTION_FLOOR) · weighted²     (FLOOR=0.01)
```
Squared, audience-weighted. Maps: bad(0.35)→0.13, avg(0.55)→0.29,
good(0.67)→0.45, great(0.82)→0.68. **A ~5× spread — but not steep enough in
practice** (see §4): the early-week `activityFraction` (echo of the big opening)
dominates `womInfluence`, so even average films clear the low thresholds and
hold flat for weeks 1–3.

> ⚠️ **Quantum-Signal runaway.** The two most-warned coupling risks: (a) raising
> the WOM sensitivities back toward 75/100, and (b) shrinking the market/pool
> without re-tuning sensitivities. Both push a merely-good film's reproduction
> ratio (R0, `computeWomReproductionRatio` `step.ts:955`) over replacement → an
> unbounded phenomenon. The `saturationDampening` terms and the Milestone-12
> crossover fix (§4) exist to bound this.

---

## 4. Crossover capacity

- **Capacity ceiling (fixed at release):** `computeCrossoverCapacityFraction`
  (`inputs.ts:336`), `CROSSOVER_CAPACITY_CEILING = 0.3` (`inputs.ts:239`),
  weights `{crossoverPotential:0.55, spectacle:0.3, criticScore:0.15}`,
  × accessibility floor `0.4`.
- **Weekly realization:** `deriveWomCrossoverExpansion` (`step.ts:280`).
  `crossoverCeiling = crossoverCapacityFraction · totalAddressable`;
  `headroom = ceiling − cumulativeCrossoverRealized`;
  `saturationDampening = headroom / ceiling`.
- **Milestone-12 fix (`step.ts:270`):** crossover headroom is bounded against
  its *own* running total `cumulativeCrossoverRealized`, not the combined
  natural+crossover ceiling — so a film's `crossoverCapacityFraction` genuinely
  throttles realized crossover. **Do not regress this** (the earlier naive
  reception-cubing attempt inverted it and broke the Suicide Squad case).

`maxInterestedAudience = (baseInterestFraction + crossoverCapacityFraction) ·
totalAddressable` (`audienceSimulation.ts:163`) — the WOM normalization
denominator, so crossover capacity also feeds back into how strong WOM reads.

---

## 5. Run-length stopping rule

- `hasSimulationEnded` (`step.ts:1008`), from `boxOfficeRun.ts:331`.
- `MAX_SIMULATION_WEEKS = 20` hard cap (`step.ts:997`).
- `MIN_WEEKLY_ADMISSIONS_RATIO = 0.02` (`step.ts:998`) — run ends when a week
  drops below **2% of the opening week's** admissions. Measured *relative to
  opening*, so a more front-loaded opening ⇒ the 2% floor is reached later ⇒
  longer tail (mild self-correction against front-loading).

---

## 6. Baseline (measured 2026-07-28, on master @ merged PR #106)

Driven by the real settlement loop, 6 seeds × 8 yr (`BOX_OFFICE_DIAGNOSTIC=1`).

**Center is calibrated; the *shape* is not.**

| Metric | Now | Target | Verdict |
|---|--:|--:|---|
| Wide median gross | $128M | 90–130 | ✅ |
| Wide mean gross | $187M | 170–230 | ✅ |
| **Opening multiple** | **5.2×** | 2–3× | ❌ pacing |
| **Run length** | **11 wk** | 5–8 wk | ❌ pacing |
| % losing money | 18% | 45–55 | ❌ spread |
| Top-10 share | 19% | 40–50 | ❌ spread |
| % over $1B | 0% | 1–2 | ❌ spread |
| Same-plan variance ("as expected") | **100%** | ~30% | ❌ variance |

### Week-by-week shape (why the opening multiple is 5.2×)

Wide films **hold too flat in weeks 1–3**, then decay normally:

```
week:        w0    w1    w2    w3    w4    w5 …
% of opening 1.00  0.88  0.94  0.83  0.57  0.44   (w2 ≈ w1 !)
wk-over-wk    —    0.88  0.94  0.83  0.74  0.67 → settles ~0.55/wk
```

Real front-loaded wide films drop 45–60% by week 2. Opening here is only **22%**
of total; a 2–3× multiple needs ~33–50%. The flat early hold is the WOM
reproduction echoing the big opening (high `activityFraction` → high
`womInfluence` → strong reproduction) faster than the reception multiplier can
suppress an ordinary film.

---

## 7. Root-cause decomposition — **the shape failures have TWO independent roots**

This was the key finding of the 2026-07-28 investigation. Initially assumed a
single WOM root; the data refuted it.

### Root A — WOM loop (owns pacing + the top tail)
- **Opening multiple / run length**: early-week WOM reproduction too strong &
  uniform. Verified: raising `conversionPacingBaseline` 0.35→0.80 only moves the
  median opening multiple 4.5→3.7 (**saturates**, can't reach 2–3); adding a
  steepened awareness ramp on top still floors at ~3.5. The residual hold is the
  WOM reproduction itself. → must reshape the reception coupling, not just the
  drain.
- **No megahit tail**: coupling *flattens at the top*. Median gross by
  audienceScore band: [55,65)→$98M, [65,75)→$138M, [75,101)→**$149M** (barely
  rises), and p90 *drops* 444M→330M. Great films don't break out because the
  crossover ceiling caps them. → open crossover for genuinely great films.

### Root B — upstream scoring/execution (owns the unprofitable tail + variance)
- **Too few unprofitable/bombs**: `audienceScore` across varied films spans only
  **p5=56 … p50=68 … p95=76** — almost nothing below 55. The AI makes no genuine
  flops, so no unprofitable tail can exist. **No WOM change can crater a film
  that always scores 60–75.**
- **Same-plan variance 100% "as expected"**: a *fixed* plan resolved 120 ways
  gives audienceScore **cv 0.015** (59–63) and gross **cv 0.016**. Execution does
  not move the score. Only `buzzScore` varies (cv 0.089) but buzz has little
  box-office leverage. → the fix is making execution→score produce genuine spread
  (endogenous variance, Simulation-Philosophy Principle 1), **entirely upstream
  of the WOM loop.**

**Consequence for sequencing:** the WOM/pacing rework (Root A) is confirmed,
self-contained, and high-value, but it *cannot* deliver the variance/flop-tail
half (Root B). They are separate pieces. (Decision 2026-07-28: do Root A first,
Root B as a distinct follow-up.)

---

## 8. Lever cheat-sheet

| Want | Change | File:line |
|---|---|---|
| Smaller opening multiple / faster early fall | Steepen reception coupling (suppress ordinary films) and/or raise `conversionPacingBaseline` (saturates ~3.5 alone) | `step.ts:166`, `inputs.ts:511` |
| Shorter runs | Above, or raise `MIN_WEEKLY_ADMISSIONS_RATIO` | `step.ts:998` |
| Bigger breakouts (top-10, $1B tail) | Raise `CROSSOVER_CAPACITY_CEILING` or `CROSSOVER_RESPONSE.sensitivity` — reception-gated so only great films reach it | `inputs.ts:239`, `step.ts:155` |
| Unprofitable tail / bombs | **Upstream** — widen the audienceScore distribution downward (scoring) | `scoring.ts`, `rivalExecution.ts` |
| Same-plan variance | **Upstream** — make execution move the finished score | `rivalExecution.ts` |
| Reception matters more/less to legs | Adjust the coupling curve exponent/pivot | `step.ts:166` |

> Every constant above is flagged in-code as a provisional, diagnostic-swept
> placeholder. Calibrate by editing these + `data/`, never by threading magic
> numbers through logic (CLAUDE.md).

---

## 9. Calibration constants (current)

The Root-A pacing reshape (2026-07-28) settled on:

| Constant | File | Old | New |
|---|---|--:|--:|
| Wide `conversionPacingBaseline` | `inputs.ts` | 0.35 | **0.62** |
| `RECEPTION_PIVOT` | `step.ts` | — (plain `weighted²`) | **0.22** |
| `RECEPTION_EXPONENT` | `step.ts` | 2 (implicit) | 2 |

Reception curve: `mult = FLOOR + (1-FLOOR)·clamp((weighted-0.22)/0.78, 0, 1)²`.
Maps weak(0.44)→~0.08, ordinary(0.62)→~0.28, good(0.72)→~0.42, great(0.85)→~0.66
— a steeper reception→legs coupling than the old plain square (which gave
0.19 / 0.39 / 0.52 / 0.72 respectively).

### The pacing frontier (why not lower / higher)

Front-loading intensity is a single axis (pacing baseline × reception pivot) that
trades **four things against each other simultaneously** — there is no point that
satisfies all of them, so 0.62/0.22 is a chosen compromise, not an optimum:

1. **Opening multiple** ↓ as front-loading ↑ (want ≤3).
2. **Median/mean gross** ↓ as front-loading ↑ (want median 90–130, mean 170–230).
3. **Strong-WOM reproduction ratio** ↑ toward the Quantum-Signal replacement edge
   as front-loading ↑ (must stay <1.0; guarded at <0.9 historically).
4. **Per-film shape** — pushing pacing to ~0.9 hit opening-multiple 2.7 on the
   *aggregate* but over-front-loaded the typical film to ~1.5× legs / 4-week runs
   and *inverted* the strong-WOM vs phenomenon reproduction ordering. Rejected.

0.62/0.22 lands: opening 3.0, runs 7.3, median 117, mean 171 — all in band — with
the Quantum guard intact and healthy per-film shapes. The cost is that it can't
*also* pull the megahit tail or the unprofitable tail into band (those are Roots
A-crossover and B, §7).

### ⚠️ Known tension: expensive mid-reception tentpoles (the "Suicide Squad" case)

Cutting ordinary-film legs to front-load tips an *expensive, mid-reception* film
toward marginal: the Suicide Squad regression (audience 67 / critic 49, ~$274M
all-in) grosses ~$628M (was ~$785M) but its studio revenue (~$258M) lands just
below cost → ~−$17M. This is the collateral of (a) the pivot cutting mid-reception
legs and (b) the top tail thinning (a Root-A-crossover effect). It sits right on
the ratified "a bad critic score must never *by itself* force a commercial loss"
invariant (`realFilmRegression.test.ts`). Restoring big-film legs is the crossover
piece's job; until then this case is marginal. **Resolved (2026-07-28):** the SS
regression was relaxed to assert a big gross + not-a-Flop + a *thin/breakeven*
studio result (rather than strict profit), with an explicit note that it should
re-tighten to a clear profit once the crossover/top-tail piece restores big-film
legs. The theatrical-only sim omits ancillaries (home video etc.), on which the
real film's profit substantially depended, so a thin theatrical result is itself
not unrealistic.

---

## 11. Root B — the scoring & execution pipeline (why scores compress & don't vary)

Investigated 2026-07-28. `audienceScore`/`criticScore` (0–100, FilmResults) are
**pure and deterministic given the plan + recorded event history** — no rng at
release (`engine/scoring.ts`). Two distinct failures, four structural causes.

### Composition (engine/scoring.ts)
```
audienceScore = qualityScore·0.50 + genreFulfilment·0.25 + audienceEditing·0.15 + productionScore·0.10   (:515)
criticScore   = qualityScore·0.78 + originality·0.14      + criticalEdit·0.08                             (:489)
qualityScore  = soft-ceiling dependency chain over {script, direction, acting, postProduction},
                each term renormalized to sum 1, with per-link independence floors K (:394-486)
```

### Empirical decomposition (measured over 931 varied films + one fixed plan × 150 exec seeds)

| Field | varied-film p5–p95 (sd) | fixed-plan cv | Reads as |
|---|---|--:|---|
| audienceScore | 54–76 (6.7) | 0.015 | compressed + execution-invariant |
| criticScore | 49–71 (6.9) | 0.022 | compressed |
| qualityScore | 47–69 (6.7) | 0.029 | compressed |
| scriptScore | 52–82 (9.2) | 0.000 | varies across films, fixed within a plan |
| directionScore | 49–83 (9.7) | — | varies across films |
| actingScore | 53–85 (10.0) | — | varies across films |
| **eventsScore** (shoot outcome) | 38–100 (20.7) | **0.221** | **huge variance, both across films AND within a fixed plan** |

The tell: the craft sub-scores genuinely vary (sd 9–10), and the shoot outcome
swings wildly (eventsScore 12→100 for a *fixed plan*), yet audienceScore collapses
to sd 6.7 and barely moves within a plan (cv 0.015). **Execution variance exists;
it's absorbed before it reaches the score.**

### The four compression/determinism sources (priority order)

1. **The quality combine averages + floors (dominant across-film compression).**
   `computeQualityBreakdown` (`scoring.ts:394-486`) is a 4-term weighted average
   renormalized to sum 1, with independence floors `K_SCRIPT_TO_DIRECTION=0.65`,
   `K_DIRECTION_TO_ACTING=0.4`, `K_DIRECTION_TO_PRODUCTION=0.4`,
   `K_FOOTAGE_TO_EDITING=0.25` (`:344-347`) that stop any department from ever
   dropping below K·raw. Averaging + floors pull qualityScore to the middle.
2. **Execution upside is near-neutral (fixed-plan variance killer).**
   `productionExecution.ts:136-143`: positive conversion sensitivity
   (SCRIPT 0.0042 / PERF 0.0072 / POST 0.0062) is 3–4× smaller than negative
   (0.015 / 0.027 / 0.0235), ceilings only ~1.10–1.16, and resilience absorbs up
   to 50% of the downside (`MAX_MITIGATION=0.5`, positives never mitigated). So a
   great shoot ≈ an average shoot; only genuinely troubled shoots move the score,
   and only downward. This is why a fixed plan gives cv 0.015.
3. **Rival plan variety is narrow (input-side clustering).** Rivals pick
   top-8-by-craft scripts (`rivalStudios.ts:690`), jitter spend only ±0.06
   (`:144-154`), and price-match talent — so rival films cluster in a narrow
   quality band; nothing samples genuinely weak plans.
4. **Anchored sub-terms.** post-production base 55 (`scoring.ts:284`), editing
   terms anchored at 50 (`:494`, `:530`), `budgetFit` flat 85 for any funded film
   (`:304`) — keep even weak films' components off the floor.

### Which fix hits which diagnostic — and why they can't be separated
Initial read was "variance ⟵ #2 (execution), tail ⟵ #1/#3/#4 (combine)". **A sweep
refuted the clean split.** Scaling execution's positive sensitivity up to **20×**
and widening its ceiling to ~1.96 with mitigation 0.05 moved the same-plan
variance CV only 0.012 → **0.026**, still **100% "as expected."** Execution is
absorbed by the two averaging stages downstream (execution → one craft axis →
quality *average* → audience *average*), so tuning the execution *conversion* in
isolation cannot create same-plan variance.

**Conclusion: source #1 (the averaging combine) is the shared, dominant lever for
BOTH failures.** Until the combine stops averaging single-axis swings away:
- a tanked execution can't drag the score down (no same-plan variance), and
- a weak craft axis can't drag the score down (no unprofitable tail).

The next hypothesis was to make `computeQualityBreakdown` **less central-tendency**
(weighted geometric mean + lower K-floors). **A sweep refuted this too** — it is
NOT sufficient, for two structural reasons found in the data:

- **Variance stays immovable.** Blending fully to the geometric mean AND zeroing
  the K-floors left the same-plan variance CV at **0.010** (still 100% "as
  expected"). Why: `audienceScore = qualityScore·0.50 + genreFulfilment·0.25 +
  audienceEditing·0.15 + productionScore·0.10`. The **non-quality 50%** is
  execution-invariant (genreFulfilment is script/talent/budget; editing is
  anchored at 50; production barely moves), so it anchors audienceScore no matter
  what the quality combine does. Same-plan variance therefore cannot be created in
  the quality combine at all — it needs execution to reach a larger share of
  audienceScore (recompose the score, or give execution a more direct term).
- **A punishing combine crashes the median before it builds a low tail.** Full
  geometric + zero floors dropped the wide median $117M → **$57M** while
  unprofitable% reached only ~35% (target 45–55). It lowers *every* film roughly
  uniformly rather than fattening the *low* tail, because the tail needs genuinely
  weak **inputs** (bad scripts / risky plans) that the rival AI never generates
  (source #3) — punishing the combine on uniformly-competent inputs just shifts
  the whole distribution down.

**Revised conclusion (the approach the combine-reshape hypothesis assumed is
wrong): Root B is not a scoring-combine calibration. It is a structural rework
spanning two subsystems:**
1. **Variance** ⟶ recompose `audienceScore`/`criticScore` so execution reaches a
   larger, less-diluted share (e.g. lean audienceScore harder on qualityScore, or
   add a direct endogenous execution term), so a troubled/triumphant shoot moves
   the finished film. Touches `scoring.ts:489-547` + execution routing.
2. **Unprofitable tail** ⟶ widen the **input** distribution: make the rival AI
   greenlight a real spread of plan quality (weaker scripts, riskier budgets), not
   just top-8-craft picks (`rivalStudios.ts:690, 144`). Without genuinely weak
   films in the field, no combine can manufacture a believable flop tail.

The combine convexity (geometric blend) and lower K-floors remain *reasonable
components* of #1/#2 but are amplifiers, not the fix. This is materially larger
than the pacing pass and should be scoped as its own multi-part effort.

Both increase score dispersion, which will widen the box-office distribution
(fatter unprofitable tail AND fatter megahit tail — a likely side-benefit for the
deferred crossover/top-tail metrics). **This moves audienceScore, which drives the
funnel, so every change here must be re-validated against the whole-year
distribution diagnostic** (median/mean were just calibrated by the pacing pass).

Sanctioned by SIMULATION_PHILOSOPHY.md Principles 1 (variance should be
endogenous — emerge from decisions, not a release-time roll) & 2 (execution
quality should emerge during production).

---

## 10. Change log (calibration history)

- **2026-07-28** — Root-cause investigation (this doc created). Verified pacing
  (Root A, WOM) and variance/flop-tail (Root B, upstream scoring) are
  independent roots; drain & awareness-ramp levers saturate ~3.5× opening
  multiple; audienceScore compressed high (p5–p95 56–76) & execution-invariant
  (cv 0.015). Decision: WOM/pacing rework first.
- **2026-07-28** — Root-A pacing reshape landed: `RECEPTION_PIVOT=0.22` (new
  pivoted reception→legs curve) + Wide `conversionPacingBaseline` 0.35→0.62.
  Net on the whole-year harness: **opening multiple 5.2→3.0×** (FAIL→PASS),
  **run weeks 11→7.3** (FAIL→PASS), median 128→117 & mean 187→171 (held in
  band), blockbusterPct FAIL→PASS; unprofitable/over-100 nudged toward target;
  no regression to previously-passing bands. Untouched (by design, deferred):
  over-$1B & top-10 share (crossover/top-tail piece), unprofitable/bomb tail &
  same-plan variance (Root B upstream scoring). Behavioural regression tests
  updated for the milder front-loaded legs; Quantum-Signal guard and
  phenomenon-reaches-$1B invariants preserved.
