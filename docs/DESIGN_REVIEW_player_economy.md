# Design review: the player economy

**Status:** findings and proposals. No balance change has been applied; every
number under "Trials" comes from a scratch copy of the engine.

**Question:** the player-economy harness showed a cliff. Below about £25M
starting cash every strategy bleeds out; from £80M a plain scripted player
cannot lose. Why, and how can it be fixed without giving up realism?

**Short answer.** There is no single cause and no single fix. Small studios are
killed by six rules that each depart from how the real business treats a small
film, and that compound: a flat overhead that does not scale with the film, no
overseas income, a judgement made on cinema receipts alone, a Brand penalty
that ignores how few people saw the film, skill that can only be bought by fee,
and a feedback loop that turns each of those into a worse next film. Fixing all
six together, each in the direction the real industry points, turns Indie into
a hard but survivable start and Boutique into a viable one, and leaves the wide
market inside its calibration bands. It does not rescue the two cheapest tiers
and it does not make the top losable; both need mechanisms the game does not
have yet, named in section 7.

---

## 1. How this was measured

`src/state/playerBot.ts` plays a studio through the real reducer under a fixed
strategy. All figures here are from **Careful** (one film at a time, cast for
fit) and **Steady** (two in flight), three seeds each, ten years, from four
starting tiers. The bot is a plain player: it never negotiates, bids, rewrites,
uses producers or optional crew, or campaigns for awards. Its rules are at the
top of that file.

Three seeds per cell is enough for direction and scale, not for decimals.
Differences of a few hundred thousand pounds between single trials are noise.

Since the first harness run the bot gained two things: it records where a
career's money goes (the cash ledger, summed by category), and it grants a
director's creative demands only when the director is proven. Giving in to
every director had cost its small studios about five quality points a film,
which was the bot's fault and not the engine's.

## 2. The cliff, with the money traced

Median over three seeds, ten years, Careful strategy:

| Start | Cash Y10 | Films | Profitable in cinemas | Stalled | Greenlights | Prep overhead | Cinemas net | After-market | Awards cash |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Grassroots £2M | £2.0M | 0 | - | 3/3 | 0 | 0 | 0 | 0 | 0 |
| Indie £8M | £0.7M | 4 | 15% | 3/3 | −£6M | **−£4.1M** | +£2.2M | +£1.9M | 0 |
| Boutique £25M | £1.2M | 10 | 6% | 2/3 | −£25M | **−£12.4M** | +£5.4M | +£9.9M | +£0.3M |
| Mid-Major £80M | £926M | 15 | 60% | 0/3 | −£709M | −£48M | +£709M | +£607M | **+£324M** |

Two things stand out before any analysis. At Indie, pre-production overhead is
two thirds the size of everything else spent on making the films. At Mid-Major,
awards pay out a sum equal to nearly half of what cinemas do.

Release type tells the same story from the other side (baseline, all seeds):

| | Films | Median cost | Median gross | Gross ÷ cost | Profitable in cinemas | Profitable on all income |
|---|--:|--:|--:|--:|--:|--:|
| Boutique, limited | 69 | £2.5M | £1.6M | 0.8 | 7% | 30% |
| Mid-Major, limited | 63 | £9.2M | £33.3M | 3.5 | 67% | 90% |
| Mid-Major, wide | 69 | £107M | £190M | 2.0 | 41% | 72% |

A natural experiment sits in the data: the same screenplay ("The Heist", an
Intimate prestige comedy) came up in the same seed's market for both a Boutique
and a Mid-Major studio. The Boutique version cost £3.6M and grossed £5.1M. The
Mid-Major version cost £13.4M and grossed £53.5M. Four times the spend, ten
times the gross. Sections 3 and 4 account for the difference.

## 3. Why small studios die

Each item gives what the engine does, what the real business does (citing
`docs/domain/`), and how much it matters.

### 3.1 Pre-production overhead is flat per scale

**Engine.** `src/engine/cost.ts:47` charges £25k a day for an Intimate film,
£55k for Medium, £95k for Epic, whatever the film costs. Over a prep of 50 to
60 days that is about £1.4M, £3M and £5.2M. It is charged day by day with no
affordability check (`engine/productionsInProgress.ts:136`), which is how cash
goes below zero, and it is not counted in the film's own cost
(`cost.ts:100`), so the results screen overstates every film's profit.

**Reality.** Prep is 15 to 25% of a budget (`11` §8.1). A micro-budget film
preps for three to five weeks with a crew of 10 to 25 and burns $5k to $30k a
day *on set* (`04` §1, `05` §2). Nothing in the real business charges a £1M
film the prep bill of a £6M one.

**Size.** The largest single line at the bottom. It is why Garage and
Grassroots cannot make a film at all, and at Indie it is −£4.1M against −£6M of
greenlights.

### 3.2 No overseas income without the International facility

**Engine.** `src/data/distribution.ts:114`: reach by tier is `{0: 0, 1: 0.4,
2: 0.7, 3: 1.0}`. Tier 0 is a hard gate. Tier 1 needs the Distribution Arm
first, which needs four released films or a Brand milestone, then £2.5M.

**Reality.** A producer with no overseas operation sells territories through a
sales agent, who takes 10 to 25% plus expenses (`11` §8.3, `03` §1.4). The
income is smaller and comes with a middleman; it is never nil. The mapping
document records pre-sales as omitted (`15` L82).

**Size.** Roughly half of worldwide gross, lost on every film a small studio
makes. In the trial it raised the share of Indie films profitable in cinemas
from 15% to 38%.

### 3.3 A film is judged on cinemas alone

**Engine.** `engine/boxOfficeRun.ts:177` computes profit as theatrical revenue
minus cost and hands that to both the outcome label (`outcome.ts:50`: a ratio
of −0.5 or worse is a Flop) and the Brand change.

**Reality.** "Most films recoup after theatrical"; success is judged on
ultimates, roughly ten years of all income (`11` §5.1, `10` §8.7). For a
prestige or adult drama, cinemas are 30 to 45% of lifetime revenue (`11` §3.4).
The game already models that income well (`engine/ancillary.ts`); it just does
not consult it when passing judgement.

**Size.** At Boutique, 7% of limited releases profit in cinemas but 30% profit
on all income. The other 23% are labelled Weak or Flop and punished as such.

### 3.4 A miss costs the same Brand whether anyone saw it or not

**Engine.** `engine/reputation.ts:55`: a Flop is −8 Brand, a Weak −2, a Hit +5,
a big hit +7, with no reference to scale. Brand then sets how far marketing
money goes (`audienceSimulationInputs.ts:549`, efficiency 0.3 at Brand 0 to 1.0
at Brand 100) and adds `(Brand − 50) × 0.55` to buzz (`scoring.ts:1101`).

**Reality.** Brand is name recognition. A film that played to a few thousand
people cannot erase it, and a small success cannot build it the way a film seen
by millions does.

**Size.** This is the loop that turns the other five into a spiral. Every
failing small studio in the baseline reached Brand 0 to 5, which costs 27 buzz
points and 70% of marketing efficiency on the next film. It is equally the
ratchet at the top: Mid-Major reaches Brand 100 by year 5.

### 3.5 Skill can only be bought by fee

**Engine.** `engine/talentGenerator.ts:193`: skill is `25 + 65·t ± 20`, where
`t` is the person's position in the fee range. A £60k director averages about
32 and cannot exceed about 52. Actors are exempt (their craft is seeded
separately), which is why acting scores barely differ between tiers.

**Reality.** Fees track fame and track record, not ability. The undiscovered
good director is the independent sector's whole business model.

**Size.** The scoring maths itself barely reads money: maxing every spending
dial on an Indie film adds under one quality point. Yet Indie films average
quality 43 against 62 at Mid-Major. Of that gap, direction accounts for 5.6
points, script 4.6, acting 1.8. Replacing an Indie film's director with the
best one at the same fee changes nothing, because there is no better one at
that fee; the best at any price adds 14 points.

Two smaller rules do punish cheapness directly and are worth correcting for
honesty, though they move quality by a point or less: shooting-budget quality
is read on an absolute £100k to £75M scale with no reference to what the script
needs (`productionDials.ts:22`), and a fully realised small design is capped at
62 (`facetModel.ts`, `ceilingLow`).

### 3.6 Wide distribution for a small film is a guaranteed loss, and nobody ever says no

**Engine.** Any film may take a wide release through a rented distributor
(`engine/distribution.ts:158`). Three offers always arrive. The campaign is
sized by appeal between £3M and £60M and recouped in full off the top. A £2.9M
film took a £28.7M campaign, grossed £37M, and returned nothing to the studio,
which then lost 7 Brand for the "Flop".

**Reality.** The numbers are right: a wide release has a floor of $25 to 35M in
P&A and the distributor does recoup first (`11` §6.4, `10` §8.6). What is
missing is everything else about how that deal works. A distributor that wants
the film pays a minimum guarantee, about half the negative in the worked
example; one that does not, passes, and "nobody bids" is the common outcome
(`03` §5.2). The mapping document records pickups and guarantees as omitted
(`15` L82, L202).

**Size.** Not trialled, because it needs a new mechanism and not a constant.
It is the most likely answer to the two cheapest tiers (section 7).

### 3.7 A bug that makes all of the above permanent

`SCHEDULE_RELEASE` refuses when the marketing charge exceeds cash. With cash
below zero that refuses a release with no marketing at all, so a finished film
can never come out and the studio can never earn its way back. This is a
defect whatever the balance ends up being.

## 4. Why large studios cannot lose

- **Awards pay cash on the whole run.** `data/awards.ts:132`: each ceremony
  credits up to 40% of a film's theatrical revenue. In reality a Best Picture
  nomination lifts the *remaining* gross of a platform release by 30 to 100%
  and does about nothing for a tentpole that has finished its run (`13` §1.1).
  Awards cash was £324M to £392M per Mid-Major career, 15 to 20% of all income.
- **Rivals do not contest quality or awards.** Already on the work list. The
  bot wins 80 to 130 awards per career without campaigning.
- **Brand saturates and stays.** Section 3.4, from the other end.
- **There is no cost of being big.** The mapping document says so (`15` L234):
  no studio overhead, no interest, no slate P&L. Real studios charge each film
  10 to 15% of negative in overhead and 5 to 10% in interest (`11` §13), carry
  hundreds of millions a year in fixed cost, and write off $40 to 100M a year
  of development (`11` §5.5). A representative twelve-film slate returns about
  1.5% (`11` §5.4).

That last item matters less than it sounds. A Steady Mid-Major career
greenlights about £1.4B in ten years; a 20% overhead and interest charge would
take about £280M of a £1.16B ending balance. A real dent, not a ceiling. The
ceiling has to come from rivals and from Brand not being permanent.

## 5. Two suspects that turned out not to matter

- **Limited releases expanding without limit.** Capping a platform release at a
  third of screens changed nothing at any tier. The large limited grosses at
  Mid-Major come from Brand, marketing and overseas reach multiplying, not from
  runaway expansion.
- **Cheap films being marked down for being cheap.** Covered in 3.5: the
  scoring chain is nearly blind to money. The problem is who a small studio can
  hire.

## 6. Trials

Each change was applied to a scratch copy and run through the harness. Median
cash at year 10, then careers stalled out of three.

| Change | Indie Careful | Indie Steady | Boutique Careful | Boutique Steady | Mid-Major Careful | Mid-Major Steady |
|---|--:|--:|--:|--:|--:|--:|
| Baseline | £0.7M, 3 | £1.7M, 2 | £1.2M, 2 | −£0.1M, 1 | £926M | £1,162M |
| A. Prep overhead follows the film | £0.4M, 2 | £0.4M, 2 | £0.7M, 1 | £0.2M, 0 | £809M | £1,273M |
| B. Overseas reach 0.3 without the facility | −£0.2M, 2 | −£0.2M, 2 | £1.6M, 2 | £0.3M, 2 | £789M | £1,189M |
| C. Skill less tied to fee | −£0.2M, 0 | £1.3M, 3 | £2.1M, 1 | £1.7M, 3 | £1,128M | £1,080M |
| D. Judge on all income | £1.3M, 3 | £1.4M, 3 | £2.8M, 0 | £1.9M, 2 | £1,121M | £1,137M |
| E. Awards cash cut to a quarter | −£0.9M, 2 | £0.3M, 2 | £0.2M, 0 | £0.0M, 3 | £670M | £550M |
| **A+B+C+D+E, with Brand scaled by reach** | **£1.6M, 0** | **£0.2M, 1** | **£20.7M, 0** | **£70.3M, 0** | **£791M** | **£865M** |

What the trials used:

- **A.** Daily prep burn = 0.4% of the film's committed negative, floor £2k,
  capped at today's per-scale rate. That is about 20% of budget over a typical
  prep.
- **B.** Overseas reach by tier `{0: 0.3, 1: 0.5, 2: 0.75, 3: 1.0}`.
- **C.** Skill = `35 + 45·t ± 30` (was `25 + 65·t ± 20`).
- **D.** Outcome label and Brand use theatrical profit plus the film's expected
  lifetime after-market income. The profit shown to the player is unchanged.
- **E.** Award bump fractions cut to a quarter (nomination 0.8%, win 3%, cap
  10%).
- **Brand by reach.** Brand's profit and audience terms are multiplied by
  `clamp(gross ÷ £30M, 0.15, 1)`, in both directions.

Reading the table:

- **No single change rescues a small studio.** Each one removes a cost or adds
  an income, and the Brand loop takes it back.
- **Together they do.** No Indie Careful career stalled; Boutique grows.
  Quality at Indie rose from 43 to 51 and at Boutique from 48 to 61.
- **Brand must scale both ways.** An earlier combination scaled only the
  penalty. Indie then reached Brand 100 and Boutique Steady reached £456M,
  which moves the snowball down a tier instead of removing it.
- **Indie is still hard.** The plain bot ends below where it started. A player
  who negotiates and picks carefully should do better, which is about where the
  first rung of a difficulty ladder belongs.
- **Grassroots is not rescued.** With the changes it makes two films and ends
  at −£0.5M.
- **The top is not fixed.** £800M to £900M at year 10, Brand and Prestige 100.

Side effects of the combination on what already exists:

- **Whole-market distribution gate:** 18 of 21 bands before, 18 of 21 after,
  but a different three. Wide releases over £100M a year moved into band (51.8
  to 57.6). The share of wide releases that lose money moved out (45.5% to
  37.5%, band 40 to 52), because rivals draw from the same talent pool and get
  better people for the same fees. Specialty releases a year sat on the edge of
  its band both times. Break-even share stays failing by earlier decision.
- **Buzz gate:** passes before and after.
- **Unit tests:** seven would need updating. All pin the constants being
  changed (tier-0 reach of zero, the flat prep rate, the Brand table).

## 7. What I would do, in order

1. **Fix the release lock (3.7)** and decide what zero cash means. Small, and
   independent of everything else.
2. **Prep overhead follows the film (A)**, and prep and the screenplay are
   counted in the film's own cost so the results screen tells the truth.
3. **Judge on all income (D) and scale Brand by reach.** These two belong
   together; D alone feeds the Brand ratchet.
4. **Overseas sales without the facility (B)**, at a lower keep than a
   studio's own operation, so the International facility remains worth buying.
5. **Loosen skill from fee (C).** This one changes rivals too, so re-run the
   box-office gates and expect to retune the share of wide releases that lose
   money. It also wants a companion: once a cheap director makes a hit, their
   fee should rise. That is the talent-careers item already on the work list.
6. **Awards cash on the remaining run only (E).** The quarter-size trial is a
   stand-in; the realistic rule is a lift for films still in cinemas and
   nothing for those that have left.

Then two pieces of new design, which the trials show are needed and which no
constant can supply:

7. **Selling a film (for the bottom).** A finished or packaged film can be
   offered to distributors. One that wants it pays a guarantee up front and
   takes the release and its costs; a weak film gets no offer. This is how real
   small producers survive, it gives Garage and Grassroots a way to finish a
   film and be paid, and it replaces the current rule that every film is
   offered three wide deals.
8. **The cost of being big (for the top).** A per-film overhead and interest
   charge that grows with the studio's facilities, plus Brand that decays
   without fresh hits. Together with rivals that compete, this is what makes a
   large studio need its slate to work.

## 8. Decisions needed

- **Is "Indie is hard for a plain player" the right target for the third
  tier?** If Indie should be comfortable, the after-market or overseas terms
  need to be more generous than trialled.
- **Should Garage and Grassroots be playable before item 7 exists?** If yes,
  they need more starting cash in the meantime. If no, they should be hidden
  until it does.
- **Is skill-for-fee (C) acceptable given it moves the calibrated market?**
  The alternative is to leave the pool alone and add a small number of
  deliberately underpriced people each year, which is closer to "discovery"
  and touches rivals less.

## 9. Reproducing this

```bash
PLAYER_ECONOMY_DIAGNOSTIC=1 TIERS=indie STRATEGIES=Careful,Steady DUMP_OUT=/tmp/indie.json \
  npx vitest run src/state/playerEconomy.diagnostic.test.ts --disable-console-intercept
```

The harness prints, per strategy, the money-out and money-in lines used in
section 2. The trial edits are described exactly in section 6; none is in the
repository.
