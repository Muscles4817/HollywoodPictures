# Review of the market-realism proposal

Reviews `docs/DESIGN_REVIEW_market_realism.md` (called "the proposal" below).
Written for the owner. Nothing here is built; the plan that follows it waits on
the owner's answers to §8.

Method: every claim in the proposal's §1 and §3 was checked against the code;
every citation in §2 was checked against `docs/domain/`; and the diagnosis was
tested by switching one suspected cause off at a time in a scratch copy and
running ten-year careers (Mid-Major, Careful and Steady, six seeds each -
Appendix A). The switches are crude and are not proposals; they measure how
much each cause is worth.

---

## 1. Verdict

The direction is right and the evidence for the symptom is solid. The proposal
should not be built in the order or the size it describes. Six findings, most
important first:

1. **The careful studio's surplus is the after-market, not the cinema run.**
   Across twelve Mid-Major careers the player's cinema income net of marketing
   was *less than the films cost to make* in ten of them. All of the growth is
   post-theatrical income, which for the player is as large as the cinema net
   (the field's calibrated band is 35-55% of rentals). The proposal ranks the
   after-market fourth of five and repeats the earlier finding that it "is not
   the edge". Measured over six seeds, it is most of it (§2.2).
2. **The player's films and rivals' films are not scored by the same model.**
   Player films get person-driven camera, score and edit craft; rivals get a
   flat value. Player shoots net nine good events to two bad; rival shoots
   seven to four. Putting the player on the rivals' craft model alone takes a
   Careful Mid-Major from £334-785M to £45-163M. Part of "the player makes
   better films" is an accounting asymmetry that no amount of rival bidding
   will close. The proposal does not mention it (§2.3).
3. **Two of the five pieces of 4.1 are already built.** Word of mouth already
   reads delivery against the promise (`data/wordOfMouth.ts`), and reviews are
   already weighted by film type (`data/reviewSensitivity.ts`). The proposal
   presents both as new. What is left is tuning two existing mechanisms, which
   is much smaller than "replace reception-as-quality" (§4.1).
4. **The money levers overshoot together.** After-market at the market's rate,
   Brand taken out of marketing, and audience score loosened - roughly step 1
   as proposed - leave *every* Careful career and five of six Steady careers
   smaller than they started, before rivals or difficulty are touched. Steps 2
   and 3 would then land on a studio that already cannot win (§2.4).
5. **The economy is a cliff in quality, and Brand turns "harder" into "dead".**
   Five quality points separate a tenfold career from a flat one. Careers that
   fail end with Brand at 23-48 and do not recover, because Brand feeds the
   next film's reach. Unless that loop is damped first, making the game harder
   produces boom-or-bust, not thin and volatile margins. The earlier
   investigation said this (player economy §13, item 3); the proposal dropped
   it (§2.5, §4.2).
6. **Script reads are the weakest lever and the largest UI change.** Blurring
   the bot's script read by ±20 points left Steady untouched and Careful still
   growing. The quality gap sits in direction and in how the shoot goes, not in
   which script was bought (§4.4).

Recommended shape instead: after-market first and alone; then one scoring model
for everyone; then Brand; and only then decide whether legs and audience score
need touching at all. Rival profiles and script reads are later, smaller, and
optional. §6 has the order.

---

## 2. Is the diagnosis right?

### 2.1 Claims checked against the code

| Proposal's claim | Finding |
|---|---|
| Careful Mid-Major £80M to £330-960M, every time | Confirmed on six seeds: Careful £334-785M, Steady £581-857M. Major (from £200M): Careful £537-953M, Steady £518-1,066M. |
| Player quality 67-75 against rivals' ~50 | Confirmed (65-72 against 49-52). |
| Audience score follows quality one-for-one above 51 | Confirmed (`scoring.ts`, `AUD_QUALITY_GAIN = 1`), with a soft ceiling from 74. |
| After-market multiplies four readings of quality | Understated. Audience score is read **six** times: the reach base, home entertainment, licensing, and catalogue longevity each read it, on top of critic score, awards and studio prestige (`ancillary.ts`). |
| Brand multiplies marketing reach 0.3-1.0 | Confirmed, and it also sets Wide screen count (40% of release strength) and is the largest single term in Buzz (weight 0.55, above cast fame's 0.5). |
| Rivals of a size behave alike | Confirmed. Also: rivals never read a script's hook or accessibility, only craft, originality and price. |
| Careful films return a median +30% to +90% all-in, 20-34% losing | Confirmed, slightly wider: +36% to +115%, 7-37% losing. |
| "A good film making money is too reliable" | Half right. In cinemas the player's films are profitable 37-57% of the time - about the reference's "about half" (11 §9) and no better than rivals' films of the same size. It is the after-market that makes them reliable. |

### 2.2 Where the money comes from

Mid-Major, ten years, £M. "Made" is scripts, greenlights and prep; "cinema" is
rentals net of marketing.

| Career | Made | Cinema | After-market | Awards | Year-10 cash |
|---|---|---|---|---|---|
| Careful 101 | -305 | 285 | 310 | 47 | 334 |
| Careful 102 | -543 | 462 | 550 | 47 | 466 |
| Careful 103 | -923 | 922 | 875 | 29 | 785 |
| Careful 105 | -447 | 378 | 446 | 52 | 392 |
| Steady 101 | -1,861 | 1,185 | 1,527 | 45 | 743 |
| Steady 102 | -1,808 | 1,075 | 1,430 | 36 | 581 |
| Steady 106 | -1,850 | 1,233 | 1,433 | 42 | 711 |

At Major it is starker: Steady loses £700-1,300M in cinemas per career and
takes £1,350-1,990M downstream. The game already has the reference's shape -
theatrical is "an expensive advertisement for every window that follows"
(09 §11.4) - but the windows that follow pay the player about 1.0 per pound of
rentals against the market's 0.38.

### 2.3 Causes the proposal missed or misweighted

- **Two scoring models.** `marketSettlement.ts` passes `personDrivenCraft: true`
  for the player; rivals get `false`, so their post-production score is a flat
  60 against the player's 71-76. Rivals also get no producer effects, no
  director's take, no development swing, no campaign rollout.
- **Shoots that go well.** A player film carries about 13 events netting +33
  quality points (pre-production rehearsals, table reads and design
  breakthroughs are nearly all upside); a rival's nets +10. The bot answers
  every choice with the first option and still gets this.
- **Direction is the widest gap, not scripts.** Below £40M the player's
  direction score is 77-89 against rivals' 64-70; scripts are 71-78 against
  63-67; acting is level. Rivals pick directors on track record near a price;
  the player reads ability and taste for the script, and nobody else is
  competing for that director.
- **Scripts can be bought outright.** Any script with no bid on it can be
  acquired at once at list price (`ACQUIRE_OPPORTUNITY`), and the market offers
  five to nine new scripts a week against under three rival films started.
  "Rivals bid against the player" (4.3) changes nothing while the player can
  buy before an auction exists.
- **Slate width is an edge by itself.** Steady (two films at a time) survives
  every single switch below. Nothing limits a studio's attention across
  parallel films.
- **The bot is weaker than a player.** It never bids, always releases in a
  quiet month, takes the first option in every decision and spends a fixed
  marketing ratio. A human will beat it, so every harness number here
  understates the problem. No acceptance target should be signed off on the
  bot alone.

### 2.4 What each cause is worth

Year-10 cash, £M, from £80M. Range across six seeds; "shrank" counts careers
ending below £80M. Per-seed rows are in Appendix A.

| Switch | Careful | Steady | Shrank (of 12) |
|---|---|---|---|
| Baseline | 334-785 | 581-857 | 0 |
| After-market at the market's rate (no quality readings) | 31-242 | 209-708 | 1 |
| Brand out of marketing reach and Buzz (flat for all) | 71-791 | 413-936 | 1 |
| Audience score follows quality half as steeply | 28-325 | 49-679 | 3 |
| Player on the rivals' craft model | 45-163 | 218-847 | 2 |
| Script read blurred by ±20 points | 143-521 | 520-1,082 | 0 |
| First three together | 8-65 | 33-158 | 11 |

Read with care: seed-to-seed spread is as large as most single effects, and a
career's path is chaotic (one early flop changes every later film). The table
supports orderings, not percentages.

### 2.5 The cliff

Median film quality 68 gives £334-785M; 63 gives £45-163M. The same knife-edge
appeared in the talent model ("widening the scatter brought the snowball
straight back", §7.7). Any change that moves the player's quality by a few
points moves the outcome by multiples, which makes calibration by medians
unsafe and makes the order of work matter: flatten the response first
(after-market, Brand loop), then move quality.

---

## 3. Are the citations right?

All sixty-odd citations were checked. The quoted phrases are almost all
verbatim. Six readings are stronger than the source in ways that bear on the
design:

1. **"Legs come from delivery against the promise, not from quality."** The
   reference says both. "The multiple is set by whether the film is good *and*
   whether it delivered the promise of its own campaign" (09 §12.3);
   "marketing sets the opening; the film sets the multiple" (10 §4);
   "good films build over weeks; bad ones collapse" (16 §8). The misconception
   it lists is that word of mouth is *just* quality. "Quality is neither
   necessary nor sufficient" is the proposal's inference. The design
   conclusion is to keep an absolute reception term and strengthen the gap
   term, not to replace one with the other.
2. **The 1.5% slate.** It is corporate contribution "after overhead and
   interest, over the films' lifetimes" on an illustrative slate (11 §5.4).
   Overhead alone is 10-15% of negative, so before it the slate clears several
   times that. The game charges facility running costs but no per-film
   overhead or interest, so 1.5% is not a like-for-like target (§8, Q2).
3. **Rental terms.** 55-60% against 50-55% is a tentpole against an ordinary
   release (01 §8.4): a property of the film, not the studio. The studio-level
   leverage the reference describes is screens and treatment across a slate
   (09 §7.6).
4. **"None of it buys legs."** Uncited, and the reference disagrees at the
   margin: "exhibitor conviction... legs are impossible without that"
   (10 §4.3), and losing screens is "a real and common way for a good film to
   post a mediocre multiple". Standing protects legs; it does not create them.
5. **Date standoffs and output deals** are attributed to studio standing; the
   reference attributes standoffs to "more sunk cost, a bigger comp history,
   or the more inflexible post schedule" (09 §7.5) and ties partners to the
   film (09 §1.5).
6. **Review sensitivity** is "directional, with wide spread, and best treated
   as elasticities rather than constants", and the rule has a second half the
   proposal dropped: "...and directly proportional to how much the viewer has
   to choose deliberately" (16 §6.2). The existing implementation models that
   second half (genre and audience), which is the better half to model.

On studio brand the reference is **silent, not negative**: nothing says
audiences follow a studio name and nothing says they do not. The proposal
flags its Pixar and A24 examples as outside the reference, correctly.

One small error: "simply is not visible" is 11 §6.4 only; 09 §1 says $30-50M.

---

## 4. The four reworks

### 4.1 What makes money

| Item | Status | Recommendation |
|---|---|---|
| 1. Legs from delivery against the promise | **Already built**, weakly: `EXPECTATION_GAP_WEIGHT` 0.1, bounded 0.7-1.2, and the promise is Buzz with a slope so shallow that a phenomenon and an unknown differ by 13 points of expectation. | Tune, do not rebuild. Later, and only if needed. |
| 2. Reviews by film type | **Already built** by genre, audience and how pre-sold the film is. | Drop from scope. |
| 3. Audience score loosens from quality | New. Contradicts a recorded finding: the gain is 1 because below it "the two voices decorrelated far past the real-world ~0.7" (`scoring.ts`). | Do not change the score. If needed, change what money reads from it. |
| 4. After-market indexed to box office, one bounded premium | New, and the best-supported change in the proposal. | **Do first, alone.** |
| 5. Player-side returns target | New, and wrongly specified. | Redefine (below). |

Risks and interactions:

- **Legs (item 1)** sits on the most fragile calibration in the engine. The
  word-of-mouth loop has run away twice (the "Quantum Signal" incident, the
  reverted crossover experiment), and `RECEPTION_PIVOT` and Wide pacing were
  tuned jointly against opening multiple and run length. Raising the gap
  weight widens the spread of legs, which the variance gate and the regression
  matrix both guard. It can also be gamed: the promise is Buzz, Buzz is mostly
  Brand and marketing, so under-marketing a good film would *improve* its legs
  per viewer. That is real (10 §4.3) but needs the opening to shrink by more
  than the legs grow, which must be tested.
- **Audience score (item 3)** feeds legs, repeat viewing, platform expansion,
  Brand change, awards and the after-market. Halving its response to quality
  sent three of twelve careers into a Brand spiral. A narrower lever with the
  same aim: a stronger soft ceiling, so a quality-70 film scores in the low 80s
  with audiences instead of 91-96, leaving the middle of the market where the
  gates calibrated it.
- **After-market (item 4).** The whole-year gates measure rival films, and the
  field's ratio is anchored at the market median, so a premium centred on the
  median leaves them where they are. The pre-release outlook prose
  (`ancillaryOutlook`) and the awards top-up
  (`ancillarySettlement.ts:accrueAncillaryAwardsPremium`) both read the
  multipliers and must move with them. The premium should be one factor, read
  once, of roughly 0.8 to 1.4 around the median film, with genre keeping its
  own mix. A simpler version than the proposal's: keep the current formulas
  and replace every quality reading with that one bounded "regard" value.
- **Returns target (item 5).** "Median film near break-even all-in" is not
  survivable with the current tail: in the combined run the median film
  returned between -40% and +21% and nearly every studio shrank, because the
  top tenth of films returned only +12% to +213%. Target the career, and the
  share of profit that comes from the top films, not the median film (§8, Q2).

### 4.2 Brand as trade leverage

Right in spirit; three problems.

- **It moves the loop instead of breaking it.** "A studio's recent record with
  exhibitors buys screens and holds" is the same loop - results feed the next
  film's reach - with a different name. Seven of eight Indie rivals end at
  Brand 0-3 because Brand reads cinema profit alone and most small films lose
  money in cinemas. What stops polarisation is Brand drifting back toward a
  level set by a studio's recent output, and a bounded effect. Do that first;
  the proposal omits it.
- **Most of the list already exists or is not studio leverage.** Screens: Brand
  is already 40% of Wide release strength. Talent: studio standing is already
  one of the reasons a person says yes or no (`castingAppeal.ts`, stage 8).
  Rental terms and date standoffs are film-level in the reference (§3). The
  genuinely new piece is the hold: a week's benefit of the doubt before
  screens are pulled, which plugs into the existing screen-collapse rule.
- **It removes a progression the game was designed around.** The code records
  marketing efficiency as "a genuine mid/late-game progression mechanic". With
  it gone, what does a growing studio feel? The proposal should say. Flattening
  efficiency also helps Indie (Brand 20 means 0.44 today) and moves every rival
  film, so the whole-year gates and the Buzz fixtures re-run.

Simpler mechanism with the same effect: keep one Brand number; narrow its
marketing range from 0.3-1.0 to about 0.75-1.0; make it revert toward the
average of the studio's last several releases; keep its screens role and add
the hold. The per-genre studio identity lift (+15% at most, already built)
stays as the one audience-facing studio effect.

### 4.3 Rival profiles that adapt

The largest build in the proposal and the least connected to the measured
cause.

- **Gates measure rival films.** Every box-office gate is a statement about
  what rivals make over six to eight simulated years. Rivals that chase hits,
  reprice genres and change regime make that population drift within a run, so
  a gate can pass or fail on when it was sampled. Adaptation needs bounds and
  the gates need to report by period before it lands.
- **Herding.** Every profile raising the weight of last year's hit genre
  crowds that genre's dates the year after. Realistic, and a source of
  runaway crowding unless the response is slow and capped.
- **"The bot uses the same machinery"** ties the instrument to the thing being
  changed. The bot strategies must stay fixed so before and after compare.
- **What actually closes the gap is narrower:** rivals on the same scoring
  model as the player; rivals valuing hook and reading a director's ability the
  way they already read people they have used; and the best scripts going to a
  short bidding window instead of to whoever clicks first. Static per-studio
  profiles (a data table of weights for the named studios, replacing
  `GENRE_TIER_BIAS`) give distinct identities at a fraction of the cost.
  Adaptation can follow once the market is stable.
- **Notification contract:** a rival taking a script the player was bidding on
  is already notified. A rival moving onto the player's date, or a director
  the player has on hold being booked away, arrives unprompted and owes an
  Inbox item.

### 4.4 Good films become hard to make

- **Script reads** change every development screen and, measured, change
  little: the bot with a ±20 blur still grew at Mid-Major on every seed. The
  script gap is 8-10 points of a 20-point quality gap, and the six script
  stats average out much of the noise.
- **The cheaper levers the proposal lists last are the real ones.** The shoot
  is tilted the player's way (+33 points of events). Rebalancing that, and
  widening the page-to-screen step that already exists
  (`execution.scriptExecution`), reaches the same end without new screens.
- **Availability** is the mechanism the reference stresses ("the best person
  is usually working", 12 §5.6) and stage 8 has started. Measure how often the
  top tenth of directors are actually unavailable to the player before
  designing more; it may already be most of what is needed once rivals want
  the same directors.
- **Notes and cut-by-committee** are new systems with decisions that land on
  due-days. They are a feature in their own right and should not ride in on a
  balance project.
- Anything that arrives later (coverage, notes, a booked person falling out)
  owes the Inbox an item that clears on read.

---

## 5. What is missing

- **Acceptance tests as code.** "No strategy is safe for ten years" has no
  number. It needs a gate like the box-office ones: per tier and strategy, at
  least ten seeds, per-seed rows, with bands for how many careers shrink, how
  many exceed a ceiling, and what share of profit the top films carry.
- **Per-seed reporting.** The existing harness prints medians; medians hid a
  runaway Boutique seed once and would hide the Brand spirals above.
- **A parity test:** the same script, people and plan released once as the
  player and once as a rival should score the same quality.
- **A stronger opponent than the bot,** or a standing owner playtest at each
  step, since a human out-plays it.
- **The small tiers.** Indie ends at £0-8M and Boutique at £8-30M today. Every
  change here makes money harder. Each step must be run at all four tiers, not
  only the two that are too easy.
- **Fat enough tails.** If the target is "a few hits carry the slate", the
  player needs films that return five and ten times. Today the best tenth
  return two to five times. Check whether the phenomenon channels (franchise
  eligibility, event scale) are reachable by a player at all.
- **The rival field as a target:** how many rivals may end a decade at Brand 0
  or out of cash.

---

## 6. Order

Step 1 as proposed is too big: it touches the audience simulation, reception,
the after-market and Brand at once, each of which moves the same harness
numbers, so a regression could not be attributed.

| Step | What | Why here | Moves the box-office gates? |
|---|---|---|---|
| 0 | Instruments: per-seed career gate, parity test, tail report | Everything after is judged by them | No |
| 1 | After-market: one bounded regard premium | Largest measured effect, smallest change, self-contained | No, if centred on the median |
| 2 | One scoring model: rivals get person-driven craft and the same event balance | Removes the accounting asymmetry before anything is tuned against it | Yes - rival quality rises; recalibrate once, here |
| 3 | Brand: reverts toward recent output, narrower marketing range, the hold | Damps the spiral before the game gets harder | Yes, modestly |
| 4 | Stop and measure. Decide whether legs and audience ceiling need tuning | They may not, after 1-3 | - |
| 5 | Rivals compete for inputs: bidding window, hook, directors | Addresses the cause | Yes |
| 6 | Execution spread and availability | Player-side difficulty | No |
| 7 | Optional: rival identities; adaptation; script reads | Flavour and feel | Varies |

---

## 7. Risks

- **Overshoot.** Shown above. Each step needs a "too hard" stop as well as a
  "too easy" one.
- **Seed noise.** Six seeds do not resolve a 20% effect. Ten or more, per-seed
  tables, and the same seeds before and after.
- **Small studios.** Already at the edge.
- **Gate drift.** Steps 2, 3 and 5 move rival films. Recalibrate at step 2 and
  hold the gates fixed after; do not retune them at every step.
- **Felt progression.** Brand's marketing range narrowing takes something away
  from the mid-game. The hold and the screens role need to be visible to the
  player, in words, or the stat reads as dead.

---

## 8. The four open questions

**Q1. Audience-facing labels.** Recommendation: **no new system.** The
reference is silent, the game already has a bounded per-genre studio identity
lift that is exactly a label tied to a kind of film, and a second audience-side
studio effect would re-open the loop Brand is being taken out of. Until
decided, the plan assumes: genre identity stays as built, and Brand's audience
effect is narrowed, not replaced.

**Q2. How lopsided.** Recommendation: **somewhat better than the reference
slate, and specified by career, not by median film.** The 1.5% is after
overhead and interest the game does not charge, and the combined run shows a
median film at break-even means a studio that shrinks. Proposed bands for a
careful strategy at Mid-Major and Major over ten years and ten seeds: one to
three careers end below their starting cash; none above four times it; the
median career ends between one and two and a half times; 35-45% of films lose
money all-in; the best fifth of films earn more than the whole career's
profit. Careless still goes broke. Until decided, the plan assumes these bands.

**Q3. Script reads.** Recommendation: **keep the stats; make the page-to-screen
step uncertain.** Measured, reads change little, and they cost every
development screen. If reads are wanted for feel, do them last, as bands on the
existing bars with the talent-read wording. Until decided, the plan assumes
script stats stay exact.

**Q4. Scope of step 1.** Recommendation: **split, further than the proposal
offers.** After-market first and alone; Brand separately; legs and audience
score only after measuring what the first three steps leave. Until decided,
the plan assumes the order in §6.

Two further questions this review raises:

**Q5.** Rivals moving to the player's scoring model (step 2) raises rival
quality and needs one recalibration of the box-office gates. The alternative -
moving the player down to the rivals' flat model - is cheaper but throws away
the camera, score and edit work. Recommendation: rivals up.

**Q6.** Should buying a script outright stay? Recommendation: keep it for
ordinary scripts and send the best of each week's batch to a short bidding
window, so the best material is contested and the rest stays quick.

---

## Appendix A. Measurements

Scratch harness (not committed): `runBot` for Mid-Major, Careful and Steady,
seeds 101-106, ten years, printing one row per career. Switches, each applied
to every studio, not only the player:

- **After-market:** in `deriveAncillaryMultipliers` and `deriveAncillaryProfile`,
  audience score fixed at 65, critic score 48, studio prestige 50, awards none.
- **Brand:** `computeMarketingEfficiency` returns 0.65; `computeBuzzScore`
  reads Brand as 50.
- **Audience:** `AUD_QUALITY_GAIN` 0.5.
- **Craft model:** `personDrivenCraft` false for the player.
- **Script read:** the bot's `scriptQuality` plus a per-script offset of ±20.

Year-10 cash in £M (start £80M), then median film quality.

| Seed | Base C | Base S | After-mkt C | After-mkt S | Brand C | Brand S | Audience C | Audience S | Craft C | Craft S | Read C | Read S | Three C | Three S |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 101 | 334 | 743 | 174 | 653 | 71 | 936 | 296 | 49 | 45 | 579 | 380 | 1,048 | 8 | 67 |
| 102 | 466 | 581 | 136 | 708 | 320 | 554 | 246 | 653 | 128 | 652 | 154 | 854 | 42 | 33 |
| 103 | 785 | 732 | 83 | 499 | 130 | 697 | 325 | 480 | 133 | 589 | 521 | 635 | 47 | 53 |
| 104 | 655 | 857 | 242 | 523 | 791 | 413 | 28 | 151 | 163 | 218 | 143 | 752 | 21 | 72 |
| 105 | 392 | 856 | 31 | 497 | 96 | 678 | 62 | 444 | 64 | 847 | 383 | 520 | 41 | 50 |
| 106 | 337 | 711 | 168 | 209 | 601 | 881 | 220 | 679 | 116 | 693 | 370 | 1,082 | 65 | 158 |

Median film quality: baseline 65-71; craft model 58-69; script read 59-68.
Careers that failed ended with Brand between 23 and 48.

Quality components, medians, films of £10-40M negative (seed 101 Careful;
other seeds agree within a few points):

| | Quality | Script | Direction | Acting | Production | Post | Net event points |
|---|---|---|---|---|---|---|---|
| Player | 69 | 78 | 77 | 61 | 73 | 75 | +33 |
| Rivals | 49 | 64 | 67 | 60 | 65 | 60 | +10 |

Not measured, and wanted before committing: the box-office gates under each
switch; any tier below Mid-Major; a human player.
