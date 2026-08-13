# Audit — The Script, and Everything It Touches

*A full trace of the `Script` entity: its exact shape, how it is born, how it flows
through the game's lifecycle, and every system that reads it — with a specific
inventory of the detail that **already exists but is not yet consumed**, framed for
the goal of making films feel unique and memorable and of letting the script drive
cast and crew selection in richer ways.*

> Method: this audit was assembled from a full read of the type contracts and a
> parallel trace across generation, scoring/commercial, cast/crew, production/lifecycle,
> and presentation/docs. Every load-bearing claim about a field being inert was
> verified directly against source (grep + read), not inferred. File references are
> `path:line` as of this branch.

---

## 1. Executive summary

**The Script is the game's creative root, and it is architecturally excellent — but
much of its detail is decorative today.** The type is small, principled, immutable,
and self-documenting. The problem for your goal is not the shape; it is the **wiring**.
A large fraction of the script's richest fields are stored, displayed, and then read
by *nothing that changes an outcome or a decision*.

Three findings dominate everything below:

1. **Three of the four "idea" fields are inert.** `emotionalPremise` feeds only a
   display string. `hook` and `franchisePotential` reach outcomes *only* through
   `deriveMarketability`, whose box-office lever is hard-zeroed
   (`FRANCHISE_ELIGIBILITY_GAIN = 0`, `audienceSimulationInputs.ts:204`). A film with a
   spectacular hook and huge emotional stakes but middling craft scores **identically**
   on quality, reviews, awards, and box office to a dull one. (§5, §7.A)

2. **The script barely informs cast and crew selection — which is exactly what you want
   to change.** Casting reads only **5 of 9** character trait axes, **unweighted**, at
   **≤40%** of any hiring decision; **18 of 19** character archetypes are ignored;
   `genre`, `storyType`, `primarySetting`, and `intendedAudience` exert essentially no
   pull on who gets hired. Crew other than the director have **no script-fit channel at
   all** — even though a full script→crew fit signal is already computed one layer away
   and then walled off as "presentation only." (§6, §7)

3. **The expansion surface is enormous and already scaffolded.** The author has
   repeatedly built the *inputs* for richer coupling (per-character trait profiles, a
   17-leaf requirement taxonomy, department workload routing, crew specialty/philosophy
   spaces) and deliberately left them non-scoring "calibration-safe" reads. Turning
   these from reads into decision drivers is mostly *wiring existing data*, not
   inventing new systems. (§7, §9)

The good news: because the codebase religiously follows a **"store intrinsic
properties, derive strengths on demand"** discipline (Simulation Philosophy Principles
8–9), you can rebalance and extend the script's *leverage* without migrations or schema
churn. The fields are there. They just need to be believed.

---

## 2. The exact shape of a Script

`Script` — `src/types/index.ts:774-849`. It is an **immutable creative snapshot of one
completed draft**. Grep confirms zero writes to any `Script` field anywhere in the code;
a rewrite mints a *new* `Script` rather than mutating one (§4). The fields partition into
five conceptual groups, formalised by the `ScriptConcept` / `ScriptCraft` type aliases
(`:891-899`).

### 2.1 Master field table

Legend for **Leverage**: 🟢 live and material · 🟡 live but small/indirect ·
🔴 inert to outcomes (display/texture only). "Sets" = what determines the value at
generation. "Reads" = every consumer that changes an outcome or decision.

| Field | Group | Sets it (at generation) | Who reads it → effect | Leverage |
|---|---|---|---|---|
| `originality` | Concept-quality (immutable) | Archetype quality band, biased by writer `conceptAmbition` | `computeScriptScore`·0.25 (→ quality → everything); `criticScore`·0.14 **direct**; best-screenplay award·0.30; `crossoverPotential`·0.45 (→ box-office legs); ancillary cult/longevity; ConceptStrength display | 🟢 (prestige **and** some commercial) |
| `hook` | Concept-quality | Uniform archetype band (not writer-biased) | ConceptStrength display; `deriveMarketability`·0.12 → **box-office lever zeroed** | 🔴 near-inert |
| `emotionalPremise` | Concept-quality | Uniform archetype band | ConceptStrength display **only** (`conceptStrength.ts:49,79`) | 🔴 fully inert |
| `franchisePotential` | Concept-quality | Uniform archetype band | ConceptStrength display; `deriveMarketability`·0.18 → **box-office lever zeroed** | 🔴 near-inert |
| `structure` | Execution-craft (rewritable) | Archetype band, biased by writer craft; a rewrite may raise it | `computeScriptScore`·0.25; `commercialProfile.hookStrength`·0.30 | 🟢 |
| `characters` | Execution-craft | Archetype band, writer-biased; rewritable | `computeScriptScore`·0.25; `hookStrength`·0.20 | 🟢 |
| `dialogue` | Execution-craft | Archetype band, writer-biased; rewritable | `computeScriptScore`·0.25 **only** — no commercial channel | 🟢 (critical/awards only) |
| `complexity` | Production scope (immutable) | Uniform archetype band (no writer bias) | Edit-facet ambition; preprod/editorial/shoot days (`production.ts`); commission & rewrite durations; IP cost-risk; requirement/workload profiles; `estimateScriptCost` | 🟢 (difficulty/cost/time) |
| `toneProfile` (6 axes) | Tone (rewritable in principle; rewrite leaves it alone) | Genre `canonicalTone` + per-tone jitter + 0–2 boosted flavor tones; writer tone-pull | Talent compatibility (director **and** actor); `deriveGenreFit` → audienceScore·0.25; director appeal & pitch; facet ambitions; `crossoverPotential`·0.30 (spectacle) | 🟢 **the dominant script→talent signal** |
| `genre` | Categorical identity | Writer affinity / market slate | Popularity & importance everywhere: commercial sub-values, box-office pool sizing, genre-tilted quality weights, facet ambition, reviews, ancillary. **Casting: only `genre==='Horror'` (one boost).** | 🟢 globally · 🔴 to casting |
| `archetype` | Categorical identity | Weighted by genre affinity (+ writer commercial lean) | Shapes all quality bands at generation; `commercial.{accessibility,hookiness,crossover}` biases; ConceptStrength | 🟢 (commercial/gen); not in casting |
| `storyType` | Categorical identity | Weighted by archetype affinity | `accessibility`·0.3 + `hookStrength`·0.35 (hookiness); cast-size multiplier; gen affinities. **Casting: only `storyType==='War'` (one boost).** | 🟢 (commercial/gen) · 🔴 to casting |
| `primarySetting` | Categorical identity | Genre × story-type affinity (sequel inherits) | `settingDistinctiveness` → hookStrength (**≤ +5**); sets/vfx/cine/practical facet ambition; requirement profile | 🟢 (production); **not** in actor/director/writer appeal |
| `scale` | Categorical identity | Archetype × story-type weights | Commercial reach (accessibility·0.2, crossover·0.25); **all 6** facet ambitions; cost multiplier; cast size; prep days | 🟢 |
| `franchiseRecognition` | Provenance (immutable) | **Only** by sequel generation = source IP's `recognition`; else absent (original) | `deriveMarketability`·0.70 → **box-office lever zeroed**; ancillary home-ent/licensing/**merch**/longevity — **LIVE money** | 🟡 split: theatrical inert, ancillary live |
| `cast: ScriptCharacter[]` | Cast | `generateCast` (§3.4) | See §2.2 / §6 — role slots, casting compat, commercial (leads), ancillary, IP promotion | 🟢/🔴 mixed (mostly under-used) |
| `requiredLeads` / `requiredSupporting` | Cast sizing | Story-type × scale multipliers | Hire-Talent slot capacity (`castRequirements.ts`) | 🟢 (slots) |
| `intendedAudience` | Audience | Story-type × archetype × genre-typical weights | Box-office audience-mismatch penalty·0.7 (`audienceSimulationInputs.ts:299`). **Casting: inert.** | 🟡 box-office only |
| `productionRequirements` (10 dials) | Production scope | Story baseline ∪ scale floor ∪ setting bias, jittered | Requirement-profile → department-workload → crew-fit **read**; presentation tags. **No facet and no scoring path reads it.** | 🔴 to scoring/box-office; 🟡 to crew *reads* |
| `environmentStrategy` / `effectsStrategy` (distributions) | Derived lean | 100% derived from `productionRequirements` + setting + complexity | Director method-affinity (0.15 of scriptFit); requirement-profile routing | 🟡 |
| `environmentAmbition` / `effectsAmbition` (scalars) | Derived lean | Derived from same | Mostly display/gen; little downstream | 🔴 near-inert |
| `synopsis` | Flavor | Procedural log-line from premise banks | Presentation only — feeds no scoring | 🔴 (by design) |
| `cost` | Economy | `estimateScriptCost` from craft mean × scale × complexity | Charged **once** at acquisition; **not** re-charged at release | 🟢 (economy) |
| `title`, `id` | Identity | Title banks; `id` minted off-RNG | Display / keying | 🔴 (by design) |

### 2.2 The character sub-shape

`ScriptCharacter` (`:748-772`) — a **script-local** value object (its `id` is unique only
within its own Script): `name`, `archetype` (one of 19, `:703-722`), `prominence`
(`Lead`/`Supporting`/`Minor`), optional `castingGender`, optional `castingAgeBand`, and a
`CharacterTraitProfile`.

`CharacterTraitProfile` (`:736-746`) — **9 axes on a 1–100 scale**:

| Axis | Maps to an actor stat? | Consumed by |
|---|---|---|
| `transformationDemand` | ✅ `characterTransformation` | Casting compat (**live**) |
| `emotionalDemand` | ✅ `emotionalPerformance` | Casting compat (**live**) |
| `charismaDemand` | ✅ `charisma` | Casting compat (**live**) |
| `comedyDemand` | ✅ `comedy` | Casting compat (**live**) |
| `physicalDemand` | ✅ `physicalPerformance` | Casting compat (**live**); requirement profile (max across cast) |
| `dramaticDepth` | ❌ no actor equivalent | **Nothing** — pure texture |
| `audienceAccessibility` | ❌ | `commercialProfile` (leads·0.1); IP promotion |
| `distinctiveness` | ❌ | `commercialProfile.hookStrength` (leads, **≤ +5**); IP promotion |
| `merchandisePotential` | ❌ | Ancillary merch revenue; IP promotion. **Not** casting, **not** quality. (The type comment "no direct effect yet" at `:745` is stale.) |

The first five are the "acting demand" axes (`ACTING_STYLE_TO_CHARACTER_TRAIT`,
`compatibility.ts:134-140`). The last four never touch casting.

### 2.3 The design discipline the shape obeys

- **One job per field** (`:782`): each intrinsic attribute is "what the screenplay *is*,
  not how commercially attractive it is." Commercial appeal, concept strength, and
  marketability are **derived on demand**, never stored (`commercialProfile.ts`,
  `conceptStrength.ts`).
- **Concept vs craft immutability** (Simulation Philosophy Principle 9): a rewrite may
  improve only execution craft; the *idea* (including `originality`) is frozen at
  conception. This is compiler-enforced — the rewrite seam accepts only
  `Partial<ScriptCraft>` (§4).
- **Qualitative presentation** (CLAUDE.md): the player never sees a raw stat — quality
  becomes stars, concept/commercial/cost become named-cause prose, categories become
  badges (§8).

Respect these three when expanding; they are the reason the sim is rebalanceable from
`data/` (§9 constraints).

---

## 3. How a Script is born (generation pipeline)

Every Script is produced by one worker,
`generateScript(genre, rng, title, usedSynopses, author?, profile, sequelSeed?)`
(`scriptGenerator.ts:549`), fed by four public wrappers:

| Path | Wrapper | Distinguishing input |
|---|---|---|
| Market / acquired | `generateScriptOptions` (`:696`) | Per-source `GenerationProfile`; a writer picked by source |
| Commissioned | `generateCommissionedScript` (`commission.ts:41`) | Writer profile; **NEUTRAL** profile |
| Sequel / franchise | `generateSequelScript` (`:729`) | A `SequelSeed` (inherits setting, returning cast, `franchiseRecognition`) |
| Founding / test | hand-authored literals (`data/testScripts.ts`, `data/dev/referenceScripts.ts`) | Not procedurally generated; reuse `estimateScriptCost` |

**The archetype is the generative root.** Almost everything cascades from the chosen
`ScriptArchetype`: it sets the 8 quality bands (4 concept + 3 craft + complexity), then
biases story type → scale → setting → audience. This is intentional ("one archetype
cascades into everything") but it means concept fields and craft fields are **correlated
by construction** within an archetype.

**Three levers differentiate the paths** — the `GenerationProfile` (`:528`):
`conceptSpread` (the market "lottery" variance on concept axes), `executionShift` (flat
craft shift), `executionSpread` (per-axis craft variance = "spiky/uneven draft"). Spec
scripts are `{16,-16,24}` (wild idea, rough draft); Agent packages `{3,8,4}` (reliable,
polished); commissions & sequels use the neutral floor.

**Writer influence is minority-by-design** (`:420-462`): an author shifts only the
*centre* of craft rolls (0.4 share) and tone (0.3 pull), and nudges archetype odds — never
a hard filter. `conceptAmbition` biases `originality` only; `hook`/`emotionalPremise`/
`franchisePotential`/`complexity` are author-independent (properties of the idea, not the
writer).

**Determinism is a locked contract.** The RNG stream position is test-enforced; the
concept axes and spread finalizations are drawn *last* specifically so that adding them
didn't shift the earlier cast/tone stream. Character `castingGender`/`castingAgeBand` are
**hash-derived from the character's name** (FNV-1a), off the RNG stream, so adding
character fields doesn't reseed everything downstream. **Any new field should append at
the end of generation, or hash-derive, for the same reason.**

### 3.4 Cast generation

`generateCast` pushes exactly `requiredLeads` Leads, then `requiredSupporting` Supporting,
then a few `Minor` characters (pure flavor — no system consumes Minors). **This ordering is
a hard contract** consumed by `characterForRoleSlot`. Each character's archetype is a
weighted pick over 19 archetypes (genre × story-type × prominence affinity); its 9 traits
jitter ±12 around the archetype's `baseTraits`.

**Data tables that shape scripts** (all in `src/data/`, all tunable without touching
logic): `SCRIPT_ARCHETYPE_PROFILES` (the root), `STORY_TYPE_PROFILES`,
`SETTING_ARCHETYPE_PROFILES` (20 settings × 9 production-pressure scalars),
`SCRIPT_SCALE_PROFILES`, `GENRE_PROFILES`, `CHARACTER_ARCHETYPE_PROFILES` (19 × 9-dim
base traits), `PREMISE_BANKS`, `SCRIPT_TITLE_WORDS`.

---

## 4. Lifecycle & the immutability contract

The four-layer contract (`:851-899`) is real and enforced by a single mechanical fact:
**the `Script` object is shared by reference and never mutated.** "Freezing a snapshot"
just pins that reference.

```
generateScript ──► Opportunity.script
      │  (ACQUIRE / COMMISSION / DEVELOP_SEQUEL)
      ▼
   Asset.script (head)  ◄── revisions[]  ◄── developmentHistory[]  ◄── pendingRewrite
      │  reviseScript() mints a NEW Script; old head → revisions[]      (the ONLY "new Script" event post-generation)
      │  (CREATE_PROJECT_FROM_ASSET — blocked while a rewrite is pending)
      ▼
   FilmDraft.script  (= asset.script, by reference)
      │  greenlight → pre-production → photography  (never touch draft.script)
      ▼
   Film.script  (terminal snapshot — kept forever, untouched by later Asset revisions)
      │
      ▼
   post-release reads: IP promotion, franchise viability, ancillary revenue, export
```

- **The single mutation seam** is `reviseScript(asset, craftChanges: Partial<ScriptCraft>, opts)`
  (`screenplay.ts:62`). Because the parameter is `Partial<ScriptCraft>`, the compiler
  **rejects any concept field** — a rewrite structurally cannot redefine what the film is.
  In practice it's even narrower: `computeRewriteOutcome` touches only
  `structure`/`characters`/`dialogue` (not `complexity` or `toneProfile`).
- **Persistence:** `SAVE_KEY = 'hollywood-pictures-save-v81'` (`persistence.ts:416`), whole
  `GameState` serialized, no migrations (pre-launch policy — out of scope). The whole
  `Script` is serialized everywhere it appears. *Shape note only, per CLAUDE.md.*

**Sequel/IP flywheel:** `franchiseRecognition` is set only from a source IP's grown
`recognition`; on each franchise entry's release, `recordFranchiseEntries` grows the IP's
recognition monotonically, so the next sequel inherits a larger draw — a compounding loop
that is **live on the ancillary side but dormant on the theatrical side** (the box-office
lever is zeroed).

---

## 5. What the Script drives — the outcome map

Two derived aggregates and one score chain carry almost all of the script's leverage.

**ConceptStrength** (`conceptStrength.ts:46`) = `hook·0.30 + emotionalPremise·0.22 +
franchisePotential·0.18 + originality·0.15 + categorical·0.15`. **Consumed by nothing but
a display string.** This is the sole home of `emotionalPremise` and the main home of
`hook`/`franchisePotential` — which is why those three are effectively inert.

**CommercialProfile** (`commercialProfile.ts:88`) — three derived sub-values:
- `accessibility` = genre popularity·0.4 + storyType·0.3 + scale reach·0.2 + archetype +
  lead-character accessibility·0.1 → the **single biggest content lever on box office**
  (convex base interest, `INTEREST_CONVEXITY=2.2`).
- `hookStrength` = structure·0.3 + characters·0.2 + storyType hookiness·0.35 + popularity·0.15
  + archetype + setting distinctiveness·(≤5) + lead distinctiveness·(≤5) → buzz + secondary
  interest.
- `crossoverPotential` = originality·0.45 + scale reach·0.25 + popularity·0.15 + archetype
  → the **only content route to a breakout** (word-of-mouth legs), together with
  `toneProfile.spectacle`·0.30.

**Marketability** (`commercialProfile.ts:145`) = `franchiseRecognition·0.70 +
franchisePotential·0.18 + hook·0.12` → franchise-eligibility box-office multiplier —
**hard-zeroed today** (`FRANCHISE_ELIGIBILITY_GAIN = 0`). Fully wired, waiting to be
switched on.

**The quality → prestige/money chain:**

```
computeScriptScore = (originality + structure + characters + dialogue)/4·25 each
        │
        ├─► qualityScore (genre-tilted blend of script/direction/acting/post, soft-ceiling chain)
        │        ├─► criticScore = qualityScore·0.78 + originality·0.14 + editCritic·0.08
        │        │        └─► best-picture / best-director / best-screenplay (+originality·0.30) / craft awards
        │        └─► audienceScore = qualityScore·0.50 + genreFit(toneProfile)·0.25 + audEdit·0.15 + prod·0.10
        │
   toneProfile ─► talent compatibility ─► direction & acting scores (feed qualityScore)
        │
   commercialProfile + toneProfile.spectacle + intendedAudience ─► AUDIENCE SIMULATION ─► box office ─► profit
   originality + franchiseRecognition + cast.merchandisePotential ─► ANCILLARY money
```

**What matters most:** to **prestige**, `originality` (triple-counted) and the three craft
axes; to **money**, `accessibility` (convex) then `hookStrength`, with `crossoverPotential`
+ `spectacle` for legs — but all of these are dwarfed by non-script inputs (marketing
spend, star/director fame, studio brand, genre popularity, target-audience market size).

**toneProfile per axis:** `spectacle` is the richest (cine + score ambition **and** the
only direct box-office lever, crossover·0.30); `comedy` is the weakest (no facet, no
box-office channel — only indirect via compatibility/genre-fit).

---

## 6. The cast & crew coupling, in depth (your central question)

Today the script drives casting through **exactly three live channels**, and crew through
**essentially one** (the director). Everything else is presentation.

### 6.1 Character → actor (the one moderately-rich channel)

- **5 of 9 trait axes** map to actor `ActingStyle` and drive
  `computeCharacterCompatibility` (`compatibility.ts:151`) — an **unweighted mean gap**
  across the five. A character whose defining trait is `charismaDemand=90` weights that
  axis no more than an incidental `physicalDemand=50`. The code calls itself "a first-pass
  calculation."
- That compatibility is **≤40%** of any casting decision: 0.40 of `roleFit` inside realised
  performance (`scoring.ts:106`), and 0.35 of actor appeal (`castingAppeal.ts:78`) — where
  it is the *only* script-coupled term (the other 65% is reputation/salary/momentum).
- **Gender** is a hard exact-match gate; **age** is a soft penalty (floor 0.65) with an
  absurd-gap refusal at 18 years.

### 6.2 Role slots

`requiredLeads`/`requiredSupporting` set slot capacity; `characterForRoleSlot` binds a hire
to the character at the same ordinal within its prominence group. **Only `prominence`
participates** — a character's archetype and traits play no part in *which* slot exists or
*which* actor is eligible for it.

### 6.3 Script → crew

- **Director** is the one richly-coupled crew role: `scriptFit` (0.40 of appeal) blends
  tone taste-fit·0.40 (with a hard creative veto below a taste floor), craft-fit·0.20,
  method-affinity·0.15, and flat material·0.25. **But craft demand is derived purely from
  `toneProfile`** (`directorAppeal.ts:142`) — a VFX-heavy sci-fi and a talky drama with the
  same tone profile demand identical director domains. Genre, setting, and the rich
  requirement/workload signal are **not** fed to director fit.
- **Writer** is chosen at *generation* time, before the script exists — zero script-content
  coupling.
- **Every other crew head** (DP, composer, editor, VFX sup, production designer, casting
  director) has **no script-fit gate at all** — they "hire instantly, with no interest step
  to gate on." A full script→crew fit signal *is* computed (`crewFitRead`, `crewSpecialty`,
  `crewPhilosophy`) but is explicitly walled off as "changes neither cost nor scoring."

### 6.4 requirementProfile — the rich signal that goes nowhere decision-relevant

`deriveRequirementProfile` (`requirementProfile.ts:332`) reads the whole
`productionRequirements`, setting profile, tone, scale, complexity, effects/environment
strategy, and even per-character `physicalDemand`/`transformationDemand` and the
`MonsterOrCreature` archetype — into a 17-leaf taxonomy, routed by `departmentWorkload` to
PD/VFX/Stunts. **All of it terminates in a qualitative crew-fit *read*** — it never reaches
selection, acceptance, cost, or scoring. This is the single largest "already-built, not
yet believed" asset in the codebase.

---

## 7. The inert / under-used surface (the expansion inventory)

This is the practical heart of the audit: **fields that already exist on the Script or its
characters but are not consumed by any decision or outcome.** Ordered by size of gap.

### A. Concept-quality fields (idea strength) — near-dead to outcomes
- `emotionalPremise` — **fully inert** (display aggregate only).
- `hook`, `franchisePotential` — reach outcomes only via `deriveMarketability`, whose
  box-office lever is zeroed. Effectively inert until franchise eligibility is switched on.
- **Consequence:** the entire "how strong is the *idea*" layer is currently decorative. A
  memorable premise cannot beat a competent-but-dull one on any measured axis.

### B. Character trait axes — 4 of 9 ignored by casting
- `dramaticDepth` — consumed by **nothing** (pure texture).
- `audienceAccessibility`, `distinctiveness` — only modest commercial/IP reads; never a
  casting axis.
- `merchandisePotential` — ancillary + IP only; never casting or quality.
- **The character-compat formula is unweighted** — it ignores which demand *defines* the
  role, unlike the tone path which weights by how much the script leans on each axis.

### C. Character archetypes — 18 of 19 do nothing in cast/crew
Only `MonsterOrCreature` is read (by the requirement profile). `Antihero`, `Villain`,
`Mentor`, `LoveInterest`, `ComicRelief`, `Detective`, etc. exert **zero** pull on
suitability, appeal, typecasting, or crew needs. A large, cheap surface.

### D. Categorical fields barely touching selection
- `genre` → only `genre==='Horror'` (one boost) in cast/crew.
- `storyType` → only `storyType==='War'` (one boost). A Musical implies choreography/singing
  casting; a Biopic implies transformation-heavy prestige casting — none is modelled.
- `primarySetting` → crew *reads* only; never actor/director/writer appeal.
- `intendedAudience` → box-office only; no "family-friendly star vs edgy talent" coupling.

### E. Crew has no script-fit selection channel
The `crewFitRead` / `crewSpecialty` / `crewPhilosophy` machinery already derives exactly the
script↔crew fit a selection gate would need — but it is presentation-only. `crewPhilosophy`
even builds a 2-axis space to compare director and crew leanings, and **no consumer scores
the overlap.**

### F. Production signal inert to quality
`productionRequirements` (the 10 dials describing what the shoot actually needs) is read by
**no facet and no scoring path** — the facets derive ambition from genre/setting/scale/tone
instead. `environmentAmbition`/`effectsAmbition` are near-inert. `dialogue` has no commercial
channel (fine, but note it).

### G. Fragilities to fix while you're in here
- Franchise reprisal binds returning roles **by character name string** (script-local ids),
  so a rename silently breaks continuity.
- The `merchandisePotential` "no effect yet" comment (`:745`) is stale.
- The director's "creative demand to recast" is aptitude-only — it never reads the
  character's traits.

---

## 8. What the player currently sees

Presentation is strictly qualitative (CLAUDE.md house rule). `ScriptDetails.tsx` (Opportunity
Market, Project Overview) shows: identity badges, `synopsis`, **Concept Strength** prose,
**Cost** + cost-driver prose, **commercial appeal** prose, production-requirement badges,
Writing/Creative stat groups as **stars**, tone breakdown, and per-character cards with
archetype label, gender/age badges, and a "what the part needs" demand read (the five
acting axes as magnitude words). `CastingRoleBrief.tsx` is the "who am I casting for" pane.

**Hidden from the player entirely:** `hook`, `emotionalPremise`, `franchisePotential`
(rolled up into the Concept Strength band), `franchiseRecognition`, the environment/effects
distributions, and the four non-acting character traits (surfaced only later in the IP
modal — which, notably, *breaks* the qualitative rule by showing raw score bars).

---

## 9. Expansion opportunities & recommendations

Framed against your two goals — **(i)** films that feel unique/memorable, and **(ii)** the
script informing cast & crew selection more richly. Ordered roughly by leverage-per-effort.
Each notes whether it's *wiring* (connect existing data) or *new system*.

### Tier 1 — Turn on the detail that already exists (mostly wiring)

1. **Weight the character-compatibility formula by the role's own demand emphasis**
   (mirror the tone-compat formula). *Wiring, ~1 function.* Immediately makes a
   charisma-defined lead genuinely want a charismatic actor, and makes two same-archetype
   roles cast differently. Highest ratio of impact to effort for goal (ii).

2. **Give crew heads a real script-fit channel.** Promote a fraction of the already-computed
   `crewFitRead` / `crewSpecialty` signal from presentation into either a hiring
   acceptance/appeal term or a scoring nudge. *Wiring — the inputs exist.* This is the single
   biggest lever for "the script informs *crew* selection," which today is near-zero.

3. **Feed the requirement/workload signal into director craft-fit** instead of deriving it
   from tone alone. *Wiring.* A creature-heavy film should demand a visually-capable director
   even at neutral tone.

4. **Make `storyType` and character `archetype` shape casting.** e.g. a Musical raises a
   "performance/choreography" demand; a Biopic raises `transformationDemand` weighting; a
   Villain/Antihero biases toward distinctive-over-accessible actors. *Small new mappings over
   existing enums (19 archetypes, 11 story types) — cheap, high flavor.*

### Tier 2 — Make the "idea" matter (targeted un-zeroing)

5. **Wire `hook`/`emotionalPremise`/`franchisePotential` into *something*.** The cleanest
   options, respecting the architecture:
   - Let `emotionalPremise` feed audience word-of-mouth / legs (an emotionally resonant film
     holds better), and/or the acting-award and audienceScore paths.
   - Let `hook` feed opening-weekend urgency/buzz directly (not only via the zeroed
     marketability lever).
   - This is the design's stated intent (`DESIGN_REVIEW_originality_vs_marketability.md`) — the
     seam is built; it needs a non-zero gain and a home. *Calibration-sensitive; do it behind
     the diagnostic gates.*

6. **Introduce a real originality↔marketability tradeoff.** Today `originality` is nearly all
   upside (quality + critics + awards + crossover + ancillary) with its intended commercial
   counterweight (franchise draw) switched off. Turning on `FRANCHISE_ELIGIBILITY_GAIN` (or an
   equivalent) is what makes "safe franchise vs risky original" a genuine choice — central to
   films feeling *distinct*.

### Tier 3 — New per-script texture for memorability (new system, higher ambition)

7. **A signature/dominant-demand concept for roles.** Surface each character's defining
   demand and reward a "the part called for exactly their gift" match at cast time (the
   `signatureGift` idea already exists at *post-release* read time in `castPerformance.ts` —
   lift it forward into selection). Makes casting feel like matchmaking, not stat-averaging.

8. **Give `dramaticDepth`/`distinctiveness` an actor counterpart** (a prestige/character-actor
   axis) so "a distinctive character actor vs a bankable everyman" becomes a real casting
   decision — the missing fourth and fifth casting dimensions.

9. **Consume `productionRequirements` in the facets** (or make it the derived source of truth
   the requirement taxonomy is meant to become). Aligns "what the script says the shoot needs"
   with "what the shoot actually costs and how well it turns out."

### Constraints to honor while expanding

- **Store intrinsic, derive strength.** Any new *quality/appeal/fit* value should be a pure
  `derive*` function over existing fields, not a new stored roll (Principles 8–9). This is why
  none of Tier 1–2 needs a migration.
- **Concept stays immutable; only craft is rewritable.** New idea-strength wiring must not
  become something a rewrite can manufacture. Keep the `ScriptConcept`/`ScriptCraft` partition.
- **Presentation stays qualitative.** New signals surface as stars/prose/named-causes (and fix
  the IP modal's raw bars while you're at it).
- **Generation determinism.** Append new generated fields at the end of the stream, or
  hash-derive them, to avoid reseeding the locked RNG contract.
- **Watch the weight budget.** Any richer casting signal (Tier 1, 3) competes inside a ≤40%
  script-coupled slice of the hiring decision — you will likely need to *rebalance the casting
  weights*, not just add a term, for the new nuance to be felt.

---

## 10. File index

**Core shape:** `src/types/index.ts` — `Script` :774, `ScriptCharacter` :748,
`CharacterTraitProfile` :736, `ScriptConcept`/`ScriptCraft` :891, `Asset` :2029,
`ProductionRequirements` :677, categorical enums :606-669.

**Generation:** `engine/scriptGenerator.ts`, `engine/premiseGenerator.ts`,
`engine/commission.ts`, `engine/writers.ts`, `engine/titleGenerator.ts`;
`data/{scriptArchetypes,storyTypes,settings,scale,genres,characterArchetypes,premises,scriptWords,tones}.ts`.

**Derived aggregates:** `engine/conceptStrength.ts`, `engine/commercialProfile.ts`.

**Scoring/outcomes:** `engine/scoring.ts`, `data/scoringWeights.ts`, `engine/genreWeights.ts`,
`engine/reviews.ts`, `engine/awards.ts`, `engine/audienceSimulationInputs.ts`,
`engine/ancillary.ts`, `engine/releaseFilm.ts`, `engine/marketSettlement.ts`.

**Cast/crew:** `engine/casting.ts`, `engine/castRequirements.ts`, `engine/castingAppeal.ts`,
`engine/compatibility.ts`, `engine/requirementProfile.ts`, `engine/departmentWorkload.ts`,
`engine/directorAppeal.ts`, `engine/directorPitch.ts`, `engine/crewFitRead.ts`,
`engine/crewSpecialty.ts`, `engine/crewPhilosophy.ts`, `engine/franchiseTalent.ts`.

**Lifecycle/production:** `engine/screenplay.ts`, `engine/rewrite.ts`,
`engine/sequelDevelopment.ts`, `engine/intellectualProperty.ts`, `engine/ipViability.ts`,
`engine/{vfx,sets,score,edit,cinematography,practical}Facet.ts`, `engine/facetModel.ts`,
`state/{gameState,studioReducer,persistence}.ts`.

**Presentation:** `engine/scriptPresentation.ts`, `data/scriptTagLabels.ts`,
`components/common/{ScriptDetails,ScriptSummaryCard,FilmDetailModal,IpDetailModal,StatGroup}.tsx`,
`components/wizard/CastingRoleBrief.tsx`.

**Design intent:** `docs/SIMULATION_PHILOSOPHY.md` (Principles 8–9),
`docs/DESIGN_REVIEW_originality_vs_marketability.md`,
`docs/DESIGN_REVIEW_source_generation_and_determinants.md`,
`docs/DESIGN_REVIEW_development_department.md`, `docs/DESIGN_REVIEW_studio_financial_model.md`.
