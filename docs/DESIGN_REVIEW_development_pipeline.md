# Design Review: The Development Pipeline — Opportunities, Assets, and a Real Greenlight Decision

Status: **pure conceptual exercise - no code, no implementation.** Follow-up
to `DESIGN_REVIEW_domain_model.md` (this document **revises** its Q3/Q6
stage tables - I say exactly where and why below) and builds directly on
the shipped `Project`/calendar work (roadmap Phases 0-7,
`DESIGN_REVIEW_implementation_roadmap.md`, all live in code today). Nothing
here is decided until it's built and folded into `DESIGN.md`.

---

## TL;DR

- **Four concepts, but only two of them are new entities.** `Opportunity`
  and `Asset` are genuinely new, world-level and studio-owned respectively.
  `Project` already exists and just grows two new early stages. **`Film`
  stays a *word*, not a fifth type** - exactly the call
  `DESIGN_REVIEW_domain_model.md` already made for "released Project" and
  I'm making again here for "Project once it's in production": a name for
  what a late-stage `Project` *is*, not a different thing it turns into.
- **Idea and Library aren't Project stages - they're what Assets and
  released Projects are called before/after the Project's own life.**
  "Idea" = an `Asset` sitting in the library with no `Project` attempt
  against it yet. "Library" = a `released` `Project` whose run has settled
  - already true today, already argued in `domain_model.md` Q6, not
  reopening it. That drops your ten-stage pipeline to **eight `Project`
  stages**, and I'd argue only **two of those eight are genuinely new**
  (`Greenlit` is the real addition; everything else is an existing wizard
  stage getting a clearer name and a slightly later commitment point).
- **The single most important new rule: Development doesn't spend real
  money. Greenlight does.** Today `BEGIN_PHOTOGRAPHY` is both "the studio
  commits" and "cameras roll" at once. Splitting those into `Greenlit` →
  `Pre-production` → `Production` is the one structural change everything
  else in this document hangs off - it's what makes attaching talent,
  estimating budget, and walking away from a bad idea *before* money moves
  a real, cheap, reversible decision instead of today's all-or-nothing
  wizard commitment.
- **Talent Attachment collapses your eight states to four real ones:
  Available → Attached → Contracted → Booked.** `Interested`/`Negotiating`
  are flavor text around one resolved action, not stored state nobody ever
  branches on - the same "does anything outside the current screen need to
  observe this" test `domain_model.md` already uses to prune stages.
  Critically, **`Attached` doesn't check availability at all** - that's
  what makes "attach Nolan to a project starting after his current booking
  ends" fall out for free instead of needing new plumbing.
- **Opportunities are a shared, contested, expiring resource - modeled
  exactly like `Talent` already is**, not like today's per-draft
  `scriptOptions` slate. World-level, visible to every studio, generated on
  a per-tier timer the same way rival productions already spawn.
- **I'm recommending you ship this player-side first, with AI studios kept
  on their existing shortcut initially.** Rewriting `rivalStudios.ts` onto
  the full pipeline at the same time as building it is exactly the kind of
  big-leap risk the whole roadmap that got you here was designed to avoid.
  Phasing is in §12.
- **What I'm pushing back on, up front:** your ten-stage `Project` pipeline
  (too many stages nothing needs to observe separately - see §3), the
  eight-state Talent lifecycle (same issue - see §6), and Script
  Coverage/Market Research/Concept Art as their own systems (real-sounding,
  no mechanical payoff proposed - see §4). Full list of challenges in §11.

---

## 0. Why this is four concepts and not five (or three)

Your framing draws a real, useful line: *not owned* (Opportunity) vs.
*owned but not committed* (Asset) vs. *committed business decision*
(Project) vs. *exists in the world* (Film). That's a genuinely better cut
than what's in the code today, where all four of those are blurred into
one `FilmDraft` from the moment `START_NEW_FILM` fires.

But `domain_model.md` already fought this exact battle once, for a
narrower question ("is a released film a different *type* from a film in
production?"), and landed on: **one entity, one persistent id, a
discriminated union by stage** - specifically *because* the alternative (a
chain of distinct types: `FilmDraft` → `CompletedFilm` → `Film`) produces
id churn and "did I copy every field correctly" bugs, and the codebase had
already been bitten by exactly that (the `RELEASE_FILM` id-churn bug fixed
in roadmap Phase 5). I'm applying that same finding here rather than
re-litigating it:

- **`Film` doesn't get its own type.** It's what you call a `Project` once
  it has a script, cast, and reception people talk about - i.e., roughly
  `Production`-stage onward. Same entity, same id, same array, all the way
  through. This isn't a new call - `domain_model.md` §4 already made it for
  "released"; I'm just confirming it holds at the *start* of the pipeline
  too.
- **`Opportunity` and `Asset` *do* earn real entity status**, for a
  structural reason neither `Film` nor "Idea"/"Library" have: **cardinality**.
  One `Asset` can produce zero, one, or several `Project` attempts over its
  life (a stalled adaptation gets tried again two years later; a hit
  spawns a sequel that's a *new* `Asset`/`Project` referencing the
  original's id). A `Project`, by contrast, has exactly one continuous
  life. That 1-to-many relationship is precisely what a single
  discriminated union *can't* represent on its own - the same reason
  `Talent` stays a separate entity from `Project` even though a naive
  design would be tempted to just embed cast info per-film. `Opportunity`
  and `Asset` are structurally closer to `Talent` (a shared, referenced,
  scarce resource with its own lifetime) than to `Project` (one committed
  attempt), and I've designed them that way throughout this document.

So: **`World` gains two new referenced, non-contained lists -
`opportunities: Opportunity[]` and, per-`Studio`, `assets: Asset[]`** -
alongside the existing `projects`/`talentPool`. `Project` gains a
`assetId` reference and two new early stages. Nothing about `Film`,
`Talent`, or the already-shipped `Scheduled`/`Released` machinery changes
shape.

---

## 1. Opportunity Generation

**What it replaces:** today's `FilmDraft.scriptOptions` - a slate of
scripts regenerated fresh every time `SET_GENRE`/`REROLL_SCRIPTS` fires,
with no existence outside that one draft, no expiry, no contention with
anyone else. Opportunities are the same generative machinery
(`engine/scriptGenerator.ts`'s archetype-first roll is untouched and
reused wholesale - this is presentation/lifecycle, not a rewrite of *how
scripts are generated*) given a real, shared, time-bound existence.

**Source taxonomy** - I'd keep this to a small enum with real mechanical
weight per source, not eight bespoke systems:

| Source | What it skews | Pre-attached talent? | Typical cost | Expiry window |
|---|---|---|---|---|
| Spec screenplay (writer) | Wide quality variance, any genre/archetype | No | Low-medium | Short - other studios are reading it too |
| Agent package | Above-average quality floor, genre-flexible | Sometimes a Lead Actor "attached in principle" | Medium-high | Medium |
| Publisher (book/comic rights) | Setting/story-type locked to the source material, built-in audience awareness | No | Medium-high | Long, but the *Asset* it becomes carries its own rights-expiry (see §2) |
| Director pitch | Archetype/tone skews toward that director's own profile | Yes - the pitching director, already Attached | Low (it's their passion project) | Short - they'll take it elsewhere |
| Actor passion project | Skews toward roles suited to that actor | Yes - the pitching actor, already Attached | Low-medium | Short |
| Studio executive (internal) | Safe, on-trend, lower quality ceiling | No | Free | Long - it's yours whenever you want it, nobody's racing you for it |
| Sequel opportunity | Locked genre/tone to the originating `franchiseId`, quality floor boosted by the original's reception | No (existing cast may re-attach easily - see §6) | Free to acquire (you already own the franchise), real cost is in Development | Doesn't expire - it's your own IP, use it whenever |

The columns are the whole point: **source is mostly flavor riding on three
real levers (pre-attachment, cost, expiry), not eight parallel systems.**
That's a deliberate, small surface - matches the "small number of real
parameters, many flavor labels" pattern the game already uses for
`ScriptArchetype` (5 archetypes, each just a bundle of weight tables, not 5
separate generators).

**Generation cadence:** reuse the exact `nextSpawnCheckDay` per-tier timer
pattern `engine/rivalStudios.ts` already uses for production spawning,
applied at the *world* level instead of per-rival - a periodic "the
industry generates opportunities" tick, producing a small batch visible to
**every studio simultaneously**, the player included. This is what makes
opportunities feel like a real, contested market rather than a private
slot machine: a studio-executive freebie is basically guaranteed to still
be there next week; a hot agent package might be gone by the time you
circle back.

**Expiry:** each `Opportunity` gets an `expiresOnDay`, resolved the same
lazy, catch-up-safe way every other calendar-triggered thing in this
codebase already resolves (`settleScheduledReleases`,
`settleRivalMarket`) - if `totalDays` passes `expiresOnDay` before it's
acquired, it's silently removed from the pool on the next settlement pass.
No need to simulate *who* took it or *why* - same reasoning
`settleRivalMarket` already uses for "a rival just released a film you
never watched get made."

**Visibility:** all currently-active opportunities are visible to the
player, full stop, for v1. A "your relationships determine what you even
hear about" scouting layer is a real, interesting future lever (and would
give a hired Producer - already a named `DESIGN.md` Known Limitation -
somewhere to plug in) but it's realism *with* a mechanical payoff you
haven't asked for yet; naming it here as a seam, not building it.

---

## 2. Asset Library

Once acquired, an `Opportunity` becomes an `Asset`, owned (contained, not
referenced - same ownership rule `cash` already follows) by the acquiring
`Studio`. An Asset is inert until a `Project` is started against it.

**Should scripts be permanent assets?** Yes - this is the whole point.
Acquisition cost is paid once, at acquisition, and the underlying
script/IP just sits in the library indefinitely.

**Can they be sold?** Yes, and I'd build this deliberately: sell an unused
Asset back to the market for a partial cash return. This is the pressure
valve that keeps the library from becoming an ever-growing pile of dead
weight with no decision attached to it - without it, "acquire everything
that looks interesting" has no real cost beyond the initial spend, which
undercuts the "portfolio of investments" fantasy you're after (a portfolio
where nothing is ever divested isn't really a portfolio).

**Can they be optioned (licensed out temporarily rather than sold
outright)?** Real-world yes, mechanically I'd defer it - it's a genuine
richer version of "sell," not a different lever, and doesn't earn its
complexity until selling-outright is already live and feels like it needs
a softer alternative.

**Can they generate multiple projects?** Yes - this is *why* Asset is a
separate entity from Project at all (§0). A stalled or abandoned `Project`
returns its `Asset` to the library, undamaged, ready to be tried again
later (possibly with a `heat` penalty - see below). A hit spawns a sequel
*Opportunity* that becomes a *new* Asset carrying a `franchiseId` back to
the original - I would **not** have a sequel reuse the original Asset
object directly, since it needs its own fresh script/quality roll,
distinct from the original.

**Can rights expire?** Yes, but **only for licensed assets, not owned
ones** - this is a deliberate, source-dependent split that makes the
source taxonomy in §1 earn its keep beyond flavor:

- Spec scripts, internal originals, director/actor passion projects: no
  expiry once acquired. You bought it outright; it's yours forever.
- Publisher (book/comic) adaptation rights: carry a real `rightsExpireOnDay`
  - a "use it or lose it" clock distinct from the *Opportunity's* own
    expiry (that one was about "acquire it before a rival does"; this one
    is about "having acquired it, don't sit on it forever"). If a Project
    hasn't at least reached `Greenlit` before rights expire, the Asset is
    removed from the library - the rights revert.

**Should an Asset decay if left undeveloped?** Yes - I'd add a `heat`
value (0-100, starts high at acquisition, decays slowly while no Project
is actively attempting it) rather than a hard expiry for owned assets.
This is softer pressure than a clock running out: a stale spec script
isn't *gone*, it's just less commercially exciting than it was, and I'd
have `heat` feed a small, visible discount into whatever the Development
stage's quality/buzz estimate shows (§4) - "this concept was hot two years
ago" is a real, legible cost of hoarding, without punishing legitimately
long-term IP ownership the way a hard expiry would.

---

## 3. Projects: challenging the ten-stage pipeline

**I don't think you need ten stages, and I don't think I need to invent a
new test for deciding that - `domain_model.md` §6 already wrote the test
I'd apply:**

> "A status should exist when something *outside* the currently-active
> screen needs to observe or gate on it - not for every UI screen
> boundary."

That document already used this test to collapse "Development +
Pre-production" into one `InDevelopment` stage and "Finished Run +
Library" into one `Finished` stage. I'd apply it again, twice, to your
proposal:

- **"Idea" isn't a `Project` stage at all** - it's an `Asset` with no
  `Project` attempt against it yet (§0, §2). Nothing about a `Project`'s
  own state machine needs to represent "hasn't started," because until
  something is actively being attempted, there's no `Project` - same move
  `domain_model.md` made for `ScheduledRelease`: don't invent a stage for
  "not yet a thing."
- **"Library" isn't a `Project` stage either** - it's a `released` Project
  whose box-office run has settled, a presentation choice for the Stats
  page exactly as `domain_model.md` §6 already argued for "Finished."
  Nothing changed here; not reopening it.

That drops you to **eight stages**. Here's where I *do* diverge from
`domain_model.md`'s existing table, and why - it collapsed
`InDevelopment`/`InProduction` into two stages total pre-release
(`InDevelopment` covering script-pick through cast-and-plan,
`InProduction` starting at `BEGIN_PHOTOGRAPHY`). That was the right call
*for the question that document was answering* (does a film's identity
fragment across storage locations), but it deliberately didn't need to ask
"is there a business decision happening here that something needs to gate
on," because at the time, there wasn't one - the whole point of *this*
document is that there now is.

| # | Stage | What's true here | New, or an existing stage renamed/retimed? |
|---|---|---|---|
| 1 | **Development** | Asset pulled from the library, gets its `Project` id here. Director/cast can be *Attached* (soft, free - §6). A production plan can be estimated. Optional rewrite/polish spend (§4). No cash committed beyond whatever's spent on rewrites. Freely abandonable - Asset returns to the library. | Existing (`develop`/`talent`/`production-planning` wizard steps), retimed: script choice moves upstream into Opportunity acquisition (§1), so this stage shrinks to attachment + planning + optional polish. |
| 2 | **Greenlit** | The studio commits. Every Attached mandatory role converts to Contracted (§6), charging full salary. Non-contingency production budget + full contingency reserve charged. **The one genuinely new stage.** | **New.** This is the split out of today's `BEGIN_PHOTOGRAPHY`, which currently does "commit money" and "cameras roll" in the same instant. |
| 3 | **Pre-production** | Crew assembly, sets built, schedule locked - a short fixed calendar cost, no new mechanics. | Existing (`production-planning`'s calendar cost), retimed to fire *after* Greenlight instead of before. |
| 4 | **Production** | Unchanged. The live day-by-day shoot, on-set events, everything already built. | Existing, untouched. |
| 5 | **Post-Production** | Unchanged. | Existing, untouched. |
| 6 | **Completed** | Post-production choices locked, no release commitment yet. | Already functionally live today - this is exactly the "parked" state Phase 7.1 already produces (a backgrounded project with `postProductionChoices` set and no `marketingChoices`/schedule yet), just not a formally named `Project` kind. This document proposes formalizing it as one. |
| 7 | **Scheduled** | Unchanged - the real `'scheduled'` `Project` kind, shipped in Phase 7.2. | Existing, untouched. |
| 8 | **Released** | Unchanged - box office running, then settled. "Library" is what you call it once settled. | Existing, untouched. |

**Net new surface: one stage (`Greenlit`), one formalized-but-already-real
stage (`Completed`).** Six of your ten proposed stages already exist in
some form; two (`Idea`, `Library`) fold into `Asset`/presentation exactly
the way `domain_model.md` already argued similar cases should; one
(`Pre-production`) is a rename/retime of existing calendar-cost logic; and
`Greenlit` is the actual new thing this whole document is about.

**Recommended `Project.kind` mapping** (extending the existing
discriminated union, same pattern as every kind added so far):

```
'player-in-progress'  → Development (renamed in spirit, not in code -
                         reuses the exact existing kind and storage, since
                         nothing outside the active screen needs to
                         observe "still attaching cast" as distinct from
                         "still picking a genre." Development is freely
                         abandonable exactly the way RETURN_TO_DASHBOARD
                         already treats a pre-BEGIN_PHOTOGRAPHY draft.)

'greenlit'             → NEW. Covers Pre-production through Completed as
                          one bucket - mirrors exactly how
                          'player-in-progress' already bundles several
                          wizard screens into one kind today. What makes
                          this deserve its own kind (unlike Development)
                          is that something outside the active screen
                          DOES need to observe it: cash is committed,
                          talent is Contracted, and abandoning it should
                          cost real money (§5) - all facts the Asset
                          Library, a Producer system, and eventually a
                          Studio solvency check need to see.

'scheduled'             → unchanged (Phase 7.2)
'released'              → unchanged
```

This keeps the "how many real stored states do I actually need" answer
disciplined: **four `Project` kinds**, not eight or ten, with `Development`
costing nothing new to build at all.

---

## 4. Development: what actually happens, and what I'd cut

Running your list through "does this create an interesting decision, or is
it realism with no mechanical payoff":

| Idea | Verdict | Why |
|---|---|---|
| **Rewrites / polish** | **Keep - this is the real one.** | Spend cash + Development-stage time to improve the Asset's underlying script stats (or nudge its tone) before Greenlighting. The genuinely new piece of gameplay depth in this whole document: it trades time (Asset `heat` decays a little more, a rival might be circling the same space, an Attached actor's patience isn't infinite) against a better outcome - the same "spend more, get more, but not for free" shape Production's contingency dial already teaches the player. |
| **Budget estimation** | **Keep, but it's not new** | This is today's `SET_PRODUCTION_PLAN`/Plan Production screen, just retimed to sit inside Development instead of after Hire Talent. No new mechanic. |
| **Director attachment / Casting discussions** | **Keep - this is the whole point of the stage** | Both are just "Attach talent" (§6), generalized across every role. This *is* Development's core activity, not a side item. |
| **Producer assignment** | **Name the seam, don't build it** | `DESIGN.md`'s own Known Limitations already flags a hireable Producer / studio-lot system as deliberately deferred. I'd leave that call exactly as it stands - Development-stage decisions (rewrite quality, attachment odds) are a natural place for an assigned Producer to eventually apply a bonus, once that system exists, without needing to guess its shape now. Same "reference, don't guess the shape" discipline `domain_model.md` already uses for Franchise/Loan/Investor. |
| **Script coverage** | **Cut as a system** | Everything a coverage report would tell the player (genre fit, tags, quality stats) is already visible on the Asset the moment it's acquired. A separate "commission coverage" button doesn't reveal anything new - it'd be a paywall on information the player already has. If it survives at all, it's flavor text on the Asset detail card, not a mechanic. |
| **Market research** | **Cut as a standalone system; fold the *payoff* into Rewrites** | "Spend money to learn things" only earns its keep if it changes a decision. I'd fold its one legitimate payoff - narrowing the uncertainty on a quality/reception preview - into the Rewrite action's own feedback (a rewrite pass naturally reveals more accurate numbers, since you're paying craftspeople to look closely at the material anyway) rather than adding a second, parallel "pay to know more" button next to it. |
| **Concept art** | **Cut** | No mechanical hook proposed, and I can't find one that isn't purely cosmetic. Fine as a future presentation flourish (a generated mood-board image on the Project detail card) once there's budget for that kind of polish - not a gameplay system. |

**What Development boils down to, concretely:** attach a director and
cast (free, reversible), lock in a production plan estimate (free,
reversible), optionally pay for one or more rewrite passes (real cost,
real improvement, the one new decision), then decide whether to Greenlight
or walk away. That's a tight, legible stage - not a second wizard bolted
onto the first.

---

## 5. Greenlighting

**Requirements before a Project can be Greenlit:**

- Every mandatory role (`Director`, `Lead Actor`, `Supporting Actor`,
  `Writer`, `Cinematographer`, `Composer`, `Editor` - unchanged from
  today's `MANDATORY_TALENT_ROLES`) must be at least **Attached**.
- A production plan must exist (`SET_PRODUCTION_PLAN` dispatched at least
  once - already an implicit dependency today, made explicit here).
- **The studio must actually be able to afford the full upfront
  commitment right now.** This is a real, deliberate tightening over
  today's behavior worth calling out on its own: today, `BEGIN_PHOTOGRAPHY`
  has no reducer-level solvency check at all - `HireTalent.tsx`'s
  `canAfford`/`canContinue` only gates the *button*, so a determined enough
  sequence of dispatches could already drive `studio.cash` negative. Moving
  the real commitment to an explicit `Greenlight` action is a natural, cheap
  place to finally close that gap for real, matching this codebase's own
  established preference for fixing root causes over papering over them
  (`DESIGN.md`'s own changelog is full of exactly this kind of "found and
  fixed while touching something else" entry).

**What belongs before Greenlight:** asset choice, attachment, budget
estimate, optional rewrites - everything in §4.

**What belongs after Greenlight:** everything Production/Post/Marketing
already do today, plus the actual binding **cash-backed** talent
commitment (Attached → Contracted, §6).

**The asymmetry that makes Greenlight feel real:** abandoning a
`Development`-stage Project should be cheap - exactly `RETURN_TO_DASHBOARD`'s
existing "nothing committed, discard outright" branch, already built.
Abandoning a `Greenlit`-or-later Project should **cost real money** - at
minimum, forfeit whatever's already been spent; ideally a further
cancellation penalty on top (severance to Contracted talent), so
Greenlighting is the moment a Project stops being a free-to-reconsider
idea and starts being a real financial commitment with a real cost to
reverse. Without that asymmetry, `Greenlit` is just a label, not a
decision.

---

## 6. Talent Attachment

Your eight-state proposal, run through the same test §3 used:

> Does anything *outside the current screen* need to observe or branch on
> `Interested` as distinct from `Negotiating`, or `Booked` as distinct
> from `Working`?

I don't think so. I'd resolve "attach this person" as **one action with a
success chance** (driven by fame/ego/price-fit, the same shape
`computeTalentCompatibility` already uses elsewhere in this codebase),
resolved instantly - the UI can absolutely still *say* "negotiating..." for
a beat, but that's presentation, not four extra enum values nothing ever
branches on.

**Recommended real states - four, not eight:**

```
Available  →  Attached  →  Contracted  →  Booked  →  (back to) Available
```

- **Available**: today's existing default (no `bookedUntil`, or it's
  passed).
- **Attached**: a soft, non-exclusive commitment to a Development-stage
  Project. **Deliberately does not check availability at all** - only a
  compatibility/interest roll (does this person want to work on this
  material). This is the load-bearing design decision that makes your own
  north-star example fall out for free: *"I know Nolan is busy until 2034.
  I can still attach him to a project beginning afterwards"* - Attach
  never needs to ask "when are you free," because it isn't booking
  anything yet. Non-exclusive means two different studios' Development-stage
  Projects can attach the same in-demand director simultaneously - a real,
  interesting bidding-war dynamic that costs nothing extra to support once
  Attached isn't a lock.
- **Contracted**: happens at Greenlight (§5). This is where availability
  finally matters - a Contract carries an explicit start day, which can be
  arbitrarily far in the future if the talent's current `bookedUntil`
  hasn't passed yet. This is the second half of the Nolan example: you
  *can* Greenlight a project with a start date past his current
  commitment, and the Contract just reflects that real future window
  instead of the game pretending it can't be expressed.
- **Booked**: the contracted window has actually started. I've merged your
  `Booked`/`Working` into one - I don't see a decision the game needs to
  hang on "about to start" vs. "currently on set" beyond flavor text.
- Loop back to **Available** once the Contract's end (tied to the Project's
  actual wrap, not today's rough `recommendedDays` estimate) passes -
  matching `RETURN_TO_DASHBOARD`'s existing `bookedUntil` mechanics
  closely, just made precise instead of estimated.

This is a strict generalization of today's binary Available/Booked model -
exactly one new real distinction inserted (soft interest vs. hard,
cash-backed commitment), which is the *only* piece actually required to
support pre-attaching someone to a future slot. Everything else in your
eight-state version was doing presentation work, not gameplay work.

---

## 7. AI Studios

**Recommendation: don't rebuild `rivalStudios.ts` on top of this in the
same pass that ships it for the player.** See §12 for why as a sequencing
call - this section describes the target shape either way.

**How AI should use the system, once unified:** rivals draw from the same
shared `Opportunity` pool as the player (real scarcity - a rival can take
something the player was circling) and maintain their own Development
funnel, using the exact per-tier spawn-check timer already in
`engine/rivalStudios.ts` for *opportunity pursuit* instead of directly
conjuring a fully-cast `RivalProductionInProgress` out of nothing the way
`startRivalProduction` does today.

**How many projects per stage, by tier** - I'd widen the funnel at
Development relative to today's existing Production-stage caps, rather
than inventing new numbers wholesale:

| Tier | Development (new) | Greenlit+Production (existing `startableScales` caps, unchanged) | Completed awaiting schedule |
|---|---|---|---|
| Indie | 1-2 | 1 Small at a time | 0-1 |
| Mid-Size | 2-3 | up to 3 Medium, *or* 1 Big (not both) | 0-1 |
| Major | 4-6 | up to 4 Medium *and* 2 Big simultaneously | 1-2 |

This produces the "portfolio funnel" feel you want - AI studios visibly
developing more than they'll ever greenlight - for the cost of one new cap
per tier, layered *above* the existing, already-tuned production caps
rather than replacing them.

**How studio strategy should influence this:** this is exactly the
`SlateStrategy` seam `domain_model.md` §5 already named and deliberately
declined to build ("most likely alongside AI strategy work or a
hireable-producer mechanic... that's the moment a small `SlateStrategy`
object earns its keep"). I'd stand by that deferral here too - a
"prestige" archetype (narrow Development funnel, high Greenlight bar,
fewer but better releases) vs. a "high-volume" archetype (wide funnel,
liberal Greenlighting) is a real, good idea, and a natural v2 once the
pipeline itself is proven, not a reason to hold up shipping it.

---

## 8. Cash Flow

Mapped onto the new lifecycle - I'm flagging the one genuine *timing*
change explicitly, since it's a real departure from today's behavior, not
just a relabeling:

| Moment | What's charged | vs. today |
|---|---|---|
| Opportunity → Asset acquisition | The Asset's acquisition cost | **Changed.** Today `Script.cost` is folded into `results.productionCost` and only charged at release. Under this model it has to move to acquisition - an Asset can sit unused, spawn several Projects, or never become a film at all, so its cost can no longer be deferred to a release that might never happen. This is a necessary consequence of Assets being real, standalone-owned things, not an arbitrary change - and it's also exactly the "sunk cost" pressure that makes hoarding assets feel like a real decision instead of a free option. |
| Rewrite/polish (Development, optional) | Per-attempt cost | New, small. |
| Talent Attachment (Development) | Nothing | Unchanged - `SET_TALENT_FOR_ROLE` already charges nothing today. |
| **Greenlight** | Full talent salary (Attached → Contracted) + non-contingency production budget + full contingency reserve | Same *math* as today's `BEGIN_PHOTOGRAPHY`, moved to fire at the explicit Greenlight decision instead of at "cameras start rolling this instant." |
| Pre-production | Nothing new | Calendar-cost only, like every other `STAGE_DURATIONS` entry. |
| Production | Unchanged | On-set event cost deltas, daily contingency burn - untouched. |
| Post-Production | Unchanged | Test-screening fee, still charged at release/schedule time - not part of what this document is redesigning. |
| Marketing | Unchanged | Charged at `SCHEDULE_RELEASE`/resolution, exactly as Phase 7 already built. |
| Release | Unchanged | Weekly box-office revenue, exactly as today. |

---

## 9. UI

The wizard itself doesn't get thrown out - `focusedProjectId` already
generalizes to "whichever Project you're currently drilling into," which
is exactly what's needed here. What changes is the **front door** and the
**Dashboard's own structure**, not the screen-by-screen flow of actually
working one Project.

**New front door:** "Start New Film" (always a blank draft) is replaced by
**Opportunities → Asset Library → "Start Developing"**. `DevelopFilm.tsx`'s
job shrinks - no more in-wizard script-slate browsing, since that moved
upstream to Opportunity acquisition - while `HireTalent.tsx`/
`ProductionPlanning.tsx` keep almost their existing shape, just
recontextualized as Development's Attach/Plan actions instead of binding
commitments.

**New Dashboard sections**, replacing today's single "backgrounded
productions" card list with stage-grouped ones (same card-list pattern
already used for backgrounded shoots, just split by stage instead of
lumped together):

- **Opportunities** (new screen) - the shared, time-limited pool.
- **Asset Library** (new screen) - owned, undeveloped assets; `heat`;
  sell/abandon.
- **Development Slate** - every Development-stage Project, one card each,
  "open" drills into the (now-shorter) wizard.
- **In Production** - Pre-production/Production/Post-production, mostly
  today's existing Dashboard section, unchanged.
- **Completed, awaiting release** - the already-real "parked" state from
  Phase 7.1, now with a proper name and its own section instead of being
  folded into the Inbox's generic "finished" bucket.
- **Release Calendar** - unchanged (Phase 7.3).
- **Studio History / Library** - unchanged.

None of this requires new state-shape plumbing beyond what §3 already
specifies (one new `Project` kind, two new world/studio-level entity
lists) - it's the same "new `Project` kind + new Dashboard-reachable
screen" pattern Phase 7.1-7.3 already executed for `Scheduled`/the Release
Calendar, applied one more time.

---

## 10. What this deliberately does *not* touch

- The scoring/quality/box-office engines - completely untouched. A Script
  generated via an Opportunity is the exact same `Script` shape scored the
  exact same way.
- Production's own live day-by-day simulation - untouched.
- The already-shipped `Scheduled`/`Released`/Release Calendar machinery -
  untouched, just gains a new predecessor.
- Marketing channels, awards, franchises-as-a-full-system,
  financing/loans, a hireable Producer, streaming - all remain exactly
  where `DESIGN.md`'s Known Limitations and `domain_model.md`'s Q7 already
  left them: named, real, safely deferred, referencing `Project`/`Studio`
  by id whenever they do get built rather than requiring either to change
  shape today.

---

## 11. Challenges, consolidated

For visibility, everything in this document that pushes back on either
your brief or an existing doc, in one place:

1. **Ten `Project` stages → eight, and really only one wholly new one
   (`Greenlit`)** - §3. `Idea` folds into Asset; `Library` folds into
   presentation of `Released`, both already-established moves.
2. **Eight Talent states → four real ones** - §6. `Interested`/`Negotiating`
   are flavor text, not stored state; `Booked`/`Working` don't need to be
   distinguished.
3. **Script Coverage and Concept Art cut entirely; Market Research folded
   into Rewrites rather than built standalone** - §4. Real-sounding
   mechanics with no proposed payoff beyond information the player already
   has, or better served as a side-effect of an action that already
   exists.
4. **`Film` stays a word, not a fifth entity** - §0. Consistent with
   `domain_model.md`'s own already-settled call on the release end of the
   pipeline.
5. **A real solvency check at Greenlight** - §5. Not something you asked
   for, but a genuine, cheap gap in today's `BEGIN_PHOTOGRAPHY` worth
   closing while this exact commitment point is already being touched.
6. **AI studios should *not* move onto the full pipeline in the same pass
   that ships it for the player** - §7/§12. A sequencing disagreement with
   "how should AI use this system," not with the target shape itself.
7. **Script acquisition cost moves from "paid at release" to "paid at
   Asset acquisition"** - §8. A real, necessary timing change flagged
   explicitly rather than left implicit.

---

## 12. Phasing

Matching the incremental, test-each-step discipline the roadmap that got
`Project`/`Scheduled`/the Release Calendar built already established -
this is a bigger arc than any single phase of that roadmap, and shouldn't
land as one commit either.

| Phase | Ships | Player-visible behavior change | AI behavior |
|---|---|---|---|
| **A - Opportunities & Assets** | `Opportunity`/`Asset` entities, generation timer, Asset Library screen, sell/abandon | Player can browse/acquire Opportunities into a real library. Existing wizard flow (`Start New Film`) still works unchanged, now just also has this new front door as an alternative. | Unchanged - rivals keep `startRivalProduction`'s existing shortcut. |
| **B - Development & Greenlight** | New `'greenlit'` Project kind, Attach/Contract talent split, the real Greenlight action + solvency check, cancellation cost asymmetry | `Start New Film` retired in favor of Asset → Development → Greenlight. This is the phase that actually changes the core loop. | Still unchanged - rivals remain opaque here exactly as they are today; nothing about how a rival is *presented* to the player changes. |
| **C - Rewrites/polish, Asset `heat` decay, rights expiry** | The one genuinely new Development-stage decision, plus the pressure valves that keep the Asset Library from becoming a junk drawer | Adds real depth to Development without touching anything upstream/downstream of it. | Unchanged. |
| **D - Unify AI onto the real pipeline** | Rivals draw from the shared Opportunity pool, maintain a real Development funnel (§7's table), genuinely contend with the player for the same assets | True scarcity - a rival can now take something the player was circling. | The big AI change, done last and in isolation, once the player-side plumbing is proven and the existing, already-tuned rival economy isn't being rewritten and re-verified at the same time as everything else. |
| **E - Sequels/franchises** | `franchiseId` on Project, sequel Opportunities sourced from a studio's own released back-catalog | The first payoff of `Project`'s stable id specifically enabling this (`domain_model.md` Q7 already predicted this exact hook). | Rivals can sequel their own hits too, once D has them fully on the pipeline. |

Each phase is independently playable and independently revertable, the
same "every phase compiles, keeps the game playable, states its own
behavior-change status" discipline `DESIGN_REVIEW_implementation_roadmap.md`
used throughout - I'd expect Phase B specifically to get the same
one-continuous-effort-but-heavily-tested treatment that roadmap's own
Phase 5 (the storage-model flip) got, since it's the one phase that
changes the core loop rather than adding alongside it.
