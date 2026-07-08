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
   -> Hire Talent        (director, lead actor, supporting actor, writer, composer, editor, +VFX supervisor -
                          each a price slider over procedurally generated candidates)
   -> Production Planning(six continuous sliders: budget, shooting pace, sets, effects, VFX, runtime)
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

- **Studio** - `name`, `cash`, `reputation` (0-100), `year`, `filmsReleased[]`,
  `talentPool` (the persistent hireable roster, one array per role). This is
  the only thing that persists between films.
- **Film** - a fully-resolved, released film: its script, its cast, every
  choice made producing it, its rolled events, and its final `FilmResults`.
  Immutable once created; lives forever in `studio.filmsReleased`.
- **Script** - `genreFit`, `originality`, `structure`, `dialogue`,
  `marketability`, `complexity` (all 1-100), a `cost`, and a `toneProfile`
  (see [Section 5.11](#511-tone-profiles--compatibility-enginecompatibilityts-datatonests)).
  Generated procedurally per genre (see `engine/scriptGenerator.ts`).
- **Talent** - `role`, `fame`, `skill`, `reliability`, `ego` (all 1-100),
  `salary`, and a `toneProfile` (six-axis emotional/tonal profile, replacing
  the old flat per-genre affinity number). Generated once per role when a
  `Studio` is created and kept for the life of the save in
  `studio.talentPool` (see [Section 5.8](#58-procedural-talent-generation-enginetalentgeneratorts)) -
  the same named roster is drawn from across every film, though there's
  still no scheduling conflicts or relationships yet (see
  [Section 8](#8-known-limitations--next-steps)).
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
| **Direction** | `director.skill*.6 + compatibility(director, script)*.4` | No director hired -> flat 35. `compatibility` is the tone-profile match against this specific script, not a genre lookup - see 5.11. |
| **Acting** | `lead*.7 + avg(supports)*.3`, each `skill*.65 + compatibility(actor, script)*.35` | No actor hired -> flat 30 for that slot. Supporting Actor can be an ensemble (see 5.8/5.9) - more of them *averages* the group's quality, it doesn't add up. |
| **Production** | Weighted blend of budget/shooting/set/effects "quality scores", each read off a continuous curve (`engine/productionDials.ts`) rather than a fixed tier, with VFX vs. practical-effects weighted per genre (`data/genres.ts` `vfxImportance` / `practicalEffectsImportance`) | This is where "Action/Sci-Fi/Fantasy benefit from VFX" and "Drama/Romance don't" actually happens. |
| **Post-production** | `55 + testScreeningDelta + musicDelta + (Balanced edit ? 5 : 0)` | See `data/postProduction.ts`. |
| **Events** | `50 + sum(event.qualityDelta) * 2` | Amplified because each rolled event's raw delta is small (~-10..+10 across 3-5 events). |

**Final Quality Score** = a weighted average of the six sub-scores above -
but unlike everything else in this section, the *weights themselves* are
genre-dependent, not fixed. `data/scoringWeights.ts:BASE_QUALITY_WEIGHTS`
(`script .2, direction .2, acting .2, postProduction .2, production .1,
randomEvents .1`) is the reference point for a genre of exactly-average
importance; `engine/genreWeights.ts:computeQualityWeights(genre)` tilts it:

```
scriptWeight     = BASE.script * (genre.scriptImportance / avgScriptImportance)
actingWeight     = BASE.acting * (genre.actingImportance / avgActingImportance)
productionWeight = BASE.production * (productionImportance / avgProductionImportance)
  where productionImportance = (genre.vfxImportance + genre.practicalEffectsImportance) / 2
direction / postProduction / randomEvents stay at BASE
-> all six renormalized to sum to 1
```

`productionImportance` is deliberately *derived* from fields that already
exist (`vfxImportance`/`practicalEffectsImportance`) rather than a new one -
a genre that leans on effects within the production sub-score (5.1's
Production row) also leans on production quality at this top level. The
averages are computed once from the live `GENRE_PROFILES` data, not
hardcoded, so retuning genre data keeps everything self-consistent.
Concretely, this is the difference between a Drama and an Action film:

| Genre | script | direction | acting | post | production | events |
|---|---|---|---|---|---|---|
| Drama | 25% | 18% | 27% | 18% | 2% | 9% |
| Comedy | 22% | 19% | 27% | 19% | 3% | 10% |
| Action | 11% | 22% | 15% | 22% | 20% | 11% |
| Sci-Fi / Fantasy | 17% | 20% | 15% | 20% | 18% | 10% |
| Horror | 22% | 22% | 12% | 22% | 12% | 11% |

Drama/Comedy barely care about production values at all - script and
acting alone are more than half the score. Action/Sci-Fi/Fantasy pull real
weight into production. Horror is the interesting one: it doesn't shift
much on script, but pulls extra weight into *direction and post-production*
specifically (tension and pacing are an editing/directing job) at acting's
expense - which matches horror's reputation as a director's genre more than
a star vehicle. `actingImportance` and `scriptImportance` were declared on
every `GenreProfile` from early on but never actually read anywhere until
this - the game had genre-flavored *inputs* (VFX mix, casting fit,
low-budget tolerance) without genre-flavored *priorities*.

Two more scores exist alongside quality but aren't part of it:

- **Genre Fit Score** = `script.genreFit*.4 + avg(directorCompatibility, leadCompatibility)*.35 + budgetFit*.25`,
  where `budgetFit` ramps linearly from `30 + genre.lowBudgetFriendly*60` at
  the very bottom of the budget slider up to 85 by 35% of the way up it, then
  stays at 85 the rest of the way - this is why Horror can go cheap and
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
    * budgetScaleFactor       (0.55 - 1.25, scales linearly with the budget slider; wider prints, independent of quality)
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
engine (not by hand-calculation), then re-verified after the production
model moved from four fixed tiers to a continuous slider:

| Scenario | Total cost | Box office | Profit ratio | Outcome |
|---|---|---|---|---|
| Rock-bottom indie, everything at the floor (Horror) | £839,750 | £3,141,000 | +2.74 | Hit |
| Money-no-object blockbuster, everything near the ceiling (Sci-Fi) | £103,095,000 | £232,219,000 | +1.25 | Hit |
| Mid-budget + bad (25 audience / 20 critic) | £30,000,000 | £15,495,000 | **-0.48** | **Flop** |
| Top-of-the-slider budget + bad (25 / 20) | £90,000,000 | £17,059,000 | **-0.81** | **Flop** |

The middle two rows are the point: an expensive, bad film loses real money -
that still holds at the top of the continuous slider exactly as it did with
the old fixed "Excessive" tier. At the very bottom of the slider, profit
*ratios* can look enormous (a bad film can occasionally return 10x+ on a
true shoestring budget) simply because the denominator is so small - the
`outcome` classifier's quality gates (see 5.5) keep that from reading as
anything better than "Hit", so a lucky cheap flop-that-wasn't doesn't get
mislabeled as a Blockbuster or Masterpiece it didn't earn.

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

### 5.7 Continuous production dials (`engine/interpolate.ts`, `engine/productionDials.ts`, `data/production.ts`)

All six Production Planning sliders (budget, shooting pace, set quality,
practical effects, VFX spend, runtime) are genuinely continuous - dragging
one changes cost and quality/risk smoothly across the whole range, not in
4-ish discrete jumps. The pattern is the same for all six:

1. `data/production.ts` declares a **range** (for the four currency dials,
   e.g. `BUDGET_RANGE = { min: 100_000, max: 40_000_000 }`) and a handful of
   **anchors** - calibration points at a slider position `t` (0-1) with the
   quality/risk/cost-multiplier values that apply there, plus a description.
2. `engine/interpolate.ts` has the generic math: `logT`/`logAmount` convert
   between a currency amount and its 0-1 slider position on a *log* scale
   (so the cheap end - where a real indie budget lives - gets just as much
   slider resolution as the expensive end), and `interpolateScale` does
   piecewise-linear interpolation of a named value between whichever two
   anchors bracket the current `t`.
3. `engine/productionDials.ts` wires the two together into named functions
   (`budgetQuality`, `shootingCostMultiplier`, `vfxScore`, ...) that
   `engine/cost.ts`, `engine/scoring.ts` and `engine/production.ts` all call.

Flavor text still comes in a handful of qualitative bands (`describeScale`
picks whichever anchor's description is closest to the current `t`) - there
isn't infinite unique English for infinite slider positions, and there
doesn't need to be. The numbers are what actually needed to stop jumping;
the words were never the problem.

This is also what makes a true shoestring film possible: the budget range's
floor is £100,000 (not the old "Cheap" tier's £900,000 base cost), and the
same log-scale treatment applies to set quality, practical effects and VFX
spend, so a genuinely bare-bones production - all six dials at the bottom -
costs about £98,750 in production spend alone (see the scenario table in
5.4: a full indie film, script and cast included, lands around £840,000
total).

### 5.8 Procedural talent generation (`engine/talentGenerator.ts`, `data/talentGeneration.ts`)

There's a fixed roster, but it's procedurally generated rather than
hand-authored. `generateTalentPool(rng)` runs once, when a `Studio` is first
created (`state/gameState.ts:createInitialStudio`), and produces ~100
candidates per role, each sampling a salary from a stratified band on a log
scale across that role's own range (`data/talentGeneration.ts:ROLE_GENERATION_PROFILES` -
e.g. Lead Actor spans £40,000 - £15,000,000, Editor spans £10,000 -
£1,200,000) so a real shoestring hire and a blockbuster star are both
represented and reachable via a price slider. Stratifying (one candidate per
even slice of the range, with random jitter inside each slice) rather than
pure random sampling guarantees coverage across the whole spectrum instead
of leaving it to chance. The resulting pool lives in `studio.talentPool` for
the life of the save (~170KB of localStorage including it) and is drawn from
by every film - the same named people are available film after film, so a
player can come to recognise (and build a mental model of) individual
actors and crew rather than meeting an entirely fresh cast each time.

Given a candidate's position `t` on that log scale:

```
fame        = 10 + (roleFameCeiling - 10) * t   + noise(±12)
skill       = 25 + 65 * t                        + noise(±20)
reliability = 45 + 25 * t                        + noise(±30)
ego         = 15 + fame * 0.45                    + noise(±20)
toneProfile = 1-2 random "signature" tones at random(70,100), the rest at random(10,55)
```

Fame and skill scale up with price *on average*, but the noise bands are
wide on purpose: a cheap unknown can be a hidden gem, an expensive hire can
still disappoint. Reliability and ego are only loosely tied to price -
professionalism isn't for sale, and neither is a diva-free set. `roleFameCeiling`
caps how famous a role can plausibly get even at the top of its pay scale -
98 for Director/Lead Actor, down to 45 for Editor - since below-the-line
crew don't become household names the way stars do. Every candidate gets a
full `toneProfile` at creation time (see 5.11), not one tied to whatever
genre happens to be selected - this is what makes the pool genre-agnostic
and reusable: switching a film's genre mid-draft (`SET_GENRE`) just changes
which script slate gets regenerated, it doesn't touch who's hireable or who
you've already hired. Rolling 1-2 signature tones high and the rest low
rather than sampling every tone independently is deliberate: six
independent uniform rolls regress everyone toward an unmemorable middle,
which loses the "brilliant at suspense, hopeless at comedy" specialist feel
a real cast/crew has.

On the Hire Talent screen, each role gets its own price slider (`SET_TALENT_TARGET_PRICE`)
that filters that role's ~100 pool members down to whoever's genuinely close
to that price - moving the slider changes who's shown, it doesn't generate
or discard anyone. `engine/talentFilter.ts:findCandidatesNearPrice` does the
filtering: start at a ±10% band around the target and take up to 9 of
whoever's in it, sorted by proximity; only widen the band (to ±20%, ±35%,
±60%, ±100%) if that leaves fewer than 3 candidates, so a sparse patch of
the range doesn't leave the screen empty. This replaced an earlier "always
show the 9 closest regardless of how close" version that could surface
candidates 60%+ away from the target with nothing nearby to show instead -
that's a real difference in kind, not just a tuning tweak: the old version
could never come up short of 9 results, the new one can (and should) show
fewer when fewer genuinely qualify. There's no "Reroll Candidates" button
any more - with a persistent named pool, rerolling would mean discarding
people the player may already have hired elsewhere, which defeats the
point; "Reset Studio" is the only way to get a fresh pool, because it starts
an entirely new save. A master "Target Cast & Crew Budget" slider
(`SET_TALENT_BUDGET_SPLIT`) splits a total evenly across the six mandatory
roles as a starting point - the player is free to tilt any individual
role's slider up or down afterward to over- or under-spend relative to that
split.

**Role capacity** (`data/talentGeneration.ts:ROLE_CAPACITY`) governs how many
people a role can hold: `{ min, max }`, checked in two places - the reducer
(`TOGGLE_TALENT_FOR_ROLE` refuses to add past `max`; `min` drives the "still
need to hire" validation on the Continue button) and the Hire Talent screen
(cards for candidates you haven't hired grey out and show "Cast full" once
`max` is reached, but an already-hired card stays clickable so you can
un-hire them). Every role is currently `{1,1}` (hire one, replacing swaps
who) except Supporting Actor at `{1,4}` - the first role that supports an
ensemble. Hiring more people into an ensemble role doesn't add their
contributions up; it *averages* them (see the Acting sub-score, 5.1) - a
bigger supporting cast is about hedging and flavor (spreading compatibility
risk, more reliability data points feeding production risk in 5.9), not a
free quality multiplier. Two singular-role actions exist because the
semantics genuinely differ: `SET_TALENT_FOR_ROLE` replaces/toggles a `{1,1}`
role in place, `TOGGLE_TALENT_FOR_ROLE` adds-or-removes against a role that
can hold more than one.

### 5.9 Production risk & events (`engine/production.ts`, `data/productionEvents.ts`)

Before filming, a risk score (5-95) is computed from cast reliability/ego,
script complexity, and the chosen shooting pace/budget position:

```
risk = (100-avgReliability)*.3 + avgEgo*.2 + script.complexity*.2 + shootingRisk(shootingIntensity)*.2 + budgetRisk(budgetAmount)*.1
```

3-5 events are then rolled; each roll is negative with probability
`risk / 100`, drawn from `NEGATIVE_EVENT_TEMPLATES` or
`POSITIVE_EVENT_TEMPLATES` (`data/productionEvents.ts`), merged with that
film's `GENRE_EVENT_TEMPLATES[genre]` entries (one positive, one negative per
genre - a Horror shoot might roll "a practical gore effect looked so
convincing a crew member actually flinched" or "a key prop malfunctioned
mid-scare"), without repeats. Genre events sit *inside* the same pool as the
generic ones rather than replacing them, so a Sci-Fi shoot can still hit
ordinary set drama (bad weather, an over-schedule director) alongside its
VFX-flavored beats - genre nudges the flavor of what can happen, it doesn't
wall off a separate experience. Each event contributes a small, randomised
cost/quality/buzz/delay delta. This is the one place ego and reliability
actually bite - a high-ego, unreliable cast doesn't lower skill, it raises
the odds of an expensive, quality-sapping on-set incident.

### 5.10 Department breakdown & review blurbs (`engine/reviews.ts`, `data/reviewBlurbs.ts`)

`computeQualityBreakdown` (5.1) already produces six per-department
sub-scores on its way to the single Quality Score, but until now only the
final number survived to `FilmResults` - the breakdown was computed and then
thrown away. `FilmResults` now carries all six (`scriptScore`,
`directionScore`, `actingScore`, `productionScore`, `postProductionScore`,
`eventsScore`) and the Results screen shows them as their own "Department
Breakdown" card, so a player can see *why* a film scored the way it did -
weak acting on an otherwise well-made film, or a great script undercut by a
cheap production - rather than reasoning backward from one number.

`engine/reviews.ts:pickDepartmentBlurb` turns that same breakdown into one
extra line of review prose, appended after the usual critic/audience-quadrant
blurbs (`pickReviewBlurbs`, unchanged). It finds the single weakest and
single strongest of the five *craft* departments (script/direction/acting/
production/post-production - `eventsScore` is excluded here, since bad luck
on set isn't a craft failing worth a critic blaming someone for) and:

- If the weakest department scores below 45, it gets criticized.
- Else if the strongest scores 70+ *and* nothing is weaker than 55 (i.e.
  there's genuinely no soft spot to call out), the strongest gets praised
  instead.
- Otherwise - nothing stands out enough either way - no department line is
  added, rather than manufacturing an opinion the numbers don't support.

When the department in question (script/acting/production only - direction
and post-production have no per-genre importance weighting to key off, see
5.1) happens to be that genre's **signature department**
(`engine/genreWeights.ts:genreSignatureDepartment` - whichever of
script/acting/production importance is highest in that genre's
`GenreProfile`, reusing the same derived-not-hardcoded pattern as
`computeQualityWeights`), the line is drawn from a genre-flavored bank
instead of the generic one (`data/reviewBlurbs.ts:GENRE_SIGNATURE_CRITICISM`/
`GENRE_SIGNATURE_PRAISE`) - cheap effects sting harder in a critic's voice on
a Sci-Fi film than a Drama, and a script's emotional stakes matter more to a
Horror or Drama review than an Action one. Concretely: Action/Sci-Fi/Fantasy
signature is production, Comedy/Romance signature is acting, and
Drama/Horror/Thriller signature is script - computed from each genre's
existing importance fields, not hand-mapped, so retuning `data/genres.ts`
automatically keeps the signature assignments correct.

### 5.11 Tone profiles & compatibility (`engine/compatibility.ts`, `data/tones.ts`)

Casting used to be a single genre-affinity lookup: every talent had one
number per genre, and "does this director suit this film" only ever meant
"does this director suit *Horror*." That collapsed every Horror film into
the same question, and made a talent's fit about the genre label rather
than the specific script. It's been replaced with a shared six-axis tone
profile (`types/index.ts:Tone` - `action`, `comedy`, `romance`, `suspense`,
`drama`, `spectacle`, each 1-100) that scripts, directors, and actors all
carry, plus a compatibility function that measures how well two profiles
match:

```
compatibility(scriptTone, talentTone) =
  100 - Σ( scriptTone[tone] * |scriptTone[tone] - talentTone[tone]| ) / Σ( scriptTone[tone] )
```

The weighting is the whole point: each tone's contribution to the distance
is scaled by how much *the script* leans on that tone, not by a flat
average. A talent who's weak at comedy barely loses anything on a script
that isn't comedic at all, because the comedy term's weight is small - but
that same weakness costs them heavily on a script built around it. This is
what makes casting a genuine trade-off instead of "hire whoever has the
highest average stat": a director who's a suspense/drama specialist and
mediocre everywhere else can still be a near-perfect match for a
suspense-and-drama-heavy script (`engine/compatibility.ts`).

`compatibility()` replaced the single `genreAffinity()` lookup at every one
of its call sites in `engine/scoring.ts` - `computeDirectionScore`,
`computeActingScore`, and `computeGenreFitScore`'s `talentFit` term - with
no other change to those formulas' shape or weights, so this was a
drop-in swap of what "fit" means, not a rebalance of how much it matters.

**Where the two vectors come from:**

- **Talent** rolls its `toneProfile` at generation time the same way as
  everything else about them (see 5.8) - 1-2 signature tones high, the rest
  low and noisy - independent of genre entirely, since talent is a
  persistent studio resource that outlives any one film's genre choice.
- **Scripts** get a `toneProfile` centered on their genre's `canonicalTone`
  (`data/genres.ts`) with ±20 random jitter per axis
  (`engine/scriptGenerator.ts`). This is also how multi-genre blending
  happens, with no separate secondary-genre field: a Horror script
  (canonical tone leans hard on `suspense`) that happens to jitter unusually
  high on `comedy` and low on `suspense` is, mechanically, already most of
  the way to being a horror-comedy - genre is a starting point in
  tone-space, not a hard category. This was deliberately scoped as the
  *only* multi-genre mechanism for now, in place of a dedicated
  primary/secondary-genre picker - simpler, and free once the tone system
  exists; an explicit picker remains a natural addition later if emergent
  variance alone doesn't feel controllable enough in play.

Genre as a categorical field (`Genre`, the wizard's genre step,
`GENRE_PROFILES`'s non-tone fields) is otherwise untouched -
`computeQualityWeights`, `computeProductionScore`, and the VFX/practical mix
still key off the genre label directly, because those are production-lever
questions ("how much does this genre reward VFX spend") that a tone vector
doesn't answer any better than a category does. Only the "does this specific
person suit this specific script" question moved from genre-keyed to
tone-vector-keyed.

**UI:** the Hire Talent screen shows a collapsed `Compatibility: NN` figure
per candidate card rather than the full six-axis breakdown, so a card stays
scannable at a glance - showing all six numbers on every card at once is
exactly the wall-of-stats micromanagement this game avoids elsewhere. Click
or hover it (`components/common/CompatibilityBadge.tsx`) to reveal the
talent's own tone profile as six mini score bars, for the borderline
casting calls where "why is this number what it is" actually matters. The
toggle button stops its click from bubbling to the card's own `onClick`, so
inspecting a candidate's breakdown never accidentally hires or un-hires
them.

## 6. Cost model (`engine/cost.ts`, `state/selectors.ts`)

Final results break costs into two headline numbers:

- **Final production cost** = script cost + total cast salary + production
  budget cost (`budgetAmount x shootingCostMultiplier x runtimeCostMultiplier`,
  plus the set/practical-effects/VFX spend amounts directly) + net event cost
  delta + test-screening cost.
- **Marketing cost** = marketing spend tier x release-type cost multiplier
  (Wide costs more to support than Limited).

`profit = totalBoxOffice - (productionCost + marketingCost)`.

## 7. Data-driven config

Everything a designer would want to retune without touching engine code
lives in `src/data/`:

| File | Contents |
|---|---|
| `genres.ts` | Popularity, VFX/practical/acting/script importance, low-budget tolerance, and canonical tone profile per genre |
| `tones.ts` | The six tone axes (`TONES`) and their display labels, shared by scripts and talent (see 5.11) |
| `audiences.ts` | Market size per target audience |
| `talentGeneration.ts` | Per-role salary range and fame ceiling for procedural talent, the mandatory/optional role lists, and per-role hiring capacity (`{min, max}`) |
| `talentNames.ts` | First/last name word banks for procedurally generated talent |
| `scriptWords.ts` | Per-genre title word banks for procedural script titles |
| `production.ts` | Ranges and anchors for the six continuous production dials (see 5.7) |
| `postProduction.ts` | Cost/score deltas for edit style, music, test screening, final cut |
| `release.ts` | Marketing spend tiers, release type profiles, release window bonuses |
| `productionEvents.ts` | The generic pool of on-set event templates, plus `GENRE_EVENT_TEMPLATES` (one positive/negative pair per genre, merged into the generic pool for that film's shoot) |
| `reviewBlurbs.ts` | Flavor-text review snippets bucketed by critic/audience reception, plus per-department criticism/praise lines (generic and genre-signature-flavored) used to call out a film's clear weak or strong point |
| `scoringWeights.ts` | The weighted-sum tables for critic/audience, and the base (genre-average) quality weights that `engine/genreWeights.ts` tilts per genre |

Rebalancing the game should almost always mean editing a table in this
folder, not a formula in `engine/`. The one exception is the interpolation
math itself (`engine/interpolate.ts`, `engine/productionDials.ts`,
`engine/talentGenerator.ts`) - that's engine code because it's genuinely
logic (log-scale conversion, piecewise interpolation), not just numbers, but
it's written so every number it needs comes from `data/`.

## 8. Known limitations / next steps

Things noticed during build/playtest that are worth flagging rather than
quietly leaving implicit:

- **Talent persists but still has no scheduling or relationships.** The
  roster now lives in `studio.talentPool` and is the same across every film
  in a save (Section 5.8), so "the same actor across films" exists as a
  concept - but nothing yet tracks whether someone's "busy" on another
  project, builds loyalty/grudges from repeat collaboration, or lets an
  actor's fame/skill drift over time based on how their films performed. All
  natural next layers on top of a persistent roster.
- **Candidate sampling is randomized, not exhaustive.** ~100 stratified
  candidates per role gives dense coverage, but it's still finite - the
  single cheapest (or single best) possible hire for a role won't always be
  in the pool. Unlike before, there's no reroll to fall back on (rerolling a
  persistent named roster would discard whoever's already been hired
  elsewhere) - what's in the pool for that save is what's available, for the
  life of that save. This is deliberate (real casting doesn't offer infinite
  options either) but worth knowing when reasoning about "why didn't I see
  anyone under £X".
- **Buzz and Marketability scores are computed but not fully load-bearing.**
  Buzz shows on the results screen; Marketability doesn't surface anywhere
  yet. Both are clean hooks for a pre-release hype mechanic.
- **Multi-genre blending is emergent only, not player-directed.** A script's
  tone profile (5.11) can drift toward a second genre through jitter alone,
  but there's no secondary-genre picker giving the player deliberate control
  over that blend - a natural addition if the random variance doesn't feel
  controllable enough in practice.
- **No AI rival studios, awards, franchises, scandals, or physical
  facilities** - all explicitly out of scope for the MVP per the brief, and
  all should slot in as new `data/` + `engine/` modules plus one more studio
  field, without touching the wizard flow.
- **Balance is tuned, not proven.** The scenario table in 5.4 was produced by
  running the real engine (`engine/boxOffice.ts`) against a handful of
  representative inputs by hand - there's no automated test suite pinning
  these numbers yet. Worth adding before any serious rebalancing pass, so
  future tuning doesn't silently break the "expensive bad films flop" promise.
