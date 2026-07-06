# Hollywood Pictures

A browser-based film studio management game, inspired by *Hollywood Pictures 2* /
*The Movies*. Run a small studio, greenlight a film, hire talent, make production
and marketing decisions, then see it live or die at the box office.

This is a **playable MVP**: one film at a time, start to finish, with a
deterministic-ish simulation underneath. See [`docs/DESIGN.md`](docs/DESIGN.md)
for the full design brief and how the simulation actually works.

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

Studio Dashboard → Develop Film → Hire Talent → Production Planning →
Filming → Post-Production → Marketing & Release → Results → back to
Dashboard, repeat.

You start with £5,000,000 cash and 20/100 reputation. Every choice you make -
script, cast, budget tier, edit style, release window - feeds a scoring
engine that produces critic/audience/buzz scores, a box office result, and a
reputation swing, all shown on the results screen before you move on to the
next film.

## Project layout

```
src/
  types/       Domain types shared across the whole app (Studio, Film, Talent, Script, ...)
  data/        Tunable game data - genres, talent roster, scripts, events, cost tables, scoring weights
  engine/      Pure functions: scoring, box office, production risk, outcome, reputation
  state/       Reducer + Context that drives the wizard, plus localStorage persistence
  components/  React components - Dashboard and one screen per wizard step
```

The `engine/` functions take plain data in and return plain data out - no
React, no state, nothing hidden. That's deliberate: it makes the simulation
easy to test, easy to reason about, and easy to rebalance by editing `data/`
without touching logic. See the design doc for why it's laid out this way and
what to touch when extending it (new genres, franchises, rival studios,
awards, streaming platforms, etc.).

## Status

Working MVP, playtested end-to-end (script → release → dashboard, across
multiple films). Visual design is intentionally minimal - clean cards and
buttons over any kind of styling investment. See `docs/DESIGN.md` for known
rough edges and natural next steps.
