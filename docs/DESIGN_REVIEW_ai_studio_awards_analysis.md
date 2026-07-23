# Design Review — AI Studio Outcomes & Awards Analysis

Empirical analysis of two suspected bugs raised from play:

1. **VFX awards monopoly** — the player is the only studio ever nominated for
   Best Visual Effects.
2. **Awards dominance** — the player gets nominated / wins across the board
   "almost regardless of what else I do."

The analysis is driven by a headless simulation harness,
[`src/engine/aiStudioStats.diagnostic.test.ts`](../src/engine/aiStudioStats.diagnostic.test.ts),
which runs the **real** settlement loop (the same three functions
`state/studioReducer.ts:runCalendarSettlement` calls each day, in the same
order — `settleTheatricalMarket`, `settleOpportunities`, `settleRivalMarket`)
over **12 seeds × 15 in-game years**, captures every rival film the moment its
box-office run finishes, and runs the real 4-show awards season
(`engine/awards.ts:computeCeremony` + `accrueMomentum`) over the resulting
field. It's opt-in and asserts nothing (an analysis harness, not a test):

```bash
AI_STATS_DIAGNOSTIC=1 npx vitest run src/engine/aiStudioStats.diagnostic.test.ts --disable-console-intercept
```

Sample size for the run reported below: **11,849 finished rival films**.

---

## Finding 1 — AI studios literally cannot hire a VFX Supervisor (confirmed bug)

**Rival films that hired a VFX Supervisor: 0 / 11,849 = 0.0%.**

This is a hard structural fact, not a probability. In
`engine/rivalStudios.ts:startRivalProductionFromWonScript`, a rival only casts
the roles in `MANDATORY_TALENT_ROLES`:

```ts
for (const role of MANDATORY_TALENT_ROLES) { … }
```

and `data/talentGeneration.ts` defines:

```ts
export const MANDATORY_TALENT_ROLES = ['Director','Lead Actor','Supporting Actor','Writer','Cinematographer','Composer','Editor'];
export const OPTIONAL_TALENT_ROLES  = ['VFX Supervisor','Casting Director'];
```

Because `VFX Supervisor` is optional, the rival loop never even considers it —
**no rival film ever has one.** The awards engine
(`engine/awards.ts:contendersForCategory`) builds Best Visual Effects via:

```ts
case 'best-visual-effects':
  return craftContenders(input, 'VFX Supervisor', (r) => r.productionScore);
```

and `craftContenders` drops any film without a person in that role. So the
Best-VFX contender pool contains **only** player films. The player is nominated
100% and wins 100%, every year, at every quality tier tested — confirmed in the
awards table below (Best Visual Effects reads `100.0%` across the board).

### Recommended fix

Let rivals hire a VFX Supervisor *probabilistically*, driven by the genre's own
`vfxImportance` (and scale), rather than forcing one on every film (a talky
Drama shouldn't get a mandatory VFX lead any more than the player's should).
Concretely, in `startRivalProductionFromWonScript`, iterate a per-production
role list that appends `'VFX Supervisor'` when e.g.
`rng() < GENRE_PROFILES[script.genre].vfxImportance` (optionally gated up for
`Big` scale). Casting Director has the identical gap and can be handled the same
way if desired. This is a small, contained change but it's a **balance
decision** (how often, weighted how), so it's flagged rather than applied.

---

## Finding 2 — The AI never makes an awards-caliber film, so the player faces no competition (confirmed bug)

### Score distributions (0–100)

| metric   | mean | p10 | p25 | median | p75 | p90 | max |
|----------|-----:|----:|----:|-------:|----:|----:|----:|
| quality  | 56.5 | 50  | 53  | 57     | 60  | 63  | 74  |
| critic   | 58.8 | 50  | 55  | 59     | 63  | 67  | ~70 |
| audience | 64.8 | 56  | 61  | 66     | 70  | 72  | —   |

- **Quality ≥ 70: 0.4%.  Quality ≥ 80: 0.0%.**
- **Critic ≥ 70: 3.0%.  Critic ≥ 80: 0.0%.**

The AI field is extremely **compressed**: essentially everything an AI studio
ships lands between ~50 and ~65, and *nothing* reaches the acclaim tier. The
mean (~57 quality / ~59 critic) is individually plausible, but the **variance is
far too low** — there are no masterpieces and no disasters. This is because the
AI makes its film-shaping choices **at random**, never in service of quality:
post-production (`editStyle`, `musicFocus`, `finalCutFocus`) is
`pick(rng, …)`; release type is `pick(rng, …)`; the spend plan is one ambition
roll plus jitter (`engine/rivalStudios.ts`). It never *aims* for a good film, so
it regresses to a mediocre mean.

### Why this causes the awards complaint

We injected a synthetic player film at a sweep of absolute quality tiers into
each year's real AI field (5 nominees/category, ~66 AI films/year, standard
player-only campaign boost ≈5 pts) and measured its Oscar haul. The nomination
rate for a player film, by its own quality score:

| category                | 60 | 65 | 70 | 75 | 85 |
|-------------------------|---:|---:|---:|---:|---:|
| Best Picture            | 26% | 93% | **100%** | 100% | 100% |
| Best Director           | 0% | 3% | 12% | 67% | 100% |
| Best Screenplay         | 0% | 1% | 7% | 19% | 52% |
| Best Actor              | 30% | 41% | 54% | 61% | 75% |
| Best Actress            | 17% | 23% | 27% | 31% | 34% |
| Best Supporting Actor   | 35% | 44% | 57% | 64% | 73% |
| Best Supporting Actress | 23% | 27% | 33% | 38% | 51% |
| Best Cinematography     | 2% | 5% | 15% | 22% | 57% |
| Best Film Editing       | 18% | 33% | 47% | 60% | 84% |
| Best Original Score     | 22% | 37% | 49% | 62% | 88% |
| Best Visual Effects     | **100%** | 100% | 100% | 100% | 100% |

Win rate for Best Picture, same tiers: **1% → 45% → 97% → 100% → 100%.**

Total Oscar haul per year, by tier: 60 → 2.7 noms/1.6 wins; **70 → 5.0 noms/3.5
wins**; 75 → 6.2/4.2; 85 → 8.2/6.7.

The cliff sits **right at the AI's own ceiling.** A player film at quality **70**
— barely above the *maximum* (74) the AI reaches with purely random choices, and
well above its p90 of 63 — is a lock for Best Picture (100% nom, 97% win) and
takes home 3–4 Oscars a year *on its own merit alone*, before the two structural
thumbs on the scale:

- **Best VFX is a guaranteed player win** (Finding 1) — free every year.
- **Only the player gets a campaign boost** — `campaignByFilm` is player-only
  ("Rival films campaign nothing in MVP"), worth up to +8 award-score points on
  a field where the whole AI spread is ~13 points p10–p90. In a race that
  tight, the campaign alone reorders it.

So the complaint is real and well-founded: once the player clears ~65–70
quality — trivial to do deliberately, since the AI reaches 74 *by accident* —
they win almost regardless of the specifics, because **nothing is pushing back
at the top of the field.** The fix is to make the AI capable of occasionally
making a genuinely good (and genuinely bad) film, widening the top of the field
so the player has to earn it. Options, in rough order of impact:

1. **Give AI post-production/marketing some intent.** Bias the random
   `pick(rng, …)` choices toward ones that fit the script/genre (even weakly),
   so a well-matched AI film can climb. This is the single biggest lever on the
   compression.
2. **Widen AI spend/quality variance** so a fraction of AI films genuinely
   reach the acclaim tier (and a fraction bomb) — restoring real top-end
   competition and a believable Oscar race.
3. **Consider letting rivals mount awards campaigns** (or remove/​shrink the
   player-only boost), so the campaign isn't a structural player-only edge.

These are all balance changes, so they're recommended, not applied.

---

## Finding 3 — AI films are far too profitable vs. real life

The user asked specifically: how often are AI films profitable, and how do the
scores compare to reality.

### Profitability & commercial outcomes

- **Profitable (studioRevenue > totalCost): 9,884 / 11,849 = 83.4%.**
- Outcome distribution:

  | outcome | share |
  |---------|------:|
  | Hit | 37.6% |
  | Blockbuster | 34.7% |
  | Weak | 11.5% |
  | Modest Success | 7.9% |
  | Flop | 6.8% |
  | Phenomenon | 1.4% |
  | Cult Hit | 0.1% |

**~36% of AI films are Blockbuster-or-better**, and only ~18% (Weak + Flop) lose
or barely make money.

### Comparison to real life

| metric | game (AI studios) | real world (theatrical) |
|--------|------------------:|-------------------------|
| films profitable | **83%** | Rule of thumb: a *minority* break even on theatrical alone — commonly cited as ~2 in 10; studios live on a few hits carrying the slate. |
| "blockbuster or better" | **36%** | Low single digits — a genuine blockbuster is rare by definition. |
| avg critic score | **59** (σ tiny; range ~50–70) | Metacritic average is ~55–60, so the *mean is realistic*, but real scores span ~15–95; the game has **no acclaimed and no panned films**. |
| avg quality / audience | 57 / 65 | plausible means, again far too little spread |

So the economy is **too forgiving**: making a film is nearly a guaranteed
profit, and a third of all films are blockbusters. In reality most releases lose
money theatrically and hits are the exception. Two caveats on the profit figure:
rivals are frozen at **full international reach**
(`internationalReachForRivalStudio`) and start cash-rich, both of which flatter
their margins relative to an early-game player; but the box-office model itself
(`engine/boxOfficeRun.ts`, `engine/outcome.ts`) is shared with the player, so
the generosity is systemic, not rival-specific.

The critic/quality **means** are fine — it's the **lack of spread** (Finding 2)
and the **over-generous commercial outcomes** (this finding) that diverge from
reality. Tightening the outcome thresholds / box-office curve so that flops are
common and blockbusters rare would bring the commercial side in line, and
widening AI quality variance would bring the critical side in line.

---

## Summary

| # | Finding | Status | Fix type |
|---|---------|--------|----------|
| 1 | Rivals never hire a VFX Supervisor → player owns Best VFX | Confirmed bug | Small code change (probabilistic hire by genre `vfxImportance`) — balance-flagged |
| 2 | AI never exceeds ~65–74 quality → player sweeps awards above ~70 | Confirmed bug | Balance: give AI creative intent + widen quality variance; reconsider player-only campaign |
| 3 | 83% of AI films profitable, 36% blockbusters | Realism gap | Balance: tighten outcome thresholds / box-office generosity |

All three are **balance/design decisions** beyond the airtight VFX structural
gap, so this review stops at diagnosis + recommendation. The harness is
committed so any rebalance can be re-measured against the same numbers.
