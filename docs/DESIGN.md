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
   -> Develop Film       (title, genre, buy a script, then Target Audience -
                          pre-filled from the script's own intended audience)
   -> Hire Talent        (director, lead actor, supporting actor, writer, composer, editor, +VFX supervisor -
                          each a price slider over procedurally generated candidates)
   -> Production Planning(five continuous sliders: contingency, sets, effects, VFX, runtime -
                          plus a recommended principal-photography day count)
   -> Filming             (full recap of script/cast/crew/production plan and their
                          costs before you commit, then live day-by-day photography -
                          watch the shoot happen and wrap it whenever you choose)
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

- **Studio** - `name`, `cash`, `reputation` (0-100), `totalDays` (the
  in-game calendar - a single running day count, see 5.16), `filmsReleased[]`,
  `talentPool` (the persistent hireable roster, one array per role). This is
  the only thing that persists between films.
- **Film** - a fully-resolved, released film: its script, its cast, every
  choice made producing it, its rolled events, and its final `FilmResults`.
  Immutable once created; lives forever in `studio.filmsReleased`.
- **Script** - `genreFit`, `originality`, `structure`, `dialogue`,
  `marketability`, `complexity` (all 1-100), a `cost`, a `toneProfile`
  (see [Section 5.11](#511-tone-profiles--compatibility-enginecompatibilityts-datatonests)),
  `requiredLeads`/`requiredSupporting` (how many Lead/Supporting Actor slots
  this script actually has - drives Hire Talent's capacity for those two
  roles, see `engine/castRequirements.ts`), and an `intendedAudience` that
  pre-fills (but doesn't lock) Target Audience once picked. Generated
  procedurally per genre (see `engine/scriptGenerator.ts`).
- **Talent** - a discriminated union by role, not one flat shape (see
  [Section 5.11](#511-tone-profiles--compatibility-enginecompatibilityts-datatonests)):
  `fame`, `reliability`, `ego`, `salary` (all 1-100 except salary) are
  common to every role, but Director additionally carries `skill` and a
  `toneProfile` shared with Script, Lead/Supporting Actor carry an
  `actingStyle` (their own five-axis vocabulary) instead of `skill` or
  `toneProfile`, and everyone else (Writer/Composer/Editor/VFX Supervisor)
  just has `skill`. Generated once per role when a `Studio` is created and
  kept for the life of the save in `studio.talentPool` (see
  [Section 5.8](#58-procedural-talent-generation-enginetalentgeneratorts)) -
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

**Cash is only ever mutated once per film for costs, at `RELEASE_FILM`.**
Every earlier screen (buying a script, hiring cast, planning production,
test screenings) just *previews* a projected spend via
`state/selectors.ts:computeCommittedSpend` - nothing is actually deducted
until release, when the reducer computes the complete cost breakdown fresh
from the finished draft and deducts `totalCost` in one step. Box office
*revenue* is the one exception - it lands gradually instead, credited week
by week as a film's theatrical run actually plays out rather than added in
the same step as the cost deduction (see 5.19).

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
| **Acting** | `lead*.7 + avg(supports)*.3`, each just `compatibility(actor, script)` | No actor hired -> flat 30 for that slot. Unlike Direction, there's no separate skill term - an actor's ActingStyle *is* their skill (see 5.11). Supporting Actor can be an ensemble (see 5.8/5.9) - more of them *averages* the group's fit, it doesn't add up. |
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
Critic   = quality*.45 + script.originality*.2 + direction*.2 + editStyleScore*.15 + releaseType.criticBonus
Audience = genreFit*.3 + leadActorFame*.2 + entertainment*.3 + production*.2
```
(`data/scoringWeights.ts:CRITIC_WEIGHTS` / `AUDIENCE_WEIGHTS`, computed in
`scoring.ts:computeCriticScore` / `computeAudienceScore`.)

`releaseType.criticBonus` is a small flat addend, not a weighted term - it's
how Festival First delivers on "helps critics and awards-style films"
(`data/release.ts:RELEASE_TYPE_PROFILES`, +6 for Festival First, 0 for
Streaming/Wide, +2 for Limited). `entertainment` folds in edit-style and
final-cut-focus audience deltas plus a slice of the quality score.

Audience Score has **no marketing term**, on purpose. That's a deliberate
cut, not an oversight: marketing builds awareness of a film, it doesn't make
the people who actually watch it enjoy it any more than they otherwise
would - so it has no business informing how much an audience liked what
they saw. Marketing's entire effect lives in Buzz instead (below), which
only ever touches Opening Weekend, never the audience's actual verdict.

### 5.3 Buzz Score (`scoring.ts:computeBuzzScore`)

Buzz is **pre-release hype, not reception** - a completely different
question from Critic/Audience Score, and it drives a different half of box
office (Opening Weekend, see 5.4) for exactly that reason: hype gets people
into a seat on day one whether or not the film is any good; whether they
liked it is a separate question that Buzz has no opinion on.

```
Buzz = 10 + (avgFame(director, leads) - 50)*.5 + (studioReputation - 50)*.4
          + marketingBuzzContribution(marketingSpend) + eventsBuzz + musicBuzz + finalCutBuzz
          + (script.marketability - 50)*.2
```
clamped 0-100. Three things dominate on purpose - fame, reputation and
marketing spend - because those are the three real levers a studio actually
has over hype. Crucially, **only one of the three is for sale**: marketing
spend is pure cash, but fame and reputation aren't - fame comes from who
you cast (itself a function of prior success funding better hires), and
reputation is earned by how your past films were received
(`engine/reputation.ts`). A wealthy but unknown studio with an anonymous
cast still can't buy its way past roughly a fame+reputation-less ceiling
(base + max marketing contribution alone, before the fame/reputation terms
even engage) - buzz above that requires an actual track record, not just a
bigger cheque. `marketingBuzzContribution` reads off a log-scale anchor
curve (`data/release.ts:MARKETING_SPEND_ANCHORS`), the same interpolation
pattern as every other spend dial.

### 5.4 Box office (`engine/boxOffice.ts`)

Box office is computed in **two stages, not one lump sum** - this was a
deliberate rebuild (see the earlier single-stage version's balance problems
in Section 8) modeled on how box office actually behaves: an opening
weekend driven by hype, and a "legs" multiplier - how many further multiples
of that opening the film goes on to earn - driven by whether audiences
(and, to a lesser extent, critics) actually liked it.

```
Opening Weekend = OPENING_BASE_POTENTIAL (£24,000,000)
    * targetAudience.marketSize
    * (genre.popularity / 100)
    * releaseWindow.baseMultiplier * releaseWindow.genreBonus (e.g. Halloween x Horror = 1.45)
    * releaseType.reachMultiplier
    * hypeFactor(buzzScore) (0.15 - 1.5)
    * variance              (band scaled by releaseType.varianceMultiplier)

reviewWeighted    = audienceScore*.65 + criticScore*.35   // audience matters more than critics for legs
reviewLegsFactor  = 0.25 + (reviewWeighted / 100) * 1.6    // 0.25 - 1.85
legs              = max(1, releaseType.baseLegsMultiplier * reviewLegsFactor)  // never less than 1x - the floor is "died after opening", not negative legs
```

`legs` no longer multiplies straight into a single `totalBoxOffice` figure
here - as of 5.19 it's spent out week by week over the actual run instead
(`retention = 1 - 1/legs`), so `totalBoxOffice`/`studioRevenue`/`profit`
aren't known until that run finishes. See 5.19 for the weekly mechanics;
this section still fully describes Opening Weekend and where `legs` itself
comes from, both still computed exactly this way at release.

Production budget deliberately has **no term here at all**, even though an
earlier version of this formula gave it one (`budgetScaleFactor`, 0.4-1.6,
"bigger budgets buy wider prints"). That didn't survive scrutiny: audiences
can't see how nice your sets or effects look before they've bought a
ticket, so budget isn't something that should draw an opening-weekend
crowd - it's something that affects whether they enjoyed what they saw
once they did. Budget already has a real, correctly-ordered path to box
office: it feeds `computeProductionScore`, which feeds Quality Score,
which feeds Critic/Audience Score, which feeds legs, above. Giving it a
*second*, independent lever directly on Opening Weekend was redundant with
that, and it was diluting Buzz's effect on the one number Buzz is supposed
to dominate - a high-buzz film could still open unimpressively if the
budget slider happened to be modest, for no reason a player would find
intuitive. Removing it and re-tuning `OPENING_BASE_POTENTIAL` upward to
compensate made Buzz's effect on Opening Weekend cleaner and more direct:
holding a mid-budget film's reach/release fixed and varying only
reputation (and therefore Buzz), Opening Weekend now moves from £13.1M
(reputation 10, buzz 41) to £21.7M (reputation 95, buzz 75) - a clean,
monotonic, single-cause relationship.

`releaseType.baseLegsMultiplier` (Limited 6.5, Wide 2.9, Streaming 4.0,
Festival First 8.0) is "how many multiples of the opening does an
*average*-reviewed film in this release type end up grossing" - a wide
release front-loads hard by design; a limited release that catches on can
expand for months, hence the much bigger multiple. `totalBoxOffice` stays
the big number the game reports everywhere (matching how box office is
always reported in the real world); `studioRevenue` is the smaller number
profit actually comes from, reflecting that theaters and international
distributors keep the majority of ticket revenue - real-world studio
rentals average roughly 40% of worldwide gross, which is where the 0.42
figure comes from, not an arbitrary tuning choice.

The split has a genuine gameplay payoff, not just a realism one - hype and
reception can now pull in opposite directions:

| Scenario (same release, only buzz vs. reviews vary) | Opening | Total | Total/Opening |
|---|---|---|---|
| High hype (buzz 90), bad reviews (critic 30, audience 25) | £28.7M | £56.5M | 1.97x - opens big, dies fast |
| Low hype (buzz 25), great reviews (critic 85, audience 90) | £10.3M | £49.5M | 4.82x - modest opening, real legs |
| High hype **and** great reviews | £28.7M | £138.5M | 4.82x - the actual blockbuster case |
| Low hype **and** bad reviews | £8.8M | £17.4M | 1.97x - a non-event |

The first two rows land at similar *totals* through completely different
paths - a marketing-and-star-power play versus a word-of-mouth sleeper -
which is the whole point: buying hype and making something people love are
two different skills, and this is what lets either one work without making
the other pointless.

These numbers (`OPENING_BASE_POTENTIAL`, the hype/legs floor-ceiling pairs)
were tuned by running scenario scripts through the real engine, the same
way the original single-stage formula was - see Section 8 for the specific
before/after comparisons that motivated both rebuilds (the original
single-stage formula, and later the removal of the redundant budget term).

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

The five Production Planning sliders (contingency, set quality, practical
effects, VFX spend, runtime) are genuinely continuous - dragging one
changes cost and quality smoothly across the whole range, not in 4-ish
discrete jumps. The pattern is the same for all five:

1. `data/production.ts` declares a **range** (for the four currency dials,
   e.g. `CONTINGENCY_RANGE = { min: 100_000, max: 40_000_000 }`) and a
   handful of **anchors** - calibration points at a slider position `t`
   (0-1) with the quality/cost-multiplier values that apply there, plus a
   description.
2. `engine/interpolate.ts` has the generic math: `logT`/`logAmount` convert
   between a currency amount and its 0-1 slider position on a *log* scale
   (so the cheap end - where a real indie budget lives - gets just as much
   slider resolution as the expensive end), and `interpolateScale` does
   piecewise-linear interpolation of a named value between whichever two
   anchors bracket the current `t`.
3. `engine/productionDials.ts` wires the two together into named functions
   (`contingencyQuality`, `runtimeCostMultiplier`, `vfxScore`, ...) that
   `engine/cost.ts`, `engine/scoring.ts` and `engine/production.ts` all call.

There used to be a sixth dial, Shooting Style (Fast↔Perfectionist,
`SHOOTING_ANCHORS`) - removed entirely, see 5.16. How meticulously a film
is shot is no longer something set in advance on a slider; it's read off
how principal photography actually went.

Flavor text still comes in a handful of qualitative bands (`describeScale`
picks whichever anchor's description is closest to the current `t`) - there
isn't infinite unique English for infinite slider positions, and there
doesn't need to be. The numbers are what actually needed to stop jumping;
the words were never the problem.

This is also what makes a true shoestring film possible: the contingency
range's floor is £100,000 (not the old "Cheap" tier's £900,000 base cost),
and the same log-scale treatment applies to set quality, practical effects
and VFX spend, so a genuinely bare-bones production - all five dials at the
bottom - costs about £98,750 in production spend alone (see the scenario
table in 5.4: a full indie film, script and cast included, lands around
£840,000 total).

**The first dial isn't "the budget" - it's the contingency/overhead
margin, and that distinction is load-bearing (5.9, 5.16).** It was
originally called "Production Budget," which read as "the total cost of
making this film" even though it was always just one of five things that
*sum* to the real total - set, practical, VFX and runtime all add on top
of it. Renamed to `contingencyAmount`/"Contingency Reserve" to match what
it actually represents: crew size, equipment, insurance, general overhead,
and the safety margin that offsets risk from ambitious choices made
elsewhere. It's no longer a flat lump sum, either - it's spent as a daily
burn rate over however many days principal photography actually takes
(`engine/cost.ts:computeDailyContingencyBurn`, 5.16), so
`computeProductionBudgetCost` only covers set/practical/VFX/runtime now;
contingency's actual cost lives in `PhotographyState.runningCost`. It
still feeds 35% of Production Score (`contingencyQuality`) and is now a
mitigating term in three of the four risk dimensions knowable before
filming (5.9). Genre Fit's cheapness check and the Budget Risk dimension
both read `overallSpendT` (all four spend dials' own log-scale position,
averaged) instead of `contingencyAmount` alone, since "does this look
cheap" and "is this production over its head" are honestly about total
spend, not one arbitrarily-privileged dial.

### 5.8 Procedural talent generation (`engine/talentGenerator.ts`, `data/talentGeneration.ts`)

There's a fixed roster, but it's procedurally generated rather than
hand-authored. `generateTalentPool(rng)` runs once, when a `Studio` is first
created (`state/gameState.ts:createInitialStudio`), and produces ~100
candidates per role (200 for Lead Actor and Supporting Actor specifically -
`talentGenerator.ts:ROLE_POOL_SIZE` - since a script can now require several
leads or a big supporting ensemble at once, see 5.11's castRequirements
note, and a price band needs enough genuinely distinct people in it to cast
an ensemble from), each sampling a salary from a stratified band on a log
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

Given a candidate's position `t` on that log scale, the common stats:

```
fame        = 10 + (roleFameCeiling - 10) * t   + noise(±12)
reliability = 45 + 25 * t                        + noise(±30)
ego         = 15 + fame * 0.45                    + noise(±20)
```

Fame scales up with price *on average*, but the noise band is wide on
purpose: a cheap unknown can be a hidden gem, an expensive hire can still
disappoint. Reliability and ego are only loosely tied to price -
professionalism isn't for sale, and neither is a diva-free set.
`roleFameCeiling` caps how famous a role can plausibly get even at the top
of its pay scale - 98 for Director/Lead Actor, down to 45 for Editor - since
below-the-line crew don't become household names the way stars do.

What else gets rolled depends on the role, since `Talent` is a discriminated
union (5.11 explains why):

```
skill = 25 + 65*t + noise(±20)     - Director and crew roles only
toneProfile / actingStyle = 1-2 random "signature" axes at random(70,100), the rest at random(10,55)
                                    - Director gets toneProfile (6 axes, shared with Script)
                                    - Actors get actingStyle (5 axes, their own vocabulary) instead of skill
```

Both `toneProfile` and `actingStyle` share the same generation shape
(`talentGenerator.ts:generateSignatureProfile`, generic over the axis list)
- 1-2 signature axes rolled high, the rest low and noisy, rather than
sampling every axis independently. Independent uniform rolls regress
everyone toward an unmemorable middle, which loses the "brilliant at
suspense, hopeless at comedy" specialist feel a real cast/crew has. Every
candidate gets a full profile at creation time, not one tied to whatever
genre happens to be selected - this is what makes the pool genre-agnostic
and reusable: switching a film's genre mid-draft (`SET_GENRE`) just changes
which script slate gets regenerated, it doesn't touch who's hireable or who
you've already hired.

On the Hire Talent screen, each role gets its own price slider (`SET_TALENT_TARGET_PRICE`)
that filters that role's pool members down to whoever's genuinely close
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
(`SET_TALENT_BUDGET_SPLIT`) splits a total evenly *per head*, not per role,
as a starting point - the player is free to tilt any individual role's
slider up or down afterward to over- or under-spend relative to that split.
Per head matters because of the capacity point below: the split divides by
the sum of every mandatory role's `effectiveRoleCapacity(...).max`, not by
`MANDATORY_TALENT_ROLES.length`. The original version divided by the flat
role count, which quietly understated the target price for Lead Actor and
Supporting Actor on any script that needed more than one of either - a
script needing 2 leads and 4 supporting actors has 10 mandatory heads to
cast, not 6, and splitting a £3M budget six ways instead of ten ways set
every multi-hire role's per-candidate target 67% too high, so hiring the
suggested number of people at that price could overshoot the intended
budget substantially without the slider ever suggesting anything looked
wrong. Verified via `SET_TALENT_BUDGET_SPLIT` directly: for that same 2
lead / 4 supporting script, `price × capacity` summed across all six roles
now lands within rounding of the master budget figure exactly, where the
old flat split implied roughly 1.67x the budget actually set.

**Role capacity** (`RoleCapacity`, `{ min, max }`) governs how many people a
role can hold, checked in two places - the reducer (`TOGGLE_TALENT_FOR_ROLE`
refuses to add past `max`; `min` drives the "still need to hire" validation
on the Continue button) and the Hire Talent screen (cards for candidates you
haven't hired grey out and show "Cast full" once `max` is reached, but an
already-hired card stays clickable so you can un-hire them). Director,
Writer, Composer and Editor are fixed at `{1,1}` (hire one, replacing swaps
who); VFX Supervisor is `{0,1}` (optional). Lead Actor and Supporting Actor
are different: their capacity isn't a static number at all, it comes from
the chosen script's own `requiredLeads`/`requiredSupporting`
(`engine/castRequirements.ts:effectiveRoleCapacity`) - a script that calls
for two leads makes Lead Actor a `{2,2}` role for that film, the same
toggle-based multi-hire UI Supporting Actor already used generalizing to
cover it with no new reducer action needed. `data/talentGeneration.ts:ROLE_CAPACITY`
is still the fallback these two roles use before a script is picked, and
the only source of truth for every other role. Hiring more people into a
multi-slot role doesn't add their contributions up; it *averages* them
(see the Acting sub-score, 5.1) - a bigger cast is about hedging and
flavor (spreading compatibility risk, more reliability data points feeding
production risk in 5.9), not a free quality multiplier. Two singular-role
actions exist because the semantics genuinely differ: `SET_TALENT_FOR_ROLE`
replaces/toggles a `{1,1}` role in place, `TOGGLE_TALENT_FOR_ROLE`
adds-or-removes against a role that can hold more than one - which of the
two fires is decided purely by whether `capacity.max === 1` at the moment
of the click, so Lead Actor transparently switches behavior film-to-film
based on what that film's script needs.

### 5.9 Production risk profile & contextual events (`engine/production.ts`, `data/productionEvents.ts`)

Rebuilt from a single blended risk score into independent-enough
dimensions, each 0-100 and each driving its own event pool - the direct fix
for "planning choices should create a risk profile, not apply flat
modifiers, and events should emerge from that profile" rather than a
generic positive/negative roll a player can only read as pure RNG.

**Why five, not the ten originally proposed.** The design brief floated ten
hidden values (Pressure, Preparedness, Morale, Safety, Technical
Complexity, Creative Freedom, Schedule Risk, Budget Risk, Spectacle
Potential, Performance Potential). Each was tested for a genuinely distinct
input *and* a genuinely distinct output before being kept:

- **Pressure, Preparedness, Schedule Risk** all read off the same
  underlying signal (did the shoot get enough time) - merged into one,
  **Schedule Pressure**.
- **Creative Freedom** has no concrete input in the current game (no
  studio-executive/producer-notes mechanic exists to be constrained by) and
  no output distinguishable from a Morale event once you take away inputs
  it'd need - cut.
- **Spectacle Potential** and **Performance Potential** aren't risk at all,
  they're Production Score and Acting Score under new names - tracking
  them again as "hidden profile" values would mean carrying the same
  number twice, the exact double-counting the box office rework (5.4)
  spent real effort removing - cut.
- **Morale, Safety, Technical Complexity, Budget Risk, Schedule Pressure**
  each survived with a real input nothing else owns and a real output
  category nothing else covers - kept.

**Four of the five are knowable before a day of filming happens
(`StaticProductionRisk`, `engine/production.ts:computeStaticProductionRisk`);
the fifth, Schedule Pressure, isn't - it depends on how many days the
player actually decides to shoot for, which didn't exist as a concept
until 5.16 turned photography into something the player lives through
instead of a slider they set in advance. It's computed separately, live,
every day of the shoot (`computeSchedulePressure`), not shown as a
pre-shoot estimate at all.**

```
moraleRisk           = unreliabilityRisk*.6 + avgEgo*.4
safetyRisk           = 20 + practicalAmbitionT*60 - contingencyT*35
technicalComplexity  = 15 + vfxAmbitionT*45 + complexityT*30 - contingencyT*15
budgetRisk           = 20 + (genreAmbition - overallSpendT)*60 + (complexityT - overallSpendT)*20
schedulePressure     = ratio>=1 ? 30-(ratio-1)*20 : 30+(1-ratio)*90   // ratio = daysElapsed/recommendedDays
```

`moraleRisk` is the interpersonal-friction chunk already in the old single
score, just isolated. `safetyRisk` and `technicalComplexity` are the two
dials that used to feed nothing but Production Score -
`practicalEffectsAmount` and `vfxAmount` now each drive a real risk
dimension, offset by `contingencyT` (the safety margin 5.7 describes),
which is the concrete version of "high practical effects, low contingency,
fast pace → stunt injury" from the original brief (fast pace is now
something the player lives rather than pre-sets, see 5.16, so it shows up
through Schedule Pressure instead of as a term here). `budgetRisk` is a
genre-aware upgrade of the old budget-alone U-curve: risk when *this
genre's* VFX/practical ambition or *this script's* complexity outpaces
overall spend, not "is the number low" in isolation - an Action film and a
Drama at the same shoestring spend no longer carry the same risk (verified
directly: same spend, Action budgetRisk=48 vs. Horror budgetRisk=33, since
Horror's `lowBudgetFriendly`/lower VFX-practical importance means the same
spend suits it better). `schedulePressure` is a floor-30 curve either side
of the recommended schedule - falling short is steep, meeting or
comfortably exceeding it is calm but never zero (there's always *some*
pressure) - the same shape as `shootingQualityFromRatio` (5.7, 5.16) since
they're two readings of the same underlying "how did the shoot actually
go" signal, one as risk, one as quality.

**Contextual events.** `data/productionEvents.ts:RISK_DIMENSION_EVENT_TEMPLATES`
has a `{ positive, negative }` bank per dimension, all five included (40
templates total, on top of the 12 generic + 16 genre templates already
there - 68 total, up from 13 at the start of this feature).
`engine/production.ts:rollDayEvent` is called once per
`ADVANCE_SHOOTING_DAY` (5.16, not once per whole shoot the way the old
batch-of-3-to-5 `simulateProduction` was) - it recomputes Schedule
Pressure fresh from that day's actual `daysElapsed`, combines it with the
four static dimensions, and mixes a dimension's `negative` bank into the
negative pool once that dimension reads ≥55, its `positive` bank into the
positive pool once it reads ≤35 - the same additive-pool-mixing pattern
`GENRE_EVENT_TEMPLATES` already used, just conditioned on risk instead of
genre. A mid-range dimension contributes nothing extra, so the pool
doesn't get diluted by dimensions all being vaguely-not-quite triggered
simultaneously - only a clear reading in either direction earns thematic
events. Both the *frequency* of a day producing any event at all (5%-13%
per day, scaled by the five dimensions averaged) and the positive/negative
bias of that roll move with the same average - a shoot that's clearly
struggling doesn't just unlock worse flavor text, it gets more eventful,
not just worse. Verified end-to-end, not just in isolation: a reckless
static-risk scenario (ambitious practical/VFX spend, thin contingency)
pulled `risk-safety-neg` events 91 times across 200 simulated shoots at
matched day-counts, a careful one (deep contingency, minimal effects)
pulled zero; a shoot wrapped exactly on its recommended schedule burned
its full contingency reserve to the pound.

Not yet built: a **postmortem** stage connecting which *named* events
fired back into the Results screen narrative (`storyReport.ts`, 5.13's
sibling feature) - `PhotographyState.events` already carries which
templates fired, so the data exists, but nothing reads it into a beat yet.
Deliberately left for a follow-up rather than bundled in here.

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

### 5.11 Tone profiles, acting style & compatibility (`engine/compatibility.ts`, `data/tones.ts`, `data/actingStyle.ts`)

Casting used to be a single genre-affinity lookup: every talent had one
number per genre, and "does this director suit this film" only ever meant
"does this director suit *Horror*." That collapsed every Horror film into
the same question, and made a talent's fit about the genre label rather
than the specific script. It's been replaced with a shared six-axis tone
profile (`types/index.ts:Tone` - `action`, `comedy`, `romance`, `suspense`,
`drama`, `spectacle`, each 1-100) plus a compatibility function that
measures how well two profiles match:

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

**Only Director shares tone-space directly with Script.** Actors have their
own, deliberately different, five-axis vocabulary -
`types/index.ts:ActingStyle`: Character Transformation, Emotional
Performance, Charisma, Comedy, Physical Performance - reached the same way
Director's stats are (1-2 signature axes high, the rest low and noisy, see
5.8), but it isn't compared to a script directly. Instead
`engine/compatibility.ts:deriveToneFromActingStyle` translates it into a
synthetic `ToneProfile` first, via a weighted-average mapping
(`data/actingStyle.ts:ACTING_STYLE_TONE_WEIGHTS`):

| Tone | Pulls from (weighted) |
|---|---|
| action | Physical Performance ×3, Charisma ×1 |
| comedy | Comedy ×3, Charisma ×1 |
| romance | Emotional Performance ×2, Charisma ×2 |
| suspense | Character Transformation ×2, Emotional Performance ×2, Charisma ×1 |
| drama | Character Transformation ×3, Emotional Performance ×2, Charisma ×1 |
| spectacle | Physical Performance ×1, Charisma ×2 |

Comedy and Physical Performance are clean specialists, each speaking to
essentially one tone. Character Transformation and Emotional Performance
both lean into the "serious" cluster (drama/suspense/romance) but in
different proportions - Transformation is more drama-coded (the classic
"disappears into the role" performance), Emotional Performance spreads more
evenly. Charisma is the one generalist, contributing a smaller share of
*every* tone rather than owning one - including spectacle, so a genuinely
charismatic, physically committed star still earns some credit for
anchoring a blockbuster even though acting style otherwise has little to do
with production scale. Once translated, the exact same `computeCompatibility`
formula runs - actors don't get a second scoring formula, just a translation
step in front of the same one. `engine/compatibility.ts:computeTalentCompatibility`
is the single entry point that dispatches on role: Director compares its
`toneProfile` directly, Actors go through the translation first, and crew
roles (Writer/Composer/Editor/VFX Supervisor) have neither, so it returns
`null` for them rather than a meaningless number.

One consequence worth stating plainly: **actors have no separate `skill`
stat.** Director's contribution is `skill*.6 + compatibility*.4` - two
distinct signals, general craft and specific fit. An actor's contribution
is `compatibility` alone (5.1) - their five ActingStyle numbers are both
their skill and their fit, together, so a Comedy specialist with Comedy=95
simply *is* very good at comedy, full stop, rather than having a separate
generic "acting skill" moderating that. This was a deliberate choice over
keeping `skill` alongside the five axes: two overlapping "how good are they"
signals would have made the new axes redundant with the thing they were
meant to replace.

`compatibility()`/`computeTalentCompatibility()` replaced the single
`genreAffinity()` lookup at every one of its call sites in
`engine/scoring.ts` - `computeDirectionScore`, `computeActingScore`, and
`computeGenreFitScore`'s `talentFit` term - with no other change to those
formulas' shape or weights beyond dropping the actor skill term above, so
this was mostly a drop-in swap of what "fit" means, not a rebalance of how
much it matters.

**Where the profiles come from:**

- **Director** rolls its `toneProfile` at generation time the same way as
  everything else about them (see 5.8) - independent of genre entirely,
  since talent is a persistent studio resource that outlives any one film's
  genre choice.
- **Actors** roll their `actingStyle` the same shape, just over the
  five-axis list instead of the six-tone one.
- **Scripts** get a `toneProfile` centered on their genre's `canonicalTone`
  (`data/genres.ts`) with ±15 random jitter per axis, *then* 0-2 "flavor"
  tones get boosted by a further +20..+35 on top (`engine/scriptGenerator.ts`,
  `FLAVOR_COUNT_WEIGHTS` - roughly 25% of scripts stay a "straight" genre
  film, 50% get one flavor, 25% get two). This is deliberate, not
  incidental: jitter alone mostly just adds noise around one point, so an
  "Action" script stayed close to pure action nearly every time, which
  doesn't match how genre actually works - most action films aren't *just*
  action (buddy-cop action is action-comedy, plenty of action leans hard
  into romance or revenge-drama alongside the stunts). Flavor boosts are
  what actually produce that variety: a Horror script that rolls a comedy
  flavor boost is, mechanically, a horror-comedy; one that rolls a drama
  boost reads as a tragedy with scares. This is also the *only* multi-genre
  mechanism, in place of a dedicated primary/secondary-genre picker -
  simpler, free once the tone system exists, and (per playtesting) already
  produces enough variety that an explicit picker hasn't felt necessary; one
  remains a natural addition later if that changes.

Genre as a categorical field (`Genre`, the wizard's genre step,
`GENRE_PROFILES`'s non-tone fields) is otherwise untouched -
`computeQualityWeights`, `computeProductionScore`, and the VFX/practical mix
still key off the genre label directly, because those are production-lever
questions ("how much does this genre reward VFX spend") that a tone vector
doesn't answer any better than a category does. Only the "does this specific
person suit this specific script" question moved from genre-keyed to
tone-vector-keyed.

**UI:** the Hire Talent and Develop screens show the full breakdown on every
card, always - a Director's six-axis tone profile, an Actor's five-axis
acting style, or (on the Develop screen, no score attached since there's no
talent yet to compare against) a script's own tone profile
(`components/common/CompatibilityBadge.tsx`). `CompatibilityBadge` takes a
generic `breakdown` list rather than a `ToneProfile` specifically, precisely
so it can serve all three without caring which. This used to be collapsed
behind a click-to-pin/hover-to-peek toggle, on the theory that showing every
number on every card at once would be too much at a glance - in practice
the toggle target was too small to comfortably hit and didn't work at all
on touch, so it came out. Always-showing it also sidesteps the layout
problem the toggle was originally built to dodge (a card that only
sometimes expands unevens out its grid row) more robustly than the toggle
did: every card in a row now renders the same amount of content, so row
heights stay consistent without needing a hover-flyout trick.

Each axis originally reused the generic `.row-between` layout (label left,
stars right, wrapping if the row ran out of space) - but the shared
`.score-bar-label` class it borrowed is a fixed 130px, which doesn't fit
next to a star rating in a narrow card, so it wrapped onto two lines with
no distinguishing spacing, and it read ambiguously which label a wrapped
star row belonged to. Fixed by giving the breakdown its own dedicated
`.compat-axis`/`.compat-axis-label` layout (label always stacked directly
above its own stars, small gap within a pair, bigger gap between pairs)
instead of reusing `.row-between`/`.score-bar-label`, which stay untouched
for their many other unrelated uses elsewhere in the app. The first pass
at that gap (2px within a pair, 6px between pairs) turned out not to be
enough contrast in practice, especially with the muted, low-weight label
color sitting next to much brighter gold stars - the label could still
get visually lost against the wrong star row. Widened to 2px/16px and
darkened the label to full text color with more weight, so the grouping
reads from contrast in both spacing and color rather than spacing alone.

Each axis in that expanded breakdown renders as a 5-star rating
(`components/common/StarRating.tsx`) rather than a raw number -
`Math.round((value/max)*10)/2` snaps the underlying 0-100 value to the
nearest half star, so there are still 10 effective levels of resolution,
just read as "3.5 stars" instead of "just do 74." A precise 0-100 figure
reads as noise once there are six-plus of them stacked in one card; a star
rating reads as an actual opinion. This is presentation-only - nothing
about the underlying numbers, formulas, or generation changed, `StarRating`
just renders whatever 0-100 value it's given (two stacked star strings, a
muted track and a colour-clipped fill, rather than swapping in a half-star
glyph that not every font renders consistently). The same component is
used for Critic Score on the Results screen, both because real film
reviews are conventionally a star rating and because it's the one
top-level score that reads more like a single opinion than a value worth
tracking precisely over time - Quality/Audience/Buzz and the Department
Breakdown stay as bars, since those benefit from comparing several values
against each other at a glance, which stars are worse at than a bar chart.

Two generation ranges were pulled in from the 1/100 extremes specifically
so this coarse display has room to show texture: genre `canonicalTone`
vectors now span roughly 20-80 rather than 10-95 (`data/genres.ts`), and
`talentGenerator.ts`'s signature/base tone-generation ranges moved from
`[70,100]`/`[10,55]` to `[65,90]`/`[15,50]`. Left at the old extremes, a
coarse 5-star bucket would mostly just flip between "empty" and "full"
with nothing in between - compressing the source range first means the
star display actually earns its granularity. Script generation
(`engine/scriptGenerator.ts`) also grew from 4 to 12 options per genre, and
`TONE_JITTER` came down from ±20 to ±15 to match the tighter source range.

### 5.12 Script synopsis (`engine/premiseGenerator.ts`, `data/premises.ts`)

Every script gets a one-sentence log-line (`Script.synopsis`), shown in
italics under the title on the Develop screen. This is deliberately built
the same way as the Results screen's Studio Report (5.10-adjacent, see
`engine/storyReport.ts`): a curated bank of pre-written sentences,
conditionally selected from real data, with randomness only in *which*
phrasing gets used - not a compositional slot-filler ("A {protagonist} must
stop {antagonist} before {stakes}"), which was considered and rejected
because freely recombining independently-written fragments risks nonsense
pairings that a hand-written sentence never would.

The selection key is genre plus whichever tone (if any) got a flavor boost
during tone-profile generation (5.11) - `generateToneProfile` now returns
the rolled `flavorTones` alongside the profile itself specifically so this
doesn't have to re-derive "was this flavored" from the finished numbers.
An Action script that rolled a comedy flavor boost pulls from
`PREMISE_BANKS.Action.comedy` instead of `PREMISE_BANKS.Action.straight`,
so a buddy-cop-flavored action script reads like one. Every genre's
`straight` bucket now has 9 entries, and 18 of the 48 possible genre/flavor
combinations are authored (2-3 per genre, the pairings common enough to be
worth writing - e.g. Action+comedy/suspense/drama, Fantasy+romance/comedy),
each with 5-6 entries; anything without an authored bucket falls back to
that genre's `straight` bucket, the same incremental-coverage approach
already taken with the script title word banks (5.11) - fill in more if
repetition is still noticeable in play, rather than trying to cover every
combination up front.

169 hand-written entries surfaced their own lesson worth recording: several
early entries reused `{antagonist}` twice in one sentence, or built a
sentence around a long descriptive antagonist phrase (`"a king who keeps
declaring wars without checking with him first"`) the way one would around
a short name - both read fine individually but produced either a broken
trailing possessive (`...first's latest crusade`) or the same long phrase
repeated verbatim seconds apart once substituted. A `.replace()` call was
also silently only replacing the *first* `{antagonist}` occurrence,
compounding the double-use case further (fixed to `.replaceAll()` in
`premiseGenerator.ts`). Caught by actually rendering and reading every
entry, not by the mechanical checks (no leftover token, no `null`, correct
capitalization) that all still passed - worth remembering that the
generator producing *valid* output isn't the same as producing *readable*
output.

**This is presentation only, on purpose.** `Script.synopsis` feeds nothing
in `engine/scoring.ts` and nothing in `engine/compatibility.ts` - the same
boundary `title` already sits behind. The alternative (turning protagonist/
antagonist archetypes into a second, parallel "does this actor suit this
character" scoring system) was considered and explicitly rejected: casting
already has one clean, unified answer to "does this person suit this
script" - tone-vector compatibility, identical for Director and Actor
(5.11). A second, archetype-based compatibility system running alongside
it would give every casting decision two numbers that could disagree,
which is a regression, not a refinement - the same shape of problem as the
`budgetScaleFactor` double-multiplier bug in 5.4's history notes. If
character-level casting fit ever becomes a real feature, it should extend
the existing tone system, not fork a second one next to it.

### 5.13 Script comparison panel (`components/wizard/DevelopFilm.tsx`)

Requested by a playtester: pin up to two scripts (a `pinnedIds` array,
plain component `useState`, not reducer state - purely a browsing aid with
no effect on the draft) to see them side by side in a sticky panel while
still browsing the rest of the slate. Deliberately separate from
*choosing* a script: clicking a card still selects it immediately (existing
behavior, unchanged), while a dedicated "Pin to Compare" button on each
card (`e.stopPropagation()` so it doesn't also trigger the card's own
`onClick`) toggles membership in the comparison panel. The panel also gets
its own "Choose This Script" button so committing to a pinned script
doesn't require going back and re-finding its card in the grid.

Pins are cleared (`useEffect` on `draft.scriptOptions`) whenever the slate
regenerates - genre change or Reroll Scripts both replace `scriptOptions`
wholesale, so a pinned id can otherwise point at a script that no longer
exists in the current options.

This is also what first motivated widening `#root` beyond its original
1080px cap (`index.css`) - the original width left comfortable room for the
script grid alone, but not for a persistent side panel too. `#root` has
since dropped the max-width entirely (5.13.1) rather than settling on a
bigger fixed number, so the grid now uses however much width is actually
available. The two-column layout (`.develop-compare-layout`) stays
conditional on `pinnedIds.length > 0` rather than permanently reserving the
space: with nothing pinned, the grid uses the full width (as many columns
as fit, growing with the viewport); pinning narrows the grid back down to
make room for the panel, which is exactly the tradeoff a comparison view
implies. Below 900px the two-column grid switches to a single column
(`@media (max-width: 900px)`) rather than squeezing a rail next to an
already-narrow grid - the only responsive breakpoint in the app so far,
added because this is also the first layout with a genuinely fixed-width
side element; everything else already reflows via `.grid`'s `auto-fill`.

The rail itself resizes with pin count rather than staying one fixed
width: 320px (one column) with a single pin, 660px (two columns,
`.compare-slots-double`) once both slots are filled, so two scripts
actually sit side by side rather than stacking - stacking two full-detail
cards in a 320px column was the first pass, but a playtester correctly
flagged that "side by side" meant horizontally, not just "both visible."
The width is set via a `--compare-rail-width` CSS custom property on a
per-count basis rather than setting `grid-template-columns` directly inline
- an inline `style` always wins over a stylesheet rule for the same
property regardless of a media query, which would have silently defeated
the 900px single-column fallback above. Routing it through a custom
property keeps `grid-template-columns` itself a normal stylesheet
declaration that the media query can still override.

### 5.14 Hire Talent's script rail and talent comparison (`components/wizard/HireTalent.tsx`)

Same request extended to the next screen: a persistent script-reference
panel on the *left* (`.script-reference-panel`) throughout Hire Talent, plus
the same pin-up-to-two-and-compare-side-by-side panel from Develop (5.13),
reused for talent candidates, on the right. `toneProfileBreakdown` moved
from a local function in `DevelopFilm.tsx` to `data/tones.ts` so both
screens build a `CompatibilityBadge` breakdown from a raw `ToneProfile` the
same way, rather than each screen keeping its own copy.

The script panel is unconditional, not pin-driven like the comparison
panels - there's exactly one script by the time the wizard reaches this
screen (`draft.script`), nothing to choose between, so it's just always
shown rather than requiring an action to surface it. The talent comparison
panel reuses `.compare-panel`/`.compare-slots`/`.compare-slots-double`
as-is from 5.13 - both were already generic enough (not Develop-specific
in name or behavior) to cover a second kind of pinned item without
duplicating the CSS.

Pinning is scoped to one role at a time: pinning a candidate from a
different role than what's currently pinned clears the tray and starts a
fresh comparison, rather than mixing (say) a Director and a Composer in
the same two slots. The first pass allowed cross-role pinning on the
reasoning that `talentBreakdown()` already renders whichever shape
(ToneProfile vs ActingStyle vs neither) each pinned talent actually has, so
nothing would *break* - but a comparison across roles isn't a comparison
anyone actually wants, and leaving stale picks from a role you've moved on
from sitting in the tray was just clutter. `togglePinTalent` checks
`pinnedTalent[0]?.role` against the incoming candidate's role before
deciding whether to add or replace; the per-card pin button's disabled
state follows the same rule; so does the empty-slot hint text (`Pin
another {role} candidate...`).

Three regions (script rail, role sections, talent rail) compete for the
same width more than Develop's two did, so the center grid degrades
further under load than on Develop: as many columns as fit with nothing
pinned (same as Develop), fewer with one candidate pinned, fewer still with
two pinned and the rail at its widest. Accepted as the same tradeoff
already established in 5.13 - more side panels active means less room for
the main grid.

### 5.15 Removing the page width cap

`#root`'s `max-width` (1080px originally, bumped to 1320px in 5.13, then
dropped entirely here) never had a strong reason to exist once the layout
was grid-based throughout: `.grid`'s `auto-fill` and the compare rails'
own fixed widths already size themselves to available space instead of
stretching individual cards indefinitely, so an outer cap wasn't
protecting anything - it was just leaving the sides of a wide monitor
empty. `#root` now has no `max-width` at all; on a 1920px viewport the
Develop script grid renders 7 columns instead of 4-5, and Hire Talent's
three-region layout (5.14) has real room to breathe instead of being the
first place the squeeze from 5.13/5.14 actually bites.

The one place removing the cap needed a deliberate counter-move: plain
prose. A `<p>` stretching edge-to-edge on a wide monitor becomes a
genuinely hard-to-read long line, and unlike the grids, text doesn't have
its own natural sizing logic to fall back on. `p { max-width: 720px; }` is
a blanket rule (`index.css`) rather than something applied screen-by-screen
- every `<p>` in the app is either short flavor/stat text (well under
720px regardless) or exactly the kind of longer descriptive copy
(`.choice-description`, intro paragraphs) this is for, so one global rule
covers it without needing a special case per screen.

### 5.16 A real calendar, and principal photography as a live process (`engine/calendar.ts`, `engine/production.ts`, `data/schedule.ts`, `state/studioReducer.ts`)

Two changes that only make sense together: the game gained an actual
in-game calendar, and Plan Production's abstract Shooting Style dial was
removed in favor of the player actually living through however many days
of principal photography they choose.

**The calendar.** `Studio.year: number`, incremented by one flat unit per
released film, is gone - replaced by `Studio.totalDays: number`, a single
running day counter (day 1 = the studio's founding) that every stage of
making a film spends real days out of. Year and day-of-year are derived
purely for display (`engine/calendar.ts:formatGameDate`) rather than
stored separately, so there's one source of truth and no rollover
bookkeeping. It's shown in a new persistent `DateBar`
(`components/common/DateBar.tsx`), mounted in `App.tsx` itself alongside
`ThemeToggle` - previously the only chrome visible on every screen - since
"visible at all times" meant it couldn't live inside any one screen's own
header the way everything else on this page does.

Every wizard stage except Plan Production→Film It's boundary has a fixed
day cost (`data/schedule.ts:STAGE_DURATIONS` - Develop 7, Hire Talent 14,
Plan Production 5, Post-Production 45, Marketing 30), charged in
`GO_TO_STEP` the moment the player *leaves* that stage moving forward.
Going back costs nothing - `WIZARD_STEP_ORDER`
(`state/studioReducer.ts`) gives every step a canonical index, and a
transition only charges when the destination index is genuinely past
`FilmDraft.furthestStepIndexCharged`. This field exists specifically to
stop a Back-then-forward round trip from paying the same stage's duration
twice - the first version of this didn't have it, and leaving Develop,
going Back to fix something, then continuing charged 7 days *twice*
(caught by a diagnostic script asserting the date after a deliberate
back-and-forth, not by inspection - the bug was invisible in a straight
playthrough). Marketing's duration is applied inside `RELEASE_FILM`
directly rather than via `GO_TO_STEP`, since release jumps straight to the
Results screen rather than routing through a step transition first.

**Principal photography.** The old `BEGIN_FILMING` action computed a whole
shoot's worth of events (3-5, fixed count) in one dispatch, instantly.
It's replaced by three actions built around a new `FilmDraft.photography:
PhotographyState | null`:

- `BEGIN_PHOTOGRAPHY` computes `recommendedDays`
  (`engine/production.ts:computeRecommendedShootDays` - a base of 18 days
  plus terms for script complexity, cast size, runtime target, and
  practical/VFX ambition, roughly 18 days for a bare-bones production up
  to 90+ for a complex ensemble VFX blockbuster) and starts `photography`
  at `{ status: 'in-progress', daysElapsed: 0, events: [], runningCost: 0 }`.
- `ADVANCE_SHOOTING_DAY` - dispatched automatically on a timer
  (`ProductionRun.tsx`, every 500ms) while `status === 'in-progress'` -
  rolls whether anything happens that day (`rollDayEvent`, 5.9), adds one
  day's contingency burn (`computeDailyContingencyBurn`), and advances
  *both* `photography.daysElapsed` and `Studio.totalDays` together, so the
  persistent date bar visibly ticks forward while the player watches
  filming happen. Because every tick is a genuine dispatched action rather
  than a local animation, the whole `photography` sub-state persists
  through the existing localStorage autosave - a mid-shoot refresh resumes
  exactly where it left off, the same as everything else in this app.
- `FINISH_PHOTOGRAPHY` - available the moment shooting begins, not gated
  on reaching `recommendedDays` - sets `status: 'finished'`. Wrapping
  early spends less contingency than budgeted; running past
  `recommendedDays` keeps burning at the same daily rate with no upper
  bound, and drags `shootingQualityFromRatio` (5.7) down from its 2.5x
  ceiling only very gradually, so there's no hard cap on an overrun -
  cost and diminishing quality returns are what discourage one, not a
  rule forbidding it. Verified directly: wrapping at half the recommended
  schedule spent half the contingency reserve, landed Schedule Pressure at
  75/100 and shooting quality at 50; running 1.5x over spent 1.5x the
  reserve, landed Schedule Pressure at 20/100 and shooting quality at 69 -
  cost, risk and quality all move in the directions the mechanic promises,
  not just in the direction that happens to be convenient to display.

`FilmResults`/`Film` no longer carry a flat `events` field fed by a single
batch call - `productionCost` now includes `photographyCost`
(`ReleaseComputationInput.photographyCost`, the shoot's final
`runningCost`) as its own line, separate from `computeProductionBudgetCost`
(5.7), and Production Score reads `shootingRatio` (`daysElapsed /
recommendedDays` from the finished shoot) instead of a pre-set pace dial.

Not yet built: per-event day tagging - the on-set log shows events in the
order they fired, not which specific day each one happened on
(`PhotographyState.events` is a flat `ProductionEvent[]`, same shape as
the old batch result, deliberately not restructured to carry a day number
too - the live day counter above the log gives the time context instead,
and avoiding the restructure kept this already-large change from also
touching every place `ProductionEvent[]`/`Film.events` gets consumed).

**History: `computeCommittedSpend` quietly excluded contingency entirely
until photography began, so "Projected Cash After Release" understated the
real cost of a film for the whole Develop→Plan Production stretch of the
wizard.** Found from direct player feedback after a shoot ended up
substantially over budget with no warning: contingency only entered the
committed-spend total via `photography.runningCost`
(`state/selectors.ts:computeCommittedSpend`), which doesn't exist until
`BEGIN_PHOTOGRAPHY` fires - so the sticky budget tracker
(`components/common/BudgetTracker.tsx`, visible on every wizard screen)
showed a rosier number than reality for the entire planning phase, missing
the single biggest line item in the film. Fixed by adding the full planned
`contingencyAmount` to the estimate whenever `productionChoices` exists but
`photography` doesn't yet - the same number `ProductionPlanning.tsx` shows
directly as part of "Estimated Total Cost (on schedule)", so the sticky
tracker and the screen's own numbers agree. The estimate necessarily dips
to the live (lower, since it starts at zero) `runningCost` the instant
photography actually begins - a real transition (an estimate replaced by
the truth as it's known), not a bug.

Plan Production and the pre-shoot Film It screen also both gained explicit
**Daily Shoot Cost** and **Estimated Total Cost (on schedule)** figures
(`engine/cost.ts:computeDailyContingencyBurn` × `recommendedDays`) next to
the day-count estimate, and Film It shows a standing red warning once
`daysElapsed` passes `recommendedDays` during an active shoot - the
daily-burn-with-no-cap mechanic (5.16) was already real, but the *number*
wasn't visible anywhere before committing to filming, only the day count
was.

Separately: every screen transition (`GO_TO_STEP`, both directions) now
resets scroll position to the top (`App.tsx`, a `useEffect` keyed on
`state.screen`) - long wizard screens previously left the player dropped
wherever the *previous* screen's scroll happened to be, since a React SPA
doesn't reset scroll on its own the way a full page navigation would.
Scoped to genuine screen changes only, so a photography day ticking
(which doesn't change `state.screen`) doesn't yank the page around mid-shoot.

### 5.17 Interactive on-set events and a real delay mechanic (`data/productionEvents.ts`, `engine/production.ts`, `state/studioReducer.ts`, `components/wizard/ProductionRun.tsx`)

Two problems with the original event system (5.9), both raised directly by
playtest feedback: every event auto-applied its deltas with no player
input, and buzz was showing up on events nobody outside the shoot could
plausibly know about (a great take in dailies moving pre-release hype makes
no sense - the public hasn't seen it).

**Buzz audit.** Went through every template in `data/productionEvents.ts`
and zeroed `buzzRange` on anything without a real public angle - an
internal VFX review, a smooth department meeting, a good take in dailies.
Buzz survives only on events with an actual plausible leak: press
coverage, a stunt clearly bound for the trailer, concept art or cast
photos leaking online, a public blowup, a departure or financing scramble
that reaches the trade press. `technicalComplexity`'s whole bank ended up
buzz-free entirely - VFX/technical process is genuinely never public until
release.

**`delayRiskDelta` became a real mechanic.** It was already on
`ProductionEvent`, but marked "informational for MVP" - rolled and stored,
never read anywhere. Renamed to `delayDaysDelta` and wired it into
`ADVANCE_SHOOTING_DAY`: a negative event can now cost real extra shoot
days on top of the day it happened on (`neg-bad-weather` costs 2-4,
matching its own description), advancing both `daysElapsed` and
`Studio.totalDays` together, with `runningCost` charged for every one of
those days, not just the one the event landed on. Positive events keep
`delayDaysRange` at `[0, 0]` - there's no "days saved" mechanic (can't
retroactively un-shoot a day already lived through); a positive event's
upside is entirely in its cost/quality/buzz.

**Interactive events.** `ProductionEventTemplate` is now a discriminated
union - most templates are the same auto-applying shape as before, but a
template with `interactive: true` carries a `situation` and 2-3
`EventChoiceTemplate` options instead of its own ranges. When
`rollDayEvent` picks one, `ADVANCE_SHOOTING_DAY` still charges that day
(the situation itself *is* that day's event) but sets
`PhotographyState.status` to `'awaiting-choice'` and stashes the template
on `pendingChoice`, instead of resolving a delta. The existing ticking
`useEffect` in `ProductionRun.tsx` already only runs its `setInterval`
while `status === 'in-progress'`, so the new status value pauses the timer
for free - no separate pause flag needed. `ADVANCE_SHOOTING_DAY` is also a
guarded no-op outside `'in-progress'`, which means a Fast Forward loop
that gets interrupted mid-flight by a choice harmlessly no-ops through its
remaining dispatches rather than needing its own awareness of the
interruption.

Each `EventChoiceTemplate` rolls its own independent cost/quality/buzz/delay
ranges. Which of those a given choice actually touches is whatever the
situation logically implies, not forced down to a single resource for its
own sake: "bring in a mediator" is pure cost because that's genuinely all
it costs, but "replace someone mid-shoot" costs *and* delays, because
severance and onboarding a replacement are both real; "reinvest a currency
windfall in an extra day of coverage" costs a day *and* raises quality,
because that's what spending the day on the film actually buys. 16
interactive templates across the five risk dimensions this way (3-4 each,
mixing negative-crisis and positive-opportunity situations - budgetRisk and
schedulePressure each lean toward whichever polarity gives the more natural
decision). Picking a choice dispatches `RESOLVE_EVENT_CHOICE`, which rolls
that choice's outcome (`engine/production.ts:resolveEventChoice`), appends
it to `events` with the situation + choice label folded into its
description, applies its own `delayDaysDelta` on top of the calendar
(separately from the day the situation itself consumed), and flips `status`
back to `'in-progress'`.

`FINISH_PHOTOGRAPHY` was already gated to `status === 'in-progress'`, so it
naturally can't be used to skip past a pending decision - the Finish and
Fast Forward buttons are hidden by the same status check on the UI side.

Save format bumped to v10 (`state/persistence.ts`) - `ProductionEvent` lost
`delayRiskDelta` and gained `delayDaysDelta`, and `PhotographyState` gained
`pendingChoice`, so a v9 save wouldn't shape-check cleanly.

### 5.18 Crew-aware events, and real mid-shoot recasting (`data/productionEvents.ts`, `engine/production.ts`, `state/studioReducer.ts`)

Extends 5.17's interactive events so a decision can be *about* someone
specific - the hired Director, Writer, Lead Actor, Composer or Editor -
rather than always reading as generic set drama with nobody's name on it.

**A template can declare `involvesRole`.** At roll time
(`engine/production.ts:rollDayEvent`), the engine resolves the actual hired
Talent for that role from `FilmDraft.talent` (a random pick among
multi-hire roles like Lead Actor), then:
- Interpolates a `{name}` token in the template's `situation` and each
  choice's `label`/`description` with their real name, once, before the
  `PendingEventChoice` is ever stored - the UI never sees a raw token.
- For any choice marked `skillSensitive`, shifts its `qualityRange` up and
  `delayDaysRange` down by how far the involved talent's skill sits from
  50 (`talentSkillScore` - the plain `skill` field for
  Director/Writer/Composer/Editor/VFX Supervisor, or an actor's
  compatibility with the script, since actors have no separate skill
  number - see types/index.ts:ActorTalent). A stronger hire doesn't turn a
  bad option into a sure thing (the shift caps at half the choice's own
  range width), but a skilled Writer shipping a draft as-is stings a lot
  less than a weak one doing the same. This is also the first time the
  Writer's `skill` stat does anything at all - previously hireable but
  fully decorative (see Known Limitations).

**A template can also declare `offersReplacementFor` a role.** When set
(alongside `involvesRole`), `rollDayEvent` pulls real candidates from the
studio's talent pool near the departing hire's own salary
(`engine/talentFilter.ts:findCandidatesNearPrice`) and appends 1-2 of them
to `choices` as genuine recast options - `Recast with {candidate.name}`,
with that specific person's salary shown next to the label
(`replacementCandidateSalary`, rendered via `<Money>` in
`ProductionRun.tsx`) so the player is choosing a real person at a real
price, not a blind roll. Each recast choice's own roll is built from that
one candidate:
- Cost is a disruption charge, not their ongoing salary - severance for
  the departing hire (40% of their salary) plus a rush-hire premium on the
  new person's own rate (30% of theirs). Their ongoing salary takes care of
  itself once they're actually in the cast, the normal way.
- Quality swings on the gap between the two people's `talentSkillScore` -
  modest and two-sided, so a recast is a real gamble, not a guaranteed
  upgrade just because the player picked the pricier name.
- Delay is real and role-flavored: 3-6 days for a Lead/Supporting Actor
  (anything they're already in has to be reshot), 2-4 for anyone else
  (ramp-up time, no reshoot).

Picking a recast choice doesn't just roll a delta - `RESOLVE_EVENT_CHOICE`
(`state/studioReducer.ts`) checks the chosen choice for
`replacementCandidateId` and, if present, actually swaps `FilmDraft.talent`:
the departing hire (`PendingEventChoice.involvedTalentId`) comes out, the
picked candidate goes in, for the rest of the film. The swap is a straight
1-for-1 replace, verified in a reducer-level diagnostic across 200 seeded
shoots.

Eight new templates ship with this: Writer (a rewrite struggling, and a
punch-up worth capitalizing on), Composer (a temp-score clash), Editor (an
assembly that's come together ahead of schedule), Director and Lead Actor
(each with a real recast option), plus two plain additions with no
specific role attached (an actor rivalry, a vendor discount) - bringing the
interactive template count from 16 to 24.

### 5.19 Box office as a live weekly process (`engine/boxOffice.ts`, `engine/boxOfficeRun.ts`, `state/studioReducer.ts`, `components/Dashboard.tsx`)

Same move as Principal Photography (5.16) applied to what happens *after*
release: a film's total box office used to be one number computed the
instant the player clicked Release. Now it's whatever a week-by-week run
actually adds up to, and the player watches it happen instead of being told
the ending upfront.

**What's release-day-knowable vs what isn't.** Critic/audience/buzz score,
the department breakdown, review blurbs, the story report, and Opening
Weekend are all still computed immediately
(`engine/releaseFilm.ts:computeReleaseResults`) - none of that depends on
how the run actually goes. `totalBoxOffice`, `studioRevenue`, `profit`,
`outcome` and `reputationChange` do, so `FilmResults` now types all five as
`| null` and `computeReleaseResults` returns them null, alongside a `legs`
figure (`engine/boxOffice.ts:computeLegs` - the same reviews-and-release-
type multiplier the old lump-sum formula used, just not spent all at once
any more).

**`Film.boxOfficeRun`** is the live state: `status`, a fixed `legs` and
`retention` (`computeWeeklyRetention(legs) = clamp(1 - 1/legs, 0, 0.95)` -
legs=1 gives retention 0, the film dies right after opening; legs=8 gives
≈0.875, a long slow tail), `weeks: BoxOfficeWeek[]`, and `cumulativeGross`.
Week 1 is always exactly the already-known Opening Weekend, not a fresh
roll - decay only governs week 2 onward, each rolled as `previous ×
retention × variance(±15%)` (`engine/boxOfficeRun.ts`). A run ends when a
week's gross drops under 2% of the opening, or after a 20-week cap,
whichever comes first.

**Settlement is lazy, off the existing calendar, not a dedicated ticking
screen.** `engine/boxOfficeRun.ts:settleBoxOfficeForAllFilms` takes
`Studio.filmsReleased` and the current `Studio.totalDays`, and for every
film still `'running'` works out how many weeks *should* be settled by now
(`floor((totalDays - releasedOnDay) / 7) + 1` - the `+1` is what makes week
1 due immediately at release, with no special-casing anywhere else) and
rolls however many are newly due. This is called from every reducer case
that can advance `totalDays` - `GO_TO_STEP`, `ADVANCE_SHOOTING_DAY`,
`RESOLVE_EVENT_CHOICE`, and `RELEASE_FILM` itself (which calls it once,
right after inserting the brand new film, so week 1 gets seeded the same
way any later week would be - no separate "first week" code path). Each
newly-settled week credits its studio-share straight into `Studio.cash`
(`applyBoxOfficeSettlement`, shared by all four call sites) - profit and
cash arrive gradually as the run plays out, not in one lump at release.
Whichever call crosses a run into `'finished'` computes the final
`totalBoxOffice`/`studioRevenue`/`profit`/`outcome`/`reputationChange`
right there, from whatever `cumulativeGross` actually reached, patches them
into that film's `results`, and folds `reputationChange` into
`Studio.reputation` - the same job `RELEASE_FILM` used to do in one shot,
now done whenever the run's actual ending arrives.

**No blocking.** The player is free to start developing their next film the
moment the current one releases - `filmsReleased` is a plain array, and
settlement iterates every running entry in it regardless of what's
happening in `FilmDraft`. In practice this means an older film's weekly
numbers keep updating in the background purely as a side effect of
`ADVANCE_SHOOTING_DAY` ticking on whatever's shooting next, verified in a
reducer-level diagnostic that released one film, started and shot a second
one to completion, and watched the first one's run settle to completion
entirely through the second film's own day-by-day actions.

**UI.** `ReleaseResults.tsx` now reads "Opening Weekend", shows "Still
playing" where the total used to be, and a note pointing at the Dashboard -
unless the run happened to finish in that very first settlement pass (a
poorly-reviewed enough film with legs at the floor), in which case the real
final numbers are already there instead. `Dashboard.tsx` gained a bar chart
per running release (`components/common/BoxOfficeChart.tsx` - plain divs,
no charting library) and a `BoxOfficeFinishedPopup` that surfaces once per
finished-and-unseen run (`Film.boxOfficeRun.acknowledged`, cleared by a new
`ACKNOWLEDGE_BOX_OFFICE_RESULTS` action so it doesn't reappear on every
Dashboard visit). Studio History's table shows "so far" gross and "In
Theaters" / "Pending" in place of final figures for anything still running.

Save format bumped to v11 (`state/persistence.ts`) for both the nullable
`FilmResults` fields and the new `Film.boxOfficeRun`.

### 5.20 A background day-tick outside the wizard (`App.tsx`, `state/studioReducer.ts`)

5.19 made an older film's box office settle lazily off `Studio.totalDays` -
but that only advances when a wizard action fires, so a player sitting on
the Dashboard (or the results screen after a release) with nothing left to
click could leave an old release's numbers frozen indefinitely, never
finishing its run. A plain `setInterval` in `Screens` (`App.tsx`) now
dispatches a new `ADVANCE_DAY` action every 3 seconds, advancing
`Studio.totalDays` by exactly 1 and running the same
`settleBoxOfficeForAllFilms` pass every other calendar-advancing action
already uses (5.19) - it's a genuinely independent tick, not a dressed-up
wrapper around any existing one.

Paused on every wizard screen that's purely about making a choice with no
clock of its own (`develop`, `talent`, `production-planning`,
`post-production`, `marketing`) - so a slow decision never silently costs a
day. `production` is paused too, but for a different reason: it already
runs its own faster, dedicated tick the moment photography begins
(`ProductionRun.tsx`, 500ms/day) - running both at once would double-charge
days, so the background tick stands down there entirely rather than
overlapping with it. That leaves `dashboard` and `results` as the two
screens where time passes on its own, verified with a Playwright pass
showing the date bar advancing three days over ~9.5 seconds on the
Dashboard, then holding perfectly still for the same span on `develop`.

### 5.21 Event severity, and a real shoot having *multiple* events (`data/productionEvents.ts`, `engine/production.ts`)

Direct playtest feedback: a 40-day recommended shoot that produced a single
event, none of them interactive, read as broken even though it was within
normal variance for the original tuning. Two changes, driven by an actual
simulation rather than a guess at what "felt right":

**Every template now carries a `severity: 'low' | 'medium' | 'high'`**
(`types/index.ts:EventSeverity`) - how big a deal it actually is, independent
of polarity. "The crew found a clever low-cost solution" is `low`; "a
performer was hospitalized, shutting down filming for two days" is `high`.
Classified by hand across all ~90 templates by eyeballing each one's own
cost/quality/delay magnitude and narrative weight - roughly half came out
`low`, a little over a third `medium`, and about 1 in 10 `high`. The two
templates that offer a real recast (`offersReplacementFor`, see 5.18) are
always `high` - replacing someone mid-shoot is never a minor event.

**`rollDayEvent` now rolls severity as its own independent question**, after
polarity, before picking a template - "how big a deal" and "good or bad
news" don't have to move together. `severityWeights(avgRisk)` skews hard
toward `low` regardless of risk (70% at avgRisk=0, still 40% at avgRisk=100)
so routine set texture stays the common case even on a tense shoot, while
`medium` and `high` genuinely grow with risk instead of everything
flattening into a coin flip. Falls back to any severity within the same
polarity pool if the rolled tier happens to be empty for that combination
(a rare specific risk-dimension/polarity/severity intersection).

**The daily event chance itself also went up**, from 0.05-0.13 to
0.12-0.27 - the original range meant a real shoot could run its full
length and land one event, sometimes none, which is what actually happened
in the reported case. Simulated across 5,000 40-day shoots at three risk
levels to check the fix landed where intended rather than asserting it:

| Risk level | Avg events/shoot | Avg low-severity interactive/shoot | Shoots with 0 events |
|---|---|---|---|
| Low ("a good shoot") | 6.73 | 1.81 | 0.1% |
| Moderate | 7.64 | 2.08 | 0.0% |
| High | 9.07 | 2.75 | 0.0% |

A good shoot now averages "one or two" low-severity interactive events -
exactly the target - and effectively never produces fewer than 2 events
total, versus the old tuning's real chance of landing on 0-1.

`ProductionEvent` and `PendingEventChoice` both gained the resolved
template's `severity`, shown as a small color-coded tag
(`components/common/SeverityBadge.tsx` - grey "Minor", amber "Moderate",
red "Major") next to each entry in the On-Set Events log and on the
decision panel heading, so the player can see at a glance how much weight
an event actually carries before reacting to it.

Save format bumped to v12 (`state/persistence.ts`) for the new required
`severity` field.

### 5.22 Pausing the background tick, and a visible countdown to the next day (`App.tsx`, `components/common/TimeTickIndicator.tsx`)

Two small additions on top of 5.20's background day-tick, both direct
feedback: a 3-second gap between visible changes on the Dashboard read as
the game being stuck rather than counting down, and there was no way to
hold time still while reading something without leaving the screen
entirely.

**Pause** is a `paused` boolean local to `Screens` (`App.tsx`), not
persisted anywhere and deliberately *not* studio state - it's a UI
convenience for "let me look at this without the clock running," not a game
rule. The tick effect's condition became `ticking = !PLANNING_SCREENS.has(state.screen) && !paused`,
so pausing behaves exactly like already being on a planning screen. A
second `useEffect` resets `paused` to `false` on every `state.screen`
change - since essentially every action that costs real time
(`GO_TO_STEP`, `RELEASE_FILM`) is itself a screen transition, this is what
makes a manual pause "toggle off if the player does something that
requires time to pass" true in practice, without needing to special-case
every time-costing action individually. It also means a pause can never be
left on by accident on a screen the player has long since moved away from.

**The countdown** is `components/common/TimeTickIndicator.tsx` - a fixed-
width bar whose fill runs a plain CSS `@keyframes` animation
(`animation-duration` read from the same `DAY_TICK_MS` constant the real
interval uses, both now living in `src/constants.ts` specifically so a UI
component can read it without importing `App.tsx` and creating a circular
dependency). Restarting the animation in sync with the real tick doesn't
need its own timer: `Screens` bumps a `tickNonce` counter inside the same
interval callback that dispatches `ADVANCE_DAY`, and the fill `<div>` is
keyed on it - changing a `key` forces React to unmount and remount the
element, which restarts a CSS animation cleanly for free. When paused, the
bar is replaced with a static "Paused" label instead of a frozen fill,
so a stopped bar never reads as a hang.

Verified live: pausing held the date at Day 1 through a 7-second wait,
resuming advanced it to Day 2 within the next 4 seconds.

### 5.23 A full dossier for any past film (`components/common/FilmDetailModal.tsx`)

Studio History's table only ever showed a handful of summary columns - the
full cast/crew, their individual stats, the on-set event log, and the
department breakdown were only ever visible once, immediately after
release, on `ReleaseResults`. Clicking a row now opens
`FilmDetailModal` (the same `.modal-overlay`/`.modal-content` pattern as
`BoxOfficeFinishedPopup`) built directly from that `Film` record rather
than the current draft, so it works identically for a film released just
now or twelve films ago:

- **Cast & Crew**: every hired role, with their role-appropriate stat -
  plain `skill` for Director/Writer/Composer/Editor/VFX Supervisor, or
  `computeTalentCompatibility(talent, film.script)` (rounded - it returns a
  raw float) for actors, since they have no separate skill number - plus
  fame/reliability/ego/salary.
- **Financials**: production/marketing/total cost, and either the live
  running numbers (`BoxOfficeChart` + gross-so-far, if `boxOfficeRun.status
  === 'running'`) or the final total/studio-share/profit once the run has
  finished - the same conditional `ReleaseResults` and Dashboard's history
  table already use for a null-vs-final `FilmResults`.
- **Reception**: quality/critic/audience/buzz plus the full department
  breakdown, reusing `ScoreBar`/`StarRating` as-is.
- **On-Set Events**: the complete event log with the same `SeverityBadge`
  treatment as the live Production screen.
- **Reviews & Studio Report**: unchanged from `ReleaseResults`.

Deliberately a first pass, not a polished redesign - the sections are
plain stacked cards reusing existing components with no new visual
language, called out in the component's own comment as worth revisiting
once there's a sense of which parts of a 12-film-deep history a player
actually wants to dig back into.

### 5.24 AI rival studios (`engine/rivalStudios.ts`, `data/rivalStudioNames.ts`)

The Top 10 chart (below) is hollow with only the player's own 1-2 films in
it, and Known Limitations (Section 8) already flagged that a real calendar
existing made talent "busy" a buildable concept with nothing yet to
conflict with. This closes both gaps with one feature: a small persistent
roster of AI-controlled competitor studios that cast real candidates out of
the same shared `talentPool`, release real films through the same
scoring/box-office pipeline, and show up ranked alongside the player on the
same weekly chart.

**No day-by-day simulation - a rival's production is one synthesized roll.**
Nobody watches a rival's shoot happen, so there's no live event log, no
`PhotographyState` equivalent. `engine/rivalStudios.ts:startRivalProduction`
generates a script (`generateScriptOptions`, the exact function the
player's own Develop screen uses), casts mandatory roles from the shared
pool near a target price banded by the production's scale, and rolls
production/post-production/marketing choices randomly. Its production
window (`releaseDay`) comes from `computeRecommendedShootDays` plus the sum
of every non-Photography `STAGE_DURATIONS` entry - the same numbers behind
the player's own estimate, so a rival's dev-to-release timeline is
grounded in the same constants, not an invented one. At `releaseDay`,
`resolveRivalProduction` calls `computeReleaseResults` - the *exact* same
function `RELEASE_FILM` calls for the player - with a randomly rolled
`shootingRatio` (0.85-1.25) standing in for a lived shoot, and seeds a
`BoxOfficeRun` the same way. Because a rival film is a literal `Film`
object, it drops straight into `engine/boxOfficeRun.ts:settleBoxOfficeForAllFilms`
unchanged - the same weekly settlement, the same `BoxOfficeChart`, the same
`FilmDetailModal` - the only difference is its `cashCredit`/`reputationDelta`
output is discarded, since none of it is the player's money or reputation.

**Talent locking via `Talent.bookedUntil`.** When a rival casts someone,
that specific pool entry gets `bookedUntil = releaseDay`. Reading it is a
plain `bookedUntil > totalDays` comparison - no explicit "release" step,
availability just lapses on its own once the day passes. Hire Talent shows
a booked candidate disabled with "Filming elsewhere until [date]," the same
visual treatment as "Cast full." The player's own hires never set this -
only one of their own films is ever in production at a time, so there's
nothing for that to conflict with.

**Studio scale governs both production size and concurrent capacity**,
exactly per spec:

| Tier | Concurrent capacity |
|---|---|
| Indie | 1 Small production, nothing else |
| Mid-Size | *either* up to 3 Medium *or* 1 Big at a time - not both; picking one locks out the other until everything in that lane wraps |
| Major | up to 2 Big *and* up to 4 Medium simultaneously - independent pools |

(`engine/rivalStudios.ts:startableScales`, verified against these exact
rules directly - a diagnostic ran 500 simulated days and found zero
violations, with max concurrent productions observed landing at exactly 1 /
3 / 6 for Indie / Mid-Size / Major.) A production's `ProductionScale`
(`Small`/`Medium`/`Big`) sets its target-price band (roughly t=0.08-0.32 /
0.32-0.65 / 0.65-0.98 on the same log-scale casting/spend math the player's
own sliders use) - a Big Major tentpole and a Small Indie both roll through
identical formulas, just at different price points, so their eventual
quality is genuinely random rather than tier-determined (per direct
instruction: no thumb on the scale - a Major's blockbuster can flop, an
Indie's small film can be a Cult Hit).

**Spawn cadence** is per-studio, not global: each `RivalStudio` carries a
`nextSpawnCheckDay`, rerolled (10-40 days depending on tier, Majors
checking most often) every time that threshold is reached, regardless of
whether a new production actually started. Checked from the exact same
five call sites `settleBoxOfficeForAllFilms` already runs from
(`state/studioReducer.ts` - every action that can advance `totalDays`), via
`settleRivalMarket`, which also resolves any production whose `releaseDay`
has arrived and settles every rival film's box office in the same pass.

**Studio names** come from a small new word bank
(`data/rivalStudioNames.ts`, 18 prefixes x 5 suffixes), same pattern as
script titles - "Northbridge Pictures," "Cobalt Media." A 500-day
diagnostic never dropped any mandatory role's available-candidate count
below 80/100 (crew roles) or 146/200 (Lead/Supporting Actor), so the
shared pool has comfortable headroom even with 5-6 rivals casting from it
concurrently.

**The Top 10 chart** (`state/selectors.ts:computeTopGrossingFilms`,
`components/common/TopGrossingPanel.tsx`) combines the player's own
`filmsReleased` and `Studio.rivalFilmsReleased`, keeps only whichever are
still `boxOfficeRun.status === 'running'` (a finished run drops off, same
as a real chart), and ranks by each film's own most-recently-settled
week's gross - not lifetime total, so a film in its second week and a
long-running holdover compete on the same number, exactly like a real
weekend chart. Each row shows all three figures asked for: this week's
gross, cumulative total, and which week of release it's on. Sits in a new
sticky right-hand rail on the Dashboard (`.dashboard-layout`, same
two-column pattern as Hire Talent's script rail) and is clickable straight
into `FilmDetailModal` - a rival film is a real `Film`, so that modal
needed no changes at all to show one.

Save format bumped to v13 (`state/persistence.ts`).

### 5.25 Difficulty on reset, rival studio pages, a recast side panel, and a schedule checkpoint (`components/common/DifficultyPicker.tsx`, `components/RivalStudioPage.tsx`, `components/wizard/ProductionRun.tsx`)

Four small, independent QOL passes, grouped here because they landed together
rather than because they're related:

**Difficulty picker on Reset.** `RESET_SAVE` now takes a `startingCash`
instead of a hardcoded £10M - `Dashboard.tsx`'s Reset button opens
`DifficultyPicker` (Grassroots Indie £1M / Indie £3M / Mid-Level £10M /
Major Studio £25M) instead of firing straight off a `window.confirm`. Scoped
to Reset only, per the literal request - a brand new save with no prior
state still defaults to the old £10M (`persistence.ts:DEFAULT_STARTING_CASH`)
rather than gating first launch behind a picker, since that would have meant
making `GameState.studio` nullable for a one-time nicety.

**Viewing a rival studio's own page.** `GameState` gained
`viewingRivalStudioName` and `Screen` gained `'rival-studio'`; a new
`VIEW_RIVAL_STUDIO` action sets both. Identified by name rather than id, same
as `Film.releasedBy` already was (5.24) - one less lookup, and consistent
with the rest of the rival-facing code. `RivalStudioPage` shows the rival's
tier, its own release history (`rivalFilmsReleased` filtered by name, same
table as Dashboard's Studio History, same click-through into
`FilmDetailModal`), and a light teaser of what it's currently making -
scale and genre only, not the full choice/cast detail the player gets on
their own production, keeping a rival's in-progress film from being fully
transparent. Reachable from a Top 10 row's studio name (now a click target,
skipped for the player's own entries) or a new "Rival Studios" list in the
Dashboard's right rail, so every rival is reachable even when nothing of
theirs is currently charting. A "Home" button (`RETURN_TO_DASHBOARD`) is the
only way back, same pattern as leaving the wizard.

**Recast choices get a dedicated side panel.** Previously every choice for an
interactive event - including `offersReplacementFor`'s dynamically-built
"Recast with X" options - rendered as identical buttons in one vertical
list. Now `ProductionRun.tsx` splits `pendingChoice.choices` into
`replacementChoices` (`replacementCandidateId` set) and everything else:
regular choices stay as buttons in the main column, and if any replacement
choices exist, a right-hand "People Involved" panel appears
(`.event-decision-layout`, same two-column pattern as Hire Talent and the
recast decision itself) showing the departing talent's own card first, then
one card per replacement candidate with their salary and a dedicated action
button. The existing single-line involved-talent badge only shows when
there's *no* replacement panel, to avoid saying the same thing twice.

**A checkpoint at the recommended day count.** Photography no longer ticks
past `recommendedDays` unattended - `ProductionRun.tsx` tracks the previous
`daysElapsed` in a ref and, the first time it crosses `recommendedDays`
while `status === 'in-progress'`, sets a local `awaitingContinueDecision`
flag that stops the tick interval and shows a "Recommended Schedule Reached"
card with Keep Filming / Finish Principal Photography. Crossing rather than
exact equality, since a delay event can jump `daysElapsed` past the
threshold in a single tick. Purely local UI state (never persisted, same as
Dashboard's manual pause) - nothing about the reducer or save shape changed
for this one. Fast Forward already targets exactly `recommendedDays`, so it
naturally lands on this same checkpoint; a second Fast Forward click past it
is already a no-op (`remaining` clamps to 0).

**Fast Forward already stopped correctly for interactive events** - checked
before building anything here. `ADVANCE_SHOOTING_DAY` no-ops once
`photography.status !== 'in-progress'` (state/studioReducer.ts), so a Fast
Forward loop that hits an interactive event partway through silently stops
advancing at that day even though the loop's remaining iterations still
"run" - they're just no-ops against the frozen state. No change needed.

Save format bumped to v14 (`state/persistence.ts`) for `viewingRivalStudioName`.

### 5.26 Foundations for a producer-recommendation model (`types/index.ts`, `engine/scriptGenerator.ts`, `engine/talentGenerator.ts`, `engine/random.ts`)

The first step of a larger redesign of Plan Production: instead of the player
inventing a production from scratch on a set of spending sliders, the goal is
for most production decisions to emerge from the script and the director,
with the player acting as producer - following or overriding a recommendation
rather than setting every dial blind. This section is the data foundation
that redesign will be built on; **no recommendation engine and no UI changes
exist yet** - Plan Production is untouched, and none of what's below is read
by anything yet.

**The vocabulary (`types/index.ts`).** `Recommendation<T> = { value: T;
reasons: string[] }` - a suggestion with its own justification, generic
rather than one bespoke type per dial. `OptionalRecommendation<T> =
Recommendation<T> | null`, for a recommendation that might not apply to a
given production at all (`null` means "this system doesn't activate here,"
not "neutral default"). Two value shapes cover every dial identified so far:
`Distribution<K extends string> = Record<K, number>` (how something is
divided across a fixed set of named options, always summing to 1 - same
generic-over-named-keys pattern `engine/interpolate.ts:ScaleAnchor` already
uses) and `NormalizedScalar` (a 0-1 "how much is invested in this, relative
to what's possible" reading - deliberately not a currency amount; turning it
into a real pound figure is later work, once a recommendation is followed or
overridden). `EnvironmentMethodKey` (`studio`/`location`/`digital`) and
`EffectsMethodKey` (`practical`/`digital`) are the two concrete key sets in
use.

**Strategy vs. Ambition.** Every dial identified splits into two independent
recommendations rather than one: a `Distribution` describing *how* something
is done (method/style), and a separate `NormalizedScalar` describing *how
much* is invested in it. These aren't the same question - a script can want
a strongly location-heavy shoot at very low investment (an intimate,
cheaply-shot drama on real locations) just as easily as a studio-heavy shoot
at very high investment (a tentpole built entirely on soundstages). Keeping
them separate also means a player can follow the recommended split while
overriding the ambition level, or vice versa, without an all-or-nothing
override.

**Script gained** `environmentStrategy`/`environmentAmbition`/
`effectsStrategy`/`effectsAmbition` - the screenplay's own implied
production approach, not a requirement (deliberately not named `*Demand`).
**DirectorTalent gained** a nested `productionStyle: { environmentStrategy,
effectsStrategy }` - deliberately *not* an Ambition-driving field yet (see
Known Limitations). Both sides use the exact same `Distribution`/
`NormalizedScalar` shapes so a future recommendation engine can blend script
and director signals directly, including the interesting case where they
disagree (a script implying heavy location work against a director whose
`environmentStrategy` leans studio) - the eventual reason strings are meant
to be able to say so directly ("Director strongly prefers studio shooting
despite the script's location demands") rather than needing a separate
structured "tension" field.

**Genre profiles become generation inputs, not live scoring inputs.**
`GENRE_PROFILES[genre].vfxImportance`/`practicalEffectsImportance`
(`data/genres.ts`) used to be read directly by `engine/scoring.ts`; a
script's own `effectsStrategy`/`effectsAmbition` are now generated *around*
those two numbers plus per-script jitter (`engine/scriptGenerator.ts`,
`STRATEGY_JITTER`), the same relationship `GENRE_PROFILES.canonicalTone`
already has to `Script.toneProfile`. `environmentStrategy`/
`environmentAmbition` have weaker existing grounding - nothing in
`GENRE_PROFILES` speaks to studio-vs-location directly - so their generation
formula is a rougher first pass (`vfxImportance` sets the digital share,
`lowBudgetFriendly` splits the remainder between location and studio),
flagged in code as worth revisiting once a recommendation engine is actually
exercising it. `engine/scoring.ts` itself hasn't been touched yet - it still
reads genre importance directly - that migration is later work, once
something is actually reading the new script fields instead.

**Director generation has no genre to anchor around** (a director isn't
tied to one genre), so `productionStyle` is pure per-director variation - one
key rolls a meaningfully stronger weight (`engine/talentGenerator.ts:generateLeaningDistribution`)
so a director reads as having a genuine lean (a location purist, a studio
loyalist) rather than a bland even split, echoing the existing "signature
axis" idea already behind `toneProfile`/`ActingStyle` generation.
`engine/random.ts:normalizeWeights` is the shared math turning any set of
raw weights into a proper `Distribution` - used by both the genre-anchored
script side and the personal-lean director side.

**Deliberately not built yet, and why:**
- **A third Director field for Ambition.** Discussed and explicitly deferred
  - a plausible "resource expectations" trait was proposed, but nothing
  currently has a concrete consumer for it. Per the same discipline as
  everything else here: added only once Phase 3 (the recommendation engine)
  proves a director-side Ambition signal is actually missing, not
  anticipated now.
- **Costume.** Explicitly not modeled - may end up being Ambition-only
  (unclear whether costume has a natural Strategy split the way environment/
  effects do), and should only activate for productions where it's
  genuinely relevant (period/fantasy/sci-fi/superhero) rather than existing
  for every film. Revisit once Script's world/setting information is
  designed properly, rather than seeding a coarse `setting` enum now that
  would likely need replacing.
- **Crew fields.** None added or planned for the recommendation system -
  crew executes a chosen production well or badly (already covered by
  existing `skill`), it doesn't set creative direction the way script and
  director do.
- **The recommendation engine itself, and Plan Production's redesign** -
  the actual point of all this - haven't started. This section is
  scaffolding only.

Save format bumped to v15 (`state/persistence.ts`) for the new required
Script/DirectorTalent fields.

### 5.27 The recommendation engine itself (`engine/recommendation.ts`)

Four pure, independently-callable functions implementing 5.26's vocabulary -
`recommendEnvironmentStrategy`, `recommendEffectsStrategy`,
`recommendEnvironmentAmbition`, `recommendEffectsAmbition` - each taking a
`Script` (and, for the two Strategy functions, a `DirectorTalent`) and
returning a `Recommendation<T>`. **Still no UI, and `engine/scoring.ts`
still reads genre importance directly** - nothing calls these functions yet
outside diagnostics.

**Script is the primary source, the director nudges.** A Strategy
recommendation blends `script.environmentStrategy`/`effectsStrategy` and the
director's matching `productionStyle` field as a weighted average,
`SCRIPT_STRATEGY_WEIGHT = 0.65` vs `0.35` for the director - a single named
constant, easy to retune once there's a UI to judge the feel against.
Ambition has no director input at all yet (`recommendEnvironmentAmbition`/
`recommendEffectsAmbition` are a thin pass-through of the script's own
value, script-only per direct instruction) - a director-side Ambition trait
was discussed and deliberately not added; add one only once a real gap
shows up, not in anticipation of one.

**Reason ordering is influence-based, not templated.** Each reason carries
an internal weight (`WeightedReason`, never exposed on `Recommendation`
itself) and the list is sorted strongest-first before being returned. The
director's weight is a *counterfactual*: how much the blend actually moves
if their opinion is swapped for a neutral one, rather than their flat 35%
blend share - which is what lets a director with a strong, disagreeing
opinion outrank the screenplay's own reason when the screenplay barely has
one (verified directly - see diagnostics below), instead of the two reasons
always appearing in the same fixed order regardless of what's actually
driving the number.

**Agreement and disagreement are explicit**, via total variation distance
between the script's and director's distributions (0 = identical, 1 =
share no weight in common at all - comparable across a 2-key distribution
like Effects and a 3-key one like Environment, since TVD's range doesn't
depend on how many keys are being compared). Below `AGREEMENT_DISTANCE`
(0.15) the reason reads as reinforcement ("The director also favors...");
at or above `DISAGREEMENT_DISTANCE` (0.4) it names the tension directly
("...in tension with the screenplay's lean toward..."). A bug surfaced by
the required diagnostics: that tension phrasing originally fired even when
the screenplay itself had no real opinion (a near-uniform distribution's
technical argmax isn't a genuine "lean"), producing a self-contradicting
sentence citing the same option as both sides. Fixed by gating the
"screenplay's lean" clause on the screenplay actually having one
(`SCRIPT_OPINION_THRESHOLD`), falling back to "...which the screenplay
itself doesn't push back against" when it doesn't - exactly the kind of
thing this diagnostic-first pass exists to catch before any UI is built on
top of it.

**False precision is handled explicitly, not just in phrasing.** A Strategy
recommendation's confidence (`strategyConfidence`) scales linearly with its
matching Ambition, from 0 at Ambition 0 to full trust at
`AMBITION_CONFIDENCE_FLOOR` (0.3) and above. Below that floor, the blended
distribution itself is pulled toward an even split
(`dampenTowardNeutral`) *and* a reason is added naming the reason why
("Effects investment is minimal for this film, so this balance has little
practical effect on the finished production") - both the number and the
explanation move, not just the explanation. Confirmed directly against the
case that originally raised the concern: a real generated Drama script's
raw `effectsStrategy` (digital 88.9% / practical 11.1%, at effectsAmbition
0.247) - a strong-looking split that would have read as a confident
creative choice - damps to a much less committal 63.4% / 36.6% with the
low-materiality reason attached, rather than presenting the raw split as-is.

**Representative diagnostic results** (script + a real generated director,
`npx tsx` scratch script, deleted after use per the project's established
verification pattern):

| Case | Result |
|---|---|
| Strong agreement (environment, both location-heavy) | Value stays location-dominant; reasons: "screenplay is built around real-world locations" + "director also favors real-world locations." |
| Strong disagreement (script=location, director=studio) | Value pulled toward studio (38%→54% location, still location-led since script dominates the blend); reasons name the tension directly. |
| Low-ambition Drama | See false-precision note above. |
| Practical-heavy Horror | Raw 76.4% practical; a strongly opposing generated director pulls the recommended value to 58.2% - a real, visible demonstration of the director's 35% weight actually mattering, not token influence. |
| Digital-heavy Sci-Fi | Raw 64.4% digital; an agreeing director nudges it further to 67.8%. |
| High Ambition + studio-heavy Strategy | Ambition (0.85, "substantial investment") and Strategy (studio-dominant) reported independently and correctly, proving the two aren't conflated - a production can want a lot of money spent on a distinctly non-digital, non-location vision. |
| 400 distributions across 200 random script/director pairs | 0 failures summing to 1. |
| Reason ordering | A strong-script/flat-director case leads with the screenplay's reason; a flat-script/extreme-director case leads with the director's - confirmed the order genuinely flips rather than defaulting to a fixed script-first sequence. |

**Model gaps and calibration notes this pass exposed:**
- `SCRIPT_STRATEGY_WEIGHT`/`DIRECTOR_STRATEGY_WEIGHT` (0.65/0.35),
  `AGREEMENT_DISTANCE`/`DISAGREEMENT_DISTANCE` (0.15/0.4), and
  `AMBITION_CONFIDENCE_FLOOR` (0.3) are first-pass hand-picked constants,
  not validated against real gameplay feel - each is a single named
  constant specifically so it's cheap to retune once there's a screen to
  actually look at the recommendations on.
- The Horror case above shows the director's 35% weight has real teeth (an
  18-point swing on a strongly-opinionated script from one opposing
  director) - worth watching once playtesting exists, in case it ends up
  feeling like the director overrides the script's own voice too easily.
- Ambition's reasoning is deliberately thin (the magnitude of the value
  itself, plus one `complexity`-driven secondary reason) - kept minimal
  per the same "don't add without a consumer" discipline as 5.26, not an
  oversight; worth revisiting if the eventual UI's Ambition reasons feel
  underexplained next to Strategy's richer reasoning.
- `dominantLean` always returns *some* key, even for a near-uniform
  distribution - correct mathematically, but only meaningful once gated by
  `overBaseline` (as `leanPhrase` and the disagreement-phrasing fix both
  do). Any future recommendation reusing `dominantLean` needs the same
  gating, not just the raw label.

No Plan Production UI changes and no `engine/scoring.ts` migration yet -
next step, when ready, is wiring a followed-or-overridden recommendation
into real `ProductionChoices` values.

### 5.28 Recommendation Inspector - a developer-only diagnostic screen (`components/dev/RecommendationInspector.tsx`)

Before redesigning Plan Production, a way to rapidly eyeball the
recommendation engine (5.27) against dozens of generated script/director
pairs - "does this feel believable," not just "does it type-check." Not
part of the game: no `Screen`/`GameAction` involvement, no persistence, no
dependency on the real studio's talent pool or save data. Toggled via a
fixed top-center button (`App.tsx`, visible on every screen) that swaps
`<Screens />` for `<RecommendationInspector />` entirely outside
`StudioContext`'s reducer - it generates its own scripts/directors from a
local RNG (`createRng(Date.now())`, advanced on every reroll rather than
recreated, so rapid clicking never repeats a value) and calls the engine
functions directly.

**Exposes intermediate computation without changing the domain model.**
`recommendEnvironmentStrategy`/`recommendEffectsStrategy` only ever
returned `Recommendation<T>` - script raw, director raw, the blend before
Ambition-driven damping, and confidence were computed internally and
discarded. Rather than have the inspector reimplement that sequence itself
(fragile - any future change to the real function's internals would
silently desync from a duplicate), each Strategy function was split into a
private per-dial `compute*Breakdown` that returns everything
(`StrategyBreakdown<K>`), with the public function now just returning
`.recommendation` from it. Verified behavior-identical before/after the
split (direct diagnostic: same JSON output). Ambition needed no equivalent
split - it was already a thin, fully-exposed pass-through.

**Recommendation strength is derived in the inspector, not the engine** -
deliberately not a new field on `Recommendation<T>`, per direct
instruction. `recommendationStrength` normalizes the final value's
dominant-key lean against the maximum a distribution of that size could
show (`1 - 1/n`), so a 2-key Effects split and a 3-key Environment split
land on the same 0-1 scale before bucketing into Strong/Moderate/Weak -
otherwise Effects would read structurally "weaker" than Environment purely
from having fewer keys to spread across, independent of how opinionated
either actually is. Needed `engine/recommendation.ts:dominantLean` exported
- the one piece of generic distribution math a presentation layer
genuinely needs, kept separate from the "strength" concept itself, which
stays engine-agnostic on purpose.

**A real layout bug, caught before it shipped.** The toggle button's first
position (bottom-right, mirroring `.theme-toggle-fixed`'s corner pattern)
turned out unsafe - the Dashboard's right rail (Top 10 chart + Rival
Studios list, 5.24/5.25) grows tall enough to extend underneath a
bottom-fixed element and get silently covered, the same class of overlay
bug `DateBar`/`ThemeToggle`'s original positioning was chosen to avoid.
Stacking it below `ThemeToggle` instead (top-right) was *also* unsafe,
confirmed by measuring actual bounding boxes rather than eyeballing a
screenshot - Dashboard's own header row starts higher than assumed and the
two collided by a few pixels. Landed on top-center, reusing the exact
y=16px row `DateBar`/`ThemeToggle` already safely occupy (proven clear on
every screen, since nothing else lives there) rather than a new,
unverified band - checked against Dashboard's header and a wizard screen's
header both, zero overlap.

### 5.29 Real-film reference scripts and directors (`data/dev/referenceScripts.ts`, `data/dev/referenceDirectors.ts`)

Ten hand-authored `Script`s and ten hand-authored `DirectorTalent`s, based
on real films/directors, selectable in the Recommendation Inspector (5.28)
alongside its random generator. The problem this solves: a procedurally
generated script's Strategy/Ambition values are only as easy to judge as
"does 61% digital feel right for a made-up Sci-Fi script" - genuinely hard
to have an opinion about. "Does 90% digital feel right for *Gravity*" is
immediate, because there's already a strong real answer to check it
against. Every Strategy/Ambition value is a deliberate judgment call about
that specific film's actual production (Jaws is location/practical because
it was shot on the real ocean with a mechanical shark; Gravity is
studio/digital because it's virtual production almost start to finish;
Mad Max: Fury Road is practical/location despite being an Action film,
where genre alone would suggest otherwise) - not derived from
`GENRE_PROFILES` the way real generation is, since a genre-level default
can't know any specific film's actual production is unusual for its genre.
`Script.cost` is the one field derived rather than hand-picked -
`engine/scriptGenerator.ts:estimateScriptCost` was exported so it stays
consistent with the same formula real scripts use, rather than a guessed
number that could silently drift from it.

The ten: *The Matrix*, *Jaws*, *The Blair Witch Project*, *The Lord of the
Rings: The Fellowship of the Ring*, *Before Sunrise*, *Mad Max: Fury Road*,
*Gravity*, *12 Angry Men*, *Jurassic Park*, *The Grand Budapest Hotel* -
picked for spread across genre, environment method, effects method, and
ambition level, plus one deliberate real-world instance of the
"decoupled" pattern Phase 3's diagnostics tested synthetically (*Grand
Budapest*: high Environment Ambition from its meticulous built sets, low
Effects Ambition since it isn't an effects-driven film at all). The ten
directors (Nolan, Anderson, Cameron, Gerwig, del Toro, Bay, Coppola,
Villeneuve, Lumet, Spielberg) were picked to span practical purists,
digital pioneers, studio loyalists and location-lovers, so pairing any
script against any director gives a genuine spread of agreement/
disagreement cases to eyeball, not just the ones this project happened to
write diagnostics for.

Illustrative only, for internal calibration - not a factual claim about
any real person's actual preferences, and never imported by anything the
player's own save touches. The Inspector defaults to *The Matrix* +
Nolan rather than a random pair, so it opens on something immediately
legible.

### 5.30 Plan Production rebuilt around the recommendation engine (`components/wizard/ProductionPlanning.tsx`, `components/common/DistributionEditor.tsx`, `engine/productionChoicesAdapter.ts`, `engine/productionIdentity.ts`)

The redesign 5.26-5.29 were building toward: the player now acts as
producer over the script's and director's own Strategy/Ambition signals,
rather than inventing a production from scratch on five blind spend
sliders. `ProductionChoices` (`contingencyAmount`/`setQualityAmount`/
`practicalEffectsAmount`/`vfxAmount`/`runtimeIntensity`) still exists and
still drives every downstream formula unchanged - the player just no
longer edits it directly.

**Information hierarchy**, top to bottom: a one-sentence **Production
Identity** synthesis, a **Biggest Tension** callout (or a quiet
alignment confirmation if nothing disagrees), one **Recommendation
Card** per Strategy pair (Environment, Effects - the only two that exist
yet), the two dials nothing in the new model replaced (Contingency,
Runtime Target), the existing Risk Profile card, and an aggregate
cost/schedule strip at the bottom.

**`engine/productionIdentity.ts`** is new, cross-recommendation synthesis
- deliberately not folded into `engine/recommendation.ts`, which stays
four independent single-purpose functions (5.27). `synthesizeProductionIdentity`
builds one sentence from both Strategy breakdowns' dominant leans (gated
by the same opinion-strength thresholds already used for reason
phrasing, so a low-Ambition production doesn't claim an identity its own
numbers don't back up) plus whether either disagrees with the director.
`findBiggestTension` picks whichever active Strategy has the largest
script/director distance, or `null` if nothing crosses the disagreement
threshold - both meant to be reusable later wherever a film's "identity"
matters beyond this screen (release-time reviews, the original design
goal this whole arc started from).

**`components/common/DistributionEditor.tsx`** is the proportional
control settled on after explicitly rejecting a "dominant approach +
commitment" simplification that would have thrown away real information
(Avatar/Oppenheimer/Dune-style distinctions collapsing into the same
label). One continuous bar split into N segments with N-1 draggable
dividers, rather than N independent sliders - "always sums to 100%" is
then structurally true rather than a rule the player has to trust.
Dragging a divider trades share only between its two adjacent segments
(adjacent-only redistribution - the natural behavior for this shape of
control, and for a 2-key distribution it's just a single bipolar slider,
the same control at a different N). Arrow-key nudging on a focused
divider for basic keyboard access; full ARIA slider semantics not fully
fleshed out yet, a known gap. Verified via direct `dispatchEvent`
simulation after discovering Playwright's synthetic `page.mouse` calls
didn't reliably reach the `window`-level `pointermove`/`pointerup`
listeners in this environment - the drag logic itself was confirmed
correct, that was purely a test-tooling quirk.

**Each Recommendation Card** shows Recommended (read-only reference,
via `DistributionEditor` with `disabled`) above Your Plan (the live
editor, with the recommended distribution rendered as a thin ghost
overlay for reference while dragging). A `Following Recommendation`/
`Adjusted` badge (never "Overridden" - deliberately neutral, no
scolding tone) is computed by measuring `totalVariationDistance` between
the player's value and the recommendation, the exact same distance
function the engine itself uses for agreement/disagreement, exported
from `engine/recommendation.ts` for this reason rather than reinventing
a second "close enough" notion. Reasons default to the top two,
expandable. Ambition is collapsed by default (a one-line "Investment:
X" summary) and, when expanded, mirrors the same Recommended/Your Plan
split Strategy uses - an earlier version showed the recommendation's
fixed reasoning text next to the player's *adjusted* label, which read
as contradictory ("Investment: Minimal" beside "calls for a moderate
level of investment") until the split was made explicit, caught by
actually looking at a screenshot rather than trusting the logic alone.
A card's Strategy section renders visually muted when its Ambition
confidence is low (`MUTED_CONFIDENCE_THRESHOLD`) - the same
false-precision principle the engine's damping already encodes, carried
into visual weight rather than left as a reasons-list footnote only.

**Per-card cost/schedule consequence** ("This choice: £X · +Y shoot
days") is a counterfactual delta - current plan's cost/days minus the
same plan with that card's contribution neutralized - reusing the same
counterfactual idea the recommendation engine already uses for
reason-ordering (5.27), rather than a new technique. Risk stays
holistic, shown once via the existing Risk Profile card fed by the
aggregate plan, not decomposed per card - artificially attributing
`StaticProductionRisk`'s four dimensions to individual cards would
reintroduce the exact false-precision problem 5.27 fixed, just in a new
place. Honest limitation worth being explicit about: today's cost
formulas only price Ambition, not Strategy - Environment's studio/
location/digital *split* has no cost or schedule consequence at all in
the legacy model, only how much is invested does. That's real
information loss the adapter can't paper over.

**`engine/productionChoicesAdapter.ts` is a temporary bridge, not the
future architecture** - stated explicitly in its own file header, not
just here. `adaptRecommendationsToProductionChoices` maps Environment/
Effects Ambition into `setQualityAmount`/`practicalEffectsAmount`/
`vfxAmount` via the same `logAmount` scaling every other spend dial
already uses; Contingency passes straight through (still directly
player-set, its own redesign still deliberately parked pending the
event-consumption question from the start of this whole arc); Runtime
Target stays on this screen too, unexposed to Strategy/Ambition and not
yet moved to Post-Production (a real idea, out of scope for this pass).
Once cost/schedule/risk formulas are migrated to read Strategy/Ambition
natively, this file and the `ProductionChoices` fields it derives should
be deleted, not extended - the whole point of naming it an adapter
instead of quietly letting it become "just how it works."

**`SET_PRODUCTION_CHOICES` is gone, replaced by `SET_PRODUCTION_PLAN`**
(`state/gameState.ts`, `state/studioReducer.ts`) - takes the full
Strategy/Ambition/Contingency/Runtime set every time (mirroring how the
old action always took a complete `ProductionChoices`), derives
`ProductionChoices` via the adapter in the same reducer case. `FilmDraft`
gained `environmentStrategy`/`environmentAmbition`/`effectsStrategy`/
`effectsAmbition` (nullable until Plan Production is first visited, seeded
from the recommendation on mount the same way the old screen seeded flat
defaults). Save format bumped to v16.

**Deliberately not built yet:** Costume/Creature Effects/Crowd Strategy
cards (no recommendation exists for them - 5.26/5.27's `OptionalRecommendation`
gate means they simply don't render rather than needing a special case);
`engine/scoring.ts` migration off genre importance; persisting the
player's Strategy/Ambition choices onto the final `Film` record for
historical display (`FilmDetailModal` still only shows the derived
legacy `ProductionChoices`, so a released film's original creative
identity doesn't survive into Studio History yet - a natural next step
once reviews are meant to reference these decisions, the original goal
this whole arc started from).

### 5.31 Hire Talent rebuilt as a Cast & Crew hub (`components/wizard/HireTalent.tsx`, `components/wizard/RoleHiringDrawer.tsx`, `data/talentPresentation.ts`)

The same "producer feeling" the Plan Production redesign was built around
(5.30), applied to casting: one long scrolling page of seven stacked
slider-plus-grid sections becomes a hub the player returns to between
individual hires, each one opened deliberately rather than scrolled past.

**The hub is a dashboard, not a menu.** Script summary, a Production
Overview card (Cast & Crew Progress bar, roles-filled count, current
payroll), the same Production Identity synthesis Plan Production shows
later (5.30's `synthesizeProductionIdentity`, computed here as soon as a
script and a director exist - both Strategy recommendations only ever
needed those two things, so this is a genuine reuse, not a new function),
soft quality warnings (see below), the master budget slider, and a grid of
one tile per role. A tile shows either a one-line hook + "Not yet hired"
(empty), a name + role-category-aware headline stat (single-slot, filled),
or a live "X/Y hired" badge with every hired name listed (multi-slot -
Supporting Actor today, any future ensemble role for free). Clicking any
tile - filled or empty - opens that role's hiring drawer; a filled tile is
never locked, since changing your mind about a hire has to stay as easy as
making it the first time.

**Soft warnings, deliberately not gates.** `lowCompatWarning` (average
compatibility across hired cast below 45) and `temperamentWarning`
(average reliability below 45 or average ego above 65) both need at least
two hires before they can fire, so a nearly-empty cast doesn't trip a
false alarm. Purely informational - `canContinue` still only depends on
`missingMandatory`/`canAfford`, same as before this redesign.

**Every role is hired through the same mechanism but doesn't read the
same.** `data/talentPresentation.ts` assigns each of the seven roles a
`RoleCategory` (`director` | `actor` | `crew`) plus its own blurb/hook
copy. A candidate card's headline stats are category-aware:
Director leads with its own production-style lean (`describeProductionStyle`,
built from `engine/recommendation.ts:dominantLean` on the candidate's own
`productionStyle` - the same math Plan Production's cards use, now
visible one stage earlier) plus compatibility and reliability; actors lead
with fame, compatibility, and reliability; crew roles lead with skill and
reliability. Salary and ego stay put as a plain secondary line for every
category - never a headline, since ego is a caution stat, not a selling
point. Writer/Composer/Editor/VFX Supervisor share the crew template
rather than four bespoke ones - the data model has nothing to
differentiate them by beyond a flat skill number (no genre-expertise
stat, no "previous work" history), so a bespoke presentation for each
would have been decoration without substance. Named here as a deliberate
scope boundary, not an oversight - a real candidate for future Script/
Talent model enrichment (5.26's discipline: propose a field only once a
concrete consumer exists) if genre-specific crew expertise ever becomes
worth modeling.

**Container: a slide-in drawer, not a page.** Chosen over a dedicated
screen specifically for continuity - "the player should never feel like
they left the production they're assembling." `RoleHiringDrawer` is a
fixed-position overlay (backdrop + panel, `role-drawer`/`role-drawer-backdrop`),
not a `Screen`/wizard-step transition - opening and closing it never
touches `GameState.screen` or costs calendar time, the same "detour,
not navigation" principle `RivalStudioPage` and the Recommendation
Inspector already established. Body scroll is locked and Escape closes it
while open, matching standard overlay conventions this app didn't
previously need. Auto-closes ~500ms after a single-slot role gets a
genuinely new hire (long enough to register the "Hired" confirmation,
short enough to still feel immediate) - but never on a deselect, since a
player who just cleared a role is about to pick someone else, not leave.
Stays open for multi-slot roles regardless, tracking "X/Y hired" live in
its own heading so several people can be hired in one visit. Pin-to-compare
now lives entirely inside the drawer as local state, reset for free every
time it mounts - simpler than the old page's manual "pinning a different
role resets the rail" logic, which this redesign made unnecessary rather
than needing to preserve.

**Naming**: deliberately did *not* rename the stage to "Pre-Production" -
that term covers budgeting/scheduling too in real film terms, which is
Plan Production's territory one stage later; using it here would imply
overlap that doesn't exist and set up confusion once the player reaches
that screen right after. The page heading changed to **"Cast & Crew"**
(the step nav still reads "Hire Talent," `components/common/WizardSteps.tsx`
untouched) - a small, easily-reversible inconsistency flagged here
rather than silently resolved either way, since it wasn't explicitly
settled before implementation.

### 5.32 Cinematographer - a missing mandatory role (`types/index.ts`, `data/talentGeneration.ts`, `data/talentPresentation.ts`)

A genuine gap, not a deliberate scope cut: Cinematographer/Director of
Photography was simply never in the original role brainstorm, and every
extension since (Acting Style, tone profiles, Strategy/Ambition) worked
within the existing seven-role set rather than re-examining whether that
set was complete. Added as an eighth `TalentRole`, mandatory (every real
production has one), same `CrewTalent` shape as Writer/Composer/Editor -
salary range £25k-£6M, fame ceiling 62 (between Composer and VFX
Supervisor - some working DPs are genuinely well-known, most aren't).

**How little this actually touched is itself informative** - a genuinely
useful signal about how consistently this codebase avoided hardcoded role
lists. Adding the role to `MANDATORY_TALENT_ROLES` plus one entry each in
`ROLE_GENERATION_PROFILES`, `ROLE_CAPACITY`, and `data/talentPresentation.ts`
(TypeScript's `Record<TalentRole, ...>` forced completeness on all three -
the build simply wouldn't pass with one missing) was the entire change.
Talent generation, rival casting, the Cast & Crew hub's tile grid, the
hiring drawer, budget splitting - all already iterated `TalentRole`
generically rather than naming roles individually, so a new mandatory role
is a config entry, not a new code path anywhere. Verified directly: a
500-day rival-market simulation cast a Cinematographer into all 30
released rival films with zero special-casing needed, and a full player
playthrough (hub tile, drawer, hire, auto-close, Continue-gating, into
Plan Production) worked on the first pass once the build was clean.

**Known limitation, shared with the crew roles this joins, not new to
it**: Cinematographer's `skill` doesn't feed `computeQualityBreakdown`
(`engine/scoring.ts`) any more directly than Writer/Composer/Editor/VFX
Supervisor's already didn't - none of the four below-the-line crew skills
feed quality scoring today, only `talentSkillScore` in `skillSensitive`
interactive events and their own salary cost. Worth knowing given "the
person who shoots the film" is a reasonable thing to expect to move visual
quality more directly than that - but this is an existing gap in how crew
skill is used generally, not something specific to Cinematographer, and
not something to quietly patch only for this one role while leaving the
other three as they are.

**Deliberately not done**: no Cinematographer-specific interactive event
templates (`data/productionEvents.ts`) - the other `involvesRole` crew
events (Writer, Editor, Composer) were each hand-authored and balanced
individually; matching that for Cinematographer is real, separate work,
not a required part of fixing the role gap itself. Also deliberately not
explored: whether a Cinematographer should influence Environment/Effects
Strategy the way Director's `productionStyle` does (5.26) - genuinely
plausible given how much of what a DP does overlaps with "how is this
shot," but that would mean a second influence source on the Strategy
blend, which was an explicit, deliberate scope decision (script primary,
director nudges, nothing else - 5.27) that shouldn't be revisited as a
side effect of fixing an unrelated gap.

Save format bumped to v17 (`state/persistence.ts`) - an existing save's
`talentPool` has no Cinematographer candidates and no past `Film` ever
cast one.

### 5.33 Mobile web (`src/index.css`)

CSS-only, every screen reviewed, deliberately scoped so desktop is
pixel-identical to before - verified directly via matched-viewport
screenshots (1280px) on two screens both before and after, not just
assumed from the diff. Every mobile-specific rule lives inside either the
existing `@media (max-width: 900px)` tablet breakpoint, a new
`@media (max-width: 640px)` phone breakpoint, or a `@media (pointer:
coarse)` touch-target block - nothing outside a media query changed
visually, only a couple of `:root` custom properties got introduced as
plumbing (see `--header-clearance` below).

**A real, pre-existing bug found by looking at an actual screenshot rather
than reasoning about the CSS**: `.dashboard-layout`/`.dashboard-right-rail`
and `.event-decision-layout` were never actually collapsing to one column
on narrow viewports, despite a rule that looked like it should. CSS
resolves equal-specificity conflicts by source order - the `@media
(max-width: 900px)` block containing their mobile overrides was written
*earlier* in the file than their own unconditional base rules, so the
later unconditional rule always won the cascade regardless of whether the
query matched. On a phone this meant the Dashboard's Top 10/Rival Studios
rail rendered on top of the main column instead of stacking below it, and
the interactive-event recast panel (5.18) never dropped to one column
either. Fixed by moving that whole media query block to the very end of
the file, after every rule it could possibly need to override - the only
way to make this class of bug structurally impossible going forward
rather than just fixed for the two rules found this time.

**The header/footer "frozen" complaint** (the user's own word, and the
right one): `.wizard-header-sticky` (step nav + `BudgetTracker`) and
`.plan-consequence-strip` both stay permanently pinned to the viewport at
desktop widths, which is fine there - there's room to spare. On a
~650px-tall phone viewport (after browser chrome), a wrapped 7-step nav
plus a wrapped 3-tile budget row could easily reserve 100-160px that never
went away no matter how far the player scrolled, stacked with a *second*
permanently-pinned bar at the bottom of Plan Production specifically.
Un-stuck both (`position: static` under the phone breakpoint) - they
scroll away normally now, same as regular content. Deliberately left
`.sticky-footer` itself sticky (just leaner - reduced padding) rather than
un-sticking everything: reaching Back/Continue without hunting for it at
the bottom of a long page is worth more than ambient progress/budget
visibility is, so the two got different treatment on purpose rather than
uniformly flattening every sticky element.

**Fixed-chrome collision**: `DateBar` (top-left), `ThemeToggle` (top-right)
and the Recommendation Inspector's dev-only toggle (top-center, 5.28) all
share the same fixed y=16px row, sized for desktop width. On a phone the
dev toggle's long label was the thing that actually caused a three-way
collision - resolved by hiding it below the phone breakpoint entirely
(it's never meant to be used from a phone anyway) rather than trying to
shrink all three into an ever-smaller shared space. `DateBar`/`ThemeToggle`
also shrink their own padding/font on the same breakpoint.
`--header-clearance` is a new `:root` custom property `#root`'s top
padding and `.wizard-header-sticky`'s sticky offset both read from - the
phone breakpoint only needs to redefine it once for both to stay in sync,
rather than two numbers that could drift apart.

**Touch targets** (`@media (pointer: coarse)`, deliberately viewport-
width-independent - a touch laptop at a wide viewport has the same
precision problem a phone does, and a mouse-driven narrow window doesn't):
the Plan Production distribution divider's hit area (5.30) widens from a
precise 14px to a forgiving 40px without changing its visible 3px line;
`.btn`/`.btn-sm` padding and the `.tier-slider` thumb both grow slightly.
Verified the drag interaction itself works via `PointerEvent`-based touch
simulation (it already did - the component was built on Pointer Events
from the start, which unify mouse/touch/pen natively) - what needed fixing
was purely the hit-target size, not the interaction logic.

**A test-tooling quirk worth recording, not a product bug**: verifying
`pointer: coarse` mid-flow inside a longer Playwright script sometimes
reported `false` even in a `hasTouch`/`isMobile` context, traced to
Chromium's dynamic pointer/hover media features responding to mixed
mouse-shaped and touch-shaped synthetic events within one test session -
something a real phone, which only ever generates touch-originated
events, can't produce. Confirmed correct in isolation (matched the CSS
rule applying cleanly) before concluding this, rather than assuming.

### 5.34 Box office as an audience simulation - architecture (design frozen; implementation starting - see Milestone 1)

**Status: design frozen, implementation underway in small reviewable
milestones.** This section records an architecture pressure-tested
over several rounds of discussion before any formula or code was written -
`engine/boxOffice.ts`'s existing Opening Weekend -> Legs -> Total Gross model
(5.4, 5.19) stays in place and unchanged until this is actually built.
Recorded here so implementation starts from a stable design instead of
improvising formulas against a half-remembered conversation.

**Motivation.** The Outcome Inspector (`components/dev/OutcomeInspector.tsx`)
- built to let the player load a real film's inputs and see how one changed
value moves ratings/box office - exposed that the existing box office model
is a *formula*, not a *simulation*: Opening Weekend and Legs are each a
single number computed once, multiplied together. That's fine arithmetically
but can't express what audiences actually do - a film that opens small and
grows, one that opens huge and collapses, or one that expands into an
audience nobody expected it to reach - without hand-tuned special cases per
shape. The model below treats a theatrical run as a population of people
making a weekly decision, instead of a two-number formula.

**Core philosophy.** Model **people, not money**. Every quantity here is
either a count of people (or a fraction of a population) or a probability -
never a dollar figure - until the very last step, where
`tickets sold x price = revenue` converts the simulation's output into money
once, at the boundary. Legs is not an input anywhere in this design - it's
`Total Gross / Opening Weekend`, computed *after* a run finishes, exactly
how the real industry reports it (the same principle that already motivated
5.19's move from a single release-day number to a live weekly process,
taken one layer deeper).

The second, harder-won principle: **only introduce state when reality
genuinely requires it; everything else is a derived observation.** An early
draft of this design had a `Momentum` variable meant to explain opening-week
urgency, decay, sleeper growth and surprise overperformance all at once. It
didn't survive - every one of those turned out to already fall out of the
interaction between the pieces below, once Awareness and Interest were
properly separated and connected in a feedback loop. `Momentum` isn't part
of this design at all; where it's useful, it's something a results screen
could *compute* from the weekly history for display, never something the
simulation stores or reads back.

**Fixed release-day state.** Computed once, at release, from the same
inputs `computeReleaseResults` (`engine/releaseFilm.ts`) already has -
script, cast, genre, marketing/release choices. Never recomputed once the
run starts.

- **`TotalAddressableAudience`** - the ceiling: everyone who could
  conceivably see a film like this, as a headcount rather than a dollar
  figure. Same inputs as today's `OPENING_BASE_POTENTIAL x marketSize x
  genrePopularity` chain (5.4), expressed as people instead of money.
- **`BaseInterestFraction`** - of that ceiling, what fraction has genuine
  taste-fit for *this specific film*. Driven by **Marketability**, genre
  fit, and cast fame - the "how many people might like this" half of
  Marketability.
- **`MarketingEfficiency`** - how efficiently marketing spend converts into
  Awareness. Driven by **Marketability**'s other half - how easy the
  premise is to explain in one sentence, not how many people it appeals to.
  Dampened by high **Originality** (a genuinely novel premise is harder to
  pitch even when it would appeal to plenty of people if they understood
  it).
- **`CrossoverCapacity`** - the ceiling on how far Interest can expand
  *beyond* `BaseInterestFraction` via word of mouth. Driven by
  **Originality**. Originality creates the *capacity* for a film to become
  "the one everyone should see" - it doesn't, by itself, mean that happens
  (see Word of Mouth below). A highly original, badly-received film has a
  large capacity that's never realized; a broadly-appealing, unoriginal film
  with an outstanding reaction doesn't need much crossover capacity to post
  huge numbers, because its `BaseInterestFraction` was already wide.
- **`ConversionPacing`** - a baseline weekly *probability* that an
  interested-but-unconverted person attends this particular week (a
  per-person likelihood, not a fraction of the pool "consumed" - the
  distinction matters because it's what lets word of mouth modulate it
  later). Driven primarily by **Release Type** - Wide creates event-scarcity
  urgency with a higher baseline; Limited/Festival First start lower and
  build.
- **Release-day-known reception**: `CriticScore` and `AudienceScore` -
  already computed today (5.1/5.2), unchanged. Deliberately reused rather
  than duplicated behind a new "audience reaction" concept, since they
  already represent exactly that.

Release Type also shapes *initial* Awareness, not just pacing - the richer
read that came out of this design pass: Wide seeds a large initial
`AwareCount` (broad day-and-date marketing reach); Limited seeds a small
one; Festival First seeds almost no *public* awareness but weights
`CriticScore` more heavily in early word of mouth (critics are effectively
the film's first audience, and their reaction can start the loop before the
public has heard of it). A slow-building "platform" release isn't a fifth
type - it's simply what a Limited release looks like once word of mouth
succeeds, which this model produces on its own without a dedicated
mechanic.

**Evolving weekly state.** The only things that change once a run is
underway:

- **`AwareCount(t)`** - cumulative people who know the film exists.
  Monotonically non-decreasing.
- **`InterestedRemaining(t)`** - aware, interested (including any realized
  crossover), and hasn't bought a ticket yet. Shrinks via purchases; grows
  via word-of-mouth-driven crossover, bounded by `CrossoverCapacity`.
- **`CumulativeTicketsSold(t)`** - running total; the only thing money is
  ever derived from, and only at the very end.

That's the complete list. The weekly ticket/viewer history (needed for
reporting regardless - it's what a box office chart already shows) doubles
as the record word-of-mouth strength is computed from, below. No separate
"momentum," "buzz," or "hype decay" variable is stored anywhere.

**Derived, not stored.** Computed fresh whenever needed, never written to
state:

- **`WordOfMouthStrength`** - a function of `AudienceScore` (primary) and
  `CriticScore` (secondary, weighted higher for Festival First).
  Deliberately **convex, not linear** - the same shape already chosen for
  Buzz -> Opening Weekend (5.3/5.4): most films generate fairly ordinary
  word of mouth, and only a genuinely exceptional reception produces a
  disproportionate response. This convexity also answers "should
  recommendation intensity be its own variable" - it isn't, because a
  convex function's marginal output growing with its input *is* "yeah I
  enjoyed it" vs. "you HAVE to see this" scaling with how good the film
  actually was, without a second hidden number to represent it.
- **Current word-of-mouth "pulse"** - a decay-weighted sum over the
  *already-stored* recent weekly viewer history (the week just passed
  contributes fully, older weeks taper off over a handful of weeks).
  Computed from history rather than tracked as its own accumulating
  variable, for the same reason `Momentum` didn't survive: a stored,
  independently-decaying accumulator can drift from what the real history
  implies; a sum over the authoritative weekly record never can.
- **"Momentum" / trend**, if ever shown to the player - this week's actual
  tickets vs. what a naive continuation of last week's trend would have
  predicted. Pure commentary for a results screen, never read back into the
  simulation.

**Where each existing lever enters the system:**

| Lever | Enters as |
|---|---|
| Marketing spend | Seeds initial `AwareCount` (scaled by `MarketingEfficiency`); nothing else |
| Marketability | Splits in two: sizes `BaseInterestFraction` (pool) *and* sets `MarketingEfficiency` (pitch clarity) |
| Originality | Sets `CrossoverCapacity` (the crossover ceiling) and dampens `MarketingEfficiency` |
| Release Type | Sets initial `AwareCount` shape *and* `ConversionPacing`'s baseline |
| Critic Score / Audience Score | Feed `WordOfMouthStrength` - the existing numbers get a second job, nothing new is computed about "reception" |
| Buzz Score | Unchanged from today (5.3) - still purely a pre-release hype input to initial Awareness. Deliberately **not** an input to `WordOfMouthStrength`, which would double-count the same hype through two channels; Buzz's job ends once the film opens |

**The three effects of word of mouth.** Every week,
`WordOfMouthStrength` (scaled by that week's recent-viewer pulse, run
through the convex response) does three separate things, each with its own
sensitivity threshold - ordinary reactions clear the first bar, only
good-to-great reactions clear the second, only exceptional reactions clear
the third:

1. **Grows `AwareCount`** - people who didn't know the film exists learn
   about it from people who've seen it. Lowest bar; nearly every released
   film does this to some degree.
2. **Pulls existing interest forward in time** - boosts *this week's*
   attendance probability (`ConversionPacing`'s per-person baseline) for
   everyone already interested and not yet converted, whether their
   interest is old or new. The mechanism behind "everyone was already
   planning to see it eventually, but the reaction convinced them to go
   this weekend instead of next month" - a film suddenly exploding in week
   2 or 3. Needs a genuinely good reaction, not just an average one.
3. **Realizes crossover** - moves people who were never in the interested
   pool at all into it, bounded by `CrossoverCapacity`. The
   Everything-Everywhere/Barbie mechanic: word of mouth creating new
   interest outright, not just informing or accelerating existing interest.
   Needs the strongest reaction to matter - deliberately the hardest of the
   three bars to clear.

Expressed as person-level transitions: **Never Interested -> Interested**
(effects 1 and 3, at different thresholds) and **Interested -> Going This
Week -> Bought Ticket** (effect 2, plus ordinary `ConversionPacing`).

**A release week, plain English.**

*Week 1:* release-day fixed state is already locked in. `ReleaseType` +
marketing spend seed the initial `AwareCount` in one lump. `BaseInterestFraction`
filters that into the initial `InterestedRemaining` pool. `ConversionPacing`'s
baseline probability determines what fraction of that pool converts this
week - typically the run's largest single week, simply because it's the
first chance anyone's had to act on interest that's been accumulating since
marketing started; no separate "momentum" is needed to explain a big
opening. After this week's viewers have actually seen the film,
`WordOfMouthStrength` (from `AudienceScore`/`CriticScore`) determines what
carries into week 2 - it has no effect on week 1 itself, since nobody's
heard reactions to a film that just opened.

*Every week after (week N):* first, last week's word-of-mouth effect is
applied, before anything else - it grows `AwareCount`, pulls existing
interest forward (boosting this week's attendance probability), and -
bounded by `CrossoverCapacity` - realizes some crossover into
`InterestedRemaining`. Only then does `ConversionPacing` convert a fraction
of the *now-updated* pool into this week's tickets. Whether this week beats
or trails last week isn't an explicit rule anywhere - it falls out of
whether this week's word-of-mouth-driven growth outpaced the pool's natural
depletion (the most-eager remaining people tend to convert first, so what's
left each week skews progressively less eager, absent fresh WOM injection).
That single piece of arithmetic is the entire mechanism for both ordinary
decline and sleeper-hit growth. The run ends when a week's realized tickets
(or the pending word-of-mouth effect about to be applied) drop below a
small threshold, or a hard week cap is hit - the same stopping philosophy
5.19's `MAX_WEEKS`/`MIN_WEEKLY_GROSS_RATIO` already uses.

*At the end:* Total Gross = sum of every week's tickets x price. Legs =
Total Gross / Opening Weekend, reported after the fact, never an input.

**Why this produces the right shapes without special cases:**

- **Huge opening, terrible legs**: high `MarketingEfficiency`/marketing
  spend and a wide `ReleaseType` give a big week-1 `AwareCount` and pool; a
  weak `AudienceScore` means low `WordOfMouthStrength`, so nothing
  replenishes the pool afterward - pure depletion, fast collapse.
- **Tiny opening, incredible legs**: small initial `AwareCount`
  (Limited/Festival First), but an outstanding `AudienceScore` clears all
  three word-of-mouth thresholds every week - awareness keeps growing,
  existing interest keeps getting pulled forward, and crossover keeps
  expanding the pool. Not a "sleeper hit" special case - the same three
  effects any film has access to, just all firing strongly at once.
- **Huge opening, huge legs**: wide reach *and* an outstanding reaction -
  both the pool-size and replenishment mechanisms maximized together.
- **Small, steady indie**: small `TotalAddressableAudience`/`BaseInterestFraction`
  and a modest `AudienceScore` - a small pool converting at a slow, steady
  `ConversionPacing`, without enough word of mouth to meaningfully expand or
  accelerate it, but also without enough negative signal to collapse fast
  either.
- **Platform release**: not a mechanic at all under this design - it's what
  a Limited release's numbers look like once word of mouth is working,
  which falls out of the model instead of needing to be built into it.

**Where competition and international markets slot in later.** Deliberately
not designed yet, but the shape of this architecture keeps both open:

- **Competition** between concurrently-running films is a natural extension
  of the weekly conversion step: a shared "moviegoing attention" pool that
  multiple films' `InterestedRemaining` populations draw from
  proportionally, instead of each film converting against an uncontested
  pool. Requires settling every currently-running film's week *jointly*
  rather than independently (today's `settleBoxOfficeForAllFilms` maps over
  films one at a time) - a real change, but one that slots into the same
  weekly step rather than requiring new state categories. Notably, this
  would have been much harder to add on top of a `Momentum`-style variable,
  since there's no coherent notion of "shared momentum" between competing
  films - Awareness/Interest/Tickets, being genuine population counts, are
  the right currency to share.
- **International markets** decompose naturally into per-market copies of
  the same simulation - separate `TotalAddressableAudience`,
  `BaseInterestFraction` and `AwareCount` per market (domestic vs.
  international, or finer later), each with its own release timing, summed
  at the end. Replaces today's single blended `STUDIO_BOX_OFFICE_SHARE`
  constant (5.4) with real per-market simulation instead of one flat
  multiplier. Staggered international rollout timing (a market's "week 1"
  landing on a different calendar week than another's) needs its own small
  follow-up design pass, not resolved here.

**What deliberately isn't decided yet.** No formulas - every relationship
above is described by its *shape* (convex, threshold-gated, bounded by a
capacity) and *inputs*, not by weights or curves. The next design pass is
choosing those, informed by running real film data through the Outcome
Inspector the same way the existing Buzz curve and quality-dependency-chain
constants were tuned.

**Implementation Milestone 1: isolated types and state
(`engine/audienceSimulation.ts`, `engine/audienceSimulation.test.ts`).**
Domain types and validating constructors only - no wiring into the live
game yet, and no weekly-update formulas (still "equations work," explicitly
deferred). `state/studioReducer.ts` still runs `engine/boxOffice.ts`'s
existing Opening Weekend/Legs model unchanged; nothing about a real game
session is different after this milestone.

- **Fixed state** (`AudienceSimulationFixedState`): `totalAddressableAudience`,
  `baseInterestFraction`, `marketingEfficiency`, `crossoverCapacityFraction`,
  `conversionPacingBaseline`, plus `criticScore`/`audienceScore` reused
  verbatim from `FilmResults`' existing meaning (not duplicated behind a new
  "reaction" concept - see the design section above). The module takes
  these as plain numbers and doesn't import `Film`/`Script`/`ReleaseType` at
  all - translating Marketability/Originality/Release Type into these
  numbers is a later milestone's job, per the "Where each existing lever
  enters the system" table above.
- **Evolving weekly state** (`AudienceSimulationWeekState`): exactly three
  fields - `awareCount`, `interestedRemaining`, `cumulativeTicketsSold` -
  plus the week number. Nothing else. Validated both against its own fixed
  state (`awareCount <= totalAddressableAudience`, `interestedRemaining <=
  awareCount` and `<= maxInterestedAudience`, no repeat viewing so
  `cumulativeTicketsSold <= totalAddressableAudience`) and, via
  `createAudienceSimulationRun`, across consecutive weeks (`awareCount`/
  `cumulativeTicketsSold` monotonically non-decreasing; `interestedRemaining`
  deliberately *not* required to be monotonic, since it both shrinks via
  conversion and grows via crossover).
- **Derived, not stored**: `deriveWeeklyAdmissions` (a week's new ticket
  buyers, from consecutive `cumulativeTicketsSold` values - never its own
  field) and `deriveWordOfMouthActivity` (a recency-weighted lookback over
  admissions history - the piece an earlier design draft called
  `RecentViewershipPulse` before deciding it should be computed from the
  already-stored weekly record rather than tracked as its own accumulator).
  `deriveWordOfMouthActivity`'s lookback weights (`WOM_LOOKBACK_WEIGHTS`,
  currently `[1, 0.7, 0.4, 0.2, 0.05]`) are explicitly a placeholder shape,
  not tuned - the actual curve is equations work for a later milestone.
  `WordOfMouthStrength` (the reception-quality half of word of mouth, a
  function of `criticScore`/`audienceScore`) isn't built yet either, for the
  same reason - this milestone only covers what was explicitly asked for
  ("current WOM activity... derived from recent weekly admissions").
- **Validation**: every constructor throws on out-of-range input rather than
  clamping silently - negative pools, probabilities outside 0-1,
  `NaN`/`Infinity`, `awareCount`/`interestedRemaining` exceeding their
  bounds, and non-sequential or decreasing weekly history are all rejected
  at construction. 37 tests (`npm run test`, Vitest - newly added as the
  project's first test runner, `vitest.config.ts`) cover these plus the
  "fixed state never varies by week" and "no stored word-of-mouth/momentum
  field exists" invariants directly.
- **Deferred to later milestones, by design**: the weekly simulation step
  itself (how these three fields actually move), wiring into
  `Film`/`BoxOfficeRun`/`state/studioReducer.ts`, any save-version bump
  (nothing new is persisted yet, so none is needed), shadow-mode comparison
  against the live model, competition, international markets, and repeat
  viewing.

## 6. Cost model (`engine/cost.ts`, `state/selectors.ts`)

Final results break costs into two headline numbers:

- **Final production cost** = script cost + total cast salary + production
  budget cost (`(setQualityAmount + practicalEffectsAmount + vfxAmount) x runtimeCostMultiplier`,
  5.7) + the shoot's final contingency burn (`PhotographyState.runningCost`,
  5.16 - contingency itself is no longer part of the production budget cost
  formula, it's spent daily during photography instead) + net event cost
  delta + test-screening cost.
- **Marketing cost** = marketing spend amount x release-type cost multiplier
  (Wide costs more to support than Limited). Marketing spend is a continuous
  currency amount (`data/release.ts:MARKETING_SPEND_RANGE`, £10,000 -
  £150,000,000 on a log-scale slider, same pattern as every other spend
  dial), not a named tier - a flat, absolute cost was a deliberate choice
  over scaling it with production budget: what a given level of exposure
  costs doesn't change based on how cheap or expensive the film itself was,
  and a flat cost is what makes the top of the range naturally unreachable
  for a small studio, without needing an artificial rule to lock it out.

`profit = studioRevenue - (productionCost + marketingCost)` - see 5.4 for
why it's `studioRevenue` (the studio's cut after the theatrical split) and
not the flashier `totalBoxOffice` figure.

## 7. Data-driven config

Everything a designer would want to retune without touching engine code
lives in `src/data/`:

| File | Contents |
|---|---|
| `genres.ts` | Popularity, VFX/practical/acting/script importance, low-budget tolerance, canonical tone profile, and typical target audiences (`GENRE_TYPICAL_AUDIENCES`) per genre |
| `tones.ts` | The six tone axes (`TONES`) and their display labels, used by Script and Director (see 5.11) |
| `actingStyle.ts` | The five acting-style axes (`ACTING_STYLE_AXES`), their labels, and the weighted mapping (`ACTING_STYLE_TONE_WEIGHTS`) that translates an Actor's style into tone-space for compatibility scoring (see 5.11) |
| `audiences.ts` | Market size per target audience |
| `talentGeneration.ts` | Per-role salary range and fame ceiling for procedural talent, the mandatory/optional role lists, and per-role hiring capacity (`{min, max}`) |
| `talentNames.ts` | First/last name word banks for procedurally generated talent |
| `scriptWords.ts` | Per-genre title word banks (12 adjectives x 12 nouns) for procedural script titles - `engine/scriptGenerator.ts` also dedupes titles within a single slate on top of this |
| `production.ts` | Ranges and anchors for the five continuous production dials (see 5.7) |
| `schedule.ts` | Fixed in-game day cost per wizard stage other than Photography, which is lived through instead (`STAGE_DURATIONS`, see 5.16) |
| `postProduction.ts` | Cost/score deltas for edit style, music, test screening, final cut |
| `release.ts` | Marketing spend range/anchors (continuous, log-scale), release type profiles (incl. `baseLegsMultiplier`), release window bonuses |
| `productionEvents.ts` | The generic pool of on-set event templates, `GENRE_EVENT_TEMPLATES` (one positive/negative pair per genre), and `RISK_DIMENSION_EVENT_TEMPLATES` (a positive/negative bank per risk dimension, see 5.9) - all merged into the same per-day event pool during photography. A template is either the auto-applying shape or `interactive: true` with player-facing choices (see 5.17) |
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

- **Talent persists and now has real scheduling against rivals, but not
  against the player's own films or any relationships.** `Talent.bookedUntil`
  (5.24) makes a candidate genuinely unavailable while an AI rival has them
  cast - but the player's own hires never set it, since only one of the
  player's own films is ever in production at a time, so there's still
  nothing for a *player-vs-player* scheduling conflict to conflict with.
  Loyalty/grudges from repeat collaboration, or fame/stats drifting over
  time based on how a talent's films performed, remain natural next layers
  on top of the same persistent roster.
- **Only Principal Photography's days are genuinely lived through.** Every
  other stage's calendar cost (5.16, `data/schedule.ts:STAGE_DURATIONS`) is
  a flat number charged on leaving, not something the player watches happen
  the way filming now is - Develop always costs exactly 7 days whether the
  script search was quick or agonizing. Deliberate scope boundary for this
  pass, not an oversight: Photography was the stage the original request
  was specifically about, and giving every stage the same live treatment
  would have been a much larger change than "does time pass, and does
  filming feel real."
- **No trait/sub-skill layer under ActingStyle yet.** The five acting-style
  axes (5.11) are deliberately clean, single-purpose specialists partly so a
  future trait system has something uncrowded to attach to - narrower
  buffs/debuffs like dance, guns, swords, singing, or physical attributes
  that would nudge specific roles rather than a whole axis. Not built yet;
  noted here so the current axis shapes aren't mistaken for the finished
  picture.
- **Candidate sampling is randomized, not exhaustive.** ~100 stratified
  candidates per role (200 for Lead/Supporting Actor) gives dense coverage,
  but it's still finite - the
  single cheapest (or single best) possible hire for a role won't always be
  in the pool. Unlike before, there's no reroll to fall back on (rerolling a
  persistent named roster would discard whoever's already been hired
  elsewhere) - what's in the pool for that save is what's available, for the
  life of that save. This is deliberate (real casting doesn't offer infinite
  options either) but worth knowing when reasoning about "why didn't I see
  anyone under £X".
- **Marketability score is computed but not fully load-bearing.** It doesn't
  surface anywhere yet - a clean hook for a future mechanic. (Buzz *used* to
  be in this bullet too, but as of the box office rebuild below it directly
  drives Opening Weekend - no longer a cosmetic number.)
- **Marketing is a single spend dial, not distinct channels.** Trailers,
  press/interviews, brand collabs etc. would be a thematically richer way to
  spend a marketing budget than one slider, and came up when this area got
  rebuilt - deliberately deferred rather than designed alongside the
  Buzz/Opening/Legs restructure, since that rework was about fixing economic
  scale, not adding decision-richness. Worth revisiting now that a real Buzz
  mechanic exists for channels to feed into.
- **Multi-genre blending is emergent only, not player-directed.** A script's
  tone profile (5.11) picks up its variety from jitter plus 0-2 randomly
  rolled flavor-tone boosts, but there's no secondary-genre picker giving the
  player deliberate control over *which* flavor a script leans into - a
  natural addition if wanting a specific combination (rather than rolling
  the slate until one shows up) starts to feel necessary.
- **requiredLeads/requiredSupporting don't vary by genre.** Every genre
  draws from the same weighted distribution (`engine/scriptGenerator.ts:LEAD_COUNT_WEIGHTS`/
  `SUPPORTING_COUNT_WEIGHTS`) - an ensemble-heavy genre and a two-hander
  genre are equally likely to produce a 3-lead script right now. Genre-flavoring
  these the way `canonicalTone` and `GENRE_TYPICAL_AUDIENCES` already are
  would be a natural follow-up.
- **No awards, franchises, scandals, or physical studio facilities/
  upgrades.** AI rival studios shipped (5.24); these are the remaining
  explicitly-out-of-scope items from the original MVP brief, and should
  still slot in as new `data/` + `engine/` modules without touching the
  wizard flow. A hireable Producer / upgradeable studio-lot system in
  particular was discussed but deliberately deferred to its own design pass
  - its value is easier to pin down now that real competition (5.24) gives
  "getting to a candidate before a rival does" actual stakes, but the
  mechanic itself isn't scoped yet.
- **No postmortem beat connecting named on-set events back to the Results
  screen.** `draft.events` already carries which specific templates fired
  during production (5.9), and `storyReport.ts` (5.13) already proved the
  curated-bank narration pattern for the buzz/reception trajectory - a
  "the rushed schedule led to reshoots that cost the film its edge" beat
  built the same way is a natural, separable follow-up, not built alongside
  the risk-profile rework itself.
- **No "Creative Freedom" mechanic.** Considered as a sixth production risk
  dimension (5.9) and cut for having no concrete input - there's no
  studio-executive/producer-notes system to be constrained *by*. Would need
  that mechanic to exist first before the risk dimension would mean
  anything.
- **Balance is tuned, not proven.** The scenario table in 5.4 was produced by
  running the real engine (`engine/boxOffice.ts`) against a handful of
  representative inputs by hand - there's no automated test suite pinning
  these numbers yet. Worth adding before any serious rebalancing pass, so
  future tuning doesn't silently break the "expensive bad films flop" promise.
  The Dashboard's "Export Film History (JSON)" button
  (`state/exportFilmHistory.ts`) helps here in the meantime - it downloads
  every released film's full script/cast/choices/results as one JSON file,
  so a specific confusing result (e.g. "buzz was high, why was opening
  weekend still small?") can be checked against the actual recorded inputs
  instead of guessed at from the Results screen alone. The same Dashboard
  also has a "How It Works" button (`components/common/GameGuide.tsx`) - a
  plain-language walkthrough of the mechanics for players, deliberately
  separate from this document rather than a rendering of it, since this
  document is written for whoever's maintaining the code (raw formulas,
  file paths, historical postmortems) and would be the wrong thing to hand
  a player trying to understand why their last film flopped. Kept in sync
  by hand, not generated from this file - worth remembering to update both
  when a mechanic changes.
- **History: the box office formula was rebuilt once already, for being
  badly overpowered.** The original single-stage version (`raw =
  BASE_MARKET_POTENTIAL x <chain of ~10 multipliers>`, `totalBoxOffice` computed
  directly, `profit = totalBoxOffice - totalCost` with no revenue split) had
  several compounding problems found by actually running it: the worst
  possible cast on a mid-budget film still netted **+£26M profit**; playing
  8 mediocre-but-not-terrible films in a row, reinvesting everything, took
  starting cash from £10M to **£295M** with every single film landing as a
  "Hit"; and marketing spend alone (a flat tier, decoupled from the film's
  own budget) could more than triple box office for a small fraction of the
  film's cost. Root causes: no theatrical revenue split (treating
  `totalBoxOffice` as 100% studio profit, when real studios keep roughly
  40%), floors on the quality-to-multiplier curves shallow enough that
  mediocre scores still landed 80-98% of the way to the maximum multiplier,
  and marketing acting as a second, redundant box-office multiplier on top
  of an already-generous base. The current two-stage Opening/Legs model
  (5.4) with a studio revenue split fixed this - the same worst-cast
  scenario now nets a modest +£1.55M, and the 8-film trajectory grows
  roughly 3.7x instead of 30x. Documented here so a future rebalancing pass
  has the actual failure mode on record, not just "it felt off."
- **History: `budgetScaleFactor` was removed from Opening Weekend for the
  same reason - a redundant multiplier that undercut the mechanic it was
  supposed to serve.** After the Opening/Legs rebuild above, a player
  correctly noticed that a high-Buzz film could still open surprisingly
  small, and asked why production budget should affect Buzz at all - it
  doesn't (Buzz is fame/reputation/marketing only), but budget *did* still
  independently multiply Opening Weekend on top of Buzz's own hype factor,
  a carry-over from the original single-stage formula. That didn't hold up:
  audiences can't judge production value before buying a ticket, so it
  isn't a legitimate opening-day factor - it's a reception factor, and
  already had a correct path to the score through Production Score ->
  Quality -> Critic/Audience -> legs. Removed the term entirely and
  re-tuned `OPENING_BASE_POTENTIAL` from £12M to £24M to compensate for the
  lost multiplier, re-verifying against the same failure scenarios: the
  worst-priced-cast scenario still nets a modest profit, a genuinely bad
  film still flops regardless of budget (confirmed at both a cheap £2.5M
  and an expensive £41M budget), and Buzz now has a clean, single-cause
  relationship with Opening Weekend instead of a diluted one.
- **History: studio cash was being credited with `totalBoxOffice` instead
  of `studioRevenue` at release time, silently undercutting the revenue
  split above.** `RELEASE_FILM` in `state/studioReducer.ts` computed
  `profit` correctly from `studioRevenue` for display, but the actual cash
  mutation (`cashAfter = cash - totalCost + totalBoxOffice`) used the full
  headline gross - so a studio's cash grew roughly 2.4x faster than the
  profit figure shown on the Results screen implied, reintroducing the same
  kind of overpowering the two rebuilds above were fixing, just one level
  removed from the formula itself. Found incidentally while wiring up the
  Studio Report feature below; fixed to use `studioRevenue`, matching
  `profit`'s formula exactly.
- **Results screen narration ("Studio Report").** A short templated
  paragraph above the Reviews card, read in an omniscient trade-press voice
  rather than the in-world critic quotes below it -
  `data/storyBeats.ts` + `engine/storyReport.ts`. Deliberately not
  freeform/LLM-generated text: a beat is chosen *conditionally* from what
  actually happened (an `openingTier` from Buzz Score crossed with a
  `receptionTier` from the same audience-weighted critic/audience blend
  `reviewLegsFactor` uses), then one of several pre-written phrasings for
  that outcome is picked at random - closer to a sports-commentary
  generator than either a fixed template or free text. Built as the first
  of a planned three "beats" (trajectory now; a named critic/audience
  highlight and a studio-milestone/budget-framing beat are follow-ups, not
  yet built) that `generateStoryReport` already joins from an internal
  `beats: string[]` array for exactly that reason, even though only one
  beat exists today.
