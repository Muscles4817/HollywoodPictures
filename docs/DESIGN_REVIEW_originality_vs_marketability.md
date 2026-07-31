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
| Publisher Rights | 1.1 | **tiered, super-linear (see §5b)** | mid IP ~1–2×, bestseller several×, franchise-tier tens–hundreds×; mega effectively unbuyable |
| Commission | full fee | **full fee** (tier-scaled) | £150k WGA → £3M A-list |

A flat multiplier can't express this — IP cost must scale with the **marketability
tier** it carries (§5b), not with `script.cost`. That's a structural change: an IP
listing's price is driven by its *draw*, not its screenplay-craft cost.

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

## 5b. The marketability curve — intense, convex, and rare at the top

**This is the single most important calibration decision in the feature.** Real
openings are a power law, not a line, and the top is a different universe:

| Asset | Typical value (real) |
|---|---|
| Original spec screenplay | $100k–3M |
| Unknown novel adaptation rights | $50k–1M |
| Bestselling novel | $1–10M+ |
| *Harry Potter*-level franchise | tens–hundreds of millions (if ever sold) |
| Spider-Man film rights today | effectively billions in economic value |
| Entire IP company (Marvel / Lucasfilm) | $4B+ |

Openings follow the same shape. **Opening scales exponentially with
marketability, never linearly** — calibrated to real domestic figures:

| Marketability | Real analogue | Opening (domestic, illustrative) |
|---|---|---|
| 25 | a tiny original | ~$2–4M |
| 50 | a solid genre film | ~$20–30M |
| 75 | a strong franchise entry | ~$90–130M |
| 90 | a major event | ~$200–260M |
| **97+** | **a cultural phenomenon (rare)** | **~$300M+ domestic → $600M–1.2B worldwide** |

That's roughly `opening ≈ base × exp(k·(M − M₀))` — about **10× per ~33 points** of
marketability (k ≈ 0.07) — scaled by release size (a limited release can't reach
event numbers however marketable it is). The top band (90–100) is soft-ceilinged
but *enormous* and, when it lands, dominates a studio's fortunes — one Marvel
carries a Disney. A true **90+ marketability IP should be rare and insanely
powerful**, exactly as the brief says.

**The top is RARE.** Marketability is long-tailed: most films sit 30–55. A genuine
90+ is scarce *even among IP* — gated by a rare "franchise-tier" property, not
handed to every Publisher Rights listing. Non-IP marketability is centred low–mid
(originals seldom open huge), which is precisely *why* the hidden band matters so
much: a spec that secretly rolled an 85 is a phenomenon nobody saw coming, and the
convex curve makes that reveal land like a bomb.

**Cost & availability scale super-linearly with it.** The proposed flat "Publisher
2.5–4× a spec" in §5 is too tame for the top — value is tiered and the ceiling is
barely for sale:

| Tier | Real analogue | Value | In-game |
|---|---|---|---|
| Spec | original screenplay | $100k–3M | routine buy |
| Mid IP | backlist / unknown novel | $50k–1M | affordable |
| Bestseller | hot book | $1–10M+ | a real investment, contested |
| Franchise property | *Harry Potter*-scale | tens–hundreds of M | rare, studio-defining, fierce bidding |
| Mega-franchise | Spider-Man / Marvel library | billions | **buyable, but vanishingly rare** |

**The top tier is buyable — just absurdly rare.** You could play for in-game
*decades* without one ever appearing. It is NOT gated to buildable-only, because a
live studio-to-studio market is the point: an IP can be **sold between studios**
(you buy a rival's franchise; a rival in trouble divests its crown jewel; you
outbid the world for a property that surfaces once a generation). Building your own
(your hit → franchise rights) is *a* path to a mega-property, but so is buying one
— and wanting to buy from other studios is exactly why it must be purchasable.

Balance is protected by **rarity and price**, not by making it unbuyable: a 90+
property appears so seldom, and costs so much (tens–hundreds of millions, fiercely
contested), that acquiring one is a once-in-a-studio's-life event that reshapes the
company — one Marvel carries a Disney. Rarity, power, and cost all scale together.

This implies a real **studio-to-studio IP market**: IP is an ownable, tradeable
asset (rival IP ownership was scoped-but-deferred in the pipeline doc). That, plus
"an IP may have no screenplay yet," is what makes the **IP object** the entity this
whole tier lives on — see the sequencing note in §7.

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

## 7. Sequencing — does the IP object come first?

Honest answer: **the core marketability mechanic and the IP object are separable,
but the *top tier* — the rare, buyable, tradeable mega-franchise you actually care
about — genuinely needs the IP object.** Two facts pull in opposite directions:

- **Marketability lives on the film** (it's what *opens*), derived from concept
  fields, and applies to *every* film. Its derivation, the exponential curve, and
  even the hidden-vs-known band (keyed off the existing `AssetProvenance`) can all
  be built and calibrated **without** the IP object. This is the biggest single
  box-office improvement and the lowest-risk to prove.
- **The IP object owns the top end.** "An IP with no screenplay," the rare 90+
  franchise *tier*, and studio-to-studio trading are all IP-object features. Wire
  marketability on plain scripts and its ceiling is whatever `franchisePotential`
  rolls from an archetype band — the true mega-franchise, and the market you want
  to buy from rivals, simply don't exist yet.

So neither ordering causes rework (the IP feeds *into* film marketability either
way), and the real question is which you want first:

**Option A — Marketability core first, IP object second.** Ship draw-driven
openings + the hidden-band gamble for all films now (Publisher-Rights-acquired
assets get "known draw" via provenance immediately); add the IP entity, adaptation,
franchise tier, and trading after. De-risks the scary box-office calibration before
the big reshape; delivers the "buying is tangible" payoff soonest.

**Option B — IP object first, then marketability (your lean).** Build the IP as a
real ownable/tradeable/rare entity first, so marketability wires up with its full
range (known-high IP draw, the rare buyable mega-tier, the studio-to-studio market)
native from day one. Cleaner conceptually; front-loads the biggest, most invasive
reshape (`Opportunity.script` becomes optional, every reader guarded), and the
box-office calibration lands *after* it.

**Recommendation:** given your priorities — a buyable-but-vanishingly-rare
mega-franchise and a studio-to-studio market — **Option B is defensible and I'm
happy to lead with the IP object.** The one thing I'd lift out and do *first
regardless* is the **exponential opening curve** (§5b): it's the calibration-risky
piece, it's independent of the IP object, and proving it early means the IP work
lands on an already-validated box-office shape rather than stacking two big
unknowns.

### The build order under Option B

1. **IP object** — `Opportunity`/`Asset` become a discriminated union: a listing is
   a *screenplay* (today's shape) **or** an *IP* (no script, carries a
   marketability/franchise tier). Every `opportunity.script` reader guarded.
2. **Adaptation** — the development stage that turns an owned IP into a screenplay,
   inheriting the IP's marketability. (The third rewrite kind from the pipeline doc.)
3. **The exponential opening curve** (§5b) — behind `BOX_OFFICE_DIAGNOSTIC`,
   recalibrated, non-purchasability preserved. *(Do this first if de-risking.)*
4. **`deriveMarketability` + provenance band/reveal** — film draw from concept (or
   inherited IP tier); wide/hidden for originals, tight/known for IP; resolves at
   opening. Replaces the `hookStrength` script term in Buzz.
5. **Rare mega-tier + studio-to-studio market** — franchise-tier IP generation
   (vanishingly rare), rival IP ownership, and buying/selling IP between studios.
6. **Re-anchor costs** — IP priced by marketability tier (§5, §5b); commission/
   rewrite fees to the real-price table; small `emotionalPremise` legs term.

---

## 8. Open decisions for sign-off

1. **Marketability inputs & weights** — proposed `hook` (lead) + `franchisePotential`
   (heaviest) + genre reach. Include `accessibility` from `commercialProfile`?
2. **The curve steepness** (§5b) — ~10× per 33 points (k ≈ 0.07) is the proposed
   convexity. Steeper (more extreme top) or gentler? And where does the soft
   ceiling on the 95–100 "phenomenon" band sit?
3. **Franchise-tier rarity** (§5b) — how scarce is a 90+ property in the IP pool,
   and is the true mega-tier **buildable-only** (your hit → franchise) rather than
   ever purchasable?
4. **Band widths** (§4) — Spec ±30 down to IP ±6. Too swingy? Too tame? (Note the
   convex curve *amplifies* these — an ±30 band on the input is far more than ±30
   on the output.)
5. **Reveal cadence** — all at opening weekend (proposed), or leak partially during
   the marketing campaign / test screenings (a "tracking" mechanic — real studios
   buy tracking data)? Tracking-as-a-purchasable-signal is a lovely future hook.
6. **IP cost model** — price an IP listing by its **marketability tier** (§5b),
   not `script.cost` — and make the mega-tier buildable-only rather than for sale?
7. **Scope of the taxonomy cleanup** — fold `commercialProfile` into the two new
   reads now, or leave it and layer Marketability on top first?

Nothing here is built. On sign-off, Steps 1–2 are the safe first PR; Step 3 is the
calibrated box-office PR.
