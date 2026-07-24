# Box Office Calibration Targets — the framework we tune *against*

Status: **proposed targets, awaiting ratification.** This document defines what a
correct box-office simulation should *look like*, at the level of individual
films, a whole simulated year, and the buzz scale — **before** any constant is
changed. Once ratified, these targets become regression assertions
(`audienceSimulationScenarios.test.ts`, a new full-year distribution harness, and
buzz fixtures), and every calibration change is judged against them rather than
tuned by feel.

Companion to `DESIGN_REVIEW_box_office_revenue_analysis.md` (the diagnosis). This
doc is the answer to that review's Lever 0, rebuilt around the architectural
guidance that the fix must preserve headroom for genuine phenomena, must attack
the *interest-generation* layer rather than merely shrink the audience constant,
and must be validated at the level of the whole yearly distribution, not a few
hand-picked archetypes.

Every number below marked _(ratify)_ is a judgment call for the designer to set;
they are proposed with a real-world basis but are meant to be edited here first,
then implemented.

---

## 1. Principle: shrink *activation*, not the market

The current absolute scale is too high, but the fix is **not** primarily to lower
`BASE_ADDRESSABLE_POPULATION`. A small population constant would compress the top
end and make Avatar / Endgame / Barbie-scale phenomena impossible. We keep a
large theoretical market and make it *harder for an ordinary film to activate*.

Model the demand path as an explicit funnel, and locate the fix in the middle
layers:

```
Total theoretical audience        (large — keep it; headroom for phenomena)
   ↓  eligibility          ← which of them could ever want THIS film (genre/audience/concept fit)
Eligible audience
   ↓  awareness            ← do they know it exists (marketing reach × efficiency, cast reach)
Aware audience
   ↓  interest             ← of the aware, how many actually want to see it (concept/accessibility)
Interested audience
   ↓  intent / urgency     ← how soon (pacing, buzz, word of mouth)
Intent to watch
   ↓  attendance           ← gated by exhibition access (availability/capacity) AND attention competition
Actual attendance
```

**The prime suspect is not the population constant — it is
`BASE_INTEREST_FLOOR = 0.15`.** Guaranteeing every film a 15% slice of an enormous
eligible pool is what inflates the average film to a hit. The recalibration must:

- **Lower the guaranteed interest floor** sharply (toward ~0.02–0.05 _(ratify)_)
  so an ordinary concept activates only a small fraction of its eligible market,
  and only a genuinely broad, accessible, well-positioned concept earns a large
  one.
- **Introduce an explicit eligibility layer** (film-specific reachable fraction of
  the total market, from genre/audience/concept fit) so "how many could ever want
  this" is separated from "how many know about it" and "how many end up
  interested" — three distinct funnel stages instead of two.
- **Keep (or even enlarge) `BASE_ADDRESSABLE_POPULATION`** so the top of the funnel
  still has phenomenon-scale headroom. Scale comes from the *product* of all
  funnel stages being near-maxed at once (a rare event), not from the average film
  starting near the ceiling.

The test of success: the *average* film should land far down the funnel while the
*maximum possible* film is unchanged or higher.

---

## 2. Per-film targets (worldwide gross)

Worldwide potential gross. "Current" = today's live model (measured);
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

Headline: the **average wide film must drop ~5–7×** (≈$712M → ≈$120M), while the
**phenomenon ceiling is preserved** (~$2B+ still reachable by a near-maxed funnel).

---

## 3. Whole-year distribution targets

Cherry-picked archetypes are not enough — the *shape of a simulated year* must be
believable. A new full-year harness (drives the real `settleTheatricalMarket`
loop over N years × seeds, as `aiStudioStats.diagnostic.test.ts` already does) will
report these and assert the ratified bands.

Measured current baseline: **83.4% of films profitable**, average wide ~$712M WW,
AI field ~67 films/year.

Real-world basis: ~100–140 wide releases/industry-year; top-10 take **40%+** of
annual box office; roughly **half of wide releases fail to recoup all-in** (P&A
often rivals the production budget).

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

The current model is close to flat (most films are hits); the target is a **steep
power law** — a handful of winners, a large unprofitable tail.

---

## 4. Profitability distribution targets

Profitability must be validated **separately from gross** — production budget,
marketing/P&A, exhibitor splits, and international keep shares all sit between
gross and profit and can be independently wrong. The harness reports the *return
multiple* (studio cash ÷ all-in cost) distribution.

Measured current baseline: **83.4% profitable.** Real theatrical is far more
brutal.

Target bands, over **all** films _(ratify)_:

| Outcome | Return multiple (cash ÷ all-in) | Target share |
|---|---|--:|
| Outright bomb | < 0.4× | **~15%** |
| Loss | 0.4–1.0× | **~30%** |
| Break-even | 1.0–1.25× | **~12%** |
| Modest success | 1.25–2.5× | **~25%** |
| Major hit | 2.5–5× | **~15%** |
| Studio-changing blockbuster | > 5× | **~3%** |

→ **~45% of films unprofitable** (bomb + loss), vs. ~17% today. This is the number
that makes the economy have stakes; every other lever (identity, scheduling,
competition) becomes meaningful only once failure is common.

---

## 5. Buzz: bands and real-film fixtures

Buzz must not be **purchasable**. Money buys *awareness* and contributes to buzz,
but phenomenon-level anticipation requires latent audience demand that marketing
*amplifies* — franchise, star, cultural moment — not a cheque alone. `computeBuzzScore`
currently lets marketing spend reach ~75/100 on its own; the target caps money's
solo contribution well below the top bands.

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

**Real-film buzz fixtures** (compute buzz from *only* pre-release information;
build inputs from handcrafted scripts/talent modelling each equivalent). These
become regression tests — if the buzz system drifts, these break:

| Fixture | Construction (pre-release only) | Target buzz |
|---|---|--:|
| Ordinary studio action film | mid brand, mid fame, ~$30M mktg | **48–58** |
| Well-marketed star vehicle | mid brand, A-list lead, ~$60M mktg | **62–72** |
| Successful horror sequel | genre brand, modest fame, franchise recall | **58–68** |
| Marvel-style tentpole | high brand, ensemble fame, ~$120M mktg, franchise | **80–90** |
| Barbie | high brand, star + director, huge mktg + cultural hook | **90–95** |
| The Force Awakens | franchise return, near-max latent demand | **96–99** |
| Avengers: Endgame | franchise culmination, max latent demand | **98–100** |

The gap between "Marvel-style tentpole" (~85, buildable with money + fame) and
"Endgame" (~99, requires franchise/cultural latent demand) is the exact
non-purchasability property we're asserting: the top two bands must be
**unreachable by marketing spend alone.**

---

## 6. Competition: two levels, one shared matchup model

The diagnosis showed competition is inert because it only touches *availability*,
which only binds when demand exceeds capacity — which never happens. Two
architectural corrections:

**(a) Model competition at both levels, not just exhibition.**

- **Exhibition competition** (what availability already models, once made able to
  bind): screens, premium formats, showtimes, theatre retention, geographic
  rollout. Throughput should stay *physically meaningful* (screens × showings ×
  seats × occupancy), not become a pure balancing knob — but it must be able to
  fall below demand under pressure so it can actually bind.
- **Attention / audience competition** (new): two films with plenty of seats still
  cannibalise each other for awareness, media coverage, urgency, discretionary
  spend, and overlapping demographics. This should suppress the *demand* side
  (awareness growth and/or conversion) directly, weighted by **audience overlap** —
  not just the availability side. This is what lets same-weekend clashes hurt even
  when nobody sells out, and is the seam for counter-programming (opposite
  demographics → low overlap → little mutual harm; the Barbenheimer property).

**(b) Make crowding relative, via one reusable matchup model.**

Build a single **release-strength / matchup** primitive that answers, for any two
releases: *how strong is each, how much does their audience overlap, and who
displaces whom?* Every film uses it to ask: How strong am I? How strong are the
incumbents on my window? How much overlap? Am I likely to displace them, or they
me? The **stronger** film takes screens/attention; the **weaker** one loses them —
the opposite of today's absolute, candidate-blind crowding.

This same primitive is consumed by **both** theatrical settlement (Section 6a) and
AI scheduling (Section 7) — not two parallel formulas. That shared model is the
key architectural payoff.

---

## 7. AI scheduling: contest by strength, don't just avoid

Rivals currently only *avoid* crowded windows (±14-day nudge, identical for all
tiers). Target behaviour, built on the Section 6 matchup model:

- A film **stronger** than a window's incumbents will *tolerate or claim* it —
  majors plant flags on prime weekends and force weaker films off. A film
  **weaker** than the field flees to quiet pockets — everyone else surviving
  cleverly around the majors.
- **Counter-programming:** same-audience clashes carry the split penalty;
  opposite-audience films on the same window are spared it (or benefit), which
  spreads the quiet-pocket survivors across the calendar instead of stacking them.
- **Per-tier frequency emerges from marketing capital + window scarcity**, not a
  flat spawn cadence. Calibration check against researched real volumes: Major
  ~10–15 wide/yr, Mid ~10, Indie/boutique ~4–10 (often limited/platform).

---

## 8. Studio identity: via intermediate systems, emergent from history

Identity must **not** be a flat "+15% horror revenue" multiplier. It influences
the *intermediate* systems, so its effects are believable and legible:

- audiences trust that studio's marketing (→ higher marketing efficiency / awareness
  for on-brand films);
- exhibitors are more confident (→ better opening availability for on-brand films);
- talent is more willing to sign (→ casting/availability edge in that space);
- awareness spreads more easily on-brand (→ external awareness / word-of-mouth);
- competitors *respect that studio's territory* (→ feeds the Section 7 matchup —
  rivals weight an on-brand incumbent as stronger on that window).

And identity **emerges from history** — a studio becomes known for a genre/audience
through repeated commercial success there, rather than being picked upfront. No
hidden revenue multiplier anywhere.

---

## 9. Revised implementation order

Per the designer's refinement — **targets before constants**:

1. **Ratify this document** (the targets + bands below become the spec).
2. Build the **calibration harnesses**: full-year distribution report + assertions,
   profitability-distribution report, buzz-band fixtures. These fail loudly at
   first (that's correct — they encode the target, not the current state).
3. **Recalibrate the funnel**: eligibility layer + interest-generation (lower floor)
   + overall scale, tuned until Sections 2–4 pass. Population stays large.
4. **Recalibrate awareness, opening conversion, and buzz** until Sections 2 & 5
   pass (buzz non-purchasable; opening multiples in range).
5. **Relative competition + capacity that can bind** (Section 6), built as the
   shared matchup model.
6. **Reuse the matchup model for AI scheduling** (Section 7); check per-tier
   frequency.
7. **Evolving studio identity** (Section 8), then re-validate the full-year
   financial + profitability distributions end to end.

The discipline: **no constant changes in steps 3–4 until the step-2 harnesses
exist and encode ratified targets.** We tune against the framework, never by feel.

---

## Open decisions to ratify

The most consequential judgment calls (everything else can follow from these):

1. **Average wide WW gross** — proposed ~$120M (down from $712M). Higher/lower?
2. **% of films unprofitable** — proposed ~45% (up from ~17%). Harsher/softer?
3. **Top-10 annual share** — proposed ~45%. 
4. **Phenomenon ceiling** — proposed ~$2–2.5B preserved. Higher for Avatar-scale?
5. **Buzz non-purchasability line** — confirmed that marketing-alone must cap
   below the top two bands (≤ ~75)?
