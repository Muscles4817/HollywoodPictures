# Design review — how many films the industry makes

Why the rival market's output was a third of what it should be, what was actually
limiting it, and what widening it did to everything else.

Measured over three seeds × eight in-game years unless stated, with rival
post-theatrical revenue credited (see §1.1 — the harnesses were omitting it).

---

## 1. The gap, and what was causing it

Twelve rival studios (4 Indie / 4 Mid-Size / 4 Major) released **20.3 films a
year between them, 8.8 of them wide** — 1.06 per Indie, 1.22 per Mid-Size, 2.78
per Major. `docs/domain/01-industry-structure.md` §2 has a single major releasing
**8–20+ wide** a year and a mini-major carrying "a slate of 10–20 wide releases".

Three candidates for the constraint, two of which were measured out:

- **Not capacity.** The industry ran at 46% of its own concurrent-production
  ceiling.
- **Not script supply.** A mean of 16.9 unclaimed opportunities sat on the market
  at any moment.
- **Cash.** Every tier ended broke or close to it — median $3M for an Indie, $23M
  Mid-Size, $205M Major — against productions costing far more than that. The
  affordability gate (`cost > rival.cash`) was the binding constraint, and it was
  also quietly acting as a budget governor (§3).

### 1.1 The harnesses were understating the field

`state/ancillarySettlement.ts:accrueRivalAncillary` credits a rival its film's
whole post-theatrical afterlife as a lump, and every engine-level harness omitted
it — they drive the rival market directly rather than through
`runCalendarSettlement`. That understated rival cash and, through the
affordability gate, the size of the whole industry: 16.1 films a year measured
against 20.3 actually produced. Every figure in this document includes it.

---

## 2. Studios do not fund their slates out of pocket

The model had them doing exactly that, which is what made cash binding.

`docs/domain/11-money-accounting-and-participations.md` §7.1 describes the
instrument that exists precisely for this: a slate deal in which an SPV "funds an
agreed % of the negative cost of each qualifying picture (and often the same % of
P&A), and receives the same % of the picture's defined revenue", at a
participation rate of **20–50%**. Its stated purpose is to let a studio run a
wider slate than its balance sheet — it "diversifies the investor and de-risks
the studio".

So `RivalStudio.coFinancedShare`, set by tier: Indie 0.50, Mid-Size 0.42, Major
0.32. The rate rises as the balance sheet shrinks, which is the real pattern — a
major co-finances to de-risk and keeps most of the upside, an independent
finances nearly every picture externally because it has nothing else to finance
it with.

It applies to **both sides**: the studio commits its share of the cost, and
receives its share of theatrical receipts *and* of the post-theatrical afterlife
(§7.1's "defined revenue" is not theatrical-only). Brand, prestige and genre
identity are not shared — those are earned by the film's public performance, and
a co-financed hit is entirely this studio's hit.

The economics per pound of the studio's own capital are unchanged. It simply gets
more films for them, which is the whole point of the instrument.

---

## 3. Capacity and budgets

**Ceilings raised** — Indie 1 → 2, Mid-Size 3 → 5, Major 6 → 9. At an eleven-month
greenlight-to-release cycle a major needs 8–18 pictures in flight to sustain the
reference's 8–20 wide a year; it had six. A ceiling belongs there — §13 of the
industry chapter makes physical infrastructure "a hard constraint on how many
films can be made at once" — but not that low.

**Tentpole budgets pulled back** — `SCALE_SPEND_RANGE.Big` from [0.75, 1.0] to
[0.5, 0.8]. The old top was safe only because a rival could never afford it: the
affordability gate was doubling as a budget governor, and the moment studios were
capitalised to run a full slate the median negative cost of a >$80M picture
inflated to **$217M** — above the largest film on the reference's entire
twelve-picture slate and well above its ~$150M median for that tier. A budget
should be set by what the film needs, never by what the studio happens to hold.

---

## 4. What it did

| | before | after |
|---|--:|--:|
| Films per year, whole industry | 20.3 | **42.0** |
| ...of which wide | 8.8 | **21.2** |
| Per Indie | 1.06 | **2.42** |
| Per Mid-Size | 1.22 | **3.43** |
| Per Major | 2.78 | **4.67** |
| Median >$80M negative cost | $115M | **$128M** |
| Ratified aggregate gates | 10/17 | **12/17** |

A major at 4.67 films a year is still short of the reference's 8–20 wide, and
this was deliberately one step rather than the whole distance: everything
downstream of slate width had been calibrated at the old density, and §5 is what
that cost. **§8 is the second step.**

**The calibration got better, not worse.** Four profitability-shape bands that
had been stuck for the whole recalibration came good at once —
`wideUnprofitablePct` (36.8 → **49.7**), `lossPct` (28.3 → **33.2**), `modestPct`
(→ **30.0**) and `majorPct` (→ **9.2**). A market with twice as many films
genuinely does spread its outcomes better, which is what those bands were asking
for and what no amount of tuning at the old width had produced.

---

## 5. Slate width is coupled to two other things

Both were re-pegged here, and both will need it again if the slate moves.

**Competition weights.** `competitivePressure` is a sum over every competitor in
a film's window, so it scales with how many films the industry makes: doubling
the slate took mean pressure from 0.186 to 0.334 and over-suppressed the entire
market — big-budget films fell to 82% unprofitable. `COMPETITIVE_PRESSURE_WEIGHT`
(0.08 → 0.045) and `ATTENTION_COMPETITION_WEIGHT` (0.55 → 0.31) are re-pegged so
the bite per unit of crowding returns to what it was calibrated at. The relative
matchup — who is pushing whom — is untouched.

**The concentration metric.** `top10SharePct` was not scale-invariant and had a
second, independent defect:

- it bucketed by year alone, pooling every seed into one bucket, so "the top 10"
  meant the top ten across six parallel industries running the same calendar — a
  quantity with no real-world counterpart, whose value moved when the *seed
  count* did;
- and ten films are 29% of a 35-film slate against 9% of a 110-film one, so the
  same market shape reads 74% at one slate width and 40% at another.

Replaced by `topDecileWideSharePct` — the top decile of wide releases' share of
wide-release gross, bucketed per seed-year. The real figure it is calibrated
against (the top ten of roughly 110 US wide releases taking a bit over 40% of
wide gross) *is* a decile, which is what makes the two comparable at all.

---

## 6. Still open

`bombPct` 16.5 against 5–12, `breakevenPct` 10.6 against 18–30,
`topDecileWideSharePct` 31.3 against 35–50, `blockbusterPct` 0.6 against 1–4, and
`wideOver100Pct` 63.2 against 45–60.

The first four are one finding, and it is the same one
`DESIGN_box_office_calibration_targets_v2_draft.md` §10 reached from the other
direction: the distribution has the right median and too thin a middle, with
tails that are too fat at the bottom and too thin at the top. Widening the slate
moved it toward the target rather than away, which is the first thing that has,
but did not close it.

Per-tier, big-budget films remain the weakest — a 0.93× median return and 56%
unprofitable against bands of 1.0–1.45 and 35–50. They run longest, so they sit
in the most windows, and a denser calendar costs them most.

---

## 7. Reproducing

```bash
BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeDistribution.diagnostic.test.ts --disable-console-intercept
BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeByBudgetTier.diagnostic.test.ts --disable-console-intercept
npx vitest run src/engine/audienceSimulationRegressionMatrix.test.ts   # the word-of-mouth runaway guard
```


---

## 8. The second widening

Same two levers, plus the durable fix for §5's first coupling.

**Ceilings and capital again** — Indie 2 → 3, Mid-Size 5 → 9, Major 6 (Medium) +
3 (Big) → 11 + 4; capital Indie $45M → $110M, Mid-Size $300M → $700M, Major
$1.2B → $2.2B. The tiers had split their constraints after the first pass:
majors were capacity-bound (in-flight p90 8 against a ceiling of 9) while Indie
and Mid-Size were still cash-bound at $2M and $9M. A major's $2.2B is the figure
the reference's own slate deploys in a year (`docs/domain/11` §5.4).

| | before §2 | after §4 | **after §8** |
|---|--:|--:|--:|
| Films per year | 20.3 | 42.0 | **83.8** |
| ...of which wide | 8.8 | 21.2 | **45.8** |
| Per Indie | 1.06 | 2.42 | **4.46** |
| Per Mid-Size | 1.22 | 3.43 | **7.40** |
| Per Major | 2.78 | 4.67 | **9.09** |
| Ratified aggregate gates | 10/17 | 12/17 | **13/17** |

A major at 9.09 films a year is inside the reference's 8–20 band, and the
industry's 45.8 wide releases sit against a real market's ~110 — the right order
of magnitude for a twelve-studio compression of it.

### 8.1 Density normalisation, instead of a third re-peg

§5 re-pegged the two competition weights when the slate first widened. Doing it
again did not work, and the reason is worth recording: at 44 wide releases a year
the crowding *score itself* saturated — p50 0.633, p90 0.999, nearly every window
reading "maximally crowded" — and a weight can restore the average bite but not
the spread a saturated score has already thrown away. Median wide gross fell to
$118M and outright bombs hit 19.4% however the weights were set.

So the normalisation moved into the score, as
`releaseCrowding.ts:CROWDING_DENSITY_REFERENCE`: the pressure sum is divided by
how much competition an *ordinary* window holds, which makes the result mean "how
crowded is this window compared with a normal one" — which is what a 0–1 crowding
score has always claimed to be, and what its bands and soft knee were calibrated
against. The two competition weights are back at their original 0.08 / 0.55 and
stay there. Measured pressure returns to the distribution the model was tuned at:
mean 0.185 against the original 0.186, p50 0.133 against 0.117, p90 0.423 against
0.450.

**This is now the one constant that tracks slate width.** Three things are
expressed in crowding units and moved with it, all of them noted at their own
definitions: the qualitative bands (`crowdingBandKey`, rebanded so a head-on
same-genre collision still reads "Crowded"), the AI's date-avoidance weight
(`SCHEDULING_CROWD_WEIGHT` 0.6 → 2.76, without which rivals stopped steering
around each other entirely), and `explainCrowding`'s per-contributor figures.

### 8.2 What it did

`topDecileWideSharePct` **passes for the first time** (36.4 against 35–50). That
is the concentration metric §11.3 of the calibration targets predicted would only
become meaningful at a realistic field size, and it is the last of the
whole-year distribution bands to come good.

Four bands remain: `wideUnprofitablePct` 52.9 (0.9 over its ceiling), `bombPct`
17.7, `breakevenPct` 11.9, `blockbusterPct` 0.5. Three of those are the same
standing finding — the distribution has the right median and too thin a middle,
with a bottom tail that is too fat. Per tier, returns run 0.87 / 1.02 / 0.93
against bands of 1.1–2.4 / 0.95–1.35 / 1.0–1.45: the market at a realistic slate
width is slightly harsher than the targets want, and mid-budget films are the
only tier squarely inside theirs.

Post-theatrical revenue reads 34% of rentals against a 35–55% band — just under,
where it was 38% before. The slate's composition shifted toward the tiers with
the lowest downstream ratios; nothing about the ancillary model changed.
