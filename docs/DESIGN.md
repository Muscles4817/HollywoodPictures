# Hollywood Pictures - Design Brief

This is the working design document for the MVP: what the game is trying to
be, how the simulation actually computes its numbers, and what the natural
next steps are. It's written to be read alongside the code - every formula
below names the file it lives in, so when you rebalance something you know
exactly where to go.

## 1. Vision

A browser game inspired by *Hollywood Pictures 2* and *The Movies*: run a
small studio, make one film at a time, and watch reputation and cash compound
(or collapse) over a career. The MVP scope is deliberately narrow - one film,
start to finish, with a satisfying loop - so it can be extended later without
a rewrite: franchises, rival studios, awards season, streaming platforms,
scandals, physical studio facilities, talent relationships that persist
across films.

Design priorities, in order: **a complete, playable loop** > **clean,
extensible architecture** > **visual polish**. Nothing in this MVP should
need a rewrite to grow - it should need new `data/` entries and maybe a new
`engine/` function.

## 2. The core loop

```
Studio Dashboard
   -> Develop Film       (title, genre, target audience, buy a script)
   -> Hire Talent        (director, lead actor, supporting actor, writer, composer, editor, +VFX supervisor)
   -> Production Planning(budget tier, shooting style, sets, effects, VFX, runtime)
   -> Filming             (roll 3-5 production events)
   -> Post-Production     (edit style, music focus, test screening, marketing cut)
   -> Marketing & Release (spend, release type, release window)
   -> Results             (box office, scores, reputation change, reviews)
   -> back to Dashboard, start the next film
```

Each step is a screen in `src/components/wizard/`, driven by one shared
`FilmDraft` object in state (see [Section 4](#4-state--architecture)). The
step order is fixed; nothing in the data model prevents jumping around later
(e.g. a "revise the script" loop) but the MVP wizard is linear by design -
one thing at a time, always know what's next.

## 3. Data model

Defined in `src/types/index.ts`. The five nouns that matter:

- **Studio** - `name`, `cash`, `reputation` (0-100), `year`, `filmsReleased[]`.
  This is the only thing that persists between films.
- **Film** - a fully-resolved, released film: its script, its cast, every
  choice made producing it, its rolled events, and its final `FilmResults`.
  Immutable once created; lives forever in `studio.filmsReleased`.
- **Script** - `genreFit`, `originality`, `structure`, `dialogue`,
  `marketability`, `complexity` (all 1-100), plus a `cost`. Generated
  procedurally per genre (see `engine/scriptGenerator.ts`).
- **Talent** - `role`, `fame`, `skill`, `reliability`, `ego` (all 1-100),
  `salary`, and a sparse `genreAffinities` map. A static roster in
  `data/talentPool.ts` - every talent is always hireable (no scheduling
  conflicts yet, see [Section 8](#8-known-limitations--next-steps)).
- **FilmDraft** - the film *in progress*. Every wizard screen reads and
  writes one field of this (`script`, `talent`, `productionChoices`, ...).
  Once released it's promoted into a `Film` and the draft is thrown away.

## 4. State & architecture

`src/state/` is a single `useReducer` + Context (`StudioContext.tsx`,
`studioReducer.ts`, `gameState.ts`), auto-persisted to `localStorage` on every
change (`persistence.ts`). No backend - this is intentional for the MVP, and
the reducer is structured so a backend could swap in later by replacing
`persistence.ts` without touching anything else.

**Cash is only ever mutated once per film, at `RELEASE_FILM`.** Every earlier
screen (buying a script, hiring cast, planning production, test screenings)
just *previews* a projected spend via `state/selectors.ts:computeCommittedSpend` -
nothing is actually deducted until release, when the reducer computes the
complete cost breakdown fresh from the finished draft and applies
`cash - totalCost + totalBoxOffice` in one step.

This was a deliberate correction mid-build: the first version deducted cash
incrementally at each screen (buy script -> deduct; hire cast -> deduct;
begin filming -> deduct). That made the wizard's "Back" buttons dangerous -
navigating back and re-confirming a step would double-charge the studio. The
single-mutation-at-release design makes back-navigation free of side effects
by construction, at the cost of every screen needing to recompute its own
cash preview from the draft. That tradeoff is worth it - a bug class removed
entirely beats a bug handled carefully.

The `rngSeed` lives in state too, so randomness stays reproducible in the
sense that matters for a reducer: same state + same action always produces
the same result (see `engine/random.ts` - Mulberry32 PRNG, reseeded after
every roll).

## 5. The scoring engine

Everything in `src/engine/` is a pure function: plain data in, plain data
out, no React, no state. That's what makes it unit-testable and safe to
rebalance by editing `src/data/*.ts` without touching logic.

### 5.1 Sub-scores (`engine/scoring.ts`)

Six 0-100 sub-scores feed the Final Quality Score:

| Sub-score | Formula | Notes |
|---|---|---|
| **Script** | `originality*.3 + structure*.3 + dialogue*.25 + marketability*.15` | Independent of genre fit. |
| **Direction** | `director.skill*.6 + genreAffinity(director)*.4` | No director hired -> flat 35. |
| **Acting** | `lead*.7 + support*.3`, each `skill*.65 + genreAffinity*.35` | No actor hired -> flat 30 for that slot. |
| **Production** | Weighted blend of budget/shooting-style/set/effects "quality scores" (`data/production.ts`), with VFX vs. practical-effects weighted per genre (`data/genres.ts` `vfxImportance` / `practicalEffectsImportance`) | This is where "Action/Sci-Fi/Fantasy benefit from VFX" and "Drama/Romance don't" actually happens. |
| **Post-production** | `55 + testScreeningDelta + musicDelta + (Balanced edit ? 5 : 0)` | See `data/postProduction.ts`. |
| **Events** | `50 + sum(event.qualityDelta) * 2` | Amplified because each rolled event's raw delta is small (~-10..+10 across 3-5 events). |

**Final Quality Score** = weighted average per the spec's brief:
`script .2 + direction .2 + acting .2 + postProduction .2 + production .1 + events .1`
(`data/scoringWeights.ts:QUALITY_WEIGHTS`).

Two more scores exist alongside quality but aren't part of it:

- **Genre Fit Score** = `script.genreFit*.4 + avg(directorAffinity, leadAffinity)*.35 + budgetFit*.25`,
  where `budgetFit` is 85 for anything above Cheap, and for Cheap it's
  `30 + genre.lowBudgetFriendly*60` - this is why Horror can go cheap and
  Sci-Fi/Fantasy/Action really can't (`genres.ts:lowBudgetFriendly`).
- **Marketability Score** = `script.marketability*.5 + avgCastFame*.45 + runtimeDelta` -
  informational for now; feeds nothing downstream yet (a natural hook for a
  future "pre-release buzz" mechanic).

### 5.2 Critic & Audience Score

```
Critic  = quality*.45 + script.originality*.2 + direction*.2 + editStyleScore*.15 + releaseType.criticBonus
Audience = genreFit*.25 + leadActor.fame*.2 + entertainment*.25 + marketingScore*.15 + production*.15
```
(`data/scoringWeights.ts:CRITIC_WEIGHTS` / `AUDIENCE_WEIGHTS`, computed in
`scoring.ts:computeCriticScore` / `computeAudienceScore`.)

`releaseType.criticBonus` is a small flat addend, not a weighted term - it's
how Festival First delivers on "helps critics and awards-style films"
(`data/release.ts:RELEASE_TYPE_PROFILES`, +6 for Festival First, 0 for
Streaming/Wide, +2 for Limited).

`entertainment` folds in edit-style and final-cut-focus audience deltas plus
a slice of the quality score. `marketingScore` is a flat lookup by spend tier
(None=15 ... Huge=95) - deliberately coarse, since marketing's real
box-office effect is in the box office formula itself, not here.

### 5.3 Buzz Score

`40 + sum(event.buzzDelta) + musicBuzz + finalCutBuzz + marketingBuzz + (script.marketability-50)*.2`,
clamped 0-100 (`scoring.ts:computeBuzzScore`). Buzz is currently cosmetic on
the results screen - a clean hook for a future "pre-release hype affects
opening weekend" mechanic.

### 5.4 Box office (`engine/boxOffice.ts`)

This is *not* a weighted sum - it's a multiplicative chain against a base
market size, because box office in reality compounds factors rather than
averaging them (a great film in the wrong genre window in a market too small
for it still underperforms, no matter how good the individual scores are):

```
raw = BASE_MARKET_POTENTIAL (£60,000,000)
    * targetAudience.marketSize
    * (genre.popularity / 100)
    * releaseWindow.baseMultiplier * releaseWindow.genreBonus (e.g. Halloween x Horror = 1.45)
    * releaseType.reachMultiplier
    * marketingSpend.boxOfficeMultiplier
    * reputationFactor        (0.7 - 1.3, from studio reputation)
    * budgetScaleFactor       (0.55 Cheap - 1.25 Excessive; wider prints, independent of quality)
    * audienceConversion      (0.1 - 1.4, from audience score)
    * criticLegsFactor        (0.75 - 1.15, from critic score, "legs" / word of mouth)

if (Wide release && marketing spend is None/Low): raw *= 0.55   // "wide needs strong marketing"

totalBoxOffice = raw * variance   // variance band scaled by releaseType.varianceMultiplier
openingWeekend = totalBoxOffice * openingWeekendFraction[releaseType]  // Wide .35, Streaming .25, Limited .15, Festival First .12
```

The two low floors - `audienceConversion` bottoming out at 0.1 and
`criticLegsFactor` at 0.75 - are the load-bearing numbers for the game's
central promise ("revenue shouldn't be too punishing, but expensive bad films
should flop"). They were tuned by running scenario scripts through the real
engine (not by hand-calculation) until:

| Scenario | Total cost | Box office | Profit ratio | Outcome |
|---|---|---|---|---|
| Cheap + mediocre (58/52) | ~£6.8M | ~£17.4M | +1.57 | Hit |
| Cheap + bad (25/20) | ~£6.8M | ~£7.5M | +0.11 | barely breaks even |
| Cheap + great (85/85) | ~£6.8M | ~£28M | +3.13 | Blockbuster-tier |
| Premium + bad (25/20) | £30M | ~£14.3M | **-0.52** | **Flop** |
| Excessive + bad (25/20) | £55M | ~£17M | **-0.69** | **Flop** |

That last two rows are the point: an expensive, bad film loses real money.
A cheap, bad film just doesn't turn a profit - it doesn't need to bankrupt a
new studio for a single misjudged genre pick.

### 5.5 Outcome label (`engine/outcome.ts`)

A first-match-wins decision tree on `profitRatio = profit / totalCost`:

1. `profitRatio <= -0.3` -> **Flop**
2. `criticScore >= 85 && qualityScore >= 80` -> **Masterpiece**
3. `profitRatio > 2.5 && audienceScore >= 70` -> **Blockbuster**
4. `profitRatio < 0.15 && criticScore >= 65` -> **Cult Hit** (broke even, critics loved it)
5. `profitRatio > 0.8` -> **Hit**
6. else -> **Modest Success**

### 5.6 Reputation (`engine/reputation.ts`)

Flat delta per outcome (Flop -8, Cult Hit +2, Modest Success +3, Hit +6,
Blockbuster +10, Masterpiece +15) plus a small critic-score nudge
(`round((criticScore-50)/10)`, roughly -5..+5), clamped to 0-100.

### 5.7 Production risk & events (`engine/production.ts`, `data/productionEvents.ts`)

Before filming, a risk score (5-95) is computed from cast reliability/ego,
script complexity, and the chosen shooting style/budget risk:

```
risk = (100-avgReliability)*.3 + avgEgo*.2 + script.complexity*.2 + shootingStyleRisk*.2 + budgetRisk*.1
```

3-5 events are then rolled; each roll is negative with probability
`risk / 100`, drawn from `NEGATIVE_EVENT_TEMPLATES` or
`POSITIVE_EVENT_TEMPLATES` (`data/productionEvents.ts`) without repeats. Each
event contributes a small, randomised cost/quality/buzz/delay delta. This is
the one place ego and reliability actually bite - a high-ego, unreliable cast
doesn't lower skill, it raises the odds of an expensive, quality-sapping
on-set incident.

## 6. Cost model (`engine/cost.ts`, `state/selectors.ts`)

Final results break costs into two headline numbers:

- **Final production cost** = script cost + total cast salary + production
  budget cost (budget tier x shooting style x runtime multipliers, plus flat
  set/practical-effects/VFX spend) + net event cost delta + test-screening cost.
- **Marketing cost** = marketing spend tier x release-type cost multiplier
  (Wide costs more to support than Limited).

`profit = totalBoxOffice - (productionCost + marketingCost)`.

## 7. Data-driven config

Everything a designer would want to retune without touching engine code
lives in `src/data/`:

| File | Contents |
|---|---|
| `genres.ts` | Popularity, VFX/practical/acting/script importance, low-budget tolerance per genre |
| `audiences.ts` | Critic/audience weighting and market size per target audience |
| `talentPool.ts` | The full hireable roster - fame/skill/reliability/ego/salary/affinities |
| `scriptWords.ts` | Per-genre title word banks for procedural script titles |
| `production.ts` | Cost + quality-score tables for every production choice |
| `postProduction.ts` | Cost/score deltas for edit style, music, test screening, final cut |
| `release.ts` | Marketing spend tiers, release type profiles, release window bonuses |
| `productionEvents.ts` | The pool of on-set event templates |
| `reviewBlurbs.ts` | Flavor-text review snippets, bucketed by critic/audience reception |
| `scoringWeights.ts` | The weighted-sum tables for quality/critic/audience |

Rebalancing the game should almost always mean editing a table in this
folder, not a formula in `engine/`.

## 8. Known limitations / next steps

Things noticed during build/playtest that are worth flagging rather than
quietly leaving implicit:

- **Talent has no scheduling.** Every hire is always available; nothing
  stops you re-hiring the same lead actor film after film. A natural next
  step (mentioned in the original brief) is per-talent availability/cooldown
  and persistent relationships (an actor you keep hiring gets loyalty; one
  you burn gets pricier or refuses).
- **Buzz and Marketability scores are computed but not fully load-bearing.**
  Buzz shows on the results screen; Marketability doesn't surface anywhere
  yet. Both are clean hooks for a pre-release hype mechanic.
- **The talent roster is static and hand-tuned**, not procedurally generated
  like scripts are. Fine for an MVP roster size; would need generation (or a
  much bigger hand-authored pool) if the game runs many in-game years.
- **No AI rival studios, awards, franchises, scandals, or physical
  facilities** - all explicitly out of scope for the MVP per the brief, and
  all should slot in as new `data/` + `engine/` modules plus one more studio
  field, without touching the wizard flow.
- **Balance is tuned, not proven.** The scenario table in 5.4 was produced by
  running the real engine (`engine/boxOffice.ts`) against a handful of
  representative inputs by hand - there's no automated test suite pinning
  these numbers yet. Worth adding before any serious rebalancing pass, so
  future tuning doesn't silently break the "expensive bad films flop" promise.
