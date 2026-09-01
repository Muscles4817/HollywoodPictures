# Design review — what a big production buys, and films that actually contend

Companion to `DESIGN_REVIEW_reception_model.md` (which fixed how films are
*scored*) and `DESIGN_box_office_calibration_targets.md` (which ratifies what
the market should look like). This one is about two structural gaps in the
box-office model itself, both measured before anything was changed.

Everything below is measured over the same sweep — **six seeds × eight in-game
years**, the rival market driven end to end, ~650–700 wide releases — unless
stated otherwise. Reproduce with the harnesses in §6.

---

## 1. The two gaps

### 1.1 Money could not buy an audience

A film's audience ceiling was built from its genre, its target audience, its
marketability and its script, and **not at all from how big a production it
was**. Measured:

| all-in cost | n | median on screen | median TAA | median maxInterested | penetration | median gross | median return |
|---|--:|--:|--:|--:|--:|--:|--:|
| small <$25M | 304 | $1.2M | 82.5M | 21.0M | 0.080 | $17M | 0.99× |
| mid $25–80M | 227 | $10.2M | 112.5M | 41.3M | 0.489 | $192M | 1.65× |
| big >$80M | 130 | $38.4M | 122.8M | **44.0M** | **0.715** | $299M | **0.88×** |

A tentpole got a **6% larger room for three times the money**, and was already
71% of the way through it. There was nowhere for the extra spend to go. That is
the whole of the "every big film fails to make much money and all the
mid-budget ones make bucket loads" pathology: costs scale with the budget, the
audience ceiling did not, and no film over $80M ever became a blockbuster.

It is also unrealistic in a specific, nameable way. A $200M production is an
**event**, and events are attended by people who would never turn out for the
genre. Avatar's audience is not science-fiction fans. That is not marketing —
marketing buys awareness of a pool, never the pool itself — it is what is on
the screen.

### 1.2 Competition did not bind

The model has two competition channels and both were live, but the *strength*
they were fed made them inert:

- mean `competitivePressure` across 4,649 settled weeks: **0.056**
- median: 0.022 → an attention factor of **0.988**
- correlation between a film's budget and the pressure it actually felt: **−0.09**

Everyone was pushed around exactly as hard as everyone else, which is to say
not at all.

The cause was a units mismatch. `UpcomingRelease.strength` is compared directly
between films inside `matchupWeight`, so all three ways of constructing it must
answer the same question. Two of them (`computeRivalReleaseStrength`,
`computePlayerReleaseStrength`) are log-scaled *presence* figures — "how big a
noise will this make." The third, for a film already running, was its recent
admissions divided by **its own maximum interested audience** — a *saturation*
figure, "how well is this doing for its size." A $9M indie playing to its whole
small crowd therefore out-crowded a live tentpole, and a scheduled mid-budget
release exerted more pull than a blockbuster in its second weekend.

---

## 2. What changed

### 2.1 Event scale (`audienceSimulationInputs.ts`)

`computeEventScale(productionBudgetCost, scriptSpectacle)`, fixed at release:

- the driver is `computeProductionBudgetCost` — set quality + practical effects
  + VFX, **the money the audience can see** — never the all-in cost, which is
  mostly salaries. A $130M star vehicle is not an event; a $130M creature
  feature is.
- gated on the script's own spectacle intent, the same "was the intent
  realised" shape `scoring.ts:postRealisationFactor` uses. A spectacle script
  shot for nothing is a B-movie; a chamber drama shot for a fortune is an
  expensive chamber drama.
- deliberately the **raw** choice-driven figure, not the producer-adjusted one
  that gets charged: a producer who brings the same spectacle in cheaper has
  changed the bill, not the screen.

It feeds two lifts, both convex so the ordinary film does not move (at the
measured medians eventScale is 0.02 / 0.38 / 0.60 by tier):

- **eligibility** (`totalAddressableAudience`) — the smaller lift, and
  unconditional. It applies to a terrible tentpole exactly as much as a great
  one, so it buys a big opening and nothing else. That asymmetry is the point:
  a bad event film now opens huge against a huge budget and collapses, which is
  what a real bomb looks like.
- **crossover capacity** — the larger lift, and the discriminating one.
  Capacity is only ever a ceiling; the crossover step still requires real word
  of mouth to realise any of it. A badly-received tentpole gets a bigger empty
  room.

Reception-independent by construction, which is what distinguishes it from the
reverted crossover-capacity-on-reception experiment (PR #187): that one fed the
word-of-mouth loop back into its own ceiling and ran away. This one is fixed at
release from money already spent.

### 2.2 One strength scale (`releaseCrowding.ts`)

`computeMarketPresence` — a running film's absolute recency-weighted
admissions, log-scaled against the market, on the same 0–1 presence scale the
two pre-release proxies use. Range calibrated against measured in-run activity
(median 0.48M / 5.7M / 15.5M by tier, p99 84M, observed max 123M), putting
those medians at 0.09 / 0.56 / 0.74.

The film's own self-normalised saturation figure still exists and still drives
its own word of mouth (`computeRunningFilmStrength`) — that one genuinely is
about a film's own crowd and must not become market-relative.

`COMPETITIVE_PRESSURE_WEIGHT` 0.05 → 0.08 alongside it: with strengths that
finally mean something, the exhibition channel can carry a real share of the
redistribution without saturating its clamp.

### 2.3 Word-of-mouth awareness growth (step 4) re-enabled

Previously commented out on the suspicion that it was responsible for "almost
never any bombs." Measured against the current reception model it is not: the
wide-release outcome mix moves by less than a point in either direction, and
the runaway guard does not trip (62/62). WOM awareness only converts
unaware → aware inside a fixed addressable audience, so it cannot run away on
its own; it was the crossover *ceiling* that used to. Keeping it off cost
realism for nothing.

---

## 3. What it did

| | master | after |
|---|--:|--:|
| big >$80M median return | 0.86× | **1.15×** |
| big >$80M unprofitable | 48% | **33%** |
| big >$80M profitable | 40% | **58%** |
| mid $25–80M median return | 1.74× | 1.87× |
| mid ÷ big return ratio | **2.02×** | **1.63×** |
| mean competitive pressure | 0.056 | **0.186** |
| p90 attention factor | 0.92 | **0.75** |
| ratified gates passing | 11/17 | **13/17** |

Two gates that had never passed now do: `wideMeanGrossM` (169 → 202, band
170–230) and `wideOver1000Pct` (0.2 → 1.7, band 1–2). The second is the more
significant: the model's hard arithmetic ceiling had been measured at $1.286B
against a ratified $1–2.5B phenomenon band, so **billion-dollar films were
structurally impossible**. They exist now, and at the ratified frequency.

---

## 4. A negative result: the crossover-normalisation pass

`RECEPTION_PIVOT`'s own note defers top-10 concentration to "the crossover
*capacity ceiling* and its coupling to the WOM normalization denominator
(`maxInterestedAudience`), a separate entanglement left to a dedicated
crossover-normalization pass." That pass was attempted here and **reverted**.

The reasoning for it was sound. Word-of-mouth influence divided admissions by
`maxInterestedAudience` — the natural audience *plus* the whole crossover
ceiling — so a film with large crossover capacity generated less word of mouth
per ticket than an identical film with no room to grow. Raising any film's
capacity partly cancelled itself. Normalising against the natural audience
alone also reads better: crossover *is* the buzz escaping the core crowd, so
the core crowd is the right measure of loud.

It works mechanically. With the response sensitivities re-picked against the
new denominator (÷2.6 to ÷2.8 — the curve is quadratic, so the neutral
recalibration divides by k², not k) the full 62-test regression matrix passes.

It is wrong for the goal. Because `thresholdResponse` is quadratic *with a
threshold*, the films that gain most are the ones previously sitting just below
it — the small ones. Measured: small-film median gross $19M → $25–35M, median
return 0.94× → 1.35–1.52×, **70% of all wide releases profitable, bombs at 3%**,
and top-10 share moved the wrong way (35.9 → 32.6). The change democratises the
market rather than concentrating it, which is the opposite of what the
entanglement note wanted it for.

Recorded here so the idea is not re-derived a third time. If it is revisited,
the missing piece is a response shape whose *threshold* does not move relative
to the denominator.

---

## 4b. The cost side: P&A, and the P&L nobody was measuring

Prompted by "just compare a mid-budget film's costs to a real one." Two findings,
the second much larger than the first.

### 4b.1 Marketing was too low, and scaled backwards

Measured medians, tiered by NEGATIVE cost (production only - what "a $40M film"
means everywhere in the industry):

| tier | negative | on screen | P&A | **P&A ÷ negative** |
|---|--:|--:|--:|--:|
| small | $8.5M | $1.1M (13%) | $0.8M | **0.10** |
| mid | $28.4M | $9.6M (34%) | $12.6M | **0.44** |
| big | $82.8M | $38.4M (46%) | $54.0M | **0.65** |

The negative's internal split is fine - 34% on screen and 43% on cast and crew
is close to a real below-the-line/above-the-line breakdown. P&A was not.
`docs/domain/09-marketing-and-distribution.md` §1 gives US-domestic bands of
$15-30M for a wide independent, $30-60M for a studio mid-budget wide and
$100-200M+ global for a tentpole, with a greenlight rule of thumb of **0.8x
negative cost** and a tentpole's global marketing "often approximating the
negative cost". So the real ratio is roughly FLAT; the model's climbed with
budget, and was 2-20x low at every tier. **47% of Wide releases were marketed
for under $5M and a quarter for under $1M**, which is not a wide release.

§1.3 is explicit that the floor is *structural, not strategic*: national reach to
~85-90% awareness, a full asset package, and an exhibitor circuit that "quietly
notices" when its 3,500 locations are not advertised. None of it scales down with
how cheap the film was.

So `MINIMUM_CAMPAIGN_SPEND` (`data/release.ts`): a Wide release is raised to a
real campaign whatever the studio would rather spend, and - having been made to
buy it - gets what it bought, the chosen channel mix scaled up rather than a
cost with no reach behind it. Limited and Festival First have no floor, because
platforming on very little is precisely what a film too cheap to open wide
should do instead.

It works. P&A/negative lands at 1.39 / 0.71 / 0.66, all three inside the bands
the domain doc supports, and the tier return spread - the whole "mid-budget
films print money while tentpoles die" complaint, as one number - falls to
**1.47x**, inside its target.

### 4b.2 Every profitability target was asserted against half the P&L

`FilmResults.profit` is `studioRevenue - totalCost`, and `studioRevenue` is
**theatrical rentals only**. But the game also pays post-theatrical revenue:
`state/ancillarySettlement.ts` schedules it to the player over game time and
credits it to rivals as a lump. It is live, not staged - the "Stage 1 / INERT"
header on `engine/ancillary.ts` is stale, and `DESIGN_REVIEW_studio_financial_model.md`
records stages 1-6 as landed.

Measured, post-theatrical revenue is **110% of theatrical rentals** across the
field (79% for a small film, 100% for a tentpole) - which is not itself
implausible; home entertainment plus TV/streaming plus merchandising genuinely
is comparable to theatrical rentals for a modern studio film.

The consequence is that every band in
`boxOfficeDistribution.diagnostic.test.ts` - `wideUnprofitablePct`, `bombPct`,
`lossPct`, all of §5 - has been asserted against roughly half the revenue a film
actually earns, and every calibration pass that chased those targets was tuning
the wrong number. On the whole P&L the market is about twice as profitable as
the targets intend:

| tier | return (theatrical only) | return (whole P&L) | unprofitable (whole P&L) |
|---|--:|--:|--:|
| small | 2.02x | **3.31x** | 13% |
| mid | 1.51x | **2.92x** | 14% |
| big | 1.03x | **2.25x** | 25% |

against a ratified 45-55% unprofitable.

This also explains the P&A finding rather than merely accompanying it. The
model's compressed P&A was an unwitting compensation for a revenue stream the
gates could not see: with theatrical-only accounting, realistic marketing costs
make every film a loser, so marketing quietly shrank until the numbers worked.
The revenue was there the whole time; only the measurement was missing.

`boxOfficeByBudgetTier.diagnostic.test.ts` now reports both P&Ls side by side,
every run, so the two cannot drift apart again.

**What this does not do is fix it.** The aggregate targets in
`DESIGN_box_office_calibration_targets.md` §5 need re-deriving against the whole
P&L before anything is tuned to them, and that is a ratification decision, not
an implementation one. Until then the aggregate harness's profitability bands
should be read as measuring theatrical performance, not profitability.

---

## 5. What is still wrong

Four gates still fail, and they are honest failures rather than near-misses:

- **`top10SharePct` 35.0, band 40–50.** The market is not concentrated enough.
  Established by measurement: this metric is invariant to every *level* lever
  tried (base interest ceiling, event gain, competition weight all move the
  whole distribution and leave the share alone). It needs genuine dispersion —
  the top pulling away from the field — not more or less of anything.
- **`wideOver500Pct` 11.5, band 5–8.** Too much mass in the $100–500M band; the
  same finding from the other side.
- **`lossPct` 42.7, band 25–35** against `wideUnprofitablePct` 45.3 (in band).
  These point in opposite directions, which locates the problem: the *limited*
  and small end loses too often while the wide end is now about right.
- **`limitedOpeningMultiple` 13.8, band 5–12.** Measures the 20-week
  `MAX_SIMULATION_WEEKS` cap rather than behaviour — a harness artefact, not a
  model finding.

A candidate root for the first two, not yet investigated: the cost model, not
the audience model. A mid-budget film's median all-in cost is $41M against
$10.8M actually on screen, so roughly three quarters of its budget buys nothing
the audience can see — while its audience ceiling sits at 80% of a tentpole's.
The audience curve may now be defensible and the **cost** curve too shallow.

---

## 6. Reproducing

```bash
BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeDistribution.diagnostic.test.ts --disable-console-intercept
BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeByBudgetTier.diagnostic.test.ts --disable-console-intercept
npx vitest run src/engine/audienceSimulationRegressionMatrix.test.ts   # the runaway guard
npx vitest run src/engine/eventScaleAndCompetition.test.ts             # the contracts this pass added
```
