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

**Cost per shot** is the number producers actually reason with, and it spans
three orders of magnitude:

| Shot type | Typical price | Artist effort |
|---|---|---|
| Rig/wire removal, simple paint-out | $500–$3,000 | 2 hours – 2 days |
| Screen comp, split-screen, beauty | $2,000–$8,000 | 1–4 days |
| Set extension, 2.5D environment | $8,000–$30,000 | 1–3 weeks |
| Full-CG environment, hero matte | $30,000–$120,000 | 3–8 weeks |
| Hero creature/character shot | $50,000–$300,000+ | 6–20 weeks across departments |
| Large-scale destruction / water sim | $80,000–$400,000 | Simulation-bound, weeks of wall clock |

A tentpole's *blended* average lands around **$30K–$60K a shot**, which is why
"we added 200 shots in the edit" is a $6M–$12M sentence, not a scheduling
inconvenience. Headcount scales with it: a 2,000-shot tentpole may have
**800–2,000 artists** working across six to twelve vendor facilities on three
continents, peaking eight to twelve weeks before final delivery.

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
  by sequence or by discipline. See §1.7.

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
  side) at each stage. A shot may go through 5–30 versions. See §1.9.
- **Final** into the DI (`07-postproduction.md` §6).

### 1.3 Disciplines within VFX

Every one of these is a separate career with its own software, its own labour
market, and its own idea of what "finished" means. The durations below are per
shot or per asset for one artist, at studio-feature quality, and they are what
turns a shot count into a schedule.

| Discipline | What the work actually is | Typical duration |
|---|---|---|
| **Matchmove / tracking** | Solving the real camera's path, lens, and distortion from the plate so CG sits still in it; then object tracks for props and body tracks for actors. Unglamorous, entirely blocking — nothing downstream can start without it. | 0.5–2 days a shot; a handheld long take with no markers, a week |
| **Layout** | Placing CG geometry into the solved scene, setting scale and staging, cutting CG cameras for full-CG shots. On a full-CG sequence layout is effectively cinematography. | 1–3 days a shot |
| **Modelling** | Building geometry — hard-surface (vehicles, weapons, architecture) and organic (creatures, faces). Topology matters because it decides whether the thing can deform. | Prop 2–5 days; vehicle 2–4 weeks; hero creature 4–12 weeks |
| **Texturing / look-dev** | Painting surface detail and authoring the shader response — how the thing reacts to light. Signed off under lighting conditions from the film, not a neutral turntable. | Prop 2–5 days; hero character 4–10 weeks |
| **Rigging** | Building the control system an animator drives — skeleton, deformation, facial controls, blendshapes. Invisible to the audience; if it is bad, every animator on the show is slowed for months. | Hero biped 6–12 weeks; a face rig alone 4–8 weeks |
| **Animation** | Performance. Keyframed or motion-capture-derived, but mocap is always cleaned and re-timed by hand. The bottleneck discipline on any creature show. | **1–3 seconds of finished hero animation per animator per week** |
| **Creature FX (CFX)** | Muscle, fat, skin sliding, cloth, hair, feathers — everything that moves *because* the animation moved. Run as simulations on top of approved animation, which is why an animation note after CFX has started is expensive. | 1–5 days a shot, plus fix rounds |
| **FX simulation** | Fire, smoke, water, destruction, sand, magic. Wall-clock-bound: a large sim can take 12–48 hours to compute, so an artist gets one or two attempts a day regardless of how fast they think. | 1–4 weeks a shot; hero water/destruction longer |
| **Crowd simulation** | Agent-based crowds with behaviour libraries built from mocap cycles. Heavy setup, cheap per shot afterwards. | Setup 4–10 weeks; 2–5 days a shot |
| **Matte painting / environments** | Digital environments, from 2.5D projections onto cards to fully built worlds. The discipline that decides whether a film's landscapes feel like places. | Hero environment 1–4 weeks |
| **Lighting / rendering** | Lighting the CG to match the plate's light, then managing the render — which is a scheduled resource, not a button. Hero frames can take 4–100+ hours each. | 2–10 days a shot |
| **Compositing** | Assembling every element into the final image and making it belong: grain, lens distortion, defocus, edges, atmosphere, colour. The last hands on the shot and the discipline that most often rescues it. | Simple 2 hours; hero 3–15 days |
| **Rotoscoping and paint** | Hand-drawn mattes for elements that cannot be keyed, and removal of rigs, markers, crew, and modern intrusions. Volume work, heavily offshored, and the industry's usual entry point. | 1–5 days a shot per element; hero character roto longer |
| **Stereo conversion** | Generating a second eye from a 2D plate via roto and depth assignment. A separate vendor tier with its own schedule, working from approved finals. | Priced per minute; a whole-film pass is a months-long parallel track |
| **Virtual production** | Real-time environments, LED volumes, simulcam, on-set motion capture. Sits before the shoot rather than after it. See §1.4. | Content built 8–20 weeks *ahead* of the shoot |

Two structural facts follow from this table. First, the disciplines are
**serial** — a lighting note cannot be actioned before animation is approved,
and an animation note received during lighting throws away the lighting.
Second, the durations are **per artist**, so schedule is bought with headcount
up to the point where the review bandwidth of the director and the supervisor
becomes the constraint, which happens sooner than producers expect.

### 1.4 Virtual production

LED volumes (in-camera background projection driven by a real-time engine),
motion capture, simulcam, and real-time previs. Trade-off: it moves cost and
decision-making *earlier* (assets must exist before the shoot), buys in-camera
final pixels and correct interactive lighting, and reduces post-heavy
greenscreen work — but only where content is planned far enough ahead.

**What a volume actually is.** A curved LED wall — commonly 60–80 feet across
and 20–25 feet high, wrapping 180–270 degrees — with an LED ceiling, built from
panels of roughly 2.3–2.8mm pixel pitch. The camera is tracked in real time
(optical or infrared marker systems), and the engine renders the region inside
the camera's **frustum** in correct perspective at full quality while the rest
of the wall runs a cheaper version whose only job is to light the set.

**Who is on the stage.** The normal unit, plus a **brain bar** of 6–15 people
who did not exist on a film crew fifteen years ago:

| Role | What they own |
|---|---|
| **Virtual production supervisor** | The whole system; the counterpart to the VFX supervisor |
| **Stage / volume operator** | Panel health, genlock, colour calibration, brightness |
| **Real-time engine operators (2–5)** | Loading, dressing, and adjusting environments live |
| **Tracking engineer** | Camera tracking calibration and drift |
| **Content / environment team** | The scenes themselves, prepared for weeks beforehand |
| **Colour scientist / imaging** | Matching LED output to the camera's colour response |

**What it demands of prep.** This is the part productions consistently
underestimate. Every environment that will appear on the wall must be
**designed, built, optimised, lit, and approved before the shooting day** —
typically finished 4–8 weeks out with 8–20 weeks of build behind it. That
inverts the normal cash curve: money that would have been spent in post is
spent in prep, before the film has a cut and before anyone knows which
environments survive the edit. If a scene is dropped, the asset is a total
loss. If the director changes their mind on the day, the answer ranges from
"give us twenty minutes" (time of day, sun position, dressing) to "that is a
three-week rebuild" (new geography, new architecture).

**What it is genuinely good for**, in rough order of value:

1. **Vehicle interiors** — driving, cockpits, spacecraft. Correct moving
   reflections and interactive light, and the actor can see what they are
   reacting to. This alone justifies many volumes.
2. **Reflective and translucent subjects** — chrome, glass, water, visors,
   wet streets — where greenscreen spill and roto are brutal.
3. **Environments with strong, specific light** — sunsets, firelight, neon —
   because the light falls on the actors for real.
4. **Locations that cannot be travelled to**, on a schedule that cannot afford
   a company move.

**Where it fails.** Moiré and colour fringing at certain lens/pitch/distance
combinations; **parallax breakdown** when the camera translates too far and the
2D-ness of a distant background becomes visible; limited depth cueing — a 70ft
volume cannot sell a genuinely distant vista on a long lens; a flat, samey
lighting signature across a whole film; and the cost floor, since stage rental
runs roughly **$20K–$70K a day** before content. Productions that succeed with
volumes treat them as *one tool in the schedule* — a week of driving, a week of
cockpit — rather than a philosophy.

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

### 1.6 Who's actually who

VFX has two parallel org charts — the production's and the vendor's — and most
confusion about the discipline comes from collapsing them.

**On the production side** (hired by the producer, works for the film):

| Role | Reports to | Owns |
|---|---|---|
| **VFX Supervisor** | Director and producer | The *look* and the *method*. What is shot practically, what is built digitally, whether a plate is usable, whether a shot is finalled. |
| **VFX Producer** | Producer / line producer | The *money* and the *schedule*. Breakdown, bids, awards, cash flow, vendor performance, change orders. |
| **VFX Coordinator(s)** | VFX producer | Turnovers, submissions, notes distribution, the shot database. On a tentpole there are 3–8. |
| **VFX Editor** | VFX supe / editor | Cutting temps and postvis into the film, pulling plates at correct handles, tracking versions against the cut. The hinge between editorial and VFX. |
| **On-set VFX crew** | VFX supe | Data wrangler, LiDAR/scanning tech, witness-camera operator, plate photographer. 2–6 people on a big show. |
| **Previs / Postvis Supervisor** | Director / VFX supe | The animated planning of sequences before and during post. |
| **Digital Asset / Production Manager** | VFX producer | Which vendor owns which asset, and how assets move between vendors. |

**On the vendor side** (employed by the facility, works for many films):

| Role | Owns |
|---|---|
| **Visual Effects Supervisor (facility)** | The vendor's creative output; the person who takes the client's notes and turns them into instructions |
| **CG Supervisor** | Everything upstream of comp — assets, animation, FX, lighting |
| **Compositing Supervisor** | Final image quality and integration |
| **Visual Effects Producer (facility)** | Bid accuracy, crewing, margin, delivery |
| **Production Manager / Coordinator** | Scheduling artists against shots, day by day |
| **Department leads** | Model, texture, rig, anim, FX, lighting, comp leads — the people who actually review artists' work daily |
| **Pipeline / R&D / systems** | The software and infrastructure everything runs on; 5–15% of a facility's staff |

The two supervisors are the key relationship on any show: the production's
supervisor sets intent, the facility's supervisor decides how to hit it, and
when they distrust each other the shot count silently doubles.

### 1.7 How a bid is actually built and awarded

**When** — the first rough bid happens at greenlight, off the script alone, to
put a number on the top sheet. The real bid happens **6–12 weeks before the
shoot**, off previs and a breakdown. It is re-bid after the shoot against the
actual plates, and this second number is almost always higher.

**Step by step:**

| Stage | What happens | Who |
|---|---|---|
| **Breakdown** | Every VFX moment in the script is listed, sequence by sequence, with a description, an estimated shot count, and a complexity tier | VFX supe + VFX producer |
| **Methodology** | For each sequence: practical, digital, or hybrid — and if digital, what has to be shot to enable it | VFX supe, director, SFX supe, stunt coordinator, PD |
| **Bid package** | Script pages, previs, storyboards, concept art, reference, plate descriptions, format/resolution specs, delivery dates, temp dates | VFX producer |
| **Bid meetings** | Each vendor is walked through the package in a 2–4 hour session and asks the questions that expose what the production has not decided | VFX producer + supe, vendor supe + producer |
| **Vendor bids return** | 2–4 weeks later, priced per shot or per sequence, with assumptions stated | Vendor |
| **Levelling** | Bids are compared line by line — different vendors have bid different assumptions, and the cheapest number is usually the one that misunderstood the shot | VFX producer |
| **Award** | Split by sequence and by asset, not scattered by shot | Producer, studio, VFX producer |
| **Contracting** | Master services agreement + a statement of work per sequence, with a version-count assumption, a change-order mechanism, and milestone payments | Business affairs |

**What a vendor's number is made of.** Bids are built bottom-up in
**artist-weeks per discipline**, not top-down from a shot price. A hero shot is
estimated as, say, 3 weeks animation + 2 weeks CFX + 2 weeks FX + 1.5 weeks
lighting + 2 weeks comp + a share of the asset build, each multiplied by a
loaded internal rate (salary plus overhead plus facility plus render), then
marked up. Studio-feature artist day rates run roughly **$400–$900** depending
on discipline and region; facilities bill at something like 1.5–2.5× internal
cost. The critical hidden term is the **assumed number of client review
rounds** — typically three or four before approval. Everything past that is
theoretically a change order and practically absorbed.

**How the award is structured.** Splitting a film across vendors is done by
**sequence or by asset**, so that one facility owns a creature end to end. The
alternative — the same asset built at two facilities — means duplicated build
cost and two versions that never quite match, which the audience reads as the
character changing between scenes. Where sharing is unavoidable, one vendor is
named the **asset owner** and ships the build to the others, which still costs
2–6 weeks of translation per handoff.

**Payment shape** matters to whether a vendor survives the job: a mobilisation
payment of 10–30% at award, then milestones at turnover, first temp, and final
delivery, on 30–90 day terms. A vendor is therefore financing the production's
payroll for months, which is precisely why the ones with thin balance sheets
die in the gap between "we won the job" and "we got paid".

### 1.8 What the VFX supervisor actually does, all year

**Prep (3–6 months, sometimes a year on a tentpole).** The supervisor is a
department head in prep even though their department barely exists yet.

- Reads the script for method, not for shots: *how* does this happen, and what
  does the camera have to do to allow it.
- Sits in concept art reviews with the director and production designer; a
  creature or environment approved here is what will be built, so the
  supervisor's job is to say early which designs are unbuildable, unlightable,
  or unanimatable at the budget.
- Runs previs and techvis with the previs supervisor; attends tech scouts
  (`04-preproduction.md` §5.2) and answers, out loud, how much of this
  building gets built and where the bluescreen goes.
- Negotiates the practical/digital line with the SFX supervisor, the stunt
  coordinator, and the PD. A good supervisor gives away work here — arguing
  *for* the practical car flip, *for* the built set — because plates with real
  elements are cheaper and more convincing than the digital equivalent.
- Runs **camera tests**: the actual camera, the actual lenses, against the
  actual bluescreen and the actual prosthetic, weeks before the shoot.
- Writes the methodology document that becomes the bid package.

**Shoot (the whole schedule, on set for VFX days).** The job is data capture
under time pressure, and the daily reality is negotiating with the 1st AD for
minutes.

- Reviews each set-up: is this plate shootable, is anything in frame that must
  come out, does the camera move in a way the track can solve.
- Directs capture of the extras that make post possible: a **clean plate**
  (the shot with the actors removed, 20–90 seconds of the unit's time and the
  most-skipped item on any film), HDRI and grey/chrome ball, a lens grid, a
  colour chart, tracking markers placed where they can be removed, LiDAR of the
  set before it is struck.
- Keeps the **VFX log**: for every set-up, the lens, T-stop, filtration, camera
  height, tilt, distance to subject, frame rate, and what the shot is for.
- Answers, ten times a day, the only question the director asks them: *can you
  fix that?* The honest supervisor's value is in the "no" — the boom in shot,
  the wrong lens, the impossible eyeline — while it can still be re-shot for
  free rather than for $40,000 in post.
- Rides second unit and splinter units, or delegates to an associate
  supervisor; on a big show there are two or three supervisors covering units.

**Post (6–18 months).** The rhythm becomes weekly and relentless.

- Walks the cut with the editor and VFX editor to establish the real shot
  count, which is always higher than the breakdown.
- Runs **client reviews** with the vendors — daily on a big show, per vendor,
  by time zone (§1.10).
- Presents to the director once or twice a week with a curated selection: what
  has moved, what needs a decision, what is about to become expensive.
- Guards the **temp**: postvis and temp comps shown at test screenings shape
  what the director expects finals to look like, which is both the tool and
  the trap.
- Signs off finals into the DI, then watches the grade change them
  (`07-postproduction.md` §6) and re-approves.

### 1.9 The review cycle, and why a shot reaches version 30

**The two-layer loop.** Nothing goes to the client raw. At the vendor, artists
submit to their **department lead** and then to the facility's **CG or comp
supervisor** in internal dailies each morning; typically only one in two or
three internal versions is judged good enough to send. That approved version is
**published to the client** with a version number (v001, v002…), and enters the
production's review.

**A single round, in order:**

1. Vendor submits overnight; the coordinator posts it to the review platform.
2. The production's VFX supe reviews first, alone or with the VFX editor,
   often in the cut so the shot is judged in context rather than in isolation.
3. Shots that are ready are put in front of the director, in a proper theatre
   or a colour-managed review room, usually as a sequence rather than singly.
4. Notes are captured live — spoken, drawn as annotations on the frame,
   timestamped — by the coordinator.
5. Each shot is given a **status**: `APPROVED` / `FINAL`, `CBB` ("could be
   better" — acceptable but revisit if there is time), `HOLD` (blocked on a
   decision elsewhere), `OMIT` (cut from the film), or notes-for-revision.
6. Notes go back to the vendor with the annotated frames; the vendor's
   supervisor translates them into department instructions.
7. Next version, usually 24–72 hours later.

**Why versions accumulate.** A shot that goes to v30 has almost never had
thirty rounds of "make it better". It has had a small number of *category
changes*, each of which resets progress:

| Cause | What it costs |
|---|---|
| **The edit changed** | New in/out points, a new plate pull, sometimes a different take — everything downstream re-runs |
| **An upstream note arrives late** | An animation note given during lighting throws away lighting and comp; the single most expensive kind of note |
| **Design not locked** | The creature's horns change in month four; model, texture, rig, and every approved shot go back |
| **Context** | The shot was approved alone and fails next to its neighbours — brightness, scale, or pace |
| **Notes are subjective and drifting** | "More weight" from three people meaning three things; a supervisor's job is to convert this into instructions |
| **Temp love** | The director has watched the postvis 200 times and the final is now "wrong" for not being it |
| **Approval bandwidth** | The director is on another film, in the mix, or on a press tour; shots sit at v12 for three weeks and then all move at once |
| **DI and stereo** | The grade reveals something the review didn't; the shot re-opens after "final" |
| **The last 10%** | Contact shadows, edge work, atmosphere, grain, defocus — each worth one version, all of them what makes the shot work |

A healthy show finals invisible shots in 3–6 versions and hero shots in 10–20.
Beyond about 25 the shot is usually not a craft problem but a decision problem:
somebody has not chosen something.

### 1.10 Running vendors across time zones

A tentpole's vendors are spread across Los Angeles, Vancouver, Montreal,
London, Mumbai, Chennai, Sydney, Wellington, Seoul, and Shanghai — a spread
driven by tax incentives (`03-financing-and-dealmaking.md` §6) far more than by
craft. The practical consequences:

- **Follow-the-sun is real and useful.** Notes given at the end of a Los
  Angeles day arrive at the start of the Mumbai and London day, and the next
  version is waiting when Los Angeles wakes. Handled well this yields close to
  two working shifts a day; handled badly it means a 24-hour penalty on every
  ambiguous note, because nobody is awake to ask.
- **Review is remote and synchronised.** Frame-synced review sessions over
  dedicated media networks let both ends scrub the same frame and draw on it.
  The alternative — emailed notes on stills — reliably loses the point.
- **Every vendor has "client hours."** The facility's supervisor and producer
  work the client's day, not their own; a London vendor on an LA show has
  supervisors living at 6pm–1am, which is a real attrition cost.
- **One person must hold the whole film.** The production's supervisor and
  producer are the only people who see all vendors' work. Consistency across
  facilities — the same creature, the same city, the same weather — is their
  problem alone, and is enforced with shared **look bibles**, approved lighting
  references, and shared LUTs.
- **Security regimes** (watermarking, locked-down networks, no phones in review
  rooms, per-artist forensic marking) are contractual and add friction to every
  handoff.
- **Handoffs between vendors** are where films quietly lose weeks. Different
  facilities have different pipelines, colour management, and units; moving a
  built asset is a 2–6 week translation job, not a file transfer.

### 1.11 The economics of fixed-bid work, and why vendors fail

VFX is unusual in being a **fixed-price** business selling a product whose
specification is not known when the price is set. The consequences are
structural, and they are why the sector's history includes facilities winning
Academy Awards weeks after filing for bankruptcy.

**Where the margin goes:**

| Pressure | Mechanism |
|---|---|
| **Fixed bid, moving target** | The bid assumes 3–4 versions and a locked cut; both assumptions are routinely false, and the vendor eats the difference |
| **Change orders not enforced** | Contractually the vendor can charge for the change; commercially, invoicing a studio you want to work for again is a decision with consequences |
| **Free work to win work** | Test frames, "look development" during bidding, and a free hero shot at pitch stage are normalised |
| **Subsidy chasing** | Awards follow tax credits, so vendors open offices in incentive jurisdictions and carry that footprint through the troughs |
| **Currency** | Bid in dollars, payroll in pounds, rupees, or Canadian dollars, over an 18-month job |
| **Payment terms** | 30–90 days, on milestones, with the vendor funding hundreds of salaries in the meantime |
| **Peaky demand** | Facilities must crew up for a peak and are carrying the same people during the trough between shows |
| **Overtime** | Absorbed. The artist works the weekend; the bid did not price the weekend |

Sector margins are thin — commonly discussed in the **single digits** — against
a business that is essentially all payroll. Two well-known and public
illustrations of the shape: Rhythm & Hues filed for bankruptcy in early 2013,
days before winning the Academy Award for *Life of Pi*; Digital Domain's parent
filed in 2012. Neither was caused by bad artistry.

**Why the model persists.** Studios buy certainty — a fixed number they can put
on a top sheet — and there are more facilities than there are tentpoles, so
competitive bidding pushes prices to the point where the winner is often the
vendor who misjudged the work. The countermeasures that exist are partial:
time-and-materials or "cost-plus" deals on genuinely undefined work, awarding
by sequence so the vendor controls its own dependencies, and unionisation
efforts among VFX crews, which gathered real momentum in the 2020s.

### 1.12 What separates a great VFX supervisor from a poor one

The skill axis. Note how little of it is about knowing software:

1. **Method judgement.** Choosing *how* to achieve a shot — practical element,
   in-camera, hybrid, full CG — better and earlier than anyone else in the
   room. This one judgement moves cost by multiples and is made in prep.
2. **Saying no on the day.** The value of a supervisor on set is in the
   sentence "we cannot fix that, we have to go again", said while it is free.
   A supervisor who says yes to everything is buying the director's goodwill
   with the post budget.
3. **Giving work away.** Great supervisors argue for the built set and the real
   explosion. Weak ones accept everything into post because it grows their
   department, and end up defending 2,400 shots they cannot finish.
4. **Note translation.** Converting "it feels fake" into "the contact shadow is
   missing and the animation has no anticipation before the step" — a
   supervisor who passes vague notes through unfiltered doubles the version
   count of every shot they touch.
5. **Knowing what is expensive.** Which requests are twenty minutes and which
   are three weeks, instantly, without asking the vendor. This is what allows
   them to offer the director an alternative rather than a refusal.
6. **Reading a shot's readiness in context.** Judging in the cut, at speed, at
   the right brightness — not admiring a hero frame in isolation.
7. **Vendor relationships.** Facilities do their best work for supervisors who
   are clear, decisive, and do not humiliate artists in reviews. This is not a
   niceness argument; it decides whether the best crew is put on your show.
8. **Consistency across the film.** Holding one look across eight vendors so
   the creature does not change species in act three.
9. **Taste.** Ultimately the job is to know when an image is convincing and
   when it is nearly convincing, which is the difference the audience sees.

**And the VFX producer**, whose skill axis is different and equally decisive:

1. **Bid realism** — knowing which vendor bid is low because they are efficient
   and which is low because they misread the sequence.
2. **Shot count forecasting** — projecting the real final count from the
   breakdown, and being right, because the schedule is built on it.
3. **Award structure** — splitting the film so vendors own their dependencies.
4. **Cash flow discipline** — paying vendors on time, because a vendor in
   distress crews your show with whoever is left.
5. **Change control** — recording every change from the moment it happens, so
   the conversation about who pays is evidential rather than emotional.
6. **Escalation timing** — knowing three months out that a vendor will miss,
   and re-awarding while there is still time, rather than discovering it in
   month sixteen.

### 1.13 What success and failure look like

**Success** is invisible: the audience does not know which shots were VFX, the
film finals on schedule, the last shot arrives at the DI with days rather than
hours in hand, and the supervisor's name is not in any trade story.

**Failure**, in rough order of severity:

| Failure | Consequence |
|---|---|
| Shots not finished by the delivery date | Release date moved, or shots delivered to theatres in worse versions; both are public and expensive |
| Bad or missing on-set data | Hand-tracking and hand-roto: a $6,000 shot becomes a $30,000 shot, silently, hundreds of times |
| Design approved late | Asset build restarts; on a creature show this is a 2–4 month hit that no amount of money buys back |
| A vendor fails mid-show | Sequences re-awarded, assets translated, 6–12 weeks lost and paid for twice |
| Shot count growth unchecked | Budget overrun in the tens of millions; the most common single cause of VFX overages |
| Unconvincing hero shot | Reviews and audiences single it out; the effect becomes the story about the film (`16-critics-reviews-and-word-of-mouth.md`) |
| Too much coverage handed to post | Every "we'll fix it" compounds into a post schedule nobody has time for |
| Inconsistency across vendors | The audience reads it as continuity error without knowing why |

---

## 2. Practical special effects (SFX)

Everything created live, on set, by the SFX department.

### 2.1 The department

**Who** — the **SFX Supervisor**, who reports to the director and producer and
is a full head of department in their own right, *not* a subdivision of props or
VFX. Under them:

| Role | What they do |
|---|---|
| **SFX Supervisor** | Designs the effect, owns the risk assessment, and usually fires it personally |
| **SFX Foreman / Key** | Runs the floor crew day to day |
| **Pyrotechnician(s)** | Licensed; builds, places, and fires explosive and flame effects |
| **SFX Technicians (2–20)** | Build, rig, run, and reset. Fabrication skills: welding, machining, hydraulics, pneumatics, electronics |
| **Armourer** | Weapons: custody, condition, loading, checks. Often a separate licensed contractor |
| **SFX Workshop crew** | Off-site build of rigs and mechanical effects, often months ahead |

**When** — an SFX supervisor is engaged in prep alongside the other HODs,
typically **6–14 weeks before the shoot** on an effects-led film, because
mechanical rigs, breakaway sets, and gimbals have to be *built*. On the day
they are on set, and on big gags they are on set for the two or three days it
takes to rig before anyone shoots anything.

### 2.2 Categories

| Category | Examples |
|---|---|
| **Atmospherics** | Rain towers, wind machines, snow, fog, smoke, dust |
| **Pyrotechnics** | Explosions, fireballs, burning sets, bullet hits (**squibs**) |
| **Mechanical effects** | Gimbals, motion bases, breakaway walls, collapsing structures, animatronics |
| **Rigs** | Car rigs (process trailers, pod cars), wire rigs, ratchets |
| **Water** | Tanks, dump tanks, wave machines |
| **Props FX** | Practical weapons, sparking devices, working machinery |

### 2.3 How each is actually rigged and run

**Rain.** Rain towers — scaffold or telescopic stands 20–40 feet high with
sprinkler heads — plus rain bars for close work, fed by a water truck or a
hydrant tap. A modest rain set-up is 2–4 towers, 2,000–5,000 gallons an hour,
and a drainage plan; a street exterior is a dozen towers and a pump crew. The
non-obvious problems: **rain is invisible without backlight**, so the DP's
lighting plan and the rain rig are the same conversation; the water must be
warmed for actors in cold weather; the ground stays wet all day, which means
the schedule can only run one direction (dry scenes first, ever after wet);
and every costume needs 3–6 duplicates plus a drying tent.

**Wind.** Truck-mounted fans in the 200–400 horsepower class for large-scale
work, ducted electric fans and leaf blowers for close-up. Wind destroys
production sound completely, so any dialogue in a wind gag is going to ADR
(`07-postproduction.md` §3) and everyone knows it before the day starts.

**Snow.** Two entirely different problems. **Dressing snow** (the ground) is
laid days ahead — biodegradable foam, paper, or blankets — by a crew of ten,
and once laid the location is committed. **Falling snow** is machine-thrown
paper or plastic flake, or foam, delivered from condors or towers, and, like
rain, needs backlight to read. Environmental regulators increasingly restrict
what may be left on a location, and the clean-up is a contracted line item.

**Fog and smoke.** Glycol foggers and cracked-oil hazers for atmosphere; the
craft is **matching density shot to shot** across a day, which is why the SFX
crew re-hazes between every take and the operator watches a monitor rather than
the room. Smoke is a health-and-safety exposure with monitored limits and
mandatory ventilation breaks, and it slows a day by 3–8 minutes per set-up.

**Pyrotechnics.** The most heavily regulated thing on a set. In the US, the
supervisor holds a federal explosives licence plus state and local permits (in
California, a graded pyrotechnic operator licence); in the UK, a qualified
supervisor works under a documented risk assessment with the HSE regime and
local authority sign-off. Mechanically: charges are sized and placed by the
pyrotechnician, mortars are buried and aimed with debris caught by the mortar
design, flame effects run off propane bars with a dedicated fuel supply and a
purge line. Firing is from a board with a key, an arming step, and a dead-man
switch, and **the SFX supervisor fires it, not the AD**. Before the take: an
exclusion zone with measured distances, a briefing everyone signs, a fire crew
and medic standing by, radios cleared, and an agreed abort word that anybody
may say.

**Bullet hits (squibs).** Small electrically fired charges on a hit plate under
wardrobe, often with a blood bag, over body armour, run on wires to the firing
board. Practical squibs remain in use but have been substantially displaced by
digital hits — partly cost and reset time, mostly the risk calculus around
anything explosive on a performer.

**Mechanical effects.** Gimbals and motion bases — hydraulic or electric
platforms, six degrees of freedom, rated in tons, programmed and repeatable —
carry everything from a car interior to an entire ship set. Breakaways use
balsa, sugar glass, or urethane foam, and are built in quantity because each
one is single-use. Collapsing structures are pre-cut, held by pinned or
pneumatically released joints, and pulled by rams or winches on cue. All of it
is workshop work done weeks ahead: the gag on the day is the last five minutes
of a four-week build.

**Car rigs.** A **process trailer** or **lowloader** tows a picture car so the
actors can "drive" while the camera rigs to the trailer; a **pod car** puts a
stunt driver in a raised pod above the roof with the actor in the real driver's
seat; a **biscuit rig** does the same on a purpose-built chassis. All three
exist to give the actor a real environment without the actor driving, and all
three take 45–120 minutes to change configuration.

**Water.** The slowest medium on any set. Tank stages and dump tanks (releasing
thousands of gallons on cue), wave machines, and underwater units with a diving
supervisor. Water gags eat the day through **reset**: refilling a dump tank is
30–90 minutes, the actors need warming and drying, wardrobe needs multiples,
and every piece of electrical equipment near it is a separate safety question.

### 2.4 Reset time is the real constraint

Most practical effects are one-shot. What that means for a day's plan:

| Effect | Typical reset | Practical consequence |
|---|---|---|
| Bullet hit / squib on wardrobe | 20–45 min | Costume change, re-rig, re-touch makeup |
| Breakaway window / chair | 10–30 min | Held in multiples; reset is swap, not repair |
| Large explosion | 2–6 hours, often a whole day | Shot once, covered by 4–10 cameras |
| Burning set | Effectively never | One take; the set is consumed |
| Dump tank | 30–90 min refill | Two or three takes in a day, maximum |
| Rain (continuous) | Minutes to restart, all day to dry | Scene order is locked by wetness |
| Collapsing structure | 1–3 days if rebuildable, otherwise one-shot | Rehearsed dry, then fired once |
| Car flip / cannon roll | One-shot per vehicle | Priced per vehicle; duplicates are the budget |
| Full-body burn | 30–60 min plus performer recovery | Two or three burns a day is a hard ceiling |

The universal answer to a one-shot effect is **cameras**: six, ten, sometimes
twenty, at every useful angle and frame rate, because there is no second take.
This drives the day's crew, the equipment order, and the amount of data
editorial receives — a single explosion can generate more footage than a normal
shooting day.

### 2.5 The safety chain

The chain of responsibility is explicit and, in most jurisdictions, legally
defined (see also `06-principal-photography.md` §8):

1. **The producer** carries overall statutory responsibility for the safety of
   the production.
2. **The 1st AD** is responsible on the floor and runs the set; they call the
   safety meeting and they decide when the set is ready.
3. **The SFX supervisor** owns the effect itself — its design, its rigging, its
   firing, and the exclusion zones around it.
4. **The stunt coordinator** owns any performer inside it.
5. **A safety officer / fire marshal** attends any pyro or fire work, with fire
   appliances and a standby crew.
6. **A medic** (often two, plus an ambulance for high-risk days) is on set and
   named on the call sheet.
7. **Every person in the zone** is briefed before the take, signs the briefing,
   and holds an absolute right to abort with an agreed word.

The paperwork is not decoration: a written risk assessment, a method statement,
permits, and a signed briefing sheet are what an insurer and an investigator
read afterwards, and their absence converts an accident into a liability.

### 2.6 What separates a great SFX supervisor from a poor one

1. **Designing to what the camera will see.** The gag only has to work from the
   lens. A great supervisor builds the 30% of the effect that is in frame,
   spectacularly, and skips the rest.
2. **Reset thinking.** They plan the day around how many attempts exist, and
   tell the AD honestly — "you get two" — in prep, not at 4pm.
3. **Repeatability.** Turning a one-shot into a three-shot through clever
   rigging is where the craft's real economics live.
4. **Knowing the limit and saying so early.** The refusal in prep costs
   nothing; the refusal on the day costs a shooting day.
5. **Fabrication depth.** A shop that can machine, weld, and program its own
   control systems solves problems in hours that a hire-in shop solves in
   weeks.
6. **Integration with VFX.** Knowing what to give the digital team — a real
   flame element, real debris, real interactive light — rather than treating
   VFX as a rival department.
7. **Calm.** The person firing an explosive with 150 people in a zone must be
   unhurried under a producer's pressure, and must be seen to be.
8. **A record with no incidents.** In this discipline, the reputation *is* the
   qualification, and it is checked.

### 2.7 What failure looks like

| Failure | Consequence |
|---|---|
| Effect misfires or under-delivers | Reset consumes the day; the scene is rescheduled or reduced |
| Effect over-delivers | Damage to set, camera, or people; work stops pending investigation |
| Reset time misjudged | Half a day lost, and the day's remaining scenes pushed |
| Sound ruined by wind/rain/fans | Entire scene to ADR; performances rebuilt in a booth |
| Continuity of atmosphere lost | Smoke or wetness jumps between angles; shots become unusable in the cut |
| Injury | Unit stands down; statutory investigation; insurance claim; potential criminal exposure |
| Practical abandoned late for digital | An unbudgeted seven-figure VFX line arrives in post with no schedule for it |

Practical and digital are complementary, not alternatives: most convincing
effects work is a practical element extended or cleaned up digitally. See §9.

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

The full department on an action film:

| Role | Reports to | Owns |
|---|---|---|
| **Stunt Coordinator** | Director and producer | The design, the personnel, the risk assessment, the sign-off |
| **Assistant Stunt Coordinator** | Coordinator | The floor, the paperwork, the rigging schedule |
| **Fight Choreographer** | Coordinator | Hand-to-hand and weapons choreography; often a discipline specialist |
| **Stunt Rigger(s)** | Coordinator | Wires, descenders, ratchets, airbags, the physical rig and its load ratings |
| **Stunt Doubles** | Coordinator | Doubling a named principal; cast for build, height, colouring, and skill |
| **Stunt Performers / Utility stunts** | Coordinator | The crowd of the sequence: falls, hits, driving, reactions |
| **Precision Drivers** | Driving coordinator | Vehicle work at speed, to marks |
| **Safety / Standby crew** | Coordinator + 1st AD | Medics, water safety, fire safety, spotters |

**When** — the coordinator is hired **8–20 weeks before the shoot** on an
action film, sometimes during development if the action *is* the film. They
work through prep, all through the shoot, and into post for face replacement
and speed-ramp supervision.

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
  risk — a high fall or fire burn is individually priced. A day's scale sits in
  the low hundreds of dollars; the adjustment for a serious gag can be several
  thousand on top, per performer, per performance. Ratchets, high falls, fire
  burns, and vehicle rolls are each their own negotiation, and a stunt
  performer who does the gag three times is paid three times.
- Insurance and safety regimes cap what is permitted; some sequences are
  refused outright. The completion bond (`03-financing-and-dealmaking.md` §7)
  and the insurer both hold effective vetoes, and a principal actor's contract
  usually forbids them from performing specified categories of stunt.
- A serious injury stops the unit, triggers an investigation, and can end the
  production.

### 3.4 Designing a sequence, in order

| Stage | What happens | Who | When |
|---|---|---|---|
| **Read and intent** | What the sequence is *for* dramatically — who wins, what changes, what the audience must feel. A fight with no story is the commonest failure in the craft | Director, coordinator, writer | At hire |
| **Beat sheet** | The action broken into beats and turns, on paper, before anyone moves | Coordinator, director | Week 1–2 |
| **Stunt-vis** | The stunt team performs the sequence in a rehearsal space or car park, shot on a consumer camera, cut together with temp music. Cheap — days, not weeks — and the single most useful artefact in action design, because it proves the thing is physically possible and shows the director the *rhythm* | Coordinator, stunt team, sometimes the editor | Week 2–5 |
| **Previs** | Where the sequence is CG-heavy or involves impossible camera, stunt-vis is converted to formal previs and techvis | Previs supe, VFX supe, coordinator | Week 4–8 |
| **Methodology split** | Line by line: performed practically, performed by a double, digital double, or face replacement. This is a joint decision with VFX and it sets both budgets | Coordinator, VFX supe, producer | Week 6–10 |
| **Rig build** | Wire rigs, ratchets, decelerators, airbags, vehicle modifications, cannon rigs. Physical build with load testing and certification | Riggers, SFX, engineering | Weeks 4–12 |
| **Training** | Principals and doubles, daily (§3.5) | Coordinator, fight choreographer, trainers | Weeks 6–20 |
| **Rehearsal on the rig** | On the actual apparatus, at the actual location where possible, at reduced intensity, building up | Everyone who will be there on the day | Days–weeks before |
| **Tech rehearsal / dry run** | Full speed, no camera, everyone in position, radios live | Full unit | The day before, or the morning of |
| **Shoot** | Multi-camera, briefed, medics present, abort word agreed | Full unit, second unit | The day |
| **Post supervision** | Face replacement, wire removal, speed ramps, digital doubles, and the assembly of the sequence | Coordinator, VFX supe, editor | Months |

**On stunt-vis specifically:** it is the discipline's equivalent of the story
reel. It costs a few days of a small team's time and it answers questions that
storyboards cannot — whether a human body can actually get from that position
to that one, how long the beat really takes, and whether the sequence has a
shape. Directors who skip it design action in the edit, which is where action
sequences become incoherent.

### 3.5 Training the actor, and what it buys

**How it works.** A principal doing significant action trains **8–16 weeks**
before the shoot, typically 2–4 hours a day, five days a week, and keeps
training through the shoot on off days. Fight work is taught as choreography —
learned in numbered beats like dance, then run at increasing speed. Driving,
riding, weapons handling, wire work, and swimming each have their own
specialist trainer. The actor also builds the specific physical conditioning
the sequence needs, which is not the same as looking fit.

**What it buys**, concretely:

1. **Longer takes.** A trained actor can perform 20–40 seconds of choreography
   without cutting. An untrained one gives you three moves, which forces a cut
   every 1.5 seconds and produces the incoherent modern fight scene.
2. **Wider lenses and closer camera.** If the performer is really doing it, the
   camera can be wide enough to show the whole body and the face in the same
   frame — which is what makes an audience believe it.
3. **Fewer face replacements.** A digital face replacement runs roughly
   $8,000–$25,000 a shot and can be needed dozens of times in a sequence.
4. **A better performance.** The actor acts *through* the action instead of
   surviving it, and the character survives the fight rather than being
   replaced by a stunt performer for two minutes.
5. **Schedule.** Fewer set-ups, fewer double swaps, fewer costume matches.

What it does **not** buy is licence to remove the double. Doubles do the falls,
the impacts, and the repetitions; the trained actor does the parts that need
their face. Coordinators who let a star do the dangerous version because the
star wants to are the ones who end up in an investigation.

### 3.6 How safety is actually enforced

Not by a rulebook — by a set of practices that are near-universal on
professional sets:

- **Nothing at full intensity first.** Every gag is walked, then run at 25%,
  then 50%, then full. A performer who has not done the reduced-speed version
  does not do the full-speed version.
- **One voice.** During a gag, the coordinator (not the director, not the AD)
  controls the count and the go. On pyro gags the SFX supervisor fires.
- **The abort word.** Agreed, briefed, and absolute: anyone, of any rank, can
  stop the take, and there is no cost or consequence for using it. A set where
  people are reluctant to use it is already unsafe.
- **Documented risk assessment and briefing.** Written before the day, read
  aloud on the day, signed by everyone in the zone.
- **Exclusion zones and marshals.** Measured distances, physically marshalled,
  with a headcount before the take.
- **Standby resources named on the call sheet.** Medic, ambulance, fire crew,
  water safety, and the nearest trauma hospital with travel time.
- **The coordinator's veto.** The coordinator can refuse a sequence, and their
  refusal is backed by the producer, the insurer, and the bond. The system only
  works when the producer visibly backs it — a coordinator who is overruled
  once will be quieter the next time, and that is the mechanism by which safety
  cultures decay.
- **Fatigue as a safety issue.** Hour 14 is when the accidents happen; the
  professional practice is to schedule hazardous work early in the day and
  early in the week (`06-principal-photography.md` §7).

### 3.7 What separates a great stunt coordinator from a poor one

1. **Designing to character and story.** Great action tells you who these
   people are — how they fight is characterisation. Poor action is a list of
   tricks, and audiences disengage from it within ninety seconds no matter how
   expensive it is.
2. **Designing to the schedule and the location.** Knowing that this sequence
   is fourteen days and this one is four, and saying so in prep, so the film
   can afford the one that matters.
3. **Coverage literacy.** Delivering a sequence that *cuts* — pieces that
   overlap, eyelines that match, a geography the audience can hold. A
   coordinator who thinks in shots rather than in gags gives the editor a
   sequence; one who thinks in gags gives them a pile.
4. **Casting the performer to the gag.** The right double for this specific
   fall, this specific driving style, this specific body. Stunt casting is as
   specific as acting casting and far less forgiving.
5. **Saying no, early and calmly.** And having the standing that the no holds.
6. **Rehearsal discipline.** Incrementalism enforced when the day is running
   late and everyone wants to skip to the full-speed version.
7. **Knowing what to hand to VFX.** Wire removal, face replacement, and digital
   doubles are cheap relative to injury; the coordinator who insists on doing
   everything for real is not the safest one in the room.
8. **Running a unit.** The step from coordinator to second unit director is a
   directing job — shot design, actor direction, and a schedule — and many
   excellent coordinators are not good at it.
9. **Crew care.** Stunt performers are freelancers with short careers and
   accumulated injuries; the coordinators people want to work for are the ones
   who protect them, and they get the best performers as a result.

### 3.8 What happens when it goes wrong

| Severity | What happens |
|---|---|
| **Near miss** | Reported (on a well-run show), sequence re-assessed, sometimes re-designed. The signal that matters most and the one most often buried |
| **Minor injury** | Performer replaced for the day; gag re-rigged; report filed with the insurer |
| **Serious injury** | Unit stands down immediately; regulator notified; work in that category suspended pending investigation; insurance claim; potential re-design or abandonment of the sequence |
| **Fatality** | Production halts, often for weeks or permanently; statutory investigation; potential criminal prosecution of individuals and companies; the film's release and marketing become inseparable from the incident |

The industry's safety regime is largely written in the aftermath of specific
deaths — the 1982 *Twilight Zone* helicopter crash, the 2014 death of camera
assistant Sarah Jones on *Midnight Rider* (which resulted in a producer's
imprisonment), the 2017 deaths of stunt performers John Bernecker and Joi
Harris, and the 2021 shooting on *Rust* — and the reforms that follow each are
real but partial. The practical lesson practitioners draw is consistent:
serious incidents are almost never caused by the one dangerous decision, but by
a chain of small ones — a rehearsal skipped because of time, a briefing
shortened, a role doubled up, a person too tired, a question not asked because
of who would have had to be contradicted.

---

## 4. Prosthetics and creature effects

A distinct craft, usually contracted to a specialist shop.

### 4.1 Who does it

| Role | What they own |
|---|---|
| **Prosthetics Designer / Special Makeup Effects Designer** | The design, the shop, and the outcome. Contracted per film, usually running their own facility |
| **Key Sculptor** | The sculpture — where the character actually gets created |
| **Mould-maker** | Translating sculpture into a production mould that survives 60 runs |
| **Lab technicians / runners** | Foam or silicone runs, one shooting day's worth at a time |
| **Painter / colourist** | Intrinsic and extrinsic colouring; the difference between skin and rubber |
| **Hair punchers** | Inserting hair one strand at a time |
| **Key Prosthetic Makeup Artist (on set)** | Application, maintenance, continuity, removal |
| **Application artists (2–6 per character)** | The chair work every morning |
| **Personal makeup artist to the actor** | The relationship management, which is not a joke — the actor is in a chair with these people for four hours a day for months |

The designer reports to the director and producer; the on-set team sits under
the makeup department head for scheduling but takes creative direction from the
designer (`05-departments-and-crew.md` §10).

### 4.2 The pipeline, with real timings

| Stage | What happens | Duration |
|---|---|---|
| **Design** | Concept art, then a **maquette** — a quarter- or third-scale sculpture the director approves in three dimensions | 2–6 weeks |
| **Life cast** | The performer is cast in alginate and plaster bandage — head, or head and torso, or full body. Claustrophobic, uncomfortable, and a relationship-defining two hours. Increasingly supplemented (rarely replaced) by photogrammetry scanning, which takes twenty minutes but captures less | 2–4 hours in the chair; 2–3 days to produce the positive |
| **Sculpture** | The character is sculpted in clay onto a copy of the performer's own anatomy. This is the creative centre of the craft | 2–8 weeks per major appliance |
| **Moulding** | Fibreglass or stone production moulds, in pieces, capable of surviving dozens of runs | 1–2 weeks |
| **Running appliances** | Foam latex baked in an oven (2–4 hours a run) or platinum-cure silicone with an encapsulating layer. **One set per shooting day, plus spares** | Continuous through the shoot |
| **Painting** | Intrinsic colour pigmented into the material plus extrinsic layers airbrushed on. Colour is judged under the film's actual lighting, not shop light | Days per set |
| **Hair punching** | Individual hairs inserted with a needle. A full brow, beard, and hairline is 40–120 hours of one person's time | Weeks, in parallel |
| **Camera test** | The full makeup, on the actor, in costume, under the DP's lighting, on the actual camera and lenses. **The gate.** Anything discovered here is fixable; anything discovered on day one of shooting is not | 3–5 weeks before the shoot |
| **Application** | 2–6 hours, up to 8–10 for a full-body creature, with 2–4 artists working simultaneously | Every shooting day |
| **Maintenance** | Between every set-up: edges, sweat, colour, continuity photographs | All day |
| **Removal** | Solvents and patience; destroys most appliances | 45–90 minutes |

**Total lead time for a hero character is 4–6 months** and cannot be compressed
past the curing and testing steps. A design approved eight weeks before the
shoot produces a character that arrives untested.

### 4.3 What it costs and what it does to the day

- **Consumables per shooting day** are a real, recurring line: a hero silicone
  character's daily set can run **$4,000–$25,000**, every day the character
  shoots. A forty-day character is therefore a build cost *plus* a six- or
  seven-figure consumable line.
- **A full hero character build** — design, sculpt, moulds, first sets,
  animatronic components — commonly runs **$150,000 to well over $1M**.
- **Application time dictates the whole day's shape.** A four-hour application
  means an actor whose call is 3am for an 8am first shot, and union rules count
  much of it as work time, which pushes wrap and can trigger turnaround
  violations (`06-principal-photography.md` §7) two days later. Removal adds an
  hour at wrap. In practice a heavy prosthetic character costs the production
  an hour or more of shooting time every single day, which is why designers are
  judged partly on how much time they can take *out* of the process.
- **Performance cost.** Every millimetre of material over the mid-face
  suppresses expression. The actor is hot, partly deaf, has restricted
  peripheral vision, and cannot eat normally. Heavy makeup days are shorter
  days whether or not anyone plans for it.

### 4.4 What a bad appliance looks like on camera

The audience cannot name these, but they read all of them instantly as "rubber
mask":

| Tell | Cause |
|---|---|
| **Visible edges** | Blending not taken far enough, or the appliance's flashing too thick; shows worst in raking light and close-up |
| **Wrong translucency** | Foam latex reads opaque; skin scatters light beneath the surface. Silicone solves this and costs more |
| **A dead mid-face** | Material too thick between nose and mouth; the actor's expression stops at the appliance |
| **Small, sunken eyes** | Brow and cheek build-up recessing the eyes — the single most common creature-makeup failure |
| **Colour mismatch at the neck** | The appliance and the actor's own skin were matched under different light |
| **Hair that starts too abruptly** | A punched hairline that begins in a line rather than thinning out |
| **Lifting during the day** | Heat, sweat, and inadequate adhesive; visible by the afternoon and worse in the wide |
| **Drift across the schedule** | Different artists applying it differently over forty days; the character subtly changes shape between scenes |
| **Fighting the camera format** | What survived a 1990s film scan does not survive a modern large-format sensor in close-up |

### 4.5 What separates a great prosthetics designer from a poor one

1. **Designing onto the actor.** The best work is built around this performer's
   bone structure and this performer's expressive habits, so the character
   moves when they do. Generic sculpts applied to whoever was cast are the
   defining sign of a weak shop.
2. **Minimalism where expression lives.** Great designers keep the appliance
   thin around the eyes and mouth and put the drama in the periphery. This is a
   restraint decision and it is why some famous creature makeups seem to act.
3. **Buying back production time.** Reducing a five-hour application to three —
   through smarter piece-splitting, better pre-painted parts, more artists in
   parallel — is worth more to a production than any aesthetic flourish.
4. **Testing under the real conditions.** The camera test with the actual
   lenses, lighting, and costume, weeks early. Designers who skip it are
   gambling with a schedule they do not control.
5. **Colour under light.** Judging skin tone under the film's palette, not
   under shop fluorescents.
6. **Repeatability.** Writing the recipe so six artists over forty days produce
   the same character. The great shops document application in photographs and
   step charts and enforce them.
7. **The actor relationship.** Someone who can keep a performer calm and
   comfortable for four hours a day for five months is worth more than a
   slightly better sculptor who cannot.
8. **Knowing what to hand to VFX.** Digital eye enhancement, edge blending,
   removing a rig, extending a limb — the modern craft is a partnership, and
   designers who treat digital work as an insult produce worse characters.

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

### 5.1 The shape of a production

A studio CG feature runs roughly **4–5 years end to end**: 1–3 years of
development and story, then 2–2.5 years of production, with the crew ramping
from a few dozen to **300–600 people at peak**, held for 12–18 months, and
released down through the back half. Because the entire cost is headcount and
render, the budget curve *is* the crewing curve, and every schedule decision is
really a decision about how many people are standing around waiting.

| Phase | What is happening | Crew | Duration |
|---|---|---|---|
| **Development** | Pitch, treatment, script drafts, visual development | 5–30 | 1–3 years |
| **Story / boards** | Sequences boarded, pitched, re-boarded; the reel takes shape | 30–80 | 1–2 years, overlapping |
| **Pre-production** | Character and environment design, modelling, rigging, look development | 60–150 | 12–18 months |
| **Production** | Layout, animation, CFX, FX | 250–500 | 12–18 months |
| **Post / finishing** | Lighting, rendering, comp, stereo, DI, sound, score | 150–300 | 6–12 months, overlapping |

### 5.2 The pipeline in detail

| Stage | What actually happens | Rate of work |
|---|---|---|
| **Beat board / outline** | The sequence's story beats in a handful of drawings, pitched to the director | Days |
| **Storyboarding** | A story artist boards a whole sequence — 200 to 2,000 panels — and **pitches** it, performing it aloud to the director and the story team | 3–8 weeks per sequence, per artist |
| **Reel cut** | Editorial cuts the boards to scratch dialogue and temp music. The film exists at feature length from this point on and never stops existing | Continuous |
| **Scratch voice** | Story artists and internal voices record the dialogue so the reel plays | Ongoing |
| **Final voice sessions** | The cast records in a booth, alone, 2–4 hours a session, **3–10 sessions each spread over two or three years** as the story changes under them | Ongoing |
| **Visual development** | Colour scripts, character design, environment paintings — the film's look decided in 2D before anything is built | 12–18 months |
| **Modelling / rigging / look-dev** | Building the cast and the world. A hero character is months of combined model, texture, groom, and rig | 3–6 months per hero character |
| **Layout** | Rough then final camera and staging; the reel's boards translated into 3D cinematography | 4–8 weeks per sequence |
| **Animation** | The performance, keyframed. **The classic benchmark is 3–5 seconds of finished animation per animator per week**; a 100-minute feature is roughly 6,000 seconds of screen time | 12–18 months with 80–150 animators |
| **Character FX / simulation** | Cloth, hair, fur, muscle — everything that follows the animation | Per shot, days |
| **FX** | Water, fire, smoke, dust, magic. Frequently the most expensive shots in the film | Per shot, days to weeks |
| **Lighting** | A lighter takes 5–20 shots and lights each to the colour script | 2–6 days a shot |
| **Rendering** | 5–100+ core-hours a frame; a feature consumes tens of millions of core-hours, scheduled as a resource | Continuous, months |
| **Comp and finishing** | Assembly, grade, DI, stereo, sound, score | 6–12 months, overlapping |

### 5.3 Why the story reel dominates everything

Because animation cost is **per frame produced**, and nothing produced can be
reconsidered cheaply. In live action, a scene that does not work can be
re-shot, re-cut, or fixed in the mix. In animation, a sequence that does not
work has already consumed months of modelling, animation, simulation, lighting,
and render, and there is no cheap version of "do it again".

The reel is the answer: a continuously updated, feature-length version of the
film made of drawings, scratch voices, temp music, and temp sound, which can be
re-cut in a day and re-boarded in a fortnight. Consequences:

- **The film is screened to internal audiences every 8–12 weeks** for its entire
  development, in reel form, and judged as a film — pacing, clarity, whether
  the emotional beat lands — long before it looks like anything.
- **Sequences are re-boarded five to fifteen times.** A feature has roughly
  40–60 sequences; some are thrown out entirely and several are invented late.
  This is normal and is the process working, not failing.
- **Story trusts / brain trusts.** Peer directors and story leads watch the reel
  and give notes without authority to compel — the director chooses what to
  take. The mechanism only works if there is time to act on it, which is why
  the reel's schedule is guarded.
- **Gates are enforced hard.** Story lock, then layout lock, then animation
  approval, then no changes. Each gate exists because the cost of a change past
  it multiplies by roughly an order of magnitude.

The classic failure is starting production before story lock in order to hold a
release date, and then discovering in year three that act three does not work —
at which point the fix is a re-board and re-animation of a third of the film,
which is a $20M-plus event and the reason well-known animated features have
been delayed, re-directed, or shelved outright.

### 5.4 What separates good animation production from bad

1. **Enforcing the gates.** Refusing to start layout on an unlocked sequence,
   even when 300 people are idle and the temptation is enormous. Everything
   else on this list is downstream of it.
2. **Killing sequences early.** Deciding in month eight that a sequence does
   not belong, rather than in month thirty.
3. **Screening the reel honestly.** Showing the unfinished film to people who
   will say it is not working, often enough that there is time to fix it.
4. **Note discipline.** Converting a screening's forty reactions into three
   actionable structural notes, and protecting the director from the rest.
5. **Crewing to the curve.** Ramping artists to match approved work. A
   department that is ready before the work is approved is pure burn; one that
   ramps late becomes the bottleneck for the rest of the film.
6. **Directorial consistency.** Director changes mid-production are the
   sector's most expensive event, and are almost always a symptom of a story
   problem that was visible in the reel two years earlier.
7. **Protecting the pipeline.** Technology decisions — a new fur system, a new
   renderer — made on a film in production rather than between films are how
   schedules quietly disappear.
8. **Casting for the reel, not the poster.** A voice cast assembled for
   marketing rather than for performance is audible, and cannot be fixed later.

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

A second cross-cutting regularity: **every one of these crafts is cheapest to
influence in prep and most expensive to influence in post**, and the size of
the multiplier between those two points is what defines the discipline.

| Craft | Cost of a change in prep | Cost of the same change in post |
|---|---|---|
| VFX | A conversation | $10K–$100K+ a shot, times hundreds |
| SFX | A drawing and a build order | A shooting day, or an unbudgeted VFX line |
| Stunts | A re-designed beat | Reshoots, or an incoherent sequence in the cut |
| Prosthetics | A new sculpt | Impossible; the material is on the actor's face in every take |
| Animation | A re-board, in a fortnight | Months of re-produced frames |

---

## 7. Miniatures and practical model work

Largely displaced by digital work between the late 1990s and the 2010s, and
never quite extinct — because photographed reality still solves problems that
simulation solves expensively.

### 7.1 What it is and who does it

A **model unit** is a small parallel production: a **model shop supervisor**
running a shop of 5–30 model makers (fabricators, machinists, painters,
electricians, pyro technicians) and a **miniatures DP** shooting on a stage or
outdoor pit with a high-speed camera, a motion-control rig, and enormous
amounts of light. Model makers come from engineering, architectural modelling,
and prop-making backgrounds, and they are a small and ageing labour pool.

**When** — builds run **8–20 weeks** and are commissioned in prep, and the
model unit shoots either alongside the main unit or in post as element
photography for VFX to composite.

### 7.2 The physics that governs the craft

Two rules do most of the work:

- **Scale the frame rate, not just the model.** Gravity does not scale, so a
  miniature falls too fast for its apparent size. The correction is to
  overcrank by roughly the square root of the scale factor: a 1/16-scale model
  is shot at about 4× normal speed (96fps), a 1/25 model at 5× (120fps). Get
  this wrong and the audience reads "toy" instantly without knowing why.
- **Bigger is always better.** The single strongest predictor of whether a
  miniature works is its scale. Serious work is 1/3 to 1/8; anything smaller
  than about 1/24 struggles. This is why "**bigature**" became a working term —
  models built at a scale where detail, depth of field, and physics all behave.

Consequences the shop plans around: **water does not scale at all** (surface
tension is fixed, so convincing water miniatures need very large scale and vast
volumes), fire and smoke scale poorly and need overcranking plus careful
particle size, and depth of field must be forced with small apertures, which
means lighting levels far above a normal set.

### 7.3 Why anyone still does it

| Advantage | Why it matters |
|---|---|
| **Real light on real surfaces** | Nothing to match; the lens sees the thing |
| **Real destruction physics** | Debris, dust, and structural collapse for free, at a fidelity simulation reaches slowly and expensively |
| **Real lens interaction** | Flare, aberration, grain, focus fall-off — the artefacts audiences read as photographic |
| **Element photography** | Even on all-digital shows, real fire, smoke, water, and debris shot as miniature elements get composited into CG constantly |
| **Cost, sometimes** | A one-off hero destruction can be cheaper as a build than as a simulation |

**Limits:** the model is committed the moment it is destroyed, so it is one
take with many cameras (as in §2.4); the camera cannot move in ways a real
camera at that scale could not; and changing the shot after the fact means
rebuilding, which is why the modern default is to shoot miniatures as
*elements* that digital work can re-frame, extend, and combine.

**Cost:** a hero miniature runs **$50,000 to $1M+** depending on scale and
detail, plus the model unit's shooting days.

---

## 8. Creature and puppet performance

Distinct from §4's makeup craft: this is the discipline of *performing* a
non-human character physically, on the set, in front of the actors.

### 8.1 The forms

| Form | How it works | Where it excels |
|---|---|---|
| **Suit performance** | A performer inside a built creature suit, often with animatronic head functions run remotely | Full-body characters that interact physically; anything requiring weight and presence |
| **Animatronics** | Servo- or cable-driven mechanisms, controlled by puppeteers at a console or through **waldo** rigs that map a puppeteer's hand movements onto the creature's face | Close-ups, dialogue, subtle facial work |
| **Rod and cable puppetry** | Puppeteers below or behind frame operating on rods; multiple performers per character (**bunraku**-style) | Characters with no full-body requirement; theatrical, expressive work |
| **Hybrid on-set reference** | A practical creature or even a foam stand-in performed on set purely for eyeline, interactive light, and the actors' reactions, then replaced digitally | Almost everything modern — it buys the performance quality without constraining the final image |

### 8.2 Who is involved

A **creature effects supervisor** runs the shop (sculptors, mould-makers,
mechanical designers, electronics engineers, fur and hair specialists), and a
**lead puppeteer** runs performance. A single hero animatronic character on set
can involve **4–8 puppeteers simultaneously**: one on the eyes and blinks, one
on brows and forehead, one on mouth and jaw, one on the body or neck, plus a
suit performer and a wrangler managing cables. They rehearse together like a
small ensemble, because the character only exists when their timing agrees.

**Timing and cost:** a hero animatronic head is **4–9 months** of design,
engineering, and fabrication, commonly **$200,000–$1.5M**, and it must be
finished early enough to rehearse with.

### 8.3 What separates great puppet performance

The mechanism is engineering; the performance is acting, and the difference
between a beloved creature and an embarrassing one is almost entirely in the
second:

1. **Breath.** A creature that does not breathe is dead, and audiences detect
   it before they can articulate it. Great puppeteers keep an idle rhythm going
   at all times, including between lines.
2. **The look before the move.** Living things aim their eyes at where they are
   about to go. Puppets that move and then look are read as objects.
3. **Blinks with intention.** Blink rate and timing carry emotion; mechanical
   metronomic blinking destroys a character instantly.
4. **Weight.** Acceleration and settling that imply mass. This is also the
   commonest failure in *digital* creatures, which is why puppeteers are
   routinely hired onto CG shows as performance reference.
5. **Listening.** The character must react while the actor is speaking, not
   only when it is their turn — the single most valuable thing a practical
   creature gives a scene.
6. **Consistency of the ensemble.** Multiple puppeteers producing one
   coherent performance take is a rehearsal problem, not a technology problem.
7. **Designing for what the mechanism can do.** A shop that promises functions
   it cannot drive fast enough hands the set a creature that is always slightly
   late.

**Why it survives:** an actor performing opposite a real object gives a
different performance than one performing opposite a tennis ball on a stick,
and directors know it. The modern compromise — perform practically on set,
replace or augment digitally — costs the VFX budget a removal job and buys
back the scene.

---

## 9. How practical and digital are actually combined

This is the central craft decision of modern effects work, and the framing of
"practical versus digital" is a press-tour fiction. Almost no shot in a modern
studio film is purely one or the other.

### 9.1 What a "practical" shot actually contains

A car flip that a film's marketing calls "done for real":

| Layer | Origin |
|---|---|
| The vehicle leaving the ramp and rolling | Practical, cannon rig, one take, ten cameras |
| The driver's face | Digital — the stunt driver's head replaced with the actor's |
| The safety rig, cannon, and cables | Digital removal |
| Debris and glass in the foreground | Mixture: practical elements, augmented with simulation |
| The street the crash happens in | Practical to about twenty feet, digital extension above |
| Crew, tracking markers, safety marshals in shot | Digital paint-out |
| The impact's timing and rhythm | Editorial, plus a digital speed ramp |

And a creature scene that its marketing calls "all CG":

| Layer | Origin |
|---|---|
| The creature | Digital |
| The interactive light on the actors' faces | Practical — lights rigged on set to match the creature |
| The dust it kicks up on contact | Practical, blown on cue; augmented digitally |
| The performance the actors are reacting to | A practical stand-in, a puppet, or a performer on stilts |
| The environment | Practical set to a height, digital above |
| The creature's shadow on the floor | Digital, and the shot fails without it |

### 9.2 How the decision is actually made

The choice is made in prep, in a room containing the director, the VFX
supervisor, the SFX supervisor, the stunt coordinator, the production designer,
and the line producer. The criteria they actually use:

| Criterion | Pushes practical | Pushes digital |
|---|---|---|
| **Interactive light** | The effect lights the actors or the set | Light can be faked convincingly (rare, and the usual tell) |
| **Contact and interaction** | Actors touch, hold, or are hit by it | No physical contact required |
| **Safety** | Controllable risk with rehearsal | Anything that would put a human at genuine risk |
| **Scale** | Fits on a stage or a location | City-scale, aerial, or geographically impossible |
| **Reset and repeatability** | Multiple takes affordable | One-shot practically, but the director needs options |
| **Screen time** | On screen briefly, or in motion | Held long, in close-up, under scrutiny |
| **Certainty** | The result is known on the day | The result is decidable for months afterwards |
| **Schedule** | Prep exists; the build fits | Post exists; the shoot does not have the days |
| **Cost shape** | One build, one day | Per shot, repeated |

The last row is the one producers most often miscalculate: **a practical effect
is priced once; a digital one is priced per shot.** A build that seems
expensive against a single shot becomes cheap the moment there are forty shots
of it, and vice versa.

### 9.3 The working rules practitioners actually use

1. **Shoot something real in every frame you can.** Real light, real smoke,
   real debris, real texture. It gives the digital work something to belong to
   and the compositor something to hide inside.
2. **Practical for the wide and the interaction; digital for the impossible.**
3. **Never make the practical element do the thing that will get someone
   hurt** — put a human at the edge of risk and replace the last step
   digitally.
4. **Capture the practical version even if you plan to replace it.** A real
   fire element shot on the day is cheap insurance and usually ends up in the
   comp.
5. **Give the actors something to act to.** Even a foam shape on a pole with
   a light on it out-performs a mark on a bluescreen.
6. **Decide early.** A practical approach abandoned two weeks before the shoot
   becomes an unbudgeted post line; a digital approach adopted on the day
   arrives without plates or data (§1.8).

---

## 10. What makes an effect convincing — a craft profile

The question every one of the preceding sections is ultimately serving. It is
worth stating explicitly, because it is not primarily about resolution, budget,
or render time — expensive shots fail all the time, and cheap ones routinely
work.

### 10.1 What the audience is actually checking

Not detail. Audiences do not examine texture; they check a short list of
physical and photographic cues, unconsciously, in under a second:

1. **Weight and motion.** Does the mass accelerate, decelerate, and settle the
   way something of that size would? This is the single biggest tell, and it is
   an *animation* problem, not a rendering one. A perfectly rendered dragon
   that moves like a paper kite is unconvincing; a crude one with real weight
   is not.
2. **Light shared with the plate.** One sun, one colour temperature, one set of
   shadows. Interactive light — the effect illuminating the environment and the
   actors — is what practical elements give for free and what digital work most
   often omits.
3. **Contact.** Shadows where things touch, occlusion, dust displaced,
   footprints, water disturbed. Shots fail at the ground plane more than
   anywhere else.
4. **Camera behaviour.** A real camera has motion blur, imperfect framing, an
   operator who reacts *late* to a moving subject, focus that misses slightly,
   lens distortion, flare, chromatic aberration, and grain. Effects shots read
   as fake when their camera is *too good* — too smooth, too perfectly framed,
   too impossibly placed.
5. **Scale cues.** Atmospheric haze with distance, parallax, depth of field
   consistent with the focal length. Miniatures fail here (§7.2) and so does CG
   that has never had a lens applied to it.
6. **Design plausibility.** Whether the thing looks like it could exist —
   anatomy that could function, engineering that could hold, wear where wear
   would occur.
7. **Consistency.** The same creature, city, and weather across a two-hour
   film. Audiences are calibrated by the good shots and then punished by the
   inconsistent ones.

### 10.2 Why shots fail

| Failure | What the audience perceives |
|---|---|
| **Floating** | No contact shadow, no weight transfer; the element is "pasted on" |
| **Clean-room syndrome** | No grain, no dirt, no lens artefacts; too sharp everywhere at once |
| **Wrong light** | The element's key comes from a direction the plate's does not |
| **Impossible camera** | A move no crane, drone, or operator could have made — flying through a keyhole into a battle |
| **Over-choreography** | Everything in frame simultaneously spectacular; the eye has nowhere to rest and stops believing any of it |
| **Uncanny digital humans** | Faces that are nearly right; the eyes, the skin's subsurface response, and micro-expression timing are where it breaks |
| **Video-game lighting** | Flat, ambient, shadowless — usually a symptom of a full-CG environment that was never lit by anyone with a cinematography background |
| **Held too long** | A shot that would have survived at 1.5 seconds fails at 6 |
| **Fixed too late** | A shot rushed at the end of a schedule, delivered at a version count nobody was happy with |

### 10.3 The context effects

Two facts that professionals treat as load-bearing and outsiders usually miss:

- **Story carries effects.** An audience invested in a scene extends
  extraordinary latitude to its imagery; a bored audience examines it. This is
  why effects on a film that is not working are reviewed as bad even when
  they are technically identical to effects on a film that is.
- **Screen time and lighting are the dials.** The oldest craft trick in the
  discipline is to show the difficult thing briefly, in motion, partly
  obscured, and in the dark — and to hold the shot only once the audience has
  already accepted the character. Films that reveal their creature fully in
  daylight in the first reel are making a very expensive bet.

### 10.4 The skill axis, summarised

Excellence across every craft in this document reduces to the same three
things, applied at different stages:

1. **Choosing the right method** — before anything is built or shot, when the
   choice is still free.
2. **Getting the physics right** — weight, light, and contact, which are
   craft judgements rather than budget items.
3. **Finishing** — the last 10% of integration work that nobody notices when it
   is present and everybody notices when it is absent, delivered at a point in
   the schedule when there is no time left for it.

The first is a prep decision, the second is a talent question, and the third is
a scheduling one. Films that fail at effects have usually failed at the first
and are trying to buy their way out with the third.
