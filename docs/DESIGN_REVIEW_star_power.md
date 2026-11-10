# Design Review — Star Power

*Status: proposed, not built. Grounded in `docs/domain/17-star-power-and-its-decline.md`
(the research) and `docs/DESIGN_REVIEW_box_office_variance_diagnosis.md` §5
(the measured problem).*

---

## 0. TL;DR

Today one number, `fame`, does everything a star does. It is spread wide (one
actor in six is at fame 80 or higher), it never changes as a result of films,
and its box-office effect is a small awareness bump that ignores how good the
film looks. A fame-95 lead moves gross by 1–10% and loses money at market rate.

The research says something more specific and more interesting:

1. **Recognition is not draw.** Many people are famous. A small, ageing top
   tier actually brings people to the cinema, and only in genres that fit them.
2. **A star multiplies, it doesn't add.** The best evidence (a 2017
   meta-analysis) is a multiplier of about 1.08–1.13 on a film's other draws.
   It is worth most on a film that already looks good, and buys only a little
   insurance on one that doesn't.
3. **Stars don't reliably raise profit.** Their fee captures most of their
   value. A star is a bet on your film, not free money.
4. **Draw is earned and lost through openings.** Two flops cut a quote. A
   breakout opening makes a star.
5. **The "death of the movie star" is mostly structural.** Fewer star vehicles
   get made, so fewer stars get built, and the top tier narrows and ages. The
   few still on top have not lost per-film draw.

The proposal: split **fame** (recognition) from a new derived **draw**
(bankability). Draw feeds a multiplier on interest that is gated on how good
the film looks. Draw is built from an opening track record that real releases
update, the player's and rivals' alike. The industry-wide decline is left to
emerge from that, and is measured rather than scripted.

---

## 1. What exists today

| Channel | Where | What fame does |
|---|---|---|
| Awareness | `audienceSimulationInputs.ts:computeCastReachFraction` | Up to 10% extra reach, quadratic in fame (75% lead, 25% director). Independent of the film. |
| Buzz | `scoring.ts:computeBuzzScore` | +0.5 buzz per fame point over 50, and fame + brand unlock more of marketing's buzz. |
| Marketability score | `scoring.ts:computeMarketabilityScore` | 45% weight on lead/support fame. |
| Distributor offers | `distribution.ts:assessCommercialAppeal` | 25% weight on lead + director fame. |
| Salary, choosiness, back end | `talentGenerator.ts`, `castingAppeal.ts`, `backend.ts` | Fee and selectiveness rise with fame and heat. |
| Campaign angle | `releaseFilm.ts` | The `starPower` angle is judged against lead fame. |
| International | `distribution.ts:computeInternationalAppeal` | None. Genre only. |

**Fame and heat never move as a result of films.** The only write-back is the
press tour (`pressTourMoments.ts`). A star who leads three flops is exactly as
famous and as expensive afterwards.

**The tier is wide.** In a generated pool (seed 1), 900 actors break down by fame as:

| 0–19 | 20–39 | 40–59 | 60–69 | 70–79 | 80–89 | 90+ |
|--:|--:|--:|--:|--:|--:|--:|
| 144 | 196 | 205 | 98 | 100 | 88 | 69 |

So 157 actors are at 80+. The research's top tier, the people who can open a
film, is a few dozen at most.

**The measured effect** (diagnosis §5.3, controlled sweep, fame 20 → 95):
opening +4–28%, gross +1–10%, p10 gross +5–21%. Paid at market rate it lowers
return on every plan above fame ~60. The cause is structural: fame adds
*awareness* of a fixed interested audience, so it front-loads the run instead
of growing it.

---

## 2. What the research asks of a model

Each row is a finding from `17`, and what it implies.

| Finding (`17` section) | Implication for the model |
|---|---|
| Steep threshold: only ~19 names in 1984–96 had a measurable link to hits (§4.2) | Draw is near zero for most people and rises steeply at the top. |
| Recognition ≠ draw; NRG top draws are few and old; famous young actors flop (§3.2, §4.2) | Separate fame (people hear about it) from draw (people go because of them). |
| Multiplier ×1.08–1.13 on other drivers (§4.1 Hofmann) | Star acts on *interest*, scaled by how appealing the film already is. |
| Stars cushion bad reviews in week one (§4.1 Basuroy) | A small insurance effect on the opening, independent of quality. |
| Most robust star effect is screen allocation (§4.1 Liu) | Draw lifts a wide release's booking strength. |
| Popularity fades after opening; nothing survives bad WOM (§4.1 Carrillat, De Vany) | Don't touch word of mouth. The run's own dynamics do the fading. |
| No reliable profit effect; stars capture value in salary (§4.1 Ravid, Elberse) | At market rate a star should be about ROI-neutral on average: positive on strong films, negative on weak ones. |
| Persona must match genre (§3.3, `12` §3.3) | Draw is per genre. |
| Draw is built and lost through openings; two flops cut a quote (`12` §3.3) | A stored opening track record that releases update. |
| Franchise openings aren't star openings (`12` §3.3 item 1) | Credit the star less when the film was pre-sold. |
| Market-wide decline = fewer vehicles + narrower tier + smaller market, not weaker top stars (§5) | Don't add a global "stars matter less" dial. Let it emerge and measure it. |
| Star value abroad: not supported now (§6) | No per-star international term. |
| Star worth relatively more on streaming (§7.3) | Optional: draw lifts the TV/streaming licence value. |

---

## 3. The design

### 3.1 Fame stays; draw is new

- **Fame** (stored, unchanged): recognition. It keeps its current jobs: the
  awareness channel, buzz, choosiness, press-tour value.
- **Draw** (derived, 0–1, per genre): how many people go *because of* this
  person. Computed by a pure function in a new `engine/starPower.ts`, from:
  - **fame**, through a steep curve (roughly zero below 65, rising sharply
    from 80). Recognition is necessary but not sufficient.
  - **opening record** (§3.3): recent lead outings scored against the norm for
    their scale, discounted for pre-sold IP. Proven draw beats fame.
  - **genre fit**: a lead's record is per genre. Where there is no record in a
    genre, a persona fallback comes from `actingStyle` (physical → action,
    comedy → comedy, emotional → drama), at reduced strength.
  - **heat**: recent momentum, which decays.

Target shape: in a 900-actor pool, about **15–30 actors with real draw in
their best genre**, and a handful at the top. That is set by the curve and
record, not by regenerating the talent database.

Directors get the same treatment later, if at all. The research names
director brands (Nolan, Coogler, Gerwig) as doing part of the work, but the
director's current fame→awareness channel is a reasonable proxy for now.

### 3.2 What draw does at the box office

Three effects, each tied to a finding:

1. **Turnout multiplier (the main effect).** `baseInterestFraction` is
   multiplied by `1 + draw × MAX_STAR_LIFT × lookGate`.
   - `lookGate` reads **how good the film looks before release**. Its inputs
     are the concept hook, event scale and director, all without the star, so
     the gate isn't circular. It is near 0 below an average look, ramps up
     through "above average", and reaches 1 for a film that clearly looks
     strong. This is the user's "as long as the film looks above average,
     people turn out for the star".
   - Raising interest grows the **ceiling**, not just the opening, which fixes
     the front-loading problem.
2. **Opening insurance (small).** Draw softens a negative
   `openingReviewMultiplier` for week one only. This doesn't depend on the
   look gate: a star buys some first weekend for a badly reviewed film. It
   does nothing for weeks after, because word of mouth isn't touched.
3. **Screens.** Draw adds a little to a wide release's booking strength
   (`releaseStrength` in `computeInitialAvailabilityFraction`).

The existing fame→awareness channel stays as it is. Famous people get a film
noticed, which is a different thing from getting it bought.

### 3.3 Careers: the opening record

- Each actor's career stores a short **lead record**: their last ~5 lead
  outings. Each entry holds the day, genre, an **opening score**, and how
  pre-sold the film was.
  - The opening score is week-one admissions against the norm for that scale
    and genre. A franchise opening counts at a discount, which is the
    attribution argument.
- **Every release updates it**, the player's and rivals' alike. Rivals cast
  from the same pool, so the market makes and breaks stars too.
- After each release, leads' **heat** moves with the opening score, and
  **fame** grows a little with the audience reached. Heat decays over time.
- **Quotes follow draw.** `typicalSalary` drifts toward what the actor's draw
  is worth. Two misses cut it, and a breakout raises it. This is where the
  "rent capture" balance lives.
- **Seeding at game start**: a synthetic record derived stably per person from
  fame, experience and genre, not from rng at load. The world doesn't open
  with 157 equally proven stars. Some famous names are unproven, and a few are
  established draws.

The save shape changes, so `SAVE_KEY` is bumped. There is no migration, per
CLAUDE.md.

### 3.4 What is deliberately not modelled

- **No global decline dial.** The decline should emerge: rivals greenlight IP,
  stars get fewer vehicles, records age out, and the tier narrows. A
  long-horizon diagnostic (§5) reports the tier size and the share of
  star-driven originals over 10+ sim years. If nothing emerges, that is a
  finding about rival greenlighting, not a reason to script a decline.
- **No per-star international term.** The research doesn't support it now.
  The genre-level international split stays.
- **No change to word of mouth.** The research is clear that a star doesn't
  survive bad word of mouth.

### 3.5 Presentation (qualitative, per CLAUDE.md)

- Talent cards gain a draw read: "Opens action films", "Famous, unproven as a
  lead", "Cooling after two misses", "Breakout heat".
- Casting advice explains the bet in words: "A proven draw, and this film
  looks strong enough to use one" versus "Their name won't carry a film that
  looks this uncertain".
- The `starPower` campaign angle is judged against draw, not fame.
- **Notifications** (`docs/DESIGN_notification_contract.md`): a change in an
  actor's standing resolves on the background tick. The player is told when it
  affects them: someone attached to or in negotiation on their project, or
  someone they have a relationship with. The message names the cause (a
  rival film's opening) and links to the talent card. The full checklist runs
  in phase 3's design.

---

## 4. Decisions needed

1. **How big at the top?** The research average for "stars" is ×1.08–1.13.
   - **Recommended:** `MAX_STAR_LIFT` = 0.25. The very top name on a
     strong-looking film gets ×1.25 interest. A typical bankable star on a
     good film gets ×1.08–1.13, matching the meta-analysis. Below the tier
     it's ~×1.0.
   - Alternative, ×1.13 cap: strictly the research average, but then a star is
     barely a decision at all.
   - Alternative, ×1.4 or more: more game-forward. It drifts from the evidence
     and would push the $100M-count and breakeven gates.
2. **ROI target at market rate.** Recommended: about neutral on average,
   positive on strong-looking films, negative on weak ones. That makes casting
   a star a bet on your film, which is the research's "no profit effect" and
   the user's "not a guarantee".
3. **Dynamic careers (§3.3) in the first build, or later?** Recommended: in,
   as phase 3. Without them draw is a static relabel of fame, and the "death of
   the movie star" can't emerge at all.
4. **Streaming licence lift from draw (§2 last row).** Recommended: later,
   optional. It's supported but secondary.

---

## 5. Build plan and gates

| Phase | What | Gate / evidence |
|---|---|---|
| 1 | `engine/starPower.ts` + `data/starPower.ts`: draw from fame curve, genre fit and a seeded record. No box-office change yet. | Tier diagnostic: number of actors with draw ≥ bankable per pool (target 15–30), and their age/fame mix. Unit tests for the curve and genre fit. |
| 2 | Box office: turnout multiplier with the look gate, opening insurance, screens. Distributor offers and the `starPower` angle read draw. | Rework `starPower.diagnostic` into a gate. Rows by look band (weak / average / strong) × draw tier, reporting gross, p10 and return at market rate. Pass: (a) below-tier lift ≈ 0; (b) top tier on a strong look lands in the chosen band; (c) a weak look gets only the insurance; (d) priced ROI ≈ neutral overall. The `boxOfficeDistribution`, `boxOfficeVariance` and `buzzCalibration` gates don't regress. |
| 3 | Careers: lead record on `ActorCareer`, post-release updates for player and rival films, heat decay, quote drift, notifications. Save key bump. | A long-horizon diagnostic over 10–20 sim years per seed reports: tier size over time, star churn (made and lost), the share of top-grossing films that are star-led originals, and median quote of the top tier. No pass/fail at first: it's how we find out whether the decline emerges. |
| 4 | Presentation: talent card draw read, casting advice, `docs/domain/15-game-mapping.md` row update. | Render check with the populated save dump. |

Each phase is a separate commit. Phase 2 is the only one that moves box-office
numbers, so the calibration gates run on it before anything else lands.

---

## 6. Risks

- **Double-counting fame.** Draw is derived partly from fame, and fame already
  feeds awareness and buzz. The look gate excludes the star, and the
  multiplier acts on interest, not awareness, so the channels stay separate.
  The phase 2 sweep checks it.
- **The look gate is a new judgement.** "How good a film looks" before release
  is assembled from existing signals: hook, event scale, director. If it
  tracks final quality too closely, stars become a reward for already-good
  films, which is close to what the multiplier finding says anyway. If it is
  too loose, stars rescue weak films, which the research says they don't.
- **Rival casting.** If rivals cast stars indiscriminately, the market's star
  films will skew to weak looks and flop. That is realistic, but it could also
  shrink the tier fast. Phase 3's diagnostic will show it.
- **Calibration knock-on.** More interest on strong star films pushes the
  $100M count up, which is currently under target, and the top of the
  distribution. That is mostly welcome. The gates decide.
