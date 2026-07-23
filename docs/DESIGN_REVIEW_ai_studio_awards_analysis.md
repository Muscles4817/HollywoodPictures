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

## Finding 1 — AI studios literally cannot hire a VFX Supervisor (confirmed bug — now fixed)

**Rival films that hired a VFX Supervisor: 0 / 11,849 = 0.0%** (before the fix).

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

### Fix (implemented)

Rivals now hire a VFX Supervisor *probabilistically*, driven by the genre's own
`vfxImportance` nudged by scale, rather than forcing one on every film (a talky
Drama shouldn't get a mandatory VFX lead any more than the player's should). In
`engine/rivalStudios.ts:startRivalProductionFromWonScript`, a new
`rivalHiresVfxSupervisor(script, scale, rng)` rolls against
`clamp(vfxImportance + scaleAdjustment, 0, 0.95)` (scale adjustment: Big +0.15,
Small −0.05); when it hits, `'VFX Supervisor'` is appended to the cast list and
the existing loop hires one (gracefully none if the talent pool is dry, since
the role's min is 0).

Post-fix measurement (fresh 12×15 run): **47.2% of rival films now hire a VFX
Supervisor**, weighted by genre — Sci-Fi/Action/Fantasy nearly always, Drama/
Romance rarely. Best Visual Effects is now a genuine contest: a player film at
quality 70 wins it **~2%** of the time (down from 100%), and even a quality-85
film wins it only ~14% — it has to be earned.

Casting Director has the identical structural gap (also optional, never cast by
rivals). It doesn't feed an award, so it's lower-impact; the same pattern would
fix it if desired — **not** applied here.

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

> The Best Visual Effects row here is the **pre-fix** measurement (Finding 1).
> After that fix it drops to a real contest — ~12% nom / ~2% win at quality 70,
> ~38% nom / ~14% win at quality 85. The rest of the table (the quality-cliff)
> is unaffected by the VFX fix and still stands.

Win rate for Best Picture, same tiers: **1% → 45% → 97% → 100% → 100%.**

Total Oscar haul per year, by tier: 60 → 2.7 noms/1.6 wins; **70 → 5.0 noms/3.5
wins**; 75 → 6.2/4.2; 85 → 8.2/6.7.

The cliff sits **right at the AI's own ceiling.** A player film at quality **70**
— barely above the *maximum* (74) the AI reaches with purely random choices, and
well above its p90 of 63 — is a lock for Best Picture (100% nom, 97% win) and
takes home 3–4 Oscars a year *on its own merit alone*, before the two structural
thumbs on the scale:

- **Best VFX was a guaranteed player win** (Finding 1) — free every year; now
  fixed, so this thumb is gone, but the quality-cliff below remains.
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

## Finding 2 (root cause) — the scoring engine can't produce great *or* awful films, no matter who's choosing

The compression in Finding 2 is often assumed to be "the AI makes random
choices." The engine says otherwise. Two facts, both from the code and the
harness:

**(a) Quality is fully deterministic.** `engine/releaseFilm.ts` uses `rng` only
for review *flavor text*; `qualityScore` / `criticScore` / `audienceScore` are
pure functions of the inputs (`engine/scoring.ts`). The same script + director +
cast + budget yields the *identical* film every time — **there is no
execution/luck variance at all.** This is exactly the "if you pick a good
script, director and matching actors there's no real reason your film will fail"
feeling: the front-loaded creative picks fully determine the result.

**(b) The department that varies most has no say; the ones that count are
pinned.** Per-department raw sub-scores across 11.8k rival films:

| department | mean | stdev | p10–p90 | role in `qualityScore` |
|------------|-----:|------:|:-------:|------------------------|
| script     | 69.1 | 9.7  | 55–81 | top-level weight ~0.25 |
| direction  | 66.7 | 11.4 | 52–83 | top-level ~0.25 **+ drives the whole dependency chain** |
| acting     | 74.3 | 6.5  | 65–82 | top-level ~0.25, but pinned high |
| **production** | 58.0 | **13.7** | 37–77 | **no top-level weight — ~0.02 quality/pt** |
| postProd   | 61.0 | 4.0  | 55–68 | top-level ~0.25, but base 55 → nearly constant |
| events     | 50.0 | 0.0  | flat  | display-only; real path folds into Production |

The killer detail: **Production has the widest spread of any department (stdev
13.7) and almost zero influence on the final score.** `computeQualityWeights`
gives Production no top-level weight; it only leaks in through the "captured
footage" ceiling. Working the dependency chain analytically, a *full-range*
swing in Production (≈90 pts) moves `qualityScore` by **~2 points**. On-set
events fold into Production 1:1 and un-amplified, so a catastrophic shoot is
**cosmetic** to quality — despite the game already computing a detailed
production-risk model (`moraleRisk`/`safetyRisk`/`technicalComplexity`/
`budgetRisk`, driven by talent **reliability** and ego, in
`engine/production.ts`). The risk is modelled and then thrown away. (Rivals make
it worse — they skip the day-by-day shoot entirely, so `events` is a flat 50.)

Meanwhile two of the four terms that *do* count are low-variance: `acting` sits
at 74±6 and `postProduction` is `base 55` + a tiny music/edit delta (61±4). So
the final score is a blend of two genuinely-variable terms (script, direction),
one pinned-high term (acting), and one near-constant term (postProduction), with
the one high-variance lever (production/execution) routed around. The result is
mathematically forced to cluster in a narrow mid-band — for the AI *and* the
player.

**Implication for "make the AI considered."** The AI's raw inputs already span a
lot (script 55–81, direction 52–83, production 37–77) — it isn't uniformly
incompetent; it wins good scripts and casts fine actors. Making it choose
deliberately would nudge its *mean* up a few points but cannot widen the
*spread*, because the ceiling and floor are set by the scoring math, not by the
chooser. **To get great and awful films, widen the outcome space first, then the
AI's (and the player's) choices start to matter.** In rough priority:

1. **Reconnect Production and on-set events to `qualityScore` with real weight.**
   It's the highest-variance department and the natural home of execution risk —
   and the risk model already exists. This alone lets a troubled/under-resourced
   shoot sink an otherwise-strong film (downside), which is the missing half of
   realism.
2. **Add a release-time execution-variance term** — a stochastic roll scaled by
   the already-computed production risks and by director **reliability** (today
   generated but never read by scoring). This is what makes "same inputs,
   different film," and lets luck cut both ways.
3. **Un-pin `postProduction` (drop the base-55 floor) and stiffen misalignment
   penalties** (wrong director for the script, under-shooting, cheap production
   in a spectacle genre) so weak choices genuinely score low.
4. **Then give the AI intent** — and give rivals a real (or simulated) shoot so
   their films can go sideways too. With leverage restored, a considered AI
   clusters high while risky/unlucky productions bomb → a realistic spread.

Directors, notably, are *not* the culprit: `direction` is the second-most
variable department and the single highest-leverage one (it drives the whole
chain). The consistency the player feels comes from **(a)** zero execution
variance and **(b)** the front-loaded creative terms being the only things that
reach the score.

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
| 1 | Rivals never hire a VFX Supervisor → player owns Best VFX | **Fixed** | Probabilistic hire by genre `vfxImportance` + scale (`rivalHiresVfxSupervisor`) |
| 2 | AI never exceeds ~65–74 quality → player sweeps awards above ~70 | Confirmed bug, not yet fixed | Balance: give AI creative intent + widen quality variance; reconsider player-only campaign |
| 3 | 83% of AI films profitable, 36% blockbusters | Realism gap, not yet fixed | Balance: tighten outcome thresholds / box-office generosity |

Finding 1 (the airtight structural gap) is fixed in this change. Findings 2 and
3 are **balance/design decisions**, so this review stops at diagnosis +
recommendation for those. The harness is committed so any rebalance can be
re-measured against the same numbers.
