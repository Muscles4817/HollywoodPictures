# Box Office Calibration Targets — the framework we tune *against*

Status: **proposed targets, awaiting ratification.** This document defines what a
correct box-office simulation should *look like* — at the level of individual
films, a whole simulated year, the spread of outcomes, and the buzz scale —
**before** any calibration change is made. Once ratified, these targets become
regression assertions, and every change is judged against them rather than tuned
by feel.

**This is a behavioural specification, not a tuning document.** It defines
*observable outcomes* only. It deliberately names no engine constants and proposes
no constant values — those belong in implementation notes (the diagnosis in
`DESIGN_REVIEW_box_office_revenue_analysis.md` holds the current engine-level
analysis). Any implementation is free to reach these outcomes however it likes; it
is *measured* against this document.

Every number marked _(ratify)_ is a judgment call for the designer to set; each is
proposed with a real-world basis, meant to be edited here first, then implemented.

---

## 1. Principle: shrink *activation*, not the market

The absolute scale is too high, but the fix must **not** primarily shrink the
theoretical audience. A smaller market would compress the top end and make
Avatar / Endgame / Barbie-scale phenomena impossible. We keep a large theoretical
market and make it **harder for an ordinary film to activate it**.

Model demand as an explicit funnel:

```
Total theoretical audience     large — preserved; headroom for phenomena
   ↓  ELIGIBILITY        which of them could ever want THIS film
Eligible audience
   ↓  AWARENESS          of the eligible, how many know it exists
Aware audience
   ↓  INTEREST           of the aware, how many actually want to see it
Interested audience
   ↓  INTENT / URGENCY   how soon they act
Intent to watch
   ↓  ATTENDANCE         gated by exhibition access AND attention competition
Actual attendance
```

**Behavioural target for the funnel:** an *ordinary* film should activate only a
**small fraction** of its eligible audience; an *exceptional, broadly-positioned*
film should be capable of activating a **very large fraction**. The everyday case
sits far down the funnel; the phenomenon case — every stage near-maxed at once — is
rare and unchanged in ceiling. Success is measured as: the *average* film moves
sharply down, the *maximum possible* film does not move down at all.

### 1.1 What "Eligibility" represents

Eligibility is "of the entire theoretical market, how many could **ever** plausibly
want a film like this" — distinct from Awareness ("do they know it exists") and
Interest ("of those who know, how many want it"). It is a property of the film's
*concept and positioning*, set before any marketing, and is influenced by:

- **genre popularity** — how broad the genre's natural audience is;
- **target demographic size** — the reachable audience the film is aimed at;
- **concept accessibility** — how easy the premise is to grasp and want;
- **age rating / content gating** — a hard restriction on the reachable pool;
- **franchise familiarity** — an existing audience predisposed to this title;
- **breadth of appeal** — four-quadrant vs. narrowly targeted;
- **cultural specificity** — how universal vs. locale-specific the material is.

Keeping Eligibility as its own stage gives every future system a single clean place
to plug in (an age-rating system, a franchise system, a demographics system) without
overlapping Awareness or Interest.

---

## 2. Per-film targets (worldwide gross)

Worldwide potential gross. "Current" = today's model (measured);
"Target" _(ratify)_ = where each archetype should land.

| Archetype | Current WW | Target WW | Target opening | Target legs |
|---|--:|--:|--:|--:|
| Invisible / dumped wide | $194M | **$5–25M** | — | 2–2.5× |
| Below-average wide | ~$400M | **$40–90M** | $20–40M | 2.5–3× |
| **Average wide commercial** | **$712M** | **$90–160M** | $35–60M | 2.5–3.5× |
| Strong commercial / mid tentpole | $815M | **$300–500M** | $90–160M | 3–3.5× |
| Major blockbuster | $1,173M | **$600M–1B** | $180–320M | 2.5–3.5× |
| Rare cultural phenomenon | (unreachable cleanly) | **$1B–2.5B+** | $350–600M | 2.5–4× |
| Indie drama (Limited/platform) | $41M | **$8–45M** | $1–4M | 6–15× |
| Horror cheapie (Wide) | $258M | **$40–120M** | $15–40M | 3–5× |

Headline: the **average wide film must drop ~5–7×** while the **phenomenon ceiling
is preserved**.

---

## 3. Whole-year distribution targets

A believable *year* matters as much as believable individual films. A full-year
harness (drives the real settlement loop over N years × seeds) reports and asserts
these.

Measured baseline: **83.4% of films profitable**, average wide ~$712M WW, field
~67 films/year. Real-world basis: top-10 take **40%+** of annual box office;
roughly **half of wide releases fail to recoup all-in**.

**Over WIDE releases** _(all ratify)_:

| Metric | Current | Target |
|---|--:|--:|
| Median WW gross | ~$700M | **$90–130M** |
| Mean WW gross (tail-pulled) | ~$700M | **$170–230M** |
| % losing money (all-in incl. P&A) | ~17% | **45–55%** |
| % exceeding $100M WW | ~95% | **40–50%** |
| % exceeding $500M WW | ~60% | **5–8%** |
| % exceeding $1B WW | ~15% | **1–2%** (0–2 films/yr) |
| Top-10 share of annual box office | (flat) | **40–50%** |
| Avg run length (weeks) | 5–10 | Wide **5–8**, Limited/platform **10–20** |
| Opening multiple (total/opening) | 2.5–4.6× | Wide **2–3×**, Limited **5–12×** |

The current model is nearly flat (most films are hits); the target is a **steep
power law** — a few winners, a large unprofitable tail.

---

## 4. Volatility / variance targets

Averages and distributions are not enough — the framework must also define **how
predictable outcomes are.** Real box office is noisy: two films with similar
budgets, casts and marketing can perform very differently. Outcomes must not feel
deterministic; the simulation should produce genuine surprises while still
rewarding good decisions **over the long run**.

**Target outcome spread for an average commercial film** (relative to its own
expectation) _(ratify)_:

| Outcome vs. expectation | Target probability |
|---|--:|
| Significantly underperforms | ~15% |
| Modestly underperforms | ~30% |
| Performs roughly as expected | ~30% |
| Modestly overperforms | ~20% |
| Genuine breakout hit | ~5% |

The same principle applies at the top: **even expensive blockbusters should
occasionally disappoint.** No budget tier is a guaranteed outcome.

**Regression tests must assert variance, not just the mean** — e.g. the spread /
coefficient of variation of outcomes for a *fixed* set of inputs across many seeds
and market contexts should fall in a target band (neither near-deterministic nor
pure noise).

**Architectural constraint (from `SIMULATION_PHILOSOPHY.md`, Principle 1):** this
variance must be **endogenous** — it should emerge from how the production actually
went (execution/reception varying with the shoot and the creative risks taken) and
from the *market context* a film releases into (who else is on screens), **not**
from a hidden release-time dice roll bolted onto box office. Identical
pre-production inputs re-scored must still yield the identical film; the spread
comes from the decisions and the world, not from re-rolling the outcome. The
variance *target* is a property to validate across many productions and contexts —
not a licence to inject box-office randomness.

---

## 5. Profitability distribution targets

Profitability is validated **separately from gross** — production budget,
marketing/P&A, exhibitor splits and international keep shares all sit between gross
and profit and can be independently wrong. The harness reports the **return
multiple** (studio cash ÷ all-in cost) distribution.

Measured baseline: **83.4% profitable.**

Target bands over **all** films _(ratify)_:

| Outcome | Return multiple (cash ÷ all-in) | Target share |
|---|---|--:|
| Outright bomb | < 0.4× | **~15%** |
| Loss | 0.4–1.0× | **~30%** |
| Break-even | 1.0–1.25× | **~12%** |
| Modest success | 1.25–2.5× | **~25%** |
| Major hit | 2.5–5× | **~15%** |
| Studio-changing blockbuster | > 5× | **~3%** |

→ **~45% of films unprofitable** vs. ~17% today. This is what gives the economy
stakes; identity, scheduling and competition only matter once failure is common.

---

## 6. Buzz: bands and real-film fixtures

Buzz must not be **purchasable.** Money buys *awareness* and contributes to buzz,
but phenomenon-level anticipation requires latent audience demand that marketing
*amplifies* — franchise, star, cultural moment — not a cheque alone. Today, marketing
spend alone can reach the upper bands; the target forbids that.

**Ratified bands** (adopt verbatim as regression thresholds):

| Buzz | Meaning | Real-world anchor |
|---|---|---|
| 0–20 | Almost invisible release | dumped / no campaign |
| 20–40 | Small release, limited awareness | small indie, platform |
| 40–60 | Typical commercial release | ordinary studio film |
| 60–75 | Clearly anticipated | well-marketed star vehicle, known sequel |
| 75–90 | Major blockbuster | Marvel-style tentpole |
| 90–97 | Rare cultural event | Barbie, Spider-Man: No Way Home |
| 98–100 | Once-in-years global phenomenon | Endgame, The Force Awakens, Avatar |

**Real-film buzz fixtures** (computed from *only* pre-release information; become
regression tests):

| Fixture | Character (pre-release only) | Target buzz |
|---|---|--:|
| Ordinary studio action film | mid brand, mid fame, ordinary campaign | **48–58** |
| Well-marketed star vehicle | mid brand, A-list lead, large campaign | **62–72** |
| Successful horror sequel | genre brand, modest fame, franchise recall | **58–68** |
| Marvel-style tentpole | high brand, ensemble fame, huge campaign, franchise | **80–90** |
| Barbie | high brand, star + director, huge campaign + cultural hook | **90–95** |
| The Force Awakens | franchise return, near-max latent demand | **96–99** |
| Avengers: Endgame | franchise culmination, max latent demand | **98–100** |

The gap between "Marvel-style tentpole" (buildable with money + fame) and "Endgame"
(requires franchise/cultural latent demand) is the non-purchasability property:
**the top two bands must be unreachable by marketing spend alone.**

---

## 7. Competition: two levels, one shared matchup model

Competition is currently inert because it only touches *exhibition access*, which
only bites when demand exceeds capacity — which never happens. Two corrections:

**(a) Model competition at both levels.**

- **Exhibition competition** — screens, premium formats, showtimes, theatre
  retention, geographic rollout. Exhibition capacity should stay *physically
  meaningful* (it represents real seats and showings), **and** must be able to fall
  below demand under pressure so it can actually constrain attendance.
- **Attention / audience competition** — even with seats to spare, films fight for
  awareness, media coverage, urgency, discretionary spend and overlapping
  demographics. This suppresses the **demand** side, weighted by **audience
  overlap** — so same-window clashes hurt even without sell-outs, and opposite
  demographics barely harm each other (the counter-programming / Barbenheimer
  property).

**(b) Make crowding relative, via one reusable matchup model.**

A single **release-strength / matchup** primitive answers, for any two releases:
how strong is each, how much does their audience overlap, and who displaces whom?
The **stronger** film takes screens/attention; the **weaker** one loses them — the
opposite of today's absolute, candidate-blind crowding. This same primitive is
consumed by **both** theatrical settlement (7a) and AI scheduling (§8) — not two
parallel formulas. That shared model is the key architectural payoff.

---

## 8. AI scheduling: contest by strength, don't just avoid

Built on the §7 matchup model:

- A film **stronger** than a window's incumbents tolerates or *claims* it — majors
  plant flags on prime weekends and force weaker films off. A film **weaker** than
  the field flees to quiet pockets — everyone else surviving cleverly around the
  majors.
- **Counter-programming:** same-audience clashes carry the split penalty;
  opposite-audience films are spared it (or benefit), spreading the survivors across
  the calendar rather than stacking them.
- **Per-tier frequency emerges from marketing capital + window scarcity**, not a flat
  cadence. Calibration check against researched volumes: Major ~10–15 wide/yr, Mid
  ~10, Indie/boutique ~4–10 (often limited/platform).

---

## 9. Studio identity: via intermediate systems, emergent from history

Identity must **not** be a flat revenue multiplier. It influences *intermediate*
systems, so its effects are believable and legible:

- audiences trust that studio's marketing (→ awareness efficiency on-brand);
- exhibitors are more confident (→ opening availability on-brand);
- talent is more willing to sign (→ casting/availability edge in that space);
- awareness spreads more easily on-brand (→ external awareness / word of mouth);
- competitors *respect that studio's territory* (→ the §7 matchup weights an on-brand
  incumbent as stronger on that window).

And identity **emerges from history** — earned through repeated commercial success in
a space, not selected upfront.

---

## 10. Future target: genre-specific calibration

The targets above treat the market as one distribution, which is right for now. But
the eventual goal is to validate distributions **both globally and per genre**, because
genres behave differently:

- **Horror** — lower budgets, lower ceilings, much higher ROI.
- **Animation** — enormous family appeal, long theatrical runs, strong holiday
  performance.
- **Awards drama** — often opens small, exceptional legs.
- **Action** — opens very large, more front-loaded.
- **Comedy** — increasingly volatile.

Documented now as a **future calibration target** so genre behaviour is something we
*validate*, not merely hope emerges. Not for immediate implementation.

---

## 11. Future target: seasonality calibration

Likewise, release windows should have **measurable** characteristics, validated rather
than assumed:

- **Summer** — supports the largest blockbuster openings.
- **Christmas** — benefits family films and prestige releases.
- **Halloween** — significantly boosts horror.
- **January / quiet months** — generally weaker commercially.

Documented now as a **future calibration target**. Not for immediate implementation.

---

## 12. Implementation order

**Targets before constants:**

1. **Ratify this document.**
2. Build the **calibration harnesses**: full-year distribution + assertions,
   outcome-variance report, profitability-distribution report, buzz-band fixtures.
   They fail loudly at first — correct, since they encode the target, not the current
   state.
3. **Recalibrate the funnel** (eligibility + interest + overall scale) until §§2–5
   pass; theoretical market stays large.
4. **Recalibrate awareness, opening conversion and buzz** until §2 & §6 pass.
5. **Relative competition + capacity that can bind** (§7), as the shared matchup model.
6. **Reuse the matchup model for AI scheduling** (§8); check per-tier frequency.
7. **Evolving studio identity** (§9), then re-validate the full-year financial and
   profitability distributions end to end.

The discipline: **no calibration change in steps 3–4 until the step-2 harnesses exist
and encode ratified targets.** We tune against the framework, never by feel.

---

## Open decisions to ratify

The most consequential judgment calls (everything else follows from these):

1. **Average wide WW gross** — proposed ~$120M (down from $712M).
2. **% of films unprofitable** — proposed ~45% (up from ~17%).
3. **Top-10 annual box-office share** — proposed ~45%.
4. **Phenomenon ceiling** — proposed ~$2–2.5B preserved (raise for Avatar-scale?).
5. **Buzz non-purchasability line** — marketing-alone must cap below the top two
   bands (≤ "clearly anticipated", ~75)?
6. **Average-film outcome spread** (§4) — the 15/30/30/20/5 split as stated?
