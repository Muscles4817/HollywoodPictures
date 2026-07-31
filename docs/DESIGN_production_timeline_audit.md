# Production Timeline Audit & Recalibration

**Status:** Recalibration landed (see "What changed" below).
**Scope:** How much *in-game calendar time* it takes to make a film — per stage,
across the particulars that should drive it (runtime, cast size, filming
complexity, scale, effects ambition, setting). This document is both the audit
of the pre-recalibration model and the record of the recalibration that
replaced it.

Everything here is expressed in **in-game days**. The clock is a single day
counter (`engine/calendar.ts`), 365 days/year, ~30 days/month. Convert: **30d ≈
1 month, 365d ≈ 1 year.**

---

## 1. How a film consumes calendar time

The **mandatory critical path** to make one film is three phases, each a real
stretch of the game clock:

| Phase | Length source | How the clock consumes it |
|---|---|---|
| Pre-production | `computeRecommendedPreProductionDays` | day-by-day (`ADVANCE_PREPRODUCTION_DAY`) |
| Principal photography | `computeRecommendedShootDays` | day-by-day (`ADVANCE_SHOOTING_DAY`), player may wrap at 0.6× / auto-wraps at 2.5× |
| Post-production | `computeRecommendedPostProductionDays` | passive wait to `postProductionScreeningReadyDay` |

Everything else is **off the critical path** and adds no mandatory time:

- **Development** is optional — buying a market script is instant; commissioning
  an original is 42–56 days, a rewrite 24–36, a polish 10–16, but these run in
  the background (`engine/commission.ts`, `engine/rewrite.ts`).
- **Casting** costs no direct days (a booked star can defer the *shoot start*,
  and Open Casting trickles applicants weekly, but neither is inherent film
  time).
- **Marketing / press tour / release** enforce **no lead time** — a film can be
  scheduled for release the same day post finishes (`studioReducer.ts`
  `SCHEDULE_RELEASE`). An 8-week marketing rollout is a *soft* momentum
  incentive only.
- **Test-screening reshoots** are optional and additive on top of post: re-edit
  +3–8, pickups +10–20, major reshoots +25–45 days per round, repeatable
  (`engine/testScreening.ts`).

So the headline "how long to make a movie" number is **pre + shoot + post**.

---

## 2. The problem (pre-recalibration model)

### Per-stage bounds (old constants)

| Stage | Formula | Min | Typical | Max |
|---|---|---:|---:|---:|
| Pre-production | 14 + scale(0–18) + cast(0–10) + effects(0–14) | 14 | ~28 | 56 |
| Photography | 18 + complexity(0–35) + cast(0–12) + runtime(0–12) + effects(0–15) + setting(0–10) | 18 | ~50 | ~89 |
| Post-production | editorial(14–49) + VFX(0–46, **linear**) | 14 | ~38 | ~95 |

### Two structural failures

1. **The whole field collapsed into a narrow band.** Realistic builds ran
   ~2.6 months (indie) to ~6.4 months (tentpole) — barely a 2.5× spread. Most
   non-tentpole genres clustered in a **3–4 month wall**, which is exactly the
   "nothing goes past 4 months" feel the audit was opened to investigate.

2. **Nothing reflected the film's particulars strongly, and the biggest real
   time sink was capped.** VFX post — the term that in reality takes effects
   tentpoles *1–2 years* — was linear and capped at ~46 days (~1.5 months). A
   contained drama and an effects-led sci-fi epic of the same complexity/scale
   finished within weeks of each other. Genre never entered any duration
   formula directly; it only mattered via complexity/scale/setting/spend
   proxies, and those were too weak to separate anything.

Real-world reference the model was missing: standard studio films run
~1.5–2 years concept-to-release; VFX tentpoles 3–5 years, dominated by post.
Even the old *ceiling* (~8 months) sat far below that.

---

## 3. The recalibration

**Design goal:** the schedule should be *built out of the specific film* —
runtime, cast size, filming complexity, scale, effects ambition and setting all
push it materially — so a small contained film finishes in a few months while a
large, effects-heavy epic runs well over a year, with **post carrying most of
the tentpole length** (mirroring where real VFX calendars actually go, and
keeping the day-by-day phases from becoming a clicking chore).

### New per-stage model

**Pre-production** (`computeRecommendedPreProductionDays`) — now also reads the
setting's build/scout pressure and period flag, which were previously ignored:

```
21 (base)
 + scale         {Intimate 0, Medium 16, Epic 32}
 + cast          (n−6)·2.5, capped 16
 + effects        ((practicalT + vfxT)/2)·28
 + setting        (setConstructionDemand·0.6 + locationComplexity·0.4)·18   ← new
 + period         +10 if the setting is a period piece                       ← new
```
Range ≈ **21 → ~125 days** (3 weeks → ~4 months).

**Principal photography** (`computeRecommendedShootDays`) — same structure, every
particular weighted harder:

```
20 (base)
 + complexity    (complexity/100)·34
 + cast          (n−6)·2, capped 18
 + runtime        runtimeIntensity·22
 + effects        (practicalT + vfxT)·11
 + setting        (travelDemand·0.6 + locationComplexity·0.4)·16
```
Range ≈ **20 → ~130 days** (3 weeks → ~4.3 months). Player may still wrap early
(0.6×) or overrun (auto-wrap 2.5×).

**Post-production** (`computeRecommendedPostProductionDays`) — the primary lever.
Editorial now also reads complexity; VFX is **super-linear** (raised to an
exponent) with a much larger ceiling, so light-VFX films are untouched and
effects-led films balloon:

```
editorial = (30 + runtimeIntensity·45 + (complexity/100)·22) · editorSkillMult(0.7–1.3)
vfx       = vfxT^2 · 340 · vfxSupervisorMult(0.7–1.3, or 1.15 if none hired)
```
Range ≈ **~21 → ~570 days** (3 weeks → ~19 months). A near-zero-VFX drama gets
~0 VFX days; a fully effects-driven tentpole with a weak/absent VFX Supervisor
gets a year-plus of post alone.

### Resulting timelines (representative "sensible" builds)

| Film | Old total | Old | New total | New | New pre / shoot / post |
|---|---:|---:|---:|---:|---|
| Micro indie drama | 80d | 2.6mo | 122d | **4.0mo** | 28 / 42 / 52 |
| Studio drama | 99d | 3.3mo | 162d | **5.3mo** | 35 / 53 / 74 |
| Comedy | 106d | 3.5mo | 169d | **5.6mo** | 51 / 54 / 64 |
| Horror (low-budget) | 104d | 3.4mo | 181d | **6.0mo** | 38 / 55 / 88 |
| Thriller (mid) | 122d | 4.0mo | 222d | **7.3mo** | 56 / 64 / 102 |
| Period drama | 128d | 4.2mo | 240d | **7.9mo** | 73 / 67 / 100 |
| Action tentpole | 188d | 6.2mo | 478d | **15.7mo** | 97 / 100 / 281 |
| Sci-Fi tentpole | 183d | 6.0mo | 503d | **16.5mo** | 91 / 93 / 319 |
| Fantasy epic (period) | 194d | 6.4mo | 510d | **16.8mo** | 110 / 104 / 296 |

Spread widened from **2.5× to ~4.2×**, and — crucially — the spread is now
*caused by the film*: complexity, runtime, cast size, scale, effects ambition,
setting build/travel demand and period status each move the number, and post
dominates precisely for the films where it should.

> These are genre-*representative* builds, not genre-*forced* ones. Genre still
> enters only through the particulars a genre tends to imply (a Spectacle
> script's high complexity, an Epic scale, a VFX-hungry setting, heavy effects
> spend). Two films with identical particulars take identical time regardless of
> genre label — which is the correct behaviour: it's the effects epic that takes
> years, not the word "Sci-Fi".

---

## 4. What changed in code

- `src/engine/production.ts` — recalibrated all three duration functions and
  their tunable constants; added the setting-build + period terms to
  pre-production, the complexity term to post-production editorial, and the
  super-linear VFX exponent (`VFX_POST_EXPONENT`) with a larger `MAX_VFX_DAYS`.
  `computeRecommendedPostProductionDays` now takes the `script` (for complexity).
  Stale docstrings corrected (pre-production is day-by-day, not a Greenlight lump
  sum; post bounds updated).
- `src/state/studioReducer.ts`, `src/engine/rivalStudios.ts` — pass `script` to
  the post-production call.
- Tests updated for the new signature and bounds
  (`production.test.ts`, `rivalStudios.test.ts`, `studioReducer.test.ts`);
  full suite green.

All constants live at the top of `production.ts` and remain first-draft and
tunable — rebalance by editing them, not the logic.

---

## 5. Playability note

Pre-production and photography are advanced **day-by-day** by the player, so a
big tentpole now implies ~200 clicks through those phases before its (passive)
post wait. That is deliberate — the recalibration pushes the dramatic length
into **post-production, which is a passive wait**, and keeps the clicked phases
capped near ~4 months each. If the day-by-day phases start to feel like a chore
at the top end, the right follow-up is a UI "advance N days / skip to end of
phase" control, not shrinking the timeline model back down. That is out of scope
here and left as a follow-up.

## 6. Not done / follow-ups

- No development-hell / financing gestation on the critical path (still instant
  to buy a script). Modeling long, uncertain development would be the next step
  toward true multi-year timelines but is a larger feature, not a constant tweak.
- No "advance multiple days" control for the day-by-day phases (see §5).
- Cost model is unaffected: daily shoot burn is `shootingBudget / recommendedDays`,
  so total shoot spend is invariant to these length changes.
