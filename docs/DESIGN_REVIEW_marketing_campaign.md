# Design Review: Marketing Campaigns — Channels, Audience Fit & Campaign Angle

Status: **Proposed** (design locked, unbuilt). Replaces the single marketing
spend dial with a real campaign: money split across **channels**, each with an
**audience fit**, plus a **campaign angle** that governs the opening-vs-legs
tradeoff. This is the A+B+C scope from the marketing brainstorm; press tours,
brand tie-ins, tracking-as-a-service, and counter-programming (D/E/F/G) bolt on
later against the same model.

---

## TL;DR

- **Today marketing is one slider.** `MarketingChoices.marketingSpend` is a
  single £ amount that feeds Buzz and is the dominant awareness channel into
  the audience simulation (`MARKETING_REACH_WEIGHT` 0.75). `docs/DESIGN.md` §8
  flags this exact thinness: *"Marketing is a single spend dial, not distinct
  channels… worth revisiting now that a real Buzz mechanic exists."*
- **Not a sim rewrite — a smarter front end.** The four channels roll up into
  one **effective marketing reach** number that the existing Buzz → Opening →
  Legs pipeline consumes unchanged. We're replacing *how the spend number is
  produced*, not the box-office math it drives.
- **The Target Audience pick finally matters.** Films already carry a
  `TargetAudience`, but marketing barely reads it. Each channel has an audience
  affinity, so *matching channels to your audience* is efficient and
  mismatching is mostly wasted — turning "how much?" into "who's this for, and
  how do I reach them?"
- **The campaign angle is the fun part.** You choose what the campaign *sells*.
  Sell your real strength → a big opening at no cost. **Oversell** a weakness →
  a bigger opening but **worse legs** as word of mouth sours (the classic "the
  trailer lied"). An honest, genre-faithful cut is the safe baseline.
- **A live tracking readout** projects your opening as you allocate, so the
  whole thing is legible instead of a blind gamble.

---

## 1. What it is

The **Marketing & Release** step keeps release type and window, but the single
spend slider becomes a **campaign builder**:

1. **Allocate** a budget across four channels (Trailers, TV, Digital, Press).
2. Each channel's effectiveness depends on your film's **Target Audience**.
3. Pick a **campaign angle** — what you're selling.
4. A **tracking** panel shows the projected opening as you go.

Under the hood, the channel mix + angle produce the same handful of numbers the
release pipeline already consumes, so nothing downstream is rebuilt.

### Design priorities (inherited from `docs/DESIGN.md` §1)

A richer, legible decision > clean architecture > polish. New `data/` +
`engine/` + a reworked Marketing screen; the box-office simulation is untouched
beyond the inputs it's already fed.

---

## 2. The channels (four)

`MarketingChannel = 'trailers' | 'tv' | 'digital' | 'press'`.

Each channel takes a £ amount with its own **diminishing-returns curve** (so
dumping everything into one is inefficient) and an **audience efficiency**
(effective reach per £, by Target Audience):

| Channel | Character | Mass | Critics | Teens | Families | Adults | Niche |
|---|---|---|---|---|---|---|---|
| **Trailers** | broad workhorse | 1.0 | 0.6 | 0.8 | 0.8 | 0.8 | 0.6 |
| **TV spots** | mass & family reach | 1.0 | 0.4 | 0.5 | 1.0 | 0.7 | 0.3 |
| **Digital / social** | cheap, young, viral | 0.7 | 0.5 | 1.0 | 0.5 | 0.7 | 1.0 |
| **Press & screenings** | critic/prestige-facing | 0.4 | 1.0 | 0.3 | 0.4 | 0.8 | 0.7 |

Efficiencies are **medium-sharp**: a matched channel is ~1.0, a mismatched one
~0.3–0.4 — enough that matching clearly matters, not so brutal that four
channels feels punishing. All values live in `data/marketing.ts`.

### 2.1 Effective marketing reach

```
effectiveReach = Σ_channels  efficiency(channel, targetAudience) · saturate(spend_channel)
```

where `saturate` is a concave per-channel curve (capped, diminishing returns —
the same shape the awards campaign curve uses). This single number replaces the
raw `marketingSpend` everywhere the awareness/Buzz math reads it today
(`engine/scoring.ts:marketingBuzzContribution`,
`engine/audienceSimulationInputs.ts`'s marketing reach input). **The 0.75/0.25
marketing-vs-cast reach split and everything downstream stay exactly as they
are** — they just receive a smarter, audience-aware reach number.

The **cash cost** is simply `Σ spend_channel`, scaled by the existing
`releaseType.costMultiplier` (`computeMarketingCost`).

---

## 3. The campaign angle

`CampaignAngle = 'spectacle' | 'story' | 'mystery' | 'starPower' | 'faithful'`.

Named angles (not raw tone axes) — clearer to a player than "sell the
suspense=72 axis." Each loud angle maps to a **dimension the film either
delivers on or doesn't**:

| Angle | Sells… | Delivered by (0-100) |
|---|---|---|
| **Spectacle** | scale & effects | production score / `tone.spectacle` |
| **Story** | emotion & craft | script score / `tone.drama` |
| **Mystery** | intrigue | `tone.suspense` |
| **Star Power** | the cast | average lead fame |
| **Faithful** | an honest cut | — (no hype, no risk) |

**The mechanic:**
- Each loud angle has a **hype** value that boosts the **opening** (louder
  campaigns open bigger, even for bad films — that's the point).
- The **legs penalty** is `hype · max(0, PROMISE − delivered)/100` — i.e. you're
  only punished to the extent the film *fails to back up* the angle. Sell your
  genuine strength (high `delivered`) → no penalty. Oversell a weakness → the
  louder you went, the worse word of mouth sours.
- **Faithful** = no hype, no penalty: the safe baseline.

**Opening** feeds through the existing awareness/Buzz path (an opening
multiplier on effective reach, exactly like the producer
`marketingEfficiencyMultiplier` already does). **Legs** feed a retention /
word-of-mouth dampener into the audience simulation's post-opening weeks — the
one place this touches the sim, at `deriveAudienceSimulationFixedState`
(exact retention input pinned at build).

### 3.1 Calibration: honesty slightly favoured

Constants are tuned so overselling a weakness is a **real temptation with a
real cost** — the opening gain does **not** fully offset the legs loss on
average, so the safe/honest play stays viable and "sell your actual strength"
is the mastery play. Louder isn't free; it's a gamble that pays off only when
the film can cash the cheque.

---

## 4. Data model

`MarketingChoices` (types/index.ts) changes shape:

```ts
export interface MarketingChoices {
  channelSpend: Record<MarketingChannel, number>; // was: marketingSpend
  campaignAngle: CampaignAngle;
  releaseType: ReleaseType;   // unchanged
  releaseWindow: ReleaseWindow; // unchanged
}
```

This is the one genuinely breaking change: `marketingSpend` is read by
`computeMarketingCost`, `computeBuzzScore`, `deriveAudienceSimulationFixedState`,
`defaultMarketingChoices` (fixtures + UI default), and their tests. All move
behind two helpers — `totalMarketingSpend(choices)` (cost) and
`effectiveMarketingReach(choices, targetAudience)` (awareness) — so each
consumer changes one call, not its logic. Saves predating this get a migration
in `state/persistence.ts` (map an old `marketingSpend` onto an all-Trailers
channel mix + `faithful` angle) — the first real migration the codebase needs,
since unlike prior additive fields this one *replaces* a field older saves
depend on.

`data/marketing.ts`: the channel list, the audience-efficiency matrix, the
saturation curve constants, per-angle hype + promise + delivered-dimension, and
the honesty calibration constants.

---

## 5. Tracking readout

A **projected opening** range shown on the Marketing screen, recomputed live as
the player allocates channels / picks an angle — the same week-1 figure the
release settlement will produce, run against the current draft. Purely
informational (a `selectors`/derived read, no state), but it's what turns the
campaign from a blind gamble into an optimisation you can *see*. Small, and it
makes the whole MVP feel finished.

---

## 6. Where it plugs in

- **`engine/marketing.ts`** (pure): `effectiveMarketingReach`,
  `totalMarketingSpend`, `campaignAngleEffect(choices, film)` →
  `{ openingMultiplier, legsPenalty }`, and `projectedOpening(...)` for the
  tracking readout. Unit-testable in isolation.
- **`engine/scoring.ts` / `engine/audienceSimulationInputs.ts`**: swap the raw
  `marketingSpend` read for `effectiveMarketingReach`; apply the angle's opening
  multiplier (awareness) and legs penalty (retention).
- **`engine/cost.ts:computeMarketingCost`**: `totalMarketingSpend × costMultiplier`.
- **Reducer**: `SET_MARKETING_CHOICES` already exists and carries the whole
  `MarketingChoices` object — the new shape flows through it unchanged.
- **UI (`MarketingRelease.tsx`)**: channel allocation (four sliders + a total),
  an audience-fit hint per channel (matched/mismatched for this film's
  audience), the angle picker with a plain-language honesty warning, and the
  tracking panel. Release type/window controls stay.

---

## 7. Phasing

**MVP (this brief) — A + B + C + the tracking readout:**
- Four channels with the audience-efficiency matrix and saturation curves.
- Effective-reach rollup feeding the existing Buzz/awareness pipeline unchanged.
- The five campaign angles with the oversell → opening-up / legs-down mechanic,
  honesty slightly favoured.
- Reworked Marketing screen + live tracking. Migration for old saves.

**Deferred (the rest of the brainstorm, same model):**
- **D — Press tours & talent:** send cast on the circuit; charisma/reliability
  earn buzz, high ego/controversy risk a scandal (leans on the Person model).
- **E — Brand tie-ins / product placement:** sponsor cash that offsets budget
  but only fits certain films, with a small Prestige tension.
- **F+ — Tracking as a paid service / rival campaign intel.**
- **G — Counter-programming:** actively respond to a crowded release window.
- A fifth channel (out-of-home/billboards) once four are proven.

---

## 8. Open tuning questions

All `data/marketing.ts` values or one formula:

1. **Audience-efficiency matrix** — §2's numbers are the starting point.
2. **Saturation curve** — per-channel cap and how fast returns diminish.
3. **Angle hype vs. legs-penalty constants** — the honesty calibration (§3.1);
   the key balance lever.
4. **`PROMISE` bar per angle** — how high a delivered score must be to avoid a
   penalty.
5. **Tracking range width** — how much uncertainty the projection shows.

---

## 9. Testing

`engine/marketing.ts` is pure and fully unit-testable:

- `effectiveMarketingReach`: matched channels out-reach mismatched £-for-£;
  diminishing returns (doubling one channel's spend less than doubles its
  reach); an all-in-one-channel mix under-performs a spread for a broad
  audience.
- `totalMarketingSpend` / cost: sums channels; scales by release type.
- `campaignAngleEffect`: `faithful` is neutral (no opening boost, no legs
  penalty); a loud angle on a film that delivers has opening-up / legs-penalty
  ≈ 0; the same angle on a film that doesn't delivers opening-up / legs-down;
  the honesty calibration holds (oversell's expected box office ≤ honest for a
  non-delivering film).
- Migration: an old save's `marketingSpend` maps onto a coherent channel mix +
  `faithful`, and its projected reach/cost land close to the old value.
- Reducer/UI: `SET_MARKETING_CHOICES` round-trips the new shape; the tracking
  readout matches the settled week-1 figure for the same draft.
