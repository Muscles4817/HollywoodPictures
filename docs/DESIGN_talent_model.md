# Design: the talent model

**Status:** draft for review, revised after the owner's first read. Nothing
here is built. Section 8 records what is settled and what is still open.

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
2. **Inexperienced is not untalented.** Experience buys consistency and the
   ability to handle a large production, not a higher ceiling.
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

Each career carries four things that today are one number.

| | What it is | Changes? | Seen by the player? |
|---|---|---|---|
| **Talent** | The ceiling of what they can deliver, attribute by attribute (4.1a) | No, fixed for life | Never directly; learned through evidence (4.5) |
| **Experience** | Credits and years in the role | Grows with each film | Yes, as a track record |
| **Standing** | Fame, heat, industry respect | After every film; heat fades | Yes, in words |
| **Quote** | What the market pays them | Follows standing; rises fast, falls slowly | Yes |

Talent is generated on its own axis, as actor craft already is.

### 4.1a What "talent" means, role by role

"Talent" is not one number. It is the set of ability attributes a role already
has in the engine. Everything else on a person is taste, temperament or
standing, and none of those is talent.

| Role | Talent: the fixed ability attributes | Today |
|---|---|---|
| **Actor** | Five strengths: character transformation, emotional performance, charisma, comedy, physical performance. Plus **headroom**: how much more a good director can draw out of them. | Already separate from fee. |
| **Director** | Four aptitudes: story, visual, performance, craft. | One `skill` number set by fee; the four aptitudes are small offsets around it. |
| **Writer** | Three craft strengths: structure, characters, dialogue. Plus concept ambition (how original their ideas run). | Set from a `skill` number set by fee. |
| **Cinematographer, editor, composer, production designer, VFX supervisor, casting director** | Their department's specialties. For a designer: period craft, large builds, location builds, creature builds. For VFX: digital environments, creature animation, compositing, digital doubles. | One `skill` number set by fee; specialties are offsets around it. |

So for directors, writers and crew the change is that the per-attribute values
become the real thing and the single `skill` number becomes only a summary of
them. A director can be a superb visual stylist and ordinary with actors, which
today is possible only for the hand-authored marquee names.

What is **not** talent, and stays as it is:

| Kind | Attributes | What it does |
|---|---|---|
| **Taste and style** | A director's and writer's tone profile (action, comedy, romance, suspense, drama, spectacle); a director's production style and how hands-on they are; a writer's genre affinity and commercial lean; a crew member's leaning toward digital or practical, and toward stylised or naturalistic work. | Decides what they suit and how they work, not how good they are. Visible, since it is known from their work. |
| **Temperament** | Professionalism, ambition, loyalty, ego, temperament, pressure handling, controversy, adaptability; reliability; a writer's consistency. | Decides how they behave: on a troubled shoot (4.2), in a negotiation and over a relationship (4.3). Most of these are carried today and read by nothing. |
| **Standing** | Fame, heat, industry respect. | Sets the quote (4.3). |

One existing piece stays outside the fixed-talent rule on purpose: an actor's
**floor**, what they deliver with no help. The acting model generates it as a
fixed value. Whether experience should raise it is an open question (section 8).

### 4.2 What they deliver on a film

A person's work on a film lands between a **floor** and their **ceiling**.

- The ceiling is their talent.
- The floor rises with experience. A veteran's floor sits close to their
  ceiling; a first-timer's sits well below it.
- Where in that range the work lands is decided the way it already is for
  actors: by the production around them, not by a dice roll on the person. A
  well-run, well-matched, adequately funded shoot gets people's best. A
  troubled one drags them toward their floor.
- **Scale is a demand on experience.** An Intimate film asks little of it. An
  Epic asks a great deal, so a gifted first-timer handed a tentpole is a real
  risk and the same person on a contained drama is not. This is the honest
  version of "you cannot hire a great director cheaply": you can, for the right
  size of film.

For actors this is the existing floor-and-headroom model unchanged, with a
director unlocking the headroom. For directors and crew the "production around
them" is the existing execution model: reserve, schedule pressure, prep, the
events that happened. Pressure handling and adaptability, already on every
person, finally get a job: they decide how far a bad shoot drags someone down.

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

- **Experience** goes up by one credit.
- **Heat** moves with the film's commercial result, weighted by how much the
  role is seen to carry it: leads and the director most, crew little.
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

Seven stages. Each can ship alone, is measurable with the harness, and leaves the
game playable. The actual untying of skill from fee comes last, once everything
that makes it safe is in place.

| # | Stage | What changes for the player | Size |
|---|---|---|---|
| 1 | **Make careers coherent at generation.** Age, experience, credits and fee agree with each other. Heat and industry respect become their own values. | Talent cards make sense: nobody is 22 with a £20M quote. | S |
| 2 | **Careers move.** Standing and quotes update after each film; heat fades. | People you made famous cost more next time. | M |
| 3 | **Arrivals and departures.** A yearly intake and retirement. | New faces each year; veterans leave. | M |
| 4 | **Ability becomes evidence-based knowledge.** The skill rating on directors and crew is replaced by track record plus per-attribute reads, learned from what each film tested. | Hiring a director feels like hiring an actor already does; you learn people by working with them. | L |
| 5 | **Rivals hire on track record.** | Rivals chase hot people, including yours. | M |
| 6 | **Untie talent from fee, per attribute; experience sets the floor.** | Hidden ability exists; scale demands experience. | M |
| 7 | **Personality prices the relationship, and deals.** Loyalty, ambition and ego move what someone asks of you; multi-film deals. | Some discoveries stay; others have to be signed or lost. | M |

Stage 7's first half (personality moving the ask) is small and could ride with
stage 2, since both touch how a price is set. Deals are the larger half.

Stages 1 to 3 change no balance by design and can be checked against today's
numbers. Stage 6 is the one that moves quality, and it is the one the
acceptance tests in section 6 are for.

## 8. Decisions

Settled with the owner:

1. **Talent is fixed for life.** Defined attribute by attribute in 4.1a.
2. **Ability can be known for certain, but only through evidence.** Per
   attribute, from roles that tested it, strongly from the studio's own films
   and weakly from other people's (4.5). No film-count rule.
3. **Newcomers are drawn from the same spread as everyone.** Roughly one in ten
   genuinely good, one in fifty exceptional, and nothing marks them.
4. **How long a discovery stays affordable depends on the person and the
   relationship**: loyalty, ambition, ego and how the work went, with deals as
   the tool for keeping someone (4.3). No fixed two-film rule.
5. **The real-world roster keeps its hand-written skill values as talent**,
   with experience derived from career length and quotes recomputed. Subject to
   a look at the file.

Still open:

- **Do quotes ever fall?** Proposed: slowly, after two misses in a row or three
  years without work. Faded names at a discount are a real and interesting
  thing to hire.
- **Does experience raise an actor's floor?** The acting model fixes it. Raising
  it with experience would make young actors riskier and veterans steadier,
  which fits "less experienced, not less talented", but it changes a shipped
  and calibrated model.
- **How much does a rival know?** Simplest is to give rivals the same
  weak-evidence read the player has of strangers, plus full knowledge of people
  they have used. The cheaper alternative is a single noisy read.
- **The card.** Per-attribute reads with confidence are more to show than one
  skill rating. This needs a layout pass before stage 4.
- **When deals arrive.** They can follow the rest (stage 7 below) or come
  earlier if keeping discoveries feels too hard without them.

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
