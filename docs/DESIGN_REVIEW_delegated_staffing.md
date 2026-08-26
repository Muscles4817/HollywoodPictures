# Design Review: Delegated Staffing — Handing a Crew Slot to Your Line Producer

Status: **Phase 1 built** (§11 records what shipped and where it differs from
this brief). The first mechanic where an attached Producer *does something*
rather than multiplying something. Adds a timed brief-and-return loop to the
existing Cast & Crew staffing board for the five crew-head roles. No new
currency, no new lifecycle vocabulary, no change to how anyone is hired or
charged.

---

## TL;DR

- **The problem this solves is that producers are inert.**
  `engine/producers.ts:computeProducerEffects` is a pure function of skill ×
  affinity × reliability that quietly moves four numbers. The player attaches
  one and never interacts with them again. Nothing on the Producers section is
  a decision after the attach click. This is the smallest change that turns a
  producer into somebody who *acts*, and it makes all three of their existing
  stats legible for the first time.
- **You hand over one crew slot; they come back with one name, days later.**
  Not a shortlist, not an auto-fill. One name, their pitch for it, and the
  price they got. You accept or you veto.
- **Delegation buys money and attention; it costs time and fit.** A Line
  Producer optimises for *value* (skill per pound), not for *this script's
  department demands*. The game already computes, and already shows you, how
  demanding each department is before you delegate
  (`engine/crewFitRead.ts`, `engine/departmentWorkload.ts`) — so the risk is
  legible in advance, per Principle 3, using data that is already on screen.
- **Vetoing is not a free reroll.** Two briefs per role per film, then that
  producer is done with that slot. Without this cap, delegate → veto → repeat
  is strictly dominant and the whole mechanic collapses into a slot machine.
- **It reuses three systems wholesale.** The staffing board's lifecycle
  (`state/staffingBoard.ts` — `searching`/`candidates` already mean exactly
  what a brief out and a brief returned mean), the `ADVANCE_DAY` tick idiom
  (`engine/castingCalls.ts:tickCastingCalls`), and the Inbox
  (`engine/project.ts:deriveInboxItems`). The genuinely new code is one pure
  engine module and four reducer cases.
- **No new money.** The per-film fee charged at `RELEASE_FILM` already pays
  the producer. Delegation is what you *get* for the fee you are already
  paying — not a second economy to balance.

---

## 1. What the feature is

On the Cast & Crew board, a crew-head row gains a second verb next to **Open**:
**Hand to [producer]**. Handing it over issues a *brief* — the slot's current
budget allocation, given to an attached Line Producer, with instructions
implied by the number rather than by a dial.

The producer then goes away for real calendar days. When they come back, the
row lights up in the Inbox: *Marcus Reed has a cinematographer for you.* One
name, at a price he negotiated, with two or three lines on why. Accept and the
hire is made exactly as if you had made it yourself. Veto and the slot is empty
again, the days are spent, and Reed will take one more brief on that slot
before he stops offering.

The player-facing fantasy: *you are running a studio, not a casting session.*
The producer you are already paying is a person you can point at a problem —
and pointing them at the wrong problem is a mistake you can make.

## 2. Why this one, and why only this one

The obvious version of this feature is a general "producers can do steps for
you" framework covering casting, planning, and post. That version is a trap:
cast and crew hiring *is* the game's richest interactive loop (the whole
casting redesign — appeal, auditions, open calls, negotiation, the casting
director's take), and any affordance that resolves it at least as well as
playing it manually will be used every time and hollow it out.

So the design rule underneath everything below:

> **Delegation must be a trade, never a shortcut.** If a rational player would
> delegate a slot every single time, the design has failed and the numbers need
> to move — not the other way round.

That rule is what picks the scope:

**In scope — the five crew heads.** `Cinematographer`, `Editor`, `Composer`
(mandatory) and `Production Designer`, `VFX Supervisor` (optional). These are
exactly the slots where real staffing authority sits with the line producer
(`docs/domain/05-departments-and-crew.md` §3.1 — the line producer builds the
budget and schedule and hires the crew; HODs then hire their own people), and
they are the slots whose current UX is a single instant click from a sorted
list. There is the least loop to hollow out and the most fantasy to gain.

**Out of scope — `Director` and the actor slots.** These carry the largest
downstream creative consequence and the deepest existing systems (the bake-off,
negotiation, auditions). They should never be delegable, in this phase or a
later one. A producer bringing you a *shortlist* of actors is a different,
later mechanic (§10) with a different verb.

**Out of scope — `Writer`.** The script arrives from the originating Asset;
writer hiring belongs to the development pipeline, not to production staffing.

**Out of scope — `Casting Director`.** Delegating the hire of the person whose
job is hiring is a knot, and the CD is better understood as the *instrument* of
the later cast-side delegation than as one of its targets.

**Line Producers only, in this phase.** Only a bench producer whose
`ProducerCareer.specialty` is `'Line'` can take a crew brief. The other three
archetypes are not weaker at it — they simply do not do this job, and their own
delegations (§10) are different verbs entirely. This is what makes the four
archetypes differ in *what you can ask them to do*, not merely in which number
they nudge.

## 3. What already exists (and is therefore not being built)

This design is deliberately mostly wiring. Cataloguing it honestly, because it
is the reason the feature is small:

| Need | Already exists |
| --- | --- |
| A per-role lifecycle with a "searching" and a "candidates" state | `state/staffingBoard.ts:StaffingStage`, and its header comment explicitly promises extensibility for exactly this |
| A per-role budget allocation, with locks and an auto-split | `talentTargetPriceByRole`, `SET_TALENT_TARGET_PRICE`, `SET_ROLE_BUDGET_LOCK`, `lockedRoleBudgets` |
| A "process runs on the calendar for the focused *and* backgrounded drafts" tick | `engine/castingCalls.ts:tickCastingCalls`, called in `ADVANCE_DAY` |
| A "come back to the player when it lands" surface | `engine/project.ts:deriveInboxItems` + `components/common/Inbox.tsx`, `state/studioActivity.ts` |
| A per-film feed of meaningful staffing beats | `FilmDraft.staffingLog`, `StaffingEvent` |
| A read of how well a person suits *this script's* department demands | `engine/crewFitRead.ts:deriveCrewFitRead`, `engine/crewSpecialty.ts:specialtyWeightedCapability`, `engine/departmentWorkload.ts` |
| Producer stats to drive quality, schedule and specialisation | `ProducerCareer.skill`, `reputation.reliability`, `genreAffinity` |
| The hire, its charge, and its logging | `SET_TALENT_FOR_ROLE` → `computeTalentCost` at Greenlight |

The one thing that does **not** exist is a clock the player experiences during
staffing: `App.tsx:PLANNING_SCREENS` pauses the background tick on the
`workspace` screen. That is not a blocker — it is the same condition open
casting calls and director pitches already live under, and it produces the
correct rhythm: you issue briefs, you leave the workspace, time passes, the
Inbox calls you back. It does mean the brief's cost is only felt by a player who
has somewhere else to be, which is an argument for §9's note on slates.

## 4. The loop, in detail

### 4.1 Issuing the brief

The row's **Hand to [producer]** control opens a small confirm panel, not a
form. It shows three things:

1. **The allocation** being handed over — the slot's existing planned budget,
   snapshotted at issue. Editable here (it is the same value the board's
   Planned column shows), because *this is the whole brief*. There is no
   priority dial: telling a Line Producer the number **is** telling them what
   you want. A generous allocation is "get me someone with a look"; a thin one
   is "get me someone".
2. **The producer's read of that number** — one line, in their voice: *"For
   £400k I can get you someone solid. If you want a name, it's closer to
   £900k."* This read is skill-gated (§5.4): a good producer's is accurate, a
   mediocre one's is optimistic. It is the honest, in-fiction version of a
   difficulty warning.
3. **Their estimate of how long** — a day range, also skill-gated in the same
   way.

Preconditions: the office is unlocked, the producer is on the bench **and
attached to this draft** (`attachedProducerIds`), the role is one of the five,
the role is not already filled, and no brief is live on it.

### 4.2 Out

The brief ticks down on `ADVANCE_DAY`, for the focused draft and every
backgrounded one, alongside `tickCastingCalls`. The board row reads
**Searching** — the existing stage, no new vocabulary — with the producer's
name and the estimated return day in the progress cell.

The player can **withdraw** a live brief at any time (the days are spent
regardless) and can always still open the slot and hire someone themselves;
doing so withdraws the brief automatically. Delegation never locks you out of
the drawer. That is what keeps it a convenience the player controls rather than
a commitment they regret.

### 4.3 The return

On the due day the producer returns with exactly **one** candidate. Not a
shortlist — a shortlist is just the drawer again, and a *curated* shortlist for
free would make delegation strictly better than searching yourself. One name is
also the honest fiction: a line producer brings you their person, they do not
hand you a spreadsheet.

The return lands as:

- an Inbox **attention** item (*"Marcus Reed has a cinematographer for you"*),
- a `StaffingEvent` on the draft's `staffingLog`,
- the board row moving to **Candidates** — again, the existing stage.

The candidate card shows the person exactly as the drawer would (`TalentStats`,
the fit read, the specialty note), plus the producer's pitch: two or three
reason lines drawn from why *they* picked this person — under budget, worked
with them before, right for the genre. The player sees the same fit read they
would have seen themselves. **Delegation hides no information at the point of
decision** — it costs you the *search*, not the *judgement*. This is what keeps
a veto a real, informed choice rather than a coin flip, and it is what makes the
mistake legible afterwards (Principle 4).

### 4.4 Accept, or veto

**Accept** routes through the existing hire path (`SET_TALENT_FOR_ROLE`'s
helper, shared, not duplicated) at the fee the producer negotiated — which for
a Line Producer is frequently *under* the allocation. That difference is their
real value and should be shown plainly on the card: *"£340k — £60k under."*

**Veto** returns the slot to **Unstaffed**. The days are gone. The brief's
`briefsUsed` increments.

**The cap: two briefs per role per film.** After a second veto that producer
declines further briefs on that slot for this film — with a line that reads as
a person, not an error state (*"I've brought you two. You don't want a
producer on this, you want a rubber stamp."*). The role stays hireable by hand,
forever; only the delegation closes.

This cap is the load-bearing rule of the entire design. Without it, the optimal
play is delegate → veto → delegate → veto until a great candidate appears, at
zero cost but time — which turns a judgement mechanic into a reroll button and
makes delegation strictly dominant for any player willing to fast-forward.

## 5. Where the risk actually lives

The mechanic is only worth building if a delegated hire can be genuinely worse
than your own, in a way you could have anticipated. Four sources, each mapped
to a producer stat that currently does nothing visible:

### 5.1 They optimise for value, not for the film — `specialty`

The Line Producer's candidate is drawn from the eligible pool weighted toward
**skill per pound**, with the film's *specialty* demands deliberately
under-weighted. `engine/crewSpecialty.ts:specialtyWeightedCapability` already
computes how well a head's specialty profile matches what this script actually
loads (`periodCraft`, `creatureAnimation`, and so on); the player's own drawer
surfaces it as the suitability read. A Line Producer discounts it.

The consequence is the strategic core of the feature: **on a light, generic
department, delegating is nearly free; on a demanding, specific one, it is a
real gamble.** And the board already tells you which is which, before you
delegate, in the same row you are about to hand over. Principle 3, satisfied
with zero new legibility work.

### 5.2 Skill sets the *distribution*, not just the mean — `skill`

A high-skill Line Producer returns a tight distribution around a good, sensible
pick. A low-skill one returns a wide one: sometimes a genuine bargain discovery,
often a mismatch nobody would have chosen. Both have the same *average*
usefulness on paper; they are completely different bets. This is Principle 1 —
the variance is created by *your decision about whom to trust*, not sprinkled on
afterwards.

### 5.3 Reliability sets the schedule — `reputation.reliability`

The return day is an *estimate*. A low-reliability producer overruns it, and
the overrun is rolled at issue (recorded, not re-rolled per tick, so the history
is a deterministic read exactly as Principle 2 demands). This finally gives
`reliability` visible teeth: today it is a silent dampening factor inside
`contributionMultiplier`; here it is the difference between having a
cinematographer three weeks before the shoot and having one the week of.

### 5.4 Affinity amplifies, never penalises — `genreAffinity`

Consistent with `PRODUCER_AFFINITY_MULTIPLIER`'s existing amplify-only rule: a
producer whose `genreAffinity` includes the film's genre knows who works in that
world. Better pick, faster return, honest estimate. Never a penalty for its
absence.

The skill-gated *honesty* of the estimate (§4.1) rides on 5.2 and 5.4 together:
what is quoted is the producer's belief, and belief is only as good as they are.

## 6. Why it isn't strictly better

| | Do it yourself | Hand it over |
| --- | --- | --- |
| **Time** | Instant | 5–20 days, uncertain |
| **Choice** | The whole eligible pool, sorted by fit | One name |
| **Price** | The standing fee | Often under allocation |
| **Fit** | You optimise it | They optimise value |
| **Reroll** | Free — browse as long as you like | Two briefs, then closed |
| **Information** | Complete | Complete *at the decision* — but only after the wait |

The intended shape: on a cheap genre picture with light department loads you
delegate almost everything and spend your attention on the cast; on a period
VFX-heavy film you staff the demanding departments yourself and delegate the
composer. That split keys off data the game already computes and already
displays, which is the strongest evidence it will read as a real decision rather
than a chore-skip.

§8's diagnostic harness exists to check that this is actually true rather than
merely intended.

## 7. Shape of the change

### 7.1 State

One new optional field on `FilmDraft`, following the established
optional-and-read-as-empty convention:

```ts
/** Delegated Staffing - live and completed crew briefs handed to an attached
 *  Line Producer (docs/DESIGN_REVIEW_delegated_staffing.md). Read as [] when absent. */
staffingBriefs?: StaffingBrief[];
```

```ts
export interface StaffingBrief {
  role: ProductionRole;        // one of the five delegable crew heads
  producerId: PersonId;        // must be attached to this draft when issued
  allocation: Money;           // the budget handed over, snapshotted at issue
  issuedOnDay: GameDay;
  /** What the producer TOLD the player - shown in the UI. */
  estimatedDays: number;
  /** What it will actually take - rolled once at issue, never re-rolled (Principle 2). */
  dueOnDay: GameDay;
  status: 'out' | 'returned' | 'withdrawn' | 'closed';
  /** Set on return. `pitch` is the producer's reasons, already presentation-ready. */
  candidate?: { personId: PersonId; fee: Money; pitch: string[] };
  /** 1 on the first brief for this role, 2 on the second; at 2 and vetoed, status -> 'closed'. */
  briefsUsed: number;
}
```

No change to `TalentAssignment`, `Studio`, `ProducerCareer`, or `Film`. A
delegated hire is an ordinary hire; the *provenance* lives in the brief record
and the staffing log, which is where the postmortem will want to read it.

Per `CLAUDE.md`, bump `SAVE_KEY`; no migration.

### 7.2 Engine — `src/engine/staffingBriefs.ts` (new, pure)

```ts
export function delegableRoles(): ProductionRole[];
export function canDelegate(draft, studio, pool, role, producerId, today): boolean;
/** The producer's own read of an allocation - the §4.1 line, skill-gated. */
export function briefEstimate(producer: Person, role, allocation, script, rng): { days: number; read: string };
/** Roll the honest due day + the pick, once, at issue. Deterministic given rng. */
export function issueBrief(...): StaffingBrief;
/** Weighted pick: skill-per-pound dominant, specialty fit under-weighted. */
export function producerCandidatePick(producer, pool, role, allocation, script, rng): { person: Person; fee: Money; pitch: string[] } | null;
/** ADVANCE_DAY hook - mirrors tickCastingCalls' signature and placement exactly. */
export function tickStaffingBriefs(draft: FilmDraft, totalDays: number, talentPool, rng): FilmDraft;
```

Tunables land in a new block in `data/producers.ts` (base days per role, the
skill→spread curve, the reliability→overrun curve, the value-vs-fit weighting,
the under-allocation band, `MAX_BRIEFS_PER_ROLE = 2`), per the "rebalance in
`data/`" convention.

### 7.3 Reducer — four cases

`ISSUE_STAFFING_BRIEF`, `ACCEPT_BRIEF_CANDIDATE`, `REJECT_BRIEF_CANDIDATE`,
`WITHDRAW_STAFFING_BRIEF`. Accept delegates to the same internal helper
`SET_TALENT_FOR_ROLE` uses, so the hire, the staffing-log entry, and the budget
rebalance have exactly one implementation.

`tickStaffingBriefs` is called in `ADVANCE_DAY` immediately after
`tickCastingCalls`, for the focused draft and each backgrounded one, inside the
existing `withRng` block. Ordering note in the house style: it draws *after*
casting calls and director pitches and *before* the prep/awards/press-tour tail,
so no existing system's draws shift.

Interactions to handle explicitly:

- `DETACH_PRODUCER` withdraws that producer's live briefs on that draft (logged).
- `FIRE_PRODUCER` does the same across every draft.
- `GREENLIGHT_PROJECT` withdraws all live briefs (logged). Greenlighting with a
  crew slot empty is an already-modelled, already-warned state
  (`engine/projectReadiness.ts`); a live brief must not silently survive into
  production.
- `ABANDON_PROJECT` needs nothing — the briefs go with the draft.

### 7.4 UI

- `state/staffingBoard.ts`: `StaffingRow` gains `brief?: StaffingBriefRead`
  alongside the existing `suitability?`/`compatibility?`/`workload?` extension
  points, and `deriveStaffingBoard` maps `out → 'searching'` and
  `returned → 'candidates'`. **No new `StaffingStage` member.**
- `HireTalent.tsx`: the row's action cell gains **Hand to [name]** when
  `canDelegate`; the progress cell shows the brief's state.
- One new component for the returned candidate (the accept/veto card). It
  reuses `TalentStats` and the existing fit-read presentation rather than
  inventing a card.
- `deriveInboxItems` gains a `briefsReturned` category, counted in
  `inboxBadgeCount` (it is genuinely actionable).

## 8. Testing

Unit, in the engine's existing style:

- `producerCandidatePick` is pure and deterministic for a fixed rng.
- The estimate's honesty tracks skill; the overrun tracks reliability.
- The two-brief cap closes the slot, and a closed slot stays hand-hireable.
- Detach / fire / greenlight withdraw live briefs.
- A backgrounded draft's briefs tick on `ADVANCE_DAY` (the bug this idiom
  exists to prevent).

And one opt-in harness, in the pattern `CLAUDE.md` already lists:

```bash
DELEGATION_DIAGNOSTIC=1 npx vitest run src/engine/delegatedStaffing.diagnostic.test.ts --disable-console-intercept
```

Simulating N films staffed three ways — all by hand, all delegated, and
delegated only where department demand is light — it should report: delegation
**wins on cost**, **loses on department fit**, and **neither strategy dominates
on finished quality**. If all-delegated wins outright, the tuning is wrong and
the harness is how we find out before the playtester does.

## 9. Known limitations, stated honestly

- **The clock is paused on the workspace screen.** A player who sits in Cast &
  Crew and never leaves experiences a brief as an inert row. The mechanic
  assumes the player has somewhere else to be, which is true today (Dashboard,
  another project, the Opportunity Market) but is thinner than it will be with
  a real slate.
- **The payoff scales with the slate, and the slate does not exist yet.** On a
  single film, delegation is time-for-attention with modest stakes. Its real
  form — *which producer do I trust with the B picture while I run the A
  picture myself* — needs concurrent productions, which is also the
  precondition the Production Office review already flagged for producer
  scheduling conflicts (`docs/DESIGN_REVIEW_production_office.md` §11). This
  design is deliberately shaped to survive that transition unchanged: a brief
  is already per-draft, and a producer's capacity to hold briefs across drafts
  is a rule added later in one place.
- **A producer holds unlimited concurrent briefs in this phase.** Correct for
  one film at a time; the first thing to constrain when a slate lands.
- **The pick reads the pool, not the world.** A producer cannot yet bring
  somebody who is not in the generated pool, and has no stable of their own
  people. §10.

## 10. What this deliberately sets up, and does not build

- **Producer stables.** A producer who keeps bringing you the same DP — the
  domain's own "HODs bring teams" (`docs/domain/05-departments-and-crew.md`:
  "Hiring a gaffer effectively hires their best boy"). The substrate exists
  (`engine/relationships.ts`, `engine/pairHistory.ts`); wiring a producer's own collaboration history into `producerCandidatePick`
  is a self-contained follow-up that would make picks feel authored rather
  than sampled. This is the single highest-value next increment.
- **Creative Producer → cast shortlists.** A different verb for a different
  archetype: three names for one character, weighted toward *fit* and over
  budget, feeding the existing shortlist rather than the hire. Only worth
  building once §8's harness says the crew version is balanced.
- **The postmortem beat.** `staffingLog` will now record *who chose* each
  crew head. "You let Reed staff the camera department, and the look suffered"
  is the causal chain Principle 4 wants, and the data for it is a by-product of
  this feature rather than new work.
- **Delegation affecting producer effects.** Deliberately not built: a producer
  who staffed a department does *not* get a bonus on it. The temptation is
  obvious and it would quietly restore strict dominance.

---

## 11. As built (Phase 1)

### 11.1 Where it lives

| Piece | File |
| --- | --- |
| Tunables (every number) | `data/producers.ts`, "Delegated Staffing" block |
| Pure logic | `engine/staffingBriefs.ts` |
| State shape | `types/index.ts:StaffingBrief`, `FilmDraft.staffingBriefs` |
| Actions | `ISSUE_STAFFING_BRIEF`, `ACCEPT_BRIEF_CANDIDATE`, `REJECT_BRIEF_CANDIDATE`, `WITHDRAW_STAFFING_BRIEF` |
| Daily tick | `studioReducer.ts:ADVANCE_DAY`, immediately after `tickDirectorPitches` |
| Board integration | `state/staffingBoard.ts` (`StaffingRow.brief`), `wizard/HireTalent.tsx` |
| Player surface | `wizard/StaffingBriefs.tsx` |
| Inbox | `engine/project.ts:deriveInboxItems().briefsReturned`, `common/Inbox.tsx` |
| Tests | `engine/staffingBriefs.test.ts` (30), `state/staffingBriefs.reducer.test.ts` (17) |
| Harness | `engine/delegatedStaffing.diagnostic.test.ts` |

Save key bumped to `v88`; no migration, per the pre-launch policy in `CLAUDE.md`.

### 11.2 The one substantive change to the design

**§5.1 said the producer ranks candidates on "skill per pound". That is wrong,
and the harness caught it on its first run.** Fees span orders of magnitude
where skill spans 1–100, so a literal ratio is arithmetically just `1/fee`: the
producer came back with the cheapest warm body in the pool every single time —
a head with fit 42 when the player could have hired a fit-100 head from the same
allocation. Measured over 480 samples:

```
role                  delegated fee   hand fee    fit delta
Cinematographer            £0.03M      £2.26M        -57.0
Composer                   £0.02M      £3.09M        -57.5
```

That is not "delegation is a trade". It is delegation being strictly *worse* —
which fails the design from the opposite direction, because nobody would ever
accept the pick. A decision only exists when neither option dominates.

The fix (`data/producers.ts:BRIEF_PRICE_PENALTY`) prices quality against the
**log** position of a fee within the role's own salary range — the scale
salaries are actually distributed on, and the one `engine/interpolate.ts:logT`
already exists to express. A Line Producer then believes *each step up the price
scale has to be paid for in quality*, which is both what they'd actually say and
what produces a real trade.

This is exactly what §8 asked the harness to exist for, and it is worth
recording that it earned its keep before the feature ever reached a player.

### 11.3 What the harness now reports

`DELEGATION_DIAGNOSTIC=1`, 24 films × 5 roles × 4 producer skill bands:

```
By producer skill      n   fee saved   mean fit cost   worst fit cost   found the best pick
poor (20)            120      £0.37M            -6.5            -30.3                    5%
fair (45)            120      £0.34M            -4.5            -22.0                   10%
good (70)            120      £0.48M            -3.4            -16.8                   21%
top (95)             120      £0.63M            -2.9             -9.6                   13%

Overall: delegation saves £0.46M a slot and costs 4.3 points of department fit,
landing the fit-optimal head 12% of the time.
```

Both halves of the trade hold, and the by-skill table is the design's own claim
(§5.2) showing up in measurement rather than in prose: a better producer saves
*more* money **and** costs *less* fit **and** has a far shorter tail — a poor
one's worst pick is 30 points off the best available head, a top one's is 10.
Trusting a cheap producer with a demanding department is a genuine gamble;
trusting a good one is merely a small, priced concession.

### 11.4 Where the implementation differs from §7

- **Four statuses, not four states plus a flag.** `out | returned | accepted |
  declined`. The brief's separate `withdrawn`/`closed` states collapsed into
  `declined`: the cap is derived by *counting* briefs on a role
  (`briefsRemainingForRole`), so a "closed" status would be a second source of
  truth for the same fact. A withdrawn brief and a vetoed one are the same
  thing to every reader — a brief that ended without a hire — and both count.
- **The candidate is picked at return, not at issue.** The *schedule* is
  committed at issue (the true `dueOnDay` is rolled once and stored, per
  Principle 2), but the name is drawn against the pool as it stands when they
  come back. Rolling it at issue would have meant a three-week search returning
  someone the world had moved on from, and a second reconciliation path at
  accept-time. One roll either way; this one is both simpler and truer.
- **The board row carries the search; the decision lives under it.** The row
  gained the "Hand to …" button and reports the brief on the existing
  `searching`/`candidates` stages as designed. The accept/veto card renders in
  a panel below the board rather than inside the hiring drawer — delegation is
  the *alternative* to opening that drawer, not a mode within it, and this way
  the drawer is untouched by the feature.
- **`quoteBrief` is rng-free.** The confirm panel renders the producer's read
  and estimate live as the player edits the allocation, so the quote had to be
  a pure function of state. Only `issueBrief` and the tick draw.
- **Coming back empty-handed is a real outcome.** If nothing in the pool comes
  in at the allocation, the brief returns with no candidate — the days are still
  spent. Not in the original brief; it fell out of the money being the whole
  instruction, and it is the sharpest lesson the mechanic teaches.

### 11.5 Still true, still not built

Everything in §9 and §10 stands unchanged. The nearest next increment remains
**producer stables** (§10) — routing `engine/relationships.ts` and
`engine/pairHistory.ts` into `producerCandidatePick` so a producer keeps bringing
you their people, which would make picks feel authored rather than sampled. The
harness is already in place to check it does not quietly turn delegation into
the dominant play.
