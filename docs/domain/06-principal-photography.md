# 06 — Principal Photography

*The shoot.* The most expensive and least reversible phase: a studio unit burns
its daily cost whether it shoots one setup or forty, and the schedule is the
only currency that matters.

> **Domain reference.** Real industry, not this game. See `README.md`.

---

## 1. The economics of a shooting day

A shooting day has a **daily burn rate** — total crew, equipment, locations,
cast, and facilities cost divided by shooting days. Directional:

| Production | Daily burn | Crew on the floor | Typical shoot |
|---|---|---|---|
| Micro-budget | $5K–$30K | 10–25 | 12–20 days |
| Independent feature | $50K–$150K | 40–80 | 20–35 days |
| Studio mid-budget | $150K–$400K | 100–180 | 35–60 days |
| Tentpole main unit | $500K–$1.5M+ | 200–400 | 60–120 days |

Every decision on set is implicitly priced against this. "We'll get it after
lunch" costs real money; "we've lost the day" is a catastrophic sentence.

### 1.1 What the burn is actually made of

The important structural fact is that **almost all of it is fixed against the
day, not against the work done**. A rough shape for a studio mid-budget day:

| Component | Share of daily burn | Behaviour |
|---|---|---|
| Crew wages (below-the-line labour) | 40–55% | Fixed once called; overtime is the only variable part, and it only goes up |
| Cast (day-rate players, background, stunts) | 10–25% | Fixed for anyone on a weekly; day players are the marginal piece |
| Equipment rental (camera, grip, electric, vehicles) | 10–15% | Weekly rental — idle days cost the same as working days |
| Locations, stage rent, permits, security | 5–15% | Fixed by contract, often with hard hours attached |
| Transport, catering, facilities, unit costs | 5–10% | Scales with headcount, not with productivity |
| Post/VFX/production overhead accrual | 5–10% | Runs regardless |

The consequence practitioners internalise: **a day where nothing is shot costs
approximately the same as a day where nine setups are shot.** Productivity is
almost entirely upside. This is why 1st ADs behave the way they do, and why a
two-hour delay is treated as a serious event rather than an inconvenience.

### 1.2 Who is watching the money, and how often

| Role | What they see | Cadence |
|---|---|---|
| **1st AD** | Setups, pages, hours against the day's plan | Continuous, hour by hour |
| **UPM / Line Producer** | Actual spend vs. budget by account code | Daily, from the DPR and timecards |
| **Production Accountant** | The **cost report** — estimate to complete, variance by account | Weekly, usually issued Monday for the prior week |
| **Producer** | Days ahead/behind, cost trend, the exposures | Daily call, weekly report |
| **Studio / financier** | Cost report, dailies, schedule position | Weekly |
| **Completion bond company** | Cost report, DPRs, schedule position | Weekly; escalates on adverse trend (`03-financing-and-dealmaking.md` §7) |

The cost report is the document that determines whether a film is "in trouble".
It carries an **estimate to complete (ETC)** and an **estimate at completion
(EAC)**. When the EAC crosses the budget plus contingency, the conversation
stops being about filmmaking and becomes about cuts — scenes, days, VFX, or
schedule. See `03-financing-and-dealmaking.md` §10.

### 1.3 The day as the unit of currency

Schedules are not measured in money on the floor; they are measured in **days
ahead or behind**. The 1st AD, the UPM, and the producer all track a single
running number, quoted at the end of every day: *half a day behind*, *even*,
*a day and a quarter up*. Everything else — overtime, coverage, whether a scene
gets rehearsed — is negotiated against that number.

A rule of thumb across the industry: a film that is **more than two days behind
at the end of the first week** rarely recovers by shooting faster. It recovers
by removing work — cutting scenes, dropping coverage, or moving material to
second unit (§16). The catch-up mechanics, and what each costs the finished
film, are the subject of §16.

---

## 2. The call sheet and the daily production report

These are the two halves of the production's daily loop: the call sheet is the
**instruction**, the DPR is the **record**. Between them they define the whole
management system of a shoot.

### 2.1 Where the call sheet comes from

The call sheet is not authored fresh each night. It is the last step in a chain
that started in prep (`04-preproduction.md` §3):

```
  Script  →  Breakdown sheets  →  Stripboard  →  Shooting schedule
                                                        │
                                        one-line schedule (the whole film)
                                                        │
                                     "advance schedule" (next 2–5 days)
                                                        │
                                              TOMORROW'S CALL SHEET
```

| Step | Who | When |
|---|---|---|
| 1st AD decides tomorrow's work, in order, from the schedule and today's actual progress | 1st AD | Mid-afternoon, on set |
| Departments are canvassed: what's needed, what's ready, who's available | 2nd AD, from HODs | Afternoon |
| Cast times computed backwards from shooting call through hair/makeup/costume | 2nd AD, with H/MU and costume HODs | Afternoon |
| Draft circulated | 2nd AD | Late afternoon |
| Approved | 1st AD, then UPM (cost) and producer | Before wrap |
| Distributed | 2nd AD / 2nd 2nd AD | At wrap, usually electronically plus paper on set |

Anything not on the call sheet does not exist. A department that is not called
does not come; an actor not listed is not collected; a piece of equipment not
requested is on the truck at the wrong location.

### 2.2 The call sheet, field by field

| Field | What it means | Who supplies it |
|---|---|---|
| **Crew call** | The time crew are on set ready to work — not the time they leave home | 1st AD |
| **Shooting call** | The time the camera is intended to roll on the first setup. The gap from crew call is the build time for setup one | 1st AD |
| **Estimated wrap** | The honest projection. A crew reads this before anything else, and a chronically optimistic one destroys trust | 1st AD |
| **Scenes** | Scene numbers in shooting order, with a one-line synopsis, **D/N** (day/night), **INT/EXT**, page count in eighths | 1st AD from the schedule |
| **Total pages** | The day's promised output, in eighths of a page. The single number the day is scored against | 1st AD |
| **Cast list with numbers** | Every principal has a permanent **cast number** used throughout the paperwork. Columns: pickup (P/U), makeup, costume, **on set** | 2nd AD |
| **SWF status** | Start / Work / Finish / Hold — where each actor is in their contracted run (`04-preproduction.md` §3) | 2nd AD, from the DOOD |
| **Background** | Numbers, categories, calls, and what they're wearing | 2nd AD / 2nd 2nd AD, from extras casting |
| **Stand-ins** | Named, matched to principals — they carry the lighting time (§3) | 2nd AD |
| **Department notes** | A line per department: props needed, action vehicles, SFX gags, stunt performers, VFX requirements, animals, armourer, special makeup | Each HOD, collated by 2nd AD |
| **Location(s)** | Address, unit base, crew parking, nearest hospital (**always**, with route), toilets, catering | Location manager |
| **Weather** | Forecast, temperature, precipitation probability, wind | 2nd AD |
| **Sunrise / sunset** | The hard boundary on any exterior. Also civil twilight, which is the real end of usable light | 2nd AD |
| **Safety notes** | Specific hazards, PPE, and who to speak to | 1st AD with the safety officer/HSE adviser |
| **Advance schedule** | The next two to five days, so departments can prep. Explicitly marked *subject to change* | 1st AD |
| **Walkie channels, contacts, COVID/medical protocol** | Practical infrastructure | Production coordinator |

Two conventions worth knowing:

- **Page counts are in eighths.** A page is divided into eight; "2 4/8 pages"
  is standard notation. A typical studio day is **2–4 pages**; a talky
  independent might do 5–8; a dialogue-only TV multi-camera day can do 20+;
  a heavy action day can be **1/8 of a page** and take fourteen hours.
- **The call sheet is a contract of expectation.** A department that reads it
  and does not flag an impossibility at the production meeting owns the
  problem the next day.

### 2.3 The daily production report (DPR)

Filed after wrap by the 2nd AD, checked by the 1st AD and UPM, and distributed
overnight to the producers, studio, accountant, and bond company. It is the
**legal and financial record of the day**, and it is read adversarially.

| Section | Contents | Why it matters |
|---|---|---|
| **Times** | Crew call, first shot, lunch out/in, first shot after lunch, last shot, camera wrap, crew wrap | The gap between crew call and first shot is the most-scrutinised number on the sheet; so is the lunch-to-first-shot-after-lunch gap |
| **Scenes and pages** | Scenes completed, partly completed ("**part scene**"), added, and deleted; pages shot vs. scheduled | Feeds the running ahead/behind figure |
| **Setups** | Count of camera setups completed | The other productivity metric; typically **12–25** on a normal day, 4–8 on heavy action, 40+ on a fast comedy |
| **Screen time** | Estimated minutes of cut material achieved | Rough, but the closest thing to output |
| **Film/media** | Footage or data volume, takes printed/circled, cards shot | Consumables and post load |
| **Cast** | Every performer, their SWF status, call, on-set, dismiss, meal times, and any travel | Drives payroll, penalties, and residual eligibility |
| **Crew and background counts** | Headcount by department, plus background numbers by category | Drives payroll and catering reconciliation |
| **Meal breaks and penalties** | When lunch was called, second meal if any, and penalties incurred | The most common avoidable cost on a shoot |
| **Overtime** | Hours past the standard day, by category | Directly priced |
| **Lost time and reasons** | Explicit, itemised: weather, technical, cast, waiting on set | This is the accountability section, and it is where blame is assigned |
| **Accidents / incidents** | Any injury, near-miss, or damage | Insurance and legal exposure |
| **Notes** | Anything else — visitors, equipment failures, location issues | |

**Exhibit G** (US) is the companion daily sheet recording every performer's
work, meal, and travel times for SAG-AFTRA compliance; the UK equivalent runs
through the daily movement order and timesheets. It is signed and it is the
basis of every penalty claim.

Read as a series, DPRs tell the story of a production more honestly than
anyone's account of it: creeping wrap times, growing gaps between call and
first shot, and a rising "lost time" column are the recognised early signature
of a shoot going wrong.

---

## 3. Anatomy of a shooting day

A conventional **12-hour crew day** (which is standard, and already long):

| Time | Event |
|---|---|
| −2h to −4h | Cast makeup/hair/costume; rigging crew already on location |
| 0:00 | **Crew call.** Trucks unloaded, first setup begun |
| 0:00–0:30 | **Blocking rehearsal**: director and actors walk the scene for camera; HODs watch |
| 0:30 | Actors released to final touch-ups; **stand-ins** take their marks |
| 0:30–1:30 | **Lighting and setup**: gaffer/grip build the light, camera sets, sound places mics, dressing adjusted |
| 1:30 | Actors back; **rehearsal for camera** with the real cast |
| 1:35 | **"Picture is up"** → roll sound → roll camera → mark it → **action** |
| … | Multiple **takes**; director selects **circle takes** |
| … | **Turnaround** — the camera is repositioned for the reverse angle; relight (the biggest time cost in coverage) |
| ~6h | **Lunch** — must break within 6 hours of call or incur meal penalties |
| ~6h–11h | Second half; more setups |
| 11h–12h | Last shot ("**the martini**"), then **wrap**: strike, load, secure |
| +12h | **Turnaround clock starts** — minimum rest before next call |

A day is measured in **setups completed** and **pages in the can**, both
reported on the DPR against what the schedule promised.

### 3.1 Before the crew arrives

The shooting day does not begin at crew call. Several clocks are already
running:

| Who | Doing what | When |
|---|---|---|
| **Rigging gaffer and rigging grip** | Pre-rigging the day's lighting — overheads, condors, balloon lights, distribution — often the day before or overnight | −1 day to −6h |
| **Standby art / set dressing** | Final dressing, greens, snow, dust, practicals working | −4h to −2h |
| **Transport** | Moving trucks, unit base, cast pickups | −4h |
| **Catering** | Breakfast open before crew call, always | −1h |
| **Hair, makeup, costume** | Cast in the chair. A lead in prosthetics may be a **3–4 hour** makeup call; standard is 45–90 minutes | −4h to −1h |
| **Locations / security** | Site open, parking marshalled, public held, neighbours notified | −3h |
| **1st AD** | Walking the set with the director before anyone else arrives, confirming the plan for setup one | −30m |

The single most valuable half-hour on a shoot is often the director and DP
walking the location before crew call, because the first setup of the day is
the one most likely to run long.

### 3.2 A setup, end to end

A **setup** is one camera position. Everything on a shooting day is a repeat of
this loop, and understanding it is understanding the shoot. Directional
timings for a studio drama; action, VFX, and night work are all slower.

| # | Step | Who is working | Who is waiting | Typical |
|---|---|---|---|---|
| 1 | **"We're going again"** — the 1st AD calls the next setup and states it out loud to the floor: what the shot is, who's in it, and what's needed | 1st AD | — | 1 min |
| 2 | **Blocking** — director walks the scene with the actors; DP and 1st AD watch; the operator finds the frame | Director, cast, DP, operator, 1st AD, script supervisor | Everyone else, in position, silent | 10–25 min |
| 3 | **Marking** — 2nd AC lays **marks** (tape, or "T-marks") on the floor for every actor position; script supervisor notes positions, eyelines, and continuity | 2nd AC, script supervisor | Cast about to be released | 2–5 min |
| 4 | **Handover** — the actors are released to their trailers or to final touch-ups; **stand-ins** take their marks | 2nd AD, stand-ins | Cast off the floor | 2 min |
| 5 | **The build** — the longest step. Gaffer and best boy set lamps to the DP's design; grips set flags, nets, diffusion, negative fill, and the camera support (dolly track, crane, Steadicam prep); camera team builds the configuration and sets lens; sound places boom positions and radio mics; standby props and set dressing adjust the frame; standby costume and makeup wait | Electric, grip, camera, sound, art standbys | Director, cast, and every department not in the frame | **20–60 min** (day interior); 45–120 min (large exterior or night) |
| 6 | **Marking-up / "second team out"** | 2nd AD calls first team back | | 1–3 min |
| 7 | **Rehearsal for camera** — the real cast, with the real light and the real camera move. Focus puller takes marks off the actors' actual positions; the operator confirms the frame; the boom operator checks for shadows | Cast, camera, sound, director | Everyone | 5–10 min |
| 8 | **Final checks** — "last looks": hair, makeup, and costume come in together and touch up; props reset; effects arm | H/MU, costume, props, SFX | | 2–4 min |
| 9 | **The roll** — the sequence is fixed and near-liturgical (below) | 1st AD, sound, camera, 2nd AC, director | | 30 sec |
| 10 | **The take** | Cast, operator, focus puller, dolly grip, boom operator | | 20 sec–4 min |
| 11 | **"Cut"** — the director's call, and only the director's (or the 1st AD's on a safety issue). Script supervisor times and notes the take; DIT confirms the file; director consults DP and script supervisor | Director, script supervisor, DP | | 30 sec–3 min |
| 12 | **The reset** — actors return to first positions; props reset; SFX reset; the sequence repeats. **Reset cost is the hidden variable**: a dialogue scene resets in 20 seconds, a squib or water gag in an hour | Props, SFX, costume, makeup | | 20 sec–2 hr |
| 13 | **"Moving on"** or **"Check the gate"** — the 1st AD announces the scene is complete for that angle; the unit turns around | Everyone | | — |

**The roll sequence** — spoken aloud, every time, because it is a safety and
sync protocol as much as a ritual:

```
  1st AD:      "Lock it up."        (locks the perimeter, silence called)
  1st AD:      "Roll sound."
  Sound mixer: "Sound speed."       (recorder running, timecode locked)
  1st AD:      "Roll camera."
  Operator:    "Camera speed."      or "Rolling."
  2nd AC:      "Scene 42 Apple, take 3"  — claps the slate
  Director:    "Action."
   …
  Director:    "Cut."
  1st AD:      "Going again" / "Moving on" / "Back to one."
```

Note who calls what. The **1st AD runs the floor**; the **director runs the
performance**. The 1st AD says "roll"; the director says "action" and "cut".
When a director starts calling "roll", or a 1st AD starts calling "action",
something has gone wrong in the relationship.

### 3.3 What every other department is doing during the build

This is the part outsiders never see. During a 40-minute lighting build,
nobody who is competent is idle:

| Department | During the build |
|---|---|
| **Camera** | 1st AC preps lenses and filters for this and the *next* setup; 2nd AC preps slates, camera reports, and fresh media; DIT ingests and backs up the previous setup's cards |
| **Sound** | Boom operator walks the move for shadows and cable routes; the mixer builds the mix and pre-labels tracks; the utility runs radio mics for the next cast |
| **Art / props** | Standby props resets the frame for continuity and preps the next scene's items; set dressing swaps dressing for the reverse |
| **Costume / H&MU** | Continuity photographs checked; the next scene's changes prepped; ageing, blood, sweat, and dirt levels matched from the script supervisor's stills |
| **Script supervisor** | Lining the script for the completed angle, noting screen direction, matching action, and preparing the continuity brief for the reverse |
| **2nd AD** | Building tomorrow's call sheet, moving cast, managing background |
| **Stunts / SFX** | Rehearsing the gag on the side, dry-running with doubles |
| **Editorial** | Assistant editor pulling and syncing yesterday; the editor cutting the previous days and flagging holes |
| **Producer / UPM** | On the phone about tomorrow, next week, and the thing that just broke |
| **Director** | **This is the director's most valuable time.** Working with actors away from the floor, watching the previous take, or planning the reverse with the DP |

A well-run set has the next setup's requirements already staged at the edge of
the floor. A badly run set discovers at the moment of the turnaround that the
dolly track is on the truck.

### 3.4 The dead time, and who owns removing it

Dead time on a set is not random. It clusters in a small number of recognised
places, and each has an owner:

| Dead time | Typical cost | Mechanism | Owner |
|---|---|---|---|
| **Call to first shot** | 45–120 min | The first setup is built cold with nothing pre-rigged | 1st AD (schedule it), rigging gaffer (pre-rig it) |
| **Waiting on cast** | 5–60 min | Makeup overran, or nobody called them from base early enough | 2nd AD |
| **Waiting on lighting** | The big one | The DP is designing at the lamp rather than having designed in prep | DP and gaffer |
| **Waiting on the director** | 5–45 min | Shot not decided; blocking being invented on the floor | Director (and 1st AD, for not forcing the decision) |
| **Turnaround relight** | 20–60 min | The reverse needs a wholly new light | DP — mitigated by lighting the room, not the angle |
| **Lunch to first shot after** | 30–60 min | The unit disperses and reassembles; the "**post-lunch dip**" is real and universally complained about | 1st AD |
| **Company move** | 60–180 min | Everything on the truck, driven, unloaded, rebuilt | 1st AD and UPM in scheduling; locations in choosing |
| **Reset on effects/stunts** | 15 min–3 hr | Physical restoration of the gag | SFX supervisor, stunt coordinator |
| **Technical fault** | 5 min–hours | Camera, generator, media, or comms failure | Relevant HOD |

The **1st AD is the person paid to remove this time**, and it is the core of
the job. The tools are: pre-rigging, a second lighting unit leapfrogging ahead,
sequencing setups so the relight is minimal, holding actors close to set,
pushing the director to a decision, and — the most underrated — announcing
clearly and early what is coming, so twelve departments can prepare in
parallel instead of in series.

### 3.5 Where the shape of the day differs

- **Studio stage vs. location.** A stage day has no weather, no public, no
  travel, and a pre-rigged overhead grid; the same scene can run **20–40%
  faster** than on location. Locations buy production value with time.
- **US vs. UK.** UK crews conventionally work a **10- or 11-hour** shooting
  day with a **continuous 1-hour lunch** and a strong culture of wrapping on
  time; US crews work **12 hours plus** with widespread accepted overtime.
  UK productions also commonly take a **"French hours"**-style running-buffet
  arrangement only by explicit agreement; it is not the default.
- **Television.** Episodic drama runs 5–8 pages a day against a feature's 2–4,
  with the same crew size, which is achieved through fewer setups, more
  multi-camera work, standing sets, and far less coverage per scene.
- **Independent.** Smaller crew, fewer trucks, faster turnarounds between
  setups, but no depth on any department — one failure stops everything,
  because there is no second of anything.

---

## 4. Coverage

**Coverage** is the set of angles from which a scene is shot, giving the editor
options. Standard grammar:

- **Master** — the whole scene, wide, from one angle.
- **Two-shot / over-the-shoulder (OTS)** — the conversational middle ground.
- **Singles / close-ups (CU)** — one per actor, both directions.
- **Inserts** — hands, objects, screens, notes.
- **Cutaways / reaction shots** — for rhythm and for repair.
- **Establishing shot** — the geography, often second unit.

**Screen direction** and the **180° rule** are the continuity constraints the
script supervisor polices; violating them without intent produces a scene that
cannot be cut together.

### 4.1 The shot list and how a director actually plans

A **shot list** is a numbered inventory of every setup the director intends for
a scene, in intended shooting order, with shot size, lens or focal length,
camera support (sticks, dolly, handheld, Steadicam, crane), movement, and which
dialogue or action each covers. It is produced by the director, usually with
the DP, and it is the document the 1st AD schedules against.

The planning artefacts, in escalating order of investment:

| Artefact | What it is | Who makes it | When | Used for |
|---|---|---|---|---|
| **Shot list** | Text list of setups per scene | Director + DP | Prep, refined nightly | Everything |
| **Overheads / floor plans** | Top-down diagram of the set with camera positions, lamps, and actor paths | Director, DP, 1st AD, PD | Prep and tech scout | Blocking and lighting planning |
| **Storyboards** | Drawn frames | Storyboard artist to the director's direction | Prep | Action, VFX, complex geography |
| **Previs** | Animated 3D sequence with real lens and timing data | Previs company | Prep, months ahead on tentpoles | Action and VFX; also budgets the sequence (`08-vfx-and-specialty.md` §1) |
| **Stunt-vis / postvis** | Rehearsed action filmed and cut, or temp VFX in the edit | Stunt team / editorial | Prep and during the shoot | Proving the sequence works before it is built |

**How a director actually decides.** The competent process is not "list some
nice angles". It runs roughly:

1. **What is the scene about?** Not the plot content — the *turn*. Who wants
   what, and at what moment does it change hands. Everything else follows.
2. **Whose scene is it?** Point of view determines whose reactions matter and
   therefore where the camera lives.
3. **What is the one image the scene is for?** The frame the audience should
   remember. Protect it; the rest is service.
4. **How does the blocking express it?** Where people move, and when, does more
   dramatic work than the shot list. Most experienced directors block first and
   shoot-list second — this is why some directors do their real planning on the
   floor with the actors and refuse to lock a list in prep.
5. **What does the editor need to have a choice?** Deliberately: what are the
   two ways this could be cut, and does the material support both.
6. **What can be afforded?** The 1st AD prices the list in setups and hours,
   and the list is cut to fit the day. This negotiation happens every single
   day of a shoot.

### 4.2 The main coverage strategies and their trade-offs

| Approach | What it is | Day cost | Edit flexibility | Risk |
|---|---|---|---|---|
| **Master + singles ("the coverage pattern")** | Wide master, then OTS and CU each way, plus inserts | 6–12 setups per scene | Very high | Slow; can feel televisual; performance energy decays across a long day of repeats |
| **Selective / fragmented coverage** | Only the pieces the director intends to use; no full master | 3–6 setups | Moderate | If the intent is wrong, there is no fallback |
| **Oner (single continuous take)** | The whole scene in one developing shot | 1 setup, but potentially a whole day of rehearsal and many takes | Almost none | The take must be perfect in every department simultaneously; unusable if any element fails |
| **Shooting "in the round"** | Lighting the whole set for 360° so the camera can point anywhere without a relight | High setup cost once, then very cheap turnarounds | High | Lighting is a compromise everywhere; the look is flat unless carefully controlled |
| **Multi-camera (A/B/C cam)** | Two or more cameras running simultaneously on different sizes | Fewer setups, more time lighting a compromise, more media and post cost | High for performance matching | Lighting must serve all cameras, which usually means it serves none of them perfectly |
| **Two-camera "cross-shooting"** | Both actors' singles captured at once in a dialogue scene | Roughly halves dialogue setups | High | Cameras see each other's light; the DP's control drops sharply |
| **Walk-and-talk / Steadicam** | Continuous developing movement through space | Moderate setups, high rehearsal | Moderate | Cutting into it is hard; the geography must be right |
| **Static / tableau** | Locked frames, minimal coverage, long holds | Very few setups | Low | Total commitment to the frame; unforgiving of performance variance |

Two structural truths behind the table:

- **The turnaround, not the take, is the expensive thing.** Shooting a
  reverse angle usually means re-lighting for the opposite direction. This is
  why coverage is priced in *turnarounds*, and why a DP who lights the whole
  room (rather than the shot) can save a production hours a day.
- **Multi-camera trades lighting quality for time**, and every DP has a
  position on that trade. Comedy and television lean heavily toward
  multi-camera because performance simultaneity matters more than image
  control; a controlled visual style leans away from it.

### 4.3 How coverage decisions constrain the edit

The editor can only assemble what exists. Coverage decisions therefore
determine, months later and irreversibly:

| Coverage choice | What it gives the edit | What it forecloses |
|---|---|---|
| A clean master of the whole scene | A safety net; the scene can always be played | — |
| Singles both directions, full scene | Freedom to re-time, cut lines, change emphasis, and repair performance | — |
| Reaction shots and cutaways | The ability to **cheat time** — shorten a scene invisibly, cover a jump, fix a continuity error | — |
| A oner | A specific rhythm, exactly as directed | Any change of pace, any line cut, any performance repair |
| No master | Speed on the day | The ability to fall back if the intended cut does not work |
| No inserts | Time | The ability to redirect attention or bridge a cut |
| Coverage shot only on the speaking actor | Time | Reaction — often the actual content of the scene |

The two most common regrets heard in a cutting room are "we have no way out of
this scene" and "there is no reaction". Both are coverage failures made weeks
earlier, and the second is the more common: inexperienced directors shoot the
person talking.

**Continuity constraints** compound this. If eyelines do not match, if screen
direction reverses without a neutral shot, if a prop moves between angles, or
if the action does not overlap between the master and the single, the pieces
physically cannot be cut together no matter how good each is. This is the
script supervisor's entire job, and it is why they sit next to the director
rather than at the back.

### 4.4 "Not getting the scene"

A scene has been "got" when the material will cut into something that plays.
It has *not* been got when it will not — and the failure has several distinct
shapes:

| Failure | What it looks like on the day | Where it surfaces |
|---|---|---|
| **Incomplete coverage** | The unit ran out of day and the reverse was never shot | Editorial, within 48h |
| **No usable performance** | Every take is technically fine and dramatically dead | Dailies or assembly |
| **Continuity break** | Angles do not match; the pieces do not join | Assembly |
| **The scene doesn't work as written** | Everyone shot it correctly and it is still inert | Assembly or test screening |
| **The wrong scene was shot** | The blocking or emphasis contradicts what the film needs it to do | Assembly, sometimes months later |
| **Technical** | Soft focus, boom in frame, sound unusable, flicker, a mark missed | Dailies, ideally same night (§9) |

**How a director knows.** The reliable tells, roughly in order of how early
they arrive:

1. **The room goes quiet in the wrong way.** Experienced crew know.
2. **The script supervisor's timing** — the scene is running much longer or
   shorter than the read-through, which usually means the performance has
   drifted.
3. **They cannot describe the cut.** If the director cannot say out loud how
   the scene assembles, the coverage is probably wrong.
4. **Dailies play flat.** The single most common moment of recognition.
5. **The editor's assembly** cannot make it work, and the editor says so — the
   most valuable and least comfortable relationship on a film (§9.3).

The director's options once they know, in ascending cost: shoot one more
insert or reaction before the unit moves; go back to the location before it is
released; schedule a pickup day (§10); reshoot (§10). The gap between
recognising it *while the set exists* and recognising it *after wrap* is
frequently a factor of ten in cost.

### 4.5 Coverage philosophy, and why directors differ

Directors vary enormously here, and it is one of the most consequential
choices in whether a film can be saved in the cutting room.

- **The maximalist** covers everything, always, on the theory that film is
  made in the edit. Costs setups; produces long shooting schedules; the
  resulting film can be re-conceived in post.
- **The minimalist / "cutting in camera"** shoots only what will be used,
  often refusing to shoot a master. Fast and precise; the film is essentially
  locked at the moment of shooting, which studios dislike and which removes
  the studio's ability to re-cut. Hitchcock is the canonical example, and
  some directors do this partly *to* remove that ability.
- **The blocking-first director** spends the morning finding the scene with
  the actors and lets the coverage fall out of it. High ceiling, high variance
  in schedule.
- **The oner director** builds long developing takes. Enormous rehearsal load,
  minimal setup count, spectacular when it works.
- **The action director** works from previs and shot lists in a wholly
  different economy: a two-minute sequence may be 200 setups over three weeks,
  and the "coverage" question becomes an editorial-density question decided in
  prep.

None of these is right. What is objectively wrong is **covering everything
badly** — a full pattern shot without intent, which consumes the day, exhausts
the cast, and still gives the editor nothing usable because no angle was
directed with a purpose.

---

## 5. Time sinks — what actually loses days

In rough order of destructiveness. Each entry has a **mechanism** (why it
costs time, not just that it does) and a directional cost.

### 5.1 Company moves

**Mechanism.** Every truck must be packed, driven, unloaded, and rebuilt; the
lighting is struck at one end and rigged at the other; cast are transported
separately; the crew's meal clock keeps running throughout.

**Cost.** A **local move** (same neighbourhood) is **60–90 minutes**. A move
across a city, or from location to stage, is **2–3 hours**. Two moves in a day
is a day with about four productive hours in it. A move immediately after
lunch is the standard mitigation, because the meal break absorbs part of it.

**Prevention** is a scheduling problem, made in prep: group scenes by location
regardless of script order, and choose locations that cluster
(`04-preproduction.md` §5.4).

### 5.2 Lighting turnarounds

**Mechanism.** The reverse angle points at the lamps that lit the first angle.
Everything must be moved, re-flagged, and re-balanced, and on a large exterior
that means moving condors and 18Ks, not repositioning a lamp.

**Cost.** Interior day: **20–40 minutes**. Interior night: **30–60**.
Large exterior night: **60–120 minutes**, sometimes more. On a scene shot with
the full coverage pattern, turnarounds are typically **50–70% of the elapsed
time on that scene**.

**Prevention.** Light the space rather than the shot; use two lighting units
so one leapfrogs; shoot all angles in one direction before turning around
(which costs continuity discipline and actor patience, since one actor plays
their off-camera lines for hours).

### 5.3 Weather

**Mechanism.** Three distinct problems, often conflated. **Rain** stops
exteriors and damages equipment. **Wind** ruins sound before it ruins picture —
a boom in 25mph wind is unusable. **Inconsistent sun** is the worst of the
three, because it does not stop shooting: it silently destroys continuity
between shots of the same scene, and the damage is only visible in dailies.

**Cost.** A washed-out exterior day is a lost day unless a **cover set** —
an interior that can be shot at no notice, pre-lit and standing by — is
available. Productions deliberately hold one throughout any exterior block.
The mitigation for inconsistent sun is diffusion frames (**12x12 or 20x20
silks**) held over the playing area, which cost time to rig and are wind-
limited.

### 5.4 Losing the light

**Mechanism.** Exteriors have a hard, non-negotiable deadline. **Magic hour**
(the period around sunrise/sunset with soft directional light) is **20–40
usable minutes** and cannot be extended, purchased, or rescheduled within the
day.

**Cost.** If the shot is not achieved, it returns tomorrow at the same time —
meaning a whole day is committed to reacquire twenty minutes. Productions
routinely schedule two or three consecutive days' magic hours for one
sequence, and use the daylight hours around them for other work.

### 5.5 Cast issues

**Mechanism.** Several: late arrival; illness (which triggers an insurance
claim and a schedule rebuild); an actor who does not know the lines, which
converts a 20-second reset into a 5-minute one across forty takes; and an
actor who needs more rehearsal than the schedule assumed.

**Cost.** Line-unpreparedness on a lead is worth **1–3 hours a day, every
day**, and is the single most common private complaint of 1st ADs. Illness of
a principal in a scene with no cover work is a **lost day** at full burn, and
is claimable on cast insurance (`03-financing-and-dealmaking.md` §8) only above
the deductible and with documentation.

### 5.6 Director indecision

**Mechanism.** A hundred and eighty people stand still while one person
decides. This is uniquely expensive because it is pure dead time — no
department is progressing.

**Cost.** **15–45 minutes per occurrence**, three or four times a day on a
badly prepared shoot, is a lost day per week. The mitigation is prep: a
director who arrives with a shot list, overheads, and a clear intention makes
these decisions in prep at zero marginal cost.

### 5.7 Technical failures

**Mechanism.** Camera body faults, lens issues, generator failure, data
corruption on a card, comms failure, or a monitor/video-village outage.

**Cost.** Camera failure is usually **5–20 minutes** because there is a B-camera
or a backup body on the truck; on a small production with one camera it can be
a lost half-day. **Data loss** is the catastrophic case: material that was not
verified before the cards were wiped is gone, and the scene must be reshot.
This is why the DIT's checksum-verified backup to **at least two, usually
three** destinations before any card is formatted is a non-negotiable protocol.

### 5.8 Effects and stunt resets

**Mechanism.** Anything that physically changes state must be restored:
squibs replaced, costumes swapped, blood washed, water drained, snow re-laid,
a car repaired or a duplicate brought in, pyro re-charged and re-certified.

**Cost.** **15 minutes to 3 hours** per reset. Productions respond by
**covering the gag with multiple cameras** (four to eight is common) and
shooting it once or twice rather than repeating it — which is why a stunt or
pyro day may deliver 1/8 of a page and be considered a success. Where a gag is
genuinely one-shot (a building collapse, a real crash), it is rehearsed
exhaustively with doubles, previs'd, and covered from every angle
simultaneously, because there is no second take.

### 5.9 Child and animal work

**Mechanism.** Minors have statutory limits on hours on set, hours actually
working, and mandated schooling and rest, enforced by a studio teacher or
licensed chaperone with authority to stop work. Animals work through a trainer
and are monitored by a welfare body (American Humane in the US) whose sign-off
gates the "no animals were harmed" end credit.

**Cost.** A young child may be available for **2–4 hours of actual work** in a
day. Productions respond with twins for infants and very young children, body
doubles for over-the-shoulders, and scheduling the child's material first.
Animal work is unpredictable by nature: budget **double** the setups.

### 5.10 Crowds and the public

**Mechanism.** Location shooting in populated areas means holding traffic and
pedestrians, and a lock-up that fails ruins takes. Every uncontrolled phone,
car horn, or shouted comment is a take lost.

**Cost.** Typically 10–25% of takes on an uncontrolled urban exterior. Managed
with a large lock-up team of extra 2nd ADs and PAs, police or traffic control
where permitted, and neighbourhood letters delivered days ahead (the location
manager's job, `04-preproduction.md` §5.3).

### 5.11 The quiet ones

Less dramatic, and collectively larger than any of the above:

| Sink | Mechanism | Typical daily cost |
|---|---|---|
| **Slow call-to-first-shot** | Nothing pre-rigged; the day starts cold | 30–60 min |
| **Cast travel from base to set** | Base parked too far away | 20–40 min per fetch |
| **Costume changes** | A change mid-scene with prosthetics or corsetry | 15–60 min each |
| **Background management** | 200 extras cannot be moved quickly | 10–20 min per reset |
| **Video village drift** | Producers and executives giving notes on the floor | Unbounded |
| **"One more for safety"** | Takes shot without a reason | 2–5 min each, 20+ times a day |
| **Radio discipline** | Requests going out serially rather than in parallel | 5 min per setup |

---

## 6. Night, weather, and special conditions

### 6.1 Night shoots

**Night work** is not "the same day, later". It is a distinct operating mode.

- **Scheduling.** A unit cannot flip between day and night work freely — the
  turnaround rules (§7) plus human physiology mean the transition costs a
  **split day** or a rest day at each end. Productions therefore schedule
  night work in **blocks of consecutive nights**, usually a week or more, and
  move the crew's whole clock. Going in and out of a night block costs
  roughly **half a day each way** in productivity.
- **The "Friday night" problem.** A night block ending Friday morning collides
  with **weekend turnaround** (§7), which is why night blocks are usually
  built to end mid-week or run Sunday-to-Thursday nights.
- **Payment.** Some agreements carry a night premium; in the US the more
  significant cost is that night work reliably pushes into overtime because
  the useful hours are bounded by darkness at both ends.
- **Productivity.** A night unit achieves roughly **60–80%** of the setups of
  the equivalent day unit: everything must be lit from nothing, crew fatigue
  is higher, error rates rise, and safety exposure increases.
- **Lighting scale.** A night exterior street is lit with condors (cherry
  pickers with large fixtures at height), often a **balloon light**, and
  practical sources dressed in by the gaffer. Rigging that takes a rigging
  crew a full day *before* the unit arrives.

### 6.2 Day for night and night for day

| | **Day for night** | **Night for night** | **Night for day** |
|---|---|---|---|
| Method | Shot in daylight, underexposed and graded blue/dark; sky avoided or replaced | Shot at night with a full lighting rig | Interior shot at night with lamps simulating daylight through windows |
| Cost | Cheapest | Expensive — the rig, the hours, the premiums | Moderate; the rig is standing |
| Look | Recognisably artificial unless carefully done; the giveaway is shadows and sky | Correct | Correct if the windows are properly blown out |
| Used for | Wide exteriors, water, and anything unaffordable at night | Anything that reads as night on camera | Stage interiors, to keep a unit on a day schedule |

Modern practice increasingly does **"day for night" in the DI** with sky
replacement and window pulls (`07-postproduction.md` §6), which has improved
the look but shifts cost into post.

### 6.3 Water

The standing rule is that **everything takes twice as long, and then some**.

- **Roles required.** Marine coordinator, safety divers (typically one per
  performer in the water), water safety supervisor, lifeguards, and a medic
  with cold-water protocols.
- **Physiology.** Performers and stunt crew have limited time in cold water;
  work is measured in short immersion blocks with warming between. This alone
  can halve the achievable takes.
- **Tank vs. open water.** A **water tank** with a horizon or blue screen
  gives control and is the standard for anything shot repeatedly. Open water
  gives reality and costs schedule: boats drift, continuity of sea state is
  impossible, and half the crew are seasick.
- **Equipment.** Splash bags, underwater housings, and separate underwater
  camera and lighting teams; electrical safety around water requires isolation
  and dedicated checks before every roll.

### 6.4 Aerial, drone, and vehicle work

- **Aerial** work (helicopter, plane, gimbal systems) is separately licensed,
  weather-bound, and scheduled as its own unit with its own weather window.
  It is one of the historically most dangerous areas of film production and is
  correspondingly regulated.
- **Drones (UAS)** require a licensed operator, aviation authority permission
  (FAA in the US, CAA in the UK), and airspace clearance; they cannot be flown
  over uninvolved people without specific approval. Cheap compared with a
  helicopter, but not free of process.
- **Picture vehicles** are run by a **picture car coordinator** and a
  **precision driver** team; process trailers, low-loaders, and **pod cars**
  (with the actor apparently driving while a driver operates from a rig on the
  roof) are the standard techniques, and each takes 45–90 minutes to rig and
  re-rig between angles. A road closure is a police and permit matter with
  fixed hours.

### 6.5 Environmental extremes

| Condition | What it does | Mitigation |
|---|---|---|
| **Cold** | Batteries fail, lubricants stiffen, crew dexterity drops, statutory warming breaks, cast in period costume cannot stay out | Heated tents, battery management, shortened work blocks, shooting cold sequences on stage with snow effects |
| **Heat / desert** | Heat illness risk, equipment overheating, sensor noise, mirage distortion in long lenses, sandstorms | Earlier calls, mandated shade and hydration, midday breaks, medics |
| **Altitude** | Reduced crew capacity, medical screening, helicopter access constraints, oxygen on standby | Acclimatisation days, smaller units, doubled schedule allowance |
| **Jungle / remote** | Everything must be carried; medical evacuation planning; disease exposure | Small units, extensive medical plan, satellite comms |
| **Snow (real)** | It melts, it stops falling, and continuity is impossible | Snow effects on top of real snow; shoot the wide first |

A general rule: extreme conditions do not merely slow the unit, they
**reduce the number of achievable setups per hour and simultaneously raise
the injury rate**, which is why a bond company scrutinises any schedule with
significant extreme-condition days (`03-financing-and-dealmaking.md` §7).

---

## 7. Overtime, turnaround, and penalties

Hard constraints, negotiated by union agreement. The exact numbers vary by
agreement, local, country, and year — what follows is the *shape*, and it is
stable even where the figures move.

### 7.1 The structure

- **Standard day**: typically 8 hours at base rate, then **time-and-a-half**,
  then **double time** beyond a further threshold, with a "**golden time**"
  tier (often double or triple, sometimes per-hour-or-part-thereof) beyond a
  high threshold on some agreements.
- **Meal penalties**: escalating per-person charges for every increment past
  the meal deadline — commonly 6 hours from crew call, with a second meal
  deadline 6 hours after the first. The increments escalate (a small amount for
  the first, more for the second, more again after).
- **Turnaround**: a minimum rest period between wrap and the next call —
  commonly **10 hours** for crew, sometimes **12** for cast, and longer over a
  weekend ("**weekend turnaround**", commonly 54–56 hours from Friday wrap).
  Breaking it means paying a **forced call** penalty, typically a full day's
  pay or a substantial premium, for every affected person.
- **6th and 7th day**: premium rates (time-and-a-half and double time
  respectively is a common shape).
- **Distant location**: per diem, housing, travel days, and often a guaranteed
  minimum number of paid hours regardless of work.
- **Night premium** and **hazard/wet/smoke pay** exist under some agreements.

### 7.2 Worked examples

These are illustrative arithmetic on directional rates, not quotations from any
specific agreement. They exist to show the *shape* of the cost.

**Example A — running two hours long on a 150-person crew.**

A 12-hour day was planned. The unit wraps at 14 hours.

| Item | Calculation | Cost |
|---|---|---|
| Crew overtime, hours 12–14 | 150 people × 2 hrs × ~$60/hr blended × 2.0 (double time) | ~$36,000 |
| Second meal not broken on time (say 45 min late) | 150 people × ~$25 escalating penalty | ~$3,750 |
| Cast overtime (4 principals on weeklies with overtime provisions) | Varies wildly; often the largest single line | $5,000–$40,000 |
| Equipment, facilities, catering extension | | ~$4,000 |
| **Total for two extra hours** | | **~$50,000–$85,000** |

Against a $250K daily burn, those two hours cost roughly **20–35% of a whole
day** — which is the origin of the standing rule that *the last two hours can
cost more than the first eight*.

**Example B — a turnaround violation.**

The unit wraps at 9pm Tuesday. The 10-hour turnaround means the earliest crew
call is 7am Wednesday. The 1st AD needs a 6am call to catch the light.

| Item | Effect |
|---|---|
| Forced call penalty | Every affected crew member is owed a penalty — often a full additional day's pay. On 150 people at ~$500/day blended, that is **~$75,000** for one hour |
| Cast turnaround | Usually longer and more expensive; a lead's forced call can be a substantial contractual penalty |
| Safety exposure | A fatigued crew driving home and back is the actual reason the rule exists |

The 1st AD's real options are: wrap earlier tonight, start later tomorrow and
lose the light, **stagger the call** so only the departments that must be in
early are broken (rigging, camera, makeup), or move the scene. Staggering is
the standard answer, and it is why call sheets often carry six different call
times.

**Example C — the invisible one.**

Wrapping 20 minutes late every day for a 45-day shoot is 15 hours of overtime
that never appears as an incident and never gets flagged, and on a 150-person
crew it is a six-figure line by the end of the shoot. UPMs watch the *trend*
of wrap times for exactly this reason.

### 7.3 Consequences for how a shoot is run

- Pushing a unit to finish a day is not free, and the marginal cost of the
  last two hours can exceed the cost of the first eight.
- Therefore the decision "shoot the last setup or drop it" is a genuine
  economic calculation made at hour 11 by the 1st AD, UPM, and director, and
  the answer is often to **drop coverage rather than pay for it** (§16).
- **Grace periods** (a short unpenalised window, e.g. 12 minutes on some
  agreements) exist and are used, and abused.
- The single cheapest lever is **breaking the meal on time**, which costs six
  minutes of discipline and saves a five-figure penalty on a large crew.

---

## 8. Safety

Legally the 1st AD's responsibility on the floor, and the producer's overall.
In the UK, statutory duties under health and safety law sit with the
production company and are administered through a **production safety
adviser**; in the US the framework is the industry **Safety Bulletins** issued
by the Industry-Wide Labor-Management Safety Committee, plus OSHA and state
law. The vocabulary differs; the practice converges.

### 8.1 How a hazardous sequence is actually run

Take a sequence involving a car hit, a stunt performer on a ratchet, and a
pyro charge. The chain, in order:

| Stage | What happens | Who |
|---|---|---|
| **Prep: design** | The stunt coordinator designs the gag with the director; the SFX supervisor designs the pyro; previs or stunt-vis proves it | Stunt coordinator, SFX supervisor, director |
| **Prep: risk assessment** | A written document per hazard: what could go wrong, likelihood, severity, controls, residual risk. Reviewed and signed | Coordinator, safety adviser, 1st AD, producer |
| **Prep: permissions** | Pyrotechnic licence, local fire authority sign-off, road closure, insurance notification | SFX supervisor, locations, production |
| **Prep: rehearsal** | The gag is rehearsed at reduced intensity, then at full intensity without cameras, usually on a separate rehearsal day | Stunt team, SFX |
| **On the day: the safety meeting** | Held on the floor before anything is rigged. Attendance is compulsory and recorded. The coordinator explains the sequence, the hazards, the exclusion zones, the signals, and the abort word | 1st AD chairs; coordinator briefs; **entire unit attends** |
| **On the day: zoning** | The floor is physically divided — hot zone (performers and coordinator only), camera positions with distance minimums, crew exclusion line, medic position, fire cover, ambulance staging | 1st AD, coordinator, SFX |
| **On the day: roles named** | Who arms, who fires, who calls the abort, who has the extinguisher, who checks the performer afterward. Named individuals, not departments | Coordinator |
| **On the day: the walkthrough** | Every person in the zone walks their position and their escape route | 1st AD |
| **The roll** | Extended protocol: "hot set", zone cleared and confirmed department by department over radio, fire cover confirmed, medic confirmed, performer confirmed ready, **then** roll | 1st AD |
| **The fire** | The SFX operator fires on the coordinator's or director's cue; **anyone** may call the abort | SFX operator |
| **Immediately after** | Medic to the performer, area made safe, charges checked, only then "clear" | Medic, SFX |
| **Reset or move on** | Full reset with the same sign-off chain, every time | All |
| **Record** | Incident or near-miss logged on the DPR regardless of outcome | 1st AD, 2nd AD |

The two principles under all of it: **anyone can stop the shot, and nobody may
restart it except the person responsible for that hazard**; and **no rehearsal,
no take** — a hazardous action is never performed for the first time on a
rolling camera.

### 8.2 The sign-off chain

```
  Producer            (overall statutory / contractual responsibility)
      │
  1st AD              (responsible for safety on the floor, day to day)
      │
  Safety adviser      (advises, writes/reviews risk assessments; may stop work)
      │
  Specialist HOD      (stunt coordinator / SFX supervisor / armourer /
      │                marine coordinator / animal trainer — owns their hazard)
      │
  Performer & crew    (any individual may refuse or stop; this is protected)
```

Insurers and the completion bond sit above all of it: an uninsured or
un-assessed sequence will simply not be permitted to shoot
(`03-financing-and-dealmaking.md` §8).

### 8.3 Specific regimes

- **Firearms**: the **armourer** (US: property master's weapons specialist or
  a dedicated armourer; UK: a licensed armourer) controls every weapon on
  site. Industry practice **bans live ammunition entirely**, requires the
  weapon to be shown and declared **cold** before it is handed over, restricts
  who may handle it, requires it to be returned to the armourer between takes,
  and requires that no weapon is ever pointed directly at a person without
  specific safety measures (protective glass, off-axis framing, or a
  substitute). This is regulated and enforced, and failures here have been
  fatal. Post-2021 practice in the US has tightened materially, including
  wider use of non-firing replicas and VFX muzzle flashes.
- **Stunts**: never performed without a coordinator; performers are qualified,
  rehearsed, and paid an adjustment negotiated for the specific action; medics
  on standby; and the **stunt double** matched and briefed. See
  `08-vfx-and-specialty.md` §3.
- **Working at height, rigging, and electrical**: certificated riggers, load
  calculations signed off, and lock-out/tag-out on power.
- **Fatigue** is a recognised safety issue — the long-hours culture has
  produced fatal driving accidents on the drive home, and turnaround rules
  exist partly for this. Productions increasingly provide drivers or hotel
  rooms after very long days.
- **Set closure**: closed sets for nudity/intimacy, with an **intimacy
  coordinator**, consent-based choreography agreed in advance, a nudity rider
  in the contract, and monitors covered. Now standard on studio productions.
- **Environmental / biological**: water, animals, smoke and atmospheric
  effects (which have exposure limits and require ventilation planning), and
  extreme temperature all have their own protocols.

### 8.4 What good and bad safety practice look like

**Good**: hazards are identified in prep, the sequence is rehearsed, everyone
in the zone knows their role and the abort word, and the shot is achieved on
schedule because the process removed uncertainty rather than adding delay.
Well-run hazardous days are frequently *faster* than badly-run safe ones.

**Bad**, in ascending order of consequence:

| Failure | Consequence |
|---|---|
| Safety meeting skipped or rushed | Crew in the wrong place; a take lost, or worse |
| Zone not cleared or not confirmed | Injury exposure; a stop-work notice |
| Hazard added on the day without assessment | Uninsured; the bond company can refuse |
| Fatigue-driven error at hour 15 | The most common real cause of set injuries |
| Weapon handling shortcut | Fatality; criminal liability; production shut down |
| Incident concealed or not logged | Insurance void, regulatory action, career-ending |

---

## 9. Dailies

**Dailies** (UK: **rushes**) are the previous day's material, synced and
graded to a viewing standard, distributed same-day. They are the production's
only feedback loop that is fast enough to act on **while the set still
exists**, and that is their entire purpose.

### 9.1 The pipeline, overnight

| Step | Who | When |
|---|---|---|
| Cards offloaded, checksum-verified, backed up to 2–3 destinations | **DIT / data wrangler / loader** | Continuously through the day |
| Camera reports and sound reports reconciled against the slate log | 2nd AC, sound mixer, script supervisor | At wrap |
| Media and sound files shipped or uploaded | DIT / runner | At wrap |
| Sync to sound by timecode and slate; transcode to viewing format | Dailies operation (post house or on-set lab) | Overnight |
| **Look LUT / show LUT** applied — the DP's intended grade, so nobody judges an ungraded log image | Dailies colourist, to the DP's spec | Overnight |
| Watermarked, encrypted, and published to a secure platform | Post supervisor | Before next crew call |
| Script supervisor's notes and the lined script attached | Script supervisor | Same night |
| Ingested into the cutting room; scenes assembled | Assistant editor, then editor | Next day |

On a distant location without connectivity this becomes a physical process
with a runner and a hard drive, and it is why remote shoots have a slower
feedback loop and therefore a higher rate of undetected problems.

### 9.2 Who watches, and what each of them is looking for

This is the part usually left out. Different people watch dailies for
completely different things, and they are not all watching the same film.

| Watcher | Looking for | What they do about it |
|---|---|---|
| **Director** | Is the performance there; does the scene play; did I get what I thought I got | Adds a pickup, redirects tomorrow, or asks for the scene back |
| **DP** | Exposure, focus, colour consistency between angles, flicker, lens flare, whether the grade holds | Adjusts tomorrow's lighting; may request a re-shoot of one angle |
| **Editor** | Does it **cut**. Are the pieces there. Is there a reaction. Does the geography read | Sends a "we need X" note — the highest-value message on a shoot |
| **1st AC / focus puller** | Focus, take by take. This is a personal accountability review | Adjusts technique; requests a re-shoot of a soft take |
| **Sound mixer** | Usable dialogue, noise floor, radio interference, boom shadows heard about | Flags lines that will need ADR (`07-postproduction.md` §3) |
| **Script supervisor** | Continuity errors between angles, eyelines, screen direction | Notes them for the editor and for any pickup |
| **Hair/makeup/costume HODs** | Continuity of appearance across a scene shot over days | Adjusts the next day's match |
| **Production designer / set dec** | Does the set read on camera; is anything anachronistic or ugly in frame | Changes dressing before the next day on that set |
| **VFX supervisor** | Are the plates usable; are markers visible where needed and invisible where not; is the data complete | Requests a re-plate immediately (`08-vfx-and-specialty.md` §1) |
| **Producer / UPM** | Is the film good, is it on schedule, is anything about to become a problem | Escalates or reassures |
| **Studio executives** | Tone, performance, star presentation, whether the film is the film that was greenlit | Notes to the producer; in extremis, intervention |

Historically dailies were screened in a theatre with the key people present,
which produced a shared conversation. Secure streaming has made them
individual and asynchronous, which is more convenient and has measurably
weakened the feedback loop — a common complaint from editors and DPs.

### 9.3 When a problem is spotted

The response ladder, in ascending cost. The whole point is to catch a problem
at the top of this ladder rather than the bottom.

| Severity | Example | Response | Cost |
|---|---|---|---|
| Cosmetic | A prop in the wrong place in one take | Use a different take | Zero |
| Technical, one take | Soft focus on the circle take | Circle a different take, or re-shoot the angle if still on the set | Zero to 30 min |
| Technical, all takes | Boom in frame throughout; a flicker; a hair in the gate | **Re-shoot the setup** — trivial if the set is still standing today, expensive tomorrow | 30 min to a day |
| Coverage gap | No reaction shot; missing insert | Pick it up before the unit leaves the location | 15–45 min |
| Continuity break | Eyelines do not match between angles | Editor works around it, or one angle is re-shot | Variable |
| Performance | The scene is dead | Director's judgement: re-shoot now, or note it for later reconsideration | A half-day now, a reshoot later |
| Data loss | A card corrupted, unverified | Reshoot everything on it. This is the nightmare case and is why verification protocol exists | A full day+ |
| Structural | The scene doesn't work as written | Nothing today. Goes to the assembly, and possibly to reshoots (§10) | Potentially very large |

The **editor's assembly** builds alongside for exactly this reason. A good
editor cuts scenes within a day or two of shooting and says, out loud and
early, "I cannot make this work" or "I need one more shot". That message,
delivered while the location is still under contract, is worth more than any
other single input on a shoot — and productions where the editor is remote,
overloaded, or politically discouraged from speaking lose that value entirely.

---

## 10. Reshoots, additional photography, and pickups

Three distinct things, often conflated:

- **Pickups** — small missing pieces (an insert, a line, a reaction, a plate)
  shot cheaply with a minimal unit, sometimes by the 2nd unit or even by the
  VFX unit. Often within the original schedule.
- **Additional photography** — planned, budgeted extra days after the main
  shoot; on tentpoles this is normal and scheduled from the start, not a
  distress signal. It exists because the film is designed to be finished in
  the edit and the last 10% is intentionally deferred.
- **Reshoots** — re-shooting material that exists because it didn't work,
  usually triggered by an assembly screening or a test screening
  (`07-postproduction.md` §9). Expensive: the unit, cast, and sets must be
  reassembled, and cast availability may have evaporated.

### 10.1 How the decision is actually made

| Stage | What happens | Who |
|---|---|---|
| **The assembly** | The editor's first full cut, delivered within a few weeks of wrap. Almost always too long and structurally rough | Editor, director |
| **The director's cut** | A contractual period (DGA: typically **10 weeks** on a feature) during which the director cuts without studio interference | Director, editor |
| **First studio screening** | The producers and studio see a cut. Problems are named here for the first time in a room with money in it | Director, producer, studio |
| **Test screening / research** | A recruited audience scores the film; specific scenes and characters are diagnosed (`07-postproduction.md` §9) | Research company, studio |
| **The reshoot conversation** | What is broken: an act, a character, an ending, a tone. What could fix it. What is affordable and available | Studio, producer, director, editor |
| **Scoping** | A reshoot list is built — scenes, cast needed, sets needed, days required, and the cost. This is a mini-prep | Line producer, 1st AD, editor |
| **Decision** | Approved by the studio and the financiers; contingency or an overage is drawn | Studio, bond company if applicable |

The failure modes that trigger reshoots, in rough order of frequency:

1. **The ending doesn't land.** By far the most common.
2. **A character is not sympathetic / not comprehensible**, requiring new
   scenes to establish them.
3. **The third act is confusing** — connective tissue is missing.
4. **Tone mismatch** — the film is darker, or funnier, than the campaign
   requires.
5. **A performance or a chemistry problem** that cannot be edited around.
6. **A VFX or design decision changed**, requiring plates to be re-shot.
7. **External events** — a real-world event, a legal problem, or a cast member
   who has become unusable.

### 10.2 What it costs to reassemble

The distinguishing fact about reshoots is that the **per-day cost is higher
than the original shoot**, sometimes much higher, because everything must be
recreated rather than merely continued.

| Cost driver | Why it is worse than during the shoot |
|---|---|
| **Cast availability** | Actors are on other jobs. Availability, not money, is the binding constraint, and a two-day reshoot may be scheduled around one actor's single free week months later |
| **Cast appearance** | Hair length and colour, weight, tan, and beards have changed — sometimes contractually for another role. Wigs, prosthetics, and lighting compensation are routine |
| **Sets** | Struck and destroyed. Rebuilding a set for two days costs nearly what it cost to build for six weeks |
| **Locations** | Re-permitted, re-negotiated, possibly changed (a season has passed; the trees are bare) |
| **Crew** | Dispersed to other jobs. The original DP, gaffer, and key grip may be unavailable, which threatens the visual match |
| **Season and light** | Continuity of weather and foliage may be impossible; this alone can force a location change or a VFX solution |
| **Re-prep** | A reshoot needs its own prep: schedule, breakdown, costume pulls, prop recreation |
| **Post disruption** | Editorial, VFX, and sound all pause or redo work downstream (`07-postproduction.md` §1) |

Directionally, a studio reshoot block is commonly **5–20 days** costing
**$5M–$30M+** on a tentpole, and a few days at $100–300K on a mid-budget film.
Trade reporting of reshoots as evidence of disaster is often wrong — planned
additional photography is routine — but a **large, late, un-budgeted** reshoot
following a bad test screening is a genuine distress signal.

### 10.3 Cheaper substitutes for a reshoot

Post has a toolkit that is used first, because it is an order of magnitude
cheaper:

- **Re-cutting** — restructuring, dropping a scene, changing the order.
- **ADR and off-screen dialogue** — new lines laid over cutaways and backs of
  heads. The single most common invisible fix.
- **VFX**: face replacement, digital set extension, sky and weather
  replacement, removing or adding a character, changing the time of day.
- **Narration** added in post — a recognised distress signature when it is not
  in the original design.
- **Score and sound design** carrying a scene the picture does not.
- **Stock and library material**, and repurposed footage from other scenes.

A reshoot is what happens when none of these can do it, which usually means
the problem is **structural** rather than cosmetic.

---

## 11. Multiple units and blocks

### 11.1 The units

| Unit | What it shoots | Who leads | Typical size |
|---|---|---|---|
| **Main unit** | Everything with the principal cast and dialogue | Director | Full crew |
| **Second unit** | Action without principals' faces, driving, doubles, establishing shots, inserts, scenics, plates | **Second unit director**, often a stunt coordinator by background, working to the director's brief | 30–60% of main |
| **Splinter unit** | A small crew broken off the main unit for a few hours — usually to grab inserts or a plate while the main unit lights | Often the 2nd unit director, sometimes the 1st AD or a producer-director | 5–20 |
| **Plate unit / VFX unit** | Backgrounds, environments, textures, HDRIs, and scanning | VFX supervisor | 5–15 |
| **Aerial unit** | Helicopter and drone material | Aerial DP | Specialist |
| **Underwater unit** | As it says | Underwater DP + marine coordinator | Specialist |
| **Motion capture unit** | Performance capture on a volume stage | Director or a mocap supervisor | Varies (`08-vfx-and-specialty.md` §5) |

Full role breakdowns for each of these are in `05-departments-and-crew.md`
§13 and §16.

**How the work is actually split.** The dividing line is not "action vs.
dialogue" — it is **whether the principal actor's performance is legible in
frame**. Anything where the face reads belongs to the main unit. In practice a
sequence is decomposed shot by shot in prep, and the shot list is marked
**MU** or **2U** setup by setup, so a single car chase might be 30 second-unit
setups and 6 main-unit setups intercut.

The coordination costs are real: the second unit must match lighting, lens
choice, and screen direction exactly, so the DP briefs the 2nd unit DP and
frequently reviews their dailies. Second unit material that does not match is
worse than useless — it cannot be cut in, and the day is lost twice.

### 11.2 Blocks and the shape of a schedule

**Blocks** are the schedule divided into phases, usually by location or stage,
sometimes with gaps (a **hiatus**) for construction, actor availability,
seasonal requirements, or a cast member's other commitment.

A typical studio feature's block structure:

```
  Block 1  Stage — standing interiors           (4 weeks)
  Block 2  Local location — city exteriors      (2 weeks)
  ── hiatus: 1 week, stage strike & rebuild ──
  Block 3  Distant location — landscape/period  (3 weeks)
  Block 4  Night block — the action sequence    (2 weeks, nights)
  Block 5  Return to stage — remaining interiors + pickups (2 weeks)
```

Blocks exist because moving a unit is expensive (§5.1) and because sets must
be built serially on a finite number of stages. They constrain the schedule
hard: once a block ends and a location is released or a set is struck, going
back is a reshoot, not a rescheduling.

Consequences that follow from the block structure:

- **Scenes are shot wildly out of order**, so the actors and the director must
  hold the film's emotional geometry in their heads; the script supervisor and
  the director's continuity of intention are load-bearing here.
- **A scene split across blocks** (an interior on stage in week 2, its
  matching exterior on location in week 7) requires exact continuity of
  costume, makeup, weather, and light across two months.
- **Cast are scheduled in and out of blocks**, and a "**drop and pick up**"
  arrangement lets a production stop paying an actor during a gap — subject to
  guild rules on the minimum gap and on how many times it may be done.

---

## 12. Wrap

- **Wrap of a cast member** ("that's a wrap for…") ends their contract days.
  It is announced on the floor and applauded, and it is also a hard financial
  event: the actor's guarantee is satisfied, and bringing them back costs a
  new deal.
- **Unit wrap** — strike, return of equipment, restoring locations, wrap
  parties, and the closing of the production office over the following weeks.
  Wrap typically takes **1–3 weeks** for a mid-budget film and longer for a
  tentpole; construction strike and location restoration run in parallel.
- **Wrap book / cost final** — the accountant closes the production accounts,
  which then feed the incentive audit and the studio's cost of the negative
  (`11-money-accounting-and-participations.md`).
- Sets are **struck** unless a reshoot hold is paid for — a real decision,
  since holding a stage costs weekly rent (directionally **$10K–$60K a week**
  for a large stage, plus the standing set's insurance) but re-building is far
  worse. Productions with a known additional-photography plan hold their key
  sets deliberately; those without gamble.
- **Asset disposition**: props and costumes go to storage, to a sequel hold,
  to the studio archive, to auction, or are destroyed for rights reasons.
  Hero props for a franchise are held; everything else is a storage cost
  decision.

---

## 13. What the shoot hands to post

- Camera media and its backups, with camera reports.
- Sound recordings, sound reports, and timecode sync.
- The **lined script**, **script supervisor's notes**, and **circle takes**.
- Continuity stills.
- **VFX data**: plates, HDRIs, LiDAR scans, camera and lens metadata, tracking
  markers, reference photography (`08-vfx-and-specialty.md`).
- The editor's ongoing assembly.
- The daily production reports, which are the record of what happened.
- The **show LUT** and any on-set grading decisions, so the DI starts from the
  DP's intent rather than from scratch (`07-postproduction.md` §6).
- Unit stills and behind-the-scenes material, which marketing will need long
  before the film is finished (`09-marketing-and-distribution.md` §2).

---

## 14. Directing actors on the day

Everything above is logistics. This section is the part that determines
whether the film is any good, and it is the least documented.

**Who** — the **director**, alone. No department assists with this and no
process substitutes for it. The people adjacent to it are the **script
supervisor** (who tracks whether the performance is consistent and whether the
scene's beats are landing), the **1st AD** (who buys or refuses to buy the
time), and occasionally an **acting coach** or **dialect coach** attached to a
specific performer.

**When** — in three windows, and the first two are usually skipped when the
schedule is under pressure:

| Window | What happens | Typical duration |
|---|---|---|
| **Prep** | Meetings, read-throughs, discussion of intention and backstory, rehearsal where budget allows (`04-preproduction.md` §10) | Days to weeks, or nothing at all |
| **On the floor, before the crew** | Blocking, which is where most real direction happens | 10–25 min per scene |
| **Between takes** | Adjustments — the visible, and smallest, part | 20 seconds to 2 minutes each |

### 14.1 What a director actually does with actors

**Blocking is direction.** The most consequential decision is almost never a
line reading; it is *where the actor is, when they move, and what they are
doing with their hands*. An actor who is given something physical to play — a
task, an obstacle, a reason to cross the room — will generate a performance
that a note about emotion cannot produce. Directors who cannot block tend to
compensate with verbal notes, which is why their sets talk more and achieve
less.

**Notes are given in playable terms.** The working distinction that every
experienced director uses:

| Unplayable note | Playable equivalent |
|---|---|
| "Be sadder" | "You've already decided to leave. You're just waiting for him to notice" |
| "It needs more energy" | "You're late. Say it while you're already walking" |
| "That was too big" | "He's in the next room. Don't let him hear you" |
| "Faster" | "Come in on the end of his line" |
| "I didn't believe it" | (Not a note. Find the specific moment and give an action) |

The general rule: **actions, objectives, and circumstances are playable;
adjectives and results are not.** "Result direction" — asking for the outcome
rather than the cause — is the single most recognisable mark of an
inexperienced director, and actors respond to it by manufacturing the result,
which is exactly what looks false on screen.

**Notes are given privately and briefly.** A note delivered across the floor
in front of 150 people is a different event from the same note delivered
quietly at the actor's shoulder. Experienced directors walk in. The exception
is a note that the whole scene needs, which is deliberately public so everyone
hears the same thing.

**Different actors need different things**, and reading which is which within
the first day is a core skill:

- Some want detailed technical direction and are unsettled without it.
- Some want to be left alone and will get worse under adjustment.
- Some need the first take protected because their best work is early
  (**"the first take actor"**); others build over eight takes and are dead by
  take three if the good ones were spent on rehearsal.
- Some work from the outside in (costume, walk, voice); some from the inside
  out (motivation, memory). Giving an outside-in actor an inside-out note
  wastes both their time.
- Some need the other actor present for their off-camera coverage; some do not
  care. A director who lets a lead go home rather than play their off-camera
  lines has, in most cases, sacrificed the other actor's performance.

**Take strategy is a directorial decision.** Common patterns:

| Pattern | Rationale | Risk |
|---|---|---|
| **Few takes (2–4)** | Preserves spontaneity; keeps the day moving; used by directors who cast well and block well | If it isn't there, there's no safety |
| **Many takes (10–30+)** | Wears away performance until something unplanned appears | Exhausts the cast, burns the day, and after take ~15 most actors get worse, not better |
| **One for the crew, one for the director, one for safety** | The workmanlike default | Can become mechanical |
| **Different in every take** | Deliberately varied readings to give the editor genuine choices | Continuity of physical action must still match, or none of it cuts |
| **Shooting the rehearsal** | Rolling on what was meant to be a rehearsal, because it is often the best version | Costs a small amount of media and catches lightning |

### 14.2 What separates a director who gets great performances

The skill axis, in rough order of how much it explains:

1. **Casting.** Most of the performance problem is solved or created before
   the shoot begins (`04-preproduction.md` §8). Directors known for
   performances are usually, on inspection, directors who cast extremely well
   and then protect the choice.
2. **Creating safety.** Actors do their best work when they believe they will
   not be humiliated by a failed attempt. A director who makes the set safe to
   be bad in gets braver takes. This is a management skill, not an artistic
   one, and it is the most reliable differentiator.
3. **Specificity.** Knowing precisely what is wrong with a take and being able
   to name it in one sentence. Vague notes cost takes; a specific note fixes
   the take.
4. **Knowing when it's there.** Recognising the take that works and *stopping*
   — as important as knowing when it isn't. Directors who cannot recognise
   success shoot twenty takes and print the fourth.
5. **Preparation that makes them free on the floor.** A director who has
   decided the shot in prep spends the morning on the actors. A director who
   has not spends it on the camera, and the actors stand around losing energy.
   This is the direct link between prep quality and performance quality.
6. **Protecting the actor from the machine.** Keeping the video village
   quiet, keeping notes from producers from reaching the actor unfiltered,
   keeping the 1st AD's time pressure from reaching the floor as visible
   panic.
7. **Managing their own state.** A director who is visibly frightened,
   exhausted, or angry transmits it to the cast within minutes, and a
   frightened cast plays safe.
8. **Building a private vocabulary with each actor** over the first week — a
   shorthand ("do the version from the read-through", "the one where you
   didn't look at her") that makes adjustments fast enough to be affordable.
9. **Knowing which scenes matter.** Spending the day's discretionary time on
   the three scenes the film lives or dies on, and shooting the rest
   efficiently. Directors who give every scene equal attention run out of day
   before the scenes that mattered.

### 14.3 How this collides with the schedule

The schedule and the performance are in direct competition for the same
resource — the hours in the day — and the negotiation happens through the
1st AD, dozens of times a day. The healthy version:

- The director and 1st AD agree **in advance** which scenes are the day's
  priority and where the time will come from if it is needed.
- The 1st AD builds the schedule so that the emotionally heavy scenes are not
  the last setup of a 13-hour day, and not the first thing on a Monday
  morning after a distant travel day.
- The director asks for time explicitly ("I need three more takes and I'll
  give you the insert to second unit") rather than simply overrunning.

The unhealthy version, and its symptoms:

| Symptom | What it means | Consequence |
|---|---|---|
| The 1st AD is visibly rushing the director in front of the cast | The schedule has lost its slack and nobody negotiated it | Cast lose confidence; performances get careful |
| The director shoots endless takes with no note between them | They don't know what's wrong and are hoping | Day lost; cast exhausted; the take used will be an early one anyway |
| Actors are called at 6am and used at 6pm | 2nd AD scheduling failure, or an overrun cascading | Ten hours of decay before the first take |
| Emotional scenes scheduled on Friday of a 6-day week | Bad scheduling | The most important material shot by the most tired people |
| The director stops giving notes | They have given up on the scene | It will be a reshoot candidate |

The compression is real and it is one-directional: **performance quality is
the first thing sacrificed when a day runs late**, because it is the only line
item with no contract protecting it. Nobody signs off on "we'll take the third
take instead of the ninth", and it never appears on the DPR — but it is the
most common way a film quietly gets worse.

---

## 15. What separates a good shooting day from a bad one

A craft profile of the shooting day itself, treated as the thing a production
is good or bad at.

### 15.1 The observable markers

| Marker | Good day | Bad day |
|---|---|---|
| **Call to first shot** | Under 45 min; the first setup was pre-rigged | 90+ min; the day starts cold and never recovers |
| **Noise level on the floor** | Quiet, with one voice at a time on the radio | Loud, overlapping, several people solving the same problem |
| **Who is standing still** | Nobody for long; every department is prepping the next thing | Twelve departments watching two people |
| **Announcements** | The 1st AD states the next setup clearly, early, once | Departments find out what's happening when it happens |
| **The director's location** | With the actors, or watching playback with the DP | Behind the monitor, deciding |
| **Take counts** | Purposeful; notes between takes | Repetition without adjustment, or none at all |
| **The lunch break** | Called on time, taken, back on time | Called late; a meal penalty accrues; the afternoon starts an hour behind |
| **Meal-to-first-shot** | Under 30 min | An hour |
| **The last hour** | The martini is a shot that was planned | A scramble to grab something so the scene isn't a part-scene |
| **The wrap** | On the estimated time on the call sheet | 90 minutes past, for the fourth day running |
| **The DPR** | Pages and setups match or beat the plan; "lost time: none" | A paragraph of explanation in the lost-time box |

### 15.2 What actually makes the difference

Roughly in order of leverage, and note that most of it was decided before the
day started:

1. **Prep.** A day that was properly scheduled, tech-scouted, and pre-rigged
   runs. A day that wasn't, doesn't. This is the largest single factor and it
   is not recoverable on the floor.
2. **A decided director.** Not a rigid one — a decided one. The unit can
   execute any plan; it cannot execute the absence of one.
3. **A 1st AD who communicates forward.** The difference between "we're going
   to the reverse next" said at the start of the take and said at the end of
   it is twelve departments working in parallel versus in series.
4. **A DP who lights the space, not the shot.** This converts 40-minute
   turnarounds into 15-minute ones, all day, every day.
5. **Pre-rigging and a second lighting unit.** The most reliable purchasable
   speed on a large production.
6. **Cast held close and cast who know their lines.** Removes the two most
   common non-technical delays.
7. **Departments that anticipate.** Standby props with the next scene's items
   already at the edge of the floor; the 1st AC already knowing the next lens.
8. **A functioning relationship between the director and the 1st AD.** They
   are jointly running the day; when they are not aligned, the crew receives
   contradictory signals and slows down to avoid being wrong.
9. **Morale.** Fed on time, wrapped when promised, told the truth. Crews work
   measurably faster for productions that respect their time, and it is the
   cheapest productivity intervention available.

### 15.3 The failure signatures

| Signature | Underlying cause | What it costs |
|---|---|---|
| Consistently late wrap | The schedule was never achievable | Overtime every day; fatigue; injury risk |
| Rising "lost time" on the DPR | Systemic, not incidental | The bond company starts asking questions |
| Part-scenes accumulating | Days ending without completing the scene | Every part-scene must be returned to, at a company-move cost |
| Coverage being dropped daily | Falling behind and paying for it in the edit | Discovered in the cutting room, months later (§4.3) |
| Rewrites arriving overnight | Development did not finish | Departments prep the wrong thing; cast learn lines twice |
| Departments openly blaming each other | The 1st AD has lost the floor | Slowdown, and it compounds |
| Key crew leaving mid-shoot | A hostile or unsafe set | Replacement crew cost the visual and operational continuity |
| Video village crowded with executives | The production has lost confidence in the director | Notes reach the floor; the day slows; the performance flattens |

---

## 16. How a production falls behind, and how it catches up

### 16.1 How it happens

Productions rarely fall behind in one dramatic event. The common paths:

| Path | Mechanism | Typical rate of loss |
|---|---|---|
| **An unachievable schedule** | The board was built to fit a budget, not to fit the work. Behind from day one and never recoverable | A quarter to a half day per day |
| **Slow accretion** | Half an hour lost each morning and each afternoon | ~1 day per 10–12 shooting days |
| **The heavy day that goes wrong** | An action or effects day fails and returns | 1–3 days at once |
| **Weather** | An exterior block with no cover set | 1 day at a time, unpredictably |
| **A cast event** | Illness, injury, or unavailability | 1 day to a total shutdown |
| **Script changes** | Rewrites during the shoot invalidate prep | Compounds — departments prep twice |
| **Director pace** | A director shooting more coverage or more takes than the schedule assumed | Steady and predictable, and visible in week one |

The 1st AD, UPM, and producer know the number every night. **Week one is
diagnostic**: the rate established in the first five days is usually the rate
for the whole film, because it reflects how the director and the crew actually
work rather than how the schedule assumed they would. Experienced producers
re-forecast the whole schedule at the end of week one for exactly this reason.

### 16.2 The catch-up levers, cheapest to most damaging

Each of these buys time, and each has a price paid in the finished film.

| Lever | How it works | Cost on screen |
|---|---|---|
| **Add pre-rigging / a second lighting unit** | Buys 30–60 min a day | None. Costs money, not quality — always the first choice if the money exists |
| **Combine setups** | Shoot two scenes' worth of coverage from one lighting state; cross-shoot with two cameras | Slightly compromised lighting; usually invisible |
| **Splinter unit** | Break off a small crew for inserts, plates, and cutaways in parallel | Little to none, if properly briefed |
| **Move material to second unit** | Reassign action, driving, doubles, and establishing shots | Matching risk; the sequence can feel disjointed if the 2U work is not directed to the same intent |
| **Drop coverage** | Shoot the master and one single instead of the full pattern | **Editorial flexibility gone.** The scene can only be cut one way, and cannot be repaired |
| **Shoot fewer takes** | Print earlier | Performance quality; the biggest quiet loss (§14.3) |
| **Combine scenes** | Rewrite two scenes into one, in one location | Structural change made under pressure; often visible as a rushed transition |
| **Cut scenes from the schedule** | Remove them from the film entirely | Whatever they carried — usually character material, because plot scenes cannot be cut |
| **Add days** | Buy the time outright | The most expensive option: a full day's burn plus the knock-on to cast, locations, and post |
| **Extend the day** | Overtime | Expensive (§7.2) and self-defeating past a point — fatigue reduces the next day's output |
| **Add a 6th day** | Weekend work at premium | Premium rates plus a badly rested crew for the following week |
| **Move it to post** | "We'll fix it in VFX" / "we'll cover it with narration" | Transfers cost downstream at a worse exchange rate (`08-vfx-and-specialty.md` §6) |
| **Move it to reshoots** | Defer the scene to additional photography | Most expensive per day of all (§10.2), but sometimes the only option |

### 16.3 How the choice is actually made

The decision happens in a specific, recurring conversation — usually the
**production meeting** or an ad-hoc one at wrap, between the **director**,
**1st AD**, **producer/UPM**, and increasingly the **editor** by phone.

The order of questions:

1. **How far behind are we, and at what rate?** Half a day is a scheduling
   problem; four days is a film problem.
2. **Is there money?** If contingency remains, buying time (pre-rig, second
   unit, extra days) is always preferred to cutting work.
3. **What does the editor say we can lose?** The editor is the only person who
   knows which coverage is actually being used, and a good one will say "you
   have never needed the master on a two-hander in this film — stop shooting
   them". This is the highest-value catch-up input available and it is
   frequently not asked for.
4. **What is the film about?** Cutting the scenes that are "just character"
   is the reflex, and it is how films end up as competent plot delivery with
   nothing underneath. Producers who protect the wrong scenes and directors
   who protect all of them both fail here.
5. **What is contractually or physically fixed?** A location released next
   Tuesday, an actor who flies out Friday, a stage handed back at month end.
   These are hard walls and they determine what can be deferred at all.

### 16.4 Who decides, and the escalation

| Situation | Decided by |
|---|---|
| Dropping a shot from today's list | 1st AD and director, on the floor, continuously |
| Dropping coverage on a scene | Director, informed by the 1st AD's time report |
| Moving a scene to another day | 1st AD with the UPM |
| Cutting a scene from the film | Director and producer, with the writer if available |
| Adding days | Producer and studio/financier; draws on contingency |
| Adding a unit | Producer and UPM |
| Re-forecasting the whole schedule | UPM and 1st AD, presented to the studio and the bond company |
| Taking over the schedule | The **completion bond company**, if the guarantee is invoked — it has the contractual right to take over the production, and this is the end of the director's and producer's control (`03-financing-and-dealmaking.md` §7) |

### 16.5 The catching-up trap

The recognised failure pattern: a production that is behind pushes the day
longer to catch up, which produces overtime cost, a fatigued crew, a shorter
turnaround, a later call the next day, and lower output — so it falls further
behind, and pushes harder. Experienced producers break the loop by **removing
work rather than adding hours**, on the reasoning that a shorter, complete day
beats a longer, exhausted one. It is a well-understood dynamic and it is still
one of the most common ways a shoot deteriorates, because removing work
requires admitting that the film will be smaller than intended, and everyone
involved is professionally disinclined to say so.
