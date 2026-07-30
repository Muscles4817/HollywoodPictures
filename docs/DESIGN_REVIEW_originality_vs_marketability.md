# Design Review — Originality vs Marketability: the draw vector

**Status:** Design only. No implementation. This note designs the piece that
finishes "buying is tangible" and makes Publisher Rights real, and it touches the
box-office chain — so it is deliberately designed before any code, with the
`BOX_OFFICE_DIAGNOSTIC` gates as the safety net for the eventual wiring.

**Prices throughout are anchored to real Hollywood figures** (per the brief).
The game bills in £ at roughly 1:1 with USD industry numbers (a screenplay reads
~£220–280k in-game today, which is already WGA/spec scale), so the real ranges
below double as game-£ targets.

---

## 1. The problem this solves

Three loose ends from the market restructure converge here:

1. **The concept-quality fields are inert.** `hook`, `emotionalPremise`,
   `franchisePotential` are stored, immutable, and *shown* (they drive the
   displayed Concept Strength) but feed **no outcome** — quality, buzz, or box
   office. Only `originality` is wired.
2. **Publisher Rights is a placeholder.** Its real-world power is *marketability*
   — proven audience, a guaranteed opening — not *originality*. Today it's just
   "a script with +6 concept spread." Its defining value doesn't exist mechanically.
3. **Sources differ in variance but not in *kind*.** Spec vs Agent is currently a
   spread/polish difference. It should also be a difference in **what kind of
   value** you're buying: a quality gamble vs a commercial sure thing.

The keystone insight (from the design conversation): **split the concept into two
vectors that drive two different halves of a film's commercial life.**

---

## 2. The two vectors

| Vector | Answers | Drives | Built from | Known or hidden? |
|---|---|---|---|---|
| **Originality** (quality) | "Is it *good*?" | Quality Score, Critic Score, word-of-mouth **legs** | `originality` (immutable) + execution craft | Broadly **known** pre-release (you can read the script) |
| **Marketability** (draw) | "Will people *show up*?" | Buzz → **opening weekend** | `hook` + `franchisePotential` + genre reach + stars/brand | **Hidden** for non-IP; **known** for IP |

This is the whole design in one line: **you buy an original for the chance at a
good film; you buy IP for the certainty of an opening.** Quality and draw are
different things — *Cats* opened huge and died; *The Shawshank Redemption* opened
soft and became a legend. A studio can see quality on the page; it cannot see
whether an original concept will *connect* until it's in cinemas.

### Why this makes each source tangibly distinct

| Source | Originality (quality) | Marketability (draw) | The bet you're making |
|---|---|---|---|
| **Spec** | wide, occasionally brilliant | **wide & hidden** | Double gamble — might be a great film *and* a sleeper hit, or a rough dud nobody sees. Cheapest. |
| **Agent Package** | reliable-solid | moderate & **hidden** (a touch narrower) | A competent film with an uncertain opening — de-risked on quality, not on draw. |
| **Publisher Rights (IP)** | inherited, variable | **high & known** | You *know* it opens. Quality is your job. The holy grail. |
| **Commission** | writer-competent, no lottery | **hidden** (an original) | Reliable quality floor, but the same commercial uncertainty as any original. |

The asymmetry that makes IP fought-over: **it is the only source that removes the
marketability gamble.** Everyone bids like dogs because a known opening is worth a
premium — see the economics in §5.

---

## 3. Reconsidering each script section's impact

The brief asked to "look at the script object and reconsider the impact of each
section." Here is the proposed wiring, current → target:

| Field | Bucket | Drives today | Drives under this design |
|---|---|---|---|
| `originality` | Concept · quality | Quality ¼-share + Critic 0.14 + crossover 0.45 | **unchanged** — the quality/legs vector |
| `hook` | Concept · **draw** | Concept Strength (display only) | **Marketability** → Buzz → opening |
| `franchisePotential` | Concept · **draw** | Concept Strength (display only) | **Marketability** → Buzz → opening (the heaviest draw input; franchises open big) |
| `emotionalPremise` | Concept · quality-ish | Concept Strength (display only) | small **legs** contribution (emotional films hold — word of mouth) |
| `structure / characters / dialogue` | Execution | Quality ¼ each; struct/chars → buzz(hookStrength) | **unchanged** as quality; the buzz(hookStrength) term is *replaced* by the cleaner Marketability channel (§6) |
| `complexity` | Scope | production difficulty/cost | **unchanged** |

Net effect: the concept splits cleanly into a **quality lens** (originality +
emotional premise → how good / how leggy) and a **draw lens** (hook + franchise →
how big the opening). `ConceptStrength` (the 2c display value) is re-cast as the
*quality* read; a new **Marketability** read is the *draw* lens, carrying the
hidden-band uncertainty.

---

## 4. The hidden-marketability mechanic

The centrepiece, and the reason IP is valuable.

**Marketability has a true value and a visible estimate.** The true value is
derived from `hook` + `franchisePotential` + genre reach (+ stars/brand at
production time). What the *player sees before release* depends on provenance:

- **Non-IP (Spec / Agent / Commission): a wide, hidden band.** Pre-release the
  player sees only a coarse qualitative hint ("could find a broad audience — hard
  to say" / "a tough commercial read"). The *true* draw is rolled within a wide
  band around the estimate and **only revealed as the opening weekend lands**.
  This is endogenous commercial variance: you took on the risk of an original.
- **IP (Publisher Rights): a narrow, high, *known* band.** The proven property
  tells you the audience is there. The estimate is tight and shown with
  confidence ("a proven draw — the audience is waiting"). You paid for certainty.

Band widths (illustrative, to calibrate):

| Provenance | Marketability band around estimate | Player sees pre-release |
|---|---|---|
| Spec | ±30 (very wide) | a vague hint |
| Agent Package | ±20 | a soft hint |
| Commission | ±22 | a soft hint |
| Publisher Rights (IP) | ±6 (tight), estimate floored high | a confident, specific read |

This aligns with `SIMULATION_PHILOSOPHY` Principle 1 (variance is endogenous,
earned, and legible after the fact) and Principle 3 (the risk is legible up
front: "this is an unproven original"). The reveal is **not** a hidden
release-time quality roll (Non-goal in the philosophy doc) — it's a *commercial
reception* roll, the audience deciding whether the concept connected, surfaced
through the opening-weekend result the player watches. Quality is still a
deterministic read of the production; only *draw* carries this uncertainty, and
only for unproven material.

---

## 5. Economic grounding (real prices as the guideline)

Anchoring the whole acquisition economy to real figures so the numbers feel
believable. Ranges are USD industry norms; game-£ targets track them ~1:1.

### Acquisition & development

| Transaction | Real-world range | Game-£ target | Notes |
|---|---|---|---|
| WGA minimum, original screenplay | $75k–$150k | £75k–£150k | the floor a spec/commission can cost |
| Typical spec purchase (unknown writer) | $100k–$500k | £75k–£500k | Spec's cheap end — the bargain |
| Hot spec, bidding war | $1M–$4M | £1M–£3M (rare) | the jackpot spec everyone chases |
| Literary option (per year) | $5k–$50k | £10k–£50k | cheap to *option* IP … |
| Book / IP purchase (typical) | $250k–$1M | £250k–£1M | … dear to actually *buy* |
| Bestseller / franchise rights | $1M–$5M+ | £1M–£5M | Publisher Rights' premium tier |
| Mid-tier writer commission | $200k–$500k | £200k–£500k | reliable, available |
| A-list writer commission | $1M–$3M | £1M–£3M | rarely *available* (see writer-selectiveness thread) |
| Rewrite (WGA-scale) | $50k–$150k | £50k–£150k | cheaper, easier to secure |
| Polish | $25k–$50k | £25k–£75k | cheapest development pass |

**The shape this dictates:** Spec is genuinely cheap to *acquire* (£75–500k) but
carries the development bill on top; Publisher Rights costs a multiple of a spec
(£250k–£5M) and is contested — you pay a premium for a *known draw* before a frame
is shot. Today's `SOURCE_COST_MULTIPLIER` (Spec 0.4 / Agent 0.9 / Publisher 1.1)
compresses this far too much — Publisher should be several times a spec, not 1.1
vs 0.4. Proposed re-anchor:

| Source | Current × | Proposed | Rationale |
|---|---|---|---|
| Spec | 0.4 | **0.3** | the bargain; you pay to develop it |
| Agent Package | 0.9 | **1.1** | script + implied talent commitments |
| Publisher Rights | 1.1 | **2.5–4.0** (+ contested premium) | proven-draw premium; a franchise property is worth a multiple |
| Commission | full fee | **full fee** (tier-scaled) | £150k WGA → £3M A-list |

### Box office (how the two vectors pay out)

Real rule-of-thumb the model should echo:

- **Opening weekend ≈ 20–40% of domestic total** for a wide release — it is
  almost entirely a *marketability/awareness* number (stars, brand, franchise,
  marketing). This is **Marketability → Buzz → opening.**
- **Legs (the multiplier from opening to total) ≈ reception.** A beloved film
  multiplies its opening 3–4×; a poorly-received one is front-loaded at ~2× or
  less. This is **Quality → word-of-mouth → legs.**
- **Marketing (P&A) ≈ 50–100% of production budget.** Break-even ≈ **~2.5×
  production budget** in global box office (the studio keeps roughly half, minus
  P&A).

The four archetypal outcomes fall straight out, and they're exactly the fantasy:

| | High Marketability | Low Marketability |
|---|---|---|
| **High Quality** | 🏆 the phenomenon (big open, long legs) | 💎 the sleeper hit (soft open, great legs) |
| **Low Quality** | 💥 the frontloaded blockbuster (big open, dies fast) | 🗑️ the flop |

IP buys you the top row's *opening*; originality + development earns the left
column's *legs*. A great original that also rolls high marketability is the
phenomenon — and you couldn't have manufactured it.

---

## 6. How box office consumes the vectors (wiring sketch)

Grounding in the existing chain (`engine/scoring.ts:computeBuzzScore`,
`engine/audienceSimulation*`):

- **Buzz** already drives the opening. Today it's fame + brand + marketing + a
  small `scriptBuzz` term off `hookStrength`. **Replace that script term with a
  Marketability channel**: `deriveMarketability(script)` from `hook` +
  `franchisePotential` + genre reach, resolved through the provenance band (§4).
  For IP it enters as a confident, high value; for an original it enters as the
  *rolled* true draw (unknown to the player until it lands).
- **Legs / retention** already come from reception (audience score, driven by
  quality). Add a small `emotionalPremise` contribution to retention (emotional
  films hold). Originality already reaches legs via crossover.
- **Calibration:** this changes the opening-weekend distribution, so it must land
  against `boxOfficeDistribution.diagnostic` / `buzzCalibration.diagnostic`. The
  marketing-buzz non-purchasability property (money can't buy a phenomenon) must
  survive — Marketability is *earned* (concept + IP + stars), amplified by
  marketing, not bought outright.

Taxonomy cleanup this enables (removes today's overlap between `ConceptStrength`,
`commercialProfile.hookStrength`, and buzz):

- **ConceptStrength** → the player's *quality-of-idea* read (originality-led).
- **Marketability** → the *draw* read (hook/franchise-led), with the hidden band.
- `commercialProfile.hookStrength`/`accessibility`/`crossover` fold into these two
  cleanly, or are subsumed by Marketability.

---

## 7. Phased plan (design locked here; build later, behind the gates)

1. **`deriveMarketability` (pure)** — from hook + franchise + genre reach. Not yet
   wired; unit-tested for the intended shape (franchise-heavy → high draw).
2. **Provenance band + reveal** — true-vs-estimate split; wide/hidden for non-IP,
   tight/known for IP; the true value resolves at opening. Player-facing hint copy.
3. **Wire into Buzz/opening**, replacing the `hookStrength` script term — behind
   `BOX_OFFICE_DIAGNOSTIC`, recalibrated, non-purchasability preserved.
4. **Small legs term** for emotional premise; retire the now-redundant commercial
   overlaps.
5. **Re-anchor `SOURCE_COST_MULTIPLIER`** to §5 (Publisher premium + contested),
   and align commission/rewrite fees to the real-price table.

Steps 1–2 are safe and calibration-free (new derivation + a hidden value).
Step 3 is the calibration-sensitive one and should be its own PR with the
diagnostics run.

---

## 8. Open decisions for sign-off

1. **Marketability inputs & weights** — proposed `hook` (lead) + `franchisePotential`
   (heaviest) + genre reach. Include `accessibility` from `commercialProfile`?
2. **Band widths** (§4) — Spec ±30 down to IP ±6. Too swingy? Too tame?
3. **Reveal cadence** — all at opening weekend (proposed), or leak partially during
   the marketing campaign / test screenings (a "tracking" mechanic — real studios
   buy tracking data)? Tracking-as-a-purchasable-signal is a lovely future hook.
4. **Cost re-anchor** — is Publisher at 2.5–4× a spec the right premium, and should
   the contested/bidding premium be automatic on IP?
5. **Scope of the taxonomy cleanup** — fold `commercialProfile` into the two new
   reads now, or leave it and layer Marketability on top first?

Nothing here is built. On sign-off, Steps 1–2 are the safe first PR; Step 3 is the
calibrated box-office PR.
