# Audit — Crew responsibilities (Workstream II, Phase A)

Code-grounded responsibility audit of every creative head and the currently
implicit crafts. First concrete deliverable of the Production Crafts & Crew
workstream (`DESIGN_production_crafts_and_crew.md`). Supersedes the illustrative
first-pass table in that document.

**Method.** For each role: what it *represents*, what it *reads* today, what it
*affects* today (with code references), what is *incorrectly bundled* into it,
what is *missing*, and what data already exists vs. must be added. Traced through
`engine/scoring.ts`, `engine/production.ts`, `engine/setsFacet.ts`,
`engine/practicalFacet.ts`, `engine/facetModel.ts`, `engine/compatibility.ts`,
`engine/productionExecution.ts`, `data/awards.ts`, `data/postProduction.ts`,
`engine/producers.ts`, and the type definitions.

---

## ⚠ Status: partly superseded by the coverage-unification cutover

**This document is a Phase A snapshot and three of its headline findings have
since been fixed in code.** It is kept as the historical record of what the
audit found and why the workstream exists — but do not act on findings 2, 3
(quality half), or 4 (Production Designer half) without re-reading this block.

What changed: `engine/cinematographyFacet.ts`, `engine/scoreFacet.ts` and
`engine/editFacet.ts` now exist, and `engine/scoring.ts` imports all three.
Cinematography enters `computeProductionScore`; Score and Editing enter the
post-production term. So the audit's central *"quality-from-choices, not from
hires"* defect is resolved for those three crafts — the code comment at
`scoring.ts:240-246` says so explicitly.

Two qualifications that matter, and are easy to miss:

- **Player films only.** All three are gated behind the `personDrivenCraft`
  flag. Rivals and the base model deliberately keep the flat, choice-driven
  values.
- **Deviation, not replacement.** Each craft enters as the facet quality with
  the actual head *minus* the same facet at the no-head fallback. A film with
  no Cinematographer, Composer or Editor attached is byte-identical to before
  the terms existed, which is why existing fixtures did not move.

| Finding | Status |
|---|---|
| 1 — three disciplines have real facet models | **Still true**, and now six |
| 2 — Cinematographer and Composer mechanically inert | **Fixed** (player films) |
| 3 — editor skill drives schedule, not quality | **Half fixed** — quality is now person-driven; the coverage ceiling (`editCoverageCeiling`) still bounds it, which was always correct behaviour |
| 4 — coverage mismatched across systems | **Half fixed** — `best-production-design` now exists and reads `FilmResults.productionDesignScore`. Costume / Makeup / Creature / SFX still have neither category nor model |
| 5 — only the Director has creative compatibility | Unverified since; re-check before acting |
| 6 — execution-strategy layer collapsed | Unverified since; re-check before acting |
| 7 — Producer subsystem is the reference pattern | **Still true** |

For the current, code-verified picture of what the simulation does and does
not model, see `docs/domain/15-game-mapping.md`.

---

## Headline findings

The crew system is **not** uniformly "flat skill." It is deeply uneven — some
heads drive real difficulty models, several are mechanically inert:

1. **Three disciplines have real production-difficulty models** (skill × money ×
   time vs. ambition, realised through the shoot's own events): **Production
   Designer** (sets facet), **VFX Supervisor** (vfx facet), and the **stunt
   subsystem** (practical facet). This is the `facetModel.ts` machinery — exactly
   the difficulty-not-bonus shape Workstream II wants, already built for three
   departments.

2. **Two heads are mechanically inert for film quality.**
   - **Cinematographer** appears **nowhere** in `scoring.ts` — hiring a great one
     changes film quality by nothing. It exists only for awards, salary, and
     relationships.
   - **Composer's** contribution is `MUSIC_FOCUS_PROFILES[musicFocus].qualityDelta`
     — a **player menu choice**, not the hired composer's skill. The person you
     hire is mechanically irrelevant to the music quality.

3. **Editor skill drives schedule, not quality.** Editor skill scales
   post-production *time* (`production.ts`, editorial component) and caps
   realisation ("a bad shoot can't be cut into a great film"). The edit *quality*
   terms (`criticalEditScore`, `audienceEditingScore`) come from
   `EDIT_STYLE_PROFILES[editStyle]` — again a **choice**, not the editor.

4. **Coverage is mismatched across systems.** Cinematographer and Composer have
   **award categories** (`best-cinematography`, `best-original-score`) but **no
   quality model**. Production Designer has a **quality facet** but **no award
   category**. Costume/Makeup/Creature/SFX have **neither** — folded into a single
   `periodSetting` boolean and the Production Designer.

5. **Only the Director has a creative-compatibility model.**
   `computeTalentCompatibility` returns a tone match for `Director` and **null for
   every other role** (the code comment names Editor/VFX explicitly). So
   "technical vs creative fit" doesn't exist for any craft head yet.

6. **The execution-strategy layer partly exists but is collapsed.**
   `ProductionChoices` carries the "how much" dials (`setQualityAmount`,
   `vfxAmount`, `practicalEffectsAmount`, `designPrepDays`, shooting budget,
   contingency) and post-production carries `editStyle`/`musicFocus`. But the
   "how" (practical vs digital vs miniature vs VP) is largely folded into those
   amount dials rather than expressed as an explicit strategy over named
   requirements — which is why the three-layer model (narrative × strategy =
   workload) needs building.

7. **The Producer subsystem is the reference pattern to copy.** Producers already
   have **non-overlapping specialties** (`Line → production cost`, `Creative → a
   craft sub-score`, `Executive → marketing/Buzz`, `Fixer → on-set events`) — each
   pulls a *distinct* engine system. That is exactly the "specialty pulls a
   specific downstream" shape crew should adopt, and it already exists in
   `engine/producers.ts`.

---

## Summary matrix

| Role | Skill model | Reads today | Affects today | Award? | Facet? |
|---|---|---|---|---|---|
| Director | `skill` + tone + productionStyle + handsOn | script tone, actors | `directionScore` (skill·0.6 + compat·0.4); actor realisation | ✅ | — |
| Writer | `skill` + WriterCreativeProfile | — | `scriptScore` (originality/structure/characters/dialogue) | ✅ (screenplay) | — |
| Casting Director | `skill` | cast difficulty | discovery/info/audition/forecast (casting redesign) | — | — |
| Cinematographer | `skill` | genre, script, shootingRatio | **cinematography facet** quality (player films) + awards, salary, relationships | ✅ | ✅ |
| Editor | `skill` | runtime, genre, script | post **schedule** + realisation ceiling + **edit facet** quality (player films), still capped by coverage | ✅ | ✅ |
| Composer | `skill` | genre, script | **score facet** quality (player films) on top of the `musicFocus` brief; awards, relationships | ✅ | ✅ |
| Production Designer | `skill` | sets-ambition | **sets facet** quality + `designPrepDays` + set events | ✅ | ✅ |
| VFX Supervisor | `skill` | genre, `vfxAmount` | **vfx facet** quality + post schedule + 1.15× if unhired + vfx events | ✅ | ✅ |
| Stunts (pool) | stunt-team `skill` | `practicalEffectsAmount` | **practical facet** quality + stunt events | — | ✅ |
| Producer (ref) | `skill` + specialty + genreAffinity | — | one distinct system per specialty | — | n/a |

---

## Per-role detail

### Director
- **Represents:** direction — the only craft head with a rich creative model
  (`DirectorCareer`: skill, toneProfile, productionStyle, handsOn leverage).
- **Reads:** script tone (compatibility), the cast (realisation leverage via
  `handsOn`/actingModel).
- **Affects:** `directionScore = skill·0.6 + compatibility·0.4`
  (`scoring.ts:93`); modulates actor realised performance; production-vs-direction
  coupling (`K_DIRECTION_TO_PRODUCTION`). Has a full appeal/interest model
  (`directorAppeal.ts`).
- **Bundled/missing:** the practical-vs-digital *philosophy* that should clash or
  align with VFX/PD is not modelled. **Data:** productionStyle exists and is a
  natural hook.

### Writer
- **Represents:** the screenplay's craft; richest non-actor career
  (`WriterCreativeProfile`).
- **Reads/affects:** `scriptScore` (`scoring.ts:70`, four equal axes). Hired at
  script stage, largely outside the production-crew drawer.
- **Missing:** production-rewrite lever (trade script scope against department
  workload/cost); adaptation/polish/commission distinctions as gameplay.

### Casting Director
- **Represents:** casting information & discovery. Role-specific and complete
  (built in the casting redesign): forecasts, fit-read sharpening, audition
  speed, discovery of lesser-knowns. Included for parity of the "shared frame."

### Cinematographer  ✅ real model *(was ⚠ inert — fixed)*
- **Represents:** cinematography — **but has no mechanical effect.** Absent from
  `scoring.ts` entirely.
- **Affects:** awards (`best-cinematography`), salary allocation (`castBudget`),
  relationships (`pairHistory`, `creativeTension`) — nothing on film quality,
  schedule, or cost.
- **Missing:** an entire production dimension (visual quality, shoot speed,
  lighting/equipment cost, location feasibility, practical/digital integration)
  and a DP↔director aesthetic-fit axis. **Highest-leverage gap** (an award-bearing
  role that does nothing).
- **⚠ SUPERSEDED.** `engine/cinematographyFacet.ts` now exists and
  `computeProductionScore` adds a `CINEMATOGRAPHY_PROD_WEIGHT`-scaled deviation
  from the unhired baseline (`scoring.ts:284-289`), on player films. The
  aesthetic-fit axis and the shoot-speed / equipment-cost dimensions listed
  under *Missing* are still genuinely missing.

### Editor
- **Represents:** post assembly.
- **Reads/affects:** skill scales the **editorial post-production schedule**
  (`production.ts` editorial component) and caps realisation
  (`scoring.ts:428`). Edit *quality* is `EDIT_STYLE_PROFILES[editStyle]`
  (`scoring.ts:494/530`) — a **choice**, decoupled from the hire.
- **Missing:** the editor's *specialty* (action geography, comedy timing,
  salvaging difficult footage) and any link between skill and delivered edit
  quality; "salvage of a troubled shoot" as a real value depending on the shoot's
  own difficulty/events.
- **⚠ PARTLY SUPERSEDED.** `engine/editFacet.ts` now feeds an
  `EDIT_POST_WEIGHT`-scaled deviation into the post term
  (`scoring.ts:530-536`), so skill does drive quality on player films. The
  coverage ceiling still bounds it — correctly. Editor *specialty* remains
  unmodelled.

### Composer  ✅ real model *(was ⚠ inert — fixed)*
- **Represents:** the score — **but the person is mechanically irrelevant.**
  Music quality = `MUSIC_FOCUS_PROFILES[musicFocus].qualityDelta`
  (`scoring.ts:285`), a menu choice.
- **Affects:** awards (`best-original-score`), salary, relationships only.
- **Missing:** any link between the hired composer and the score; idiom
  specialties (orchestral/electronic/horror/leitmotif/period), recording scale
  cost, audience/awards interaction.
- **⚠ SUPERSEDED.** `engine/scoreFacet.ts` now feeds a `SCORE_POST_WEIGHT`-scaled
  deviation into the post term (`scoring.ts:530-536`) on player films, so the
  hired composer does affect the score. Idiom specialties and recording-scale
  cost remain unmodelled.

### Production Designer  ✅ real model
- **Represents:** sets & physical design — one of the three real facet heads.
- **Reads:** `computeSetsAmbition(script)`; skill; `designPrepDays`.
- **Affects:** `computeSetsFacetQuality` (`scoring.ts:186` → `setsFacet.ts`)
  realised with skill-tilt + `facetSignals.sets` events; drives **prep length**
  (`GREENLIGHT_PROJECT`).
- **Bundled:** costume, period, and creature-*build* are silently owned here.
- **Missing:** an award category; a costume/creature split.

### VFX Supervisor  ✅ real model
- **Represents:** digital effects — real facet head; optional role.
- **Reads:** genre, `vfxAmount`, skill.
- **Affects:** `computeVfxFacet`/`realiseVfxQuality` (`scoring.ts:226`),
  genre-scaled; **post-production schedule**; `NO_VFX_SUPERVISOR_MULTIPLIER` 1.15×
  when unhired; vfx events. Genre-hint only in the hiring drawer.
- **Bundled:** digital environments, creature animation, compositing, digital
  doubles are one undifferentiated `vfxAmount`.
- **Missing:** environment-vs-creature-vs-comp specialties; photoreal-vs-stylised
  creative axis; practical/digital *integration* quality shared with DP.

### Stunts (pool → proposed Stunt Coordinator head)  ✅ real model
- **Represents:** practical action; a distinct subsystem (`stuntTeams.ts`,
  `practicalFacet.ts`), not a courted head.
- **Reads:** `practicalEffectsAmount`, stunt-team skill.
- **Affects:** `computePracticalFacet`/`realisePracticalQuality` + stunt events.
- **Bundled:** fights, firearms, swordplay, vehicles, wire work are one
  `practicalEffectsAmount`. **Recommended promotion to a full head** — and the
  deliberate anti-bias test for the requirements model.

### Producer (reference model, not a craft head)
- Already implements the target pattern: `ProducerSpecialty` (Line/Creative/
  Executive/Fixer), each pulling a **distinct** engine system, with `skill`
  scaling magnitude and `genreAffinity` amplifying. Copy this shape for crew
  specialties.

### Currently absent disciplines (bundled or unmodelled)
- **Costume** — no role; implied by `periodSetting` bool, owned by Production
  Designer.
- **Makeup / Prosthetics** — none.
- **Creature** — build implied in Production Designer; animation implied in VFX.
- **Practical SFX (mechanical/destruction)** — implied in `practicalEffectsAmount`
  / stunts.
  These must be modelled as independent `DepartmentWorkload`s from day one (even
  while UI-bundled) so promotion to a head is additive, not a migration.

---

## Implications for Phase B (requirements model)

1. **The facet model is the generalisation target.** Sets/VFX/Practical are three
   instances of exactly the shape we want; Phase B's `DepartmentWorkload` should
   generalise `facetModel.ts`, not replace it.
2. **Quality-from-choices, not from hires, is the core defect to fix.** Composer
   and Editor (and the absent DP award) show that "hire the best" is often
   *literally inert* today — the requirements model must connect the *hired
   person's specialty* to the delivered craft, replacing menu-choice proxies with
   person-driven realisation.
3. **Coverage must be unified.** The awards taxonomy and the quality taxonomy
   currently cover different roles; the requirements model should give every
   award-bearing craft a real quality dimension and vice-versa.
4. **Execution strategy needs explicit expression.** The "how" is collapsed into
   amount dials; Phase B must lift it into named execution approaches over named
   requirements so "same beat, different workload" is representable.
5. **Reuse the Producer specialty pattern** for role-specific "specialty pulls a
   distinct downstream" wiring.

## Implications for the implementation floor

- The safe first slice (VFX + Production Designer + Stunt Coordinator suitability,
  no cost/scoring change) is well-founded: those three already have facet models
  and event hooks to read against.
- **Cinematographer and Composer are the highest-value *correctness* fixes** (they
  are award-bearing yet inert), but they are also calibration-touching (adding a
  real quality term shifts scoring) — so they belong in the later,
  calibration-gated phases, not the floor.

## Confidence / limitations

**Traced against `master` as it stood at the time of the audit — parts have
since been superseded; see the status block at the top.**

Traced against the then-current `master`. Salary/cost allocation (`castBudget.ts`,
`cost.ts`) and the on-set event tables (`productionEvents.ts`,
`productionExecution.ts`) were confirmed at the level of *which roles participate*
but not exhaustively enumerated per event; Phase B should enumerate the
per-department event surface when it designs the risk layer.
