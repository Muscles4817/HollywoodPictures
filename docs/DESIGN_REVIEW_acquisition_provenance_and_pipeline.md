# Design Review — Acquisition Provenance & the Hollywood Pipeline

**Status:** Audit only. No engine changes. Third in the sequence, after
`DESIGN_REVIEW_opportunities_market_restructure.md` (the architecture is already
there) and `DESIGN_REVIEW_source_generation_and_determinants.md` (source as a
generation profile). This one answers the question those two circled:

> **Why does each screenplay exist, and why is it *here*, on the market, in this
> state, at this price?**

The claim of this document: the Opportunities Market is not generating numbers —
it is **generating stories**. Once each acquisition source is traced from its
real-world origin to cameras rolling, the numbers (cost, attached talent, execution
quality, rewrite need, bid pressure) stop being tuning knobs and become
*consequences of a story*. That is what makes buying one opportunity feel
fundamentally unlike buying another.

It also folds in five corrections/additions from review of the second audit
(marked ⟳ below).

---

## Two principles this work has earned (candidates for `SIMULATION_PHILOSOPHY.md`)

Both are stated here as proposals; promoting them into the canonical philosophy
doc is a one-line follow-up if endorsed.

- **P — Intrinsic values are stored; strengths are derived.** What a thing *is*
  gets rolled once and frozen (concept-quality inputs, execution craft). How
  valuable/appealing/strong it is gets *derived on demand* from those
  (`ConceptStrength`, `CommercialProfile`). Rebalancing "what makes a great
  concept" then never breaks a save, exactly as `deriveCommercialProfile` already
  demonstrates. ⟳ (formalises review point 2)

- **P — Development converges on the writer's competence; it does not manufacture
  brilliance.** Every development stage moves execution toward the working
  writer's ceiling and can never touch the concept. This one sentence defines the
  whole acquisition-and-development game: you *acquire* for the chance at a great
  idea; you *develop* for reliable competence. ⟳ (review point 10 — the user asked
  for this to become a principle, and it should)

---

## The spine: one development-stage ladder every source enters partway up ⟳

(Review points 3 & 4.) Stop thinking "Spec vs Publisher Rights" and "three rewrite
buttons." Think **one pipeline**, where a source is *the stage a project is at when
you find it*, and a development stage is *a transition to the next rung*:

```
   IDEA
    │
    ▼
  (no screenplay)      ← Publisher Rights / IP enter here (rights only)
    │  ADAPTATION  … writing, gated by the adapter — creates execution from ~0
    ▼
  TREATMENT
    │
    ▼
  FIRST DRAFT          ← Spec Script enters here (complete but raw)
    │  DEVELOPMENT … structural rewrites; often several passes
    ▼
  PROFESSIONAL DRAFT   ← Agent Package enters here (developed + packaged)
    │  POLISH      … dialogue/tightening; ADR-adjacent; low-risk refinement
    ▼
  PRODUCTION DRAFT     ← Studio Sale enters here (was about to be shot)
    │  GREENLIGHT  … the money-commitment gate (existing design)
    ▼
  CAMERAS ROLLING
```

Three things fall out of drawing it once:

1. **A source is an *entry point*, not a category.** Its execution quality, its
   rewrite need, and its price are all just "how far up the ladder it already is."
2. **Development stages are transitions, not buttons.** ⟳ "Adaptation" is *writing*
   (no screenplay → first draft); "Development" may be several rewrites; "Polish"
   is the last-mile pass. Naming them stages (not `RewriteKind` variants) keeps the
   engine honest: the same `gap → lift` model runs each, but Adaptation must
   *generate* execution rather than close a gap on existing execution.
3. **Headroom is just the ladder above where you bought.** Buy at First Draft →
   long runway (big potential gains). Buy a Production Draft → almost none (you
   can't cheaply improve a finished thing). This needs no special-casing — it falls
   straight out of "execution starts high, so the gap-to-ceiling is small."

The concept ladder-rung — the *idea* — is set at the very top and **never moves**.
That's the `✗` column from the determinant matrix, now visible as "everything below
IDEA is execution; the IDEA itself is untouchable."

---

## Correction: adaptation does not lower originality ⟳

(Review point 5 — a genuine error in the prior audit.) I biased Publisher Rights'
`originality` downward "because it's an adaptation." That's wrong. Harry Potter,
The Lord of the Rings, Dune, The Hunger Games, Jurassic Park, Pokémon — all
*adaptations*, all wildly original *as ideas*.

The fix decouples two things the prior audit conflated:

- **Originality is a property of the IDEA**, inherited by the screenplay from
  whatever it adapts. A Publisher Rights opportunity's originality is *the
  underlying IP's* originality — which can be anywhere from a generic procedural
  novel to a genre-defining fantasy world.
- **"Adapted vs original" is a property of SCREENPLAY STATE**, not concept quality.
  It means "no screenplay exists yet; you must adapt," which affects the *pipeline*
  (you enter at the top of the ladder) and the *rewrite kind* (Adaptation), **not**
  the concept-quality rolls.

So Publisher Rights keeps a **high, reliable concept floor** (proven audience +
franchise potential) with **originality inherited from the specific IP** — never
penalised for being adapted. Its distinguishing trait is *screenplay state*, full
stop.

---

## Writers bias concept, not just execution ⟳

(Review point 6.) A great writer isn't just "higher execution." Nolan and Tarantino
*statistically produce higher-concept, higher-variance ideas*; a reliable
television craftsman produces safe, commercial, low-variance ones. Concept
adventurousness is a real, separable axis.

This produces a clean, symmetric refactor of `WriterCreativeProfile`:

| Today | Proposed | Why |
|---|---|---|
| `craft = {originality, structure, characters, dialogue}` | `craft = {structure, characters, dialogue}` | craft is *execution* only |
| — | `conceptAmbition` (new) | how bold/high-concept their ideas run — raises both the concept ceiling **and** its variance |
| `consistency` | `consistency` (now also scales concept variance) | an inconsistent auteur swings from dud to masterpiece *idea*, not just draft |

The elegant part: **as `originality` moves Script-side from Craft → Concept, it moves
Writer-side from `craft` → `conceptAmbition`, in lockstep.** Both sides stay
coherent by construction — a writer shapes the *concept* they generate through
`conceptAmbition` (frozen into the idea), and the *execution* through `craft`
(mutable, developable). Nolan = high `conceptAmbition`, moderate `consistency` →
high ceiling, wide swings. A journeyman = low `conceptAmbition`, high `consistency`
→ dependable, unremarkable ideas.

This composes with source generation: a Spec's high concept variance is *partly
because* specs are disproportionately written by adventurous unknowns swinging for
the fences; an Agent Package's tighter, more commercial concept is *partly because*
agents package around commercially-confident writers. Source profile × writer axis
= the concept distribution. `selectWriterForSource` (`engine/writers.ts`) is already
the seam for this.

---

## The Hollywood process audit — origin → cameras, per source

For each source: the real-world story, what you're actually buying, where it enters
the ladder, its generation profile, the runway left to cameras, and why it costs /
bids / excites the way it does.

### 1. Spec Script — *"the writer couldn't get anyone attached"*

- **Origin story.** A writer wrote it on their own dime, with no studio, no star,
  no agent-assembled package behind it. They're shopping the *idea*, hoping it
  sells on concept alone. Often an unknown; often the boldest, least-filtered
  material in the market.
- **You're buying:** a complete but raw screenplay and nothing else.
- **Enters at:** First Draft.
- **Generation profile:** high concept **variance** (skews bold via adventurous
  unknown writers — could be a gem or a mess), low execution mean + high execution
  variance, unknown/emerging writer, **large** development runway.
- **To cameras:** Development (probably several passes) → Polish → Greenlight →
  cast from scratch → shoot.
- **Why it costs little / why it's exciting:** cheap *because* it's unproven and
  unpackaged; exciting *because* the runway is long and the concept ceiling is the
  highest in the market. This is the lottery ticket — you supply the development and
  bet on discovery.

### 2. Agent Package — *"the agent assembled talent to maximise the sale"* ⟳

(Review point 9 — expanded, because this is the most interesting source.) **You are
not buying a screenplay. You are buying a package.**

- **Origin story.** An agency, protecting and monetising its client roster,
  deliberately bundled a screenplay with attached talent — *writer + lead actor +
  maybe a director + sometimes a producer* — to make the whole thing a hot,
  turnkey, high-priced sale. The package is engineered to be bid on.
- **You're buying:** screenplay **+ pre-attached talent commitments**.
- **Enters at:** Professional Draft, *with cast/crew slots already filled*.
- **Generation profile:** solid concept mean, **low** concept variance (agents
  package sellable, de-risked material), high execution mean + low variance, one or
  more **attached names** at mid–high standing, **moderate** runway.
- **What makes it mechanically distinct** (this is the part worth leaning into):
  - **It comes with attached hires.** The opportunity carries pre-filled cast/crew
    slots (the casting/staffing system that just merged is exactly where these
    land). Buying the package means inheriting its lead/director — or paying to
    *detach* them, at a cost and possibly a relationship hit.
  - **Reduced flexibility is the trade.** The package "insists" on certain hires;
    you gain a star's buzz and a competent draft, you lose free casting.
  - **It's the natural home of bidding wars.** Packages are shopped to multiple
    studios by design; the existing `Opportunity.bids[]` / English-auction
    resolution is *most* alive here. Rivals want the same star-attached package.
  - **Its value isn't just the draft's execution** — it's the *combined package
    draw* (attached fame → Buzz, a bankable director → greenlight confidence).
- **To cameras:** light Polish → Greenlight → shoot (much of casting is pre-done).
- **Why it costs the most among standard sources / why it bids:** you're buying
  certainty *and* talent commitments simultaneously; scarce, contested, and
  expensive for exactly the reasons an agent built it that way.

### 3. Publisher Rights / IP — *"the publisher is auctioning adaptation rights"*

- **Origin story.** A book, comic, game, or life-rights holder is licensing
  adaptation rights, usually to the highest and most credible bidder. There is no
  screenplay — there is a proven audience and, often, a franchise.
- **You're buying:** an **IP** (rights), not a script. Build on the existing
  `engine/intellectualProperty.ts` / `ipViability.ts`.
- **Enters at:** *no screenplay* — the top of the ladder.
- **Generation profile:** **high, reliable concept floor** (proven audience +
  franchise potential), **originality inherited from the specific IP** ⟳ (can be
  very high — Dune, LOTR — or middling — a generic thriller), execution **does not
  exist yet**, source author is not a screenwriter, **full** runway.
- **To cameras:** **Adaptation** (writing a first draft from the IP, gated by the
  adapter's skill and how faithful/bold the take is) → Development → Polish →
  Greenlight → cast → shoot. The longest pipeline of any source.
- **Why it's expensive / why it bids / why it's exciting:** you pay for a *proven
  concept engine and a franchise*, and you take on all the screenplay risk. Highly
  contested (proven IP is scarce and every studio wants a franchise), and this is
  the only source that requires the Adaptation stage — which is itself the reason
  `Opportunity` must become a discriminated union (payload = IP, not Script).

### 4. Commission — *"you paid a writer to write the film you want"* (not a market listing)

- **Origin story.** There is no external story — *this one is yours*. You brief a
  chosen writer with a genre/mandate and pay them to originate a screenplay.
- **You're buying:** directed origination — you choose the writer and the lane
  instead of discovering what the market happens to post.
- **Enters at:** no screenplay → the writer delivers a First/Professional Draft
  depending on their skill.
- **Generation profile:** concept shaped by your brief × the writer's
  `conceptAmbition` (mid variance — briefed, not discovered), execution ≈ the
  writer's competence, writer = your pick, moderate runway.
- **To cameras:** Development/Polish as needed → Greenlight → cast → shoot.
- **Why it's premium / why it feels different:** you pay top price to *direct*
  rather than *gamble*. It is the most literal instance of "development converges on
  the writer's competence" — you are buying a known writer's competence on purpose,
  never lightning.

### 5. Studio Sale — *"a rival shelved it and needs to recoup"* — a **Special Opportunity** ⟳

(Review point 7 — demoted from a standard source.) This exists, and it's narratively
delicious, but studios are **not** constantly buying each other's abandoned
developments. It should be **rare and event-driven**, not equal billing beside
Spec/Agent/Publisher.

- **Origin story.** A rival studio cancelled a project — a regime change, a slate
  reshuffle, a budget cut, a competing film too similar — and is selling the
  developed material to recoup sunk cost. A specific, occasional event.
- **You're buying:** a **Production Draft** — fully developed, near-shootable.
- **Enters at:** Production Draft (the top-executed rung).
- **Generation profile:** mid–high concept (already vetted by professionals), very
  high execution + low variance (polished), possibly some attached talent,
  **minimal** runway.
- **Trigger, not a weekly roll:** it should be *spawned by the rival-studio engine*
  (`engine/rivalStudios.ts` / `rivalExecution.ts`) when a rival actually shelves a
  production — so the opportunity is a visible *consequence of the simulated world*,
  not a random draw. That's what makes it feel like a special event ("Monolith
  Pictures cancelled *Redshift* — the rights are available") rather than market
  furniture.
- **Why it's a bet on taste, not development:** you can't cheaply improve it (no
  runway), so the question is whether *you* see what the rival missed. Priced high
  for certainty; rare by nature.

---

## Every acquisition carries a generated story ⟳

(Review point 8 — the layer that ties it together.) Each opportunity should surface
a one-line **provenance** string, generated from its source + participants, so the
market reads as a slate of *stories*, not a table of stats. Provenance isn't
decoration — it *explains* every number the player sees:

| Source | Provenance template | Explains… |
|---|---|---|
| Spec Script | "Written on spec by {writer}; no talent attached — shopping the concept." | low cost, raw execution, long runway |
| Agent Package | "{Agency} packaged this around {star}{, dir. attached} to drive the sale." | high cost, attached hires, bid pressure |
| Publisher Rights | "{Publisher} is auctioning adaptation rights to {title}." | no screenplay, franchise value, adaptation need |
| Studio Sale | "{Rival} shelved this after {reason}; selling to recoup." | polished draft, minimal runway, rarity |
| Commission | *(none — it's yours by design)* | — |

The rule of thumb: **if the player can read *why* a project is on the market, they
can predict its price, its talent, its rewrite need, and its risk without a single
raw number** — which is exactly the game's stated preference for qualitative,
named-cause presentation over exposed stats (`CLAUDE.md`). Provenance is how the
Opportunities Market honours that principle.

---

## Updated "new vs already-built" ledger

| Piece | State |
|---|---|
| One development-stage ladder (entry points + transitions) | ➕ conceptual reframe of pieces already present |
| Development stages, not rewrite buttons (Adaptation/Development/Polish) | ➕ rename + one new stage (Adaptation) |
| Originality inherited from IP, not lowered by adaptation | ⟳ correction — free (don't apply a penalty) |
| Writer `conceptAmbition` axis; `originality` leaves `craft` | ➕ new axis, symmetric with the Script-side move |
| Agent Package as a *talent package* with attached hires | ➕ new — rides the just-merged casting/staffing system |
| Studio Sale as a rare, rival-triggered Special Opportunity | ➕ new — hooks `rivalStudios.ts`; *removes* it from the weekly source set |
| Generated provenance line per opportunity | ➕ new — small, presentation-layer, high narrative payoff |
| `Opportunity` discriminated union (IP payload, no Script) | ➕ the one real reshape (Publisher Rights needs it) |
| ConceptStrength derived; bidding; casting slots; writer-per-source skew | ✅ already built or trivially derived |

The through-line holds and strengthens: **still not a redesign.** The standard
weekly market shrinks to three coherent external sources (Spec / Agent Package /
Publisher Rights), Commission stays a directed player action, and Studio Sale
becomes a rare event the simulated world *produces*. Every one of them now has a
story that generates its own numbers.

---

## The remaining sequence

1. **Adopt the two principles** (derive strengths from stored intrinsics;
   development converges on competence) — promote into `SIMULATION_PHILOSOPHY.md`.
2. **Concept model:** two-layer Concept (identity + stored intrinsic quality
   inputs → derived `ConceptStrength`), `originality` demoted to an input.
3. **Writer refactor:** `originality` leaves `craft`; add `conceptAmbition`
   (Script-side and Writer-side move together).
4. **Source = ladder entry point + provenance:** three standard external sources,
   each with a generation profile *and* a provenance story; Studio Sale becomes a
   rival-triggered special.
5. **The one reshape:** `Opportunity` discriminated union so Publisher Rights can
   carry an IP with no screenplay, enabling the Adaptation stage.

Design first, in that order. Each step is small; the coherence comes from every one
of them descending from the same source-provenance philosophy rather than being
tuned in isolation.
