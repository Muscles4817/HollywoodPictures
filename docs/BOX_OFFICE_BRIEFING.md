# Box Office System — full briefing

**Purpose.** This is a self-contained description of how box office works in
*Hollywood Pictures* right now, written to be handed to a reader with no prior
knowledge of the codebase. It contains the architecture, every input variable and
what it feeds, the formulas verbatim, all tunable constants, two complete
two-in-game-year simulation runs including competition between studios, and the
current test suite with results.

**What we want from you.** The model is a demand simulation, not a revenue
formula, and it currently misses most of its ratified calibration targets
(§10). Read it with fresh eyes and tell us what is structurally wrong, what is
merely mistuned, and what you would change — including changes to the tests
themselves.

Everything below is extracted from source at the commit this document was
written; formulas are quoted verbatim, not paraphrased.

---

## 1. Architecture in one page

Box office is **not** a formula that computes a gross. It is a weekly diffusion
simulation over a synthetic population, and money appears only at the very last
step.

```
      release day                          every week thereafter
 ┌──────────────────────┐            ┌─────────────────────────────────┐
 │ derive FIXED STATE   │            │ advanceOneWeekWithDiagnostics() │
 │ (12 numbers, frozen  │───────────▶│  awareness → interest →         │
 │  for the whole run)  │            │  urgency → attendance,          │
 └──────────────────────┘            │  gated by availability and      │
            ▲                        │  attention competition          │
            │                        └─────────────────────────────────┘
   film's own attributes                            │
   (script, cast, budget,                           │ weeklyAdmissions (people)
    marketing, scores,                              ▼
    release type/window,           × AVERAGE_TICKET_PRICE ($11)  ← the ONLY
    studio brand, crowding)                         │              money boundary
                                                    ▼
                              domestic / international split, keep shares,
                              distributor fee, P&A recoup → studio cash
```

Design constraints the code holds itself to:

- **`src/engine/` is pure.** Plain data in, plain data out. No React, no hidden
  state, no I/O.
- **The audience simulation is fully deterministic.** There is no random draw
  anywhere in the weekly step. Two identical films with identical fixed state and
  identical competition produce byte-identical runs. All variance is meant to be
  *endogenous* — it comes from how the production actually went (which varies) and
  from the market a film releases into, never from a release-time dice roll.
- **Model people, not money.** Nothing inside the simulation multiplies by a
  price. Admissions are headcounts; the price is applied once, in
  `boxOfficeRun.ts`.
- **Derive, don't store.** Word-of-mouth activity, a running film's competitive
  strength, and market breakdowns are all re-derived from a film's stored weekly
  history rather than kept as extra state.

### Module map

| File | Lines | Role |
|---|--:|---|
| `src/engine/audienceSimulation.ts` | 353 | State types + validating factories; word-of-mouth activity derivation |
| `src/engine/audienceSimulationInputs.ts` | 876 | Turns a film's attributes into the 12-field **fixed state** |
| `src/engine/audienceSimulationStep.ts` | 1,133 | The weekly transition — the heart of the model |
| `src/engine/boxOfficeRun.ts` | 397 | Weekly settlement: admissions → money, run completion, outcome |
| `src/engine/releaseCrowding.ts` | 188 | Release-calendar crowding + relative-strength matchup |
| `src/engine/marketSettlement.ts` | 330 | The unified market tick — interleaves new releases and running weeks |
| `src/engine/distribution.ts` | 359 | Domestic/international split, keep shares, distributor deals |
| `src/engine/ancillary.ts` | 417 | Post-theatrical revenue (separate system, out of scope here) |

---

## 2. The simulated population

Every film gets its own private population. There is no shared moviegoer pool —
two films playing the same week each simulate their own audience, and they
interact only through the two competition channels in §7.

Each person in a film's population is in one of these states:

| Concept | Field | Meaning |
|---|---|---|
| Total addressable audience | `totalAddressableAudience` | Everyone who could **ever** conceivably see a film like this. Fixed at release. |
| Aware | `awareCount` | Knows the film exists. Monotonically non-decreasing. |
| Interested (remaining) | `interestedRemaining` | Wants to see it and hasn't yet. Can rise (new interest) and fall (tickets sold). |
| Attended | `cumulativeTicketsSold` | Has bought a ticket. Monotonically non-decreasing. One ticket per person — no repeat viewing modelled. |
| Crossover realised | `cumulativeCrossoverRealized` | Of the interested, how many came from *outside* the film's natural audience. Tracked separately so crossover has its own ceiling. |
| Exhibition access | `availabilityFraction` | 0–1 fraction of "full" theatrical access this week. Evolving state, one-week lagged. |

Two ceilings bound the run:

```
naturalCeiling   = baseInterestFraction        × totalAddressableAudience
crossoverCeiling = crossoverCapacityFraction   × totalAddressableAudience
maxInterestedAudience = (baseInterestFraction + crossoverCapacityFraction) × TAA
```

`createAudienceSimulationFixedState` enforces `baseInterestFraction +
crossoverCapacityFraction ≤ 1`, so those two together are the model's hard
statement of "how much of the addressable pool could ever want this."

---

## 3. The fixed state — 12 numbers, frozen at release

`deriveAudienceSimulationFixedState(inputs)` runs once, on release day, and
produces the only thing the weekly step ever reads about the film. Nothing about
the film can change after this point.

| Field | Meaning | Derived from |
|---|---|---|
| `totalAddressableAudience` | Headcount of everyone who could ever want this | genre popularity × target-audience market size × franchise multiplier |
| `baseInterestFraction` | Of TAA, what fraction has genuine taste-fit | script accessibility (convex), hook strength, audience-fit match |
| `marketingEfficiency` | How far a marketing dollar goes | studio Brand |
| `crossoverCapacityFraction` | Ceiling on interest expansion beyond the natural audience | script crossover potential, spectacle, critic score, genre/audience reach |
| `conversionPacingBaseline` | Weekly probability an interested person attends | release type, release window, window×genre bonus, buzz |
| `externalWeeklyAwarenessRate` | Fraction of the unaware who become aware weekly, non-WOM | marketing efficiency |
| `criticScore` | 0–100, reused verbatim from `FilmResults` | the production/scoring pipeline |
| `audienceScore` | 0–100, reused verbatim from `FilmResults` | the production/scoring pipeline |
| `initialAwareCount` | One-time release-day awareness lump | marketing spend × efficiency, combined with cast/director fame reach |
| `initialAvailabilityFraction` | Release-day theatrical access | release type, release strength, distribution deal ceiling, crowding |
| `availabilityBaseWeeklyDecay` | How fast access erodes on its own | release type |
| `criticLedExpansionWeight` | How much *expansion* keys on critics rather than audiences | release type (nonzero only for Festival First) |

### 3.1 Inputs → what they feed

This is the complete variable-to-effect map. Anything not listed here does not
reach box office.

| Input | Source | Feeds | Does **not** feed |
|---|---|---|---|
| `genre` | player/AI choice | TAA (popularity), crossover accessibility, window genre bonus, international appeal | — |
| `targetAudience` | player/AI choice | TAA (market size), crossover accessibility, audience-fit multiplier | — |
| `scriptAccessibility` | `deriveCommercialProfile(script)` | `baseInterestFraction` (convex, exponent 2.2) | awareness, marketing efficiency |
| `scriptHookStrength` | `deriveCommercialProfile(script)` | `baseInterestFraction` (0.8–1.2 multiplier) | crossover, awareness |
| `scriptCrossoverPotential` | `deriveCommercialProfile(script)` | `crossoverCapacityFraction` (weight 0.55) | base interest, awareness |
| `scriptSpectacle` | `Script.toneProfile.spectacle` | `crossoverCapacityFraction` (weight 0.30) | — |
| `scriptMarketability` | `deriveMarketability(script)` — franchise/IP pre-sold demand | TAA, convexly — **but the gain constant is currently 0, so it has no effect at all** | — |
| `scriptIntendedAudience` | script | audience-fit multiplier (0.7 penalty on mismatch) | — |
| `buzzScore` | `computeBuzzScore` | `conversionPacingBaseline` **only** (urgency, weight 0.5) | awareness, word of mouth |
| `marketingSpend` | player/AI choice | `initialAwareCount` (dominant channel), release strength → `initialAvailabilityFraction` | quality, interest, reception |
| `studioBrand` | `Studio.brand` | `marketingEfficiency` → awareness reach + external awareness rate + release strength | — |
| `studioGenreIdentity` | `engine/studioIdentity.ts` | effective marketing efficiency (+15% max, boost-only) | — |
| `directorFame`, `leadFame` | hired talent | `initialAwareCount` via cast reach (max 10% organic reach) | interest, reception |
| `criticScore` | scoring pipeline | reception multiplier (weight 0.3), crossover capacity (weight 0.15), Festival First expansion gate | — |
| `audienceScore` | scoring pipeline | reception multiplier (weight 0.7) | — |
| `releaseType` | player/AI choice | pacing baseline, initial availability, decay rate, critic-led expansion weight | awareness (deliberately removed) |
| `releaseWindow` | derived from release day | pacing baseline (base multiplier × genre bonus) | — |
| `competitiveCrowding` | `computeCompetitiveCrowding` at release | dents `initialAvailabilityFraction` (weight 0.5) | interest, awareness, pacing |
| `wideAvailabilityCeiling` | distribution deal | Wide availability ceiling | — |
| `competitivePressure` | recomputed **every week** | attention factor on attendance, availability decay | fixed state (it isn't fixed) |

### 3.2 Fixed-state formulas, verbatim

```ts
// --- Total addressable audience ---
const BASE_ADDRESSABLE_POPULATION = 200_000_000;
const FRANCHISE_ELIGIBILITY_GAIN = 0;        // <-- currently disables the term
const FRANCHISE_ELIGIBILITY_CONVEXITY = 5.5;

function franchiseEligibilityMultiplier(marketability) {
  return 1 + FRANCHISE_ELIGIBILITY_GAIN * (clamp(marketability, 0, 100) / 100) ** FRANCHISE_ELIGIBILITY_CONVEXITY;
}

function computeTotalAddressableAudience(genre, targetAudience, marketability = 0) {
  const marketSize = AUDIENCE_PROFILES[targetAudience].marketSize;   // 0.4 – 1.0
  const popularity = GENRE_PROFILES[genre].popularity / 100;         // 0.45 – 0.75
  return BASE_ADDRESSABLE_POPULATION * marketSize * popularity * franchiseEligibilityMultiplier(marketability);
}

// --- Base interest ---
const BASE_INTEREST_FLOOR = 0.08;
const BASE_INTEREST_CEILING = 0.45;
const INTEREST_CONVEXITY = 2.2;
const HOOK_STRENGTH_INTEREST_FLOOR = 0.8;
const HOOK_STRENGTH_INTEREST_CEILING = 1.2;
const AUDIENCE_MISMATCH_PENALTY = 0.7;

function computeBaseInterestFraction(scriptAccessibility, scriptHookStrength, targetAudience, scriptIntendedAudience) {
  const raw = BASE_INTEREST_FLOOR
    + (BASE_INTEREST_CEILING - BASE_INTEREST_FLOOR) * clamp(scriptAccessibility / 100, 0, 1) ** INTEREST_CONVEXITY;
  const hookMultiplier = HOOK_STRENGTH_INTEREST_FLOOR
    + (HOOK_STRENGTH_INTEREST_CEILING - HOOK_STRENGTH_INTEREST_FLOOR) * (scriptHookStrength / 100);
  const fitMultiplier = targetAudience === scriptIntendedAudience ? 1 : AUDIENCE_MISMATCH_PENALTY;
  return clamp(raw * hookMultiplier * fitMultiplier, 0, 1);
}

// --- Crossover capacity ---
const CROSSOVER_CAPACITY_CEILING = 0.3;
const CROSSOVER_CONCEPT_WEIGHTS = { crossoverPotential: 0.55, spectacle: 0.3, criticScore: 0.15 };
const CROSSOVER_ACCESSIBILITY_FLOOR = 0.4;
const CROSSOVER_ACCESSIBILITY_REFERENCE = 0.75;   // Action (75) × Mass Market (1.0)

function computeCrossoverConceptStrength(crossoverPotential, spectacle, criticScore) {
  return clamp(0.55 * (crossoverPotential / 100) + 0.3 * (spectacle / 100) + 0.15 * (criticScore / 100), 0, 1);
}

function computeCrossoverAccessibility(genre, targetAudience) {
  const reach = (GENRE_PROFILES[genre].popularity / 100) * AUDIENCE_PROFILES[targetAudience].marketSize;
  const normalized = clamp(reach / CROSSOVER_ACCESSIBILITY_REFERENCE, 0, 1);
  return CROSSOVER_ACCESSIBILITY_FLOOR + (1 - CROSSOVER_ACCESSIBILITY_FLOOR) * normalized;
}

function computeCrossoverCapacityFraction(...) {
  return clamp(CROSSOVER_CAPACITY_CEILING * conceptStrength * accessibility, 0, CROSSOVER_CAPACITY_CEILING);
}

// --- Marketing efficiency & awareness ---
const MARKETING_EFFICIENCY_FLOOR = 0.3;
const MARKETING_EFFICIENCY_CEILING = 1.0;
const IDENTITY_MARKETING_BOOST = 0.15;
const EXTERNAL_AWARENESS_BASE_RATE = 0.03;
const MAX_CAST_ORGANIC_REACH = 0.1;

computeMarketingEfficiency(studioBrand)          = clamp(0.3 + 0.7 * (studioBrand / 100), 0, 1);
computeEffectiveMarketingEfficiency(eff, ident)  = clamp(eff * (1 + 0.15 * (clamp(ident,0,100)/100)), 0, 1);
computeExternalWeeklyAwarenessRate(eff)          = clamp(0.03 * (0.5 + 0.5 * eff), 0, 1);

computeCastReachFraction(directorFame, leadFame) =
  0.1 * ((clamp(directorFame,0,100) * 0.25 + clamp(leadFame,0,100) * 0.75) / 100) ** 2;

// marketingReachFraction: logT(marketingSpend, {min: 10_000, max: 150_000_000}) interpolated
// through MARKETING_REACH_ANCHORS = t:0→0, 0.25→0.03, 0.5→0.12, 0.75→0.35, 0.9→0.62, 1→0.85

combineIndependentReach(...rs) = 1 - Π (1 - clamp(r, 0, 1));

computeInitialAwareCount(fixed, directorFame, leadFame, marketingSpend) {
  const marketingReach = clamp(marketingReachFraction(marketingSpend) * fixed.marketingEfficiency, 0, 0.95);
  const castReach = computeCastReachFraction(directorFame, leadFame);
  return round(fixed.totalAddressableAudience * combineIndependentReach(marketingReach, castReach));
}

// --- Conversion pacing (attendance urgency) ---
const BUZZ_URGENCY_WEIGHT = 0.5;

computeConversionPacingBaseline(releaseType, releaseWindow, genre, buzzScore) =
  clamp(DISTRIBUTION_PROFILES[releaseType].conversionPacingBaseline
        * RELEASE_WINDOW_BASE_MULTIPLIER[releaseWindow]
        * (RELEASE_WINDOW_GENRE_BONUS[releaseWindow][genre] ?? 1)
        * (1 + 0.5 * (buzzScore / 100)), 0, 1);

// --- Initial availability (exhibition access) ---
const WIDE_AVAILABILITY_FLOOR = 0.4;
const RELEASE_STRENGTH_MARKETING_WEIGHT = 0.6;
const RELEASE_STRENGTH_BRAND_WEIGHT = 0.4;
const CROWDING_PENALTY_WEIGHT = 0.5;

computeReleaseStrength(spend, eff) = clamp(0.6 * marketingReachFraction(spend) + 0.4 * eff, 0, 1);

computeInitialAvailabilityFraction(type, strength, ceilingOverride) =
  type !== 'Wide'
    ? DISTRIBUTION_PROFILES[type].initialAvailabilityFraction
    : 0.4 + ((ceilingOverride ?? 0.95) - 0.4) * strength;

initialAvailabilityFraction = uncrowdedAvailabilityFraction * (1 - 0.5 * competitiveCrowding);
```

### 3.3 Data tables the fixed state reads

**`AUDIENCE_PROFILES[targetAudience].marketSize`** — Mass Market 1.0, Families
0.85, Teens 0.8, Adults 0.75, Critics 0.55, Niche 0.4.

**`GENRE_PROFILES[genre].popularity`** — Action 75, Sci-Fi 68, Comedy 65,
Fantasy 62, Thriller 60, Horror 55, Romance 50, Drama 45.

**`RELEASE_WINDOW_BASE_MULTIPLIER`** — Christmas 1.2, Summer 1.15, Halloween
1.05, Awards Season 1.0, Quiet Month 0.85.

**`RELEASE_WINDOW_GENRE_BONUS`** — Summer: Action 1.3, Sci-Fi 1.3, Fantasy 1.2 ·
Awards Season: Drama 1.35, Thriller 1.1 · Halloween: Horror 1.45 · Christmas:
Fantasy 1.25, Romance 1.2, Comedy 1.1 · Quiet Month: none.

**`DISTRIBUTION_PROFILES`** (release-type behaviour):

| Release type | `conversionPacingBaseline` | `initialAvailabilityFraction` | `availabilityBaseWeeklyDecay` | `criticLedExpansionWeight` |
|---|--:|--:|--:|--:|
| Wide | 0.62 | 0.95 (ceiling) | 0.18 | 0 |
| Limited | 0.06 | 0.10 | 0.02 | 0 |
| Festival First | 0.05 | 0.02 | 0.015 | 0.65 |

**`MARKETING_SPEND_RANGE`** = $10,000 – $150,000,000, log-scaled.

Note that awareness is now **identical across release types** for the same
buzz/marketing/cast inputs. An earlier version scaled initial awareness by up to
30× between Wide and Festival First *and* gated availability by a further ~47× —
asking the same "how widely is this playing" question twice. Release type now
answers only the second question.

---

## 4. The weekly step

`advanceOneWeekWithDiagnostics(fixed, weeks, womInfluenceOverride?, competitivePressure = 0)`
is the whole model. It is called once per film per elapsed in-game week and is
completely deterministic.

### Order of operations

```
 1. Release-day awareness seed        (week 1 only): aware += min(unaware, initialAwareCount)
 2. External awareness growth         aware += unaware × externalRate × 0.55^(week-1)
 3. Convert new awareness → interest  min(newlyAware × baseInterestFraction, naturalHeadroom)
 4. Word-of-mouth influence           from the film's own prior weeks × reception
 5. WOM natural interest growth       within the natural ceiling
 6. WOM crossover expansion           within the separate crossover ceiling
 7. Attendance probability            pacing baseline, lifted by WOM pull-forward urgency
 8. Attention competition             probability × attentionFactor(competitivePressure)
 9. Sell tickets                      unconstrainedDemand = interested × probability
10. Exhibition gate                   ticketsThisWeek = min(demand, availability capacity)
11. Next week's availability          from this week's demand/capacity utilisation (one-week lag)
12. End check                         admissions < 2% of opening, or 20 weeks reached
```

### 4.1 Awareness

```ts
// week 1 only
applyReleaseDayAwarenessSeed(fixed, awareCount, weeksLength) {
  if (weeksLength > 0) return awareCount;
  const unaware = max(0, fixed.totalAddressableAudience - awareCount);
  return awareCount + min(unaware, fixed.initialAwareCount);
}

// every week
applyExternalAwarenessGrowth(fixed, awareCount, weekNumber) {
  const unaware = max(0, fixed.totalAddressableAudience - awareCount);
  const ageMultiplier = 0.55 ** max(0, weekNumber - 1);      // decays fast
  return awareCount + unaware * fixed.externalWeeklyAwarenessRate * ageMultiplier;
}
```

Word of mouth **does not create awareness** — `newlyAwareFromWom` is hardcoded
`0` in the step. Awareness comes only from the release-day seed and the
fast-decaying external trickle. This is deliberate (word of mouth acts on
interest and urgency instead), but it is a strong structural choice worth
questioning.

### 4.2 Word of mouth

```ts
const WOM_LOOKBACK_WEIGHTS = [1, 0.7, 0.4, 0.2, 0.05];

deriveWordOfMouthActivity(weeks, asOfWeekIndex) =
  Σ over lookback 0..4 of weeklyAdmissions(asOfWeekIndex - 1 - lookback) × WOM_LOOKBACK_WEIGHTS[lookback];

computeRunningFilmStrength(fixed, weeks, i) =
  clamp(deriveWordOfMouthActivity(weeks, i) / maxInterestedAudience(fixed), 0, 1);

const RECEPTION_FLOOR = 0.01, AUDIENCE_SCORE_WEIGHT = 0.7, CRITIC_SCORE_WEIGHT = 0.3;
const RECEPTION_PIVOT = 0.22, RECEPTION_EXPONENT = 2;

computeReceptionResponseMultiplier(fixed) {
  const weighted = (audienceScore × 0.7 + criticScore × 0.3) / 100;
  const above = clamp((weighted - 0.22) / (1 - 0.22), 0, 1);
  return 0.01 + 0.99 × above ** 2;
}

computeCurrentWomInfluence(fixed, weeks, i) =
  computeRunningFilmStrength(fixed, weeks, i) × computeReceptionResponseMultiplier(fixed);
```

So `womInfluence` is "how many people saw it recently, as a fraction of everyone
who could ever want it, scaled by how much they liked it." It is a small number:
a film selling 8M tickets against a 60M interest ceiling with a 0.5 reception
multiplier gets `womInfluence ≈ 0.067`.

### 4.3 Interest growth

```ts
thresholdResponse(womInfluence, threshold, sensitivity) {
  const excess = max(0, womInfluence - threshold);
  return clamp(excess * excess * sensitivity, 0, 1);      // QUADRATIC
}

const NATURAL_INTEREST_RESPONSE = { threshold: 0.003, sensitivity: 55 };
const CROSSOVER_RESPONSE        = { threshold: 0.0075, sensitivity: 70 };
const AWARENESS_RESPONSE        = { threshold: 0.0,   sensitivity: 300 };   // currently unused

convertNewAwarenessToBaseInterest(fixed, newlyAware, totalEverInterested) {
  const naturalCeiling = baseInterestFraction × TAA;
  const headroom = max(0, naturalCeiling - totalEverInterested);
  return min(max(0, newlyAware) × baseInterestFraction, headroom);
}

deriveWomNaturalInterestGrowth(fixed, awareCount, totalEverInterested, wom) {
  const naturalCeiling = baseInterestFraction × TAA;
  const headroom = max(0, naturalCeiling - totalEverInterested);
  const awareNotYetInterested = max(0, awareCount - totalEverInterested);
  const growthFraction = thresholdResponse(wom, 0.003, 55);
  const saturationDampening = naturalCeiling > 0 ? headroom / naturalCeiling : 0;
  return min(headroom, awareNotYetInterested) × growthFraction × saturationDampening;
}

deriveWomCrossoverExpansion(fixed, awareCount, totalEverInterested, cumulativeCrossover, wom) {
  const crossoverCeiling = crossoverCapacityFraction × TAA;
  const headroom = max(0, crossoverCeiling - cumulativeCrossover);   // its OWN ceiling
  const awareNotYetInterested = max(0, awareCount - totalEverInterested);
  const growthFraction = thresholdResponse(wom, 0.0075, 70);
  const saturationDampening = crossoverCeiling > 0 ? headroom / crossoverCeiling : 0;
  return min(headroom, awareNotYetInterested) × growthFraction × saturationDampening;
}
```

The quadratic `thresholdResponse` is the model's main non-linearity: a film with
double the word-of-mouth gets four times the interest growth. Combined with the
squared reception multiplier, reception enters interest growth to the **fourth
power**.

### 4.4 Attendance and pull-forward

```ts
const PULL_FORWARD_RESPONSE = { threshold: 0.005, sensitivity: 100 };
const PULL_FORWARD_MAX_MULTIPLIER = 3;
const PULL_FORWARD_HALF_SATURATION = 0.15;
const PULL_FORWARD_AGE_HALF_LIFE_WEEKS = 8;

pullForwardUrgencySignal(wom) {
  const excess = max(0, wom - 0.005);
  return excess / (excess + 0.15);                        // saturating, not quadratic
}

pullForwardCeilingMultiplier(weekNumber, backlogFreshnessFactor) {
  const ageFactor = 8 / (8 + max(0, weekNumber - 1));
  const freshness = clamp(backlogFreshnessFactor, 0, 1);   // interestedRemaining / totalEverInterested
  return 1 + (3 - 1) × ageFactor × freshness;
}

applyWomPullForward(baseline, wom, weekNumber, freshness) {
  const urgency = pullForwardUrgencySignal(wom);
  const ceiling = baseline × pullForwardCeilingMultiplier(weekNumber, freshness);
  return clamp(baseline + urgency × (ceiling - baseline), 0, 1);
}

sellTicketsThisWeek(interestedRemaining, attendanceProbability) =
  interestedRemaining × clamp(attendanceProbability, 0, 1);
```

Two separate ticket-selling calls per week — the existing backlog attends at the
pull-forward-boosted probability; interest created *this* week attends at the
plain baseline:

```ts
const attentionFactor = clamp(1 - 0.55 × competitivePressure, 0.25, 1);
const ticketsFromExistingPool = sellTicketsThisWeek(priorWeek.interestedRemaining, attendanceProbability × attentionFactor);
const ticketsFromNewInterest  = sellTicketsThisWeek(newInterestThisWeek,          baselineAttendanceProbability × attentionFactor);
const unconstrainedDemand = ticketsFromExistingPool + ticketsFromNewInterest;
```

### 4.5 Exhibition access

```ts
const MAX_WEEKLY_THROUGHPUT_FRACTION = 0.5;
const ANCHOR_FLOOR_FRACTION = 0.1;
const AVAILABILITY_FLOOR = 0.02, AVAILABILITY_CEILING = 1.0;
const REFERENCE_UTILISATION = 1.0;
const AVAILABILITY_RESPONSE_SENSITIVITY = 0.5;
const MAX_AVAILABILITY_RATE_MAGNITUDE = 0.2;
const MAX_WEEKLY_EXPANSION_MULTIPLIER = 1.75;
const MAX_WEEKLY_EXPANSION_POINTS = 0.12;
const COMPETITIVE_PRESSURE_WEIGHT = 0.05;

computeAvailabilityAnchor(fixed, availabilityFraction) {
  const ceiling = maxInterestedAudience(fixed);
  const baseAnchor = max(fixed.initialAwareCount, 0.1 × ceiling);
  const expansionProgress = fixed.initialAvailabilityFraction < 1
    ? clamp((availabilityFraction - fixed.initialAvailabilityFraction) / (1 - fixed.initialAvailabilityFraction), 0, 1)
    : 0;
  return baseAnchor + expansionProgress × (ceiling - baseAnchor);
}

computeAvailabilityCapacity(fixed, availabilityFraction) =
  availabilityFraction × 0.5 × computeAvailabilityAnchor(fixed, availabilityFraction);

computeDemandUtilisation(demand, capacity) = capacity <= 0 ? (demand > 0 ? 100 : 0) : demand / capacity;

computeExpansionReceptionGate(fixed) {
  if (fixed.criticLedExpansionWeight <= 0) return 1;
  const festivalGate = criticScore <= 60 ? 0 : clamp(((criticScore - 60) / 40) ** 1.5, 0, 1);
  return 1 - fixed.criticLedExpansionWeight × (1 - festivalGate);
}

computeAvailabilityPerformanceAdjustment(fixed, utilisation) {
  const raw = (utilisation - 1.0) × 0.5;
  const gate = computeExpansionReceptionGate(fixed);
  return raw > 0 ? raw × gate : raw;
}

computeNextAvailability(fixed, current, utilisation, competitivePressure = 0) {
  const netRate = clamp(performanceAdjustment - availabilityBaseWeeklyDecay - 0.05 × competitivePressure, -0.2, 0.2);
  if (netRate >= 0) {
    const r = netRate / 0.2;
    return clamp(min(current × (1 + r × 0.75), current + r × 0.12), 0.02, 1.0);
  }
  return clamp(current - (current - 0.02) × -netRate, 0.02, 1.0);
}
```

The feedback loop is **one week lagged by construction**: this week's utilisation
sets *next* week's availability. It is the only mechanism by which a film's own
performance changes its future screen count.

### 4.6 Run termination

```ts
export const MAX_SIMULATION_WEEKS = 20;
const MIN_WEEKLY_ADMISSIONS_RATIO = 0.02;

hasSimulationEnded(weeks) {
  if (weeks.length === 0) return false;
  if (weeks.length >= 20) return true;
  const opening = deriveWeeklyAdmissions(weeks, 0);
  if (opening <= 0) return true;
  return deriveWeeklyAdmissions(weeks, weeks.length - 1) < opening × 0.02;
}
```

---

## 5. The money boundary

Exactly one line converts people to money:

```ts
export const AVERAGE_TICKET_PRICE = 11;
const worldwidePotentialGross = Math.round(diagnostics.weeklyAdmissions * AVERAGE_TICKET_PRICE);
```

Everything after that is accounting, in `distribution.ts`:

```ts
computeInternationalAppeal(genre) = clamp(GENRE_INTERNATIONAL_APPEAL[genre], 0, 0.95);

splitBoxOfficeGross(worldwide, appeal, reach, domesticKeep) {
  domesticGross              = worldwide × (1 - appeal);
  internationalPotentialGross = worldwide × appeal;
  internationalGross          = internationalPotentialGross × reach;
  headlineGross               = domesticGross + internationalGross;
  studioCredit                = domesticGross × domesticKeep + internationalGross × INTERNATIONAL_KEEP_SHARE;
}
```

| Constant | Value |
|---|--:|
| `DOMESTIC_KEEP_SHARE` | 0.46 |
| `INTERNATIONAL_KEEP_SHARE` | 0.38 |
| `GENRE_INTERNATIONAL_APPEAL` | Action 0.62, Sci-Fi 0.62, Fantasy 0.60, Thriller 0.55, Horror 0.52, Romance 0.50, Drama 0.45, Comedy 0.38 |
| `INTERNATIONAL_REACH_BY_TIER` | tier 0 → 0, 1 → 0.4, 2 → 0.7, 3 → 1.0 |
| `DISTRIBUTOR_FEE_RANGE` | 0.10 – 0.35 of rentals |
| `DISTRIBUTOR_BREADTH_RANGE` | 0.55 – 0.92 Wide availability ceiling |
| `DISTRIBUTOR_PANDA_RANGE` | $3M – $60M fronted, recouped in full off the top |
| `SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER` | tier 1 → 0.72, 2 → 0.85, 3 → 0.95 |

A distributor's P&A is recouped off the top of the studio's keep, first weeks
first. `profit = studioRevenue - totalCost`, computed only when the run finishes.

Note: the model has no separate international *audience*. International is a flat
percentage split of one worldwide admissions number. `BASE_ADDRESSABLE_POPULATION
= 200M` is explicitly a stand-in for the worldwide reachable audience, not a
domestic one.

---

## 6. Where the whole thing is driven from

`settleTheatricalMarket` is the unified market tick. It runs a loop that always
processes whichever event is due **soonest by real calendar day**:

1. a player's scheduled release becoming due,
2. a rival production's release day arriving,
3. an already-running film's next weekly settlement.

This ordering is what makes a film in week 3 feel a rival's week 1 the moment
that rival's first real week elapses, and guarantees a multi-week calendar jump
settles identically to the same span done week by week. Every step reads only
state settled *before* it runs.

Player films and rival films go through the **same** pipeline —
`resolvePlayerRelease` and `resolveRivalProduction` both end up calling
`computeReleaseResults` and producing the same `fixed` state. Rivals are not a
separate, cheaper model.

---

## 7. Competition — two channels

### 7.1 Crowding (the calendar)

```ts
const CROWDING_WINDOW_DAYS = 45;
const GENRE_MATCH_WEIGHT = 1.0;
const GENRE_MISMATCH_WEIGHT = 0.15;
const AUDIENCE_MATCH_BONUS = 0.3;

computeCompetitiveCrowding(candidate, known, candidateStrength?) {
  total = Σ over known:
    proximity     = max(0, 1 - |candidate.releaseDay - other.releaseDay| / 45);
    genreOverlap  = candidate.genre === other.genre ? 1.0 : 0.15;
    audienceBonus = candidate.targetAudience === other.targetAudience ? 0.3 : 0;
    proximity × (genreOverlap + audienceBonus) × other.strength × matchupWeight(candidateStrength, other.strength);
  return clamp(total, 0, 1);
}

matchupWeight(candidateStrength, otherStrength) {
  if (candidateStrength === undefined) return 1;            // candidate-blind fallback
  const combined = candidateStrength + otherStrength;
  if (combined <= 0) return 1;
  return clamp((2 × otherStrength) / combined, 0, 2);       // evenly matched → 1
}
```

A release's "strength" comes from one of three places:

```ts
computeRivalReleaseStrength(spend, scale, genreIdentity)   = clamp(0.7 × logT(spend, MARKETING_SPEND_RANGE) + 0.3 × SCALE_STRENGTH[scale] + 0.2 × (identity/100), 0, 1);
computePlayerReleaseStrength(spend, budget, genreIdentity) = clamp(0.7 × logT(spend, MARKETING_SPEND_RANGE) + 0.3 × logT(budget, {100_000, 200_000_000}) + 0.2 × (identity/100), 0, 1);
runningFilmAsUpcomingRelease(film).strength               = computeRunningFilmStrength(fixed, simWeeks, simWeeks.length);   // live WOM-based
```

`SCALE_STRENGTH` = Small 0.2, Medium 0.5, Big 0.9.

Crowding is consumed **once**, at release, denting `initialAvailabilityFraction`
by up to 50%.

### 7.2 Attention pressure (every week)

`competitivePressureOn(target, others)` recomputes crowding fresh every settled
week against every *other currently-running* film, using the target's own live
strength for the matchup. It feeds two places:

```ts
attentionFactor = clamp(1 - 0.55 × competitivePressure, 0.25, 1);     // suppresses demand
netRate = clamp(performanceAdjustment - baseDecay - 0.05 × competitivePressure, -0.2, 0.2);   // accelerates screen loss
```

**Measured, in the two runs below: mean competitive pressure across 862 settled
film-weeks is 0.0311 — an attention factor of 0.983. The p90 is 0.081 and the
single worst film-week in either run reached 0.554. Only 7.4% of film-weeks
exceeded 0.10.** In practice competition is currently close to inert, which is
exactly what §7 of the calibration targets document predicted.

---

## 8. Two simulated runs, two in-game years each

**Harness.** `src/engine/boxOfficeBriefingTrace.diagnostic.test.ts` drives the
real settlement loop headlessly for 730 in-game days, exactly as the game's own
reducer does: rival studios bid on opportunities, greenlight productions, pick
release days against the shared calendar, release, and settle week by week
against each other. Reproduce with:

```bash
BOX_OFFICE_TRACE=1 npx vitest run src/engine/boxOfficeBriefingTrace.diagnostic.test.ts \
  --disable-console-intercept 2>&1 \
  | sed -n '/BEGIN_TRACE_JSON/,/END_TRACE_JSON/p' | sed '1d;$d' > trace.json
```

Two seeds: **4001** and **7302**. Every film in these runs is an AI studio's —
the harness has no player — but rival and player films go through an identical
pipeline (§6), so the distributions are the same ones a player competes inside.
All figures are worldwide gross unless stated.

**Read these two runs alongside §9.2, not instead of it.** These are the first
two years of a world, so they are dominated by small early-game studios with
little cash and a heavy Limited/Festival First mix — the medians here are lower
than the steady-state 6-seed × 8-year figures in §9.2. Their value is that they
show the *mechanism* week by week and film by film, including who was on screens
against whom.


### 8.1 Per-film results

#### Run 4001 — headline numbers

| | |
|---|--:|
| Films completing their run in 2 years | 33 |
| Median worldwide gross | $30.4M |
| Mean worldwide gross | $102.7M |
| Min / max worldwide gross | $2.2M / $447.1M |
| Profitable | 58% |
| Mean run length | 11.5 weeks |
| Median return multiple (studio cash ÷ all-in cost) | 1.03x |

| Release type | n | median WW | mean WW | mean weeks | mean opening multiple | profitable |
|---|--:|--:|--:|--:|--:|--:|
| Wide | 21 | $90.9M | $150.4M | 6.6 | 2.2x | 67% |
| Limited | 4 | $20.0M | $21.6M | 20.0 | 12.2x | 25% |
| Festival First | 8 | $9.9M | $18.3M | 20.0 | 22.9x | 50% |

#### Run 4001 — every finished film

| # | Date | Studio | Title | Genre | Audience | Type | Window | Budget $M | Mktg $M | Critic | Aud | Buzz | TAA M | baseInt | cross | pacing | avail₀ | aware₀ M | Wk1 $M | Total $M | Wks | Peak pressure | Return | Outcome |
|--:|---|---|---|---|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| 1 | Y1 June 26 | IFC Films | The Confession | Thriller | Adults | Festival First | Summer | 4.2 | 0.06 | 59 | 61 | 21 | 90 | 0.123 | 0.110 | 0.064 | 0.020 | 2.96 | 0.3 | 6.8 | 20 | 0.000 | 0.67x | Weak |
| 2 | Y1 August 14 | STX Entertainment | Deadlock | Thriller | Teens | Festival First | Summer | 1.4 | 0.03 | 56 | 59 | 0 | 96 | 0.106 | 0.112 | 0.058 | 0.020 | 1.48 | 0.2 | 4.7 | 20 | 0.004 | 1.39x | Modest Success |
| 3 | Y1 August 27 | Blumhouse Productions | Otieno's Vigil | Drama | Mass Market | Wide | Summer | 0.7 | 0.01 | 41 | 42 | 0 | 90 | 0.180 | 0.052 | 0.713 | 0.501 | 0.49 | 3.5 | 9.5 | 9 | 0.002 | 5.53x | Hit |
| 4 | Y1 October 1 | Searchlight Pictures | Attic of the Buried | Horror | Teens | Wide | Halloween | 2.2 | 0.02 | 51 | 61 | 14 | 88 | 0.131 | 0.142 | 1.000 | 0.386 | 0.79 | 3.9 | 7.1 | 7 | 0.021 | 1.34x | Modest Success |
| 5 | Y1 October 5 | New Line Cinema | Feral Sanatorium | Horror | Adults | Festival First | Halloween | 5.2 | 1.33 | 56 | 71 | 35 | 82 | 0.135 | 0.116 | 0.089 | 0.020 | 8.15 | 0.9 | 14.9 | 20 | 0.024 | 1.02x | Weak |
| 6 | Y1 November 5 | DreamWorks Pictures | The Ridiculous Heist | Comedy | Mass Market | Wide | Christmas | 11.4 | 0.65 | 60 | 63 | 52 | 130 | 0.293 | 0.142 | 1.000 | 0.545 | 11.25 | 33.7 | 60.5 | 6 | 0.007 | 2.14x | Hit |
| 7 | Y1 November 18 | Orion Pictures | Bonnie Lozano | Romance | Adults | Wide | Christmas | 3.9 | 0.61 | 61 | 59 | 42 | 75 | 0.102 | 0.100 | 1.000 | 0.546 | 5.86 | 8.4 | 11.3 | 6 | 0.007 | 1.03x | Weak |
| 8 | Y1 November 29 | TriStar Pictures | The Surveillance | Thriller | Teens | Wide | Christmas | 5.4 | 0.34 | 59 | 56 | 40 | 96 | 0.158 | 0.136 | 0.891 | 0.507 | 5.88 | 12.5 | 18.5 | 6 | 0.007 | 1.33x | Modest Success |
| 9 | Y1 December 30 | DreamWorks Pictures | Kian Fujimori | Thriller | Adults | Limited | Christmas | 9.9 | 2.95 | 58 | 70 | 43 | 90 | 0.113 | 0.133 | 0.087 | 0.097 | 15.18 | 1.8 | 20.0 | 20 | 0.008 | 0.73x | Weak |
| 10 | Y2 January 12 | New Line Cinema | After the Payback | Action | Mass Market | Wide | Awards Season | 9.5 | 1.72 | 52 | 54 | 21 | 150 | 0.167 | 0.203 | 0.685 | 0.551 | 18.16 | 26.8 | 46.1 | 6 | 0.003 | 1.64x | Hit |
| 11 | Y2 January 20 | Blumhouse Productions | Estrangement | Drama | Mass Market | Festival First | Awards Season | 3.6 | 0.03 | 43 | 52 | 18 | 90 | 0.185 | 0.059 | 0.074 | 0.018 | 2.20 | 0.2 | 9.9 | 20 | 0.158 | 1.15x | Modest Success |
| 12 | Y2 February 17 | Sony Pictures | Grimhold: Last Realm | Fantasy | Mass Market | Wide | Awards Season | 73.4 | 36.31 | 52 | 72 | 91 | 124 | 0.322 | 0.150 | 0.901 | 0.699 | 56.15 | 184.9 | 447.1 | 6 | 0.012 | 1.57x | Blockbuster |
| 13 | Y2 February 27 | TriStar Pictures | The Lingering Harvest | Drama | Critics | Limited | Awards Season | 17.9 | 4.45 | 60 | 71 | 64 | 50 | 0.125 | 0.091 | 0.107 | 0.093 | 9.40 | 1.5 | 14.5 | 20 | 0.116 | 0.31x | Flop |
| 14 | Y2 February 28 | New Line Cinema | The Perfect Countdown | Thriller | Adults | Wide | Awards Season | 24.0 | 4.43 | 63 | 69 | 55 | 90 | 0.138 | 0.149 | 0.871 | 0.606 | 17.85 | 25.1 | 82.1 | 9 | 0.077 | 1.16x | Modest Success |
| 15 | Y2 April 13 | STX Entertainment | The Summer | Romance | Adults | Festival First | Quiet Month | 2.0 | 0.01 | 37 | 42 | 10 | 75 | 0.180 | 0.047 | 0.045 | 0.018 | 0.71 | 0.2 | 4.8 | 20 | 0.006 | 1.03x | Weak |
| 16 | Y2 April 14 | Sony Pictures | The Legend | Fantasy | Mass Market | Limited | Quiet Month | 16.2 | 5.93 | 56 | 59 | 60 | 124 | 0.155 | 0.211 | 0.066 | 0.096 | 32.40 | 4.0 | 48.2 | 20 | 0.001 | 1.04x | Weak |
| 17 | Y2 April 15 | IFC Films | The Perfect Trigger | Thriller | Niche | Festival First | Quiet Month | 1.7 | 0.02 | 60 | 63 | 1 | 48 | 0.122 | 0.083 | 0.043 | 0.019 | 0.65 | 0.1 | 2.2 | 20 | 0.007 | 0.54x | Weak |
| 18 | Y2 April 18 | DreamWorks Pictures | The Final Reckoning | Action | Critics | Festival First | Quiet Month | 7.9 | 1.89 | 56 | 63 | 35 | 82 | 0.142 | 0.128 | 0.050 | 0.020 | 10.41 | 1.0 | 14.2 | 20 | 0.003 | 0.63x | Weak |
| 19 | Y2 June 2 | Orion Pictures | Warzone of the Doomed | Action | Adults | Wide | Summer | 29.1 | 4.10 | 61 | 71 | 55 | 112 | 0.182 | 0.179 | 1.000 | 0.306 | 18.63 | 31.3 | 98.3 | 9 | 0.342 | 1.19x | Modest Success |
| 20 | Y2 June 3 | TriStar Pictures | The Siege of the Damned | Action | Critics | Wide | Summer | 10.2 | 1.15 | 57 | 69 | 33 | 82 | 0.168 | 0.138 | 1.000 | 0.438 | 7.58 | 16.8 | 26.3 | 6 | 0.315 | 0.93x | Weak |
| 21 | Y2 June 3 | Paramount Pictures | Ironwild | Fantasy | Teens | Wide | Summer | 16.9 | 12.98 | 41 | 64 | 56 | 99 | 0.353 | 0.127 | 1.000 | 0.344 | 28.73 | 54.3 | 175.0 | 8 | 0.554 | 2.22x | Hit |
| 22 | Y2 June 5 | Sony Pictures | Singularity of the Void | Sci-Fi | Families | Wide | Summer | 24.8 | 24.27 | 53 | 56 | 98 | 116 | 0.261 | 0.140 | 1.000 | 0.652 | 47.89 | 140.2 | 229.8 | 6 | 0.093 | 1.75x | Hit |
| 23 | Y2 June 7 | Paramount Pictures | Grimhold | Fantasy | Adults | Wide | Summer | 86.3 | 47.06 | 46 | 63 | 62 | 93 | 0.358 | 0.146 | 1.000 | 0.479 | 44.81 | 118.1 | 300.0 | 7 | 0.232 | 0.87x | Weak |
| 24 | Y2 June 16 | 20th Century Studios | Citadel of the Fae | Fantasy | Mass Market | Wide | Summer | 25.7 | 16.66 | 47 | 64 | 70 | 124 | 0.321 | 0.191 | 1.000 | 0.491 | 41.32 | 111.7 | 265.9 | 7 | 0.488 | 2.40x | Blockbuster |
| 25 | Y2 July 15 | Orion Pictures | Cursed Orchard | Horror | Teens | Wide | Summer | 10.7 | 1.80 | 57 | 50 | 45 | 88 | 0.180 | 0.152 | 0.873 | 0.428 | 11.06 | 22.3 | 30.4 | 5 | 0.238 | 0.99x | Weak |
| 26 | Y2 July 16 | 20th Century Studios | Vendetta | Action | Mass Market | Wide | Summer | 21.9 | 6.63 | 49 | 61 | 74 | 150 | 0.404 | 0.194 | 1.000 | 0.525 | 37.39 | 107.9 | 245.3 | 6 | 0.073 | 3.37x | Blockbuster |
| 27 | Y2 July 19 | Searchlight Pictures | Provenance | Drama | Critics | Limited | Summer | 2.8 | 0.06 | 71 | 58 | 4 | 50 | 0.113 | 0.108 | 0.070 | 0.076 | 1.62 | 0.2 | 3.7 | 20 | 0.142 | 0.55x | Weak |
| 28 | Y2 July 23 | Orion Pictures | The Alibi of the Silent | Thriller | Critics | Wide | Summer | 8.1 | 0.83 | 60 | 72 | 34 | 66 | 0.144 | 0.111 | 0.835 | 0.471 | 5.95 | 9.6 | 20.7 | 7 | 0.096 | 0.95x | Weak |
| 29 | Y2 July 24 | Walt Disney Pictures | Iron and Light | Sci-Fi | Adults | Festival First | Summer | 238.4 | 146.53 | 54 | 69 | 85 | 102 | 0.120 | 0.190 | 0.106 | 0.018 | 70.11 | 6.9 | 88.7 | 20 | 0.097 | 0.11x | Flop |
| 30 | Y2 August 2 | 20th Century Studios | Thornwood | Fantasy | Teens | Wide | Summer | 65.7 | 36.14 | 45 | 66 | 88 | 99 | 0.343 | 0.165 | 1.000 | 0.601 | 49.12 | 162.5 | 360.4 | 6 | 0.410 | 1.36x | Modest Success |
| 31 | Y2 August 22 | Paramount Pictures | Warpath | Action | Niche | Wide | Summer | 34.7 | 23.02 | 47 | 62 | 60 | 60 | 0.172 | 0.129 | 1.000 | 0.663 | 24.79 | 47.7 | 90.9 | 6 | 0.108 | 0.60x | Weak |
| 32 | Y2 August 29 | 20th Century Studios | The Ancient Kingdom | Fantasy | Families | Wide | Summer | 101.4 | 47.16 | 49 | 69 | 95 | 105 | 0.317 | 0.129 | 1.000 | 0.736 | 60.71 | 199.8 | 383.0 | 5 | 0.137 | 1.00x | Weak |
| 33 | Y2 November 1 | Paramount Pictures | The Broken Wilds | Fantasy | Adults | Wide | Christmas | 73.4 | 49.04 | 57 | 69 | 80 | 93 | 0.138 | 0.192 | 1.000 | 0.753 | 50.22 | 78.1 | 249.0 | 6 | 0.003 | 0.78x | Weak |

#### Run 7302 — headline numbers

| | |
|---|--:|
| Films completing their run in 2 years | 36 |
| Median worldwide gross | $22.1M |
| Mean worldwide gross | $69.4M |
| Min / max worldwide gross | $4.1M / $646.3M |
| Profitable | 36% |
| Mean run length | 13.4 weeks |
| Median return multiple (studio cash ÷ all-in cost) | 0.81x |

| Release type | n | median WW | mean WW | mean weeks | mean opening multiple | profitable |
|---|--:|--:|--:|--:|--:|--:|
| Wide | 18 | $28.8M | $108.9M | 6.8 | 2.2x | 44% |
| Limited | 7 | $19.7M | $20.8M | 20.0 | 12.6x | 29% |
| Festival First | 11 | $16.0M | $35.7M | 20.0 | 25.6x | 27% |

#### Run 7302 — every finished film

| # | Date | Studio | Title | Genre | Audience | Type | Window | Budget $M | Mktg $M | Critic | Aud | Buzz | TAA M | baseInt | cross | pacing | avail₀ | aware₀ M | Wk1 $M | Total $M | Wks | Peak pressure | Return | Outcome |
|--:|---|---|---|---|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| 1 | Y1 July 31 | Searchlight Pictures | The Homecoming | Drama | Mass Market | Festival First | Summer | 1.8 | 0.02 | 42 | 61 | 2 | 90 | 0.218 | 0.058 | 0.058 | 0.018 | 0.86 | 0.2 | 8.2 | 20 | 0.029 | 1.90x | Hit |
| 2 | Y1 August 12 | STX Entertainment | Nightfall: Hushed Letters | Drama | Families | Wide | Summer | 4.2 | 0.09 | 58 | 69 | 2 | 76 | 0.133 | 0.136 | 0.719 | 0.504 | 2.37 | 4.2 | 8.7 | 8 | 0.005 | 0.85x | Weak |
| 3 | Y1 August 31 | Amblin Entertainment | Money and Mayhem | Comedy | Adults | Festival First | Summer | 11.1 | 0.46 | 55 | 53 | 38 | 98 | 0.159 | 0.129 | 0.069 | 0.020 | 7.95 | 0.9 | 16.4 | 20 | 0.002 | 0.61x | Weak |
| 4 | Y1 October 1 | Focus Features | Blight | Horror | Mass Market | Festival First | Halloween | 1.1 | 0.01 | 39 | 50 | 8 | 110 | 0.201 | 0.058 | 0.079 | 0.013 | 0.41 | 0.2 | 9.7 | 20 | 0.039 | 3.60x | Hit |
| 5 | Y1 October 1 | Lionsgate | Beyond the Nursery | Horror | Mass Market | Limited | Halloween | 4.8 | 0.31 | 56 | 67 | 42 | 110 | 0.296 | 0.122 | 0.110 | 0.093 | 7.08 | 3.4 | 36.6 | 20 | 0.013 | 3.08x | Hit |
| 6 | Y1 October 6 | A24 | Nightfall | Horror | Mass Market | Limited | Halloween | 1.6 | 0.01 | 49 | 62 | 4 | 110 | 0.136 | 0.140 | 0.093 | 0.095 | 0.23 | 0.4 | 6.9 | 20 | 0.046 | 1.82x | Hit |
| 7 | Y1 November 2 | 20th Century Studios | The Oath | Fantasy | Adults | Festival First | Christmas | 15.2 | 12.07 | 61 | 58 | 69 | 93 | 0.138 | 0.172 | 0.101 | 0.018 | 27.17 | 2.6 | 41.1 | 20 | 0.029 | 0.71x | Weak |
| 8 | Y1 November 4 | TriStar Pictures | Sunlit | Romance | Critics | Wide | Christmas | 9.0 | 1.96 | 67 | 64 | 43 | 55 | 0.124 | 0.099 | 1.000 | 0.559 | 7.73 | 12.1 | 26.2 | 7 | 0.006 | 0.97x | Weak |
| 9 | Y1 November 17 | Lionsgate | The Sanatorium | Horror | Niche | Wide | Christmas | 6.1 | 1.19 | 56 | 61 | 37 | 44 | 0.137 | 0.108 | 0.882 | 0.521 | 4.21 | 6.8 | 10.5 | 6 | 0.013 | 0.58x | Weak |
| 10 | Y1 November 25 | Lionsgate | Misfire | Comedy | Adults | Limited | Christmas | 8.8 | 0.64 | 60 | 58 | 24 | 98 | 0.171 | 0.144 | 0.089 | 0.070 | 7.87 | 1.7 | 19.7 | 20 | 0.041 | 0.93x | Weak |
| 11 | Y1 December 13 | TriStar Pictures | Dust and Shadow | Thriller | Teens | Wide | Christmas | 10.0 | 0.77 | 50 | 66 | 28 | 96 | 0.139 | 0.117 | 0.848 | 0.362 | 8.18 | 13.3 | 21.2 | 6 | 0.021 | 0.81x | Weak |
| 12 | Y1 December 16 | Castle Rock Entertainment | Blackout | Thriller | Mass Market | Festival First | Christmas | 7.2 | 0.40 | 50 | 56 | 21 | 120 | 0.223 | 0.092 | 0.066 | 0.015 | 8.34 | 0.7 | 24.8 | 20 | 0.092 | 1.37x | Modest Success |
| 13 | Y1 December 21 | Amblin Entertainment | Questionable Reunion | Comedy | Critics | Festival First | Christmas | 10.1 | 2.31 | 61 | 70 | 56 | 72 | 0.136 | 0.104 | 0.084 | 0.012 | 10.04 | 0.7 | 16.0 | 20 | 0.078 | 0.58x | Weak |
| 14 | Y1 December 26 | Paramount Pictures | Questionable Makeover | Comedy | Niche | Limited | Christmas | 47.9 | 14.06 | 68 | 72 | 88 | 52 | 0.154 | 0.094 | 0.114 | 0.092 | 16.86 | 3.4 | 34.4 | 20 | 0.042 | 0.27x | Flop |
| 15 | Y1 December 28 | TriStar Pictures | Endless Goodbye | Romance | Adults | Festival First | Christmas | 13.4 | 1.41 | 65 | 66 | 29 | 75 | 0.115 | 0.105 | 0.083 | 0.019 | 8.91 | 0.9 | 12.7 | 20 | 0.053 | 0.37x | Flop |
| 16 | Y2 January 15 | Castle Rock Entertainment | The Confession of the Guilty | Thriller | Critics | Limited | Awards Season | 11.4 | 1.68 | 66 | 61 | 56 | 66 | 0.104 | 0.092 | 0.084 | 0.092 | 8.68 | 1.0 | 10.9 | 20 | 0.094 | 0.37x | Flop |
| 17 | Y2 January 25 | 20th Century Studios | Steel and Dust | Action | Mass Market | Wide | Awards Season | 107.0 | 56.16 | 59 | 69 | 95 | 150 | 0.164 | 0.251 | 0.915 | 0.720 | 76.92 | 130.2 | 494.8 | 7 | 0.035 | 1.16x | Modest Success |
| 18 | Y2 February 15 | Amblin Entertainment | Whispering Hollow | Horror | Adults | Limited | Awards Season | 16.0 | 1.29 | 57 | 58 | 51 | 82 | 0.145 | 0.156 | 0.075 | 0.091 | 8.50 | 1.2 | 15.4 | 20 | 0.084 | 0.39x | Flop |
| 19 | Y2 February 27 | Paramount Pictures | The Deception | Thriller | Mass Market | Wide | Awards Season | 65.7 | 9.00 | 60 | 72 | 71 | 120 | 0.132 | 0.128 | 0.924 | 0.632 | 35.25 | 49.6 | 211.1 | 8 | 0.032 | 1.15x | Modest Success |
| 20 | Y2 February 28 | Paramount Pictures | Fausto Gopalakrishnan | Sci-Fi | Teens | Wide | Awards Season | 18.2 | 12.41 | 54 | 66 | 54 | 109 | 0.164 | 0.196 | 0.789 | 0.676 | 31.21 | 46.5 | 111.1 | 8 | 0.065 | 1.38x | Modest Success |
| 21 | Y2 April 17 | Castle Rock Entertainment | The Countdown | Thriller | Adults | Limited | Quiet Month | 36.2 | 3.27 | 66 | 57 | 50 | 90 | 0.140 | 0.124 | 0.064 | 0.096 | 15.81 | 1.7 | 22.1 | 20 | 0.002 | 0.24x | Flop |
| 22 | Y2 April 22 | Warner Bros. Pictures | Freeloaders | Comedy | Mass Market | Festival First | Quiet Month | 17.7 | 5.38 | 63 | 71 | 80 | 130 | 0.130 | 0.153 | 0.059 | 0.020 | 32.29 | 3.0 | 38.4 | 20 | 0.006 | 0.77x | Weak |
| 23 | Y2 June 2 | STX Entertainment | After the Genesis | Sci-Fi | Adults | Wide | Summer | 1.6 | 0.03 | 49 | 60 | 0 | 102 | 0.145 | 0.178 | 0.927 | 0.254 | 0.88 | 4.6 | 9.1 | 8 | 0.480 | 2.26x | Hit |
| 24 | Y2 June 4 | Searchlight Pictures | Feral Attic | Horror | Adults | Festival First | Summer | 2.8 | 0.05 | 58 | 56 | 3 | 82 | 0.105 | 0.104 | 0.058 | 0.015 | 1.38 | 0.1 | 4.1 | 20 | 0.238 | 0.59x | Weak |
| 25 | Y2 June 5 | Warner Bros. Pictures | Beneath the Kingdom | Fantasy | Niche | Wide | Summer | 58.3 | 58.47 | 62 | 69 | 78 | 50 | 0.130 | 0.122 | 1.000 | 0.698 | 25.86 | 37.9 | 100.8 | 6 | 0.020 | 0.32x | Flop |
| 26 | Y2 June 5 | 20th Century Studios | Beneath the Protocol | Sci-Fi | Teens | Wide | Summer | 18.7 | 15.69 | 49 | 67 | 78 | 109 | 0.154 | 0.172 | 1.000 | 0.667 | 37.21 | 64.6 | 155.0 | 7 | 0.112 | 1.70x | Hit |
| 27 | Y2 June 7 | TriStar Pictures | The Final Witness | Thriller | Adults | Wide | Summer | 7.2 | 0.45 | 61 | 56 | 30 | 90 | 0.127 | 0.129 | 0.821 | 0.512 | 5.83 | 8.6 | 14.3 | 7 | 0.180 | 0.76x | Weak |
| 28 | Y2 June 7 | A24 | The Fleeting Chance | Romance | Critics | Wide | Summer | 4.7 | 0.05 | 56 | 65 | 16 | 55 | 0.113 | 0.102 | 0.771 | 0.472 | 1.77 | 2.7 | 5.5 | 8 | 0.188 | 0.48x | Flop |
| 29 | Y2 July 6 | Focus Features | Countdown | Thriller | Adults | Wide | Summer | 1.0 | 0.01 | 59 | 51 | 0 | 90 | 0.130 | 0.114 | 0.713 | 0.443 | 1.33 | 3.4 | 8.2 | 8 | 0.097 | 3.50x | Hit |
| 30 | Y2 July 14 | Amblin Entertainment | Sena Tierney | Comedy | Critics | Festival First | Summer | 20.7 | 1.07 | 65 | 64 | 29 | 72 | 0.183 | 0.136 | 0.066 | 0.018 | 7.45 | 0.7 | 15.4 | 20 | 0.127 | 0.31x | Flop |
| 31 | Y2 July 18 | 20th Century Studios | Extraction: Merciless Protocol | Action | Mass Market | Wide | Summer | 68.6 | 24.74 | 51 | 69 | 97 | 150 | 0.393 | 0.172 | 1.000 | 0.688 | 68.35 | 258.6 | 646.3 | 5 | 0.004 | 2.70x | Blockbuster |
| 32 | Y2 July 20 | Warner Bros. Pictures | Under the Eclipse | Sci-Fi | Teens | Festival First | Summer | 96.8 | 86.69 | 51 | 62 | 70 | 109 | 0.325 | 0.134 | 0.101 | 0.018 | 62.12 | 6.2 | 206.1 | 20 | 0.122 | 0.54x | Weak |
| 33 | Y2 August 17 | TriStar Pictures | Ice and Smoke | Thriller | Adults | Wide | Summer | 7.6 | 1.24 | 54 | 68 | 21 | 90 | 0.187 | 0.156 | 0.786 | 0.496 | 8.58 | 16.9 | 28.8 | 6 | 0.038 | 1.31x | Modest Success |
| 34 | Y2 August 30 | Universal Pictures | Forgotten Anomaly | Sci-Fi | Niche | Wide | Summer | 23.0 | 11.70 | 59 | 59 | 71 | 54 | 0.130 | 0.143 | 1.000 | 0.437 | 15.84 | 23.9 | 41.2 | 6 | 0.048 | 0.46x | Flop |
| 35 | Y2 October 3 | Lionsgate | The Basement | Horror | Teens | Wide | Halloween | 16.9 | 1.68 | 56 | 67 | 33 | 88 | 0.159 | 0.138 | 1.000 | 0.489 | 11.30 | 23.1 | 40.8 | 6 | 0.010 | 0.91x | Weak |
| 36 | Y2 November 22 | Lionsgate | Blood and Dust | Thriller | Critics | Wide | Christmas | 21.9 | 4.14 | 49 | 64 | 59 | 66 | 0.113 | 0.134 | 0.963 | 0.594 | 13.62 | 17.9 | 26.9 | 6 | 0.016 | 0.42x | Flop |

### 8.2 Week-by-week traces (run 4001)

These show the internal state of the simulation, not just the money — awareness,
interest backlog, availability, crossover and competitive pressure per week.


#### Biggest hit of the run (Wide) — *Grimhold: Last Realm* (Sony Pictures)

Fantasy / Mass Market / Wide / Awards Season, released Year 2, February 17.  
Critic 52, audience 72, buzz 91, quality 55.  
Budget $73.4M + marketing $36.31M = all-in $117.0M.  
Fixed state: TAA 124M, baseInterestFraction 0.3223 (40.0M people), crossoverCapacityFraction 0.1502 (18.6M), conversionPacingBaseline 0.9006, marketingEfficiency 0.790, externalWeeklyAwarenessRate 0.0269, initialAwareCount 56.15M, initialAvailabilityFraction 0.6986, availabilityBaseWeeklyDecay 0.18, criticLedExpansionWeight 0.  
Result: $447.1M worldwide over 6 weeks; studio cash $184.2M; profit $67.2M; **Blockbuster**.

| Wk | Gross $M | Dom $M | Intl $M | Admissions M | Aware M | Interested remaining M | Cum. tickets M | Availability | Cum. crossover M | Competitive pressure |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1 | 184.94 | 73.98 | 110.97 | 16.813 | 57.97 | 1.869 | 16.813 | 0.5629 | 0.000 | 0.0012 |
| 2 | 162.19 | 64.88 | 97.31 | 14.745 | 58.95 | 1.507 | 31.558 | 0.4543 | 9.288 | 0.0001 |
| 3 | 74.58 | 29.83 | 44.75 | 6.780 | 59.47 | 0.710 | 38.338 | 0.3674 | 13.969 | 0.0034 |
| 4 | 19.66 | 7.86 | 11.80 | 1.787 | 59.76 | 0.194 | 40.125 | 0.2979 | 15.133 | 0.0052 |
| 5 | 4.73 | 1.89 | 2.84 | 0.430 | 59.92 | 0.049 | 40.555 | 0.2424 | 15.418 | 0.0077 |
| 6 | 1.01 | 0.40 | 0.61 | 0.092 | 60.01 | 0.011 | 40.647 | 0.1979 | 15.471 | 0.0116 |

#### Median Wide release — *Warpath* (Paramount Pictures)

Action / Niche / Wide / Summer, released Year 2, August 22.  
Critic 47, audience 62, buzz 60, quality 45.  
Budget $34.7M + marketing $23.02M = all-in $62.3M.  
Fixed state: TAA 60M, baseInterestFraction 0.1718 (10.3M people), crossoverCapacityFraction 0.1292 (7.8M), conversionPacingBaseline 1.0000, marketingEfficiency 0.867, externalWeeklyAwarenessRate 0.0280, initialAwareCount 24.79M, initialAvailabilityFraction 0.6631, availabilityBaseWeeklyDecay 0.18, criticLedExpansionWeight 0.  
Result: $90.9M worldwide over 6 weeks; studio cash $37.3M; profit $-25.0M; **Weak**.

| Wk | Gross $M | Dom $M | Intl $M | Admissions M | Aware M | Interested remaining M | Cum. tickets M | Availability | Cum. crossover M | Competitive pressure |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1 | 47.75 | 18.14 | 29.60 | 4.341 | 25.77 | 0.086 | 4.341 | 0.5345 | 0.000 | 0.0355 |
| 2 | 18.23 | 6.93 | 11.30 | 1.658 | 26.30 | 0.021 | 5.998 | 0.4316 | 1.073 | 0.0227 |
| 3 | 13.75 | 5.22 | 8.52 | 1.250 | 26.58 | 0.048 | 7.248 | 0.3493 | 2.029 | 0.0668 |
| 4 | 7.27 | 2.76 | 4.51 | 0.661 | 26.74 | 0.042 | 7.909 | 0.2834 | 2.554 | 0.1077 |
| 5 | 3.14 | 1.19 | 1.95 | 0.286 | 26.83 | 0.012 | 8.195 | 0.2307 | 2.762 | 0.0728 |
| 6 | 0.77 | 0.29 | 0.48 | 0.070 | 26.87 | 0.002 | 8.266 | 0.1886 | 2.806 | 0.0422 |

#### Worst Wide release — *Attic of the Buried* (Searchlight Pictures)

Horror / Teens / Wide / Halloween, released Year 1, October 1.  
Critic 51, audience 61, buzz 14, quality 46.  
Budget $2.2M + marketing $0.02M = all-in $2.2M.  
Fixed state: TAA 88M, baseInterestFraction 0.1308 (11.5M people), crossoverCapacityFraction 0.1420 (12.5M), conversionPacingBaseline 1.0000, marketingEfficiency 0.475, externalWeeklyAwarenessRate 0.0221, initialAwareCount 0.79M, initialAvailabilityFraction 0.3860, availabilityBaseWeeklyDecay 0.18, criticLedExpansionWeight 0.  
Result: $7.1M worldwide over 7 weeks; studio cash $3.0M; profit $0.8M; **Modest Success**.

| Wk | Gross $M | Dom $M | Intl $M | Admissions M | Aware M | Interested remaining M | Cum. tickets M | Availability | Cum. crossover M | Competitive pressure |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1 | 3.92 | 1.88 | 2.04 | 0.356 | 2.72 | 0.000 | 0.356 | 0.3128 | 0.000 | 0.0002 |
| 2 | 1.49 | 0.72 | 0.78 | 0.136 | 3.76 | 0.000 | 0.492 | 0.2542 | 0.000 | 0.0015 |
| 3 | 0.81 | 0.39 | 0.42 | 0.074 | 4.33 | 0.000 | 0.566 | 0.2074 | 0.000 | 0.0045 |
| 4 | 0.44 | 0.21 | 0.23 | 0.040 | 4.63 | 0.000 | 0.606 | 0.1699 | 0.000 | 0.0083 |
| 5 | 0.24 | 0.12 | 0.13 | 0.022 | 4.80 | 0.000 | 0.628 | 0.1399 | 0.000 | 0.0122 |
| 6 | 0.13 | 0.06 | 0.07 | 0.012 | 4.89 | 0.000 | 0.640 | 0.1159 | 0.000 | 0.0156 |
| 7 | 0.07 | 0.04 | 0.04 | 0.007 | 4.95 | 0.000 | 0.647 | 0.0968 | 0.000 | 0.0210 |

#### Best Limited release (platform shape) — *The Legend* (Sony Pictures)

Fantasy / Mass Market / Limited / Quiet Month, released Year 2, April 14.  
Critic 56, audience 59, buzz 60, quality 52.  
Budget $16.2M + marketing $5.93M = all-in $19.1M.  
Fixed state: TAA 124M, baseInterestFraction 0.1553 (19.3M people), crossoverCapacityFraction 0.2115 (26.2M), conversionPacingBaseline 0.0664, marketingEfficiency 0.860, externalWeeklyAwarenessRate 0.0279, initialAwareCount 32.40M, initialAvailabilityFraction 0.0956, availabilityBaseWeeklyDecay 0.02, criticLedExpansionWeight 0.  
Result: $48.2M worldwide over 20 weeks; studio cash $19.9M; profit $0.7M; **Weak**.

| Wk | Gross $M | Dom $M | Intl $M | Admissions M | Aware M | Interested remaining M | Cum. tickets M | Availability | Cum. crossover M | Competitive pressure |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1 | 3.96 | 1.59 | 2.38 | 0.360 | 34.96 | 5.069 | 0.360 | 0.0805 | 0.000 | 0.0001 |
| 2 | 3.86 | 1.54 | 2.31 | 0.351 | 36.33 | 4.931 | 0.711 | 0.0684 | 0.000 | 0.0005 |
| 3 | 3.68 | 1.47 | 2.21 | 0.335 | 37.07 | 4.711 | 1.046 | 0.0587 | 0.000 | 0.0008 |
| 4 | 3.48 | 1.39 | 2.09 | 0.317 | 37.47 | 4.457 | 1.363 | 0.0510 | 0.000 | 0.0010 |
| 5 | 3.28 | 1.31 | 1.97 | 0.298 | 37.69 | 4.194 | 1.660 | 0.0448 | 0.000 | 0.0011 |
| 6 | 3.07 | 1.23 | 1.84 | 0.279 | 37.81 | 3.933 | 1.940 | 0.0398 | 0.000 | 0.0012 |
| 7 | 2.88 | 1.15 | 1.73 | 0.262 | 37.88 | 3.682 | 2.202 | 0.0359 | 0.000 | 0.0012 |
| 8 | 2.69 | 1.08 | 1.61 | 0.245 | 37.91 | 3.443 | 2.446 | 0.0327 | 0.000 | 0.0012 |
| 9 | 2.51 | 1.01 | 1.51 | 0.229 | 37.93 | 3.217 | 2.675 | 0.0301 | 0.000 | 0.0012 |
| 10 | 2.35 | 0.94 | 1.41 | 0.214 | 37.95 | 3.006 | 2.888 | 0.0281 | 0.000 | 0.0012 |
| 11 | 2.19 | 0.88 | 1.32 | 0.199 | 37.95 | 2.807 | 3.088 | 0.0265 | 0.000 | 0.0011 |
| 12 | 2.05 | 0.82 | 1.23 | 0.186 | 37.95 | 2.621 | 3.274 | 0.0252 | 0.000 | 0.0011 |
| 13 | 1.91 | 0.77 | 1.15 | 0.174 | 37.96 | 2.448 | 3.448 | 0.0242 | 0.000 | 0.0011 |
| 14 | 1.79 | 0.71 | 1.07 | 0.162 | 37.96 | 2.285 | 3.611 | 0.0233 | 0.000 | 0.0010 |
| 15 | 1.67 | 0.67 | 1.00 | 0.152 | 37.96 | 2.134 | 3.762 | 0.0227 | 0.000 | 0.0010 |
| 16 | 1.56 | 0.62 | 0.93 | 0.142 | 37.96 | 1.992 | 3.904 | 0.0221 | 0.000 | 0.0010 |
| 17 | 1.45 | 0.58 | 0.87 | 0.132 | 37.96 | 1.860 | 4.036 | 0.0217 | 0.000 | 0.0009 |
| 18 | 1.36 | 0.54 | 0.81 | 0.123 | 37.96 | 1.737 | 4.159 | 0.0214 | 0.000 | 0.0009 |
| 19 | 1.27 | 0.51 | 0.76 | 0.115 | 37.96 | 1.622 | 4.275 | 0.0211 | 0.000 | 0.0009 |
| 20 | 1.18 | 0.47 | 0.71 | 0.108 | 37.96 | 1.514 | 4.382 | 0.0209 | 0.000 | 0.0006 |

#### Best Festival First release — *Iron and Light* (Walt Disney Pictures)

Sci-Fi / Adults / Festival First / Summer, released Year 2, July 24.  
Critic 54, audience 69, buzz 85, quality 53.  
Budget $238.4M + marketing $146.53M = all-in $341.0M.  
Fixed state: TAA 102M, baseInterestFraction 0.1197 (12.2M people), crossoverCapacityFraction 0.1904 (19.4M), conversionPacingBaseline 0.1064, marketingEfficiency 0.790, externalWeeklyAwarenessRate 0.0269, initialAwareCount 70.11M, initialAvailabilityFraction 0.0179, availabilityBaseWeeklyDecay 0.015, criticLedExpansionWeight 0.65.  
Result: $88.7M worldwide over 20 weeks; studio cash $36.4M; profit $-304.6M; **Flop**.

| Wk | Gross $M | Dom $M | Intl $M | Admissions M | Aware M | Interested remaining M | Cum. tickets M | Availability | Cum. crossover M | Competitive pressure |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1 | 6.92 | 2.63 | 4.29 | 0.629 | 70.96 | 7.868 | 0.629 | 0.0216 | 0.000 | 0.0373 |
| 2 | 8.32 | 3.16 | 5.16 | 0.756 | 71.42 | 7.167 | 1.385 | 0.0216 | 0.000 | 0.0492 |
| 3 | 8.32 | 3.16 | 5.16 | 0.756 | 71.67 | 6.468 | 2.141 | 0.0216 | 0.022 | 0.0902 |
| 4 | 7.76 | 2.95 | 4.81 | 0.705 | 71.81 | 5.860 | 2.846 | 0.0215 | 0.096 | 0.0973 |
| 5 | 7.09 | 2.69 | 4.39 | 0.644 | 71.88 | 5.333 | 3.490 | 0.0214 | 0.195 | 0.0816 |
| 6 | 6.40 | 2.43 | 3.97 | 0.582 | 71.92 | 4.854 | 4.072 | 0.0212 | 0.284 | 0.0731 |
| 7 | 5.76 | 2.19 | 3.57 | 0.523 | 71.94 | 4.405 | 4.596 | 0.0210 | 0.350 | 0.0678 |
| 8 | 5.20 | 1.97 | 3.22 | 0.472 | 71.96 | 3.982 | 5.068 | 0.0208 | 0.393 | 0.0536 |
| 9 | 4.69 | 1.78 | 2.91 | 0.426 | 71.96 | 3.586 | 5.494 | 0.0206 | 0.418 | 0.0371 |
| 10 | 4.23 | 1.61 | 2.62 | 0.384 | 71.97 | 3.218 | 5.879 | 0.0205 | 0.433 | 0.0202 |
| 11 | 3.81 | 1.45 | 2.36 | 0.347 | 71.97 | 2.880 | 6.226 | 0.0204 | 0.439 | 0.0003 |
| 12 | 3.40 | 1.29 | 2.11 | 0.309 | 71.97 | 2.575 | 6.534 | 0.0203 | 0.441 | 0.0003 |
| 13 | 3.03 | 1.15 | 1.88 | 0.275 | 71.97 | 2.301 | 6.810 | 0.0203 | 0.441 | 0.0003 |
| 14 | 2.70 | 1.03 | 1.67 | 0.246 | 71.97 | 2.056 | 7.055 | 0.0202 | 0.441 | 0.0003 |
| 15 | 2.41 | 0.92 | 1.49 | 0.219 | 71.97 | 1.838 | 7.274 | 0.0202 | 0.441 | 0.0003 |
| 16 | 2.15 | 0.82 | 1.33 | 0.196 | 71.97 | 1.642 | 7.470 | 0.0201 | 0.441 | 0.0002 |
| 17 | 1.92 | 0.73 | 1.19 | 0.175 | 71.97 | 1.468 | 7.645 | 0.0201 | 0.441 | 0.0002 |
| 18 | 1.72 | 0.65 | 1.07 | 0.156 | 71.97 | 1.312 | 7.801 | 0.0201 | 0.441 | 0.0002 |
| 19 | 1.54 | 0.58 | 0.95 | 0.140 | 71.97 | 1.172 | 7.941 | 0.0201 | 0.441 | 0.0002 |
| 20 | 1.37 | 0.52 | 0.85 | 0.125 | 71.97 | 1.047 | 8.065 | 0.0201 | 0.441 | 0.0001 |

### 8.3 Competition: what the shared calendar actually looked like


**Run 4001:** peak concurrency 12 films on screens at once; mean concurrency across occupied weeks 5.0; mean competitive pressure across all 379 settled film-weeks 0.0379; max pressure anywhere 0.5540; share of film-weeks with pressure > 0.10: 11.3%.

| Game week | Films running | Mean pressure | Max pressure | Combined gross $M |
|--:|--:|--:|--:|--:|
| 25 | 1 | 0.0000 | 0.0000 | 0.3 |
| 26 | 1 | 0.0000 | 0.0000 | 0.4 |
| 27 | 1 | 0.0000 | 0.0000 | 0.4 |
| 28 | 1 | 0.0000 | 0.0000 | 0.5 |
| 29 | 1 | 0.0000 | 0.0000 | 0.5 |
| 30 | 1 | 0.0000 | 0.0000 | 0.5 |
| 31 | 1 | 0.0000 | 0.0000 | 0.4 |
| 32 | 2 | 0.0000 | 0.0000 | 0.7 |
| 33 | 2 | 0.0000 | 0.0000 | 0.6 |
| 34 | 3 | 0.0010 | 0.0029 | 4.1 |
| 35 | 3 | 0.0014 | 0.0041 | 3.2 |
| 36 | 3 | 0.0013 | 0.0038 | 2.2 |
| 37 | 3 | 0.0010 | 0.0029 | 1.5 |
| 38 | 3 | 0.0006 | 0.0017 | 1.1 |
| 39 | 5 | 0.0030 | 0.0136 | 5.6 |
| 40 | 5 | 0.0053 | 0.0236 | 3.3 |
| 41 | 5 | 0.0042 | 0.0149 | 2.6 |
| 42 | 5 | 0.0035 | 0.0083 | 2.2 |
| 43 | 4 | 0.0038 | 0.0122 | 1.9 |
| 44 | 5 | 0.0043 | 0.0156 | 35.4 |
| 45 | 4 | 0.0066 | 0.0210 | 19.2 |
| 46 | 4 | 0.0042 | 0.0072 | 14.5 |
| 47 | 5 | 0.0040 | 0.0073 | 17.4 |
| 48 | 5 | 0.0038 | 0.0072 | 6.1 |
| 49 | 5 | 0.0028 | 0.0064 | 3.1 |
| 50 | 4 | 0.0011 | 0.0038 | 1.7 |
| 51 | 4 | 0.0007 | 0.0028 | 1.2 |
| 52 | 3 | 0.0017 | 0.0028 | 2.6 |
| 53 | 3 | 0.0005 | 0.0014 | 29.1 |
| 54 | 3 | 0.0027 | 0.0073 | 12.9 |
| 55 | 4 | 0.0070 | 0.0192 | 6.9 |
| 56 | 4 | 0.0091 | 0.0296 | 4.4 |
| 57 | 4 | 0.0059 | 0.0188 | 3.4 |
| 58 | 4 | 0.0033 | 0.0088 | 2.8 |
| 59 | 3 | 0.0009 | 0.0013 | 186.8 |
| 60 | 5 | 0.0408 | 0.0964 | 190.6 |
| 61 | 5 | 0.0709 | 0.1582 | 89.9 |
| 62 | 5 | 0.0563 | 0.1455 | 35.0 |
| 63 | 5 | 0.0364 | 0.1004 | 19.2 |
| 64 | 5 | 0.0192 | 0.0566 | 13.0 |
| 65 | 4 | 0.0086 | 0.0222 | 8.3 |
| 66 | 5 | 0.0055 | 0.0166 | 5.3 |
| 67 | 8 | 0.0033 | 0.0107 | 8.2 |
| 68 | 8 | 0.0034 | 0.0060 | 7.1 |
| 69 | 7 | 0.0031 | 0.0062 | 6.6 |
| 70 | 7 | 0.0031 | 0.0067 | 6.2 |
| 71 | 7 | 0.0030 | 0.0067 | 5.9 |
| 72 | 6 | 0.0032 | 0.0064 | 5.2 |
| 73 | 6 | 0.0030 | 0.0060 | 4.9 |
| 74 | 11 | 0.0280 | 0.1703 | 365.3 |
| 75 | 10 | 0.1164 | 0.3624 | 211.6 |
| 76 | 11 | 0.1793 | 0.5419 | 239.9 |
| 77 | 11 | 0.1808 | 0.5540 | 130.9 |
| 78 | 11 | 0.1406 | 0.4593 | 87.9 |
| 79 | 11 | 0.0940 | 0.3157 | 52.2 |
| 80 | 11 | 0.0460 | 0.1784 | 155.3 |
| 81 | 12 | 0.0288 | 0.1133 | 117.9 |
| 82 | 12 | 0.0279 | 0.1025 | 209.0 |
| 83 | 10 | 0.0552 | 0.1796 | 135.8 |
| 84 | 10 | 0.0650 | 0.2385 | 85.9 |
| 85 | 10 | 0.0428 | 0.1256 | 78.0 |
| 86 | 9 | 0.0703 | 0.2108 | 231.3 |
| 87 | 6 | 0.1245 | 0.4100 | 184.6 |
| 88 | 4 | 0.0510 | 0.1077 | 27.0 |
| 89 | 4 | 0.0344 | 0.0728 | 12.5 |
| 90 | 4 | 0.0178 | 0.0422 | 6.1 |
| 91 | 2 | 0.0040 | 0.0077 | 4.0 |
| 92 | 2 | 0.0037 | 0.0070 | 3.6 |
| 93 | 2 | 0.0033 | 0.0063 | 3.2 |
| 94 | 2 | 0.0029 | 0.0056 | 2.8 |
| 95 | 3 | 0.0027 | 0.0050 | 80.6 |
| 96 | 3 | 0.0017 | 0.0045 | 69.8 |
| 97 | 3 | 0.0015 | 0.0040 | 78.8 |
| 98 | 3 | 0.0013 | 0.0036 | 20.7 |
| 99 | 3 | 0.0012 | 0.0032 | 8.0 |
| 100 | 2 | 0.0003 | 0.0004 | 2.8 |

**Run 7302:** peak concurrency 12 films on screens at once; mean concurrency across occupied weeks 6.5; mean competitive pressure across all 483 settled film-weeks 0.0257; max pressure anywhere 0.4801; share of film-weeks with pressure > 0.10: 4.3%.

Twenty most crowded weeks of this run:

| Game week | Films running | Mean pressure | Max pressure | Combined gross $M |
|--:|--:|--:|--:|--:|
| 76 | 9 | 0.1306 | 0.4801 | 51.1 |
| 77 | 9 | 0.1109 | 0.4632 | 29.6 |
| 75 | 9 | 0.1182 | 0.3839 | 77.0 |
| 78 | 9 | 0.0816 | 0.3766 | 19.8 |
| 79 | 9 | 0.0464 | 0.2543 | 9.8 |
| 80 | 11 | 0.0272 | 0.1288 | 270.5 |
| 83 | 7 | 0.0391 | 0.1274 | 40.4 |
| 82 | 7 | 0.0495 | 0.1237 | 165.5 |
| 81 | 9 | 0.0360 | 0.1218 | 234.1 |
| 58 | 12 | 0.0328 | 0.0942 | 98.6 |
| 51 | 11 | 0.0207 | 0.0925 | 14.9 |
| 59 | 9 | 0.0420 | 0.0909 | 39.2 |
| 84 | 8 | 0.0145 | 0.0886 | 42.9 |
| 63 | 9 | 0.0296 | 0.0844 | 62.6 |
| 62 | 10 | 0.0265 | 0.0829 | 73.8 |
| 57 | 11 | 0.0304 | 0.0775 | 140.3 |
| 56 | 11 | 0.0266 | 0.0771 | 113.3 |
| 53 | 11 | 0.0211 | 0.0748 | 12.6 |
| 54 | 11 | 0.0212 | 0.0747 | 12.2 |
| 60 | 11 | 0.0374 | 0.0739 | 112.6 |

### 8.4 Structural observations from the trace data

Measured over all 69 films / 862 settled film-weeks in both runs:

| Observation | Measurement |
|---|---|
| **Franchise eligibility is switched off.** `FRANCHISE_ELIGIBILITY_GAIN = 0`, so `scriptMarketability` — the documented "non-purchasable lever that makes the highest-opening films almost always franchises" — multiplies TAA by exactly 1 for every film. | multiplier = 1.000 for all 69 |
| **Conversion pacing saturates for a large share of Wide releases.** `0.62 × window × genreBonus × (1 + 0.5·buzz/100)` clamps at 1.0, meaning *every interested person attends in week one* — no pacing at all. | 20 of 39 Wide films clamped at exactly 1.0; mean Wide pacing 0.919 |
| **Every Limited and Festival First run hits the 20-week hard cap.** They never satisfy the "admissions below 2% of opening" stop condition, so run length and therefore opening multiple are set by the cap, not by behaviour. | 11/11 Limited, 19/19 Festival First capped; 0/39 Wide |
| **Competition barely bites.** | mean pressure 0.0311 → attention factor 0.983; only 7.4% of film-weeks above 0.10 |
| **Activation is very low for the median film and high for the top.** Cumulative tickets as a fraction of TAA. | min 0.41%, median 2.68%, max 39.2% |
| **Reception has a narrow range.** AI-produced films almost never score above the mid-70s, which caps the fourth-power reception term and flattens outcome variance. | critic 37–71 (median 56), audience 42–72 (median 63) |
| **International reach is uniform.** Every rival studio has full reach, so the domestic/international split is a flat per-genre percentage with no variance. | reach = 1.0 for all 69 |
| **Word of mouth creates zero awareness.** `newlyAwareFromWom` is hardcoded 0; awareness comes only from the release-day seed and a trickle decaying at `0.55^(week-1)`. | by construction |

---

## 9. Existing tests

All ordinary box-office tests currently pass. The **calibration diagnostics are
opt-in and expected to fail** — they encode the ratified target, not the current
state (see `CLAUDE.md`).

### 9.1 Regular suite — 382 tests, all passing

| Test file | Tests | Passing |
|---|--:|--:|
| `src/engine/ancillary.calibration.test.ts` | 8 | 8 |
| `src/engine/ancillary.test.ts` | 25 | 25 |
| `src/engine/audienceSimulation.test.ts` | 40 | 40 |
| `src/engine/audienceSimulationInputs.test.ts` | 54 | 54 |
| `src/engine/audienceSimulationRegressionMatrix.test.ts` | 62 | 62 |
| `src/engine/audienceSimulationReporting.test.ts` | 13 | 13 |
| `src/engine/audienceSimulationScenarios.test.ts` | 30 | 30 |
| `src/engine/audienceSimulationStep.test.ts` | 70 | 70 |
| `src/engine/boxOfficeRun.test.ts` | 20 | 20 |
| `src/engine/distribution.test.ts` | 26 | 26 |
| `src/engine/marketSettlement.test.ts` | 13 | 13 |
| `src/engine/releaseCrowding.test.ts` | 14 | 14 |
| `src/engine/scheduledReleases.test.ts` | 7 | 7 |
| **Total** | **382** | **382** |


<details><summary><code>ancillary.calibration.test.ts</code> — 8 tests</summary>

- ancillary calibration — §3.7 lifetime bands › a merch-franchise blockbuster clears well above its theatrical rentals
- ancillary calibration — §3.7 lifetime bands › a broad four-quadrant hit lands around theatrical rentals, well below the blockbuster
- ancillary calibration — §3.7 lifetime bands › keeps the median film modest — the afterlife is a fraction of theatrical
- ancillary calibration — §3.7 lifetime bands › makes a prestige drama earn downstream but modestly — no merch, licensing + tail
- ancillary calibration — §3.7 lifetime bands › never lets ancillary rescue a flop — the absolute afterlife stays negligible
- ancillary calibration — §3.7 lifetime bands › orders the archetypes as a clean descending afterlife curve
- backend calibration — the deal is a genuine bet › points cost the studio LESS than a flat fee on a flop (you saved cash you needed)
- backend calibration — the deal is a genuine bet › points cost the studio MORE than a flat fee on a hit (the star shares the upside)

</details>

<details><summary><code>ancillary.test.ts</code> — 25 tests</summary>

- awardsLift › is zero with no awards and rises with wins and nominations
- awardsLift › clamps to 1 for a sweep
- leadMerchandisePotential › averages over Lead characters only when leads exist
- leadMerchandisePotential › falls back to the whole cast when there are no leads
- leadMerchandisePotential › is 0 for an empty cast rather than a fabricated neutral
- summariseFilmAwards › counts nominations and wins for the target film across ceremonies
- deriveAncillaryMultipliers — genre differentiation › gives a superhero franchise huge merch and a drama almost none
- deriveAncillaryMultipliers — genre differentiation › lifts merchandising with franchise recognition, all else equal
- deriveAncillaryMultipliers — genre differentiation › lifts home entertainment for a family audience
- deriveAncillaryMultipliers — genre differentiation › lifts licensing with critical acclaim and awards
- deriveAncillaryMultipliers — catalogue longevity › is high for an award-winning, beloved film and low for a forgettable one
- deriveAncillaryProfile — dollars › produces zero dollars pre-release (gross 0) while multipliers stay meaningful
- deriveAncillaryProfile — dollars › scales every window with worldwide gross
- deriveAncillaryProfile — dollars › grants no catalogue tail below the longevity floor and a durable one above it
- deriveAncillaryProfile — dollars › turns a theatrically-unprofitable blockbuster profitable over its lifetime
- deriveAncillaryProfile — dollars › contrasts the two archetypes: hero front-loads merch, drama leans on catalogue longevity
- ancillaryOutlook — qualitative, pre-release › names merchandising as a strength for a superhero film
- ancillaryOutlook — qualitative, pre-release › rates a drama negligible on merch but names its downstream strengths
- ancillaryOutlook — qualitative, pre-release › tells a film with no downstream potential that it lives or dies in cinemas
- ancillaryOutlook — qualitative, pre-release › never leaks a raw number into the headline
- buildAncillarySchedule — materialising dated payouts › produces nothing pre-release (a zero-dollar profile schedules no payouts)
- buildAncillarySchedule — materialising dated payouts › spreads each window into installments that sum to its window total
- buildAncillarySchedule — materialising dated payouts › stamps filmId/title and books each window under the right ledger category
- buildAncillarySchedule — materialising dated payouts › schedules one catalogue payout per surviving year, a year apart, for a classic
- ancillaryAttributesFromFilm — extraction from a live Film › reads genre, scores, franchise, merch and release window off the film

</details>

<details><summary><code>audienceSimulation.test.ts</code> — 40 tests</summary>

- createAudienceSimulationFixedState › accepts a well-formed fixed state
- createAudienceSimulationFixedState › rejects a zero or negative totalAddressableAudience
- createAudienceSimulationFixedState › rejects fractions/probabilities outside 0-1
- createAudienceSimulationFixedState › accepts the 0 and 1 boundary values themselves
- createAudienceSimulationFixedState › rejects baseInterestFraction + crossoverCapacityFraction exceeding 1
- createAudienceSimulationFixedState › rejects critic/audience scores outside 0-100
- createAudienceSimulationFixedState › rejects NaN and Infinity anywhere
- createAudienceSimulationFixedState › rejects a negative initialAwareCount
- createAudienceSimulationFixedState › rejects an initialAwareCount exceeding totalAddressableAudience
- createAudienceSimulationFixedState › accepts initialAwareCount equal to totalAddressableAudience
- createAudienceSimulationFixedState › remains valid for a tiny addressable audience
- createAudienceSimulationFixedState › remains valid for an extremely large addressable audience
- maxInterestedAudience › is base + crossover capacity, scaled by the addressable audience
- createAudienceSimulationWeekState › accepts a well-formed week
- createAudienceSimulationWeekState › rejects a negative pool of any kind
- createAudienceSimulationWeekState › rejects awareCount exceeding totalAddressableAudience
- createAudienceSimulationWeekState › rejects interestedRemaining exceeding awareCount
- createAudienceSimulationWeekState › rejects interestedRemaining exceeding this film's maxInterestedAudience ceiling even when awareCount would allow it
- createAudienceSimulationWeekState › rejects cumulativeTicketsSold exceeding totalAddressableAudience (no repeat viewing modeled)
- createAudienceSimulationWeekState › rejects a non-positive or non-integer week number
- createAudienceSimulationWeekState › rejects NaN/Infinity in any weekly field
- createAudienceSimulationRun › accepts a well-formed multi-week history
- createAudienceSimulationRun › rejects a run that does not start at week 1
- createAudienceSimulationRun › rejects non-sequential week numbers
- createAudienceSimulationRun › rejects awareCount decreasing week to week
- createAudienceSimulationRun › rejects cumulativeTicketsSold decreasing week to week
- createAudienceSimulationRun › allows interestedRemaining to move non-monotonically (it both shrinks via conversion and grows via crossover)
- createAudienceSimulationRun › produces an empty-history run without error (release week not yet settled)
- deriveWeeklyAdmissions › is the release week's full cumulative total for week 1
- deriveWeeklyAdmissions › is the difference between consecutive cumulative totals thereafter
- deriveWeeklyAdmissions › throws for an out-of-range week index
- deriveWordOfMouthActivity › is zero before any week has been settled
- deriveWordOfMouthActivity › weights the most recent week most heavily
- deriveWordOfMouthActivity › never grows unboundedly with an arbitrarily long history - only a bounded recent window contributes
- deriveWordOfMouthActivity › is a pure function of the history - calling it twice with the same input gives the same result
- fixed vs. evolving state stay clearly separated › AudienceSimulationFixedState never varies by week - constructing many weeks against the same fixed state does not mutate it
- fixed vs. evolving state stay clearly separated › AudienceSimulationWeekState carries only the five evolving fields plus its week number - no fixed-state fields leak into it
- word-of-mouth activity is never present as stored duplicate state › AudienceSimulationWeekState has no momentum/word-of-mouth/pulse/reaction field of any kind
- word-of-mouth activity is never present as stored duplicate state › AudienceSimulationFixedState has no momentum/pulse/reaction field either - only criticScore/audienceScore represent reception, reused not duplicated
- word-of-mouth activity is never present as stored duplicate state › deriveWordOfMouthActivity recomputes from history rather than reading a cached value - two independently-constructed but identical histories agree exactly

</details>

<details><summary><code>audienceSimulationInputs.test.ts</code> — 54 tests</summary>

- deriveAudienceSimulationFixedState - basic construction › produces a fixed state that passes Milestone 1 validation for a typical input
- deriveAudienceSimulationFixedState - basic construction › rejects Streaming at the type level - SupportedReleaseType excludes it (compile-time, exercised here defensively at runtime)
- deriveAudienceSimulationFixedState - basic construction › always produces baseInterestFraction + crossoverCapacityFraction <= 1, at every accessibility/crossoverPotential extreme
- crossoverCapacityFraction - multi-factor concept strength x accessibility › originality alone (everything else at a moderate default) does not push capacity anywhere near the ceiling
- crossoverCapacityFraction - multi-factor concept strength x accessibility › spectacle contributes independently of originality - a low-originality, high-spectacle event film still gets meaningful capacity
- crossoverCapacityFraction - multi-factor concept strength x accessibility › a non-spectacle film can still reach real capacity through exceptional originality and marketability together
- crossoverCapacityFraction - multi-factor concept strength x accessibility › criticScore alone (moderate everything else) contributes only a secondary amount, never dominating
- crossoverCapacityFraction - multi-factor concept strength x accessibility › genre/target-audience accessibility constrains capacity even when concept strength is maxed out
- crossoverCapacityFraction - multi-factor concept strength x accessibility › a well-liked but conventional niche film (low originality/spectacle, narrow accessibility) gets very little crossover capacity
- crossoverCapacityFraction - multi-factor concept strength x accessibility › a broadly accessible, spectacular, well-liked film gets strong crossover capacity - several factors aligning
- monotonicity and causality › more marketing spend does not reduce initial awareness, holding everything else fixed
- monotonicity and causality › higher Buzz does not reduce opening (week 1) admissions, holding everything else fixed
- monotonicity and causality › greater release reach does not reduce opening admissions - Festival First <= Limited <= Wide for identical Buzz/marketing/reception
- monotonicity and causality › better audience reception does not weaken WOM - clearly-separated reception bands produce non-decreasing total admissions
- monotonicity and causality › higher expansion capacity (crossoverPotential) does not reduce reachable interest, given good reception
- monotonicity and causality › higher crossoverPotential with poor reception must not independently create a sleeper hit - capacity alone never breaks out
- monotonicity and causality › strong marketability does not reduce initial interest
- Milestone 11 - awareness/interest/distribution separation of concerns (docs/DESIGN.md) › marketingEfficiency depends only on studioBrand - completely invariant to scriptAccessibility and scriptCrossoverPotential
- Milestone 11 - awareness/interest/distribution separation of concerns (docs/DESIGN.md) › marketingEfficiency rises monotonically with studioBrand alone
- Milestone 11 - awareness/interest/distribution separation of concerns (docs/DESIGN.md) › initialAwareCount is identical across every release type, for identical cast fame/marketing/reputation - Distribution no longer manufactures awareness
- Milestone 11 - awareness/interest/distribution separation of concerns (docs/DESIGN.md) › initialAvailabilityFraction still strictly differentiates release types - Distribution answers "how much of that demand converts this week," not awareness
- Milestone 11 - awareness/interest/distribution separation of concerns (docs/DESIGN.md) › scriptAccessibility never moves initialAwareCount - a broadly understandable concept is not the same as a widely-known one
- Milestone 11 - awareness/interest/distribution separation of concerns (docs/DESIGN.md) › scriptCrossoverPotential never moves initialAwareCount - crossover potential affects crossover/conversation, never raw awareness reach
- Milestone 11 - awareness/interest/distribution separation of concerns (docs/DESIGN.md) › crossoverCapacityFraction responds to scriptCrossoverPotential, not to scriptAccessibility or scriptHookStrength (Milestone 12) - "spreads by recommendation" and "has a big natural audience"/"compelling pitch" are different questions
- Milestone 11 - awareness/interest/distribution separation of concerns (docs/DESIGN.md) › baseInterestFraction responds to scriptHookStrength as a secondary multiplier alongside scriptAccessibility (Milestone 12) - "compelling pitch" and "easy to understand" are different questions, both inside interest generation
- Milestone 11 - awareness/interest/distribution separation of concerns (docs/DESIGN.md) › computeCastReachFraction: an unknown director/lead pair contributes essentially no awareness even at maximum marketing spend efficiency
- Milestone 11 - awareness/interest/distribution separation of concerns (docs/DESIGN.md) › marketing spend is the dominant awareness channel: its full-range swing produces a bigger initialAwareCount change than cast fame's full-range swing, at default reputation
- boundaries › marketing spend 0 vs maximum, everything else fixed - a heavily marketed film opens dramatically bigger, not just modestly so
- boundaries › director/lead fame 0 vs maximum, everything else fixed - cast reach provides a real but clearly secondary boost, well short of marketing's swing
- boundaries › zero vs maximum marketing spend, everything else fixed - more spend clearly opens bigger
- boundaries › a very small Limited release (unknown cast, modest spend) opens and totals far below a maximum-reach Wide release (famous cast, huge spend)
- boundaries › an excellent film with almost no opening awareness (Festival First, unknown cast, no marketing) still opens tiny relative to its addressable audience
- boundaries › a terrible film with enormous awareness (Wide, famous cast, maximum marketing, terrible reception) still collapses fast after opening
- boundaries › a niche acclaimed film with almost no expansion capacity stays capped at its (small) ceiling, never approaching mass-market scale
- named archetype diagnostics › 1. front-loaded event film, poor reception: huge opening, then a severe and uninterrupted decline
- named archetype diagnostics › 2. sleeper hit: tiny opening, but a later week matches or exceeds an earlier one - real growth, not just a slow decline
- named archetype diagnostics › 3. huge opening with exceptional reception: a genuine phenomenon - both a big opening and a big total
- named archetype diagnostics › 4. critically acclaimed niche film: acclaim genuinely grows the run, but the absolute total stays small - Niche never buys mass-market scale
- named archetype diagnostics › 5. broad crowd-pleaser: solid (not necessarily exceptional) reception still clearly outperforms poor reception at the same reach
- named archetype diagnostics › 6. highly original but disliked film: large crossover capacity never gets realized - stays at or below the natural ceiling
- named archetype diagnostics › 7. excellent but poorly marketed film: tiny opening, but total grows to many times the opening via word of mouth alone
- named archetype diagnostics › 8. massive marketing campaign for a poor film: an enormous opening that still cannot sustain itself
- named archetype diagnostics › 9. ordinary mid-performing film: unremarkable, but genuinely sustained - later weeks decline gently, they do not collapse the way a poor-reception film does
- the top end of the range › a maximal, justified combination of inputs reaches tens of millions of admissions without any repeat-viewing mechanic
- the top end of the range › scales down correctly too - the smallest reachable audience (Niche) with minimal reach never produces a phenomenon-scale total
- run always terminates and stays structurally valid › every named archetype input produces a run that ends within the hard cap and never violates Milestone 1 invariants
- Milestone 12 - commercial believability calibration (docs/DESIGN.md) › marketing spend is a bigger opening-weekend lever than the screenplay (accessibility + hookStrength combined), across each one's own realistic range
- Milestone 12 - commercial believability calibration (docs/DESIGN.md) › Wide release availability scales with release strength (marketing spend + studio reputation) - an unknown, poorly-funded studio does not get the same nationwide rollout as an established one
- Milestone 12 - commercial believability calibration (docs/DESIGN.md) › Wide still always beats Limited on availability, even for the weakest possible release strength - Distribution is earned relative to strategy, never inverted
- Milestone 12 - commercial believability calibration (docs/DESIGN.md) › Limited and Festival First availability stay flat regardless of release strength - only Wide's day-one rollout has to be earned
- Milestone 12 - commercial believability calibration (docs/DESIGN.md) › crossoverCapacityFraction now genuinely throttles realized crossover - the Milestone 10 gap this milestone fixed
- Milestone 12 - commercial believability calibration (docs/DESIGN.md) › cumulativeCrossoverRealized never exceeds crossoverCapacityFraction * totalAddressableAudience, at any reception level
- deriveAudienceSimulationFixedState - Wide availability ceiling (Distribution Arm) › a lower distribution ceiling lowers a Wide release's initial availability, all else equal
- deriveAudienceSimulationFixedState - Wide availability ceiling (Distribution Arm) › leaves non-Wide release types untouched (the ceiling only gates Wide)

</details>

<details><summary><code>audienceSimulationRegressionMatrix.test.ts</code> — 62 tests</summary>

- regression matrix: 1. ordinary positive reception › holds reasonably in weeks 2-4 (does not collapse immediately)
- regression matrix: 1. ordinary positive reception › does not grow for an extreme number of consecutive weeks
- regression matrix: 1. ordinary positive reception › does not reach peak attendance in the deep-tail weeks 14-20
- regression matrix: 1. ordinary positive reception › does not produce phenomenon-level legs
- regression matrix: 1. ordinary positive reception › peak week is not a runaway multiple of the opening
- regression matrix: 2. strong WOM film › one or two later weeks may exceed an earlier week (durable, not purely declining)
- regression matrix: 2. strong WOM film › materially outperforms an ordinary-positive film on total scale
- regression matrix: 2. strong WOM film › growth eventually slows - the run is not still climbing at the very end
- regression matrix: 2. strong WOM film › does not automatically become a mass-market phenomenon (reproduction ratio stays clearly below replacement)
- regression matrix: 3. genuine sleeper breakout › opens modestly relative to its own eventual total
- regression matrix: 3. genuine sleeper breakout › several flat-or-increasing weeks are possible
- regression matrix: 3. genuine sleeper breakout › peak occurs after opening
- regression matrix: 3. genuine sleeper breakout › final multiplier is meaningfully higher than an ordinary-positive film's
- regression matrix: 3. genuine sleeper breakout › weekly gross does not become dozens of times larger than opening
- regression matrix: 4. rare phenomenon › holds or grows past its opening week rather than declining from week 1
- regression matrix: 4. rare phenomenon › major crossover is realized
- regression matrix: 4. rare phenomenon › extreme total gross is reachable
- regression matrix: 4. rare phenomenon › is rare - dramatically bigger than an ordinary-positive film with far fewer exceptional inputs aligned
- regression matrix: 4. rare phenomenon › peaks well above an ordinary film, but never self-sustains (its scale shows in total gross, not weekly ratio)
- regression matrix: 5. well-liked but niche film › shows excellent retention within its niche (high legs) relative to an ordinary-positive film
- regression matrix: 5. well-liked but niche film › has higher legs than a broad crowd-pleaser, because its opening is small
- regression matrix: 5. well-liked but niche film › total gross remains far smaller than a broad crowd-pleaser - acclaim did not buy blockbuster scale
- regression matrix: 6. broadly marketable but merely decent film › has a solid or large opening
- regression matrix: 6. broadly marketable but merely decent film › declines from an early peak - does not transform into a late sleeper phenomenon
- regression matrix: 6. broadly marketable but merely decent film › strong total comes from scale, not extraordinary legs
- regression matrix: 7. huge opening, poor reception › produces a very large opening
- regression matrix: 7. huge opening, poor reception › shows a steep decline - week 2 falls well short of the opening
- regression matrix: 7. huge opening, poor reception › realizes little or no crossover
- regression matrix: 7. huge opening, poor reception › shows weak WOM pull-forward throughout
- regression matrix: 7. huge opening, poor reception › produces a low total-to-opening multiplier
- regression matrix: 8. excellent film with weak marketing › has a weak opening relative to its own eventual total
- regression matrix: 8. excellent film with weak marketing › shows gradual WOM recovery - growth is spread across many weeks, not one
- regression matrix: 8. excellent film with weak marketing › does not jump instantly to blockbuster weekly attendance - its peak week is nowhere near phenomenon scale
- regression matrix: 9. original but disliked film › poor reception prevents the theoretical crossover capacity from being realized
- regression matrix: 9. original but disliked film › shows no breakout - it declines from its opening
- regression matrix: 9. original but disliked film › shows no prolonged growth
- regression matrix: 10. ordinary film › shows conventional decline with no dramatic resurgence
- regression matrix: 10. ordinary film › produces front-loaded legs - well above a poor collapse, comfortably short of a leggy sleeper
- regression matrix: cross-scenario assertions › ordinary-positive reception does not outperform exceptional reception on WOM or total scale
- regression matrix: cross-scenario assertions › a niche acclaimed film may have higher legs than a broad crowd-pleaser but lower total admissions
- regression matrix: cross-scenario assertions › a highly marketed poor film opens higher than an excellent poorly marketed film, but collapses far faster (legs)
- regression matrix: cross-scenario assertions › high originality with bad reception produces less realised crossover than modest originality with strong reception
- regression matrix: cross-scenario assertions › a strong sleeper peaks after opening, while a front-loaded ordinary Wide film peaks at/near its opening (not in the deep tail)
- regression matrix: cross-scenario assertions › only the rare-phenomenon scenario regularly approaches the extreme upper-end gross among the matrix
- regression matrix: cross-scenario assertions › Wide scenarios now terminate via the natural-trickle stopping rule before the hard cap, while Limited platform builds still reach the cap
- regression matrix: cross-scenario assertions › the rare-phenomenon scenario saturates more of its reachable ceiling than an ordinary-positive film
- regression matrix: additional property sweeps › audience scores in the ordinary-positive range (65-74) do not frequently produce ten or more consecutive weeks of growth
- regression matrix: additional property sweeps › later-week gross does not exceed opening gross by extreme (20x+) multiples except in the rare-phenomenon scenario
- regression matrix: additional property sweeps › crossover realised as a fraction of capacity rises sharply only at genuinely exceptional WOM/reception levels
- regression matrix: additional property sweeps › improving audience reception produces near-monotonic improvements in total gross, without a runaway cliff at ordinary scores
- regression matrix: additional property sweeps › the WOM reproduction ratio falls below replacement as the reachable audience approaches saturation
- regression matrix: additional property sweeps › the percentage of runs reaching the hard cap outside the rare-phenomenon scenario reflects the known, pre-existing stopping-rule characteristic (Milestone 5), not a new Milestone 9 regression
- regression matrix: sanity - every scenario produces a valid, finite run › ORDINARY_POSITIVE produces finite, non-negative admissions and gross throughout
- regression matrix: sanity - every scenario produces a valid, finite run › STRONG_WOM produces finite, non-negative admissions and gross throughout
- regression matrix: sanity - every scenario produces a valid, finite run › SLEEPER_BREAKOUT produces finite, non-negative admissions and gross throughout
- regression matrix: sanity - every scenario produces a valid, finite run › RARE_PHENOMENON produces finite, non-negative admissions and gross throughout
- regression matrix: sanity - every scenario produces a valid, finite run › WELL_LIKED_NICHE produces finite, non-negative admissions and gross throughout
- regression matrix: sanity - every scenario produces a valid, finite run › BROAD_DECENT produces finite, non-negative admissions and gross throughout
- regression matrix: sanity - every scenario produces a valid, finite run › HUGE_OPEN_POOR produces finite, non-negative admissions and gross throughout
- regression matrix: sanity - every scenario produces a valid, finite run › EXCELLENT_WEAK_MARKETING produces finite, non-negative admissions and gross throughout
- regression matrix: sanity - every scenario produces a valid, finite run › ORIGINAL_DISLIKED produces finite, non-negative admissions and gross throughout
- regression matrix: sanity - every scenario produces a valid, finite run › ORDINARY produces finite, non-negative admissions and gross throughout

</details>

<details><summary><code>audienceSimulationReporting.test.ts</code> — 13 tests</summary>

- buildWeeklyReport - the people-to-money boundary › weeklyGross and cumulativeGross are exactly admissions * AVERAGE_TICKET_PRICE, nothing else recomputed
- buildWeeklyReport - the people-to-money boundary › cumulativeGross is non-decreasing across the run, matching cumulativeTicketsSold
- runModel - live-model reporting path › openingGross is week 1 gross, and totalGross matches the final cumulative gross
- runModel - live-model reporting path › is fully deterministic - the model has no randomness at all
- runModel - live-model reporting path › legs (totalGross / openingGross) is a sane positive multiple
- the representative scenario matrix › runs every scenario without throwing and returns a sane result for each
- the representative scenario matrix › every scenario in the matrix produces a valid AudienceSimulationFixedState (Streaming excluded, all fields in range)
- the representative scenario matrix › the blockbuster scenario clearly outgrosses the flop scenario - a basic sanity floor for the matrix itself
- diagnoseRunShape - the plain-language "why" behind a trajectory › an empty run (no weeks) produces no labels
- diagnoseRunShape - the plain-language "why" behind a trajectory › front-loaded event film, poor reception: labelled "Opened strongly" and "Collapsed", never "Grew"
- diagnoseRunShape - the plain-language "why" behind a trajectory › a sleeper hit: labelled "Grew", never "Collapsed"
- diagnoseRunShape - the plain-language "why" behind a trajectory › a niche acclaimed film with almost no expansion capacity: labelled "Remained niche"
- diagnoseRunShape - the plain-language "why" behind a trajectory › every detail string is non-empty and label set has no duplicates

</details>

<details><summary><code>audienceSimulationScenarios.test.ts</code> — 30 tests</summary>

- named archetype regression scenarios › front-loaded event film with poor reception: very large opening, severe second-week drop, weak final multiplier, front-loaded admissions
- named archetype regression scenarios › sleeper hit: small opening, real growth, strong WOM, high legs relative to opening
- named archetype regression scenarios › huge opening with exceptional reception: enormous opening, no early decline, very large total, reaches the simulation's extreme upper range
- named archetype regression scenarios › critically acclaimed niche film: small/restricted start, durable run, acclaim never buys mass-market scale
- named archetype regression scenarios › broad crowd-pleaser: solid opening, sustained (not explosive, not collapsing) attendance, strong total without extreme originality
- named archetype regression scenarios › highly original but disliked film: originality alone never creates a breakout - poor reception suppresses WOM and expansion
- named archetype regression scenarios › excellent but poorly marketed film: weak opening, WOM-driven recovery, never an instant Wide-blockbuster trajectory
- named archetype regression scenarios › heavily marketed bad film: strong awareness and opening, sharp collapse after poor reception
- named archetype regression scenarios › ordinary mid-performing film: conventional decline, neither explosive nor catastrophic, sensible middle-range legs and run duration
- sweep: fixed-state fields are continuous, never discontinuous, across their own inputs › baseInterestFraction and marketingEfficiency change smoothly as scriptAccessibility sweeps 0-100
- sweep: fixed-state fields are continuous, never discontinuous, across their own inputs › totalAddressableAudience changes smoothly as scriptCrossoverPotential sweeps 0-100 (it should not move at all, in fact)
- sweep: no invalid values across a broad grid of realistic combinations › every combination produces finite, non-negative fixed-state fields and simulation output
- sweep: no accidental caps - a reception sweep produces genuinely distinct outcomes, not a handful of repeated values › sweeping audience/critic score 10-100 at a fixed, moderate reach produces a wide spread of distinct totals
- sweep: no accidental caps - a reception sweep produces genuinely distinct outcomes, not a handful of repeated values › the same reception sweep does not have every entry sitting at the exact same ceiling value (an accidental cap would look like this)
- sweep: no inversions - every input that should help never makes the outcome worse › more marketing spend never reduces total gross, holding everything else fixed
- sweep: no inversions - every input that should help never makes the outcome worse › higher Buzz never reduces opening gross, holding everything else fixed
- sweep: no inversions - every input that should help never makes the outcome worse › greater release reach never reduces opening gross: Festival First <= Limited <= Wide for identical everything else
- sweep: no inversions - every input that should help never makes the outcome worse › better audience reception never weakens the outcome, using clearly-separated bands (see Milestone 3's own note on the WOM tipping point making adjacent single-point comparisons noisy)
- sweep: no inversions - every input that should help never makes the outcome worse › higher expansion capacity (crossoverPotential) never reduces the reachable total, given good reception
- sweep: no inversions - every input that should help never makes the outcome worse › stronger marketability never reduces baseInterestFraction or marketingEfficiency
- sweep: no excessive clustering around the middle - a varied set of realistic releases produces a genuinely wide outcome distribution › totals across a set of deliberately varied realistic scenarios span multiple orders of magnitude, not a narrow middle band
- sweep: no runaway saturation - not every good film becomes a phenomenon › a sweep of good-but-not-exceptional reception at modest reach does not universally saturate the ceiling
- sweep: no runaway saturation - not every good film becomes a phenomenon › a mid-tier reception score does not always produce the same outcome as a near-perfect one - reception still discriminates once one end of the comparison hasn't already saturated
- the full outcome range is achievable with plausible inputs, from negligible to billion-scale › negligible theatrical gross
- the full outcome range is achievable with plausible inputs, from negligible to billion-scale › a modest indie result
- the full outcome range is achievable with plausible inputs, from negligible to billion-scale › a normal studio outcome
- the full outcome range is achievable with plausible inputs, from negligible to billion-scale › a hit
- the full outcome range is achievable with plausible inputs, from negligible to billion-scale › a major blockbuster
- the full outcome range is achievable with plausible inputs, from negligible to billion-scale › a rare billion-scale phenomenon - genuinely exceeds £1,000,000,000, not just "the biggest of a tidy range"
- the full outcome range is achievable with plausible inputs, from negligible to billion-scale › the six tiers form one strictly increasing sequence end to end - the full range is a genuine spectrum, not disconnected islands

</details>

<details><summary><code>audienceSimulationStep.test.ts</code> — 70 tests</summary>

- invariants across a wide range of fixed-state configurations › holds for: typical mid-budget film
- invariants across a wide range of fixed-state configurations › holds for: tiny addressable audience
- invariants across a wide range of fixed-state configurations › holds for: enormous addressable audience
- invariants across a wide range of fixed-state configurations › holds for: zero critic and audience score
- invariants across a wide range of fixed-state configurations › holds for: maximum critic and audience score
- invariants across a wide range of fixed-state configurations › holds for: zero crossover capacity (unoriginal)
- invariants across a wide range of fixed-state configurations › holds for: maximum crossover capacity (highly original)
- invariants across a wide range of fixed-state configurations › holds for: zero external awareness growth
- invariants across a wide range of fixed-state configurations › holds for: maximum external awareness growth
- invariants across a wide range of fixed-state configurations › holds for: zero baseline conversion pacing
- invariants across a wide range of fixed-state configurations › holds for: maximum baseline conversion pacing
- invariants across a wide range of fixed-state configurations › holds for: zero base interest fraction
- invariants across a wide range of fixed-state configurations › holds for: maximum base interest fraction
- termination › always terminates - a full run never exceeds the hard cap
- termination › the hard maximum week count acts as a backstop even for a film with no decay (near-maximal retention inputs)
- termination › hasSimulationEnded reports true once the hard cap is reached
- termination › an empty history has not ended (nothing to evaluate yet)
- determinism › identical inputs produce identical results, one week at a time
- determinism › identical inputs produce identical results, for a full multi-week run
- determinism › advancing N weeks in one catch-up operation gives the same result as advancing one week N times
- determinism › catching up in two smaller hops gives the same result as one big hop
- word-of-mouth recency-weighted lookback › a spike far outside the lookback window contributes nothing to the current WOM influence
- word-of-mouth recency-weighted lookback › old weeks outside the effective lookback contribute nothing regardless of how long the run has been going
- word-of-mouth recency-weighted lookback › is zero before any week has settled (week 1 has no prior word of mouth)
- computeRunningFilmStrength - a running film's own current heat, readable from outside its weekly step › equals computeCurrentWomInfluence with the reception multiplier divided back out, for the same fixed/weeks/index
- computeRunningFilmStrength - a running film's own current heat, readable from outside its weekly step › is zero before any week has settled, same as computeCurrentWomInfluence
- computeRunningFilmStrength - a running film's own current heat, readable from outside its weekly step › is always in [0, 1], regardless of reception - unlike computeCurrentWomInfluence, it never gets scaled down by a poor critic/audience score
- computeRunningFilmStrength - a running film's own current heat, readable from outside its weekly step › a film with more recent admissions activity has higher strength than one with less, all else equal
- computeNextAvailability - competitivePressure (Live screen competition) › defaults to zero and is a complete no-op when omitted - identical to passing 0 explicitly
- computeNextAvailability - competitivePressure (Live screen competition) › a higher competitivePressure contracts availability faster than zero pressure, all else equal
- computeNextAvailability - competitivePressure (Live screen competition) › never pushes availability below the existing floor, however high pressure is - the existing rate-magnitude clamp still bounds it
- advanceOneWeek/advanceOneWeekWithDiagnostics - competitivePressure threading (Live screen competition) › threads competitivePressure through to computeNextAvailability exactly - nextAvailabilityFraction matches a direct computeNextAvailability call fed the same availabilityFraction/demandUtilisation this same week already reports, and competitivePressure is recorded verbatim
- advanceOneWeek/advanceOneWeekWithDiagnostics - competitivePressure threading (Live screen competition) › advanceOneWeek (the diagnostics-free wrapper) accepts the same competitivePressure argument and matches advanceOneWeekWithDiagnostics.next
- advanceOneWeek/advanceOneWeekWithDiagnostics - competitivePressure threading (Live screen competition) › every existing call site (advanceToWeek, advanceToWeekWithDiagnostics) omits competitivePressure and is completely unaffected by its existence - defaults to 0 throughout
- replaySettledWeeksWithDiagnostics › matches advanceOneWeekWithDiagnostics called manually week by week with the same pressure sequence
- replaySettledWeeksWithDiagnostics › stops exactly at the length of the pressure array, even where hasSimulationEnded would say the run should still be going
- replaySettledWeeksWithDiagnostics › an empty pressure history (nothing settled yet) returns an empty run
- replaySettledWeeksWithDiagnostics › fills in womReproductionRatio via the same post-pass advanceToWeekWithDiagnostics uses, except for the final (most recent) week
- boundary cases › critic and audience scores of 0 produce a near-floor (not exactly zero, not large) reception multiplier
- boundary cases › critic and audience scores of 100 produce the maximum reception multiplier
- boundary cases › zero crossover capacity (unoriginal film) - even an outstanding reception realizes no crossover expansion
- boundary cases › exceptional WOM with substantial expansion capacity realizes real crossover growth beyond the natural audience
- boundary cases › exceptional reception with almost no expansion capacity stays capped near the natural ceiling
- boundary cases › a highly original but poorly received film does not realize its crossover capacity - capacity alone is not enough
- boundary cases › modest originality (small crossover capacity) with exceptional reception is still capped by its small capacity
- boundary cases › nearly exhausted interested audience after week one still behaves correctly in week two - no negative pools, no over-selling
- boundary cases › no WOM effect (week 1, no prior history) - only external awareness/base interest/baseline pacing operate
- release-day awareness seed (Milestone 3 step 0) › lands only when computing week 1, never on any later week
- release-day awareness seed (Milestone 3 step 0) › is capped by the remaining unaware pool, never exceeding totalAddressableAudience
- release-day awareness seed (Milestone 3 step 0) › its natural-fit slice converts into week 1's InterestedRemaining via the same step-2 conversion, not a second formula
- release-day awareness seed (Milestone 3 step 0) › a zero initialAwareCount leaves week 1 identical to Milestone 2 behavior (no seed at all)
- pull-forward redesign - smooth saturating urgency, dual-decaying ceiling (docs/DESIGN.md 5.34, "crossover/pull-forward separation") › pullForwardUrgencySignal is 0 at/below the threshold and rises smoothly above it - no plateau at any finite influence
- pull-forward redesign - smooth saturating urgency, dual-decaying ceiling (docs/DESIGN.md 5.34, "crossover/pull-forward separation") › pullForwardCeilingMultiplier decays smoothly as the run ages, holding backlog freshness fixed
- pull-forward redesign - smooth saturating urgency, dual-decaying ceiling (docs/DESIGN.md 5.34, "crossover/pull-forward separation") › pullForwardCeilingMultiplier decays as the backlog becomes less fresh, holding week fixed
- pull-forward redesign - smooth saturating urgency, dual-decaying ceiling (docs/DESIGN.md 5.34, "crossover/pull-forward separation") › ordinary-good WOM produces a modest boost, not a near-maximal one
- pull-forward redesign - smooth saturating urgency, dual-decaying ceiling (docs/DESIGN.md 5.34, "crossover/pull-forward separation") › exceptional WOM pushes the boost meaningfully higher than ordinary-good WOM, without hitting the max multiplier outright
- pull-forward redesign - smooth saturating urgency, dual-decaying ceiling (docs/DESIGN.md 5.34, "crossover/pull-forward separation") › a late-run, thinned-out backlog gets a far smaller boost than an early, fresh one at the same womInfluence
- pull-forward redesign - smooth saturating urgency, dual-decaying ceiling (docs/DESIGN.md 5.34, "crossover/pull-forward separation") › cannot re-peak indefinitely - repeatedly feeding the same strong womInfluence at increasing week numbers keeps shrinking the boost
- probabilities and monetary/audience outputs stay valid › applyWomPullForward always returns a value in [0,1]
- probabilities and monetary/audience outputs stay valid › sellTicketsThisWeek never exceeds the interested pool it is drawn from, even with an out-of-range probability input
- probabilities and monetary/audience outputs stay valid › every value produced across a full run is finite
- week diagnostics (Milestone 4) › advanceOneWeekWithDiagnostics.next is identical to advanceOneWeek - one implementation, not two that could drift
- week diagnostics (Milestone 4) › advanceToWeekWithDiagnostics.weeks is identical to advanceToWeek, and diagnostics has exactly one entry per week
- week diagnostics (Milestone 4) › each week's diagnostics are internally consistent with the week state they describe
- week diagnostics (Milestone 4) › with zero crossover capacity, crossoverInterestCreated can only ever mop up leftover natural-ceiling headroom step 5 did not use this same week - it can never push interestedRemaining past the natural ceiling
- regression: the Quantum Signal incident (docs/DESIGN.md 5.34) › no single week grosses more than a small multiple of the opening weekend
- regression: the Quantum Signal incident (docs/DESIGN.md 5.34) › no single week accounts for more than a modest share of the film's entire lifetime gross
- regression: the Quantum Signal incident (docs/DESIGN.md 5.34) › total lifetime gross stays within a plausible range for a good-but-not-extraordinary reception, nowhere near the incident's near-Â£1bn outcome
- regression: the Quantum Signal incident (docs/DESIGN.md 5.34) › the weekly WOM reproduction ratio never sustains above replacement (>= 1) - the loop stays a bounded diffusion, not unbounded exponential growth
- regression: the Quantum Signal incident (docs/DESIGN.md 5.34) › still declines to a settled, bounded ending within the simulation window rather than being cut off mid-explosion

</details>

<details><summary><code>boxOfficeRun.test.ts</code> — 20 tests</summary>

- settleBoxOfficeForAllFilms - calendar jumps and catch-up › advancing multiple films through a single large calendar jump settles every one of them
- settleBoxOfficeForAllFilms - calendar jumps and catch-up › one big catch-up jump produces the exact same final state as settling week by week
- settleBoxOfficeForAllFilms - calendar jumps and catch-up › a run already finished does not get re-settled by a later call - same object, zero cash/brand/prestige this time
- settleBoxOfficeForAllFilms - revenue and cash › cashCredit equals the sum of each newly-settled week's per-market credit
- settleBoxOfficeForAllFilms - revenue and cash › a hard-gated film earns domestic gross only - no international week
- settleBoxOfficeForAllFilms - revenue and cash › cashCredit is never negative, across a range of reception levels including terrible ones
- settleBoxOfficeForAllFilms - revenue and cash › cumulativeGross always equals the sum of that run's own weekly grosses
- settleBoxOfficeForAllFilms - distributor P&A recoup › withholds the recoup off the top, matches a run with no recoup minus the recoup, and never goes negative
- settleBoxOfficeForAllFilms - distributor P&A recoup › recoup off the top settles identically in one big jump as week by week (reconstructable)
- settleBoxOfficeForAllFilms - distributor P&A recoup › a recoup larger than the whole run is capped at the run - the studio banks nothing, never negative
- settleBoxOfficeForAllFilms - termination › a run can terminate normally, well before the hard cap, once weekly admissions trickle down
- settleBoxOfficeForAllFilms - termination › a run terminates via the hard cap for a film that keeps performing well
- settleBoxOfficeForAllFilms - termination › once finished, totalBoxOffice/studioRevenue/profit/outcome/brandChange/prestigeChange are all populated and coherent
- rival films settle through the exact same function › a film tagged releasedBy (a rival) settles identically to one without it
- settleBoxOfficeForAllFilms - live screen competition (competitivePressure) › two concurrently-running, same-genre/audience films pull each other's availability down, relative to either one running alone
- settleBoxOfficeForAllFilms - live screen competition (competitivePressure) › a same-genre/audience competitor pulls availability down further than a mismatched one, all else equal
- settleBoxOfficeForAllFilms - live screen competition (competitivePressure) › a lone film with no siblings in the same settlement call is completely unaffected - competitivePressure is 0 throughout, identical to a single-film call before this feature existed
- settleBoxOfficeForAllFilms - live screen competition (competitivePressure) › records the real competitivePressure used each week on BoxOfficeWeek - nonzero for genuinely competing films, 0 throughout for a lone one, and replayable back into the exact same run
- settleBoxOfficeForAllFilms - live screen competition (competitivePressure) › a big multi-week jump across two mutually-competing films settles identically to the same span done as several smaller calls
- settleBoxOfficeForAllFilms - live screen competition (competitivePressure) › three same-genre competitors released on different days all settle without error, ordered by real calendar day rather than by list position

</details>

<details><summary><code>distribution.test.ts</code> — 26 tests</summary>

- Distribution Arm facility helpers › is locked until built, and self-distributing Wide needs it
- Distribution Arm facility helpers › unlocks on the films-released OR Brand milestone
- Distribution Arm facility helpers › upgrades cost through the tiers, then maxes out
- defaultDistributionMethod › defaults a Wide release to a distributor without an arm, self-distribution with one
- defaultDistributionMethod › always self-distributes the ungated release types
- resolveDistribution (self / non-Wide paths) › carries no overrides for a non-Wide release
- resolveDistribution (self / non-Wide paths) › scales the self-distributed Wide screen ceiling with arm tier, keeping the full share
- assessCommercialAppeal › is a fraction in [0,1] and rises with production scale
- generateDistributorOffers › pitches one offer per archetype, terms all inside their ranges
- generateDistributorOffers › is deterministic for a fixed seed (stable across renders)
- generateDistributorOffers › a more appealing film with a stronger studio gets better terms (lower fee, wider, bigger campaign)
- generateDistributorOffers › the major charges the most and reaches widest; the boutique charges the least
- resolveDistributorDeal / feeFractionFromKeepShare › turns an offer into frozen terms: keepShare below the default, P&A both fronted and recouped
- resolveDistributorDeal / feeFractionFromKeepShare › feeFractionFromKeepShare is 0 for a self-distributed film (no override)
- International Distribution track helpers › reports the current international tier, defaulting to 0
- International Distribution track helpers › has no next tier without an arm, and caps at the max
- International Distribution track helpers › prices the next tier, and has no price when locked or maxed
- International Distribution track helpers › tier 0 is the hard gate (reach 0) and the max tier reaches everything (reach 1)
- International Distribution track helpers › every genre has an international appeal strictly inside (0, 1) so a film always keeps a domestic half
- splitBoxOfficeGross - the one market split › tier-0 reach earns domestic only - no international gross or credit from overseas
- splitBoxOfficeGross - the one market split › full reach captures the whole overseas half, and headline == worldwide
- splitBoxOfficeGross - the one market split › domestic + international potential always reconstitute the worldwide gross
- splitBoxOfficeGross - the one market split › credit applies each market its own keep - the two constants are distinct
- splitBoxOfficeGross - the one market split › clamps hostile inputs so no negative revenue is ever manufactured
- splitBoxOfficeGross - the one market split › a full-reach studio's blended keep lands near the old 0.42 across the genre mix
- studioCreditFromMarkets › is the sum of each market at its keep, and never negative

</details>

<details><summary><code>marketSettlement.test.ts</code> — 13 tests</summary>

- settleTheatricalMarket - rival release resolution › a due rival production resolves into a Film tagged with its own studio name, and is removed from stillInProgress
- settleTheatricalMarket - rival release resolution › an unresolvable rival studio id (defensive) still resolves the production, falling back to a generic studio name
- settleTheatricalMarket - rival release resolution › a not-yet-due rival production is left untouched in stillInProgress
- settleTheatricalMarket - player and rival settle together, correctly attributed › a player release and a rival release due in the same pass both settle, split correctly by owner
- settleTheatricalMarket - player and rival settle together, correctly attributed › a rival's cashCredit/brandDelta/prestigeDelta land only on its own studio's rivalDeltas entry, never on the player's own totals or another rival's
- settleTheatricalMarket - player and rival settle together, correctly attributed › a released player film and a released rival film both keep settling their own ongoing box office in the same later pass, still correctly attributed
- settleTheatricalMarket - press tour reputation write-back (D2b) › returns a baseline heat delta for each tourer of a settled player film, and none when no tour ran
- settleTheatricalMarket - press tour reputation write-back (D2b) › a window-resolved incident (interactive) drives settlement instead of a fresh roll
- settleTheatricalMarket - cross-owner competitive crowding at release › a rival's own crowded release day is dented by a same-genre/audience player release already on the calendar, and vice versa - crowding sees across owners now, not just within one
- settleTheatricalMarket - big jump consistency across player and rival together › a multi-week jump settling a player release, a rival release, and their ongoing box office together matches the same span done as several smaller calls
- settleTheatricalMarket - resolved post-production intervention accounting (architecture cleanup) › carries FilmDraft.postProductionEvents over onto the released Film verbatim, and folds its cost into results.totalCost for reporting
- settleTheatricalMarket - resolved post-production intervention accounting (architecture cleanup) › does not charge the intervention's cost again at settlement - playerCostCharged is identical whether or not it's present, since it was already deducted from studio.cash immediately at resolution
- settleTheatricalMarket - resolved post-production intervention accounting (architecture cleanup) › a resolved intervention's quality/buzz reach the released film's scoring, combined with any on-set events, without a parallel scoring system

</details>

<details><summary><code>releaseCrowding.test.ts</code> — 14 tests</summary>

- computeCompetitiveCrowding › is 0 with no known competitors
- computeCompetitiveCrowding › is 0 for a competitor far enough away in time to no longer matter
- computeCompetitiveCrowding › is higher for a same-genre, same-day, full-strength competitor than a different-genre one at the same day/strength
- computeCompetitiveCrowding › a matching targetAudience adds on top of a matching genre
- computeCompetitiveCrowding › decays with distance in time - a same-genre competitor a week away scores higher than one a month away
- computeCompetitiveCrowding › scales with the competitor's own strength
- computeCompetitiveCrowding › saturates at 1 rather than compounding past it with many strong, close, same-genre competitors
- computeCompetitiveCrowding › never returns a negative number
- computeRivalReleaseStrength / computePlayerReleaseStrength - comparable 0-1 proxies › both stay within [0, 1] across a wide range of inputs
- computeRivalReleaseStrength / computePlayerReleaseStrength - comparable 0-1 proxies › a Big-scale rival with heavy marketing scores higher than a Small-scale rival with light marketing
- computeRivalReleaseStrength / computePlayerReleaseStrength - comparable 0-1 proxies › a bigger player production (marketing + budget) scores higher than a tiny one
- computeRivalReleaseStrength / computePlayerReleaseStrength - comparable 0-1 proxies › a maxed-out rival and a maxed-out player land in roughly the same strength range - the two proxies are comparable, not biased toward one side
- computeRivalReleaseStrength / computePlayerReleaseStrength - comparable 0-1 proxies › a strong genre identity lifts an on-brand release above the same release with none - and boost-only, never below
- studio identity as competitor territory - rivals steer around a strong incumbent › a same-genre incumbent with a home-genre identity crowds a challenger more than an identity-less one

</details>

<details><summary><code>scheduledReleases.test.ts</code> — 7 tests</summary>

- settleTheatricalMarket - player release resolution (roadmap Phase 7.2) › leaves a not-yet-due release untouched
- settleTheatricalMarket - player release resolution (roadmap Phase 7.2) › resolves a due release into a Film that keeps the exact id its draft carried
- settleTheatricalMarket - player release resolution (roadmap Phase 7.2) › a big jump past releaseDay resolves the same film, on the same scheduled day, as a jump that lands exactly on it
- settleTheatricalMarket - player release resolution (roadmap Phase 7.2) › resolves several due releases in the same pass, each keeping its own id
- settleTheatricalMarket - player release resolution (roadmap Phase 7.2) › a higher studioBrand at resolution time (not scheduling time) measurably changes the outcome - proves results are computed fresh on release day, not frozen at SCHEDULE_RELEASE
- asUpcomingRelease - player identity as home-turf territory › an on-brand scheduled release reads as a stronger presence than the same release with no identity
- asUpcomingRelease - player identity as home-turf territory › a rival opening in the player home genre feels more crowding against an on-brand incumbent than an identity-less one

</details>

### 9.2 Calibration diagnostics (opt-in, currently red)

```bash
BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeDistribution.diagnostic.test.ts --disable-console-intercept
BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/buzzCalibration.diagnostic.test.ts       --disable-console-intercept
BOX_OFFICE_DIAGNOSTIC=1 npx vitest run src/engine/boxOfficeVariance.diagnostic.test.ts     --disable-console-intercept
```

#### Whole-year distribution & profitability — **FAIL** (9 of 17 metrics out of band)

Harness: 6 seeds × 8 in-game years, driving the real settlement loop. 1,167 films
(579 wide, 363 limited).

```
  metric                     measured   target
  FAIL wideMedianGrossM          74.1   [90, 130]
  FAIL wideMeanGrossM           139.2   [170, 230]
  FAIL wideUnprofitablePct       44.6   [45, 55]
  PASS wideOver100Pct            44.4   [40, 50]
  FAIL wideOver500Pct             2.8   [5, 8]
  FAIL wideOver1000Pct            0.0   [1, 2]
  FAIL top10SharePct             31.7   [40, 50]
  PASS wideRunWeeks               6.6   [5, 8]
  PASS limitedRunWeeks           20.0   [10, 20]
  PASS wideOpeningMultiple        2.2   [2, 3]
  FAIL limitedOpeningMultiple    12.9   [5, 12]
  PASS bombPct                   11.6   [10, 20]
  FAIL lossPct                   43.2   [25, 35]
  PASS breakevenPct              10.6   [8, 16]
  PASS modestPct                 25.6   [20, 30]
  FAIL majorPct                   8.1   [10, 20]
  FAIL blockbusterPct             0.9   [1, 6]
```

Reading: the **distribution is compressed toward the bottom.** Wide run length and
opening multiple are in band, and so is the share over $100M, but the median and
mean are both below target and **the top tail is missing entirely** — no film in
1,167 crossed $1B, only 2.8% crossed $500M, and the top 10 take 32% of the year
rather than 40–50%. The failure side has the mirror problem: too many mid-range
losses (43.2% vs 25–35%), too few major hits (8.1% vs 10–20%) and almost no
studio-changing blockbusters (0.9%). Note `limitedRunWeeks` "passes" at exactly
20.0 only because every limited run hits the hard cap (§8.4).

#### Buzz bands and non-purchasability — **PASS**

```
BUZZ FIXTURES
  fixture                         buzz   band
  PASS Ordinary studio action film  49.1   [48, 58]
  PASS Well-marketed star vehicle   69.1   [62, 72]
  PASS Successful horror sequel     61.7   [58, 68]
  PASS Marvel-style tentpole        87.3   [80, 90]
  PASS Barbie                       96.3   [90, 97]
  PASS The Force Awakens            97.6   [96, 99]
  PASS Avengers: Endgame            98.6   [98, 100]

NON-PURCHASABILITY (marketing alone, must stay < 75)
  PASS max mktg / nobodies / unknown studio    10.0
  PASS max mktg / nobodies / mid brand         30.7
```

Buzz is calibrated and is not purchasable with money alone. But note from §3.1
that buzz feeds **only** `conversionPacingBaseline` — and that term is clamping at
1.0 for a third of Wide releases, so a large part of the buzz scale currently has
no mechanical effect on those films.

#### Outcome variance — **FAIL** (all 5 bands out of band)

Harness: one fixed production plan (a Medium Fantasy), resolved 240 times,
letting only the production/execution path vary, then settled to completion.
Median gross $19M.

```
  band                    share%   target
  FAIL significantly under     0.0   [8, 22]
  FAIL modestly under          0.0   [22, 38]
  FAIL as expected           100.0   [22, 38]
  FAIL modestly over           0.0   [12, 28]
  FAIL breakout                0.0   [1, 12]
  coefficient of variation: 0.010 (near 0 = deterministic)
```

Reading: **a fixed plan is currently deterministic.** Every one of the 240
resolutions lands within ±15% of the median and nothing ever breaks out.
Execution variance exists
in the production pipeline but is not reaching the finished film's scores with
enough amplitude to move box office, and there is (by design) no release-time dice
roll to compensate. This is the single largest behavioural gap.

**Architectural constraint on any fix:** variance must stay **endogenous** — it
must emerge from how the production went and from the market a film releases
into. Identical pre-production inputs re-scored must still yield the identical
film. Injecting box-office randomness is explicitly rejected by the project's
simulation philosophy.

---

## 10. The ratified calibration targets

These are already agreed and encoded in
`docs/DESIGN_box_office_calibration_targets.md`; the diagnostics above assert
them. They are the specification the model is judged against.

**Guiding principle: shrink *activation*, not the market.** Keep a large
theoretical audience so phenomena stay possible; make it harder for an ordinary
film to activate it.

**Per-film targets (worldwide gross):**

| Archetype | Target WW | Target opening | Target legs |
|---|--:|--:|--:|
| Invisible / dumped wide | $5–25M | — | 2–2.5× |
| Below-average wide | $40–90M | $20–40M | 2.5–3× |
| Average wide commercial | $90–160M | $35–60M | 2.5–3.5× |
| Strong commercial / mid tentpole | $300–500M | $90–160M | 3–3.5× |
| Major blockbuster | $600M–1B | $180–320M | 2.5–3.5× |
| Rare cultural phenomenon | $1B–2.5B+ | $350–600M | 2.5–4× |
| Indie drama (Limited/platform) | $8–45M | $1–4M | 6–15× |
| Horror cheapie (Wide) | $40–120M | $15–40M | 3–5× |

**Whole-year targets over Wide releases:** median $90–130M, mean $170–230M,
45–55% losing money all-in, 40–50% over $100M, 5–8% over $500M, 1–2% over $1B,
top-10 taking 40–50% of the annual box office.

**Profitability over all films** (return multiple = studio cash ÷ all-in cost):
bomb <0.4× ~15%, loss 0.4–1.0× ~30%, break-even 1.0–1.25× ~12%, modest 1.25–2.5×
~25%, major hit 2.5–5× ~15%, studio-changing >5× ~3%. Roughly 45% unprofitable.

**Outcome spread for a fixed average commercial plan:** significantly under ~15%,
modestly under ~30%, as expected ~30%, modestly over ~20%, breakout ~5%.

**Competition (§7 of that document, not yet built):** competition should act at
two levels — exhibition (screens, which must be able to fall *below* demand) and
attention (awareness, urgency, discretionary spend, weighted by audience overlap,
so counter-programming works). One shared relative-strength matchup primitive
should serve both theatrical settlement and AI scheduling.

---

## 11. What we would most like your view on

Not a request for a tuning pass — a request for structural criticism. Concretely:

1. **The missing top tail.** No film in 1,167 crossed $1B, and only 2.8% crossed
   $500M, and the whole distribution sits below its targets. Which term in the funnel is capping
   the top? Candidates we can see: the `CROSSOVER_CAPACITY_CEILING = 0.3` hard
   cap; the disabled franchise multiplier; `MAX_WEEKLY_THROUGHPUT_FRACTION = 0.5`
   and the availability anchor; the 20-week run cap; the narrow reception range
   AI films produce. Which matters most, and is any of it the wrong *shape*
   rather than the wrong *number*?

2. **Deterministic outcomes** (coefficient of variation 0.010 — 240 of 240 resolutions inside ±15%). Given the
   hard constraint that variance must be endogenous and identical inputs must
   re-score identically, where should the amplitude come from? Our current
   suspicion is that reception (`criticScore`/`audienceScore`) is too tightly
   determined by the plan, but we would like a second opinion on whether the box
   office model itself is also over-damped — e.g. whether the two ceilings and
   the saturating pull-forward flatten the outcome space regardless of input
   spread.

3. **Inert competition.** Mean attention pressure of 0.031 across 862 film-weeks.
   Is the crowding formula's shape wrong (proximity × genre overlap × strength,
   summed and clamped), the weights too small, or is the real problem that
   exhibition capacity can never fall below demand so screens never actually
   become scarce?

4. **Awareness.** Word of mouth creates no awareness at all, and external
   awareness decays at `0.55^(week-1)` — effectively dead by week 4. Is
   "awareness is set on release day and only decays thereafter" defensible, or is
   that why legs are short and the top tail missing?

5. **The pacing clamp.** A third of Wide releases have
   `conversionPacingBaseline` clamped at exactly 1.0, meaning every interested
   person attends in week one and buzz above a certain point does nothing. Is the
   multiplicative chain the wrong composition?

6. **The tests themselves.** Are the ratified targets in §10 the right things to
   measure? Is `limitedRunWeeks` passing at exactly the cap a sign the metric is
   badly chosen? What would you add — per-genre distributions, seasonality,
   opening-weekend share, week-2 drop, anything the current harnesses miss?

7. **Anything structurally missing.** Repeat viewing, per-market audiences,
   screen counts as a real scarce resource, premium formats, day-and-date
   effects, awards-season legs — what would you prioritise, and what would you
   deliberately leave out?
