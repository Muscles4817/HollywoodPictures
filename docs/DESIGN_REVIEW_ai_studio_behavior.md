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
