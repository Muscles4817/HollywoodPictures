# Design Review — Development & Financing

**Status:** Design agreed; ready to build **Phase 1**.
**Related:** `docs/DESIGN_production_timeline_audit.md` (the production timeline
this feature front-loads), `docs/SIMULATION_PHILOSOPHY.md` (the principles this
follows).

This document specifies a **Development** stage that today does not exist — it is
currently swallowed into pre-production — plus a **creative-disagreement** system
and a **financing** system, unified under a single *project readiness* model.

---

## 1. Design pillars (the non-negotiables)

These came out of design discussion and everything below must serve them:

1. **Development is its own state**, distinct from pre-production. A project can
   sit in development for a long time — potentially years — as its package and
   financing assemble. That time is **emergent** (waiting on rewrites,
   availability, financing), never a hardcoded duration.
2. **Creatives have opinions, not just yes/no.** A director/star/producer comes
   with a *vision* and raises *demands* — rewrites, a specific writer or
   cinematographer, casting, scale. Demands cost time and money and can gridlock
   on scheduling. This is the engine of development hell.
3. **Few but consequential forks: 0–10 per project**, scaled by initial
   alignment and personalities. A team of low-vision "yes-men" can produce
   **~0** demands — smooth, cheap, fast — **but risks a bland film**, because
   creative friction is the source of a film's *upside*, not just its cost.
4. **Accepting a demand is a bet, not a gift — "the Snyder principle."** A demand
   is *sometimes secretly great and sometimes quietly ruinous.* The deciding
   factor is the creative's **competence in the specific domain they want control
   over**, not their overall fame or talent. A brilliant *visual* director who
   demands *script* control usually makes the film worse. The player's skill is
   judging whether this person is actually good at *the thing they're asking to
   own.*
5. **Projects can die — but not easily.** Death is a *spiral* (a refused demand →
   a creative walks → readiness collapses → the option lapses / forced
   turnaround), never a single unlucky roll.
6. **Financing is a real system.** Not every film is 100% studio-financed.
   Producers can join bringing financiers *and* their own creative ideas and
   preferred talent/crew — money always arrives with strings.

Standard house rules still apply: **pure `engine/`**, **derive-don't-store**,
**qualitative player-facing** presentation, **data-driven tunables**, and — we
are pre-launch — **schema may change freely, no save migrations**.

---

## 2. The pipeline: a new Development state

Today `Project` only exists *at* greenlight (`types/index.ts`: Opportunity →
Asset → Project → Film). We introduce a pre-greenlight Project state:

```
Opportunity → Asset ──┐
                      ▼
        ┌─────────────────────────────────┐
        │   PROJECT · status: development  │   ← NEW
        │   attachments + demands +        │
        │   financing stack assemble here  │
        └──────────────┬──────────────────┘
             ┌─────────┴──────────┐
             ▼                    ▼
     GREENLIGHT (exercise    TURNAROUND (sell to a
      the option — gated      rival / market to recoup
      on readiness)           sunk dev+option cost)
             │
             ▼
   Pre-production → Shoot → Post → Release   (existing FilmDraft flow, unchanged)
```

`Project.status` lifecycle: **`development` → `greenlit` → `shooting` → `post` →
`scheduled` → `released`**. Greenlight **freezes the package** (Script snapshot,
cast, crew, financing terms) exactly as `FilmDraft.script` is already frozen
today. Everything in this doc happens in the `development` state.

---

## 3. Readiness — one derived reading, one gate

`readiness` is **never stored** — it is derived each render from four components
and surfaced qualitatively: **stalled → warming → packaged → greenlightable.**

| Component | Fed by | Greenlight blocked while… |
|---|---|---|
| **Script maturity** | development passes (extends `engine/rewrite.ts`) | below the threshold a financier/creative demands |
| **Attachments** | director + required leads + key crew locked | a *required* slot is empty or an attached creative is unsatisfied enough to walk |
| **Financing** | the financing stack covers the budget | an uncovered gap remains |
| **Open blocking demands** | the creative-demand queue | any demand flagged *blocking* is unresolved |

**Greenlight is disabled until all four clear.** That gate *is* the development
game. Note this makes development length emergent: the calendar advances (your
real-time clock) while the player waits on rewrites, availability windows, and
financing — not via any `DEVELOPMENT_DAYS` constant.

---

## 4. Attachments & domain aptitudes

Attaching a creative becomes **attach → they bring a vision → they raise demands
→ you resolve them over time**, not a checkbox.

### 4.1 Domain aptitudes (the key new data)

To express "brilliant visual director, poor story instincts," a single skill
number is not enough. Directors (and key creatives) gain a small set of
**domain aptitudes**, each 0–100:

- **Story** (script/structure/character judgment)
- **Visual** (cinematography, spectacle, production design)
- **Performance** (directing actors)
- **Craft** (edit, pacing, sound/music sensibility)

A creative's *overall* reputation can be high while a specific aptitude is low —
that gap is the entire Snyder principle. Aptitudes are **partially hidden**: the
player reads them through track record, a domain reputation ("visionary
stylist," "actor's director," "script doctor's nightmare"), and
relationship/scouting — never as raw numbers (house rule 3).

> **Alternative considered:** derive aptitudes from existing personality traits
> instead of adding fields. Rejected for Phase-2 richness — we want "great at X,
> weak at Y" to be authorable and readable, which a derived blob can't guarantee.
> Aptitudes are additive, optional fields (older/simpler talent read as neutral),
> matching the additive-seam pattern `Asset` already uses.

### 4.2 Vision

Each attachable creative carries a **`CreativeVision`**: a tone/genre lean, a
target scale/budget, script axes they want lifted, and **preferred
collaborators** (a specific writer, cinematographer, or co-star they "bring").
Vision is compared against the current package to seed tension and demands,
reusing `engine/creativeTension.ts`, `engine/compatibility.ts`,
`engine/pairHistory.ts`.

---

## 5. The creative-demand loop

### 5.1 How many demands (0–10)

Demand count is **derived**, not rolled flat, from:

- **Alignment**: vision-clash between each attached creative and (a) the script,
  (b) the other attached creatives — via `creativeTension`/`compatibility`.
  Aligned package → few; clashing auteurs → many.
- **Demand propensity** per creative: driven by **ego + vision strength**
  (`personality`). A low-ego, low-vision director on an aligned script emits
  **~0**; two strong-vision, high-ego creatives who disagree can reach **~10**
  between them.

This delivers pillar 3 directly: a yes-man team is quiet, a clash is a storm.

### 5.2 What a demand is

A `CreativeDemand` targets a **domain** and carries a strength and the demander's
conviction:

- `domain`: `Script | Casting | Cinematography | Edit | Score | ProductionDesign | VFX | Practical | Scale`
- Examples: *"rewrite to raise Dialogue"*, *"bring cinematographer X"*, *"recast
  the lead"*, *"push the scale/budget up"*, *"final-cut leaning artistic."*
- Surfaced as a `PendingChoice` (same UI + reducer pattern as production events /
  test screenings).

### 5.3 Resolving a demand — the competence-driven bet (pillar 4)

Three responses:

- **Accept** → cede control of that domain to the creative. The relevant quality
  axis moves by a delta whose **expected value is driven by the creative's
  aptitude in *that* domain**, scaled by demand strength, with real variance
  (it's a bet). Plus the concrete side-effects the demand implies (books the
  demanded collaborator → cost + their availability window; triggers a rewrite →
  +weeks + a `rewrite.ts` roll; raises scale → budget up).
  - High domain aptitude → positive expected delta (they know what they're
    doing).
  - **Low domain aptitude but demanding anyway (ego-driven overreach) → negative
    expected delta** — the Snyder case. Their genius elsewhere does not save the
    domain they're wrong about.
- **Negotiate** → a partial (a polish instead of a full rewrite; a cheaper
  comparable collaborator). Smaller delta both ways, small tension cost.
- **Refuse** → keep control. No delta (good or bad), but **raises creative
  tension** (`creativeTension`), risks the creative **walking** (5.5), and
  **forgoes the upside** the demand might have carried.

**Worked example (the pillar in one paragraph).** You attach a director with
Visual 92, Story 34, high ego. On an aligned shoot they might raise only 2
demands; misaligned, up to ~6. One demand is *"let me rewrite the third act"*
(domain = Script). Accepting cedes the script to a Story-34 talent: expected
*negative* delta with wide variance — occasionally he surprises everyone, usually
he flattens the characters. Refusing keeps your Story axis safe but spikes his
tension; refuse too much and he walks, and a half-packaged tentpole with a
departed director slides toward turnaround. Meanwhile his *"shoot it on
anamorphic with cinematographer K"* demand (domain = Visual, aptitude 92) is
almost pure upside — but K is booked for 7 months, so accepting **gates your
shoot start** on K's availability. That is the whole game: read the aptitude
behind each demand, and pay in time/tension for the ones worth having.

### 5.4 The blandness floor (why yes-men need a great script)

Creative friction is the source of **both tails** of the outcome distribution.
So the resolution model must feed **endogenous variance** (ties to
`engine/boxOfficeVariance.diagnostic`):

- A project with **accepted, competent demands** has a **raised quality ceiling**
  (real vision was applied where it belonged).
- A project with **no creative input at all** (yes-men, or everything refused)
  collapses toward a **compressed distribution around a mediocre mean** — safe,
  cheap, fast, and *capped*. It can only be rescued by an already-excellent
  script and crew (which supply the ceiling the creatives didn't).

So "pick a team of yes-men" is a legitimate, sometimes-correct strategy — cheap
and controllable — that quietly forfeits greatness. Exactly the intended tension.

### 5.5 Walking, tension, and project death (pillar 5)

- Each refusal adds to a creative's **tension**; high tension + high ego + weak
  relationship → a **walk-risk** roll (reuses personality/reliability).
- A walk knocks readiness down (an empty required slot) and can **cascade**
  (a co-star attached *because of* that director may reconsider).
- **Death is a spiral, never one roll:** walk → readiness collapse → can't
  re-package before the **option expires** (§8) → forced turnaround or write-off.
  Fixers (§7), a strong relationship, or caving on a demand can always arrest the
  spiral — which is why death is *possible but not easy.*

---

## 5a. Phase 2 concrete design (locked decisions)

Phase 2 builds §4–§5. Decisions taken:

1. **Aptitude granularity: 4 domains** — `Story / Visual / Performance / Craft`.
   Coarse enough to read qualitatively, expressive enough for the Snyder shape.
2. **Only directors raise demands in the first slice.** Lead stars and producers
   are added in a later slice, to keep the first cut legible.
3. **Aptitudes are partially revealed, and relationship sharpens the read.** A
   reputation-level tag is always visible; a stronger working relationship
   (collaboration history) resolves a sharper per-domain read. Never raw numbers.

### Domain aptitudes — derive-when-absent (mirrors `handsOn`/`philosophy`)

```ts
interface DomainAptitudes { story: number; visual: number; performance: number; craft: number; } // 0–100
// DirectorCareer.aptitudes?: DomainAptitudes   (authored override for marquee directors)
```
`deriveAptitudes(person)`: authored value if present; else a **stable per-person**
derivation (via `actingModel.stableUnit`, not rng — same discipline as
`crewPhilosophy`/`directorHandsOn`) **centred on the director's overall `skill`
with an independent per-domain spread**, so overall competence is preserved while
domains genuinely diverge. Dramatic "great visual / weak story" cases come from
*authored* marquee aptitudes; the derived default supplies moderate texture.

| Aptitude | Governs (reads/moves) |
|---|---|
| Story | script craft (structure/characters/dialogue/originality) |
| Visual | `cinematographyFacet`, `setsFacet`, spectacle |
| Performance | directing actors (`handsOn` + `actingModel`) |
| Craft | `editFacet`, `scoreFacet`, pacing |

### Partial reveal

`describeDirectorAptitudes(person, relationship?)` → a **qualitative** read whose
resolution scales with relationship familiarity (`collaborations`): at arm's
length, only the standout strength and standout weakness are named, coarsely; a
close relationship resolves a per-domain band (exceptional/strong/solid/shaky).
Never numbers (house rule 3).

### Demand resolution (the Snyder bet), concretely

`accept`: `Δquality ≈ strength · f(aptitude[governor])` (f(50)=0, f(100)=+max,
f(0)=−max) `± variance` widened by volatility/ego; plus side-effects (book a
preferred collaborator → cost + availability window gating the shoot start;
trigger a rewrite via `reviseScript`; raise Scale → budget). `negotiate`: partial
Δ + partial side-effect + small tension. `refuse`: no Δ, `tension↑`, walk-risk
roll, and the upside is forgone.

Demand count is derived per director: `round(propensity(ego, visionStrength) ·
clash(vision, script))`, capped at 10; a low-ego, low-vision director on an
aligned script raises ~0.

### Phase 2 sub-phasing (ship in thirds)

- **2a — domain aptitudes + partial-reveal read.** ✅ **Shipped.**
  `DomainAptitudes` type, `deriveDirectorAptitudes` (derive-when-absent),
  `describeDirectorAptitudes` (relationship-scaled). Data foundation.
- **2b — demand generation + accept/refuse quality deltas.** ✅ **Shipped.**
  `CreativeDemand` on `DevelopmentState`; `deriveDemandLoad` /
  `generateCreativeDemands` (regenerated on director attach, seeded per
  director+script); `resolveDemandQualityDelta` (the Snyder bet); a
  `RESOLVE_CREATIVE_DEMAND` action; blocking demands gate Greenlight; accepted
  demands' net swing frozen onto `FilmDraft.developmentQualityDelta` at
  Greenlight and folded into final Quality; demands panel in the Producer
  Workspace using 2a's relationship-gated read. (Vision stayed implicit — demand
  generation reads aptitudes + ego + tone-clash directly.)
- **2c — walk-risk & tension.** ✅ **Shipped.** Refusing a demand spends the
  director's patience (deterministic; ego-weighted, raised by loyalty and a real
  working history); exhaust it and they **walk off the project** (removed from the
  package, demands cleared, readiness back to "no director"). A qualitative
  patience read warns before the walk, so it's never a blind surprise. This is
  the "refusing isn't free" teeth — and it makes a *known, loyal* director safer
  to push back on.
- **2c (remaining) — blandness & accept-side-effects.** Still to do:
  - **Blandness → outcome variance.** Deferred deliberately: it's a *global*
    balance lever (every vision-free film, plus rivals, plus the box-office
    calibration diagnostics) and needs its own calibration pass, not a bolt-on.
  - **Accept side-effects:** a demanded collaborator's booking gating the shoot
    start, a Script demand triggering a real rewrite, a Scale demand bumping the
    budget. Plumbing-heavy (casting/script/plan); a focused follow-up slice.

---

## 6. Financing as a stack

Replace "studio funds 100%." A development Project has a **budget** (negative cost
+ P&A) and a **financing stack** whose sources must cover it before greenlight:

| Source | Brings | Costs you |
|---|---|---|
| **Studio equity** | your own cash (the ledger) | full exposure, full upside |
| **Producer-brought financier** | a % of budget, via an attached producer | a revenue share **+ that partner's demands** (talent/crew, casting approval, creative input) |
| **Pre-sale / negative pickup** | up-front money from a distributor | worse terms, less control (pull existing `distribution.ts` offers *earlier*) |
| **Co-finance / slate partner** | a % of cost | that % of upside — de-risks a bet you're unsure of |
| **Gap + completion bond** | covers an over-budget film | the guarantor can **seize a runaway production** (ties to contingency/overrun events) |

At release, revenue flows through a **recoupment waterfall** across the stack — a
natural extension of the distribution keep-share + `engine/backend.ts`
settlement. Self-financing becomes one high-risk/high-reward choice among several.
Crucially, **financier money arrives with demands** (§5), so financing and
creative-disagreement are the same knot, as in real life.

---

## 7. Producers as the connective tissue

The existing `ProducerSpecialty` (`Line | Creative | Executive | Fixer`) is the
bridge. Attaching a producer becomes "who am I getting into bed with, and what do
they want":

- **Executive** → brings **financing** (money + the financier's demands).
- **Creative** → brings a **vision + demands + preferred talent** they package in
  (a director or star).
- **Line** → cuts cost/overruns (already modeled — now also makes a self-financed
  bet affordable).
- **Fixer** → **resolves demands / unblocks stalls faster** — the antidote to a
  death spiral.

This unifies packaging, financing, and creative disagreement under one
attachment layer rather than three parallel systems.

---

## 8. Turnaround & the option clock

- An owned Asset / development Project carries an **option clock**; letting it go
  cold costs a small **carry** (dev overhead / renewal) or the rights lapse.
  A stuffed slate bleeds money — the discipline that forces greenlight-or-let-go.
- **Turnaround:** sell a development Project to a rival or the market to recoup
  part of sunk dev + option cost; value derived from readiness + package quality
  + sunk cost. Conversely, **buy** rivals' stalled projects. Development becomes a
  live secondary market and gives the death-spiral a productive exit.

---

## 9. Information & player skill

The game is judgment under partial information (house rule 3):

- Domain aptitudes are **read qualitatively** — track record, a domain
  reputation, relationship familiarity, and optional scouting — never raw numbers.
- The player's edge is **assembling an aligned package** *and* **calling each
  demand right** (accept the competent ones, refuse the overreaching ones, pay
  the scheduling cost only where the upside justifies it).
- Playing the "give the auteur everything" fantasy is *allowed and sometimes
  wrong* — accepting an out-of-domain demand is exactly how a visually stunning
  film ends up with a broken script.

---

## 10. Where the "years" come from (emergent)

No `DEVELOPMENT_DURATION` constant. Development time = the real-time clock
advancing while the player resolves the demand queue, **waits on booking windows**
for demanded collaborators, runs rewrite passes, and closes financing. A
demanding auteur who wants a specific DP booked a year out *is* a year-plus in
development — as a consequence of the package, mirroring the timeline recalibration
philosophy.

---

## 11. Types sketch (conceptual — Phase-by-phase, not final)

```ts
// Project gains a lifecycle and a development payload.
type ProjectStatus = 'development' | 'greenlit' | 'shooting' | 'post' | 'scheduled' | 'released';

interface DevelopmentState {           // present only while status === 'development'
  attachments: Attachment[];           // director, leads, key crew, producers
  demands: CreativeDemand[];           // the open/resolved fork queue
  financing: FinancingStack;
  budgetTarget: Money;
  optionExpiresOnDay?: GameDay;        // the option clock (§8)
}

interface Attachment {
  personId: PersonId;
  role: 'Director' | 'Lead' | ProductionRole | 'Producer';
  vision?: CreativeVision;             // preferences + preferred collaborators
  tension: number;                     // derived accumulation; drives walk-risk
}

// Domain aptitudes (§4.1) — additive optional fields on the director/creative career.
interface DomainAptitudes { story: number; visual: number; performance: number; craft: number; }

interface CreativeDemand {
  id: string;
  demanderId: PersonId;
  domain: 'Script' | 'Casting' | 'Cinematography' | 'Edit' | 'Score' | 'ProductionDesign' | 'VFX' | 'Practical' | 'Scale';
  strength: number;                    // how hard they push
  blocking: boolean;                   // gates greenlight until resolved
  // resolution rolled at accept-time, competence-driven (§5.3), stored for determinism
}

interface FinancingStack { sources: FinancingSource[]; }         // §6
interface FinancingSource { kind: 'studio' | 'producer' | 'presale' | 'cofinance' | 'gap'; amount: Money; terms: /* share, approvals, demands */ }
```

## 12. Engine functions sketch (pure)

- `deriveReadiness(project): ReadinessReading` — the qualitative gate (§3).
- `deriveDemandLoad(attachments, script): number` — the 0–10 count (§5.1).
- `generateCreativeDemands(project, rng): CreativeDemand[]` — seeded by
  alignment + propensity.
- `resolveDemand(demand, response, demander, rng): DemandOutcome` — the
  competence-driven bet (§5.3): quality deltas + side-effects (booking, rewrite,
  budget).
- `walkRisk(attachment): number` — tension × ego ÷ relationship.
- `financingGap(stack, budgetTarget): Money` and `settleWaterfall(...)` — §6.
- `turnaroundValue(project): Money` — §8.

## 13. Reuse map (build on, don't duplicate)

| Need | Existing system |
|---|---|
| Vision clash / friction | `creativeTension`, `compatibility`, `pairHistory` |
| Rewrite passes + risk | `rewrite.ts`, `screenplay.ts` (`reviseScript`) |
| Availability gating | talent booking windows / `latestCastBookingEnd` |
| Producer effects | `producers.ts` (Line/Creative/Executive/Fixer) |
| Financing terms & payout | `distribution.ts`, `backend.ts` |
| Demand UI/flow | `PendingChoice` pattern (production events, test screenings) |
| Endogenous variance | `boxOfficeVariance` diagnostic targets |
| Asset lineage / dev log | `Asset.developmentHistory`, `revisions`, `writerIds` |

---

## 14. Phasing (each shippable; pre-launch, schema free)

1. **Development state + readiness gauge.** ✅ **Shipped.** Pre-greenlight
   `DevelopmentState` phase sub-type on `FilmDraft`, derived `readiness` band,
   greenlight gate. (Built as a phase sub-type, not a `Project` kind — see §2.)
2. **Attachments + domain aptitudes + the demand loop.** Director visions, the
   0–10 demand queue, competence-driven resolution (the Snyder principle),
   availability-gated delays, walk-risk, the blandness floor. **Locked design +
   sub-phasing (2a/2b/2c) in §5a. **2a and 2b shipped; 2c next.**
3. **Financing stack + waterfall.** Sources, terms, the greenlight-must-close
   gate, recoupment at release.
4. **Producers as bridge + turnaround market.** Wire specialties to
   money/demands/fixing; the option clock, buy/sell, project death.

## 15. Tuning knobs (first-draft constants live in `data/`)

Demand-count curve (alignment → 0–10); demand strength/variance; aptitude→delta
mapping (how hard the Snyder penalty bites); walk-risk thresholds; option
carry/renewal cost; financing source share ranges; turnaround recoup fraction;
the blandness compression (how flat a no-vision film's distribution gets).

## 16. Open questions (post-Phase-1)

- **Aptitude granularity:** the 4 domains above (Story/Visual/Performance/Craft),
  or finer (per production facet)? Start with 4; revisit if demands feel coarse.
- **Do rivals run this whole model**, or a lightweight abstraction? (Rivals
  probably use a cheaper approximation, as they do for production today.)
- **How visible is the aptitude read** at first attach vs. after
  scouting/working together? Tunes how much development is a knowledge game.
