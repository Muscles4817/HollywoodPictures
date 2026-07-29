# Design Review — Determinants & Source Generation (the "why sources differ" audit)

**Status:** Audit only. No engine changes. This is the companion to
`DESIGN_REVIEW_opportunities_market_restructure.md` and supersedes one
conclusion in it (see "Correction" below).

**The question this answers:** If we were designing Hollywood Pictures from
scratch, which `Script` values should be primarily determined by (a) the initial
idea, (b) the writer, (c) the rewrite process, (d) the production process, and
(e) marketing — and how should each **acquisition source** (Spec Script, Agent
Package, Studio Sale, Publisher Rights, Commission) bias those values *at
generation*, and how much should each be able to *change during development*?

Once this is settled, the rewrite system, source generation, commissioning, and
adaptation all fall out of one philosophy rather than being designed piecemeal.

---

## Correction to the first audit: originality is an *ingredient*, not the core

The first audit concluded `originality` should become "the immutable lightning
value" — reasoning from the fact that it is the most impactful craft stat. That
is the wrong basis (and it violated that audit's own caution to decide on
*representation*, not on today's math).

**Originality is not what studios bid on. The concept is — and the two are not the
same:**

| Pitch | Originality | Concept strength |
|---|---|---|
| A man relives a day until he solves a murder | very high | high |
| A family of superheroes hiding in suburbia | low | high |
| Batman fights the Joker | ~zero | enormous |

Originality is neither necessary nor sufficient for a valuable concept. So:

- **Concept Strength should be a hidden, *derived* value** — the same "derive,
  don't store" pattern the codebase already uses for `deriveCommercialProfile`
  (`engine/commercialProfile.ts`), one layer up.
- **Originality becomes one *input* to it**, alongside hook, emotional premise,
  franchise potential, and the categorical tags — never synonymous with it.

This future-proofs the system: later rebalancing of the Concept Strength formula
never silently changes the development philosophy, because "what is immutable"
(the intrinsic inputs) is decided separately from "how they combine" (the
derivation).

---

## Part A — The refined ownership model (five buckets, two-layer Concept)

The clean model is **four owned buckets plus one derived layer**:

1. **Concept — identity** (categorical, immutable): `genre, archetype, storyType,
   primarySetting, scale`. *What kind* of film this is. (Already compiler-locked.)
2. **Concept — quality** (stored intrinsic scalars, immutable): `originality`,
   plus proposed `hook`, `emotionalPremise`, `franchisePotential`. *Why this idea
   is exciting.* These are the Die-Hard-vs-Skyscraper differentiators — they can't
   be derived from anything more fundamental, so they must be *rolled at
   generation and then frozen*, exactly as `originality` is stored today.
3. **Execution — craft** (stored, mutable): `structure, characters, dialogue`
   (+ tone). *How well it's written.* The rewrite seam.
4. **Production — scope** (stored, set at conception, realized on set):
   `complexity, productionRequirements, environment/effects ambition,
   requiredLeads/Supporting, cast slots`. *What kind of production the screenplay
   implies.* (Adopting the first audit's "Production category" language, which the
   brief endorsed — `complexity` has never behaved like a writing stat.)
5. **Concept Strength & Commercial Profile — derived, hidden** (never stored):
   `deriveConceptStrength(...)` and the existing `deriveCommercialProfile(...)`.
   Read on demand from buckets 1–3. Marketing *amplifies awareness* of these; it
   never changes them.

Illustrative (representation-first, weights TBD) shape of the new derivation:

```
conceptStrength = f(
  hook, emotionalPremise, franchisePotential,   // stored intrinsic quality
  originality,                                   // an INPUT, weighted modestly
  archetype.commercial, genre.popularity, storyType.hookiness  // categorical
)
```

Why each example lands high by a *different route* — which is the whole point:
- *Batman vs Joker*: low originality, but franchisePotential + hook + audience
  fantasy carry it.
- *Groundhog Day murder*: originality + hook carry it; franchise low.
- *The Incredibles*: emotionalPremise + commercial premise carry it; originality low.

Note this also **cleans up a current conflation**: today's `hookStrength`
(`commercialProfile.ts:101`) mixes concept and execution (`structure*0.3 +
characters*0.2 + ...`). Splitting a pure *Concept Strength* (idea-only inputs)
from the execution-influenced hook resolves that without a rewrite — it's a new,
purer derivation.

---

## Part B — The determinant matrix (the "from scratch" answer)

Who primarily sets each value. ● = primary determinant, ○ = secondary/modifier,
✗ = must *never* touch it, blank = irrelevant.

| Value | Initial idea | Writer | Rewrite | Production | Marketing |
|---|:---:|:---:|:---:|:---:|:---:|
| genre, archetype, storyType, setting, scale | ● | | ✗ | ○ (scale realized) | |
| hook / emotional premise / franchise potential | ● | ○ articulates | ✗ | | ○ frames |
| originality | ● | ○ shapes at authorship | ✗ | | |
| **structure** | | ● | ● lifts | | |
| **characters** (arcs/depth) | | ● | ● lifts | | |
| **dialogue** | | ● | ● lifts most | | |
| toneProfile | ○ | ● signature | ○ minor | | |
| complexity | ● implies | | ✗ | ● realizes | |
| productionRequirements / effects & environment ambition | ● implies | | | ● realizes | |
| requiredLeads / Supporting | ● (story calls for N) | | | | |
| cast (who fills the slots) | ○ (defines slots) | | | ● casting | |
| Concept Strength (derived) | ● (via its inputs) | ○ | ✗ | | ○ |
| Commercial Profile (derived) | ● | ○ | ○ (execution feeds hook) | | ○ amplifies awareness |
| Buzz / opening weekend | ○ (concept hook) | | | ○ (events) | ● campaign + stars + brand |

Three principles fall straight out of the matrix:

1. **Concept (both layers) is idea-determined and rewrite-forbidden.** The `✗`
   column is the whole development philosophy in one line: *no amount of
   development touches the idea.*
2. **Execution is writer-then-rewrite.** The writer sets it at authorship; rewrites
   move it toward a (possibly different) writer's ceiling. This is the only column
   with two ● owners — it's the shared territory of authorship and development.
3. **Production scope is idea-implied, production-realized** — never a quality
   stat and never rewritten. `complexity` finally has a home.

And the line worth keeping (the brief's favourite, and mine):
> **Development converges on the writer's competence; it does not manufacture
> brilliance.**
That sentence *is* the `✗` column plus the gap-bounded execution model.

---

## Part C — Source generation profiles (how each source should *feel* different)

Today `source` is "flavor riding on two scalars" (cost multiplier + expiry —
`opportunities.ts:15-28`). The real deepening is to make **source a *generation
profile*, not a price tag**: it should bias the *distributions* the project rolls
from. That is what makes acquiring one opportunity feel fundamentally unlike
another.

Each source is a distribution over five axes:

- **Concept** — mean & variance of the intrinsic concept-quality inputs.
- **Execution** — mean & variance of `structure/characters/dialogue`.
- **Talent** — is a writer/name attached, and at what standing.
- **Screenplay state** — does a script even exist yet, and how developed is it.
- **Development headroom** — how much a rewrite can still add (a function of how
  far execution already is from a strong writer's ceiling).

| Source | Concept | Execution | Talent | Screenplay state | Headroom | Cost | The feel |
|---|---|---|---|---|---|---|---|
| **Spec Script** | high **variance**, skews original | low mean, high variance (messy) | unknown/emerging | raw first draft | **large** | cheap | **The lottery ticket.** Could be a discovered gem or a dud; you're betting on the idea and paying to develop the writing. |
| **Agent Package** | solid mean, **low variance** | high mean, low variance (competent) | attached, mid–high standing | professionally developed | moderate | mid–high | **The safe professional buy.** Commercial confidence, de-risked, limited upside. |
| **Studio Sale / Project** | mid–high, low variance | **very high**, low variance (polished) | credited, established | already rewritten | **small** | high | **Turnkey.** What you see is what you get — you can't cheaply improve it. "No longer fit their slate," not "bad." |
| **Publisher Rights** | **high & reliable** (proven audience/franchise), lower originality | **none yet** | source author, not a screenwriter | *no screenplay* — rights only | N/A until adapted | high | **A proven concept engine you must adapt.** High franchise/emotional premise; the screenplay risk is yours. |
| **Commission** *(directed, not a market listing)* | mid variance (briefed, not discovered) | ≈ chosen writer's competence | player-chosen writer | written to order | moderate | premium | **Directed reliability.** You pay to *choose* rather than *discover*. The literal home of "converges on the writer's competence." |

The mechanics are almost entirely *already-present levers*, re-pointed:

- **Concept mean/variance** — bias the intrinsic-quality rolls per source (the
  same way `rollAuthoredCraftStat` already narrows variance by writer
  consistency). Spec = wide bands; Agent/Studio Sale = narrow, higher floor.
- **Execution mean/variance** — bias the craft rolls. Studio Sale starts execution
  in the 80s (it's been through development); Spec starts in the 40s–60s, wide.
- **Talent** — already exists: `selectWriterForSource` (`engine/writers.ts`) skews
  writer standing per source. Extend it: Agent Package attaches a name; Studio
  Sale credits an established writer; Spec draws an unknown.
- **Screenplay state** — the genuinely new one: **Publisher Rights carries no
  `Script`.** This is exactly why `Opportunity` must become a discriminated union
  (first audit, Part on "Development Opportunities"): a Publisher Rights
  opportunity's payload is an *IP* (build on `engine/intellectualProperty.ts`),
  and a screenplay only exists after adaptation.
- **Headroom** — not a stored field; it's `writerCeiling − currentExecution`,
  which already governs rewrite lift (`rewrite.ts:52`). Studio Sale has little
  headroom *because* its execution is already high — no special-casing needed, it
  falls out of the gap model. This is the elegant part: **"you can't cheaply
  improve a polished script" is already true in the engine the moment execution
  starts high.**

The cost multipliers should then follow the profile, not lead it: you pay least
for the highest-variance/most-work source (Spec) and most for the
lowest-variance/least-work one (Studio Sale) — inverting today's flat
"Studio Original ×0.1 because it's cheap flavor."

---

## Part D — Rewrites should vary by source (three kinds, not one)

The brief is right that a pass on Publisher Rights is not a pass on an Agent
Package. They are three *different acts*, and they map cleanly onto the source's
**screenplay state** from Part C. The engine already keys pass behaviour by
`kind` (`PASS_STRENGTH`/`PASS_SPREAD` by kind, `rewrite.ts:21-24`) — this just
needs a third kind and source-aware headroom:

| Pass kind | Applies to (screenplay state) | What it does | Strength | Variance | Headroom |
|---|---|---|---|---|---|
| **Adaptation** *(new)* | Publisher Rights / IP — *no screenplay yet* | *Creates* execution from an owned concept. Concept fixed (it's the book); execution rolled fresh, gated by the adapter's skill and how faithful/bold the take is. | high (builds from ~0) | **high** | full — nothing exists to diminish |
| **Development** *(= today's `rewrite`)* | Spec / raw material — messy draft | *Lifts* low-but-present execution toward competence. Big, meaningful gains. | 0.5 of gap | medium (±12) | large |
| **Polish** *(= today's `polish`)* | Agent Package / Studio Sale — strong draft | *Refines* already-good execution. Diminishing returns, low risk. | 0.25 of gap | low (±6) | small (gap already tiny) |

The insight that makes this coherent rather than three bolted-on systems:
**it's one engine (`gap → lift + noise`) with the source's execution-mean setting
the starting point, and therefore the headroom, automatically.** Adaptation is the
only genuinely new mechanic, because it must *generate* execution rather than
close a gap on existing execution — and it's the mechanic Publisher Rights (and
the whole future IP market) requires anyway.

Concept, in all three, is untouched — the `✗` column holds.

---

## Part E — Why this makes buying feel different (the payoff)

With source-as-generation-profile plus the three rewrite kinds, the five buys
occupy genuinely different strategic positions:

- **Spec Script** — cheap high-variance bet; you supply the development. Upside:
  a discovered great concept at low cost. Downside: you may develop a dud.
- **Agent Package** — pay for de-risking; competent and commercial out of the box,
  little to gain from development. The "I need a reliable slate-filler" buy.
- **Studio Sale** — pay top price for turnkey certainty; you cannot cheaply
  improve it, so it's a bet on *taste* (do you see what they missed?) not on
  development.
- **Publisher Rights** — buy a proven concept engine and a franchise, then take on
  adaptation risk; the screenplay quality is entirely your doing.
- **Commission** — spend to *direct* rather than *discover*: guaranteed-competent,
  concept shaped by your genre brief and the writer's tendencies, never lightning.

That is the asymmetry the brief has been circling from the start: **you commission
for reliable competence and acquire for the chance at brilliance** — now expressed
as *distributions and headroom per source*, not just as prices.

---

## What is genuinely new vs already-built

| Piece | State |
|---|---|
| Concept identity immutable | ✅ built (compiler-locked) |
| Execution mutable via one seam | ✅ built (`reviseScript`) |
| Marketing derived, not stored | ✅ built (`commercialProfile`) |
| Writer-standing-per-source skew | ✅ built (`selectWriterForSource`) |
| Pass behaviour keyed by kind | ✅ built (`PASS_STRENGTH`/`SPREAD`) |
| Headroom = writer ceiling − execution | ✅ built (falls out of the gap model) |
| Stored intrinsic **concept-quality** inputs (hook/emotional/franchise) | ➕ new (small: a few rolled-and-frozen scalars) |
| Derived **Concept Strength** | ➕ new (a derivation, like `commercialProfile`) |
| Source as a **generation profile** (concept & execution distributions) | ➕ new (re-point existing roll biases) |
| `Opportunity` as a discriminated union (screenplay may not exist) | ➕ new (the one real reshape) |
| **Adaptation** rewrite kind | ➕ new (generates execution from an IP) |
| Enum split: `MarketSource` vs `AssetProvenance` | ➕ new (small, high-clarity) |

The brief's own best conclusion holds and gets stronger: **this is not another
giant redesign.** It's a change of *philosophy, ownership, generation biases, and
opportunity types* on top of systems that already exist. Most of the "new" column
is re-pointing levers the engine already has; only two items (the `Opportunity`
union and the Adaptation kind) are real new mechanics, and both are demanded by
the same thing — a Publisher Rights / IP opportunity that carries a concept
without a screenplay.

---

## Recommended next decision (still not implementation)

Two design decisions unlock everything else, in order:

1. **Adopt the two-layer Concept model** (identity + stored intrinsic quality
   inputs → derived Concept Strength), with `originality` demoted to an *input*.
   Everything about mutability, sources, and rewrites is downstream of this.
2. **Redefine `source` as a generation profile** (Part C) rather than a cost
   multiplier. This is what makes the five buys feel different, and it's mostly
   re-pointing existing roll biases.

The `Opportunity` union and the Adaptation kind follow naturally from #2 (they're
what Publisher Rights needs). The enum split and the "Production category"
relabel of `complexity` are low-risk clarity wins that can ride along whenever
the concept work lands.
