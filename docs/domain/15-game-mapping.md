# 15 — Mapping the Domain to Hollywood Pictures

*The bridge document.* Everything else in `docs/domain/` deliberately ignores
the game. This one is the only place the two meet: for each area of the real
industry, what the simulation **models**, what it **abstracts**, and what it
**omits** — plus which engine module or design doc is authoritative on the
current implementation.

> **This is a coarse map and a snapshot, not a specification.** The
> `DESIGN_*` and `AUDIT_*` docs in `docs/` are authoritative on what the code
> actually does today; the code is authoritative over them. When they conflict
> with this table, they win. Re-check before relying on a row.

**How to use it.** When a design conversation reaches "how does this work in
real life?", read the domain doc. When it reaches "what do we do about it?",
come back here to see whether the game already has a place to put the answer.

**Method for this pass.** Every **Modelled** row below names a module in `src/`
that was read, not inferred. Where the code and an existing `DESIGN_*` /
`AUDIT_*` doc disagree, the code is recorded here and the disagreement is
flagged in §4.

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
| The value chain: production → distribution → exhibition (`01` §1) | **Abstracted** | Exhibition is a keep share (`data/distribution.ts`: `DOMESTIC_KEEP_SHARE`, `INTERNATIONAL_KEEP_SHARE`) plus an availability curve; there is no exhibitor to negotiate with |
| A studio as an organisation with divisions (`01` §2) | **Abstracted** | `Studio` carries cash, Brand, Prestige, per-genre identity (`engine/studioIdentity.ts`) and two buyable facilities — Production Office and Distribution Arm. No org chart, no corporate parent |
| Rival studios competing for material, talent and dates (`01` §2, §10) | **Modelled** | `engine/rivalStudios.ts`, `rivalExecution.ts`, `rivalFranchise.ts`, `releaseCrowding.ts`, `marketSettlement.ts`. Rivals are tiered, hold genre territory, and book talent out of the same pool |
| Production companies, pods, first-look deals (`01` §3) | **Abstracted** | `engine/producers.ts` — Line / Creative / Executive / Fixer producers on a Production Office bench, each shifting event impact, production cost, marketing efficiency or post score. No pods, no overhead deals |
| Financiers and outside capital (`01` §4) | **Omitted** | The studio funds everything from its own cash |
| Agencies, managers, packaging (`01` §5) | **Abstracted** | "Agent Package" is an opportunity *source* (`engine/opportunities.ts`), not an actor with interests |
| Guilds and unions (`01` §6) | **Omitted** | No scale minimums, turnaround, meal penalties or residual obligations. SAG appears only as the name of an awards show |
| Streamers as an alternative buyer (`01` §7) | **Omitted** | **Deliberate** — a `Streaming` release type existed and was removed; see the note above `ReleaseType` in `src/types/index.ts` (no honest theatrical-admissions model for it) |
| Exhibition as a business (`01` §8) | **Abstracted** | Screen access is `availabilityFraction` in `engine/audienceSimulationStep.ts`, expanding or contracting on demand-vs-capacity. No bookings, terms, or per-theatre decisions |
| International (`01` §9) | **Abstracted** | `internationalReachFraction`, gated by the Distribution Arm's international tier, scaled by `GENRE_INTERNATIONAL_APPEAL`. Territories do not exist |
| A film as an owned, tradeable asset (`01` §11) | **Modelled** | `Studio.assets`, `IntellectualProperty` with characters/setting/recognition/prestige, `engine/ipViability.ts`, `engine/sequelDevelopment.ts`. Assets are not bought or sold between studios, though |
| Trade press and how information moves (`01` §12) | **Abstracted** | `engine/storyReport.ts` and `premiereReport.ts` narrate results in trade-press voice; `engine/bidNotifications.ts` reports the rights market. There is no outlet, and no leak |
| Physical infrastructure — stages, labs, facilities (`01` §13) | **Omitted** | The two studio facilities are the whole of the built world |

### Development (`02`)

| Real thing | Status | Note |
|---|---|---|
| Where material comes from (`02` §2) | **Modelled** | `engine/opportunities.ts` — Spec Screenplay / Agent Package / Publisher Rights, on a weekly market with expiry; plus `commission.ts` (originals) and `sequelDevelopment.ts` (franchise entries) |
| Competing to buy material (`02` §2, §8) | **Modelled** | English-auction bidding against rivals — `opportunities.ts:placeBid/settleOpportunities`, `rivalStudios.ts:considerBiddingOnOpportunity`, `bidNotifications.ts`. Bids are always visible, never sealed |
| Rights: options vs purchase, chain of title, clearances (`02` §3) | **Omitted** | Acquisition is a single payment |
| The writer as a person with craft and taste (`02` §4) | **Modelled** | `WriterCareer` (craft axes + per-genre affinity), authored opportunities (`Opportunity.writerIds`), `engine/writers.ts`, `commission.ts` |
| Rewrites and polishes (`02` §4) | **Modelled** | `engine/rewrite.ts`; revision lineage and an append-only `DevelopmentEvent` history on `Asset` (`engine/screenplay.ts`) |
| Step deals, writer-by-writer chains (`02` §4) | **Abstracted** | Rewrite/polish are actions with a cost and a delivery day, not a sequence of separately engaged writers |
| Coverage and the reading system (`02` §5) | **Omitted** | No reader, no coverage document, no pass/consider/recommend. `engine/scriptPresentation.ts` is presentation, not coverage |
| Notes and the executive relationship (`02` §6) | **Abstracted** | The relationship exists inverted: `engine/creativeDemands.ts` is the *director* making demands of the studio, resolved accept/refuse. There is no notes process running the other way |
| WGA credit arbitration, separated rights (`02` §7) | **Omitted** | |
| Greenlight (`02` §8) | **Abstracted** | The player greenlights; `engine/projectReadiness.ts` and `affordability.ts` gate it. There is no internal case to make |
| Turnaround and development hell (`02` §9) | **Omitted** | Assets sit in the library indefinitely, but nothing decays, reverts, or gets picked up elsewhere |
| What makes a screenplay good (`02` §12) | **Modelled** | `engine/scriptGenerator.ts`, `data/scriptArchetypes.ts` — originality, structure, dialogue, characters, complexity, tone profile, hook, emotional premise; `conceptStrength.ts`, `commercialProfile.ts`, `marketability` |
| The pitch (`02` §13) | **Modelled** | `engine/directorPitch.ts` / `directorPitches.ts` — a pitch is a *risk posture the player bets on* (bold widens the outcome distribution), not a score to maximise |
| Where projects actually die (`02` §15) | **Abstracted** | A project can stall back to a plain Asset; the named death modes are not distinguished |

### Financing (`03`)

| Real thing | Status | Note |
|---|---|---|
| The two financing worlds — studio vs independent (`03` §1) | **Omitted** | Only the studio-funded world exists |
| Attachments and the package (`03` §2) | **Modelled** | `DevelopmentState` holds the pre-greenlight package: director attach, creative demands, then a frozen package at greenlight. `state/staffingBoard.ts` is the live view |
| Talent deal structures (`03` §3) | **Modelled** | `engine/castingNegotiation.ts` (asking price, counters, walk-aways), `castingEstimate.ts`, `backend.ts` — points against `studioGross` or `netProfit`, plus gross-milestone escalators, traded against a reduced guarantee |
| Pre-sales and territory rights (`03` §4) | **Omitted** | |
| Negative pickup and acquisitions (`03` §5) | **Omitted** | |
| Soft money: incentives and rebates (`03` §6) | **Omitted** | Would change *where* films shoot; no geography exists |
| Completion bonds (`03` §7) | **Omitted** | |
| Insurance (`03` §8) | **Abstracted** | A line inside the Shooting Budget (`data/production.ts`) and an event keyword, not a policy with cover and exclusions |
| Budget anatomy, above and below the line (`03` §9) | **Abstracted** | Continuous dials rather than an account structure — see `COST_REPORT_film_production.md`. **Deliberate.** There is no ATL/BTL split |
| Contingency (`03` §10) | **Modelled** | `ProductionChoices.contingencyReserveAmount` — set aside up front, consumed *only* by days past the recommended schedule, refunded at wrap, buys no quality. See `DESIGN_REVIEW_production_redesign.md` §8 |
| Cost reporting (`03` §10) | **Omitted** | `engine/cashLedger.ts` records movements; there is no weekly cost report or estimate-to-complete |
| Line producer and production accountant (`03` §12) | **Abstracted** | `engine/producers.ts` producer specialties are the nearest thing |
| How productions go over budget (`03` §13) | **Modelled** | Overrun days keep burning at the daily rate (`engine/cost.ts:computeDailyShootBurn`); events carry `costDelta`; the reserve absorbs, then cash does |
| Shutdown mid-production (`03` §14) | **Omitted** | A shoot cannot be abandoned |

### Pre-production (`04`)

| Real thing | Status | Note |
|---|---|---|
| Prep as a real stretch of calendar (`04` §1) | **Modelled** | `computeRecommendedPreProductionDays`, `ProductionChoices.designPrepDays`, a per-day prep burn scaled by film scale (`engine/cost.ts:computeDailyPrepBurn`) |
| Prep as a live phase with consequences | **Modelled** | `PreProductionState` ticks day by day with its own event bank (`PRE_PRODUCTION_EVENT_TEMPLATES`); prep events set the shoot's *starting* static risk (`computePrepRiskDelta`) as well as folding into delivered quality |
| Script breakdown into elements (`04` §2) | **Abstracted** | `engine/requirementProfile.ts` derives a leaf-level requirement profile (period architecture, studio build, creature embodiment/animation, digital doubles, …) — a narrative breakdown, not an element list with counts |
| Scheduling: stripboard, DOOD, shooting order (`04` §3) | **Omitted** | Shoot length is computed (`computeRecommendedShootDays`), never scheduled |
| Budgeting (`04` §4) | **Modelled** | `engine/cost.ts`, `productionDials.ts`, `affordability.ts` |
| Locations, permits, company moves (`04` §5) | **Omitted** | `locationWork` exists as a requirement leaf and an environment method, but there are no places |
| Design and build (`04` §6) | **Modelled** | `engine/setsFacet.ts` — ambition vs money vs skill vs granted prep days. No build schedule or serial dependency |
| Costume, hair and makeup (`04` §7) | **Omitted** | Explicitly left **unrouted** in `engine/departmentWorkload.ts` rather than misassigned — the coverage gap is deliberate and visible in code |
| Casting (`04` §8) | **Modelled** | The largest subsystem: `castingCalls.ts`, `casting.ts`, `castingAppeal.ts`, `castingNegotiation.ts`, `castingEstimate.ts`, `castingDirectorAdvice.ts`, shortlists and auditions on `FilmDraft`. See `DESIGN_REVIEW_casting_redesign.md`, `DESIGN_REVIEW_casting_slot_binding.md` |
| Crew hiring (`04` §9) | **Modelled** at head level | Director plus seven crew heads, hired directly. Departments beneath them do not exist |
| Rehearsal, previs, testing (`04` §10) | **Omitted** | |
| Production meetings and paperwork (`04` §11) | **Omitted** | **Deliberate** — invisible to the player |
| Prep under compression (`04` §16) | **Modelled** | Cutting prep starves the facets' time axis (`engine/facetModel.ts` time floors), which is exactly the real consequence |

### Departments and crew (`05`)

| Real thing | Status | Note |
|---|---|---|
| The hiring chain (`05` §1) | **Abstracted** | The player hires every head directly; nobody hires anybody else |
| Crew size (`05` §2) | **Omitted** | Crew is a shooting-budget line, not headcount |
| Production department (`05` §3) | **Abstracted** | `engine/producers.ts` |
| Directing department / the AD team (`05` §4) | **Omitted** | Also named as unrouted in `departmentWorkload.ts` |
| Camera department (`05` §5) | **Modelled** at head level | `engine/cinematographyFacet.ts` — the DP now drives real film quality on player films (`personDrivenCraft`), which `AUDIT_crew_responsibilities.md` still records as inert. See §4 |
| Grip and electrical (`05` §6, §7) | **Omitted** | |
| Art department (`05` §8) | **Modelled** at head level | `engine/setsFacet.ts` plus `crewSpecialty.ts` — PD specialties (period craft, large-scale builds, location work, practical creatures) |
| Costume (`05` §9), hair & makeup (`05` §10) | **Omitted** | |
| Sound department (`05` §11) | **Omitted** | No production sound mixer, no boom, no sound at all as a craft |
| Locations department (`05` §12) | **Omitted** | |
| Stunts, SFX and specialty units (`05` §13) | **Modelled** | `engine/stuntTeams.ts` (teams with a `StuntSpecialty` and an effective skill) plus `practicalFacet.ts` |
| Editorial during the shoot (`05` §14) | **Abstracted** | The shoot produces a `coverageRatio`; the editor's own work resolves in post |
| Second unit (`05` §16) | **Omitted** | One event id gestures at it |
| Day rates, fringes, directional rates (`05` §17) | **Omitted** | |
| Credit order (`05` §18) | **Omitted** | |
| Who is on the film when (`05` §19) | **Abstracted** | Commitments are per-project windows, not per-department start and finish dates |
| How departments interact, and where the friction is (`05` §20) | **Modelled** | `engine/compatibility.ts`, `collaborationEdges.ts`, `crewPhilosophy.ts`, `crewFitRead.ts`, `creativeTension.ts` — the last of these as a *risk amplifier*, not a flat penalty |
| Departments beneath each head (`05` §3–§13) | **Omitted** | **Deliberate for now** — the live Workstream II. `engine/departmentWorkload.ts` models three departments (Production Design, VFX, Stunts) as workload derived from requirements; the rest are explicitly unrouted. See `DESIGN_production_crafts_and_crew.md`, `DESIGN_production_requirements_model.md` |
| Failure signatures — which department a problem points to (`05` §22) | **Modelled** | `engine/productionExecution.ts` routes every event to the craft it actually moved; `reviews.ts` names the department in the review |

### Principal photography (`06`)

| Real thing | Status | Note |
|---|---|---|
| The economics of a shooting day (`06` §1) | **Modelled** | The Shooting Budget is a daily burn over the recommended schedule (`computeDailyShootBurn`), so wrapping early genuinely costs less and running long genuinely costs more |
| The call sheet and the daily production report (`06` §2) | **Omitted** | |
| Anatomy of a shooting day (`06` §3) | **Omitted** | The day is the atom; setups and pages do not exist |
| Coverage (`06` §4) | **Abstracted** | `engine/productionExecution.ts` derives a `coverageRatio` from days shot plus coverage-impact events, and `scoring.ts` uses it as a hard ceiling on the edit ("a film you didn't shoot can't be cut great"). But coverage is a *consequence*, never a director's stated philosophy the player chooses |
| Time sinks — what actually loses days (`06` §5) | **Abstracted** | Events carry `delayDaysDelta`; the specific sinks are flavour, not mechanism |
| Night, weather, special conditions (`06` §6) | **Abstracted** | Weather is an event template (`neg-bad-weather`, `postpone-weather`, `push-through-weather`), not a simulated condition |
| Overtime, turnaround, meal penalties (`06` §7) | **Omitted** | The main real-world cost-of-time mechanism is absent — the burn rate is flat per day |
| Safety (`06` §8) | **Modelled** | `safetyRisk` is one of four `StaticProductionRisk` dimensions with its own event bank, driven by practical ambition against contingency margin |
| Dailies as an information channel (`06` §9) | **Omitted** | The player learns via events, never by watching material |
| Reshoots and additional photography (`06` §10) | **Modelled** | `engine/testScreening.ts` — Pickups and Major Reshoots recall named principals at a rush premium and cost the film's own daily shoot burn for a real number of days, with a real delay |
| Multiple units and blocks (`06` §11) | **Omitted** | |
| Wrap (`06` §12) | **Modelled** | The player may wrap early; there is an auto-wrap ceiling and a rush penalty — see `DESIGN_REVIEW_rush_penalty_and_screen_collapse.md` |
| Directing actors on the day (`06` §14) | **Modelled** | `engine/actingModel.ts` — a performance floor plus director-unlockable headroom, so who directs changes what a cast delivers |
| Falling behind and catching up (`06` §16) | **Abstracted** | Days elapsed versus recommended is the whole reading; there is no schedule to fall behind |

### Post-production (`07`)

| Real thing | Status | Note |
|---|---|---|
| The post timeline (`07` §1) | **Modelled** | `computeRecommendedPostProductionDays`, plus explicit editing windows and a screening-ready day on `FilmDraft` |
| Editorial (`07` §2) | **Modelled** | `engine/editFacet.ts` — the hired editor drives quality on player films, within the coverage ceiling — plus the `editStyle` choice |
| Sound post: ADR, foley, design, the mix (`07` §3) | **Omitted** | Sound is neither a department nor a facet |
| Music (`07` §4) | **Abstracted** | `engine/scoreFacet.ts` (the composer's own craft) plus a `musicFocus` choice. No songs, no sync or master clearance |
| Visual effects in post (`07` §5) | **Abstracted** | The VFX facet resolves at scoring; there is no post-side VFX pipeline, turnover, or shot count |
| Picture finishing: the DI (`07` §6) | **Omitted** | **Deliberate** — invisible to the player |
| Deliverables (`07` §7) | **Omitted** | **Deliberate** |
| Ratings and versioning (`07` §8) | **Omitted** | No certification, no rating-driven audience ceiling, no alternate versions |
| Test screenings and research (`07` §9) | **Modelled** | `engine/testScreening.ts` + `postProductionStatus.ts` — an *iterative* loop: screen, choose Re-edit / Pickups / Major Reshoots, wait out the recut in real days, screen again, or lock. Reverting to the original cut is an explicit option |
| Picture lock as a gate (`07` §1) | **Abstracted** | A lock gate exists — `SCHEDULE_RELEASE` refuses until `testScreeningResolved` — but nothing downstream waits on it, because there is no downstream (no sound, no music delivery, no DI) |
| Common post failure modes (`07` §10) | **Abstracted** | Reachable through the recut loop's cost and delay, not named |
| The post-production supervisor (`07` §11) | **Omitted** | |
| Rescuing a film in post (`07` §12) | **Modelled** | The recut loop *is* this, priced honestly: each round costs money and calendar |

### VFX and specialty (`08`)

| Real thing | Status | Note |
|---|---|---|
| VFX ambition vs money vs skill vs time (`08` §1) | **Modelled** | `engine/vfxFacet.ts` |
| VFX vendors, bidding, shot counts, turnover (`08` §1) | **Omitted** | VFX is an ambition scalar against a capability, not a shot pipeline |
| Practical special effects (`08` §2) | **Modelled** | `engine/practicalFacet.ts` |
| Stunts and action design (`08` §3) | **Modelled** | `engine/stuntTeams.ts` — teams carry a specialty, and specialty match against the film's demands matters |
| Prosthetics and creature effects (`08` §4) | **Abstracted** | `creatureEmbodiment` / `creatureAnimation` requirement leaves and a `creatureMethod` (`animatronic` → `fullyCG`), but no prosthetics craft or artist |
| Animation as a production model (`08` §5) | **Omitted** | |
| How ambition becomes difficulty (`08` §6) | **Modelled** | `engine/facetModel.ts` is exactly this claim, generalised: money × time × skill against ambition, with money's weight rising with ambition and hard floors at the top. Six facets share it |
| Miniatures and practical model work (`08` §7) | **Omitted** | |
| How practical and digital are actually combined (`08` §9) | **Modelled** | `engine/executionStrategy.ts` — the creature and environment method choices *re-route the same requirements to different departments* (`departmentWorkload.ts`), which is the real trade-off rather than a cost multiplier |
| What makes an effect convincing (`08` §10) | **Abstracted** | Realisation against ambition, not a craft profile |

### Marketing and distribution (`09`)

| Real thing | Status | Note |
|---|---|---|
| P&A as a second budget (`09` §1) | **Modelled** | `engine/marketing.ts`; a distributor's committed P&A is *fronted* and recouped in full off the top of the studio's keep (`boxOfficeRun.ts`), so it is not the studio's money but it is not free either |
| Who actually does it (`09` §2) | **Abstracted** | The Market Research department is the only marketing org that exists |
| The campaign timeline (`09` §3) | **Modelled** | `MarketingChoices.campaignStartDay` → `marketing.ts:marketingRolloutMultiplier` — a longer runway builds more momentum. See `DESIGN_REVIEW_marketing_rollout.md` |
| Creative advertising (`09` §4) | **Abstracted** | `campaignAngle` (spectacle / story / mystery / starPower / faithful) is what the campaign *sells*, and an over-sold angle carries a legs risk — but there is no trailer, key art, or creative asset |
| Media buying and channels (`09` §5) | **Modelled** | `channelSpend` across trailers / TV / digital / press, converted to an audience-weighted effective reach. See `DESIGN_REVIEW_marketing_campaign.md` |
| Positioning (`09` §6) | **Abstracted** | `TargetAudience` (`data/audiences.ts`) plus the campaign angle; the four-quadrant frame does not exist |
| Distribution: dating and release strategy (`09` §7) | **Modelled** | `engine/scheduledReleases.ts`, `releaseCrowding.ts`, `marketSettlement.ts`, `calendar.ts`; Wide / Limited / Festival First each with their own availability curve |
| Self-distribute or rent a major (`09` §7) | **Modelled** | `engine/distribution.ts` — an owned Distribution Arm (tiered) versus competing `DistributorOffer`s whose fee, breadth and P&A improve with how much the distributor believes in the film |
| Research: tracking and testing (`09` §8) | **Abstracted** | `engine/marketResearch.ts` — a buyable Market Research tier narrows the *band* on the projected opening. That is tracking-as-a-service; there is no tracking report, no PostTrak, no per-quadrant read |
| Publicity and press (`09` §9) | **Modelled** | `engine/pressTour.ts` and `pressTourMoments.ts` — fame traded against media risk, with incidents that move a person's real reputation |
| Festivals (`09` §10) | **Abstracted** | "Festival First" is a release type with its own awareness and expansion profile; there is no circuit, no premiere slot, no acquisition market |
| Home entertainment and licensing (`09` §11) | **Modelled** | `engine/ancillary.ts` — four windows (home entertainment, licensing, merchandising, catalogue) with real payout timing |
| International marketing (`09` §15) | **Omitted** | International is a reach fraction, not a campaign |
| Changing course mid-flight (`09` §16) | **Omitted** | Campaign terms freeze at `SCHEDULE_RELEASE` and cannot be revised |

### Box office (`10`)

| Real thing | Status | Note |
|---|---|---|
| A week-by-week run rather than a scored total (`10` §2) | **Modelled** | `engine/boxOfficeRun.ts`, `audienceSimulation*.ts` — the game's central claim (`POSITIONING.md`) |
| Second-weekend drop and the multiple as diagnostics (`10` §3, §4) | **Abstracted** | Both emerge from the run; `audienceSimulationReporting.ts` names the *shape* (collapsed, grew, plateaued, stayed niche) rather than surfacing the named instruments |
| Seasonality (`10` §5) | **Modelled** | Release windows with a base multiplier and a per-genre bonus (`data/release.ts`, `engine/calendar.ts`) |
| What determines the opening (`10` §6) | **Modelled** | Release-day awareness seed from buzz, marketing reach, cast reach and release type |
| What determines the rest of the run (`10` §7) | **Modelled** | Word of mouth against a finite interested pool, gated by availability |
| Competition for the same weekend (`10` §6) | **Modelled** | `engine/releaseCrowding.ts`, `marketSettlement.ts` — including rivals steering around a studio's home-turf genre |
| Break-even (`10` §8) | **Modelled** | Profit is computed from the studio's actual keep net of cost and P&A recoup; there is no rolling break-even instrument the player can watch |
| Distributor / exhibitor split (`11` §1) | **Modelled** | Keep share plus distributor fee (`engine/distribution.ts`) |
| International specifics (`10` §9) | **Abstracted** | A reach fraction and a genre appeal weight |
| Reporting and estimates (`10` §10) | **Omitted** | No previews, no dailies, no Sunday estimate that gets revised. The week is the unit |
| Failure signatures (`10` §11) | **Modelled** | `engine/audienceSimulationReporting.ts` |
| How an exhibitor decides what to book and hold (`10` §13) | **Abstracted** | Availability contracts or expands on demand-versus-capacity, which is the *effect* of that decision without the decision |
| Capacity, showtimes, the arithmetic ceiling (`10` §15) | **Modelled** | `MAX_WEEKLY_THROUGHPUT_FRACTION` and the availability anchor cap demand honestly |
| Repeat viewing and event-ness (`10` §16) | **Omitted** | Structurally: the simulation converts each interested person at most once, so a film cannot be seen twice. Nothing can produce a *Titanic* run |

### Money (`11`)

| Real thing | Status | Note |
|---|---|---|
| From ticket to studio (`11` §1) | **Modelled** | Keep share → distributor fee → P&A recoup → studio revenue |
| The definitions ladder (`11` §2) | **Abstracted** | `BackendDeal.base` is `studioGross` or `netProfit`, plus gross escalators. There is no rolling break, no distribution fee or overhead inside the participation definition |
| Revenue sources over a film's life (`11` §3) | **Modelled** | `engine/ancillary.ts` — four windows, genre- and reception-weighted, scheduled as concrete future payouts on `Studio.ancillaryPipeline` |
| Residuals (`11` §4) | **Omitted** | |
| The studio's own P&L (`11` §5) | **Abstracted** | Cash plus a categorised ledger (`engine/cashLedger.ts`). No studio overhead charge, no capitalised interest, no slate-level P&L — so a hit can never show a loss for the reason it does in reality |
| Break-even, honestly stated (`11` §6) | **Abstracted** | Profit is a single figure once the run finishes |
| Co-financing and risk sharing (`11` §7) | **Omitted** | |
| Cash flow through production (`11` §8) | **Modelled** | Prep burns daily, the shoot burns daily, cost is charged in stages, ancillary drains in and backend liabilities drain out day by day. See `DESIGN_REVIEW_studio_financial_model.md` |
| Net-profit definitions and audits (`11` §2) | **Omitted** | **Deliberate** — famously opaque, poor play material |
| The library as a durable asset (`11` §12) | **Abstracted** | A `catalogue` ancillary window and a cult-longevity term exist, and `IntellectualProperty` carries recognition and prestige forward — but the library is never valued, never appears on a balance sheet, and cannot be sold |
| Ways films lose money that are not "it flopped" (`11` §13) | **Omitted** | Overhead, interest, cross-collateralisation and participation drag are all absent |

### Talent and careers (`12`)

| Real thing | Status | Note |
|---|---|---|
| The representation stack (`12` §1) | **Omitted** | No agents, managers or lawyers as actors with their own interests |
| The quote system (`12` §2) | **Modelled** | `getTypicalSalaryForRole`, `engine/castingEstimate.ts`, `castingNegotiation.ts` — a stable asking price rolled once, then negotiated against |
| What makes a star bankable (`12` §3) | **Modelled** | `engine/castingAppeal.ts`, `directorAppeal.ts`, and a cast reach fraction feeding release-day awareness. Not per-territory, and not per-genre |
| The career arc (`12` §4) | **Abstracted** | Fame and current heat move through `engine/reputation.ts` and press-tour incidents; there is no explicit rise/plateau/decline lifecycle |
| Relationships and repeat collaboration (`12` §5) | **Modelled** | `engine/relationships.ts`, `pairHistory.ts`, `TalentPairing` chemistry (performance and craft dimensions), `collaborationEdges.ts` |
| Contracts: what is actually negotiated (`12` §6) | **Abstracted** | Fee plus backend. No perks, credit position, or approvals |
| Guild minimums and protections (`12` §7) | **Omitted** | |
| Below-the-line careers (`12` §8) | **Omitted** | Follows from having no departments |
| Talent as people with craft and temperament (`12` §11, §12) | **Modelled** | `engine/person.ts`, `personTraits.ts`, `personality.ts`, `actingModel.ts`, `castPerformance.ts`, `DirectorProductionStyle`, `DomainAptitudes` |
| Availability as a hard calendar constraint (`12` §13) | **Modelled** | `PersonCommitment` windows with overlap checking (`isPersonAvailableForCommitment`), a "booked until" reading everywhere in the UI, schedule as an explicit offer-rejection reason, and Deferred Start via `latestCastBookingEnd`. Rivals book out of the same pool, so the constraint genuinely competes |
| What a simulation most often gets wrong (`12` §10) | — | Worth re-reading against this table rather than mapping |

### Critics, reviews and word of mouth (`16`)

| Real thing | Status | Note |
|---|---|---|
| The four instruments (`16` §1) | **Abstracted** | Two of the four exist: a critic score and an audience score. No aggregator and no exit poll |
| Who critics are (`16` §2) | **Omitted** | No named critics or outlets; quotes are generated voices from two banks (`data/reviewBlurbs.ts`) |
| How a review gets made (`16` §3) | **Omitted** | |
| Aggregate scores and their maths (`16` §4) | **Omitted** | Individual quote scores jitter around one underlying mean (`reviews.ts`), so there is no consensus-versus-esteem distinction and no percentage-of-positive mechanic |
| What critics respond to (`16` §5) | **Modelled** | Department scores weighted by genre signature (`engine/genreWeights.ts`, `reviews.ts`) — critics notice the craft the genre lives or dies on |
| What reviews actually do to box office (`16` §6) | **Modelled** | Critic and audience scores drive word-of-mouth strength and, for platform releases, availability expansion |
| Audience instruments — CinemaScore, definite recommend (`16` §7) | **Omitted** | The best real predictor of legs has no in-game instrument |
| Word of mouth as a mechanism (`16` §8) | **Modelled** | `engine/audienceSimulationStep.ts` — awareness spread, interest conversion and attendance probability all respond to it separately |
| The reception matrix (`16` §9) | **Omitted** | Word of mouth is monotone in mean reception, so a divisive film and an indifferent film with the same average behave identically. The real market treats them oppositely |
| Reputation over time (`16` §11) | **Abstracted** | Results are frozen at settlement; the only re-appraisal is a cult term in the ancillary longevity model |
| Fan communities and pre-release sentiment (`16` §12) | **Abstracted** | Buzz plus IP recognition; no community with a temperature of its own |
| Embargo timing as a signal (`16` §3) | **Omitted** | |
| How reception differs by territory (`16` §13) | **Omitted** | |

### Awards (`13`)

| Real thing | Status | Note |
|---|---|---|
| Why awards matter commercially (`13` §1) | **Modelled** | Awards feed the ancillary longevity model (`engine/ancillary.ts`) and studio Prestige, rather than being a decorative end-card |
| The Academy (`13` §2) | **Abstracted** | Twelve Academy categories in `data/awards.ts`; no branches, no membership, no eligibility rules |
| The season calendar (`13` §3) | **Modelled** | `data/awardsShows.ts` — Golden Globes → SAG → BAFTA → Academy, each on its own offset from the year boundary, resolved through `AwardsSeasonInProgress` |
| Precursors and their predictive value (`13` §4) | **Modelled** | Momentum accumulates from each earlier ceremony into every later one, weighted per show; the flagship resolves last so its own weight is never consumed |
| Campaigning (`13` §5) | **Modelled** | `SET_AWARDS_CAMPAIGN` commits cash per film; `engine/awards.ts:campaignBoost` is a saturating return on it, with its own `awardsCampaign` ledger category |
| Branch voting and preferential ballots (`13` §2) | **Omitted** | Contenders are scored and ranked, with jitter |
| Critics and awards (`13` §6) | **Modelled** | Ceremonies read critical reception and per-department scores |
| Genre bias in voting (`13` §9) | **Abstracted** | Present in category weighting rather than as a stated model |
| The campaign from the talent's side (`13` §10) | **Omitted** | |
| The career economics of awards (`13` §11) | **Abstracted** | Reputation moves; there is no quote bump or role-offer change |

---

## 3. The largest honest gaps

Ranked by how much they would change the game, not by effort. Several entries
that topped the previous version of this list have since been built and are
noted as such in §2 (talent availability, awards campaigning and precursors,
reshoots, contingency).

1. **Indifference versus division** (`16` §9) — the sim's word of mouth is a
   monotone function of mean reception, so a film half the audience loves and
   half hates behaves exactly like a film everyone shrugs at. Reality treats
   these as opposite outcomes: the argued-about film has legs, the shrug does
   not. This is the single largest structural mismatch between the domain and
   the model, and it sits directly on the game's positioning claim.
2. **Repeat viewing** (`10` §16) — the audience simulation converts each
   interested person at most once, by construction. No amount of quality can
   produce a phenomenon run, because the only route to one in reality is people
   going twice. A ceiling the player can never see or reach.
3. **Time as a cost gradient** (`06` §7) — overtime, turnaround and meal
   penalties are how the real industry makes "one more hour" expensive. The sim
   burns a flat daily rate, so a long day and a short day cost the same and the
   contingency reserve absorbs a linear overrun. The most-used lever in real
   production scheduling has no representation.
4. **Departments beneath the creative heads** (`05` §3–§13) — the live
   Workstream II. `departmentWorkload.ts` routes requirements to three
   departments and deliberately leaves Costume, Hair & Makeup, and the AD team
   unrouted. **Partly deliberate**: the scaffolding is built and gated, not
   forgotten.
5. **Sound as a craft** (`05` §11, `07` §3) — an entire discipline with no
   representation at any stage, and one with a clean facet shape already
   available. It is also the one omission a player who knows filmmaking will
   notice immediately.
6. **Studio overhead, interest, and the ways films lose money without flopping**
   (`11` §5, §13) — the mechanism behind the industry's most famous accounting
   facts. Without it, the studio's P&L is a cash balance and profitability reads
   more honestly than it should.
7. **Coverage as a stated choice** (`06` §4) — coverage exists as a derived
   ratio that ceilings the edit, which is the *consequence* half. The
   decision half — a director choosing how much to shoot, and paying for it in
   days — is the lever the player never touches.
8. **The library as a valued asset** (`11` §12) — catalogue income and IP
   recognition carry a film's afterlife, but the library is never valued and
   never tradeable. Given the game is about running a studio over decades, the
   durable asset is currently only a revenue trickle.
9. **Aggregate scores and exit polling as instruments** (`16` §4, §7) — the
   underlying reception model is rich; the player reads it through two bare
   numbers. Adding instruments (a consensus percentage, a definite-recommend
   read) would surface what the simulation already computes, and is a
   presentation gap more than a modelling one.
10. **Picture lock and the post dependency chain** (`07` §1) — a lock gate
    exists, but nothing waits on it, because sound, music delivery and finishing
    do not exist. This gap is largely downstream of gap 5 and would mostly be
    resolved by it.
11. **Options, turnaround, and development hell** (`02` §3, §9) — an
    acquisition is permanent and free to hold. Real development pressure comes
    from an option clock and the risk of losing material. Currently the library
    has no carrying cost at all.
12. **Ratings and certification** (`07` §8) — a rating decision is a real
    audience-ceiling trade-off (and one the player would feel). **Possibly
    deliberate**: no design doc argues for it either way.

Deliberate omissions that should stay omitted, recorded here so they are not
re-raised as gaps: streaming as an alternative buyer (removed on purpose, see
`ReleaseType` in `src/types/index.ts`), net-profit definitions and audits, DI and
deliverables, production paperwork, and the ATL/BTL account structure.

Each of these is a real-industry mechanism first; whether it earns a place in
the game is a separate design question, and belongs in a `DESIGN_*` doc rather
than here.

---

## 4. Where the code and the design docs disagree

Recorded from this pass so the next reader does not re-derive it. The code wins
in every case.

- **`AUDIT_crew_responsibilities.md` finding 2** says the Cinematographer
  "appears nowhere in `scoring.ts`" and that the Composer's contribution is a
  player menu choice rather than the hired person. Both are now false for player
  films: `engine/cinematographyFacet.ts` and `engine/scoreFacet.ts` exist and are
  wired into `computeQualityBreakdown` behind the `personDrivenCraft` flag
  (`engine/scoring.ts`; see `engine/craftCutover.test.ts`). Rivals still use the
  flat model, which is deliberate.
- **Same audit, finding 3** says editor skill drives schedule but not quality.
  `engine/editFacet.ts` now realises edit quality from the editor, within the
  coverage ceiling — again for player films only.
- The audit's finding 4 (Production Designer has a facet but no award category)
  is **stale in the other direction**: `best-production-design` exists in
  `AwardCategory`, and `FilmResults.productionDesignScore` is read out
  specifically so that category can judge the department directly.
