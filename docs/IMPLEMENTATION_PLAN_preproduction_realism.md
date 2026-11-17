# Implementation plan: pre-production as it really works

Implements `docs/DESIGN_REVIEW_preproduction_realism.md` (called **the design**
below; read it first). Owner's decisions, recorded so they are not reopened:

| Question (design §9) | Decision |
|---|---|
| Missing prep roles | Add **one** new hire: a **line producer & 1st AD team** (a "production team"). Other missing roles stay out; existing roles stand in |
| How hands-on prep is | A film's prep can be **delegated**; the film's production team (or, with none, the studio's own production office) then makes every checkpoint decision itself, with the same costs. "You run the studio; you don't produce every film up close" |
| Method | No tuning toward market targets. If measurements look wrong, investigate the cause in the films first |

Delivered as one pull request, merged, with every phase green (`npm test`,
`npm run lint`, `npm run build`) and checked by an independent reviewer agent
before the next phase starts.

---

## 0. Ground rules

- `engine/` stays pure. New engine code lives in `src/engine/prep/` (one module
  per concern). Tunables live in `src/data/prep.ts`, each with a comment saying
  what real thing it represents and its source in `docs/domain/`.
- Player-facing text is qualitative: no raw stat values. Money amounts and day
  counts may be shown (they are already shown elsewhere).
- Save shape changes bump `SAVE_VERSION` (pre-launch: no migrations).
- Every background-resolving beat follows `docs/DESIGN_notification_contract.md`.
- Determinism: everything drawn is drawn once from a seed stored on the film and
  replayable; nothing rolls at release.
- Prep never adds quality (design §3 rule 2). The only positive outcomes are
  money and days kept, and risk removed.

---

## Phase 1 — Fix what is broken (design §2.2)

No design change; each fix gets a regression test.

1. **Prep decisions reach the Inbox.** `deriveInboxItems` gains a
   `prepAwaitingChoice` category (player drafts whose `preProduction.status` is
   `'awaiting-choice'`, focused draft excluded like `awaitingChoice`);
   `inboxBadgeCount` counts it; `Inbox.tsx` renders it with the prep decision
   card, answering via `RESOLVE_PREPRODUCTION_CHOICE` with the draft's id.
   (Phase 4 replaces the card's contents; the category stays.)
2. **Decision card wording.** `OnSetDecisionCard` takes the paused message as a
   prop everywhere it is used for prep: "Pre-production is waiting on your
   call."
3. **One prep length everywhere.** Extract `effectivePreProductionDays(draft)`
   (the reducer's `max(recommended, designPrepDays)`); use it in
   `GreenlightConfirmation.tsx` and `deliveryEstimate.ts`.
4. **The greenlight gate includes the contingency reserve**
   (`projectReadiness.ts`), matching the button.
5. **One period flag.** `productionRequirements.periodSetting` becomes derived
   from the setting archetype wherever read (`requirementProfile.ts`).
6. **"Cast size" counts actors**, not crew, in prep and shoot length
   (`production.ts`).
7. **A held film starts by itself.** `settlePreProductionsInProgress` flips a
   `'scheduled'` prep to `'in-progress'` once `totalDays >= shootStartsOnDay`.
8. **Other films' prep advances whenever the calendar moves**, not only on
   `ADVANCE_DAY`: the shoot-day, prep-day and resolve actions that advance the
   calendar also settle backgrounded preps (shared helper).
9. **Bookings follow the film.** When prep or the shoot runs past the window
   booked at greenlight, the film's people's commitments for this project are
   extended to the film's current expected end (a helper called when prep
   length changes and daily on a shoot that runs past its window).

Verify gate: suite, lint, build; reviewer agent checks each item against the
code and the tests.

---

## Phase 2 — The breakdown: demands and fronts (design §4.1)

`src/engine/prep/demands.ts` (pure, derived, never stored):

```ts
export type PrepFront = 'breakdown' | 'design' | 'costume' | 'locations' | 'casting' | 'action' | 'effects' | 'visual';
export interface FrontDemand { front: PrepFront; demand: number /* 0..1 */; reasons: string[] /* player-facing, qualitative */ }
export function derivePrepDemands(input: PrepDemandInput): FrontDemand[];
```

`PrepDemandInput` = script, production choices, environment and effects
strategy, cast (actors only), the director's pitch, whether a release date is
already fixed. Sources per front (all existing data):

| Front | Reads |
|---|---|
| breakdown | count of physical requirement leaves present (`deriveRequirementProfile`), script structure/character craft (an unsound script = more "not really locked"), shooting budget against `computeRecommendedShootDays` work |
| design | `studioBuild`, `periodArchitecture`, set ambition, setting `setConstructionDemand`, environment strategy = studio |
| costume | `periodCostume`, `prostheticsMakeup`, characters' `transformationDemand`, speaking-part count |
| locations | `locationWork`, setting `locationComplexity`, `travelDemand`, `practicalLogisticsDemand`, environment strategy = location |
| casting | speaking parts by prominence, chemistry-critical archetypes (romance, two-handers), leads with `DifficultToWorkWith` |
| action | `combatStunts`, `vehicleAction`, `practicalDestruction`, characters' `physicalDemand`, practical ambition |
| effects | `digitalEnvironments`, `creatureAnimation`, `compositingVfx`, `digitalDoubles`, VFX ambition |
| visual | creative tension between director, DP and PD (`computeCreativeTension`), director decisiveness (below) |

`directorDecisiveness(person)` (pure, derived): from `productionStyle`,
`adaptability` and `ego` — a fast, committed decider vs one who stays open.

**Recommended prep** (`recommendedPrepDays(demands, …)`): a fixed core (two weeks
of breakdown, board, budget and production meeting) plus the longest front's
chain, each front's chain length taken from 04 §1.3 lead times scaled by its
demand. Replaces the body of `computeRecommendedPreProductionDays` (same
signature, so the shoot, rivals and estimates follow). The design-prep slider
becomes one front's ask (design), not a separate max.

**Outlook** (`prepOutlook(demands)`): per live front, one qualitative line
("The design front is heavy: period builds with long lead times."). Shown on the
production-planning screen and the greenlight confirmation.

Tests: a chamber drama has ≤3 live fronts and ~3–5 weeks; a period war epic has
all eight and months; demand rises with each source; the outlook never shows
numbers.

---

## Phase 3 — The production team (the new hire)

Modelled on stunt teams (a contracted unit, not a Person — no change to talent
generation):

```ts
export type ProductionTeamSpecialty = 'Locations' | 'PeriodAndBuild' | 'Action' | 'Effects' | 'Ensemble';
export interface ProductionTeam {
  id: string;
  name: string;            // "<line producer> & <1st AD>"
  skill: number;           // 1-100: how early and how much they find, and how well they judge (delegation)
  reliability: number;     // 1-100: reports bad news early
  specialties: ProductionTeamSpecialty[]; // 1-2; a matching front is worked as if skill were higher
  typicalSalary: number;   // per-film fee, charged at release like the stunt team
}
```

- `src/data/productionTeams.ts` (pool size, salary range, names, specialty bonus)
  and `src/engine/productionTeams.ts` (generate pool, by id, effective skill on a
  front, fee). Pool on `GameState.productionTeamPool`, generated with the stunt
  pool in new games, the bot studio and fixtures.
- `FilmDraft.productionTeamId?`; action `SET_PRODUCTION_TEAM`; fee folded into
  cost at release next to the stunt fee. Chosen in the same staffing surface as
  the stunt team. No team = the studio's own production office: an ordinary
  skill (`NO_PRODUCTION_TEAM_SKILL`), no specialties.
- Like the stunt team it is a vendor: its availability is not modelled.

Tests: generation deterministic and spread; effective skill rises on a matching
front; fee reaches the film's cost; the readiness gate does not require one.

---

## Phase 4 — Problems, finding them, checkpoints, delegation, and the shoot

The core. Replaces the 13-card prep bank.

### 4.1 Data (`src/data/prep.ts`)

A **problem catalogue**: one entry per kind of problem in design §1.3, each
with its front, how its likelihood scales with demand, a severity range,
**what reveals it** (`always` — anyone looking; or an activity: `scouting`,
`tests`, `rehearsal`, `previs`), the prep window it is normally found in (early /
mid / late), the **fixes** available (from design §1.5) with cost shapes in this
film's own currency (fractions of the daily prep burn, the daily shoot burn, and
the budget), and the **shoot incident** it becomes if carried (days and hours
lost, typed impact, magnitude). Text for each in plain words. Sizes come from
the reference (e.g. an implied element costs half to a whole shoot day; a
missed tech scout 1–3 hours a day at that location; a set handed over late 1–2
hours a day; a script not locked compounds). Every number cites its source.

### 4.2 State

```ts
interface PrepProblem {
  id: string; kind: PrepProblemKind; front: PrepFront; severity: number /* 0..1 */;
  foundOnDay: number | null; resolution: PrepResolution | null;
}
type PrepResolution = { option: PrepFixKind; day: number; costPaid: number; daysAdded: number };
interface PrepCheckpoint { index: 0 | 1 | 2 | 3; dueDay: number /* prep day */; problemIds: string[] }
// PreProductionState gains:
problems: PrepProblem[]; seed: number; checkpoints: PrepCheckpoint[]; nextCheckpoint: number;
pendingCheckpoint: PrepCheckpoint | null; delegated: boolean;
activities: Record<PrepActivity, boolean>; lengthFactor: number; log: PrepLogEntry[];
// PhotographyState gains:
carriedIncidents: { day: number; problemId: string }[];
```

`events`/`pendingChoice` on `PreProductionState` stay for the few genuinely
interactive situations that remain (a difficult star clashing early), now
caused by the cast, not drawn uniformly.

### 4.3 Engine (`src/engine/prep/`)

- `problems.ts` — `generatePrepProblems(demands, ctx, seed)`: for each live
  front, the expected count and severity from demand, stretch (the facet model's
  `stretch` for design/effects/action), a fixed release date and the prep
  length; drawn once, deterministically, at greenlight.
- `discovery.ts` — `discoverOnDay(prep, ctx, day, rng)`: each unfound problem's
  daily chance from its window, whether its revealing activity is on, the
  owning skill (front owner per design §4.8: production team for breakdown and
  locations; PD for design; director + PD for costume; casting director for
  casting; stunt team for action; VFX supervisor for effects; director + DP + PD
  for visual), familiarity (pairing history between director and the owner)
  and reliability. Severe, obvious problems are found early by anyone; subtle
  ones need the work and the skill.
- `checkpoints.ts` — four checkpoints at the real milestones (first budget and
  board ≈ 25% of prep; design and locations lock ≈ 55%; tests and rehearsal ≈
  80%; production meeting ≈ 95%). Each lists the found, unresolved problems and,
  per problem, the fixes still open by its deadline, each priced.
  `applyFix(prep, problemId, fix, ctx)` → cash charge, prep days added (prep
  length grows), a scope cut (recorded; becomes a small typed quality loss in
  the named department plus any money saved — the reference's "taking a pass"),
  contingency drawn (reserve reduced, no cash now), or carried.
- `delegation.ts` — `decideCheckpoint(checkpoint, prep, ctx)`: how the
  production team decides. Better teams pick cheaper effective fixes, protect
  the shooting day, and never spend contingency in prep; weaker teams carry more
  and overpay. Also used by rivals (with their studio's situation) and by the
  bot.
- `handoff.ts` — at the end of prep, every unresolved problem becomes a
  scheduled shoot incident on the shoot day its front is reached; the readiness
  checklist (design §4.5 / 04 §12) is computed for display.
- `shootIncidents.ts` — `incidentEvent(problem, ctx)` builds the
  `ProductionEvent` (description, delay days, typed impact and quality, cost)
  that the shoot records when it fires.
- Targeted risk: replace `computePrepRiskDelta`/`applyPrepRiskDelta` with
  `prepRiskAdjustments(prep)` returning per-dimension deltas: unresolved action
  problems raise safety, unresolved breakdown/design/effects raise technical and
  budget, unresolved visual/casting raise morale; activities done lower their
  own dimension. Same callers.

### 4.4 Reducer and settlement

- `GREENLIGHT_PROJECT`: compute demands, recommended prep × length factor,
  problems and checkpoints; store; delegated flag from the draft's setting.
- `ADVANCE_PREPRODUCTION_DAY` and `settlePreProductionsInProgress`: run discovery
  for the day; on reaching a checkpoint, either (delegated) decide and apply it
  at once and log it, or (not delegated) pause as `'awaiting-checkpoint'` with
  `pendingCheckpoint` set.
- `RESOLVE_PREP_CHECKPOINT { productionId, choices: Record<problemId, PrepFixKind> }`:
  apply each; resume. Unanswered problems default to carry.
- `SET_PREP_DELEGATION { productionId, delegated }`: allowed any time in prep.
- Shoot: `ADVANCE_SHOOTING_DAY`, the backgrounded shoot and the rival
  synthesizer fire due `carriedIncidents` as recorded events before their
  random roll for the day.
- Release: prep's scope cuts reach the film as typed events through the same
  path `prepQualityEvents` uses today; the old positive prep quality events no
  longer exist.

### 4.5 Notifications (contract checklist ticked in the record)

- `deriveInboxItems.prepCheckpoints`: player drafts paused at a checkpoint (one
  card per film per checkpoint), counted in the badge; routes to that film's
  prep briefing (`RESUME_PROJECT` lands on the prep screen, which shows the
  briefing); the card clears when the checkpoint is resolved — which happens on
  the screen that displays it, so read and resolve coincide.
- Delegated checkpoints produce an informational "What your production team
  decided" entry in the prep log, not an Inbox item (nothing to act on).

### 4.6 UI

- **Production planning (before greenlight)**: the outlook per front;
  recommended prep with a length choice (shorter / as recommended / longer); the
  activity toggles, defaulted by demand, showing what a shorter prep would drop
  in the reference's sacrifice order; the delegation toggle; the production
  team picker beside the stunt team.
- **Pre-production screen**: a readiness checklist; the prep log (found
  problems, decisions taken); when paused, the **checkpoint briefing** — each
  found problem in plain words with its options, each option's money and days
  and what it costs the film in words; "Carry it" always available; one confirm
  button.
- **Shoot and results**: incidents read as their own descriptions; the story
  report already narrates events.

### 4.7 Removed

The 13-card `PRE_PRODUCTION_EVENT_TEMPLATES` bank and `rollPreProductionDayEvent`
(kept only for the trait-gated difficult-star clash, now gated by the cast);
`computePrepRiskDelta`'s shared delta; `chooseRivalOption`'s use for prep.

Tests (engine, reducer, components): determinism; a missing activity never
finds its problems; a skilled owner finds more and earlier; a cut prep drops
rehearsal first; delegation decides every checkpoint and a better team spends
less for the same carried risk; carried problems fire on the shoot and reach
the film through coverage/typed impacts; no prep outcome raises any facet or
department above its funded level; the Inbox shows a paused checkpoint, the
badge counts it, routing lands on the briefing, resolving clears it.

---

## Phase 5 — Time costs real things (design §4.6)

- Extending prep (a fix or the length choice) or a held start moves the shoot's
  start. People whose other commitments now overlap the new window **leave**:
  under a week's slip, only those with a hard clash; 2–4 weeks, also a share of
  the department heads, best-booked first; 6+ weeks, most of them (04 §9.6).
  The film's bookings extend for those who stay.
- A mandatory role that leaves is **replaced** automatically from available
  people near the same fee (existing candidate search), logged, and notified
  (Inbox informational card, cleared on read — contract). A lead leaving is the
  expensive case and says so.
- The prep-burn cap is lifted so a week of prep costs what the reference says
  relative to the film (04 §1.4: a core prep week is a fraction of a shooting
  day); prep burn is included in the greenlight affordability read.

Tests: a 3-week slip with a director booked elsewhere loses the director and
replaces them; a 2-day slip loses nobody; bookings extend for those who stay;
the notice appears and clears.

---

## Phase 6 — Rivals on the same model (design §5)

- Rival productions get a contingency reserve (by tier), a production team from
  the pool (by tier and budget), prep time in their calendar (release day =
  today + prep + shoot + post + 30), prep cost, and bookings covering prep.
- `synthesizeRivalPrep` is replaced by the real engine run headless: demands →
  problems → day-by-day discovery over the prep length (own forked stream) →
  checkpoints decided by `decideCheckpoint` with the rival's situation (cash,
  dated release, tier character) → carried incidents into the synthesized shoot.
- **Memory**: a rival records each finished film's overrun (days over the
  recommended shoot) and its main cause; its next films' prep length factor and
  contingency move a bounded step toward what would have prevented the last
  ones (longer prep / more contingency after overruns; shorter after
  consistently finishing early and missing windows). Stored on `RivalStudio`.

Tests: parity — a rival and a player film with the same parts, the same prep
and the same decisions produce the same carried incidents and the same film;
memory moves the right way and stays bounded.

---

## Phase 7 — The bot, measurement, and the record

- The harness bot delegates prep (it runs a studio; it is the measuring
  instrument, so its five strategies' numbers are untouched). Careful and Steady
  attach the best production team they can afford; Careless attaches none.
- Measure, observationally: career gate at four tiers, the four box-office
  gates, the anatomy. Plus a new opt-in harness
  `src/engine/prep.diagnostic.test.ts` (`PREP_DIAGNOSTIC=1`) reporting, over a
  population of rival and player films: prep length by film kind, problems
  generated / found / fixed / carried by front, days lost on the shoot by cause,
  overrun as a share of shoot budget by cause — the shape checks of design §7
  against 03 §13 and 04 §1, §16.
- Record everything in a final section of the design review ("As built"),
  including what looks wrong and what investigation it calls for. **No tuning
  toward market targets in this plan**: if the market moves, the record says so
  and the next step is investigation.
- Pull request with the plan's summary, merged.

---

## Verification (each phase)

1. `npm test`, `npm run lint`, `npm run build` all green.
2. An **independent reviewer agent** (fresh context) is given this plan's phase
   section, the design note and the phase's diff, and asked to check: every item
   built as specified; nothing claimed that the code does not do; tests that
   actually exercise the behaviour; no rule broken (purity, qualitative text,
   prep never adds quality, notification contract, no tuning to targets).
   Findings are fixed before the next phase.
3. A short "as built" entry for the phase.
