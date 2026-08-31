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

Aggregate harness 13/17 against the ratified bands, from 11/17 against the old
ones on the wrong P&L.

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

### 9.3 What did not land, and the reason

`breakevenPct` (10.8 vs 18-30), `modestPct` (32.0 vs 18-30) and `majorPct`
(16.1 vs 4-10) are all one finding: the return distribution has the right
**median** and the right **tails** but too thin a **middle**. §3's "fat middle,
thin tails" shape is a variance property, and the obvious lever for it is
blocked by a structural coupling worth recording:

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
