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
