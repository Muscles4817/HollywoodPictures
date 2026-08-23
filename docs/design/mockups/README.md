# DESK register — mockup takes

Each take renders **the same screen with the same data** — the production record
for *Thunder County*, a mid-scale 1987 action picture — so that comparing them
compares treatment and nothing else. All names are invented and the studio is
"Meridian", modelling the post-rename, post-roster-replacement state.

Every take is a self-contained HTML file. Open locally, or use the published
link.

| # | Direction | File | Published |
|---|---|---|---|
| 01 | **Paper document.** Warm bond stock under a lamp on a dark desk. Printed form / typed content split (Archivo + Courier Prime). Above-the-line / below-the-line columns. Drawer slides up. | `take-01-production-sheet.html` | https://claude.ai/code/artifact/46ef77f7-9ce4-43e4-b525-ceb3c3e4983b |
| 02 | **Studio terminal.** Amber-phosphor CRT, full-bleed, F-key rail, scanlines. Marquee neon (cyan/magenta) used strictly as slot state coding. IBM Plex Mono + Plex Sans Condensed. TUI overlay window. | `take-02-studio-terminal.html` | https://claude.ai/code/artifact/410cf7cb-fb65-4f12-987b-2eb43bd85a88 |
| **09** | **THE CHASSIS.** The *frame*, not the screen. Time as the spine (clock, transport, and an attention queue where a time-critical item physically guards Play); studio destinations and the film slate as two separate registers; a working command palette on Ctrl-K. Carries a full project page: readiness meter, per-person notes, side panels and the stamp. Take 08's tokens, unchanged. | `take-09-chassis.html` | https://claude.ai/code/artifact/5c091ba3-7591-4ed2-b2e9-1e680bb7dbcd |
| **08** | **THE HYBRID.** Take 07's system carrying the best move from each earlier take: 01's printed-form/typed-content type split and warm palette, 02's colour-coded state and edge nav, 03's "what does this block", 04's voice rationed to one line, 05's deadline on an absence, and 06 as a **toggleable lens** rather than its own screen. Anybody + Schibsted Grotesk + Courier Prime. | `take-08-hybrid.html` | https://claude.ai/code/artifact/d97b8a4e-1f24-47dd-b904-7c41b6f2d65c |
| 07 | **Systematic (the control).** No metaphor at all — the era carried by typeface, palette, density and rule weight rather than by imitating an object. Anybody + Schibsted Grotesk. KPI row, validated readiness meter, state pills, persistent rail, side panels. The only take with light **and** dark themes. | `take-07-systematic.html` | https://claude.ai/code/artifact/3be4c2b1-580c-49d0-9dc7-44bd7ad564c6 |
| 06 | **Packaging board.** The package as a *relationship web*: index cards pinned to cork, joined by thread — green for fit or proven history, red for friction, dashed blue for untested. Chivo + Special Elite. Hovering a card isolates its threads; a tension report reads the web in words. | `take-06-packaging-board.html` | https://claude.ai/code/artifact/3d0b845f-60b2-475a-acf5-0e6d5ddb4c06 |
| 05 | **One-sheet proof.** The package as the film's own poster billing block, on a marked-up advertising proof: black teaser artwork on light mount board, chrome title, red hand-written proof notes in the margin. Big Shoulders Display + Saira Extra Condensed + Caveat. The only take where DESK and SPECTACLE occupy one object. | `take-05-one-sheet-proof.html` | https://claude.ai/code/artifact/5845b912-c3ed-4693-93a2-43c05e76e766 |
| 04 | **Trade paper.** A 1987 front page: Bodoni nameplate, spot red, justified two-column newsprint with a drop cap, and the production record carried as the paper's own *production chart*. Bodoni Moda + Fira Sans Condensed + Libre Baskerville. Gives the game a narrating voice. | `take-04-trade-paper.html` | https://claude.ai/code/artifact/1988435c-555c-4ce2-a678-df5f13584749 |
| 03 | **Strip board.** The real production-scheduling artifact: steel frame, vertical card strips in the industry colour convention, numbered cast key, black day breaks. Barlow Condensed + Bitter. Adds the schedule to the record, so an uncast role visibly blocks strips. | `take-03-strip-board.html` | https://claude.ai/code/artifact/18fd30f6-7430-41cc-9323-b0c10855551e |

## Verdicts so far

Recorded from review of takes 08 and 09.

**Keep** — the Package Readiness meter (reads distance-to-done at a glance);
take 08's right-hand side panels (better use of horizontal space, more
informative than a bare roster); per-person notes on each roster row; take 01's
rubber stamp. The chassis itself: time spine, two axes, command palette.

**Fixed in 09** — the first cut of the chassis stripped the page down to show the
frame and in doing so wasted horizontal space and dropped the sidebar, the
notes and the meter. All three are back, the content grid now runs
`minmax(0,1fr) 320px` inside a 1560px wrap, and each of the three slate projects
carries its own meter, panels, verdict and stamp.

**Still open** — per-page details beyond the project screen.

## The chassis (take 09)

Takes 01-08 all answered "what does *a screen* look like". 09 answers the prior
question: **what frame do all fourteen screens sit in?**

A page list handles only one of the four things this game's navigation must hold:

| Needs a home | In the code | A left page-list gives it |
|---|---|---|
| Places | `Screen` — 14 values | ✅ the list |
| Project contexts | `projects: Project[]` | ✗ flattened to one link |
| Time | `TICK_SPEED_MULTIPLIERS`, `paused`, `computeTicking` | ✗ nowhere |
| Attention | `timeCriticalUnreadBidCount()` | ✗ nowhere |

09's answer:

- **Time is the spine.** The clock, transport and speed are permanent and
  prominent, and the attention queue lives beside them. Critically, a
  time-critical item *guards Play* — this is `shouldConfirmResume` made visible
  rather than buried in a modal.
- **Two axes.** Studio destinations are one register; the films in flight are
  another, each showing the one fact that matters about it. A project is a
  **context**, not a peer of "Dashboard". The slate hides on non-project screens.
- **A command palette** (Ctrl-K), because 1,487 talents is past the point where
  any menu reaches most of the game.

## The synthesis (take 08)

Assembled from the reading in §Verdicts rather than from filled-in Keep/Reject
rows — revise it as those rows get filled.

| From | Move kept |
|---|---|
| 07 | The whole chassis: tokens, both themes, rail, KPI row, readiness meter, drawer, density |
| 01 | The **printed form / typed content** type split — the game's structure wears the grotesque, the player's decisions wear the typewriter. The discipline, not the paper texture. Plus the warm bone palette. |
| 02 | Slot state carried by colour *as well as* form; persistent edge nav |
| 03 | An open slot states **what it blocks** — in words, so no scene-level scheduler is needed |
| 04 | The voice, rationed to **one line**: "the desk's read", narrating the simulation |
| 05 | An absence with a **deadline** on it, not just a gap |
| 06 | The relationship web as a **lens you toggle**, inside the same chassis — not a screen of its own |

The uncast supporting role now carries all three readings at once: *blocks 3
shooting days · 2 relationships unreadable · offer needed by 30 Sept.*

## What each take is testing

- **01** — Does the DESK register work as a *physical object*? Tests
  `ART_DIRECTION.md` §2.1 in its most literal reading, and §5.3's "newsprint"
  option (resolved here as paper-on-a-dark-desk, taking both).
- **02** — Does it work as a *screen*? Tests §5.3's "darkened office" option,
  and whether colour-coding slot state (something paper cannot do) earns its
  place against §2.3's ornament discipline.
- **07** — The control, and the question the other six cannot answer: does the
  DESK register work as a **system** rather than an object? Metaphor does not
  scale to fourteen screens — there is no physical artifact that is the Talent
  Database, the Release Calendar or the Milestones page, so a per-screen
  metaphor means fourteen art directions and every new feature becomes an art
  problem before it can be a code problem. This take applies type, palette,
  density and rule weight uniformly instead, leaving metaphor to be deployed
  selectively where it earns its keep. It is also the only take that can carry a
  dark theme: a sheet of paper does not have one.
- **06** — Should this screen show **relationships instead of a list**? Takes
  01-05 all render the package as an ordered set of names and throw every
  relationship away — yet `compatibility.ts`, `pairHistory.ts`,
  `creativeTension.ts`, `directorAppeal.ts` and `relationships.ts` are where
  this simulation's actual depth lives. This is the only take that draws them.
  It is also the only one that shows the empty slot as a *hole with edges*: two
  relationships that cannot be read until the part is cast. Era-accurate too —
  agency packaging was invented in exactly this period.
- **05** — Can the two registers live in **one object** rather than on separate
  screens? A billing block is DESK paperwork (tiny, legal, contractually fixed
  order) printed on SPECTACLE artwork. Also reframes the empty slot a third way:
  not a blank line (01), not a colour (02), not a blocked strip (03), but a
  typesetter's slug that *cannot go to print* — an absence with a deadline
  attached. And it makes above-the-title billing visible, which is a real
  negotiation lever the game already models.
- **04** — Can editorial framing carry a *functional* screen? Real trades ran a
  regular "production chart" — a dense tabular listing of every picture
  shooting — so the newspaper metaphor has a genuine table at its centre rather
  than fighting one. Also the only take that gives the game a **voice**: the
  unfilled role is reported in prose ("no offer has gone out") instead of shown
  as a blank. Tests whether that voice is worth the space the prose costs.
- **03** — Does the register work as a *domain-specific instrument* rather than
  a generic document or screen? This is the only take whose information
  architecture differs rather than its skin: by carrying the shoot schedule
  alongside the package, an unfilled slot stops being a hole in a list and
  becomes three blocked shooting days. Tests whether consequence-made-visible
  is worth the legibility cost of vertical strips.

Both test §4 principles 1–3 (one screen, visible holes, persistent edge nav) and
§8.4 (the sheet is the map, the drawer is the depth).

## Candidate directions not yet built

All seven explorations built, plus the hybrid (08) that synthesises them.
Further work should iterate on 08 rather than adding a ninth direction. The next move is a **hybrid** assembled
from the individual moves marked Keep below, rather than a fifth fresh
direction.

## Verdicts

_To be filled in as takes are reviewed. Record what was liked and disliked per
take, not just which one won — the point of the cycle is to isolate the
individual moves worth keeping._

| # | Keep | Reject |
|---|---|---|
| 01 | | |
| 02 | | |
| 03 | | |
| 04 | | |
| 05 | | |
| 06 | | |
| 07 | | |
| 08 | | |
| 09 | | |
