# Design — Production Requirements Model (Workstream II, Phase B)

Status: **draft for review — design only.** Builds directly on
`AUDIT_crew_responsibilities.md` (Phase A) and expands the Phase B sketch in
`DESIGN_production_crafts_and_crew.md`. No implementation until this is agreed.

## Purpose & stance

The audit established that we are **finishing and unifying** a production
simulation that already exists, not building a new one. Three departments
(Production Designer, VFX, Stunts) already have the target shape — requirements →
ambition → budget → schedule → execution → events → realised quality — via
`facetModel.ts`. Others (Cinematographer, Composer, largely Editor) are inert or
choice-driven. **The goal of this model is to raise every creative department to
the standard of the strongest existing ones, generalising the facet pattern
rather than inventing parallel mechanics.**

## The four-stage pipeline (the spine)

```
NARRATIVE REQUIREMENTS   what the film must contain (story-level, execution-agnostic)
        │
        ▼
EXECUTION STRATEGY       how we choose to achieve it (a first-class, shared object)
        │
        ▼
DEPARTMENT WORKLOAD      how hard THIS production is for each department
        │
        ▼
DEPARTMENT EXECUTION     realised quality/schedule/cost/risk (generalised facet)
```

Worked example — one narrative requirement, one strategy choice, many
departments (the user's creature case):

- **Narrative:** "a large creature attacks in the third act" (magnitude,
  frequency, criticality).
- **Execution strategy:** `creatureMethod = Animatronic | Hybrid | MostlyCG |
  FullyCG`. **This single choice ripples**:
  - *Animatronic* → loads **Creature/Practical SFX** (build), **Production Design**
    (integration), **Stunts** (puppeteering/rigging), longer **prep**, on-set
    **actor experience** (reacting to a real prop); light VFX cleanup.
  - *Fully CG* → loads **VFX** (creature animation), **greenscreen** workload for
    **Cinematographer**, longer **post schedule**, actor experience (reacting to a
    tennis ball); light physical build.
- The workload for each department is **derived** from (narrative requirement ×
  chosen strategy), not decided independently per department. That is the crux of
  making #4 real.

## Addition #4 — Execution Strategy as a first-class object

Today the "how" is collapsed into amount dials (`setQualityAmount`, `vfxAmount`,
`practicalEffectsAmount`) and post-production menu choices (`editStyle`,
`musicFocus`). Phase B lifts it into an explicit **ExecutionStrategy**: a small
set of production-level **method choices**, each attached to the narrative axes it
governs, each rippling across multiple departments.

- Strategy is **production-level and shared**, not per-department — one
  `creatureMethod`, one `environmentMethod` (location / studio build / set
  extension / full digital / virtual production), one `destructionMethod`
  (practical / miniature / CG), etc.
- The existing amount dials become the **budget/ambition** inputs *within* a
  chosen strategy, not the strategy itself.
- **Migration:** the current `ProductionChoices` amounts remain the funding layer;
  ExecutionStrategy is a new layer above them. Coarse `ProductionRequirements`
  becomes a derived view of the new narrative layer (audit implication #4).

## Addition #3 — Responsibilities vs. Workload (two separate concepts)

Every department has two distinct architectural objects:

- **DepartmentDefinition (static).** What the department *owns*: which narrative
  requirements route to it, which ExecutionStrategy choices it exposes/participates
  in, which craft decisions it makes, and which quality/schedule/cost/risk outputs
  it produces. Authored once per department.
- **DepartmentWorkload (per-production, derived).** How hard *this* film is for the
  department: the aggregated magnitude/complexity/criticality of its routed
  requirements under the chosen strategy. Recomputed as the script/strategy change.

Keeping these separate means we can add a department (Costume) by authoring its
Definition and its requirement routing, without touching the workload-derivation
engine — and a script's difficulty for an existing department updates purely from
data.

## Layer 1 — Narrative Requirements: taxonomy + discipline

### Addition #5 — the inclusion test (taxonomy discipline)

**A requirement earns its place only if it (a) meaningfully affects ≥2 systems**
(cost, schedule, quality, risk, crew suitability, compatibility) **and (b) creates
a real production decision** (a strategy fork, or a hire whose specialty matters).
If it does neither, it does not become its own requirement — it stays folded into
a parent. This is the primary guard against taxonomy creep, and it is a hard rule,
not a guideline.

Corollaries:
- Prefer **magnitude on a parent** over a new leaf. ("More elaborate swordfights"
  is magnitude on *swordplay*, not five new sword-style tags.)
- New leaves require passing the test in review; the initial mid-grained set is the
  v1 ceiling.

### Hierarchical structure

Five categories; leaves beneath. Each requirement carries **magnitude ·
frequency · complexity · criticality · permitted execution approaches**.

- **Physical Environments** — period architecture · studio interiors · location
  build/augmentation · practical weather/water.
- **Character Transformation** — costume complexity · prosthetics/makeup · creature
  embodiment · digital doubles.
- **Action / Movement** — hand-to-hand · firearms · swordplay · vehicle stunts ·
  wire work · practical destruction · dance/choreography.
- **Digital Imagery** — digital environments · greenscreen/compositing · virtual
  production · creature animation.
- **Logistical Scale** — extras · crowd work · animals · location count.

**Initial mid-grained content set** must distinguish: grounded drama · period
drama · action · creature horror · effects-heavy sci-fi · large-scale war
(fingerprints in the workstream doc). That is the v1 target resolution — rich
enough to separate those six, disciplined enough to resist explosion.

## Layer 3/4 — Department model & generalised execution

`DepartmentWorkload` generalises the facet inputs; **Department Execution**
generalises `facetModel.ts`:

```
delivered = realise(
  capability  = crew technical capability (Layer of #1)
  resources   = budget/ambition (existing amount dials)
  time        = prep/schedule granted
  vs. workload = derived difficulty
) then swung by the department's own execution EVENTS   ← difficulty-not-bonus
```

This directly fixes the audit's core defect (**quality-from-choices, not from
hires**): Composer's `musicFocus` and Editor's `editStyle` menu proxies are
replaced by person-driven realisation against a real workload, and
Cinematographer gains a delivered dimension for the first time. It also **unifies
coverage**: every award-bearing craft gets a quality dimension, and every
quality-bearing craft (Production Designer) gets its award.

## Addition #1 — three dimensions per creative head

Never one "skill" or "specialty" value. Every head carries three orthogonal
dimensions (which the Director and Producer already foreshadow):

| Dimension | What it is | Existing precedent to reuse |
|---|---|---|
| **Technical capability** | what they can execute, per specialty | `skill`, per-requirement specialties |
| **Creative philosophy** | how they *like* to execute | Director `toneProfile` / `productionStyle` |
| **Working style** | how they behave on set (fast · collaborative · perfectionist · adaptable) | **reuse personality axes** (temperament, professionalism, adaptability, ego) — do NOT invent parallel data |

- **Technical capability** feeds Department Execution (realisation vs workload).
- **Creative philosophy** feeds compatibility (below) and *approach* fit — it is
  distinct from capability (technically ideal, aesthetically wrong is expressible).
- **Working style** feeds schedule, cost, risk and events (a perfectionist DP is
  slower/costlier; an adaptable one absorbs on-set change) — reusing the existing
  personality substrate so we don't fork the data model.

## Addition #2 — compatibility beyond Directors (disciplined)

Extend compatibility to the collaborator graph (Director↔DP, Director↔PD,
Director↔Composer, PD↔VFX, DP↔VFX, Actor↔Stunt Coordinator, …), **but under two
rules so it doesn't explode**:

1. **Derived, not authored.** An edge is computed from the two heads' *creative
   philosophy* vectors (and, where relevant, working style), not stored per pair.
   Data stays O(N) (a vector per head); the O(N²) edges are emergent. This is the
   same discipline as the requirement inclusion test.
2. **Edges produce interaction, not a flat quality knob.** A compatibility result
   drives **collaboration quality → risk, events, and recommendations** (a
   practical-first director + a digital-first VFX head raises the odds of a
   philosophy-clash event; an aligned pair unlocks a creative-upside event and a
   "these two work well together" recommendation). It must not collapse into a
   generic +quality modifier — that would just re-introduce the algorithmic
   verdict problem.

Only model an edge if it passes the inclusion test (meaningful across ≥2 systems
and creates a decision). Start with the edges that clearly do: Director↔DP,
Director↔PD, PD↔VFX (practical/digital integration), Actor↔Stunt Coordinator
(physical-demand tolerance).

## Calibration staging (unchanged constraint)

Cost and quality feed box office (`BOX_OFFICE_DIAGNOSTIC` gates). The
**suitability/fit-read floor** (VFX + PD + Stunts, reading the new model, no
cost/scoring change) is calibration-safe and goes first. Any phase that gives an
inert head a real quality term (Cinematographer, Composer, Editor) shifts scoring
and is gated — staged deliberately, never bundled.

## Design-level interfaces (illustrative, not final)

```ts
// Layer 1 — story-level, execution-agnostic
interface RequirementLeaf { key: string; category: RequirementCategory;
  magnitude: Scalar; frequency: Scalar; complexity: Scalar; criticality: Scalar;
  permittedApproaches: ExecutionApproach[]; }
type RequirementProfile = RequirementLeaf[];

// Layer 2 — production-level, shared, ripples across departments
interface ExecutionStrategy { [axis: string]: ExecutionApproach; } // e.g. creatureMethod: 'Hybrid'

// Layer 3 — static ownership vs derived difficulty
interface DepartmentDefinition { id: DepartmentId; ownsRequirements: string[];
  exposesStrategyAxes: string[]; produces: DepartmentOutput[]; }
interface DepartmentWorkload { department: DepartmentId; magnitude: Scalar;
  dominantSpecialties: string[]; }   // derived from RequirementProfile × ExecutionStrategy

// The three-dimension crew profile
interface CraftProfile { technical: Record<Specialty, Scalar>;
  philosophy: PhilosophyVector; workingStyle: WorkingStyleVector; } // last two reuse existing axes

// Compatibility — derived from philosophy vectors, produces interaction
interface CompatibilityEdge { a: CollaboratorRef; b: CollaboratorRef;
  alignment: Scalar; drives: ('risk'|'event'|'recommendation')[]; } // never a flat quality add
```

## Open decisions for review

1. **ExecutionStrategy surfacing.** Making strategy explicit eventually changes the
   production-plan UI (method choices become visible decisions). Do we surface the
   first strategy axes (creature/environment/destruction method) in Phase B's
   implementation, or keep them derived-from-existing-dials initially and surface
   later?
2. **Working-style reuse.** Confirm we reuse the existing personality axes for
   working style rather than authoring a crew-specific set (my recommendation:
   reuse).
3. **First compatibility edges.** Confirm the starter set (Director↔DP,
   Director↔PD, PD↔VFX, Actor↔Stunt Coordinator) — or reprioritise.
4. **Coverage unification scope.** Do we add the missing award category
   (Production Design) and the missing quality dimensions (Cinematography, Score)
   together as a "coverage-unification" phase, or fold each into its role phase?

Once these are settled, Phase C (role-specific designs) can be written against a
fixed model, and the implementation floor can begin.

---

## Revision 1 — review refinements (locked)

Seven amendments from review, all adopted. Phase C is written against the model
*as amended here*.

1. **Layer 4 is renamed "Department Simulation" (not "Execution").** A department
   doesn't merely calculate a quality number — it **plans, prepares, executes,
   adapts, hits problems, and delivers**. The broader term makes future systems
   (events, delays, reshoots, redesigns, morale, recovery) fit naturally as parts
   of the department's ongoing simulation rather than bolt-ons to a quality calc.
   The four-stage pipeline is now: Narrative Requirements → Execution Strategy →
   Department Workload → **Department Simulation**.

2. **Execution Strategy is a major gameplay system, not just a layer.** Practical
   vs digital, locations vs sets, animatronics vs CG, miniatures vs full-CG
   destruction, etc. become **first-class producer decisions** with visible
   trade-offs (cost, schedule, risk, department load, actor experience, creative
   identity). This answers open decision #1: **surface the first strategy axes as
   real decisions**, don't leave them derived-from-dials. It becomes one of the
   central things a producer *does* during production planning.

3. **The pipeline has feedback loops — it is not strictly linear.** Real
   productions push back: a department's limits force rewrites, strategy changes,
   and production decisions. The model makes room for **upstream pressure** as an
   explicit, first-class idea, surfaced as producer decisions/events (never silent
   auto-adjustment):
   - *Department Simulation → Execution Strategy*: a department over-loaded under
     the chosen method recommends/forces a method change (VFX drowning → "go
     hybrid/practical?").
   - *Workload / Simulation → Narrative Requirements*: scope too big for the
     budget/schedule → a **production-rewrite** recommendation (the Writer's
     production-rewrite lever) that trims the requirement.
   - *Simulation → Simulation*: one department's trouble raises another's load
     (a blown practical effect pushes work into VFX cleanup).
   Loops are **producer-facing prompts**, preserving the "support, not solve"
   principle.

4. **Technical capability is broader than specialties.** It encompasses
   per-specialty execution *plus* experience, department leadership,
   problem-solving, and management — i.e. how well the department **handles a
   difficult production**, not only how good its best specialty is. (A brilliant
   specialist who can't run a large department is a real, expressible profile.)

5. **Working style shapes more than cost and schedule.** It drives **events,
   collaboration, morale, creative upside, and recovery from problems** — a
   perfectionist delivers upside on a good shoot but recovers badly from chaos; an
   adaptable, collaborative head absorbs setbacks and lifts neighbouring
   departments. Reuse the existing personality substrate; add only the few
   production-specific facets (perfectionism, collaboration-under-pressure) that
   pass the inclusion test.

6. **Compatibility primarily generates interactions, stories and events — not
   hidden numbers.** The interesting outcome is *"the Director and DP keep
   inspiring each other"* or *"the Production Designer and VFX Supervisor clash
   over practical vs digital again,"* not "+3 quality." Any quality effect is a
   *consequence* of those narrated interactions (an inspired pair rolls a
   creative-upside event; a clashing pair rolls a rework/delay event), never a
   silent modifier. This strengthens the earlier "edges produce interaction, not a
   flat knob" rule into the primary design intent.

7. **`DepartmentDefinition` must not become a god object.** Decompose it now into
   three concepts so it doesn't grow unbounded:
   - **DepartmentResponsibilities** — what the department owns and which creative
     decisions/strategy axes it makes/participates in.
   - **RequirementRouting** — the rules mapping (requirement × strategy) → this
     department's workload contribution.
   - **DepartmentOutputs / event surface** — what it produces and which events it
     can generate.
   Keeping routing and outputs separate from responsibilities means adding a
   department, a routing rule, or an event doesn't bloat one object.

### Amended pipeline

```
NARRATIVE REQUIREMENTS  ⇄  EXECUTION STRATEGY  ⇄  DEPARTMENT WORKLOAD  ⇄  DEPARTMENT SIMULATION
        ▲                        ▲ (major gameplay system)                    │ plan·prep·execute·
        └──────────── feedback (rewrites, strategy changes) ──────────────────┘  adapt·problems·deliver
```

## Revision 2 — decisions locked

- **Coverage unification = one coordinated programme.** Cinematographer/Composer/
  Editor quality dimensions, the missing Best Production Design award, and the
  associated scoring recalibration are one phase — split into small commits and
  testable role slices, but **calibrated once** rather than shifting scoring
  repeatedly.
- **Working style = reuse the existing personality axes wherever possible.** A
  production-specific facet is added only where it is demonstrated that the
  existing substrate cannot express a meaningful behaviour that passes the
  inclusion test.
- **Starter compatibility edges:** Director↔DP, Director↔PD, PD↔VFX,
  Actor↔Stunt Coordinator, **+ Director↔VFX** (practical-vs-digital strategy
  disagreements should become meaningful early). **Defer** Director↔Composer and
  Director↔Editor until those roles are brought up to standard.
- **Creative briefs replace the quality-proxy menus (critical refinement).**
  Retiring `musicFocus`/`editStyle` as *quality* proxies must **not** remove
  player creative direction. Convert them into **creative briefs / intended
  approaches**:

  ```
  creative brief  +  hired person's capability/philosophy  +  resources/time/compatibility
        →  delivered result
  ```

  The player/director can still ask for an orchestral / electronic / restrained /
  thematic score, or a kinetic / classical / comedic / suspense-focused cut. The
  Composer/Editor then determines how *successfully* that intention is realised,
  may **recommend** a different approach, and may introduce their own creative
  identity. The menu stops *directly* creating quality but remains a genuine
  production decision (a brief, not a dial).

## Sequencing (locked)

1. **Workstream I Phase 1 — budgeting & offers** (first: fixes the most immediate
   player-facing contradiction; establishes infrastructure Director hiring and the
   live hub reuse).
2. **Crew fit-read floor** — Production Designer, VFX Supervisor, Stunt Coordinator.
3. **Live Cast & Crew hub** — with the richer state from 1 and 2 available to
   surface.

---

## Implementation status

**Layer 1 — Narrative Requirements: SHIPPED (scaffolding slice).**
`src/engine/requirementProfile.ts` implements the mid-grained v1 leaf set (17
leaves across the five categories) and `deriveRequirementProfile(script)`, a pure
read of a script into the requirements actually present (magnitude above a floor),
most-critical-first. Each leaf carries magnitude · frequency · complexity ·
criticality (0-1) and its `permittedApproaches` — the Layer-1↔Layer-2 seam. The
derivation reads existing script signals (coarse `ProductionRequirements`,
setting/story/tone profiles, `effectsStrategy` / `environmentStrategy` leans,
character `physicalDemand` / `transformationDemand`, `MonsterOrCreature` cast) —
it does **not** yet replace the coarse `ProductionRequirements` (that reverse-view
migration is deferred so this slice touches neither cost nor scoring; it is
calibration-safe by construction).

- The design's routing crux is realised: the **same** written creature routes to
  `creatureEmbodiment` (practical) or `creatureAnimation` (CG) purely by the
  production's practical-vs-digital lean, via steep routing gains.
- Verified to separate the six target archetypes (grounded drama · period drama ·
  action · creature horror · effects-heavy sci-fi · large-scale war) —
  `src/engine/requirementProfile.test.ts`.
- Read-only dev surface: **Requirement Profile Inspector**
  (`src/components/dev/RequirementProfileInspector.tsx`), reachable from the dev
  header, runs the derivation against generated and real reference scripts.
- **Known data limitation:** creature leaves fire only when a cast character has
  the `MonsterOrCreature` archetype; a creature that is not a written cast member
  (Jaws' shark, Jurassic Park's dinosaurs) currently reads as animals + VFX. A
  future content pass can promote non-cast creatures to a script-level signal.

**Layer 3 — Department Workload: SHIPPED (scaffolding slice).**
`src/engine/departmentWorkload.ts` implements `deriveDepartmentWorkloads(profile)`
— how hard the production is for each modelled department, DERIVED from the Layer
1 profile rather than decided per department. Modelled departments are the
fit-read floor: **Production Design · VFX · Stunts** (the three with existing
facets). A static `leaf → { department: weight }` routing table aggregates each
department's routed requirements into a saturating `magnitude` (1 − e^−load) plus
load-weighted `complexity` / `criticality`, `contributions`, and
`dominantRequirements`. Returns only departments the film actually loads, most
first.

- Generalises the per-facet ambition functions (`computeSetsAmbition` /
  `computeVfxAmbition` / `computePracticalAmbition`) but does **not** replace them
  — nothing here feeds cost or scoring, so it stays calibration-safe. Wiring it
  back into the facet ambition inputs is a later, gated step.
- The routing crux carries through from Layer 1: a **practical** creature loads
  Stunts + Production Design; the **same** creature realised digitally loads VFX —
  because Layer 1 already split the approach fork into different leaves, routing is
  a static map. Verified in `src/engine/departmentWorkload.test.ts` (period → PD,
  action → Stunts, sci-fi → VFX, war → all three, and the creature flip).
- Surfaced read-only in the Requirement Profile Inspector (department-workload
  panel beneath the requirement categories).
- **Coverage gap (explicit):** requirements owned by as-yet-unmodelled departments
  (Costume, Makeup, Assistant Director / crowd logistics, animal unit) are left
  UNROUTED rather than misassigned. They join when those departments are modelled.

**Crew fit-read floor — SHIPPED (calibration-safe).**
`src/engine/crewFitRead.ts` implements `deriveCrewFitRead(capability, workload)` —
a head's technical capability read against the Layer-3 department workload, as a
QUALITATIVE verdict (`overqualified · strong · solid · stretch · outmatched`)
plus a demand band (`light · moderate · demanding · severe`), a make-or-break
`critical` flag (from routed criticality), a confidence band from experience, and
prose. Player-facing output is bands + prose; raw scores are dev/test only. v1
reads a FLAT capability (crew `skill`); it refines to per-specialty without a
shape change when heads gain specialties.

- The hub's `StaffingRow.suitability` extension point (typed-but-empty since
  Workstream I Phase 2) is now populated for the modelled department heads —
  **Production Designer** (`getCrewCareer … skill` / `NO_DESIGNER_SKILL`) and
  **VFX Supervisor** (`vfxSupervisorSkill` / `NO_VFX_SUPERVISOR_SKILL`). An
  unstaffed row reads as a demand-to-fill prompt; a staffed one reads the head
  against the workload. **Stunts** is a contracted team (chosen in Production
  Planning), not a `ProductionRole` crew head, so it has no place in the
  role-keyed table — it surfaces instead as a board-level `StaffingBoard.stunts`
  read (a compact "Stunts & Practical" panel on the hub), reading the attached
  team's genre-effective skill (or `NO_STUNT_TEAM_SKILL`) against the stunts
  workload. That completes the fit-read floor's third department on the hub.
- Surfaced in the live Cast & Crew hub as a compact qualitative line on those
  rows. **Calibration-safe:** reads capability vs workload, changes no cost or
  scoring — the facet model still decides realised quality.
- Tests: `src/engine/crewFitRead.test.ts` (banding, margin, stakes, confidence,
  hired-vs-unstaffed prose) + staffing-board seam tests (seam populated for the
  modelled heads, stronger head reads as more suitable).

**Layer 2 — Execution Strategy: SHIPPED (engine slice, calibration-safe).**
`src/engine/executionStrategy.ts` lifts the production "how" out of the script's
effects/environment lean into explicit, named METHOD axes:
- `creatureMethod` (animatronic · hybrid · mostlyCG · fullyCG) and
  `environmentMethod` (location · studioBuild · setExtension · virtualProduction ·
  fullyDigital) — the two axes Layer 1 already forks on.
- `deriveRequirementProfile(script, strategy?)` now takes an optional strategy:
  when supplied, the chosen method drives the approach routing (a fully-CG
  creature → `creatureAnimation`/VFX; an animatronic one →
  `creatureEmbodiment`/Stunts+PD); when omitted, routing is inferred from the
  lean exactly as before, so **unengaged play is byte-identical** and the whole
  layer stays calibration-safe (strategy re-routes requirements → workload →
  the non-scoring fit-reads, never cost or box office).
- `deriveDefaultStrategy(script)` picks the discrete method closest to the
  script's lean (what the UI pre-selects); `relevantStrategyAxes(script)` exposes
  only the axes a film actually contains (creature axis only when a creature is
  written).
- Demonstrated in the Requirement Profile Inspector (method pickers re-derive the
  profile and workloads live). Tests: `src/engine/executionStrategy.test.ts` —
  the producer choice flips the creature's department; environment method drives
  digital environments; no-strategy reproduces pre-Layer-2 behaviour.
- **Deliberately only the two forked axes.** `destructionMethod` / `actionMethod`
  join when the finer-taxonomy expansion splits those requirements by approach —
  not shipped inert.

**Layer 2 is now live in play.** The chosen strategy persists and drives the hub:
- `FilmDraft.executionStrategy?: Partial<ExecutionStrategy>` (types) — only the
  axes the player has explicitly set; unset axes follow the lean-derived default;
  absent = fully lean-derived (unchanged). `SET_EXECUTION_STRATEGY` merges a
  partial patch (reducer). `SAVE_KEY` bumped v70 → v71.
- `deriveStaffingBoard` threads the effective strategy (player choices over the
  default) into the Layer-3 workload, so the hub's crew fit-reads re-route in
  response to the producer's method choice. Still calibration-safe — the strategy
  reaches only the non-scoring fit-reads, never cost or box office.
- Surfaced on the Cast & Crew hub as a **"Production approach"** control right
  above the staffing board (only the axes the film exposes), so changing a method
  and seeing the department suitability reads shift happens in one place.

Not yet built: Layer 4 (Department Simulation), the compatibility/workload hub
sections, the richer per-specialty crew capability model, and the
`destructionMethod`/`actionMethod` axes (awaiting the finer-taxonomy split).

## Script-model depth — an open roadmap question (raised, not yet scoped)

Everything in Layers 1–3 *derives* structure by inferring from the existing
`Script` fields (`genre / storyType / primarySetting / scale / toneProfile /
complexity`, the coarse `ProductionRequirements`, and cast archetypes). There is
**no planned phase that deepens the `Script` type's own authored content.** The
planned depth work — the coarse→fine `ProductionRequirements` migration and the
"finer-taxonomy expansion" (`DESIGN_production_crafts_and_crew.md` item #6) — all
sits in the *derivation/requirements* layer on top of the script, not in the
script itself.

Concrete consequences of that gap, worth deciding deliberately:
- **Creatures** register only via a `MonsterOrCreature` cast archetype, so a
  creature that isn't a written cast member (Jaws' shark, Jurassic Park's
  dinosaurs) reads as animals + VFX, not a creature requirement.
- **Action** has no sub-types — swordplay, firearms, and hand-to-hand are one
  `stunts` scalar; the `actionMethod` strategy axis waits on this.
- No **per-scene / set-piece** granularity; magnitude/criticality are film-level.

Decision to make when this becomes load-bearing: does the added depth come from
**richer derivation** over existing fields (cheap, the current implicit plan) or
from **genuinely authored** script content (per-scene beats, explicit set-pieces,
creature/action sub-tags)? Not blocking — the layers above work on today's script
— but it should be an explicit roadmap item rather than an implicit assumption.
