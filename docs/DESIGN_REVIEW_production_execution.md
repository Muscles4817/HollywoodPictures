# Design Review — Production Execution (Phase 1)

Phase 1 of `docs/SIMULATION_PHILOSOPHY.md`: **reconnect the player's production
execution and on-set events to the finished film.** The shoot already happens
day by day and records real events; until now those events had almost no effect
on the finished film. This change makes the recorded shoot history materially,
explainably, and deterministically shape the film — with no new release-time
randomness.

Deliberately **out of scope** for this phase (seams left in place, see below):
rival execution, full Studio Identity, and the full creative-dissonance system.

---

## 1. The previous leverage problem (audit)

Traced through the engine as it stood:

- **Production score** (`computeProductionScore`) is a blend of the four spend
  dials + shooting-pace quality. Genuinely variable (stdev ~13.7 across the AI
  field), but…
- **Production has no top-level quality weight.** `computeQualityWeights`
  returns weights for script / direction / acting / post-production only.
  Production reaches `qualityScore` *only* through the "captured footage"
  ceiling on the edit.
- **On-set events folded into production as one flat number.** The old
  `computeQualityBreakdown` did `productionScoreWithEvents = production + Σ
  eventQualityDelta`, then production entered via the footage chain.
- **Net effect:** working the dependency chain analytically, a *full-range*
  swing in production moved `qualityScore` by **~2 points**, and a shoot's worth
  of events (each ±2…±10) moved it a fraction of a point. Production risk
  (`moraleRisk`/`safetyRisk`/`technicalComplexity`/`budgetRisk`, driven by
  talent **reliability** and ego) was modelled in detail and then thrown away.
  Reliability influenced only the *odds* of a morale event, never the film.
- **Coverage** already had the one honest production→department link
  (`editCoverageCeiling`: an under-shot film caps the edit), but it read raw
  `shootingRatio` only — lost *scenes* mid-shoot didn't reduce it.

Confirmed empirically in `aiStudioStats.diagnostic.test.ts`: production was the
highest-variance department and had roughly cosmetic effect on final quality.

## 2. The new causal model

The recorded shoot history is turned into typed, per-department **execution
modifiers**, which scale the department *outputs* at the root of the existing
dependency chain — so a gutted performance drags down everything downstream that
leans on it, exactly as a genuinely weaker department would.

```text
Creative + production decisions
        ↓
Risk profile (moraleRisk/safetyRisk/technicalComplexity/budgetRisk + schedule pressure)   [unchanged]
        ↓
Per-day event rolls during the shoot (recorded facts)                                       [unchanged]
        ↓
classifyEventImpact: each event → the finished-film department it shaped         [new]
        ↓
computeExecutionProfile: typed, resilience-mitigated, per-department modifiers    [new]
        ↓
computeQualityBreakdown: modifiers scale department outputs through the chain      [rewired]
        ↓
Finished film (+ a player-facing, causally-explained execution summary)           [new]
```

`engine/productionExecution.ts` is a **pure, deterministic** read of already-
recorded facts. It rolls nothing. Same history + same shootingRatio + same
talent/plan ⇒ same film. The randomness stays where it belongs — in the shoot.

### Impact types (`ProductionExecutionImpact`)

Consequence-typed (what part of the film an event shaped), the smallest model
that improves causality:

| impact | routed to | example events |
|--------|-----------|----------------|
| `performances` | Acting output | morale collapse, chemistry, improv, on-set conflict |
| `coverage` | edit ceiling (footage) | lost shoot days, a scene cut for time |
| `visual` | Post-production output | VFX/technical failure, a set collapse, a stunt |
| `pacing` | Post-production output | the twist not landing, a temp-score clash, editing |
| `script` | Screenplay output | mid-shoot rewrites, script-doctor calls |
| `general` | Post-production output | budget/logistics, uncategorised |

Events carry an explicit `impact` set at roll time; legacy/saved events with no
`impact` are classified from their id by `classifyEventImpact`, so **no save
migration is needed** to route old events. Templates may also author an explicit
`impact` to override the inference (a seam for future authored events).

### Routing (`computeQualityBreakdown`)

Each modifier scales one department's *output* before the chain:

```
executedScript  = scriptScore          × scriptExecution
executedActing  = actingScore          × performanceCapture
executedPost    = postProductionScore  × postExecution     (post already capped by coverage)
coverageRatio   = shootingRatio + Σ coverage-event points  → editCoverageCeiling
```

Direction is left unmodified — it is the upstream driver execution flows *from*.

### Avoiding double-counting

The concern is: does routing execution re-use a department's own score? No.

- Each execution multiplier is an **orthogonal on-set reading** — "how the
  performances were captured", "how the footage cut together", "the material as
  rewritten" — not a re-derivation of the department's raw casting/craft score.
  A great cast (high `actingScore`) whose shoot melted down (low
  `performanceCapture`) is a real, distinct outcome from a mediocre cast that
  performed to its level.
- Each impact bucket routes to **exactly one** effective term. `performances` →
  Acting; `coverage` → the edit ceiling; `pacing`/`visual`/`general` → the
  Post-production output; `script` → the Screenplay term. No term receives two
  buckets except Post-production, which aggregates the finished-cut readings —
  a coherent single grouping, not overlapping sources.
- Production events **no longer also fold into the production score** (that path
  was removed), so there is no place the same event is counted twice.
- Direction is untouched, so nothing double-counts against it.

### Positives and negatives combine multiplicatively

Within a department, positive and negative execution points are combined
*multiplicatively*, not netted: `mult = (1 + Σpos·k⁺) · (1 + Σneg·k⁻)`. A failed
VFX sequence still leaves its mark even if the set looked great — a genuinely
mixed shoot reads as *marked*, not blandly averaged to neutral. This is the main
reason realistic (not just hand-built) shoots produce a real spread.

### Reliability as a mitigation lever

`computeExecutionResilience` = a blend of average cast/crew **reliability** and
**contingency** margin (0–1). Resilience softens *negative* execution points
(up to 50%) — a reliable, well-resourced production absorbs the same on-set
problems with less damage to the finished film. Positives are never mitigated (a
good day is a good day). Reliability now matters twice — it already lowered the
*odds* of morale trouble; it now also lowers the *severity* of whatever does go
wrong. That double role is intended: it is what makes reliability a lever worth
paying for, and it keeps ambition from being an irrational trap (you can buy the
risk back down).

## 3. Balance outcome

From `productionExecution.diagnostic.test.ts` (400 projects × 3 resourcing
cohorts — the *same* creative projects resourced carefully vs recklessly):

| cohort | mean Q | worst execution drop | disappoint (>3pt loss) | overperform (>3pt gain) | catastrophic | strong+ |
|--------|-------:|---------------------:|-----------------------:|------------------------:|-------------:|--------:|
| careful (reliable + deep contingency) | 51.4 | −2.6 | 0.0% | 16.5% | 0.0% | 46% |
| typical | 50.1 | −4.1 | 1.3% | 5.3% | 0.0% | 23% |
| reckless (unreliable + thin reserve) | 48.7 | −7.9 | 10.0% | 3.0% | 2.0% | 10% |

This matches the intended shape:

- **Downside is real** — a reckless shoot can shed ~8 points; troubled shoots
  have visible consequences.
- **Upside remains possible** — exceptional shoots lift the film (+5), and a
  careful production overperforms 16.5% of the time.
- **Reliable productions stay predictable** — careful worst-case is −2.6 and
  *zero* catastrophes; catastrophes require genuinely reckless resourcing (2%),
  and are always causally justified.
- **Tails are asymmetric and mitigable** — reckless drop (−7.9) dwarfs its lift
  (+4.6); reliability + contingency buy the risk back down.
- **Variance is decision-driven** — the careful↔reckless mean gap is ~2.6pts on
  identical creative projects, and their delta distributions diverge sharply.

The *mechanism* has much more range than the *typical* case shows (a
hand-built catastrophic history drops quality 8–14 points — see the tests);
average shoots move less because the event bank is deliberately gentle and
roughly balanced. Widening the realistic spread further (event magnitudes /
risk-driven polarity) is a natural, separate content lever — see Deferred work.

## 4. What the player sees

At release (and in the historical film-detail modal), a **Production Execution**
card: a 1–5 star rating, a qualitative headline, one causal sentence, and the
named causes (the actual events, tinted by direction). No raw internal numbers
appear in the UI. Example:

> **Production Execution ★★☆☆☆**
> A troubled shoot left its mark on the finished film.
> The shoot weakened the performances.
> ▼ A morale collapse gutted the performances.
> ▼ Lost shoot days left scenes uncovered.

The numeric modifiers persist on `FilmResults.productionExecution.modifiers` for
dev inspectors and tests only.

## 5. Causal history preserved

The finished film keeps the source of truth: `film.events` (the real recorded
shoot) plus `results.productionExecution` (the resolved outcome + its named
causes + the numeric modifiers). The explanation is built from the actual
history, never reverse-rationalised from a final score.

## 6. Seams for later phases

- **Rival execution (Phase 2).** `computeExecutionProfile` takes plain inputs
  (events, shootingRatio, talent, plan). A future rival resolver can synthesize
  a rival's events from its risk profile and call the *same* function, so rival
  and player films converge on one execution model. Rivals record no shoot
  today, so they resolve to a neutral profile and are unaffected in Phase 1.
- **Studio Identity (Phase 3).** Not implemented. The decision sites it will
  drive (`evaluateOpportunityForTier`, the rival casting loop, `deriveRivalSpendPlan`,
  the random post-production picks) are unchanged and clearly localised.
- **Creative dissonance (Phase 4).** Not implemented. It will enter as an input
  to the *risk* model (widening event probabilities), upstream of this module —
  `computeExecutionProfile` already consumes whatever event history results, so
  it needs no change to benefit. Nothing here assumes compatibility can only
  ever be a deterministic quality penalty.

## 7. Migration / compatibility

Additive and defensive. `ProductionEvent.impact` and
`FilmResults.productionExecution` are both optional; legacy events classify from
their id (no migration), legacy films simply omit the card. Save key bumped
`v50 → v51` (documented in `persistence.ts`) as the honest "stored shape
changed" signal; stored results are historical fact and never recomputed, so the
scoring change can't retroactively alter an old film's numbers.

## 8. Deferred work & known concerns

- **Event bank is gentle.** The realistic spread is modest because event
  magnitudes are small and polarity is roughly balanced. The single highest-
  impact follow-up is a risk-driven event rebalance (bigger magnitudes, more
  lopsided polarity for high-risk shoots) — squarely in the spirit of Phase 1,
  but a content pass, kept separate to bound this change.
- **Rivals don't yet execute** (Phase 2) — their films are still deterministic.
- **Coverage rarely binds** on a normally-shot film (the edit ceiling only bites
  well below ratio 1); it's most impactful on already-thin shoots.
- Tunables (`PERFORMANCE_CONV`/`POST_CONV`/`SCRIPT_CONV`/`COVERAGE_TO_RATIO`/
  `MAX_MITIGATION`, star thresholds) live at the top of
  `engine/productionExecution.ts`; re-measure any change with the diagnostic.

---

# Recalibration pass (player-side validation)

A focused calibration pass after the initial wiring, before any rival work. The
goal: make careful production _preserve_ a project (not passively elevate it),
make reckless production genuinely dangerous, and drive the tails from causal
event histories rather than a bigger score roll.

## Event severity tiers & consequence routing

The event bank was audited. Existing severe events were **strengthened** (rather
than adding many new events) so a shoot that rolls a genuine disaster feels it:

| tier | example events | quality hit (per event) | escalates |
|------|----------------|------------------------:|----------:|
| mild | a nice take, a minor wrinkle | ~±2…6 | 0 |
| meaningful setback | scene cut for time, no-chemistry leads | ~−7…−11 | 0.25–0.4 |
| major failure | week of unusable footage, stunt hospitalisation, walk-off, VFX rebuild, set collapse | ~−12…−16 | 0.5–0.8 |
| catastrophic chain | any major failure that seeds further trouble (below) | compounding | — |

Every template now **owns** its consequence: an explicit `impact` (which
finished-film department it shapes) and an `escalates` seed (downstream
pressure). Genre and risk-dimension banks are tagged by their dominant
department via `tagImpact()`, with per-template inline overrides (e.g. "a week
of unusable footage" sits in the technical bank but declares `impact: 'coverage'`
because lost footage is a coverage problem, not a look problem). The id-based
`classifyEventImpact` is now only an internal fallback for a stray untagged
template — the definitions are the primary type system.

## Bounded failure chains

`computeShootEscalation(events, resilience)` (engine/production.ts) reads the
recorded history and returns extra daily risk fed to `rollDayEvent`: a shoot
that has already suffered major setbacks is more likely to suffer more. It is:

- **causal** — pure read of recorded events, never a new roll;
- **bounded** — capped at `MAX_ESCALATION_RISK` (22), so one mishap can't doom a
  film and there is no uncontrollable spiral;
- **mitigable** — dampened by resilience (reliable, well-resourced productions
  contain trouble), so poor preparation makes containment harder.

The chain is realised as _more negative events in the history_, which the
execution model already reads — so the tail is legible (every event is shown),
never a hidden multiplier.

## Careful vs reckless calibration

Positive execution sensitivity was cut well below negative, and the `strong`/
`exceptional` thresholds raised, so **upside must be earned by genuine positive
events** — reliability/contingency no longer buy a passive bonus. From the
recalibrated diagnostic (500 excellent projects × 3 resourcing cohorts; the
_same_ excellent script/director/cast, only resourcing varied):

| cohort | mean Δ | worst | P(lose≥3) | P(≥5) | P(≥8) | P(≥10) | P(gain≥3) | catastrophic | strong+ |
|--------|-------:|------:|----------:|------:|------:|-------:|----------:|-------------:|--------:|
| careful  | +1.2 | −6.7 | 1.0% | 0.2% | 0.0% | 0.0% | 10.8% | 0.0% | 2.2% |
| typical  | +0.2 | −7.6 | 6.4% | 1.4% | 0.0% | 0.0% | 3.4% | 0.6% | 0.4% |
| reckless | −1.9 | −14.2 | 32.0% | 17.6% | 6.4% | 2.2% | 1.2% | 12.8% | 0.0% |

Quality band of the finished film (data/reviewBlurbs.ts:`reviewBand`), showing
the same excellent project pushed down the scale by a bad shoot:

| cohort | poor | mixed | solid | excellent |
|--------|-----:|------:|------:|----------:|
| careful  | 0.2% | 40.8% | 57.4% | 1.6% |
| reckless | 3.4% | 56.0% | 40.4% | 0.2% |

Behavioural read (the acceptance criteria, not a target stdev):

- **Careful protects an important project** — near-zero catastrophe, 1% chance
  of even a 3-point loss, and no broad passive bonus (its small mean lift comes
  only from genuine positive events it happens to roll, P(gain≥5) ≈ 0).
- **Reckless is genuinely dangerous** — a third of reckless shoots shed ≥3
  points, ~18% shed ≥5, ~6% shed ≥8, and 12.8% are outright catastrophic; the
  worst case (−14) drags an excellent project down two quality bands. Dangerous
  enough to change how you'd resource a film you care about.
- **Upside is earned, not passive** — reaching `strong`/`exceptional` requires
  concentrated positive execution (career-best performances, an inspired cut),
  which no amount of safety guarantees.
- The tempting _upside_ of ambition comes from ambitious **scope** (the spend
  dials raise the baseline production score / ceiling), while reckless
  **resourcing** (thin contingency, unreliable talent) is pure downside — so
  ambition is a real bet, not a free win.

## Production score vs execution (no double-count)

After events were removed from the production score's old flat path, the four
concepts are cleanly distinct:

- **Production (baseline capability)** — `computeProductionScore`, the dials-
  driven potential your _budget_ bought (contingency, set, effects, shooting
  pace). Retained and displayed in the Department Breakdown, relabelled in the
  UI copy as the baseline the department _brought_ to the film. Feeds the
  footage chain and the audience score, as before.
- **Coverage** — how much usable footage the shoot captured (shootingRatio +
  coverage-impact events), which caps the edit.
- **Production execution** — how well the shoot _realised_ that baseline
  (the typed modifiers), shown in the separate Production Execution card.
- **Post-production (final department outcome)** — the edit, capped by coverage
  and scaled by execution.

The blunt, display-only "On-Set Events" score bar (superseded by the richer
execution card) was removed from the player UI; it remains on `FilmResults` for
the dev Outcome Inspector.

## Player inspection

The Production Execution card stays compact by default (stars + headline +
causal sentence + the top couple of causes). A large deviation exposes an
expandable **"What happened on set"** breakdown: every major effect (named
event, tinted by direction) under _Major effects_, and, when reliable leadership
/ contingency demonstrably absorbed damage, a _Mitigation_ note. No raw numeric
modifiers appear in any of it. Small, normal shoots never expand into a wall of
text.

## Recalibration test coverage

`productionExecutionCalibration.test.ts` adds behavioural tests: careful
mitigates but never boosts above neutral; a no-event shoot is reliability-
invariant; positive execution requires positive causes; major events damage the
right department and materially the film; escalation is bounded and resilience-
dampened; an excellent project can be ruined by a catastrophic shoot; a poor
screenplay can't be executed into a masterpiece; Script/Direction/Production
retain distinct leverage (script's own range exceeds the shoot's swing, so
execution hasn't swallowed the model); and event definitions own their impact.

## Save policy note

Per `CLAUDE.md`, the game is pre-launch and save compatibility is out of scope;
these schema additions (`impact`/`escalates` on events, `productionExecution`
on results) were made freely without migration work.

---

## Recommended next phase

**Phase 2 — rival execution resolver** (now implemented — see below).

---

# Phase 2 — Rival Production Execution

**Objective:** player and AI films are now created by the *same* conceptual
production model. A rival's shoot isn't lived day by day, so instead of
simulating each day we **synthesize a plausible production history** and feed it
through the exact same pipeline the player uses. The player and AI differ only
in *how the history is generated*, never in *how the finished film is evaluated*.

## The shared pipeline

```text
Rival project → plan → existing production risk → synthesized history → computeExecutionProfile() → finished film
```

Nothing after "synthesized history" is rival-specific. `resolveRivalProduction`
(engine/rivalStudios.ts) now calls `resolveRivalExecution`
(engine/rivalExecution.ts) to get `{ events, shootingRatio }`, then hands them
to `computeReleaseResults` — the identical call the player's release makes. The
rival film stores its `events` (causal history) and gets its
`productionExecution` summary from the same `summarizeExecution`.

## How histories are synthesized (engine/rivalExecution.ts)

- **Shared event core.** `rollDayEvent` was refactored to expose `pickShootEvent`
  — the pool-build + risk-weighted polarity/severity + template roll, minus the
  per-day chance gate. The player's shoot calls it once per day; the resolver
  calls it directly, a synthesized number of times. **No new rival-only event
  types** — rivals draw from the same catalogue (`data/productionEvents.ts`),
  with the same typed impacts and escalation.
- **Event count.** `≈ recommendedDays × dailyEventChance(avgRisk)`, jittered — the
  player's per-day odds integrated over the shoot instead of rolled day by day.
- **Reused risk inputs.** `computeStaticProductionRisk` (morale/safety/technical/
  budget, from reliability/ego/spend-vs-ambition) drives polarity and severity;
  `computeExecutionResilience` (reliability + contingency) dampens damage and
  chains; `computeShootEscalation` makes a troubled synthesized shoot spawn a few
  more negatively-skewed incidents (bounded). Nothing is recalculated that the
  player's model already computes.
- **Schedule pressure.** The player's live schedule pressure has no rival
  analogue, so one representative value (`RIVAL_SCHEDULE_PRESSURE = 72`) stands in
  for it — calibrated (below) so counts and outcomes match the player's.
- **Interactive events.** With no player to decide, the resolver picks one of the
  base choices and resolves it (`resolveEventChoice`), so an interactive setback
  still lands typed and causal.
- **Deterministic.** Pure function of the plan + rng; identical inputs → identical
  history → identical film.

## Player-vs-rival parity (calibration)

From `productionExecution.diagnostic.test.ts` (same excellent plans; player lives
the shoot, rival synthesizes it):

| cohort | who | mean Δ | troubled+ | catastrophic | events |
|--------|-----|------:|----------:|-------------:|-------:|
| careful | player / rival | +1.12 / +1.12 | 2.6% / 4.4% | 0% / 0% | 8.6 / 9.8 |
| typical | player / rival | +0.15 / +0.09 | 15% / 22% | 0.2% / 1.4% | 8.6 / 10.9 |
| reckless | player / rival | −2.32 / −2.98 | 47% / 56% | 14% / 21% | 9.8 / 12.4 |

Central tendency matches closely; the rival tails run marginally fatter (a
believable, accepted difference — we only ever see a rival's outcome, not its
day-to-day).

## Realistic rival distribution (before vs after)

From `aiStudioStats.diagnostic.test.ts` over the real rival market (~11.8k films):

Measured apples-to-apples on the **same** current master (rivals scored with
execution vs. a neutral profile), so the merge changes that predate this phase
(hand-authored directors, the expanded event bank) aren't counted:

| metric | execution off (neutral) | execution on |
|--------|------------------------:|-------------:|
| quality mean / p90 / max | 60 / 66 / 75 | 61 / 67 / 76 |
| on-set events per film | 0 | ~10 |
| execution rating | n/a (no variance) | solid 89% · troubled 8.8% · **catastrophic 0.2%** · strong 1.9% · exceptional 0% |
| finished quality band | — | mixed 38% · solid 62% · **excellent 0.2%** · poor 0.1% |

AI studios are now capable of **routine competent productions, troubled ones,
recoveries (resilience-dampened chains), rare infamous disasters, and the
occasional film lifted above expectation** — emerging from production risk, not
jitter. Execution's *own* effect on the mean is small and correct (**+1**):
consistent with the per-plan deltas (+1.12 careful / +0.15 typical / −2.98
reckless) weighted over a rival field that's mostly competent. The real change
is the **widening** — a disappointment/disaster tail that didn't exist before
(neutral had zero variance) and a slightly higher ceiling — not the mean. (An
earlier draft cited "56 → 61"; the ~+4 there was the pre-phase master merge
measured against a stale baseline, not execution.)

## Positive-tail review (requested)

**Finding: the positive side of execution is under-represented relative to the
negative side** — as intended for Phase 1, and it carries into rivals. Rivals
land troubled+ ~9% of the time but reach `strong` only ~1.9% and `exceptional`
~0%. Causes, in order:

1. **Calibration (deliberate).** `productionExecution.ts` uses much smaller
   positive than negative sensitivity, and a high `exceptional` threshold — upside
   must be *earned* and stays rare.
2. **Event-bank asymmetry.** The catalogue's negatives include genuine
   catastrophes (−12…−16: hospitalisation, unusable footage, walk-off, set
   collapse), but its positives top out around +8…+12 (a nailed take, real
   chemistry, an inspired cut). There is no positive analogue to a "career-best
   that redefines the film" or a "practical effect that steals the movie" at
   disaster magnitude.

**Proposal (later, not now — no rebalance this phase):** if we want a real
positive tail, add a small number of **rare, high-magnitude positive execution
events** (the upside equivalents of the catastrophes) — extraordinary chemistry,
an improvisation that elevates the whole third act, a breakthrough practical gag —
and modestly lift the positive sensitivity/`exceptional` threshold so a
genuinely blessed shoot can reach it. Keep it rarer than the downside (tails
stay asymmetric) and always event-driven. This should be a *joint* player+rival
change (they share the model) and validated against both diagnostics. Deferred
so we don't destabilise the freshly-calibrated player model.

## Tests

`rivalExecution.test.ts`: same pipeline (rival summary = `summarizeExecution` of
its stored events); deterministic; typed impacts on every synthesized event;
both positive and negative histories occur; reckless plans yield harsher
histories than careful ones; summary causes trace to real stored events; JSON
round-trip under the current schema. Player behaviour is unchanged (the whole
suite, incl. the Phase 1 diagnostic, is green after the `pickShootEvent`
extraction).

## Remaining future work

- **Studio Identity & AI objectives** — the next major layer: rivals choosing
  *what* to make and *how* to resource it by identity (prestige vs commercial,
  risk appetite), so their execution distributions diverge *by studio*.
- **Creative disagreement** — competing creative visions as an explicit risk
  amplifier upstream of the shoot.
- **Positive-tail pass** — the proposal above.
- **Scoring-compression rebalance** — separate from execution; what would let a
  genuinely perfect film reach true masterpiece range (90+). Execution widens the
  distribution modestly; the absolute ceiling is still set by the quality math.
