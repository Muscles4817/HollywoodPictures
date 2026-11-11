# Design: the talent model

**Status:** draft for review. Nothing here is built. Section 8 lists the
decisions that need an answer before work starts.

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
| **Talent** | The ceiling of what they can deliver in this role | No | Never directly |
| **Experience** | Credits and years in the role | Grows with each film | Yes, as a track record |
| **Standing** | Fame, heat, industry respect | After every film; heat fades | Yes, in words |
| **Quote** | What they ask | Follows standing; rises fast, falls slowly | Yes |

Talent is generated on its own axis, as actor craft already is.

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

A quote is built from standing, never from talent.

- **Fame** sets the base for anyone the public would recognise: actors and
  directors, and to a lesser degree composers and writers.
- **Heat** is recent results. It multiplies the quote up after a hit.
- **Industry respect** sets the base for crafts the public does not follow:
  cinematographers, editors, designers. It comes from the quality of the films
  they worked on and from awards.
- **Experience** sets a floor under the quote: a veteran does not work for a
  newcomer's rate.
- **It ratchets.** A quote rises as soon as results justify it and falls only
  slowly, after repeated misses or a long gap. This is the documented behaviour
  of real quotes (`docs/domain/12` §2.3).
- **The independent quote stays.** The existing appeal and negotiation systems
  already let a person take less for a script they love, a director they
  admire, or a share of the back end. That is how a small studio occasionally
  lands someone above its weight, and it needs no change.

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

### 4.5 What the player sees

The house rule already says players see prose and stars, not raw stats. Ability
moves fully behind that rule.

- **A track record**: the films, the role, how each was received and how it
  did. This is the primary evidence, as it is in the real business.
- **A read**: the existing three-tier confidence read, extended from "will this
  actor fit this part" to "how good is this person at this job". With eight
  credits the read is confident and narrow. With none it says so, and names why.
- **Ways to sharpen a read**, all of which exist or have an obvious home:
  - A casting director, for actors (exists).
  - Having worked with the person before (exists). After two or three films
    together the studio simply knows them.
  - For crew, the department head they would work under vouching for them.
  - A screen test or a meeting, costing days: a later addition.
- **Never** the talent number, outside the dev inspector.

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

Six stages. Each can ship alone, is measurable with the harness, and leaves the
game playable. The actual untying of skill from fee comes last, once everything
that makes it safe is in place.

| # | Stage | What changes for the player | Size |
|---|---|---|---|
| 1 | **Make careers coherent at generation.** Age, experience, credits and fee agree with each other. Heat and industry respect become their own values. | Talent cards make sense: nobody is 22 with a £20M quote. | S |
| 2 | **Careers move.** Standing and quotes update after each film; heat fades. | People you made famous cost more next time. | M |
| 3 | **Arrivals and departures.** A yearly intake and retirement. | New faces each year; veterans leave. | M |
| 4 | **Ability becomes a read for everyone.** The skill rating on directors and crew is replaced by track record plus read. | Hiring a director feels like hiring an actor already does. | M |
| 5 | **Rivals hire on track record.** | Rivals chase hot people, including yours. | M |
| 6 | **Untie talent from fee, and experience sets the floor.** | Hidden ability exists; scale demands experience. | M |

Stages 1 to 3 change no balance by design and can be checked against today's
numbers. Stage 6 is the one that moves quality, and it is the one the
acceptance tests in section 6 are for.

## 8. Decisions needed

1. **Is talent fixed for life?** Proposed: yes. Experience raises the floor and
   that is all the growth there is. The alternative, people who improve or
   decline, is more lifelike and much harder to read as a player.
2. **Can the player ever know someone's ability for certain?** Proposed: yes,
   after about three films together. It rewards loyalty and gives relationships
   a second purpose.
3. **How generous should the newcomer intake be?** Proposed: drawn from the
   same spread as everyone, so roughly one newcomer in ten is genuinely good
   and one in fifty exceptional. More generous makes scouting a strategy
   everyone uses; stingier makes it a lottery.
4. **How fast should a quote rise after a hit?** Proposed: enough that a second
   film with a discovery is still a good deal and a third is at market rate.
   That gives a discovery a two-film life as a bargain.
5. **Do quotes ever fall?** Proposed: slowly, after two misses in a row or
   three years without work. Faded stars at a discount are a real and
   interesting thing to hire.
6. **The real-world roster.** Its 1,500 people have hand-written skill values
   and fees. Proposed: treat the written skill as talent, derive experience
   from each person's real career length, and let quotes be recomputed. This
   needs a look at the file before it is promised.

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
