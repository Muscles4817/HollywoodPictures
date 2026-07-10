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
totalBoxOffice    = openingWeekend * legs

studioRevenue     = totalBoxOffice * 0.42   // the studio's actual cut after theatrical/international splits
profit            = studioRevenue - totalCost
```

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
ranges - nothing requires a choice to touch more than one of them, and most
of the ten interactive templates (two per risk dimension, one per
negative/positive split - `moraleRisk`, `safetyRisk`, `technicalComplexity`
and `budgetRisk` each get one of each polarity; `schedulePressure` gets two
negative, since a schedule crisis is the clearest natural fit for a
decision) deliberately keep each option to a single resource: pure quality
("cut your losses"), pure money ("throw money at it"), pure time ("take
the extra time"), or pure buzz ("let the team show it off online"). Picking
one dispatches `RESOLVE_EVENT_CHOICE`, which rolls that choice's outcome
(`engine/production.ts:resolveEventChoice`), appends it to `events` with
the situation + choice label folded into its description, applies its own
`delayDaysDelta` on top of the calendar (separately from the day the
situation itself consumed), and flips `status` back to `'in-progress'`.

`FINISH_PHOTOGRAPHY` was already gated to `status === 'in-progress'`, so it
naturally can't be used to skip past a pending decision - the Finish and
Fast Forward buttons are hidden by the same status check on the UI side.

Save format bumped to v10 (`state/persistence.ts`) - `ProductionEvent` lost
`delayRiskDelta` and gained `delayDaysDelta`, and `PhotographyState` gained
`pendingChoice`, so a v9 save wouldn't shape-check cleanly.

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

- **Talent persists but still has no scheduling or relationships.** The
  roster now lives in `studio.talentPool` and is the same across every film
  in a save (Section 5.8), so "the same actor across films" exists as a
  concept - but nothing yet tracks whether someone's "busy" on another
  project, builds loyalty/grudges from repeat collaboration, or lets an
  talent's fame or stats drift over time based on how their films performed.
  All natural next layers on top of a persistent roster. Now that a real
  calendar exists (5.16), "busy" specifically has become buildable in a way
  it wasn't before - a hired actor's dates could plausibly block them from
  another film's overlapping principal photography window - but this game
  only ever has one film in progress at a time regardless, so there's
  nothing for a scheduling conflict to conflict *with* yet.
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
- **No AI rival studios, awards, franchises, scandals, or physical
  facilities** - all explicitly out of scope for the MVP per the brief, and
  all should slot in as new `data/` + `engine/` modules plus one more studio
  field, without touching the wizard flow.
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
