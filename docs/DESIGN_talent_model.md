# Design: the talent model

**Status:** design agreed with the owner over three rounds. **Stages 1, 2, 3 and 5 are built**
(sections 7.1 to 7.4); stages 4, 6 and 7 are not. Section 8 records what is settled and
what is still open.

**Where this comes from:** `docs/DESIGN_REVIEW_player_economy.md` §9. For
directors and every crew role the engine sets skill from fee, which is
unrealistic and is the main reason a small studio's films score in the 40s. But
cutting the tie on its own made the game worse, because the tie is standing in
for three systems the game does not have. This document designs those systems.

---

## 1. The problem in four numbers

Measured on a generated talent pool and with the player-economy harness:

- **0.85**: the correlation between a director's fee and their skill. For
  writers and crew it is 0.83 to 0.88. For actors it is 0.05; their craft has
  been separate from their fame since the acting model.
- **0%**: the share of directors costing under £150k with skill of 70 or more.
  For actors it is 45%.
- **0.06**: the correlation between a director's age and their fee. Age relates
  to nothing; a career's `experience` field is a copy of `skill`.
- **£657M**: where a Boutique studio ends after ten years if skill is simply cut
  loose from fee (it ends at −£0.1M today). The whole-year market gate goes
  from 3 misses to 8 in the same trial.

## 2. What the model has to do

1. **A fee is a price, not a measurement.** It follows fame and results. Some
   expensive people are coasting, and some cheap people are very good.
2. **Inexperienced is not untalented, and nobody is finished.** Experience buys
   consistency and the ability to handle a large production. Practice turns
   potential into ability, in whatever the work actually used.
3. **Ability is judged, not read off a card.** The player sees a track record
   and a read whose confidence depends on how much there is to go on.
4. **Careers move.** A discovery gets expensive after a hit. People arrive and
   leave. A bargain does not last the whole game.
5. **Rivals play the same game** with the same information, so the player
   competes for people and does not just shop.

The test of success is the last line of section 6: no strategy should be able
to do with a talent sort what the trial did.

## 3. What already exists to build on

Less is missing than it looks. The acting model
(`docs/DESIGN_REVIEW_acting_model.md`) solved this problem for actors, and
several fields were added to people in anticipation of a model like this and
never given a consumer.

| Exists today | Where | State |
|---|---|---|
| Craft as a floor plus headroom, with fame on a separate axis | `engine/actingModel.ts` | Actors only |
| Variance living in the production-execution layer, not in a stat | acting model §6 | Actors only |
| A read with three confidence tiers, a band, and a named reason for doubt | `engine/talentCardPresentation.ts:187` | Actor fit only |
| A casting director and shared history sharpening that read | `deriveFitReadAssist`, same file | Actor fit only |
| Fame, prestige, industry respect, reliability and current heat on every person | `types/index.ts:273` | Heat is a copy of fame and industry respect a copy of reliability at generation; neither moves |
| Experience, career start day and last-worked day on every career | `types/index.ts:285` | Experience is a copy of skill; the days are unused |
| Ambition, loyalty, pressure handling, adaptability | `types/index.ts:262` | "No current formula reads these yet" |
| A way to change someone's fame and heat | `engine/person.ts:182` | Called only for press tours |
| Per-studio relationship history with each person | `engine/relationships.ts` | Live; feeds casting appeal |
| An asking price that already reads heat | `engine/castingNegotiation.ts:109` | Live; heat never changes |
| Credits counted from released films | `TalentDatabase.tsx` | Display only |

So the model is mostly a matter of giving directors and crew what actors have,
making the standing fields real, and adding the yearly movement.

## 4. The model

### 4.1 What a person is

Each career carries five things that today are one number.

| | What it is | Changes? | Seen by the player? |
|---|---|---|---|
| **Potential** | How good they could become at each thing their job involves (4.1a) | No, fixed for life | Never. At most inferred from how fast someone is improving |
| **Ability** | How good they are at each of those things today | Grows through work that uses it, toward their potential | Learned through evidence (4.5) |
| **Consistency** | How close to their ability they land on an ordinary day | Rises with experience | Yes, as steadiness in the track record |
| **Standing** | Fame, heat, industry respect | After every film; heat fades | Yes, in words |
| **Quote** | What the market pays them | Follows standing; rises fast, falls slowly | Yes |

"Talent" in the everyday sense is **potential**: the part that is fixed.
**Ability** is what that potential has been turned into so far, and it is not
fixed. This split is the answer to two things that are both true: some people
are simply more gifted than others, and people get better at what they
practise.

### 4.1a Potential and ability, role by role

Both apply to the same list of attributes, which is the list the engine already
has for each role.

| Role | The attributes | Today |
|---|---|---|
| **Actor** | Character transformation, emotional performance, charisma, comedy, physical performance. Plus **headroom**: how much more a good director can draw out of them. | Already separate from fee; a single fixed value each. |
| **Director** | Story, visual, performance (working with actors), craft. | One `skill` number set by fee; the four are small offsets around it. |
| **Writer** | Structure, characters, dialogue, and how original their concepts run. | Set from a `skill` number set by fee. |
| **Cinematographer, editor, composer, production designer, VFX supervisor, casting director** | Their department's specialties. For a designer: period craft, large builds, location builds, creature builds. For VFX: digital environments, creature animation, compositing, digital doubles. | One `skill` number set by fee; specialties are offsets around it. |

**How ability grows.** This follows how careers actually develop
(`docs/domain/12` §4, §8), not a levelling system.

- **Ability grows in what the work used.** An actor who keeps getting dramatic
  parts gets better at emotional performance and no better at comedy. A
  designer who has only done contemporary films has not learned period craft.
- **It grows toward potential, fastest early.** The first few films in a new
  register teach the most. Near their potential, more of the same teaches
  little.
- **So people can develop range, within limits they do not know.** A comic
  actor can become a good dramatic one by doing dramatic work, if the potential
  is there. Nobody knows whether it is until they try, which is why
  counter-casting is a gamble for the actor and the studio alike. The reference
  describes the same thing: one counter-cast role is an anomaly, two is a range
  (`12` §4.6).
- **Who you work with matters.** A part under a strong director, or on a
  well-run production, teaches more than the same part on a poor one. This is
  the sponsor and mentor effect, and it gives a studio a reason to pair
  promising people with good ones.
- **The balance of gift and practice differs by job.** For actors, potential
  varies widely and shows early: some are remarkable at twenty. For crew heads
  of department, ability is mostly accumulated craft. The real ladders are ten
  to twenty years long (`12` §8.1), so potential varies less and experience
  explains most of the difference. Directors sit between, and peak late: often
  in their fifties and sixties (`12` §4.7).
- **Some things decline.** Physical performance fades with age, and a physically
  demanding lead becomes harder to mount around an older actor (`12` §4.7). The
  other attributes do not decline with age in this model.

**How fast someone grows is personal.** There is no single pace. Three things
set it, and between them they produce people who peak early, people who peak
late, and people who never reach what they could have been.

1. **Temperament.** The traits are already on every person.
   - *Adaptability* is how quickly they pick up something new. It matters most
     in an unfamiliar register.
   - *Professionalism* is how much they take from each job, whatever it was.
   - *Ambition* is whether they keep pushing once they are comfortable.
   - *Ego* works against growth where growth depends on taking direction: a
     high-ego actor learns less from a strong director than a humble one does.
2. **What they choose to do.** People decide which offers to take, and the
   engine already models that decision. An ambitious person leans toward the
   part that stretches them and the director who will push them. A comfortable
   one takes the familiar part and the bigger cheque, and stops growing. This
   is also how typecasting happens from the inside: the type generates the
   offers, and accepting them is the easy choice.
3. **What they are offered.** Nobody grows in something they are never asked to
   do. A gifted person who never gets the part that would show it stays where
   they are. A player, or a rival, taking a chance on them is what changes
   that.

The shapes of a career come out of those rather than being assigned:

| Shape | How it happens |
|---|---|
| **Peaks early** | Starts close to their potential, or grows fast and then coasts: low ambition, or early fame that locks them into one kind of part. |
| **Peaks late** | Real potential, but years of small or narrow work before someone gives them the part. Common for directors and character actors. |
| **Keeps growing** | Ambitious, adaptable, and keeps choosing work that tests something new. |
| **Never peaks** | The potential was there and the temperament or the opportunities were not. Nobody ever finds out, including the player, unless they take the chance. |

So the number to find with the harness is only the *typical* pace. Individuals
spread widely around it.

**Consistency** is separate from all of that and is what "experience raises the
floor" means. An experienced person lands near their ability almost every time.
An inexperienced one has the same ability on paper and a wider spread of
outcomes, more so under pressure (4.2). It rises with total credits, whatever
they were.

What is **not** potential or ability, and stays as it is:

| Kind | Attributes | What it does |
|---|---|---|
| **Taste and style** | A director's and writer's tone profile (action, comedy, romance, suspense, drama, spectacle); a director's production style and how hands-on they are; a writer's genre affinity and commercial lean; a crew member's leaning toward digital or practical, and toward stylised or naturalistic work. | Decides what they suit and how they work, not how good they are. Visible, since it is known from their work. |
| **Temperament** | Professionalism, ambition, loyalty, ego, temperament, pressure handling, controversy, adaptability; reliability; a writer's consistency. | Decides how they behave: on a troubled shoot (4.2), in a negotiation and over a relationship (4.3). Most of these are carried today and read by nothing. |
| **Standing** | Fame, heat, industry respect. | Sets the quote (4.3). |

A note on the tone profile, since it looks like a list of genres: it is taste,
not ability. It says a director is drawn to suspense, not that they are good at
it. It can drift slowly toward what someone keeps making, but it is not what
this section means by getting better.

### 4.2 What they deliver on a film

A person's work on a film lands somewhere up to their **ability** in the
attributes the film calls on. How close it gets is decided by two things.

- **Their consistency.** A veteran lands near their ability; a first-timer has
  a wider spread below it.
- **The production around them**, the way it already works for actors: not a
  dice roll on the person. A well-run, well-matched, adequately funded shoot
  gets people's best. A troubled one drags them down, and drags the
  inexperienced further.

**Scale is a demand on experience.** An Intimate film asks little of it. An Epic
asks a great deal, so a gifted first-timer handed a tentpole is a real risk and
the same person on a contained drama is not. This is the honest version of "you
cannot hire a great director cheaply": you can, for the right size of film.

For actors this is the existing floor-and-headroom model, with one change: the
floor rises with experience where today it is fixed. A director still unlocks
the headroom. For directors and crew the "production around them" is the
existing execution model: reserve, schedule pressure, prep, the events that
happened. Pressure handling and adaptability, already on every person, finally
get a job: they decide how far a bad shoot drags someone down.

### 4.3 What they cost

There are two prices: what the market pays someone, and what they ask *this
studio*.

**The market quote** is built from standing, never from talent.

- **Fame** sets the base for anyone the public would recognise: actors and
  directors, and to a lesser degree composers and writers.
- **Heat** is recent results. It multiplies the quote up after a hit.
- **Industry respect** sets the base for crafts the public does not follow:
  cinematographers, editors, designers. It comes from the quality of the films
  they worked on and from awards.
- **Experience** sets a floor under the quote: a veteran does not work for a
  newcomer's rate.
- **It ratchets.** A quote rises as soon as results justify it and falls only
  slowly. This is the documented behaviour of real quotes (`docs/domain/12`
  §2.3).

**How a quote falls.** Slowly, and by how much depends on four things. The
reference is blunt that "a flop does not end a career; a flop that is
attributed to you starts the chain" (`12` §4.4), and each of these is a part of
that.

1. **How badly the film did.** A disappointment costs a little. A bomb costs a
   lot. The scale is the film's result against what it cost, not a yes or no.
2. **How much it was their film.** Blame lands on whoever the film was sold on:
   the lead it was built around and the director, far more than a supporting
   player or the editor. Being in a film that failed for its own reasons costs
   much less than being the reason it was made.
3. **How they personally came off.** The engine already gives each cast member
   a verdict on their own work. Being singled out as the weak part of a decent
   film does a little damage each time and real damage if it keeps happening.
   This is the smaller effect; how the films do is the main one.
4. **How much standing they have to spend.** An established star with a long
   record of hits can absorb a bomb or two; it takes a run of them before the
   market stops believing the quote. Someone with one big film behind them has
   no such cushion, and one bad follow-up can undo the breakout.

Two details follow from how this really works. Heat falls first and the quote
follows a film or two later, because deals are signed before results are known.
And fame barely falls at all: a faded star is still famous, just no longer
expensive, which makes them an interesting hire.

**Recovery** needs no rule of its own. A faded name cast in a film that is well
received, especially by a respected director, regains heat through the same
update that took it away. The reference's routes back (the prestige director,
the scene-stealing supporting part, the cheap genre film that reaches a big
audience) all fall out of that.

**Directors** follow the same arc on a longer clock: they fall more slowly,
recover more completely, and are hurt as much by a reputation for going over
budget as by a bad film (`12` §4.9). The engine already records overruns and
on-set trouble, so this can be real.

**What they ask you** starts from the market quote and is moved by the person
and by your history with them. There is no fixed rule for how long a discovery
stays affordable; it depends on who they are.

- **The relationship.** The engine already tracks each studio's history with
  each person in tiers from grudge to loyal, and a loyal collaborator already
  "takes a friendlier deal to work with you again"
  (`engine/relationships.ts`). That stays the base.
- **Loyalty** decides how much of a market rise they pass on to a studio that
  treated them well. A loyal person who broke out on your film comes back for
  close to what you paid before. A person with little loyalty asks the full new
  quote from everyone.
- **Ambition** pulls the other way. An ambitious person wants the bigger film,
  the bigger studio and the bigger number once they are hot, however well you
  got on. Ambition also makes them likelier to say yes to a rival.
- **Ego** sets how much the billing, the role's size and the director matter
  next to the money.
- **How the last film went for them**, not only for you: a performance that got
  them noticed warms the relationship more than a paycheque on a flop.

So the same breakout produces different sequels. A loyal, unambitious
cinematographer becomes a long-term collaborator at a fair rate. An ambitious
lead with a hit is gone to a major unless there is a reason to stay.

**Deals** are that reason, and are a later stage of this work. A studio can
sign someone to more than one film at an agreed rate while they are still
affordable, which is the real practice of second-picture options
(`docs/domain/12` §2.3). The person's ambition and the studio's standing decide
whether they will sign and at what premium. A deal is what lets a player keep a
discovery whose personality would otherwise take them elsewhere.

**The independent quote stays.** The existing appeal and negotiation systems
already let a person take less for a script they love, a director they admire,
or a share of the back end. That needs no change.

### 4.4 How careers move

After each film finishes its run, everyone credited on it is updated.

- **Experience** goes up by one credit, and with it consistency.
- **Ability** grows in the attributes the film called on, more for a demanding
  part, more under strong collaborators, less the nearer they are to their
  potential (4.1a).
- **Physical performance** eases off with age.
- **Heat** moves with the film's commercial result, weighted by how much the
  role is seen to carry it and by the person's own notices. A miss is
  cushioned by standing (4.3).
- **Fame** moves with how many people saw the film, using the same visibility
  idea Brand now uses. A small film cannot make someone famous; a hit can.
- **Industry respect** moves with reviews and with nominations and wins.
- **The quote** is recomputed, subject to the ratchet.

Between films, heat fades toward neutral over about two years, and fame fades
very slowly.

Each year:

- **Newcomers arrive** in every profession: young, cheap, uncredited, with
  talent drawn from the same spread as everyone else. Most are ordinary. A few
  are not, and nothing marks them.
- **People leave**: by age, and by going years without work.

The pool stays about the same size. Today it is generated once and nobody
enters or leaves, which is also why the harness sometimes could not fill a role
late in a career.

### 4.5 What the player knows, and how they come to know it

The house rule already says players see prose and stars, not raw stats. Ability
moves fully behind that rule. The player never sees a talent value outside the
dev inspector; they hold a **read** of each attribute, and each read has its own
confidence.

**Knowledge is per attribute, and it comes from evidence.** There is no "three
films and you know them" rule. What a film teaches depends on what it asked of
the person.

- **A role only tests what it demands.** Every character already carries the
  demands of the part ("high physical performance, charisma demands"), every
  script its tone and scale, every production its requirements. A film sharpens
  the read of the attributes it leaned on and tells the player nothing about
  the rest.
- **So repetition has diminishing returns.** Cast someone in three action
  films and their physical performance is known for certain while their comedy
  and emotional range are exactly as uncertain as the day they were hired. To
  learn those, the player has to give them a part that needs them, which is a
  risk, which is the point.
- **A harder test teaches more.** A demanding lead tells more than a small
  supporting part; a large, difficult shoot tells more about a crew member than
  an easy one.

**Evidence from your own films is strong. Evidence from other people's films is
weak and can mislead.** This follows from something the engine already does: a
performance is not the actor alone. Today an actor's realised performance is
their own floor plus whatever headroom the director draws out, gated by how
well the part suits them (acting model §5). An ordinary actor with the right
director in a well-written, well-fitting part can give a great performance.
That is already true in the game.

- **On your own film you know the circumstances.** You know who directed, how
  well the part fit, how the shoot went. So the studio can separate the person
  from the help they had, and the read tightens properly.
- **On someone else's film you see only the result.** A great performance
  elsewhere says they are *capable of that under those conditions*. It does not
  say how much was the actor and how much was a director who knew how to push
  them. The read moves a little, stays wide, and leans optimistic for anyone
  who has worked with strong collaborators. The read's caveat names this: "Her
  best work was under a director who gets the best from everyone."
- **The same applies to directors and crew.** A director's acclaimed film may
  owe a great deal to its script; a cinematographer's best work to the director
  and the budget. Their track record is a clue, not a measurement.

**What is learned is ability, not potential.** Evidence shows how good someone
is now. Potential is never shown; the most the player gets is a sense of
direction, such as "still getting better" for someone whose recent work
outshines their earlier work. And because ability keeps moving, a read ages: a
confident read of someone the studio last used years ago is a read of who they
were then.

**A read reaches certainty one attribute at a time**, when the studio has seen
that attribute properly tested on its own films. Someone can be fully known as
a physical performer and still a mystery as a comic one.

What sharpens a read, in order of strength:

1. Your own films with them, on the attributes those films tested.
2. A casting director, for actors (exists), and for crew the department head
   they would work under vouching for them.
3. A screen test or a meeting, costing days and aimed at one attribute: a
   later addition.
4. Their work elsewhere: wide, and biased by who they worked with.

What this looks like on a card: the track record first (films, role, how each
was received), then a read per attribute in words with its confidence, then the
single most useful caveat. Not a grid of numbers. How to lay that out without
clutter is a design task of its own (section 8).

**Where the knowledge is stored:** nowhere new. Like relationships today, it can
be derived from the released films the studio made, which already record who
worked on them, in what part, under whom and how it went.

### 4.6 What rivals do

- Rivals choose people on the same evidence the player has: track record,
  standing and a noisy read. They stop picking at random near a price.
- So rivals go after whoever is hot, including someone the player just made
  hot. The person's loyalty, and the relationship the player has built, decide
  whether they stay. Both already exist.
- Rivals also take chances on newcomers at about the rate their identity
  suggests, which is where the work-list item on rival identity connects.

### 4.7 People decide: saying no, staying busy, slowing down, leaving

Raised by the owner after stage 5, and not yet built. Everything above treats
people as things that happen to be hired. They are also the ones choosing, and
that choice is the third thing growth depends on (4.1a), the thing that keeps
some people busy and others selective, and the honest way to model retirement.

**What exists today.** An actor can turn the player down for five reasons:
the part does not suit them, the studio's standing does not match what they
want, the money, their schedule, or bad history with the studio
(`engine/castingAppeal.ts`). A director weighs taste and appetite for the
script. Crew never refuse. Nobody ever refuses a rival. And nothing a person
decides depends on where they are in their career or what they have just done.

**The principle.** One decision, made the same way by everyone: actors,
directors and crew, whether the offer comes from the player or a rival. A
person weighs an offer against what they want right now, says yes or no, and
if it is no the player is told the reason in a sentence. Rivals being refused
matters as much as the player being refused: without it rivals get whoever they
choose, and the pool's dynamics are distorted in their favour.

**What a person weighs.** The first four exist in some form and stay.

| | The question they are asking | Driven by |
|---|---|---|
| The money | Is it enough? | Quote, relationship, loyalty (4.3) |
| The part | Does it suit me? | Fit (exists) |
| The studio | Do I want to be associated with them? | Brand, prestige, history (exists) |
| The schedule | Am I free? | Bookings (exists) |
| **What it does for me** | Is this another one of those, or something new? | Ambition, how established they are, what they have done lately |
| **Who else is on it** | Do I want to work with this director, this cast? | The director's standing and style, pair history, ego |
| **Whether it is beneath me** | Is this the size of film and of part someone like me does? | Standing, ego; waived for a script or director they love |
| **Whether I want to work at all** | Do I need a break? | How much they have worked, how the last film went, temperament, age |

**"Another one of those."** This is the centre of it, and it is what the owner
identified as the biggest effect.

- Everyone has a **type**: what they are known for. It is not a new stat. It is
  read from their record: the kinds of part and film they have mostly done, and
  for someone with no record, what they are naturally strongest at.
- **An unambitious person likes their type.** Offers that match it are easy
  yeses. They stay busy, stay where they are, and stop growing, because
  repeating what you can already do teaches nothing (4.1a). They are the
  dependable working core of the pool.
- **An ambitious person tires of it, once they can afford to.** Early on they
  take what comes, like anyone. With some standing behind them they start
  turning down the fourth version of the part that made them and looking for
  the one that stretches them: a different register, a better director, a
  smaller film with a better script. That is how range gets developed, and it
  is why they work less often and for less money on some films.
- **A stretch is a risk for them too.** A counter-cast part that goes badly
  costs heat. The reference describes the escape from typecasting as taking "a
  much smaller fee and often a smaller part, in exchange for evidence", and
  needing to do it twice before it counts (`docs/domain/12` §4.6). So an
  ambitious person offered a stretch by a studio or director they trust says
  yes cheaply, which is a real opening for a small studio.
- The player sees it in a line: "She has played three detectives running and
  wants something else", or "He is glad of the work".

**Who else is on it.** A director already draws actors by standing. Add the
reverse: some people will not work with a particular director or co-star again
after a bad experience (pair history exists and records how collaborations
went), and a person with a high ego will not take second billing to someone
they consider beneath them.

**Breaks.** Being available is not the same as wanting to work.

- After several films back to back, a person may take time off. How soon
  depends on temperament: the driven and the professional keep going, others
  pace themselves.
- A bad experience prompts one: a bomb that was blamed on them, a troubled
  shoot.
- A break is a period in which they turn down everything, or everything except
  an offer they could not refuse (a director they revere, the part of a
  lifetime). The player is told: "Taking a year away from films."
- Breaks end. Someone coming back has cooled a little and is often keen, which
  makes them good value.

**Slowing down and leaving.** Stage 3 retires people with a yearly chance that
depends on age. That works as bookkeeping and is not how it happens. Retirement
is a process, and people go through it at different ages for different reasons.

| Phase | What they do | The player sees |
|---|---|---|
| Working | Take offers on the terms above. | Nothing special. |
| **Selective** | Take fewer films. Money matters less; the part, the director and the people matter more. Leads become supporting parts by choice. | "Works rarely now, and only for the right project." |
| **Semi-retired** | Turn down nearly everything. Can still be coaxed out by a director they trust or a part written for someone their age. | "Says he has retired. People say that." |
| Gone | Leave the pool. | In the year's notice (stage 3). |

What moves someone from one phase to the next is personal:

- **Age**, differently by job: the reference has actors moving to character
  parts and directors peaking in their fifties and sixties (`12` §4.7).
- **Ambition.** The driven work until they cannot. Others stop when they have
  enough.
- **How it is going.** Some leave at the top. More leave because the offers
  have dried up or got smaller, which is the decline in 4.3 reaching its end.
- **Burnout:** a run of bombs or bad shoots.
- **The physical demands** of what they are known for. An action star has to
  change type or stop sooner than a character actor.

Comebacks follow from the semi-retired phase without a special rule: a faded or
retired name, cheap and famous, who says yes to the right offer and is good in
it, regains heat like anyone else.

**What this does to the pool.** It replaces three approximations.

- The age-based retirement chance (stage 3) becomes the phases above.
- "Rivals hire whoever they pick" (stage 5) becomes "rivals offer, and people
  choose", so the hottest people are genuinely scarce and a rival can lose
  someone to the player on something other than price.
- Growth through choice (4.1a, item 2) becomes real: who diversifies and who
  repeats is decided by the person.

**What it needs that does not exist yet.**

- A way to say what kind of part an offer is, and what a person's type is, from
  their record. People generated before the game began have a count of prior
  credits and no record of what they were, so their type has to be inferred
  from their strengths until they have made films in this world.
- The decision applied to crew and to rivals' offers, which never go through it
  today.
- A named reason for every kind of refusal, in the house style.

## 5. Why this does not recreate the exploit

The trial broke for three reasons. Each has an answer here.

| Trial failure | Answer |
|---|---|
| Ability was visible, so the player sorted by it | It is a read, and the read is wide exactly where the bargains are |
| Fees never moved, so a bargain lasted all game | Quotes ratchet after the first hit, and rivals bid for the person |
| Rivals hired by price and got worse | Rivals hire on track record, so proven people stay in demand and rival quality holds |

A fourth guard comes from 4.2: a cheap gifted first-timer is only safe on a
small film, so the discovery strategy is strongest for exactly the studios that
need it and weakest for a studio trying to staff a tentpole with unknowns.

## 6. How we will know it works

The player-economy harness and the box-office gates are the judges. The bot
needs one new strategy, "Scout", that deliberately hires the cheapest people
with the best reads.

- **Fee and talent correlate at 0.3 to 0.5** in a pool that has run for fifteen
  years, having started wherever generation puts it. The link should emerge
  from careers, not be written in.
- **A discovery's price at least doubles** after their first hit, and a rival
  makes them an offer within a year.
- **Indie with Scout does better than Indie with Careful**, but does not reach
  Brand 100 or nine-figure cash in ten years.
- **Boutique with Scout does not snowball.** This is the £657M case.
- **Rival film quality holds**: the whole-year gate misses no more bands than
  it does today.
- **The pool is stable**: size, age spread and fee spread after fifteen years
  look like year one.

## 7. Build order

Eight stages. Each can ship alone, is measurable with the harness, and leaves the
game playable. The actual untying of skill from fee comes last, once everything
that makes it safe is in place.

| # | Stage | What changes for the player | Size |
|---|---|---|---|
| 1 | **Make careers coherent at generation.** Age, experience, credits and fee agree with each other. Heat and industry respect become their own values. | Talent cards make sense: nobody is 22 with a £20M quote. | S |
| 2 | **Careers move.** Standing and quotes update after each film; heat fades. | People you made famous cost more next time. | M |
| 3 | **Arrivals and departures.** A yearly intake and retirement. | New faces each year; veterans leave. | M |
| 4 | **Ability becomes evidence-based knowledge.** The skill rating on directors and crew is replaced by track record plus per-attribute reads, learned from what each film tested. | Hiring a director feels like hiring an actor already does; you learn people by working with them. | L |
| 5 | **Rivals hire on track record.** | Rivals chase hot people, including yours. | M |
| 6 | **Untie ability from fee, per attribute. Potential, growth through use, and consistency from experience.** | Hidden ability exists; people develop; scale demands experience. | L |
| 7 | **Personality prices the relationship, and deals.** Loyalty, ambition and ego move what someone asks of you; multi-film deals. | Some discoveries stay; others have to be signed or lost. | M |

| 8 | **People decide (4.7).** One accept-or-refuse decision for everyone and for rivals' offers; type, stretch and repetition; breaks; retirement as phases. | People turn you down for reasons you can read, the ambitious seek new kinds of part, and veterans slow down before they go. | L |

Stages 1 to 5 and 8 are built. The agreed order for the rest is 6, then 7:
untying ability from fee, then deals.

Stage 7's first half (personality moving the ask) is small and could ride with
stage 2, since both touch how a price is set. Deals are the larger half.

Stages 1 to 3 change no balance by design and can be checked against today's
numbers. Stage 6 is the one that moves quality, and it is the one the
acceptance tests in section 6 are for.

### 7.1 Stage 1, as built

`engine/careerHistory.ts` derives a career's length, prior credits and
experience from the role and the person's position in its fee range, and the
generator stamps them onto every generated person.

| | Before | After |
|---|---|---|
| Fee and age, directors | 0.06 | 0.58 |
| Fee and age, crew heads | about 0 | 0.50 to 0.66 |
| Fee and age, actors | 0.05 | 0.26 |
| Youngest director in the top fee decile | 20s possible | 42 |
| Actors under 30 | about 5% | 15% |
| `experience` | a copy of skill | years in the role, 25 years = fully seasoned |
| Heat, industry respect | copies of fame and reliability | their own values; the pool's average heat still equals its average fame |
| Credits shown in the talent database | films released in this world only | those plus the films made before the studio opened |

The link is loose on purpose and differs by job: an actor can be famous young, a
head of department has climbed a ladder to get there. About a third of the
cheapest directors are veterans who never became expensive.

Skill, fame and fees are generated exactly as before, and the birth-date draws
are taken in the same order, so the generation stream is unchanged and every
existing test passes unmodified.

**What it did to balance.** The player-economy harness reads the same within
seed noise: median film quality is identical at every tier (41 and 39 at Indie,
53 and 49 at Boutique, 71 and 70 at Mid-Major), and the same studios survive,
decline or snowball. The box-office gates moved a little, which the stage was
not meant to do:

- Whole-year gate: 17 of 21, from 18. The new miss is specialty releases a year
  at 4.8 against a floor of 5, a figure that has sat on that edge all along.
- Budget-tier gate: 6 misses, from 4. Small rival films gross about 10% more
  against their cost (8.05x, from 7.3x, band 4.5 to 7).

Neither the younger acting pool nor any designed effect explains the second
one. Personality is derived from a hash that includes age, heat and industry
respect, and personality traits feed on-set events; changing those inputs
re-rolled everyone's temperament. Holding heat equal to fame recovers about
half the drift. It is left as is: the band was already failing, the cause is a
reshuffle and not a rule, and the gates are due a retune at stage 6 in any
case.

Hand-authored people (the real-world roster and the marquee directors) are
untouched: they carry their own ages and standing and have no prior-credit
count yet.

### 7.2 Stage 2, as built

`engine/careerProgress.ts`. When a film's run ends, everyone credited on it,
on the player's films and rivals' alike, is updated:

| | Moves with | Notes |
|---|---|---|
| **Heat** | How the film did in cinemas, from a full bomb (lost 60% of its cost or more) to a full hit (125% profit or more) | Weighted by role: lead 1.0, director 0.9, supporting 0.35, writer 0.3, down to 0.1 for a casting director. For actors, a quarter of it is their own notices. A miss is cushioned by up to 75% for someone famous and long in the job, and the cushion thins as heat sinks. |
| **Fame** | How many people saw the film | Never falls for a bomb. Harder to add to the more famous someone is. |
| **Industry respect** | The reviews | |
| **Experience** | The credit | Kept in step with the years the career has run. |
| **Quote** | All of the above | See below. |

Awards add heat and respect for the person named. Each quarter heat closes 16%
of its gap to fame and fame slips by 0.15%.

**The quote** is read against an anchor: the fee and standing a person had when
the market first repriced them. The same standing therefore always implies the
same quote. It rises to that figure at once and falls toward it by 30% of the
gap at the moment of a bad result and 12% a quarter after.

The first version passed on all of every rise and a share of every fall,
step by step. That is a ratchet with no way back, and it inflated the whole
pool: the median actor's fee more than tripled in ten years on the ordinary ups
and downs of heat. Anchoring fixed it.

**Measured** (four tiers, Careful and Steady, three seeds, ten years):

- **The player's economy reads the same as stage 1**, within seed noise. Median
  film quality is 41 to 43 at Indie, 47 to 55 at Boutique, 68 at Mid-Major, 73
  to 74 at Major. Ability has not moved, so this is expected.
- **The pool keeps its fame.** After ten years mean fame is up 7% for actors
  and flat for directors and crew.
- **Fees compress toward the middle.** The median actor's fee is 1.8 to 1.9
  times what it was and the median director's 1.2 to 1.4 times, while the top
  decile is slightly down (0.94 to 0.97 for actors, 0.85 for directors). People
  who work become better known; the famous can only hold their place. With
  nobody arriving at the bottom and nobody leaving the top, the middle fills
  up. This is what stage 3 is for, and it is left for stage 3.
- **A breakout raises an unknown lead's quote by a little under double**, short
  of the "at least doubles" in section 6. Making breakouts bigger pushes the
  compression above further, so it also waits for stage 3.

**A limit on the measurement.** The box-office gates read exactly as they did
after stage 1. That is not evidence of no effect: they run their own market loop
and do not go through the calendar settlement where careers move, so they
cannot see this stage at all. The harness, which plays through the real
reducer, is the only thing that measures it.

### 7.3 Stage 3, as built

`engine/careerTurnover.ts`, applied once in the reducer as the calendar moves
into a new year.

- **Who leaves.** Nobody for age before 55. From there the yearly chance rises
  from 2% to 25% at 80, is 50% after that, and everyone has gone by 88.
  Directors are judged eight years later than everyone else, since their
  careers peak late. Separately, someone who has not worked in six years and
  whose heat is below 35 has an 8% yearly chance of drifting out.
- **Who is safe.** Anyone attached to an unreleased film of the player's. (As
  first built, anyone booked by a rival was safe too; that turned out to mean
  almost nobody left, and was removed in 7.4.) No profession loses more than
  6% of its people in a year.
- **Who arrives.** The same number, in the same profession: generated from the
  bottom 30% of the fee range, aged a few years past the youngest the job
  starts at, with at most three years and a handful of credits behind them.
- **No dice from the main stream.** Departures are decided by a hash of the
  person and the year, and newcomers are generated from a seed derived from the
  save's own, so adding this moved no existing roll.
- **The player is told.** A stored note per year goes to the Inbox: how many
  arrived and left, the best-known departures by name, and anyone leaving whom
  the studio had worked with, with a button to the talent database. It counts
  toward the badge until the Inbox is opened and stays until dismissed.

**Measured** (four tiers, Careful and Steady, three seeds, ten years).

The player's economy reads the same as stage 2 within seed noise.

The pool after ten years, against day one:

| | Mean fame | Median fee | Top-decile fee |
|---|--:|--:|--:|
| Actors | 1.06x | 1.7x to 2.0x | 0.80x to 0.85x |
| Directors | 1.00x | 1.5x to 1.75x | 0.79x to 0.82x |
| Cinematographers | 0.91x | 0.74x to 0.82x | 0.80x to 0.87x |

**It did not fix the compression.** Fame held and people arrived and left, but
fees still crowded toward the middle: the median actor asked nearly double and
the top tenth about a fifth less. The explanation offered at the time - rivals
hire by price, so nobody is given the film that would take them to the top -
was a guess, and stage 5 showed it to be wrong (7.4).

Also not done: people who leave vanish from the talent database, though the
films they made keep their record of them.

### 7.4 Stage 5, as built, and what was really wrong with the pool

Stage 5 was taken ahead of stage 4 because the pool's stability was thought to
be waiting on it.

**Rivals hire on track record** (`engine/rivalCasting.ts`). A rival used to take
the people whose fee was nearest a target price and pick among them at random.
It now considers everyone it can afford for the film, from 35% of the target
up to 112% of it, and takes the best track records by its own imperfect read:
heat and fame for the people the public knows, the respect of colleagues and
years in the job for the crafts, each off by up to 14 points either way. A cheap
person on a run is now in contention for a bigger film; the same person without
the heat is not. Rivals know only what a player can see of a stranger.

**That alone changed nothing about the pool.** Fees compressed exactly as
before. So the pool was measured by group over ten years instead of in
aggregate, and the cause turned out to be in stage 2:

- **Fame had one resting level for everybody.** Gains shrank as fame rose, and
  decay was proportional to fame. Any working person drifted toward the same
  point: the middle third of actors gained eight to ten points of fame and the
  top third lost four.
- **Almost nobody was leaving.** Anyone a rival had booked was held back from
  retiring, and working people are always booked: 25 of 900 actors turned over
  in ten years.

What changed:

- **Fame is the level of the biggest things someone has been seen in.** A film
  has a reach set by its gross (22 at £15M, 12.5 more for each doubling, so
  about 47 at £60M, 72 at £240M and the high 90s at £1B). Being in it moves a
  person 35% of the way from where they are up to their role's share of that
  reach: all of it for a lead or director, 45% for a supporting part, 15 to 35%
  for writers and crew. Someone already better known than that gains nothing.
  Routine work at your own level changes nothing, a star stays a star, and a
  breakout is a leap. Fame now decays at 0.4% a year.
- **Craft rates climb with experience.** A head of department's market value
  now includes years in the job, which is what lets those pools hold their
  shape when newcomers arrive at the bottom and veterans leave from the top.
- **Being booked by a rival no longer keeps someone from retiring.** The film
  they are on carries its own record of them. People on the player's unreleased
  films are still protected.

**Measured** (four tiers, Careful and Steady, three seeds, ten years). The pool
after ten years against day one:

| | Mean fame | Median fee | Top-decile fee |
|---|--:|--:|--:|
| Actors | 1.02x to 1.04x | 1.35x to 1.48x (was 1.7x to 2.0x) | 0.83x to 0.88x |
| Directors | 0.97x to 0.99x | 1.09x to 1.32x (was 1.5x to 1.75x) | 0.80x to 0.89x |
| Cinematographers | 1.02x to 1.04x | 0.65x to 0.69x | 0.92x to 0.97x |

Roughly stable, not exactly. The middle still rises somewhat and the top still
slips, and the median craft fee falls because newcomers arrive at the very
bottom. "The pool is stable" in section 6 is **mostly met**: within about a
third at the median and a fifth at the top over a decade, where it was a factor
of two.

The player's economy reads the same within seed noise, and median film quality
is unchanged at every tier. The box-office gates are steady: the whole-year gate
passes 18 of 21 (it was 17), the buzz gate passes, and the budget-tier gate has
six misses as it has since stage 1. The variance gate's assertions all pass; it
was failing only on vitest's 5-second default, which it sat right at, and now
has an explicit time budget.

Not done in this stage: rivals do not yet remember whom they have worked with,
so the agreed rule that a rival knows people it has used better than strangers
waits for stage 4, when ability stops being visible. And a person's loyalty does
not yet weigh against a rival's offer; that is stage 7.

### 7.5 Stage 4, as built

**What a read is.** `engine/talentKnowledge.ts` derives, for one person in one
role, a read of each attribute the job involves: an actor's five, a director's
four (storytelling, visual command, working with actors, shaping the cut), a
production designer's or VFX supervisor's specialties, and a single "craft" for
the other crafts and writers (the engine still has one number for them). Each
read has a centre, a band, a confidence, a verdict in words ("Strong", "Very
likely good", "Good to strong", "Probably good", "Hard to say", "Untested") and
the basis behind it ("You saw it on two of your films", "One film for another
studio", "What they are known for"). Nothing is stored: it is rebuilt from the
released films, indexed by person once per projects array.

**Where evidence comes from**, as built:

| Source | Strength | Notes |
|---|---|---|
| Your own film | One demanding lead takes a read about half way; three make it certain | Tested only on what the part asked: a character's demands for an actor, the script's scale, spectacle and cast for a director, the department workload's specialties for a designer or VFX head |
| Another studio's film | 0.3 of an own film, and never past 60% confidence | For actors, work under a director who is strong with actors flatters the read until your own evidence replaces it |
| The career before the game | Second-hand, per credit, weighted by how strong the attribute is and how famous they are | So a veteran is known for their strengths and a mystery in what they are never cast for |
| A casting director | Up to half-way on every actor attribute, by skill | Unbiased |
| A screen test | Most of the way, on what the part asks | |

An unconfirmed read sits off the truth by a per-person, per-attribute amount
(up to 16 points), which shrinks as confidence grows, so a read is not just a
wider band around the right answer.

**What it changes.** The talent card's fit read now takes its confidence from
this evidence, weighted by what the part asks for, instead of from fame; the
per-axis breakdown veils the axes nobody has seen; the reputation bias (a famous
coaster reads better than they are) fades with evidence. The casting director's
take and the two-candidate comparison read the same way. The director's
creative-demand read and the pitch cards reveal a domain when a film has shown
it, banded by the read rather than the truth. The card gains a "Before you
offer" caveat, always visible, and a "Track record & what you know" section one
click away: the last four films with year, part, how each went and, for actors,
their own notices, then the reads. Rivals read anyone they have put in one of
their own released films by real ability, without noise (noise is still drawn,
so the stream does not move).

**Design pass.** The layout follows the canvas the user approved
(https://claude.ai/artifact/XapUz9yK2Bg4ZNoGFDQw4Z) with one change: the track
record and reads sit behind a disclosure, since the same card is used in
candidate lists of twenty or more; the caveat stays on the face of the card.

**Measured.** The whole-year gate passes 18 of 21 with the same three misses as
stage 5, within seed noise. The full suite passes. No save change: knowledge is
derived.

**Not done.** The on-set replacement card still uses the older fame-based read
(it has no film history to hand). The staffing board's read of crew already
hired still compares their true skill with the workload. A read does not yet age
(a read of someone last used years ago is a read of who they were then); with
ability fixed until stage 6 there is nothing for it to drift from. "Still
getting better" waits for growth in stage 6. Screen tests for crew, and a
department head vouching for someone, are not built.

### 7.6 Stage 8, as built

`engine/careerChoices.ts` holds the decision; it is folded into the offer paths
that already existed rather than added beside them.

**What a person now weighs**, on top of money, part, studio, schedule and
history:

| | As built |
|---|---|
| **Type** | Read from `Person.recentWork` (the last six films in this world, each with what the part leaned on), or, with too little record, their strongest attribute; an established pre-game veteran is assumed to be two films into it. |
| **Another one of those** | Ambitious (60+) and established (fame or heat 45+) with a run of two or more: the offer appeals less, 4 points a film, at most 16, and a refusal is named "is tired of playing this kind of part". Content (under 45): 5 points more appealing. |
| **The stretch** | Ambitious and established, offered something other than their type: 8 points more appealing, and their salary floor drops 15%. This is the opening a small studio can use. |
| **Beneath them** | Fame or heat 70+ and ego 60+: a small film or a supporting part appeals less, more so for both. Waived for a stretch they want. |
| **Selective** | 8 points less appealing for any ordinary offer. |
| **On a break / semi-retired** | A hard no ahead of everything else, unless the offer is tempting enough: a director whose industry respect is high, or a studio they are close to. |

**Phases.** Each person slows down at their own age: 59 for actors, 67 for
directors, 59 for crew, moved up to 5 years by ambition, spread 12 years by
luck, and 5 years earlier for an actor whose type is physical. Selective from
then, semi-retired 7 years later. Leaving for age now follows the phase (4% a
year selective, 25% semi-retired, 50% over 80, everyone by 88), replacing
stage 3's age curve. Tuned so departures run close to the old rule through the
first six years.

**Breaks.** Decided after each film finishes: a base 3% chance, plus 7% for
each film past two in two years, plus 20% after a bomb pinned on them (a lead
or director when the film failed badly), plus 5% over 60, damped by up to 60%
for the professional and the driven. A break lasts five months to eighteen
months (`Person.breakUntilDay`). Hashed from the person and the film, so it
never touches the shared random stream.

**Everyone, and rivals.** Actors and directors go through it in the existing
offer, negotiation and odds paths, with named reasons. Crew on a break or
retired cannot be hired. Rivals are turned down: nobody on a break or retired
takes a rival film, and anyone the offer does not suit (slowing down, or a big
name offered something small) refuses 70% of the time.

**What the player sees.** A line on the card ("Has played three action parts
running and wants something else", "Glad of the work", "Wants exactly this",
"Works rarely now", "Taking time away from films until..."), chips in the
casting list ("Tired of this type", "Wants this kind of part", "Taking a
break", "Retired"), the reason when they say no, and the "hide who won't work
with me" filter. When someone the studio has worked with starts a break or
slows down, the Inbox says so in one notice that gathers a month's news and
clears when read.

**Measured.** Ten-year harness, Careful and Steady, indie to major: the
player's economy reads the same within seed noise. Pool drift is back in
stage 5's range after retuning the phases (actors' median fee x1.33-1.59,
directors x1.15-1.32, top-decile fees x0.82-0.93); cinematographers' median
fee is lower than before (x0.55-0.61, was x0.65-0.69) because crew now turn
over a little faster. Whole-year gate 18 of 21, same misses. Budget-tier gate
the same six misses; big films do slightly worse (median all-in return 0.88x,
was 0.95x), consistent with big names now sometimes turning rivals down.
Save version 104.

**Not done.** Directors have no type yet (their genre would be it), so they
never tire of one. "Who else is on it" - refusing a director or co-star after a
bad experience, or second billing to someone beneath them - is not built. A
rival's offer is judged without the part, since rivals cast before binding
characters, so type and stretch do not apply to rivals. Growth through choice
waits for stage 6, which is next.

## 8. Decisions

Settled with the owner:

1. **Potential is fixed for life; ability is not.** People get better at what
   they practise, toward a limit they are born with and nobody can see (4.1,
   4.1a). This replaces the earlier "talent is fixed", which would have stopped
   anyone developing range.
2. **Experience raises the floor**, as consistency, for everyone including
   actors (4.2).
3. **Ability can be known for certain, but only through evidence.** Per
   attribute, from roles that tested it, strongly from the studio's own films
   and weakly from other people's (4.5). No film-count rule.
4. **Newcomers are drawn from the same spread as everyone.** Roughly one in ten
   genuinely good, one in fifty exceptional, and nothing marks them.
5. **How long a discovery stays affordable depends on the person and the
   relationship**: loyalty, ambition, ego and how the work went, with deals as
   the tool for keeping someone (4.3).
6. **Quotes fall slowly, by how badly the film did, how much it was theirs, how
   they came off, and how much standing they have to spend** (4.3). How the
   films do is the main driver; personal notices are the smaller one.
7. **A rival knows what the player would**: a weak read of strangers and full
   knowledge of people it has used.
8. **Growth is personal.** Temperament, choices and opportunity set each
   person's pace; early peakers, late bloomers and people who never get there
   all emerge from that (4.1a).
9. **The real-world roster keeps its hand-written skill values**, with
   experience derived from career length and quotes recomputed. Subject to a
   look at the file, and to deciding whether a written value is that person's
   ability today or their potential.

Still open:

- **The talent card.** Agreed that it needs a design pass. Per-attribute reads
  with confidence, a track record and a caveat are more than one skill rating.
  Needed before stage 4.
- **When deals arrive.** They can follow the rest (stage 7) or come earlier if
  keeping discoveries feels too hard without them.
- **The typical pace of growth.** How fast any one person grows is set by their
  temperament, their choices and their opportunities (4.1a). What is left to
  find is the average those spread around: too fast and most people reach their
  potential in a few films; too slow and development is invisible in a
  ten-year game. This is a number to find with the harness.
- **How much people steer their own careers.** Now designed as 4.7 (stage 8):
  what a person weighs, type and stretch, breaks, and retirement as phases. Not
  built. Order agreed: it comes after stage 4 and before stage 6, because it is
  one of the three things growth depends on.

## 9. Risks and limits

- **Save size.** Standing changes per person per film, but only current values
  are stored. Track records are derived from released films, which already
  hold who worked on them. Arrivals and departures keep the pool the same size.
- **Calibration.** Several constants assume today's skill spread, including the
  quality reference of 51. Stage 6 will need the gates re-run and probably a
  retune, which is why it is last and alone.
- **Legibility.** A read can feel like the game hiding things. The acting model
  handled this by always naming the reason for doubt. The same rule applies:
  every uncertain read says what it is uncertain about and what would resolve
  it.
- **Not in scope:** agents and packaging, guild rules, a person moving between
  professions, and personal lives. The domain reference covers them; none is
  needed for this.
