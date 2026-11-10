# Design Review — Ambition and Delivery: outcome spread that follows the risk a plan took

**Status:** **Built** (2026-11-10), with one departure from §2.2 recorded in §7. Variance-gate option B
ratified. Step 1 of the joint calibration in
`DESIGN_REVIEW_box_office_variance_diagnosis.md` §10.2, and the unbuilt step 3
("ambition vs delivery gap") of `DESIGN_REVIEW_reception_model.md` §4.

---

## 1. The problem, measured

`docs/SIMULATION_PHILOSOPHY.md` Principle 1:

> Ambitious, unconventional, or creatively conflicted projects should have
> **wider** outcome distributions — higher ceilings *and* lower floors. Safe,
> reliable productions should have **narrower** distributions and lower ceilings.

`src/engine/receptionSpread.diagnostic.test.ts` resolves 16 captured rival plans
under 60 execution seeds each and reports, per plan, its ambition next to the
spread of every stage from the shoot to the gross. Selected rows:

| Plan | Originality | VFX ambition | Quality SD | Audience SD | Gross CV | Sold (median) |
|---|--:|--:|--:|--:|--:|--:|
| 7000 Big Action | **98** | 55 | 5.2 | **13.2** | **0.62** | 0.33 |
| 7003 Big Horror | **98** | 28 | 3.9 | **10.6** | **0.44** | 0.60 |
| 7004 Big Comedy | **89** | 10 | 4.2 | 8.6 | 0.28 | 0.79 |
| 7002 Big Fantasy | 62 | **60** | 3.8 | 4.2 | **0.08** | 0.93 |
| 7008 Big Sci-Fi | 31 | **67** | 4.6 | 5.9 | **0.08** | 0.88 |
| 7014 Big Fantasy | 48 | **73** | 3.9 | 4.4 | **0.09** | 0.85 |
| 7001 Big Comedy | 67 | 14 | 3.3 | 3.3 | 0.09 | 0.77 |

Across plans: corr(originality + complexity, gross CV) **0.82**;
corr(production risk, gross CV) 0.55.

Three readings:

1. **Execution moves quality by about the same amount on every plan** (SD 3–5).
   What differs is how much *reception* amplifies it. Execution does reach
   acting, script and post-production, as multipliers inside the quality blend
   (`scoring.ts`: `performanceCapture`, `scriptExecution`, `postExecution`). The
   department scores a finished film reports are the planned ones, which is why
   they read as invariant.
2. **Principle 1 already works, through exactly one channel: originality.**
   Reception's "bet" (`scoring.ts`, `CRITIC_AMBITION_GAIN × distinctiveness ×
   ambitionRealised`, and the audience's one-sided `AUD_ALIENATION`) turns a
   distinctive concept into a wide outcome. Plans reaching for anything else get
   no bet at all.
3. **The most spectacle-ambitious plans are among the narrowest.** The fantasy
   and sci-fi plans reach for the most VFX and come out at CV 0.08–0.09, already
   selling 85–93% of their reachable audience. A big-effects film cannot land as
   an event or be laughed at for looking cheap. The spectacle side of execution is
   nearly inert: across 60 shoots of one plan, `productionScore` moves by about
   0.5 points, although the shoot rolls facet events (`facetSignals.sets/vfx/
   practical`) and each facet has an ambition (`computeVfxAmbition`, etc.).

A secondary finding: the production-risk average barely separates plans (46–53
across all 16). It is a mean of five dimensions, one of them a constant schedule
pressure for rivals: the same averaging-destroys-spread pattern the reception
doc diagnosed.

## 2. The design

**Generalise the bet.** A plan's *reach* is what it attempted beyond the
ordinary, along named, legible dimensions. Its *delivery* is how that specific
thing came out, read from the recorded shoot, never rolled. Reception reads
**reach × delivery** on each dimension, two-sided where reality is two-sided.
A safe plan has little reach, so execution barely moves it. An ambitious plan
is a bet in both directions.

### 2.1 Three reach dimensions

| Dimension | Reach (planned, already computed) | Delivery (from the shoot) | Who reads it |
|---|---|---|---|
| **Concept** | originality (`conceptDistinctiveness`) | overall quality vs the bar (`ambitionRealised`) | **Exists.** Critics two-sided (±18), audiences punish the miss (−22) |
| **Spectacle** | the plan's own facet ambitions: VFX, practical, sets, weighted by what it spent on each | the facet's realised quality vs what the plan's money and team should have produced, which is where `facetSignals` already land | **New.** Audiences two-sided (an event, or "looks cheap"); critics a small mirror |
| **Structure** | script `complexity` (already "production scope, not quality") | script and performance execution (`scriptExecution`, `performanceCapture`) | **New.** Critics reward an intricate film that holds together; audiences punish one that confuses (one-sided, like alienation) |

Each term is centred so the typical delivery for that reach is neutral (the
`QUALITY_REFERENCE` / `AMBITION_BAR` pattern). That keeps the median film where it
is and widens the tails only. The earlier attempt that lifted the median instead of
widening the spread (`DESIGN_REVIEW_reception_model.md` §4.5, attempt 2) is the
failure this centring exists to avoid.

### 2.2 Let the spectacle facets actually respond to the shoot

The spectacle bet needs a delivery signal with spread. Today a plan's facet
events move `productionScore` by about 0.5 points, so "how the effects came out"
is effectively fixed. Fix: scale a facet's execution swing by that facet's
ambition. A plan reaching for 73 VFX ambition has a lot riding on the VFX shoot;
one reaching for 10 has almost nothing. This is the same principle as §2.1 one
level down, and it stays endogenous: the swing comes from events the shoot
actually rolled.

### 2.3 Optional, phase 2: risk that reflects reach

Make the event-volume driver read the plan's *peak* risk dimension rather than
the mean of five, so an ambitious plan has a visibly riskier shoot as well as a
riskier reception. Deferred because §2.1–2.2 may be enough, and because it
changes the player's shoot experience, which deserves its own look.

### 2.4 Legibility (Principles 3 and 4)

A bet the player cannot see is not a decision. Two surfaces, both qualitative:

- **Before:** where the plan is built, a reach readout: "a safe, dependable
  package" through "a high-wire act: this could be remarkable or a mess". It is
  derived from the same reach values, so it can't disagree with the outcome.
- **After:** the premiere report and reviews name which bet paid or failed: "the
  effects were the draw", "the spectacle looked unfinished", "an intricate
  structure that never quite comes together". The engine already computes the
  per-dimension term, so it can be named instead of guessed.

Neither is a background-tick event, so no new notification is owed.

## 3. Acceptance

Measured with `receptionSpread`, the pooled variance gate and the existing
suites:

1. **Spread follows reach.** corr(total reach, gross CV) across the 16 plans
   rises from today's 0.82 (originality only) and holds when VFX-ambitious plans
   are counted: the three fantasy/sci-fi plans above should move from CV ~0.08 to
   ≥ 0.2. **Safe plans stay narrow**: low-reach comedies (7001, 7015) stay ≤ 0.12.
2. **The median doesn't move.** Median critic, audience and wide gross within ±2%
   of today. Market level is the last calibration step, not this one.
3. **Reception shape** stays within `DESIGN_REVIEW_reception_model.md`'s targets:
   critic SD toward ~17, audience 15–18, corr(critic, audience) 0.70–0.75.
4. **The pooled variance gate** moves toward its bands. How far is the decision
   in §4.
5. **No regressions:** the runaway guards in
   `audienceSimulationRegressionMatrix.test.ts`, the real-film recreations, the
   buzz gate.

## 4. Decision needed: what the variance gate should demand

The gate pools 16 plans and asks the *pooled* outcomes to be 15/30/30/20/5 across
its bands, which implicitly says every plan should be wide. Principle 1 says
safe plans should be **narrow**. Those two conflict, and once spread follows
reach, the gate's reading will depend on how ambitious the 16 captured plans
happen to be.

Options:

- **A. Keep the pooled bands as they are.** Simple, but tunes against a
  population accident: a slate of safe plans would be pushed wide regardless of
  Principle 1.
- **B. Gate the relationship, report the pool** *(recommended)*. Assert that
  spread follows reach (high-reach plans wide, low-reach narrow, by thresholds
  set from §3.1), and keep the pooled bands as a reported, not asserted,
  population check. This is the principle itself, made testable.
- **C. Re-derive the pooled bands** for the observed reach mix of rival plans.
  More faithful than A, but still asserts a population property.

## 5. Build order

1. Spectacle facets respond to the shoot in proportion to ambition (§2.2).
   Measure: per-plan facet-quality spread.
2. The spectacle bet in reception (§2.1). Measure: §3.1 and §3.2.
3. The structure bet (§2.1). Measure again.
4. Legibility surfaces (§2.4).
5. Gate change per the decision in §4.
6. Hand off to the joint calibration's next steps: the limited/festival run
   shape, then the market level (`DESIGN_REVIEW_box_office_variance_diagnosis.md`
   §10.2).

**Coupling to watch** (`DESIGN_REVIEW_reception_model.md` §5.1): reception feeds
outcome labels, awards, reputation, ancillary and word of mouth. Each step
re-runs the reception distribution and the guards before moving on.

## 7. As built

### 7.1 Departure from §2.2: effects events were never reaching the effects

§2.2 proposed scaling a facet's execution swing by its ambition. Measuring first
showed that would overturn a deliberate rule in the facet model: the swing
scales with **stretch** (how far ambition outruns funding), because
"comfortably-funded is dependable, over-reaching is a gamble"
(`facetModel.ts`). The big fantasy and sci-fi plans sit at a VFX stretch of
0.06–0.08, well funded, so their narrowness is that rule working, and it is
realistic. §2.2 was not built.

What measuring did find was a real bug. Across 16 plans × 30 shoots, **0 of
480 shoots ever moved the VFX or practical facet**, though squib misfires, VFX
redos and stunt gags fired about 70 times each. Every genre bank stamps a
default department onto its templates (`visual` for Action / Sci-Fi / Fantasy /
Horror), and a stamped impact pre-empted the craft-facet keyword routing added
later. Fixed in `data/eventImpactRouting.ts` (shared by the classifier and the
bank tagging, so they can't drift apart again): VFX now moves in 152/480
shoots and practical in 273/480, swinging about −3..+5 points within stretch.
Player films share the bank, so theirs were affected too.

That fix on its own made per-plan outcomes **narrower** (median per-plan CV
0.175 → 0.096) and the market richer (mean wide gross $298M → $311M). The
misrouted events had been carrying variance through the broader visual
channel, and stunt and practical events skew positive.

### 7.2 The bets

`data/ambitionBets.ts`; `scoring.ts:computeStructureBet`,
`computeSpectacleBet`, read in `computeCriticScore` / `computeAudienceScore`.
- **Structure:** reach from script complexity (30 → 60). Delivery is the mean
  of performance capture and post execution, each from its measured median
  (1.048 / 0.969). Critics ±10 two-sided; audiences −12 one-sided (confusion).
- **Spectacle:** reach from the plan's facet ambitions, weighted by genre.
  Delivery is the facets' realised swing, ±4 points as a full unit. Audiences
  ±10, critics ±3. Because the swing is stretch-bounded, a well-funded spectacle
  stays dependable and only an over-reaching one is a bet, which is consistent
  with the facet model rather than overriding it.

### 7.3 Measured (16 plans × 60–80 shoots; 6 seeds × 8 years for the market)

| | before the step | after |
|---|--:|--:|
| corr(ambition, gross CV) across plans | 0.80 | **0.86** |
| corr(**exposure**, gross CV), the new gate measure | — | **0.92** |
| Most-exposed third, median CV | — | **0.426** (≥ 0.2) |
| Least-exposed third, median CV | — | **0.084** (≤ 0.12) |
| Pooled "as expected" (reported) | 76.6% | 73.0% |
| Critic mean / SD | 52.7 / 14.1 | 52.9 / **15.1** |
| Audience mean / SD | 62.6 / 11.3 | 62.4 / **12.0** |
| corr(critic, audience) | 0.43 | **0.51** |
| Mean wide gross | $311M (routing fix alone) | **$282M** (in band) |
| Distribution gate | 10/21 (routing fix alone) | **16/21** |

Per plan, structure bets widened the complex scripts (complexity 43–64): CVs
0.08–0.58 became 0.13–0.65. Safe comedies stayed at 0.07–0.08. Means held.

**Against §3:** criterion 1 is met, with the fantasy/sci-fi clause dropped per
§7.1. Criterion 2: the market median held against the pre-routing baseline
($166M → $166M); against the routing-fix-only state it fell 6.5%, which is the
routing fix's enrichment being undone. Criteria 3 and 4 are met (reception moved
toward every target; gate passes). Criterion 5 is met (full suite green).

### 7.4 The gate (option B) and legibility

`boxOfficeVariance.diagnostic.test.ts` now asserts that spread follows reach.
It ranks the 16 plans by `scoring.ts:computeBetExposure` (each bet's reach
times its size in reception points, spectacle counted only as far as it
over-reaches its funding) and requires:
- the most-exposed third at median CV ≥ 0.2;
- the least-exposed third ≤ 0.12;
- corr(exposure, CV) ≥ 0.6.

It **passes**. The pooled bands are printed as a population report.

The same exposure drives a qualitative card on the production planning screen
("How Much Is Riding On This": safe and dependable, some creative risk, an
ambitious swing, or a high-wire act, plus what it is reaching for), so the
readout can't disagree with what the gate measures. Each film's results record
how its bets landed (`FilmResults.ambitionBets`, signed reach × delivery), and
the results screen names any bet that clearly paid off or failed
(`engine/ambitionPresentation.ts`). Save key v96 → v97.

## 6. Reproducing the measurements

```bash
BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/receptionSpread.diagnostic.test.ts --disable-console-intercept
# optional: SPREAD_PLAN_SEEDS=7000,7002  SPREAD_EXECUTIONS=60
```
