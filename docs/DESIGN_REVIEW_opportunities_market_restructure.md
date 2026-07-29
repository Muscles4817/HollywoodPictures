# Design Review — Opportunities Market restructure & the Concept/Execution split

**Status:** Audit only. No engine changes proposed here are implemented — this
document is the foundation a later restructure builds on, per the brief
("start with an audit, not an implementation").

**Scope:** Two intertwined questions.
1. Should the Opportunities Market stop being a market of *scripts* and become a
   market of *development opportunities* — and does "Studio Original" still
   belong in it now that writers can be commissioned?
2. Should a `Script` have an **immutable Concept core** (the thing studios bid
   on) distinct from **mutable Execution** (the thing development improves) — and
   where is that line drawn today versus where it *should* be drawn?

---

## TL;DR — the design is ~90% already built; one field is on the wrong side of the line

- The **immutable-core / mutable-execution split already exists and is
  compiler-enforced**: `ScriptConcept` vs `ScriptCraft` (`types/index.ts:798-806`),
  with `reviseScript` accepting only `Partial<ScriptCraft>` (`engine/screenplay.ts:62`)
  so a rewrite *cannot* touch a concept field — the compiler rejects it.
- **But the line is drawn around categorical identity, not the idea's quality.**
  Concept = `{genre, archetype, storyType, primarySetting, scale}`. Craft =
  `{originality, structure, characters, dialogue, complexity, toneProfile}`.
  So **`originality` is mutable today** — a rewrite can and does raise it
  (`engine/rewrite.ts:17` `CRAFT_AXES` includes `originality`). That directly
  contradicts the design philosophy where originality *is* the intrinsic core.
- **"Studio Original" is already miscategorised, and the code proves it.** The
  one `OpportunitySource` enum does two contradictory jobs: it's a *market source*
  you acquire externally **and** the provenance tag stamped on every
  *commissioned* script (`engine/commission.ts:108` sets `source: 'Studio
  Original'`). The game already uses "Studio Original" to mean "something the
  studio created," which is exactly why it no longer fits a market of external
  opportunities.
- **Marketing is already a pure derivation** (`engine/commercialProfile.ts` —
  `deriveCommercialProfile`, nothing stored on `Script`), so the acquisition /
  development / production / marketing pipeline the brief is converging on is
  mostly latent in the code already.

The single highest-leverage decision is therefore **whether `originality`
becomes immutable Concept**. It is a ~4-line type-level move that turns the
design philosophy into a compiler invariant and re-shapes the entire
development pipeline's *meaning* (development makes competent films; acquisition
finds lightning).

---

## What already exists (so we don't re-litigate it)

| Design intent | Already built? | Where |
|---|---|---|
| Immutable creative snapshot; rewrites mint a NEW `Script`, never mutate | ✅ | `types/index.ts:766-806`, `engine/screenplay.ts:reviseScript` |
| Compiler-locked concept vs mutable craft partition | ✅ (partial — see below) | `ScriptConcept`/`ScriptCraft`, `SCRIPT_CONCEPT_KEYS`/`SCRIPT_CRAFT_KEYS` |
| Rewrite/polish as a probabilistic gamble with real downside | ✅ | `engine/rewrite.ts` |
| Commission an original from a chosen writer | ✅ | `engine/commission.ts` |
| Marketing/commercial appeal as derived, not stored | ✅ | `engine/commercialProfile.ts` |
| Opportunities Market: weekly cadence, English-auction bidding, expiry | ✅ | `engine/opportunities.ts` |
| Author provenance carried by reference (`writerIds`), never copied | ✅ | `Opportunity.writerIds` → `Asset.writerIds` |
| Persistent Asset market / sell-back / heat decay / rights expiry | ❌ deferred | `DESIGN.md:5098-5152`, dev-dept doc "deferred" |
| IP / franchises / talent-attachment / production opportunities | ❌ future | pipeline doc Phase E; not built |

The pieces the brief describes as "the future" are, in code terms, a **naming
correction plus one genuine reshape** (the market payload), not a rebuild.

---

## The eight audit questions

### Q1 — Which script fields contribute most to final quality?

Only four of the five stats feed *quality* at all; `complexity` does not.

| Stat | `computeScriptScore` (root of the chain) | Critic Score | Buzz / Marketability (`hookStrength`) | Crossover / legs (`crossoverPotential`) | Production scope |
|---|---|---|---|---|---|
| **originality** | 0.25 | **≈0.14 direct** (`scoring.ts:502`) | — | **0.45** (`commercialProfile.ts:114`) † | — |
| structure | 0.25 | — | 0.30 (`commercialProfile.ts:102`) | — | — |
| characters | 0.25 | — | 0.20 | — | — |
| dialogue | 0.25 | — | — | — | — |
| complexity | — | — | — | — | drives production requirements, difficulty/risk, rewrite/commission duration |

Two structural facts amplify this table:

- **Script is the root of the quality dependency chain** (`scoring.ts:394-486`).
  `executedScript` gets a direct genre-tilted weight (`weights.script`, base 0.25,
  up to ~0.35–0.40 for a Drama) **and soft-ceils every downstream department**
  (direction, acting, production, post) via `scriptRatio`. So all four craft axes
  have compounding influence, not just their 0.25 slice.
- **`originality` is by far the most far-reaching single stat.** Beyond the shared
  root, it *alone* also feeds Critic Score directly and `crossoverPotential`
  (word-of-mouth reach). `dialogue`, by contrast, feeds **only** `computeScriptScore`
  — it is the purest "execution" axis, with zero reach beyond craft.

† Caveat: `crossoverPotential` is computed and tested but **not yet fully wired
into the box-office chain** (`DESIGN.md:4599-4604`). So originality's crossover
reach is *designed* but partially dormant; its `scriptScore` + Critic reach is live.

**Impact ranking (live):** originality > structure ≈ characters > dialogue;
complexity is orthogonal (scope, not quality).

**The inversion worth naming:** the most impactful craft stat (originality) is
currently *also the most rewritable-with-reach*. The brief's instinct — "whatever
is most impactful should be least affected by rewrites" — is precisely
contradicted by the code today. Making originality immutable realigns impact with
immutability.

### Q2 — Which fields are effectively immutable today?

Three tiers:

1. **Compiler-locked immutable** (a rewrite *cannot* express a change):
   `genre, archetype, storyType, primarySetting, scale` — plus everything not in
   `ScriptCraft` (`id, cast, requiredLeads/Supporting, intendedAudience,
   productionRequirements, synopsis, title, environment/effects strategy+ambition`).
   `reviseScript` only accepts `Partial<ScriptCraft>`.
2. **De-facto immutable** (in the mutable `ScriptCraft` type, but the rewrite
   engine deliberately never touches them): `complexity` and `toneProfile`.
   `rewrite.ts:17` `CRAFT_AXES` is only the four writing axes; the comment is
   explicit: "Complexity and tone are deliberately left alone."
3. **Actually mutated by rewrites:** `originality, structure, characters, dialogue`.

Nothing anywhere mutates a `Script` field in place — the immutable-snapshot
contract holds by construction (`types/index.ts:779-781`).

### Q3 — Which fields *should* realistically be mutable?

- **Keep mutable (correct today):** `structure`, `characters` (arcs/depth),
  `dialogue`. This is exactly what development refines.
- **Should become immutable:** `originality` — see Q4/Q5 and the keystone
  section.
- **`complexity` — resolve its ambiguity.** It is stored as a "craft stat"
  (`DESIGN.md:4465`) yet has **no writer axis** (`writer_authors` doc:
  "complexity has no writer axis and stays a plain band roll") and the rewrite
  engine never moves it. It behaves like a **production/scope attribute**, not a
  quality stat — it drives `productionRequirements`, effects/environment ambition,
  and pass duration. Recommend re-homing it conceptually as *Scope/Production*,
  not Craft, and keeping it immutable post-generation (it is tied to production
  requirements that a greenlit project freezes).
- **`toneProfile` — leave fixed for now.** A polish arguably *could* recalibrate
  tone, but tone sits close to concept; leaving it de-facto immutable is
  defensible. Revisit only if "polish tightens a tonal wobble" becomes a desired
  player-legible outcome.
- **Future additive candidate:** `ScriptCharacter.traits` (character depth).
  A rewrite that "deepens the protagonist" arguably should move character traits;
  currently untouched. Out of scope for the first pass.

### Q4 / Q5 — Concept vs Execution mapping (recommend a *three*-way partition)

The current two-way split conflates two different things inside `Craft`. Recommend:

**CONCEPT — intrinsic, immutable ("what got bought"):**
- Categorical identity: `genre, archetype, storyType, primarySetting, scale`
  *(already immutable ✅)*
- The idea's quality: **`originality`** *(move here from Craft)*
- Provenance/logline: `synopsis`, `id`

Rationale: "the thing studios fight over." Cannot be manufactured on demand.
Maps to the brief's Concept list (originality / hook / premise / commercial &
emotional premise / thematic & franchise potential).

**EXECUTION — craft, mutable ("what development improves"):**
- `structure, characters, dialogue` *(already mutable ✅)*
- *(future)* character depth / `ScriptCharacter.traits`

Rationale: the writing quality a rewrite realistically lifts toward the writer's
ceiling. Maps to the brief's Execution list (dialogue / pacing / structure /
character arcs / scene flow / clarity).

**SCOPE / PRODUCTION — set at conception, not a quality stat:**
- `complexity, productionRequirements, environment/effects strategy+ambition,
  requiredLeads/Supporting, cast slots`

Rationale: describes how the film is *made*, not how good the screenplay *is*.

The mechanical change to realise the Concept/Execution move is small and the seam
already exists:
- Move `'originality'` from `SCRIPT_CRAFT_KEYS` → `SCRIPT_CONCEPT_KEYS`
  (`types/index.ts:805-806`) and from the `ScriptCraft` `Pick` → the
  `ScriptConcept` `Pick` (`types/index.ts:798-802`).
- Remove `'originality'` from `rewrite.ts:17` `CRAFT_AXES`.
- The compiler then makes it **impossible** for any rewrite to touch originality —
  the identical guarantee that already protects genre/archetype/etc.

One consequence to design around: the *authored generator* (`writer_authors`) and
`WriterCraft` treat originality as a writer-shaped axis. If originality becomes
Concept, a writer still *biases the originality of what they generate at
authorship time* (that's fine — generation sets the concept), they simply cannot
*rewrite* it upward later. That is exactly the intended asymmetry: you author or
buy a great idea; you cannot polish your way to one.

### Q6 — How much variance should rewrites realistically produce?

Current model (`rewrite.ts`), which is well-aligned with the philosophy docs:

```
gap   = writer.craft[axis] − current[axis]
lift  = passStrength · skillFactor(skill) · max(0, gap)   // only closes a positive gap
noise = randFloat(−spread, +spread)                       // the gamble; can be negative
new   = clamp(current + lift + noise, 1, 100)
```

- `passStrength`: polish 0.25, rewrite 0.5 (closes a quarter / half of the gap to
  the writer's own level).
- `skillFactor`: 0.4–1.0.
- `spread` (pre-consistency): polish ±6, rewrite ±12; narrowed up to 70% by writer
  `consistency`.
- Diminishing returns are free (a script already at the writer's level barely
  moves); downside is real (a weak/volatile writer on a good script can lower an
  axis).

Assessment against the intended asymmetry ("development = reliable path to a
*competent* film; acquisition = lightning in a bottle"):

- **The gap-toward-writer's-level ceiling is exactly right** — development
  converges on the writer's competence, it does not manufacture brilliance.
- **Keep the downside.** `SIMULATION_PHILOSOPHY` Principle 6 ("a decision with no
  downside is not a decision") directly underwrites the negative-noise term.
- **Recommended target variance:** keep per-axis swings modest — roughly the
  current bands. A full development arc (a couple of passes with a strong writer)
  should *reliably* take weak execution to "solid/competent" (execution axes into
  the 70s–80s), but **not** to masterpiece. Masterpiece execution should require a
  genuinely elite writer *and* some luck.
- **The key point once originality is immutable:** the ceiling on a *manufactured*
  film is set by its bought-in concept. A commissioned/rewritten film can be a
  competent 75; an acquired lightning-concept can be a 95. That asymmetry then
  falls out **for free** from (immutable originality) + (gap-bounded execution) —
  no extra tuning needed. This is the mechanical realisation of the brief's
  "commissioning is reliable competence; buying opportunities is lightning."

### Q7 — Hollywood: what changes in development vs what almost never changes

- **Almost never changes (bought, intrinsic):** the premise / hook / logline —
  "dinosaurs from DNA," "dreams can be invaded," "a shark terrorises a beach
  town." The genre, the fundamental world/setting, the scale of the idea. → maps
  to **Concept** (`genre, archetype, storyType, primarySetting, scale` +
  `originality`).
- **Constantly changes (the WGA's daily bread):** dialogue passes, act
  structure & the third act, character arcs & motivations, pacing, tonal
  calibration, scene order, clarity. → maps to **Execution** (`structure,
  characters, dialogue`; and tone, if we later let polish move it).

The brief's own examples (Jurassic Park, The Matrix, Inception, Get Out, The
Social Network) all make the same point: the concept pre-existed; development
refined execution. The engine's job is to make **"you cannot rewrite your way to a
great concept" a hard rule** — which immutable-originality delivers.

### Q8 — Field → pipeline-stage assignment

| Stage | Fields | Notes |
|---|---|---|
| **Acquisition** (fixed at purchase; what you bid on) | `id, source, acquisitionCost, writerIds, genre, archetype, storyType, primarySetting, scale, originality, synopsis` (+ `intendedAudience` as an overridable suggestion) | The immutable core. |
| **Development** (what rewrites/polish improve) | `structure, characters, dialogue`, `toneProfile` (if polish is later allowed to recalibrate tone), *(future)* character traits | The enforced seam already exists (`reviseScript`). |
| **Production** (scope realised on set; how it's made) | `complexity, productionRequirements, environmentStrategy/Ambition, effectsStrategy/Ambition, requiredLeads/Supporting, cast` | Not screenplay quality — the production plan the script implies. |
| **Marketing** (derived, not stored) | `deriveCommercialProfile` → `accessibility, hookStrength, crossoverPotential`; `intendedAudience` | Already a pure derivation — the restructure should **not** add a stored marketing stat. |

The clean alignment: Marketing is *already* pure derivation, Concept is *already*
compiler-locked, Development *already* has an enforced seam. **The only field
sitting on the wrong side of a line is `originality`** (in Development's mutable
set when it belongs to Acquisition's immutable core). The pipeline the brief is
converging on is almost entirely already present.

---

## The keystone decision: make `originality` immutable Concept

This is the philosophical centre of the whole restructure and it is nearly free:

- **Represents** "the idea" — the least manufacturable, most fought-over thing.
- **Realigns** impact with immutability (Q1's inversion).
- **Splits** the two ways to get a film cleanly: *commission/rewrite* → reliable
  competence (execution converges); *acquire an opportunity* → the only way to a
  brilliant concept (originality is fixed at generation, never after).
- **Costs** ~4 lines at the type level; the compiler enforces the rest.

Decide it on *representation*, not on today's math (per the brief's own caution:
"if you rebalance formulas later, you don't want your development philosophy to
accidentally change"). The math merely corroborates.

---

## The Opportunities Market restructure

### "Studio Original" is genuinely miscategorised — remove it from the *market*

`OpportunitySource` (`types/index.ts:1644`) is overloaded onto one enum doing two
contradictory jobs:

1. **A market source** — one of `OPPORTUNITY_SOURCES` (`opportunities.ts:12`), the
   cheapest tier (`SOURCE_COST_MULTIPLIER` ×0.1, longest expiry window).
2. **A provenance tag** — `settlePendingCommissions` (`commission.ts:108`) stamps
   every *commissioned* Asset `source: 'Studio Original'`; founding test scripts
   use it too.

So the game **already** uses "Studio Original" to mean "something the studio
created" — which is exactly why it no longer belongs in a market of *external*
opportunities. The brief's intuition is corroborated by the existing double-use.

**Recommendation (low-risk, high-clarity):**
- Remove `'Studio Original'` from `OPPORTUNITY_SOURCES`. The market becomes
  **Spec Screenplay / Agent Package / Publisher Rights** — all unambiguously
  external.
- **Split the overloaded enum.** Today one type serves both "how it appeared on
  the market" and "how the studio came to own it" (`Asset.source`). The restructure
  is the moment to separate `MarketSource` (Spec / Agent Package / Publisher Rights
  / *Studio Sale…*) from `AssetProvenance` (`Acquired` / `Commissioned` /
  `Founding`). This removes the collision permanently and makes commissioned
  originals stop masquerading as a market source.
- Because "source is mostly flavor riding on [a cost multiplier + an expiry
  window]" (`opportunities.ts:7-11`) — no parallel generation system per source —
  changing the market's source *set* is genuinely low-risk: labels, two scalars
  each, and the writer-selection skew in `writers.ts:selectWriterForSource`.

### Optional richer replacement: "Studio Sale / Studio Project"

If studios should *sell developed projects* (Fox develops, Sony buys, Netflix
rescues), that is a coherent **new external source** distinct from Spec: a
studio-developed package that "no longer fits their slate." Mechanically it
differs from Spec by (a) a **higher craft floor** (already developed → higher
structure/characters/dialogue at generation), (b) a **higher cost multiplier**,
(c) possibly a **shorter window** (someone else is circling). Additive; fits the
existing source-as-two-scalars model.

### The broader "Development Opportunities" vision (IP / Franchises / Talent / Productions)

This is the one genuinely large piece, and it is an **architectural reshape**, not
a rename. Today `Opportunity` **always carries a full `Script`** wholesale
(`Opportunity.script`, `types/index.ts:1657`). The richer market types do not:

| Proposed market section | Payload it actually carries | Not a `Script` because… |
|---|---|---|
| Screenplays (Spec / Agent Package / Studio Sale) | a `Script` | — (the current shape) |
| **IP** (novel / comic / game / remake / public-domain rights) | an IP + maybe a concept | you buy rights, then still develop/commission a screenplay. Seam already exists: `engine/intellectualProperty.ts`, `engine/ipViability.ts` |
| **Productions** (script + producer + maybe director seeking finance) | a partially-assembled Project | you buy *into* it, not a bare script |
| **Talent attachments** ("Nolan wants material", "Cruise is shopping a package") | a `Person` + intent | the opportunity is *access to attach them*; pipeline doc's `Available→Attached→Contracted→Booked` |
| **Franchises** (Terminator, Die Hard, Resident Evil) | an IP + sequel/brand rights | pipeline doc Phase E; a sequel becomes a *new* Asset referencing the original |

**Architectural implication:** `Opportunity` becomes a **discriminated union** keyed
on kind, where `.script` is present only on the Screenplay kinds and other kinds
carry `{ip}` / `{production}` / `{talentId}` / `{franchise}`. Every current reader
assumes `opportunity.script` exists, so this must be phased. It should build on the
existing `intellectualProperty.ts` rather than a fresh IP model.

---

## Open tensions this audit surfaces

1. **`complexity` is a category error waiting to happen.** Stored as a "craft
   stat," has no writer axis, never rewritten, behaves like production scope.
   Any restructure of the Concept/Craft split should re-home it as Scope/Production.
2. **Vocabulary drift across doc eras.** `DESIGN.md §5.35` calls all five stats
   "intrinsic quality attributes"; the later phase docs re-cut four as mutable
   execution. Reconcile DESIGN.md's language with the dev-department contract when
   the split moves.
3. **`crossoverPotential` is designed but partially dormant** (`DESIGN.md:4599-4604`).
   Originality's box-office reach is not fully live yet — worth wiring as part of,
   or before, the Concept move, so making originality immutable has its full
   intended payoff.
4. **The deferred pressure valves give development its teeth.** Asset *heat* decay,
   rights expiry, and sell-back / re-listing are all scoped-but-unbuilt
   (`DESIGN.md:5098-5152`, dev-dept "deferred"). Without them, the time-cost of
   development is "soft." A market restructure is a natural moment to revisit at
   least sell-back (an abandoned Asset re-listing as an Opportunity closes the
   loop the pipeline doc originally imagined).

---

## Recommended sequencing

1. **Phase 1 — near-term, low-risk, high-clarity (the keystone + the rename):**
   - Move `originality` into immutable Concept (type-level; compiler-enforced).
   - Reconcile `complexity` as Scope/Production (documentation + conceptual;
     keep it immutable post-generation).
   - Split `OpportunitySource` into `MarketSource` + `AssetProvenance`; drop
     `Studio Original` from the external market; tag commissions as
     `Commissioned`.
   Both are small, mostly correctness/clarity, and change the *character* of the
   development pipeline exactly as the brief intends.

2. **Phase 2 — the market reshape (larger):**
   - Introduce the `Opportunity` discriminated union and the first non-Screenplay
     kind (IP is the natural first, on top of `intellectualProperty.ts`).
   - Add "Studio Sale" as a richer external screenplay source if desired.

3. **Phase 3+ — the full producer's desk:**
   - Talent attachments, franchises, buy-into-productions; revisit the deferred
     pressure valves (heat/rights/sell-back) so development time has real cost.

The through-line: the brief's philosophy is **already the code's architecture** —
it just needs `originality` moved across one line, and the market's payload freed
from always being a finished screenplay.
