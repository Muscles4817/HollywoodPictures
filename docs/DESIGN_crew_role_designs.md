# Design — Crew role-specific designs (Workstream II, Phase C)

Status: **draft for review — design only.** Written against the locked model in
`DESIGN_production_requirements_model.md` (incl. Revision 1) and grounded in
`AUDIT_crew_responsibilities.md`. One design per creative head, plus the
package departments.

## Shared template

Every head is specified on the same axes so the framework stays uniform:

- **Responsibilities** — what it owns; which Execution-Strategy axes it
  makes/participates in.
- **Technical capability** — per-specialty execution **plus** experience,
  leadership, problem-solving, management (how well it handles a hard production).
- **Creative philosophy** — the vector that feeds compatibility and approach-fit
  (distinct from capability).
- **Working style** — facets (perfectionist · fast · collaborative · adaptable)
  and what they drive (events, morale, collaboration, creative upside, recovery).
- **Reads** — which requirements route to it under which strategies.
- **Department Simulation** — outputs (quality/schedule/cost/risk) + its **event
  surface** + the **feedback loops** it can trigger.
- **Compatibility edges** — the collaborator edges it participates in.
- **Cast/director interactions.**
- **Existing hooks** — from the audit (what to reuse/migrate).

Priority for *implementation* (not design): the floor heads (VFX, Production
Designer, Stunt Coordinator) first; the **bring-up-to-standard** heads
(Cinematographer, Composer, Editor) are the highest-value correctness fixes but
calibration-gated. The already-strong heads (Director, Casting Director, Writer)
mainly gain new *participations* (compatibility, feedback loops).

---

## Production Designer  (floor head)

- **Responsibilities.** Physical design & sets; owns Environment-build and
  Period-design decisions; participates in `environmentMethod` and
  `creatureMethod` (practical build) strategy axes.
- **Technical capability.** Specialties: period authenticity, scale build,
  studio-interior craft, location build/augmentation. Plus management (running a
  large art department on a big build).
- **Creative philosophy.** Practical/tactile ↔ suggestive/minimal; realism ↔
  stylisation.
- **Working style.** Perfectionist build (upside on ambition, poor recovery when
  a build slips); collaborative (lifts DP/VFX integration).
- **Reads.** Physical-Environments requirements; Character-Transformation *build*
  portions until Costume/Creature are promoted; routed under `environmentMethod`.
- **Department Simulation.** Sets facet quality (**generalise existing
  `setsFacet.ts`**), prep-length (already drives `designPrepDays`), build cost;
  event surface: set triumph/collapse (exists), over-reaching-build boom/bust.
  **Feedback:** an over-scope build → recommend a strategy change (studio vs
  location) or a production-rewrite to trim environments.
- **Compatibility.** Director↔PD (aesthetic), PD↔VFX (practical/digital
  integration), PD↔DP (how sets photograph).
- **Existing hooks.** The strongest existing model; award category is **missing**
  (coverage unification should add Best Production Design).

## VFX Supervisor  (floor head)

- **Responsibilities.** Digital effects; owns digital-imagery decisions;
  participates in `creatureMethod`, `environmentMethod` (digital extension),
  `destructionMethod` (CG).
- **Technical capability.** *Distinct* specialties — digital environments,
  creature animation, compositing/integration, digital doubles (a great
  environment house ≠ a great creature animator). Plus pipeline management.
- **Creative philosophy.** Photoreal ↔ stylised; invisible-VFX ↔ spectacle.
- **Working style.** Methodical (fewer redos, slower) ↔ aggressive (faster,
  higher redo risk); collaboration drives practical/digital integration quality.
- **Reads.** Digital-Imagery requirements + any requirement whose strategy routes
  to digital (a Fully-CG creature loads VFX heavily).
- **Department Simulation.** VFX facet quality (**generalise `facetModel`**), post
  schedule (exists), the 1.15× unhired penalty (exists), integration quality
  shared with PD/DP; event surface: shot breakthrough/redo (exists), pipeline
  overload. **Feedback:** overload → recommend hybrid/practical method or a
  scope-reducing rewrite.
- **Compatibility.** PD↔VFX, DP↔VFX (plate photography), Director↔VFX (philosophy).
- **Existing hooks.** Real facet + award; specialties undifferentiated today
  (one `vfxAmount`).

## Stunt Coordinator  (floor head — promoted from the stunt pool)

- **Responsibilities.** Practical action; owns action-execution decisions;
  participates in `destructionMethod` and a new `actionMethod` (grounded ↔
  heightened, practical ↔ assisted).
- **Technical capability.** *Distinct* specialties — hand-to-hand, firearms,
  swordplay, vehicle/precision driving, wire work, practical destruction. Plus
  safety management (the leadership axis matters most here).
- **Creative philosophy.** Grounded realism ↔ heightened spectacle.
- **Working style.** Cautious (fewer injuries, slower) ↔ bold (faster, higher
  injury/reshoot risk); collaboration with actors is central.
- **Reads.** Action/Movement requirements; routed under `actionMethod`.
- **Department Simulation.** Practical facet quality (**generalise
  `practicalFacet.ts` from a pool skill to a courted head**), action-clarity
  contribution, stunt prep schedule; event surface: stunt landing/reshoot
  (exists), **injury** (new — ripples to actor availability and holding cost).
  **Feedback:** an unsafe action scope under the chosen method → recommend a
  method change or rewrite. **This role is the anti-bias test** — if the model
  expresses fights/firearms/vehicles as first-class, it is not sets/digital-biased.
- **Compatibility.** Actor↔Stunt Coordinator (physical-demand tolerance),
  Director↔Stunt (action style).
- **Existing hooks.** Feeds practical facet via `stuntTeamSkill`; no award today.

## Cinematographer  (bring up to standard — highest-value correctness fix)

- **Represents today: nothing mechanical** (absent from scoring). Has an award.
- **Responsibilities.** Photography & lighting; participates in `environmentMethod`
  (how sets/locations are shot) and greenscreen strategy.
- **Technical capability.** Specialties: natural vs controlled light, low-light,
  action clarity, large-format/spectacle, intimate close work, VP/greenscreen
  photography, practical-effects photography.
- **Creative philosophy.** Naturalistic ↔ composed; period visual language;
  intimate ↔ spectacle.
- **Working style.** Meticulous lighting (upside + slower/costlier) ↔ nimble.
- **Reads.** A *new* visual-demand read derived from setting/environment strategy,
  action, low-light scenes, VP/greenscreen load.
- **Department Simulation.** A **new** cinematography facet (visual quality),
  shoot-speed and lighting/equipment cost effects, location feasibility, and
  **practical/digital integration quality shared with PD/VFX**; event surface:
  a lighting triumph, a weather/location photography setback.
  **Calibration-gated** (adds a real quality term).
- **Compatibility.** Director↔DP (the classic creative marriage — a primary
  source of "they inspire each other" stories), DP↔VFX, DP↔PD.
- **Existing hooks.** Award exists; quality dimension entirely missing.

## Composer  (bring up to standard — highest-value correctness fix)

- **Represents today: the person is inert** (quality = `musicFocus` menu choice).
  Has an award.
- **Responsibilities.** The score; participates in a `scoringApproach` strategy
  (song-driven ↔ orchestral ↔ electronic ↔ minimal) that currently hides in
  `musicFocus`.
- **Technical capability.** Idiom specialties — orchestral, electronic, horror
  atmosphere, theme/leitmotif, comedy, action, minimalist drama, period
  authenticity.
- **Creative philosophy.** Wall-to-wall ↔ restrained; melodic ↔ textural.
- **Working style.** Collaborative with the director on temp/theme; recovery when
  a cut changes late.
- **Reads.** Script **tone/genre** (a different demand surface from the physical
  departments) + recording-scale strategy.
- **Department Simulation.** **Replace the `musicFocus` proxy with person-driven
  realisation** — music quality from composer capability × idiom-match × recording
  resources; recording-scale cost; audience/awards interaction. Calibration-gated.
- **Compatibility.** Director↔Composer (tonal alignment).
- **Existing hooks.** Award exists; the menu-choice proxy must be retired.

## Editor  (bring up to standard)

- **Represents today: schedule + realisation ceiling** (quality is `editStyle`
  menu choice). Has an award.
- **Responsibilities.** Assembly & pacing; participates in a cut-strategy that
  currently hides in `editStyle`.
- **Technical capability.** Specialties: action geography, comedy timing,
  suspense construction, emotional pacing, nonlinear structure, **salvaging
  difficult footage**, effects-heavy post.
- **Creative philosophy.** Invisible/classical ↔ kinetic/showy.
- **Working style.** Fast turnaround ↔ meticulous; recovery is the signature axis
  — a great editor's value spikes on a **troubled** shoot.
- **Reads.** Genre + **the shoot's own difficulty/events** (what footage actually
  came back), not genre alone.
- **Department Simulation.** Link skill to delivered edit quality (**retire the
  `editStyle`-only proxy**), keep the post-schedule effect (exists); event
  surface: a save-in-the-edit, a structural problem surfaced late.
  Calibration-gated.
- **Compatibility.** Director↔Editor (final-cut alignment).
- **Existing hooks.** Schedule wired; quality decoupled from the hire.

## Director  (already strong — new participations)

- Keep the existing rich model (skill, toneProfile, productionStyle, handsOn,
  full appeal model). **Add:** a practical-vs-digital **philosophy** that
  participates in the compatibility graph (the hub most edges connect to) and in
  feedback loops (a practical-first director resists a Fully-CG strategy). The
  Director is the natural centre of the "creative marriage / clash" stories.

## Casting Director  (already role-specific — align to the frame)

- Complete (discovery/info/audition/forecast). For consistency, express its
  existing behaviour on the shared three dimensions (technical = discovery reach;
  philosophy = star-led ↔ discovery-led; working style = thoroughness), so it sits
  in the same framework as the other heads. No mechanical change required.

## Writer  (role-specific — not flat skill)

- **Responsibilities.** The screenplay; owns the **production-rewrite** lever —
  the primary *feedback-loop actuator*: when a department is over-loaded or the
  budget can't meet the requirement profile, a production rewrite trims/retargets
  narrative requirements (fewer locations, a smaller creature, a contained
  third act).
- **Technical capability.** Reuse `WriterCreativeProfile`; specialties across
  commissioning, adaptation, dialogue polish, structural rewrite, and
  writing-to-constraint.
- **Department Simulation.** Feeds `scriptScore` (exists); the production-rewrite
  changes the RequirementProfile itself, closing the top feedback loop.
- **Compatibility.** Writer↔Director (voice alignment) — lower priority edge.

## Package departments (workloads modelled now, heads later)

Modelled as independent `DepartmentWorkload`s + routing from day one, selected as
capability packages / production-plan choices initially, promotable to full heads
without migration:

- **Costume** — routes period-costume & costume-complexity requirements (today
  folded into `periodSetting` + PD). Outputs: costume facet, fabrication schedule.
- **Makeup / Prosthetics** — routes prosthetics/transformation requirements.
  Outputs: makeup facet, application schedule (affects daily call times → shoot
  pace).
- **Practical SFX** — routes practical-destruction/mechanical requirements (today
  in `practicalEffectsAmount`). Outputs: practical facet share, on-set risk.
- **Creature** — routes creature-embodiment; splits with VFX by `creatureMethod`
  (build vs animate). Outputs: creature facet, integration with PD/VFX/Stunts.

---

## How Phase C maps to implementation phases

- **Floor (no cost/scoring):** PD, VFX, Stunt Coordinator — suitability fit-reads
  (technical × workload) + track-record/uncertainty presentation.
- **Coverage-unification (calibration-gated, proposed as one phase):** give
  Cinematographer & Composer real quality dimensions, add Best Production Design,
  retire the `musicFocus`/`editStyle` quality proxies. *(Open decision #4 —
  recommend this be one deliberate phase rather than scattered, so the
  box-office recalibration happens once.)*
- **Execution Strategy as gameplay:** surface `creatureMethod` / `environmentMethod`
  / `destructionMethod` / `actionMethod` as producer decisions (Revision-1 #2).
- **Feedback loops:** the production-rewrite lever + strategy-change recommendations.
- **Compatibility & events:** the derived edges + their story/event surface,
  starting with Director↔DP, Director↔PD, PD↔VFX, Actor↔Stunt.
- **Package departments → heads:** promote Costume/Makeup/SFX/Creature when their
  workloads justify a courted hire.

## Remaining open decisions (from Phase B, carried)

1. **Coverage-unification as one phase?** (recommend yes.)
2. **Working style:** reuse personality axes + a couple of production-specific
   facets guarded by the inclusion test (recommend yes).
3. **Starter compatibility edges** confirmed as Director↔DP, Director↔PD, PD↔VFX,
   Actor↔Stunt — or reprioritise.

With these settled, the model + role designs are complete and the implementation
floor can begin, in parallel with Workstream I.
