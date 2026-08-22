# Positioning — what this game is, and who it is for

**Status: LIVING DOCUMENT.** Companion to `SIMULATION_PHILOSOPHY.md` (how the
simulation should work) and `ART_DIRECTION.md` (what it should look like). This
one answers the prior question both of those depend on: *what is this game, and
why would anyone choose it over the alternatives?*

Recorded here so it does not have to be re-argued, and so feature decisions can
be checked against it.

---

## 1. The pitch [DECIDED]

> **The film industry as a living market — where your picture has to earn its
> audience week by week, against studios that want the same script and the same
> weekend.**

And the one-line differentiator against the nearest competitor:

> **Hollywood Animal simulates a film. This game simulates a market.**

---

## 2. The claim, and the evidence for it

This is not aspiration. It is what the engine already does, verified against the
code rather than assumed.

### 2.1 Box office is emergent, not scored

`engine/boxOffice.ts` — the old opening-weekend/legs formula — **no longer
exists**. `engine/releaseFilm.ts` and `engine/boxOfficeRun.ts` both drive
`advanceOneWeek` from `engine/audienceSimulationStep.ts`, which runs a
population model of moviegoers week by week:

- `awareCount` / `interestedRemaining` / `cumulativeTicketsSold` as evolving state
- Awareness arrives three ways — a release-day marketing seed, a weekly external
  trickle, and word of mouth
- Awareness converts to *interest* only for the fraction with genuine natural fit
- Word of mouth is amplified by reception on a convex, audience-weighted curve, so
  ordinary reception sits in the shallow part (front-loaded, weak legs) and only
  real quality holds
- Crossover expansion reaches beyond the natural audience when a film breaks out
- Screen availability gates demand; pull-forward urgency models the rush

A film's gross is therefore an **outcome of a simulated population**, not a number
a formula returned.

### 2.2 The industry around the film is alive

`engine/rivalStudios.ts` gives AI competitors their own cash, their own slates,
and their own intentions. They **bid against the player in script auctions**,
target the seasonal windows that actually pay for their genre, become publicly
announced when their campaigns start, and settle into a shared market where
`engine/releaseCrowding.ts` and `engine/marketSettlement.ts` make a crowded
weekend genuinely cost everyone in it.

### 2.3 The creative decisions are modelled, not rolled

`compatibility.ts`, `pairHistory.ts`, `creativeTension.ts`, `directorAppeal.ts`,
`directorPitch.ts`, `castingAppeal.ts`, `castingNegotiation.ts`, `personality.ts`,
`facetModel.ts` — hiring is a set of fits and frictions between specific people,
not a stat comparison.

---

## 3. Competitive position [DECIDED]

| | What it is | Where it wins | Where it leaves room |
|---|---|---|---|
| **The Movies** | A studio-lot toy box with film-making | Sandbox play, machinima | The lot is tedious; abstract actions get silly buildings ("hire at the Acting Academy") |
| **Hollywood Animal** | A narrative game about running a studio, 1929 | Art direction, character stories, atmosphere | The world outside your studio is mostly set dressing; outcomes are delivered as 0–10 verdicts |
| **This game** | A simulation of the film *market*, 1983–97 | Emergent box office, live competitors, modelled creative fit | No art team; depth is invisible in a screenshot |
| **Football Manager** | The genre's proof that this lane works | A living league and a model deep enough to argue with | — |

Two useful notes on Hollywood Animal specifically:

- It is set in **1929**; this game is set in **1983–97**. The head-to-head visual
  comparison is less direct than it first appears, and the eras were chosen to
  stay apart (`ART_DIRECTION.md` §1).
- Its headline 0–10 commercial/artistic scores are exactly what `CLAUDE.md`
  forbids here — *"player-facing presentation is qualitative, never raw internal
  stat values."* The opposite position was taken deliberately, and should stay
  taken.

---

## 4. What follows from this [DECIDED]

**The art bar is Football Manager's, not Hollywood Animal's.** We cannot out-art a
studio with an art team and a publisher, and competing there is a losing fight.
The bar to clear is *"looks deliberate and reads well at density"* — not
*"beautiful."* Nothing in `ART_DIRECTION.md` should be scoped as if the target
were an illustrated period piece.

**Depth is the moat.** 107 pure engine modules and 2,200-plus tests are not
something a competitor adds in a patch. Every hour spent deepening the market
simulation widens a gap; every hour spent chasing their art direction narrows a
gap we cannot close anyway.

**The audience is the sim crowd, not the tycoon crowd.** Narrower, more loyal,
markedly less art-sensitive, and far more willing to read a dense screen. Design
for the player who wants to argue with the model.

---

## 5. The known risk, and the mitigation [DECIDED]

**Depth does not screenshot.** A crossover-expansion curve is invisible on a store
page; an illustrated 1929 lobby sells itself in one frame. This is the single
biggest commercial risk in the project, and it is the same risk that makes capsule
art worth paying for.

**The mitigation is writing, not art.** Hollywood Animal's most shareable moments
are *sentences*: "the lead actor became seriously ill… the actor passed away after
finishing work on the film." That is causal prose explaining a simulation outcome —
cheap to produce, and the thing players screenshot and post.

The machinery already exists: `premiereReport.ts`, `reviews.ts`,
`pressTourMoments.ts`, and 3,000-plus lines of `data/productionEvents.ts`. And
`SIMULATION_PHILOSOPHY.md` Principle 4 already requires it — *"every success and
failure should have a causal explanation."*

The advantage is that **their prose explains a score; ours can explain a
simulation**:

> *"Opened narrow, but word of mouth held: by week four it was reaching people the
> campaign never touched."*

That sentence is only sayable because the model underneath is real. Prose is where
the moat becomes visible — treat it as a first-class deliverable, not flavour text.

---

## 6. Non-goals [DECIDED]

Restated here because they are positioning decisions, not just design ones.

- **No studio lot, no building placement, no map.** Rejected on gameplay grounds
  (tedium, and it forces fake realism onto abstract actions) and on positioning
  grounds — it is the competitors' territory and playing there invites exactly the
  art comparison we lose.
- **No film-making minigame.** The player packages and releases films; they never
  direct a shot.
- **No numeric verdict scores** as the player-facing outcome. Qualitative
  presentation, always.
- **No competing on art direction.** Clear the bar; do not chase the leader.

---

## 7. Decision log

| Date | Decision |
|---|---|
| 2026-08-22 | Positioning set: the market, not the film. |
| 2026-08-22 | Art bar set at Football Manager, not Hollywood Animal. |
| 2026-08-22 | Causal prose adopted as the mitigation for "depth does not screenshot", and as a first-class deliverable. |
| 2026-08-22 | Studio lot and numeric verdict scores confirmed as positioning non-goals. |
