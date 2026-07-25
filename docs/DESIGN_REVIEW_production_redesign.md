# Production Redesign — Design Spec (v0.1 draft)

> Status: **draft, in discussion.** Captures the agreed direction so we don't
> lose detail. Open decisions are marked **OPEN**. Numbers here are shapes, not
> final tuning. This document is the "step 1" of the rollout plan in §12.

---

## 1. Problem

`engine/scoring.ts:computeProductionScore` is a **static weighted sum of spend**:
`contingencyQuality × 0.35 + shootingRatio-style × 0.25 + setQuality × 0.20 +
effects × 0.20`. It is **monotonic in money** — spend more, score more,
deterministically — and the single "Contingency Reserve" dial (really the
Shooting Budget, `data/production.ts:26`) carries 35% of it while being
mislabelled and unexplained.

Worse: **Production has no execution content of its own.** The on-set execution
layer (`engine/productionExecution.ts`) routes performance events → Acting,
rewrites → Script, and even *visual/technical* events → **Post-Production**.
Production is the one department that is pure spend readout. So there is nothing
for the player to be *skilful* at, and none of the four outcomes below are
reachable through Production.

## 2. Design goals

The player must be able to reach every corner of this 2×2 **for legible
reasons**:

|                    | Poorly realised            | Well realised              |
| ------------------ | -------------------------- | -------------------------- |
| **High spend**     | spend lots, bungle it      | spend lots, look amazing   |
| **Low spend**      | spend little, look cheap   | spend little, look amazing |

Plus: the planning UX should make the player feel **empowered**, give
**qualitative** (not numeric) feedback, and present genuine **trade-offs** — no
strictly-dominant choice.

## 3. Core model

### 3.1 Three inputs, one target

Every **facet** (§4) has an **ambition target** `A` (0–100): what the *script*
plus the player's *creative choices* demand of it (a VFX-heavy tentpole has high
VFX ambition; a chamber drama has low VFX but high cinematography/design-subtlety
ambition). Hitting `A` takes **work**, and work is produced by three inputs:

- **Money `M`** — the facet's budget. Raises the ceiling; buys work *fast*.
- **Time `T`** — days granted in the facet's phase (§6). Buys work *slowly*.
- **Skill `S`** — the department head's rating. **Multiplies** what a given `M`
  and `T` produce, and can push realisation past 1.0 (over-delivery).

### 3.2 The central principle: money = speed, skill + time = the cheap road — *within limits set by ambition*

Skill does **not** substitute for money directly. It substitutes **through
time**. A brilliant Production Designer *can* match a lavish build on a fraction
of the budget — but they need the prep weeks to do it. Rush them cheap → it looks
like a set; give them time → they find the clever solution.

**But substitution is bounded, and ambition sets the bounds.** More money does
not scale endlessly into perfect work in miniscule time, and more time + skill
does not scale endlessly into a spectacle for pennies. Both `moneyWork` and
`timeWork` have **diminishing returns**, and — critically — each has an
**ambition-scaled floor**:

- **Money floor `M_floor(A)`** — below it, no amount of time or skill reaches the
  ceiling. A convincing space battle has a hard minimum spend; you cannot be
  clever your way under it. (This is what keeps money meaningful and makes
  spectacle genuinely require budget.)
- **Time floor `T_floor(A)`** — below it, no amount of money reaches the ceiling.
  Complex work takes calendar time; a rushed tentpole with all the money in the
  world still can't hit its mark. (This is what keeps *time* meaningful and makes
  a rushed shoot genuinely risk the film regardless of budget.)

Between the floors, money and time trade off (money = speed; skill + time = the
slow, cheap road). Skill shifts the *efficiency* curves — an elite head needs
less of both, and can push realisation past 1.0 — but **skill does not remove the
ambition floors.**

So — resolving the "should cheap fully match expensive?" question — **it depends
entirely on the ambition of the project:**
- **Low / moderate ambition** → the floors sit low, so cheap + skilful + patient
  can *fully match* expensive + fast. The price of going cheap is time and its
  downstream risks (later release, extended talent holds, more daily burn, rivals
  crowding), not a quality cap. "Clever + patient + cheap" is a real identity.
- **High ambition (spectacle scale)** → the floors sit high. There is a mandatory
  minimum of *both* money and time; skill lets you exceed the baseline, never
  duck under it. A tentpole genuinely requires money **and** time **and** skill.

Ambition is therefore the master dial: it sets the ceiling, the risk, *and* how
much substitution between money and time is even possible.

### 3.3 Stretch → variance; overreach is a SWING, not a wall

**Stretch** = ambition `A` relative to the resources committed (`M` + `T`'s
work). 

- **Low stretch** (well-funded for the ambition) → a **tight** outcome band near
  the funded level. Dependable, rarely spectacular.
- **High stretch** (attempting more than you've comfortably funded) → a **wide**
  outcome band, and **skill biases where in the band you land**. An elite team
  on an under-funded, ambitious plan is a genuine boom-or-bust bet worth taking;
  the same plan with a weak team is just a bust.

So overreach is never a warning you simply avoid — it is a gamble whose odds you
set by *who you hired*. (Same shape as the acting model: ambition widens the
distribution; skill/preparation buys the upside of that widening.)

### 3.4 Math sketch (shape, not final)

Per facet, roughly:

```
workRequired   = curve(A)                          # higher ambition => more work
M_floor, T_floor = floors(A)                        # ambition-scaled minimums (§3.2)
# Each input's contribution is CONCAVE (diminishing returns) and GATED below its floor:
moneyWork = M < M_floor ? starved(M) : concave(M)   # can't reach full work below the floor
timeWork  = T < T_floor ? starved(T) : concave(T)   # ditto
workDelivered = S01 * combine(moneyWork, timeWork)  # money higher per-unit rate => money = speed
realisation   = clamp(workDelivered / workRequired, 0, ~1.1)
stretch       = clamp(workRequired / (workDelivered + eps) - 1, 0, 1)   # >0 when under-resourced
facetCeiling  = lerp(COMPETENT, SPECTACULAR, A01)   # ambitious facets can score higher when realised
facetQuality  = facetCeiling * realisation  +  executionSwing(stretch, S, onSetEvents)
```

- **Diminishing returns** on both `moneyWork` and `timeWork` (concave curves):
  past a point, more of either barely moves the work done — no endless scaling to
  perfection.
- **Ambition floors** (`M_floor`, `T_floor`): below either floor the input is
  "starved" and `realisation` can't reach 1 no matter the other input or skill.
  Low-ambition facets have low floors (full substitution / full match possible);
  high-ambition facets have high floors (both money and time are mandatory).
- `moneyWork` has a higher per-unit rate than `timeWork` → **money = speed**
  (fewer days to reach `workRequired`), time = the slow substitute — but only
  *above* the floors.
- **Skill `S01`** scales efficiency (needs less of both, can exceed 1.0) but does
  **not** lower the floors.
- `executionSwing` is centred at 0 for low stretch and fans out (skill-biased) as
  stretch rises — the endogenous variance, realised by the **re-routed visual/
  technical on-set events** (§10).
- **Ingenuity** (cheap + amazing) is not a separate term — it falls out of high
  `S` × high `T` compensating for low `M` *when the ambition floors permit it*, so
  `realisation` still reaches ~1 on low/moderate-ambition facets but is capped on
  spectacle-scale ones.

**OPEN:** exact curves — floor heights vs ambition, concavity of each input, the
money/time rate ratio, how wide `executionSwing` fans, and the facet-ceiling span.

## 4. Facet catalogue

| Facet | Head | Head type | Time from phase | Money lever | Ambition driven by |
| --- | --- | --- | --- | --- | --- |
| **Sets & Design** | Production Designer | person *(new role)* | Pre-production | set budget | setting archetype, scale, script |
| **Cinematography / Look** | Cinematographer | person *(exists, ~inert today)* | Filming | shoot resources | tone, setting, genre |
| **Practical Effects / Stunts** | Stunt Team | **team/vendor** *(new)* | Filming (+ previs in pre) | practical budget | action/spectacle demands |
| **Visual Effects** | VFX Supervisor | person *(exists, ~inert today)* | Post-production | VFX budget | vfx importance (genre/script) |
| **Score** | Composer | person *(exists)* | Post-production | *(no dial today — **OPEN**)* | tone/genre |
| **Edit / Pacing** | Editor | person *(exists)* | Post-production | *(no dial — largely modelled already)* | complexity/runtime |

Notes:
- **Sets, Cinematography, Practical/Stunts** are the **Production** cluster
  (time from pre-production + filming). **VFX, Score, Edit** are the
  **Post-Production** cluster (time from post). The same model spans both — they
  differ only in which phase supplies their time. This unifies Production and
  Post-Production under one system.
- This gives the currently-near-inert Cinematographer and VFX Supervisor skills a
  real job (Principle 7 — wire existing signals in, don't invent parallel ones).

**OPEN:** final facet list & granularity. Six is rich; do we ship all six or
start with a core (Sets / Look / Effects) and fold Score/Edit in later? Do Score
and Effects get their own money dials, or share the shoot/post budget?

## 5. Department heads

### 5.1 Named creatives (person)
Hired individuals with a **skill** rating (sets money/time efficiency), a salary,
availability, and — eventually — personality (a perfectionist DP asks for more
time; a pragmatic one delivers lean). They speak as collaborators.

Roles to **add**: **Production Designer**. Roles to **wire in** (skill currently
does almost nothing): Cinematographer, VFX Supervisor.

### 5.2 Contracted teams / vendors
Not a person — a **unit selected by tier + specialties**, contracted per film.

- **Stunt Team** *(new)*: choose a tier (price/quality) and **specialties**
  (vehicular, fire, wire/aerial, fights, …) matched to what the script needs. It
  gives a **bid** — a price and required days for the gags the script implies —
  rather than a collaborator's conversation. Can expand its specialties over time
  (a studio builds a relationship with a favoured team).
- **OPEN:** should VFX be a **house/vendor** (tiered, like stunts) *in addition
  to* or *instead of* a supervisor person? Real productions have both (an
  in-house supervisor + an outsourced house). Leaning: supervisor = person (the
  skill/realisation), the render/artist volume = money. Decide during §12 step 2.

## 6. Time model

### 6.1 Per-head asks; phase length emerges (decision: **option B**)
The player does **not** set abstract phase durations. Each head states a **time +
money ask** for the ambition; the player grants/trims it; **the phase length is
the sum of its heads' granted time.** More diegetic and empowering than three
raw day-sliders.

### 6.2 Diminishing returns & the sweet spot
Each head has an ambition-driven **needed time**. `timeWork` rises toward it and
**plateaus** past it — extra days beyond the sweet spot add no quality but still
cost money/calendar. The head communicates this ("~6 weeks does it; beyond that
you're paying me to gold-plate").

### 6.3 The cost of time (why "the slow, cheap road" isn't free)
Five real costs, mapped to game levers:

1. **Prep/phase daily burn** — *new for pre-production* (prep currently costs only
   via events). Each phase burns cash per day it runs. **DECIDED: add a
   pre-production daily burn** as part of the Sets prototype (§12 step 2) so time
   has a real cost in the slice.
2. **Talent-holding cost & availability risk** — longer phases extend the
   `greenlight → prep+shoot` booking; at the extreme, a held star/crew can **drop
   out** (recast risk).
3. **Opportunity cost / time-to-market** — later release: rivals crowd, momentum,
   cash tied up (already partly modelled).
4. **Diminishing returns** — §6.2.
5. **Over-cooked risk** *(optional, v2)* — a small negative swing at extreme prep
   (development hell / lost spontaneity).

Net: time is worth buying up to each head's sweet spot, wasteful beyond, risky at
the far extreme; going cheap on money means needing more time, which pushes
release later and extends holds. The trade-off closes.

**DECIDED:** add the prep daily burn (item 1) now. **OPEN:** availability /
drop-out risk (item 2) — v1 or defer?

## 7. The department-head conversation (UX)

The planning screen becomes a series of **negotiations**, not opaque sliders. Per
head:
- reads the script's ambition for its facet;
- states an **ask** in **time and money**;
- reacts **qualitatively** as the player trades one for the other — the head *is*
  the tooltip;
- its **confidence band is the forecast** (§9): a qualitative
  *Confident / Workable / A stretch / Set up to fail*, whose **spread encodes the
  stretch/variance**.

Example (elite Production Designer, haunted-house film):
> "This film lives or dies on the house. To build what the script wants I'd want
> the full prep window and a real construction budget. …Cutting the budget? I've
> done more with less — give me the extra two weeks in prep and I'll make it sing.
> Rush me on this money and it'll read like a set."
> **Confidence: A stretch — but I like our odds.**

Skill becomes a *character*: a great head is reassuring and precise; a weak one
hedges. **OPEN:** how much authored voice vs templated phrasing? (Templated with
skill/stretch-driven variants is the buildable v1.)

## 8. Money model — Shooting Budget vs. real Contingency (decision: **option B**)

Split today's overloaded "Contingency Reserve" into two honest decisions:
- **Shooting Budget** — the operating resources that fund the facet ceilings +
  daily burn. (What `contingencyAmount`/`SHOOTING_BUDGET_RANGE` already *is*
  internally — just renamed and no longer masquerading as a buffer.)
- **Contingency Reserve** — a *genuine* separate buffer that only absorbs
  overruns/disasters. Protects the downside; does **not** buy quality. Matches the
  player's intuition.

**DECIDED:** the Shooting Budget **dissolves into the per-facet money asks**
(§6.1). Each head's granted budget *is* the shooting budget for its facet;
"Shooting Budget" becomes a sum readout, and **Contingency Reserve is the one
separate buffer dial** (a true downside buffer, no quality effect).

## 9. Forecast (option C)

No separate numeric forecast screen — the **heads' confidence bands are the
forecast**, and their sum is the film's projected Production band ("this plan
could land ~3–4½ stars depending on how the shoot goes"). The all-in **cost**
forecast reuses the existing `computeFilmCostBreakdown` (`engine/cost.ts:81`),
surfaced *before* commit instead of only at release, including an estimated
marketing line (flagged "you'll set this later").

## 10. Scoring integration

- `computeProductionScore` is replaced by a **sum/blend of facet qualities**
  (§3.4), each `facetCeiling × realisation + executionSwing`.
- **Re-route `visual` on-set events** from the Post-Production bucket into the
  relevant Production facet's `executionSwing`, so a rig failure or a VFX
  breakthrough moves *Production*, giving the department its endogenous variance
  (the source of the 2×2's "well/poorly realised" axis at the same spend).
- Genre weights still tilt how much Production matters overall; **scale-heavy
  facets (big VFX/stunts) need more *time* to substitute the same money**, so
  spectacle still leans on spend while craft/look leans on skill+time.

**OPEN:** keep Production and Post-Production as two reported departments (they
share the model but read separately on the Results screen), or merge the reporting.

## 11. Open questions (rolled up)

1. Final facet list & whether Score/Edit ship in v1 (§4).
2. VFX as vendor-house vs. supervisor-person vs. both (§5.2).
3. Money dials for Score/Effects (§4). *(Shooting Budget → per-facet asks:
   DECIDED, §8.)*
4. Talent drop-out / availability risk in v1 or later (§6.3). *(Prep daily burn:
   DECIDED, §6.3.)*
5. Curve tuning: money/time rate ratio, time plateau, swing width (§3.4).
6. Head conversation: authored voice vs templated (§7).
7. Production vs Post reporting: two departments or one (§10).

## 12. Rollout plan (agreed)

1. **This spec** — full design for all facets. *(in progress)*
2. **Prototype one facet end-to-end** — **Sets ↔ Production Designer ↔
   pre-production time** (the phase already exists), including the head
   conversation, the money/time/skill/stretch math, and the visual-event
   re-route for that facet.
3. **Document deltas** — fold whatever the prototype forced us to change back
   into this spec.
4. **Prototype all facets** — extend the model across the catalogue (math + data
   only, light UI).
5. **Full version on one facet** — production-quality UX for Sets.
6. **Roll out to all facets.**

---

## 13. Prototype 1 — Sets facet, end-to-end (deltas from the spec above)

Status: **built** (`engine/setsFacet.ts` + wiring). This section records what the
first end-to-end slice actually did, and where reality forced a change from §1–§12
(rollout step 3). The core model held; the deltas are calibration and scope.

**What shipped**
- New **Production Designer** crew role — **optional** (like VFX Supervisor), with
  a `NO_DESIGNER_SKILL = 40` fallback when unhired. (Delta: the spec leaned toward
  heads being real/mandatory hires; for a safe first slice it's optional. Making
  it mandatory is a later call — it changes the greenlight gate and budget split
  for every film.)
- `engine/setsFacet.ts` — the money × time × skill vs ambition model
  (`computeSetsAmbition`, `computeSetsFacet`, `designerAsk`, `designerConfidence`).
  Replaces the flat `setQualityScore` term in `computeProductionScore`
  (`scoring.ts`), keeping the 0.20 production weight.
- **Money axis = the existing `setQualityAmount`** (the Environment Budget dial /
  Environment Ambition slider). We did *not* add a separate money dial — the
  Sets money is already per-facet, so "the Shooting Budget dissolves into
  per-facet asks" is realised here by reusing that dial. (Full dissolution of the
  contingency-vs-shooting-budget split, spec §8, is still pending — this slice
  didn't touch contingency.)
- **Time axis = pre-production days**, granted via a new `designPrepDays`
  (ProductionChoices), which drives `preProduction.recommendedDays`
  (`GREENLIGHT_PROJECT` now uses `max(scope-estimate, designPrepDays)`), with a
  new **pre-production daily burn** (`computeDailyPrepBurn`, scaled by film scale)
  so time genuinely costs money. (Delta from spec §6.1: phase length "emerges from
  the sum of head asks" — with only one timed head so far, it's `max(base, ask)`.
  The sum-of-heads model arrives when more facets land.)
- **The conversation UX** (spec §7) — a "Production Design" card in Production
  Planning: the designer names their ask (money + prep days), a Design Prep Time
  slider is the time lever, and the designer's **confidence** ("Confident /
  Workable / A stretch / Set up to fail") is the live, in-character forecast.

**Model deltas that mattered**
- **Money's weight must SCALE WITH AMBITION** (`MONEY_WEIGHT_LOW→HIGH`). This was
  the key finding: with a fixed money/time weighting, a moderate no-designer film
  scored ~95 (vs the old ~58) AND cheap+skilled could never fully match lavish.
  Making money's weight rise with ambition (spec §3.2's principle, now concrete)
  fixed both: at low ambition time+skill fully substitute (full match); at high
  ambition money dominates (floors bite). This is now the load-bearing mechanism.
- **Calibrated the neutral case** back to ~the old set-quality baseline
  (`DEMAND_BASE/SLOPE`, ceiling/floor bands) so the change isn't a global quality
  inflation — a catastrophic-shoot calibration test still holds.
- **Confidence is read off `stretch`, not `realisation`** (4 stretch bands), since
  the recalibration lands a "comfortable" build a touch under realisation 1.0.

**Deferred (write down so it isn't lost)**
- **Visual on-set event re-route into the Sets facet** (spec §10, §12 step 2) — the
  endogenous-variance layer. The deterministic money/time/skill model already
  produces the full 2×2 (skill+time are the "well/poorly realised" axis at equal
  spend); the event-driven *stretch swing* on top is not yet wired. Next.
- **Contingency-vs-Shooting-Budget split** (spec §8, option B) — untouched by this
  slice; still pending.
- **Resolve-delay prep days** advance the calendar but don't burn overhead or
  advance `daysElapsed` (a minor accounting simplification).
- Save bumped to **v59** (new career field + `designPrepDays`).
