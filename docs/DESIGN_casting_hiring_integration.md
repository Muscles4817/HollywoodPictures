# Design — Casting & Hiring Integration (Workstream I)

Status: **draft for review**. This is one of two sibling documents. The other,
`DESIGN_production_crafts_and_crew.md` (Workstream II), is design-first and does
not begin implementation until its audit and requirements model exist. This
document is the implementable arc.

## 0. Framing

The actor-casting loop is already broadly fit for purpose (character-centred
framing, three genuine entry routes, persisted negotiations, auditions,
scheduling that can move the production, a Casting Director that changes
*information quality*). The work here is **integration and legibility**, not a
rebuild:

- Clarify abstractions that are currently conflated (one salary slider doing
  three jobs).
- Prevent exploitable/optimal behaviour (costless mass-lowballing).
- Make the process legible on the main Cast & Crew page (today it collapses a
  deep simulation to "0/7 roles filled").
- Bring the Director up to the actors' depth, and remove UI contradictions
  between the two flows.

Design principles carried from the existing sim: engine stays pure and
rebalanceable from `data/`; player-facing presentation stays qualitative (never
raw stat values); **decision support, not decision replacement** — the system
offers perspectives, not verdicts.

What already exists (verified in code), so we don't rebuild it:
- Negotiations persist: `RoleNegotiation` stores a frozen `askingPrice`,
  `lastOfferedSalary`, and `counterSalary`; the live odds estimate is hidden the
  moment a negotiation exists. Moving the global slider does **not** rewrite an
  existing counter.
- The global budget already auto-allocates by role importance
  (`splitCastBudgetByImportance` / `withRebalancedTargets`); it is simply
  unsurfaced and unlockable.
- Offers resolve **synchronously** today (accept immediately attaches the actor).
  Making them time-aware is the single largest flow change (Phase 6).

## The four salary concepts

The current single per-role slider (`talentTargetPriceByRole`) silently plays
three roles. Split into four distinct, separately-named concepts:

| Concept | Scope | Drives | Status today |
|---|---|---|---|
| **Planned allocation** | internal per-role budget | production planning; the auto-split + locks | partial (`talentTargetPriceByRole` + auto-split, unsurfaced) |
| **Advertised range** | external, per-role | Open Casting applicant weighting + forecast | new (split out of the slider) |
| **Candidate offer** | per-candidate | this negotiation; persists | new control (model already stores `lastOfferedSalary`) |
| **Agreed salary** | signed fee | the actual cost | exists (`agreedSalary` on the assignment) |

---

## Phase 1 — Budgeting & offers

**Intent.** Make role budgeting and candidate offers distinct, and remove the
two-price-sliders-mean-different-things contradiction.

**Scope.**
- Replace the casting drawer's single slider with: a per-role **advertised
  range** (what shapes Open Casting) and a per-candidate **offer** control that
  appears at Make Offer / inside a negotiation (defaulting to the advertised
  midpoint, adjustable per candidate, persisted with the negotiation).
- Surface an explicit **allocation table** at the Cast & Crew hub: role · planned
  allocation · committed · remaining, with **lockable** allocations (reserve £X
  for the director even when another role is retargeted). This is the visible,
  controllable face of the existing auto-split.
- **Hiring drawer:** delete the price-window slider entirely; replace with search
  controls (max fee, budget band, affordable-only, available-by, sort by
  fee/value/fit). The identical-slider-different-meaning bug is gone.

**Anti-solve note.** The per-candidate offer must not become a "tune until the
odds turn green" dial — odds stay banded/qualitative and uncertain, as today.

**Out of scope.** Time-based offers (Phase 6); director negotiation (Phase 7).

**Dependencies.** None; this unblocks Phases 6 and 7.

---

## Phase 2 — Cast & Crew hub → live staffing dashboard

**Intent.** The hub becomes the control centre for staffing the production. The
player should never need to reopen a role to remember what's happening in it.

**Scope.** Per-role live state, e.g.:
- *Evelyn Abbott* — open call active · 5 applicants · 2 shortlisted · 1 audition
  completing in 3 days · no offer outstanding.
- *Lee Abbott* — offer out to Actor X (response expected tomorrow) · Actor Y
  awaiting callback.
- *Casting Director* — not hired · forecasts low-confidence.

Plus two cross-cutting panels this hub naturally hosts:
- **Planned shoot window**, prominently (scheduling can't live only inside
  candidate cards — Phase 3 feeds this).
- **Activity timeline** across the production: audition completes (date),
  counter-offer expires (date), next applicant batch (~date), proposed shoot
  start (date).

Most of this data already exists on the draft (`castingCalls`, `shortlist`,
`auditions`, `negotiations`); this phase is aggregation + presentation, and it is
the spine later phases plug their state into.

**Dependencies.** Reads Phase 1's allocation/offer state and Phase 6's timers as
they land (degrade gracefully before then).

---

## Phase 3 — Scheduling: preview-then-confirm

**Intent.** Stop "Wait for them" from silently moving the production mid-browse.

**Scope.**
- Replace the immediate-mutation "Wait for them" with a **scenario preview**:
  "Moving the shoot to 12 June would — free Actor A, keep Actor B, add N days of
  development, change holding/prep cost by ~£X." The player then **confirms** the
  new target date.
- The planned shoot window shows at the hub (Phase 2), not only per-card; a
  per-card "needs a later start" opens the hub-level scenario.

**Known model limit (intermediate).** Today availability is `busyUntil` only, so
a later start can only *free* talent — never lose it. The gains-only preview is
an accepted intermediate. Real availability **windows** (busy-after too, so
delay can gain *and* lose) are a cross-cutting deepening (below); `busyUntil` is
explicitly not the final model.

**Dependencies.** Phase 2 (hub window). Benefits from the windows deepening.

---

## Phase 4 — Legibility pass

**Intent.** Improve honesty of information without solving the decision for the
player.

**Scope.**
- **Direct Approach: visibility → information.** Replace the hard fame floor
  (currently: no Casting Director ⇒ can't *see* anyone below fame 45) with an
  **information** gate. Working actors are findable by deliberate search but read
  *vaguely* (wide bands, "limited info") without a Casting Director; the CD
  proactively **surfaces + sharpens** suitable lesser-knowns; true unknowns /
  hidden gems remain weighted toward Open Casting so calls keep a distinct
  purpose. A studio can always locate a working professional — it just may not
  know if they're any good.
- **Dial back algorithmic verdicts.** Keep exactly **one** clearly-subjective
  voice (the Casting Director's take, explicitly coloured by *their* skill /
  confidence / preferences) and make the neutral comparison **trade-off-framed**:
  declare a per-row winner only on *material* differences (a £50k tie highlights
  nothing), and frame the summary as a trade-off ("Robert is cheaper and
  similarly dependable; Eric offers different performance strengths; neither has
  a meaningful commercial edge") rather than "Robert has the edge."

**Dependencies.** None hard; touches the Phase 5 identity work (shared prose).

---

## Phase 5 — Casting feel: candidate identity & audition reports

**Intent.** Make a candidate feel like a distinct creative choice, not a stat row.

**Scope.**
- **Candidate identity.** Compose a candidate-specific "casting case" from the
  data that already exists (personality, temperament, ego, controversy,
  adaptability, acting style, tone profile, reputation): e.g. "eccentric
  authority and an unsettling edge; strong emotional control but less naturally
  paternal; reliable veteran unlikely to create problems; limited current
  box-office value." **Execution risk:** template prose reading like mad-libs at
  scale. Mitigation: lead each card with the actor's *most distinctive axes*
  (furthest from average), so cards differ because the actors do. The current
  performance-axis explanation stays available beneath the identity, not instead
  of it.
- **Audition reports.** An audition produces an actual **report**, not just a
  narrower confidence bar: interpretation chosen, what worked, concerns,
  direction-taking, chemistry with an attached co-star, and *possible perception
  shifts* (an audition can reveal a latent strength/weakness — the pre-audition
  read can be honestly wrong). Design toward **selective tiers** (self-tape /
  screen test / callback / chemistry read) that are selectively useful rather
  than mandatory for everyone; the first pass ships one richer report with an
  optional chemistry note.

**Dependencies.** Shares a presentation/prose layer with Phase 4.

---

## Phase 6 — Negotiation consequences

**Intent.** Make maintaining backups a matter of judgement, not costless mass
solicitation. **Highest-risk phase** (turns synchronous offers time-aware).

**Scope (per the locked decision — snappy default, selective async).**
- Initial accept/counter/reject stays **snappy** — no mandatory dead time on
  ordinary offers.
- **Selective async:** a high-leverage or particular-personality actor *may* take
  calendar time to respond (personality/leverage-gated), not every offer.
- **Open counters expire** — an unanswered counter lapses after a period (shown
  on the hub timeline, Phase 2).
- **Confirm-to-commit:** an acceptance becomes "accepted — awaiting your
  decision" rather than auto-casting. Several candidates accepting the same slot
  becomes a real "pick one, disappoint the others" choice.
- **Relationship costs:** repeated lowballing damages standing; withdrawing after
  agreement costs relationship.

**Dependencies.** Phase 2 (timers surface on the hub); Phase 1 (per-candidate
offers). Feeds Phase 7.

---

## Phase 7 — Director → actor-parity

**Intent.** The director is arguably the most-negotiated hire; today they can
only accept/reject once (no counter, no shortlist, no wait, no persistence). That
is the clearest inconsistency in the whole staffing UI.

**Scope.** Bring the director onto the actor framework — search/recommendations,
shortlist, availability & schedule scenarios, an initial approach, salary
negotiation with persistent counters, creative concerns/conditions, script &
studio appeal (the director already has an appeal model:
`computeDirectorAppeal` — prestige gate, script fit, brand/prestige, salary).
Directors don't audition; the analogue is meetings / creative-alignment
discussions (kept light in the first pass). A director declining £700k with "no
counter possible" while lesser actors negotiate properly is the specific wrong we
remove.

**Dependencies.** Phases 1 and 6 (offers + negotiation infra it reuses).

---

## Cross-cutting deepening — real availability windows

Give talent real availability **windows** (busy-before/busy-after, not only
busy-until). This makes scheduling trade-offs bidirectional (delay can gain *and*
lose talent), upgrading Phase 3's gains-only preview and enriching Phase 6/7
scheduling. Sequence after Phase 3's intermediate ships; benefits multiple
phases, so it's tracked as cross-cutting rather than owned by one.

## Explicitly out of scope this workstream

- **Character-eligibility flexibility** (gender/age as fixed vs preferred vs
  flexible interpretation). Deferred — but we should avoid hard-baking every
  character descriptor so deeply that adding it later forces a migration.
- **All crew depth** — see Workstream II.

## Sequencing summary

1 (budgeting/offers) → 2 (live hub) closely behind → 3 (scheduling preview) →
4 (legibility) → 5 (casting feel) → 6 (negotiation consequences) →
7 (director parity). Windows deepening slots in after 3. Each phase is scoped as
its own PR series, verified against the existing test suite and calibration
gates, following the same cadence as the completed casting redesign.
