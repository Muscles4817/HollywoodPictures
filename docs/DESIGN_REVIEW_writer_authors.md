# Design Review — Writers Become Authors (Phase 2)

Status: **implemented** (save v48). Follows the Phase 1 screenplay/development
foundation (docs: the Asset↔Script contract). Establishes writers as real
creative entities that *shape* screenplays without dictating them, ahead of the
Development Department (Phase 3+).

## Principle

```
market requirements + screenplay archetype + writer creative tendencies
  + writer craft strengths + controlled randomness  =  finished screenplay
```

Archetype-first generation stays dominant. A writer shifts probabilities within
the archetype's territory; they never determine the outcome. Great writers make
good scripts *more likely*, not certain — weak scripts, experiments, poor genre
fits and the occasional masterpiece all still occur.

## The model — `WriterCareer`

Writer graduates from the flat, skill-only `CrewCareer` bucket to a bespoke
creative career (like Director/Actor already have). `WriterCareer extends
CrewCareer<'Writer'>`, so every generic crew consumer (`getCrewCareer`, on-set
`skillSensitive` events, craft-award scoring) keeps reading `.skill` unchanged;
only creative-aware code reads the new fields.

| Field | Meaning |
|---|---|
| `skill` | Overall execution *level*, **independent** of craft shape (see below). Kept on `CrewCareer`. |
| `craft` | Relative *shape* on the four Script craft axes: `originality / structure / characters / dialogue` (1-100 each). |
| `toneProfile` | Tonal signature (reuses the Director tone type). |
| `genreAffinity` | **Weighted** genre profile, `Record<Genre, number>` (1-100 each) — "mostly thrillers, sometimes drama, rarely comedy." |
| `commercialLean` | 1-100: prestige/original ↔ commercial/crowd-pleasing. |
| `consistency` | 1-100: variance control (low = an inconsistent auteur; high = a dependable craftsman). |

The creative half is also exposed as a standalone `WriterCreativeProfile` value
type, so `engine/scriptGenerator.ts` can be biased by a writer **without importing
the Person/talent model** (keeps generation decoupled), and so a future
collaboration system can blend two writers' profiles.

### Two deliberate decisions

- **`skill` stays independent, not `average(craft)`.** Overall execution ability
  isn't the mean of the four craft axes: a writer can be phenomenal at dialogue
  and structure, merely average at originality, and still rank among the best.
  Generation runs the other way — craft is generated *around* skill (1-2 signature
  axes above the writer's level, the rest modestly below), so a skill-90 writer is
  strong everywhere with a standout and a skill-40 writer is weak everywhere with a
  relative strength, while `skill` remains the single "how good overall" number
  used by salary, on-set events, and the player-facing headline.
- **Weighted genre affinity, not `Genre[]`.** A discrete favourite-genre list
  turns a writer into "a comedy writer"; a weighted profile reads as "mostly
  comedy, occasionally drama, rarely horror," which ages far better over a long
  campaign and drives believable, varied output.

## How writers influence screenplay generation

`generateScript(genre, rng, title, used, author?)` — all influence gated on an
author actually being supplied; the un-authored path is byte-identical to before
(preserving determinism the tests lock).

- **Archetype:** `commercialLean` multiplies the archetype weights (prestige →
  Prestige/OriginalVision, commercial → CrowdPleaser/GenreFormula), still a
  weighted pick inside the same archetype system.
- **Craft:** each of the four craft rolls is biased toward the author's own level
  on that axis, spread by `consistency`, but anchored on the archetype's band
  (with a little overshoot so a great author can rarely exceed the ceiling and a
  volatile one dip below the floor). `complexity` has no writer axis and stays a
  plain band roll.
- **Tone:** the generated tone is pulled a fixed fraction toward the author's
  tonal signature.

Influence is a **minority weight** (craft centre share 0.4, tone pull 0.3) so the
archetype's own band still owns "what kind of film this is."

## Opportunity source drives writer selection

The opportunity pipeline now follows Hollywood: **source first, then a
source-appropriate writer, then a genre from that writer's affinity, then a
screenplay shaped by them** (`engine/writers.ts:selectWriterForSource`).

| Source | Favours |
|---|---|
| Spec Screenplay | emerging / unknown writers (low standing) |
| Agent Package | established, agency-repped writers (mid-high) |
| Publisher Rights | proven names on known material (mid-high) |
| Studio Original | commissioned elites (high standing) |

Standing is skill-led (`0.7·skill + 0.3·fame`). Weights are always positive — any
writer *can* appear via any source, just rarely against type — so elite writers
no longer routinely post anonymous specs. The author is referenced by id on
`Opportunity.writerIds`, carried to `Asset.writerIds` at acquisition (the Phase 1
authorship seam), never copied.

## Presentation

Internally precise, externally qualitative — same philosophy as Phase 1.
`engine/writerPresentation.ts:describeWriter` turns the hidden numbers into a tier
word and a single "known for tense, character-driven thrillers" phrase; the
Opportunity Market shows `Written by <name>` + that description. No raw stat is
ever shown.

## Migration

Save key **v47 → v48**, no migration code (established convention): a v47 save's
writer careers lack the creative fields and its opportunities have no author, so
it falls back to a fresh studio. The legacy un-authored generation path is
preserved exactly, so the change to writer generation only affects new saves.

## Future-proofing (deliberately not built)

The architecture is shaped so later phases are additive, not reshapes:

- **Rewrites / commissions / collaboration** consume `WriterCreativeProfile` (a
  plain value), so a rewrite can blend or apply a profile; `selectWriterForSource`
  is reusable/invertible for a studio commissioning a *specific* writer.
- **Career records / relationships / studio identity / sales / options** all hang
  off the persistent writer `Person` (stable ids) and the `writerIds` references
  already linking screenplays → authors and (via `Film.assetId`) films → authors —
  derivable, no new storage needed yet.
- **Known concern:** procedural talent uses a module-level `nextTalentId` counter.
  Fine while the pool is generated once at game start; a future system that mints
  *new* writers mid-game (commissions) will need the save-stable id fix scripts
  already got in Phase 1.
