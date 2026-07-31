# Design Review — Sequels & Franchises (the flywheel)

**Status:** Design for build. Implementation-oriented. This is the feature that
unblocks the box-office top-end calibration by giving the world a *real bimodal
marketability distribution* — most films original (low draw), a rare few franchise
entries (huge, pre-sold draw). Player and rivals both.

## What already exists (don't rebuild)

The IP foundation is done and well-shaped (`engine/intellectualProperty.ts`,
`IntellectualProperty` type, `PROMOTE_FILM_TO_IP`, `IpLibrary`, `evaluateIpViability`):
a released player film can be **promoted to an IP** that lifts chosen characters +
setting and carries **`recognition`** (0–100, seeded from the film's box office +
buzz + audience score) and `prestige`. `filmIds[]` is the designed sequel
append-hook. **But the IP is terminal** — nothing reads it; there's no IP→project
path and no sequel. And IP is player-only.

## The core model — one clean signal, bimodal by construction

The phenomenon lever must be driven by **proven, pre-sold demand**, which is
near-zero for an original and high for a franchise entry. So:

- **New `Script.franchiseRecognition: number` (default 0).** An original's is 0. A
  sequel inherits it from its source IP's `recognition` (a hit → high). This is
  the bimodal field: most films 0, a rare few high.
- **Revise `deriveMarketability`** to be dominated by `franchiseRecognition`, with
  the rolled concept terms (`franchisePotential`/`hook`) as a *minor* component.
  So an original reads low-marketability (concept only); a franchise entry reads
  high (proven recognition). One signal, cleanly bimodal — this fixes the
  "boosts the median too" problem (originals no longer ride a rolled
  franchise stat into the eligibility lever).
- The **eligibility lever** (`franchiseEligibilityMultiplier`, already wired,
  inert) reads this marketability. Flip its gain on and calibrate.

Why not a big original spectacle (Avatar)? It opens on spectacle/marketing/
word-of-mouth through the *interest/awareness* funnel — it is **not** a pre-sold
franchise, so it doesn't get the eligibility phenomenon boost. Only *proven*
franchises do. That's realistic (Avatar built its audience; Endgame arrived with
one).

## Sequel generation (IP → script)

`generateSequelScript(ip, rng)` (engine, pure) produces a screenplay that:
- **inherits** the IP's `setting.archetype` and seeds its cast from the IP's
  `characters` (returning characters);
- sets `franchiseRecognition = ip.recognition`;
- rolls **originality & execution normally** — a sequel is *not* guaranteed good
  (you can make a bad sequel; the draw is pre-sold, the quality is not);
- keeps genre from the source film.

## The flywheel (player + rivals)

```
a hit  ──promote──▶  IP (recognition)  ──develop──▶  sequel (high draw)
                        ▲                                   │
                        └──────────── on release, append filmId + bump recognition
```

- **Player:** a "Develop a sequel" action on an owned IP (from `IpLibrary` /
  `FilmDetailModal`) mints a sequel **Asset** into the library; the player produces
  it normally. On release, append to `ip.filmIds` and bump `ip.recognition`
  (success grows the franchise; a flop dents it).
- **Rivals:** rival AI promotes its hits to franchises and, some of the time,
  makes a **franchise-entry production** instead of a fresh opportunity — so the
  *world* has franchises (essential: the box-office harness runs rival films).
  Rivals can use a lightweight per-studio franchise record (a past hit's
  recognition) rather than the full player IP object.

Franchises are **rare and earned**: only *hits* spawn them, and each successful
entry compounds recognition (Marvel flywheel). No acquisition yet (per scope).

## Marketability → box office (the payoff)

Already wired: `deriveMarketability` → `scriptMarketability` release input →
convex `franchiseEligibilityMultiplier` on the eligible pool. Once
`franchiseRecognition` makes marketability bimodal, flip
`FRANCHISE_ELIGIBILITY_GAIN` on and tune (gain + convexity) against
`boxOfficeDistribution.diagnostic` until `top10Share`, `over500Pct`, `over1000Pct`
and `wideUnprofitablePct` reach band **without** moving the passing median — the
franchise entries become the rare $500M–$1B phenomena, concentrating the top.
`buzzCalibration.diagnostic` must stay green (non-purchasability preserved — the
lever is franchise-driven, never marketing).

## Staged build (each a verifiable commit)

1. **Data + generation** — `Script.franchiseRecognition`; `generateSequelScript`;
   revise `deriveMarketability` to be recognition-dominated. Unit-tested. Box
   office still inert (gain 0), so no calibration risk yet. `SAVE_KEY` bump.
2. **Player flow** — "Develop a sequel" action + Asset minting from an IP;
   on-release `filmIds` append + `recognition` bump. Reducer + UI + tests.
3. **Rival franchising** — rivals promote hits and produce franchise entries;
   lightweight rival franchise record. Rival-execution tests.
4. **Calibrate** — flip `FRANCHISE_ELIGIBILITY_GAIN` on; tune against the
   diagnostics until §2/§6 bands pass. Its own PR-worthy step.

Stages 1–3 are calibration-safe (the lever stays inert until step 4). Step 4 is
the calibration, gated by the harness.

## Open decisions

1. **`franchiseRecognition` weight in `deriveMarketability`** — proposed dominant
   (~0.7), concept terms minor (~0.3). Enough to make it cleanly bimodal?
2. **Recognition growth per successful entry** — how fast does a franchise compound
   (and decay on a flop / over time)?
3. **Rival franchise propensity** — how often does a rival with a hit make a sequel
   vs a fresh film? (Drives how many franchises the world/harness sees.)
