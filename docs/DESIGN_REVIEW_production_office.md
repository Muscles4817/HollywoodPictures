# Design Review: The Production Office — Hiring and Attaching Producers

Status: **Proposed** (design locked, unbuilt). First upgradeable studio
facility. Introduces Producers as a new `Person` career, an employment layer
on the `Studio`, and a per-film attach decision on the Producer Workspace.
No change to the film wizard.

---

## TL;DR

- **This is not a new entity — it's a new career on the existing `Person`.**
  Every hireable human is already one canonical `Person` with shared base
  layers (`identity`, `personality`, `reputation`, `traits`, `availability`)
  and a `careers` bag holding only the role-specific bits. A Producer is a
  `producer?: ProducerCareer` in that bag, exactly parallel to
  `DirectorCareer`/`CrewCareer`. We reuse `personality.ego`,
  `reputation.fame`, `reputation.reliability`, and the whole identity/name
  machinery for free; the *only* genuinely new person-level data is
  `specialty` + `skill` + `genreAffinity` inside the career record.
- **The one genuinely new structure lives on the `Studio`, not the person.**
  Being "signed to your studio" is a **studio↔person relationship**, not an
  attribute of a person — the same way `talentPool` holds `Person`s while the
  casting relationship lives elsewhere. So `Studio.productionOffice` holds the
  office tier plus a bench of hired producers *by `PersonId`*.
- **`'Producer'` joins `TalentProfession`, but NOT `ProductionRole`.**
  `ProductionRole` drives the Hire Talent casting wizard; producers are
  attached on the Producer Workspace, never cast there. Adding it to
  `TalentProfession` (required anyway for `RoleCareerCommon<'Producer'>` to
  typecheck) and keeping it out of `ProductionRole` is the clean way to stop
  producers leaking into casting flows.
- **Fees derive from stats, they aren't stored.** `RoleCareerCommon` already
  carries `typicalSalary`/`minimumSalary` set at generation. The per-film fee
  *is* the producer career's `typicalSalary`; the one-time hiring fee is a
  multiple of it. No bespoke fee fields, same derivation precedent crew
  salaries already use (`engine/person.ts:getTypicalSalaryForRole`).
- **Four archetypes, each pulling a different existing system**, so stacking
  across specialties adds up honestly with zero overlap: Line (cost),
  Creative (a craft sub-score), Executive (marketing/Buzz), Fixer (on-set
  events). Every boost is `lerp(minEffect, maxEffect, skill/100)`.
- **Milestone unlock, then cash-bought tiers widen the bench.** You *earn*
  the office by shipping films; you *grow* it with money. This stops a
  turn-one studio buying its way to producers before it has proven anything.

---

## 1. What the feature is

The Production Office is the studio's first **upgradeable facility**. Once
unlocked, it gives the studio a **bench of hired Producers**. A Producer is a
persistent employee (not a per-film hire like cast/crew): you pay a one-time
hiring fee to sign them onto the bench, and thereafter pay a per-film fee each
time you **attach** them to a film. Attaching a producer applies a boost to
that film, drawn from the producer's `specialty` and scaled by their `skill`.

The player-facing fantasy: *assemble a producing team*. A deep bench of
specialists, and the recurring decision of which of them to put on each
picture given its genre and your budget.

This is the "physical studio facilities/upgrades" line item flagged as
deferred-but-wanted in `docs/DESIGN.md` §8, scoped for real for the first
time.

### Design priorities (inherited from `docs/DESIGN.md` §1)

A complete, playable decision loop > clean, extensible architecture > visual
polish. This feature should be **new `data/` + `engine/` + one `Studio` field
+ Producer Workspace UI**, and must not touch the film wizard.

---

## 2. Person-model integration — the load-bearing decision

### 2.1 A Producer is a career, not a new type

`Person` (`types/index.ts`) is already the unified model the casting redesign
and PERSON_MODEL_REDESIGN established:

```
Person
  identity        (name, gender, dob, ...)          — reused as-is
  personality     (ego, reliability*, temperament,  — reused as-is
                   professionalism, ambition, ...)
  reputation      (fame, prestige, reliability,     — reused as-is
                   industryRespect, currentHeat)
  traits          (Perfectionist, Mentor, ...)      — reused as-is
  availability    (commitments)                     — reused (see 2.4)
  primaryRole: TalentProfession                     — may be 'Producer'
  careers: PersonCareers                            — + producer?: ProducerCareer
```

\* `reliability` lives on `PersonReputation`; `ego`, `temperament`,
`pressureHandling` on `PersonPersonality`. We consume the ones already there;
we do not redeclare a single base stat.

The new career record mirrors `DirectorCareer` exactly (extend the shared
common, add role-specific fields):

```ts
export type ProducerSpecialty = 'Line' | 'Creative' | 'Executive' | 'Fixer';

export interface ProducerCareer extends RoleCareerCommon<'Producer'> {
  specialty: ProducerSpecialty;
  skill: number;            // 1-100, scales the boost magnitude
  genreAffinity: Genre[];   // genres where this producer's boost is amplified
}
```

`RoleCareerCommon<'Producer'>` already provides `experience`, `roleReputation`,
`minimumSalary`, `typicalSalary`, `careerStartDay`, `lastWorkedDay` — which is
where the fee economy comes from for free (see §6).

`PersonCareers` gains one optional field:

```ts
export interface PersonCareers {
  // ...existing...
  producer?: ProducerCareer;
}
```

### 2.2 `TalentProfession` yes, `ProductionRole` no

`RoleCareerCommon<TRole extends TalentProfession>` forces `'Producer'` to be
added to `TalentProfession`. We do **not** add it to `ProductionRole`.

- `ProductionRole` is the set of slots the **Hire Talent casting wizard**
  fills and that `TalentAssignment`/`PersonCommitment` are typed against.
  Producers are attached on the Producer Workspace, never cast in the wizard —
  so keeping `'Producer'` out of `ProductionRole` is what stops it appearing
  as a castable slot with zero special-casing in the casting screens.
- Consequence to accept for v1: producer attachment therefore does **not**
  create a `PersonCommitment` (which is typed on `ProductionRole`). That is
  fine — the player runs one film at a time, so a producer has nothing to
  conflict with. If producer scheduling conflicts are ever wanted, that's the
  revisit point (see §11).

### 2.3 Producers come from the same population

Producers are generated by the same `engine/talentGenerator.ts` machinery as
everyone else — a `Person` with a `producer` career filled in, `skill`,
`specialty` (stratified so all four appear), and `genreAffinity` (1–2 genres)
rolled. `MultiHyphenate` already exists as a trait, so nothing prevents a
person carrying both, e.g., a `director` and a `producer` career later; v1
only needs to *generate* producer-primary people, but the model doesn't fight
a director-who-also-produces if we want it.

### 2.4 Availability

Reused but dormant. A producer's `availability.commitments` stays empty in v1
(no producer commitments are written, per §2.2). The field exists on every
`Person` already; we simply don't populate it for producers yet.

---

## 3. The Studio-side employment layer

Employment is a relationship, so it lives on `Studio`, referencing people by
id — never duplicating person data.

```ts
export interface ProductionOffice {
  tier: number;                 // 1..3; presence of the object == unlocked
  benchProducerIds: PersonId[]; // hired producers, by id
}

export interface Studio {
  // ...existing (cash, brand, prestige, assets)...
  productionOffice: ProductionOffice | null;  // null == not yet unlocked
}
```

- `null` = office not unlocked. Existing saves migrate to `null` (see §10).
- `benchProducerIds.length` is capped by the tier's bench size (§6).
- The actual `Person` records for bench producers live wherever generated
  people live (the pool), referenced by id — the office stores no person data.

### 3.1 Per-film attachment

The film-in-progress gains the set of attached producers, also by id:

```ts
// on FilmDraft (the in-progress film) and promoted into Film on release
attachedProducerIds: PersonId[];
```

Stored on the draft so it is a free, side-effect-light choice (consistent with
the wizard's "nothing is charged until release" design, `docs/DESIGN.md` §4) —
the per-film fees are previewed via the same committed-spend selector and only
deducted at `RELEASE_FILM`.

---

## 4. The four archetypes

Each pulls a **different** engine system, so a one-of-each team touches
quality, cost, box office, and risk with no overlap.

| Specialty | Fantasy | Lever (system) | Effect @ skill 30 → 90 |
|---|---|---|---|
| **Line** | ruthless budget hawk | trims production budget spend (`engine/cost.ts:computeProductionBudgetCost`) | **−3% → −15%** of production budget |
| **Creative** | hands-on story/craft | nudges one craft sub-score (`engine/scoring.ts`) | **+2 → +7** to the target sub-score |
| **Executive** | connections & hype | marketing efficiency + flat Buzz (box-office chain) | **+6% → +25%** marketing efficiency |
| **Fixer** | keeps the trains running | softens on-set event impact (`data/productionEvents.ts`) | negative event impact **−10% → −40%** |

**Magnitude scaling.** Every effect is a single linear interpolation off the
producer's `skill`:

```
effect = lerp(minEffect, maxEffect, skill / 100)
```

so a rising £-cheap producer delivers the low end, an A-list producer the
high end. One formula, trivially testable, easy to rebalance in `data/`.

**Which sub-score does Creative hit?** Recommend **post-production** as the
v1 target (it is the craft sub-score most legibly a "producer in the edit
bay" story, and the existing Balanced-edit `+5` bonus is the natural
neighbour for the magnitude). Left as a one-line data choice so it can move to
script polish if playtesting prefers.

### 4.1 Amplify-only genre affinity

If the film's `genre` is in the producer's `genreAffinity`, the effect is
amplified (recommend ×1.3); otherwise the effect is applied at face value.
**Never a penalty** — attaching a producer is never a mistake, only sometimes
suboptimal. This keeps a thin early bench from feeling punishing.

```
affinityMultiplier = film.genre ∈ producer.genreAffinity ? 1.3 : 1.0
appliedEffect = baseEffect * affinityMultiplier
```

### 4.2 Reliability variance

`reputation.reliability` gates how much of the boost lands: a low-reliability
producer occasionally underdelivers a fraction of their effect. Keeps the
existing `reliability` stat load-bearing here rather than decorative, and adds
texture without a new stat. Exact curve is a tuning question (§12).

---

## 5. Stacking rules

Stacking is allowed (per design decision). Two rules keep it honest:

- **Across specialties → additive.** Different specialties hit different
  systems, so their effects genuinely add. This is the "producing team"
  fantasy.
- **Same specialty → each additional one adds half the previous** (geometric
  decay). Two Line Producers give ≈ `base × 1.5`, not `base × 2`; three give
  `× 1.75`. You cannot drive production cost to zero by hoarding one type, and
  the maths quietly rewards a *diverse* bench.

```
sameSpecialtyTotal = base * (1 + 0.5 + 0.25 + ...)   // per specialty group
```

No hard per-film attach cap: the **per-film fee** is the economic governor.
Once a producer's marginal boost is worth less than their fee for *this*
picture, the player benches them. Bench size (office tier) constrains the
early game; money constrains the late game.

---

## 6. Economy

### 6.1 Fees derive from stats

`RoleCareerCommon` already carries a generated `typicalSalary`. So:

- **Per-film fee** = the producer career's `typicalSalary` (reuse
  `getTypicalSalaryForRole(person, 'Producer')` — the same path crew pay
  already flows through). Deducted per attach, folded into the film's cost
  breakdown at `RELEASE_FILM`, previewed before then like every other spend.
- **Hiring fee** = a multiple of the per-film fee (recommend **×3**), a
  one-time studio-level deduction at hire — the same *immediate* studio-level
  deduction path buying IP in the Opportunity Market already uses (not the
  film-release path).

Because fees derive, a producer re-prices automatically if their stats ever
drift later. No stored fee fields to keep in sync.

Salary-generation band for the `Producer` profession in
`data/talentGeneration.ts:PROFESSION_CALIBRATION` sits **below** marquee
talent (directors/actors cap £12–15M) — a producer is a force multiplier, not
the biggest line item. Suggested `salaryRange` ≈ `{ min: 40_000, max:
4_000_000 }`, `fameCeiling` low (they aren't front-facing).

### 6.2 Unlock and tiers

| Tier | Bench slots | How to reach |
|---|---|---|
| **Unlock** | 1 | Milestone: **3 films released OR Brand ≥ 40** (not cash) |
| **Tier 2** | 2 | £1.5M |
| **Tier 3** | 4 | £4M |

Milestone unlock means a brand-new studio cannot buy its way to producers
turn one — you earn the office by proving you can ship, then invest cash to
grow the bench. Slots 1→2→4 keep early choices tight (one producer = pick your
single most valuable specialty per film) and open up stacking only once real
money has been committed. All five numbers live in `data/facilities.ts` and
are pure tuning.

---

## 7. Where the boosts hook in

All four are read from one place — a producer-effects aggregator — so the
wizard and engine call one function, not four scattered special-cases.

```
engine/producers.ts
  computeProducerEffects(attachedProducers, film) -> {
    productionCostMultiplier,   // Line   -> engine/cost.ts:computeProductionBudgetCost
    postProductionDelta,        // Creative -> engine/scoring.ts (post sub-score)
    marketingEfficiencyMult,    // Executive -> box-office / marketing chain
    flatBuzzDelta,              // Executive -> Buzz input
    eventImpactMultiplier,      // Fixer  -> event resolution
  }
```

Each field applies the affinity multiplier (§4.1) and reliability gate (§4.2)
and the stacking rules (§5) *before* returning, so consumers stay dumb: they
multiply/add one number. This mirrors how the codebase already isolates pure
math in `engine/` and keeps consumers thin.

- **Line** → applied inside `computeProductionBudgetCost` (or as a multiplier
  the release cost breakdown applies), so the trim shows up in the finance
  preview automatically.
- **Creative** → added to the post-production sub-score in `scoring.ts`,
  clamped to the 0–100 range like every other sub-score.
- **Executive** → marketing efficiency multiplies the Buzz-per-pound the
  existing marketing→Buzz step computes; the flat Buzz add lands in the same
  Buzz input. Both flow through to Opening Weekend via the existing box-office
  chain untouched.
- **Fixer** → scales the **negative** portion of each rolled event's
  `costDelta`/`qualityDelta` (positive events unaffected — a fixer mitigates
  disasters, they don't manufacture windfalls).

---

## 8. UX — Producer Workspace, not the wizard

- **Dashboard:** a "Production Office" card — locked state (shows the unlock
  milestone and progress), or unlocked state (tier, bench summary, upgrade
  button, hire button).
- **Hiring:** a producer market/drawer surfaced from the office card —
  browse generated producers filtered by specialty/skill/affinity/fee, sign
  one onto the bench (immediate hiring-fee deduction).
- **Attaching:** on the **Producer Workspace**
  (`components/projectWorkspace/`) — a producer section on the active project
  where the player attaches/detaches bench producers, sees each one's applied
  effect (with affinity called out) and per-film fee, and a running total of
  the team's combined boost and cost. This is the per-film decision surface;
  the film wizard is not touched.

---

## 9. State and reducer actions

New actions on `studioReducer.ts`:

- `UNLOCK_PRODUCTION_OFFICE` — fires when the milestone is met (or a claim
  button); sets `productionOffice = { tier: 1, benchProducerIds: [] }`.
- `UPGRADE_PRODUCTION_OFFICE` — affordability-gated (same gate greenlight
  uses); increments `tier`, deducts the tier cost immediately.
- `HIRE_PRODUCER` — affordability-gated; pushes a `PersonId` onto the bench
  (capped by tier bench size), deducts the hiring fee immediately.
- `FIRE_PRODUCER` — removes from the bench (no refund).
- `ATTACH_PRODUCER` / `DETACH_PRODUCER` — mutate the draft's
  `attachedProducerIds`; **no cash movement** (previewed, charged at release).

Cash-mutation discipline (`docs/DESIGN.md` §4) is preserved: office/producer
*studio-level* purchases deduct immediately (like IP acquisition); *per-film*
producer fees are previewed and deducted once, at `RELEASE_FILM`, inside the
recomputed cost breakdown.

---

## 10. Persistence and migration

`state/persistence.ts` gains one migration: any save without
`studio.productionOffice` gets `productionOffice: null` (locked). Films/drafts
without `attachedProducerIds` default to `[]`. Both are additive, both
backward-compatible, no existing field changes shape. Producer `Person`s are
generated the same way the rest of the pool is, so no roster migration is
needed beyond ensuring a save generates producer candidates on load if it
predates the feature.

---

## 11. Phasing

**v1 (this brief):**
- Producer career on `Person`; `Studio.productionOffice`; four archetypes;
  skill-scaled effects; amplify-only affinity; reliability variance; stacking
  rules; milestone unlock + two paid tiers; derive-from-stats fees; Dashboard
  card + hire drawer + Producer Workspace attach section; migration.

**Deferred (natural next layers, deliberately out of scope):**
- **Ego-clash downside.** `personality.ego` is consumed by nothing in v1 —
  it's the hook for a phase-2 "too many big egos on one film → raised clash
  event odds" mechanic, giving stacking teeth beyond the economic cap.
- **Talent Producer / Packager** — the fifth archetype (cuts cast salaries /
  eases high-ego stars). Deferred because it overlaps the casting system and
  needs more care than the four non-overlapping levers.
- **Producer scheduling conflicts** — would require `'Producer'` participating
  in `PersonCommitment` (see §2.2); only meaningful once the player can run
  more than one film at a time.
- **Producer stat drift / relationships** — producers gaining skill or loyalty
  from films they shepherded, reusing the same career substrate.

---

## 12. Open tuning questions

None block the build; all are `data/` values or a single formula:

1. **Affinity multiplier** — 1.3 recommended. Higher makes specialization
   sharper.
2. **Reliability variance curve** — how much of the boost a low-reliability
   producer can shed, and how often. Recommend a small band (e.g. up to
   −25% of the effect at very low reliability) so it's texture, not a coin
   flip.
3. **Creative's target sub-score** — post-production (recommended) vs script.
4. **Hiring-fee multiple** — ×3 of per-film fee recommended.
5. **Same-specialty decay factor** — 0.5 recommended; lower punishes
   duplicates harder.
6. **Exact tier costs / bench sizes / unlock milestone** — the §6.2 table is
   the starting point.

---

## 13. Testing

Everything load-bearing is a pure function in `engine/producers.ts`, unit-
testable in isolation the same way the rest of `engine/` is:

- `computeProducerEffects` — additive-across / decay-within stacking, affinity
  on/off, skill endpoints (30/90), empty attach set → all-neutral.
- Fee derivation — `getTypicalSalaryForRole(person, 'Producer')` parity with
  the generated `typicalSalary`; hiring fee = ×3.
- Reducer — unlock milestone gate, upgrade/hire affordability gates, bench cap
  by tier, attach/detach mutate the draft only (no cash movement), per-film
  fees appear in the release cost breakdown exactly once.
- Migration — a save without `productionOffice` loads to `null`; a draft
  without `attachedProducerIds` loads to `[]`.
