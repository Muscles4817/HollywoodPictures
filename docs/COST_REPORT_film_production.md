# Cost Report: End-to-End Film Production (Min/Max)

Reference doc for balance tuning. Every dollar lever the game exposes,
where it lives in code, and the min/max value it can take. All amounts are
in-game currency. File:line references are current as of this report's
writing — re-verify before relying on them if the code has moved.

There are **no discrete budget tiers** (no "indie/B-movie/blockbuster"
presets) anywhere in the cost model. Every dial below is a continuous
log-scale slider or formula between a `min` and a `max`. The "Difficulty"
picker (§7) only sets *starting cash*, not any film's cost.

---

## 1. Script Acquisition

Paid once, immediately, at `ACQUIRE_OPPORTUNITY`
(`src/state/studioReducer.ts:254-260`). **Not** part of `totalCost` in
§8 — deliberately excluded to avoid double-charging
(`src/engine/releaseFilm.ts:104-110`).

**Underlying script cost** — `src/engine/scriptGenerator.ts:209-216`,
`estimateScriptCost()`:

```
avgQuality  = (originality + structure + dialogue + characters) / 4
complexityMultiplier = 1 + (complexity / 100) * 0.3
cost = round( (50,000 + avgQuality * 6,000) * scaleMultiplier * complexityMultiplier / 1000 ) * 1000
```

- `scaleMultiplier` — `src/data/scale.ts:20-33`: Intimate **0.55**, Medium **1.0**, Epic **1.9**
- Quality axes (`originality/structure/characters/dialogue/complexity`) are rolled
  per script archetype, `src/data/scriptArchetypes.ts:50-95` (5 archetypes:
  Prestige, CrowdPleaser, Spectacle, OriginalVision, GenreFormula)

| | avgQuality | complexity | scaleMultiplier | script.cost |
|---|---|---|---|---|
| Min | 31.25 (GenreFormula) | 15 | 0.55 (Intimate) | **£137,000** |
| Max | 92.5 (OriginalVision) | 70 | 1.9 (Epic) | **£1,391,000** |

**Acquisition cost** — `src/engine/opportunities.ts:14-19,43`:

```
acquisitionCost = round(script.cost * SOURCE_COST_MULTIPLIER[source])
```

`SOURCE_COST_MULTIPLIER`: Studio Original **0.1**, Spec Screenplay **0.4**,
Agent Package **0.9**, Publisher Rights **1.1**

| | script.cost | source | multiplier | acquisitionCost |
|---|---|---|---|---|
| Min | £137,000 | Studio Original | 0.1 | **£13,700** |
| Max | £1,391,000 | Publisher Rights | 1.1 | **£1,530,100** |

---

## 2. Talent (Cast & Crew Salaries)

Charged in full, upfront, at `GREENLIGHT_PROJECT`
(`src/state/studioReducer.ts:510-513`).

**Salary ranges** — `src/data/talentGeneration.ts:16-25`,
`ROLE_GENERATION_PROFILES`:

| Role | Min salary | Max salary | Fame ceiling | Headcount |
|---|---|---|---|---|
| Director | £50,000 | £12,000,000 | 98 | 1 |
| Lead Actor | £40,000 | £15,000,000 | 98 | 1–5 (script-dependent) |
| Supporting Actor | £20,000 | £4,000,000 | 85 | 0–7 (script-dependent) |
| Writer | £15,000 | £2,000,000 | 55 | 1 |
| Cinematographer | £25,000 | £6,000,000 | 62 | 1 |
| Composer | £15,000 | £2,500,000 | 60 | 1 |
| Editor | £10,000 | £1,200,000 | 45 | 1 |
| VFX Supervisor (optional) | £30,000 | £5,000,000 | 65 | 0–1 |

Sampling: `src/engine/talentGenerator.ts:102-104` — log-scale position `t`
stratified across a 100 (200 for Lead/Supporting) candidate pool per role.

**Headcount** for Lead/Supporting is set by the chosen script, not a fixed
1–4 slider — `src/engine/castRequirements.ts:13-19`:

```
requiredLeads      = max(1, round(pick([1,1,1,1,1,2,2,2,3]) * castMultiplier))
requiredSupporting = max(0, round(pick([1,2,2,3,3,3,4]) * castMultiplier))
castMultiplier = storyType.castSizeMultiplier * scriptScale.castMultiplier
```

`storyType.castSizeMultiplier` — `src/data/storyTypes.ts` — ranges
**0.15** (Documentary) to **1.3** (Heist). `scriptScale.castMultiplier` —
`src/data/scale.ts` — ranges **0.8** (Intimate) to **1.25** (Epic). In rare
RNG tails this pushes required leads up to ~5 and supporting up to ~7.

**Total** — `src/engine/cost.ts:6-8`, flat sum of hired salaries:

| Scenario | Min | Max |
|---|---|---|
| Standard cast (1 Lead, 0 Supporting, one each other role, no VFX Sup) | **£155,000** | — |
| Standard cast, all salaries at ceiling (1 Lead, 4 Supporting, VFX Sup included) | — | **£59,700,000** |
| Script-scaled extreme tail (5 Leads, 7 Supporting, all at ceiling) | — | **£131,700,000** |

---

## 3. Production Budget (Sets, Practical Effects, VFX, Contingency, Runtime)

Four independent log-scale dollar dials — `src/data/production.ts`:

| Dial | Line | Min | Max |
|---|---|---|---|
| `SET_QUALITY_RANGE` | `production.ts:39` | £20,000 | £3,000,000 |
| `PRACTICAL_EFFECTS_RANGE` | `production.ts:47` | £10,000 | £2,500,000 |
| `VFX_RANGE` | `production.ts:55` | £5,000 | £12,000,000 |
| `CONTINGENCY_RANGE` | `production.ts:11` | £100,000 | £40,000,000 |

Each is set via `logAmount(t, range)` (`src/engine/interpolate.ts:21-24`)
where `t` derives from `environmentAmbition` / `effectsAmbition × strategy
split` (`src/engine/productionChoicesAdapter.ts:38-40`) — all independently
reachable at their full range simultaneously.

**Runtime cost multiplier** — `RUNTIME_ANCHORS`, `production.ts:64-77`:
Short **0.85×**, Standard **1.00×**, Long/Epic **1.15×**.

**Production budget cost** — `src/engine/cost.ts:19-22`:

```
productionBudgetCost = round((setQualityAmount + practicalEffectsAmount + vfxAmount) * runtimeCostMultiplier)
```

| | Set | Practical | VFX | Runtime | productionBudgetCost |
|---|---|---|---|---|---|
| Min | £20,000 | £10,000 | £5,000 | 0.85 | **£29,750** |
| Max | £3,000,000 | £2,500,000 | £12,000,000 | 1.15 | **£20,125,000** |

**Contingency** (£100,000–£40,000,000) is charged upfront at greenlight
alongside the above, then spent as a **daily burn** during the shoot and
settled (refund or overrun charge) at `FINISH_PHOTOGRAPHY`
(`studioReducer.ts:763-768`) — see §4.

---

## 4. Principal Photography — Daily Burn & On-Set Events

**Recommended shoot length** — `src/engine/production.ts:26-48`:

```
BASE_SHOOT_DAYS = 18
recommendedDays = round(18 + complexity/100*35 + clamp((castSize-6)*1.5, 0, 12) + runtimeIntensity*12 + (practicalEffectsT+vfxT)*7.5)
```

Ranges roughly **18–72+ days** depending on complexity/cast/runtime/effects.

**Daily contingency burn** — `src/engine/cost.ts:32-34`:

```
dailyBurn = recommendedDays > 0 ? contingencyAmount / recommendedDays : contingencyAmount
```

The actual cost charged (`photographyCost`) is the cumulative burn
actually incurred. **This has no upper bound** — shooting past
`recommendedDays` keeps burning at the same daily rate indefinitely
(explicit design comment, `cost.ts:24-34`, `production.ts:106-119`).
Wrapping on day 0 is legal (no minimum-day gate,
`src/components/wizard/ProductionRun.tsx:249-254`) and yields £0 burn plus
a full contingency refund.

| | Value |
|---|---|
| Theoretical floor (wrap day 0) | **£0** |
| Practical floor (full min-contingency schedule run to completion) | **£100,000** |
| Ceiling | **Unbounded** — the only uncapped cost lever in the game |

**On-set random events** — `src/data/productionEvents.ts` (1704 lines),
rolled daily via `rollDayEvent` (`src/engine/production.ts:354-421`) at a
**12%–27%** daily chance (`MIN/MAX_DAILY_EVENT_CHANCE`,
`production.ts:289-290`), scaled by average risk. Each event/choice rolls
`costDelta = round(randFloat(costMin, costMax))`
(`production.ts:130,153`). No template repeats within one shoot.

Representative ranges: positive (cost-saving) events **-£400,000 to £0**;
negative events **£0 to +£1,200,000**. Recast/replacement disruption cost
(`production.ts:220-278`): `severance = departing.salary * 0.4 +
newHire.salary * 0.3` — scales directly with talent salaries.

**Theoretical ceiling on cumulative event cost in one shoot** (sum of every
unique negative template's max, since none repeat):

| Source | Max |
|---|---|
| Generic negative pool | ≈ £5,370,000 |
| Matching genre negative template | up to £1,200,000 |
| 5 risk-dimension negative banks (schedule/morale/safety/technical/budget) | ≈ £13,970,000 |
| **Combined theoretical max** | **≈ £20,540,000** |

(Bounded by the finite template catalog — unlike the daily burn above,
which is truly unbounded.)

---

## 5. Post-Production

`src/data/postProduction.ts`. Edit Style, Music Focus, and Final Cut Focus
are **free** — they only move critic/audience/buzz deltas, no dollar cost.
The only cost line is **Test Screening Response**
(`TEST_SCREENING_PROFILES`, lines 24-40):

| Option | Cost | qualityDelta |
|---|---|---|
| Ignore | £0 | -5 |
| Minor Changes | £250,000 | +8 |
| Major Changes | £1,000,000 | +15 |

Range: **£0 – £1,000,000**.

---

## 6. Marketing & Distribution

**Marketing spend** — `src/data/release.ts:72`,
`MARKETING_SPEND_RANGE = { min: 10,000, max: 150,000,000 }`, log-scale
slider.

**Release type cost multiplier** — `RELEASE_TYPE_PROFILES`,
`release.ts:51-64`:

| Release Type | costMultiplier | criticBonus |
|---|---|---|
| Limited | 0.5 | +2 |
| Festival First | 0.7 | +6 |
| Wide | 1.2 | 0 |

**Marketing cost** — `src/engine/cost.ts:42-45`:

```
marketingCost = round(marketingSpend * RELEASE_TYPE_PROFILES[releaseType].costMultiplier)
```

| | spend | release type | multiplier | marketingCost |
|---|---|---|---|---|
| Min | £10,000 | Limited | 0.5 | **£5,000** |
| Max | £150,000,000 | Wide | 1.2 | **£180,000,000** |

---

## 7. Studio Difficulty Tiers (starting cash only — not a film-cost tier)

`src/components/common/DifficultyPicker.tsx:13-18`:

| Tier | Starting Cash |
|---|---|
| Grassroots Indie | £1,000,000 |
| Indie | £3,000,000 |
| Mid-Level | £10,000,000 |
| Major Studio | £25,000,000 |

Default/fallback: `DEFAULT_STARTING_CASH = 10,000,000`
(`src/state/persistence.ts:153`). This gates what a player can *afford*, it
does not cap or floor any individual cost formula above.

---

## 8. Aggregate Formula

`src/engine/releaseFilm.ts:100-116`:

```
talentCost            = computeTalentCost(talent)                             // §2
productionBudgetCost  = computeProductionBudgetCost(productionChoices)        // §3
photographyCost       = actual contingency burn incurred                      // §4, uncapped
eventsCostDelta       = sum of all on-set event costDeltas                    // §4
testScreeningCost     = TEST_SCREENING_PROFILES[choice].cost                  // §5

productionCost = max(0, talentCost + productionBudgetCost + photographyCost + eventsCostDelta + testScreeningCost)
marketingCost  = computeMarketingCost(marketingChoices)                       // §6
totalCost      = productionCost + marketingCost   // = FilmResults.totalCost
```

Paid separately, earlier, and **not** included in `totalCost`:

```
scriptAcquisitionCost = round(script.cost * SOURCE_COST_MULTIPLIER[source]) // §1
```

**True end-to-end cost = scriptAcquisitionCost + totalCost.**

### Minimum possible (all levers at floor, minimal standard cast)

| Component | Value |
|---|---|
| Script acquisition | £13,700 |
| Talent (Dir, Lead, Writer, DP, Composer, Editor; 0 Supporting, no VFX Sup) | £155,000 |
| Production budget (Set+Practical+VFX floor × runtime 0.85) | £29,750 |
| Photography burn (degenerate: wrap day 0) | £0 |
| Events cost delta | £0 (no shoot days = no rolls) |
| Test screening | £0 (Ignore) |
| Marketing (min spend × Limited 0.5×) | £5,000 |
| **Degenerate floor total** | **≈ £203,450** |
| **Realistic floor** (full min-contingency £100k actually burned over a completed shoot) | **≈ £303,450** |

### Maximum possible (all levers at ceiling, standard cast)

| Component | Value |
|---|---|
| Script acquisition | £1,530,100 |
| Talent (Dir, Lead, 4× Supporting, Writer, DP, Composer, Editor, VFX Sup — all at ceiling) | £59,700,000 |
| Production budget (Set+Practical+VFX ceiling × runtime 1.15) | £20,125,000 |
| Photography burn | **unbounded** |
| Events cost delta (finite template ceiling) | ≈ £20,540,000 |
| Test screening | £1,000,000 (Major Changes) |
| Marketing (max spend × Wide 1.2×) | £180,000,000 |
| **Bounded-components total** | **≈ £282,895,100** |
| **True max** | **Unbounded** — driven entirely by how long the player keeps shooting past `recommendedDays` |
| Script-scaled cast extreme variant (5 Leads / 7 Supporting, swaps talent line to £131,700,000) | pushes bounded total to **≈ £354,895,100** |

---

## 9. Randomization / Variance Sources

| Source | File:Line | Mechanism |
|---|---|---|
| Talent salary sampling | `talentGenerator.ts:104` | log-scale `t`, stratified across 100/200-candidate pool |
| Script quality attributes | `scriptGenerator.ts:234-236,252-256` | uniform `randIntRange` within archetype's quality range |
| Lead/Supporting count | `scriptGenerator.ts:194-195,277-278` | weighted-repetition pick × castMultiplier |
| Production events | `production.ts:121-135,144-158` | `randFloat(min,max)` per template/choice, rerolled daily at 12–27% chance |
| Opportunity batch size/expiry | `opportunities.ts:22-33` | `randInt` over `[min,max]` day/count ranges |
| RNG engine | `random.ts:7-16` | seeded Mulberry32 — deterministic given seed |

No cost formula applies a blanket `cost * (0.8–1.2)`-style multiplier.
Variance is either explicit `[min,max]` roll ranges (events) or the
underlying stat rolls (quality/complexity/salary position `t`) that feed
the deterministic formulas above.

---

## 10. Notes for Balance Tuning

1. **The daily contingency burn is the only truly uncapped cost in the
   game** (`cost.ts:32-34`, `production.ts:106-119`). Every other dial is
   range-bounded; this one scales linearly with however long the player
   keeps shooting past `recommendedDays`, with no ceiling. If "max possible
   cost" should be a real number rather than "unbounded," this is the
   formula to cap.
2. **Script acquisition cost is deliberately excluded from `totalCost`**
   (`releaseFilm.ts:104-110`) to avoid double-charging. Keep this in mind
   when comparing any in-game "total cost" readout to the true end-to-end
   number in §8.
3. **Insurance, permits, and studio rental are not separate line items** —
   they're folded into the Contingency dial's flavor text only
   (`production.ts:23`), not modeled as distinct costs.
4. **Edit Style, Music Focus, and Final Cut Focus are entirely free** —
   only Test Screening has a real post-production dollar cost. Worth a
   look if post-production is meant to be a meaningful budget category.
5. **Cast size can exceed the UI's advertised 1–4 Supporting Actor range**
   via `script.requiredLeads`/`requiredSupporting` scaling with story type
   × scale (`castRequirements.ts`, `scriptGenerator.ts:276-278`), producing
   the £131.7M talent-cost tail case. Worth checking whether that's
   intended or an unbounded edge case worth clamping.
6. **`FilmResults.productionCost` floors at 0**
   (`Math.max(0, ...)`, `releaseFilm.ts:111`) even though components like
   events or contingency settlement can go negative — so a film can show
   £0 production cost on paper despite real spend elsewhere in the
   pipeline.
