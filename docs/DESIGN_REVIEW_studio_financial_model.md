# Design Review — Studio Financial Model: ancillary revenue & backend participation

**Status:** Design for build. Two interconnected systems that turn a film from a
one-shot theatrical bet into a multi-year revenue asset, and give stars genuine
financial leverage. No engine changes made yet — this is the design.

The brief: *very large films look like financial disasters even when they gross
$700M–1B, because the model only really earns from theatrical exhibition.* The
fix is not "add more revenue" — it is to model the two things real studios
actually live on that the sim is missing, in a way that **fixes blockbuster
economics, makes genres feel different, gives stars leverage, and stays
readable.**

---

## 0. The problem, in the model's own numbers

Theatrical settlement today (`engine/boxOfficeRun.ts:167-223`,
`engine/distribution.ts:357-359`):

```
studioRevenue ≈ worldwide gross × 0.42      (domestic 0.46 / international 0.38 keep, blended)
profit        = studioRevenue − totalCost   (totalCost = production + marketing)
```

That single equation is the whole business right now. Run three archetypes
through it:

| Film | WW gross | Rentals (0.42×) | Prod + Mktg | **Theatrical profit** |
|---|--:|--:|--:|--:|
| Superhero tentpole | $750M | $315M | $200M + $150M | **−$35M** |
| Broad franchise hit | $1,000M | $420M | $220M + $150M | **+$50M** |
| Prestige drama | $60M | $25M | $25M + $20M | **−$20M** |

A film seen by ~70M people worldwide books a **loss**. This is correct
*theatrical* accounting and wrong *studio* accounting: in reality the $750M
tentpole is comfortably profitable once home entertainment, television,
streaming, and merchandising are counted — revenue that arrives **over the
following two to three years**, not opening weekend. The prestige drama likewise
earns most of its money downstream, slowly, from prestige — never from cinemas.

The model is missing the **second half of a film's life.** This design adds it,
plus the compensation structure (backend participation) that the second half
makes possible.

---

## 1. Design principles this inherits

From `docs/SIMULATION_PHILOSOPHY.md` and `CLAUDE.md`, non-negotiable:

- **Derive, don't store (Principle 8).** A film's ancillary *potential* is a pure
  function of attributes it already carries (genre, audience/critic score,
  franchise recognition, character merch potential, awards) — computed on demand,
  exactly as `deriveCommercialProfile` / `deriveMarketability` already do
  (`engine/commercialProfile.ts`). Only concrete *future cash events* are stored,
  and only because you cannot plan around a number that recomputes itself.
- **Qualitative presentation (`CLAUDE.md`).** Players read "strong merchandising
  potential," "limited home-video appeal," a term sheet, and named cash-ledger
  lines — never a raw multiplier. Dev inspectors and tests read the numbers.
- **Every outcome has a cause (Principle 4).** Ancillary income is explainable
  from the film's own attributes; a backend cheque is explainable from the deal
  the player signed. No flat bonuses.
- **Real trade-offs (Principle 6).** Backend is not a discount — it is a bet.
  Flat fee keeps the upside and risks the cash; points share the downside *and*
  the upside. A decision with no downside is not a decision.
- **Connect existing systems (Principle 7).** `merchandisePotential` (character
  trait, stored, currently inert), `IntellectualProperty.recognition`,
  `Studio.prestige`, `AwardsState.history`, the `ScheduledRelease` deferral
  pattern, and the `recordCashChange` ledger seam are all already here. This is
  mostly wiring.
- **Pre-launch (`CLAUDE.md`).** Bump `SAVE_KEY` (currently
  `hollywood-pictures-save-v74`, `state/persistence.ts:394`); no migrations.

---

## 2. System overview — two systems, one lifetime

```
                    ┌─────────────── a film's lifetime ───────────────┐
  greenlight ──▶ THEATRICAL RUN ──▶ HOME ENT ──▶ LICENSING ──▶ CATALOGUE (years)
      │           (weeks, exists)     (mo 4-9)   (mo 7-24)     (annual, decaying)
      │                                  └──────── ANCILLARY (System 1) ────────┘
      │
      └─ casting: BACKEND DEAL (System 2) ── star takes points instead of cash;
                                             paid out of every window above.
```

**System 1 — Ancillary revenue.** After theatrical, a film pays out across a
small number of **windows** that arrive over game time, each an attribute-driven
multiple of the film's theatrical reach. This is where blockbuster economics get
fixed and where genres diverge.

**System 2 — Backend participation.** At casting, a star may take a reduced fee
plus a share of the film's receipts. Lower cash now, shared upside later — paid
out of *all* the windows above, so a gross-points star rides the streaming tail
too. This is where stars get leverage and the player gets a real bet.

They interlock: ancillary is what makes a backend deal worth offering (there's a
long revenue tail to share), and backend is what makes ancillary a *decision*
(who gets a slice of it).

---

## 3. System 1 — Ancillary revenue

### 3.1 Abstraction: windows, not line-items

The brief lists eight possible categories (digital purchase, digital rental,
streaming, TV, physical, merch, airline/hotel, catalogue). Modelling eight line
items per film is spreadsheet overload for zero added decision. We collapse them
into **four windows**, chosen so each has a *distinct timing* and a *distinct
attribute signature* — i.e. each one is a different strategic shape, not a
different accounting bucket:

| Window | Folds in | Timing (after run ends) | Dominant drivers |
|---|---|---|---|
| **Home Entertainment & Digital** | physical disc, EST/download, VOD rental | months ~3–9 | rewatchability: genre, audience score, family, franchise |
| **Licensing** | pay-TV, streaming SVOD, free-TV, international TV | months ~7–24, two waves | broad watchability + prestige: accessibility, critic & audience score, awards, franchise, star fame |
| **Merchandising** | toys, apparel, games, tie-ins, theme-park/hotel/airline licensing | part at release, part with home-ent | **genre + character `merchandisePotential` + franchise** (the big differentiator) |
| **Catalogue** | long-tail library exploitation | annual, for years, decaying | classic status: awards, beloved audience score, holiday+family, franchise, cult |

Four windows is enough to make a superhero film and an Oscar drama earn money in
visibly different *shapes*, and few enough that the player reads a film's whole
afterlife at a glance.

### 3.2 The reach base

Every window scales off one signal: **how many people engaged with the film**,
proxied by worldwide theatrical gross `G` (`FilmResults.totalBoxOffice`), with a
word-of-mouth lift so that a film people *loved* over-indexes downstream relative
to its opening:

```
reachBase = G × (0.85 + 0.30 × audienceScore/100)     // 0.85×G … 1.15×G
```

A beloved sleeper (audience 90, modest gross) punches above its box office in
home video and streaming; a front-loaded, poorly-received tentpole under-indexes.
This is the "catches on later" effect, endogenous to a stat the film already
carries. `reachBase` is a derived internal quantity, never shown.

> Note it deliberately keys off *gross*, not studio rentals. Ancillary demand
> tracks the size of the audience, not the studio's cut of the ticket — the whole
> point is that a film with thin theatrical margins can still have a fat afterlife.

### 3.3 Window formulas

Each window pays `reachBase × baseRate × filmMultiplier`. Base rates
(`data/ancillary.ts`, tunable) set the *typical* film's take as a fraction of
its reach; the multiplier (∼0.3–2.2, merch wider) is where attributes bite. All
multiplier factors read fields that already exist.

Let `aud = audienceScore/100`, `crit = criticScore/100`,
`fr = franchiseRecognition/100`, `fame = leadStarFame/100`,
`merch = mean(lead characters' merchandisePotential)/100`,
`famTeen = 1 if targetAudience ∈ {Families, Teens} else 0`,
`access = commercialProfile.accessibility/100`,
`prestige = studio.prestige/100`, and `awardsLift` from §3.5.

**Home Entertainment & Digital** — `baseRate 0.10`
```
mult = GENRE_ANCILLARY[genre].homeEnt          // Action 1.4 … Drama 0.6
     × (0.7 + 0.6·aud)                          // people buy what they loved
     × (0.9 + 0.4·famTeen)                      // family rewatch / gifting
     × (0.9 + 0.3·fr)                            // franchise collectibility
clamp(mult, 0.3, 2.2)
```

**Licensing** — `baseRate 0.13`
```
mult = (0.5 + 0.7·access)                       // broadcasters pay for broad appeal
     × (0.75 + 0.5·aud)
     × (0.85 + 0.30·crit)                        // acclaim commands a premium
     × (0.9 + 0.3·fr)                            // library/name value
     × (1 + awardsLift)                          // prestige premium
     × (0.95 + 0.10·prestige)                    // studio's licensing standing
clamp(mult, 0.3, 2.2)
```

**Merchandising** — `baseRate 0.015` (near-zero baseline; genre-gated up hard)
```
mult = GENRE_ANCILLARY[genre].merch             // Superhero/Animation ~6 … Drama ~0.05
     × (0.3 + 1.4·merch)                          // the inert character trait, finally read
     × (0.5 + 1.5·fr)                             // toy lines need a brand
     × (0.8 + 0.5·famTeen)
clamp(mult, 0.0, 12)
```
Merch is the sharpest genre lever: an adult drama's `GENRE_ANCILLARY.merch ≈
0.05` and near-zero `merchandisePotential` characters yield essentially nothing,
so "adult dramas shouldn't sell merch" falls out of the data rather than a
special case.

**Catalogue** — see §3.5 (it is a longevity model, not a one-shot multiplier).

`GENRE_ANCILLARY` is a new eight-row table (`data/ancillary.ts`) — the one piece
of genre data that doesn't exist yet (genres carry no family/merch flags today).
Illustrative:

| Genre | homeEnt | merch | catalogueBias |
|---|--:|--:|--:|
| Action | 1.4 | 3.5 | 0.5 |
| Sci-Fi | 1.4 | 4.5 | 0.7 |
| Fantasy | 1.5 | 5.0 | 0.8 |
| Animation* | 1.6 | 6.0 | 0.9 |
| Horror | 1.1 | 1.2 | 0.6 |
| Comedy | 1.0 | 0.8 | 0.4 |
| Thriller | 1.0 | 0.6 | 0.4 |
| Romance | 0.8 | 0.3 | 0.5 |
| Drama | 0.6 | 0.05 | 0.7 |

*Animation is not a genre in the union today (`types/index.ts:11-19`); until it
is, treat family-audience Fantasy/Comedy as its proxy, or key the merch/home-ent
lift off `targetAudience === 'Families'`. Flagged as an open decision in §11.

### 3.4 Timing — the deferred-income pipeline

The chosen model (confirmed with the studio owner) is **phased windows over game
time**, so ancillary becomes a cash-flow planning tool, not a lump cheque. This
needs a general deferred-income mechanism, which doesn't exist — today the only
scheduled future money is the pre-release `ScheduledRelease`
(`engine/scheduledReleases.ts`), and theatrical revenue hard-stops when the run
finishes (`boxOfficeRun.ts:331`).

**New: an ancillary payout pipeline.** When a film's theatrical run finishes
(`finishFilm`, `boxOfficeRun.ts:167`), compute its ancillary profile and
**materialise a schedule** of future payouts:

```ts
type AncillaryWindow = 'homeEntertainment' | 'licensing' | 'merchandising' | 'catalogue';
interface AncillaryPayout { filmId: string; window: AncillaryWindow; dueDay: GameDay; amount: Money; }
// Studio.ancillaryPipeline?: AncillaryPayout[]   // append at finish, drain on advance
```

Each window is spread over a few installments rather than a single hit, keyed to
offsets from the run's end (`data/ancillary.ts`, tunable):

- **Merchandising** — ~40% at/around release day (toys ship with the film), the
  rest over the home-ent window. (Merch is the one window that partly *precedes*
  the theatrical run ending — it launches with the marketing campaign.)
- **Home Entertainment** — begins ~day +90, ~3 installments across ~120 days
  (disc/EST front, VOD tail).
- **Licensing** — wave 1 (pay-TV) ~day +210; wave 2 (streaming/free-TV) ~day
  +480. Two waves because a film is licensed more than once.
- **Catalogue** — one payout per in-game year for its longevity span (§3.5),
  each smaller than the last.

**Draining the pipeline.** `runCalendarSettlement` (`studioReducer.ts:419`) —
which already runs on every day-advance and settles due box-office weeks — also
credits any `ancillaryPipeline` entries whose `dueDay ≤ totalDays`, then drops
them. Crucially, these credits go through **`recordCashChange`**
(`engine/cashLedger.ts:17`), not the direct-cash mutation box office uses. That
fixes a standing gap: film income is currently invisible in the activity feed
(box-office cash bypasses the ledger, `studioReducer.ts:452`). Ancillary income
appears as named lines — "Home entertainment — *Titan Force* +$62M" — which is
also the readable, non-spreadsheet surface for the whole system.

Add ledger categories (`types/index.ts:2025`): `homeEntertainment | licensing |
merchandising | catalogue` (or one `ancillary` category if we want the feed
terser — open decision §11).

**Why store the schedule when we "derive, don't store"?** The *profile* (rates,
multipliers) is derived from stored attributes and recomputed freely. But a
*scheduled cheque the player is planning around* must be a fixed fact, exactly
like a `BoxOfficeWeek` or a `ScheduledRelease` — otherwise a later formula tweak
would retroactively rewrite money already promised. We store the materialised
payouts (a recorded consequence), not a "revenue" stat on the film. This is the
same line the codebase already draws between derived strengths and recorded
history.

### 3.5 The long tail — catalogue longevity

Most films decay to nothing within a year or two of their windows closing. A few
become **classics** and pay a small dividend for a decade or more. That "few" is
what makes a beloved library valuable, so catalogue is modelled as a *longevity*
score, not a flat multiplier:

```
longevity =  0.40 · awardsLift                    // Best Picture / Actor wins dominate
           + 0.25 · max(0, (aud − 0.75)/0.25)      // only genuinely beloved films (aud>75)
           + 0.15 · fr                              // franchise library staples
           + 0.10 · GENRE_ANCILLARY[genre].catalogueBias
           + 0.10 · holidayFamily                   // Christmas/family perennials
                                                     //   (release window + Families audience)
cult bonus: +0.15 if originality high AND audience polarising (loved-by-few)
```

`longevity ∈ [0,1]` sets **both** the annual catalogue rate and **how many years
it pays**: below a threshold (~0.25) a film gets *no* catalogue tail at all
(it's forgotten); above it, `years = round(3 + 12·longevity)` (∼4 to 15) and
each year pays `reachBase × 0.006 × (0.5 + longevity) × decay^n`, decaying ~15%
annually. So an award-winning family perennial pays a modest sum every Christmas
for 15 years; a forgettable thriller pays nothing after its licensing wave.

`awardsLift` reads `AwardsState.history` by `filmId` (`engine/awards.ts`) — a
Best Picture + Best Actor sweep is a large lift, a single craft nomination a
small one. This is the point at which **prestige finally becomes a financial
asset**: an Oscar drama's whole economic case is its licensing premium plus a
long catalogue tail, both driven by acclaim it can't buy.

### 3.6 The international gate

Ancillary respects the studio's distribution reach, reusing the existing
international gate. Today a studio with no International Distribution tier keeps
`internationalReachFraction = 0` and earns *no* overseas box office
(`data/distribution.ts:114`). The same fraction scales the international portion
of licensing and home-ent (broadly ~40% of those windows). A domestic-only
studio captures the domestic afterlife but leaves the overseas afterlife on the
table — the same lever, extended, and another reason to build out distribution.

### 3.7 Calibration targets — ✅ CALIBRATED (Stage 6)

Ancillary must fix the top end **without** turning every film into a printing
press. The achieved bands, fenced by `engine/ancillary.calibration.test.ts`
(lifetime ancillary ÷ theatrical rentals, i.e. `÷ 0.42·gross`, across
representative archetypes):

| Film class | Lifetime ancillary vs theatrical rentals | Achieved | Shape |
|---|--:|--:|---|
| Merch-driven franchise blockbuster | 1.8–2.5× | **~2.2×** | front-loaded (merch + home-ent) |
| Broad four-quadrant hit | 1.0–1.6× | **~1.1×** | balanced |
| Typical wide release | 0.45–1.0× | **~0.6×** | home-ent-led, modest |
| Adult prestige drama | 0.4–0.65× | **~0.5×** | licensing + catalogue tail |
| Flop nobody saw | (absolute, not ratio) | **~$6M** | negligible, can't rescue |

Two honest calibration notes. The **typical-wide** band was relaxed from the
original ~0.7–1.0× guess to 0.45–1.0×: a film's ratio is genre-sensitive (a
low-merch Thriller sits near 0.6×, an Action tentpole higher), and the invariant
that matters is that the median stays a *fraction* of theatrical, well below the
hits — which it does. The **flop** is asserted on its *absolute* afterlife
(≈$6M — far too small to turn a real loss around), not a ratio: because every
window scales off reach, a flop's ratio floors around ~0.4× structurally, but its
dollars are negligible, which is what "can't rescue a flop" actually requires.
The tuning that got here (all in `data/ancillary.ts` + the multiplier weights in
`engine/ancillary.ts`): higher window base rates, steeper audience-score
sensitivity (to separate a liked-but-modest film from a flop), and raised
multiplier clamps (to un-cap the top merch/home-ent blockbuster without moving
the median).

The invariant: ancillary makes a *genuine hit that lost money theatrically*
profitable over its life, and gives a prestige film a slow path to black — but
never rescues a film **nobody engaged with**, because every window scales off
`reachBase`. You cannot ancillary your way out of a flop.

---

## 4. System 2 — Backend participation

Today all talent comp is a flat salary charged at greenlight
(`engine/cost.ts:8`, `studioReducer.ts:1820`); no participation concept exists
anywhere. Backend adds a **compensation structure choice** at casting.

### 4.1 Deal structures

At negotiation, a *bankable* talent (see §4.2) can be signed under one of three
structures, presented as a term sheet:

1. **Flat fee.** Pay the full quote up front. Studio keeps 100% of the upside.
2. **Reduced fee + points.** A lower guaranteed fee, plus a percentage of a
   defined base:
   - **Studio-gross points** — a share of the studio's *receipts* (theatrical
     rentals + every ancillary window), paid as that money arrives. Expensive;
     pays even on a break-even film. This is the star-favourable "gross" deal.
   - **Net-profit points** — a share of *profit after costs*. Cheap; pays only if
     the film clears its costs, and often pays nothing (the sim's honest version
     of "Hollywood accounting"). Studio-favourable.
3. **Salary + escalators.** A moderate guaranteed fee plus fixed milestone
   bonuses at gross thresholds — "+$5M at $600M worldwide, +$10M at $900M." No
   percentage; capped, legible, and only triggers on genuine outperformance.

### 4.2 Willingness and terms — where stars get leverage

Who can command backend, and on what terms, is read from stats the negotiation
system already uses (`engine/castingNegotiation.ts`, `PersonReputation`):

- **Only bankable talent offers it.** A star with high `fame` / `currentHeat` /
  `ego` will trade guaranteed cash for points — they believe in the upside and it
  is a status marker. A mid-tier actor takes scale; backend isn't on the table.
  This makes signing a genuine star *feel* different from filling a supporting
  role, which is the point.
- **The discount scales with belief.** The fee reduction a star offers for a
  point of backend scales with their heat and the project's apparent upside —
  hotter stars discount their fee more aggressively for gross points, because
  they expect the film to pay. So the classic decision the brief names is exactly
  what the player faces:

  > Pay the star **$35M flat**, or **$12M + 7% of studio gross**?

  If the film does $1B lifetime receipts, 7% is ~$70M and flat was far cheaper.
  If it flops, backend pays almost nothing and you saved $23M in cash you didn't
  have. The star's leverage is real: taking points, they can earn multiples of
  any flat fee you'd have paid — *on the films that hit*.

- **Reliability tempers it.** An unreliable star demanding heavy gross points is
  a double risk (production risk *and* a first-call on receipts) — surfaced, not
  blocked, so the player can decide.

### 4.3 Payout mechanics

```ts
type BackendBase = 'studioGross' | 'netProfit';
interface BackendDeal {
  personId: string;
  reducedFee: Money;                 // the guaranteed portion, charged at greenlight as normal
  points: number;                    // e.g. 7 (percent)
  base: BackendBase;
  escalators?: { grossThreshold: Money; bonus: Money }[];
}
// TalentAssignment.backendDeal?: BackendDeal   (types/index.ts:2130)
```

The **guaranteed fee** is charged at greenlight through the existing path — no
change to cost flow. The **participation** is a *liability that settles as the
triggering revenue arrives*:

- **Gross points** are deducted from each theatrical settlement and each
  ancillary payout as it lands — so a gross-points star is paid across the film's
  whole life, including the streaming tail. This is precisely what makes the two
  systems interlock: without ancillary, gross points would be a rounding error;
  with it, they're a career-maker.
- **Net points** settle only once the film has recouped `totalCost` cumulatively,
  then take their share of the surplus as further revenue arrives.
- **Escalators** fire once, when cumulative worldwide gross crosses each
  threshold during the theatrical run.

Each triggering event routes through `recordCashChange` with a `backend`
category and a named reason ("Backend participation — T. Cruise −$31M"), so the
cost is as legible as the income.

### 4.4 Presentation — a term sheet, not a formula

Per the qualitative-presentation rule, the player never sees "willingness 0.62."
They see, in the casting/negotiation drawer, two or three offer cards the star
will accept:

```
  ┌─ Flat ──────────────┐  ┌─ Points ─────────────────┐  ┌─ Escalators ──────────┐
  │ $35M guaranteed     │  │ $12M + 7% studio gross    │  │ $20M + bonuses:       │
  │ You keep all upside │  │ Shares the upside AND the │  │  +$5M at $600M WW      │
  │                     │  │ downside of every window  │  │  +$10M at $900M WW     │
  └─────────────────────┘  └───────────────────────────┘  └────────────────────────┘
```

with a one-line qualitative risk read ("A gross deal pays her before you see a
dollar of profit — worth it only if you believe in this film"). The chosen deal
is then a visible line in the film's waterfall when it pays.

---

## 5. How the two systems interconnect (and fix the brief)

- **Blockbuster profitability** is fixed by ancillary: the $750M "−$35M" tentpole
  becomes strongly profitable over three years (worked example §7). Backend lets
  you *afford* the star that made it a tentpole, by moving cash cost into shared
  upside.
- **Genres feel different** because the window *signatures* differ: merch is
  gated hard by genre + character merch potential; home-ent rewards
  family/rewatchable; licensing and catalogue reward prestige. A superhero film
  and an Oscar drama earn money in different windows, in different amounts, on
  different timelines.
- **Stars get leverage** because backend lets them capture a percentage of a
  revenue tail that ancillary makes large — real money on the films that hit.
- **Meaningful decisions** exist at three new points: which windows a film is
  built for (genre/casting/franchise choices now have downstream revenue
  consequences), how to pay a star (cash vs. shared upside), and how to plan
  around scheduled income (fund a risky slate off a stable catalogue floor).
- **Readable** via the extended waterfall, the named cash-ledger lines, and a
  per-film windows timeline — no new spreadsheet.

---

## 6. UI concepts

All extend existing components; none is a new screen.

1. **Lifetime waterfall** — extend `FilmMoneyBreakdown`
   (`components/common/FilmMoneyBreakdown.tsx`). Below the existing theatrical
   `Waterfall`, add the afterlife:
   ```
   Theatrical profit ................  −$35M
   + Home entertainment .............  +$118M   (settled)
   + TV & streaming licensing ......   +$140M   (settled)
   + Merchandising ..................  +$205M   (settled)
   + Catalogue (to date) ............   +$14M   (ongoing)
   − Backend — T. Cruise (7% gross) .   −$58M
   ────────────────────────────────
   Lifetime profit ..................  +$384M
   ```
   Pending windows render greyed with an arrival hint ("Home entertainment —
   expected spring") until they settle, mirroring how the current waterfall
   withholds the theatrical split until the run ends.

2. **Windows timeline** — a compact horizontal strip on the film dossier
   (`FilmDetailModal`), reusing `BoxOfficeChart` styling: Theatrical → Home Ent →
   Licensing → Catalogue, filled portions = paid, outlined = upcoming. The
   film's whole economic life at a glance.

3. **Cash-ledger integration** — ancillary and backend lines flow into the
   existing activity feed (`CashHistoryModal`) with named categories, finally
   making film income visible there.

4. **Backend term sheet** — offer cards in the casting negotiation drawer
   (`components/wizard/CastingDrawer.tsx` / `RoleHiringDrawer.tsx`), as §4.4.

5. **Pre-release qualitative read** — on the greenlight/planning screens, a
   film's projected afterlife as prose/stars derived from its attributes
   ("Strong merchandising and home-video potential; limited awards profile"), so
   the player can *plan* for windows without seeing numbers. Derived live from
   `deriveAncillaryProfile`, never stored.

6. **Slate cash-flow panel** (optional, high value) — upcoming ancillary income
   across all films on the dashboard: the planning tool the phased timing unlocks.

---

## 7. Worked examples — two films, two lifetimes

### A. *Titan Force* — superhero tentpole

*Action/Fantasy, franchise entry (recognition 80), lead star fame 85, lead
characters merch potential ~75, audience 78, critic 62, Families/Teens. Prod
$200M + Mktg $150M = $350M. WW gross $750M. Star signed at $12M + 7% studio
gross.*

`reachBase = 750 × (0.85 + 0.30·0.78) ≈ 750 × 1.08 ≈ $810M`

| Window | Amount | When |
|---|--:|---|
| Theatrical rentals | $315M | over the run |
| Home Entertainment | ~$150M | months 4–9 |
| Licensing (2 waves) | ~$140M | months 7–24 |
| Merchandising | ~$205M | release + home-ent window |
| Catalogue | ~$8M/yr, fading | annual, ~10 yrs |
| **Studio receipts (life)** | **~$820M+** | |
| − Backend (7% of ~$820M) | −$57M | as each window pays |
| − Total cost | −$350M | greenlight/release |
| **Lifetime profit** | **≈ +$413M** | vs **−$35M** theatrical-only |

The disaster becomes a franchise cornerstone — front-loaded, merch-heavy. And
the backend lesson lands: the star's 7% (~$57M) cost *more* than the $23M of fee
you saved, because the film hit. Flat would have been cheaper — but you didn't
know that at greenlight, and the $23M of cash you kept may have funded the next
film.

### B. *The Quiet Hour* — prestige drama

*Drama, original (recognition 0), lead star fame 70 (prestige actor), merch ~5,
audience 82, critic 90, Adults/Critics. Wins Best Picture + Best Actor. Prod $25M
+ Mktg $20M = $45M. WW gross $60M. Star took $8M + 5% studio gross (a passion
project).*

`reachBase = 60 × (0.85 + 0.30·0.82) ≈ 60 × 1.10 ≈ $66M`

| Window | Amount | When |
|---|--:|---|
| Theatrical rentals | $25M | over the run |
| Home Entertainment | ~$5M | months 4–9 |
| Licensing (prestige premium, awards) | ~$18M | months 7–24 |
| Merchandising | ~$0 | — |
| Catalogue (longevity high: awards + beloved) | ~$1.6M/yr for ~15 yrs | annual |
| **Studio receipts (first 4 yrs)** | **~$54M** | |
| − Backend (5% gross) | −$2.7M | as windows pay |
| − Total cost | −$45M | |
| **Profit, 4 yrs in** | **≈ +$6M and climbing** | vs **−$20M** theatrical-only |

The drama earns almost nothing from merch or home video, grinds to black on the
*licensing premium its acclaim commands*, and then pays a small dividend every
year for a decade and a half. Its economic identity is the mirror image of the
tentpole's — slow, prestige-driven, long-tailed. **Prestige is now worth money.**

---

## 8. Data model & engine changes

New, pure, testable (`engine/` stays plain-data-in/plain-data-out):

- **`data/ancillary.ts`** — `GENRE_ANCILLARY` table, `WINDOW_BASE_RATES`,
  `WINDOW_TIMING_DAYS`, longevity/decay constants. All rebalancing lives here.
- **`engine/ancillary.ts`** —
  - `deriveAncillaryProfile(film, ip?, studio)` → projected per-window amounts +
    longevity. Pure, derived, never stored (the `deriveCommercialProfile`
    template). Powers the pre-release qualitative read and the UI preview.
  - `scheduleAncillaryPayouts(film, profile, runEndDay)` → `AncillaryPayout[]`.
- **`engine/backend.ts`** — `settleBackend(deal, event)` for a theatrical/ancillary
  cash event; escalator checks. Deal *construction* (what a star offers) extends
  `engine/castingNegotiation.ts`.
- **Types** (`types/index.ts`) — `AncillaryWindow`, `AncillaryPayout`,
  `Studio.ancillaryPipeline?`, `BackendDeal`, `TalentAssignment.backendDeal?`,
  new `CashLedgerCategory` values, backend-liability tracking on the film.
- **Wiring** — scheduling lives in `runCalendarSettlement` (`studioReducer.ts`),
  not in the pure `finishFilm` (`boxOfficeRun.ts:167`): the reducer detects a
  player film whose run has just crossed to `finished`, computes the profile
  (which needs studio prestige + awards, cross-entity facts `finishFilm` can't
  see), and appends payouts — marking `BoxOfficeRun.ancillaryScheduled` so it
  happens once. The same function drains due payouts through `recordCashChange`,
  and (Stage 5) settles gross/net backend on every theatrical and ancillary credit.
- **`SAVE_KEY`** bump (`state/persistence.ts:394`), no migration (pre-launch).

The intrinsic/derived split holds throughout: attribute-driven *potential* is
derived on demand; only the materialised payout schedule and backend liabilities
(recorded future facts) are stored.

---

## 9. Staged build plan

Each stage is independently shippable and testable.

1. **✅ LANDED — Ancillary profile, derived + inert.** `data/ancillary.ts` +
   `engine/ancillary.ts` (`deriveAncillaryMultipliers` / `deriveAncillaryProfile`
   / `ancillaryOutlook`) + the pre-release qualitative read. No cash, no state.
   Unit-tested against the §3.7 target *shapes*. Zero economic risk.
2. **✅ LANDED — Pipeline + phased payout, drained through the ledger.**
   `AncillaryPayout` / `Studio.ancillaryPipeline` / `BoxOfficeRun.ancillaryScheduled`
   types; `buildAncillarySchedule` materialises the phased offsets directly (the
   "lump first" interim was skipped — the installment table was cheap enough to
   ship at once); `runCalendarSettlement` schedules a film's payouts the pass its
   run finishes and drains due ones through `recordCashChange` (four new ledger
   categories, so film income is finally visible in the activity feed). The
   `FilmMoneyBreakdown` waterfall gains a lifetime-profit "afterlife" section via
   `selectFilmAncillary`. `SAVE_KEY` → v75. Catalogue longevity ships here too (it
   was already in the profile). Player studio only; rival afterlife deferred.
3. **✅ LANDED — Windows timeline UI + slate cash-flow panel.** The planning
   layer. Per-film: a proportional `AncillaryTimeline` strip in the money dossier
   (theatrical + the four windows, each split solid=received / faded=scheduled,
   next-payment caption) via `selectFilmAncillary().windows`. Slate-wide: a
   dashboard `SlateCashFlowPanel` bucketing all scheduled income by in-game year
   via `selectUpcomingAncillary` — the forward-looking cash-flow view a studio
   funds a risky slate against.
4. **✅ LANDED — Awards refinement + rival afterlife.** The Stage 2 helpers moved
   into a pure, unit-tested `state/ancillarySettlement.ts`. Two additions: an
   **awards premium** — when a film wins/gets nominated *after* its schedule was
   fixed, `accrueAncillaryAwardsPremium` pays the incremental licensing+catalogue
   value (isolated from prestige drift) as follow-on payouts, idempotently, using
   a new `BoxOfficeRun.ancillaryAwards` baseline; and **rival afterlife** —
   `accrueRivalAncillary` credits each finished rival film's whole ancillary
   lifetime as a lump to its studio's cash + `lifetimeRevenue`, so rival economics
   reflect the full business, not just theatrical. Rival awards retroactivity is
   still out of scope.
5. **✅ LANDED — Backend participation.** A bankable star (gated by fame/heat/ego
   in `engine/backend.ts`) offers structured alternatives to a flat fee:
   `deriveBackendOffers` returns a reduced-guarantee-plus-gross-points deal and a
   salary-plus-escalators deal, terms scaling with bankability. The player picks
   one from a term-sheet card in the casting drawer (`ACCEPT_BACKEND_OFFER` →
   `BackendDeal` stamped on the assignment; the reduced guarantee flows through
   the existing `agreedSalary` greenlight charge). `buildBackendLiabilities`
   materialises the participation into phased, negative-signed cash events at
   run-finish — gross points off theatrical receipts and every ancillary payout,
   escalator bonuses at crossed gross thresholds — drained through the ledger
   (`backend` category) as the revenue arrives, and shown as a deduction line in
   the film's lifetime waterfall. **Net-profit points are typed but deferred**
   (they need cumulative-recoup tracking). `SAVE_KEY` → v76.
6. **✅ LANDED — Calibrate.** `engine/ancillary.calibration.test.ts` fences the
   §3.7 bands over five archetypes plus a "the backend deal is a genuine bet"
   check (points cost the studio less than a flat fee on a flop, more on a hit).
   The tuning — higher window base rates, steeper audience-score sensitivity, and
   raised multiplier clamps — lifted a $750M merch-franchise from ~1.4× to ~2.2×
   its theatrical rentals (the headline gap) while keeping the median a modest
   fraction and never letting ancillary rescue a flop. All in `data/ancillary.ts`
   + the multiplier weights; no schema change, no save bump.

Stages 1–6 have all landed: 1–2 fix the headline blockbuster problem, 3 adds the
planning layer, 4 handles retroactive awards + rival afterlife, 5 delivers backend
participation, and 6 calibrates the magnitudes. Both systems from the brief are
in and tuned. The only deferred pieces are net-profit points and rival
backend/awards-retroactivity — noted where they arise, not on the critical path.

---

## 10. Balancing, risks, and open decisions

- **Don't re-inflate the top.** Ancillary scales off `reachBase`, which scales
  off gross — it amplifies engagement, it doesn't invent it. Keep base rates low
  and let multipliers do the differentiating; gate merch hard so only the right
  films print. The `wideUnprofitablePct` and top-share box-office diagnostics
  must not regress (a film should still be able to lose money for its whole
  life).
- **Backend must stay a real bet.** Calibrate the fee-discount so that, in
  expectation across a studio's slate, flat vs. points is roughly a wash — points
  win on the hits, flat wins on the misses. If points are strictly better, the
  decision dies (Principle 6).
- **Cash-flow, not free money.** Phased timing means a studio can over-extend
  against income that hasn't arrived — good. Guard against it becoming a pure
  windfall by keeping near-term windows modest and the big licensing wave genuinely
  distant.

**Open decisions:**
1. **Animation.** Add it to the `Genre` union (cleanest — it has the strongest
   merch/home-ent/catalogue signature of all), or proxy it via `Families`
   audience until then?
2. **Ledger granularity.** Four named ancillary categories (richer feed) vs. one
   `ancillary` category (terser)? Recommend four — legibility is the whole point.
3. **Backend on ancillary by default.** Should gross points *always* include the
   ancillary tail, or should "theatrical-only" vs "all-media" be a negotiable
   term the sharpest stars push on? The latter is more real but one more knob.
4. **Catalogue floor visibility.** Surface projected annual catalogue income as a
   studio-level "library value" figure (a reason to keep a beloved back-catalogue)
   or leave it per-film?

---

## 11. What this deliberately does not do

- **No eight-line-item accounting.** Four windows, chosen for distinct timing and
  attribute signatures. The player reads a film's afterlife in one glance.
- **No hidden release-time roll.** Ancillary is a deterministic read of the
  film's attributes and its actual theatrical reach — endogenous, explainable, no
  new randomness bolted on at the end (Principle 1/2).
- **No rescue for flops.** Every window scales off engagement. A film nobody saw
  earns a small, fast-dying tail and stays a loss — as it should.
- **No raw numbers to the player.** Prose, stars, term sheets, and named ledger
  lines. The multipliers live in `data/` and the tests.
- **No save migration.** Pre-launch; bump `SAVE_KEY` and target the current
  schema.
</content>
</invoke>
