# 08 — VFX, Stunts & Specialty Crafts

*The disciplines that create difficulty rather than just cost.* VFX, stunts,
practical effects, prosthetics, and animation each have their own pipeline,
their own failure modes, and their own relationship to schedule — and on modern
studio films they frequently dominate both budget and calendar.

> **Domain reference.** Real industry, not this game. See `README.md`.

---

## 1. Visual effects

### 1.1 Scale

| Film type | VFX shot count | VFX budget |
|---|---|---|
| Drama with invisible fixes | 50–300 | $0.5M–$3M |
| Genre / thriller | 300–800 | $3M–$15M |
| Studio action | 800–1,500 | $20M–$60M |
| Superhero / large tentpole | 1,500–3,000+ | $60M–$150M+ |

"Invisible VFX" — wire removal, set extension, weather replacement, crowd
tiling, beauty work, period cleanup (removing modern signage, aerials, road
markings) — is the majority of shots on most films, including ones no one
thinks of as VFX films.

### 1.2 The pipeline

```
PREVIS ─► shoot with plates & data ─► POSTVIS ─► TURNOVER ─► vendor work ─► FINAL
```

**Pre-shoot**
- **Concept art / design** for creatures, environments, vehicles.
- **Previs** — rough animated versions of sequences, used to plan coverage,
  budget, and stunt requirements before shooting.
- **Techvis** — previs converted into actual camera, crane, and rig
  specifications for the shooting day.
- **Bidding** — the VFX producer sends the breakdown to vendors, who bid per
  shot or per sequence. Awards are usually split across several vendors
  by sequence or by discipline.

**On set** — the VFX supervisor's job is data capture, and getting it wrong is
unrecoverable:
- **Plates** shot with the right lens, motion, and lighting.
- **HDRI / lighting reference** — chrome and grey balls, panoramic captures.
- **LiDAR / photogrammetry scans** of sets, locations, props, and actors.
- **Camera and lens metadata** — focal length, height, tilt, distortion.
- **Tracking markers**, clean plates, and **witness cameras**.
- **Colour charts** for matching.

**Post**
- **Postvis** — temp versions cut into the film so the editor can judge the
  scene long before finals exist.
- **Turnover** — locked shot counts, plates, and reference delivered to
  vendors. Changes after turnover are chargeable.
- **Iteration**: layout → animation → FX simulation → lighting/rendering →
  **compositing**, with client review rounds ("**dailies**" on the vendor
  side) at each stage. A shot may go through 5–30 versions.
- **Final** into the DI (`07-postproduction.md` §6).

### 1.3 Disciplines within VFX

Matchmove/tracking · layout · modelling · texturing/look-dev · rigging ·
animation · creature FX (muscle, cloth, hair) · FX simulation (fire, water,
destruction, smoke) · crowd simulation · matte painting/environments ·
lighting/rendering · compositing · rotoscoping and paint · stereo conversion ·
virtual production.

### 1.4 Virtual production

LED volumes (in-camera background projection driven by a real-time engine),
motion capture, simulcam, and real-time previs. Trade-off: it moves cost and
decision-making *earlier* (assets must exist before the shoot), buys in-camera
final pixels and correct interactive lighting, and reduces post-heavy
greenscreen work — but only where content is planned far enough ahead.

### 1.5 Why VFX schedules fail

- **Late picture lock** — shots are worked, then changed, then re-worked.
- **Shot count growth** during post as editorial invents fixes.
- **Design not locked** — a creature redesigned after animation has begun
  invalidates weeks of work.
- **Bad or missing on-set data**, forcing hand-tracking.
- **Vendor overload** — the industry is capacity-constrained at peak, and
  bidding is fixed-price, which compresses vendor margins and has driven
  repeated insolvencies.
- **Serial dependency** — compositing cannot start until lighting, which cannot
  start until animation, which cannot start until layout.

The structural consequence: **VFX is the long pole**, and a film's release date
is very often set by when the last few hundred shots can be finalled.

---

## 2. Practical special effects (SFX)

Everything created live, on set, by the SFX department.

| Category | Examples |
|---|---|
| **Atmospherics** | Rain towers, wind machines, snow, fog, smoke, dust |
| **Pyrotechnics** | Explosions, fireballs, burning sets, bullet hits (**squibs**) |
| **Mechanical effects** | Gimbals, motion bases, breakaway walls, collapsing structures, animatronics |
| **Rigs** | Car rigs (process trailers, pod cars), wire rigs, ratchets |
| **Water** | Tanks, dump tanks, wave machines |
| **Props FX** | Practical weapons, sparking devices, working machinery |

Characteristics that matter:

- **Reset time.** Most practical effects are one-shot. Resetting a fire gag or
  a destroyed set piece takes hours, so the effect is usually covered by
  multiple cameras and shot once — which shapes the whole day's plan.
- **Safety-critical.** Pyro and firearms are licensed activities with legal
  regimes, permits, and mandatory briefings.
- **Interacts with everything.** Water, fire, and dust affect camera, sound,
  costume (multiples), makeup, and crew hours.

Practical and digital are complementary, not alternatives: most convincing
effects work is a practical element extended or cleaned up digitally.

---

## 3. Stunts and action design

### 3.1 The department

Led by the **stunt coordinator**, who designs the action, hires performers,
runs rehearsals, and signs off safety. On large films the coordinator is
frequently also the **second unit director**, and the action is designed as a
parallel production with its own previs, schedule, and budget.

Specialists: fight choreographer, precision/stunt driving coordinator, wire and
rigging specialists, high fall specialists, fire burn performers, motorcycle
and equestrian specialists, water safety.

### 3.2 How action gets made

1. **Design** — from the script, in concert with the director; often previs'd
   or shot as a rough **stunt-vis** with the stunt team performing it.
2. **Casting doubles** — a stunt double matched to each principal for build,
   height, and colouring.
3. **Training** — principal actors train for weeks to months for fight or
   driving work; the more an actor can perform, the more the camera can be
   close and the fewer cuts are needed.
4. **Rehearsal on the actual rig**, incrementally (half-speed, then full).
5. **Shooting** — multi-camera, safety briefing, medics standing by, an agreed
   abort signal.
6. **Post** — face replacement, wire removal, and speed ramping are near
   universal now; digital doubles handle what is genuinely impossible.

### 3.3 Constraints

- Stunt performers are paid **scale plus adjustments per gag**, negotiated by
  risk — a high fall or fire burn is individually priced.
- Insurance and safety regimes cap what is permitted; some sequences are
  refused outright.
- A serious injury stops the unit, triggers an investigation, and can end the
  production.

---

## 4. Prosthetics and creature effects

A distinct craft, usually contracted to a specialist shop.

Pipeline: design/maquette → **life cast** of the performer → sculpture →
mould → foam latex or silicone appliance → **application** on set → daily
maintenance → **removal** (which destroys most appliances, so each shooting day
consumes a new set).

Practical implications:

- **Lead time is months**, and cannot be compressed past the curing and
  testing steps.
- **Application time** of 2–6 hours dictates the actor's call and therefore the
  whole day's shape; removal adds an hour at wrap, and union rules count much
  of this as work time.
- **Consumables per day** are a real, recurring budget line.
- **Animatronics and puppetry** for creatures, with puppeteers on set and
  digital cleanup of rods and rigs afterwards.

---

## 5. Animation (as a production model)

Animated features run on a fundamentally different plan: there is no shoot, so
"production" is a continuous 2–4 year pipeline.

```
Development ─► Story/boards ─► Voice record (scratch, then final)
  ─► Editorial reel ─► Layout ─► Animation ─► Simulation
  ─► Lighting/rendering ─► Comp ─► Finishing
```

Distinctive features:

- **The story reel** (animatic) is the film, continuously, from very early —
  animated features are edited before they are animated.
- **Voice recording** comes first and is re-recorded repeatedly across years.
- **Story is revised iteratively** in ways live-action cannot afford: a
  sequence can be thrown out and re-boarded at relatively low cost, which is
  why animated features go through many more story iterations.
- **Budget shape** is labour and render, with essentially no location, cast
  day, or weather risk — and no schedule leverage from "shooting faster".
- **Cost**: $100M–$200M for a studio CG feature; the marketing spend is
  comparable to live-action tentpoles.

---

## 6. Cross-cutting: how ambition becomes difficulty

A useful mental model for all of §1–§5. Each specialty converts **ambition**
into **difficulty** through the same four terms:

| Term | Meaning |
|---|---|
| **Requirement** | What the script demands (a creature, a car chase, a burning building) |
| **Approach** | How it's chosen to be achieved — practical, digital, hybrid, or avoided |
| **Resource** | Money, prep time, and the skill of the head of department |
| **Realisation** | What actually ends up on screen, after the shoot's events and post's iterations |

The gap between requirement and resource is where failures come from — and the
failure mode is characteristic per department: VFX fails as *unfinished or
unconvincing shots* and a slipped date; stunts fail as *injury or a refused
sequence*; SFX fails as *lost days*; prosthetics fail as *lost hours every
day*; art department fails as *a set that isn't ready*.
