# Design Review — Development Office: the paths a script gets made

**Status:** Vision capture, not for immediate build. The stage-2 MVP ("Develop a
sequel" → a timed pending development → an auto-generated screenplay) is
deliberately shaped so these paths bolt on without a rewrite. This note records
the paths and the hard questions each raises so they aren't lost.

## The frame

Getting a screenplay made is not one action — it's a **desk with several paths**,
each of which can be seeded by an **IP** (a franchise entry) *or* be an
**original**. The IP just provides a seed (world, returning characters, pre-sold
`recognition`); the *path* decides who writes it and how much the studio steers.

All paths produce the same output — a pending development that delivers a `Script`
Asset after a real delay (rights/legal/greenlight setup, then writing).

## Path 1 — Open commission ("write what you want")

Hire a writer and let them run. The writer's own proclivities shape the result.

**Hard question — writer × IP identity.** An IP has an established identity
(genre, tone, tags, its characters). A writer has their own signature (tone
profile, genre affinity, commercial lean, conceptAmbition). How do they fuse?
- A franchise has a *canonical* tone the audience expects; a strong-signature
  writer bends it toward themselves. Proposed: the IP sets the centre, the writer
  pulls it a bounded fraction (the same "author pulls tone a modest fraction"
  model `applyWriterTone` already uses at generation) — a bold auteur reinterprets
  the franchise, a journeyman keeps it on-model.
- Genre: default inherited from the IP; a writer with a strong off-genre affinity
  can drift it (a horror-inflected entry in an action franchise).

## Path 2 — Briefed commission ("here's what I want, now make it")

The player defines a brief first — target genre, tones, tags (a
`Partial<{genre, tones, tags}>`) — *then* hires a writer to execute it.

**Hard questions — brief adherence & willingness.**
- **Adherence:** how tightly the delivered script matches the brief, as a function
  of the writer's fit (a writer briefed inside their affinity nails it; one pushed
  against type delivers something looser).
- **Willingness (the selectiveness thread):** not every writer accepts a brief.
  Acceptance probability should fall with the writer's standing and rise with the
  studio relationship and how close the brief sits to their proclivities — a
  low-tier writer takes any brief, an auteur only takes one they believe in. This
  is the same willingness gate flagged for commissions generally.

## Path 3 — Creative pitch ("I want to make this")

Certain creatives proactively approach with a partial idea for the IP — a genre in
mind, a character they want to build a film around, part of a tone profile. The
player greenlights or passes.

- **Who pitches decides who executes.** A **writer** pitching writes it directly.
  A **director** pitching arrives with a *recommended writer* (and a stronger claim
  on directing it) — the pitch carries a partial brief plus a talent attachment.
- Pitches are a *feed* (like the Opportunity Market, but IP-scoped and
  talent-driven): they arrive over time, are time-limited, and are shaped by which
  creatives are drawn to the IP's identity and standing.

## Shared model (what the MVP reserves for these)

The stage-2 `PendingSequelDevelopment` record is shaped so all three slot in:

```
PendingSequelDevelopment {
  id; ipId; startedOnDay; readyOnDay; script;   // MVP fills these
  path?: 'open' | 'briefed' | 'pitch';          // ← the three paths
  writerId?;                                     // open / briefed / writer-pitch
  brief?: { genre?, tones?, tags? };             // briefed / pitch
  pitchId?;                                       // pitch (talent + partial idea)
}
```

- **Open** adds `writerId` (+ the writer×IP tone fusion).
- **Briefed** adds `brief` + `writerId` (+ adherence + willingness gate).
- **Pitch** adds `pitchId` (a creative + partial brief + optional talent
  attachment), which resolves into `writerId`/`brief`.

Because this parallels `PendingCommission`, the open/briefed paths can eventually
**converge with the commission system** (a sequel commission = a commission with
an `ipId` seed) rather than duplicating timing/fee/delivery machinery.

## Cross-cutting dependencies (each its own future thread)

1. **Writer × IP identity fusion** — how a writer's signature bends an IP's
   canonical tone/genre (Path 1).
2. **Brief adherence** — delivered-vs-requested fit as a function of writer fit
   (Path 2).
3. **Writer willingness / selectiveness** — acceptance probability by standing +
   relationship + brief fit (Paths 1–2, and commissions generally).
4. **Creative pitch feed** — IP-scoped, time-limited pitches shaped by creative
   affinity for the IP (Path 3), with writer-vs-director execution differences.

None of these are in the MVP; the MVP is one-click → timed → auto-script, with the
record above reserving their seams.
