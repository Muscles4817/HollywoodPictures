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

## Recommended next phase

**Phase 2 — rival execution resolver.** Give rivals a synthesized shoot (events
from their risk profile) feeding the same `computeExecutionProfile`, so rival
films inherit the same variance and can go sideways or transcend expectations.
This is also the prerequisite for the AI awards field to stop being uniformly
mediocre. A risk-driven event-magnitude rebalance can ride along, since it
widens the realistic spread for players and rivals alike.
