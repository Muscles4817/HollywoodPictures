# Hollywood Pictures

A browser-based film studio management game, inspired by *Hollywood Pictures 2* /
*The Movies*. Run a studio against a field of AI rivals: buy or commission
scripts, package and cast them, shoot, cut, market and release a slate of films
in parallel, then watch each one live or die in a simulated theatrical market.

The game is **pre-launch** and in active development: the full studio loop is
playable end-to-end, with a deterministic-ish simulation underneath. See
[`docs/DESIGN.md`](docs/DESIGN.md) for the design brief and how the simulation
actually works, [`docs/SIMULATION_PHILOSOPHY.md`](docs/SIMULATION_PHILOSOPHY.md)
for the principles it is being grown toward, and
[`docs/domain/`](docs/domain/README.md) for a reference library on how the real
film industry works, which the simulation is checked against.

## Running it

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`). No backend,
no login - state autosaves to `localStorage` as you play, so you can close the
tab and pick up where you left off.

```bash
npm run build   # type-check + production build
npm run lint    # oxlint
```

## The loop

Time runs on a calendar that ticks in the background. From the Studio Dashboard
you run several projects at once, each moving through its own pipeline:

Opportunity Market or Development (buy, commission or rewrite a script) →
package and greenlight → Cast & Crew → pre-production → principal photography →
post-production and a test screening → Marketing & Release (date, distribution,
campaign) → a week-by-week theatrical run → ancillary revenue and awards season.

Nineteen AI rival studios compete for the same scripts, talent, release dates
and audiences. Anything that resolves while you're looking elsewhere lands in
the Inbox. Starting cash depends on the difficulty you pick; Brand and Prestige
both start at 20/100 and move with how your films land, commercially and
critically.

## Project layout

```
src/
  types/       Domain types shared across the whole app (Studio, Film, Talent, Script, ...)
  data/        Tunable game data - genres, talent roster, scripts, events, cost tables, scoring weights
  engine/      Pure functions: scoring, box office, production risk, outcome, reputation
  state/       Reducer + Context that drives the wizard, plus localStorage persistence
  components/  React components - Dashboard, the project workspace, the per-stage screens, Inbox
  audio/       Synthesized sound - the Web Audio engine, effects, and the music loops as data
  settings/    Player preferences (sound, music, theme) - stored apart from the studio save
```

The `engine/` functions take plain data in and return plain data out - no
React, no state, nothing hidden. That's deliberate: it makes the simulation
easy to test, easy to reason about, and easy to rebalance by editing `data/`
without touching logic. See the design doc for why it's laid out this way and
what to touch when extending it.

## Status

Pre-launch: playtested end-to-end by a single playtester who restarts for each
run, so save compatibility is deliberately out of scope (see `CLAUDE.md`). The
box-office model is still being calibrated: the `BOX_OFFICE_DIAGNOSTIC` gates
listed in `CLAUDE.md` encode the targets and are expected to fail until that
work lands. Section 8 of `docs/DESIGN.md` lists what is known to be missing.
