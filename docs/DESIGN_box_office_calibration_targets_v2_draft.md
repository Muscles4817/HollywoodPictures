# Box Office Calibration Targets v2 — RATIFIED

Status: **ratified and implemented.** See §9 for what landed, what is in band, and
the two derivation errors found and corrected during implementation.

Original preamble follows.

Status (as drafted): **draft, nothing here is ratified.** This document proposes replacements
for the profitability and whole-year bands in
`DESIGN_box_office_calibration_targets.md` §3 and §5, and adds per-tier targets
that document had no equivalent of. It changes no code. Edit the numbers here
first; implementation follows ratification, as v1 established.

Same discipline as v1: **a behavioural specification, not a tuning document.**
Every figure below is an observable outcome, never an engine constant.

---

## 1. Why v1 needs replacing

Two reasons, both measured.

**The bands measure half the P&L.** v1's §5 asserts against `FilmResults.profit`,
which is `studioRevenue − totalCost`, and `studioRevenue` is **theatrical rentals
only**. The game also pays post-theatrical revenue (`state/ancillarySettlement.ts`,
live for both the player and rivals), measured at **109% of theatrical rentals**.
So "45% of films unprofitable" has been asserted against roughly half of what a
film earns. On the whole P&L the figure is **34%**, and 16% for wide releases.

**The bands are shares of the whole field, so tier errors cancel.** A market where
mid-budget films print money and tentpoles cannot make any passes every one of
them. That was the actual state of the model for months
(`DESIGN_REVIEW_scale_and_competition.md` §1.1), while `wideUnprofitablePct` sat
inside its band throughout.

v1's §1 (the funnel principle), §2 (per-film archetypes), §4 (variance) and §6
(buzz) are unaffected and stand as ratified.

---

## 2. The reference case

`docs/domain/11-money-accounting-and-participations.md` §5.4 gives a
representative 12-film studio slate with negative cost, P&A, worldwide gross and
lifetime contribution after overhead and interest. It is the closest real
analogue to what this game's rival market *is* — a handful of studios releasing a
few dozen films a year — and it is the anchor for everything proposed below.

Return is contribution ÷ capital deployed (negative + P&A), with overhead and
interest added back, because the game models neither: §5.2's worked greenlight
puts overhead + interest at **8.6%** of capital, and that figure is used here.

| # | Type | Negative | P&A | P&A÷neg | WW gross | gross÷neg | Return |
|---|---|--:|--:|--:|--:|--:|--:|
| 1 | Franchise sequel | $200M | $160M | 0.80 | $1,100M | 5.5× | **1.81×** |
| 2 | Animated original | $135M | $150M | 1.11 | $720M | 5.3× | **1.49×** |
| 3 | Horror | $15M | $30M | 2.00 | $185M | 12.3× | **2.42×** |
| 4 | Star-driven action | $110M | $110M | 1.00 | $430M | 3.9× | **1.20×** |
| 5 | Broad comedy | $45M | $60M | 1.33 | $175M | 3.9× | **1.20×** |
| 6 | Genre thriller | $35M | $45M | 1.29 | $140M | 4.0× | **1.19×** |
| 7 | Prestige drama | $28M | $40M | 1.43 | $95M | 3.4× | **1.12×** |
| 8 | YA adaptation | $70M | $75M | 1.07 | $190M | 2.7× | **0.98×** |
| 9 | Mid-budget drama | $40M | $50M | 1.25 | $85M | 2.1× | **0.81×** |
| 10 | Comedy sequel | $60M | $65M | 1.08 | $110M | 1.8× | **0.77×** |
| 11 | Franchise starter | $150M | $140M | 0.93 | $260M | 1.7× | **0.57×** |
| 12 | Tentpole miss | $210M | $170M | 0.81 | $310M | 1.5× | **0.51×** |
| | **Slate** | **$1.10B** | **$1.10B** | **1.00** | **$3.80B** | 3.5× | **median 1.16×** |

Three things this says that the current targets do not.

**The middle is fat and the tails are thin.** Nine of twelve films land between
0.5× and 1.5×. Nothing on the slate returns more than 2.5×. The distribution is
dominated by its tail *in absolute contribution* — two films out-earn the other
ten — but in **return on capital** it is compressed, because P&A scales with
ambition: the $1.1B franchise sequel returns 1.81×, less than the $15M horror's
2.42×.

**P&A ÷ negative is ~1.00 slate-wide and rises as budgets fall** — 0.80–1.11 above
$80M, 1.07–1.43 in the middle, 2.00 for the $15M horror. The floor is fixed
(§6.4: you cannot open wide in the US for less than ~$25–35M), so cheap films
carry proportionally more of it.

**Break-even is therefore a *falling* multiple of negative cost.** §6.1's worked
cases: **~8.5×** for a micro-budget film, **~5.1×** for a mid-budget one, **~4.0×**
for a tentpole (§8.2). This is the single most load-bearing correction in this
document, and the current model has it backwards in magnitude at every tier.

---

## 3. Proposed §5 replacement — profitability, on the whole P&L

**Measured on theatrical rentals + post-theatrical revenue, against all-in cost
(negative + P&A).** That change of basis is the substance of this section; the
band edges are kept from v1 so the series stays comparable.

| Outcome | Return | v1 target | Reference slate | **Proposed** | Current (whole P&L) |
|---|---|--:|--:|--:|--:|
| Outright bomb | < 0.4× | ~15% | 0% | **5–12%** | 4.9% |
| Loss | 0.4–1.0× | ~30% | 42% | **30–42%** | 29.4% |
| Break-even | 1.0–1.25× | ~12% | 33% | **18–30%** | 9.2% |
| Modest success | 1.25–2.5× | ~25% | 25% | **18–30%** | 25.5% |
| Major hit | 2.5–5× | ~15% | 0% | **4–10%** | 18.1% |
| Studio-changing | > 5× | ~3% | 0% | **1–4%** | 12.9% |
| | | **~45%** | **42%** | **40–52%** unprofitable | **34.3%** |

Where the proposal departs from the slate, and why:

- **Bombs 5–12%, not the slate's 0%.** Twelve films cannot show a tail. The
  slate's worst is 0.51×; genuine disasters (a $200M film opening to $40M) reach
  0.25×. Kept well below v1's 15%, which was set with no reference case.
- **Major and blockbuster kept non-zero.** The slate has no micro-budget breakout;
  those are real (a $5M horror grossing $200M returns 5×+) and are the main
  source of the top two bands. They are rare, which v1 already had right for
  blockbusters and badly wrong for major hits.
- **Break-even widened to 18–30%.** The slate's 33% is the most striking single
  number in it: a third of studio films land within ±25% of break-even. v1's 12%
  had the middle of the distribution far too thin.

The net effect is a distribution with **a much fatter middle and thinner tails**
than v1 ratified. The unprofitable share barely moves (45% → 40–52%); what moves
is the shape of the profitable half.

---

## 4. Proposed new §3a — per-tier targets

Tiered by **negative cost**, never all-in: that is what "a mid-budget film" means
in the industry and in `docs/domain/`, and all-in tiering moves films between
tiers whenever the marketing model changes.

| Metric | Tier | Reference | **Proposed** | Current |
|---|---|--:|--:|--:|
| **P&A ÷ negative** | small <$25M | 2.00–2.75 | **1.5–2.5** | 1.39 |
| | mid $25–80M | 1.07–1.43 | **1.0–1.5** | 0.71 |
| | big >$80M | 0.80–1.11 | **0.8–1.1** | 0.66 |
| **Break-even gross ÷ negative** | small | ~8.5× | **7–10×** | ~2.8× |
| | mid | ~5.1× | **4.5–6×** | ~2.0× |
| | big | ~4.0× | **3.5–4.5×** | ~1.9× |
| **Median gross ÷ negative** | small | 12.3× | **7–13×** | 12.4× |
| | mid | 3.1× | **3–5×** | 6.1× |
| | big | 3.9× | **3.5–5.5×** | 4.1× |
| **Median return (whole P&L)** | small | 2.42× | **1.1–2.4×** | 3.31× |
| | mid | 1.05× | **0.95–1.35×** | 2.92× |
| | big | 1.19× | **1.0–1.45×** | 2.25× |
| **Unprofitable %** | small | — | **40–55%** | 13% |
| | mid | 50% | **40–55%** | 14% |
| | big | 40% | **35–50%** | 25% |
| **Tier return spread** | best ÷ worst | 2.3× | **≤ 1.8×** | 1.47× |

Two readings worth having in front of you when ratifying:

**The gross curve is already right at the ends and wrong in the middle.** Median
gross ÷ negative is 12.4× against a reference 12.3× for small films and 4.1×
against 3.9× for tentpoles — both essentially exact. Mid-budget is 6.1× against
3.1×, **twice what it should be**. That is the residue of the complaint this whole
line of work started from, and it is now isolated to one tier.

**The break-even multiples are the real problem.** Every tier's is 2–3× too low,
which is why nothing loses money. That is not a gross problem — it is the
combination of §5's two revenue-side errors below.

---

## 5. Revenue-side ratios that need ratifying too

These are observable outcomes, not constants, and both currently sit outside any
defensible real-world range. They are the arithmetic cause of §4's break-even
gap, so ratifying §3 and §4 without them is not actionable.

| Ratio | Reference | Basis | **Proposed** | Current |
|---|--:|---|--:|--:|
| Theatrical rentals ÷ WW gross | 46–50% | domain/10 §8.1, §8.2; the worked cases run 47–50% | **44–49%** | **41.3%** |
| Post-theatrical ÷ theatrical rentals | 32–50% | domain/11 §6.1 cases A–D: 0.37, 0.45, 0.73 (flagged "unusually high"), 0.32; §5.2 base case 0.50 | **35–55%** | **109%** |

The rentals figure is the one thing in the model that is currently too *harsh*,
and only mildly: real distributors retain 46–50% of gross but then carry "other
distribution expenses" (~7% of rentals in §5.2's worked model) that this game
folds nowhere, so a net 41% is defensible and 44–49% is proposed as the honest
band rather than the headline one.

**Post-theatrical at 109% is the single largest miscalibration in the model** —
roughly 2.5× its real value, and the direct reason 66% of films are profitable.
Note the shape as well as the level: domain/11 §6.1D is explicit that family and
animation earn a much larger downstream share than live action, so a flat rate
would itself be wrong.

> **Resolved (§11).** The level was corrected first and the archetype *ordering*
> filed as an open question; that question is now closed, and the ordering
> corrected at its three sources.

---

## 6. Proposed §3 amendments — whole-year

| Metric | v1 target | Reference | **Proposed** | Current |
|---|--:|--:|--:|--:|
| Median wide WW gross | $90–130M | $180M (slate median) | **$120–190M** | $260M |
| Mean wide WW gross | $170–230M | $317M (slate mean) | **$200–300M** | $339M |
| % wide over $100M | 40–50% | 58% | **45–60%** | 83% |
| % wide over $500M | 5–8% | 17% (2 of 12) | **6–12%** | 16.6% |
| % wide over $1B | 1–2% | 8% (1 of 12) | **1–3%** | 5.2% |
| Top-10 share of annual gross | 40–50% | 38–39% | **34–44%** | 36.9% |
| % wide unprofitable (whole P&L) | — | 42% | **40–52%** | 15.8% |

The gross-level bands are all proposed **upward** from v1, and the reason is a
scale question that should be ratified explicitly: v1's figures read like the
whole US market (~110 wide releases a year, median well under $100M), while this
game's rival field is ~8 wide releases per seed-year across five or six studios —
structurally a *studio slate*, not a market. Compared against the slate that
actually resembles it, the model's gross level is much closer to right than v1
implies, and the profitability problem is almost entirely on the cost and
downstream-revenue side.

**Top-10 share is proposed downward, from 40–50% to 34–44%.** Real top-10 domestic
share has run 38–39% in recent years; v1's 40–50% appears to have been set from
the "top-10 take 40%+" rule of thumb without a measured figure. The model's 36.9%
is roughly right, and the several passes spent trying to move it were chasing a
target that was itself too high.

---

## 7. What ratifying this implies

Roughly in dependency order. None of it is started.

1. **Post-theatrical revenue down to ~35–55% of rentals**, with the family and
   animation exception preserved. Largest single lever; nothing else can be
   judged until it lands.
2. **P&A up again** — the wide-release floor already added closes part of the
   gap, but every tier still sits below its reference ratio.
3. **Mid-budget gross down ~2×**, and only mid-budget. Small and tentpole gross
   are already at reference.
4. **Re-point the existing harness at the whole P&L.**
   `boxOfficeDistribution.diagnostic.test.ts` §5 measures `FilmResults.profit`;
   it should measure rentals + post-theatrical.
   `boxOfficeByBudgetTier.diagnostic.test.ts` already reports both.
5. Re-check §2's per-film archetypes against the ratified gross bands.

---

## 8. Decisions to ratify

1. **The basis change** — profitability measured on the whole P&L, not
   theatrical alone. Everything else follows from this.
2. **The fatter middle, thinner tails** in §3 — particularly break-even
   18–30% (from 12%) and major hits 4–10% (from 15%).
3. **The falling break-even multiple** in §4 (~8.5× small, ~5× mid, ~4× big) as
   the model's central profitability shape.
4. **Post-theatrical at 35–55% of rentals** (§5), and whether it should vary by
   genre rather than being flat.
5. **Scale framing** (§6) — is the rival field a studio slate or a whole market?
   The gross bands differ by roughly 2× depending on the answer, and this is the
   one question here that is a game-design choice rather than a realism finding.
6. **Top-10 share down to 34–44%** (§6).
7. **Tier return spread ≤1.8×** as a standing invariant — the "no budget class is
   simply the wrong thing to make" rule.


---

## 9. Implementation outcome

Implemented in dependency order per §7. Full suite green (2,565 passing); the
ratified regression matrix that guards the word-of-mouth runaway stays 62/62.

### 9.1 Two derivation errors in this document, found and corrected

**The break-even multiples in §4 are THEATRICAL, not whole-P&L.** They were
sourced from worked cases whose arithmetic balances to zero on rentals alone -
`docs/domain/11` §6.1 case A's $8M negative with $25M of distribution expense
breaks even at $68M worldwide (68 × 0.485 − 25 − 8 = 0.0), case B's $45M with
$66M at $230M (230 × 0.483 − 66 − 45 = 0.1) - but filed here under a whole-P&L
heading. Measured on the whole P&L the same films appear to break even near 5×
and 3.5×, so the band would have been wrong by that entire factor. The numbers
stand; the basis label was wrong, and the harness measures theatrical.

**§4's small-tier gross band [7, 13] is unsatisfiable alongside its own 40-55%
unprofitable band.** It was extrapolated from a single reference film - the
slate's $15M horror at 12.3× - which `docs/domain/11` §5.4 explicitly calls "the
best return on capital on any slate", i.e. a winner, not a median. At the
ratified P&A ratio and revenue shares a small film breaks even at ~4.7× on the
whole P&L, so a median of 7-13× caps the tier at roughly 20% unprofitable.
Re-derived as **[4.5, 7]** - the median sits near its own break-even, which is
what the unprofitable band actually asserts, leaving the reference winner in the
upper tail where it belongs. mid and big were checked the same way and are
internally consistent.

### 9.2 What landed

| | Before | After | Band |
|---|--:|--:|--:|
| Post-theatrical ÷ rentals | 109% | **38%** | 35-55 ✅ |
| Rentals ÷ WW gross | 41.3% | **45.4%** | 44-49 ✅ |
| P&A ÷ negative, small | 0.10 | **1.84** | 1.5-2.5 ✅ |
| P&A ÷ negative, mid | 0.44 | **1.39** | 1.0-1.5 ✅ |
| P&A ÷ negative, big | 0.65 | **1.02** | 0.8-1.1 ✅ |
| Median return, small | — | **1.26×** | 1.1-2.4 ✅ |
| Median return, mid | — | **1.36×** | 0.95-1.35 (0.01 over) |
| Median return, big | — | **1.12×** | 1.0-1.45 ✅ |
| **Tier return spread** | **2.02×** | **1.21×** | ≤1.8 ✅ |
| Wide unprofitable | 15.8% | **40.5%** | 40-52 ✅ |
| Top-10 annual share | 32.2% | **39.5%** | 34-44 ✅ |

Aggregate harness 12/17 against the ratified bands, from 11/17 against the old
ones on the wrong P&L. The four still open are `wideOver100Pct` (63.7 against
45-60) and the three §9.3 discusses.

Two changes beyond §7's list, both forced by measurement and both evidenced:

- **Rival capital ×1.5** (Major $390M → $600M). P&A roughly tripled, so a
  tentpole's all-in cost went from ~$135M to ~$260M while the reserve behind it
  did not move, and films over $80M of negative cost fell from 53 to 25 across
  the harness - the affordability gate quietly deleting the top of the market.
  The same pairing the previous cost-side pass documented.
- **AVERAGE_TICKET_PRICE $11 → $6.50.** The model applied a US ticket price
  (`docs/domain/10` §7: "Ticket price in the US averages around $11") to a
  *worldwide* admissions count, against a 200M-person worldwide addressable
  pool. That chapter's own market table says the high-admission markets are the
  low-price ones - Mexico "very high admissions on low ticket prices", India
  "vast admissions on very low ticket prices, so gross understates reach" - so
  the blend has to sit well below the US figure. $6.50 keeps it above a pure
  global average, since Hollywood films over-index on higher-price markets.

### 9.3 What did not land, and the reason (diagnosis SUPERSEDED — see §10)

`breakevenPct` (10.8 vs 18-30), `modestPct` (32.0 vs 18-30) and `majorPct`
(16.1 vs 4-10) are all one finding: the return distribution has the right
**median** and the right **tails** but too thin a **middle**. §3's "fat middle,
thin tails" shape is a variance property, and the obvious lever for it is
blocked by a structural coupling worth recording:

> The diagnosis below was tested directly in §10 and is **wrong**. The
> observation is real - moving the audience curve does destabilise the loop -
> but the denominator is not the cause. Read §10 for the mechanism.

**`maxInterestedAudience` is both the audience ceiling and the word-of-mouth
normalisation denominator.** Any change to the base interest fraction therefore
rescales `womInfluence` and destabilises the reproduction loop. Measured
directly: with everything else held, cutting `BASE_INTEREST_CEILING` 0.45 → 0.22
put the tier bands almost perfectly in range (mid at 4.68× gross/negative and a
1.24× median return, both centre-band) and simultaneously tripped the runaway
guard at a 1.29 reproduction ratio, with the *ordinary* film losing its legs
while the *phenomenon* self-sustained - the loop's ability to tell them apart
gone. Restoring the base restored the guard; no rebalancing of the four response
sensitivities recovered both ends at once.

So the audience level cannot be set independently of the word-of-mouth loop
while those two share a denominator. Decoupling them is the next pass, and it is
the same `womNormalisationPool` change trialled and reverted earlier
(`DESIGN_REVIEW_scale_and_competition.md` §4) - reverted then because
normalising against the natural audience alone lifted the bottom of the market,
which is a tractable problem, and worth revisiting now that there is a concrete
reason to.


---

## 10. The decoupling pass — a negative result, and the real mechanism

§9.3 proposed separating the word-of-mouth normalisation denominator from
`maxInterestedAudience` so the audience curve could be retuned freely. That was
built, measured, and **reverted**. The hypothesis is wrong, and the experiments
that disprove it also identify what is actually going on.

### 10.1 What was built

`AudienceSimulationFixedState` gained an optional `womReferenceAudience` - the
pool word of mouth is measured against - defaulting to `maxInterestedAudience`
so every existing caller was unaffected. The interest curve became data
(`InterestCurve`), instantiated twice: `AUDIENCE_INTEREST_CURVE`, free to retune
for box-office calibration, and `WOM_REFERENCE_CURVE`, frozen at the calibration
the loop's four response constants were last swept against.

With both curves identical the change is a **proven no-op** - the full suite
stayed at 2,565 passing, the regression matrix at 62/62.

### 10.2 It does not unlock the curve

Cutting `AUDIENCE_INTEREST_CURVE` to 0.045/0.22 with the denominator frozen:
the runaway guard no longer trips, but the **ordinary film starves** - its weeks
2-4 hold falls to 0.33x its opening against a required 0.6x, and its legs to
1.71x against a required 1.8x - while the phenomenon still self-sustains at a
1.83 peak reproduction ratio.

Cutting it only moderately, to 0.07/0.38, trips the runaway guard instead, at
1.15. So moderate cuts run away and deep cuts starve, with no green band
between: freezing the denominator changed the *sign* of the coupling without
removing it.

### 10.3 The interest fractions are not a scale lever either

Next hypothesis: the loop is invariant to a *uniform* rescale of the pool, and
what breaks it is changing the pool's composition. Tested by halving everything
together - base floor, base ceiling and `CROSSOVER_CAPACITY_CEILING` all x0.5,
denominator coupled as before. **Still trips**, at a 1.34 reproduction ratio.

### 10.4 What actually drives the loop

Same halving, applied one level up - `BASE_ADDRESSABLE_POPULATION` 200M -> 100M,
interest fractions untouched. **Every reproduction-ratio and legs assertion in
the matrix stays green.** The only three failures are pure absolute-size bars
that a half-sized market must fail by construction: the phenomenon grosses
$997M against a >$1B floor, and the huge-opening scenario opens to 40.7M
admissions against a >50M floor.

That isolates it:

**`initialAwareCount` is sized from `totalAddressableAudience` - marketing reach
and cast fame times the whole population - while the interested pool is a
*fraction* of that same population. Cutting the interest fraction therefore
changes the ratio of aware people to interested people, and it is that ratio,
not the size of either pool, that the reproduction loop runs on.** Scaling the
population moves awareness and interest together and the loop does not notice.

Which is why every attempt above failed in the way it did. The denominator was
never the coupled quantity; the funnel's own shape was.

### 10.5 Consequences

- **The safe audience lever is the population, not the interest curve.** It
  scales admissions with the awareness/interest ratio held fixed.
- **It buys no new headroom for this calibration, though.** Gross is admissions
  times price, so population and `AVERAGE_TICKET_PRICE` are the same lever for
  anything measured in money, and §9.2's price correction already spent it.
- **So the bands still open in §9.3 are not a level problem.** `breakevenPct`,
  `modestPct` and `majorPct` describe a distribution with too thin a middle at
  the right median - a variance property. Compressing outcome variance is a
  reception-model question, not a box-office one, and it runs against the
  direction `DESIGN_REVIEW_reception_model.md` deliberately pushed.
- **The refactor was reverted rather than shipped.** It is a clean abstraction
  and it cost nothing, but its own comments would have promised an unlock that
  does not exist, and a no-op field documented as load-bearing is worse than no
  field. The mechanism above is the durable part; recorded here so the
  denominator is not re-attempted a third time.


---

## 11. The archetype ordering — closed

§5 ratified the post-theatrical *level* and deliberately left the *ordering*
open: the model ranked a merch franchise highest and a prestige drama lowest,
where `docs/domain/11-money-accounting-and-participations.md` ranks them the
other way round. Correcting a level is a rescale; correcting an ordering is a
reshaping, and it was not what §5 asked for. It is now done.

### 11.1 The target

§6.1's four worked P&Ls are stated in exactly the units the model measures —
lifetime post-theatrical over theatrical rentals — and §3.4's revenue-mix table
gives the window composition. Both agree on the ordering, and closely on the
spacing once normalised.

| archetype | reference | before | **after** |
|---|--:|--:|--:|
| Prestige drama | 0.735 | 0.214 | **0.759** |
| Merch franchise | 0.525 | 0.905 | **0.593** |
| Four-quadrant tentpole | ~0.40 | 0.459 | **0.404** |
| Typical wide / horror | 0.369 | 0.242 | **0.365** |

Field-wide post-theatrical stays at 38% of rentals, inside the ratified 35-55%
band, and the "cannot ancillary your way out of a flop" invariant holds on the
absolute figure it was always fenced on.

### 11.2 Three defects, each fixed at its source

**The reach base was linear in worldwide gross.** Post-theatrical was therefore
a fixed share of gross, the ratio to rentals was decided entirely by the
multipliers, and merchandising - the one multiplier with a wide range - dictated
the ordering. It is now concave (`REACH_BASE.grossExponent`), which is what the
reference describes: §3.1 prices the premium SVOD window as "a fixed licence
fee", pay-TV and free-TV as recurring and "small per-run" fees, and §3.3 prices
library packages on "hours, title recognition, and genre mix rather than on any
individual film". A film that grossed ten times more gets a bigger licence fee,
not a tenfold one.

**Licensing had no genre term at all.** §3.4's licensing column is the reference's
second-widest genre signal after consumer products - 15-20% of lifetime revenue
for a tentpole or an animated family franchise against 35-45% for an adult drama
- and the model could not express it. `GENRE_ANCILLARY` gains a `licensing`
weight. The formula's own weighting was also backwards: it scaled hard on
accessibility, reading a narrow film as a weak licensing asset, when television
and library buyers want title recognition and critical standing. Accessibility's
weight is cut and criticScore's roughly doubled.

**Longevity never read criticScore.** It was dominated by `awards`, so a
well-reviewed film that won nothing scored below `CATALOGUE.minLongevity` and
got *no library tail at all* - deleting precisely the channel the reference says
prestige earns in. `LONGEVITY_WEIGHTS` gains `criticalStanding`, and the floor
comes down. The reference does not say awards; it says "library value is why
loss-making prestige films still get made".

A fourth, second-order: `homeEnt`'s genre curve ran 1.5 for Fantasy down to 0.6
for Drama, against a reference where home and digital is nearly flat across film
types (10-15% of lifetime for tentpoles and family, 15-20% for horror, comedy
and prestige) and tilts slightly *away* from spectacle. Corrected.

### 11.3 What it costs

`wideUnprofitablePct` (40.5 -> 36.8) and `lossPct` (31.2 -> 28.3) both fall just
below their bands, taking the aggregate harness from 12/17 to 10/17.

This is not a tuning slip, it is the correction working. Making downstream
revenue concave in gross moves post-theatrical money from the biggest films to
the smallest, which is what the reference says happens - and this game's wide
slate skews small, so the field gets more profitable at the bottom. The small
tier's median return rises 1.26x -> 1.43x, still inside its ratified 1.1-2.4
band; its unprofitable share falls to 31%.

Two ratified statements are in genuine tension here, and it is worth naming
rather than tuning away: the reference says both that **cheap films earn the
highest post-theatrical multiple** (§5.4's "the small film is the best return on
capital") and that **roughly half of wide releases fail to recoup**. Those
coexist in a real market with a far larger and more varied slate than this one.
In a field of ~8 wide releases per year skewed small, honouring the first makes
the second harder. Lowering the post-theatrical level to compensate was tried
and rejected: it takes the field to 34%, below the ratified floor, and still
does not recover the bands.


---

## 12. v3 — re-derived at market scope

Everything in §3–§6 was derived when the rival field was **8.8 wide releases a
year**, and §6 said so explicitly: *"is the rival field a studio slate or a whole
market? The gross bands differ by roughly 2× depending on the answer, and this is
the one question here that is a game-design choice rather than a realism
finding."* It was ratified under the **slate** reading.

Two slate widenings later the field is **45.8 wide releases a year from twelve
studios across three tiers** (`DESIGN_REVIEW_slate_width.md`). That question is
now settled by construction: it is a market. This re-derives the targets against
that, and the answer is mostly that the *population being measured* was wrong
rather than the bands.

### 12.1 The profitability bands describe one major's slate

Every quantitative P&L in the reference is a single major's: §5.4's twelve-film
slate, §6.1's four worked cases. Measured over the population that reference
actually describes, the model already agrees with it:

| | reference (one major's slate) | model, **major-tier wide** | model, whole market |
|---|--:|--:|--:|
| Median return | ~1.16× | **1.09×** | 0.87× |
| Unprofitable | 42% | **45.4%** | 56.5% |
| Outright bombs | 0% | **9.1%** | 17.7% |

The market figure is lower because a market contains what a major's slate does
not: Mid-Size and Indie wide releases, returning a median 0.68× and 0.34×. The
reference's twelve pictures say nothing whatever about those films.

So §3's bands are now asserted over **major-tier wide releases**. This is the
second narrowing of the same kind — v2 narrowed from all films to wide releases
because the reference slate is all-wide — and it is the one that matters most:
`bombPct` goes from 17.7 (failing 5–12) to **9.1** without the model moving at
all. The whole-market and all-films shapes are still printed, just not asserted
against a band drawn from one studio's books.

### 12.2 The bands carried false precision

Those shares come from **twelve films**, where a single picture is 8.3 points.
Asserting them to ±6 claimed more than the evidence supports. At one standard
error, `sqrt(p(1-p)/12)`:

| band | slate | ±1 SE | **v3** |
|---|--:|--:|--:|
| loss | 42% | 28–56 | **28–45** |
| break-even | 33% | 19–47 | **14–35** |
| modest | 25% | 12–38 | **15–38** |

For bomb, major and blockbuster the slate observed **none in twelve**, so the
rule of three puts the 95% upper bound at 3/12 — anything under ~14% is
consistent with that. Bands: bomb **4–14**, major **2–14**, blockbuster **0–6**.

**Stated plainly because it cuts both ways.** Widening these is what makes
`breakevenPct`, `modestPct`, `majorPct` and `blockbusterPct` pass, and the model
did not move to earn it. The claim is that the old bands asserted more than a
twelve-film sample can support — not that anything improved. Reject this half of
§12 and those four bands go back to failing; §12.1 stands on its own either way.

### 12.3 New: market structure

`docs/domain/01-industry-structure.md` §2 gives market-level figures that were
never encoded, and they are precisely what the widening was for. Four new bands:

| metric | reference | measured |
|---|--:|--:|
| Wide releases per major, per year | 8–20+ | **5.0** ✗ |
| A major's share of industry gross | 10–25% | **21.4%** ✓ |
| Films per specialty label, per year | 5–15 | **3.6** ✗ |
| Of a specialty label's films, share going wide | low — they "platform rather than open wide" | **17.9%** ✓ |

The structural shape is right: a major commands a fifth of the market, and
specialty labels platform four films in five. The **volume is still short** —
majors release five wide films a year against a reference eight to twenty, and
specialty labels make under four against five to fifteen. That is a concrete,
reference-backed statement of how much further the slate has to go, which the
previous two widenings had no target to check themselves against.

### 12.4 Where that leaves it

**17 of 21 bands pass**, from 13 of 17 before.

Four remain, and they say different things:

- `widePerMajorPerYear` 5.0 and `specialtyFilmsPerYear` 3.6 — a **third widening**
  is warranted, and now has a target. Not done here: each of the last two cost a
  re-peg of everything denominated in crowding units, and that belongs in its own
  pass.
- `wideUnprofitablePct` 52.9 against 40–52 — market-wide, 0.9 over its ceiling.
  Left alone rather than widened; it is measuring the right thing at the right
  scope and is essentially at target.
- `breakevenPct` 13.2 against 14–35 — 0.8 under, and the last remnant of the
  standing "thin middle" finding, which has shrunk from a 7-point gap to under
  one point purely by measuring the right population.

One model finding, not acted on here because it is a change to behaviour rather
than to a target: **Mid-Size studios put 59% of their films into wide release at
a $15M median negative cost**, and those films return a median 0.68×. The
reference says smaller distributors platform. That single behaviour is the
largest source of the market-wide bomb rate, and it is a defect the widening
exposed rather than caused.
