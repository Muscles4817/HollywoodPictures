# Script Information Model, Phase 2: Coverage — Design Spec (v0.2 draft)

> Status: **draft, awaiting greenlight.** Nothing here is implemented. Numbers
> are shapes, not final tuning. **OPEN** marks a decision deliberately left to
> the greenlight conversation; **DECIDED** marks one that has now been settled,
> with the reasoning that settled it.

---

## 0. Where this sits

The agreed sequence for making script quality a judgment rather than a readout:

| Phase | Name | Status |
| --- | --- | --- |
| — | Price scripts off their earning ceiling; complexity out of the quality star; role demands read the script | **landed** (PR #170) |
| 1 | Script generation carries real, evaluable content | not started |
| **2** | **Coverage — quality becomes somebody's opinion** | **this document** |
| 3 | Multiple signal sources (writer track record, rival interest, attachments) + sourcing/access (§6.3) + writer deals (§8.1) | not started |
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

**DECIDED: the tone profile stays visible.** It is arguably a judgment — someone
had to read the script to know it's a comedy — but so is knowing its genre or
its page count. Tone is how the script is *positioned* rather than a verdict on
whether it works, and a logline plus a genre tag genuinely do convey it. The
fact/judgment line above is the one to hold; tone sits on the fact side of it.

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

### 5.3 Four axes, not a page of prose

**DECIDED: coverage is the four axis scores modelled above, plus a verdict and
prose notes.** This was previously assumed rather than argued; it is now
settled, and the alternative is worth recording because it is where this should
eventually go.

The rejected-for-now alternative: a real coverage is a logline, a synopsis, a
comment and a verdict — `02` §5.3 shows the document, and while it does carry a
box-score grid (premise / story-structure / characters / dialogue / production
value, which the game's four axes already sit almost exactly on top of), what
the executive actually reads is the comment. A single grade plus prose is the
better long-term destination for this game too. Two reasons it is not the Phase
2 shape:

- **Prose leans on Phase 1.** What a reader can say about a script is bounded by
  what the script *is*. Coverage prose only gets better than the script content
  underneath it in the sense of being wrong about it. Phase 2 is deliberately
  shippable without Phase 1 (§0), and prose-only coverage would break that.
- **Four axes are what make bias learnable.** "Marla reads dialogue hot" is only
  something a player can notice if dialogue is a thing Marla visibly rates. A
  single grade folds the bias into one number and the learning loop in §10 has
  nothing to converge on — which would quietly cost the layer its second design
  goal (§2.3).

**Later evolution, not a rewrite:** once Phase 1 lands, the axes can recede into
the detail and the comment become the headline without touching the model. The
perceived values would still drive the prose, exactly as §9 already has them do.

## 6. The Story Department (facility)

Coverage needs a home. Readers parked loose on the staffing board work, but they
give the player nothing to *invest in* — and reading capacity, which is the real
scarcity this phase creates (§6.3, §7.2), has nowhere to be upgraded from.

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

**Writers themselves stay free agents** — see §8.1, where the real instruments
for tying a writer to a studio live. Nobody in this facility writes anything.

### 6.2 Shape — the established facility pattern

Identical in shape to the two facilities that already exist, so this is a well-
worn path rather than a new concept:

```ts
interface StoryDepartment {
  tier: number;              // reading capacity — data/storyDepartment.ts
  sourcingTier?: number;     // Phase 3 track, inert in this phase (§6.3)
  analystIds: string[];      // hired analysts, by id; Person records live in the pool
}
// Studio.storyDepartment?: StoryDepartment | null   — absent/null == not unlocked
```

- `UNLOCK_STORY_DEPARTMENT`, `UPGRADE_STORY_DEPARTMENT`, `HIRE_STORY_ANALYST`
  reducer actions, mirroring `UNLOCK_PRODUCTION_OFFICE` / `UPGRADE_…` /
  the bench-hire action at `state/studioReducer.ts:1199+`.
- Tier → concurrent reading capacity (§7.2), the way
  `data/producers.ts:OFFICE_BENCH_CAPACITY_BY_TIER` governs the producer bench.
- Presence == unlocked. Read defensively, no migration pass.

**DECIDED: purchasable from day one at tier 1, not milestone-gated.** Both
existing facilities (Production Office, Distribution Arm) unlock via a
milestone; this one deliberately does not. The reason is that §13's first risk
is the phase's largest: a player fogged out of the market with no signal they
can afford. A milestone gate would mean a stretch of the early game in which
the player is told quality is now somebody's opinion and given no way to buy an
opinion. Below the purchasable tier sits the free assistant-tier read (§6.3), so
the ladder is: never blind → cheap and bad → purchasable and better. A studio
should never be *unable* to buy a read.

**DECIDED: starting stature grants a Story Department at a scaled tier.** The
seven stature tiers in `components/common/DifficultyPicker.tsx` already hand a
new studio the Brand and Prestige that stature implies; a Legacy Powerhouse with
a century of hits behind it and no story department would read as odd. Shape,
not tuning:

| Starting stature | Story Department |
| --- | --- |
| Garage Outfit, Grassroots Indie | none — the free assistant read (§6.3) |
| Established Indie, Boutique Studio | tier 1 |
| Mid-Major Studio, Major Studio | tier 2 |
| Legacy Powerhouse | tier 3 |

Two honest notes on this. First, `DifficultyChoice` currently carries only cash,
brand and prestige, so it gains a field — small, but it is a change to the
picker, not just to data. Second, this makes the Story Department the first
facility a stature start can arrive already holding, since the milestone-gated
two never do. That is consistent rather than inconsistent: it is the same
property as being purchasable from day one, which is exactly the thing that
distinguishes this facility from the other two.

### 6.3 Two functions now, and a third that is Phase 3

**DECIDED: the Story Department is a two-function facility in this phase.**
Reading capacity and read quality ship; sourcing does not.

1. **Reading capacity** (tier). How many scripts you can have *being read at
   once* (§7.2). The binding constraint: you cannot read the whole market, so
   *what to spend a read on* becomes a real decision. Without a department you
   fall back to the assistant tier — one slow, low-acuity read at a time.
2. **Read quality.** Better analysts to hire onto the bench. Upgrades narrow
   noise; they **never** remove taste bias (§5). There is no reader who tells the
   truth, at any tier. Game-side, three populations mirroring `02` §5.1's:

   | Who | Acuity | Cost | Throughput |
   | --- | --- | --- | --- |
   | Assistant read (no department) | ~25 | free | one at a time, slow |
   | Freelance reader | ~40 | per-script fee | one desk each, hired per read |
   | Staff story analyst | ~55–80 by hire | salaried | a desk each, count set by tier |

   The free assistant read is the floor that keeps a broke studio in the game
   (§13), and it is deliberately bad enough to be worth upgrading away from.

   **DECIDED: an analyst's CV is visible at hire; their `acuity` number is not.**
   Credits, years in the job, where they trained, what they are known for — the
   same fog this phase applies to scripts, applied one level up. A hire is
   itself a judgment call, and a studio that could read acuity off a number
   would be back to arithmetic, just about people instead of screenplays. (This
   decision was made against an earlier draft of this section and lost when the
   section was rewritten around the facility; it is reinstated here.)

3. **Sourcing / access** (`sourcingTier`, an independent second track — exactly
   how `productionOffice.marketResearchTier` sits alongside its bench) —
   **Phase 3.** `01` §3.4: a pod's real product is "*access to material before
   the market*." Higher sourcing would mean seeing the slate earlier than rivals
   do. The field exists on the type from day one and the UI renders the track
   as a **visibly locked row**, so nothing needs re-plumbing when it lands — but
   it has zero behaviour in this phase. Three reasons it is deferred, all worth recording:

   - **It is a structural change, not a facility tier.** Today an `Opportunity`
     is a single shared world object: `state.opportunities` is one array, the
     Opportunity Market renders it, and `engine/rivalStudios.ts` filters the
     same array. Early access requires a per-studio notion of *opportunity
     visibility* — who can see what, and from when — which is surgery on
     `engine/opportunities.ts` and its weekly batch, not a number on a facility.
   - **Its payoff is invisible in Phase 2.** Rival interest is not shown to the
     player until Phase 3 (§11). A player with early access would look, buy
     uncontested, and never learn that they had just avoided losing it — the
     upgrade would feel like nothing, because the thing it prevents is the thing
     the player can't see.
   - **It stacks too much into one track.** Early access, plus a head start on
     the read clock (§7), plus buying before an auction can form is a very large
     compounding advantage. It should be tuned when rival behaviour is legible
     enough for a human to judge whether it is fair, which is Phase 3.

### 6.4 Keeping it distinct from Market Research

The Production Office already sells information via `marketResearchTier`. Two
"buy information" facilities will blur unless the split is stated and held:

| | Question it answers | Bought from |
| --- | --- | --- |
| **Market Research** | Will an audience turn up for this? | Production Office |
| **Story Department** | Is the script any good? | Story Department |

Audience-side versus script-side. A coverage should never mention box office; a
market research report should never grade dialogue.

## 7. Reads take days

Commissioning coverage does not return an answer. It starts a clock, and the
coverage lands some days later. This is genuinely new — nothing in the game
currently makes the player wait for *information* — and it is where most of the
phase's gameplay actually is, because the read clock **races two clocks the
market already runs**:

- **Expiry.** Every `Opportunity` carries an `expiresOnDay` fixed at generation.
  `engine/opportunities.ts:SOURCE_EXPIRY_DAYS` gives a Spec Screenplay 15–30
  days, an Agent Package 10–20, Publisher Rights 30–60. Past it the listing is
  gone whether or not the player ever looked at it.
- **Bidding.** An opportunity whose `bids` array is empty is an instant buy at
  `acquisitionCost`. The moment a rival wants it too
  (`engine/rivalStudios.ts:considerBiddingOnOpportunity`) it stops being a
  purchase and becomes an English auction that resolves at the next weekly tick
  (`settleOpportunities`, `WEEK_LENGTH_DAYS = 7`) — and opportunities are
  generated on that same weekly beat, in batches of three to six.

So the fog is not only "you don't know whether it's good." It is **you don't
know yet, and the thing will not wait for you**. You can lose a script while you
are still deciding whether you want it. That is the actual executive job, and
the industry runs it on exactly this compression: `02` §2.1's spec go-out mails
the script Friday morning, hands assistants rush reads that afternoon, orders
coverage on everything else, and takes offers Monday at 9am. Nobody in that
weekend has finished reading by the time they have to decide.

An in-flight read is stored state, not a derived view — the moment it is
commissioned it has a fee charged, a reader attached and a delivery day:

```ts
interface CoverageOrder {
  id: string;
  readerId: string;
  scriptId: string;
  /** The market listing this was commissioned against, absent for an owned asset (§8). */
  opportunityId?: string;
  commissionedOnDay: number;
  deliversOnDay: number;
  fee: number;
}
// Studio.coverageOrders: CoverageOrder[]   — settled on the same day-advance
// path settleOpportunities already runs on, so a skipped week can't strand one.
```

### 7.1 How long a read takes

`02` §5.2 puts a careful read at 2.5–5 hours of work and a professional
turnaround at **24–48 hours**, with overnight or same-day possible on a weekend
go-out. The tier that slips is the assistant, who per `02` §5.1 is reading "at
11pm after a twelve-hour desk day." Game-side, stretched out to be legible
against a weekly market beat — shapes, not tuning:

| Reader | Acuity (§6.3) | Days to deliver |
| --- | --- | --- |
| Assistant read (no department) | ~25 | 5 |
| Freelance reader | ~40 | 3 |
| Staff story analyst | ~55–80 | 2, or 1 at the top department tier |

Two consequences of those numbers against `SOURCE_EXPIRY_DAYS` are deliberate
and should survive tuning: an Agent Package can expire inside two assistant
reads, and a read commissioned late in a week frequently delivers *after* the
weekly tick that resolves any auction on it. The cheapest reader is not merely
worse; they are slower than the market.

Duration is fixed **at commission time**, from the reader and the department
tier then in force, and stored on the order as `deliversOnDay`. Upgrading the
department mid-read does not accelerate a read already running — the desk it is
sitting on has not changed.

The delivery day is a **fact, not a judgment** (§3), and is shown from the
moment the read is commissioned: "Marla Chen · reading · lands day 17". Fogging
the ETA would add anxiety without adding a decision, and the player needs it to
weigh the read against the expiry date already printed on the listing.

### 7.2 Capacity is desks, not a weekly quota

**DECIDED: a reader is occupied for the duration of a read, and department tier
sets how many reads can be in flight at once.** Capacity is concurrency.

The alternative is the more literally accurate one: `02` §5.1 describes a staff
analyst as salaried "with a weekly script quota" of 8–15 scripts. But a quota
that refills on the weekly beat plays badly. It is spend-it-or-lose-it, so it
pushes the player to dump unused reads at the tick on whatever is left, and the
interesting question — *this script, now, before it goes* — collapses into
end-of-week bookkeeping. Concurrency puts the scarcity in the same currency as
the race in §7: a desk that is busy is a script you are not reading while this
week's batch lands.

It is also the shape this codebase already has: the producer bench
(`data/producers.ts:OFFICE_BENCH_CAPACITY_BY_TIER`) is a tier-scaled count of
occupied slots, and §6.2 is already modelled on it.

The quota realism is not lost, only expressed differently: with *N* desks at *D*
days each, weekly throughput is roughly 7*N*/*D*. A tier-3 department with three
staff analysts reading in two days apiece lands at about ten scripts a week —
inside `02` §5.1's 8–15. If tuning ever puts throughput far outside that band,
the tuning is wrong.

The assistant fallback is exactly one desk at the slowest duration. That is what
"one slow, low-acuity read at a time" (§6.3) means mechanically.

### 7.3 Rush reads

**OPEN:** can the player pay to jump a read to the front, or shorten it?

The case for is real: `02` §2.1 has assistants "handed rush reads" on a Friday
go-out and `02` §5.2 allows overnight or same-day turnaround, so a rush is not
an invention. The case against is that a purchasable rush converts this phase's
central tension into a cash check — a rich studio simply buys its way out of
the clock, and the clock stops being the constraint that makes the department
worth upgrading.

**Recommendation: not in the first build.** If it goes in afterwards, price it
in *acuity* as well as cash — a rushed read is a worse read, which is precisely
what `02` §5.2 says ("a reader clearing three scripts a day is not reading them
carefully"). That keeps a rush a trade rather than a purchase, and it is the one
version of the feature that does not undo §7.2.

### 7.4 When the script goes away mid-read

Three cases, and they all resolve the same way. **DECIDED: coverage you paid
for is kept — the read completes on its own schedule and the document is yours
— whether or not you end up owning the script.**

- **The opportunity expires.** Coverage lands, filed against the script.
- **A rival wins the auction.** Coverage lands, filed against the script.
- **The player buys it mid-read.** Coverage lands against the owned asset
  instead of the listing (§8) — nothing is interrupted.

The fee is not refunded in any of them. You bought a reader's time, not an
outcome, and the non-refund is the sting that makes commissioning a decision
rather than a reflex. It is also the case with the strongest real-world footing:
per `02` §5.5, coverage is *stored* — studios keep searchable databases going
back decades, old coverage resurfaces when a script is resubmitted, and "a bad
coverage follows a script around town." Coverage outliving the deal is how the
real system works.

Retained coverage has three live uses, so this is not merely consolation:

- It is the reader's track record accumulating (§10) — a read on a script a
  rival bought still scores that reader once the resulting film releases.
- It is a memory of the market: the player knows what they thought of a script
  before, if a variant of it comes round again.
- It is what makes covering an owned asset useful (§8).

Delivery is announced in the inbox, including the sour ones: "Coverage on
*Nightjar* — sold to Meridian on Tuesday." The player should be told the read
was overtaken, not left to work it out from a listing that quietly vanished.

Dismissing an analyst cancels their in-flight reads, with no refund. An order
never sits in the queue with no reader attached.

## 8. Multiple reads and triangulation

Coverage can be commissioned on **both** market opportunities and assets the
studio already owns. **DECIDED**, and both directions matter: covering before
buying is the whole point of the phase, and covering *after* buying is how the
player decides whether a script needs a rewrite before it goes near production.
An owned asset has no expiry and no rival bidding on it, so the read clock there
is a cost and a wait rather than a race.

Commission a second opinion on the same script. The UI shows both, attributed
and side by side, **never averaged into a single truth**. Convergent reads read
as confidence; a split is information in itself.

Cap at 3 coverages per script — past that the UI gets noisy and the marginal
information is small.

### 8.1 Writers stay free agents — deals, not desks

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

## 9. UI

Reuse the existing star components wholesale. Same pixels, different epistemic
status:

```
MARLA CHEN · COVERAGE · Day 14                          RECOMMEND
  Writing   ★★★★☆        Concept   ★★★☆☆
  "Dialogue crackles. The second act sags badly."

No coverage yet — commission a read.   [ Story analyst · 2 days · £1,200 ]
                                       [ Assistant     · 5 days · free   ]

Reading — Marla Chen, lands day 17.    Expires day 19.
```

Unread scripts show the production facts and a call to action where the stars
were. That reframe alone — stars as *someone's opinion* rather than truth — is
most of the value of this phase for a fraction of the work.

The in-flight line is a first-class state, not a spinner: the reader's name, the
delivery day, and the listing's own expiry day next to it, because that
comparison is the decision (§7). Every desk in use is shown on the Story
Department card the way bench occupancy already is.

The Story Department card also carries the **locked sourcing row** (§6.3),
rendered explicitly as a later phase rather than as an unaffordable upgrade —
no price, no button, a plain "Access & sourcing — not yet available". A greyed
button with a cost would read as a bug.

Prose notes come from the reader's own `read`, so a biased reader writes biased
notes. This reuses the existing `scriptPresentation` prose machinery pointed at
`Coverage.read` instead of `Script`.

## 10. Post-release revelation

On release, the film detail modal shows the script's **true** values alongside
every coverage written about it. This is the learning loop and it is not
optional — without it, a flop is arbitrary rather than instructive.

After N films, surface a per-reader track record.

**DECIDED: the track record shows a hit rate, not a measured bias.** "Marla:
4 Recommends, 1 hit" rather than "Marla reads dialogue +11 hot across 12
scripts." The player still does the inference. Handing over the correction
factor would turn the one skill this layer sells (§2.3) back into arithmetic —
subtract 11 from her dialogue star and you have the true value again, which is
precisely the failure §1 describes, reintroduced one level up.

## 11. Rivals must play the same game

`engine/rivalStudios.ts` gets reader profiles too and buys on *perceived* value.

This is load-bearing. If rivals see truth and the player doesn't, the player
loses every good script by construction. With biased rivals, they sometimes
overpay for junk and pass on gems — which is what makes "a script being fought
over" a real but fallible signal, and creates mistakes the player can exploit.

**DECIDED: rival *interest* stays invisible in this phase.** It is Phase 3's
signal, and it needs stating precisely, because the market is not silent today:
once a rival actually bids, the auction is public — `Opportunity.bids` is
"always the full, visible list, never sealed", and the Opportunity Market names
the current leader. What Phase 2 does **not** add is any *pre-bid* temperature:
no "two other studios are circling this", no tracking-board heat, nothing
equivalent to `02` §2.1's Friday-evening "are you in?" calls.

So in this phase the player learns of a rival's interest only once it has
already hardened into a bid — late, blunt, and often after the read they
commissioned has been overtaken. That is deliberate. Rival interest only works
as a *quality* signal when it is legible before the auction forms, and building
it early would also make the sourcing track look pointless (§6.3).

## 12. Files

**New:** `engine/coverage.ts`, `engine/coveragePresentation.ts`,
`engine/storyDepartment.ts`, `data/readers.ts`, `data/storyDepartment.ts`,
`components/StoryDepartmentCard.tsx` (modelled on `ProductionOfficeCard.tsx`),
plus tests.

**Changed:** `types/index.ts` (Coverage, ReaderProfile, StoryDepartment,
CoverageOrder, `Studio.storyDepartment`, `Studio.coverages`,
`Studio.coverageOrders`); `state/studioReducer.ts` (`COMMISSION_COVERAGE`,
coverage-order settlement on the day-advance path,
`UNLOCK_/UPGRADE_STORY_DEPARTMENT`, `HIRE_STORY_ANALYST`); `state/gameState.ts`
(starting department by stature); `components/common/DifficultyPicker.tsx`
(stature grants a department tier, §6.2); `engine/scriptGenerator.ts` (price off
the market read); `engine/rivalStudios.ts`;
`components/common/ScriptDetails.tsx`, `FilmDetailModal.tsx`,
`AssetLibrary.tsx`, `OpportunityMarket.tsx`; `engine/conceptStrength.ts`
consumers. `SAVE_KEY` bump.

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| Fog + no affordable signal early = frustration | The assistant read is free from day one on every difficulty, and the department is purchasable at tier 1 with no milestone gate (§6.2) |
| **The read clock punishes rather than pressures** — scripts lost mid-read feel like the game cheating | Delivery day is visible *before* committing, next to the listing's expiry (§7.1, §9); the coverage still lands and is kept (§7.4); losing one is announced, not silent; the free tier means being outrun is a choice about which script, not a wall |
| The clock becomes a tax cash simply pays off | Rush reads deliberately held back (§7.3); capacity is desks, not money-per-read (§7.2) |
| Free assistant read is good enough that nobody buys the facility | Acuity ~25 and one 5-day desk — roughly one bad read a week, slower than an Agent Package's shortest expiry (§7.1) |
| The inert sourcing row reads as a broken button | Rendered as an explicit "not yet available" row with no price and no action (§9), not as an unaffordable upgrade |
| Player ignores the script, buys on price | Price is itself a noisy read (§4.1), so it can't substitute for judgment |
| Feels arbitrary rather than uncertain | Post-release revelation (§10) is shipped in the same phase, not later |
| UI noise from many coverages | Cap at 3; verdict is the headline, axes are detail |
| Diagnostics and dev inspectors need truth | Unchanged — per CLAUDE.md they read raw numbers; only player surfaces fog |
| Story Department blurs with Market Research | The audience-side / script-side split in §6.4, held in both directions |
| A facility with nothing to do | Build the coverage engine and the clock first; the department is their home, not the layer itself (§16) |

## 14. Acceptance criteria

1. No true craft value is displayed on any player-facing surface pre-release.
2. The same reader on the same script returns an identical read; two readers
   return different ones.
3. A reader's systematic bias is recoverable from ~20 reads (diagnostic test).
4. Commissioning coverage does not perturb a seeded slate.
5. Post-release shows truth plus every coverage written.
6. A rival studio's acquisition decisions run off perceived, not true, value.
7. Price correlates with true craft but does not determine it.
8. A studio with no Story Department can still obtain coverage — slowly, at the
   worst acuity, free — and is never locked out of reading. On the tightest
   stature, with zero cash, on day one.
9. The Story Department is purchasable at tier 1 with no milestone satisfied.
10. Department tier changes the number of *concurrent* reads and nothing else;
    analyst quality changes acuity and never removes taste bias.
11. Commissioned coverage delivers on a determinate future day, and that day is
    visible from the moment it is commissioned.
12. A read in flight when its opportunity expires, or is won by a rival, still
    delivers, and the coverage is retained and readable afterwards.
13. Upgrading the department while a read is running does not shorten that read.
14. Coverage can be commissioned against an owned asset as well as a market
    opportunity, and an owned asset's read never expires out from under it.
15. `sourcingTier` exists on the type and is rendered, and no code path reads it
    to change any outcome — a save with `sourcingTier: 5` plays identically to
    one without it.
16. A starting stature at or above Established Indie begins with a Story
    Department at the tier §6.2 gives it.

## 15. Explicitly out of scope

Talent pushback in prep (Phase 4), targeted rewrites (Phase 4), inbound pitches
(Phase 5), improved script prose (Phase 1), and writer deals plus the sourcing
track (Phase 3, §6.3/§8.1 — `sourcingTier` ships inert). Per-studio opportunity
visibility, which is what sourcing would actually require (§6.3), is Phase 3
work on `engine/opportunities.ts` and is not begun here. Pre-bid rival interest
as a visible signal is Phase 3 (§11). Prose-only coverage (§5.3) is a later
evolution, not this phase. Rewrites keep working exactly as they do today.
**No writers room, in this phase or any later one.**

## 16. Build order

The facility is the wrapper, not the layer. Built first, it is a building with
nothing to do.

1. `engine/coverage.ts` — the perception model, pure, with its tests.
2. Price off the market read (§4.1) — closes the oracle before the fog goes up.
3. Player surfaces read from `Coverage` instead of `Script` (§3, §9), sourced
   from the free assistant read alone — no facility, no purchase, no clock.
4. The read clock (§7) — `CoverageOrder`, delivery on the day-advance path,
   mid-read loss, the in-flight UI state. Still on the single free desk.
5. The Story Department as a two-function facility (§6): desks and read quality,
   purchasable at tier 1, granted by stature, with the sourcing row rendered
   locked and wired to nothing.
6. Post-release revelation (§10).
7. Rivals onto perceived value (§11).

Steps 1–3 are the phase's spine: they are what makes quality an opinion at all.
Step 4 is what makes it a *decision*, and step 5 has nothing scarce to sell
without it, so 4 and 5 travel together or not at all. A slip in 6–7 is
survivable; a slip in 2 is not — it would ship the fog with the answer still
printed on the price tag.
