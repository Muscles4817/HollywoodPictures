# 15 — Mapping the Domain to Hollywood Pictures

*The bridge document.* Everything else in `docs/domain/` deliberately ignores
the game. This one is the only place the two meet: for each area of the real
industry, what the simulation **models**, what it **abstracts**, and what it
**omits** — plus which design doc is authoritative on the current
implementation.

> **This is a coarse map and a snapshot, not a specification.** The
> `DESIGN_*` and `AUDIT_*` docs in `docs/` are authoritative on what the code
> actually does today; the code is authoritative over them. When they conflict
> with this table, they win. Re-check before relying on a row.

**How to use it.** When a design conversation reaches "how does this work in
real life?", read the domain doc. When it reaches "what do we do about it?",
come back here to see whether the game already has a place to put the answer.

---

## 1. Legend

| Mark | Meaning |
|---|---|
| **Modelled** | The simulation represents this with its own mechanics |
| **Abstracted** | Represented, but collapsed into something simpler |
| **Omitted** | Not present |
| **Deliberate** | Omitted or abstracted by design, not by oversight |

---

## 2. Area by area

### Industry structure (`01`)

| Real thing | Status | Note |
|---|---|---|
| Rival studios competing for material and dates | **Modelled** | `engine/rivalStudios.ts`, `engine/releaseCrowding.ts`, `engine/marketSettlement.ts` |
| Distribution partners taking a fee of rentals | **Modelled** | `engine/distribution.ts` — major / mid-major / boutique, each with a screens share, P&A commitment, and fee |
| Exhibitors as a counterparty | **Abstracted** | Screens arrive via the distribution deal, not negotiated per release |
| Streamers as an alternative buyer | **Abstracted** | Ancillary revenue exists (`engine/ancillary.ts`); a streamer-commissioned, cost-plus film does not |
| Guilds and unions | **Omitted** | No scale minimums, turnaround, or meal penalties |
| Agencies, managers, packaging | **Abstracted** | "Agent Package" exists as an opportunity *source* (`engine/opportunities.ts`), not as an actor with interests |
| Ratings / certification | **Omitted** | No rating decision, no rating-driven audience ceiling |

### Development (`02`)

| Real thing | Status | Note |
|---|---|---|
| Acquiring material from a market | **Modelled** | `engine/opportunities.ts` — spec, agent package, publisher rights |
| Commissioning originals, rewrites, polishes | **Modelled** | `engine/commission.ts`, `engine/rewrite.ts`; see `DESIGN_REVIEW_development_pipeline.md` |
| Script quality as multi-axis | **Modelled** | Originality, structure, dialogue, characters, complexity (`engine/scriptGenerator.ts`, `data/scriptArchetypes.ts`) |
| Options vs purchase, chain of title, clearances | **Omitted** | Acquisition is a single payment |
| Step deals, writer-by-writer rewriting chains | **Abstracted** | Rewrite/polish exist as actions, not as a sequence of engaged writers |
| WGA credit arbitration, separated rights | **Omitted** | |
| Turnaround, development hell, regime change | **Omitted** | |
| Greenlight as a committee decision | **Abstracted** | The player greenlights; there is no internal case to make |

### Financing (`03`)

| Real thing | Status | Note |
|---|---|---|
| Studio cash constraint | **Modelled** | `engine/cashLedger.ts`, `engine/affordability.ts` |
| Backend / participations | **Modelled** | `engine/backend.ts` |
| Talent negotiation and cost | **Modelled** | `engine/castingNegotiation.ts`, `engine/castBudget.ts` |
| Continuous budget dials rather than tiers | **Modelled** | Deliberate — see `COST_REPORT_film_production.md` |
| Tax incentives / soft money | **Omitted** | Would change *where* films shoot; no geography exists |
| Pre-sales, gap financing, co-financiers, slate deals | **Omitted** | The studio funds everything from cash |
| Completion bonds | **Omitted** | |
| Insurance | **Abstracted** | Appears in production execution and cost data, not as a policy with cover and exclusions |
| Pay-or-play, holds, start dates | **Omitted** | Talent availability is not a calendar |
| Contingency and cost reporting | **Abstracted** | Overruns exist; a weekly cost report does not |

### Pre-production (`04`)

| Real thing | Status | Note |
|---|---|---|
| Prep as a real stretch of calendar, with a recommended length | **Modelled** | `computeRecommendedPreProductionDays`; see `DESIGN_production_timeline_audit.md` |
| Prep length affecting delivered quality | **Modelled** | Via the facet system (`engine/facetModel.ts`, `setsFacet.ts`, `vfxFacet.ts`, `practicalFacet.ts`) |
| Casting process (breakdowns, reads, offers) | **Modelled** | `engine/casting*.ts` — the largest subsystem; see `DESIGN_REVIEW_casting_redesign.md` |
| Crew hiring by head of department | **Abstracted** | Nine professions hired directly; no departments beneath them |
| Script breakdown into elements | **Abstracted** | Requirements exist as a profile (`engine/requirementProfile.ts`, `creativeDemands.ts`), not an element list |
| Scheduling: stripboard, DOOD, shooting order | **Omitted** | Shoot length is computed, not scheduled |
| Locations, permits, company moves | **Omitted** | |
| Set construction as a serial constraint | **Abstracted** | Sets ambition and prep time feed the sets facet; there is no build schedule |
| Costume manufacture, prosthetic lead times | **Omitted** | |

### Departments and crew (`05`)

| Real thing | Status | Note |
|---|---|---|
| Creative heads as hireable people with skills | **Modelled** | Director, Writer, Cinematographer, Composer, Editor, VFX Supervisor, Casting Director, Production Designer, plus Actors |
| Compatibility and collaboration between heads | **Modelled** | `engine/compatibility.ts`, `collaborationEdges.ts`, `crewPhilosophy.ts`, `crewFitRead.ts` |
| Departments beneath each head | **Omitted** | **Deliberate for now** — see `DESIGN_production_crafts_and_crew.md` and `AUDIT_crew_responsibilities.md`, which is the live workstream on this exact gap |
| Sound department (production sound and post sound) | **Omitted** | No production sound mixer, supervising sound editor, or mix |
| 1st AD, UPM, line producer, script supervisor | **Omitted** | Producers exist separately (`engine/producers.ts`) |
| Stunt discipline | **Modelled** | `engine/stuntTeams.ts` + the practical facet |
| Second unit | **Omitted** | |
| Crew day rates, fringes, crew size | **Abstracted** | Crew appears as a shooting-budget line, not as headcount |

### Principal photography (`06`)

| Real thing | Status | Note |
|---|---|---|
| The shoot as day-by-day elapsed time | **Modelled** | `ADVANCE_SHOOTING_DAY`; player may wrap early, auto-wrap at a ceiling |
| On-set events with consequences | **Modelled** | `data/productionEvents.ts`, `engine/productionExecution.ts` |
| Events feeding delivered quality rather than a bonus | **Modelled** | The facet-signal design — the core of `SIMULATION_PHILOSOPHY.md` |
| Rush penalties for wrapping short | **Modelled** | See `DESIGN_REVIEW_rush_penalty_and_screen_collapse.md` |
| Call sheets, setups, pages per day | **Omitted** | Days are the unit; pages and setups do not exist |
| Coverage philosophy and its post consequences | **Omitted** | A significant lever the sim does not have |
| Weather, cover sets, losing the light | **Omitted** | Some events gesture at this; conditions are not simulated |
| Overtime, turnaround, meal penalties | **Omitted** | The main real-world cost-of-time mechanism is absent |
| Reshoots and additional photography | **Abstracted** | Referenced in scoring/production; not a scheduled unit with cast availability |
| Dailies as an information channel | **Omitted** | The player learns via events, not by watching material |

### Post-production (`07`)

| Real thing | Status | Note |
|---|---|---|
| Post as elapsed calendar time | **Modelled** | `computeRecommendedPostProductionDays` |
| Post-production choices | **Modelled** | `PostProductionChoices`, `data/postProduction.ts`; see `DESIGN_REVIEW_post_production_redesign.md` |
| Editing as a quality determinant | **Modelled** | `engine/editFacet.ts` |
| Score as a quality determinant | **Modelled** | `engine/scoreFacet.ts` |
| Test screenings with a decision attached | **Modelled** | `engine/postProductionStatus.ts` — pending choice, then resolution |
| The assembly → director's cut → studio cut ladder | **Omitted** | No cut versions, no director's-cut right, no recut fight |
| Sound post (ADR, foley, design, the mix) | **Omitted** | Sound is not a department or a facet |
| Music licensing, sync/master clearance | **Omitted** | Composer exists; songs do not |
| DI, deliverables, formats, M&E | **Omitted** | **Deliberate** — invisible to the player |
| Picture lock as the gate everything downstream waits on | **Omitted** | The most structurally important post fact the sim doesn't have |

### VFX and specialty (`08`)

| Real thing | Status | Note |
|---|---|---|
| VFX ambition vs money vs skill vs time | **Modelled** | `engine/vfxFacet.ts` — one of the three departments already at the target shape |
| Sets/production design as the same shape | **Modelled** | `engine/setsFacet.ts` |
| Practical/stunt work as the same shape | **Modelled** | `engine/practicalFacet.ts`, `engine/stuntTeams.ts` |
| Cinematography as the same shape | **Modelled** | `engine/cinematographyFacet.ts` |
| VFX vendors, bidding, shot counts, turnover | **Omitted** | VFX is a single ambition scalar, not a shot pipeline |
| Previs / techvis / postvis | **Omitted** | |
| Prosthetics and creature work | **Omitted** | |
| Animation as an alternative production model | **Omitted** | |

### Marketing and distribution (`09`)

| Real thing | Status | Note |
|---|---|---|
| P&A as a second budget | **Modelled** | `engine/marketing.ts`; the distribution deal commits P&A (`engine/distribution.ts`) |
| Campaign shape and channels | **Modelled** | See `DESIGN_REVIEW_marketing_campaign.md`, `DESIGN_REVIEW_marketing_rollout.md` |
| Release dating against competition | **Modelled** | `engine/scheduledReleases.ts`, `releaseCrowding.ts`, `marketSettlement.ts` |
| Seasonality | **Modelled** | Release windows in `engine/calendar.ts`, `data/release.ts` |
| Press tour | **Modelled** | `engine/pressTour.ts`, `pressTourMoments.ts` |
| Buzz as an emergent, non-purchasable quantity | **Modelled** | A ratified design target — `DESIGN_box_office_calibration_targets.md` §6 |
| Quadrants and positioning | **Abstracted** | Audience segments exist (`data/audiences.ts`); the four-quadrant frame does not |
| Tracking, CinemaScore, PostTrak as instruments | **Abstracted** | `engine/marketResearch.ts` covers some of this ground |
| Trailers, key art, creative advertising | **Omitted** | Campaign spend has no creative content |
| Promotional partners | **Omitted** | |
| Windows and the post-theatrical ladder | **Abstracted** | Ancillary is a computed tail (`engine/ancillary.ts`), not a sequence of windows |
| Festivals | **Omitted** | |

### Box office (`10`)

| Real thing | Status | Note |
|---|---|---|
| A week-by-week run rather than a scored total | **Modelled** | `engine/boxOfficeRun.ts`, `audienceSimulation*.ts` — the game's central claim (`POSITIONING.md`) |
| Word of mouth driving legs | **Modelled** | Audience simulation |
| Screen allocation and collapse | **Modelled** | See `DESIGN_REVIEW_rush_penalty_and_screen_collapse.md` |
| Competition for the same weekend | **Modelled** | `engine/marketSettlement.ts` |
| Distributor/exhibitor split | **Modelled** | Rentals and fee (`engine/distribution.ts`) |
| Domestic vs international split | **Abstracted** | A market split exists; territories do not |
| Opening/multiple, second-weekend drop as diagnostics | **Abstracted** | Emerges from the run; not surfaced as named instruments |
| Previews, daily reporting, Sunday estimates | **Omitted** | |

### Money (`11`)

| Real thing | Status | Note |
|---|---|---|
| Full cost model with continuous levers | **Modelled** | `COST_REPORT_film_production.md` is the inventory |
| Distribution fee against rentals | **Modelled** | `engine/distribution.ts` |
| Backend participations | **Modelled** | `engine/backend.ts` |
| Ancillary revenue tail | **Modelled** | `engine/ancillary.ts` |
| Cash flow and ledger | **Modelled** | `engine/cashLedger.ts`; see `DESIGN_REVIEW_studio_financial_model.md` |
| Studio overhead charge and capitalised interest | **Omitted** | The "why hits show a loss" mechanism is absent |
| Residuals | **Omitted** | |
| Net-profit definitions and audits | **Omitted** | **Deliberate** — famously opaque, poor play material |
| Library value as a durable asset | **Omitted** | A real gap given the positioning |
| Slate-level portfolio thinking | **Abstracted** | The player experiences it; the game doesn't name it |

### Talent and careers (`12`)

| Real thing | Status | Note |
|---|---|---|
| Talent with skills, styles, and personalities | **Modelled** | `engine/person.ts`, `personTraits.ts`, `personality.ts`, `actingModel.ts` |
| Quotes and negotiation | **Modelled** | `engine/castingNegotiation.ts`, `castingEstimate.ts` |
| Reputation and standing | **Modelled** | `engine/reputation.ts`, `studioStanding.ts` |
| Relationships and pair history | **Modelled** | `engine/relationships.ts`, `pairHistory.ts` |
| Career arcs (heat, plateau, decline) | **Abstracted** | Careers exist as state; the arc is not an explicit lifecycle |
| Availability as a hard calendar constraint | **Omitted** | The most commonly-missed real constraint |
| Agents, managers, commissions | **Omitted** | |
| Bankability as genre- and territory-specific | **Abstracted** | Appeal exists (`engine/castingAppeal.ts`, `directorAppeal.ts`); it is not per-territory |
| Below-the-line careers | **Omitted** | Follows from having no departments |

### Awards (`13`)

| Real thing | Status | Note |
|---|---|---|
| An awards season with categories | **Modelled** | `engine/awards.ts`, `data/awards.ts`, `data/awardsShows.ts`; see `DESIGN_REVIEW_awards_season.md` |
| Rival studios competing for awards | **Modelled** | `DESIGN_REVIEW_ai_studio_awards_analysis.md` |
| Critical reception | **Modelled** | `engine/reviews.ts`, `data/reviewBlurbs.ts` |
| Branch voting and preferential ballots | **Omitted** | |
| Precursors and a season calendar | **Omitted** | Awards resolve at year end |
| Campaigning as a spend decision | **Omitted** | A natural, high-value addition given the rest of the design |
| Genre bias in voting | **Abstracted** | Present in weighting rather than as a stated model |

---

## 3. The largest honest gaps

Ranked by how much they'd change the game, not by effort:

1. **Departments beneath the creative heads** (`05`) — already the live
   Workstream II; the audit and requirements model exist.
2. **Time as a cost mechanism** (`06` §7) — overtime, turnaround, and meal
   penalties are how the real industry makes "one more hour" expensive. The sim
   has day counts but no cost-of-time gradient.
3. **Talent availability as a calendar** (`12` §4) — the constraint that makes
   packaging hard in reality.
4. **Picture lock and the post dependency chain** (`07` §1) — the reason post
   schedules fail.
5. **Sound as a department** (`05` §11, `07` §3) — a whole craft with no
   representation, and one with a clean facet shape available.
6. **Library value and the long revenue tail** (`11` §3) — currently a single
   ancillary term, when it is the actual business.
7. **Coverage philosophy** (`06` §4) — a director-level decision with real
   consequences in post that the sim has no place for.

Each of these is a real-industry mechanism first; whether it earns a place in
the game is a separate design question, and belongs in a `DESIGN_*` doc rather
than here.
