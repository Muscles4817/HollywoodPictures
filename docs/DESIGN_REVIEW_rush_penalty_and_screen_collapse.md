# Design Review: Rushed-release penalty & theatrical screen-collapse

Status: **Built** (save v93). §1–§10 are the design as written; §11 records
what landed, where it departed from the plan, and the measured numbers. Extends
the marketing rollout model (`docs/DESIGN_REVIEW_marketing_rollout.md`) and couples
to the distributor-offer system.

---

## 1. The problem

Rushing a film to theatres with no marketing runway isn't punishing enough. A
player who builds a wide release and ships it essentially immediately should be
looking at a near-total flop — financial-collapse territory — and today they
aren't. The current marketing rollout is a **bonus for holding, never a penalty
for rushing**: a same-day release is the neutral 1.0 baseline and a full ~8-week
rollout earns up to `+CAMPAIGN_MOMENTUM_BONUS` (+18%) realised reach
(`data/marketing.ts`). Rushing costs at most that forgone 18%.

## 2. What the real industry does

A rushed, under-marketed **wide** release of an otherwise-decent film is
realistically a **total write-off**, and the mechanism is structural, not
quality-driven:

- *"The opening is bought, the legs are earned."* Marketing/awareness is the
  dominant driver of the **opening**; quality/word-of-mouth drives the **legs**
  (weekly retention). A 10% rise in pre-release buzz ≈ 2.3% opening gross, and
  buzz needs **≥8 weeks** to build — so a rushed campaign forfeits most of it.
- *"Opening-weekend numbers determine how many screens the movie keeps."* A soft
  open → exhibitors pull screens in week 2 → the film **never reaches its
  audience**. Collapse happens inside one weekend: a >60% second-weekend drop
  triggers same-week screen cuts. *Jane Got a Gun*: opened $836K on 1,210
  theatres, dropped 83.5%, pulled to **8 theatres**.
- Named "decent film, no awareness" collapses: **The Marsh King's Daughter**
  ($849K opening on 1,055 screens despite a real star + bestseller source),
  **Mortal Engines** (~$100–175M loss), **Cats**, **The 13th Warrior**. Losses
  track the sunk P&A + production commitment, because the film earns a sliver of
  it back.

Crucially the catastrophe is **release-type-specific**. A **platform/Limited**
release is *designed* to open on a few screens with little marketing and build
over weeks (My Big Fat Greek Wedding: 108 theatres → $241M over 17+ weekends;
Slumdog, Little Miss Sunshine, Moonlight). Rushing a platform release is normal,
even optimal. So a rush penalty must **scale with release breadth** — brutal for
Wide, negligible for Limited/Festival.

And legs *can* rescue a soft opening — but that's the exception (the "sleeper":
The Greatest Showman, Edge of Tomorrow), and it comes from genuine **quality**,
which the sim already models as retention. So the rush penalty can be almost
purely a function of breadth; quality independently decides whether legs claw it
back.

## 3. Why the current sim can't express this (diagnostic evidence)

Running real films through the box-office model shows the intuitive levers are
**inert on the total**. Profit = studio revenue − all-in cost:

**Mid-budget wide** (~$20M marketing, ~$55M all-in):

| Scenario | Opening | Total | Profit |
|---|---|---|---|
| Current — rushed (same-day) | $38.2M | $225.9M | **+$49.1M** |
| Current — full 8-wk rollout | $40.5M | $230.0M | +$51.0M |
| Drastic rush penalty (×0.40 reach) | $26.3M | $176.5M | **+$26.4M** |

**Tentpole wide** (~$80M marketing, ~$203M all-in):

| Scenario | Opening | Total | Profit |
|---|---|---|---|
| Current — rushed | $56.3M | $254.3M | −$85.8M |
| Current — full rollout | $59.0M | $258.8M | −$83.8M |
| Drastic rush penalty (×0.40 reach) | $42.9M | $235.2M | −$94.6M |

Cutting a tentpole from **92% of screens to 15%** moved the total only ~$6M.

**The structural reason** (`engine/audienceSimulationStep.ts`): availability only
throttles the weekly *rate* — unserved demand rolls forward
(`advanceOneWeekWithDiagnostics:836`) and the reachable pool
(`maxInterestedAudience`, `audienceSimulation.ts:163`) has **no availability
term**. So the whole pool drains over the 20-week run regardless of how the film
opened or how many screens it held. Two compounding effects: (1) availability
floors at `AVAILABILITY_FLOOR = 0.02` and screens never fully die
(`computeNextAvailability:648`); (2) `hasSimulationEnded`'s cutoff is *relative to
the opening* (2% of week-1 admissions, `:966`), so a lower opening runs *longer*.
The sim has essentially **no distribution risk** — a film always earns its
quality-driven potential. That's the gap.

## 4. The proposed model

Three coupled pieces. The collapse is an *emergent* consequence of the existing
demand-utilisation → availability loop (Milestone 9), once screens can actually
die and the mechanic is armed only for genuinely rushed wide releases.

1. **Breadth-scaled opening rush penalty (the trigger).** A new frozen
   `openingRushMultiplier` on `AudienceSimulationFixedState`
   (`audienceSimulation.ts` + its factory), derived in
   `deriveAudienceSimulationFixedState` (`audienceSimulationInputs.ts:740`) from a
   new **marketing-runway** input × the release's **breadth**
   (`initialAvailabilityFraction` / release type). Applied **week-1 only** in
   `advanceOneWeekWithDiagnostics` (scale the release-day seed
   `applyReleaseDayAwarenessSeed:60` and/or week-1 attendance `:794`). Zero-runway
   Wide → opening ≈ 0.3–0.4× of its rolled-out opening; Limited/Festival → ≈ 1.0.
   This produces a weak opening on a big screen commitment → low week-1 demand
   utilisation.

2. **Terminal screen-collapse (the amplifier).** Today `computeNextAvailability`
   (`audienceSimulationStep.ts:610`) contracts availability asymptotically toward
   `0.02` and never dies, so the run limps to the 20-week cap and drains its pool.
   Change: when a film is **collapse-armed** (§5) AND demand utilisation is
   catastrophically low (below a new `THEATRICAL_HOLD_UTILISATION`), let
   availability contract toward **0**. Once availability ≈ 0, weekly admissions ≈
   0, and the existing 2%-of-opening rule ends the run early — leaving the
   still-large `interestedRemaining` pool **unsold**. That truncation caps the
   total (rushed wide: run ends ~week 2–3 → total ≈ 2× a weak opening instead of
   ~6× a strong one → deep loss). A `collapsed` flag rides `WeekDiagnostics:667`
   for the dev inspector; `hasSimulationEnded` itself needs no change.

3. **Distributor floor.** In `SCHEDULE_RELEASE` (`state/studioReducer.ts`), a
   **distributor** deal guarantees a minimum effective runway (the distributor was
   already running the campaign), so a distributor's wide release is never
   collapse-armed. **Self-distributed** wide releases use the real runway → a
   same-day self-distributed wide release can collapse. Rushing becomes a
   self-distribution footgun, tying the two systems together.

## 5. Gating — protect the existing calibration (critical)

The box-office model treats **same-day = neutral baseline**, and the core
regression suite (`realFilmRegression`, `audienceSimulationScenarios`,
`audienceSimulationRegressionMatrix`, `releaseFilm.*.test`) calls the sim /
`computeReleaseResults` **directly with no runway signal**
(`marketingRolloutMultiplier` already defaults to neutral 1 when `campaignStartDay`
is absent — `engine/marketing.ts:105`). Both new mechanics are **armed only when
an explicit runway signal is present** — i.e. a live player release via
`SCHEDULE_RELEASE`, which always freezes `campaignStartDay`. When absent (rivals,
direct-sim tests, the live projection's default), `openingRushMultiplier = 1` and
availability keeps its 0.02 floor — **behaviour identical to today**. Only the
reducer-level integration tests that deliberately release **same-day**
(`studioReducer.test`, `wizardRunThrough.test`, `developmentPipeline.test`,
`studioReducer.distribution.test`) change — correctly, since a rushed same-day
wide release *should* now underperform — and get updated.

## 6. Threading & tuning

- `ReleaseSimulationInputs` gains `marketingRunwayWeeks?`; `releaseFilm.ts`
  (`computeReleaseResults`) and `marketSettlement.ts:resolvePlayerRelease` already
  compute the rollout from `marketingChoices.campaignStartDay` → `releaseDay`
  (`marketing.ts:115`) — thread the raw runway weeks alongside it.
- Distributor floor applied where the deal freezes `campaignStartDay`
  (`studioReducer.ts:SCHEDULE_RELEASE`): for a distributor deal, effective runway
  ≥ `MIN_DISTRIBUTOR_RUNWAY_WEEKS`.
- New constants in `data/marketing.ts`: `RUSH_PENALTY_MAX` (max opening cut for a
  zero-runway wide release), `RUSH_PENALTY_FULL_RUNWAY_WEEKS` (reuse
  `CAMPAIGN_FULL_ROLLOUT_WEEKS`), `THEATRICAL_HOLD_UTILISATION`,
  `SCREEN_COLLAPSE_DECAY`, `MIN_DISTRIBUTOR_RUNWAY_WEEKS` (~4). Breadth-scaling:
  penalty × `clamp((breadth − floor)/(1 − floor))` so Limited ≈ 0, Wide ≈ full.

## 7. Calibration approach

Rebuild the throwaway diagnostic (a `*.diagnostic.test.ts`, run with
`--disable-console-intercept`, deleted after) that instruments **week-by-week
demand utilisation** and total gross/profit for: full-rollout wide (good &
mediocre), rushed wide (good & mediocre), rushed limited, distributor-floored
wide. Pick `THEATRICAL_HOLD_UTILISATION` so it cleanly separates "rushed wide
collapse" from "normal soft wide film" (which must NOT collapse). Target: rushed
self-distributed wide of a decent film → run truncates ~wk 2–3, total a fraction
of potential, deep loss; full-rollout wide → unchanged vs today; rushed Limited →
~unchanged; distributor wide → protected.

## 8. UI

`components/wizard/MarketingRelease.tsx`: when a **Wide**, **self-distributed**
release is scheduled with little runway, show a visible **risk warning**
("Rushing a wide release — theatres may pull it if it opens soft"), distinct from
the existing "Marketing rollout · +X% reach" readout, and note the distributor
floor on distributor deals. The live `projectedOpening` re-computes via
`computeReleaseResults`, so it reflects the rush penalty automatically once the
runway is threaded into the projection input.

## 9. Files (primary)

- `src/engine/audienceSimulation.ts` — `openingRushMultiplier` field + factory + validator.
- `src/engine/audienceSimulationInputs.ts` — derive it from runway × breadth; `ReleaseSimulationInputs.marketingRunwayWeeks`.
- `src/engine/audienceSimulationStep.ts` — week-1 penalty; terminal collapse in `computeNextAvailability`; `collapsed` diagnostic.
- `src/engine/releaseFilm.ts` + `src/engine/marketSettlement.ts` — thread runway into the sim inputs.
- `src/state/studioReducer.ts` — distributor floor on `campaignStartDay`.
- `src/data/marketing.ts` — tuning constants.
- `src/components/wizard/MarketingRelease.tsx` — rushed-wide risk warning.
- Update same-day integration tests (`studioReducer*.test`, `wizardRunThrough.test`, `developmentPipeline.test`).

## 10. Verification

- Rebuild + run the utilisation diagnostic; confirm §7 targets and pin thresholds.
- New unit tests: `audienceSimulationStep` (armed + low utilisation → availability
  → 0 + early end + capped total; unarmed → 0.02 floor unchanged), rush penalty
  (breadth-scaled), distributor floor, end-to-end reducer (rushed self-distributed
  wide → deep loss; full-rollout or distributor wide → healthy).
- `npm test` (core calibration suite stays green — proof the neutral path is
  untouched; only same-day integration tests update), `npm run build`, `npm run lint`.

## 11. What landed

Built as designed: breadth-scaled week-1 penalty, latched terminal screen
collapse, distributor runway floor, gated on an explicit runway signal.

**Where it lives**

- `data/marketing.ts` — `RUSH_PENALTY_MAX` 0.65, `RUSH_PENALTY_FULL_RUNWAY_WEEKS`
  (= `CAMPAIGN_FULL_ROLLOUT_WEEKS`, 8), `MIN_DISTRIBUTOR_RUNWAY_WEEKS` 4,
  `SCREEN_COLLAPSE_ARM_SEVERITY` 0.35.
- `engine/marketing.ts` — `effectiveRushRunwayWeeks` (the distributor floor),
  `rushSeverity` = breadth × (1 − runway progress)², the same concave curve as
  `rolloutMomentum`; `openingRushMultiplier`; `isScreenCollapseArmed`.
- `engine/audienceSimulationInputs.ts` — `computeRushBreadth` (0 at Limited's
  platform availability, 1 at a full Wide commitment, read off the *uncrowded*
  opening availability); sets the two optional fixed-state fields.
- `engine/audienceSimulationStep.ts` — step 8.6 (week-1 penalty) and
  `isScreenCollapse` / `collapsedAvailability`, with `THEATRICAL_HOLD_UTILISATION`
  0.5, `SCREEN_COLLAPSE_TRIGGER_WEEKS` 2, `SCREEN_COLLAPSE_DECAY` 0.8.
- Threaded through `releaseFilm.ts` (`marketingRunwayWeeks`) from
  `marketSettlement.ts` and the Marketing screen's projection.

**Departures from the plan**

1. **The distributor floor is applied where the runway is read, not by
   rewriting `campaignStartDay` in `SCHEDULE_RELEASE`.** Rewriting the start day
   would also have handed distributor deals 4 weeks of the rollout *bonus* they
   never earned. `effectiveRushRunwayWeeks` floors only the rush penalty's input.
2. **The penalty multiplies tickets, not attendance probability.** A strong
   film's pulled-forward probability can exceed 1 before its clamp, which
   silently absorbed most of the cut (a 0.35× multiplier landed as ~0.56×).
3. **Collapse is latched** (`AudienceSimulationWeekState.screensPulled`) and
   only triggers in the first two weeks. Without the latch a shrinking screen
   count raises utilisation, the film reads as "selling out", and
   `computeNextAvailability` re-books it — the opposite of what exhibitors do.
4. **Arming is a severity threshold, not "any runway signal".** Severity 0.35
   arms a full-breadth Wide release under ~3.3 weeks of runway. The distributor
   floor caps severity at 0.25, so a distributor deal can never be armed.

**Measured** (`RUSH_DIAGNOSTIC=1 npx vitest run src/engine/rushPenalty.diagnostic.test.ts --disable-console-intercept`,
24 films per row, medians, worldwide gross / all-in cost):

| Mid-budget good film | Opening | Gross | Gross/cost | Pulled |
|---|---|---|---|---|
| Wide, 8-week rollout | $59.5M | $158.4M | 3.37× | 0/24 |
| Wide, distributor floor (4 wk) | $52.2M | $149.2M | 3.28× | 0/24 |
| Wide, 2 weeks | $43.3M | $97.6M | 1.80× | 13/24 |
| Wide, same-day | $31.5M | $50.5M | 1.08× | 19/24 |
| Limited, same-day | $5.2M | $65.6M | 1.98× | 0/24 (unchanged) |

Tentpole (good film, ~$146M all-in): $325.7M rolled out vs **$98.2M rushed**
(0.69× its cost), 23/24 pulled. Through the real reducer (fixture seed 3,
self-distributed): held 8 weeks **+38%** profit, rushed same-day **−36%** and out
of theatres after 4 weeks. A rushed film that still fills its seats is *not*
pulled (seed 23 stays profitable) — quality can still rescue a rush, as the
sleeper cases in §2 do.

The collapse is a cliff at the arming threshold (3 weeks of runway: kept; 2
weeks: half pulled), which is why the Marketing screen warns exactly when the
release is armed rather than on a runway heuristic.

**Calibration untouched.** All three `BOX_OFFICE_DIAGNOSTIC` gates report
value-for-value the same as before this change: rivals carry no runway signal.

**Player-facing.** The Marketing & Release screen warns when the scheduled
release is armed (read off the projection's own fixed state, so it can't
disagree with settlement). A pulled film's existing "run finished" Inbox card
says theatres pulled it (warning tone, "Pulled from theatres" eyebrow), routes
to its dossier, and clears on read; the dossier's Financials section explains
it. The dev audience-sim inspector has a "Pulled" column.

**Test change worth knowing.** `realFilmRegression.test.ts` released its
recreated tentpoles same-day, self-distributed: exactly the case that now
collapses. They now release after a full rollout, as the real films did. One
assertion (Suicide Squad's star vehicle beating its stripped counterpart on
profit *ratio*) was an ordering of two losses on a 2.7-point margin. The
existing rollout bonus lifts only the stripped film (the star vehicle's audience
is already saturated), which flips it, so that line was replaced with an
explanatory note. The "stars more than double the gross" claim still stands.
