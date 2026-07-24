# Design Review — Box Office Revenue: why films make too much money, and the four levers to fix it

Status: analysis + proposed solution. No engine changes made yet — this document
is the diagnosis and a prioritised plan.

The brief: *films are still making too much money.* Four suspected levers were
named: **studio identity**, **buzz being too easy to push high** (opening
weekend), **competition not pushing films out of theatres**, and **AI release-window
selection** (rivals should contest windows by relative strength, not merely
avoid busy ones — majors fight each other, everyone else survives in the quiet
pockets).

All numbers below come from driving the *live* box-office path
(`engine/audienceSimulationInputs.ts` → `engine/audienceSimulationStep.ts`, the
model `state/studioReducer.ts:settleTheatricalMarket` actually runs — the old
`engine/boxOffice.ts` is gone) headlessly across a spread of film archetypes and
one-variable sweeps.

---

## 0. Headline finding: the absolute scale is far too hot

Worldwide potential gross (pre international-reach gate; studio cash ≈ 0.42× via
the 0.46 domestic / 0.38 international keep shares):

| Archetype | Total WW | Opening wk | Legs |
|---|--:|--:|--:|
| Blockbuster (mktg $120M, fame ~88, brand 85, buzz 85, score ~78) | **$1,173M** | $455M | 2.6× |
| Mid-studio tentpole (mktg $60M, fame ~68, score ~68) | **$815M** | $233M | 3.5× |
| **Average wide Action (mktg $30M, fame 50, brand 50, score 60/65)** | **$712M** | $156M | 4.6× |
| Low-buzz wide (mktg $8M, fame 30, brand 30, score ~52) | **$194M** | $72M | 2.7× |
| Mediocre film, **huge** marketing ($150M, fame 40, score ~41) | **$542M** | $233M | 2.3× |
| Indie Drama (Limited, mktg $2M, score ~75) | $41M | $3.5M | 11.7× |
| Horror cheapie (Wide, Halloween, mktg $15M) | $258M | $58M | 4.5× |

**An "average everything" wide release grosses ~$712M worldwide** and returns
~$300M in studio cash. In reality an average wide release does ~$80–150M
*worldwide*; only the genuine top tier clears $700M. The model has compressed the
whole industry up against its own ceiling: the *average* film performs like a
real-world hit, so nearly everything is wildly profitable.

**Root cause** is in `audienceSimulationInputs.ts`:

- `BASE_ADDRESSABLE_POPULATION = 250_000_000`. Action × Mass Market addressable
  pool = 250M × 1.0 × 0.75 = **187.5M people**. That constant was deliberately
  sized so a *maxed-out* film could reach ~£2B (a rare-phenomenon ceiling) — but
  nothing scales the *ordinary* film down off that ceiling.
- `BASE_INTEREST_FLOOR = 0.15`, `CEILING = 0.45`. An average concept converts
  ~30% of a 187M pool into the interested pool.
- `MAX_WEEKLY_THROUGHPUT_FRACTION = 0.5` and Wide `conversionPacingBaseline =
  0.35` let that pool drain fast into a huge opening and a healthy tail.

The net effect: the interested pool for an average film is tens of millions, and
the model lets almost all of it convert. Every downstream lever (below) is then
fighting over a total that is already an order of magnitude too big.

> **This recalibration is the dominant fix.** The other three levers are real and
> worth doing, but even a perfectly-tuned competition system cannot make an
> average film "reasonable" while the average film's uncontested ceiling is
> $700M. Scale first, then shape.

---

## 1. Competition is mechanically inert (biggest structural gap)

Two separate crowding mechanisms exist, and **both are effectively no-ops for the
exact films the brief cares about** (big wide releases fighting each other):

**One-time release-day dent** (`competitiveCrowding`, dents
`initialAvailabilityFraction` by up to `CROWDING_PENALTY_WEIGHT = 0.5`):

| Release-day crowding | Total WW (avg film) |
|--:|--:|
| 0.00 | $712M |
| 0.50 | $696M |
| 1.00 (maximally crowded) | $682M |

Maximum crowding costs an average film **~4%** of its gross.

**Ongoing weekly pressure** (`COMPETITIVE_PRESSURE_WEIGHT = 0.05`, applied every
settled week from live competitors' strength):

| Sustained weekly pressure | Total WW (avg film) |
|--:|--:|
| 0.00 | $712M |
| 0.50 | $712M |
| 1.00 (maximal, every week) | **$712M** |

**Literally zero effect.** The mechanism is real but cannot bite, for a
structural reason: competition only lowers `availabilityFraction`, and
availability only constrains admissions when demand *exceeds* capacity
(`maxServiceableDemand = availability × 0.5 × anchor`). A Wide release opens at
~0.95 availability against a capacity anchor so generous that demand never
approaches it — the film is demand-limited, never capacity-limited — so shaving
availability at the margins changes nothing. A film **cannot be pushed out of
theatres** in the current model, no matter how strong its neighbours are.

There is also a **conceptual** gap independent of the calibration one:
`computeCompetitiveCrowding` is **absolute, not relative**. It sums the strength
of nearby competitors but never looks at the *candidate's own* strength. A
$300M-marketing blockbuster feels the same crowding number as a $2M indie facing
the same neighbours. In reality the causation runs the other way: the **stronger**
film takes the screens and the **weaker** one loses them. Crowding needs to be a
function of *relative* strength (candidate vs. the incumbents on that
window/screen pool), not just incumbent mass.

**Fix direction:**
1. Make availability actually able to bind — lower `MAX_WEEKLY_THROUGHPUT_FRACTION`
   (and/or the anchor) so a wide film's capacity can genuinely fall below its
   demand once availability is squeezed. Until capacity can bind, no competition
   knob matters.
2. Make crowding **relative**: a film weaker than the incumbents on its window
   loses screen access to them (fast contraction / suppressed opening); a film
   stronger than the incumbents displaces *them*. This is the "strong performers
   push others out" behaviour the brief asks for, and it's the same signal the AI
   scheduler (Lever 4) needs.
3. Optionally model a **finite shared screen pool per window** so displacement is
   zero-sum, not just an independent per-film dent.

---

## 2. Buzz is too easy to max, and inflates the opening

`computeBuzzScore` (`engine/scoring.ts`):

```
10 (base) + fameBuzz + brandBuzz + marketingBuzz + eventsBuzz + musicBuzz
   + finalCutBuzz + scriptBuzz
```

with `marketingBuzz` alone worth **up to 75** (the `MARKETING_SPEND_ANCHORS`
table: a national blitz ≈ 52, a global campaign ≈ 75). So marketing spend *by
itself* takes buzz from 10 to **~60–85 with no stars and no brand**. Fame and
brand are supposed to gate the top of the range (`(fame−50)×0.5`,
`(brand−50)×0.4`) but they only add a modest ± on top of a marketing term that
already saturates the scale.

What buzz then does downstream (post the Milestone-11 separation) is narrow — it
feeds `conversionPacingBaseline` urgency only (`BUZZ_URGENCY_WEIGHT = 0.5`), so
its effect on **total** gross is nearly flat, but it does inflate the **opening**:

| Buzz | Opening (avg film) | Total |
|--:|--:|--:|
| 10 | $136M | $693M |
| 50 | $162M | $709M |
| 90 | $188M | $694M |

Opening swings ~1.4× across the buzz range — and because buzz is trivially
pushed past 80 with money alone, that upper opening is always available for
purchase. (Note the *larger* opening-weekend driver is actually
`initialAwareCount` = marketing reach × a huge addressable pool, which is really a
symptom of Lever 0. Marketing sweep: opening $52M → $250M across $1M → $150M
spend.)

**Fix direction:** cap marketing's solo contribution in `computeBuzzScore` (e.g.
lower the anchor ceiling and/or make the marketing term multiplicative with a
fame/brand factor) so that **phenomenon-level buzz requires stars or an
established brand, not just a cheque** — matching the function's own stated
intent ("money alone caps out well short of 100"), which the current anchors
don't actually enforce.

---

## 3. Studio identity is not yet a lever

Today `studioBrand` does two things only: it scales `marketingEfficiency`
(awareness reach) and contributes `brandBuzz`. There is **no notion of a studio
being *known for* something** — a genre, an audience, a budget class. Rivals have
a `tier` (Indie / Mid-Size / Major) and a `GENRE_TIER_BIAS` that shapes *what they
choose to make*, but nothing shapes *how well an on-brand film performs*, and the
player has no identity axis at all.

This matters for the money problem because identity is the natural way to stop
"any studio can make any film and win": a studio should convert its marketing and
crowding-strength **more efficiently for on-brand films and less for off-brand
ones.** It also underpins Lever 4 — a studio's identity is what makes a
horror-boutique's Halloween slot *its* territory and a major's summer tentpole
*theirs*.

**Fix direction (larger design piece):** give each studio (player + rivals) an
identity — most cheaply a **genre/audience affinity** that grows from what it
actually ships and cashes in. On-brand films get a marketing-efficiency /
interest / competitive-strength bonus; off-brand films get none or a penalty.
This is a differentiation and specialisation lever, and a soft cap on
everything-everywhere dominance. It is the biggest *new* system of the four and
should follow the recalibration, not precede it.

---

## 4. AI release scheduling only *avoids*, never *contests*

`engine/rivalStudios.ts:avoidCrowdedReleaseDay` nudges a rival's naive release day
forward one day at a time while `computeCompetitiveCrowding > MAX_ACCEPTABLE_CROWDING
(0.35)`, capped at `MAX_RELEASE_DAY_NUDGES (14)` days. Consequences:

- **Everyone flees; nobody claims.** There is no path by which a strong major
  *plants a flag* on a prime weekend and forces weaker films off it. All twelve
  rivals use the identical avoid-rule regardless of tier or film strength.
- **No relativity.** The nudge reads incumbent mass, never the candidate's own
  strength — a Major tentpole swerves away from a crowded summer weekend exactly
  as an Indie would, which is backwards.
- **Only ±14 days of freedom**, so films can't actually reach a genuinely quiet
  pocket if the whole season is busy.

### What real studios do (researched, for calibration)

- **Volume per tier:** Major ≈ **8–20 wide/yr** (Disney low-volume/high-budget
  ~8–12; Universal stacks sub-labels ~15–20+; WB/Sony/Paramount ~10–15).
  Mini-major (Lionsgate) ~10–14 wide. Boutique (A24/Neon/Blumhouse) ~4–10 wide
  (often *limited*/platform, not instant-wide).
- **What constrains frequency:** not production — **marketing (P&A) capital** (a
  campaign often rivals the production budget) and a **finite number of good
  weekends** (52 weekends, only summer + Thanksgiving + mid-Dec are "prime").
  Studios ration capital into *fewer, larger bets* and space their own slate so
  titles don't cannibalise each other.
- **How dates are picked relative to each other:** tentpoles **date-stake** prime
  frames years ahead; when a bigger film claims/moves onto a weekend, **weaker
  adjacent films vacate** in a cascade; same-demographic blockbusters avoid
  head-to-head (they split and both underperform) and instead **counter-program**
  a *different* audience (the Barbenheimer case: opposite demos → complementary,
  not cannibalising).
- **Concentration:** top-10 films now take **40%+** of annual box office. A
  realistic annual distribution is a steep power law — the top ~10–20 wide
  releases capture roughly half of all gross.

### Fix direction

Replace the avoid-only nudge with **strength-aware scheduling**:

- Each candidate compares its **own** release strength against the incumbent
  strength on a window. A film **stronger** than the field will *tolerate or claim*
  a prime window (majors fighting majors); a film **weaker** than the field flees
  to the quiet pockets (everyone else surviving cleverly). This is the same
  relative-strength signal Lever 1 needs — build it once.
- Let **tier + identity** set risk appetite and the marketing capital a studio can
  commit, so per-tier *frequency* and *slate size* emerge from capital and
  window-scarcity rather than a flat spawn cadence. Target the researched volumes
  (Major ~10–15 wide/yr, Mid ~10, Indie/boutique ~4–10) as a calibration check via
  `rivalStudios.diagnostic.test.ts`.
- Add **demographic counter-programming**: same-genre/same-audience clashes carry
  the split penalty; opposite-audience films on the same window are spared it (or
  benefit) — which naturally spreads the quiet-pocket survivors across the calendar
  instead of stacking them.

---

## Recommended sequence

1. **Recalibrate absolute scale** (`BASE_ADDRESSABLE_POPULATION` / interest floor /
   throughput) so an average wide film lands ~$100–180M WW, a mid tentpole
   ~$300–500M, and only a genuine top-tier film clears ~$700M–1B. *Dominant fix
   for "too much money."*
2. **Make competition bite** — let availability actually constrain demand (lower
   throughput anchor) and make crowding **relative to the candidate's own
   strength**, so stronger films displace weaker ones. Reuse this relative-strength
   signal in Lever 4.
3. **Fix buzz** — stop marketing spend from single-handedly maxing buzz; require
   fame/brand for phenomenon-level opening urgency.
4. **Strength-aware AI scheduling** — majors contest/claim prime windows, weaker
   studios flee to quiet pockets; counter-programming; per-tier frequency
   calibrated to the researched volumes.
5. **Studio identity** — genre/audience affinity that boosts on-brand marketing/
   interest/competitive-strength and anchors the scheduling territories. Largest
   new system; do last.

Each step is independently shippable and independently testable
(`audienceSimulationScenarios.test.ts`, `rivalStudios.diagnostic.test.ts`,
`aiStudioStats.diagnostic.test.ts`). Save compatibility is out of scope
(pre-launch policy, `CLAUDE.md`) — bump `SAVE_KEY` freely.
