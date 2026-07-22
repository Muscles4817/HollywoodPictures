# Design Review: Marketing Rollout — a campaign that takes place over time

Status: **Built.** Adds a *temporal* dimension to marketing: a campaign is a
rollout that plays out over the weeks before release, and the runway it gets to
build is a real lever on how well it lands. Bolts onto the existing marketing
model (`docs/DESIGN_REVIEW_marketing_campaign.md`) — channels, angle, and press
tour are unchanged; this is the "over time" axis they didn't have.

---

## 1. The problem

Marketing didn't *feel* like it took place over any amount of time. You built a
campaign on one screen, hit Release, and the whole thing — buzz, reach, opening
— was computed atomically on release day. A film scheduled months out did
nothing but wait: no campaign in flight, no sense of a rollout. Time on the
calendar was invisible to marketing.

## 2. The idea

A marketing campaign is a **rollout**, not a switch flipped on release day.
Trailers air and re-air, word spreads, anticipation compounds — and all of that
takes weeks. So the **runway** a campaign gets — the gap between committing it
(`SCHEDULE_RELEASE`) and the release day — governs how much of that momentum it
builds:

- **Rushed (zero runway, a same-day release):** the campaign lands at its
  **baseline** reach — the neutral 1.0. Nothing about the existing box-office
  math changes.
- **Held for a full rollout (`CAMPAIGN_FULL_ROLLOUT_WEEKS`, ~8 weeks):** the
  campaign is in full swing, realising up to **`+CAMPAIGN_MOMENTUM_BONUS`**
  (+18%) more reach for the *same spend*.
- In between: a concave ramp, so the **first** weeks of runway buy the most.

Crucially it's a **bonus for holding, never a penalty for rushing.** A same-day
release is exactly today's numbers, so the entire existing calibration (and the
whole regression suite, which releases same-day) is untouched. The only thing
that moves the number is the new act of *giving the campaign time*.

### 2.1 Why a bonus, not a penalty

Two reasons. (1) Calibration: the box-office model, the real-film regression
tripwires (`state/realFilmRegression.test.ts`), and every other test schedule
same-day; making "rushed" the neutral baseline means none of that shifts.
(2) Design honesty: runway isn't free. Holding a release lets rivals crowd your
window (`engine/releaseCrowding.ts`) and keeps the film off screens earning
nothing, so "hold for the full campaign" is a genuine trade-off against "get to
market now," not a dominant button. The bonus caps at a full rollout, so there's
never a reason to hold a film for years.

## 3. Where it plugs in

A single multiplier on the **realised marketing reach**, resolved by the caller
and threaded in exactly like the campaign angle and producer multipliers already
are — the box-office simulation itself is untouched beyond the input it's already
fed.

- **`engine/marketing.ts`** (pure): `campaignRolloutWeeks(startDay, releaseDay)`,
  `rolloutMomentum(weeks)` → the ≥1 multiplier, `marketingRolloutMultiplier(startDay?, releaseDay)`
  (neutral 1 when no start day is known), and `campaignRolloutProgress(...)` for
  the UI's "week N of M". Fully unit-tested.
- **`engine/releaseFilm.ts`**: new optional `marketingRolloutMultiplier` input
  (default 1) scales `marketingReach` before it feeds **both** Buzz
  (`computeBuzzScore`) and the opening (`deriveAudienceSimulationFixedState`). The
  cash `marketingCost` is *not* touched — momentum is more reach per pound, not
  more spend.
- **`engine/marketSettlement.ts`**: `resolvePlayerRelease` resolves the
  multiplier from the frozen `campaignStartDay` → this film's `releaseDay`.
- **`state/studioReducer.ts:SCHEDULE_RELEASE`**: freezes `campaignStartDay =
  totalDaysAfter` (the day the campaign commits) onto the release, alongside the
  distribution terms it already freezes.
- **`types/index.ts`**: `MarketingChoices.campaignStartDay?: number` — optional
  and additive, so no save migration is needed (absent → neutral).

## 4. Making it visible

The mechanic is legible, not a hidden multiplier:

- **Marketing & Release screen** — a **Marketing rollout** readout in the Release
  Date card: how many weeks of runway the selected date earns, the momentum it
  builds (Rushed / Building +x% / Full rollout +18%), and a meter. The live
  **projected opening** already recomputes as you allocate; it now climbs as you
  push the release out, so the runway trade-off is something you *see*.
- **Dashboard** — a scheduled film shows its campaign in flight ("Marketing
  campaign · week 3 of 10" with a progress meter) instead of just a date, so a
  film waiting for release reads as an active rollout.
- **How It Works** — a guide entry explaining that when you release changes how
  far your marketing reaches.

## 4a. Rival campaigns reveal a film's title and cast

A rival studio's in-progress film used to be masked as a generic "{scale}
{genre} film" with no cast, for its entire production — the real title and cast
only surfaced the day it released. That contradicted the rollout framing: a real
studio's film is under wraps while it shoots, but once **marketing begins** the
title and cast are announced (a teaser drops, the cast is public) well before
release.

So a rival's identity now **reveals when its marketing rollout begins**:

- Rival productions freeze a `campaignStartDay` at creation
  (`engine/rivalStudios.ts`) — the day the shoot and post wrap, which is exactly
  `releaseDay − RIVAL_MARKETING_LEAD_DAYS` before the crowding nudge. This is the
  rival analogue of the player committing a campaign at `SCHEDULE_RELEASE`.
- `rivalReleaseIsAnnounced(production, today)` gates the reveal (with a
  lead-time fallback for saves predating the field, so no migration).
- **Release Calendar** (`selectors.ts:deriveUpcomingReleaseEntries`, now taking
  `today`): a masked rival shows only scale/genre/studio/timing and an "under
  wraps" note; once announced it shows the real title, its lead cast, and
  director. `CalendarEntry` gained `announced` / `stars` / `director` (the
  player's own films are always announced).
- **Rival studio page** (`RivalStudioPage.tsx`): the "In Production" list shows
  the real title + "Starring …/Dir. …" once announced, the masked placeholder
  before.

## 5. Scope & non-goals

- **Rivals' box office is unchanged.** They resolve through
  `resolveRivalProduction`, which passes no rollout multiplier (neutral 1) —
  rollout *momentum* is a player-facing campaign-management lever, and keeping it
  off rivals leaves their commercial calibration alone. The `campaignStartDay`
  now stored on rival productions is used only as the title/cast reveal anchor
  (§4a), never read by the box-office path.
- **The box-office simulation is not rewritten.** Same discipline as the original
  marketing brief: a smarter input, not new box-office math.
- **No per-week spend draw-down or buzz accrual into state.** The rollout's
  *effect* is resolved once at settlement from the frozen runway; the week-by-week
  progress shown for a scheduled film is pure display arithmetic
  (`campaignRolloutProgress`), not mutated state. A genuinely stateful,
  week-by-week campaign (spend pacing, mid-flight re-buys, tracking that updates
  as the rollout runs) is the natural next increment against this same model.

## 6. Tuning knobs

All in `data/marketing.ts`:

1. **`CAMPAIGN_FULL_ROLLOUT_WEEKS`** (8) — the runway at which the campaign is in
   full swing.
2. **`CAMPAIGN_MOMENTUM_BONUS`** (0.18) — the extra realised reach a full rollout
   earns over a rushed release. The key balance lever.
3. The ramp shape (`rolloutMomentum`, concave) — how front-loaded the benefit is.
