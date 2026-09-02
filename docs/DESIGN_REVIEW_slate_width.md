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

---

## 9. The third widening

The first two widenings raised how many films the industry made. This one raised
how many it **releases wide**, which is the thing the reference actually
measures — and the two turned out to be different problems.

Going in, the gap was stated numerically for the first time (calibration targets
§12.3): majors released 5.0 wide films a year against a reference 8–20, and
specialty labels made 3.6 against 5–15.

### 9.1 The harness was measuring a poorer industry than the game runs

Before any model change: `state/ancillarySettlement.ts:accrueRivalAncillary`
credits a rival its film's whole post-theatrical afterlife as a lump, and
`boxOfficeDistribution.diagnostic.test.ts` — the harness carrying every ratified
gate — never did. It computed each film's post-theatrical revenue for the
profitability record and then threw it away instead of crediting it to the
studio's cash.

That is not cosmetic, because **rival cash is the binding constraint on how many
films get made** (the affordability gate, `rivalStudios.ts` `cost > rival.cash`).
§1.1 found and fixed exactly this omission in the rival-behaviour harness; this
one still had it.

Fixing the measurement alone, with no model change at all, moved the field from
3113 films to 3786 and the two structural gates from 5.0/3.6 to **6.1/4.1**. It
also cost four other gates, because a bigger field is harsher — which is the
coupling §5 documented, arriving on schedule.

Every "before" figure below is measured **after** this fix, so the widening is
not credited with it.

### 9.2 What was actually binding, per tier

Measured over three seeds × eight years. The tiers were bound by different
things, which is why one lever was never going to do it:

| tier | films/yr | wide/yr | at ceiling | cash p50 | median cost |
|---|--:|--:|--:|--:|--:|
| Indie | 4.02 | 0.80 | **53%** | $45M | $9M |
| Mid-Size | 6.57 | 4.06 | 32% | $160M | $42M |
| Major | 6.94 | 4.64 | **2%** | **$71M** | $117M |

Script supply was not the constraint anywhere (14–15 unclaimed opportunities
sitting on the market throughout). Indie was hard capacity-bound. Major was not
— it sat at its ceiling 2% of the time while running on $71M against a $117M
median picture, i.e. **cash-bound**, a $2.2B studio unable to start a film.

### 9.3 Release strategy belongs to the distributor, not just the budget

`RELEASE_TYPE_WEIGHTS_BY_SCALE` chose a release type from the film's scale
alone, so the same $15M film platformed four times in five whoever owned it.
`docs/domain/01-industry-structure.md` makes this a property of the
**distributor**:

- §2, specialty labels: they "release fewer, cheaper films, lean on festivals
  and awards, and **platform (open small, expand) rather than open wide**".
- §2, a major: "a slate of **10–20 wide releases**" — and §2.2.7 itemises that
  slate as 2–4 tentpoles, 3–6 mid-budget **and 4–8 low-budget** films ($5–30M,
  "horror, thriller, faith, specialty"). Those cheap films are inside the 10–20
  wide releases. A major owns a worldwide distribution network (§2.1) and opens
  its slate on it.
- The exception the reference names itself is the 1–3 awards plays, which go
  "often through the specialty label" — a different distributor, which in this
  model is the Indie tier.

So `RELEASE_TYPE_WEIGHTS` is now tier × scale. No distributor platforms a
tentpole — that is physics, not strategy — but at the cheap end a major opens
76% wide where a specialty label opens 14%.

### 9.4 A major could not make a cheap film at all

`startableScales` offered a Major only Medium and Big. Roughly half of a real
major's slate — §2.2.7's 4–8 low-budget films — simply did not exist, and that
is also *why* majors ran cash-poor below their ceiling: every film they were
allowed to start was an expensive one.

Ceilings: Indie Small 3 → 6 (the one genuinely capacity-bound tier), Mid-Size
gains Small (< 6) and Medium 9 → 12, Major gains Small (< 7).

Mid-Size is raised furthest because the field was short at the **non-major** end
specifically: with majors inside their 8–20 band the market still ran ~62 wide
releases a year against a real ~110, and the missing ones are not more
tentpoles — they are the ordinary wide releases a mini-major puts out, most of
which never break $100M.

### 9.5 "Low-budget" means different things at different studios

The moment majors could make cheap films they made them at an *indie's* price
and opened them wide on a major's network. Measured: an $8.8M median negative
grossing **$119M**, a 12.1× gross-on-negative against a 4.5–7× target, and 23%
of a major's slate returning 2.5–5×. The reference slate (`docs/domain/11` §5.4)
has exactly one such film and calls it "the best return on capital" on the whole
slate; the model was making it the median.

The same film class, by distributor, showed the problem cleanly:

| distributor | median negative | median gross |
|---|--:|--:|
| Indie | $2.5M | $26M |
| Mid-Size | $6.2M | $61M |
| Major | $8.8M | **$119M** |

`SCALE_SPEND_RANGE` is therefore tier-aware at the Small end: §2.2.7 prices a
major's low-budget picture at $5–30M and §5.4's slate prices its cheap film at
$15M, while a true independent's is a different animal at a $2.5M median. After
repricing, a major's cheap film sits at a **$19.4M** median negative. The fix is
pricing a studio picture at what the reference says it costs, not a penalty on
cheap films.

`RIVAL_BUDGET_REALISM` went 0.06 → 0.10 for the same reason, **but not for
tentpoles**. The widened wide-release pool is dominated by major-tier films
carrying a major's talent, brand and campaign, so the same budget band buys a
better film than it did; small and mid tiers came out 37% and 36% unprofitable
against a 40–55% band. Lifting Big too took big-budget films from 48% to 53%
unprofitable and their median all-in return from 1.02× to 0.96× — past
break-even, in the tier already closest to it. That trade bought one extra
whole-year gate and cost the one thing the calibration is most explicitly not
allowed to produce, so it was not taken.

### 9.6 The density coupling, again — and how to do it right

§8.1 called `CROWDING_DENSITY_REFERENCE` "the ONE constant that tracks slate
width", and it earned that. Measured on the **live rival market** rather than a
fixture, mean crowding pressure went 0.334 → 0.503 as the industry widened, so
the divisor moves with it: **4.6 → 5.6**, with the two things denominated in
crowding units moving alongside (`SCHEDULING_CROWD_WEIGHT` 2.76 → 3.36,
`crowdingBandKey` thresholds by the same factor).

One discipline learned here and worth keeping: **re-derive it at the end of a
change, not in the middle.** Pegged against the intermediate slate the answer
was 6.9; but §9.5 makes films pricier and therefore fewer, and 6.9 then read
0.273 — 18% below the distribution everything downstream is calibrated against.
5.6 reads 0.343 against a target 0.334.

6.9 scored better on the gate count (16/21 against 14/21), and was still wrong:
two of those gates flip on their third significant figure, and picking a
divisor because it flips them is precisely the tuning-to-the-test this constant
was introduced to prevent.

### 9.7 What it did

| | before §2 | §4 | §8 | **§9** |
|---|--:|--:|--:|--:|
| Films per Indie | 1.06 | 2.42 | 4.46 | **4.63** |
| Films per Mid-Size | 1.22 | 3.43 | 7.40 | **9.25** |
| Films per Major | 2.78 | 4.67 | 9.09 | **8.79** |
| **Wide per Major** | — | — | 5.0 | **9.9** |
| Films per specialty label | — | — | 3.6 | **5.1** |
| Of a specialty label's films, share wide | — | — | 17.9% | **11.5%** |

**Both structural gates pass**, which is what this widening was for:
`widePerMajorPerYear` 9.9 in 8–20, `specialtyFilmsPerYear` 5.1 in 5–15. The
market's *shape* is now the reference's: a major releasing ten wide films a year
off a mixed slate with a real low-budget end, and specialty labels platforming
nine films in ten.

Against the honest baseline (§9.1) the gate count is unchanged at **14/21**, and
the trade is worth stating exactly. Gained: `widePerMajorPerYear`,
`specialtyFilmsPerYear`, `wideMedianGrossM`, `wideUnprofitablePct`. Lost:
`wideOver100Pct`, `topDecileWideSharePct` (34.6 against a floor of 35),
`limitedOpeningMultiple` (12.1 against a ceiling of 12), `majorPct` (14.1
against a ceiling of 14) — three of the four decided in their last digit.

### 9.8 Still open — and one band that is now measuring the wrong thing

`wideOver100Pct` 65.4 against 45–60, `wideOver500Pct` 15.2 against 6–12 and
`wideOver1000Pct` 3.7 against 1–3 are **percentage** bands, and their implied
counts are all correct or low:

| band | measured | implied films/yr | real |
|---|--:|--:|--:|
| > $100M | 65.4% | 39.0 | 55–70 |
| > $500M | 15.2% | 9.1 | 10–15 |
| > $1B | 3.7% | 2.2 | 2–5 |

The model runs **59.7 wide releases a year against a real ~110**, so a share of
the field reads high while the field itself is short. This is the same
scale-invariance defect §5 found in `top10SharePct` and fixed by moving to a
decile, and these three bands have it. They should be re-derived as counts, or
against the field size they were drawn from — not satisfied by suppressing the
top of the market, which is where they currently point.

The shortfall is entirely at the non-major end: majors are inside their band, so
the missing ~50 wide releases a year are the ones a real market gets from the
many distributors this model compresses into four Mid-Size and four Indie
studios. A fourth widening is not the lever; a wider **roster** might be.

`breakevenPct` 11.8 against 14–35 is the standing "thin middle" finding,
unchanged.

---

## 10. Widening the roster

§9.8 ended by saying the next lever was not another widening but a wider
**roster**: majors were inside their 8–20 band, the market still ran ~60 wide
releases a year against a real ~110, and the missing ones came from distributors
that did not exist because the field was four studios per tier.

### 10.1 The roster is not flat, because the real one isn't

`docs/domain/01-industry-structure.md` §2 gives two of the three numbers
outright:

- **Five majors**, named exactly — Disney, Warner Bros., Universal, Paramount,
  Sony. The least arbitrary number in the document, so the Major tier is five.
- **Eight specialty / independent distributors**, also named exactly — A24,
  Neon, Focus, Searchlight, Bleecker Street, IFC, Magnolia, Sony Pictures
  Classics. So the Indie tier is eight.
- **Mid-Size is a judgement call and is flagged as one.** §2's mini-major list
  (Lionsgate, Amazon MGM, Apple) is three examples under a category heading
  rather than a census, and two of the three are streamers with "selective
  theatrical" — not what this tier models. It models a self-distributing
  distributor below major scale, and a theatrical market has more than three
  once the specialty labels that routinely open wide are counted. **Six.**

**8 Indie / 6 Mid-Size / 5 Major — nineteen studios**, up from twelve.

### 10.2 Two harness divisors were hard-coded to four

`widePerMajorPerYear`, `specialtyFilmsPerYear` and `majorShareOfGrossPct` all
divided by a literal `4`. They now read the count off the generated roster.
Left alone, the widening would have reported a major releasing 25% more wide
films than it does and a specialty label **twice** as many — the roster change
would have "passed" two gates by arithmetic.

### 10.3 Adding studios does not by itself add films

The first measurement after the roster change was the instructive one. Total
wide releases went 59.7 → 68.8, but **wide releases per major fell 9.9 → 7.4**,
straight through the floor of the band §9 had just brought it inside. Three
things were throttling the bigger field, each found by measuring rather than
guessing:

**Script supply had not moved.** The Opportunity Market generated 3–6 titles a
week — a figure last set when the AI roster arrived. Nineteen studios draw on it
where twelve did, so it scales with them: **[5, 9]**, the same +58% as the
roster. Unclaimed titles went 13 → 22 and majors recovered to 9.0 films a year;
the Indie tier did not move at all, which ruled supply out as *its* constraint
and was worth knowing.

**The spawn cadence rested on a dead premise.** Its own comment justified the
tier gap with "an Indie's *single film* takes a while to turn around" — true
when an Indie ran one production at a time, and false since §9 raised its
ceiling to six and Mid-Size's to eighteen. Both tiers sat at their ceilings only
4–6% of the time with scripts going spare: limited by nothing but how rarely
they looked. Indie 20–40 → **14–28** days, Mid-Size 15–30 → **12–24**.

**§9 raised two ceilings without raising the capital behind them** — the pairing
every previous capital bump in this file exists to make. An Indie's median cash
had drained to $22M and a Mid-Size's to $88M, so the affordability gate was
throttling exactly the tiers whose concurrency had just been raised. Indie
$110M → **$220M**, Mid-Size $700M → **$1.0B**.

Major's $2.2B is deliberately **not** raised. It is not a headroom figure at
all — it is the capital the reference slate itself deploys in a year
(`docs/domain/11` §5.4) — and that anchor is worth more than the films
loosening it would buy.

Mid-Size is also not scaled by its full ceiling ratio, which would have been
$1.4B. Cash is meant to be headroom rather than throughput, but it leaks into
throughput through `scriptBudget` (a fraction of current cash), and at $1.4B a
Mid-Size sat on a $734M median against a Major's $95M and made **more films
than a Major** — backwards, and it would have out-bid majors for every script.

### 10.4 What it did

| | §8 | §9 | **§10** |
|---|--:|--:|--:|
| Studios | 12 | 12 | **19** |
| Wide releases a year, whole market | ~46 | 59.7 | **82.5** |
| Wide per major | 5.0 | 9.9 | **9.4** |
| Films per specialty label | 3.6 | 5.1 | **5.1** |
| A major's share of industry gross | 21.4% | 22.1% | **16.8%** |
| Ratified aggregate gates | 13/17 | 14/21 | **17/21** |

**17 of 21, the best this calibration has been**, with the density constant
landing exactly on its target (measured pressure 0.334 against a calibrated
0.334) rather than near it.

Four gates came good with the wider field and no tuning aimed at them:
`wideOver100Pct` (65.6 → **59.7**), `majorPct` (14.6 → **13.7**), `lossPct` and
`wideUnprofitablePct`. A market with more distributors in it genuinely does
spread its outcomes better — the same effect §4 recorded at the first widening,
and the third time this has been the thing that moved a stuck band.

`majorShareOfGrossPct` fell from 22.1% to 16.8% purely because five majors split
the market where four did. Still comfortably inside 10–25%.

### 10.5 Still open

`wideOver500Pct` 14.7 against 6–12 and `wideOver1000Pct` 4.9 against 1–3 are the
two remaining members of §9.8's finding, and the widening has now made the case
plainer rather than fixed it — their implied counts are **inside** the real
range and moved further in:

| band | measured | implied films/yr | real |
|---|--:|--:|--:|
| > $500M | 14.7% | 12.1 | 10–15 |
| > $1B | 4.9% | 4.0 | 2–5 |

The field is 82.5 wide releases a year against a real ~110. These two bands
should be re-derived as counts, or against the field they were drawn from; they
should not be satisfied by suppressing the top of the market, which is where
they currently point. `wideOver100Pct` passing at 59.7 while the field is still
short is the same story from the other side.

`breakevenPct` 11.1 against 14–35 is the standing "thin middle" finding, and is
now the only failing band that is a genuine statement about the model.

`limitedOpeningMultiple` 12.1 against a ceiling of 12 has been within a tenth of
its boundary for three passes and is noise.
