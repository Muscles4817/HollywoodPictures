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

### 3.2 The central principle: money = speed, skill + time = the cheap road

Skill does **not** substitute for money directly. It substitutes **through
time**. A brilliant Production Designer *can* match a lavish build on a fraction
of the budget — but they need the prep weeks to do it. Rush them cheap → it looks
like a set; give them time → they find the clever solution.

Consequence (resolves the "should cheap fully match expensive?" question — **yes,
it can**): cheap-and-skilful reaches the *same quality* as expensive-and-fast.
The price of going cheap is **time and its downstream risks** (later release,
extended talent holds, more daily burn, rivals crowding), never a quality cap. So
money never becomes worthless — it is *speed and safety* — and "clever + patient +
cheap" is a real, viable studio identity.

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
workRequired   = curve(A)                    # higher ambition => more work
workDelivered  = S01 * (moneyWork(M) + timeWork(T))   # money faster per unit than time
realisation    = clamp(workDelivered / workRequired, 0, ~1.1)
stretch        = clamp(workRequired / (workDelivered + eps) - 1, 0, 1)   # >0 when under-resourced
facetCeiling   = lerp(COMPETENT, SPECTACULAR, A01)   # ambitious facets can score higher when realised
facetQuality   = facetCeiling * realisation  +  executionSwing(stretch, S, onSetEvents)
```

- `moneyWork` has a higher per-unit rate than `timeWork` → **money = speed**
  (fewer days to reach `workRequired`), time = the slow substitute.
- `executionSwing` is centred at 0 for low stretch and fans out (skill-biased) as
  stretch rises — the endogenous variance, realised by the **re-routed visual/
  technical on-set events** (§10).
- **Ingenuity** (cheap + amazing) is not a separate term — it falls out of high
  `S` × high `T` compensating for low `M`, so `realisation` still reaches ~1.

**OPEN:** exact curves — how fast `timeWork` plateaus, the money/time rate ratio,
how wide `executionSwing` fans, and the facet-ceiling span.

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
   via events). Each phase burns cash per day it runs.
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

**OPEN:** do we add a prep daily burn now (item 1), and do we add availability/
drop-out risk (item 2) in v1 or defer?

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

**OPEN:** does the Shooting Budget stay one number, or dissolve entirely into the
per-facet money asks (§6.1)? Leaning: per-facet asks *are* the shooting budget;
"Shooting Budget" becomes the sum readout, and Contingency is the one separate
buffer dial.

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
3. Money dials for Score/Effects, and whether Shooting Budget dissolves into
   per-facet asks (§4, §8).
4. Prep daily burn + talent drop-out risk in v1 or later (§6.3).
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
