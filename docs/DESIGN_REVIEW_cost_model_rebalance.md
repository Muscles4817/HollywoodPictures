# Design Review: Cost Model Rebalance — Why the Budget Doesn't Feel Real Yet

Status: **pure conceptual exercise - no code, no implementation.** Grounded
in `docs/COST_REPORT_film_production.md` (the current-state audit this
review starts from - every number below traces back to it) and
`docs/DESIGN.md` §6/§7. Nothing here is decided until it's built, validated
the way every other formula in this codebase is (diagnostic sweeps before
locking constants - see DESIGN.md 5.34's own precedent), and folded into
DESIGN.md.

---

## TL;DR

- **The three big-ticket dials (VFX, Sets, Practical Effects) are capped an
  order of magnitude too low, and that's the single biggest reason the
  budget doesn't scale to blockbuster.** VFX tops out at £12M when real
  VFX-heavy tentpoles routinely spend £80-150M+ on VFX alone. Proposed:
  VFX → £150M ceiling, Sets → £40M, Practical → £25M (§2).
- **You're not missing cost *categories* so much as missing *wiring*.**
  `Script.productionRequirements` (extras/locations/stunts/vfx/crowdWork/
  periodSetting/...) already exists, is already generated coherently from
  story type + scale + setting, and is used **for exactly one thing today:
  flavor-text tags** (`engine/scriptPresentation.ts`). Zero cost formula
  reads it. Same story for `environmentStrategy` - the adapter layer
  itself already says outright *"Environment Strategy has no cost/risk
  consequence at all in today's formulas"* (`productionChoicesAdapter.ts:14-19`).
  This is the real gap: the signals for crew/location/travel/equipment
  cost already exist in the data model, unused (§3).
- **Every one of your six missing categories (crew, locations, travel,
  equipment, insurance, post/music) should be derived, not exposed** -
  and every one of them has an honest, already-existing signal to derive
  from. None of them need a new slider. §3 gives each one a concrete input
  signal and rough shape.
- **Insurance has the cleanest hook in the whole review: it should just
  read `StaticProductionRisk`, which already exists and already computes
  exactly the right blend** (safety risk, technical complexity, budget
  risk) for a completely different purpose (on-set event odds). One new
  consumer of an existing computed value - the same "compute once, wire in
  a second consumer later" pattern this codebase already uses for
  `commercialProfile.crossoverPotential` and `Studio.prestige`.
- **Talent's ceiling is fine as a per-person number; it's fine to leave
  mostly alone.** Your real gap there isn't the named-role ceiling, it's
  that the game only ever bills 6-9 named people for a production that, in
  reality, employs hundreds. That's not a talent problem, it's the missing
  Crew Cost line (§3.1).
- **Overall distribution verdict: currently talent + the three production
  dials are the entire below-the-line budget, and VFX/Sets/Practical are
  starved relative to marketing (max production dials £20M vs max
  marketing £180M - a 9:1 ratio real blockbuster economics doesn't
  support). After the changes below, a maxed-out film's production side
  and marketing side land within the same order of magnitude, which is
  what "P&A roughly matches or trails the production budget for a wide
  release" actually looks like** (§6 has the worked comparison).
- **Don't touch marketing (agreed) or script acquisition (agreed).** One
  thing worth fixing *while you're in this code* even though it's not on
  your list: the daily contingency burn is the only literally unbounded
  cost lever in the game (COST_REPORT §10.1) - if believable maximums
  matter to you here, that's the other place a ceiling is worth adding
  (§7).

---

## §1. Real-world reference points this review is grounded in

Rough, well-known industry rules of thumb (these vary considerably by film,
treat as *directional*, not precise):

| Budget tier | Total production budget | VFX (if VFX-heavy) | Below-the-line (crew/sets/practical/locations/travel/equipment/insurance) | Post (editorial/sound/music/DI) | P&A / marketing |
|---|---|---|---|---|---|
| Indie | $1M-$20M | usually minimal | ~50-65% of budget | ~8-12% | often £0 (festival) up to ~30-50% of budget for a real theatrical push |
| Mid-budget | $20M-$80M | $5M-$30M if present | ~55-65% | ~10-15% | roughly 50-100% of production budget |
| Tentpole/blockbuster | $150M-$300M+ | **$80M-$180M+** | ~50-60% | ~10-15% | often *comparable to or exceeding* the production budget |

Two numbers worth anchoring on specifically because the brief called them
out: modern VFX-heavy tentpoles (Marvel, *Avatar*, *Dune*) routinely spend
**£80-180M on VFX alone** - multiple times this game's entire current
production-dial ceiling (£20.1M for Set+Practical+VFX *combined*, at
runtime multiplier). And P&A for a major wide release is commonly **on the
same order as the production budget itself**, sometimes more - not a small
fraction of it.

---

## §2. Range changes - the three under-costed dials, and talent

All four are `Range` constants in `src/data/production.ts`, sampled via
`logAmount(t, range)` - a log-scale slider, so raising a ceiling costs
nothing in resolution at the cheap end (log-scale means the bottom of the
range keeps exactly the same slider precision no matter how high the top
goes). That makes these genuinely free lifts, not a redesign.

| Dial | Current | Proposed | Rationale |
|---|---|---|---|
| `VFX_RANGE` | £5,000 - £12,000,000 | £10,000 - **£150,000,000** | Matches real tentpole VFX spend and (deliberately) matches `MARKETING_SPEND_RANGE`'s own £150M ceiling and 15,000x span - VFX is a genuine peer to marketing as a blockbuster cost center now, not a rounding error next to it. |
| `SET_QUALITY_RANGE` | £20,000 - £3,000,000 | £15,000 - **£40,000,000** | A real backlot build (full streets, standing sets, large practical builds) runs tens of millions. £3M doesn't cover one real large set piece, let alone a whole show. |
| `PRACTICAL_EFFECTS_RANGE` | £10,000 - £2,500,000 | £10,000 - **£25,000,000** | Large stunt teams, vehicle work, creature/prosthetic builds, miniatures, controlled pyrotechnics - real productions in this space (a *Mad Max: Fury Road*-shaped film) spend well into eight figures. |
| `CONTINGENCY_RANGE` | £100,000 - £40,000,000 | **Unchanged** in £ terms | See §2.1 - its *role* narrows, not its ceiling. |
| Director / Lead Actor salary ceiling | £12M / £15M | Optional: £20M / £25M | Secondary, not load-bearing. Real top-quote stars/directors can exceed £15-20M pre-backend. Your instinct that this one's "reasonable" is basically right - only worth touching if you want headline star salaries to occasionally read as genuinely eye-watering; skip it if you'd rather focus effort on §3. |

At the runtime-multiplier ceiling (1.15x), the three production dials alone
go from **£20.1M today to ~£247M** at absolute max - which sounds enormous
until you remember absolute max means *every one of three independent
log-scale dials simultaneously at its own individual ceiling*, the same
kind of tail-case number `COST_REPORT §8`'s own "£354.9M bounded max"
already is for the *existing* model. A realistic top-of-the-range tentpole
(VFX pushed hard, Sets and Practical at a real-but-not-maxed level) lands
much more sensibly - see the worked example in §6.

### §2.1 Contingency's role needs to narrow, not grow

Right now Contingency is quietly the closest thing to a crew/equipment/
insurance placeholder - its own t=0 flavor text literally says *"bare-
minimum crew, equipment and insurance"* (`data/production.ts:22`), but
none of that is actually costed; it's all folded into one abstract
"quality + risk offset" number. Once crew/equipment/insurance become real
derived costs (§3), Contingency should be **rewritten to mean only what it
already mechanically does** - a safety-margin/risk-buffer reserve that
offsets `safetyRisk`/`technicalComplexity` in `computeStaticProductionRisk`
and gets burned daily during the shoot. Proposed anchor rewrite:

- t=0: *"No safety margin - if anything goes wrong elsewhere, there's
  nothing to absorb it."*
- t=1: *"A deep contingency reserve - real insulation against an ambitious
  effects or stunt choice elsewhere becoming a liability."*

No number changes here, just stops double-booking one dial as both "risk
buffer" and "the entire uncosted below-the-line budget."

---

## §3. What should be derived, and from what

Every category below already has an honest signal sitting in the data
model. None of these need a new player-facing slider - that's not a
simplification for this review's sake, it's genuinely already there.

### §3.1 Crew Cost (the big one - "hundreds of people not currently modeled")

**Signal**: `recommendedDays` (`engine/production.ts:computeRecommendedShootDays`,
already the shoot-length estimate every other formula uses) x
`overallSpendT(productionChoices)` (`engine/productionDials.ts:68-70`,
already exists, already means "how ambitious is this production given
what the player already chose to spend" - it's the average `t` position
across all four existing dials).

```
crewDailyRate = logAmount(overallSpendT, CREW_DAILY_RATE_RANGE)   // e.g. £3,000/day - £150,000/day
crewCost = round(crewDailyRate * recommendedDays)
```

This is deliberately **not** a live daily burn like Contingency - compute
it once, at greenlight, from the `recommendedDays` estimate already known
then (same timing every other production-budget line uses), not a second
uncapped-burn mechanic. A lean 18-day indie shoot at low ambition costs
roughly £54,000 in crew; a 70-day, maximally ambitious shoot costs upward
of £10M - genuinely enormous, matching what a real union crew payroll on a
tentpole actually runs.

Why `overallSpendT` and not `productionRequirements` directly: crew size
scales primarily with *how much production value the shoot is already
buying* (bigger sets, more VFX plates, more practical rigs all mean more
hands), which is exactly what the four existing dials already express in
aggregate. `productionRequirements` (extras/crowdWork specifically) is a
good secondary multiplier - see below.

### §3.2 Location Cost (fees, permits, police, security)

**Signal**: `environmentStrategy.location` (the Distribution weight,
`types/index.ts:EnvironmentMethodKey`) x `environmentAmbition` x
`script.productionRequirements.locations`.

```
locationCost = round(LOCATION_COST_CEILING * environmentStrategy.location * environmentAmbition * productionRequirements.locations)
```

A pure-studio or pure-digital production (`environmentStrategy.location`
near 0) pays close to nothing here regardless of ambition - correct, there's
nothing to permit. A location-heavy Epic-scale film
(`productionRequirements.locations` floors high for Epic scale, per
`data/scale.ts:locationsFloor`) at high ambition pays real money. This is
the fix for the adapter's own documented gap: *"Environment Strategy has no
cost/risk consequence at all in today's formulas"* - this gives it one.

### §3.3 Travel & Accommodation

**Signal**: cast size (`talent.length`, or more precisely headcount from
`requiredLeads + requiredSupporting` + mandatory crew) + the Crew Cost
scale from §3.1, x `environmentStrategy.location` weight, x
`recommendedDays`.

```
travelCost = round(TRAVEL_DAILY_RATE_PER_PERSON * estimatedHeadcount * environmentStrategy.location * recommendedDays)
```

Moving a contained, studio-bound production costs almost nothing to
shelter and feed; moving hundreds of people to real locations for months
costs a great deal. `estimatedHeadcount` doesn't need a new number - it can
read the same inputs Crew Cost's rate already implies (or a coarse proxy
like `castSize + BASE_CREW_HEADCOUNT * overallSpendT`).

### §3.4 Equipment Rental

**Signal**: `overallSpendT` again x `recommendedDays`.

```
equipmentCost = round(logAmount(overallSpendT, EQUIPMENT_RANGE) * (recommendedDays / BASELINE_DAYS))
```

Cameras, lighting, cranes, grip, generators, specialist rigs - rental cost
scales with both how elaborate the shoot is (ambition) and how long the
gear is booked for (shoot length). No new signal needed beyond what §3.1
already reads.

### §3.5 Insurance - the cleanest derivation in this whole review

**Signal**: the running production budget total, x a risk-scaled
percentage read straight from `StaticProductionRisk`
(`engine/production.ts:computeStaticProductionRisk`) - which **already
computes** `safetyRisk` (practical-effects ambition vs. contingency
margin) and `technicalComplexity` (VFX ambition + script complexity vs.
contingency margin), i.e. **exactly** "production risk, stunt/VFX
intensity" as specified in the brief, computed for an entirely unrelated
purpose (on-set event odds) and sitting there unused for this one.

```
riskPremium = (safetyRisk + technicalComplexity) / 2 / 100   // 0-1
insuranceRate = clamp(BASE_RATE + riskPremium * RISK_RATE_SPREAD, 0.01, 0.05)   // ~1%-5%, real-world range
insuranceCost = round(productionBudgetSoFar * insuranceRate)
```

This is the one item in this review that isn't really a new formula so
much as a new *caller* of one that already exists. Worth building first -
it's the cheapest win here and it's genuinely "derive from existing
systems," not "build a new system that happens to feel derived."

### §3.6 Post-Production: Sound, Music, and Finishing

This is the biggest structural omission (agreed with the brief) - today
`editStyle`/`musicFocus`/`finalCutFocus` are **entirely free**, only Test
Screening has a real cost. Proposed shape:

- **Keep the three existing choices exactly as the exposed creative
  decisions** - don't add new sliders for editing/color/sound/mixing
  individually. `editStyle`, `musicFocus`, `finalCutFocus` already *are*
  "which of these ways are we doing this," the same category of decision
  Environment/Effects Strategy already model.
- **Give each of them a real cost consequence for the first time**, summed
  into one new "Post-Production" line on the results screen (not three
  separate readouts):
  - `musicFocus` (Minimal/Standard/Heavy) drives derived **score/music
    production cost** (orchestra size, recording sessions, studio hire,
    mixing) - directly answers the brief's point 11. This is the single
    highest-leverage change in this section: the dial already exists,
    already means the right thing, and currently costs the player nothing
    to max out.
  - `editStyle` (Commercial/Artistic/Balanced) and overall ambition
    (`overallSpendT`, `script.scale`) drive derived **picture finishing**
    cost (editing labor, color/DI, mastering, rendering, deliverables) -
    a bigger, more VFX-heavy film simply has more footage and more
    finishing passes to pay for, independent of which style is chosen.
  - `productionRequirements` (`stunts`, `crowdWork`, `vfx`) drives derived
    **sound cost** (ADR, Foley, sound design, mixing) - a crowd-heavy war
    epic needs dramatically more sound design work than a two-hander
    drama, and the signal for that already exists per-script.
- **Localization/subtitling/dubbing/international deliverables:
  explicitly defer.** There's no honest hook for this yet - box office is
  a single flat `STUDIO_BOX_OFFICE_SHARE` split with no per-territory
  model, so a localization cost would have no corresponding revenue
  mechanic to pair against. Same reasoning DESIGN.md's own Known
  Limitations already applies to the cut "Creative Freedom" risk
  dimension: don't cost a system that doesn't exist yet. Revisit if/when
  international distribution ever becomes its own mechanic.

Rough illustrative ceiling: a minimal indie (Minimal music, small scale)
should land around £50,000-£150,000 total post-production; a maximal
tentpole (Heavy/orchestral score, huge VFX-driven finishing and sound
load) should be able to reach **£20-25M** - genuinely comparable to a real
film's post budget, not the current £0-£1M range that's entirely test-
screening.

---

## §4. Production Design's evolution path (Sets → Sets/Props/Costumes)

Agreed this isn't urgent, and agreed it shouldn't become three raw currency
sliders even later - that would be exactly the "dozens of separate
sliders" outcome the brief is trying to avoid. If/when this splits, it
should follow the **same pattern Environment/Effects Strategy already
use**: one `NormalizedScalar` ("Production Design Ambition," replacing
`environmentAmbition`'s current sole claim on `setQualityAmount`) plus one
`Distribution<'sets' | 'props' | 'costumes'>` lean - one exposed decision
(the split) and one exposed intensity (the ambition), not three
independent dials. That's structurally identical to how Effects Strategy
already divides `effectsAmbition` between practical and digital.

**A smaller, genuinely low-effort near-term step** worth doing well before
the full split: `script.productionRequirements.periodSetting` is a boolean
that already exists and already means "costume/production design has to
recreate an era" (its own doc comment says so), and nothing reads it for
cost today. A simple `periodSetting` surcharge on `setQualityAmount`'s
effective cost (a flat multiplier, e.g. 1.3-1.5x, applied only for period
scripts) captures a real, well-known cost driver (period pieces are
expensive) with zero new UI and zero new formulas beyond one conditional
multiply - a reasonable stepping stone before committing to the full
three-way split.

---

## §5. Post-production summary table (what's explicit vs. derived vs. deferred)

| Item | Treatment |
|---|---|
| Edit Style, Music Focus, Final Cut Focus, Test Screening | Explicit (already exist) - keep as the exposed decisions |
| Editing labor, color grading/DI, mastering, rendering, deliverables | Derived - "Picture Finishing," from `editStyle` + `overallSpendT` + `script.scale` |
| ADR, Foley, sound design, sound mixing | Derived - "Sound," from `productionRequirements` (stunts/crowdWork/vfx) |
| Orchestra, recording sessions, studio hire, musicians, mixing | Derived - "Music," from `musicFocus` + `overallSpendT` |
| Localization, subtitling, dubbing, international deliverables | **Deferred** - no international-distribution mechanic exists yet to pair it against |

---

## §6. Does the overall distribution now resemble real filmmaking?

Worked illustrative example - **not** a diagnostic-verified simulation
output (that's follow-up implementation work, same validation process
every other formula in this codebase goes through before its constants are
locked), just directional math to sanity-check the shape of the proposal.
"Realistic top-of-range tentpole" below means the production dials pushed
hard but not simultaneously maxed - the same kind of representative
scenario `docs/COST_REPORT_film_production.md` and DESIGN.md's own
scenario tables already use elsewhere, rather than the literal all-dials-
at-ceiling tail case.

| Component | Today (max, bounded) | Proposed (realistic top-of-range tentpole) | Real-world tentpole (~$250M) as % |
|---|---|---|---|
| Talent | £59.7M | ~£70M (modest ceiling bump) | ~20-25% typical |
| VFX + Sets + Practical | £20.1M | ~£150M (VFX-led, not all three maxed) | ~45-55% typical below-the-line incl. VFX |
| Crew / Location / Travel / Equipment (new) | £0 | ~£35M | (folded into "below-the-line" above in real breakdowns) |
| Insurance (new) | £0 | ~£8M (risk-scaled %) | ~2-3% typical |
| Contingency | up to £40M | up to £40M (unchanged, narrowed role) | — |
| Post-production (new + test screening) | £1M | ~£20M | ~10-15% typical |
| **Production total** | **~£120.8M** | **~£323M** | — |
| Marketing | up to £180M | up to £180M (unchanged) | often comparable to or above production budget |
| **Ratio, production : marketing** | **~1 : 1.5** (already directionally okay, but both sides are too small vs. real tentpoles) | **~1.8 : 1** | real wide releases: often close to 1:1 |

**Verdict**: today's ratio between production and marketing isn't
*wildly* wrong at the aggregate level - the real problem is both sides sit
roughly an order of magnitude below where a genuine blockbuster lives, and
the production side is missing entire categories (crew/location/travel/
equipment/insurance/real post) that real budgets spend 50-60% of their
money on. Raising VFX/Sets/Practical and adding the six derived categories
closes that gap without moving marketing at all, and without adding a
single new slider to the UI.

---

## §7. One related issue worth fixing while you're in this code (not on your list, flagging anyway)

`COST_REPORT §10.1`: the daily contingency burn is **the only literally
unbounded cost lever in the game** - shooting past `recommendedDays` keeps
burning at the same daily rate indefinitely, with no ceiling, by explicit
existing design comment. Every other lever in this review (including the
new derived ones proposed above) is a bounded range. If "believable
maximum budget" matters to you as a concept - and this whole review is
about making budgets feel believable across the range - this is the one
place where "maximum" currently means "however long the player is willing
to keep clicking Advance Day," not a real number. Worth a cap (e.g., burn
stops accruing past some multiple of `recommendedDays`, say 2-3x) as a
small, separate follow-up - flagged here because it's adjacent to this
review's whole subject, not because it's part of the brief.

---

## §8. Suggested phasing, if this review is approved

Roughly cheapest-and-most-isolated first:

1. **Range constants only** (§2): VFX/Sets/Practical ceilings, Contingency
   flavor-text rewrite. Pure `data/production.ts` edits, zero engine
   changes, immediately playable.
2. **Insurance** (§3.5): the cleanest derivation - one new function reading
   an already-computed `StaticProductionRisk`, one new line in
   `computeReleaseResults`'s cost sum.
3. **Music cost from `musicFocus`** (§3.6, one slice of post-production):
   highest-leverage single change in the post-production section - an
   existing free dial gets real teeth.
4. **Crew / Location / Travel / Equipment** (§3.1-§3.4): the bulk of the
   new work - four new pure functions, all reading signals that already
   exist (`overallSpendT`, `environmentStrategy`, `productionRequirements`,
   `recommendedDays`), summed into one new "Below-the-Line & Logistics"
   line on the results screen.
5. **Remaining post-production (picture finishing, sound)** (§3.6): rounds
   out the post-production line once music's already proven the pattern.
6. **Production Design split** (§4): explicitly a *separate*, later
   milestone, not part of this rebalance - flagged for completeness only.

Each of 2-5 needs the same diagnostic-sweep validation this codebase
already does before locking any formula's constants (sample real inputs
across indie/mid/blockbuster scenarios, check the resulting totals land
where §6's table expects) - not something to guess-and-ship.
