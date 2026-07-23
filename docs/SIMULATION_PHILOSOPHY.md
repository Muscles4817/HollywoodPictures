# How the Hollywood Pictures Simulation Should Work

This is a **design-philosophy** document, not a feature roadmap. It describes the
principles the simulation should follow as it grows. Algorithms, weights, and
even whole modules will change over time; these principles should outlast them.

It exists because two related failures were diagnosed in the simulation (see
`docs/DESIGN_REVIEW_ai_studio_awards_analysis.md`):

1. **The finished film is nearly deterministic.** Quality, critic, and audience
   scores are pure functions of the pre-production inputs. Pick a good script,
   a good director, and matching actors, and the film essentially cannot fail.
2. **The parts of the simulation that _should_ create variety are disconnected.**
   The game already models production risk, on-set events, talent reliability,
   ego, compatibility, and tone in detail — and then lets almost none of it
   reach the finished film. Production is the highest-variance department in the
   engine and has roughly cosmetic effect on final quality.

The through-line of everything below: **a film's outcome should be the emergent
result of the decisions made and the way the production actually went — not a
number computed from a spreadsheet of inputs, and not a dice roll bolted on at
the end.**

---

## Principle 1 — Variance should be endogenous

Film outcomes should not be:

- completely deterministic (identical inputs → identical film, every time);
- widened by arbitrary hidden score jitter;
- decided by a random roll at release.

Variance should **emerge from the decisions** made during development, hiring,
planning, and production. The riskiness of a film's outcome should be something
the player and the AI _create_ through their choices, not something the engine
sprinkles on afterwards.

- Ambitious, unconventional, or creatively conflicted projects should have
  **wider** outcome distributions — higher ceilings _and_ lower floors.
- Safe, reliable productions should have **narrower** distributions and lower
  ceilings — dependable, rarely brilliant.

Stochasticity is allowed and needed. But it must be:

- **scaled** by the risks the player's and AI's decisions created;
- **located** within the production process, not invented at release;
- **expressed** through visible events and their consequences;
- **understandable** after the fact.

The test: two studios can reach the _same average quality_ while producing very
different _distributions_, because they took on different amounts of risk. If
the only way to widen the distribution is to turn up a global randomness knob,
the design has failed this principle.

## Principle 2 — Execution quality should emerge during production

The shoot itself should create the execution outcome. The conceptual model is:

```text
Creative and production decisions
        ↓
Risk profile (what could go wrong, and how badly)
        ↓
Production events and execution outcomes (what actually happened)
        ↓
Department-specific consequences (what it did to the film)
        ↓
Finished film
```

Not:

```text
Finished production  →  hidden release-time quality roll  →  finished film
```

The distinction is not cosmetic. In the first model, the randomness lives in
_when and whether things go wrong on set_ — events the player watches unfold and
can respond to — and the finished film is a **deterministic read of that
recorded history**. Re-scoring the same production history must always yield the
same film. In the second model, the film's fate is decided by an invisible roll
the player never sees and cannot influence; that is exactly what this simulation
should not do.

Concretely: the on-set event history is the source of truth. The finished-film
calculation reads it. It does not roll new randomness of its own.

## Principle 3 — Every meaningful risk should be legible

Before committing to a project, the player should be able to understand _why_ it
is dangerous. Not exact percentages — but the causes:

- an inexperienced director;
- an unreliable star;
- excessive ambition for the resources;
- an inadequate schedule;
- insufficient contingency;
- demanding practical effects;
- an unstable or unfinished script;
- competing creative visions among the key talent.

When a film fails, the player's reaction should be **"I pushed this production
too far"** — never **"the game randomly punished me."** Risk that the player
cannot see or reason about is indistinguishable from unfairness, no matter how
principled the math behind it is.

## Principle 4 — Every success and failure should have a causal explanation

Avoid unexplained flat adjustments (`quality −8`). Prefer causal chains:

```text
Technical problems delayed the shoot
        ↓
Two sequences lost filming time
        ↓
Coverage was incomplete
        ↓
The editor could not fully repair the third act
        ↓
Pacing and clarity suffered
```

And symmetrically, for success:

```text
Strong cast chemistry
        ↓
Successful improvisation
        ↓
Performances exceeded the screenplay
        ↓
Critics praised the acting
```

The simulation should be able to **explain why the finished film became what it
became**, from its own recorded history — not by reverse-rationalising a final
number. If a system can produce an outcome but not an account of _how_, it isn't
finished. This is why consequences are typed to the department they affect
(performances, coverage, pacing, visual execution, screenplay): a typed
consequence carries its own explanation.

## Principle 5 — Studios should pursue coherent objectives

AI studios should not merely _complete productions_. They should make decisions
in pursuit of goals rooted in a **studio identity**:

- commercial vs. prestige priorities;
- genre focus;
- risk appetite;
- financial position;
- preference for reliable vs. high-ceiling talent;
- awards ambition;
- brand strategy.

Two studios may reach similar _average_ quality while producing very different
slates and very different outcome _distributions_ — a prestige house making
fewer, riskier, occasionally-brilliant films; a commercial house making a steady
stream of dependable, rarely-transcendent ones. Identity should express itself
at every decision point: what to acquire, whom to hire, how to resource the
shoot, how to release. "The AI makes reasonable-on-average choices" is not the
goal; **coherent, identity-driven choices that produce a recognisable slate** is.

## Principle 6 — Player decisions should involve trade-offs

Move away from a game where every decision simply pushes quality upward:

```text
Highest-rated script → highest-rated compatible talent → spend more → good film
```

High-rated talent, large budgets, and ambitious choices should **not be
unconditionally monotonic**. The player should routinely face genuine trade-offs:

- ceiling vs. reliability;
- ambition vs. execution risk;
- star power vs. role suitability;
- creative unity vs. productive tension;
- budget efficiency vs. contingency margin;
- prestige vs. broad commercial appeal.

A decision with no downside is not a decision. Every lever that raises the
ceiling should cost something — money, risk, reliability, or fit — so that
"making a good film" is a series of informed bets, not a checklist.

## Principle 7 — Connect existing systems rather than duplicating them

The game already contains most of the required substrate:

- static production risks (morale, safety, technical, budget) and live schedule
  pressure;
- a rich bank of on-set events, already tagged by risk dimension, genre, and
  severity;
- talent **reliability** and **ego**;
- talent/character **compatibility** and script **tone profiles**;
- writer creative identities, director strategies and ambitions, actor styles,
  and script identity;
- per-department production scores and the edit-coverage ceiling.

The preferred direction is to **connect these into causal chains**, not to build
parallel replacement systems. When a new behaviour is needed, first ask which
existing signal already models it and is simply not being _read_. Reliability
already lowers the odds of morale events but never affects the film; compatibility
already measures fit but only ever subtracts a few points; the edit-coverage
ceiling already models "you can't cut footage you didn't shoot" and is the exact
template for typed production consequences. The work is mostly wiring, not
invention.

---

## What this looks like in practice

A few worked implications, to make the principles concrete:

- **Reliability and preparation protect the downside; they do not manufacture
  upside.** A reliable, well-resourced production absorbs the same on-set
  problems with less damage to the finished film, contains failure chains, and
  makes catastrophes rare. What it must _not_ do is hand out a passive quality
  bonus for being safe: a careful shoot's job is to _preserve_ the project's
  potential, not to elevate it. Upside is earned only by genuinely positive
  execution events (a career-best performance, real chemistry, an inspired
  solve) — which can occur on any shoot, and which reliability neither creates
  nor guarantees. Ambition raises the ceiling _and_ widens risk; preparation
  buys that risk back down. Catastrophes remain possible, but rare and always
  causally justified — never the price of ambition alone.

- **Consequences are typed, not scalar.** A morale collapse hurts _performances_.
  A technical failure hurts _visual execution_. Lost shoot days reduce _coverage_,
  which limits how much the edit can repair. Exceptional improvisation lifts
  _captured performances_. Each consequence routes to the department it logically
  touches, which is what makes the outcome explainable.

- **The same inputs can yield different films — for legible reasons.** Two
  productions with identical scripts, directors, and casts can diverge, because
  their _shoots went differently_ — and the player can see exactly how. This is
  endogenous variance (Principle 1) realised through production (Principle 2)
  and explained by typed consequences (Principle 4).

- **Player and AI films should eventually converge on one execution model.** The
  player experiences the shoot day by day; a rival's shoot is resolved from its
  risk profile, identity, talent, and plan into synthesized events. Both should
  feed the _same_ finished-film calculation, so a rival can go sideways or
  transcend expectations the same way a player's film can.

---

## Non-goals

- **Not "increase AI variance."** Wider distributions are a _consequence_ of
  identity-driven risk-taking, not a knob.
- **Not "make the AI optimal."** The AI should make _coherent_ choices for its
  identity, including deliberately risky or deliberately safe ones — not the
  single highest-scoring choice available.
- **Not "punish ambition."** Ambition should be a bet with real upside, made
  affordable by preparation — not a coin flip.
- **Not a hidden release-time roll**, in any form, however mathematically
  convenient. Variance lives in the production, or it doesn't exist.

---

## Phasing

This philosophy is bigger than any one change. The intended order of arrival:

1. **Reconnect player production execution to the finished film.** Make the
   already-recorded shoot history genuinely shape the film, with typed
   consequences and legible causes. _(Done — see
   `docs/DESIGN_REVIEW_production_execution.md`.)_
2. **Give rivals an equivalent execution resolver**, so their films inherit the
   same variance from a synthesized shoot. _(Done — rivals now run the shared
   pipeline; see `docs/DESIGN_REVIEW_production_execution.md` "Phase 2".)_
3. **Acting model: craft, direction, and the unlocked performance.** Give actors
   a reliable floor + a director-unlockable headroom (decoupled from fame), and
   directors a hands-on-ness that unlocks or misfires on it — so direction
   genuinely matters, performances vary endogenously, and fame ≠ craft. Comes
   **before** Studio Identity, which depends on a craft axis to differ on. _(See
   `docs/DESIGN_REVIEW_acting_model.md`.)_
4. **Studio identity and objectives** driving rival acquisition, hiring,
   resourcing, and release — so variance becomes directional per studio.
5. **Creative disagreement as an explicit risk amplifier**, so competing
   creative visions widen the outcome distribution instead of merely subtracting
   a few points.

(Phases 2 and 3 are independent and can land in either order; Studio Identity
follows both.)

Each phase should leave the simulation shippable, measurable against the
diagnostic harness, and truer to the principles above than it was before.
