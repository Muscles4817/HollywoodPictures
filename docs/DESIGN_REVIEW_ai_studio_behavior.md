# Design Review: AI Rival Studio Behaviour — Frequency, Film Kinds, and Talent

Status: **Investigation** (empirical characterisation of existing behaviour —
no rules changed). Accompanies the roster change that doubled the AI field to
twelve studios and rebased their names on real studios (see DESIGN.md 5.24).

---

## TL;DR

The AI studios already behave like the tiers they belong to, and the numbers
below confirm it holds up empirically, not just in the constants:

- **Frequency scales cleanly with tier.** A Major starts films ~3.6× as often
  as an Indie (**8.7 vs 2.4 productions per studio per year**), a Mid-Size
  sits in between (**6.4/yr**).
- **Each tier has a recognisable slate.** Indies make Drama-led adult films,
  Mid-Sizes live on Horror/Thriller genre fare, Majors make Fantasy/Sci-Fi/
  Action tentpoles. Almost no genre overlap between the top and bottom tier.
- **Scale is effectively tier-locked.** Indies make **100% Small** films,
  Mid-Sizes **~99% Medium**, and only Majors make **Big** films (**~22%** of
  their slate).
- **Talent tracks money, and money tracks tier.** A Major's average lead actor
  is famous (**fame ~74**) and its talent bill averages **~£22M**; an Indie
  casts near-unknowns (**fame ~31**) for **~£1.1M**.
- **One genuinely emergent, non-obvious result:** a **Major's scripts are on
  average *lower*-craft than an Indie's** (66 vs 72). The tiers value scripts
  differently at bid time — Indies chase craft/originality, Majors chase
  blockbuster genre-fit and can outspend everyone regardless of script quality.

---

## Method

`src/engine/rivalStudios.diagnostic.test.ts` drives the **real** settlement
loop headlessly — the same three functions
`state/studioReducer.ts:runCalendarSettlement` runs every day, in the same
order:

1. `engine/marketSettlement.ts:settleTheatricalMarket` — settles box office and
   credits each rival its own revenue (so cash, which gates production, evolves
   for real).
2. `engine/opportunities.ts:settleOpportunities` — generates/expires the shared
   Opportunity pool and resolves bids weekly.
3. `engine/rivalStudios.ts:settleRivalMarket` — turns won bids into productions
   and lets spawn-checking studios place new bids.

It advances **day by day over 6 in-game years across 16 seeds** (seeds
1000–1015), and every time a new `RivalProductionInProgress` appears it records
the studio's tier, the film's genre and scale, and the cast/crew that was hired
(fame, summed talent cost via the same `computeTalentCost` the affordability
check uses, and the script's craft average). The harness is opt-in and skipped
in the normal suite; reproduce with:

```
RIVAL_DIAGNOSTIC=1 npx vitest run src/engine/rivalStudios.diagnostic.test.ts
```

One deliberate approximation: finished box-office runs are dropped from the
re-fed film list (they never settle again), which keeps the 6-year sweep fast
and does not affect any production/genre/talent statistic.

> All figures below are the aggregate of 16 seeds × 6 years. Because the tier
> roster is now 4 / 4 / 4, per-studio-per-year rates divide the tier total by
> `16 seeds × 4 studios × 6 years`.

---

## 1. Production frequency

| Tier | Productions / studio / year | Driver |
|---|---|---|
| Indie | **2.38** | one Small at a time; 20–40-day spawn checks |
| Mid-Size | **6.35** | up to 3 Medium *or* 1 Big; 15–30-day checks |
| Major | **8.67** | up to 2 Big **and** 4 Medium at once; 10–20-day checks |

Two independent constants compound to produce the spread, exactly as designed:

- **Spawn cadence** (`SPAWN_CHECK_INTERVAL_DAYS`) — Majors check most often,
  Indies least.
- **Concurrent capacity** (`startableScales`) — an Indie is capped at a single
  Small production, so even frequent checks can't raise its throughput; a Major
  runs two independent lanes (Big + Medium) simultaneously.

An Indie's throughput is capacity-bound (it usually has nothing startable), so
its rate is the most stable of the three. Majors and Mid-Sizes are more
bid-bound — they can afford and staff more than the Opportunity pool always
offers a good fit for, so their rate reflects how often a suitable script shows
up as much as their own cadence.

## 2. What kinds of films each tier makes

### Genre mix (share of a tier's own productions)

| Tier | Top genres |
|---|---|
| **Indie** | Drama **47%**, Romance **19%**, Horror **14%**, Thriller **14%**, Comedy 5% — essentially **no** Action / Sci-Fi / Fantasy |
| **Mid-Size** | Horror **32%**, Thriller **29%**, Comedy **15%**, Drama 8%, Action 7%, Romance 7% |
| **Major** | Fantasy **36%**, Sci-Fi **30%**, Action **23%**, Comedy 6%, Thriller 3% — essentially **no** Drama / Horror / Romance |

This is `GENRE_TIER_BIAS` (in `evaluateOpportunityForTier`) expressing itself.
Indies get a strong positive bias toward Drama/Horror/Thriller and a heavy
negative bias against Fantasy/Sci-Fi/Action; Majors are the mirror image. The
effect is even sharper than the raw biases suggest because a Major planning a
Big film applies its genre bias a **second time** (`+ genreBias * 0.50`),
concentrating tentpoles into spectacle genres. Mid-Sizes sit in the middle and
end up as the genre generalists — the only tier that makes a meaningful amount
of Horror **and** Comedy **and** Action.

### Scale mix

| Tier | Small | Medium | Big |
|---|---|---|---|
| Indie | **100%** | 0% | 0% |
| Mid-Size | 0% | **99%** | 1% |
| Major | 0% | **78%** | **22%** |

Scale is set purely by `startableScales`: Indies can only ever start Small,
Mid-Sizes only reach Big when they have *nothing* else running (rare), and only
Majors sustain a steady Big cadence. Note the Big slice for a Major is a
minority even for them — Big productions tie up a lane for a long time, so
Mediums naturally fill most slots.

## 3. What talent each tier hires

Averages per production:

| Tier | Lead actor fame | Director fame | Avg cast+crew fame | Talent spend | Script craft |
|---|---|---|---|---|---|
| Indie | 31.3 | 33.2 | 26.2 | **£1.13M** | 71.9 |
| Mid-Size | 56.9 | 54.9 | 40.7 | **£5.67M** | 71.4 |
| Major | 73.6 | 70.8 | 52.1 | **£22.1M** | 66.3 |

Talent hiring is driven by the target price band a production casts against —
`SCALE_SPEND_RANGE` (Small 0.08–0.32 / Medium 0.32–0.65 / Big 0.65–0.98 on a
log scale) plus tier adjustments in `deriveRivalSpendPlan` (Indies −0.06 to
base but concentrate what they have into talent; Majors +0.08 base and an extra
talent bonus). Because fame rises with salary on average in `generateTalent`, a
higher price band buys a more famous cast — so the fame ladder (31 → 57 → 74 for
leads) is really the spend ladder (£1.1M → £5.7M → £22M) seen from the cast
side. Every tier hires the same *seven mandatory roles*; only the price point
differs.

### The counter-intuitive finding: Majors don't buy better scripts

Average **script craft** runs Indie **71.9** > Mid-Size **71.4** > Major
**66.3** — the inverse of the money ladder. This is not a bug; it falls out of
`evaluateOpportunityForTier` weighting the tiers differently at bid time:

- **Indie** weights craft **0.50** and originality **0.30** — it wins the
  scripts it wins by *quality*, because it can't win them on money.
- **Major** weights craft **0.40**, originality only **0.10**, and leans on
  genre-fit and raw affordability — it takes the blockbuster-genre script and
  overpowers the field with spend, whether or not it's the best-written one.

So the tiers end up with a believable division of labour: the small studio's
edge is the *screenplay*, the major's edge is the *spectacle and the chequebook*.

---

## Implications for the doubled roster

Doubling to 4 / 4 / 4 preserves all of the above — the behaviours are per-tier,
not per-studio, so a bigger field just means more of each archetype competing.
Two things worth keeping an eye on now that the field is larger:

- **Opportunity-pool contention.** Twelve studios bidding (four of them Majors
  with deep cash) means good blockbuster-genre scripts get contested harder.
  This is desirable pressure, but if the pool's generation rate ever feels thin
  for the player, this is the first place it would show. The diagnostic is the
  tool to re-measure it.
- **Talent-pool headroom.** Majors book famous, expensive talent for long
  windows. The existing 500-day pool-headroom check (DESIGN.md 5.24) still held
  under this heavier 6-year, 16-seed sweep — no mandatory role ran dry — but
  the diagnostic is the place to re-verify if the roster grows again.

No rule changes are recommended from this investigation; it characterises
behaviour the doubled roster inherits unchanged.

---

## Reality check: model vs. real Hollywood

How well do the game's tier assumptions match the real industry they're
modelling? Short answer: **the directions are strongly right, the top-end
scale is compressed.** Every qualitative claim the tiers make — majors do
spectacle, mid-tiers do horror, indies do prestige drama, fame tracks spend,
and craft runs *opposite* to budget — is visible in real-world data. The
gaps are all calibration (absolute budget ceiling, exact frequencies), not
direction.

> A scale note first: the game runs in compressed nominal figures. Its total
> production commitment averages ~£1.5M / ~£8M / ~£70M for Small / Medium /
> Big (see `rivalStudios.ts:STARTING_CASH_BY_TIER` comment). Real modern
> budgets run higher, especially at the top, so comparisons below focus on
> **orderings, ratios, and genre/craft direction** rather than pound-for-dollar.

### Production frequency

| Tier | Game (films/studio/yr) | Real-world wide-release output | Read |
|---|---|---|---|
| Indie | 2.4 | Boutique producer ~1–5/yr; a *distributor* like A24 puts out ~18–20/yr | Game models a boutique **producer**, not a mega-indie distributor — reasonable for one small shingle |
| Mid-Size | 6.4 | Blumhouse ~4–8 wide/yr; Lionsgate ~10–15 wide/yr | In range, slightly low vs. a busy mini-major |
| Major | 8.7 | Disney ~10–15/yr, Warner Bros. targeting 12–14, Universal ~20 (incl. Focus) | Right order of magnitude, a touch low |

**Real insight the model gets right:** modern majors deliberately release
*few* films at high budget (10–20/yr), not dozens. The one inversion worth
noting: a large indie *distributor* (A24 ~18–20) actually out-releases a
game "Major" — because the game's tiers describe *production scale*, not
*distribution volume*. A boutique that finances a couple of its own films a
year is the right mental model for the game's Indie.

### Genre mix

| Tier | Game leans | Real-world | Match |
|---|---|---|---|
| Major | Fantasy 36% / Sci-Fi 30% / Action 23% | 50–70% of the six majors' 2025 slates are existing IP; franchise/IP drove **73%** of 2025 domestic box office — overwhelmingly superhero/action/sci-fi/fantasy | ✅ Strong |
| Mid-Size | Horror 32% / Thriller 29% | Blumhouse's whole identity is sub-$5M horror; horror/thriller is the mid-tier's signature profit engine | ✅ Strong |
| Indie | Drama 47% + Romance/Thriller | A24 built its brand on character drama (*Moonlight*, *Lady Bird*) **and elevated horror** (*Hereditary*, *Midsommar*) | ✅ Direction right, ⚠️ see below |

**One real calibration gap:** in reality, horror is *the* low-budget
breakout genre, so genuine indies lean on it heavily — it's how boutiques
turn a profit. The game routes most horror to Mid-Size and gives Indie only
~14%. Nudging the Indie `GENRE_TIER_BIAS` toward Horror would track reality
more closely (`Horror` is already indie-friendly per `GENRE_PROFILES`
`lowBudgetFriendly: 0.9`, so the game's *own* economics already agree — it's
only the AI's genre preference that under-uses it).

### Scale / budget

| Tier | Game total commitment | Real production budget | Read |
|---|---|---|---|
| Small/Indie | ~£1.5M | Indie $0.25–2M; Blumhouse caps ~$5M | ✅ Spot on |
| Medium | ~£8M | Mid-budget up to ~$40M | ⚠️ Game "Medium" sits at the *low* end of real mid-budget |
| Big | ~£70M | Tentpole $65M–$300M+ (before marketing) | ⚠️ Compressed ~2–4× — the game's ceiling is a lower-end studio film, not a $250M tentpole |

The **bottom** of the ladder is realistic; the **top** is compressed. That's
a deliberate-feeling design choice (keeps player and rival cash legible), not
a mistake — but it does mean the game's "blockbuster" is priced like a real
mid-major release.

### Talent

| Signal | Game | Real-world | Read |
|---|---|---|---|
| Star pay ceiling | Actor salary max £15M | A-list upfront ~$20–30M single film (Denzel/Diesel/Hardy ~$20M); top earners $50M+ with backend | ⚠️ Ceiling just below the real A-list peak |
| Talent as share of budget | Major ~£22M talent of ~£70M total ≈ **31%** | Above-the-line ~25–35%; principal cast 10–25% | ✅ In range |
| Fame tracks spend | fame 31 → 57 → 74 as spend £1.1M → £5.7M → £22M | Indies cast emerging talent at SAG minimums; majors pay for bankable stars | ✅ Strong |

The fame-follows-money ladder is exactly the real dynamic: an indie casts
unknowns near scale minimum, a major pays up for a name that opens a film.
The only stretch is the individual star ceiling (£15M) landing a little under
what a real A-lister commands up front.

### The craft-vs-spend inversion — validated

The diagnostic's most counter-intuitive result — **indie scripts average
higher craft (72) than major scripts (66)**, the inverse of the money ladder
— is one of the *best*-supported assumptions against reality:

- A24 (indie) has won **Best Picture and Best Original/Adapted Screenplay**
  with *Moonlight* and *Everything Everywhere All at Once* (the latter took 7
  Oscars), on budgets a fraction of a tentpole's.
- Franchise/tentpole films — the majors' bread and butter — very rarely win
  screenplay awards and score lower critically on average, despite the
  biggest budgets in the business.

Real prestige flows to the small, writing-driven film; real spectacle and box
office flow to the tentpole. The game reproduces exactly that split, and for
the same structural reason: at bid time indies compete on script craft
because they can't compete on money, while majors take the blockbuster-genre
script and win on spend.

### Verdict

| Assumption | Directional realism |
|---|---|
| Frequency ordering (Major > Mid > Indie by studio) | ✅ Matches |
| Majors = spectacle genres | ✅ Strong |
| Mid-tier = horror/thriller | ✅ Strong |
| Indie = prestige drama | ✅ Strong (⚠️ under-weights indie horror) |
| Budget ladder shape | ✅ Realistic at bottom, ⚠️ compressed at top |
| Fame tracks spend | ✅ Strong |
| Craft inverse to budget | ✅ Strongly validated |

**Optional tuning ideas** (none required, and none in this PR): raise the Big
target-price band / star ceiling to widen the top of the budget ladder toward
real tentpole scale; shift a slice of the Indie genre bias from Drama toward
Horror to match how real boutiques actually make their money.

### Sources

- [Warner Bros. targeting 12–14 theatrical releases annually — Deadline](https://deadline.com/2025/08/warner-bros-discovery-theatrical-releases-key-labels-1236481064/)
- [Disney tops 2025 studio rankings (release/box-office context) — Screen Daily](https://www.screendaily.com/news/disney-tops-2025-studio-rankings-with-658bn-global-box-office-take-warner-and-universal-follow/5212392.article)
- [A24 — Wikipedia](https://en.wikipedia.org/wiki/A24) and [List of A24 films](https://en.wikipedia.org/wiki/List_of_A24_films)
- [Lionsgate Films — Wikipedia](https://en.wikipedia.org/wiki/Lionsgate_Films)
- [Hollywood's franchise frenzy: >50% of 2025 studio movies are existing IP — CNBC](https://www.cnbc.com/2024/10/06/box-office-2025-movies-existing-intellectual-property.html)
- [Blumhouse Productions (sub-$5M horror model) — Wikipedia](https://en.wikipedia.org/wiki/Blumhouse_Productions)
- [Average movie budget by tier — Celtx](https://blog.celtx.com/average-movie-budget/)
- [Above-the-line & cast cost share of budget — Filmustage](https://filmustage.com/blog/budgeting-for-talent-how-to-plan-for-cast-and-crew-costs/)
- [Highest-paid actors 2023/2024 (per-film salaries) — Forbes](https://www.forbes.com/sites/mattcraig/2025/02/28/the-highest-paid-actors-of-2024/)
- [A24 Oscar wins (Moonlight, Everything Everywhere All at Once) — Variety](https://variety.com/lists/best-a24-movies-ranked/)
