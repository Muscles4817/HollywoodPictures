# Design Review: Awards Season — Giving Prestige a Payoff

Status: **Proposed** (design locked, unbuilt). The flagship **Academy Awards**
ceremony, run once a year over the films released that year — the first
mechanic that actually *reads* the Prestige stat the studio has tracked all
along. Precursor ceremonies (Globes, BAFTA, guilds) are deferred to a later
pass; this brief is the one big night.

---

## TL;DR

- **Prestige finally does something.** `Studio.prestige` (and every rival's)
  has grown from critical reception since the reputation redesign, but nothing
  consumes it (`docs/DESIGN.md` §8, 5.39 flag awards as its natural first
  reader). Awards make accumulated Prestige matter and give critically-loved
  films a payoff beyond the box office.
- **Rivals are free competition.** Every rival film is already a full `Film`
  with the same `results` (critic score, sub-scores, cast), sitting in
  `GameState.projects` tagged by `releasedBy`. Awards pit your films against
  theirs with no new competitor modelling — the same "everyone's a Film" design
  that let the box-office market unify.
- **Categories map onto what the sim already scores.** Best Picture reads
  `qualityScore`/`criticScore`; Director → `directionScore`; Screenplay →
  `scriptScore`; the craft categories → `productionScore`/`postProductionScore`
  blended with the individual crew member's `skill`; acting → each performer's
  own compatibility + the film's quality. Nothing new needs to be computed at
  release; awards are a *reading* of existing results.
- **Deterministic + light jitter.** Best merit usually wins; a small rolled
  jitter allows the occasional upset, so it feels like awards rather than a
  leaderboard.
- **A basic campaign gives real agency.** Cash spent during the season lifts a
  film's award scores (diminishing returns, capped) — money sways a contender
  but can't buy a bad film a statuette. Structured so per-category / per-talent
  "For Your Consideration" targeting drops in later.
- **Timing mirrors real life.** Films from year N compete at a ceremony early
  in year N+1, with a campaign window in between — which also cleanly solves
  "when is the eligible field known" (the whole prior year is complete).

---

## 1. What it is

Once a year, the **Academy Awards** honour the films released in the year just
ended. Play runs: the calendar crosses into a new year → **awards season
opens** (all of last year's films are now eligible and known) → the player gets
a **campaign window** to spend on their contenders → the **ceremony** resolves
~45 days later, naming nominees and winners across 11 categories. Wins bump
studio **Prestige** and **Brand**, deliver a **box-office awards bump**, and are
recorded permanently in the studio's history.

Real names are used deliberately — the game already uses real film titles and
real talent names, so "the Academy Awards / Oscars" reads consistently.

### Design priorities (inherited from `docs/DESIGN.md` §1)

A complete, satisfying yearly beat > clean, extensible architecture > visual
polish. This should be new `data/` + `engine/` + state + one campaign screen
and one results view; it must not touch the film-making wizard.

---

## 2. Eligibility & timing

The calendar is a single running `totalDays` with `DAYS_PER_YEAR = 365`
(`engine/calendar.ts`); year = `floor((totalDays-1)/365)+1`.

- A film is **eligible** for year N's awards if its `releasedOnDay` falls in
  year N and it is a released `Film` with `results` — **player and rival films
  alike** (`playerReleasedFilms` / `rivalReleasedFilms`, `engine/project.ts`).
- **Season opens** at each year boundary (the day year increments): the just-
  completed year's field is now fully known. An Inbox beat fires; the campaign
  window opens.
- **Ceremony resolves** `CEREMONY_DELAY_DAYS` (≈45) into the new year — matching
  real life (year-N films, ceremony early year N+1) and giving the campaign
  window somewhere to live.
- Driven by the existing per-timer settlement pattern (`nextOpportunityCheckDay`
  / `RivalStudio.nextSpawnCheckDay`): a `nextAwardsSeasonDay` opens the season,
  and the open season's own `ceremonyDay` resolves it — both checked in the
  calendar settlement the reducer already runs on every calendar-advancing
  action.

Year 1 has no prior year, so the first ceremony is early in year 2 over year-1
films. A thin field early on is fine (small studios, few films) and self-
corrects as the world fills in.

---

## 3. Categories (11)

Gender-split acting, mapped onto every role the sim tracks:

| Picture & craft | Performance (gender-split) |
|---|---|
| **Best Picture** | **Best Actor** (lead) |
| **Best Director** | **Best Actress** (lead) |
| **Best Screenplay** | **Best Supporting Actor** |
| **Best Cinematography** | **Best Supporting Actress** |
| **Best Film Editing** | |
| **Best Original Score** | |
| **Best Visual Effects** | |

- **Screenplay** stays single for MVP; Original vs Adapted is an easy later
  split (`Script.storyType` already distinguishes them).
- **Best Visual Effects** only considers films that actually hired a VFX
  Supervisor (an optional role) — a film with no VFX simply isn't in that race.
- **Casting Director** has no category (no real analogue until recently); it's
  a crew role, not an awarded one.

### 3.1 Gender split & non-binary handling

Acting categories bucket eligible performers by the performer's
`identity.gender` (now first-class after the casting-gender work): `Male` →
Actor, `Female` → Actress. A **non-binary or unknown-gender** performer is
**eligible for both** Actor and Actress but can be **nominated only once** — in
whichever field their award score would place them highest. This avoids both
excluding them and letting one person occupy two nomination slots.

---

## 4. Award scoring (`engine/awards.ts`, pure)

Each category computes a per-contender **award score**, then takes the top 5 as
**nominees** and the highest as the **winner**. Deterministic given the same
seed, with a small jitter term for upsets.

```
awardScore = meritTerm + prestigeNudge + campaignBoost + jitter
```

- **meritTerm** — the category's own quality reading (0–100 scale), the
  dominant factor:

  | Category | meritTerm |
  |---|---|
  | Best Picture | `qualityScore·0.6 + criticScore·0.4` |
  | Best Director | `directionScore·0.7 + qualityScore·0.3` |
  | Best Screenplay | `scriptScore·0.7 + script.originality·0.3` |
  | Best Actor/Actress (lead) | this performer's own script compatibility · 0.7 + `qualityScore` · 0.3 |
  | Best Supporting Actor/Actress | as lead, from the supporting pool |
  | Best Cinematography | `productionScore·0.6 + cinematographer.skill·0.4` |
  | Best Visual Effects | `productionScore·0.6 + vfxSupervisor.skill·0.4` |
  | Best Film Editing | `postProductionScore·0.6 + editor.skill·0.4` |
  | Best Original Score | `postProductionScore·0.6 + composer.skill·0.4` |

  The craft categories share film-level sub-scores but are differentiated by
  the **individual crew member's `skill`**, so two films with equal
  `productionScore` still separate on their DP vs their VFX lead. Acting is
  scored **per performer** (each performer's own compatibility with the script,
  the same `engine/compatibility.ts` reading the game already uses), lifted a
  little by the film's overall quality — a great film flatters its cast.

- **prestigeNudge** — a *small* bias from the film's studio Prestige (a
  respected house gets a sliver of benefit of the doubt). Deliberately minor so
  awards stay merit-driven, not rich-get-richer; capped at a few points.

- **campaignBoost** — see §5.

- **jitter** — a small rolled term (Mulberry32 via the state `rngSeed`, the
  same reproducible-randomness discipline the rest of the reducer uses),
  bounded so it reorders near-ties and springs the occasional upset without
  ever floating a weak film over a clearly stronger one.

Nominees = top 5 by award score in a category (fewer if the field is smaller).
Winner = the top nominee. A film/person can be nominated in every category they
qualify for.

---

## 5. Campaign (basic, extensible)

During the campaign window the player allocates cash to their eligible films to
improve their odds — the studio game's version of a "For Your Consideration"
push.

- **Shape (MVP):** one campaign budget **per film**, applied across all
  categories that film competes in. Cash is deducted immediately on allocation
  (a studio-level spend, like acquiring IP).
- **Effect:** `campaignBoost = CAMPAIGN_MAX · (1 - e^(-spend / CAMPAIGN_SCALE))`
  — a smooth diminishing-returns curve capped at `CAMPAIGN_MAX` award-score
  points. Real money helps a genuine contender clear a close race; it can't
  manufacture a nomination from nothing (the merit term dominates the ceiling).
- **Only the player campaigns** in MVP. Rivals compete on merit alone (a
  rival-campaign AI is a natural later addition).
- **Extensible:** the per-film budget is the coarse version of what later
  becomes per-category and per-talent FYC targeting — the data model stores a
  `Record<categoryOrTalent, spend>` shape from the start, MVP just fills the
  film-wide bucket.

---

## 6. Payoff

Applied when the ceremony resolves:

- **Prestige** (the headline reward): each **nomination** adds a little, each
  **win** adds more, weighted by category (Best Picture > the majors > craft).
  Via `applyStatChange` on `Studio.prestige`, same clamp/curve the reputation
  engine already uses.
- **Brand** (smaller): wins add Brand — "Academy Award winner" is commercial
  cachet, not just critical respect — so a big awards night nudges future Buzz.
- **Box-office awards bump:** nominated/winning films receive a one-time
  revenue credit (the studio's share, per the existing split), scaled by their
  award haul and their original gross — the real "Oscar bump." MVP credits it
  once at the ceremony rather than re-opening a theatrical run; extending it to
  a genuine re-release/legs lift is a later refinement.
- **Rivals** get the Prestige/Brand side of this too (they track both stats),
  so a rival sweeping the Oscars visibly strengthens them — consistent with how
  `settleTheatricalMarket` already credits rival outcomes.
- **Talent fame** is deliberately **out of MVP** (deferred; an easy later add
  once the ceremony exists).

Every ceremony is written to a permanent **`AwardsCeremony`** record (year,
per-category nominees + winner) in studio history, so the trophy shelf is real
and displayable.

---

## 7. State & data model

```ts
// engine/awards.ts / types
export type AwardCategory =
  | 'best-picture' | 'best-director' | 'best-screenplay'
  | 'best-actor' | 'best-actress' | 'best-supporting-actor' | 'best-supporting-actress'
  | 'best-cinematography' | 'best-film-editing' | 'best-original-score' | 'best-visual-effects';

export interface AwardNomination {
  filmId: string;
  personId?: string;   // set for person categories (director, acting, crafts)
  awardScore: number;  // for display/ordering; the resolved number
  won: boolean;
}

export interface AwardsCeremony {
  year: number;                                  // the year honoured
  ceremonyDay: number;                           // totalDays it resolved on
  categories: Record<AwardCategory, AwardNomination[]>;
}

// A season between open and resolution - the campaign phase.
export interface AwardsSeasonInProgress {
  year: number;
  eligibleFilmIds: string[];
  ceremonyDay: number;
  campaignByFilm: Record<string, number>;        // filmId -> cash committed (extensible shape)
}
```

On `GameState` (all optional / defaulted, read defensively — no migration pass,
per `state/persistence.ts`):

```ts
awardsHistory?: AwardsCeremony[];            // resolved ceremonies, newest last
awardsSeason?: AwardsSeasonInProgress | null; // the open season, or null
nextAwardsSeasonDay?: number;                // next year boundary to open on
```

Tunables live in `data/awards.ts`: category weights, prestige/brand payouts per
nomination/win, `CEREMONY_DELAY_DAYS`, `CAMPAIGN_MAX`/`CAMPAIGN_SCALE`, jitter
magnitude, nominee count, box-office-bump factor.

---

## 8. Where it plugs in

- **`engine/awards.ts`** (pure): `computeCeremony(eligibleFilms, campaign, studios, rng)` →
  an `AwardsCeremony`; helpers to gather eligible films by year and to derive a
  category's contenders from a `Film`'s `talent` + `results`. Unit-testable in
  isolation, like the rest of `engine/`.
- **Reducer settlement** (`studioReducer.ts`, the calendar-settlement helper):
  open a season at `nextAwardsSeasonDay`; resolve at `awardsSeason.ceremonyDay`
  (apply payoffs, push history, clear season). New actions:
  `SET_AWARDS_CAMPAIGN` (allocate/adjust a film's campaign budget, deduct cash),
  and navigation to the season/results views.
- **Inbox** beats: "Awards season has opened — campaign your contenders" and
  "The Academy Awards: <results>", reusing the existing Inbox pipeline.
- **UI:** an **Awards Campaign** screen (list your eligible films, allocate
  budget, see cash impact) reachable while a season is open, and a **Ceremony
  Results** view (categories, nominees, winners, your haul) — plus an
  **awards history** panel on the Stats page. No wizard changes.

---

## 9. Phasing

**MVP (this brief):** the Academy Awards — 11 categories, gender-split acting
with the non-binary rule, deterministic+jitter scoring, the basic per-film
campaign, Prestige/Brand/box-office payoff, permanent history, player + rival
eligibility.

**Deferred (natural next layers):**
- **Precursor ceremonies** (Golden Globes with its Drama/Comedy split, BAFTA,
  SAG, guild awards) building a real season with predictive hype.
- **Original vs Adapted Screenplay** split.
- **Per-category / per-talent campaign** targeting (the campaign shape already
  anticipates it).
- **Talent fame** rewards for winners; talent "awards history" on their cards.
- **Rival campaign AI.**
- **A genuine re-release/legs bump** instead of a one-time credit.

---

## 10. Open tuning questions

None block the build; all are `data/awards.ts` values or one formula:

1. **Prestige/Brand payouts** per nomination vs win, and per category weight.
2. **`CEREMONY_DELAY_DAYS`** (~45) and how early the season opens.
3. **Jitter magnitude** — how often an upset should happen.
4. **`CAMPAIGN_MAX` / `CAMPAIGN_SCALE`** — how much money can move the needle.
5. **Box-office-bump factor** — how large the Oscar bump is.
6. **prestigeNudge cap** — how much studio Prestige tilts a race (kept small).

---

## 11. Testing

Everything load-bearing is a pure function in `engine/awards.ts`:

- Eligibility bucketing by year (player + rival; a film released on the last day
  of a year is in that year, day 1 of the next is not).
- Category scoring: the strongest film wins its category with zero jitter;
  craft categories separate two equal-sub-score films by crew `skill`; acting
  buckets by gender; a non-binary performer appears in exactly one acting
  category (their strongest).
- Campaign: `campaignBoost` is monotonic increasing, capped at `CAMPAIGN_MAX`,
  and cannot lift a clearly weaker film over a clearly stronger one.
- Payoff: a Best Picture win moves Prestige more than a single craft nomination;
  the box-office bump credits the studio once.
- Reducer: a season opens at the year boundary with the right eligible field;
  `SET_AWARDS_CAMPAIGN` deducts cash and is capped by affordability; the
  ceremony resolves on `ceremonyDay`, writes history, and clears the season;
  everything is a no-op when no season is open.
- Migration: a save with none of the new fields loads (history `[]`, no open
  season) and the next year boundary opens the first season.
