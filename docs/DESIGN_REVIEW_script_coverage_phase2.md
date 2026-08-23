# Script Information Model, Phase 2: Coverage — Design Spec (v0.1 draft)

> Status: **draft, awaiting greenlight.** Nothing here is implemented. Numbers
> are shapes, not final tuning. **OPEN** marks a decision deliberately left to
> the greenlight conversation.

---

## 0. Where this sits

The agreed sequence for making script quality a judgment rather than a readout:

| Phase | Name | Status |
| --- | --- | --- |
| — | Price scripts off their earning ceiling; complexity out of the quality star; role demands read the script | **landed** (PR #170) |
| 1 | Script generation carries real, evaluable content | not started |
| **2** | **Coverage — quality becomes somebody's opinion** | **this document** |
| 3 | Multiple signal sources (writer track record, rival interest, attachments) + writer deals (§7.1) | not started |
| 4 | Talent pushback in prep drives targeted rewrites | not started |
| 5 | Inbound pitches — creatives come to you with projects | not started |

Phase 2 is playable and worth shipping **without** Phase 1. Phase 1 is what
makes the player's *own* read meaningful; Phase 2 is what makes anyone else's
read meaningful. They're independent, and 2 is the smaller change.

---

## 1. Problem

A screenplay shows the player `dialogue`, `characters`, `structure` and
`originality` as star ratings read straight off the stored stat. That is
perfect information about the one thing nobody in the industry has perfect
information about. It makes acquisition arithmetic: read the number, compare to
the price, buy or don't. There is no judgment, no risk, and no way to be *good
at* development — which is the fantasy the department is supposed to sell.

In life, an executive has coverage from a reader with their own taste, their own
read, comps, a writer's track record, and who else is circling. Great scripts
get passed on constantly. That uncertainty is the job.

**The trap to avoid:** simply hiding the numbers replaces solved arithmetic with
a coin flip, which is worse. The stars must be *replaced with a different
information game*, not deleted.

## 2. Design goals

1. **The player never sees true craft before release** — but always sees enough
   to form a view.
2. **Every quality signal is attributable to someone**, and that someone can be
   wrong in a way the player can learn.
3. **Bias is systematic and stable; noise is per-read.** Learning that "Marla
   over-rates dialogue" and correcting for it is the skill the layer sells.
4. **Facts stay facts.** Anything the player needs to plan a budget stays fully
   visible. Only the *is it good* question fogs.
5. **The player can always afford one read**, from day one, on the tightest
   difficulty.
6. **Post-release, the truth comes out**, so the player can calibrate.

## 3. What hides and what stays

**Hidden pre-release (judgment):**
- `originality`, `structure`, `characters`, `dialogue`
- `hook`, `emotionalPremise`, `franchisePotential`
- The Writing/Concept star groups derived from them
- `describeConceptStrength` — "A solid concept — a genuinely original premise."
  is a quality claim and must become coverage-sourced

**Stays visible (fact):** genre, archetype, story type, setting, scale, tone
profile, production requirements, complexity prose, cast list and role demands,
required leads/supporting, intended audience, synopsis, screenplay cost.

The line is *judgment vs. production fact*. PR #170 already drew exactly this
line once, when Complexity moved out of the quality star and into the production
section — this phase generalises it.

**OPEN:** the tone profile is arguably a judgment too (someone had to read it to
know it's a comedy). Proposal: keep it visible. It's how the script is
*positioned*, which a logline and a genre tag genuinely do convey.

## 4. Two leaks that must close with it

Fogging the stars is pointless if the true values remain recoverable elsewhere.

### 4.1 Price is currently an oracle

`estimateScriptCost` reads true craft. A player who knows the formula can invert
the displayed price and recover it exactly.

**Fix, and it is a feature:** price is set by the market's *read*, not by truth.
Introduce a synthetic **market consensus reader** — moderate acuity, no taste
bias — and price off its perceived craft. Price stays a genuinely useful signal
(expensive scripts are usually good) without being an oracle, and it explains
why bidding wars happen over scripts that turn out mediocre. This falls directly
out of what PR #170 built: price becomes *market's estimate of ceiling ×
market's read of craft*.

### 4.2 `describeCommercialAppeal` partially leaks

It reads `structure` and `characters` through `hookStrength`. Proposal: reframe
it as your **distribution people's estimate** — itself an opinion, from a
different department with a different bias. Cheap to do, and it adds a second
voice for free.

## 5. Core model

A new pure engine module, `engine/coverage.ts`.

```ts
type QualityAxis = 'originality' | 'structure' | 'characters' | 'dialogue';

interface ReaderProfile {
  acuity: number;                                  // 0-100, inverse of noise
  taste: Record<QualityAxis, number>;              // systematic bias, e.g. +12 dialogue
  genreAffinity: Partial<Record<Genre, number>>;   // reads their own genre sharper
  archetypeBias: Partial<Record<ScriptArchetype, number>>; // loves prestige, distrusts spectacle
}

interface Coverage {
  scriptId: string;
  readerId: string;
  read: Record<QualityAxis, number>;   // what this reader PERCEIVED, 1-100
  verdict: 'Pass' | 'Consider' | 'Recommend';
  notes: string[];                     // prose, from their own read
  writtenOnDay: number;
}
```

Derivation is pure and total:

```
perceived(axis) = clamp(true(axis) + taste[axis] + archetypeBias + noise(acuity, seed), 1, 100)
```

### 5.1 Determinism — the important detail

Noise is seeded on `hash(scriptId + readerId + axis)` via the existing
`hashUnit` helper, **not** drawn from the shared `RandomFn` stream. Three
consequences, all wanted:

- Re-opening a panel can't reroll a read.
- A *different* reader on the same script is an independent draw.
- It never advances the rng stream, so seeded slates stay reproducible — the
  same discipline `castingGenderForCharacter` already follows.

### 5.2 Verdict

`Pass` / `Consider` / `Recommend` from the reader's own mean perceived craft,
with their archetype bias applied. This is the headline, as it is on real
coverage — the axis stars are the supporting detail.

## 6. The Story Department (facility)

Coverage needs a home. Readers parked loose on the staffing board work, but they
give the player nothing to *invest in* — and reading capacity, which is the real
scarcity this phase creates (§6.3), has nowhere to be upgraded from.

So Phase 2 ships a third studio facility: the **Story Department**.

### 6.1 Why this is realistic, and why it is not a writers room

The instinct to be careful here is right, but it applies to the wrong thing.

**A writers *room* would be an anachronism.** That is a television institution.
`01` §3.3 notes personal-exclusivity deals are "the norm in **television**, where
a showrunner's time is the asset." Film studios have never run rooms, and the
spec deliberately does not add one.

**A story *department* is one of the oldest departments in the business, and its
readers are staff.** From `02` §5.1:

| Reader | Where | Pay | Volume |
| --- | --- | --- | --- |
| **Staff story analyst** | Major studios and networks; in the US organised under an IATSE story analysts local | Salaried, with a weekly script quota | 8–15 scripts/week |
| Freelance reader | Studios, prodcos, financiers, festivals | $40–75 per script | As many as they can stand |
| Assistant / intern | Every agency and prodco in town | Salary or nothing | Weekends and evenings |

Salaried, quota'd, unionised. Housing that in a facility is not a liberty; it is
a payroll department the industry has run for a century.

`02` §5.1 also makes the third row worth modelling eventually: "a very large
share of the industry's first-pass judgement is exercised by 24-year-olds reading
at 11pm after a twelve-hour desk day." That is the cheapest, worst-acuity reader
tier, and it is the *default* one a studio with no department is stuck with.

**Writers themselves stay free agents** — see §7.1, where the real instruments
for tying a writer to a studio live. Nobody in this facility writes anything.

### 6.2 Shape — the established facility pattern

Identical in shape to the two facilities that already exist, so this is a well-
worn path rather than a new concept:

```ts
interface StoryDepartment {
  tier: number;              // reading capacity — data/storyDepartment.ts
  sourcingTier?: number;     // independent upgrade track (§6.3)
  analystIds: string[];      // hired analysts, by id; Person records live in the pool
}
// Studio.storyDepartment?: StoryDepartment | null   — absent/null == not unlocked
```

- `UNLOCK_STORY_DEPARTMENT`, `UPGRADE_STORY_DEPARTMENT`, `HIRE_STORY_ANALYST`
  reducer actions, mirroring `UNLOCK_PRODUCTION_OFFICE` / `UPGRADE_…` /
  the bench-hire action at `state/studioReducer.ts:1199+`.
- Tier → weekly coverage capacity, the way
  `data/producers.ts:OFFICE_BENCH_CAPACITY_BY_TIER` governs the producer bench.
- Presence == unlocked, via a milestone. Read defensively, no migration pass.

**OPEN:** unlock via milestone (as both existing facilities do) or purchasable
from day one? Proposal: **purchasable from day one at tier 1**, because §12's
first risk is a player fogged out of the market with no affordable signal. A
studio should never be *unable* to buy a read.

### 6.3 Three functions, in the order they should be built

1. **Reading capacity** (tier). Scripts covered per week. The binding constraint:
   you cannot read the whole market, so *what to spend a read on* becomes a real
   decision. Without a department you fall back to the assistant tier — one slow,
   low-acuity read at a time.
2. **Read quality.** Better analysts to hire onto the bench. Upgrades narrow
   noise; they **never** remove taste bias (§5). There is no reader who tells the
   truth, at any tier. Game-side, three populations mirroring `02` §5.1's:

   | Who | Acuity | Cost | Throughput |
   | --- | --- | --- | --- |
   | Assistant read (no department) | ~25 | free | one at a time, slow |
   | Freelance reader | ~40 | per-script fee | as many as you'll pay for |
   | Staff story analyst | ~55–80 by hire | salaried | a weekly quota, set by tier |

   The free assistant read is the floor that keeps a broke studio in the game
   (§12), and it is deliberately bad enough to be worth upgrading away from.
3. **Sourcing / access** (`sourcingTier`, the independent second track — exactly
   how `productionOffice.marketResearchTier` sits alongside its bench). `01` §3.4:
   a pod's real product is "*access to material before the market*." Higher
   sourcing means seeing the slate earlier than rivals do. **This is Phase 3
   content** — the track exists in the type from the start so it has somewhere to
   land, but ships inert.

### 6.4 Keeping it distinct from Market Research

The Production Office already sells information via `marketResearchTier`. Two
"buy information" facilities will blur unless the split is stated and held:

| | Question it answers | Bought from |
| --- | --- | --- |
| **Market Research** | Will an audience turn up for this? | Production Office |
| **Story Department** | Is the script any good? | Story Department |

Audience-side versus script-side. A coverage should never mention box office; a
market research report should never grade dialogue.

## 7. Multiple reads and triangulation

Commission a second opinion on the same script. The UI shows both, attributed
and side by side, **never averaged into a single truth**. Convergent reads read
as confidence; a split is information in itself.

Cap at 3 coverages per script — past that the UI gets noisy and the marginal
information is small.

### 7.1 Writers stay free agents — deals, not desks

For completeness, since the Story Department raises the question and the answer
shapes Phase 3: a studio genuinely *can* tie a writer to it, but through term
deals rather than employment. `01` §3.3 gives two real instruments:

| Instrument | What it buys | Cost |
| --- | --- | --- |
| **First-look** | *Submission* exclusivity — the writer still works elsewhere, but you see it first | Overhead, funded development |
| **Overall** | *Personal* exclusivity — "the principal cannot work for anyone else in the covered field for the term" | Materially more |

This is better than employment as a mechanic, because a deal has a term, a
price, an opportunity cost, and it **denies a writer to your rivals** — none of
which a salaried desk does. It is **Phase 3**, not this one; recorded here only
so the facility is not built assuming it will house writers.

## 8. UI

Reuse the existing star components wholesale. Same pixels, different epistemic
status:

```
MARLA CHEN · COVERAGE · Day 14                          RECOMMEND
  Writing   ★★★★☆        Concept   ★★★☆☆
  "Dialogue crackles. The second act sags badly."

No coverage yet — commission a read.   [ Story editor · 3 days · free ]
```

Unread scripts show the production facts and a call to action where the stars
were. That reframe alone — stars as *someone's opinion* rather than truth — is
most of the value of this phase for a fraction of the work.

Prose notes come from the reader's own `read`, so a biased reader writes biased
notes. This reuses the existing `scriptPresentation` prose machinery pointed at
`Coverage.read` instead of `Script`.

## 9. Post-release revelation

On release, the film detail modal shows the script's **true** values alongside
every coverage written about it. This is the learning loop and it is not
optional — without it, a flop is arbitrary rather than instructive.

After N films, surface a per-reader track record ("Marla: reads dialogue +11 hot
on average across 12 scripts"). **OPEN:** show the measured bias outright, or
only the hit rate? Proposal: hit rate, so the player still does the inference.

## 10. Rivals must play the same game

`engine/rivalStudios.ts` gets reader profiles too and buys on *perceived* value.

This is load-bearing. If rivals see truth and the player doesn't, the player
loses every good script by construction. With biased rivals, they sometimes
overpay for junk and pass on gems — which is what makes "a script being fought
over" a real but fallible signal, and creates mistakes the player can exploit.

## 11. Files

**New:** `engine/coverage.ts`, `engine/coveragePresentation.ts`,
`engine/storyDepartment.ts`, `data/readers.ts`, `data/storyDepartment.ts`,
`components/StoryDepartmentCard.tsx` (modelled on `ProductionOfficeCard.tsx`),
plus tests.

**Changed:** `types/index.ts` (Coverage, ReaderProfile, StoryDepartment,
`Studio.storyDepartment`, `Studio.coverages`); `state/studioReducer.ts`
(`COMMISSION_COVERAGE`, `UNLOCK_/UPGRADE_STORY_DEPARTMENT`,
`HIRE_STORY_ANALYST`); `state/gameState.ts`; `engine/scriptGenerator.ts` (price
off the market read); `engine/rivalStudios.ts`;
`components/common/ScriptDetails.tsx`, `FilmDetailModal.tsx`,
`AssetLibrary.tsx`, `OpportunityMarket.tsx`; `engine/conceptStrength.ts`
consumers. `SAVE_KEY` bump.

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| Fog + no affordable signal early = frustration | One in-house read free from day one, on every difficulty |
| Player ignores the script, buys on price | Price is itself a noisy read (§4.1), so it can't substitute for judgment |
| Feels arbitrary rather than uncertain | Post-release revelation (§9) is shipped in the same phase, not later |
| UI noise from many coverages | Cap at 3; verdict is the headline, axes are detail |
| Diagnostics and dev inspectors need truth | Unchanged — per CLAUDE.md they read raw numbers; only player surfaces fog |
| Story Department blurs with Market Research | The audience-side / script-side split in §6.4, held in both directions |
| A facility with nothing to do | Build the coverage engine first; the department is its home, not the layer itself (§15) |

## 13. Acceptance criteria

1. No true craft value is displayed on any player-facing surface pre-release.
2. The same reader on the same script returns an identical read; two readers
   return different ones.
3. A reader's systematic bias is recoverable from ~20 reads (diagnostic test).
4. Commissioning coverage does not perturb a seeded slate.
5. Post-release shows truth plus every coverage written.
6. A rival studio's acquisition decisions run off perceived, not true, value.
7. Price correlates with true craft but does not determine it.
8. A studio with no Story Department can still obtain coverage — slowly, at the
   worst acuity — and is never locked out of reading.
9. Department tier changes weekly coverage capacity and nothing else; analyst
   quality changes acuity and never removes taste bias.

## 14. Explicitly out of scope

Talent pushback in prep (Phase 4), targeted rewrites (Phase 4), inbound pitches
(Phase 5), improved script prose (Phase 1), and writer deals plus the sourcing
track (Phase 3, §6.3/§7.1 — `sourcingTier` ships inert). Rewrites keep working
exactly as they do today. **No writers room, in this phase or any later one.**

## 15. Build order

The facility is the wrapper, not the layer. Built first, it is a building with
nothing to do.

1. `engine/coverage.ts` — the perception model, pure, with its tests.
2. Price off the market read (§4.1) — closes the oracle before the fog goes up.
3. Player surfaces read from `Coverage` instead of `Script` (§3, §8).
4. Story Department facility as coverage's home and upgrade path (§6).
5. Post-release revelation (§9).
6. Rivals onto perceived value (§10).

Steps 1–3 are the phase's spine; a slip in 4–6 is survivable, a slip in 2 is
not — it would ship the fog with the answer still printed on the price tag.
