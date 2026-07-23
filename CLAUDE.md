# Hollywood Pictures — working guidance for Claude

A browser-based film-studio management game (React + TypeScript, Vite, Vitest).
Pure simulation logic lives in `src/engine/`, tunable data in `src/data/`,
state/reducer in `src/state/`, UI in `src/components/`. See `README.md` and
`docs/DESIGN.md` for the full picture, and `docs/SIMULATION_PHILOSOPHY.md` for
the design principles the simulation is being grown toward.

## Product stage: PRE-LAUNCH — save compatibility is out of scope

This game is **pre-launch**. There is a single playtester who restarts for each
test run. **Backward compatibility with old local saves is not a product
requirement at this stage.**

> **Policy:** Until the game enters a launched or persistent-playtest phase,
> save compatibility and migrations are **out of scope unless explicitly
> requested**. Bump or reset the save version freely and target the current
> schema. A clean reset is acceptable.

Concretely, for any schema change:

- **Do** bump the save version/key (`SAVE_KEY` in `src/state/persistence.ts`) as
  the honest "the stored shape changed" signal.
- **Do not** write migration code for obsolete pre-launch saves.
- **Do not** spend implementation or review time preserving or auditing old
  saves (e.g. "does a v50 save load into v51?" — it doesn't need to).
- **Do not** raise save compatibility as a concern in completion reports unless
  there is a genuinely unusual architectural reason.
- Tests and fixtures target the **current** schema only.

This policy is deliberately recorded here so it does not need to be
re-litigated each session.

## Everyday commands

```bash
npm test          # vitest run (full suite)
npm run build     # tsc -b && vite build
npm run lint      # oxlint
```

Opt-in analysis harnesses (skipped in the normal suite):

```bash
AI_STATS_DIAGNOSTIC=1  npx vitest run src/engine/aiStudioStats.diagnostic.test.ts --disable-console-intercept
PROD_EXEC_DIAGNOSTIC=1 npx vitest run src/engine/productionExecution.diagnostic.test.ts --disable-console-intercept
RIVAL_DIAGNOSTIC=1     npx vitest run src/engine/rivalStudios.diagnostic.test.ts
```

## Conventions worth keeping

- `engine/` functions are pure (plain data in, plain data out) — no React, no
  hidden state. Keep them that way; it's what makes the sim testable and
  rebalanceable from `data/`.
- Rebalance by editing `data/` and the tunable constants at the top of the
  relevant engine module, not by threading magic numbers through logic.
- Player-facing presentation is qualitative (stars, prose, named causes), never
  raw internal stat values. Dev inspectors and tests may read raw numbers.
