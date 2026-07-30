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

**Compatibility edges — STARTED (Director ↔ approach; calibration-safe).**
`src/engine/collaborationEdges.ts` implements the first collaborator edge, per
Addition #2 / Revision 1 #6: a relationship read DERIVED from creative-philosophy
vectors that produces an INTERACTION (a story about how they'll get on), never a
hidden quality modifier.
- `deriveDirectorApproachFit(directorStyle, strategy, axes)` compares the
  director's practical↔digital lean (`productionStyle.effectsStrategy` /
  `environmentStrategy` — real data) against the practical↔digital character of
  the chosen Execution Strategy, averaged over the axes the film exposes →
  `aligned · mixed · friction` with qualitative prose ("your director is a
  practical-first film-maker, but you've committed to a digital production —
  expect friction"). This is the computable core of the design's Director↔VFX /
  Director↔PD edges: the strategy is exactly what those departments execute.
- Surfaced inline in the hub's "Production approach" panel — pick methods and the
  attached director reacts in place. Shown only when a director is hired.
- **Calibration-safe:** a clash is a story (and, later, an event/recommendation
  surface), not a −quality knob — feeds no cost or scoring.
- Tests: `src/engine/collaborationEdges.test.ts` (aligned/friction/mixed banding,
  axis-averaging, no digits in copy) + hub render.

**Addition #1 — crew creative-philosophy vectors: SHIPPED (calibration-safe).**
`src/engine/crewPhilosophy.ts` gives each creative head a second dimension beside
`skill`: a `CrewPhilosophy` vector (`digitalAffinity` practical↔digital ·
`stylisation` naturalistic↔stylised) in the same space the Director/Execution
Strategy already speak. Like director hands-on-ness, an unauthored philosophy is
a STABLE per-person derivation from the person id (no rng, so no generated pool
shifts; no save impact), with an optional authored `CrewCareer.philosophy`
override for future marquee crew. `directorPhilosophy(career)` maps a director
into the same space (digital lean → digitalAffinity; tone → stylisation).

This **unlocks the person↔person compatibility edges**: `deriveCrewCollaborationReads`
now derives **Director↔PD, Director↔VFX, PD↔VFX** from the two heads' vectors
(O(N) data, edges emergent) — aligned / mixed / friction, with the dominant
disagreement naming the topic ("clash over practical vs digital" / "grounded vs
stylised"). Surfaced on the hub as a **"Creative collaboration"** panel listing
the active edges among the attached heads. Still calibration-safe — a clash is a
story, not a −quality knob. Tests in `crewPhilosophy.test.ts` (stable/authored/
director-mapping) and `collaborationEdges.test.ts` (edge banding, attach-gating).

**Addition #1 — per-specialty technical capability: SHIPPED (calibration-safe).**
The third of the three dimensions per head. `src/engine/crewSpecialty.ts` splits a
head's flat `skill` into per-specialty capability — Production Design
(`periodCraft · scaleBuild · locationBuild · creatureBuild`), VFX
(`digitalEnvironments · creatureAnimation · compositing · digitalDoubles`) — so a
great digital-environments house is expressibly *not* a great creature animator.
Same discipline as philosophy: a stable per-person spiky profile around overall
skill (a standout and a weakness), keyed on the id, with an optional authored
`CrewCareer.specialties` override; no rng, no save impact.
- `specialtyWeightedCapability(caps, contributions, overallSkill)` collapses the
  profile to an effective capability for THIS film — weighting each specialty by
  how much the film's Layer-3 workload loads it — plus a qualitative note ("a
  specialist in digital environments — the film's biggest demand" / "their weaker
  area is creature animation, which is exactly what this film leans on").
- The crew fit-read now reads a hired head on the specialties the film actually
  demands, not flat skill: two heads of equal overall skill read differently by
  how their strengths line up with the workload. Surfaced in the fit-read detail
  on the hub. Still calibration-safe (feeds the read only).
- Tests: `crewSpecialty.test.ts` (spiky/stable/authored, specialty-weighting up
  and down, fallback) + staffing-board seam (specialist vs misfit at equal skill).

With this, all three head dimensions are live: technical (skill + specialties),
creative philosophy, and working style (reused personality axes).

**Still deferred:** Actor↔Stunt and Director↔Composer/Editor compatibility edges
(those parties don't carry philosophy vectors yet).

**Layer 4 — Department Simulation / coverage unification: STARTED (calibration-gated programme).**
Per Revision 2, coverage unification is *one coordinated programme, calibrated
once* — giving Cinematographer/Composer/Editor real person-driven quality
dimensions, adding the missing Best Production Design award, and retiring the
`musicFocus`/`editStyle` quality-proxy menus in favour of creative briefs. It is
being built as safe scaffolding slices first, with the single box-office scoring
shift (the facet→`computeProductionScore`/`computePostProductionScore` cutover)
staged last and calibrated in one pass. Calibration boundary for the programme:
keep the whole normal suite and the already-green, §6-ratified buzz diagnostic
green, and do **not** regress the (red-by-design) distribution/variance
diagnostics — those belong to the *separate* funnel/scale recalibration
workstream, not folded in here. Quality feeds legs/word-of-mouth/variance, never
reach/scale (the "acclaim doesn't buy mass-market scale" lock stands).

- **Slice 1 — Best Production Design + its own sub-score: SHIPPED (box-office-safe).**
  Production Design already *has* a real, person-driven quality — the existing
  Sets facet (Production Designer skill × budget × prep vs ambition). It was
  simply buried inside the blended `productionScore` and had no award.
  `computeQualityBreakdown` now also returns `productionDesignScore` (the Sets
  facet quality decomposed out — the *same* pure value it already blends into the
  `sets` term, so no box-office maths change), carried on `FilmResults`
  (optional; a result without it reads as the shared `productionScore` in the
  awards path, exactly as cinematography/VFX do). A new `best-production-design`
  `AwardCategory` (label + weight 0.4, enrolled in BAFTA + Academy via
  `AWARD_CATEGORIES`) reads it through `craftContenders(Production Designer)`, so
  a strong designer contends even when effects dragged the blended production
  number down. Awards feed prestige/brand/momentum, not the box-office quality
  seam, so this slice shifts no scoring. Renders automatically on the Awards page
  (dynamic `ALL_AWARD_CATEGORIES` × label map). Tests in `awards.test.ts`
  (reads the design facet not the blend; designer-skill tiebreak; no-designer
  exclusion; loose-fixture fallback).

- **Slice 2 — craft facets for Cinematographer/Composer/Editor: SHIPPED (safe scaffolding, NOT wired).**
  Three new pure modules generalise the facet model (engine/facetModel.ts) to the
  three inert heads: `cinematographyFacet.ts`, `scoreFacet.ts`, `editFacet.ts`.
  Each supplies its own ambition source, a skill accessor with an unhired
  fallback, `computeXFacet` / `realiseXQuality` / `xOutlook`, mirroring
  `vfxFacet.ts`/`setsFacet.ts` exactly:
  - **Cinematography** ambition from the tone's spectacle/action lean + the
    setting's environment scale/location complexity + scale. Runs on the shoot's
    `shootingRatio` (time) × DP skill; money held neutral (no camera-budget dial
    yet, documented like VFX's neutral time axis). Fallback `NO_CINEMATOGRAPHER_SKILL`.
  - **Score** ambition from the music-forward tones (suspense/drama/spectacle/
    romance) + scale. Runs on Composer skill vs demand; money + post-time neutral.
    Fallback `NO_COMPOSER_SKILL`.
  - **Editing** ambition from the script's structural complexity + action/suspense
    lean + scale. Runs on Editor skill vs cutting difficulty; money + post-time
    neutral. The already-live `editCoverageCeiling` (an under-shot film caps the
    cut) is orthogonal and untouched. Fallback `NO_EDITOR_SKILL`.
  - **Calibration-safe by construction:** nothing reads these facets yet -
    `computeProductionScore`/`computePostProductionScore` are unchanged, so box
    office is byte-identical. They exist so the gated cutover is a small, focused
    wiring change with the maths already built and tested.
  - Tests: `cinematographyFacet.test.ts` / `scoreFacet.test.ts` /
    `editFacet.test.ts` (ambition separates archetypes, the head's skill is the
    axis, unhired falls back to the floor, forecast = base at neutral skill).

- **Slice 3 — creative-brief seam: SHIPPED (behaviour-preserving).**
  Reframes the `musicFocus`/`editStyle`/`finalCutFocus` menus as the director's
  BRIEF (intended approach handed to the Composer/Editor) rather than a quality
  dial, and — the substantive part — routes the four scattered menu→delta reads in
  `scoring.ts` through one seam, `postProductionBrief.ts`:
  - `CreativeBrief` (a view over the persisted `PostProductionChoices`; the menu
    fields stay the state) + `briefFromChoices`.
  - Four interpretation accessors — `briefQualityContribution` (post-production
    quality), `briefCriticEditScore`, `briefAudienceEditScore`, `briefBuzzContribution`
    — each returning EXACTLY the value scoring.ts computed inline before.
    `computePostProductionScore`/`computeCriticScore`/`computeAudienceScore`/
    `computeBuzzScore` now call these instead of indexing the profiles directly.
  - `describeBriefIntent` — the brief as qualitative intent ("a bold, memorable
    score"; "a fast, crowd-pleasing cut"), distinct from the profiles' effect
    language; additive, not yet surfaced.
  - **Byte-identical:** the entire normal suite passes unchanged and the §6-ratified
    buzz gate stays green with identical fixture numbers — the seam is transparent.
  - **Why it matters:** the cutover now changes these four accessors ALONE — each
    stops returning a flat menu delta and instead returns the hired Composer's/
    Editor's realisation of the brief (scoreFacet.ts / editFacet.ts) — with the
    rest of scoring untouched. The intent stays a real player decision; the
    quality becomes person-driven (Revision 2's "brief, not a dial").
  - Tests: `postProductionBrief.test.ts` (mapping, per-combination byte-identity
    against the raw profile arithmetic, digit-free intent prose).

- **Slice 4 — the gated scoring cutover: SHIPPED (player-only, aggregate-neutral).**
  Cinematography, Score and Editing quality is now realised from WHO you hired,
  fixing the audit's quality-from-choices-not-hires defect. Each enters scoring as
  a DEVIATION from the unhired-fallback baseline (facet quality with the actual
  head minus the same facet at the no-head fallback), so a film with no such head
  is byte-identical to before the term existed:
  - Cinematography → a term in `computeProductionScore` (a brand-new delivered
    dimension for the DP; feeds the production→quality chain and the
    Best-Cinematography award's productionScore).
  - Score + Edit → a deviation added to the post-production quality in
    `computeQualityBreakdown`, on top of the brief baseline, bounded by footage
    coverage with the rest of the cut.
  - Weights (`CINEMATOGRAPHY_PROD_WEIGHT` 0.3, `SCORE`/`EDIT_POST_WEIGHT` 0.25) at
    the top of `scoring.ts`; the character terms (critic/audience/buzz edit/score
    deltas) stay brief-driven choices, and `computeBuzzScore` is untouched (buzz
    gate trivially green).

  **Player-only, and why (a measured decision).** A `personDrivenCraft` flag gates
  the three new dimensions: true on the player's release + forecast paths
  (`marketSettlement`, `MarketingRelease`, `OutcomeInspector`, `testScreening`),
  absent/false everywhere else (rivals, the base model, every calibration
  diagnostic). Sets/VFX/Practical remain person-driven for everyone regardless.
  The reason: rivals attach these crew too, and the whole-year box-office
  DISTRIBUTION diagnostic is a chaotic multi-year rival-feedback simulation — any
  change to rival craft quality cascades non-monotonically through greenlight/
  budget/release decisions across the simulated years (measured: weight 0.3 →
  mean gross 167, weight 0.12 → 157, i.e. smaller weight moved it FURTHER, not
  closer). So the distribution gate cannot be held stable by tuning under any
  rival-scoring change, and it is red-by-design and PROPOSED (not ratified),
  owned by the separate funnel/scale recalibration. Making the cutover player-only
  keeps the distribution + variance gates BYTE-IDENTICAL (verified: wideMeanGrossM
  173.5, wideOver500Pct 5.3, wideOpeningMultiple 2.9, variance 100%/CoV 0.017 all
  exactly at baseline) while delivering the feature for the player. Rivals adopt
  person-driven craft in the funnel/scale recalibration that owns the gate — so
  rival scoring shifts ONCE, there, honouring "calibrated once."
  - **Verified:** build ✓; full suite ✓ (1913, +4 cutover-wiring tests); lint ✓
    (0 errors); buzz gate green; distribution + variance gates byte-identical to
    baseline. Tests: `craftCutover.test.ts` (crew lifts player productionScore/
    postProductionScore; monotonic in skill; flag-off ignores craft; unstaffed
    film byte-identical flag on/off).

**Coverage unification is complete for the player.** The whole chain now runs and
is player-visible: script → producer's Execution Strategy → requirements →
department workload → crew suitability → **realised craft quality that depends on
who you hired** → box office and awards (incl. the new Best Production Design).
Remaining (deliberately deferred): rivals adopting person-driven craft + the
overall funnel/scale recalibration (one workstream that owns the box-office
distribution gate); the workload hub section; and the `destructionMethod`/
`actionMethod` axes (awaiting the finer-taxonomy split).

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
