# Domain Reference — How Films Actually Get Made

A standing reference on the **real film industry**: the pipeline, the crafts,
the money, and the people. It exists so that design conversations about
Hollywood Pictures can start from a shared factual baseline instead of
re-researching the same ground every session.

**This library describes the real world. It does not describe the game.**
That separation is the point — the moment these documents start justifying game
mechanics, they stop being useful as a baseline. The single exception is
`15-game-mapping.md`, which is explicitly the bridge.

---

## The library

| # | Document | Covers |
|---|---|---|
| 01 | [`01-industry-structure.md`](01-industry-structure.md) | The value chain, majors, production companies, financiers, agencies, guilds, exhibitors, streamers, international |
| 02 | [`02-development.md`](02-development.md) | Sources of material, options and rights, writers and step deals, coverage, notes, credit arbitration, greenlight, turnaround |
| 03 | [`03-financing-and-dealmaking.md`](03-financing-and-dealmaking.md) | Capital stacks, attachments, talent deals, pre-sales, negative pickups, tax incentives, completion bonds, insurance, budget anatomy |
| 04 | [`04-preproduction.md`](04-preproduction.md) | Script breakdown, scheduling and DOOD, budgeting, locations, design and build, costume, casting, crew hiring, rehearsal |
| 05 | [`05-departments-and-crew.md`](05-departments-and-crew.md) | Every department and role, the hiring chain, crew sizes, day rates, credit order |
| 06 | [`06-principal-photography.md`](06-principal-photography.md) | The shooting day, call sheets, coverage, time sinks, overtime and turnaround, safety, dailies, reshoots |
| 07 | [`07-postproduction.md`](07-postproduction.md) | Editorial, sound post, music, VFX in post, the DI, deliverables, ratings, test screenings |
| 08 | [`08-vfx-and-specialty.md`](08-vfx-and-specialty.md) | VFX pipeline and economics, practical effects, stunts, prosthetics, animation as a production model |
| 09 | [`09-marketing-and-distribution.md`](09-marketing-and-distribution.md) | P&A, campaign timeline, creative advertising, positioning, dating, release patterns, windows, research, festivals |
| 10 | [`10-theatrical-release-and-box-office.md`](10-theatrical-release-and-box-office.md) | Run shapes, drops and multiples, seasonality, break-even, international, reporting, failure signatures |
| 11 | [`11-money-accounting-and-participations.md`](11-money-accounting-and-participations.md) | The waterfall, participation definitions, revenue windows, residuals, studio P&L, cash flow |
| 12 | [`12-talent-labor-and-careers.md`](12-talent-labor-and-careers.md) | Representation, quotes, bankability, career arcs, contracts, guild protections, below-the-line careers |
| 13 | [`13-awards-and-critical-reception.md`](13-awards-and-critical-reception.md) | The Academy, season calendar, precursors, campaigning, critics and aggregate scores |
| 14 | [`14-glossary.md`](14-glossary.md) | A–Z of terminology, cross-referenced to the document that explains it |
| 15 | [`15-game-mapping.md`](15-game-mapping.md) | **The bridge.** What Hollywood Pictures models, abstracts, and omits, area by area |

**Reading order.** 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 follows a film's own
chronology and reads as a continuous narrative. 09 → 10 → 11 covers what
happens after it's finished. 12 and 13 are cross-cutting. 14 and 15 are
lookup.

---

## Scope and conventions

**Era.** Contemporary studio filmmaking — roughly the 2010s–2020s, post-
streaming. Where a practice has changed materially (packaging fees, theatrical
windows, first-dollar gross, residuals), the shift is noted rather than
silently resolved to one side.

**Geography.** US studio practice is the default, since it is the system the
game models. UK and international practice is noted where it differs
meaningfully — crew nomenclature, certification, co-productions, incentives.

**Currency.** USD unless stated. The game uses £; conversion is left to
whoever is doing the balancing, because the *ratios* are what transfer, not
the absolute figures.

**Figures are directional.** Every number here is a rule of thumb with a wide
real-world spread. They are good enough to sanity-check a model and not good
enough to cite as fact. Where a figure is contested or has drifted over time,
that is said.

**Sourcing.** Written from general industry knowledge, not from live research
against primary sources. Treat it as a well-informed baseline that is worth
verifying before anything load-bearing depends on a specific number. It is
also a snapshot: guild agreements, window lengths, and incentive rates all
change.

---

## What this library is for

1. **Answering "how does this actually work?"** without a research detour.
2. **Sanity-checking the simulation** — is a modelled behaviour recognisable
   as the real thing, or has it drifted?
3. **Finding what's missing** — `15-game-mapping.md` names the gaps explicitly.
4. **Vocabulary.** Using the industry's own words for things makes both the
   design docs and the player-facing text sharper.

## What it is not for

- **It is not a design document.** It has no opinion on what the game should
  do. Design arguments belong in `docs/DESIGN_*.md`.
- **It is not a source of truth about the code.** `docs/AUDIT_*`,
  `docs/COST_REPORT_*`, the `DESIGN_*` docs, and ultimately `src/` are.
- **It is not a realism mandate.** `docs/SIMULATION_PHILOSOPHY.md` and
  `docs/POSITIONING.md` decide what the game is; fidelity to this reference is
  a tool, not a goal. Plenty of what's described here is correctly omitted
  because it would be tedious to play.

---

## Maintaining it

- Keep the real/game separation absolute. If a game consideration needs
  recording, it goes in `15-game-mapping.md` or a `DESIGN_*` doc.
- Update `15-game-mapping.md` when a subsystem lands or changes shape; it is
  the only document here that goes stale from code changes.
- Correct figures in place when better information turns up, and keep the
  "directional" framing.
- Add to `14-glossary.md` whenever a new term enters a document, with the
  cross-reference.
