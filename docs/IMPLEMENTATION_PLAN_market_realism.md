# Implementation plan: market realism

For an implementing session that has none of the conversation behind it. Follow
the phases in order. Every design decision is made here; where one is not, the
plan says **STOP AND ASK**.

Background, in reading order:

1. `CLAUDE.md` - house rules and every harness command.
2. `docs/DESIGN_REVIEW_market_realism.md` - the proposal.
3. `docs/REVIEW_market_realism.md` - the review of it. This plan implements the
   review's order (§6), not the proposal's, with the owner's decisions below.
4. `docs/DESIGN_notification_contract.md` - apply wherever a phase says so.

## 0. What is being fixed, and the owner's decisions

A careful player studio cannot lose: a Mid-Major grows £80M to £330-860M in ten
years and a Major £200M to £520-1,070M, on every seed. Measured causes, largest
first (review §2):

- the after-market pays the player about 1.0 per pound of cinema rentals
  against the market's 0.38, because it reads film quality six times over;
- the player's films and rivals' films are not scored the same way;
- Brand feeds the next film's reach with nothing pulling it back, so studios
  run away or spiral;
- nobody competes with the player for the best scripts and directors;
- a player's shoot nets far more good events than bad.

Decisions the owner has made. Do not reopen them.

| | Decision |
|---|---|
| Audience-facing studio labels | No new system. The existing per-genre studio identity lift stays exactly as built. |
| How hard | Kinder than the real industry; judged by career, with the bands in §1.3. |
| Script quality | Script stats stay exact on screen. Uncertainty goes into how the shoot turns out. |
| Order | Split into small phases, after-market first and alone. |
| Scoring | Rivals move up to the player's scoring model. The player's model is not simplified. |
| Buying scripts | Ordinary scripts can still be bought outright. The best of each week's batch are sold by bidding. |

Out of scope unless the owner asks: rival profiles that adapt, script reads,
studio notes and cut-by-committee, any change to talent generation or fees
(`engine/talentAbility.ts` is knife-edge - do not tune it).

## 1. Rules for the whole job

### 1.1 Conventions

- Work on the branch your session is assigned. No pull request unless the owner
  asks.
- Commit often, in plain English that says what changed ("After-market: one
  bounded regard premium replaces the stacked quality readings"). Push after
  each phase.
- No model name or identifier in any commit message, code comment or file.
- `engine/` stays pure. Tunables live in `src/data/` or as named constants at
  the top of the engine module, each with a comment saying what it means and
  what it was measured against.
- Player-facing text is qualitative: no raw stat values, no multipliers.
- Pre-launch: when a stored shape changes, bump `SAVE_VERSION` in
  `src/state/persistence.ts` (106 at the time of writing) and add a line to the
  version comment block above it. No migrations.
- After each phase: `npm test`, `npm run lint`, `npm run build` all green.
- After each phase: add a subsection to a new final section of
  `docs/DESIGN_REVIEW_market_realism.md` titled "7. As built" - what changed,
  the constants as shipped, the per-seed tables before and after, the gate
  results, anything that surprised you.
- The harness bot's five strategies (`src/state/playerBot.ts:BOT_STRATEGIES`)
  are the measuring instrument. Do not change their numbers. Phase 5 teaches the
  bot one new mechanic; nothing else about it changes.

### 1.2 Measuring (the calibration procedure)

Seed-to-seed spread is as large as most effects in this plan, and a career is
chaotic: one early flop changes every later film. So:

1. **Seeds.** Always 101-110, the same ten before and after a change.
2. **Per-seed tables, not medians.** A median once hid a runaway seed. Every
   record in "As built" is the full per-seed table.
3. **Noise floor.** Phase 0 runs the unchanged game on seeds 201-210 as well.
   The difference between the two seed sets is what "no change" looks like. A
   change is real only if it moves the *count* measures (careers that shrink,
   careers above the ceiling) by two or more of ten, or moves at least eight of
   ten seeds the same way.
4. **One constant at a time**, in the order each phase gives, by the step each
   phase gives. Re-run after each step. Record every value tried, including
   the ones rejected.
5. **Three tries per constant.** If three steps of one constant have not
   reached the phase's success numbers, stop tuning it and report.
6. **Never** tune a box-office gate's bands, a talent constant, or a bot
   strategy to make a number pass.
7. **Run every tier**, not only the big ones: `indie`, `boutique`, `midmajor`,
   `major`. One tier per process (a ten-seed tier takes several minutes; four
   processes fit on four cores).

### 1.3 Final targets

These are the bands the whole job is aiming at. They are checked at the end of
Phase 6, not after each phase. Each phase has its own smaller success and stop
numbers.

Careful and Steady, at Mid-Major and at Major, ten years, seeds 101-110:

| Measure | Band |
|---|---|
| Careers ending below starting cash | 1 to 3 of 10 |
| Largest year-10 cash | no more than 4 times starting cash |
| Median year-10 cash | 1 to 2.5 times starting cash |
| Films that lose money all-in (cinema profit plus after-market) | 35% to 45% |
| Share of career film profit earned by the best fifth of films | more than 100% |

Guard rails at every phase:

| Measure | Rule |
|---|---|
| Careless at Mid-Major | at least 8 of 10 end below a quarter of starting cash |
| Indie and Boutique, Careful | careers "stalled for good" no more than 2 of 10 above the Phase 0 count |
| Boutique, any strategy | no career above 4 times starting cash |
| Box-office gates | no metric outside the misses recorded in Phase 0, except where a phase says to expect it |

### 1.4 Re-deriving the reference points (procedure R)

Several engine constants are *measurements of the rival market's median film*.
When a phase changes what rivals make, they go stale and the whole market
drifts. Phases 2, 5 and 6 end with this procedure. It is the only gate
recalibration this plan allows.

1. Dump a whole year's films:
   `DUMP_OUT=<file> BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeDistribution.diagnostic.test.ts --disable-console-intercept`
   and read medians with `node scripts/analyseBoxOfficeDump.mjs <file>` (extend
   the script if it does not print a median it needs).
2. Set each of these to its newly measured value, rounding to a whole number:
   - `engine/scoring.ts:QUALITY_REFERENCE` - median `qualityScore`, all films.
   - `data/reviewSensitivity.ts:REVIEW_SIGNAL_PIVOT` - median `criticScore`, wide releases.
   - `data/wordOfMouth.ts:EXPECTED_RECEPTION_BASE` - chosen so a Buzz of the
     measured median wide Buzz expects the measured median delivered reception
     (0.7 x audience + 0.3 x critic), with `EXPECTED_RECEPTION_PER_BUZZ` left alone.
   - `data/ancillary.ts:REGARD.neutralAudience` and `neutralCritic` (Phase 1) -
     median audience and critic score, all films.
3. Re-run the whole-year, budget-tier, variance and buzz gates. If the
   whole-year gate still has a miss that Phase 0 did not, move one level lever
   only: `engine/audienceSimulationInputs.ts:BASE_ADDRESSABLE_POPULATION`
   (190,000,000), in steps of 2,000,000, down if the market is too profitable
   (`wideUnprofitablePct` or `lossPct` low, `majorPct` high), up if the
   reverse. No further than 176,000,000 or 204,000,000.
4. If that does not restore the Phase 0 set of misses: **STOP AND ASK.**

---

## Phase 0. Instruments

**Goal.** A career gate that prints per-seed tables and checks the bands, an
anatomy that shows where the quality gap sits, and the baseline numbers. No
gameplay change.

### Build

1. `src/data/careerTargets.ts` (new): the bands of §1.3 as data.

   ```ts
   export interface CareerBands {
     shrinkers: [number, number];          // careers ending below start, of the seeds run
     maxEndMultiple: number;               // largest year-end cash / starting cash
     medianEndMultiple: [number, number];
     filmsLosingAllInPct: [number, number];
     topFifthShareOfProfitPct: number;     // minimum
   }
   export const CAREFUL_BIG_STUDIO_BANDS: CareerBands = {
     shrinkers: [1, 3], maxEndMultiple: 4, medianEndMultiple: [1, 2.5],
     filmsLosingAllInPct: [35, 45], topFifthShareOfProfitPct: 100,
   };
   ```

2. `src/state/careerGate.ts` (new, pure):

   ```ts
   export interface CareerRow {
     strategy: string; seed: number; startCash: number;
     cashAtYear: number[];        // year-end cash, one per year
     minCash: number; brandEnd: number; prestigeEnd: number;
     films: number; medianQuality: number; qualityP10: number; qualityP90: number;
     profitableInCinemasPct: number; losingAllInPct: number;
     allInReturnMedian: number; allInReturnP10: number; allInReturnP90: number;  // (profit + ancillary) / totalCost
     bestFilmReturn: number; topFifthShareOfProfitPct: number;
     made: number; cinemaNet: number; afterMarket: number; awards: number; facilities: number; // from BotRun.cashFlow
     stalled: boolean;
   }
   export function summariseCareer(run: Omit<BotRun, 'finalState'>, startCash: number): CareerRow;
   export interface BandResult { measure: string; value: number; band: string; pass: boolean }
   export function evaluateCareerBands(rows: CareerRow[], bands: CareerBands): BandResult[];
   export function formatCareerTable(rows: CareerRow[]): string[];
   ```

   `made` = `production:greenlight` + `production:prep` + `production:other` +
   `acquisition`; `afterMarket` = `homeEntertainment` + `licensing` +
   `merchandising` + `catalogue`; `cinemaNet` = `theatricalNet`.
   `topFifthShareOfProfitPct` = sum of all-in profit of the best fifth of films
   (by all-in profit, rounded up to at least one film) divided by the sum over
   all films, times 100; report 0 when the total is not positive.

3. `src/state/careerGate.diagnostic.test.ts` (new, opt-in on `CAREER_GATE=1`).
   Env: `TIER` (default `midmajor`), `STRATEGIES` (default `Careful,Steady`),
   `SEEDS` (default `101,102,...,110`), `YEARS` (default 10), `DUMP_OUT`.
   Prints the table, then the band results. It asserts the bands only when
   `CAREER_GATE_ASSERT=1`, so it reports during the job and gates at the end.

4. Extend `src/state/bigStudioAnatomy.diagnostic.test.ts` to print, per budget
   band and for player and rivals:
   - median `productionScore` and `postProductionScore`;
   - net event quality points per film (sum of `qualityDelta` over `events` and
     `postProductionEvents`), median and 10th percentile, and split three ways:
     events whose id starts `preprod-`, events that came from a choice, the rest;
   - release-weighted mean Brand of rival wide releases (read each film's Brand
     with `inferStudioBrandFromMarketingEfficiency(film.boxOfficeRun.fixed.marketingEfficiency)`);
   - on a sampled day in each year, the share of the top tenth of directors by
     true skill who are unavailable for hire.

5. Add both commands to `CLAUDE.md` under the player-economy harness.

### Tests

Unit tests for `careerGate.ts` in `src/state/careerGate.test.ts`:
`summariseCareer` on a hand-built run (cash flow lines summed into the right
columns; all-in return uses profit plus ancillary; a run with no films gives
zeros, not NaN); `topFifthShareOfProfitPct` on five films of known profit;
`evaluateCareerBands` passes and fails each band at its edges.

### Run and record

- Career gate: all four tiers, Careful, Scout, Steady, Careless, seeds 101-110.
  Then Mid-Major and Major again on seeds 201-210 (the noise floor).
- Whole-year, budget-tier, variance and buzz gates. Expect whole-year 18 of 21
  (misses `wideOver100PerYear`, `specialtyFilmsPerYear`, `breakevenPct`),
  budget-tier six misses, variance and buzz passing. **Whatever you measure is
  the baseline** for the "no new misses" rule; record it.
- Anatomy: Mid-Major Careful 101 and Steady 102, Major Careful 101.

Expected (six seeds, measured during review): Mid-Major Careful £334-785M,
Steady £581-857M; Major Careful £537-953M, Steady £518-1,066M; no career
shrinks; median film quality 65-71; 7-37% of films lose all-in; the player's
net event points about +33 against rivals' +10; rivals' post-production score a
flat 60.

**Stop and report** if your baseline differs from these by more than the spread
you see between the two seed sets: something else has changed since this plan
was written.

---

## Phase 1. After-market: one regard premium

**Goal.** A well-regarded film still earns more after cinemas, by a bounded
factor read once, instead of quality being multiplied in six places.

### Change

`src/data/ancillary.ts` - add:

```ts
/** How a film's standing lifts its life after cinemas: one bounded factor, read once. */
export const REGARD = {
  neutralAudience: 65,   // the market's median audience score (measured)
  neutralCritic: 48,     // the market's median critic score (measured)
  neutralPrestige: 50,
  audienceSpan: 30, criticSpan: 30, prestigeSpan: 50,   // points from neutral that count as a full swing
  audienceWeight: 0.5, criticWeight: 0.35, prestigeWeight: 0.15,
  span: 0.35,            // what a full swing on every reading is worth, either way
  awards: 0.25,          // added at a full awards haul (awardsLift = 1)
  min: 0.75, max: 1.5,
  longevityWeight: 0.45, // share of catalogue longevity a top-regard film earns from regard alone
} as const;
```

`src/engine/ancillary.ts`:

- New export:

  ```ts
  /** 0.75..1.5 - how well regarded a film is, for everything it earns after cinemas. 1 for the market's median film. */
  export function computeRegard(a: Pick<AncillaryAttributes, 'audienceScore' | 'criticScore' | 'studioPrestige' | 'awards'>): number
  ```

  `standing = audienceWeight * u((aud - neutralAudience) / audienceSpan) + criticWeight * u((crit - neutralCritic) / criticSpan) + prestigeWeight * u((prestige - neutralPrestige) / prestigeSpan)`
  with `u` clamping to -1..1; `regard = clamp(1 + span * standing + awards * awardsLift(a.awards), min, max)`.

- `deriveAncillaryMultipliers`: every quality reading is replaced by the
  neutral value it had for a median film, and the result is multiplied by
  `regard` once.
  - `homeEntertainment = genre.homeEnt * (0.4 + 1.0 * neutralAudience/100) * (0.9 + 0.4 * famTeen) * (0.9 + 0.35 * fr) * regard`
  - `licensing = genre.licensing * (0.75 + 0.3 * access) * (0.6 + 0.7 * neutralAudience/100) * (0.7 + 0.6 * neutralCritic/100) * (0.9 + 0.3 * fr) * (0.9 + 0.2 * neutralPrestige/100) * regard`
  - `merchandising`: unchanged.
  - `longevity = clamp(longevityWeight * clamp((regard - 1) / (max - 1), 0, 1) + franchise * fr + genreBias * genre.catalogueBias + holidayFamily * holidayFamilyScore(...) + cultBonus(a), 0, 1)`.
    Delete `LONGEVITY_WEIGHTS.awards`, `.criticalStanding`, `.belovedAudience`,
    `WELL_REGARDED_CRITIC_FLOOR` and `BELOVED_AUDIENCE_FLOOR`. `cultBonus` keeps
    its own audience threshold.
  - Keep the `MULT_CLAMP` clamps.
- `computeReachBase(worldwideGross)`: drop the audience parameter; use
  `REACH_BASE.floor + REACH_BASE.audienceLift * (REGARD.neutralAudience / 100)`.
- `deriveAncillaryProfile` and every caller follow. `AncillaryAttributes` keeps
  its fields.
- Fix the comments that describe the old formulas: the header of
  `ancillary.ts`, and `state/ancillarySettlement.ts` where it says licensing
  "carries a `1 + awardsLift` factor" and longevity "a `0.40 * awardsLift`
  term". `accrueAncillaryAwardsPremium` needs no logic change (it recomputes the
  profile with and without the new awards), but confirm it still pays a
  positive top-up when a film wins after its run.

No stored shape changes; no save bump. No new UI. Grep `src/components` for
text that tells the player Prestige or reviews raise licensing or catalogue
income and make sure it is still true in words (it is: "a well-regarded film
earns more after its cinema run").

### Tests

In `src/engine/ancillary.test.ts`:

- `computeRegard` is 1 for a film at the neutral readings with no awards; never
  below `min` or above `max`; rises with each of audience score, critic score,
  prestige and awards separately; awards alone can lift a neutral film to 1.25.
- A median film (audience 65, critic 48, prestige 50, no awards) gets the same
  four multipliers as the old formulas gave, within 1%. Compute the old values
  by hand from the formulas being replaced and pin them.
- A film at audience 93, critic 74, prestige 98, three wins earns no more than
  1.5 times the median film's home entertainment and licensing at the same
  gross (it was about 3.7 times on licensing).
- A panned film (audience 30, critic 20) earns no less than 0.75 times.
- Reach base no longer changes with audience score.
- Catalogue: a median film still has no tail (`longevity` below
  `CATALOGUE.minLongevity` unless genre, franchise or holiday give it one); a
  top-regard drama has one.

Existing tests expected to change, and why: `ancillary.test.ts` cases that pin
how far audience or critic score move a multiplier; `ancillarySettlement` tests
that pin an awards top-up amount; any outlook test that expected "exceptional"
licensing from scores alone (genre and franchise now do most of that work).
Update the expectations; do not loosen what they check.

### Measure

Career gate, all four tiers. Anatomy, Mid-Major Careful 101. All four
box-office gates.

Success:

- Rivals' after-market per pound of rentals (anatomy, `RIV` line) between 0.33
  and 0.45 (baseline 0.38).
- The player's between 0.45 and 0.70 (baseline about 1.0).
- Box-office gates: the Phase 0 misses, no others.
- Mid-Major: Careful roughly £70-600M with one to three of ten below £80M;
  Steady roughly £500-800M. (Prototype with these constants, six seeds: Careful
  70, 129, 368, 334, 70, 576; Steady 627, 798, 545, 523, 742, 727.) Steady is
  expected to remain far too high after this phase; later phases deal with it.

Tune, in this order, only if the player's ratio is outside 0.45-0.70:
`REGARD.span` in steps of 0.05 (0.25 to 0.45), then `REGARD.max` in steps of
0.1 (1.3 to 1.6).

**Stop and report** if more than four of ten Mid-Major Careful careers end
below £80M, or a guard rail in §1.3 breaks.

---

## Phase 2. One scoring model

**Goal.** A rival's film is scored exactly as a player's would be from the same
script, people, plan and luck. Rival quality rises a little; the reference
points are re-derived once.

### Change

1. **Craft.** `engine/releaseFilm.ts`: delete `personDrivenCraft` from
   `ReleaseComputationInput` and pass `true` to `computeQualityBreakdown`.
   Remove the field from `engine/marketSettlement.ts`. In `engine/scoring.ts`
   delete the `personDrivenCraft` parameter from `computeQualityBreakdown` and
   `computeProductionScore`, keeping the person-driven branch. A film with no
   Cinematographer, Composer or Editor attached must score exactly what the
   flat model gave (the deviation is measured from the no-head fallback, so it
   is zero) - pin that in a test before deleting the flag. Update the comments
   that say rivals keep the flat model, including
   `docs/domain/15-game-mapping.md` where it says rivals use the flat craft
   model.

2. **Preparation.** `engine/rivalExecution.ts`: a rival's shoot is preceded by
   a synthesised pre-production, built from the same table the player's is.

   ```ts
   export interface RivalPrepResult { events: ProductionEvent[]; riskDelta: number }
   /** The pre-production a rival's film went through: the same daily rolls a player's prep makes, with each decision answered as a competent studio would. */
   export function synthesizeRivalPrep(production: RivalExecutionInput, rng: RandomFn): RivalPrepResult
   ```

   - Days: `computeRecommendedPreProductionDays(talent, script, productionChoices)`.
   - Each day: `rollPreProductionDayEvent(talent, script, usedIds, rng)`. A
     plain event is kept. A pending choice is answered by `chooseRivalOption`
     (below) and resolved with `resolveEventChoice`.
   - `riskDelta` = the same sum-and-clamp `computePrepRiskDelta` applies.
   - `resolveRivalExecution` calls it first, applies the risk delta to the
     static risk with `applyPrepRiskDelta`, and returns the prep events that
     carry quality (the same filter and zeroing as `prepQualityEvents`) ahead
     of the shoot's events.
   - Give the prep its own generator so the shared stream does not shift:
     `const prepRng = forkRng(rng)` is **not** acceptable (it consumes from the
     shared stream); build one with `createRng` from a seed hashed from the
     production (`hashUnit` of the script title and the release day, scaled to
     an integer).

3. **Decisions.** Rivals answer shoot and prep decisions at random today.

   ```ts
   /** How often a rival takes the option a competent producer would. */
   export const RIVAL_SENSIBLE_CHOICE = 0.7;
   /** The option with the best expected quality (midpoint of qualityRange), ties to the lower expected cost; taken RIVAL_SENSIBLE_CHOICE of the time, otherwise any option at random. */
   export function chooseRivalOption(choices: PendingEventChoice['choices'], rng: RandomFn): string
   ```

   Use it for prep (always) and for the shoot in `resolveRivalExecution`
   **only if**, after steps 1 and 2, the anatomy still shows rivals' median net
   event points more than 8 below the player's. Record which way it went.

### Tests

- `src/engine/scoringParity.test.ts` (new, normal suite): build one script, one
  set of people, one plan and one fixed event list; call `computeReleaseResults`
  with a player-shaped input and with the input `resolveRivalProduction` would
  build from the same parts; `qualityScore`, `criticScore` and `audienceScore`
  are equal.
- A rival film's `postProductionScore` is higher with a strong Editor and
  Composer than with weak ones, all else equal.
- `synthesizeRivalPrep`: deterministic for a production; never returns an
  event id twice; its risk delta stays within the prep clamp; it does not
  consume from the generator passed to `resolveRivalExecution`.
- `chooseRivalOption`: with a generator that always returns 0 it picks the
  best-expected option; over many draws it picks it between 70% and 85% of the
  time on a two-option choice.

Existing tests expected to change: anything pinning a rival film's exact
quality or box office (`rivalStudios.test.ts`, `rivalExecution.test.ts`,
snapshot-style market tests), and unit tests that passed `personDrivenCraft`.
The rush, crowding and hold-or-move harness numbers will move slightly; they
are observational.

### Measure

Procedure R (§1.4). Then all four gates, the career gate at all four tiers,
and the anatomy.

Expected: rival median quality up 1 to 4 points; rivals' post-production score
62-66 instead of a flat 60; rivals' net event points up toward the player's.
With step 1 alone the whole-year gate moved from three misses to six by small
margins (`wideUnprofitablePct` 38.6 against a floor of 40, `majorPct` 14.3
against a ceiling of 14, `wideOpeningMultiple` 3.0 at its ceiling); procedure R
is expected to bring it back.

Success: the parity test passes; the whole-year gate is back to the Phase 0
misses; the gap between player and rival median quality at £10-40M is 15 points
or less (baseline 20).

**Stop and report** if procedure R cannot restore the gates; if rival median
quality rises more than 6 points; or if more than five of ten Mid-Major Careful
careers end below £80M (this phase moves the player's scores down relative to
the market, and the economy is steep there).

---

## Phase 3. Brand: reverts, matters less to marketing, buys a hold

**Goal.** Brand stops being a one-way ratchet. A studio's name follows what it
has released lately, makes marketing go a little further instead of three
times further, and keeps a wobbling film on screens a week longer.

### Change

1. **Reversion.** `engine/reputation.ts`:

   ```ts
   /** Films back that set where a studio's name rests. */
   export const BRAND_ANCHOR_FILMS = 8;
   /** Share of the gap to the anchor that closes in a year. */
   export const BRAND_REVERSION_PER_YEAR = 0.15;
   /** Worldwide gross -> the Brand a studio rests at if that is what its films usually do. Log-interpolated between anchors. */
   export const BRAND_LEVEL_BY_GROSS: Array<[gross: number, brand: number]> = [
     [1_000_000, 10], [10_000_000, 30], [100_000_000, 60], [1_000_000_000, 90],
   ];
   /** Where a studio's Brand rests, from the grosses of its most recent releases (newest first, at most BRAND_ANCHOR_FILMS). null with fewer than three: too little to go on, no drift. */
   export function computeBrandAnchor(recentGrosses: number[]): number | null
   /** Brand after `years` of drift toward the anchor. Unrounded; the caller rounds once. */
   export function driftBrand(brand: number, anchor: number | null, years: number): number
   ```

   The anchor is the mean of `brandLevelForGross` over those films, clamped
   5-95. Drift is applied once a quarter, on the day running costs are charged:
   in `state/studioReducer.ts:withRunningCosts`, for the player and for every
   rival, `brand = round(driftBrand(brand, anchor, 0.25))`, with grosses read
   from the finished films in `state.projects` (the player's have
   `releasedBy === undefined`; a rival's have its name). Derived, not stored.
   Because a quarter's drift can round to nothing, carry the fraction: add
   `brandDriftCarry?: number` to `Studio` and `RivalStudio`.

2. **Marketing range.** `engine/audienceSimulationInputs.ts`: narrow
   `MARKETING_EFFICIENCY_FLOOR`/`CEILING` so the top is worth about 1.5 times
   the bottom instead of 3.3 times, without moving the market's level. With
   `B` = the release-weighted mean Brand of rival wide releases from Phase 0's
   anatomy: `span = 0.30`, `floor = (0.3 + 0.7 * B/100) - span * B/100`,
   `ceiling = floor + span`. (For `B` = 55 that is 0.52 to 0.82.) Round to two
   places. `inferStudioBrandFromMarketingEfficiency` stays an exact inverse.
   Leave `RELEASE_STRENGTH_BRAND_WEIGHT` and `BRAND_BUZZ_WEIGHT` alone. Rewrite
   the long comment above the constants: it describes marketing efficiency as
   the mid-game progression, which it no longer is.

3. **The hold.** A studio exhibitors trust keeps its screens a little longer
   when a film softens.

   - `AudienceSimulationFixedState` gains `exhibitorStanding?: number` (0-1),
     set in `deriveAudienceSimulationFixedState` from a new optional input
     `exhibitorStanding` on `ReleaseSimulationInputs`; `releaseFilm.ts` passes
     `studioBrand / 100`. Absent means 0, so direct-simulation tests are
     unchanged.
   - `engine/audienceSimulationStep.ts`:

     ```ts
     /** Weeks of a run in which a trusted studio gets the benefit of the doubt. */
     const HOLD_WEEKS = 3;
     /** Share of a soft week's screen loss a fully trusted studio is spared. */
     const HOLD_RELIEF = 0.5;
     /** 0..HOLD_RELIEF - how much of this week's performance-driven screen loss is forgiven. 0 after HOLD_WEEKS, for a film not losing screens, or with no standing. */
     export function computeHoldRelief(fixed: AudienceSimulationFixedState, weekNumber: number, rawPerformanceAdjustment: number): number
     ```

     In `computeAvailabilityPerformanceAdjustment` (add the week number to its
     parameters), a negative adjustment is multiplied by `1 - relief`. The
     age-based decay and the rushed-release screen collapse are not touched.
   - The diagnostics variant (`advanceOneWeekWithDiagnostics`) reports the
     relief so the weekly report can read it.

4. **Save.** `Studio`, `RivalStudio` and the fixed state changed shape: bump
   `SAVE_VERSION`.

### What the player sees

- Wherever Brand is explained (`components/common/GameGuide.tsx`, the studio
  stat tooltip, `components/RivalStudioPage.tsx` if it explains it), replace
  the text with: **"Brand - how well the trade and the public know your name.
  A strong name gets a film onto more screens, keeps it there a little longer
  when it wobbles, and makes marketing go somewhat further. It follows what you
  have released lately, so it fades if your films stop being seen."**
- In the weekly box-office report for the player's running film, in any week
  where relief was applied: **"Exhibitors are keeping faith with this one a
  little longer, on the strength of your recent record."** Find the component
  by following where the weekly diagnostics for the player's film are rendered
  (start from `components/` uses of `boxOfficeRun.weeks`).
- No numbers in either.

### Notification contract

Drift happens on the tick. A point or two a quarter is not worth a message, but
a studio's name fading is something the player must be able to find out.

- Store `brandNotice?: { day: number; direction: 'fading' | 'recovering'; acknowledged?: boolean }`
  on `Studio`, set in `withRunningCosts` when drift alone has moved the
  player's Brand by 5 or more points in one direction since the last notice (or
  since the start), replacing any earlier notice.
- Add a category to `engine/project.ts:deriveInboxItems` and count it in
  `inboxBadgeCount` while unacknowledged. Both take projects only today; give
  each an optional trailing parameter for the studio's notice and pass it from
  `Inbox.tsx` and `Header.tsx`, so the two keep reading one derivation.
- Text: fading - **"Your studio's name is fading. It has been a while since a
  release of yours was widely seen."**; recovering - **"Your studio's name is
  recovering as your recent releases reach more people."**
- One click: the card's button opens the studio overview where Brand is shown.
  It is acknowledged when that screen displays it (an effect on that surface),
  not when the Inbox opens.
- Work through the contract's checklist and tick it off in "As built".

### Tests

- `computeBrandAnchor`: null under three films; £100M films rest at 60; mixed
  grosses give the mean of their levels; uses only the newest eight.
- `driftBrand`: moves toward the anchor from above and below; never past it;
  no change with a null anchor; four quarters compound to about the yearly rate.
- Reducer: crossing a running-cost day drifts the player and each rival once;
  the carry accumulates sub-point drift until it rounds.
- Marketing efficiency at the mean Brand `B` equals the old value there within
  0.005; the top is at most 1.6 times the bottom; the inverse round-trips.
- `computeHoldRelief`: 0 with no standing, 0 for a film gaining screens, 0
  after week three, `HOLD_RELIEF` at full standing in week two; a soft Wide
  release from a Brand-90 studio keeps more screens in weeks two and three than
  the same film from a Brand-10 studio and the same from week five on.
- Inbox: the notice appears after a 5-point drift, lights the badge, clears
  when the studio overview shows it, and does not reappear until a further 5
  points.

Existing tests expected to change: tests pinning `computeMarketingEfficiency`
at 0.3 and 1.0, release-strength and Buzz tests that depend on efficiency,
audience-simulation scenario tests that fix a Brand far from the mean (their
grosses move), and `buzzCalibration` fixtures only if they read efficiency
(Buzz itself is untouched).

### Measure

All four gates; career gate at all four tiers; anatomy for the rival table.

Success:

- Whole-year gate: the Phase 0 misses. Because the range was centred on the
  market's mean Brand the level should hold; if `wideUnprofitablePct` or
  `majorPct` leaves its band, apply step 3 of procedure R (the level lever
  only).
- Rival field after ten years (anatomy): no more than 3 of 19 rivals at Brand
  below 10 (baseline 9), and no more than 3 above 90.
- Among player careers that end below starting cash, at least half end with
  Brand above 40 (baseline in the ablations: failing careers ended at 23-48).
- Indie and Boutique are no worse than Phase 2 (their Brand of 24-34 now buys
  more marketing than before, so they should be slightly better).

Tune only if the rival field misses: `BRAND_REVERSION_PER_YEAR` in steps of
0.05 (0.10 to 0.30).

**Stop and report** if a guard rail breaks, or if Boutique gains more than
half again on its Phase 2 median (cheaper marketing for small studios must not
bring the Boutique runaway back).

---

## Phase 4. Report, then tune legs only if needed

**This phase begins with a mandatory report to the owner.** Post the per-seed
career tables for all four tiers after Phase 3 beside the Phase 0 tables, the
gate results, and where the numbers stand against §1.3. Then continue by the
rule below without waiting, unless the owner replies.

Rule:

- If Mid-Major and Major, Careful and Steady, are all inside the §1.3 bands or
  *harder* than them: do nothing in this phase.
- If any still has no career that shrinks, or a career above four times
  starting cash: apply 4a, measure, and apply 4b only if 4a did not bring it
  inside.

**4a. A lower ceiling on audience score.** `engine/scoring.ts`: add
`AUDIENCE_CEILING = 94`, and replace `topCompressed(raw, AUDIENCE_KNEE, AUDIENCE_KNEE_SCALE)`
with `softBound(raw, AUDIENCE_KNEE, AUDIENCE_KNEE_SCALE, AUDIENCE_CEILING)`;
move `AUDIENCE_KNEE` from 74 to 72. Do **not** change `AUD_QUALITY_GAIN` (a
recorded finding: below 1 the critic and audience voices decorrelate too far).
Target: a quality-70 film from a careful player scores 80-86 with audiences
(baseline 91-96); the market's median audience score moves by no more than one
point. Tune `AUDIENCE_KNEE` in steps of 2 (68 to 74).

Tests: scores below the knee are unchanged; the score is monotone in quality;
nothing exceeds the ceiling. Run
`BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/receptionSpread.diagnostic.test.ts --disable-console-intercept`
and record critic-audience correlation before and after; it must stay within
0.05 of where it was.

**4b. A firmer expectation gap.** `data/wordOfMouth.ts`:
`EXPECTATION_GAP_WEIGHT` 0.1 to 0.15, `EXPECTATION_FACTOR_MIN` 0.7 to 0.6,
`EXPECTATION_FACTOR_MAX` 1.2 to 1.25. Nothing else. This sits on the most
fragile calibration in the engine. `audienceSimulationRegressionMatrix.test.ts`
and the scenario tests must pass **unchanged**; the whole-year gate's
`wideOpeningMultiple` and `wideRunWeeks` must stay in band; the variance gate
must pass. If any of those fails, revert 4b completely and report - do not
retune word of mouth to make it fit.

---

## Phase 5. Rivals compete for scripts and directors

**Goal.** The best scripts go to the best offer, not to whoever clicks first,
and rivals want the scripts and directors a careful player wants.

### Change

1. **Contested scripts.** `types`: `Opportunity` gains `contested?: boolean`.
   `engine/opportunities.ts`:

   ```ts
   /** How many of a week's new scripts are sold by bidding. */
   export const CONTESTED_PER_BATCH = 2;
   /** A script has to be at least this good to draw a crowd. */
   export const CONTESTED_MIN_HEAT = 62;
   /** How much the trade wants a script, 0-100: the mean of originality, hook, emotionalPremise, structure, characters and dialogue. */
   export function marketHeat(script: Script): number
   ```

   In `settleOpportunities`, after the batch is generated, the
   `CONTESTED_PER_BATCH` scripts with the highest heat, if at or above
   `CONTESTED_MIN_HEAT`, get `contested: true`. At the weekly tick a contested
   script with a bid resolves as bids do today; one with no bid becomes an
   ordinary listing (`contested: false`) and stays until it expires.

   `state/studioReducer.ts:ACQUIRE_OPPORTUNITY` refuses a contested script.
   `PLACE_BID` already accepts a first bid above the listed price; confirm it
   does for a contested script with no bids, and add the case if not.

2. **Rivals want them.** `engine/rivalStudios.ts`:
   - `scriptCraftScore` becomes `marketHeat` (it gains hook and emotional
     premise; originality stays its own separate term in
     `evaluateOpportunityForTier`).
   - `BID_OPENING_PREMIUM_RANGE_CONTESTED: [number, number] = [0.15, 0.5]` is
     used in `considerBiddingOnOpportunity` for a contested script, in place of
     `BID_OPENING_PREMIUM_RANGE`.
   - In `evaluateOpportunityForTier`, a contested script adds
     `CONTESTED_APPEAL = 8` to its score.

3. **Rivals read a director's fit.** `engine/rivalCasting.ts`: `chooseRivalHires`
   takes an optional `script?: Script`. For the Director role, when a script is
   given, the read gains
   `RIVAL_DIRECTOR_FIT_WEIGHT (0.3) * ((computeTalentCompatibility(person, 'Director', script) ?? 50) - 50)`.
   `startRivalProductionFromWonScript` passes the script. The noise draw stays
   where it is so the stream does not shift.

4. **The bot learns to bid.** `state/playerBot.ts:chooseScript`: contested
   scripts are candidates on the same affordability test. If its first choice
   is contested, it dispatches `PLACE_BID` at
   `min(acquisitionCost * BOT_BID_PREMIUM (1.25), the 20%-of-negative cap)`,
   does not raise, and tries again after the weekly tick: if it won, it starts
   the film from the new asset; if it lost, it chooses again. While its bid is
   open it starts nothing else. This is harness maintenance, not a strategy
   change; the five strategies' numbers stay as they are.

5. **Save.** `Opportunity` changed shape: bump `SAVE_VERSION`.

### What the player sees

`components/OpportunityMarket.tsx`:

- A contested script's card carries a badge **"Contested"** and the line
  **"Several studios are circling this one. It goes to the best offer when the
  week closes."**
- Its button reads **"Make an offer"** and opens the existing bid control,
  starting just above the listed price. The outright purchase button is not
  shown.
- A contested script that drew no offer loses the badge and shows
  **"No offers came in. It can be bought outright now."** until the player has
  seen the card.

### Notification contract

The outcome lands at the weekly tick. Bid notifications
(`engine/bidNotifications.ts`: won, lost, outbid) already exist and already
clear on read. Confirm each fires for a contested script, that the won card's
button lands on the new asset, and that being outbid mid-week still gives the
player one click to raise. Nothing else new arrives unprompted.

### Tests

- `marketHeat` is the six-stat mean.
- Settlement flags at most two per batch and none below the minimum; a
  contested script with bids resolves to the highest; one without becomes
  ordinary; flags are deterministic for a seed.
- The reducer refuses to acquire a contested script outright and accepts an
  opening bid on one.
- A rival opens higher on a contested script than on an ordinary one of the
  same price, and ranks a high-hook script above a low-hook one of equal craft.
- `chooseRivalHires` prefers, among directors of equal record, the one whose
  taste suits the script; without a script it behaves exactly as before.
- Bot: wins an uncontested auction it bids on; moves on after losing one; is
  never left idle forever with a bid that cannot resolve.
- Component: a contested card shows the offer button and not the buy button.

Existing tests expected to change: `opportunities.test.ts` batch expectations,
`OpportunityMarket.test.tsx` (the buy button is now conditional),
`rivalStudios` bidding tests that pin a chosen script or an opening amount, and
`developmentPipeline.test.ts` where it acquires whatever script comes first.

### Measure

Procedure R (rival direction scores rise). Then gates, career gate at all four
tiers, anatomy.

Success:

- The player wins between 25% and 60% of the contested scripts it offers on
  (count from the bot's bid notifications).
- Rivals' median direction score at £10-40M rises at least 3 points; the gap to
  the player's at that size is 10 or less (baseline 10-20).
- The share of top-tenth directors unavailable on a sampled day is higher than
  Phase 0's figure.
- The whole-year gate is back to the Phase 0 misses after procedure R.

Tune, in order: `BID_OPENING_PREMIUM_RANGE_CONTESTED` upper bound in steps of
0.1 (0.3 to 0.8) for the win rate; `RIVAL_DIRECTOR_FIT_WEIGHT` in steps of 0.1
(0.2 to 0.5) for the direction gap.

**Stop and report** if a guard rail breaks, or if the player wins fewer than
one in ten contested scripts at Indie or Boutique (small studios must not be
locked out of good material).

---

## Phase 6. A shoot that can go wrong

> **Withdrawn (owner's decision).** This phase re-weighted random prep events
> to force an outcome. It was built and measured but never merged; see
> `DESIGN_REVIEW_market_realism.md` §7.6. Pre-production is being redesigned
> from how real prep works instead: `DESIGN_REVIEW_preproduction_realism.md`.

**Goal.** A player's shoot stops being reliably lucky. Rivals share the prep
table since Phase 2, so this moves them too.

### Change

`src/data/productionEvents.ts`, `PRE_PRODUCTION_EVENT_TEMPLATES`:

| Template | `qualityRange` now | becomes |
|---|---|---|
| `preprod-table-read-revelation` | [3, 7] | [1, 5] |
| `preprod-rehearsal-chemistry` | [2, 6] | [1, 4] |
| `preprod-design-breakthrough` | [2, 6] | [1, 4] |
| `preprod-casting-chemistry-concern` | [-5, -1] | [-7, -2] |
| `preprod-int-rewrite-window`, "Commission the rewrite" | [2, 8] | [-2, 7] |
| `preprod-int-ambitious-set`, "Find the money and build it" | [4, 9] | [-1, 8] |

Two new plain templates, both `polarity: 'negative'`, `severity: 'medium'`, no
cost, no delay:

- `preprod-script-problem-surfaced`, `impact: 'script'`, `qualityRange: [-6, -2]`,
  `riskDeltaRange: [2, 6]`: **"The table read exposed a second act that does
  not work, and there is no time left to fix it properly."**
- `preprod-look-never-settled`, `impact: 'sets'`, `qualityRange: [-5, -1]`,
  `riskDeltaRange: [2, 6]`: **"The look of the film never quite settled, and
  the departments went into the shoot pulling in different directions."**

Change the two option descriptions so they are honest about the new downside:
"Commission the rewrite" - **"A good writer can lift it. A late pass can also
unsettle what was working."**; "Find the money and build it" - **"A real
centrepiece if it comes off, and a costly distraction if it does not."**

No new mechanics, nothing new on the tick (prep events already reach the
player through the prep log and its pending decisions), no stored shape change.

### Tests

Every prep template still passes the table's existing shape tests; the two new
ids are unique; a rewrite commissioned from a weak writer can now lose quality
and from a strong one still gains on average (the option is `skillSensitive`).

### Measure

Procedure R. Then gates, career gate at all four tiers, anatomy.

Success: the player's median net event points per film are within 8 of rivals'
(baseline +33 against +10) and the player's 10th percentile is below +5.

Tune, only if the median gap is still above 8: lower the three positive ranges
by one more point at each end, once.

**Then check §1.3 in full**, with `CAREER_GATE_ASSERT=1`, at Mid-Major and
Major. Report the result to the owner whichever way it falls. If the bands are
missed on the easy side, do not invent further levers: **STOP AND ASK.** If
they are missed on the hard side (more than three of ten careers shrink), the
first thing to give back is `REGARD.span` (Phase 1), one step.

Finally, ask the owner for a playtest of one Mid-Major career. The bot never
picks a release date, never tunes a campaign and takes the first option in
every decision; a person plays better than it does, so the bands are a floor on
how easy the game is, not a measurement of it.

---

## Phase 7. Optional - do not start without the owner's go-ahead

Listed so the implementer knows what was deliberately left out.

- **Rival identities.** A data table of per-studio weights (genres, film sizes,
  marketing appetite, how much they value hook, craft, originality and price)
  replacing `GENRE_TIER_BIAS` and the per-tier weights in
  `evaluateOpportunityForTier`, so named rivals differ. Static first.
- **Rivals that adapt.** Only after identities, and only with bounds, because
  the box-office gates measure rival films and would drift within a run.
- **Script reads.** The owner chose to keep exact script stats.
- **Notes and cut-by-committee.** A feature in its own right.

---

## Stop-and-ask points, gathered

1. Phase 0: the baseline differs from this plan's by more than seed noise.
2. Any phase: a guard rail in §1.3 breaks.
3. Any phase: three steps of one constant have not reached the success numbers.
4. Procedure R cannot bring the whole-year gate back to its Phase 0 misses.
5. Phase 2: rival quality rises more than 6 points, or more than five of ten
   Mid-Major Careful careers shrink.
6. Phase 3: Boutique's median rises by more than half.
7. Phase 4: the mandatory report (continue by the rule unless the owner
   replies); and 4b fails a regression test (revert, report).
8. Phase 5: small studios win fewer than one in ten contested scripts.
9. Phase 6: the final bands are missed on the easy side.
10. Anything that would need a change to talent generation, a bot strategy's
    numbers, or a gate's bands.

When stopping: commit and push what is green, write what was tried and the
per-seed tables into "7. As built", and say in the report what you would do
next and why.
