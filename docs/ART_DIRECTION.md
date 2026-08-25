# Art Direction — Hollywood Pictures

**Status: LIVING DOCUMENT.** This is the visual counterpart to
`SIMULATION_PHILOSOPHY.md`: it records what the game is supposed to *look and
feel* like, and — just as importantly — what it must never look like. It exists
so those decisions are made once and enforced everywhere, instead of being
re-litigated screen by screen.

The build order that turns this document into code — and the measured gap
between the two — lives in `DESIGN_REVIEW_visual_redesign_roadmap.md`. This
document decides *what* the game looks like; that one decides *what order we
build it in*. Where they disagree, this document wins.

Sections marked **[DECIDED]** are settled and load-bearing. Sections marked
**[PROPOSED]** are drafts awaiting a look at something rendered. Sections marked
**[OPEN]** are unanswered questions. Anything can move between the three; nothing
here is precious.

---

## 1. The core decision [DECIDED]

**Era: the American blockbuster, roughly 1983–1997.**

Chosen because it is the era that made the designer fall in love with cinema, and
because it is commercially differentiated — the nearest competitor in this genre
(Hollywood Animal) owns the 1930s–40s Golden Age look, while the 80s/90s
blockbuster era has the deeper nostalgia market and is currently unclaimed.

**The one-line statement:**

> You are not making a movie poster. You are making **the desk of the executive
> whose posters those are.**

Everything below follows from that sentence.

---

## 2. The two registers [DECIDED]

The central structural device. 80s/90s poster aesthetics and dense management UI
are actively hostile to each other: posters are loud, high-contrast and airbrushed,
built to be read in two seconds from forty feet; this game needs forty legible data
points at 14px, readable for forty hours. Applying poster language to the interface
produces something that screenshots beautifully and is unplayable by minute twenty.

So the game runs **two distinct visual registers**, each with its own reference set,
its own palette and its own rules.

### 2.1 DESK — the working register

Where ~95% of playtime lives. Quiet, dense, legible, textured, unmistakably 1987.

Its reference is **not posters**. It is the paperwork of the era:

- *Variety* and *Hollywood Reporter* trade pages and box-office grosses charts
- Greenbar ledger paper, dot-matrix printouts, fax curl
- Telex, exec memos on studio letterhead, Xeroxed call sheets
- Contact sheets, VHS spine labels, manila folders and tab dividers

Rules: high legibility, tabular figures everywhere, restrained colour, texture
carried by paper stock rather than by glow.

### 2.2 SPECTACLE — the event register

Deployed **rarely and deliberately** — it hits hard precisely because it is rationed.
Neon, chrome, airbrush, deep black, hard gradients, condensed display type, bulb chase.

Reserved for: the title screen and main menu, the box-office results reveal, awards
night, the marketing/release screen, and the Steam capsule.

### 2.3 The rule that binds them [DECIDED]

> **Ornament lives on the frame. The data stays plain.**

Verified against Hollywood Pictures 2 (see §4): its wooden surrounds, brass fittings
and carved panels are lavish, and the lists *inside* them are flat, plain and
legible. That is why HP2 reads as rich without becoming unreadable. Never put
ornament, gradient, glow or texture on a surface a player has to read numbers off.

---

## 3. Place as backdrop, never as navigation [DECIDED]

A game set in a studio can put the player *somewhere* without making them *walk*
there.

- **Backdrop (good):** the screen has an ambient sense of place — a desk, an office,
  a lobby — while the thing the player came to do is on screen immediately, one
  click, zero traversal.
- **Navigation (rejected):** the player must travel to a location to perform an
  action. This is the studio-lot pattern in *The Movies* and *Hollywood Animal*, and
  it is explicitly rejected. It is tedious, and it forces fake realism — once you
  commit to a physical lot, every abstract action needs a silly building to live in
  ("hire an actor at the Acting Academy").

**Test:** if a menu has become a corridor, it is wrong.

This resolves the apparent tension between "atmospheric, evocative screens" and
"let me just do the database management." Both are available. Only traversal is banned.

---

## 4. Structural principles inherited from Hollywood Pictures 2 [DECIDED]

Read directly off HP2's own screens. These are structural, not stylistic — they
survive the change of era.

1. **One screen = one complete task, every slot visible at once.** HP2's film
   package screen carries title, genre, epoch, 11 attribute sliders, cast slots,
   director, co-producer, stunt team, FX, music, camera and make-up, plus shoot
   dates — on one screen. No wizard, nothing hidden behind Next. The player can see
   the whole shape of the decision.
2. **Empty slots are visible and shaped.** Blank rows show the holes before they are
   filled. The screen tells you what "done" looks like.
3. **Persistent global nav on one edge** — always available, never modal.
4. **Ornament on the frame, plain data inside** (see §2.3).
5. **Ambient backdrop behind the functional panel** — never underneath the text.
6. **A dialogue bar where the game speaks to the player in character.**

---

## 5. Palette [DECIDED]

Derived from reference: a modern retro marquee (cyan/magenta/bulb), the Studio City
Bookstar blade sign (red/blue neon, star motif, white letterboard), and a 1995
Cinemark lobby (hot red, green neon, purple, checkerboard, gold-framed lightboxes).

**Shipped and rendered** (`bfd2bb8`, `65173bd`). The tables below are the
*reference derivation* — the reasoning that produced the palette. The values
actually in force are the custom properties at the top of `src/index.css`, which
are the single authority; they drifted from these tables on contact with real
density, which is what the tables were always for.

Two rules came out of rendering it, and both are load-bearing:

- **The accent is rationed to state.** Focus rings, the active step, links. It
  never fills a surface. Filling every primary button with it is precisely what
  made the first pass shout at forty data points.
- **A value needs no hue.** Bars, meters and tracks take a neutral `--bar`
  rather than the accent, because a bar shows a quantity and hue would be
  decoration on a data surface (§2.3).

### 5.0 Corners [DECIDED]

Hard corners throughout, with **one** sanctioned exception: the badge family
(badges, chips, tags, state pills) keeps the full round, because there the shape
*is* the token rather than a softened corner. Two tokens carry this — `--radius`
for surfaces and `--radius-pill` for that family — and nothing else may hardcode
a radius.

Bars, tracks and meters take `--radius`, not the pill: §5's "a value needs no
hue" argument applies unchanged to shape, so a rounded cap on a data surface is
ornament under §2.3.

Whether even the badge family should go square is still live. It is now a
one-line change to `--radius-pill` rather than a 45-site sweep, so it can be
answered by looking at it.

### 5.1 SPECTACLE palette

| Role | Hex | Source |
|---|---|---|
| Ground | `#08080B` | night black behind every marquee |
| Neon cyan | `#29D8E0` | marquee primary |
| Neon magenta | `#F0559E` | marquee secondary |
| Neon red | `#FF2A2A` | Bookstar tube |
| Neon blue | `#2E5BFF` | Bookstar tube |
| Bulb warm | `#FFD98A` | chase bulbs |
| Letterboard | `#F2EFE6` | white plastic board |

### 5.2 DESK palette

| Role | Hex | Source |
|---|---|---|
| Newsprint | `#E8E3D6` | trade paper stock |
| Ink | `#1A1A18` | letterpress black |
| Greenbar | `#C9D9C0` | ledger paper banding |
| Manila | `#D9C9A3` | folder tab |
| Rule line | `#B3AC9A` | printed rule |
| Accent red | `#B0242C` | trade-paper headline red |

### 5.3 The film-stock question [DECIDED]

The two era references pull in opposite directions, and this needs resolving:

- **80s stock:** teal-to-blue shadows, warm/amber highlights, desaturated greens,
  *lifted* blacks, organic grain, halation bloom around practical lights. Soft, hazy.
- **90s stock:** peak analogue — high contrast, dense saturation, *deep* blacks,
  hard directional light, ultra-sharp glass. Crisp, physical.

**Resolution:** they map cleanly onto the two registers rather than competing.
SPECTACLE takes the 80s treatment — halation, bloom, grain, lifted blacks —
because atmosphere is the point. DESK takes the 90s treatment — hard contrast,
deep blacks, sharp edges, no bloom — because legibility is the point. Both eras
get used; neither fights the other.

This also settles the light-vs-dark question §12 used to carry, which was really
this question wearing different clothes. **DESK is theme-agnostic and both themes
are first-class** — take 07 established that a *system*, rather than an imitated
paper object, is the only treatment that can carry a dark theme at all, and both
token sets ship. **SPECTACLE is dark-only**: `MainMenu.css` grounds itself on
`--spine` in both themes, which is correct and should stay that way. Newsprint
and the darkened exec office were never a choice between two art directions; they
are the light and dark settings of one.

---

## 6. Screen inventory and register assignment [PROPOSED]

| Screen | Register | Notes |
|---|---|---|
| Title / main menu | SPECTACLE | Cinema marquee — see §7 |
| Save selection | SPECTACLE | Poster wall — see §7 |
| Settings | DESK | |
| Dashboard | DESK | The exec's desk / trade paper front page |
| Project workspace | DESK | The production sheet — see §8 |
| Talent database | DESK | Agency headshot files |
| Release calendar | DESK | Wall planner |
| Opportunity market | DESK | Trade classifieds |
| Marketing / release | SPECTACLE | The campaign is the poster |
| Box-office results | SPECTACLE | The emotional peak of the loop |
| Awards | SPECTACLE | |
| Stats / milestones | DESK | |

The rhythm this produces is the intended one: the player spends their week on the
trade pages, and on release weekend the screen turns into a poster.

---

## 7. Title screen and main menu [PROPOSED]

**Direction: the 1987 multiplex marquee.** Not the 1930s deco picture palace — plastic
changeable letter boards, fluorescent tubes, chunky neon, bulb chase, black and red.

Chosen because it is *functionally* a menu rather than a decorated one: a marquee is
literally a list of items in lightbox letters. The building's name is the game's name.
It is era-flexible, and it is cheaper than painted deco because it is flat geometry
rather than ornament.

**Save selection: the poster wall.** Each save is a film poster in a gold-framed
lobby lightbox, carrying that studio's own logo — tying directly to the existing
studio-logo feature. Presented as a **wall seen flat, all at once**, never a corridor
walked down (§3). Reference: the 1995 Cinemark lobby — hot red walls, black-and-white
checkerboard floor, green neon "NOW SEATING" letterboard, framed poster lightboxes.

**Logo mark: the clapperboard**, as a flat vector device rather than an animation.
The clapper snap becomes a CSS screen *transition* on New Game — the evocative half
of the "hands holding a clapperboard" idea, without the cost of illustrating or
animating hands.

---

## 8. Package assembly vs. temporal phases [PROPOSED]

The question "should the wizard become one sheet?" is the wrong question. The game
already contains two structurally different things wearing the same UI clothing.

### 8.1 Assembly has no inherent order

Pre-greenlight — script, title, genre, the ten `ProductionRole` slots, producers,
budget, schedule, financing — has **no causal ordering**. A player might cast the
lead before attaching a director, or lock the budget last. Order is the player's
business, not the game's.

This is already acknowledged in the code. `ProjectWorkspaceSection` is documented in
`src/types/` as "freely navigable via `OPEN_PROJECT_WORKSPACE_SECTION` — not a fixed
forward sequence like `WizardStep`." The Producer Workspace redesign did the hard
half of this work already.

What remains is that those five sections are still presented as **tabs**
(`ProjectWorkspace.tsx` wraps a `Nav`), and tabs still violate §4's principles 1 and
2: the player cannot see every slot at once, so they can neither read the shape of
the decision nor see where the holes are.

**Assembly should become one sheet.**

### 8.2 Execution is a chronology, not a form

`WizardStep = 'production' | 'post-production' | 'marketing' | 'results'` is not a
sequence of form steps — it is time passing. A film cannot be marketed before it is
shot. That is causality, and no amount of layout flattens it.

Hollywood Pictures 2 agrees: its one-sheet carries *Dreharbeiten* (shoot start, shoot
days, end date) as a **plan** — a set of dates on the assembly sheet — while the
shoot itself happened elsewhere. HP2's one-sheet is the *package*, not the film's
whole life.

**Execution stays sequential.**

### 8.3 Complexity is depth, not breadth

The worry that this game is "too complex for one sheet" does not survive counting.

- HP2's sheet: title, genre, epoch, 11 attribute sliders, cast slots, director,
  co-producer, supporting actors, stunt team, FX team, music, camera, make-up, three
  shoot dates. **20+ slots.**
- This game: script, title/genre/tone, ten production roles, producers, budget tier,
  schedule, financing. **16–18 slots.**

Fewer slots, not more. The difference is **depth per slot**: HP2's director slot is
"pick a name from a list"; this game's is a bake-off with pitches, a personal
reaction to the script, a fit read, a confidence-capped performance projection and a
negotiation.

### 8.4 The resolution [PROPOSED]

> **The sheet is the map. The drawer is the depth.**

One sheet shows every slot and its state — empty, filled, who occupies it, what it
cost. Clicking a slot opens a drawer over the sheet for the deep decision. Closing it
returns to the sheet, one line richer.

**The drawers already exist.** `CastingDrawer.tsx` (1,156 lines) and
`RoleHiringDrawer.tsx` (578) are precisely this pattern. The missing piece is the
sheet behind them, currently a tab bar.

This also converges with the strongest idea from the design conversation — *"a new
folder is opened for the production sheet and it fills in as you build your cast and
crew, writing their names in."* That idea **is** the one-sheet: a production sheet on
studio letterhead, blank ruled lines where a role is unfilled, names appearing as
they are hired. It is §4's principles 1 and 2, the existing drawers, and the DESK
register at full strength, all at once.

### 8.5 Known risks

- 16–18 slots on one screen is genuinely dense. That is the genre (the Football
  Manager squad screen), not a failure — but it only works if §2.3's legibility
  discipline holds absolutely.
- It will fight the 640px breakpoint. The sheet needs a **stacked** fallback, not a
  scaled-down one.

---

## 9. Cost tiers [DECIDED]

Every visual idea must be classified before it is committed to. The three tiers read
identically in a bullet list and differ by orders of magnitude in cost.

- **Tier 1 — CSS/SVG only, no artist.** Frame chrome, all typography, marquee-bulb
  and neon *text* effects, ledger/newsprint/dot-matrix textures, the production
  sheet, screen transitions, the entire DESK register. **Default to this.**
- **Tier 2 — one to five illustrations (~£150–500 each).** Title-screen key art, a
  small set of reusable backdrops.
- **Tier 3 — many illustrations and/or animation (£2k+).** Rejected unless a specific
  case is made. Includes: animated hands with a clapperboard; a Hollywood Blvd
  vista; an office that visually upgrades across studio tiers (4–6 scenes × several
  tiers ≈ 20–30 pieces); any walk-through corridor.

**Progression should be shown in Tier 1, not Tier 3.** Grander letterhead, a changed
desk nameplate, the trade paper moving your studio above the fold — same feeling,
near-zero cost.

### 9.1 The portrait problem [PROPOSED]

1,487 talent records. Ranked options:

1. **Framing devices instead of faces** — monograms or silhouettes inside an
   era-appropriate frame (trading card, VHS spine, Polaroid, contact sheet, or a
   high-contrast black-and-white agency headshot with a hard border). The frame makes
   the absence read as a deliberate style choice. **Preferred.**
2. Procedural silhouettes derived from each talent's own attributes.
3. Generated portraits — consistency across 1,487 is hard, and licensing and player
   reaction are both live issues.
4. Commissioned illustration — not viable at this count.

---

## 10. Legal constraints [DECIDED]

Hard boundaries. These are not stylistic preferences.

- **The Hollywood Sign** is a registered trademark of the Hollywood Chamber of
  Commerce, actively licensed and enforced. **Do not use**, in game or in marketing.
- **The Walk of Fame star** — the specific star configuration and the name are also
  Chamber trademarks. **Do not reproduce.** A generic brass five-pointed star motif
  is fine; the Walk of Fame star is not.
- **Real people.** `src/data/handcraftedTalents.ts` names ~1,500 real, mostly
  living public figures and assigns them invented personality values — a
  publicity-rights problem for a game that is sold.

  **Resolved structurally rather than by deletion.** The roster a game draws from
  is now selectable (`types/index.ts:TalentDatabase`,
  `data/talentDatabases.ts`). The shipped default generates everybody; the
  real-world roster is one database among others, reachable only by explicit
  choice, flagged `containsRealPeople`, and never used as a fallback. The
  remaining work is quality of the generated roster, not removal of the real one.

  It still constrains portrait and headshot work: do not build art around real
  identities.
- **Fonts.** Desktop and web licences do not cover embedding in a distributed game
  binary. Every face must be licensed for commercial software distribution, in the
  studio's name, in writing. Google Fonts sidesteps this entirely.
- **The title.** "Hollywood Pictures" is a dormant Disney film label. Rename before
  any store page exists.

**Invent our own landmark.** A game with its own iconic mark is worth more than one
borrowing a mark it cannot legally put on its own capsule art.

---

## 11. Non-goals [DECIDED]

Stated as flatly as `SIMULATION_PHILOSOPHY.md` states its own.

- **No studio lot.** No building placement, no purchasing premises, no map.
- **No traversal.** No corridor, hallway or street the player moves along to reach a
  menu item.
- **No film-making minigame.** The player packages and releases films; they never
  direct a shot.
- **No ornament on any data surface.** No gradient, glow, texture or neon behind text
  the player must read.
- **No lens flare, bloom or halation in the DESK register.** Ever.
- **No more than one neon accent per SPECTACLE screen.**
- **No spatial diorama.** This is a database sim; the interface is the game.
- **No colour outside the token layer**, in a stylesheet or a component — not
  even as a `var(--token, #hex)` fallback, which is worse than a bare hex
  because it looks themed and silently is not.
- **No hardcoded corner radius.** `--radius` or `--radius-pill`, nothing else.

The last two are enforced by `src/designSystem.test.ts` rather than by review.
Three of this document's rules had quietly stopped being true before anyone
noticed — see the roadmap's §1.3 — and prose does not survive fourteen screens
of implementation. A rule worth stating is worth a test where one is possible.

---

## 12. Open questions

Answered questions move into the section they belong to rather than lingering
here. Two did on 2026-08-25 (the light/dark question into §5.3, the typeface
pairing into §5), which is why this list is shorter than the decision log.

- **§5.0** Should the badge family go square too, or is the pill a real
  exception? A one-line change to `--radius-pill`; needs looking at, not
  arguing about.
- **§8** Package assembly as one sheet — how far, and what stays sequential?
  Roadmap Phase 2 proposes: all five sections, deep decisions in drawers.
- Does the studio-logo feature need a logo *builder*, given the poster wall makes
  logos highly visible? Cheaper to answer once Phase 4 has rendered the wall.

---

## 13. Decision log

| Date | Decision |
|---|---|
| 2026-08-22 | Era set to the American blockbuster, 1983–1997. |
| 2026-08-22 | Two-register system (DESK / SPECTACLE) adopted as the central device. |
| 2026-08-22 | "Ornament on the frame, plain data inside" adopted as the binding rule. |
| 2026-08-22 | Place-as-backdrop adopted; place-as-navigation rejected. |
| 2026-08-22 | Six structural principles inherited from Hollywood Pictures 2. |
| 2026-08-22 | Cost tiering adopted; Tier 3 rejected by default. |
| 2026-08-22 | Hollywood Sign and Walk of Fame star ruled out on trademark grounds. |
| 2026-08-22 | Assembly/execution split (§8): assembly becomes one sheet, execution stays a chronology. |
| 2026-08-23 | §10's real-people blocker resolved structurally: the roster is selectable, the default generates everybody, and a real-people roster can only be reached by explicit choice. |
| 2026-08-25 | §5 palette moved to DECIDED — shipped and rendered. `src/index.css` is the authority; the tables are the reference derivation that produced it. |
| 2026-08-25 | The accent is rationed to state and never fills a surface; bars take a neutral `--bar`, because a value needs no hue. |
| 2026-08-25 | §5.0: hard corners throughout, with the badge family as the one sanctioned exception. Bars take the surface radius, since the no-hue argument applies to shape. |
| 2026-08-25 | §5.3 closed, and with it §12's light/dark question: DESK is theme-agnostic with both themes first-class; SPECTACLE is dark-only. |
| 2026-08-25 | Typeface pairing settled: Schibsted Grotesk (the game's structure), Anybody (display), Courier Prime (anything the player chose). The last split is load-bearing — typography encodes structure vs. decision. |
| 2026-08-25 | §11's colour and corner rules made mechanical in `src/designSystem.test.ts`, after three stated rules were found to have quietly stopped being true. |
