# Design Review — Casting Director Model: The Eye, Reputation, and Discovery

A design for what a Casting Director *is*, replacing today's single `skill`
scalar with a small **competence profile** that a producer reads *qualitatively,
through reputation* — never as raw numbers. It follows
`docs/SIMULATION_PHILOSOPHY.md` (endogenous variance, legible causes, real
trade-offs, presentation stays qualitative) and is a direct sibling of
`docs/DESIGN_REVIEW_acting_model.md`: it turns that model's own principles —
a hidden 2-D competence, reputation ≠ ability, reads under uncertainty, history
sharpens them, salary off reputation — onto the person doing the casting.

> Status: **proposed.** Nothing here is built yet. The confidence-capped
> performance projection it composes with *is* shipped
> (`engine/castPerformancePresentation.ts:describeCastingProjection`,
> `components/common/TalentStats.tsx`), and the read/scout/turnaround hooks this
> model reshapes already exist as scalar-driven code
> (`engine/talentCardPresentation.ts:deriveFitReadAssist`,
> `engine/castingCalls.ts` discovery, `auditionDurationDays`). This doc is the
> design to react to and stage, not a PR.

---

## 1. The problem

A Casting Director today is a `CrewCareer<'Casting Director'>` with one number,
`skill` (0-100). That single scalar currently drives three genuinely different
jobs, all uniformly:

- **Reading** — sharpening the fit read on a *specific* actor for a *specific*
  role (`deriveFitReadAssist` → `deriveFitConfidence` → `gateKnownAxes` →
  coverage). It reveals *every* acting-style axis equally.
- **Scouting** — surfacing undiscovered, low-fame "hidden gems" in open casting
  (`castingCalls.ts`: the discovery pick, batch size, curation exponent).
- **Turnaround** — how fast auditions run (`auditionDurationDays`).

Three problems with "one scalar, applied evenly":

1. **A real casting director has an *eye* — for something.** One is known for
   pulling comic talent, another for dramatic transformation. A flat skill can't
   express "brilliant at reading comedy, ordinary at reading physical roles."
2. **Reading and scouting are different competences.** Being able to read a
   known quantity's fit is not the same job as spotting an unknown who could be
   a star. A CD can be great at one and poor at the other.
3. **A producer never knows the true number anyway.** You hire on *reputation* —
   what a CD is *known for* — which can diverge from what they can actually do.

This design fixes all three, and in doing so makes the CD economy the same
"read the reputation, price the risk, hunt for undervalued talent" texture the
actor market already has.

## 2. Principles (and the symmetry that makes it cohere)

Every choice below is the acting model's own principle, re-applied:

| Acting model (shipped) | Casting Director (this doc) |
|---|---|
| Craft = 2-D: floor (mean) × headroom (spikiness) | Eye = 2-D: **level** (mean) × **focus** (concentration) |
| Fame ≠ craft; salary off the fame band | Renown ≠ eye; fee off the **renown** band |
| `coaster` / `undiscovered` / `star-and-craft` | Reputable-but-thin / undiscovered-gem / genuine-great CD |
| Fit read is hedged; audition/CD/history sharpen it | The CD's *own* eye is hedged; **history** working with them sharpens it |
| Player sees archetype + gift, never raw craft | Player sees a reputation read ("an eye for comedy"), never the vector |

The payoff of the symmetry: a player already understands "famous ≠ good, and
you learn the truth by working together." Reusing it for CDs means the subsystem
reads as *the same world*, not a bolted-on minigame.

## 3. The competence model

A Casting Director has a **hidden true competence profile** across three jobs.

### 3.1 The Eye (reading) — a 2-D competence, per acting-style axis

Model the eye exactly like actor craft (`actingModel.ts`): a 2-D space of
overall **level** × **focus**, producing a per-axis competence vector over the
five `ACTING_STYLE_AXES` (`characterTransformation`, `emotionalPerformance`,
`charisma`, `comedy`, `physicalPerformance`).

- **Level** — overall reading ability. High level floods *every* axis; low level
  barely reaches beyond the focus.
- **Focus** — whether that ability is concentrated on one/two axes or spread
  across all five.

The four corners — the variety a single scalar can't produce:

|  | Low focus (spread) | High focus (concentrated) |
|---|---|---|
| **High level** | Broad generalist — good at all | Deep specialist — superb at their axis, still solid elsewhere |
| **Low level**  | Weak all around — a poor CD | One-trick eye — only their wheelhouse, and even that is modest |

This is precisely the "the best are broad **and** deep; the worse they are, the
more coverage shrinks in depth and/or breadth" behavior we want — and it keeps
*two* flavors of elite CD (the broad generalist and the transcendent specialist)
rather than collapsing them into one.

**Proposed shape** (first-draft, tunable — mirrors `deriveCraftFromStyle`):
`axisEye[axis] = clamp( breadthFloor·level + affinity[axis]·level )`, where
`affinity` is a per-CD weight peaking on the specialty axis and `breadthFloor`
rises with level so high-level CDs cover the off-specialty axes too. Result is
`axisEye[axis] ∈ [0,1]` per axis.

**Where it plugs in:** `deriveFitReadAssist` becomes **axis-aware** — instead of
one `cdLevel = skill/100`, the assist to each axis is `axisEye[axis]`. That flows
straight through the existing pipeline: `gateKnownAxes` reveals the axes the CD
can actually read, `knownAxisCoverage` drops for the ones they can't, and — via
the confidence rework already shipped — the **performance projection stays "Hard
to call" for castings outside the CD's eye** and firms up for ones inside it.
Nothing new bolts onto the projection; the behavior emerges.

> Concretely: a comic-eye CD reading a comic unknown → high coverage on `comedy`
> → confident fit → the projection earns "Strong, up to inspired." That *same*
> CD on a demanding dramatic-transformation role → low coverage → "Hard to call"
> until you audition. Your CD's expertise decides which castings you can read.

### 3.2 Scouting (discovery) — a separate competence

Finding undervalued talent is a different job from reading a known quantity's
fit, so it is a **separate competence**, not a slice of the eye. It governs the
`castingCalls.ts` discovery mechanic — the chance and quality of surfacing
low-fame, high-craft "hidden gems" (the actors the acting model calls
`undiscovered`).

Scouting can itself be **axis-flavored** (a scout with a nose for comic unknowns
vs. physical/action ones), reusing the same `affinity` vector idea — but v1 may
keep it a scalar and add the flavor later (§10). A CD strong at Reading can be
weak at Scouting and vice versa; that independence is the point.

### 3.3 Turnaround — keep as-is

Audition speed / throughput (`auditionDurationDays`, batch size) already scales
sensibly with overall ability. Fold it under the eye's **level** (a better CD is
also faster) and leave the mechanic otherwise untouched.

## 4. Reputation ≠ ability; fee off reputation

The competence profile above is **hidden**. Separately, a CD has a **renown**
(their public standing) and a **reputational identity** — what they're *known
for* ("the star-maker," "the drama whisperer").

- **Fee tracks renown, not ability** — exactly as actor `typicalSalary` tracks
  the fame band, decoupled from craft. A reputable CD is expensive whether or not
  their eye is actually broad/deep; an unknown with a genuinely brilliant eye is
  cheap.
- **Reputation can diverge from truth**, giving CDs the actor model's own
  contrast trio: a **reputable-but-thin** CD (renown outruns the eye — a coaster),
  an **undiscovered** CD (a real eye, no name, cheap), and a **genuine great**
  (both). This divergence *is* the strategic texture: the choice is never "buy
  the best you can afford," it's "read the reputation, price the risk, and hunt
  for the undervalued eye."

This supersedes an earlier (wrong) idea of tuning "eye vs. cost" — once fee is
tied to renown rather than ability, that knob dissolves and the interesting
decision is reputation-reading, not budget-maxing.

## 5. Reads under uncertainty — what the player actually sees

Never the vector. The player sees a **reputation-based qualitative read** of the
CD, its firmness scaling with how established the CD is — the same uncertainty
machinery actors already use (`deriveFitConfidence`), now pointed at the CD:

- On a CD hiring card: *"Reputed to have a sharp eye for dramatic performances,"*
  *"A renowned talent-spotter,"* hedged for an unproven name (*"still making a
  name — hard to say what her eye is really for"*). Reuse the
  `crewSpecialty.ts` / `describeStandoutSpecialty` presentation pattern
  (`SPECIALTY_LABEL`), which already gives PD/VFX heads a "known for X" line.
- **History sharpens it.** Work with a CD and your read of their *real* eye
  firms up — *"you've hired her before; her eye for comedy is the real thing"*
  vs. *"...more billing than results."* Keyed off collaboration count, like the
  actor familiarity read (`familiarityLevel`).

So the reputation read is what you *decide* on; the hidden eye is what actually
determines your castings' readability; and the gap between them is gameplay you
close by working together.

## 6. What it composes with (already shipped)

- **The confidence-capped projection** (`describeCastingProjection`, this
  branch): per-axis eye → coverage → fit confidence → projection confidence, with
  zero projection-side changes. This is the single biggest reason to do the eye
  as a per-axis vector rather than a scalar.
- **`gateKnownAxes` / `knownAxisCoverage`** already reveal/veil per axis — they
  just need an axis-shaped assist instead of a uniform one.
- **`castingCalls.ts` discovery** already surfaces hidden gems on a skill gate —
  Scouting replaces that gate.
- **`auditionDurationDays`** — unchanged; reads the eye's level.

## 7. Generation (no stream perturbation)

Follow the acting model's discipline exactly (`actingModel.ts` §"Generation
without stream perturbation"): derive a generated CD's eye level, focus, and
scouting by **hash** from stable per-person entropy, **not** by consuming the rng
stream — authoring a new per-person trait must not reshuffle the whole talent
pool or break seed-specific tests. Marquee CDs get authored profiles; generated
CDs get a sensible hash-seeded default. Renown/fee stay on the existing
reputation generation, decoupled from the eye.

## 8. Presentation summary

- **CD hiring card:** reputation read of the eye ("an eye for comic talent"),
  renown/fee, turnaround — all qualitative.
- **Actor card assist note:** when your CD's eye covers this role, the existing
  assist note names *why* the read firmed up (*"your casting director knows
  comedy when she sees it"*), extending today's `ASSIST_NOTE`.
- **Never shown:** the per-axis vector, level, focus, or scouting numbers.

## 9. Open decisions / knobs

1. **Scouting: scalar or axis-flavored in v1?** (Recommend scalar first,
   axis-flavor as fast-follow.)
2. **Renown↔eye correlation strength** — how often coasters / undiscovered CDs
   occur. Loose positive correlation with real divergence, matching actors.
3. **Focus distribution** — how common the transcendent specialist is vs. the
   broad generalist at the top end (a right-skew, like actor headroom).
4. **Does a hired CD's eye also affect the *audition* read** (already the
   strongest assist), or only pre-audition scouting/reading? (Lean: audition
   stays the ceiling; the eye sharpens everything short of it.)

## 10. Phased build plan

- **v1 — The Eye (reading), self-contained.** Add the 2-D eye + per-axis vector
  to the CD career; make `deriveFitReadAssist` axis-aware; add the reputation
  read + history sharpening; author/seed generation. This slice plugs straight
  into the shipped projection and is independently valuable. *Recommended first
  bite.*
- **v2 — Scouting + reputation divergence.** Replace the `castingCalls.ts`
  discovery gate with the Scouting competence; add the reputable-but-thin /
  undiscovered-CD contrast and its fee decoupling; surface the divergence via
  history.
- **v3 — Polish.** Axis-flavored scouting, marquee-CD authoring pass, tuning of
  the knobs in §9 against a diagnostic harness (mirror
  `actingModel.diagnostic.test.ts`).

## 11. Non-goals

- **Save compatibility** is out of scope per `CLAUDE.md` (pre-launch); bump the
  save version freely when the CD career shape changes.
- **Negotiation / closing** (getting an actor to sign, cheaper) is a distinct
  concern and not part of the CD competence here.
- **No raw numbers** reach the player, ever — the whole subsystem is authored to
  be read qualitatively.
