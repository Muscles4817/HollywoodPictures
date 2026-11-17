# Design review: pre-production as it really works

Status: **proposal for the owner.** Nothing here is built. It replaces the
pre-production part of `docs/IMPLEMENTATION_PLAN_market_realism.md` (Phase 6),
which is withdrawn: Phase 6 re-weighted dice and was the wrong kind of change.

Sources: `docs/domain/04-preproduction.md` (cited as **04 §n**),
`06-principal-photography.md` (**06**), `03-financing-and-dealmaking.md` (**03**),
`05-departments-and-crew.md`, `docs/SIMULATION_PHILOSOPHY.md` (**Principle n**),
`docs/DESIGN_REVIEW_production_redesign.md` (the facet model), and a full read of
the current code (file references below are as of this branch).

---

## 0. The short version

**What real prep is.** Pre-production is where a film's problems are found and
dealt with while they are still cheap. A script quietly demands things — a car,
a crowd, rain, a set that takes eight weeks to build, a costume that cannot be
started until the actor is signed, a permit that takes three months. Prep is the
race to discover those demands and settle them before 120 people are standing on
a set at £200,000 a day. Whatever prep does not catch, the shoot pays for, at
shoot prices. "Almost every problem that appears on set was either created or
prevented here" (04, opening).

**What the game does.** Prep is a fixed-length countdown. Each day there is an
18% chance of drawing one of 13 cards, uniformly at random. Most cards hand out
or take away quality points ("the table read went well, +3"). Nothing about the
film — its locations, period, cast, stunts, effects — and nothing about the
people hired changes which cards come up. The player cannot lengthen or shorten
prep, and prep decisions never reach the Inbox. Rivals pay nothing for prep and
make no prep decisions.

**What this note proposes.** Prep becomes the discovery-and-repair process it
really is:

1. Every film carries **hidden problems**, and how many it carries, and of what
   kind, follows from **its own moving parts** (the script's demands and the
   production plan), not from dice alone.
2. Prep **finds** problems. What it finds depends on **time**, on **which prep
   work was done** (scouting, tests, rehearsal, previs), and on **who was
   hired** to do it.
3. Each problem found comes with the **real options** studios have — spend
   money, spend time, cut or simplify, rewrite, recast, or carry the risk — at
   their real relative costs.
4. Problems prep does not catch **become specific things that go wrong on the
   shoot**: lost hours and days, a set handed over unfinished, a sequence that
   cannot be covered. They reach the finished film through the existing
   machinery (schedule → coverage → edit; department quality), never as a flat
   quality number.
5. **Prep does not add quality.** It protects what the film could be. Upside
   comes from the people and the plan; prep's job is to stop it leaking away
   (Principle "What this looks like in practice", first bullet).
6. **Rivals face the same problems with the same options**, and choose among
   them the way their kind of studio would — with their own prep time, prep
   cost and contingency, which today they do not have.

How often films run over, how badly, and so how many blockbusters a year
there are, should then **come out of** this — and be checked against what the
industry reference says actually happens, not tuned to a target.

---

## 1. How real pre-production works

### 1.1 Prep exists to buy certainty cheaply

The single fact everything else hangs on (04 §1.4, §10):

| | Mid-budget studio film | Tentpole |
|---|---|---|
| One extra week of prep for the core team | $50–150K | more, but small against the shoot |
| One lost shooting day | $150–400K | $500K–1M+ |

So "buying one extra prep week to avoid half a lost shooting day pays for
itself" — and line producers "lose that argument often, because prep money is
spent before there is any footage to show for it." Prep is cut not because
anyone thinks it is unnecessary, but because **a date became immovable** and
the front end was the only flexible thing left (04 §16).

### 1.2 What prep must achieve

A well-prepped production, on day one of photography, has (04 §12):

- a locked script;
- a schedule everyone believes;
- an approved budget;
- every location for the first fortnight permitted and scouted;
- sets built for the first block, drawings signed off for the rest;
- principal cast signed, fitted and tested;
- department heads hired and their orders placed.

"Films regularly start with several of these missing. It shows."

### 1.3 What goes wrong, and why

Problems are not random. They are latent in the script and the plan, and prep
either finds them or does not. The reference's own catalogue, grouped:

| Kind of problem | Where it comes from | Who finds it, and how | What it costs if it reaches the shoot |
|---|---|---|---|
| **The implied element** — the car, the crowd, the rain, the dog, the cleared TV footage that the script assumes but never names (04 §2.6) | Scripts with many physical demands | The 1st AD's breakdown and the line producer's costing, in the first weeks | Half a day to a full day lost, each time; or the shot is simplified on the day |
| **The long-lead item** — a hero set (6–12 weeks, up to 6 months), a bespoke costume (6–10 weeks), a prosthetic (10–20 weeks), a creature (6–12 months), picture vehicles, trained animals, permits (days to 6 months) (04 §1.3) | Period, fantasy, creatures, effects, heavy builds, specific locations | The production designer and department heads, as soon as there is a set list | The set handed over wet on the shooting morning; leads in rented approximations; the gag simplified |
| **Casting blocks everything bespoke** — nothing can be made until the actor is signed (04 §1.3, §7) | Leads cast late, or recast | Costume and makeup, immediately | No fittings, no rehearsal, the actor arrives cold |
| **Locations** — permits refused, the owner withdraws, neighbours revolt, no power, unusable sound (04 §5.4) | Location-heavy, multi-location, urban, remote | The location manager's scouting and the tech scout | Days and money; every line becomes dubbing; hours lost daily |
| **The budget doesn't fit** — the first scheduled budget is routinely 10–30% over (04 §4.3) | Ambition against money | The line producer, in week 2–3 | Resolved by "taking a pass for budget" (§1.5) or by spending contingency in prep — which leaves nothing for the shoot (03 §13) |
| **The schedule was built to the budget, not the work** (03 §13) | Too few days for the pages and the action | The line producer and 1st AD — who often knew and were overruled | Behind from day one, "a quarter to a half day per day" (06 §16) |
| **The script isn't locked** — scenes that die at the table read, characters who vanish, a film that is too long (04 §10.2) | Weak or unfinished scripts | The table read and the director's prep | The single most reliable predictor of an overrun, 5–25% (03 §13); departments prep twice |
| **The departments are making different films** — "two departments with different understandings of the same word" (04 §11.2); PD and DP with two visual plans (04 §9.7) | Creative heads who don't share a vision; a director who won't decide | Concept art, camera and costume tests, the production meeting | Re-lighting, regrading, reshoots; "the film has two visual plans and neither wins" |
| **Performances aren't ready** — no rehearsal, lines not known, a pairing with no chemistry (04 §10.1, 06 §5.5) | Rehearsal cut (always the first thing cut); late casting | Rehearsal, chemistry reads | 30–60 minutes per scene, compounding; a lead who doesn't know lines costs 1–3 hours a day |
| **Action not prepared** — stunts need 2–8 weeks of rehearsal, rigs tested, performers trained (04 §10.5) | Stunt- and action-heavy scripts | The stunt coordinator, stuntvis | Unsafe or simplified gags; 15 minutes to 3 hours per reset |
| **Effects not planned** — VFX methodology undecided, no previs (04 §10.4; 08) | VFX-heavy films | The VFX supervisor and previs | Decided on the floor ("the most expensive place"); VFX shot count grows in post, 5–40% (03 §13) |
| **The start date slips** — 2–4 weeks and "the good ones" take other jobs; 6+ weeks is effectively a re-crew (04 §9.6) | Prep extended or the start pushed | Everyone | Second-choice crew; across a season the exteriors no longer match |
| **The director won't decide** (04 §13.4) | An indecisive director | Every department waiting on a decision | Departments default to "the most expensive interpretation"; 15–45 minutes per occurrence on set (06 §5.6) |

How much of this a film faces scales with its **moving parts**, not its budget:
"A $40M two-hander in one house needs less prep than a $6M period film with
forty speaking parts, and treating budget as the proxy is how the second one
gets wrecked" (04 §16).

### 1.4 Who catches problems

Skill shows up as **seeing problems early** and **saying what they cost**:

- A good 1st AD reads for the implied element, flags cost drivers in week one,
  and resolves ambiguity in a conversation (04 §2.7).
- A good line producer answers the cost of a request in under a minute, knows
  which budget lines are soft, and protects the shooting day (04 §4.6).
- A good production designer designs for the camera and the schedule, decides
  fast, and finds the location that removes a build (04 §6.5).
- A good casting director knows the 200 actors who could play the part and
  judges chemistry before the read (04 §8.2).
- A good HOD says "yes, and it costs a day", and is honest about lead times
  while things are still fixable (04 §9.7).
- A crew that has worked together is **10–25% faster** on setups (04 §9.4).
- A director who arrives with a shot list makes decisions in prep "at zero
  marginal cost" instead of on set (06 §5.6).

### 1.5 The options real productions have

When a problem is found, the menu is consistent across the reference:

| Option | Real cost | Notes |
|---|---|---|
| **Spend money** — rush orders, a second build crew, more costume multiples, pre-rigging | Money | "Always the first choice if the money exists" (06 §16.2) |
| **Spend prep time** — extend prep, push the start | Prep burn per week, plus the risk of losing booked crew and cast (04 §9.6) | Cheap in money, expensive in availability |
| **Take a pass for budget** — merge locations, kill company moves, night to day, smaller crowds, merge characters, simplify set pieces, cut a set, cut effects, trim pages (04 §4.5) | Scope, in a strict order from "usually nothing, often improves the film" to "the film starts to feel smaller" | The top of the list often makes the film better |
| **Rewrite** | The writer's time and fee; departments re-prep | Cheap if early, compounding if late |
| **Recast or rehire** | Fees, delay, and starting that department's prep again | |
| **Spend contingency in prep** | Nothing now; nothing left for the shoot | The classic mistake (03 §7.5) |
| **Carry it** | Nothing now; the shoot pays at shoot prices | Sometimes right: not every risk fires |

And when prep is short, professionals protect and sacrifice in a known order
(04 §16): protect the breakdown and schedule, the leads' casting, the first
block's locations and sets, tech scouts, tests on the principals, the
production meeting, costume multiples; sacrifice rehearsal first, then extra
concept art, previs for non-action scenes, later-block design, boarding of
dialogue scenes, second-unit prep.

### 1.6 How often things go wrong (what to check the model against)

The reference gives sizes, not a single rate, and that is what the model should
be judged by (03 §13.1):

| Mechanism | Typical overrun |
|---|---|
| Script not locked at greenlight | 5–25% (the root cause of most others) |
| Schedule built to the budget | 5–20% |
| Prep too short | 3–10% |
| Contingency spent in prep | up to all of it |
| Weather and location loss | 1–8% |
| Cast illness or unavailability | 1–5% |
| Reshoots during the shoot | 2–10% |
| VFX shot-count growth | 5–40% on a VFX-heavy film |

"Overruns are not random. They arrive through a small number of mechanisms ...
and most of them are visible in advance to anyone who knows what to look at."
And **"almost every overrun is paid for twice"** — once in money, once in the
film, "because the standard remedy for being over is descoping".

---

## 2. What the game does today

From a full read of the code (references are to `src/`).

### 2.1 The prep phase

- **Length** (`engine/production.ts:127-168`): 21 days + scale + "cast size" +
  effects money + setting + period. Fixed at greenlight. "Cast size" is
  `talent.length`, which counts crew: hiring a production designer lengthens
  prep by 2.5 days. Genre, script complexity, the location/studio/digital
  strategy and every person's attributes are ignored.
- **The player cannot shorten, extend or skip prep.** The one pre-greenlight
  lever, the design-prep slider, can lengthen it but not shorten it; set below
  the formula it only lowers set quality (`ProductionPlanning.tsx:549-559`,
  `studioReducer.ts:2327-2334`). "Begin principal photography" just runs the
  remaining days.
- **Events** (`data/productionEvents.ts:2932-3057`, rolled at
  `engine/production.ts:857-894`): 13 templates, 9 positive and 4 negative, an
  18% flat daily chance, picked **uniformly**. Each fires at most once, so a long
  prep simply draws more of the same 13 cards. The film's moving parts and the
  hired people change nothing about which cards are possible — except one
  personality trait on the lead, and the writer's and director's skill shifting
  two choices' outcomes.
- **Prep hands out quality.** "Table read revelation" +3–7, "rehearsal
  chemistry" +2–6, "design breakthrough" +2–6, "commission the rewrite" +2–8,
  "build the set" +4–9. That breaks the philosophy's own rule that preparation
  protects potential but does not manufacture it.
- **Prep's effect on the shoot** is one number added to **all four** risk
  dimensions equally (`applyPrepRiskDelta`): a safety walkthrough lowers morale
  risk.
- **Delays never delay anything.** A prep "delay" spends prep days the film was
  going to spend anyway; the start never moves; `committedStartDay` is display
  only.
- **Costs.** Prep burns cash daily (`engine/cost.ts:52-77`), but the burn is
  capped so that above roughly £6–24M of negative it is a token amount, and no
  affordability check covers it.

### 2.2 Things that are simply broken

| Problem | Where |
|---|---|
| Prep decisions never appear in the Inbox or the badge, despite the reducer comment saying they can be answered from there | `engine/project.ts:181`, `Inbox.tsx:252-284`, `studioReducer.ts:2552` |
| The prep decision card says "Filming is paused until you pick" | `OnSetDecisionCard.tsx:118` |
| A film held waiting for its cast never starts on its own; its bookings lapse while it waits | `productionsInProgress.ts:109-111`, `PreProductionRun.tsx:64` |
| Bookings are fixed at greenlight and never extended; once a booking's end passes, rivals can hire the person while the player's film still has them | `studioReducer.ts:2361-2369`, `person.ts:164-166` |
| A second film's prep freezes while the player is on a wizard screen, though the calendar moves | `studioReducer.ts:1144`, `App.tsx:84-101` |
| The greenlight dialog and delivery estimate show a prep length that ignores the design-prep slider | `GreenlightConfirmation.tsx:28`, `deliveryEstimate.ts:93` |
| The greenlight gate leaves out the contingency reserve the button includes | `projectReadiness.ts:170-176` vs `selectors.ts:988-999` |
| Two different "is this a period film" flags that can disagree | `production.ts:166` vs `requirementProfile.ts:206` |
| The location/studio/digital strategy and the execution strategy affect nothing in prep or the shoot | `productionChoicesAdapter.ts`; `types/index.ts:2841-2850` |
| `productionRequirements` (extras, locations, vehicles, animals, stunts, crowd) is unused outside scaffolding | `types/index.ts:741-752` |

### 2.3 What already exists that this should build on (Principle 7)

- **The facet model** (`engine/facetModel.ts`, `setsFacet.ts`, and the
  production redesign doc §3): each craft facet's quality comes from money ×
  time × the head's skill against an ambition target, with floors and
  diminishing returns. Set quality already depends on granted prep days. This
  is the right model for **how good a department's work is**; it stays.
- **The requirement profile** (`engine/requirementProfile.ts`): a derived
  breakdown of a script into 17 demands — location work, period architecture,
  studio build, period costume, prosthetics, creatures, combat stunts, vehicle
  action, crowd work, extras, animals — each with magnitude, frequency,
  complexity and criticality. It is the game's version of 04 §2's breakdown, and
  today it feeds nothing that matters.
- **Department workload** (`engine/departmentWorkload.ts`): turns requirements
  into workload for design, VFX and stunts; costume, makeup and the AD team are
  deliberately unrouted.
- **The shoot machinery**: delays → shooting ratio → coverage → the edit
  ceiling; typed impacts to performances, script, post and each facet;
  escalation and resilience (`engine/productionExecution.ts`). Problems carried
  out of prep should arrive through this, not beside it.
- **People data**: skill, reliability, experience, professionalism, ego,
  temperament, pressure handling, adaptability; director `productionStyle` and
  `handsOn`; crew philosophy and creative tension; pairing history
  (`TalentPairing`); producers with specialties (a "Line" producer already
  exists, as a cost discount).
- **Bookings** (`availability.commitments`) — the substrate for "the start
  slipped and the good ones left".

---

## 3. Design rules for this rewrite

1. **Cause before chance.** A problem exists because something about the film,
   the plan or the people makes it likely. Chance decides *whether* a likely
   problem materialises and *when* it is found — never *what kind of film* has
   it.
2. **Prep protects; it does not add.** No prep outcome raises a film above what
   its script, people and plan could deliver. A good prep's reward is **money
   and days kept, and potential preserved**.
3. **Costs in the currencies the industry uses**: money, prep time, start-date
   risk to bookings, scope (which costs quality in a named department), and
   shoot time (which costs coverage, money and morale).
4. **Every risk is legible before greenlight** (Principle 3): the player can see
   *why* this film will be hard to prep, in words.
5. **The same model for everyone.** Rivals' films carry the same problems,
   choose from the same options, and pay the same costs.
6. **Few, meaningful decisions.** A real prep has hundreds of decisions; the
   game should surface the handful that change the film, at the moments a real
   producer would face them.
7. **Check against the industry, not against market targets.** The model is
   right when overrun sizes, the effect of short prep, and the difference
   between a two-hander and a period epic look like §1.6. Box-office results are
   then observed; if they look wrong, investigate the cause.

---

## 4. The model

### 4.1 The film's demands (the breakdown)

At greenlight the film's **demands** are derived (pure, not stored —
Principle 8) from data that already exists, fixed so it is consistent:

- **From the script**: the requirement profile's leaves (`requirementProfile.ts`),
  the setting archetype's profile (`data/settings.ts` — construction, location
  complexity, travel, logistics, extras, period, vehicles), the cast (speaking
  parts by prominence; characters with high physical or transformation demand;
  creatures), `productionRequirements`, structural soundness (the script's
  structure and character craft: a weaker script carries more "not really
  locked" risk), and runtime.
- **From the plan**: the environment strategy (location / studio / digital —
  wired at last, since it decides whether prep is a construction problem or a
  logistics problem, 04 §14), effects strategy and ambition, set and effects
  money, the shooting budget against the days the work needs, the contingency
  reserve.
- **From the dates**: how much prep time there is, and whether the release date
  is already fixed.

One "period" flag (the setting archetype's) is kept and the other derived from
it. "Cast size" counts actors, not crew.

The demands are grouped into **prep fronts** — the parallel chains of 04 §1.3 —
each owned by a department:

| Front | Owner (in the game) | Driven by |
|---|---|---|
| **Breakdown, schedule and budget** | The producer team (a Line producer if attached) and the director | Number of physical demands, script soundness, shooting budget vs work |
| **Design and build** | Production designer (or no one) | Studio builds, period architecture, creatures, set ambition |
| **Costume, hair and makeup** | No head today; the director and PD stand in | Period costume, prosthetics, transformation, cast size |
| **Locations** | No head today; the producer team stands in | Location work, travel, logistics, urban/remote setting |
| **Casting and performance** | Casting director (if hired) and director | Speaking parts, chemistry-critical pairings, late or recast leads |
| **Action and stunts** | Stunt team | Combat, vehicles, heights, fire, water, physical demand |
| **Effects** | VFX supervisor | VFX ambition, creature animation, digital environments |
| **Visual plan** | Director with DP and PD | Creative tension between the heads; director decisiveness |

Fronts with no demand cost nothing and carry no problems. A chamber drama has
two or three live fronts; a period war epic has all eight.

### 4.2 Hidden problems

At greenlight each live front is given its **problems**: concrete, named things
that will go wrong if nobody catches them. They are drawn once (seeded per
film, deterministic thereafter) from a catalogue built on §1.3, with the
**expected number and severity set by the front's demand** and by the plan:

- more demand → more problems (a crowd scene, rain and a picture car are three
  implied elements; a two-hander has none);
- ambition stretched against money or time → more and worse (the facet model's
  "stretch" already measures this);
- a fixed, near release date and a short prep → more of the "schedule built to
  the budget" kind;
- an unsound script → "not really locked" problems that surface at the table
  read.

Each problem has:

| Field | Meaning |
|---|---|
| **Front and kind** | e.g. Design · "hero set's lead time exceeds prep"; Locations · "permit for the bridge"; Breakdown · "implied crowd in the stadium scene" |
| **Severity** | What it costs **on the shoot** if never addressed: hours lost per affected day, whole days, a facet's execution swing, a coverage loss, a performance loss |
| **Visibility** | How hard it is to see. Some are obvious once anyone looks (the set list shows the hero set); some need specific work (only a tech scout finds the power problem; only a chemistry read finds the dead pairing) |
| **Fixes** | The subset of §1.5's menu that applies, each with a cost in this film's own money and days |
| **Deadline** | The latest point at which each fix is still available — a rush order works in week 3, not week 9; a rewrite is cheap before the table read and expensive after |

The player never sees the hidden list. They see, before greenlight, a
**qualitative outlook per front** ("The design front is heavy: three builds with
long lead times, and your designer has asked for more time than the schedule
gives"), which is what a real producer would be told (Principle 3). A
pre-greenlight forecast reads only the **expected** problem load, never the
draw.

### 4.3 Prep time, and what it is spent on

**Recommended prep** is derived from the fronts, not the budget: each owner
states how long their chain needs (the production redesign's "per-head ask",
already decided as the time model, §6.1 there), and prep is as long as the
longest chain plus the fixed core (breakdown, schedule, budget, production
meeting). A two-hander comes out at 3–5 weeks; a creature-heavy tentpole at
months, matching 04 §1.

**The player chooses** (before greenlight, adjustable until the shoot starts):

- **Prep length** — the recommended length, longer, or shorter. Longer costs
  prep burn and pushes the start (§4.6). Shorter is allowed: it is how real
  films are made when a date is fixed.
- **Prep work**, as a short list of real activities, each with a cost in money
  and days and a front it serves:
  - **Scouting and tech scouts** (locations; finds the power, sound, access,
    permit problems);
  - **Camera, costume and makeup tests** (visual plan, costume; ends the "in
    dailies it looked…" argument);
  - **Rehearsal** (performance; finds chemistry and line problems; costs actor
    days and, for some material, a little spontaneity — 04 §10.1);
  - **Previs and stuntvis** (effects and action; turns an unpriceable sequence
    into a schedulable one);
  - **The production meeting** (all fronts; the last cheap chance — always on,
    but can be shortened).

  Each defaults sensibly for the film (no previs on a dinner-party drama). When
  prep is shortened, activities are dropped in **the reference's order of
  sacrifice** (04 §16): rehearsal first, then extra design depth, then
  non-action previs — unless the player chooses otherwise. This is what makes
  "cut prep" a decision with legible consequences instead of a slider.

### 4.4 Finding problems

Prep runs as a calendar of weeks. Each week, for each live front, each unfound
problem has a chance of being found that depends on:

- **whether the work that reveals it is being done** (a tech-scout problem is
  only found by a tech scout; a chemistry problem only by rehearsal or a
  chemistry read);
- **the owner's skill** — the head's craft skill and, for the breakdown front,
  the attached Line producer's (a weak or missing owner finds less, and finds it
  later);
- **familiarity** — a director and head who have worked together find
  disagreements earlier (pairing history, which today is only recorded for a few
  role pairs and should be recorded for all heads);
- **how late it is** — the real prep calendar (04 §1.2) puts the breakdown and
  budget problems in weeks 1–3, design and location problems in weeks 3–7, and
  test, rehearsal and safety problems in the last three weeks.

Chance decides only whether a findable problem is found *this week or next*.
The outcome of a well-run prep is that almost everything severe is found in
time; of a rushed or under-staffed one, that the shoot meets the rest.

### 4.5 Deciding what to do about them — the game's prep rhythm

Problems are not presented one a day. They arrive in batches at the four real
moments a producer faces them (04 §1.2), which become the game's **prep
checkpoints**:

1. **The first budget and board** (end of week 2–3 of a ten-week prep). The
   breakdown's finds: implied elements, the schedule that doesn't fit the work,
   **the budget gap**. The decision here is the reference's "find $4M": cover
   it from studio money, **take a pass for budget** (the ordered menu of 04
   §4.5, offered as concrete cuts — "merge the two apartment scenes into one
   location", "the stadium becomes 80 people shot tight", "cut the hospital
   set" — each with its saving and the department whose quality it costs), or
   **spend contingency** (shown for what it is).
2. **Design and locations lock** (mid-prep). Long-lead items that cannot be
   ready, locations at risk, casting that is blocking costume. Options: pay to
   rush, extend prep, simplify or substitute (stock costumes, a backlot street,
   a set extension instead of a build), rewrite to remove or merge.
3. **Tests, rehearsal and scouts** (the last three weeks). Visual plans that
   disagree, performances that aren't ready or a pairing with no chemistry,
   action that isn't safe yet, sites that don't work. Options: settle it now
   (a decision by the director, a reshoot of the test, more rehearsal days), a
   recast or rehire (late, expensive), simplify the gag, or carry the risk.
4. **The production meeting** (the final week). Everything still open is listed
   once, honestly, with the readiness checklist of 04 §12 in plain words
   ("Script: locked. Schedule: nobody believes it. Locations: the first
   fortnight is secured…"). The final choice is the real one: **start on the
   date** and carry what is left, **slip the start** (§4.6), or **cut** to fit.

Each option shows its cost in money and days and names what it costs the film
in words, never a quality number (CLAUDE.md presentation rule). Decisions not
taken by the deadline default to **carry it**, which is also what an
inattentive studio does. Each checkpoint is a notification under the
notification contract (§5.3).

### 4.6 Time costs real things: the start date and bookings

Extending prep or slipping the start moves the shoot, and bookings move with
it. Following 04 §9.6:

- a few days: absorbed;
- about a week: people with a hard commitment elsewhere are lost and replaced
  from a similar tier;
- 2–4 weeks: department heads start dropping, and **the best are the likeliest
  to have somewhere else to be** (a person's availability already lives in
  `availability.commitments`; the existing rival booking and career "taking
  work" logic decides who leaves);
- 6+ weeks: most of the crew re-forms from second choices.

Leads who leave are recast through the existing recast machinery. This fixes
two current bugs (bookings that never extend, and a held film that never
starts) by making bookings follow the film's real dates, and makes "the slow,
cheap road" carry its real cost, which the production redesign doc called for
(§6.3 item 2 there) and left open.

### 4.7 What reaches the shoot

Every problem still open when the cameras roll becomes a **scheduled shoot
incident**: it fires on the shoot when the part of the film it belongs to is
being shot (early for the first block, later for later fronts), with the
consequence its severity describes, routed through the machinery that already
exists:

| Kind of consequence | How it reaches the film (existing code) |
|---|---|
| Hours lost per day at a set or location; whole days lost | Shoot days → shooting ratio → coverage → the edit ceiling; and the daily burn, against contingency |
| A set or effect simplified on the day | The facet's execution swing (sets, VFX, practical) |
| Performances under-rehearsed, a dead pairing | Performance capture |
| Script changing during the shoot | Script execution, plus compounding schedule loss |
| Two visual plans | Post execution (the grade has to pick one) |
| A safety near-miss | The existing safety bank and escalation |

The existing **random** shoot events stay for what is genuinely random on a set
— weather, illness, equipment failure, a public that won't stay quiet — and
their rates continue to read the static risk dimensions. Prep's effect on those
becomes **targeted**: scouting lowers location and weather exposure (cover sets
planned), stunt prep lowers safety, a locked script lowers morale and script
risk. The single shared "prep risk delta" goes.

The upshot is the causal chain Principle 4 asks for, told by the game:
*"The stadium crowd was never in the budget. On the day, 80 extras stood in for
2,000, the sequence took two extra days, the edit had less to work with, and the
finale feels small."*

### 4.8 Who you hired

| Front | Skill that finds and fixes problems | Today in the game |
|---|---|---|
| Breakdown, schedule, budget | 1st AD and line producer | No such hires. Proposed: the attached **Line** producer's skill does this job (it is a producer specialty already); with no Line producer, a competent-but-ordinary production office. A hireable 1st AD is an open question (§9) |
| Design and build | Production designer | Exists |
| Costume, hair, makeup | Costume designer, makeup head | No such hires; deliberately unrouted today. Stand-in: director and PD, at a penalty for heavy period or prosthetic films. Open question (§9) |
| Locations | Location manager | No such hire. Stand-in: the producer team. Open question |
| Casting | Casting director | Exists |
| Action | Stunt coordinator / team | Exists (stunt teams) |
| Effects | VFX supervisor | Exists |
| Visual plan, decisions | Director, DP, PD together | Exists; needs a **decisiveness** reading of the director, derived from existing data (production style, adaptability, ego) rather than a new stored stat |

Familiarity (pairing history) and reliability apply across all fronts:
reliable heads report bad news early (04 §9.7 "honesty about lead times").

### 4.9 What the player feels

- **Before greenlight**: an honest outlook per front, and a recommended prep
  length they can accept, extend or cut, with the activities that cut would
  drop.
- **During prep**: four checkpoints a film, each a short, specific briefing
  with real options and costs — not a daily stream of cards. Between them the
  prep runs on its own.
- **On the shoot**: incidents they can trace back to a choice ("you cut the tech
  scout"), alongside a smaller amount of genuine bad luck.
- **After release**: the story report names the chain.

Difficulty sits in **the trade-offs**, which are the real ones: money now or
risk later; a fixed date or a prepared film; a bigger vision or one that can
actually be shot. A careful player who preps properly should finish most
shoots close to schedule; a player who greenlights an ambitious film on a short
prep with a weak team should feel it.

---

## 5. Rivals, and the rest of the world

### 5.1 Rivals use the same model

A rival's film gets the same demands, problems and checkpoints. What differs is
**who decides**: at each checkpoint a rival chooses by a policy that reads its
situation and character, not by a fixed 70%-sensible rule:

- **money on hand** (a cash-tight studio cuts scope or carries risk; a rich one
  pays);
- **its release date** (a tentpole with a dated release protects the date and
  pays or cuts; a small film slips);
- **its kind** (a prestige house protects rehearsal and design; a genre house
  protects the date and the budget);
- **its own record** (§5.2).

Rivals also need what they lack today (`rivalStudios.ts:1160-1190`): a
contingency reserve, prep time on their calendar, prep cost, and bookings that
cover prep. Without these no prep model can treat them like the player.

### 5.2 Rivals that learn

The owner has asked that rival studios adapt, and they do not: genre, budget
level and risk appetite come from fixed tables (`GENRE_TIER_BIAS`,
`SCALE_SPEND_RANGE`, `deriveRivalSpendPlan`). A full design for adaptive rivals
is a companion note (§8 step 6). The hooks this note needs from it:

- a rival remembers its recent productions' **overruns and their causes**;
- a rival that kept losing days to short prep **preps longer and carries more
  contingency** on its next films, and one that over-prepared and lost its
  release window does the reverse — bounded, so it moves within its character
  rather than becoming a different studio.

### 5.3 Notifications

Each checkpoint, and each problem that becomes urgent, resolves on the
background tick and so owes the player a notification
(`docs/DESIGN_notification_contract.md`): a category in `deriveInboxItems`,
counted in the badge, one card per checkpoint naming the film, routing to that
film's prep briefing, cleared when the briefing has been read. This also fixes
today's bug where prep decisions never reach the Inbox.

---

## 6. What goes away

- The 13-card prep bank's **quality payouts** and the uniform daily draw. The
  card texts are good material and many become catalogue entries (a permit
  snag, an understaffed department, a difficult star clashing early), now with
  causes.
- The single prep risk delta applied to all four risk dimensions.
- The withdrawn Phase 6 table changes (never merged).
- Rivals' "70% sensible" prep choice rule.

---

## 7. How we will know it is right

Not by box-office targets. In order:

1. **Mechanism tests** (unit level): a film with more demands carries more
   problems; a missing activity never finds its problems; a skilled owner finds
   more and earlier; a cut prep drops rehearsal first; a slipped start loses
   people with competing bookings, the best first; no prep outcome raises a
   facet above its funded potential.
2. **Shape checks against the reference**, on a population of player and rival
   films:
   - a two-hander needs 3–5 weeks and rarely overruns; a period epic needs
     months and overruns badly when cut (04 §1, §16);
   - overrun sizes by cause land in §1.6's ranges (script not locked 5–25%,
     short prep 3–10%, weather/location 1–8%);
   - well-prepped films finish near schedule most of the time; rushed ones lose
     days early ("week one is diagnostic", 06 §16.1);
   - overrun is paid twice: in money, and in a named department of the film.
3. **Then the market is observed** with the existing harnesses (career gate,
   box-office gates). If anything looks wrong — too few blockbusters, careers
   too easy — the next step is to find out **why** from the films themselves,
   and ask how the real industry behaves, before anything is changed.

---

## 8. Order of work

Each step leaves the game playable, tested and measurable.

1. **Fix what is broken** (§2.2): prep decisions in the Inbox and the badge;
   the decision card's wording; bookings that follow the film's dates; held
   films that start; other films' prep advancing on every calendar move; one
   prep length shown everywhere; the greenlight gate including contingency;
   one period flag; "cast size" counting actors. No design change.
2. **The breakdown**: derive demands and fronts from existing data, wire the
   environment strategy and `productionRequirements`; show the qualitative
   outlook before greenlight. Recommended prep from the fronts.
3. **Problems, finding them, and what reaches the shoot**: the catalogue, the
   weekly finding, scheduled shoot incidents, targeted risk. The 13-card bank's
   quality payouts go.
4. **The four checkpoints and their options**, with notifications; prep length
   and activities as player choices.
5. **Time costs**: start slips moving bookings, people leaving, recasts.
6. **Rivals**: contingency, prep time and cost, the same problems, a
   checkpoint policy by situation and character; then the companion note on
   adaptive rivals.
7. **Measure** (§7), and investigate before changing anything else.

---

## 9. Decisions for the owner

1. **Missing heads.** The reference's key prep roles — 1st AD, line producer,
   location manager, costume designer — are not hireable. Options: (a) keep
   them out and let existing roles stand in (the producer team for breakdown and
   locations; director and PD for costume), at a stated disadvantage on films
   that lean on those fronts; (b) add **one** new hire, a **line producer / 1st
   AD** pairing, because the breakdown front touches every film; (c) add all
   four. Recommendation: **(b)** now, the others only if playtests show the
   stand-ins feel wrong.
2. **How much the player manages.** Four checkpoints per film is the
   recommendation. With several films in flight that is a lot of briefings;
   an option to **delegate a film's prep** to the attached producer (who then
   decides by their own judgement, with the same costs) keeps it manageable.
3. **How hard.** The earlier decision was "kinder than the real industry". The
   lever for that in this model is honest and visible: how often a properly
   prepped film still meets bad luck, and how forgiving the fixes are — not
   hidden bonuses.
4. **Shoot-side rewrite.** This note keeps the existing random shoot events
   for genuinely random trouble. The shoot itself (overtime, coverage choices,
   catching up — 06 §7, §16) deserves the same treatment as prep; it is the
   natural next note.
