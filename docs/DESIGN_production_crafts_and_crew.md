# Design — Production Crafts & Crew (Workstream II)

Status: **draft for review — design-first.** No crew implementation begins until
Phase A (audit) and Phase B (requirements model) exist and are agreed. Sibling of
`DESIGN_casting_hiring_integration.md` (Workstream I), which is the immediately
implementable arc. Workstream II's audit runs in parallel as design work while
Workstream I Phase 1 is the first thing actually built.

## 0. Framing

The problem this workstream solves is that crew is currently close to a
database-selection screen ("known exact skill, click once to hire"), which
produces a "buy the best you can afford" ranking. The fix is **not** "give each
head interest logic plus two generic style axes." Crew suitability is highly
role-specific, and — critically — evaluating the two most physical heads
(Production Designer, VFX Supervisor) properly requires the game to understand
*what work the screenplay actually demands*, which it currently does not express
at sufficient resolution.

### Key finding: the difficulty engine already partly exists

Verified in code, and it reframes the whole workstream. The **realised-facet**
system already models three departments as *money × prep-time × head-skill vs.
ambition, realised through the shoot's own events* — which is exactly the
"difficulty-not-bonus" model we want:

- **Sets / Production Designer** — `computeSetsFacet` + `realiseSetsQuality`,
  reading a script sets-ambition, prep days, and designer skill; the shoot's set
  events (`facetSignals.sets`) swing the delivered quality (triumph/collapse).
  Production Designer skill also already drives prep length (`designPrepDays`).
- **VFX / VFX Supervisor** — `computeVfxFacet` + `realiseVfxQuality`, genre-scaled
  (Action/Sci-Fi/Fantasy weight VFX; Drama doesn't); VFX events swing it; a
  missing supervisor applies a 1.15× cost/time penalty; VFX skill drives
  post-production schedule.
- **Practical / stunts** — `computePracticalFacet` + `realisePracticalQuality`,
  realised through **stunt-team skill** and practical events (stunt
  landing/reshoot). Stunts are already a distinct pool (`stuntTeamPool`) wired
  into the practical facet — a strong signal they should be a first-class head.
- **Editor** — skill scales editorial post-production time and caps realisation
  ("a bad shoot can't be cut into a great film no matter how good the Editor").
- **Director** — deep already: scoring reads `skill × 0.6 + compatibility × 0.4`.

By contrast, **Cinematographer and Composer are *not* production facets** at all —
they appear in compatibility, awards, cast-budget and pair-history, i.e. they are
creative/aesthetic/awards-flavoured but have no realised production dimension.
**Casting Director** is the information/discovery role (built in the casting
redesign). **Writer** is a script-stage creative hire.

So the workstream **generalises an existing engine** rather than inventing one:
- from **3 facets** (sets/vfx/practical) to **N departments**;
- from **coarse one-scalar ambition** to a **hierarchical requirements model**;
- from **one-dimensional skill** to **specialty + technical-vs-creative fit**;
- and it gives the currently-thin heads (Cinematographer, Composer) their own
  dimensions.

### The three conceptual layers (must stay separate)

Workload is **not** derived from tags alone. The same dragon attack, period city
or vehicle chase can be achieved by very different means, and that choice — not
the story beat — is what creates the departmental work.

```
1. NARRATIVE REQUIREMENTS   what must appear on screen
        (a dragon razes a medieval city; a car chase through a real district)
                    │  × 
2. EXECUTION STRATEGY       how we intend to achieve it  (already exists as
        production-plan choices: effects strategy practical/digital, environment
        strategy studio/location/digital, ambition, money, prep)
                    │  = 
3. DEPARTMENT WORKLOAD       the actual work each discipline must accomplish
        (creature suit + miniature city + practical fire  vs.  full-CG dragon +
         digital environment + greenscreen plates — same beat, opposite workloads)
                    │
                    ▼
   cost · schedule · crew suitability · execution quality · risk & events
```

Layer 2 already exists (the production-plan strategy choices). Layer 1 is the new
finer thing (today only the coarse `ProductionRequirements` scalars). Layer 3 is
currently the coarse "ambition" inputs to the facets; the new model computes it
explicitly per department from **requirements × strategy**.

### Cross-cutting principles

- **Difficulty, not bonus (locked).** Requirements create execution *difficulty*.
  Skill, preparation, resources and specialty match determine how *successfully*
  that difficulty is handled. A matched specialist prevents loss, reduces risk,
  and can create creative upside — never a flat quality bonus regardless of the
  work.
- **Technical fit ≠ creative fit (locked).** A DP can be technically ideal for
  low-light location work yet aesthetically wrong for the director. Suitability
  must not collapse into a single match value; keep a technical axis and a
  creative/aesthetic axis distinct (applies to DP, Editor, Composer, PD, VFX).
- **Departments stay internally distinct even when the UI bundles them (locked).**
  Costume, Makeup/Prosthetics, Practical SFX and Creature may initially be chosen
  as packages rather than courted heads, but their workloads, costs, risks and
  quality outputs must be modelled independently from day one, so they can be
  promoted to full heads later without a migration.
- **Shared frame, role-specific matching.** A common substrate (competence,
  reliability, speed, cost, creative ambition, collaboration, genre familiarity,
  relationships, willingness) is fine; the specialty axes and downstream
  consequences are per-role modules on top.
- **Track record known, future uncertain.** Present crew as a known track record
  plus an *uncertain* fit-for-this-film — never one exact sortable number.

---

## Phase A — Responsibility audit (first concrete deliverable)

The first-pass tables in this document are **illustrative, not sufficient**.
Phase A produces the exhaustive, code-grounded audit. Its method and output:

**Method.** For every creative head (Director, Casting Director, Cinematographer,
Editor, Composer, Production Designer, VFX Supervisor, Stunt Coordinator, Writer)
and the currently-implicit disciplines (Costume, Makeup/Prosthetics, Practical
SFX, Creature), trace *in code*: every input read, every output written, and
every consumer.

**Per-role output (the deliverable).**
- **Represents** — what this role actually models.
- **Reads today** — exact inputs (which script fields, which production choices,
  which skill term).
- **Affects today** — exact outputs (scoring terms, schedule terms, cost terms,
  event tables), with function references.
- **Incorrectly bundled** — responsibilities currently owned that belong to a
  different discipline.
- **Missing** — responsibilities nothing currently owns.
- **Data present vs. absent** — what the model would need that already exists vs.
  must be added.

**Code-grounded starting findings** (to be completed exhaustively in Phase A):

| Role | Represents | Reads today | Affects today | Bundled / missing |
|---|---|---|---|---|
| Production Designer | sets/physical design | sets-ambition (`computeSetsAmbition`), prep, skill | sets facet quality, `designPrepDays`, set events | **bundles** costume, period, creature-build |
| VFX Supervisor | digital effects | genre, `vfxAmount`, skill | vfx facet quality, post schedule, 1.15× if unhired, vfx events | **bundles** digital env/creature/comp; genre-hint only for discovery |
| Stunts (pool) | practical action | `practicalEffectsAmount`, stunt-team skill | practical facet quality, stunt events | not a courted head; **bundles** fights/firearms/vehicles/wire |
| Editor | post assembly | Editor skill, runtime | editorial schedule, realisation ceiling | — |
| Director | direction | skill, compatibility | scoring (0.6/0.4), appeal model | — |
| Cinematographer | cinematography | — (compatibility/awards only) | awards, compatibility, pair-history | **no production dimension** |
| Composer | score | — (compatibility/awards only) | awards, compatibility, cast-budget | **no production dimension** |
| Casting Director | casting info | cast difficulty | discovery/info/audition/forecast | orthogonal (done) |
| Writer | screenplay | script | script quality/scoring | flat-skill hire; see Phase C |

The audit's job is to turn this skeleton into the exact, referenced truth and to
name every bundling/gap explicitly.

---

## Phase B — The production-requirements model

Design the **full** taxonomy structure and extension rules; implement an initial
**mid-grained** content set (answer to Q2). Rich enough to distinguish at least:
grounded drama · period drama · action · creature horror · effects-heavy sci-fi ·
large-scale war.

### Hierarchical taxonomy

Broad categories, specific requirements beneath (not one flat tag set):

- **Physical Environments** — period architecture, studio interiors, location
  build, location augmentation, practical weather, water work.
- **Character Transformation** — costume complexity, period costume, prosthetics,
  makeup, creature suits, digital doubles.
- **Action / Movement** — hand-to-hand, firearms, swordplay, vehicle stunts, wire
  work, practical destruction, dance/choreography.
- **Digital Imagery** — digital environment extension, full CG environments,
  greenscreen compositing, virtual production, creature animation, miniatures.
- **Logistical Scale** — extras, crowd work, animals, location count.

### Requirement fields

Each requirement carries:
- **magnitude** — screen weight when present.
- **frequency** — how often across the film.
- **complexity** — technical difficulty.
- **criticality** — how central to the film landing (a marketed set-piece vs
  background texture) — drives how much a mismatch *hurts*.
- **preferred / available execution approaches** — the set of ways it *could* be
  achieved (practical | miniature | VP | CG | location | studio…). This is the
  seam where Layer 1 (narrative) meets Layer 2 (strategy) to produce Layer 3
  (workload).

### Deriving workload

`DepartmentWorkload = aggregate over requirements of (magnitude, frequency,
complexity, criticality) resolved through the chosen execution approach`. The
same requirement routes to *different departments* by approach: a CG dragon loads
VFX; a suit-and-miniature dragon loads Creature + Practical SFX + Production
Design. This makes "two scripts, identical effects-ambition, entirely different
ideal personnel" (war film vs creature feature) fall out naturally.

### Mapping onto existing systems (migration-safe)

- The fine `RequirementProfile` becomes the **source of truth**; the existing
  coarse `ProductionRequirements` scalars become a **derived view**, so current
  cost/scoring consumers keep working during migration.
- `DepartmentWorkload` **generalises the facet model** (`facetModel.ts`): today's
  sets/vfx/practical facets are three instances; the model becomes N-department.
- Execution strategy already exists as production-plan choices — reuse, don't
  rebuild.

### Initial content-set fingerprints (mid-grained target)

| Archetype | Dominant workloads |
|---|---|
| Grounded drama | logistical (locations), minimal transformation/action/digital |
| Period drama | period architecture + costume + makeup; low action/digital |
| Action | hand-to-hand/firearms/vehicles + practical destruction; moderate digital |
| Creature horror | creature suits/prosthetics + practical SFX; targeted VFX |
| Effects-heavy sci-fi | digital environments/VP/comp + digital doubles; studio build |
| Large-scale war | crowds + vehicles + practical destruction + location build; mixed FX |

### Calibration risk (the real constraint)

Cost and quality feed box office, which has explicit calibration gates
(`BOX_OFFICE_DIAGNOSTIC` suites). Any change to per-department cost curves or
quality realisation must be staged against those gates. This is why the *fit-read*
implementation floor deliberately touches **neither** cost nor scoring first.

---

## Phase C — Role-specific designs

One design per head. Each defines: relevant requirements read · **technical**
specialties · **creative/aesthetic** fit (kept separate) · shared-frame traits ·
track record (known) vs future (uncertain) · project-interest model · cost effect
· schedule effect · quality effect (difficulty *handled*) · risks/events ·
director & cast interactions. Fuller for the first-implementation heads
(VFX, Production Designer, Stunt Coordinator); the rest are sketches to expand.

### Production Designer
- **Requirements:** period architecture, studio interiors, location build/augment,
  (creature-build until Creature promoted). **Technical:** period authenticity,
  scale build, practical-set craft. **Creative:** visual world coherence, tonal
  match to director. **Effects:** set facet quality (extend existing), prep
  schedule (already), build cost. **Risk:** over-reaching build boom/bust (already
  modelled as set events). **Interactions:** practical-leaning directors thrive.

### VFX Supervisor
- **Requirements:** digital environment, full-CG, greenscreen comp, VP, creature
  animation, digital doubles. **Technical:** environment work vs character/creature
  animation vs comp/integration (distinct specialties — a great environment house
  ≠ great creature animator). **Creative:** photoreal vs stylised. **Effects:** VFX
  facet quality, post schedule (already), the practical/digital *integration*
  quality. **Risk:** shot failures/redos (already). **Interactions:** clashes with a
  practical-first director; thrives with a digital-forward one.

### Stunt Coordinator (elevated to full head — locked)
- **Requirements:** hand-to-hand, firearms, swordplay, vehicle stunts, wire work,
  practical destruction. **Technical:** discipline-specific (a fight coordinator ≠
  a vehicle/precision-driving specialist). **Creative:** grounded vs heightened
  action language. **Effects:** practical facet (generalise from stunt-team skill
  to a courted head), stunt prep schedule, action-clarity contribution.
  **Risk:** injuries, reshoots, insurance/holding costs. **Interactions:** actor
  physical-demand tolerance; director action style. This role is the deliberate
  **anti-bias test** — if the requirements model can express fight/firearm/vehicle
  work as first-class, it is not sets/digital-biased.

### Cinematographer (sketch)
- **Technical:** natural vs controlled light, low-light, action clarity,
  large-format, VP/greenscreen photography, practical-effects photography.
  **Creative:** period visual language, intimate vs spectacle. **Effects:** visual
  quality, shoot speed, lighting/equipment cost, location feasibility,
  practical/digital integration, **DP↔director aesthetic fit**.

### Editor (sketch)
- **Technical:** action geography, comedy timing, suspense, nonlinear, salvaging
  difficult footage, effects-heavy post. **Effects:** pacing quality, *salvage of a
  troubled shoot* (reads the shoot's own difficulty/events), post schedule.
  Value depends on what footage was actually produced, not genre alone.

### Composer (sketch)
- **Technical/idiom:** orchestral, electronic, horror atmosphere,
  theme/leitmotif, comedy, action, minimalist drama, song-driven, period
  authenticity. **Effects:** music quality, recording scale/cost, audience &
  awards appeal. Matches script **tone/genre**, a different demand surface from
  the physical departments.

### Casting Director (built)
- Already role-specific (discovery/info/audition/forecast). Included for
  completeness; align its "shared frame" traits with the others.

### Director (Workstream I Phase 7 for hiring UX; here for craft interactions)
- Craft dimension: practical-vs-digital philosophy, action style, actor-direction
  — the compatibility surface other heads and cast match against.

### Writer (role-specific — locked, not flat-skill)
- Writers don't consume physical workloads, but need their own model:
  commissioning, rewrites, adaptation, dialogue polish, **production rewrites**
  (writing around budget/schedule constraints), genre idiom. **Effects:** script
  quality dimensions, and a *production-rewrite* lever that can trade script scope
  against department workload/cost. Track record known; fit-for-this-project
  uncertain.

### Package departments (independent workloads, promotable later — locked)
- **Costume, Makeup/Prosthetics, Practical SFX, Creature.** Initially selected as
  capability packages / specialists under a head or as production-plan choices,
  **but** each gets its own `DepartmentWorkload`, cost, risk and quality output
  from day one — modelled separately even while the UI bundles them, so promotion
  to a courted head is additive, not a migration.

---

## Implementation phasing (after A + B agreed)

1. **Fit-read floor** — VFX + Production Designer + Stunt Coordinator suitability:
   specialty-vs-workload fit + track-record/uncertainty presentation, reading the
   new requirements model. **No cost or scoring change.** Kills "buy the best" for
   the three roles where it matters most; fully shippable and calibration-safe.
2. **Cost & schedule integration** for those three (calibration-gated).
3. **Quality realisation + events** — generalise the facet model to the new
   departments (calibration-gated).
4. **Cinematographer, Composer, Editor** — their own dimensions + technical/creative
   fit split.
5. **Director & cast interactions** — philosophy clashes, actor physical-demand
   responses, unlock/recommend approaches (hiring changes strategy, not just
   quality).
6. **Finer taxonomy expansion** — deepen the requirement content beyond the initial
   mid-grained set.
7. **Package departments surfaced** (Costume/Makeup/SFX/Creature) and promotions.
   Writer model slots alongside as a script-stage piece.

Sequencing rule: cost/scoring-touching phases (2, 3) are calibration-gated and
staged deliberately; the fit-read floor (1) and presentation work carry no
calibration risk and go first.

## Open questions carried into the docs

- None blocking. Q1–Q3 answered: Phase A audit is the first concrete deliverable;
  full taxonomy structure with a mid-grained initial content set; Stunt
  Coordinator is a full head, other physical departments modelled independently
  as packages first.
