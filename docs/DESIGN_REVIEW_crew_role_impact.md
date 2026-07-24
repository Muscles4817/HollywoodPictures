# Design Review: Making Hireable Crew Roles Matter

## Problem

The `roleSensitivity` diagnostic (`src/engine/roleSensitivity.diagnostic.test.ts`,
`ROLE_SENSITIVITY_DIAGNOSTIC=1`) swaps a floor hire (skill ~8) for a ceiling hire
(skill ~98) in each production role, on one fixed excellent project, and measures
the finished Quality Score gap. The result:

```
role               path(dir/evt)  directD   fullD   presenceD  flag
Director                     Y/1     22.13   21.78      20.83
Lead Actor                   Y/4      7.34    7.65       8.97
Supporting Actor             Y/1      3.15    3.28       3.92
Composer                     n/1      0.00    0.19      -0.33   near-nil
Writer                       n/2      0.00    0.13       0.27   near-nil
Cinematographer              n/1      0.00    0.04       0.16   near-nil
Editor                       n/2      0.00    0.04       0.12   near-nil
VFX Supervisor               n/0      0.00    0.00       0.06   NO PATHWAY
Casting Director             n/0      0.00    0.00       0.13   NO PATHWAY
```

Only Director, Lead Actor, and Supporting Actor move the finished film. The six
crew roles are near-nil, and two have no pathway to quality at all — neither a
direct term in `computeQualityBreakdown` (scoring.ts) nor an `involvesRole` event
(data/productionEvents.ts).

## Reframe: which roles are actually broken

The diagnostic measures the **production → finished-film** pass, where the script
and cast are already fixed. Two of the six near-nil roles do their real work
*before* that pass, so a near-nil reading here is correct and expected:

- **Writer** — shapes the screenplay at generation
  (`engine/scriptGenerator.ts:generateScriptOptions(..., author)`): the writer's
  commercial lean biases archetype selection, and each craft-stat roll
  (originality/structure/characters/dialogue) is authored from the writer's
  `WriterCraft`. Those stats *are* Script Score. The writer's impact is fully
  real — it is simply baked into the Script before the shoot begins, which is
  why a harness that fixes the script cannot see it.
- **Casting Director** — drives casting curation
  (`engine/castingCalls.ts`): `castingDirectorSkill` raises applicant volume and
  gives a skill-scaled "Discovery" chance to surface better-fitting candidates.
  A better casting director yields a better shortlist, whose *fit* then lifts
  Acting Score. That value lands at hire time, on *who is available to cast* —
  which the harness holds fixed.

These two are **working as intended**. They need *measurement*, not rewiring;
wiring them into the finished-film pass would double-count Writer (against Script)
and miscategorise Casting Director (a casting lever, not a quality term). See
§5 for the two companion diagnostics that should prove they work.

The genuinely inert roles are the four **craft** roles. Each maps to a node of
the quality dependency chain that today has only money or a menu choice as its
voice, and no human in the chair:

| Role | Chain node | Current voice of that node | Human voice today |
|---|---|---|---|
| **Cinematographer** | Production / capture | spend dials (set, style) | none |
| **VFX Supervisor** | Production / effects | `vfxAmount` (money only) | none |
| **Composer** | Post-Production | `musicFocus` menu choice | none |
| **Editor** | Post-Production | `editStyle` choice + coverage ceiling | none |

## Design principles this must respect

From `docs/SIMULATION_PHILOSOPHY.md`:

- **Principle 7 — connect existing systems, don't duplicate.** The fix is to give
  a human voice to chain nodes that already exist, not to bolt on parallel
  crew-score terms. "First ask which existing signal already models it and is
  simply not being read."
- **Typed, explainable consequences.** Cinematographer → *visual execution*;
  Editor → *coverage/pacing*; Composer → *music/post*. These are the existing
  typed buckets (`productionExecution.ts`), not scalar `quality −8` nudges.
- **Principle 6 — trade-offs.** Every crew term must ride on a real spend/choice
  lever, so hiring a top crew member is an informed bet with a cost, not a free
  upgrade.
- **Craft raises ceilings; safety does not.** The philosophy forbids a *passive
  bonus for being reliable/prepared* — but a skilled cinematographer legitimately
  raising the visual ceiling is craft, exactly as an actor's `craftFloor` is a
  deterministic craft baseline (`engine/actingModel.ts`). Crew craft terms follow
  the actor-craft precedent, not the reliability rule.

## Proposal

Give each of the four craft roles a voice in its department node, in **two parts**:

1. **A craft term** — a deterministic contribution to the department's own
   sub-score, modest and scaled by the spend/choice lever that role governs
   (Principle 6). Absent hire = neutral 50, so today's crew-less fixtures and
   rivals are unaffected until they staff up.
2. **Expanded event coverage** — every craft role gets enough skill-sensitive
   `involvesRole` events that a strong vs weak hire reliably shows up across a
   shoot, so the endogenous, per-shoot variance (Principle 1/2) is real and not
   dependent on one rare template firing.

All numbers below are **starting points to calibrate against the harness** (§6),
and belong in `data/` + the tunable constants at the top of the relevant engine
module, per `CLAUDE.md` — not threaded as magic numbers through logic.

### Editor → Post-Production (clearest metaphor, strongest leverage)

Post-Production is a top-level Quality weight (~0.25), so the Editor is where a
craft term buys the most. Two hooks, both already half-built:

- `computePostProductionScore` gains an **editor-skill term** — the base cut
  quality is partly the editor's, not just the `editStyle` menu.
- Editor skill governs **how much of the coverage ceiling is realised**: a great
  editor recovers more from thin coverage (`editCoverageCeiling`,
  `productionDials.ts`) — the "the editor could not fully repair the third act"
  chain from Principle 4 — but still cannot exceed what was shot. This is the
  existing ceiling metaphor given its natural author.

### Composer → Post-Production

`MUSIC_FOCUS_PROFILES[...].qualityDelta` is currently choice-only: a `Heavy`
score contributes the same +8 regardless of who wrote it. Scale that delta by
**composer skill** — a bold score from a journeyman is not a bold score from a
master — and add a small composer term to `computePostProductionScore`. The
`buzzDelta` can scale too (a marquee composer is a selling point).

### Cinematographer → Production / capture

`computeProductionScore` (contingency/style/set/effects) gains a **cinematography
term**, with the weights reallocated to make room. Because Production is *not* a
top-level Quality term (it reaches Quality only via the footage ceiling on Post —
see §4), also route cinematographer into the **footage-capture blend**
(`FOOTAGE_*_WEIGHT`, scoring.ts): a well-shot film gives Post more to work with.
This reinforces the footage-ceiling metaphor and is where the DP's grip on the
finished film should live.

### VFX Supervisor → Production / effects

`vfxScore` (`productionDials.ts`) is currently pure money — the spend lands the
same however it is supervised. Make **realised VFX = f(vfxAmount, supervisorSkill)**:
the supervisor determines how well the spend is realised. It enters via the
existing genre-scaled effects term (`profile.vfxImportance`), so a great VFX
supervisor matters most in Action/Sci-Fi/Fantasy and barely at all in a chamber
drama — a genuine identity/genre trade-off (Principle 6), not a flat bonus.

### Event coverage to add

| Role | Events today | Add |
|---|---|---|
| Cinematographer | 1 | lighting/lens/weather technical events (typed: *visual*) |
| Composer | 1 | scoring/spotting-session events (typed: *pacing/post*) |
| Editor | 2 | (adequate; verify fire rate) |
| VFX Supervisor | 0 | vendor/shot-completion/technical events (typed: *visual*) |

## §4 — The one architectural decision: Production's leverage on Quality

Post-Production is a top-level Quality term; **Production is not** — it reaches
Quality only through the footage ceiling on Post (`FOOTAGE_PRODUCTION_WEIGHT` 0.3
→ `K_FOOTAGE_TO_EDITING` 0.25 → Post's ~0.25 weight). A full 0→100 Production
swing therefore moves finished Quality by only ~2–3 points. This is a
pre-existing design choice (the philosophy itself flags "Production has roughly
cosmetic effect on final quality"), and it caps how much **Cinematographer + VFX**
can ever move Quality Score while they live in Production.

Three ways to resolve it:

- **A. Accept it.** DP/VFX mostly govern the *edit ceiling* + Audience/visual
  reads, not raw Quality. Smallest change; keeps the chain as-is. DP/VFX top out
  at a few points of Quality even at ceiling skill.
- **B. Route cinematography (and realised VFX) into the footage blend directly**,
  independent of the Production sub-score — a well-captured image is what the
  edit has to work with. Moderate change; gives DP/VFX real grip on Post without
  making Production a headline term. **Recommended** — it is the most on-theme
  (the footage-ceiling metaphor already exists) and keeps Director dominant.
- **C. Elevate Production to a top-level Quality weight.** Largest change:
  re-weights the whole quality model and touches every calibration test. Only
  worth it if we decide the *visual craft of a film* should be a headline quality
  axis on par with Script/Direction/Acting/Post.

## §5 — Companion diagnostics (prove Writer & Casting Director work)

Rather than force these two into the film-quality harness, add two small opt-in
diagnostics that measure them where they actually act:

- **Writer**: generate script slates with a floor vs ceiling writer
  (`generateScriptOptions(..., author)`) and compare the resulting Script Score /
  craft-stat distributions. Expected: a clear, positive gap — proving the upstream
  pathway is real.
- **Casting Director**: run casting calls with a floor vs ceiling
  `castingDirectorSkill` and compare shortlist *fit* (and downstream Acting Score
  of the best-available cast). Expected: better shortlists → higher achievable
  Acting Score.

## §6 — Calibration & acceptance criteria

Re-run `roleSensitivity` after each change. Target `fullD` bands (floor→ceiling
Quality swing on the excellent-project baseline), chosen to keep the creative
hierarchy intact:

| Role | Target `fullD` | Notes |
|---|---|---|
| Director | ~22 (unchanged) | must stay dominant |
| Lead Actor | ~8 (unchanged) | |
| Editor | 4–8 | top-level Post leverage |
| Composer | 2–4 | |
| Cinematographer | 3–6 | via footage (Decision B) |
| VFX Supervisor | 2–8 in VFX genres, ~1 in drama | genre-scaled |
| Writer / Casting Director | ~0 here | measured by §5 instead |

Plus: the spend/choice lever behind each term must remain a real cost (Principle
6 — no free upside), and the `productionExecutionCalibration` and rival-parity
tests must stay green.

## §7 — Scope / persistence

Pre-launch (`CLAUDE.md`): `CrewCareer.skill` already exists on every crew career,
so no stored-schema change is required for the careers themselves — this is a
scoring + event-data change. If any `PostProductionChoices`/`ProductionChoices`
shape changes, bump `SAVE_KEY` in `state/persistence.ts` and target the current
schema only; no migrations.

## Non-goals

- No hidden release-time roll — variance stays in the recorded shoot (Principle 2).
- Don't wire Writer or Casting Director into the finished-film pass (double-counts
  Script / miscategorises casting).
- Don't let crew craft rival or overtake Director/Acting — crew are the *voices of
  their department node*, not a fifth lead.
