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

### 5.3 The controlled sweep: fame barely moves the total

`src/engine/starPower.diagnostic.test.ts` (§7 step 1, done) takes a fixed rival
plan and changes **only** its lead actors' fame, resolving every variant under
the same 30 execution seeds. Script, crew, skill, schedule and luck are
identical across rows. Fame alone, salary and marketing untouched:

| plan | fame 20 → 95: opening | gross | p10 gross |
|---|--:|--:|--:|
| 7000 Medium Fantasy | +17% | **+3.5%** | +8% |
| 7000 Big Action | +4% | **+8%** | +5% |
| 7000 Small Sci-Fi | +19% | **+4%** | +21% |
| 7001 Medium Drama | +28% | **+10%** | +19% |
| 7001 Big Comedy | +15% | **+1%** | +8% |
| 7001 Small Sci-Fi | +21% | **+3%** | +19% |

The market rate for that move (median Lead Actor fee in a generated pool) goes
from **$0.1M at fame 20 to $16.3M at fame 95**. On the 7000 Medium film the
fame-95 lead buys about $10M of extra worldwide gross, roughly half of which the
studio keeps. Paying market rate for fame lowers return on every plan above
fame ~60.

So the answer to "underpowered or mispriced" is **underpowered**:
- Fame feeds three channels: a cast-awareness lift capped at 10% of the
  addressable audience (`audienceSimulationInputs.ts:computeCastReachFraction`,
  quadratic in fame, combined independently with marketing's up-to-95% reach),
  Buzz (`scoring.ts`, +0.5 per point over 50, plus gating more of marketing's
  Buzz contribution), and distributor offers (player only).
- **None of them touches the ceiling.** A star brings more people early
  (opening +4–28%), but they come from the same fixed `maxInterestedAudience`,
  so most of the gain is the run front-loading, not growing. The total moves
  1–10%.
- Fame lifts the **floor** (p10) more than the median, by +5–21%: the direction
  the domain reference describes ("the floor, not the ceiling"), but far too
  small to pay for itself.

Where the "matched" variant (marketing cut by the salary difference) could hold
cost equal, a fame-95 lead roughly breaks even with a fame-20 one. On two plans
it couldn't, because marketing can't be cut below a wide release's minimum
campaign, so cost rose instead.

Flagged in passing, not chased: the captured **Big** rival plans return
0.24–0.25× (e.g. $464M all-in for a ~$200M gross). In the whole-market data,
Epic-scale releases return 1.83×, so this may be specific to plans captured
early in a run. Worth a look before Big plans carry weight in any tuning.

---

## 6. Decisions needed before any tuning

**Both ratified (2026-11-06) and applied.** The variance gate now pools plans
7000–7015 × 80 executions and reads exactly the §2 pooled table: 4 of 5 bands
failing, 77.0% "as expected", median per-plan coefficient of variation 0.142.
The distribution gate now counts `wideOver500PerYear` (12.1, target 10–15) and
`wideOver1000PerYear` (4.1, target 2–5), both passing: 19 of 21, with
`breakevenPct` and `limitedOpeningMultiple` still failing.

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

## 7a. Revised plan, after checking the domain reference (2026-11-09)

The §7 plan below was revised against `docs/domain/10` §4–7, `12` §3 and `16`
§6–8, which changed two of its three ideas:

1. **Reviews by film type** (replaces §7 step 3). The opening effect depends on
   genre, audience and release pattern, and pre-sold films barely feel it. For
   wide releases reviews act as *permission* (week 1); for platform releases
   they act as *awareness* (all run). **Built**, see §8.
2. **Promise vs delivery drives word of mouth** (replaces "let the ceiling
   grow"). The reference: word of mouth's sign is set by the gap between what
   the campaign promised and what the film delivered, not absolute quality. This
   is the sleeper-hit mechanism.
3. **Repeat viewing for exceptional films.** The reference's "difference
   between a hit and a phenomenon", and the realistic way past the ceiling. The
   simulation explicitly does not model it yet (`audienceSimulation.ts`).
4. **Stars as floor plus international value**, gated on whether the film
   *looks* above average, and only for a small top tier. **Waiting on research**
   into the decline of star power (a reference section is being drafted for
   `docs/domain/`).

## 8. Fix 1 built: reviews by film type

`data/reviewSensitivity.ts` and `audienceSimulationInputs.ts`
(`computeReviewSensitivity`, `computeOpeningReviewMultiplier`,
`computeReviewAwarenessMultiplier`), applied in `audienceSimulationStep.ts`
step 8.7.
- **Sensitivity:** genre (drama 0.25 down to horror 0) × audience (critics- and
  adult-led films more, teens less) × (1 − 0.8 × pre-sold), where pre-sold is
  the larger of franchise recognition and event scale.
- **Signal:** −1..+1 around the market's median wide-release critic score (51,
  ±20).
- **Wide:** a week-1 attendance multiplier. Of the viewers a pan holds back,
  half are lost to the home window; without that a pan only delayed its
  audience while a rave's bigger opening compounded.
- **Limited:** the same signal scales the ongoing awareness rate instead, so
  the sleeper shape survives. Applying it to week 1 erased it and broke the
  sleeper scenarios.
- **Festival First:** untouched; it has its own critic gate.

**Measured.** Within the genres the reference says should feel it, wide
dramas' opening ratio between well-reviewed (critic ≥ 65) and panned (≤ 40)
films went from 0.47× to 1.05×; the others moved modestly; horror is
unchanged by construction. The market as a whole barely moved (mean wide gross
$268.7M → $267.5M). The distribution gate went from 19/21 to 18/21:
`wideOver100Pct` 60.4 against a ceiling of 60, and `majorPct` 14.5 against 14,
both by under a point. The variance gate is unchanged (76.7% "as expected"):
its plans are spectacle-led action, sci-fi and comedy, which the reference
says reviews barely touch. Fixes 2 and 3 are the levers for it.

**Two findings this surfaced, not acted on here:**
- **Across the market, critic score is *negatively* correlated with opening**
  (r −0.30 to −0.46 in every genre before this change): well-reviewed films
  open at 0.25–0.47× panned ones. That is cross-film: bigger, more expensive
  films score worse with critics in the model. The reference's link between
  reviews and box office is weak, not inverted, so this is worth its own look.
- **The stopping rule rewards a weak opening.** The run ends at 2% of
  week-1 admissions, so a lower opening runs longer. For a panned film with good
  audience scores this outweighs the held-back viewers it loses (the unit test
  had to measure the mechanism directly). The rushed-release work hit the same
  quirk. A run-length rule that isn't relative to the opening would fix both,
  but it touches every film, so it belongs with the calibration of fixes 2–3.

## 9. Fix 2 built: promise vs delivery drives word of mouth

`data/wordOfMouth.ts`, `audienceSimulationInputs.ts:computeExpectedReception`,
`audienceSimulationStep.ts:computeExpectationGapFactor`. A film's Buzz sets
the reception it promised. Word of mouth is scaled by how far the delivered
reception (the same 70/30 audience/critic blend it already reads) beat or
missed that: ±10% per 10 points, bounded 0.7–1.2×.

**Calibration lesson.** Buzz in the model is saturated (median 80; 38% of
wide releases at 90–99) and delivered reception is flat at ~60 across every
Buzz level, so hype carries no information about quality. A first version
anchored "a maximally hyped film must deliver 74" and taxed the typical film,
because the typical film *is* hyped. The neutral point now sits at the market
median (Buzz 80 expects 60.4). The response was also far more sensitive than
expected: word of mouth's thresholds are squared, so a 1.1× nudge took a
scenario's peak weekly reproduction ratio from 0.87 to 1.06.

**Measured.** Across the regression scenarios, **totals barely move**. The
strong-word-of-mouth film goes from $163M to $159M even at a 1.4× setting while
its peak weekly ratio climbs to 1.5: extra word of mouth only pulls the same
audience forward, because the film is already selling into its ceiling. The
one scenario not at its ceiling (ordinary-positive, Buzz 35, delivering 70)
gains: $67M → $78M at the chosen setting. Gates: variance "as expected"
76.7% → 75.2%, median per-plan CV 0.142 → 0.161, "significantly under"
4.7% → 5.5%. Market median wide gross +5% ($147M → $155M), mean barely
(+$3M). The distribution gate is at 16/21; the newly failing bands are all
within about a point (`wideOver100Pct` 64.4 vs 60, `lossPct` at its 28 edge,
`specialtyFilmsPerYear` 4.9 vs 5). They are left for the joint calibration
of fixes 1–3 rather than nudged one at a time.

**What this shows.** The expectation gap is the right mechanism, and the
reference supports it, but it can't add audience while the reachable-audience
ceiling binds. That is fix 3's job (repeat viewing), and the reason the plan
said to calibrate these together.

**Test changes.** Two regression-matrix assertions used the peak weekly
reproduction ratio as a proxy for "no runaway". The strong-word-of-mouth film
(a modest promise, strong delivery) is now the reference's sleeper, and a
sleeper's audience grows into weeks two and three (r > 1 briefly). They now
assert what they were guarding: its total stays under 20% of a phenomenon's,
it doesn't hit the hard cap, and the phenomenon's total is more than 10× an
ordinary film's.

## 10. Fix 3 built: repeat viewing

`data/repeatViewing.ts`; `audienceSimulationInputs.ts:computeRepeatability`;
`audienceSimulationStep.ts:computeRepeatViewingRate` and step 8.8. Following
`docs/domain/10` §16: each week a share of the *previous* week's first-time
viewers come back once. They take seats, so they count against capacity and a
film people return to holds its screens. They are never drawn from or returned
to the interested pool: they are the same people again.
- **Base rate:** 0.03 for every film.
- **Extra rate:** up to 0.6 × repeatability × a reception gate. The gate is
  absolute (people re-watch what they love, whatever they were promised): zero
  at a delivered blend of 60, full at 88, convex.
- **Repeatability:** a 0–1 blend of genre (spectacle, density, emotion),
  audience (families' social obligation, teens' fandom), spectacle lifted by
  event scale, and franchise fandom.

**People vs tickets.** The simulation had treated tickets sold as distinct
viewers throughout, and forbade tickets from exceeding the addressable audience
("repeat viewing is not modeled yet"). Repeat visits are now tracked
separately (`AudienceSimulationWeekState.cumulativeRepeatAdmissions`, included
in `cumulativeTicketsSold`). Everything that counts *people* reads
`uniqueViewers()`: the interest headroom, the crossover subset check, word of
mouth's activity (people talking, not tickets) and the reproduction ratio.
Money keeps reading tickets.

**Measured against the reference** (wide releases, 6 seeds × 8 years):

| Film type | Median repeat share | p90 | Reference |
|---|--:|--:|--:|
| Ordinary (delivered < 65) | 2.7% | 3.3% | 2–5% |
| Well-liked franchise | 10.7% | 17.8% | 8–15% |
| Well-liked family film | 10.7% | 15.9% | 10–20% |
| Loved (delivered ≥ 82) | 16.0% | 21.9% (max 26.6%) | phenomenon 20–35% |

The model's top 1% by *gross* gets only ~4%. Its biggest grossers are big,
hyped, middling films rather than loved ones: the same trait as the negative
critic/opening correlation in §8.

**Gates.** Variance "as expected" 75.2% → 72.0%, median per-plan CV
0.161 → 0.175, breakouts 3.3% → 4.0%. The market got richer, as three
revenue-adding fixes would: mean wide gross $270M → $298M (ceiling 300),
median $155M → $166M. Distribution gate failures now: `wideOver100Pct`,
`wideOpeningMultiple` (3.0, at its edge), `limitedOpeningMultiple`,
`specialtyFilmsPerYear`, `lossPct` (25.9 against a floor of 28) and
`breakevenPct`. Buzz gate unchanged.

**Test changes.** One more per-week reproduction comparison
(phenomenon vs ordinary) went the way of the two in §9: repeat viewers fill a
capacity-bound phenomenon's seats, so fewer first-timers fit per week. The
assertion keeps the total-gross comparison. One test helper counted interest
plus tickets as "ever interested" and now counts unique viewers.

### 10.1 Where fixes 1–3 leave things, and what the joint calibration has to do

| | before (diagnosis) | after fixes 1–3 | target |
|---|--:|--:|--:|
| Variance: "as expected" | 77.0% | 72.0% | 22–38% |
| Variance: median per-plan CV | 0.142 | 0.175 | — |
| Distribution gate | 19/21 | 15/21 | 21/21 |
| Mean wide gross | $268.7M | $298.0M | $200–300M |

The direction is right on variance, but the distance is large. The reason is
the one §3 found: the plans the variance gate stresses mostly sit on the
plateau of the reception S-curve, selling 75–90% of their reachable audience
at a typical execution. Fixes 2 and 3 add upside; little has moved those plans
off the plateau. The joint calibration needs, in order:
1. **The stopping rule** (§8 finding): runs end relative to their own opening,
   which rewards a weak opening and blunts every downside mechanism (the rush
   penalty, the pan's lost waiters).
2. **How far execution moves reception for a good plan.** Plateau plans barely
   vary because their delivered reception barely does.
   `DESIGN_REVIEW_reception_model.md` is the standing analysis of that.
3. **The market level**, brought back inside its bands after 1–2, using the
   level levers rather than the new mechanisms, which are calibrated against
   the reference independently.

### 10.2 The stopping rule, measured: not the culprit (2026-11-09)

§8 and §10.1 named the run-end rule (a run ends when a week sells under 2%
of opening week) as blunting every downside mechanism, because a weaker
opening lowers the bar. Measured on the whole market, using the per-film weekly
series the distribution dump now carries (`weeklyGrossM`), that is **wrong for
wide releases**:

- The inversion is real but nearly worthless: bottom-quartile openings run 8
  weeks (median) against 6 for top-quartile, but weeks under $1M hold 0.17%
  of all wide-release gross. After week 6, a weak opener earns a median of 1.7%
  of its total. The top tenth (19%) are genuine sleepers, which should keep
  running.
- So an absolute "not worth the screens" floor would change almost nothing.
  The "a pan sells slightly more" effect in §8's unit test comes from the
  held-back audience buying later in ordinary weeks, not from the tail.

**The rule is not changed.** The real run-length problem it surfaced is in
**Limited and Festival First releases**: every one of them hits the 20-week
cap, still taking 31% (Limited) / 43% (Festival) of its peak week, and that
last week alone is 2.5–3% of its total. They also peak in week 1–2 and then
decline very slowly, where a real platform release expands, peaks weeks later
and fades (`docs/domain/09` §7.2, `10` §2.7). That is a decay-shape problem in
how limited availability and interest evolve, not an end-rule one. It is also
behind the failing `limitedOpeningMultiple` and `limitedRunWeeks` sitting on
its upper edge.

Revised order for the joint calibration: (1) execution's reach into reception
for good plans, the variance lever; (2) the limited/festival run shape;
(3) the market level.

## 11. Step 2 built: the platform run shape (2026-11-10)

**What was wrong.** A week-by-week replay of every Limited and Festival First run
(the distribution dump now carries per-week availability, seat utilisation and
interest left):
- **No release ever went wider.** A film's maximum screen share equalled its
  opening share (Limited ~0.086, Festival 0.020), even for loved films. Limited
  opened on more screens than its demand filled (week-1 utilisation 0.27), so
  screens only contracted.
- **Nothing ended a run.** The interested audience converted at ~5–6% a week, so
  every run rode the 20-week cap at a third of its peak.

The reference's platform shape (`docs/domain/09` §7.2, `10` §2.7, §8.5) is the
opposite: open small, expand on the per-screen average, peak a few weeks in,
then contract. Most of a film's remaining audience waits for home release once
the 17–45 day window approaches (`09` §7.4).

**What changed** (`engine/audienceSimulationInputs.ts` DISTRIBUTION_PROFILES,
`data/theatricalWindow.ts`):
1. **The home window.** After 6 weeks, 25% of whoever is still interested waits
   for home release each week. Wide films are drained by then; it ends the
   limited and festival tails.
2. **Platform releases open smaller and sell faster.** Limited opens at 0.05 of
   full screens (was 0.1); pacing Limited 0.06 → 0.12, Festival 0.05 → 0.10.

Steps 1 and 2 had to land together. The window alone cut limited films' median
gross 46% and left 87–93% of platform releases unprofitable: their money had
been in the flat 20-week tail. The faster pacing earns it back inside a
realistic run. The file's earlier warning that raising platform pacing
"amplifies gross 2–3x through the expansion loop" did not hold with the window
in place (economics unchanged, below).

The rushed-release penalty kept its own breadth reference (0.1) rather than
reading Limited's opening share, so retuning platform openings can't shift it.

**Sweep.** Limited opening share at 0.025 / 0.035 / 0.05:
- 0.025 gave the strongest build, but a 16.9× opening multiple (band 5–12).
- 0.05 is the one where shape, economics and both limited targets hold.

| Limited releases | before | after |
|---|--:|--:|
| Runs hitting the 20-week cap | 100% | **1%** |
| Median run | 20 wk | 16 wk |
| Last week as share of peak | 0.31 | **0.01** |
| Peak week, loved / disliked (p50) | 3 / 1 | **4 / 1** |
| Max screen share, loved (p90) | 0.090 (never grew) | **0.141** |
| Opening multiple (gate) | 12.8 ✗ | **9.3 ✓** |
| Median gross, all / loved | $14.6M / $22.6M | $14.8M / **$41.1M** |
| Unprofitable / median return | 65% / 0.77× | 64% / 0.78× |

**Not achieved:** expansion following reviews from the opening. Opening
utilisation is similar for loved and disliked films, because a film's screen
capacity is anchored to its own awareness: more release-day awareness raises
capacity with demand. So the loved films' extra expansion comes from word of
mouth in weeks 2+. Feeding reviews into a platform film's release-day awareness
was tried and reverted, since it didn't change this. The awareness-anchored
capacity is the structural reason, and a separate piece of work.

**Gates on this code.**
- **Variance:** passes (0.426 / 0.084, corr 0.93).
- **Buzz:** passes.
- **Distribution:** 16/21. Both limited targets now pass. The misses:
  - `wideOpeningMultiple` 3.04 vs 3, `specialtyFilmsPerYear` 4.98 vs 5 and
    `majorPct` 14.7 vs 14, all at an edge;
  - `wideOver100Pct` 65 vs 60 and `breakevenPct` 11.8 vs 14, the longer-standing
    pair.

These are the market-level step (§10.2's step 3).

**Test changes.** Three scenario assertions encoded the old shape:
- Limited platform builds ride the cap.
- A Festival sleeper's week 10 still matches week 1.
- An excellent, under-marketed Limited film has a 20× multiple.

They now assert real growth after week 1, runs ending before the cap, and a
multiple at the top of the Limited band. Save key v97 → v98.

## 7. Proposed fix order (for a separate, greenlit pass)

1. ~~**Star sweep**~~ **Done (§5.3): underpowered.** Fame moves gross 1–10%
   because it never touches the ceiling. Fixing that belongs inside step 2: a
   star's draw should enlarge the reachable audience (most for mid-budget, least
   for tentpoles, per the domain reference), not just front-load the same one.
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
