# 07 — Post-Production

*From footage to a film.* Post is where the film is genuinely made a second
time: structure, pace, performance emphasis, and meaning are all still movable,
and a large fraction of released films differ substantially from what was shot.

> **Domain reference.** Real industry, not this game. See `README.md`.

---

## 1. The post timeline

Post is not a single process. It is five or six departments running on
different clocks, all of them chained to one event — **picture lock** — and all
of them billing whether or not that event happens on time.

| Milestone | Typical timing |
|---|---|
| **Editor's assembly** | Ready ~1–2 weeks after wrap (built during the shoot) |
| **Director's cut** | DGA-guaranteed period after assembly — **10 weeks** for a feature (6 weeks on lower-budget agreements), during which the studio may not recut |
| **Studio/producer cuts** | Weeks to months, with test screenings |
| **Picture lock** | Editorial complete; VFX and sound can finish against a fixed cut |
| **Final mix, DI, delivery** | 4–10 weeks after lock |

**Total post duration:**

| Film type | Post length |
|---|---|
| Independent drama | 3–6 months |
| Studio mid-budget | 5–9 months |
| VFX-led tentpole | 12–24 months (VFX dominates and often begins during the shoot) |
| Animated feature | 2–4 years total production |

### 1.1 Who owns post

| Role | Owns | Reports to |
|---|---|---|
| **Director** | The cut, within the DGA period and after that by influence | Studio/producers |
| **Producer** | The schedule, the money, and the room the arguments happen in | Studio |
| **Post-production supervisor** | The plan, the vendors, the calendar, the deliverables (§11) | Producer / UPM |
| **Editor** | The cut as executed; the cutting room | Director |
| **Studio post executive** | Studio facilities, resources, spend approval | Studio physical production |
| **Studio creative executive** | Notes, tests, and eventually the final cut | Studio |

On a studio film, **final cut** almost always belongs to the studio; only a
small number of directors hold it contractually. On an independent, final cut
often belongs to the financier or to a completion-bond-backed committee, and
the director's protection is whatever their contract says plus the DGA
minimums. Who holds final cut is settled in the deal (`03-financing-and-
dealmaking.md`), not in post — but post is where it gets discovered.

### 1.2 The dependency chain

```
Shoot ─► Dailies ─► Editorial ─► PICTURE LOCK ─► ... ─► DI ─► Deliverables
                        │              │
                        │              ├─► Sound editorial ──────► MIX ──┐
                        │              ├─► Score: write ► record ► mix ──┤
                        │              └─► VFX finals ───────────────────┤
                        │                                                │
                        └─► temp VFX / temp music / test screenings      ▼
   (VFX starts during the shoot and runs the whole way)             into the DI
```

Everything downstream of lock is *sequenced*, not parallel: the mix needs the
final music, the DI needs final VFX, the deliverables need the finished mix and
the finished grade. A slip at lock does not shorten one department's work — it
compresses **all** of them at once, and each has a floor below which the work
degrades visibly.

### 1.3 What a week of late lock actually costs

Directional, on a mid-budget studio film:

| Consequence of one week's slip | Cost shape |
|---|---|
| VFX re-versioning of shots whose length changed | $3K–$30K per affected shot, plus vendor overtime |
| Sound editorial re-conform to the new cut | 2–5 crew-days per reel, repeated |
| Score conform (music editor re-fitting cues) | 1–2 weeks of a music editor; sometimes a re-record |
| Mix stage held or lost | $4K–$10K/day for the stage; losing the booking to another show is worse |
| DI compressed | Grade quality visibly drops; SDR trims rushed |
| Marketing assets late | Trailer slips; campaign loses its build (`09-…` §12) |

The critical fact: **VFX and music cannot finish until picture is locked**, and
each week the lock slips costs money in every downstream department
simultaneously. Locking late is the single most expensive post decision, and
the one most often made by people who are not paying for it.

### 1.4 The post budget

Directional shares of negative cost, excluding VFX (which is its own line and
can dwarf everything else — `08-vfx-and-specialty.md`):

| Item | Independent ($5M film) | Studio mid-budget ($50M) | Tentpole ($200M) |
|---|---|---|---|
| Editorial (crew, rooms, equipment) | $150K–$350K | $1M–$2.5M | $3M–$8M |
| Sound editorial + mix | $60K–$200K | $600K–$1.2M | $1.5M–$3M |
| Music (score + licences) | $80K–$400K | $1M–$3M | $3M–$10M |
| DI / finishing / masters | $40K–$120K | $250K–$600K | $600K–$1.5M |
| Deliverables, QC, versioning | $30K–$80K | $200K–$500K | $500K–$1.5M |
| **VFX** | $0–$300K | $2M–$20M | $40M–$150M+ |

Post excluding VFX typically runs **8–15%** of the negative cost. With VFX on
an effects-led film it can exceed the entire physical production.

---

## 2. Editorial

The single most consequential craft in post, and the least visible. The editor
is the first person to see whether the film that was written actually got
photographed.

**Who** — the **Editor**, reporting to the director (and, once the DGA period
ends, effectively serving the producers and studio too). Supported by a **1st
Assistant Editor**, one or more **2nd Assistant Editors**, an **apprentice** on
larger shows, a **VFX Editor**, and a **Music Editor**. Big films run **two to
four editors** in parallel cutting rooms, each owning reels or sequences, with
one editor as lead. In the US the cutting room is Editors Guild (IATSE Local
700); in the UK it is BECTU/Bectu-grade freelance.

**When** — the editor starts **on day one of the shoot**, not at wrap. They cut
in a room near the stage (or in a trailer on a distant location), watch dailies
every night, and are expected to be no more than a few days behind camera.

### 2.1 The cutting chain

```
Dailies ─► Assembly ─► Rough cut ─► Fine cut ─► Director's cut
       ─► Producer/studio cuts ─► Test screenings ─► Picture lock
```

| Stage | What it is | How long | Who is in the room |
|---|---|---|---|
| **Dailies cutting** | Scenes cut as shot, during production | The length of the shoot | Editor + assistants alone; director sees little or nothing |
| **Assembly** (editor's cut) | Every scene in script order, all in | Ready 1–2 weeks after wrap; the editor is contractually entitled to prepare it | Editor alone (the director is barred from imposing on it in the US) |
| **Rough cut** | Scenes shaped, obvious fat removed, structure first tested | Weeks 2–5 of the director's period | Editor + director, daily |
| **Fine cut** | Frame-level work, rhythm, performance selection | Weeks 5–10 | Editor + director; producers begin screening |
| **Director's cut** | The version the director signs off | End of the DGA 10 weeks | Director, editor, producer |
| **Producer / studio cuts** | Notes passes against screenings and tests | 4 weeks–6 months | Editor, director, producers, studio execs |
| **Picture lock** | No further picture changes; turnover to all departments | A date, missed often | Everyone, mostly by email |

- **Assembly** — always too long. An assembly of a film that will release at
  110 minutes is commonly 2h45–3h30. This is normal and not a signal of
  failure; the first cut of almost every good film is bad.
- **Rough cut** — the first honest read on whether the story works.
- **Fine cut** — where the film gets its rhythm. Most of the real craft.
- **Director's cut** — protected by DGA: the director gets a minimum period
  (10 weeks on features; one day per two days of shooting on some agreements,
  never less than the minimum) during which the studio may not recut, and the
  director must be given a reasonable opportunity to screen it.
- **Studio cut** — the version the studio wants; the difference between these
  two is the origin of most notorious "creative differences" stories.
- **Picture lock** — no further changes. In practice "locked" cuts still move,
  which is why VFX vendors charge for changes after turnover (§5).

Films are commonly re-cut **10–30 times** at the reel level between the
director's cut and lock. The number of *versions* screened for producers is
routinely in the dozens.

### 2.2 What editing actually does

- **Structure** — reordering, cutting whole scenes, moving a reveal, adding or
  removing voiceover. Films are routinely restructured wholesale.
- **Performance** — choosing between takes, and building a performance from
  fragments of several. An actor's performance is substantially an editorial
  creation.
- **Pace and rhythm** — where the film breathes, and where it doesn't let you.
- **Point of view** — whose scene it is, decided by whose reactions you stay on.
- **Information control** — what the audience knows, when. Most "confusing"
  films are films that released information in the wrong order.
- **Repair** — hiding a missing shot, using a reaction to bridge a hole,
  splitting a scene to conceal an unusable moment.

### 2.3 The cutting room

- **Avid Media Composer** remains the studio standard, because of its media
  management, multi-room sharing (Nexis/ISIS), and change-tracking; Premiere
  and Resolve are common on independents.
- **1st Assistant Editor** manages media, sync, versions, backups, the
  continuity of every reel, and the **VFX turnover** — the count sheets telling
  vendors exactly which frames they own. The 1st AE is the reason the cutting
  room does not lose the film.
- **2nd AE / apprentice** ingest dailies, sync sound to picture (where dailies
  aren't pre-synced by the lab), group takes into multicam clips, and prepare
  **KEM rolls** (all takes of a scene strung end to end for the editor to
  watch in one pass).
- **ScriptSync / script integration** links every line of dialogue in the
  lined script to every take that covers it, so the editor can call up "every
  version of this line" in a keystroke. On a talky film it is transformative.
- **The script supervisor's notes** (lined script, facing pages, circled
  takes, continuity notes) arrive with the dailies and tell the editor what the
  director *thought* they had (`06-principal-photography.md` §3).
- **Temp VFX** and **temp sound/music** are cut in so the film can be watched
  and tested long before real versions exist.
- **Editor's cards / EDLs / AAFs / OMFs** are the interchange to sound, VFX,
  and colour.
- **Remote review** (Evercast, ClearView Flex, Sohonet, PIX/Media Shuttle) is
  now standard: a director in another country watches a cut in sync with the
  editor, in colour-managed, watermarked streams. Post-2020 this became normal
  rather than exceptional, and it changed the geography of who can be hired.

### 2.4 How a scene actually gets cut

This is the mechanic that outsiders never see, and it is the same on a $2M
film and a $200M one.

**Input.** For a three-page dialogue scene the editor typically receives
30–80 minutes of material: a **master** (the whole scene wide), a **two-shot**,
**singles** on each actor (often several sizes), **over-the-shoulders**,
**inserts**, and whatever the director grabbed. Multiple takes of each. Digital
shooting ratios of **15:1 to 40:1** are normal; comedy improv and multi-camera
action can hit 100:1.

**The sequence the editor works in:**

| Step | What the editor does |
|---|---|
| **1. Watch everything** | Every take, once, at speed, without cutting. Marking as they go. Resist deciding early. |
| **2. Build selects** | Pull the good pieces onto a selects reel or mark them with locators: this read, that look, this bit of business |
| **3. Find the spine** | Decide what the scene is *about* and whose scene it is. Everything after this is in service of that answer |
| **4. Radio cut** | Assemble the scene on **dialogue alone**, picture ignored — the best reading of every line regardless of which take or angle it came from |
| **5. Lay picture to it** | Choose which shot carries each moment: who we watch when a line lands, when to be wide, when to be close |
| **6. Trim** | Frame-level. Where exactly the cut falls, how much air before a line, whether to cut on the movement or the look |
| **7. Split the tracks** | **J-cuts and L-cuts** — sound leading or trailing the picture — so the cut stops feeling like a cut |
| **8. Watch it cold** | Play it once, as an audience. Fix what you noticed rather than what you remember deciding |

**The craft decisions inside step 6**, which is where editors actually differ:

- **Cutting on motion.** A cut placed inside a movement is close to invisible;
  the same cut on a still frame announces itself.
- **Cutting on the look-off.** The moment a character's eyes leave someone is
  a free doorway to another shot.
- **Screen direction and the 180° line.** Break it and the audience is
  momentarily lost, whether or not they can say why.
- **Two frames.** Genuinely: a reaction held two frames longer plays as
  understanding; two frames shorter plays as surprise. Comedy timing is a
  frame-level craft — most bad comedy edits are late, not wrong.
- **Cutting away to steal time.** A reaction shot lets you remove three
  seconds from a performance the audience never sees removed.
- **Coming in late and leaving early.** Most scenes can start on their second
  beat and end before their last line, and almost always play better for it.
- **Not cutting.** Holding a shot past comfort is a decision, and the hardest
  one to defend in a notes screening.

A finished feature drama contains roughly **1,000–1,500** cuts; a
conventionally-shot studio drama **1,500–2,500**; an action tentpole
**3,000–4,500**, occasionally far more. That count is a stylistic fingerprint,
not a quality measure.

### 2.5 Building a performance

This is the part actors know about and audiences don't.

- **Cross-take assembly.** The first half of a line from take 4, the second
  from take 9, joined under a cutaway. Standard practice, not a trick.
- **Off-camera gold.** The best read of a line frequently happens while the
  camera is on the other actor. If the editor can find a face to put it
  behind, it goes in the film.
- **Rescuing a beat with a listener.** A weak delivery becomes a strong moment
  by playing it on the person hearing it.
- **Removing hesitation.** Cutting the small breath before a line makes a
  character decisive; leaving it makes them uncertain. The same take yields
  both characters.
- **Adding a beat.** Extending a hold with a cutaway lets a realisation land
  that the actor played too fast.
- **Eyeline and geography cheats.** Two actors who were never on set together
  can be cut into a conversation, and routinely are.
- **Pitch and pace processing.** Slowing a shot 4%, or nudging a line's timing,
  is done constantly and is undetectable at those magnitudes.

The consequence: **an actor's screen performance is a collaboration they do
not control.** Editors can and do make weak performances adequate and adequate
performances excellent — and the reverse. Actors with clout sometimes
negotiate a right to be consulted; almost none get approval.

### 2.6 "Finding the film"

The phrase editors use for the real work of the first eight weeks. The film
that was shot is never the film that was written, and the editor's job is to
work out which film actually exists in the material — then cut *that* one.

What that involves in practice:

| Move | What it looks like | When it's used |
|---|---|---|
| **Lifting scenes** | Removing 15–30 minutes of scenes that "work" but don't earn their place | Every film, always |
| **Reordering** | Moving a scene to a different act; moving the inciting incident 12 minutes earlier | When the first act is inert |
| **Collapsing** | Two scenes doing the same job become one | When the middle sags |
| **Cross-cutting** | Interleaving two sequential sequences to create tension between them | Thrillers, heists, parallel plots |
| **Changing the opening** | The film starts 20 pages into the script; the removed material becomes backstory or vanishes | Extremely common |
| **Adding voiceover** | Narration written and recorded in post to carry information the structure lost | A structural repair (§12) |
| **Deleting a character** | Every scene of a subplot lifted; remaining references paint-fixed or ADR'd | When a subplot tests dead |
| **Changing who the film is about** | Re-weighting screen time so a supporting character becomes the emotional lead | When the material says so |
| **Changing the ending** | Re-cutting existing coverage to a different final beat; or reshooting one | After bad tests (§9) |

The tell that "finding the film" is going well: each new cut is **shorter and
clearer**, and the notes get smaller. The tell that it is going badly: the film
keeps changing shape without getting better, and the same note keeps coming
back from different people.

### 2.7 The editor–director relationship

The closest working relationship in the film, and the reason editors and
directors form partnerships lasting decades.

**How the day runs during the director's cut:**

- The director arrives around 10am. The editor has prepared a version
  overnight or that morning against yesterday's notes.
- They watch a sequence together, in silence. Then they talk.
- The editor makes changes live, with the director in the room, for a few
  hours. Some editors prefer the director to leave and come back to a result;
  some directors insist on watching every trim.
- Late afternoon: a full-reel or full-film playback, usually with a producer.
- The editor and assistants work after the director leaves, doing the passes
  that need concentration and the ones the editor wants to *show* rather than
  argue for.

**What the relationship actually requires:**

1. **Being the first audience, honestly.** The editor is the only person who
   sees the material without having been on set for it. That objectivity is
   the entire value, and it is destroyed the moment the editor starts
   protecting the director's feelings.
2. **Delivering the note, then the alternative.** A good editor does the note
   as asked — properly, not sabotaged — and then shows their version. Editors
   who refuse to try things lose the room.
3. **Knowing when the director is describing a symptom.** "This scene is
   boring" usually means the scene three scenes earlier gave away the
   information. Diagnosing that is the job.
4. **Absorbing the studio.** Later in post the editor sits between a director
   who wants one film and executives who want another, and is often the only
   person both sides still talk to.
5. **Memory.** "There's a take where she does it differently" — and being able
   to find it in ninety seconds, six months later.

### 2.8 What separates a great editor

The skill axis, and it is not "cuts fast" or "knows the software":

1. **Story judgement over shot judgement.** The ability to say a beautifully
   shot scene must go, and be right.
2. **Objectivity that survives repeat viewings.** Great editors can still tell
   whether something is boring after they have seen it 300 times. This is
   rarer than it sounds and is the core professional skill.
3. **Performance ear.** Hearing which of eleven near-identical reads is the
   true one, and knowing which half of it to use.
4. **Rhythm.** Scene-level and film-level: knowing when the audience needs
   air, and when they need to be denied it.
5. **Ruthlessness with their own work.** Being able to throw away a week of
   cutting because the scene shouldn't exist.
6. **Structural imagination.** Seeing that the film's third scene is really
   its opening, and being able to demonstrate it in a day rather than argue
   about it for a month.
7. **Speed of iteration.** Turning a notes pass around overnight. Politically
   this is worth as much as taste: the version people can watch tomorrow wins
   the argument against the version described in a meeting.
8. **Temp craft.** Temp music and temp sound that make an unfinished film play
   for a test audience — while not being so good that they trap the composer
   (§4.6).
9. **Room temperature.** Managing a director's despair in week six of an
   assembly that doesn't work, without lying to them.

A mediocre editor cuts the script rather than the material, is precious about
their own choices, hides problems rather than surfacing them, falls behind
during the shoot, and cannot turn a note around quickly enough for anyone to
evaluate it.

### 2.9 Editorial failure modes

| Failure | What it looks like | Consequence |
|---|---|---|
| **Falling behind during the shoot** | No assembly for weeks after wrap | The whole post schedule starts late; reshoot decisions delayed past actor availability |
| **The assembly doesn't work** | Everyone leaves the screening quiet | Weeks of structural experiment; possibly reshoots (§12) |
| **Coverage isn't there** | A scene can't be cut around a bad moment | Repair with cutaways, ADR, or a reshoot (`06-…` §4) |
| **Cutting to please the room** | Every note applied, no point of view | A smooth, characterless film that tests fine and is forgotten |
| **Version chaos** | Nobody knows which cut is current | Wrong version screened for the studio; VFX built to a dead cut |
| **Turnover against an unstable cut** | Shots change length after handoff | Change orders, re-renders, direct cash cost (§5) |
| **Editor–director breakdown** | The director stops coming to the room | Editor replaced mid-post — expensive, slow, and a public signal of trouble |
| **Locking too early** | Lock declared for schedule reasons, then broken | The worst of both: departments have started, and the cut still moves |

---

## 3. Sound post

The largest, most invisible department in post. Runs in parallel with picture
after lock (though prep starts earlier). Audiences do not notice good sound;
they notice bad sound instantly and blame the film for it.

### 3.1 The sequence

| Step | What happens | Who | How long |
|---|---|---|---|
| **Spotting session** | Director, editor, and supervising sound editor watch the cut and mark every sound requirement and problem, reel by reel | Sup sound editor, director, picture editor, sometimes producer & sound designer | 3–8 hours, often over two days |
| **Dialogue editing** | Cleaning production sound, choosing alternate takes for sound only, removing noise, smoothing perspective, filling holes with room tone | Dialogue editor(s) | 1–2 weeks per reel-equivalent; 4–8 weeks total |
| **ADR** | Actors re-record lines to picture — for technical unusability, performance changes, new lines, or rating alternatives. Also **group ADR / walla** for crowds | ADR supervisor, ADR mixer, director, actor | Sessions of 2–4 hours per actor; scheduled over months around availability |
| **Foley** | A foley artist performs footsteps, cloth movement, and prop handling on a foley stage, in sync | Foley artist(s), foley mixer, foley editor | 5–15 stage days for a feature |
| **Sound design / SFX editing** | Creating and cutting non-dialogue, non-music sound: environments, vehicles, creatures, weapons, atmospheres | Sound designer, SFX editors | 6–14 weeks; on a tentpole, months and starts pre-lock |
| **Backgrounds / ambiences** | The room tone and world of every scene | BG editor | 2–4 weeks |
| **Pre-dubs** | Sub-mixes grouping dialogue, music, and effects so the final has manageable numbers of faders | Re-recording mixers | 1–3 weeks |
| **The final mix (dub)** | On a **dub stage** in a theatrical environment: re-recording mixers balance dialogue, music, and effects into the final soundtrack | Mixers, sup sound editor, director, editor, producer | 2–6 weeks for a feature |
| **Print master & formats** | 5.1, 7.1, Dolby Atmos, plus stereo and near-field fold-downs for home | Mixers, mix techs | 3–8 days |
| **M&E** | A fully-filled mix with no dialogue, required for foreign-language dubbing. A **delivery requirement**, not optional | Sup sound editor, mixers | 3–7 days, plus the fill work done throughout |

Directional cost: an independent feature's whole sound package runs
**$60K–$200K**; a studio drama **$400K–$800K**; a tentpole **$1.5M–$3M**, with
stage time alone at **$4K–$10K a day**.

### 3.2 What the supervising sound editor actually decides

The **Supervising Sound Editor** is the creative lead of sound and the person
the director talks to. It is a design job disguised as a logistics job.

They decide:

1. **What the film sounds like as a whole** — dense or sparse, realistic or
   heightened, wide dynamic range or consistently loud. This is a single
   decision with a thousand consequences, and it is taken in the first week.
2. **Where the silence goes.** Loud only works if quiet exists. Choosing which
   five minutes of the film are near-silent is a structural decision made in
   sound, not picture.
3. **What each important object *is*.** A creature, a weapon, a machine, a car
   — each gets a sonic identity built from recorded and synthesised elements,
   and that identity is as much a design object as its visual look.
4. **What the sound tells you that the picture doesn't** — offscreen space,
   what's behind the door, how big the room is, what time of day it is, who
   else is in the building.
5. **Point of view.** Whether we hear the world objectively or through a
   character — muffling, tinnitus, heartbeat, subjective narrowing. Used well
   it is the most powerful tool sound has; used carelessly it's a cliché.
6. **Crew, schedule, and budget** — which editors get which reels, what gets
   custom-recorded versus pulled from library, and where the money goes.
7. **What is left for music.** A sound designer who fills every frequency
   guarantees a fight on the dub stage that sound will lose.

### 3.3 Dialogue, ADR, and the performance problem

**Dialogue editing is the highest-stakes work in sound**, because dialogue is
the only element the audience consciously listens to. A dialogue editor works
line by line: choosing between the boom and each radio mic, replacing a noisy
word with the same word from an unused take, matching the tonal character of
lines cut together from different takes and different days, filling gaps with
room tone so the background doesn't pump, and smoothing perspective so a
close-up and a wide sound like the same room.

**Modern dialogue repair** — spectral editing tools of the iZotope RX class —
materially changed the economics from the mid-2010s. Noises that once forced
ADR (a plane, a generator, a chair squeak, clothing rustle) can now often be
removed cleanly. The result is that ADR volumes on well-recorded films have
fallen substantially, and the argument for ADR is now more often creative than
technical.

**Why ADR damages performance.** The actor is in a padded booth, months later,
alone, standing still, without their scene partner, without the set, without
the physical state the scene put them in — and is asked to match the timing of
a performance they no longer remember making. What is lost is specific:
breath, physical effort, the micro-timing of a reaction, and the acoustic
truth of the space. Audiences cannot name it, but they hear a line that sits
"in front of" the scene rather than in it.

**How it is mitigated:**

| Mitigation | What it does |
|---|---|
| **Wild lines on set** | The sound mixer records the line immediately after the take, same mic, same space, actor still in it. By far the best fix, and free |
| **Same or similar microphone** | Matching the boom mic used on set (or a hypercardioid of similar character) rather than a studio large-diaphragm mic |
| **Perspective and worldising** | Matching mic distance, adding the room's reverb, "futzing" for phones and off-screen |
| **Bringing the scene partner** | Recording both actors together, or at least playing the other performance in the ear |
| **Physicalising** | Making the actor run, kneel, lift something, be out of breath — sound editors do this constantly |
| **Director present** | ADR run as a performance session rather than a technical one |
| **Recording on location** | Mobile ADR at the actor's current shoot, in a comparable space |
| **Doing less of it** | Choosing to keep an imperfect production line because the performance is better |

Heavy ADR is a symptom, not a cause: it means noisy locations, a compromised
production sound department, or a director who changed their mind about the
scene. A film with 60–80% of its dialogue replaced is either an action film
(where it is normal) or in trouble.

### 3.4 Foley, and why it exists

Foley is not "adding footsteps for realism". Its real jobs are:

- **Filling the M&E.** Every human-made sound in the film must exist without
  the production dialogue track, or the foreign dub is silent under the
  actors. This alone makes foley a delivery requirement.
- **Character.** How a person walks — weight, hesitation, confidence — is
  performed by the foley artist, and it is performance work.
- **Continuity.** The production track's incidental sounds change take to
  take; foley makes a cut-together scene feel like one space.

A feature is covered by one or two foley artists on a stage with pits of
different surfaces and a warehouse of props, working at roughly **10–20 minutes
of finished film per day**, in passes (feet, cloth, props, specifics).

### 3.5 What separates great sound design from adequate

1. **Restraint and dynamics.** Great sound uses the full range so that loud
   means something. Adequate sound is loud throughout and therefore quiet
   throughout.
2. **Specificity.** A generic "door" versus *this* door: its weight, its age,
   its hinge, the size of the room behind it. The audience does not identify
   the detail; they identify that the world is real.
3. **Story information.** The best sound tells you something you cannot see —
   how far away the danger is, that someone is still in the house, that the
   character is lying.
4. **Designing for the mix, not the demo.** Elements built so they still read
   when music and dialogue are on top. A designer who only auditions effects
   solo gets destroyed on the stage.
5. **Frequency discipline.** Deliberately leaving space where the dialogue and
   the score live, so all three can coexist.
6. **Emotional register.** Sound choices that track the character's state, not
   just the events.
7. **Custom recording.** Going out and recording the real thing (or the
   creative substitute — the famous ones are almost never the literal object)
   instead of pulling library. This is where budget converts into quality most
   directly.

### 3.6 How a mix session actually runs

The **dub stage** is a small cinema with a mixing console at the back and a
calibrated theatrical monitoring chain. This matters: the mix is judged in the
environment the audience will hear it in.

**Who is on the stage:**

| Person | Doing |
|---|---|
| **Dialogue/music re-recording mixer** | Sits centre, owns intelligibility and the music balance; usually the lead mixer |
| **Effects re-recording mixer** | Owns effects, backgrounds, foley, and the size of the film |
| **Mix technician / recordist** | Keeps the session, records passes, manages versions and the enormous track count |
| **Supervising sound editor** | Present throughout; the director's interpreter and sound's advocate |
| **Sound designer / SFX editor** | On call to re-cut elements the same day |
| **Music editor** | On call to slip, trim, or re-edit cues in the room |
| **Picture editor** | Present for reels; the person who knows what each moment is for |
| **Director** | Present for most of it; the decision-maker |
| **Producer / studio exec** | At playbacks, sometimes daily near the end |
| **Composer** | For music passes, sometimes for the whole final |

**The shape of the work:** pre-dubs first (dialogue pre-dub, effects pre-dub,
backgrounds, foley), then reels are mixed in order, then **playbacks** — the
whole reel or the whole film run at level for the director and producers, who
give notes, followed by a fix pass. A feature is typically mixed at
**one reel (roughly 20 minutes) per 2–4 days** in the final pass, faster on a
dialogue film, far slower on an action film.

**What is actually argued about, in descending order of frequency:**

1. **"I can't hear the line."** Dialogue intelligibility against everything
   else. This is 60% of all mix notes and always wins in the end.
2. **Music level.** The composer wants the cue heard; the sound team wants the
   effects; the director changes their mind between playbacks.
3. **Loudness.** Directors who fear quiet, and mixers who know that a film
   without dynamics is exhausting.
4. **Whether the temp was better.** The mix stage is the last place temp love
   (§4.6) surfaces, and the most expensive one.
5. **The LFE and the low end.** How much the room shakes, and whether it will
   translate to a home mix.
6. **Atmos object placement.** What genuinely belongs overhead, and what is
   there because the format exists.
7. **Whether a sound is "too much".** Comedy and horror both live or die here.

**Deliverable formats** are made from the same session: a theatrical Atmos or
7.1 print master, 5.1 and 2.0 fold-downs, a **near-field** home mix remixed for
domestic listening levels (a real remix, not a copy), platform-specified
loudness versions, and the M&E.

### 3.7 Sound failure modes

| Failure | Cause | Consequence |
|---|---|---|
| **Unintelligible dialogue** | Mumbled performance, noisy location, over-mixed effects, director's taste | The most common single audience complaint about modern films; subtitles at home |
| **Heavy ADR** | Bad locations, changed lines | Flattened performances the audience feels but can't name |
| **Mix compressed by late lock** | Picture changes | Reels mixed once with no polish; the last reel is always the one that suffers |
| **M&E not properly filled** | Effects left buried in the dialogue tracks | Delivery rejected; foreign versions unusable; costly retro-fill |
| **Designed for the stage only** | No near-field pass or a lazy one | The film sounds wrong on every television and phone that will ever play it |
| **Sound crew hired too late** | Post supervisor's scheduling error | No design time; library-only sound; the film sounds generic |
| **Loudness spec failure** | Platform delivery standards | QC rejection days before a release date |

---

## 4. Music

Two distinct workstreams, run by different people, with different clocks and
different failure modes.

### 4.1 Score

1. **Temp score** — existing music cut into the film during editing. It is
   invaluable for testing and poisonous for the composer, who is then asked to
   write "like the temp" (**temp love**, §4.6).
2. **Composer hired** — typically after a director's cut exists; often 6–12
   weeks to write a feature score. On tentpoles the composer may be attached at
   greenlight and start sketching against previs.
3. **Spotting session** — director, editor, composer, and music editor agree
   exactly where music starts and stops, cue by cue (§4.3).
4. **Writing and mockups** — the composer delivers electronic mockups for
   approval before recording (§4.4).
5. **Orchestration and preparation** — orchestrator, copyist/librarian,
   contractor (§4.5).
6. **Scoring sessions** — on a scoring stage with an orchestra, conducted to
   picture with click and streamers. Common recording locations: LA, London
   (Abbey Road, AIR), Vienna, Budapest, Prague, Bratislava, Nashville.
7. **Score mix**, then delivery to the dub stage as **stems** (strings, brass,
   percussion, synths, choir) so the re-recording mixer can rebalance rather
   than just turn the music up and down.

Directional composer fees: **$50K–$250K** for an independent feature package;
**$500K–$2M+** for a top-tier composer on a tentpole, often on an
**all-in package deal** where the composer bears orchestra and studio costs.
Total music budget (score + licences + music editorial + supervision) runs
**2–5%** of negative cost.

### 4.2 Songs and licensing

The **music supervisor** clears and places existing recordings, builds the
needle-drop strategy with the director, and is often involved from prep. Every
song requires **two** clearances:

- **Master use licence** — from the record label (owner of the recording).
- **Synchronisation licence** — from the publisher (owner of the composition),
  which may mean several publishers if the song has multiple writers, each of
  whom can refuse independently.

**The mechanics, in order:**

| Step | What happens | Timing |
|---|---|---|
| **Request a quote** | Supervisor writes to label and publisher(s) with the scene description, the usage (background/visual/main title/trailer), duration, territory, term, and media | 2–6 weeks for a response; longer over holidays |
| **Scene description matters** | Rightsholders price and approve on *context*. Violence, sex, drugs, or anything that reflects on the artist can trigger refusal at any price | — |
| **Negotiate** | Fee, term (usually perpetuity), territory (world), media (all media now known or hereafter devised), and whether trailers/soundtrack/promo are included | 1–4 weeks |
| **Most favoured nations** | The standard clause: agreeing a high price with one rightsholder raises all the others on that song, and sometimes across the film | — |
| **Licence issued and paid** | Fully-executed licences are a delivery item; an unlicensed cue can block distribution entirely | Before delivery |
| **Cue sheet** | Every cue, its timing, its writers and publishers and their shares, filed with the PROs so performance royalties route correctly | At delivery |

Directional song costs for a studio film: a catalogue track by a
non-superstar **$15K–$40K** per side (so $30K–$80K all-in); a well-known hit
**$75K–$250K** per side; an iconic, first-choice-only track **$500K–$1M+**
all-in, and sometimes simply unavailable. Independents licence festival-only
rights first (cheap) and must re-clear for all media on a sale — a classic
trap, since the price after a sale is not the price before one. Cheaper
alternatives: a **cover version** (sync licence only, plus the cost of the new
recording), a **re-record** with the original artist, or a **sound-alike**
(legally risky if it is too close).

A **soundtrack album** is a separate commercial deal, and a hit single is a
genuine marketing asset (`09-…` §4).

### 4.3 The spotting session

Usually a single day, in the cutting room or a screening room, 4–8 hours.
Present: **director, picture editor, composer, music editor**, sometimes a
producer and the music supervisor.

The film is played in reels and stopped constantly. What is actually said is
mundane and decisive:

- "Music in *here*" — and a timecode goes in the notes. Then the harder
  question: "or does it start when he turns around?"
- "Out on the cut" versus "carry over into the next scene" — the single most
  common structural music decision, because music carrying across a cut binds
  two scenes into one thought.
- "What's the music doing here?" — the director's answer should be a
  dramatic function ("she's decided and doesn't know it yet"), not a mood
  adjective. Good composers push until they get a function.
- "This is the theme" — identifying the two or three moments the whole score
  will be built to serve.
- "No music here." Deciding where the film plays dry is as important as the
  cues, and it is much harder to defend later.

The output is a **cue list**: every cue numbered by reel (1M1, 1M2, 2M1…), with
start and end timecodes and a one-line description. The music editor produces
it, and it becomes the composer's work order and the schedule's spine. A
typical feature has **35–70 cues** and **40–90 minutes** of music; a
wall-to-wall action film can exceed 110 minutes.

### 4.4 The composer's weeks

For a 10-week feature schedule, roughly:

| Week | What is happening |
|---|---|
| **0** | Spotting session; music editor delivers cue list and reference QuickTimes with burnt-in timecode |
| **1–2** | Thematic work. The composer writes and rewrites the main theme(s) and plays them for the director before writing any cue. Getting this wrong costs the whole schedule |
| **2–7** | Cue writing. Mockups (sample-based full renders) delivered in batches, usually by reel, for director approval. **1–3 minutes of finished music a day** is a working pace; more under pressure, with additional writers |
| **4–8** | Approved cues go to orchestration in parallel with continued writing. The composer is usually 2–3 weeks ahead of the orchestrator |
| **7–9** | Scoring sessions |
| **9–10** | Score mix, stem delivery, conform to any late picture changes, dub stage attendance |

**The mockup is the real deliverable of the writing phase.** Directors approve
music they can hear, and modern sample libraries are good enough that a mockup
can be mistaken for a recording — which creates its own problem when the live
orchestra sounds *different*, not worse, and the director misses the mockup.

**The composer's team**, largely invisible: a **score producer** or technical
assistant running the studio; **additional music writers** (credited or not,
and a genuine industry controversy); **orchestrators**; a **music editor**
employed by the production rather than the composer; a **scoring mixer**.

### 4.5 Orchestrator, contractor, and the scoring session

- **Orchestrator** — takes the composer's sketch (which may be a detailed
  short score or a mockup session) and produces the full orchestral score:
  which instruments play which line, in which register, with which
  articulation. On many films the orchestrator makes a substantial share of
  the sonic decisions, and a great one makes a modest composer sound rich.
- **Copyist / librarian** — extracts and prints the individual parts, gets
  them on the stands, and manages corrections between takes. A parts error
  wastes 90 orchestral players' time at once.
- **Contractor** — books the players, handles union paperwork and rates
  (AFM in the US), and is responsible for the orchestra actually being
  excellent. Contractors' relationships determine who is in the room.

**A scoring session** runs in three-hour blocks under union rules. The orchestra
(**40–100+** players, sometimes 25 or fewer on an indie) sits to picture; the
conductor works to a **click track** and **streamers/punches** on the screen so
the music lands on the frame. In the control booth: composer, score producer,
scoring mixer, orchestrator, music editor, director, and a studio music
executive. A full orchestra records roughly **4–8 minutes of finished music per
three-hour session**; a feature takes **1–3 days** at the low end and **8–15
days** on a tentpole, often recorded in sections (strings one day, brass
another) for mix control and layered afterwards.

**Where you record is an economic decision.** US sessions under the AFM
agreement carry new-use and residual obligations; London and Central European
sessions are typically **buyouts** with no back end. That difference — not
musicianship — is why so many American films are scored in London, Prague, or
Budapest, and it is a live political issue with US musicians.

### 4.6 Temp love, and how it actually plays out

The most predictable dysfunction in post, and it happens like this:

1. **Week 3 of editing**, the editor temps the film with existing music so it
   plays. They use good music, because bad temp makes good scenes look bad.
2. **Weeks 6–20**, everyone watches the film with that music, hundreds of
   times. The cut is trimmed to its rhythms. Scenes are lengthened because the
   cue is beautiful there.
3. **Test screenings** are scored with it. The studio approves the film with it.
4. **The composer arrives** and is played the temp as "reference".
5. **The first cue is delivered** and everyone in the room hears *wrong* —
   not worse, just not the thing they have been conditioned to for four months.
6. Either the composer is pushed toward pastiche (and sometimes into
   plagiarism-adjacent territory that publishers notice), or cues are rejected
   repeatedly, or — occasionally — the temp track is licensed for real at
   enormous cost, or the composer is replaced weeks before the mix.

**Mitigations that actually work:** bringing the composer in early enough to
write custom temp; temping with the composer's own back catalogue; temping
deliberately with music that is *approximately* right rather than perfect;
having the director watch scenes dry at least once before hearing any cue; and
a picture editor and music editor who understand that a too-good temp is a
professional hazard rather than a triumph.

### 4.7 What makes a score work — and fail

**What good does:**

1. **Plays the subtext, not the surface.** The scene shows a smile; the music
   knows it's a lie.
2. **Has an idea.** A theme that means something specific and develops as the
   character does, so its return in the last reel carries the whole film.
3. **Enters and leaves well.** Where music starts is a dramatic act. Cues that
   fade in under a line and out under a cut are doing structural work.
4. **Leaves silence available.** A score that is always on cannot emphasise
   anything.
5. **Has a sonic identity.** An instrument, an ensemble, a treatment that
   belongs to this film and no other.
6. **Serves the edit's rhythm** rather than fighting it — and occasionally
   changes the edit, which is why late score can force picture changes.

**How scores fail:**

| Failure | What it sounds like | Consequence |
|---|---|---|
| **Temp clone** | Competent pastiche of a famous score | Reviews mention it; no identity; sometimes legal exposure |
| **Wall-to-wall** | Music under everything | Emotional flatness; nothing lands |
| **Mickey-mousing** | Every action punctuated | Comic effect where none intended |
| **Telling too early** | The cue announces the twist before the picture does | Suspense destroyed; a common note from tests |
| **No theme** | Texture and atmosphere with no melodic memory | The film has no musical identity to reprise or market |
| **Over-scoring a performance** | Music doing the actor's job | Undercuts the best moments in the film |
| **Composer replaced late** | 6 weeks of writing thrown out | $200K–$1M, a compressed rewrite, and a public signal of trouble |
| **Late picture changes** | Cues no longer fit | Music editor conform, re-records, or audible seams |

---

## 5. Visual effects in post

Covered in depth in `08-vfx-and-specialty.md`. What matters *here* is the
interface between editorial and VFX, because that interface is where most VFX
overspend is actually generated.

- **Turnover** — locked (or near-locked) shots handed to vendors with plates,
  counts, and reference.
- **Temps** for screenings, then **iterations**: previs → postvis → blocking →
  animation → lighting → comp, each with client review rounds.
- **Final delivery** into the DI, usually right up against the deadline.

### 5.1 The turnover package

Prepared by the **VFX editor** and the **1st AE**, checked by the **VFX
producer**. Per shot it contains:

- A **count sheet**: shot code, source clip, exact start and end timecodes, and
  **handles** (typically 8–24 extra frames each end) so the shot can be
  lengthened slightly without re-pulling.
- The **plate** pulled at full resolution from the camera originals, not from
  the offline media.
- **Camera and lens data**, on-set survey/witness material, HDRI and colour
  reference, and the show LUT so the vendor sees what editorial sees.
- The **editorial reference** — the shot as cut, with temp comp and
  surrounding context, so the vendor knows what the shot is *for*.

### 5.2 Why cut changes after turnover cost money

| Change | Vendor consequence | Typical cost |
|---|---|---|
| Shot shortened within handles | Free-ish, re-render of fewer frames | Low |
| Shot lengthened beyond handles | New plate pull, re-track, re-render | $2K–$20K/shot |
| Shot moved to a different scene | Lighting and continuity change | $5K–$40K/shot |
| Shot **omitted** | Work already done is billed anyway | 30–100% of the shot's price |
| Shot **added** | Full new shot at current-stage pricing, out of schedule | Full price + rush |
| Global change (creature design, environment) | Re-work across every shot containing it | Six or seven figures |

This is why **omits and adds** are tracked as a formal line and why post
supervisors quote a director the cost of a change *before* the change is made.
VFX is the schedule's long pole on any effects-led film, and the reason post
runs a year or more.

---

## 6. Picture finishing: the DI

**Digital Intermediate (DI)** is the colour and finishing stage — the last
place the film's look is decided, and the only place the whole film is seen at
full resolution before anyone pays to watch it.

**Who** — the **colourist**, working with the **DP** and the **director**,
supported by a **conform/online editor**, a **DI producer**, and a **finishing
QC** team, at a post facility. The DP's presence is a contractual expectation
on most films and a real problem when they are already shooting something else.

**When** — begins after VFX shots start finalling; **2–4 weeks** of grading
suite for a feature, plus 3–7 days of conform before and 1–2 weeks of
versioning after.

### 6.1 The sequence

- **Conform** — the online edit rebuilt at full resolution from the original
  camera files, matching the offline cut frame for frame, using EDLs/AAFs from
  editorial. Every discrepancy found here is cheaper than one found later.
- **Base grade** — the colourist works alone first, balancing every shot to
  its neighbours so the director and DP walk into a film that already looks
  like one film.
- **Look sessions** — the DP and colourist establish the film's palette,
  scene by scene, often over a week.
- **Director pass** — the director watches and responds; changes here are
  usually about emphasis and story, not technique.
- **VFX integration and final QC** — checking every shot at full resolution,
  as finals arrive (often long after the grade "finished").
- **Titles and end crawl** — main titles designed and built; the crawl is a
  contractual document as much as a design one, checked against every
  agreement in the film (§7).
- **Versions and masters** — HDR (Dolby Vision/HDR10) and SDR passes,
  theatrical and home masters, aspect ratio variants (IMAX, 2.39, 1.90).
- **DCP** — Digital Cinema Package, the encrypted deliverable cinemas actually
  play, with **KDMs** (keys) issued per screen per date.

### 6.2 What a colourist actually does

1. **Matching.** The invisible 80% of the job. A scene shot over three days in
   changing weather, on two cameras, must play as one continuous moment. Nobody
   ever praises this and everybody notices when it fails.
2. **Balancing to a reference.** Setting exposure and neutral balance shot to
   shot before any "look" is applied.
3. **Building the look.** Contrast curve, colour separation, how the blacks
   sit, how skin reads, what happens in the highlights — often extending a LUT
   designed at prep and tested during the shoot.
4. **Shaping the eye.** **Power windows**, vignettes, and keys used to darken a
   corner, lift a face, hold an eyeline, and pull attention where the cut wants
   it. Effectively relighting in post.
5. **Fixing.** Recovering an underexposed take, evening out a flickering
   fluorescent, taking the green out of a hospital, making a rainy afternoon
   match a sunny morning, day-for-night.
6. **Arc.** Grading the film as a whole so the look tracks the story: a film
   that gets colder, warmer, or more saturated across its running time — a
   deliberate structure most audiences feel and never notice.
7. **Knowing what is not a grade problem.** Telling a director that a shot
   needs a VFX fix, not another hour of windows, saves days.

### 6.3 What separates great colour work

- **Speed with the room watching.** A colourist who takes ten minutes per shot
  in front of a director loses the room; the good ones work in seconds and
  discuss in minutes.
- **Restraint.** The strongest grades are usually the ones you cannot describe.
- **Diplomacy.** Holding the DP's intent while the director asks for the
  opposite, without either of them losing face.
- **HDR discipline.** Treating the SDR trim as a deliverable people will
  actually watch, rather than an afterthought — most of the film's lifetime
  viewing is not in HDR.
- **Consistency across versions.** The trailer, the IMAX version, the airline
  version, and the streaming master should look like the same film.

### 6.4 DI failure modes

| Failure | Cause | Consequence |
|---|---|---|
| **Grading before VFX finals** | Schedule pressure | VFX shots don't match their neighbours; regrade at the end |
| **DP unavailable** | Already shooting elsewhere | The film's look drifts from what was photographed; a real and common conflict |
| **Uncalibrated review** | Notes given on a laptop or a home TV | Circular changes that undo good work |
| **Conform errors** | Bad EDLs, mixed frame rates, missing media | Wrong takes in the master; caught in QC if you're lucky |
| **Rushed SDR trim** | Late lock | The version most viewers see looks worst |
| **Trailer graded separately** | Marketing timeline runs ahead of the DI | Audiences see a different-looking film than the one released |

---

## 7. Deliverables

Delivery is a contractual schedule of dozens — often **100–250** — of line
items, and a film is not paid for until it is complete. On an acquisition or a
negative pickup, **10–20% of the purchase price** is typically withheld until
delivery is accepted. Owned by the post supervisor and a **delivery
coordinator/producer**, and it typically continues **2–4 months** after
everyone else has left the show.

Typically:

- Picture masters (theatrical DCP, HDR/SDR home masters, censored/airline
  versions).
- Audio: full mixes in all required formats, **M&E**, stems, dialogue lists.
- **Textless backgrounds** for foreign titling.
- Subtitles, closed captions, audio description, spotting lists.
- Music cue sheet (every cue, timing, ownership share) — required for royalty
  collection worldwide.
- Chain of title, E&O certificate, clearance reports.
- Credit list, cast/crew agreements, still photography, EPK, artwork elements.
- Rating certificates and censorship documentation per territory.

### 7.1 What actually goes wrong

| Failure | Why it happens | Consequence |
|---|---|---|
| **M&E not fully filled** | Production effects left inside dialogue tracks; foley gaps | Rejected on QC; foreign dubs unusable; retro-fill costs $20K–$80K and weeks |
| **Missing textless backgrounds** | Nobody pulled them before the master was struck | Every foreign version needs rework; sometimes a VFX rebuild |
| **A song licensed for the wrong media or territory** | Festival-only licence never upgraded; "all media" missed | The film cannot stream, or must be re-cut to remove the cue — occasionally after release |
| **Cue sheet errors** | Rushed at the end by whoever was left | Composers and publishers are not paid; discoverable years later; a relationship-destroying error |
| **Chain of title gaps** | An unsigned option, an uncleared underlying right | No E&O policy, therefore no distribution. Genuinely fatal |
| **Credit obligations breached** | The crawl doesn't match somebody's contract (size, position, order) | Contractual claim; on a studio film, re-issuing masters |
| **Platform QC rejection** | Flash frames, dead pixels, audio pops, wrong loudness, caption drift | Days-to-weeks delay against a fixed street date |
| **Late DCP / KDM errors** | Compressed finishing | Screens that cannot play the film on opening night |
| **Clearance report gaps** | Uncleared artwork, logos, trademarks, or a recognisable person | Paint-out in VFX at $5K–$30K a shot, late |
| **Stills and EPK shortfall** | The unit photographer was cut from the shoot budget | Marketing has no assets; contractual minimums breached |

Missing deliverables genuinely hold up payment. "Delivery" is a job, and the
people who are good at it are hired repeatedly for exactly that reason.

---

## 8. Ratings and versioning

- The film is submitted to **CARA** (US) and the equivalent body per territory
  (BBFC in the UK, and boards in every significant market).
- Submission happens on a near-final cut, and the board returns a rating with
  reasons. The production may **edit and resubmit** (there is a fee each time)
  or **appeal**, and appeals are heard by a panel of industry and exhibitor
  representatives.
- An unwanted rating triggers a re-cut, an appeal, or both — usually
  trimming violence, sexual content, or specific language counts (the
  "one F-bomb" convention for PG-13 being the best-known example).
- **NC-17 is commercially near-fatal** in the US: many chains won't play it and
  many outlets won't carry the advertising, so a studio contract will normally
  *require* a specific rating and make it the director's obligation to deliver.
- Rating obligations are therefore a **contract term set at greenlight**, and
  editing to satisfy them is routine, not exceptional.
- Territory-specific versions: censored cuts for particular markets (China,
  Gulf states, India each with different sensitivities), airline versions
  (violence, nudity, and aviation-related content removed), and TV versions
  with ADR-replaced language — often recorded in the same ADR session as
  everything else, to save the actor's time.
- The **unrated/extended cut** is a home-video and streaming asset, sometimes
  assembled from material cut for rating reasons and sometimes simply a longer
  cut with a marketable label.

---

## 9. Test screenings and research

Run by the studio's research department using outside vendors (`09-marketing-
and-distribution.md` §7). A studio film gets **2–5** of them; an independent
may get none.

### 9.1 How one is actually run

| Stage | What happens |
|---|---|
| **Recruit** | 250–400 people recruited to a demographic quota — age, gender, genre-affinity, sometimes prior-franchise attendance. Recruited at malls, by phone, or from online panels; they are not told which film |
| **Venue** | A commercial cinema in a "normal" market — historically Paramus NJ, Sherman Oaks, Long Beach, Phoenix, Chicago suburbs. Deliberately not an industry audience |
| **Security** | Phones bagged or surrendered, night-vision monitoring, guards. Piracy of an unfinished cut is a real risk |
| **Framing** | An announcer explains the cut is unfinished: temp music, temp VFX, no final colour. Audiences discount less than you'd hope |
| **The screening** | Researchers stand at the back and count walkouts, laughs, and restlessness by timecode. This observational data is genuinely useful |
| **The cards** | Handed out as the lights come up, collected before anyone leaves |
| **The focus group** | 15–25 people held back for 30–45 minutes with a moderator, while the filmmakers and executives listen from the back rows |
| **The lobby** | The real argument, immediately afterwards, between director, producers, and studio — before any numbers exist |
| **The report** | A deck 24–72 hours later: scores against norms, verbatims, demographic breaks, scene-level likes and dislikes |

### 9.2 What the cards ask

Substantially standardised across vendors:

- **Overall opinion** — Excellent / Very Good / Good / Fair / Poor.
- **Would you recommend this film?** — Definitely / Probably / Probably Not /
  Definitely Not.
- **What did you like most?** and **least?** — unaided, free text. The most
  useful question on the card.
- **Scene-level checklists** — which specific scenes you liked, which you'd cut.
- **Character ratings** — liked/disliked per major character.
- **Pace** — Too Slow / Just Right / Too Fast, sometimes per act.
- **The ending** — satisfying or not; a specifically flagged question.
- **Confusion** — "Was there anything you didn't understand?"
- **Would you see it again / would you pay to see it.**
- **Demographics** and how they'd describe the film to a friend.

### 9.3 How the numbers are read

- **Top two box** — the percentage answering Excellent or Very Good.
- **Definite recommend** — the percentage answering Definitely.

These two numbers are what get quoted in every subsequent meeting. Studios hold
internal **norms by genre and by budget tier**, and the film is judged against
the norm, not against 100. Directionally, for a broad studio release: top-two
in the **high 70s–80s** with definite recommend in the **50s–60s** is a strong
result; low 60s / 30s is a problem; below that triggers structural action.
Horror and comedy norms are lower and read differently; a horror film's
"definite recommend" among its own genre audience matters far more than its
overall score.

What experienced people actually read:

1. **The breaks, not the topline.** A film scoring 68 overall but 84 with its
   target demo is fine. A film scoring 78 with a soft target demo is not.
2. **Least-liked verbatims.** Repeated, unprompted mentions of the same scene
   are the most actionable data the process produces.
3. **The pace curve and the walkout timecodes.** Boredom is measurable and
   fixable. Preferences are neither.
4. **Confusion counts.** If 30% didn't understand who someone was, that is a
   fact about the cut, not a matter of taste.
5. **The ending question**, because it drives the recommend score more than
   anything else in the film.

### 9.4 The focus group

A moderator runs it; the filmmakers are told not to speak, and frequently do
anyway. The questions are open: who was your favourite character, when were you
bored, did you believe the ending, what would you tell a friend, was anything
confusing. The failure mode is well known — **one articulate, confident
respondent can capture the room** in ten minutes, and a weak moderator lets it
happen. Experienced executives discount the group's *solutions* entirely and
listen only for repeated, spontaneous descriptions of a problem.

### 9.5 What follows a bad test

Re-cut, reshoot, new ending, removing a character, changing the score, a new
opening, a title change, or (rarely) shelving — see §12 for what each of these
costs.

### 9.6 The real argument, both ways

**For:**

- It is the only way to see the film through eyes that have not been in the
  room for a year. Everyone who made it lost that ability months ago.
- It reliably detects **confusion, boredom, and unintended laughter** — three
  problems that are objectively bad and fixable.
- It surfaces the thing nobody wanted to say out loud, with numbers attached,
  which sometimes protects a director from a bad note as often as it produces
  one.
- It informs marketing genuinely: what the audience thinks the film is, and
  what they'd tell a friend, is directly actionable (`09-…` §5).

**Against:**

- Recruited audiences reward **familiarity** and punish ambiguity, downbeat
  endings, unlikeable protagonists, and slow openings — precisely the
  qualities that distinguish some of the best films ever made.
- Scores become **political instruments**. A number is used to win an argument
  that is really about taste, and the person with the number wins.
- Audiences reliably identify problems and reliably propose bad solutions;
  the discipline to separate the two is rare under release-date pressure.
- Iterating a cut toward a score produces **local optimisation**: each change
  raises the number a point and the film loses the thing that made it worth
  releasing.
- The audience is watching an **unfinished film** — temp music, unfinished VFX,
  no grade — and discounts for that far less than the announcement claims.

**Friends-and-family** screenings (early, sympathetic, useful only for gross
problems), **recruited word-of-mouth** screenings closer to release (a
marketing tool, not research), and **critics'/exhibitor screenings** come later
and serve different purposes entirely.

---

## 10. Common post failure modes

1. **Late lock.** Cascades into VFX overtime, a compressed mix, and a rushed DI.
2. **The film doesn't work in assembly.** Structural rewrites in the cutting
   room, then reshoots.
3. **VFX vendor failure.** A shot count larger than a vendor's capacity, or a
   vendor going insolvent mid-show (which has happened repeatedly).
4. **Temp love.** The director cannot let go of the temp score.
5. **Insufficient coverage.** The scene can't be cut because the material
   isn't there (`06-principal-photography.md` §4).
6. **Sound compromised at source.** Heavy ADR, flattened performances.
7. **Too many cooks.** Studio, producers, financiers, and talent all with
   cut approval, and a film edited toward the mean.
8. **A fixed release date with a moving film.** Everything above becomes twice
   as expensive the moment the date cannot move (`09-…` §6).
9. **Reshoots decided too late.** Actors have cut their hair, gained weight,
   or gone to another film; sets are struck; the window closes.
10. **Nobody owning the calendar.** The post supervisor's failure mode: work
    scheduled sequentially in a way that only works if nothing slips.

---

## 11. The post-production supervisor

The least glamorous and most load-bearing job in post. Almost no audience
member has heard of it; no film finishes without one.

**Who** — the **Post-Production Supervisor**, reporting to the producer and
UPM, working alongside a **post coordinator** and (on larger films) a
**post accountant**, **VFX producer**, and **delivery coordinator**. In the UK
the role is long-established and prominent; in the US on smaller films some of
it is absorbed by a line producer or the 1st AE.

**When** — hired in **prep**, before a frame is shot, because the dailies
pipeline, camera format, codec, and turnover workflow are their decisions.
They are among the **last people off the film**, often two to four months
after everyone else, finishing delivery.

### 11.1 What the job actually is

| Area | What they own |
|---|---|
| **The plan** | The post schedule, built **backwards from the delivery date**, with every department's lead time in it |
| **The budget** | The post section of the budget; approving and tracking every vendor invoice |
| **Vendors** | Bidding and contracting dailies, editorial rental, VFX, sound, music recording, DI, QC, localisation |
| **Workflow** | Camera format → dailies → offline codec → conform path. Decided in prep; catastrophic to change later |
| **The cutting room** | Hiring assistants, renting systems and storage, securing space, keeping backups |
| **The calendar of people** | Actor availability for ADR, DP availability for the DI, composer availability, stage bookings |
| **Turnover** | Making sure editorial hands off to VFX, sound, and music with the same cut, on the agreed date |
| **Ratings and legal** | CARA submission, clearance reports, E&O evidence, credit obligations |
| **Delivery** | The 100–250-item list, and getting it accepted (§7) |
| **Communication** | Being the person who tells the director what a change costs, in days and dollars, before it is made |

### 11.2 The skill axis

1. **Scheduling backwards, honestly.** Anyone can draw a schedule. The skill is
   knowing which stated lead times are real (a mix stage booking, a QC pass,
   a localisation window) and which have slack.
2. **Knowing real vendor capacity.** Whether a facility that says yes can
   actually do it in that window, with which crew, alongside its other shows.
3. **Protecting the downstream departments** from the cutting room. The best
   post supervisors buy sound and VFX their contracted weeks by making the cost
   of a late change visible before it is incurred.
4. **Costing a change in the room.** "That trim orphans 14 VFX shots and costs
   nine days" — delivered immediately, without drama, so the director can make
   an informed decision rather than an ambushed one.
5. **Paperwork as a craft.** Licences, clearances, cue sheets, and credit
   obligations are boring right up until one of them stops distribution.
6. **Relationship management.** They are the only person talking to editorial,
   sound, music, VFX, the studio, and the lab every day, and the goodwill they
   hold is what buys a favour at the end.

### 11.3 How the job fails

| Failure | Consequence |
|---|---|
| Workflow decided badly in prep | Conform problems and format conversions all the way to delivery |
| Post schedule with no contingency | The first slip consumes the whole margin |
| Vendors booked late | No stage, no colourist, no facility, at the exact week they're needed |
| Change costs not surfaced | The film spends its contingency without anyone deciding to |
| Deliverables started at the end | Two extra months of unbudgeted finishing, and withheld payment |
| ADR unscheduled against actor availability | The line cannot be recorded at all; the scene is re-cut around it |

---

## 12. Rescuing a film in post

Every studio has a shelf of films that were fixed after they were shot, and a
shelf of films that were not. The techniques are well known, they escalate in
cost, and each one **signals** something to the people watching — inside the
company and, eventually, in the trade press.

| Technique | What it is | Cost | Time | What it signals |
|---|---|---|---|---|
| **Restructure** | Reorder, lift scenes, change the opening, re-weight a character | Editorial time only | 2–8 weeks | Normal. Every film does this |
| **Trim for pace** | 10–25 minutes out | Editorial time | 1–3 weeks | Normal; usually the right answer |
| **Remove a subplot or character** | Every scene lifted; references paint-fixed or ADR'd | $50K–$500K (VFX paint, ADR, possible reshoot of a connective beat) | 3–8 weeks | A real structural failure; painful for the actor, and it becomes a story |
| **Add voiceover** | Narration written and recorded to carry lost information | $20K–$100K (writer, actor day, ADR, music editorial) | 1–3 weeks | Widely read as a confession that structure failed. Sometimes it is genuinely the best answer, and sometimes it is a scar |
| **New title cards / prologue text** | Front-loading context the film failed to deliver | Under $20K | Days | Cheap; often the only fix available late |
| **Replace the score** | New composer, or substantial re-scoring | $200K–$1M+ | 6–12 weeks | The film's tone was wrong; frequently the last big lever before the date |
| **Add or replace a song** | A needle-drop to fix a scene's energy or an ending | $30K–$500K | 2–6 weeks | Cheap relative to reshooting; used constantly |
| **VFX repair** | Paint-outs, face replacement, digital set extension, changing time of day, digitally removing an actor | $5K–$60K per shot | 4–12 weeks | Invisible if it works; a budget line that quietly doubles |
| **Additional photography — connective scenes** | 1–5 days, small unit, existing sets or a stage, to bridge a structural gap | $150K–$600K per day of a small unit; $1M–$5M for a week | 6–12 weeks including scheduling | Normal on tentpoles (often budgeted from the start), a red flag on a mid-budget drama |
| **Reshoot the ending** | New third act or new final sequence | $2M–$15M on a studio film | 3–6 months, gated by actor availability | Serious trouble, and almost always public |
| **Full-scale reshoots** | Weeks of new material, sometimes a new director-adjacent unit | $10M–$50M+ | 6–12 months | The film is being rebuilt; the trades will know within a week |
| **Move the release date** | Buy time | Millions in already-spent marketing; competitive repositioning | Months | The most public admission available short of shelving |
| **Shelve or write off** | Never release, or dump to a platform | The whole negative cost, sometimes as a tax write-down | — | Terminal; increasingly used deliberately as an accounting choice |

**The constraints that actually decide which lever gets pulled** are rarely
creative:

- **Actor availability.** A star is on another film for five months. That alone
  eliminates reshoots and ADR-heavy fixes and forces an editorial solution.
- **Continuity.** Hair, weight, age, and beards have moved on. Reshooting into
  existing material has a shelf life measured in months.
- **Sets and locations.** Struck, rented back to someone else, or seasonal.
  Rebuilding a set is often the largest single reshoot cost.
- **The date.** If marketing has committed and trailers are out, the only
  available fixes are the ones that fit the remaining weeks.
- **Who has final cut.** The rescue that gets attempted is the one the person
  with authority believes in.

**The uncomfortable truth practitioners state plainly:** post can reliably fix
**pace, clarity, and structure**, and it can meaningfully improve **tone**. It
cannot fix a **premise nobody wants**, a **performance that isn't there in any
take**, or **chemistry between two actors that never existed**. Money spent
trying to fix those in post is usually money added to a loss.

---

## 13. What makes post go well or badly

The craft-level profile of the whole phase, in the library's standard shape.

### 13.1 What good post looks like

1. **The assembly is close to the film.** Not good — close. The material is
   there, the coverage cuts, and the shape is recognisable in week two.
2. **The director had a plan and it survives contact.** Directors who shot for
   an edit they could describe give the editor a film to find; directors who
   shot "options" give them a search problem.
3. **Lock happens on the date it was promised.** Every downstream department
   gets its contracted weeks, and each gets to do the last 20% of its work —
   the polish pass that is always the first thing cut.
4. **The notes converge.** Each round is smaller and more specific than the
   last. Divergent notes late are the reliable sign of a film in trouble.
5. **One person holds the film.** Usually the director, sometimes the producer.
   Post has many contributors and needs a single point of view.
6. **Costs of changes are visible before they are made.** Someone (§11) is
   converting creative decisions into days and dollars in real time.
7. **The temp is a tool, not a target.** (§4.6.)
8. **Departments talk to each other.** Sound leaving frequency space for music;
   VFX knowing what the shot is for; the colourist knowing which shots are
   still coming.

### 13.2 What bad post looks like

| Symptom | Underlying cause | Where it ends |
|---|---|---|
| Lock date moved three times | Nobody with authority is willing to decide | Compressed mix and DI; quality visibly drops in the last reel |
| Competing cuts in parallel rooms | Studio and director both cutting | A composite film with no point of view |
| The same note keeps returning | The film's actual problem hasn't been named | Months of motion without progress |
| Scores rise, film gets duller | Optimising for the test (§9.6) | A competent, forgettable release |
| Sound and music crews hired late | Post schedule built optimistically | Library sound, rushed score, generic result |
| VFX shots still finalling in the DI week | Turnover against an unstable cut | Shots that don't match; some quietly cut from the film |
| Delivery started after the mix | No delivery owner | Withheld payment, months of unbudgeted work |
| The director stops attending | Relationship breakdown | Someone else's film is released with their name on it |

### 13.3 The two numbers that predict post's outcome

- **Weeks between wrap and lock.** Long is not automatically bad — some of the
  best films took a year in the cutting room — but *unplanned* length is a
  reliable indicator that the film has a structural problem nobody has solved.
- **Number of people with cut approval.** Above roughly three, films converge
  toward the average of their notes rather than the intent of any of them.

---

## 14. Where post practice varies

**Studio vs independent.** Studios have research departments, in-house post
facilities, mandated test screenings, dedicated post executives, and enough
schedule to test-and-recut. Independents typically have one editor, one
assistant, a sound package at a fraction of the cost, no test screenings, a
DI measured in days, and a delivery list dictated by the sales agent and the
territories. The independent constraint is money; the studio constraint is
consensus.

**US vs UK.** The crafts are the same and the vocabulary isn't: the UK says
**dubbing mixer** where the US says **re-recording mixer**, **dubbing editor**
for parts of what a US sound editor does, and treats the **post-production
supervisor** as a standard senior credit on almost every film. UK cutting rooms
are BECTU rather than IATSE Local 700, and there is no DGA director's-cut
period — director protections come from the contract instead. Scoring in London
is typically a buyout with no residual obligations, which is why so much
American music is recorded there (§4.5).

**Streaming vs theatrical.** Streaming originals skip the DCP and the
theatrical mix chain in favour of platform-specified masters, and require
**localisation up front** — subtitles and often full dubs in 20–40 languages,
which makes the M&E and the dialogue lists far more consequential than on a
theatrical release. Platform QC is stricter and more automated than a
distributor's. Test screenings are less common; platform viewing telemetry
substitutes for research, and it arrives after release rather than before.

**Era.** Until the mid-1990s picture was cut on film (Moviola, Steenbeck, KEM),
opticals were photochemical, and the finish was a negative cut and an **answer
print** — a process where every change was physical and expensive, and lock
meant lock. Non-linear editing (Avid, from around 1990) made changes nearly
free, which is the direct cause of the modern habit of endless re-cutting.
The **DI became standard around 2000–2005**, moving colour from photochemical
timing to the grading suite. **HDR deliverables** arrived in the mid-2010s and
added a whole versioning layer. **Remote review** normalised after 2020 and
changed where post crews can live and be hired from. Each shift removed a
physical constraint — and every removed constraint became a new opportunity to
keep changing the film.
