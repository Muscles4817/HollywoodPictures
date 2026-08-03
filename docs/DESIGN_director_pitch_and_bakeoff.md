# Design — Director Interest, the Pitch, and the Bake-off

Status: **draft for review**. This is the director half of Workstream I Phase 7
("Director → actor-parity", `docs/DESIGN_casting_hiring_integration.md`), but it
deliberately does **not** clone the actor negotiation flow. A director's distinct
analogue to an audition is a **pitch**; the analogue to a shortlist-with-offers
is a **bake-off**. That reframing is the whole point of this document.

## 0. Framing — the problem in one sentence

Today a director attaches on click, gated only by a one-shot interest check whose
"does this director want the job" reduces to **studio prestige + the director's
fame + salary**. It does not read whether *this individual creative* suits *this
specific script and package*. So a studio with enough prestige and money can land
almost any A-lister, and every director reacts to a given script identically.

Two symptoms, one root cause:

1. **The offer path is flat** (the playtester's report: "it doesn't feel like
   these are individual creatives reacting to the script/package I bring them").
2. **There is no pitch/bake-off** — the competitive ritual by which most working
   directors actually win a job.

The root cause is visible in the code. `engine/directorAppeal.ts`:

```ts
const factors: DirectorAppealFactors = {
  scriptFit: computeScriptScore(script),        // ← GLOBAL. same for every director.
  brandFit: studio.brand * (1 - lean),          // ← studio-driven
  prestigeFit: prestigeSignal * lean,           // ← studio-driven
  salaryFit: computeSalaryFit(...),             // ← money
};
```

`scriptFit` is the *material's* quality, not *this director's* appetite for it.
Nothing in the appeal model reads the director's `toneProfile`, `productionStyle`,
`aptitudes`, `personality.ego`, or `handsOn` — even though `engine/creativeDemands.ts`
**already** computes exactly the signal we need (`toneDistance(director.toneProfile,
script.toneProfile)`, aptitude-vs-material fit) a few files over. This is a
Principle 7 gap: the substrate exists and simply is not read at hiring time.

Design principles carried in from `SIMULATION_PHILOSOPHY.md`: variance is
endogenous and created by the player's bets (P1); trade-offs, not monotonic
upgrades (P6); connect existing signals rather than duplicate them (P7);
intrinsic properties stored, strengths derived (P8). And from the casting
workstream: engine stays pure and rebalanceable from `data/`; player-facing
presentation stays **qualitative** (never raw stat values); decision support, not
decision replacement.

---

## 1. Two tiers, because real hiring has two rituals

Director hiring is not one flow. It splits by the director's **standing** (fame /
role reputation), and the split is the design:

| Tier | Real-world ritual | Who initiates | Mechanic |
|---|---|---|---|
| **Marquee** (high fame) | *Courted.* The studio pitches the director. | Studio approaches | **Offer** — deepened interest model (§2) |
| **Working** (mid/low fame) | *Competes.* Directors pitch for the job. | Director approaches | **Bake-off** — pitches, then pick one (§3) |

The threshold is a single tunable band, not a hard line — a director near the
boundary can be *both* courted and willing to pitch. Marquee directors do not
pitch (it is beneath them; they are offered). Working directors do not get a
courteous open-ended offer; they earn the slot against rivals. This asymmetry is
the fun: for a big name **you** compete (for their yes); for a working director
**they** compete (for your slot).

Both tiers share one deepened core — the interest model in §2 — so a director's
reaction to your script/package is computed the same way whether it gates an
offer or gates their willingness to pitch. §3 and §4 build the bake-off and the
pitch object on top of it.

---

## 2. Phase A — Make the offer a *personal* reaction (fixes symptom 1)

**Intent.** A director should accept or decline based on who *they* are against
*this* script and package — not on studio prestige and money alone. This phase
stands alone and delivers the playtester's fix even before any pitch UI exists.

### 2.1 Replace global `scriptFit` with personal *appetite*

Introduce `computeDirectorAppetite(director, script)` → 0–100: **how much this
particular director wants to make this particular film**, independent of pay.
Composed entirely from signals that already exist (P7):

- **Tone affinity** — `1 − toneDistance(career.toneProfile, script.toneProfile)`.
  The single highest-value missing signal. A director whose profile leans
  suspense/drama is cool on a broad spectacle comedy *however good the script
  scores*. Already implemented in `creativeDemands.ts`; lift it into a shared
  helper.
- **Craft-to-material fit** — does the script's demands play to their aptitude
  spike? A visual-spike director (`aptitudes.visual` ≫ their mean) is drawn to a
  high-`scale`, spectacle-forward script; a story-spike director to a
  character/`drama`-forward one. Reuse `deriveDirectorAptitudes` + the script's
  `scale` and tone axes.
- **Production-method alignment** — compare `DirectorProductionStyle`
  (`environmentStrategy` / `effectsStrategy`) against the script's own
  `environmentStrategy` / `effectsStrategy` (same `Distribution` keys — the types
  were *designed* to blend "without a conversion step", per their own comments,
  `types/index.ts:300`). A practical-effects director recoils from a CG-tentpole
  script; a stage/digital director from a gritty location shoot.
- **Material quality** — `computeScriptScore(script)`, kept, but as **one term**,
  and weighted by the director's `prestigeLean`: a prestige-leaning director
  cares a lot about material quality; a journeyman weighs the paycheck more (§2.3).

`appetite` replaces the flat `scriptFit` factor. The same great script now
produces *different* appetites across directors — the exact thing missing today.

### 2.2 Let personality raise the bar

Fold personality into the *threshold*, not just the score (mirrors how
`creativeDemands.ts` already uses ego and loyalty):

- **Ego → selectiveness.** A high-ego director's acceptance threshold rises: they
  turn down good, well-paid offers on material that is merely *fine for them*.
  This is why money alone stops working on big names.
- **Ego → tone-misfit sensitivity.** High ego amplifies the *penalty* on low tone
  affinity ("this isn't the kind of film I make"), so a proud auteur is *harder*
  to miscast than a jobbing director who will shoot anything.
- **Loyalty / relationship.** Already partially present via
  `relationshipAppealDelta`; keep, and let a strong relationship *lower* the
  appetite bar (a director you have a history with takes a chance on odder
  material for you).

Net effect the playtester asked for: **landing an A-lister becomes a creative
courtship, not a purchase.** You can be rich, prestigious, and still get turned
down because the script isn't *their* film — and the rejection says so
(`reason: 'script-fit'` already exists; §2.4 sharpens its prose to name the
*creative* mismatch, not just "low script score").

### 2.3 Keep the prestige gate; make it the floor, not the whole model

`requiredStudioPrestige(director)` (fame-driven) stays as the **hard floor** —
a director won't attach their name to a studio far beneath them regardless of
script. That part is good and realistic. The change is everything *above* the
floor: today clearing the gate + affording them ≈ yes. After Phase A, clearing
the gate only earns you a *considered, personal* reaction.

### 2.4 Legibility

Rejections and acceptances read qualitatively and name the *creative* cause, in
the existing `DirectorOfferRejectionReason` vocabulary, extended:

- `script-fit` → split prose: *material quality* vs *tonal misfit* vs *wrong kind
  of film for them* (all derivable from which appetite sub-term is lowest).
- A pre-offer read ("**Where they stand**"): *"Ana is drawn to this material — it
  sits right in her wheelhouse,"* vs *"This is well outside the kind of film
  Marcus makes; expect a hard sell even at a strong fee."* Never numbers. Sharpness
  of this read is **relationship-gated**, exactly like `describeDemandCompetence`
  already gates the aptitude read: a director you barely know is harder to predict.

**Phase A is shippable on its own** and is the recommended first PR — it is the
smallest change that fixes the reported feel, and everything below reuses it.

---

## 3. Phase B — The bake-off (working directors compete for the slot)

**Intent.** For non-marquee directors, replace click-to-hire with a competitive,
time-costed selection: invite pitches, compare them, pick one (or none).

### 3.1 Flow

1. **Open the slot for pitches.** On the director role, choose *Seek pitches*
   (vs *Approach a name* for the marquee offer path). You set an **advertised fee
   band** and the script is attached — the same "advertised range" concept
   Phase 1 of the casting doc introduces for actors.
2. **Interest resolves over in-game time.** Each eligible director runs the §2
   interest model at a **lowered bar** (pitching is lower-commitment than an
   A-lister accepting a firm offer). Willingness is fame-gated in reverse: a
   working director is *eager* to pitch; a near-marquee name rarely deigns to.
   Interested directors submit a **pitch** (§4) after a short delay (a few
   in-game weeks) — surfaced on the staffing hub timeline the casting doc's
   Phase 2 already builds (*"3 pitches expected by ~12 June"*).
3. **Review the pitches.** You get N qualitative pitch cards (§4). This is the
   decision.
4. **Pick one → attach**, or **pass on all** (re-open, widen the fee band, or
   switch to approaching a marquee name).
5. **Consequences for the losers.** Not selected = a relationship ding and a
   spell of unavailability/cool-off (they took a shot and lost). This is the
   "several accept the same slot → pick one, disappoint the others" shape the
   casting doc's Phase 6 already commits to for actors — here it is native.

### 3.2 Who sharpens your read

Mirror the Casting Director's role on the actor side (it changes *information
quality*, not outcomes): a **development executive** hire could surface more
pitches and sharpen how legibly you can read a stranger's pitch. Deferred to a
later pass — the first bake-off ships with relationship-gated reads only.

### 3.3 Marquee path is unchanged in shape

Big names still get the §2 **offer** (courted, no pitch). A director in the
boundary band may offer a light "take meeting" — a one-paragraph pitch surfaced
inside the offer flow — without the full competitive bake-off. Keep this light in
the first pass.

---

## 4. What a pitch *is* — a risk posture, not a score

This is the crux, and where the design earns Principle 1. A pitch must be
**derived** from stored intrinsic properties (P8), **qualitative** to the player,
and above all a **trade-off** (P6): the pitch you like most must not simply be
"the best stats." So a pitch is modelled as a **creative bet that reshapes the
film's outcome distribution**, not a quality bonus.

### 4.1 The `DirectorPitch` object (mostly derived, deterministic)

Deterministic per `(director, script)` — same "roll once, stable thereafter"
discipline `generateCreativeDemands` uses (seed a local rng from the ids; never
thread the main stream). Composed of:

- **The take (a tonal reinterpretation).** A proposed *shift* of the film's
  realized tone toward the director's own `toneProfile`. Prose: *"I'd lean into
  the dread and pull back the spectacle."* Mechanically: a vector nudging the
  script's realized tone by an amount scaled by the director's `handsOn` and ego.
  This is a **bet** — the shift can improve the film (if it sharpens the concept
  and matches the market) or hurt it (if it fights the material). It is not free
  upside.
- **The production approach.** Their `DirectorProductionStyle` applied to the
  film: practical/location vs stage/digital. Directly feeds downstream **production
  risk and cost** (practical = higher ceiling, costlier and riskier on set;
  digital = safer, flatter) — reusing the execution-strategy machinery that
  already consumes these `Distribution` keys.
- **Previewed creative demands.** The pitch *surfaces the demands the director
  will bring* (`generateCreativeDemands(director, script)`) as up-front
  ambitions — *"I'll want my own cinematographer,"* *"I'll take a pass at the
  script myself."* This turns today's **post-hire surprise into a pre-hire
  signal**: you see, before choosing, which crafts this director will fight to
  control and — relationship-gated — whether they're actually good in those
  domains (`describeDemandCompetence`). Enormous legibility win, and pure wiring.
- **Conviction.** Derived from ego × fit. High conviction on a *well-fitting*
  film = a high ceiling. High conviction on a *poorly-fitting* film = a high
  floor risk (they'll push a vision that's wrong for the material, and fight you
  when overruled — feeding the existing patience/walk system).

### 4.2 The trade-off, made explicit

Each pitch carries a derived, **qualitative risk posture** — the thing you
actually choose between:

- **A bold pitch** (large tonal shift, high conviction, ambitious production
  method, demands in domains they command) **widens** the outcome distribution:
  higher ceiling, lower floor. The auteur swing.
- **A faithful pitch** (small shift, serves the existing script, safe method,
  few demands) **narrows** it: dependable, rarely transcendent. The safe pair of
  hands.

So the bake-off decision is *"which creative bet do I want on this film,"* not
*"which director scores highest."* Two pitches can carry the same expected
quality with completely different distributions — precisely the P1 test. A
prestige studio chasing awards takes the bold swing; a studio protecting a
franchise takes the safe hands. Identity expresses itself in the choice (P5).

### 4.3 The bet resolves in production, not at hire (P1/P2)

Critically, the pitch's promises do **not** resolve into a number at the moment
you pick. They resolve **downstream**, through systems that already exist:

- the **tonal shift** changes the *realized* tone the audience/commercial models
  read at release (a bet on the market);
- the **production approach** feeds the production-risk profile and the on-set
  event stream (P2 — variance lives in the shoot);
- the **previewed demands** become the actual `CreativeDemand`s you resolve
  during development — now *pre-agreed* and *visible*, so less of a surprise, but
  chosen by you with eyes open.

This is why the pitch widens or narrows the distribution *endogenously*
(P1) and why the finished film can still be explained from its recorded history
(P4). The pitch is where the bet is *chosen*; production is where it is *paid*.

---

## 5. Data & engine shape (pure, rebalanceable)

- **`engine/directorAppeal.ts` (extend).** Add `computeDirectorAppetite`; replace
  the flat `scriptFit` factor with it; fold ego/relationship into the threshold.
  Lift `toneDistance` into a shared helper (currently private to
  `creativeDemands.ts`). No new stored fields — appetite is *derived* (P8).
- **`engine/directorPitch.ts` (new).**
  `generateDirectorPitch(director, script): DirectorPitch` (deterministic),
  `pitchRiskPosture(pitch): 'faithful' | 'balanced' | 'bold'` (derived),
  `describePitch(director, script, relationship): PitchRead` (qualitative,
  relationship-gated). Reuses `deriveDirectorAptitudes`, `toneDistance`,
  `generateCreativeDemands`, `DirectorProductionStyle`.
- **Types.** A `DirectorPitch` record and a `DirectorSlotMode = 'approach' |
  'seek-pitches'` on the draft's director role. Reuse the reserved
  `PendingSequelDevelopment.pitchId` / `path: 'pitch'` seams
  (`types/index.ts:2181`) so the *origination* pitch (a director pitching to
  **start** a project on an IP — `DESIGN_REVIEW_development_office_paths.md`
  Path 3) and this *hiring* pitch share one `Pitch` shape.
- **State.** New reducer actions: `OPEN_DIRECTOR_PITCHES`, `SUBMIT_DIRECTOR_PITCH`
  (engine-driven on the day tick, like `tickCastingCalls`), `SELECT_DIRECTOR_PITCH`
  (attaches + freezes the pitched bets), `PASS_ON_PITCHES`. Attachment reuses the
  existing `SET_TALENT_FOR_ROLE` path + `syncDirectorDemands`, seeding the demands
  from the previewed set.
- **UI.** `RoleHiringDrawer` gains the mode toggle; a new pitch-review surface
  (cards, not a slider). The marquee offer path is the existing drawer with the
  §2 read added. **No raw numbers** anywhere player-facing.

**Save policy.** Per `CLAUDE.md`, this is pre-launch: bump `SAVE_KEY`, target the
current schema, write no migrations.

---

## 6. Why this satisfies the philosophy (self-check)

- **P1 endogenous variance** — a pitch is a distribution-shaper, chosen by the
  player, paid in production. Bold pitches widen; safe pitches narrow. No
  release-time roll.
- **P6 trade-offs** — you choose between ceiling-and-risk (bold) and
  reliability (faithful); money can't buy past a creative misfit.
- **P7 connect, don't duplicate** — appetite, tone distance, aptitudes, demands,
  production style, patience/walk all already exist; this reads them.
- **P8 derive strengths** — appetite and pitch posture are computed, not stored;
  only the intrinsic pitch *choices* (tonal shift, method, demand set) are frozen.
- **Legibility (P3/P4)** — the pre-hire read names creative causes; previewed
  demands make the director's intentions visible before you commit.

---

## 7. Sequencing

1. **Phase A — personal appetite in the offer model** (§2). Standalone; fixes the
   reported "vending-machine A-lister" feel. Smallest, highest-value PR. No new UI
   surface beyond a richer read.
2. **Phase B1 — the `DirectorPitch` object + `describePitch`** (§4), behind the
   scenes, unit-tested, not yet wired to a bake-off UI.
3. **Phase B2 — the bake-off flow** (§3): slot mode, timed pitch submission on the
   day tick, the pitch-review surface, select/pass, loser consequences.
4. **Phase B3 — pitched bets resolve downstream** (§4.3): wire the tonal shift and
   production approach into the realized-tone / production-risk reads (may pigg-back
   on existing execution-strategy plumbing).
5. **Later** — development-exec hire (sharpens pitch reads, §3.2); the origination
   pitch feed (Path 3) sharing the `Pitch` shape.

Each phase leaves the sim shippable and measurable against the existing suite and
diagnostic gates, following the casting redesign's cadence.
