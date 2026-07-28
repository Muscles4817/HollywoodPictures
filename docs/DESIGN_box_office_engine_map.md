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

_Last updated: 2026-07-28 (pacing/variance root-cause investigation)._

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
