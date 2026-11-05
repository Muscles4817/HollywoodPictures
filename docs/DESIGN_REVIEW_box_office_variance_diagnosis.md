# Design Review — Box-office calibration: a diagnosis

**Status:** Diagnosis only. No engine or tuning change. Written so the next
calibration pass starts from measured mechanisms rather than from the failing
gate lines, and so the target questions it raises can be decided first.

Companion to `DESIGN_box_office_calibration_targets.md` (and its v2/v3 draft,
whose §13.1 this picks up) and `DESIGN_REVIEW_reception_model.md`.

---

## 0. TL;DR

1. **The variance gate is measuring the wrong thing.** It stresses *one*
   production plan, and that plan is an outlier. Its "34% breakouts, nothing
   significantly under" is not the model's behaviour. Pooled over 16 plans,
   **77% of outcomes land "as expected"** (target 22–38%), breakouts are 2.7%,
   and the only tail is downside. The real defect is the one the harness's own
   header predicted: a fixed plan re-scores **almost deterministically**.
2. **The mechanism is a reachable-audience ceiling.** A film's total is an
   S-curve of its audience score that **saturates at 75–90% of
   `maxInterestedAudience`**, a ceiling fixed at release by concept, scale and
   marketing. Above an audience score of ~70, a better film barely earns more.
   Most plans' typical execution already sits on that plateau, so there is no
   upside left to vary into, and within a plan the opening doesn't move at all.
3. **Two of the four whole-market failures are a measurement question, not a
   model one.** `wideOver500Pct` / `wideOver1000Pct` fail as *shares*, but the
   *counts* (12.1 and 4.1 films per industry-year) sit inside the real ~10–15
   and 2–5. This is the scale-invariance defect v3 §13.1 recorded and
   deliberately left for ratification.
4. **The "thin middle" is not real.** The return distribution for major wide
   releases is smooth and unimodal; `breakevenPct` fails because its band is
   only 0.25× wide, not because films avoid break-even.
5. **Stars buy nothing at matched cost.** Holding scale and total cost fixed,
   films led by top-fame actors open no bigger and gross no more than films with
   lesser leads, while spending 2–3× the share of their budget on talent. And in
   every scale, return peaks at $40–80M all-in and falls with spend beyond, which
   is the ceiling again.

The two decisions in §6 come before any tuning.

---

## 1. How this was measured

All numbers are from the real settlement loop, rival films only (the same
population the gates use), unchanged code at `master` after PR #202.

- **Variance anatomy:** `src/engine/boxOfficeVarianceAnatomy.diagnostic.test.ts`
  resolves one plan under many execution seeds, buckets outcomes by
  ratio-to-median, prints what differs between the buckets, and pools the gate's
  bands across plans.
  ```bash
  BOX_OFFICE_DIAGNOSTIC=1 PLAN_SEEDS=7000,7001,7002 N=120 \
    npx vitest run src/engine/boxOfficeVarianceAnatomy.diagnostic.test.ts --disable-console-intercept
  ```
- **Whole-market dump:** `boxOfficeDistribution.diagnostic.test.ts` now writes a
  per-film JSON (scores, buzz, scale, cost, talent cost, lead fame, opening,
  share of reachable audience sold) when `DUMP_OUT` is set, analysed by
  `scripts/analyseBoxOfficeDump.mjs`. The gate itself is unchanged.
  ```bash
  DUMP_OUT=/tmp/bo.json BOX_OFFICE_DIAGNOSTIC=1 npx vitest run \
    src/engine/boxOfficeDistribution.diagnostic.test.ts --disable-console-intercept
  node scripts/analyseBoxOfficeDump.mjs /tmp/bo.json
  ```
  7,279 films: 3,958 wide, 2,264 of them from majors; 6 seeds × 8 years.

**Caveats.** Rival films only (the player's are not in the gates either). The
whole-market cuts are observational over rivals' own choices, so a pattern can
carry a confound. §5 controls for the obvious one, cost, and says what remains.
No awards season runs in these harnesses.

---

## 2. The variance gate: one plan is not a distribution

`boxOfficeVariance.diagnostic.test.ts` captures the first Big-scale rival plan
for seed 7000 and resolves it 240 times. It reads:

| band (ratio to plan median) | measured | target |
|---|--:|--:|
| significantly under (< 0.6) | 0.0% | 8–22 |
| modestly under (0.6–0.85) | 37.1% | 22–38 |
| as expected (0.85–1.15) | 19.6% | 22–38 |
| modestly over (1.15–1.6) | 9.2% | 12–28 |
| breakout (≥ 1.6) | 34.2% | 1–12 |

Sixteen plans (seeds 7000–7015, 80 executions each), each outcome taken
relative to its own plan's median:

| band | pooled | target |
|---|--:|--:|
| significantly under | 4.7% | 8–22 |
| modestly under | 10.2% | 22–38 |
| **as expected** | **77.0%** | 22–38 |
| modestly over | 5.4% | 12–28 |
| breakout | 2.7% | 1–12 |

Per plan, 11 of 16 have their middle half of outcomes within ±10% of their
median, 8 of them within ±5%: execution barely moves them. A few (7000, 7003, 7011) sit somewhere
that makes them swing hard. Seed 7000 happens to be the most extreme of those,
so the gate's reading is an accident of which plan it captured.

**This is the same thing `DESIGN_REVIEW_reception_model.md` found from the
other side** (the finished film is nearly deterministic), now measured at the
box office.

---

## 3. The mechanism: an S-curve with a ceiling

### 3.1 Inside one plan (seed 7000, 240 executions)

| outcome bucket | n | audience score | buzz | opening | weeks | sold share of reachable audience |
|---|--:|--:|--:|--:|--:|--:|
| 0.6–0.85× | 89 | 41 | 91 | $113M | 2 | 0.20 |
| 0.85–1.15× | 47 | 55 | 92 | $113M | 5 | 0.26 |
| 1.15–1.6× | 22 | 60 | 94 | $113M | 6 | 0.36 |
| 2–3× | 44 | 67 | 94 | $113M | 8 | 0.74 |
| 3–5× | 29 | 76 | 96 | $113M | 7 | 0.82 |

Two things are true at once:

- **The opening never moves.** It is the same $113M whether the shoot went well
  or badly. How the film turned out reaches the box office only through its
  legs, never its opening. A film that comes out badly still opens to its full
  pre-sold number, so its total can't fall far: the floor here is 0.71× the
  median. That is why "significantly under" is empty for this plan, and thin
  (4.7%) across all of them.
- **The total is a steep S-curve of audience score.** Median ratio by audience
  score: 0.71 up to ~45, 0.92 at 54, 2.08 at 63, 2.92 at 69, then flat at 3.05
  from 72 on. Most of the curve's rise happens in ~12 points. A plan whose
  typical execution sits on that slope is bimodal (seed 7000). A plan already
  on the plateau is deterministic (most of them).

### 3.2 Across the market (3,958 wide releases)

| audience score | sold share of reachable audience | total ÷ opening | median return |
|---|--:|--:|--:|
| 45–49 | 0.20 | 1.39 | 0.42 |
| 55–59 | 0.37 | 1.79 | 0.85 |
| 65–69 | 0.64 | 2.69 | 1.24 |
| 75–79 | 0.76 | 3.77 | 1.42 |
| 85–89 | 0.86 | 4.15 | 1.28 |

A film can never sell more than its `maxInterestedAudience`
(`engine/audienceSimulation.ts`): the base-interest share plus the crossover
capacity of its total addressable audience, all fixed at release
(`deriveAudienceSimulationFixedState`). A well-received film converges on that
ceiling and stops. Word of mouth can realise crossover only up to
`crossoverCapacityFraction`, which is set before the film opens. So **how big a
film can get is decided at release, and reception only decides how much of that
it collects.** A genuine breakout, a film finding an audience nobody expected,
has no mechanism.

---

## 4. The whole-market gate

Measured (unchanged code): 17 of 21 pass. The four failures:

| metric | measured | target | reading |
|---|--:|--:|---|
| `wideOver500Pct` | 14.7% | 6–12 | **measurement** (§4.1) |
| `wideOver1000Pct` | 4.9% | 1–3 | **measurement** (§4.1) |
| `breakevenPct` | 11.1% | 14–35 | **band width** (§4.2) |
| `limitedOpeningMultiple` | 12.1 | 5–12 | not investigated (§4.3) |

### 4.1 $500M / $1B: correct counts, wrong denominator

Per industry-year the model makes **12.1** wide releases over $500M and **4.1**
over $1B. The v2/v3 targets doc puts the real figures at ~10–15 and 2–5 (§13.1).
Both counts are in range. They fail as *shares* because the field is **82.5 wide
releases a year** against a real ~110, so the same count is a bigger share.
That is the scale-invariance defect v3 §13.1 recorded, and the one §11.3 already
fixed for top-10 share by moving to a decile.

Stated plainly, as v3 did: restating these as per-year counts makes two
failing gates pass **without the model moving**. That is the direction that
deserves the most suspicion, which is why it is a decision for you (§6) and is
not done here.

### 4.2 Break-even is not hollowed out

Fine-grained return distribution, major wide releases (density per 0.1× of
return):

```
[0.4, 0.6)  4.86  ###################
[0.6, 0.8)  5.15  #####################
[0.8, 1.0)  4.57  ##################
[1.0, 1.25) 4.43  ##################   <- the break-even band
[1.25,1.5)  4.03  ################
[1.5, 1.75) 3.59  ##############
[2.0, 2.5)  2.17  #########
```

Smooth and unimodal, peaking at 0.6–0.8×. The break-even band holds 11.1%
because it is 0.25× wide. Reaching 14% would need a local bump at exactly
1.0–1.25× that no mechanism argues for. The target itself comes from a
twelve-film slate where three films landed there (v3 §12.2). My read is that
this gate should not be tuned towards. It will move on its own if §3 is fixed.

### 4.3 Limited opening multiple

12.1 against a ceiling of 12, with limited runs at the 20.0-week simulation cap
(`MAX_SIMULATION_WEEKS`). Plausibly a cap artefact; not investigated.

---

## 5. Stars and spend: the ceiling seen from the money side

### 5.1 More money stops paying early

Median return by total cost, wide releases, within scale:

| scale | $0–40M | $40–80M | $80–150M | $150–250M | $250M+ |
|---|--:|--:|--:|--:|--:|
| Intimate | 0.55 | **0.93** | 0.71 | 0.71 | 0.74 |
| Medium | 0.97 | **1.62** | 1.14 | 0.98 | 1.11 |
| Epic | 1.47 | **2.16** | 1.77 | 1.74 | 1.43 |

In every scale, return peaks at $40–80M all-in and falls with spend beyond it,
while the share of the reachable audience sold climbs from ~0.5 to ~0.8. Extra
money keeps buying gross, but against a ceiling, so it buys it ever more
expensively.

Two secondary observations, flagged rather than chased:
- **Cheap films are starved.** The $0–40M bracket sells only 19–25% of its
  reachable audience in every scale. Low budget means a low marketing floor, and
  awareness is what's short.
- **Intimate films lose money wide.** 55% of major Intimate wide releases are
  unprofitable, at a median return of 0.91. The reference has the cheapest
  genre films (low-budget horror) as the best returns per dollar.

### 5.2 What a star buys

Films in the same scale and the same total-cost band, split by lead fame:

| scale, cost band | lead fame | talent share of cost | opening | gross | return |
|---|---|--:|--:|--:|--:|
| Medium, $80–150M | < 60 (n=82) | 0.08 | $96M | $224M | **1.40** |
| | ≥ 75 (n=88) | 0.23 | $70M | $197M | **1.06** |
| Intimate, $80–150M | < 60 (n=69) | 0.10 | $50M | $124M | **0.77** |
| | ≥ 75 (n=74) | 0.29 | $32M | $85M | **0.50** |
| Epic, $80–150M | < 60 (n=56) | 0.12 | $170M | $309M | **1.77** |
| | ≥ 75 (n=28) | 0.18 | $140M | $296M | **1.53** |
| Epic, $150–250M | < 60 (n=18) | 0.06 | $307M | $527M | 1.77 |
| | ≥ 75 (n=39) | 0.17 | $278M | $519M | 1.74 |

At equal money, star-led films open *smaller*: star salary displaces marketing
and production spend, and a pound of marketing buys more opening than a pound of
star. At best a star is neutral. This generalises the finding from PR #202's
Suicide Squad test: there, stars more than doubled the gross and still lost the
ROI comparison.

**What this does not prove.** The cut is observational over rival choices.
Matching on cost and scale removes the big confound, but not, say, script
quality differences between star and non-star projects. A clean answer needs a
controlled sweep: one script, same total budget, fame varied, money moved
between talent and marketing. That is cheap to run and is step 1 of the fix plan.

What a star *should* buy is partly a design call, and the domain reference is
specific about it (`docs/domain/12-talent-labor-and-careers.md` §3.3–3.5):
**IP outperforms stars for tentpole openings**, but stars "still matter
enormously for mid-budget films, for international pre-sales, and for getting a
film financed at all", and much of what a name buys is **the floor, not the
ceiling**, i.e. downside protection. Read against that, the Epic rows above are
roughly right (a star adds little to a tentpole), and the Medium and Intimate
rows are not: that is where a star should earn its fee, and in the model it
costs return there most.

---

## 6. Decisions needed before any tuning

1. **Pool the variance gate across plans** (measurement). Replace the single
   captured plan with ~16 plans × 80 executions, each outcome relative to its own
   plan's median, as §2 measured. This makes the gate *more* failing (77% "as
   expected"), not less: it stops reporting an accident and starts reporting the
   real defect. *Recommended.*
2. **Restate `wideOver500Pct` / `wideOver1000Pct` as per-industry-year counts**
   (targets ~10–15 and ~2–5, from v3 §13.1). This makes two gates pass without
   the model moving, so it needs your explicit yes or no. *Recommended, because
   §11.3 already made exactly this correction for top-10 share and nobody has
   argued the counts are wrong.* The alternative is to leave them failing until
   the field reaches ~110 wide releases a year.

`breakevenPct` (§4.2): my recommendation is to leave the band alone and not tune
towards it.

---

## 7. Proposed fix order (for a separate, greenlit pass)

1. **Star sweep** (§5.2): a controlled diagnostic, no model change, to settle
   whether stars are underpowered or merely mispriced, measured against the
   domain reference's split (little on tentpoles, a lot on mid-budget films,
   mostly as a floor).
2. **Let the ceiling move.** Make the reachable audience something reception can
   grow, not just fill: strong word of mouth expanding crossover capacity, or
   the addressable audience itself, past its release-day value. This is the lever
   for upside variance and genuine breakouts, and for spend having anything to
   buy past $80M. It touches the box-office chain directly, so the gates and the
   §3 tables are the safety net.
3. **Let reception touch the opening.** Reviews and early word of mouth moving
   a wide release's opening weekend somewhat. This is the lever for the missing
   downside: a film that came out badly shouldn't open to its full pre-sold
   number. It is also what `DESIGN_REVIEW_reception_model.md` needs anyway.
4. Re-measure all gates, the §2 pooled table and the §5 tables; re-check
   `breakevenPct` and `limitedOpeningMultiple` last.

Steps 2 and 3 interact (both widen the outcome spread), so they should be
calibrated together against the pooled variance gate, not one at a time.
