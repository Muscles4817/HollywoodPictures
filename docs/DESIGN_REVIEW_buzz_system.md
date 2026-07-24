# Design Review: The Buzz System — audit, feasibility study & migration path

**Status:** Design review only. No engine behaviour is changed by this document.
**Scope:** `engine/scoring.ts:computeBuzzScore`, its assembly in
`engine/releaseFilm.ts`, and every downstream consumer of `buzzScore`.
**Prompted by:** "It feels far too easy for films to reach extremely high Buzz;
100 Buzz should be extraordinarily rare and represent a genuine cultural event."

This review answers the brief's questions in order: what Buzz *is* today, where
it succeeds and fails, whether the proposed Awareness / Anticipation /
Conversation model is genuinely better, a recommended roadmap, and a testing
strategy. It deliberately proposes **no** code changes beyond one tiny,
independent bug note (§10), which is *described, not applied*.

---

## 0. Executive summary — the one thing to read

The headline concern ("big-budget films hit 100 Buzz too easily") is **true**,
but the more important finding is that it matters **less mechanically than it
looks**, and for a reason that reframes the whole redesign:

> **Buzz is no longer the box-office engine the UI implies it is.** The audience
> simulation was refactored (DESIGN.md "Milestone 11") to drive opening weekend
> from a *separate* Awareness pipeline (marketing reach + cast fame, gated by
> studio-reputation-driven marketing efficiency) and an Interest pipeline
> (script concept). `buzzScore`'s **only** remaining mechanical lever is a
> linear ×1.0–1.5 "urgency" multiplier on conversion pacing
> (`audienceSimulationInputs.ts:558`), plus a 0.25 weight in IP recognition and
> a 0.20 weight in sequel-viability carryover. Everything else it touches is
> cosmetic (a raw score bar, a 3-bucket narrative tier, a sort key).

So there are really **two problems wearing one coat**:

1. **A legibility problem (large).** Buzz is the game's most prominent
   pre-release number — shown as a raw `Buzz Score: 100` bar
   (`FilmDetailModal.tsx:155`, `ReleaseResults.tsx:56`) — and it saturates at
   100 for ordinary films. The number visibly lies about what it claims to mean.
2. **A mechanics problem (smaller than feared).** Because Buzz barely drives
   money today, the *gameplay* damage of it hitting 100 is modest. But that is
   itself a symptom: the concept the player is told to care about is
   mechanically hollow.

The proposed multi-concept model is **worth pursuing**, but not as three new
player-facing meters. The most valuable idea in the brief is not "three
concepts" — it is the sentence *"enormous marketing spend alone cannot create
Endgame-level anticipation."* That single requirement is **impossible to express
in the current additive formula** and is the real justification for an
architectural change (§5). The rest is tuning.

---

## 1. How Buzz is calculated today (exact)

### 1.1 The core formula

`engine/scoring.ts:527-553`:

```
buzz = clamp(
    10                                    // base
  + (fameAvg     - 50) * 0.5             // fameBuzz     ∈ [-25, +25]
  + (studioBrand - 50) * 0.4             // brandBuzz    ∈ [-20, +20]
  + marketingBuzzContribution(reach)     // marketingBuzz∈ [  0, +75]
  + eventsBuzz                           // Σ production-event buzzDeltas
  + musicBuzz                            // ∈ [-5, +8]
  + finalCutBuzz                         // ∈ [+2, +14]
  + (hookStrength - 50) * 0.2,           // scriptBuzz   ∈ [-10, +10]
  0, 100)
```

- `fameAvg` = mean of director + lead-actor `reputation.fame`
  (`scoring.ts:540-541`).
- `studioBrand` = `Studio.brand` (Brand Recognition, **not** Prestige —
  deliberate; `scoring.ts:522`).
- `reach` = audience-weighted effective marketing reach from the channel mix
  (`marketing.ts:effectiveMarketingReach`), lifted by the rollout-runway
  multiplier (`releaseFilm.ts:194`).
- `marketingBuzzContribution` reads a **log-scale** anchor curve
  (`release.ts:74-80`) over a £10k–£150M range.

### 1.2 The second layer

`computeBuzzScore` is clamped to [0,100] internally, and then
`releaseFilm.ts:226` adds three more terms and clamps **again**:

```
buzzScore = clamp(rawBuzz
                + producerEffects.flatBuzzDelta   // Executive producers, ~ +10 (up to ~+19.5 on a maxed bench)
                + pressTourBuzz                    // ∈ [-30, +30]
                + pressTourMomentBuzz,             // ∈ ~[-14, +13], rare
                0, 100)
```

(That double-clamp is a small latent bug — see §10.)

### 1.3 What each lever really costs (calibration reality)

| Lever | Realistic contribution | Source |
|---|---|---|
| Base | +10 always | `scoring.ts:552` |
| Marketing | **+52 at ~£13.6M**, +75 at £150M (log curve — first +15 costs ~£110k) | `release.ts:74-80` |
| Music (Heavy) | +8 | `postProduction.ts:21` |
| Final cut (Mystery) | +14 | `postProduction.ts:56` |
| Fame | ±25 in theory, but **handcrafted leads cap ~82–96 and top out at 100 only for a handful of directors**; procedural talent is far lower, so in practice ≈ +5…+12 | `handcraftedTalents.ts`, `scoring.ts:543` |
| Brand | ±20 in theory; a new studio starts at brand 3–24 and grows ~+16/blockbuster max, so early-game this is *negative* | `reputation.ts:44`, `DifficultyPicker.tsx` |
| Script hook | ±10 | `commercialProfile.ts:101` |
| Events | ≈ −20…+30 accumulated, ±15 per event, uncapped | `productionEvents.ts` |
| Press tour | ±30 (clamped) | `pressTour.ts:69`, `data/pressTour.ts:26` |
| Producers | +10 typical, ~+19.5 maxed bench (**uncapped**) | `producers.ts:139-153`, `data/producers.ts:42` |

**Summing the maxima gives ≈ 180–190 before the clamp** — roughly *half* of the
achievable contribution is thrown away against the 100 ceiling. The always-on
floor alone (base 10 + Heavy music 8 + Mystery final-cut 14 = **32**) plus a
single mid-size national campaign (£13.6M → +52) already reaches **84**, before
a single famous face, any brand, any press tour, or any producer. A modestly
famous cast and a recognised studio close the rest trivially. **This is the
mechanism behind the "too easy to hit 100" complaint, and it is confirmed
quantitatively.**

### 1.4 Where Buzz goes downstream

| Consumer | Effect | Shape |
|---|---|---|
| `computeConversionPacingBaseline` (`audienceSimulationInputs.ts:558`) | `urgency = 1 + 0.5·(buzz/100)` — the **only** money-affecting use | Linear ×1.0–1.5; 80→100 is only 1.40→1.50; saturates on Wide when window/genre bonus pushes the product to 1.0 |
| IP Recognition (`intellectualProperty.ts:29`) | `+0.25·buzz` when a film is promoted to IP | Linear |
| Sequel viability (`ipViability.ts:139`) | `+0.20·buzz` commercial carryover | Linear |
| `openingTier` (`storyBeats.ts:12`) | narrative flavour: <35 quiet, 35–64 modest, **≥65 "big"** | Step; **everything 65–100 is one bucket** |
| UI | raw `ScoreBar` value, `StatsPage` sort key | Display only |

The critical downstream fact: **Buzz's box-office effect is redistribution, not
amplification.** Higher Buzz drains the interested audience faster → bigger
opening, shorter legs — but *total* gross is essentially conserved on a Wide
release (the audience sim's own calibration note,
`audienceSimulationInputs.ts:444-459`). It does **not** feed initial awareness,
interest, crossover, availability, or word-of-mouth; those couplings were
deliberately removed to stop marketing being double-counted.

---

## 2. Where the current model succeeds

1. **The core conceptual split is right and already enforced.** Buzz =
   pre-release hype, cleanly separated from Critic/Audience reception. Marketing
   touches Buzz, never the audience's verdict (`DESIGN.md §5.2–5.3`). This is a
   genuinely good design spine and should be **kept**.
2. **"Only one of the three levers is for sale."** Fame and Brand are earned
   (casting history, past commercial performance), not bought. The *intent* that
   money alone shouldn't buy a phenomenon is already articulated — the formula
   just fails to deliver it (§3).
3. **Log-scale marketing is the correct curve shape** (diminishing returns on
   spend). The problem is the anchor *values*, not the curve type.
4. **The awareness/interest architecture the brief is groping toward already
   partly exists.** Milestone 11 split `ReleaseSimulationInputs` into documented
   **Awareness** (`marketingSpend`, `directorFame`, `leadFame`,
   `studioReputation`) and **Interest** (script traits) field groups
   (`audienceSimulationInputs.ts` interface doc). The player asking for
   "Awareness vs Anticipation" is rediscovering a distinction the engine already
   makes internally — which is strong evidence the direction is sound, and also
   a warning about redundancy (§5).
5. **The tuning discipline needed to fix this is already institutionalised.**
   Anchor tables in `data/`, opt-in diagnostic harnesses, and named regression
   matrices (`audienceSimulationRegressionMatrix.test.ts`) mean we can rebalance
   Buzz *honestly* rather than by feel.

---

## 3. Where the current model falls short

1. **It is a linear sum, so any one big term saturates it.** Marketing alone can
   reach +52…+75. This structurally *cannot* express "you need awareness AND
   anticipation AND conversation." A sum says "enough of any one thing is
   enough." This is the deepest flaw and the one real architectural limit.
2. **100 is common, not rare** (§1.3). The band the brief wants (100 = Endgame,
   ~1-in-a-generation) is unreachable as a *documented meaning* while an ordinary
   £13.6M campaign already lands at 84+.
3. **Roughly half the input range is wasted against the clamp**, and the
   second-layer additions (press tour ±30, producers ~+19.5) are stacked onto an
   *already-clamped* value (§10), so for any well-funded film they do nothing.
   Levers the player is invited to pull are frequently inert.
4. **The "Anticipation" pillar has no inputs at all.** There is **no
   franchise / existing-IP / previous-entry / audience-trust term anywhere in
   Buzz.** The IP system flows one way only (a released film → an IP;
   `intellectualProperty.ts`), never IP → a new film's hype. A sequel to a
   beloved, globally-recognised franchise generates *exactly* the same Buzz as an
   original with the same cast and spend. For a game whose reference point is
   *Avengers: Endgame* — pure franchise-culmination anticipation — this is the
   single most conspicuous gap, and it is **not fixable by tuning**.
5. **Buzz is displayed as a raw number**, which conflicts with the project's own
   presentation principle ("player-facing presentation is qualitative … never
   raw internal stat values", `CLAUDE.md`). A raw `100` with no named cause is
   exactly the kind of value that principle exists to avoid, and it is why the
   number "feels wrong" — the player has no interpretive frame for it.
6. **Narrative resolution collapses above 65.** `openingTier` gives one bucket
   for everything 65–100, so even the cosmetic payoff doesn't distinguish a
   strong release from a phenomenon.

### Diagnosis: tuning problem, or architecture problem?

**Both, cleanly separable:**

- *"Stop 100 happening so often / make the number legible"* → **tuning +
  presentation.** Rescale anchors, make the ceiling asymptotic instead of a hard
  clip, present qualitatively. Low-risk, Phase 1.
- *"Make 100 mean a genuine cultural event that marketing alone cannot buy, and
  let franchise anticipation matter"* → **architecture.** Requires (a) a
  non-additive combine so no single lever maxes it, and (b) new Anticipation
  inputs (franchise/IP history). Phase 2.

The current architecture is **not fundamentally unsound** — the pre-release /
reception split is good and worth preserving — but the **combine function and
the missing Anticipation channel are genuine architectural limits**, not just
stale constants.

---

## 4. The proposed model (Awareness / Anticipation / Conversation), examined honestly

The brief proposes Buzz emerge from the *interaction* of three concepts rather
than a sum. Taking each claim seriously:

**What's genuinely right:**

- *"Marketing spend alone cannot create Endgame-level anticipation."* Correct,
  and the current formula violates it. This demands a **multiplicative / gated**
  combine where a pillar near zero caps the whole. A geometric mean or a
  weakest-link term does this; a sum cannot.
- *"A fantastic film nobody knows exists can't generate maximum Buzz."* Also
  correct and also un-expressible in a sum (a huge Interest term would just add
  in). The engine *already* enforces this on the awareness side (obscure cast +
  low spend ⇒ low initial awareness), which is more evidence the interaction
  model matches how the sim already behaves.
- Awareness and Anticipation are clean, intuitive, and map onto levers the
  player already controls (money+stars vs concept+franchise+trust).

**What to be sceptical of:**

- **"Conversation" is the weakest of the three.** Its listed inputs (trailer
  reactions, memes, leaks, awards, controversy, social discussion) overlap
  heavily with both other pillars and with systems that already exist
  (press-tour moments, production-event leaks, awards). As an *independent
  third meter* it risks double-counting. It is better modelled as a **volatility
  / swing modifier** on top of Awareness×Anticipation than as a co-equal pillar.
- **Three new player-facing bars would be a mistake.** The game already shows
  fame, Brand, Prestige, Marketability, and Buzz. Adding Awareness +
  Anticipation + Conversation bars on top invites redundancy and analysis
  paralysis, and collides with the qualitative-presentation principle. The
  concepts should live **inside** the computation and surface as **named
  qualitative drivers** ("Held back by no franchise history"), not as three more
  numbers.
- **Balancing gets modestly harder, but the interaction model is actually
  *easier* for the specific "ceiling" question.** A geometric mean has a natural,
  provable ceiling behaviour ("max only when all pillars are high") that a sum's
  clamp fakes badly. The existing anchor/diagnostic tooling absorbs the extra
  complexity.

**Verdict:** The direction is **genuinely better**, but the win comes almost
entirely from **(a) a non-additive combine** and **(b) adding the missing
Anticipation inputs** — *not* from exposing three concepts to the player.
Recommended reframing:

> Keep **Buzz** as the single headline 0–100 index. Compute it from **two
> internal sub-scores, Awareness and Anticipation, combined multiplicatively**,
> with **Conversation as a bounded volatility modifier**. Surface the sub-scores
> only as qualitative "what drove this" explanations, never as raw bars.

This preserves everything good about today's model, delivers the brief's core
requirement, and avoids the redundancy/legibility traps.

---

## 5. Recommended target model (sketch, for discussion — not a spec)

A concrete shape to argue about, chosen to satisfy "marketing alone can't reach
100" by construction:

```
Awareness   ∈ [0,100]  ← marketing reach (log), cast fame, studio Brand, trailer/rollout
Anticipation∈ [0,100]  ← concept/hook strength, franchise-IP recognition & goodwill,
                          previous-entry track record, director/cast draw, audience trust
Conversation∈ [-1,+1]  ← press-tour moments, event leaks, controversy, awards heat (bounded)

coreBuzz = 100 * ( (Awareness/100)^wA * (Anticipation/100)^wA' )   // geometric — a low pillar caps the whole
Buzz     = clamp( coreBuzz * (1 + k*Conversation), 0, 100 )        // soft/asymptotic top end
```

Key properties this must have (these become tests, §8):

- **No single pillar maxes it.** Awareness 100 with Anticipation 40 must land
  well short of 100 (target ~mid-70s at most).
- **100 requires everything.** Only Awareness≈100 **and** Anticipation≈100 **and**
  a positive Conversation swing reaches ≥95.
- **Anticipation reads franchise history.** A sequel to a recognised IP with
  strong previous entries gets a real Anticipation lift an original can't buy —
  wiring the existing `IntellectualProperty.recognition` / `filmIds` /
  `ipViability` signals *back into* the new film.
- **Asymptotic ceiling.** Replace the hard `clamp(...,100)` with a soft
  compression so 90–100 is a genuinely thin tail and no input is silently wasted.

This is intentionally a *sketch*. The weights, the exact Anticipation inputs,
and whether Conversation is multiplicative or additive are all Phase-2 tuning
questions to be settled against the fixtures in §8, not decided here.

---

## 6. The documented Buzz scale (adopt as design canon)

The brief's scale is good and should become **documented design**, referenced by
tests. Recommended canonical table:

| Band | Meaning | Real-world anchor | Expected frequency |
|---|---|---|---|
| 0–20 | Virtually unknown | No campaign, no-name cast | Common (unmarketed/indie) |
| 20–40 | Small independent; minimal awareness | Micro-budget festival play | Common |
| 40–60 | **Typical studio release — most films live here** | Mid-budget drama/comedy | **The mode** |
| 60–75 | Strong commercial release; real interest | Well-marketed genre film | Uncommon |
| 75–90 | Major blockbuster territory | Most Marvel/Bond/MI/Pixar | Rare |
| 90–99 | Exceptionally anticipated | No Way Home tier | Very rare |
| 100 | Cultural phenomenon | Endgame / Force Awakens | ~once a generation |

**Calibration targets** (also §8):

- Endgame-equivalent (franchise culmination, A-list, saturation campaign, huge
  anticipation): **very close to 100**.
- No Way Home-equivalent: **high 90s**.
- A normal Marvel film: **~80–90**.
- A typical studio drama: **~40–60**.
- A small indie: **well below that (teens–30s)**.

The current engine cannot produce this distribution (the mode sits far too high).
Making the mode land at 40–60 and the 90+ tail genuinely thin is the concrete
success criterion for the whole effort.

---

## 7. Recommended implementation roadmap

Staged so each phase is independently shippable and independently testable.
**Save compatibility is out of scope** per project policy — bump `SAVE_KEY`
freely at each phase.

### Phase 0 — Documentation & characterization (no behaviour change)
- Land this review; adopt the §6 scale as canon in `DESIGN.md §5.3`.
- Add **characterization tests** that pin *current* Buzz outputs for a spread of
  configurations, and a diagnostic that prints the band histogram across the
  full `TEST_SCRIPTS` catalog. This makes every later phase's effect visible and
  guards against silent re-inflation. *No formula edits.*

### Phase 1 — Tuning & presentation (low risk, high perceived payoff)
- **Rescale so the mode lands at 40–60.** Lower the marketing anchors (esp. the
  £13.6M → +52 knee), trim the always-on floor (Mystery final-cut +14, Heavy
  music +8, base +10), so a standard campaign no longer pre-loads 84.
- **Make the ceiling asymptotic** (soft compression) instead of a hard clip, so
  90–100 becomes a thin tail and no lever is wasted.
- **Fix the double-clamp ordering** (§10) so press-tour/producer/moment terms
  are folded into a single clamp.
- **Present Buzz qualitatively**: keep one headline value but add a named-driver
  readout ("Star power and a saturation campaign; held back by an unknown
  studio"), per the qualitative-presentation principle. Optionally widen
  `openingTier` above 65.
- Validate against the §8 fixtures. This phase alone resolves the *legibility*
  problem and most of the *"feels wrong"* complaint.

### Phase 2 — Architecture: additive → multiplicative + Anticipation
- Introduce internal **Awareness** and **Anticipation** sub-scores; combine
  **geometrically** (§5). No new player-facing meters.
- **Wire franchise/IP goodwill into Anticipation** (recognition, previous-entry
  track record via `IntellectualProperty.filmIds` and the `ipViability` signals)
  — the one genuinely new mechanic, and the one that makes the Endgame reference
  reachable.
- Re-anchor against the fixtures; expect to re-triage the regression matrices
  (the milestone-11 precedent shows this is a known, manageable cost).

### Phase 3 — Conversation modifier & opening-week review (optional)
- Fold press-tour moments, event leaks, controversy, and awards heat into a
  bounded **Conversation** swing on top of Awareness×Anticipation.
- Only if Phase 2 meaningfully changes Buzz's *magnitude* distribution, revisit
  whether `BUZZ_URGENCY_WEIGHT` and the opening-week pacing still calibrate — but
  note that today Buzz barely drives money, so this may need **no** change. Do
  not expand Buzz's box-office role without a deliberate decision.

**Recommendation:** Phases 0–1 are worth doing regardless — they fix the actual
complaint (legibility + over-easy 100) at low risk. Phase 2 is worth doing *if*
franchise anticipation is a design priority (the Endgame framing suggests it is).
Phase 3 is genuinely optional.

---

## 8. Testing & validation strategy

The brief explicitly wants Buzz balanced by documented expectation, not
intuition. The building blocks exist: **89 handcrafted `TEST_SCRIPTS`** across 8
genres (incl. *The Dark Knight*, *Mad Max: Fury Road*, *Schindler's List*, *The
Social Network*, *Moonlight*), a **top-heavy A-list talent roster** (fame up to
100), difficulty-tiered **Brand** seeds (3–92), and the full
marketing/press-tour/producer stack.

### 8.1 Real-film fixture regression suite (the centrepiece)
A new test file (e.g. `engine/buzzCalibration.test.ts`) assembling ~8
recognizable films from existing content and asserting **derived** Buzz falls in
the §6 band:

| Fixture (built from existing content) | Config | Expected Buzz |
|---|---|---|
| Franchise culmination ("Endgame") | Spectacle/Superhero script + IP with strong `filmIds` history + A-list + brand ~90 + saturation campaign + spectacle angle | ≥ 95 |
| Anticipated sequel ("No Way Home") | as above, slightly lower brand/entries | high 90s |
| Normal Marvel film | Spectacle script + high fame + brand ~72 + strong campaign, **no franchise history** | 80–90 |
| Tentpole with money but no anticipation | huge spend + A-list, **original** concept, no IP | should **cap ~mid-70s** (the key anti-"buy your way to 100" test) |
| Mid studio drama (*The Social Network*-shaped) | Prestige/Drama + mid fame + brand ~50 + modest campaign | 40–60 |
| Well-marketed genre film | mid script + strong campaign + mid cast | 60–75 |
| Small indie (*Moonlight*-shaped) | Prestige/Drama + low fame + brand ~10 + token spend | teens–30s |
| Unmarketed no-name | no campaign, procedural low-fame cast | 0–20 |

**Gap to close first:** there is no literal *Endgame* fixture and franchise
goodwill is derived at runtime (not authored). Recommended: add a small set of
**dedicated calibration fixtures** (a handful of scripts + explicit
talent/brand/marketing/IP configs) living in `data/dev/` or the test file, so the
"real film" targets are stable and named, rather than overloading `TEST_SCRIPTS`.

### 8.2 Invariant / property tests (encode the design intent)
- **Monotonicity:** Buzz rises with each lever, all else fixed (extends the
  existing `scoring.test.ts` hook-strength test to fame, brand, marketing, IP).
- **Bounds:** stays within [0,100] across the full catalog (exists today).
- **Weakest-link ceiling (the crucial new one):** max everything *except one
  pillar*; assert Buzz stays under a documented ceiling. This is the executable
  form of "marketing alone can't buy a phenomenon" and directly guards the
  Phase-2 architecture.
- **Distribution/mode test:** run every `TEST_SCRIPT` through a *standard* mid
  campaign and assert the **mode lands in 40–60** and **<X% exceed 80** — a
  regression guard against silent re-inflation during future tuning.

### 8.3 Diagnostic harness (opt-in, matches existing convention)
An `AI_STATS_DIAGNOSTIC`-style opt-in harness
(`engine/buzz.diagnostic.test.ts`, `--disable-console-intercept`) printing the
band histogram and each fixture's Buzz with its named drivers. Not part of the
normal suite; run when tuning, per the established `CLAUDE.md` pattern.

### 8.4 Presentation test
Assert the qualitative readout matches the band (e.g. a Buzz-52 film is never
described as a "cultural event"), so the number and its prose can't drift apart.

---

## 9. Answers to the brief's specific questions

- **Is the current model fundamentally sound?** The pre-release/reception split
  is — keep it. The *combine function* (additive) and the *missing Anticipation
  channel* are not.
- **Is it mostly a tuning problem?** The "100 too easy / illegible number" half
  is mostly tuning + presentation (Phase 1). The "100 should mean a phenomenon
  money can't buy, franchise anticipation should matter" half is architecture
  (Phase 2).
- **Is the architecture itself limiting?** Yes, in exactly two places: a linear
  sum can't express "you need all pillars," and there is no franchise/IP input.
- **Would Awareness/Anticipation/Conversation produce better gameplay?** Yes —
  primarily via the multiplicative combine and the new Anticipation inputs, *not*
  via exposing three meters.
- **Would they stay understandable?** Only if kept internal and surfaced as
  qualitative drivers. Three raw bars would hurt, not help.
- **Would they make balancing harder?** Modestly, but the ceiling behaviour
  actually becomes *easier* to reason about, and the tooling already exists.
- **Would they improve long-term simulation?** Yes — franchise anticipation is a
  real, currently-absent studio-strategy lever, and a bounded 100 restores the
  number's meaning.

---

## 10. Small independent note (described, not applied)

Per the brief's guidance to flag but not implement wider changes: the
**double-clamp in `releaseFilm.ts:226`** is a latent bug independent of the
redesign. `computeBuzzScore` already clamps to [0,100] (`scoring.ts:552`); the
outer sum then adds `flatBuzzDelta + pressTourBuzz + pressTourMomentBuzz` and
clamps again. For any film whose core buzz already reaches 100, **the entire
press-tour, producer, and press-tour-moment contribution is silently discarded**
— levers the player actively invests in become inert. The fix (fold all terms
into a single pre-clamp sum, or better, into the Phase-2 combine) is small, but
it is **not** obviously independent of the wider tuning decision (whether these
terms *should* be able to push a film to the ceiling is itself part of the
rebalance), so it is deliberately left for Phase 1 rather than applied here.

---

## Appendix: key file references

- Formula: `engine/scoring.ts:527-553` · assembly `engine/releaseFilm.ts:194,226,297`
- Marketing curve/anchors: `engine/marketing.ts`, `data/release.ts:72-80`,
  `engine/productionDials.ts:97-100`, `engine/interpolate.ts:27-49`
- Modifiers: `data/postProduction.ts:18-58` · `data/pressTour.ts` /
  `engine/pressTour.ts` · `data/pressTourMoments.ts` / `engine/pressTourMoments.ts`
  · `data/producers.ts:32-45` / `engine/producers.ts:138-153` ·
  `data/productionEvents.ts`
- Downstream: `audienceSimulationInputs.ts:558-563` ·
  `intellectualProperty.ts:29` · `ipViability.ts:139-143` ·
  `storyBeats.ts:12-16`
- Brand progression: `engine/reputation.ts:44-88` ·
  `components/common/DifficultyPicker.tsx`
- Display: `components/common/ScoreBar.tsx` ·
  `components/common/FilmDetailModal.tsx:155` ·
  `components/wizard/ReleaseResults.tsx:56`
- Architecture precedent (awareness/interest split): `docs/DESIGN.md` Milestone 11
- Content for fixtures: `data/testScripts.ts` (89 films) ·
  `data/handcraftedTalents.ts` · `data/marqueePersonalities.ts`
