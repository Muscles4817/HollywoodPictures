# Reference — How Post-Production Money Actually Works

A domain reference, not a design document. It exists because the simulation kept
getting one thing structurally wrong — pricing editorial work as a share of the
*production* budget — and because that mistake is easy to make again from
intuition. What follows is how the money really behaves, and then how
`engine/testScreening.ts` maps onto it.

> **On the numbers.** The magnitudes here are order-of-magnitude figures from
> general industry knowledge, not quoted rate cards, and they are not sourced to
> published union schedules. Trust the **structure** — what drives what — and
> treat every currency figure as a bracket to calibrate against, not a fact to
> cite. Rates also vary enormously by territory, by union vs. non-union, and by
> whether a given name can command a premium.

---

## 1. The shape of post-production

Post is a pipeline, and the important property is that **each stage consumes the
output of the one before it**:

```text
Assembly            editor cuts as dailies arrive, during the shoot
      ↓
Director's cut      the director's pass, contractually protected
      ↓
Studio/producer cuts
      ↓
PICTURE LOCK        ← the pivotal moment; everything downstream keys off it
      ↓
Turnovers           the locked cut is handed to each finishing department
      ├── VFX       shots ordered, versioned, reviewed, finalled
      ├── Music     spotting, composing, recording, mixing
      ├── Sound     dialogue edit, ADR, foley, effects, pre-dubs
      └── DI        conform, grade
      ↓
Final mix           dub stage, mixers, weeks
      ↓
Deliverables        masters, formats, territories, marketing materials
```

Before picture lock, a change costs editorial time. After picture lock, a change
costs editorial time **plus** whatever it invalidates in every department that
has already started working from the locked cut. This is the single most
important asymmetry in post-production economics.

## 2. What a re-edit costs: editorial weeks

The unit of editorial cost is **weeks the cutting room stays open**. Not scenes,
not minutes of runtime, not a percentage of the negative cost. Weeks.

A cutting room on a studio feature is roughly:

| Line | Notes |
| --- | --- |
| Editor | Weekly rate. Guild scale at the floor; an established editor negotiates well above it. |
| Assistant editors | Typically one to three. They do the conform, media management, turnovers, temp VFX. |
| Additional editor(s) | On bigger pictures, or when a schedule compresses. |
| Cutting room | Avid/Premiere seats, shared storage, suite rental, a post PA. |
| Post supervisor | Part of their time, allocated across the whole post period. |

All-in, that lands somewhere around **$15–40k/week** on a studio picture and a
fraction of it on an independent film. An "additional editing period" after a bad
preview typically runs **4–12 weeks**.

So editorial alone for a recut is roughly **$60k–500k**. That is a real cost, but
on anything effects-led it is not the dominant one.

## 3. What the recut invalidates: the term that actually varies

Changing the cut puts finished downstream work back in play. This is where the
cost stops being a modest bill and starts being a serious one.

**VFX — almost always the dominant term.** Vendors bill per shot and per version.
A recut can:
- re-time a shot that was already approved (a new version, at cost),
- change a shot's in/out points so the render no longer covers the frames needed,
- cut a completed shot entirely (paid for, now unused),
- create new shots that were never bid.

On a film with hundreds or thousands of VFX shots, a modest recut can move a
seven-figure sum. On a film with a dozen invisible clean-up shots, it moves
nothing.

**Music.** Cues are written to picture. Change the picture and cues must be
re-conformed at minimum, re-written commonly, and re-recorded when the change is
structural. A re-record with players is a session cost, not a desk cost.

**Sound.** The dialogue and effects edits conform to the locked cut. A recut means
re-conforming, often new ADR, and then a **re-mix** — which is a dub stage day
rate times however many days, with mixers, and it is not cheap.

**DI / colour.** Re-conform and re-grade the changed material, plus new masters.

**Marketing knock-on.** Trailers and spots cut from footage that may no longer be
in the film.

## 4. Why timing dominates everything

The same creative decision has wildly different prices depending on when it lands:

| When | What it costs |
| --- | --- |
| During the shoot / assembly | Nearly free. The editor is already cutting; nothing downstream has started. |
| Before picture lock | Editorial weeks only. |
| After turnovers, before the mix | Editorial + VFX re-versioning + music/sound re-conform. |
| After the mix | All of the above, plus a re-mix and new deliverables. |
| After release | Effectively impossible; the cost is the release itself. |

This is the same mechanism as **integration debt** in
`docs/DESIGN_REVIEW_project_clocks_and_script_openness.md` §3.6: the price of a
change is set by how much already-committed work it destroys, not by the size of
the change. Post-production is simply the department where that principle is most
visible and most brutally priced.

## 5. Reshoots and pickups always contain a re-edit

This is the part the simulation had backwards, and it is worth stating plainly:

> You cannot shoot new material and then not cut it in.

Additional photography is **additive to** editorial work, never an alternative to
it. The sequence is always: shoot the new material → conform it → cut it in →
re-turn-over to VFX → re-conform music and sound → re-mix → re-grade. Every cost
in §2 and §3 is incurred *as well as* the photography.

So in reality the ordering is structural, not a matter of scale:

```text
re-edit  ⊂  pickups  ⊂  reshoots
```

Pickups add a few days of second-unit-ish photography and a short recall of the
principals. Major reshoots add many days, the director, the full principal cast,
often the original crew and locations — and on a tentpole they routinely run into
eight figures.

### Cast availability — the constraint that decides most of these arguments

The reason a studio fixes a bad preview in the edit is frequently not that the
edit is the better idea. It is that **the cast is gone.** Principals contract
their next job around this film's wrap date, and by the time a preview screens
they are on someone else's set, in someone else's continuity, under someone
else's schedule. There are only four ways round it, and three of them are bad:

1. **Wait.** Push the reshoot until they are free, and push the release with it.
2. **Buy them out.** Pay the other production's costs to release them for a
   fortnight. Expensive, and needs that production's cooperation.
3. **Shoot around them.** Doubles, over-shoulders, rewrites that avoid the face.
   This is why some reshoots look the way they do.
4. **Don't reshoot.** Fix it in the edit and release the film you have.

Option 4 is by far the most common, and it is why the edit carries so much of the
repair burden in practice. A reshoot is not something a studio can simply buy at
a price — it is something the calendar can refuse outright.

One further real cost the simulation does not model:
- **Continuity drift.** Hair, physique, ageing. Reshoots months later are visibly
  reshoots if not managed.

## 6. Rough magnitudes

Brackets, not quotes. Read them as "which order of magnitude", nothing finer.

| Item | Rough scale |
| --- | --- |
| Cutting room, all-in | $15–40k/week (studio), far less independent |
| Additional editing period | 4–12 weeks |
| Editorial cost of a recut | $60–500k |
| VFX re-work on a recut | ~nothing (VFX-free) to seven figures (effects-led) |
| Re-mix after changes | Dub stage day rate × days, typically 1–3 weeks |
| Pickups | Days of shooting + short principal recall |
| Major reshoots (tentpole) | Frequently eight figures |

## 7. How the game models this

`engine/testScreening.ts`. Three constants carry the whole model, and they are
the tuning surface:

```text
reEditCost(draft, round)
  = max(MIN_CUTTING_ROOM_COST,
        editorFee × RE_EDIT_EDITORIAL_SHARE × CUTTING_ROOM_MULTIPLIER)   ← §2
  + vfxAmount × VFX_REWORK_SHARE × lateness(round)                        ← §3, §4

pickups   = reEditCost + dailyShootBurn ×  4 + recall(lead)               ← §5
reshoots  = reEditCost + dailyShootBurn × 16 + recall(lead, supporting, director)
```

The mappings, and why each is what it is:

- **The editor's fee anchors the cutting room.** The room's cost is essentially
  the cost of the people in it, and the editor's rate is what the rest scales
  against. It also means *who you hired* is part of what a recut costs, which is
  true and gives the hire a consequence it did not have.
- **The VFX budget stands in for re-work exposure.** It is the pool of finished
  work a new cut can disturb, so a share of it is the honest proxy. A Drama's
  recut is pure editorial; an effects-led picture's is not.
- **`lateness(round)` grows with each screening round**, because each successive
  recut finds more of the finish locked (§4).
- **The shooting budget does not appear in the re-edit at all.** That is the whole
  correction: it was the wrong driver.
- **Additional photography is strictly additive**, so `re-edit < pickups <
  reshoots` holds at every budget level by construction (§5) rather than by
  tuning. The previous model priced reshoots as photography *alone* against a flat
  re-edit, which inverted the ordering on small films — the "cheap, fast,
  reliable option" was the most expensive one.

### Deliberately not modelled

Recorded so nobody assumes these are oversights:

- Picture lock as an explicit gate. The test screening stands in for the whole
  lock-and-turnover moment; there is no separate "we have locked" state.
- Music, sound and DI as separate re-work terms. They are folded into the single
  VFX-driven exposure term, which is defensible only because VFX genuinely
  dominates on the films where re-work matters at all.
- Continuity drift over a long gap.
- Marketing materials cut from removed footage.
- The three *workarounds* for an unavailable cast (§5): waiting, buying them out,
  or shooting around them. The simulation models only the fourth option -
  refusal - so an unavailable principal closes photography off entirely rather
  than opening a costlier route to it. Buying a principal out is the most
  natural of the three to add, and would be a genuine money-for-time trade
  rather than a new subsystem.

Picture lock is the one most likely to be worth adding, and it would fit the
existing project-clocks work rather than needing anything new.

### What IS modelled: availability refusing a reshoot

`engine/reshootAvailability.ts`. Additional photography needs the principals
physically present - pickups need the leads, major reshoots need the leads,
supporting cast and director. Each is checked against the **live** talent pool
(not the snapshot taken when they were hired, which predates everything since,
including this film's own greenlight booking), for the window that option
actually needs. Rivals book from the same pool, so an unavailable star is a real
consequence of a real market rather than a die roll.

A blocked option stays visible, disabled, and names who is unavailable and until
when - a refusal the player can reason about, not one they merely suffer
(`SIMULATION_PHILOSOPHY.md` Principle 3). The re-edit is never blocked, because
it needs nobody back: when photography is closed, the edit is the whole of what
is left, which is exactly the real dynamic above.

This is the same perishable-commitment idea as
`docs/DESIGN_REVIEW_project_clocks_and_script_openness.md` §3.1, landing one
phase later: the package the film assembled at greenlight has since dispersed,
and what the studio can still do about a bad screening depends on who it can get
back.
