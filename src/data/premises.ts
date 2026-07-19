import type { Genre, SettingArchetype, StoryType, Tone } from '../types';

// One-sentence log-lines used to generate a script's synopsis
// (engine/premiseGenerator.ts). Presentation only - protagonist/antagonist
// here are flavor text, not new mechanical fields; nothing about scoring
// reads this file. `synopsis` is the full sentence, with {protagonist} and
// (optionally) {antagonist} substituted in - matching the curated,
// conditionally-selected-then-randomly-phrased pattern already used by
// data/storyBeats.ts and data/reviewBlurbs.ts, rather than a compositional
// slot-filler, to avoid nonsense pairings.
export interface Premise {
  protagonist: string;
  antagonist: string | null;
  synopsis: string;
  /**
   * Optional: Setting Archetypes this log-line especially suits. When a
   * script's own setting matches, the premise generator narrows to the
   * tagged entries (engine/premiseGenerator.ts:selectPool) - a light "nudge
   * by setting" so a Spacecraft or Medieval concept leans toward log-lines
   * written for it. Untagged entries are eligible for any setting.
   */
  settings?: SettingArchetype[];
}

// Keyed by genre, then by which tone (if any) got a flavor boost on top of
// the genre's canonical vector (see engine/scriptGenerator.ts:generateToneProfile) -
// an action-comedy script should read differently from a straight action
// script. Only a handful of genre/flavor combinations are authored for now
// (the ones common enough to be worth the writing); anything else falls
// back to the genre's 'straight' bucket, the same incremental-coverage
// approach taken with the script title word banks.
export const PREMISE_BANKS: Record<Genre, Partial<Record<Tone | 'straight', Premise[]>>> = {
  Action: {
    straight: [
      {
        protagonist: 'a disavowed special forces operative',
        antagonist: 'the private military contractor that left him for dead',
        synopsis: "{protagonist} goes to war with {antagonist}, and this time there's no one left to call it off.",
      },
      {
        protagonist: 'a retired assassin dragged back for one last job',
        antagonist: 'the syndicate that made her who she is',
        synopsis: '{protagonist} squares off against {antagonist} - the people who trained her are about to learn they trained her too well.',
      },
      {
        protagonist: 'an off-duty cop trapped in a hijacked skyscraper',
        antagonist: 'a crew of mercenaries with a plan nobody saw coming',
        synopsis: '{protagonist} has one night, one building, and no backup to stop {antagonist} from getting away with it.',
      },
      {
        protagonist: 'a getaway driver who knows too much',
        antagonist: 'the crime boss who wants him silenced',
        synopsis: '{protagonist} has forty-eight hours to outrun {antagonist} before the whole city closes in.',
      },
      {
        protagonist: 'a soldier stranded behind enemy lines',
        antagonist: 'a warlord who controls every road out',
        synopsis: "{protagonist} has to get a village of civilians past {antagonist} - and there's only one route left.",
      },
      {
        protagonist: "a bodyguard with a code she won't break",
        antagonist: 'the cartel enforcer sent to make her break it',
        synopsis: '{protagonist} draws a line that {antagonist} refuses to respect, and the fallout levels half the city.',
      },
      {
        protagonist: 'a prison transport guard whose convoy gets ambushed in the middle of nowhere',
        antagonist: 'the crew that staged the ambush to spring one specific prisoner',
        synopsis: '{protagonist} has to figure out which prisoner is worth this much firepower before {antagonist} finishes the job.',
      },
      {
        protagonist: 'a former Olympic athlete working security for a summit under threat',
        antagonist: 'a strike team that planned around every protocol except her',
        synopsis: '{protagonist} is the only one standing between {antagonist} and a room full of people who have no idea how close they are to dying.',
      },
      {
        protagonist: 'a smuggler who took one job too many',
        antagonist: "the government task force that's been building a case against her for years",
        synopsis: '{protagonist} has one shipment left to make good on before {antagonist} finally closes the net.',
      },
    ],
    comedy: [
      {
        protagonist: 'a washed-up action star doing his own stunts again',
        antagonist: "the identity thief who's been living his life better than he did",
        synopsis: '{protagonist} has to out-punch {antagonist} just to get his own name back - and it is not going well.',
      },
      {
        protagonist: 'two mismatched cops on their worst partnership yet',
        antagonist: "a smuggling ring neither of them can stop arguing long enough to catch",
        synopsis: '{protagonist} keep blowing every stakeout on {antagonist} because they cannot stop bickering - and somehow it is still working.',
      },
      {
        protagonist: 'a suburban dad who used to be a spy',
        antagonist: 'the arms dealer who just moved in next door',
        synopsis: "{protagonist} has to stop {antagonist}'s deal from going down using nothing but a garage full of tools and pure stubbornness.",
      },
      {
        protagonist: 'a getaway driver with a very specific set of anxieties',
        antagonist: 'the crime boss who hired him by mistake',
        synopsis: '{protagonist} is now on the run from {antagonist}, and he would like everyone to know this was not the plan.',
      },
      {
        protagonist: 'a retired stuntman coaching a hopeless film crew on their first real production',
        antagonist: 'the producer cutting every safety corner to hit the deadline',
        synopsis: '{protagonist} has to keep the whole shoot alive despite {antagonist}, one increasingly insane workaround at a time.',
      },
      {
        protagonist: "two feuding brothers who inherited their father's security company and nothing else",
        antagonist: 'the client who hired them by accident instead of the actual professionals',
        synopsis: '{protagonist} take the job anyway, and {antagonist} is about to find out exactly how that goes.',
      },
    ],
    suspense: [
      {
        protagonist: 'an off-the-books operative with one shot at redemption',
        antagonist: 'a killer inside her own agency',
        synopsis: '{protagonist} has forty-eight hours to expose {antagonist} before the frame job sticks for good.',
      },
      {
        protagonist: "a bomb disposal specialist working against a countdown he can't see",
        antagonist: "a bomber who's three steps ahead of the entire unit",
        synopsis: "{protagonist} is racing {antagonist} through a city that has no idea how close it is to the edge.",
      },
      {
        protagonist: 'a bodyguard who starts to suspect the real threat is closer than the target',
        antagonist: "someone inside the principal's own circle",
        synopsis: '{protagonist} realizes {antagonist} has been running the operation from the inside the entire time.',
      },
      {
        protagonist: "a soldier who wakes up mid-mission with no memory of the last six hours",
        antagonist: "whoever gave the order he can't remember taking",
        synopsis: '{protagonist} has to figure out what he did before {antagonist} finds him first.',
      },
      {
        protagonist: "an air marshal on a flight that isn't what it seems",
        antagonist: "a hijacker who's already three moves into a plan no one else has noticed",
        synopsis: "{protagonist} has to stop {antagonist} before the plane lands and it's too late to matter.",
      },
      {
        protagonist: 'a courier carrying something she was never told the value of',
        antagonist: 'everyone suddenly willing to kill for it',
        synopsis: "{protagonist} has to figure out what she's carrying before {antagonist} decides she's expendable too.",
      },
    ],
    drama: [
      {
        protagonist: 'a veteran struggling to reintegrate after one tour too many',
        antagonist: "the war he can't leave behind, playing out in his own neighborhood",
        synopsis: "{protagonist} finds himself fighting the same battle at home that he swore he'd left overseas.",
      },
      {
        protagonist: "a single father who used to run black ops for a government that's disavowed him",
        antagonist: 'the old unit sent to make sure he stays quiet',
        synopsis: '{protagonist} has to protect his daughter from {antagonist} without ever telling her who he used to be.',
      },
      {
        protagonist: "a boxer fighting one last bout to pay for his brother's surgery",
        antagonist: "the debt that's already decided how this fight ends",
        synopsis: "{protagonist} has to win a fight that everyone but him has already been paid to lose.",
      },
      {
        protagonist: "a firefighter carrying the guilt of a rescue that went wrong years ago",
        antagonist: "a wildfire bearing down on the same town he couldn't save the first time",
        synopsis: '{protagonist} gets one more chance to be the person he used to believe he was.',
      },
      {
        protagonist: "a mercenary who took the job to pay off his sister's debts",
        antagonist: 'the man who put her in debt in the first place',
        synopsis: "{protagonist} realizes halfway through the job that {antagonist} is exactly who he's been hired to protect.",
      },
    ],
  },
  Comedy: {
    straight: [
      {
        protagonist: 'a hopeless romantic who just got fired from her dream job',
        antagonist: null,
        synopsis: "{protagonist} decides the only sane response is to crash her ex's wedding, her sister's book club, and possibly her own life.",
      },
      {
        protagonist: "three childhood friends who haven't spoken in a decade",
        antagonist: null,
        synopsis: '{protagonist} reunite for one weekend that was supposed to fix everything and instead breaks it in new and specific ways.',
      },
      {
        protagonist: 'a painfully honest office temp',
        antagonist: null,
        synopsis: '{protagonist} is mistaken for the new CEO on day one, and no one has corrected the mistake yet - including her.',
      },
      {
        protagonist: 'a groom who forgot he already has a wife',
        antagonist: null,
        synopsis: '{protagonist} has one weekend to keep both weddings from finding out about each other.',
      },
      {
        protagonist: 'an overqualified dog walker running a small empire of chaos',
        antagonist: null,
        synopsis: '{protagonist} watches the entire client roster collide at once, and none of the dogs are the problem.',
      },
      {
        protagonist: 'a family that has never once agreed on anything',
        antagonist: null,
        synopsis: '{protagonist} is forced into one holiday under one roof, and the roof does not survive it.',
      },
      {
        protagonist: 'a competitive baker who just lost the only contest that ever mattered to her',
        antagonist: null,
        synopsis: '{protagonist} enters one more contest under a fake name, and the lie spirals faster than the batter.',
      },
      {
        protagonist: 'two feuding neighbors who accidentally swap houses for the summer',
        antagonist: null,
        synopsis: '{protagonist} spend three months trying to out-petty each other from a distance and somehow become friends by accident.',
      },
      {
        protagonist: "an overconfident life coach whose own life is falling apart",
        antagonist: null,
        synopsis: '{protagonist} takes on one more client while hiding exactly how little of this advice she actually follows.',
      },
    ],
    action: [
      {
        protagonist: 'a mild-mannered accountant recruited into a heist by mistake',
        antagonist: 'a crew of professional thieves stuck with him anyway',
        synopsis: "{protagonist} was supposed to just do the paperwork - now he's the only thing standing between {antagonist} and total disaster.",
      },
      {
        protagonist: 'two exes forced to work the same undercover job',
        antagonist: "the criminal empire neither of them can focus enough to actually catch",
        synopsis: '{protagonist} spend more time sabotaging each other than stopping {antagonist}, and it is somehow going fine.',
      },
      {
        protagonist: "a wedding planner who accidentally booked a mob boss's venue",
        antagonist: 'the rival family that wants it back',
        synopsis: '{protagonist} has forty-eight hours to pull off the wedding of the century before {antagonist} shows up and ruins the seating chart permanently.',
      },
      {
        protagonist: 'a community theater troupe rehearsing a heist play',
        antagonist: 'the actual criminals who think it is a real one',
        synopsis: '{protagonist} accidentally out-plans {antagonist} without ever realizing the stakes were real.',
      },
      {
        protagonist: 'a birthday clown who used to be in witness protection',
        antagonist: "the crime family that finally tracked him down at a seven-year-old's party",
        synopsis: '{protagonist} has to keep the party going while dealing with {antagonist} without a single kid noticing.',
      },
      {
        protagonist: 'a rideshare driver who picks up the wrong passenger on the wrong night',
        antagonist: 'the criminals now chasing his car through the whole city',
        synopsis: '{protagonist} just wanted a five-star rating - now he is stuck outrunning {antagonist} with the meter still running.',
      },
    ],
    romance: [
      {
        protagonist: 'two rival food truck owners parked on the same corner',
        antagonist: null,
        synopsis: '{protagonist} spend the whole summer trying to put each other out of business and somehow keep ending up at the same table.',
      },
      {
        protagonist: 'a wedding photographer who has sworn off love professionally and personally',
        antagonist: null,
        synopsis: '{protagonist} takes one more booking against her better judgment, and cannot get the best man to stop making her laugh.',
      },
      {
        protagonist: 'two coworkers stuck sharing a desk during a very awkward merger',
        antagonist: null,
        synopsis: '{protagonist} spend three months pretending the tension is about the desk.',
      },
      {
        protagonist: 'a hopeless matchmaker who has never once dated anyone she set up',
        antagonist: null,
        synopsis: "{protagonist} finally meets someone her own algorithm never would have picked - and can't explain why it is working.",
      },
      {
        protagonist: 'a bakery owner and the health inspector who keeps finding excuses to come back',
        antagonist: null,
        synopsis: '{protagonist} run out of code violations to pretend to care about within a month.',
      },
      {
        protagonist: 'two competing wedding planners double-booked for the same venue',
        antagonist: null,
        synopsis: "{protagonist} spend the whole event trying to sabotage each other's timelines and keep missing every chance to actually leave.",
      },
    ],
    drama: [
      {
        protagonist: 'a stand-up comedian bombing his way through a hometown tour he never wanted to do',
        antagonist: null,
        synopsis: '{protagonist} has to face the family he has been making jokes about for twenty years, in person, for the first time.',
      },
      {
        protagonist: 'a wedding DJ who has never once made it through an event without crying',
        antagonist: null,
        synopsis: "{protagonist} finally has to admit why other people's happy endings keep getting to him.",
      },
      {
        protagonist: "two roommates pretending everything is fine right up until the eviction notice",
        antagonist: null,
        synopsis: '{protagonist} have one month to either fix everything or finally stop pretending to each other.',
      },
      {
        protagonist: 'a former child star doing dinner theater under a fake name',
        antagonist: null,
        synopsis: '{protagonist} gets recognized on opening night and has to decide whether to run from that past or finally own it.',
      },
      {
        protagonist: "a family reuniting for a will reading none of them are ready for",
        antagonist: null,
        synopsis: "{protagonist} spend the weekend fighting over furniture because it's easier than talking about who's actually gone.",
      },
    ],
  },
  Drama: {
    straight: [
      {
        protagonist: 'a father returning home after twenty years away',
        antagonist: null,
        synopsis: '{protagonist} has to earn back a family that stopped waiting for him a long time ago.',
      },
      {
        protagonist: 'a nurse working the last shift of a rural hospital before it closes for good',
        antagonist: null,
        synopsis: '{protagonist} spends one final night with the patients no one else came back for.',
      },
      {
        protagonist: 'two estranged sisters forced to sell the house they grew up in',
        antagonist: null,
        synopsis: '{protagonist} spend one last week clearing it out, and everything they never said comes with it.',
      },
      {
        protagonist: 'a former boxer working construction to make rent',
        antagonist: null,
        synopsis: '{protagonist} gets one more shot at the life he walked away from, and has to decide if he still wants it.',
      },
      {
        protagonist: 'a widow rebuilding a farm no one thinks she can save',
        antagonist: null,
        synopsis: '{protagonist} spends a full season proving everyone in town wrong, one bad harvest at a time.',
      },
      {
        protagonist: 'a teacher in her last year before retirement',
        antagonist: null,
        synopsis: '{protagonist} takes on the one student everyone else already gave up on.',
      },
      {
        protagonist: 'a surgeon forced to take a leave of absence after one mistake',
        antagonist: null,
        synopsis: '{protagonist} has to rebuild a life outside the one thing she ever knew how to be good at.',
      },
      {
        protagonist: 'a small-town mayor watching the one factory keeping the town alive announce its closure',
        antagonist: null,
        synopsis: "{protagonist} has one town meeting to convince people there's still something worth staying for.",
      },
      {
        protagonist: 'a mother and her estranged adult son sharing a car for one long, unavoidable road trip',
        antagonist: null,
        synopsis: "{protagonist} have four hundred miles to say everything they've been avoiding for a decade.",
      },
    ],
    romance: [
      {
        protagonist: "a hospice nurse who has never let a patient's family get close to her",
        antagonist: null,
        synopsis: "{protagonist} breaks her own rule for one family, and it costs more than she expected.",
      },
      {
        protagonist: "two former spouses forced to co-parent through a diagnosis neither saw coming",
        antagonist: null,
        synopsis: '{protagonist} find themselves leaning on each other in ways the divorce was supposed to make impossible.',
      },
      {
        protagonist: "a soldier's widow who finally opens the letters he wrote before he died",
        antagonist: null,
        synopsis: '{protagonist} finds a version of him in those pages she never got to meet, and has to decide what to do with that.',
      },
      {
        protagonist: 'a violinist whose career ended the same year her marriage did',
        antagonist: null,
        synopsis: '{protagonist} finds an old student willing to remind her why she started playing in the first place.',
      },
      {
        protagonist: 'two strangers who meet once a year at the same grief support group',
        antagonist: null,
        synopsis: "{protagonist} realize the one appointment they've been dreading all year has become the one they need most.",
      },
    ],
    suspense: [
      {
        protagonist: "a defense lawyer who starts to believe her own client did it after all",
        antagonist: null,
        synopsis: '{protagonist} has to decide what she owes the truth versus what she owes the job.',
      },
      {
        protagonist: "a daughter going through her late mother's belongings and finding a second, secret family",
        antagonist: null,
        synopsis: "{protagonist} has to decide whether confronting that truth honors her mother or destroys what's left of her.",
      },
      {
        protagonist: 'a therapist who starts to suspect one of her patients is lying about everything',
        antagonist: null,
        synopsis: "{protagonist} has to work out how far the lie goes before deciding what she's obligated to do about it.",
      },
      {
        protagonist: "a journalist investigating her own family's role in a decades-old scandal",
        antagonist: null,
        synopsis: '{protagonist} has to decide whether the story is worth what it will cost the people she loves.',
      },
      {
        protagonist: "an adult returning to clear out her childhood home and finding evidence her father wasn't who she thought",
        antagonist: null,
        synopsis: '{protagonist} has one week to decide whether she wants the answer badly enough to go looking for it.',
      },
    ],
  },
  Horror: {
    straight: [
      {
        protagonist: 'a single mother who just moved into a house that is far too cheap',
        antagonist: 'whatever the last family left behind',
        synopsis: "{protagonist} realizes the house didn't come empty - {antagonist} never actually left.",
      },
      {
        protagonist: 'a night-shift security guard at a hospital that is supposed to be empty',
        antagonist: 'something that walks the halls after the power cuts out',
        synopsis: '{protagonist} spends one shift learning exactly why the previous guard quit without notice, thanks to {antagonist}.',
      },
      {
        protagonist: 'four friends who take a wrong turn on a hiking trip',
        antagonist: "something in the woods that has been tracking them since dusk",
        synopsis: "{protagonist} realize the trail back is gone, and {antagonist} isn't.",
      },
      {
        protagonist: 'a grad student researching an abandoned asylum for her thesis',
        antagonist: "a presence the asylum's old staff refused to talk about",
        synopsis: '{protagonist} finds out exactly why {antagonist} was left off every official record.',
      },
      {
        protagonist: 'a family moving into a house with a very specific rule about the basement',
        antagonist: 'the thing that rule was written to keep down there',
        synopsis: '{protagonist} breaks the one rule within a week, and {antagonist} notices immediately.',
      },
      {
        protagonist: 'a small-town sheriff investigating a string of disappearances',
        antagonist: 'something older than the town itself',
        synopsis: "{protagonist} finds out the disappearances aren't random, and {antagonist} isn't finished.",
      },
      {
        protagonist: 'a hospice caretaker assigned to a patient the agency will not discuss',
        antagonist: 'whatever is keeping that patient alive far longer than it should',
        synopsis: '{protagonist} realizes too late why no one else would take this assignment.',
      },
      {
        protagonist: 'a park ranger doing one last patrol before the reserve closes for winter',
        antagonist: "something that has been using the closed season to come out of hiding",
        synopsis: '{protagonist} finds out exactly why the reserve closes when it does.',
      },
      {
        protagonist: 'a family who inherited a lake house nobody in the family will explain',
        antagonist: 'whatever the lake has been keeping quiet about for generations',
        synopsis: '{protagonist} spends one summer learning exactly why no one in the family ever visited.',
      },
    ],
    comedy: [
      {
        protagonist: 'a hapless real estate agent who really needs this house to sell',
        antagonist: 'the extremely rude ghost currently haunting the open house',
        synopsis: '{protagonist} tries to close the deal anyway, and {antagonist} is not going to make that easy.',
      },
      {
        protagonist: 'a group of roommates who summoned something at a party and forgot about it',
        antagonist: 'the demon still living in their kitchen',
        synopsis: '{protagonist} would like {antagonist} to leave, but it turns out it is on the lease now, technically.',
      },
      {
        protagonist: 'an exterminator called out for what sounded like a routine rat problem',
        antagonist: 'whatever is actually living in the walls',
        synopsis: '{protagonist} realizes about thirty seconds too late that this was never a rat problem, thanks to {antagonist} - and is not paid enough for this.',
      },
      {
        protagonist: 'a summer camp counselor on her first and worst night shift',
        antagonist: "the camp's very real local legend",
        synopsis: "{protagonist} spends the whole night trying to convince the kids {antagonist} isn't real, right up until it isn't fine anymore.",
      },
      {
        protagonist: 'a paranormal investigator who has never actually found anything real until now',
        antagonist: 'the first genuine haunting of her entire career',
        synopsis: "{protagonist} finally gets the proof she's always wanted, and immediately regrets every part of this.",
      },
      {
        protagonist: 'a landlord who has been ignoring tenant complaints about noises in the walls for months',
        antagonist: 'the very real reason for those noises, now considerably more annoyed,',
        synopsis: '{protagonist} finally goes to investigate personally, and {antagonist} has some notes about the response time.',
      },
    ],
    drama: [
      {
        protagonist: "a mother whose grief refuses to let her son's room stay empty",
        antagonist: 'whatever has started answering when she talks to it',
        synopsis: "{protagonist} has to decide how much of her son is really still there, and how much she's willing to believe.",
      },
      {
        protagonist: 'a hospice worker who has watched too many patients die and started seeing what comes after',
        antagonist: 'something that follows every death she is present for',
        synopsis: '{protagonist} has to decide whether {antagonist} is a warning or a mercy before it comes for her too.',
      },
      {
        protagonist: "a widower who moved into his late wife's family home to be closer to her memory",
        antagonist: 'whatever that family never told him lives in the walls',
        synopsis: "{protagonist} realizes his grief isn't the only thing keeping him in that house.",
      },
      {
        protagonist: 'a survivor of a house fire that took her whole family, moving back to rebuild',
        antagonist: 'what did not burn, and never left',
        synopsis: "{protagonist} has to face what's still waiting in the one place she swore she'd never return to.",
      },
      {
        protagonist: "a son caring for a father whose dementia keeps describing someone who isn't there",
        antagonist: "the increasingly real possibility that his father isn't imagining it",
        synopsis: '{protagonist} starts to realize his father was trying to warn him the whole time.',
      },
    ],
  },
  Romance: {
    straight: [
      {
        protagonist: 'a chef who just inherited a failing restaurant',
        antagonist: null,
        synopsis: "{protagonist} has one summer to save it, with the help of someone she swore she'd never work with again.",
      },
      {
        protagonist: 'two rival architects assigned to the same project',
        antagonist: null,
        synopsis: "{protagonist} spend six months arguing over blueprints and slowly realize that's not actually what they're arguing about.",
      },
      {
        protagonist: 'a widower who agreed to one blind date to make his daughter happy',
        antagonist: null,
        synopsis: '{protagonist} goes in expecting nothing and leaves not sure what just happened to the rest of his year.',
      },
      {
        protagonist: 'a travel writer who has never stayed anywhere long enough to fall for it',
        antagonist: null,
        synopsis: '{protagonist} takes one assignment in one small town and finds the one reason to stop moving.',
      },
      {
        protagonist: 'two former college sweethearts reunited at a wedding neither wanted to attend',
        antagonist: null,
        synopsis: "{protagonist} spend the whole weekend pretending the last ten years didn't happen.",
      },
      {
        protagonist: 'a florist who does weddings for everyone except herself',
        antagonist: null,
        synopsis: '{protagonist} finally gets asked out by a regular customer and has absolutely no idea what to do with that.',
      },
      {
        protagonist: 'a bookstore owner about to lose the lease to a chain store next door',
        antagonist: null,
        synopsis: '{protagonist} finds an unlikely ally in the chain store\'s own manager, who hates the job more than she does.',
      },
      {
        protagonist: 'a divorce lawyer who has personally never believed in the institution she works to end',
        antagonist: null,
        synopsis: '{protagonist} takes on one more case and finds herself arguing against everything she thought she believed.',
      },
      {
        protagonist: 'a ski instructor and the hopeless beginner she is assigned for the whole season',
        antagonist: null,
        synopsis: '{protagonist} spends the whole winter insisting the lessons are strictly professional.',
      },
    ],
    comedy: [
      {
        protagonist: "two exes forced to co-host their mutual friend's engagement party",
        antagonist: null,
        synopsis: '{protagonist} spend the whole event competing over who can seem more fine about it, badly.',
      },
      {
        protagonist: 'a woman who accidentally gets engaged to the wrong person at a costume party',
        antagonist: null,
        synopsis: '{protagonist} has one week to fix it before both families find out, and it just keeps getting worse.',
      },
      {
        protagonist: 'two dating-app disasters who keep getting matched by mistake',
        antagonist: null,
        synopsis: "{protagonist} finally meet in person to complain about it and immediately understand the algorithm's reasoning.",
      },
      {
        protagonist: 'a wedding singer who has performed at forty weddings and been in zero relationships',
        antagonist: null,
        synopsis: '{protagonist} finally gets asked to be more than the entertainment, and has no idea how to be anything else.',
      },
      {
        protagonist: 'two competing best-man and maid-of-honor giving dueling speeches at the same wedding',
        antagonist: null,
        synopsis: '{protagonist} turn the toast into an actual competition, and the bride is furious and delighted in equal measure.',
      },
      {
        protagonist: 'a professional bridesmaid who has been in nineteen weddings and never once been the bride',
        antagonist: null,
        synopsis: '{protagonist} finally gets asked to be more than the twentieth bridesmaid, and has absolutely no script for that.',
      },
    ],
    suspense: [
      {
        protagonist: "a woman falling for the new tenant in her building who isn't quite who he says he is",
        antagonist: null,
        synopsis: '{protagonist} has to decide whether the secret he is hiding is dangerous or just complicated.',
      },
      {
        protagonist: 'a private investigator hired to follow a woman she is slowly falling for instead',
        antagonist: null,
        synopsis: '{protagonist} has to decide what she owes the client versus what she owes her own heart.',
      },
      {
        protagonist: 'two strangers who keep running into each other, always right after something goes wrong nearby',
        antagonist: null,
        synopsis: '{protagonist} start to wonder if the timing is romance or something else entirely.',
      },
      {
        protagonist: 'a woman who realizes the man she has been dating remembers a version of their first meeting that never happened',
        antagonist: null,
        synopsis: '{protagonist} has to find out what he is actually hiding before she falls any further for a story that is not true.',
      },
      {
        protagonist: "an art restorer who falls for the man selling her a painting with a history he won't explain",
        antagonist: null,
        synopsis: '{protagonist} has to decide if she can love someone whose past keeps arriving one lie at a time.',
      },
    ],
  },
  'Sci-Fi': {
    straight: [
      {
        protagonist: "a salvage pilot who finds a signal that shouldn't exist",
        antagonist: 'the corporation that will do anything to bury it',
        synopsis: '{protagonist} has to get the truth back to civilization before {antagonist} erases every trace of it - and her.',
      },
      {
        protagonist: 'a colonist waking from cryosleep decades off schedule',
        antagonist: "the thing that's been running the station without a crew for years",
        synopsis: '{protagonist} has to figure out what {antagonist} did to everyone else before it happens to her too.',
      },
      {
        protagonist: 'an engineer aboard a generation ship losing power one deck at a time',
        antagonist: 'a fault no one can find in time',
        synopsis: '{protagonist} has one week of air left to solve what {antagonist} has been hiding since launch.',
      },
      {
        protagonist: 'a scientist who built an AI that just started making its own decisions',
        antagonist: 'the very intelligence she created',
        synopsis: "{protagonist} has to shut down {antagonist} before it decides it doesn't need her permission anymore.",
      },
      {
        protagonist: 'a border agent on a planet that is not supposed to have visitors',
        antagonist: 'an arrival that changes everything about what they thought they knew',
        synopsis: '{protagonist} has to decide what to do about {antagonist} before command makes that decision for her.',
      },
      {
        protagonist: 'a courier running data across a solar system on the edge of war',
        antagonist: 'the fleet that will kill to stop the delivery',
        synopsis: '{protagonist} has one jump left to outrun {antagonist} and get the truth where it needs to go.',
      },
      {
        protagonist: "a terraforming engineer who discovers the planet she's reshaping was never actually empty",
        antagonist: 'the company',
        synopsis: '{protagonist} has to decide what she owes a species whose existence {antagonist} has kept hidden the entire time.',
      },
      {
        protagonist: "a soldier fighting a war she's starting to suspect was manufactured",
        antagonist: 'the command structure that has been feeding both sides the same lies',
        synopsis: "{protagonist} has to get the truth out before {antagonist} decides she's a bigger problem than the war itself.",
      },
      {
        protagonist: 'a repair technician on a space elevator who finds a stowaway with no record of ever boarding',
        antagonist: 'whoever erased that record in the first place',
        synopsis: "{protagonist} has to find {antagonist} before the elevator reaches the top and it's someone else's problem.",
      },
    ],
    suspense: [
      {
        protagonist: 'the last surviving crew member of a ship that lost contact months ago',
        antagonist: "something on board that isn't supposed to be there",
        synopsis: '{protagonist} has to figure out what happened to everyone else before {antagonist} finishes the job.',
      },
      {
        protagonist: 'an investigator sent to a research station that has gone completely silent',
        antagonist: 'whatever the station was actually built to study',
        synopsis: "{protagonist} realizes the silence wasn't an accident, and {antagonist} has been waiting.",
      },
      {
        protagonist: "a technician who starts finding logs that shouldn't exist",
        antagonist: 'someone on the crew who has been erasing them',
        synopsis: '{protagonist} has to identify {antagonist} before the next log is hers.',
      },
      {
        protagonist: "a pilot who wakes up to find the rest of the crew missing and the ship's records wiped",
        antagonist: 'the person or thing behind the wiping',
        synopsis: '{protagonist} has less than a day of oxygen to find out what {antagonist} does not want her to remember.',
      },
      {
        protagonist: 'a clone who starts remembering things that happened to the original, not her',
        antagonist: "the facility that insists that's not possible",
        synopsis: "{protagonist} has to prove her memories are real before {antagonist} decides she's malfunctioning.",
      },
      {
        protagonist: 'a xenobiologist whose research samples keep changing overnight',
        antagonist: 'whatever has been getting into a supposedly sealed lab',
        synopsis: '{protagonist} has to figure out how {antagonist} is getting in before it decides to stop hiding.',
      },
    ],
    comedy: [
      {
        protagonist: "a delivery driver for the galaxy's least competent courier service",
        antagonist: 'an AI dispatcher that keeps sending him to increasingly hostile planets',
        synopsis: '{protagonist} just wants to finish his route, but {antagonist} has other, deeply unhelpful ideas.',
      },
      {
        protagonist: 'a robot built for customer service who was never updated for first contact',
        antagonist: 'the alien delegation now filing a formal complaint about him',
        synopsis: '{protagonist} has to smooth things over with {antagonist} using nothing but a return policy and pure enthusiasm.',
      },
      {
        protagonist: "a low-level bureaucrat processing paperwork for a fleet that's about to go to war by accident",
        antagonist: 'a filing error that neither side will admit started this',
        synopsis: '{protagonist} has forty-eight hours to fix {antagonist} before an entire star system goes up over nothing.',
      },
      {
        protagonist: 'a washed-up test pilot who gets recruited by aliens who clearly wanted someone else',
        antagonist: 'the actual hero the aliens meant to abduct instead',
        synopsis: '{protagonist} has to save the galaxy anyway, while {antagonist} keeps loudly pointing out this was a mix-up.',
      },
      {
        protagonist: 'a space station janitor who keeps finding classified documents in the recycling',
        antagonist: "the intelligence officer increasingly convinced he's a master spy",
        synopsis: '{protagonist} just wants to finish his shift, but {antagonist} will not stop recruiting him.',
      },
    ],
  },
  Fantasy: {
    straight: [
      {
        protagonist: "a blacksmith's apprentice who turns out to be the last heir to a throne no one wants back",
        antagonist: 'the regent who has spent years making sure no one ever finds out',
        synopsis: '{protagonist} has to reclaim a crown while {antagonist} works just as hard to make sure he never gets the chance.',
      },
      {
        protagonist: "a disgraced knight exiled for a crime she didn't commit",
        antagonist: 'the true traitor still sitting in the royal court',
        synopsis: '{protagonist} has one chance to clear her name before {antagonist} finishes what the frame job started.',
      },
      {
        protagonist: "a young mapmaker who stumbles into a kingdom that isn't on any map",
        antagonist: "the ancient power that has kept it hidden for a reason",
        synopsis: '{protagonist} has to decide whether to warn the world about {antagonist} or protect the secret that has kept it safe.',
      },
      {
        protagonist: "a healer with a gift she has been told to hide her whole life",
        antagonist: "the order that hunts anyone who doesn't",
        synopsis: '{protagonist} finally has to choose between hiding forever and standing against {antagonist}.',
      },
      {
        protagonist: 'the youngest of three siblings sworn to protect a dying forest',
        antagonist: "the empire that wants what's underneath it",
        synopsis: '{protagonist} is the only one left standing between the forest and {antagonist} once her siblings fall.',
      },
      {
        protagonist: 'a former court wizard stripped of his title and his magic',
        antagonist: 'the successor who framed him for it',
        synopsis: '{protagonist} has to get both back before {antagonist} finishes rewriting the kingdom\'s history.',
      },
      {
        protagonist: 'a village storyteller who discovers the legends she tells children are all literally true',
        antagonist: 'the force those legends were written to warn people about',
        synopsis: '{protagonist} has to convince a kingdom that stopped believing before {antagonist} makes belief irrelevant.',
      },
      {
        protagonist: 'a prince who traded his throne for a chance to travel unrecognized',
        antagonist: 'the council that installed a puppet in his place the moment he left',
        synopsis: '{protagonist} has to reclaim a kingdom he was not sure he wanted, now that {antagonist} controls it completely.',
      },
      {
        protagonist: 'a dragon keeper tasked with raising the last egg of a species everyone insists is extinct',
        antagonist: 'the hunters who made sure of that the first time',
        synopsis: '{protagonist} has to keep the last dragon alive before {antagonist} finishes what they started.',
      },
    ],
    romance: [
      {
        protagonist: 'a cursed prince who can only break the spell through a love he refuses to ask for',
        antagonist: null,
        synopsis: '{protagonist} has one season before the curse becomes permanent, and still will not say a word about it.',
      },
      {
        protagonist: 'a warrior sworn to protect a princess she was never supposed to fall for',
        antagonist: null,
        synopsis: '{protagonist} has to choose between the oath she swore and the person it was written to protect.',
      },
      {
        protagonist: 'two rival court mages assigned to work the same royal wedding',
        antagonist: null,
        synopsis: '{protagonist} spend the whole ceremony sabotaging each other\'s spells and ruining absolutely none of the romance building between them.',
      },
      {
        protagonist: 'a huntress who falls for the very creature she was sent into the forest to kill',
        antagonist: null,
        synopsis: '{protagonist} has to decide what she actually believes before she brings back proof she never will.',
      },
      {
        protagonist: 'a blacksmith forging a sword for the knight she has quietly loved for years',
        antagonist: null,
        synopsis: "{protagonist} puts everything she can't say into the one thing she knows how to make.",
      },
    ],
    comedy: [
      {
        protagonist: 'an apprentice wizard who keeps accidentally summoning things nobody asked for',
        antagonist: 'the increasingly unimpressed demon he summoned by mistake this time',
        synopsis: '{protagonist} has to send {antagonist} home before the whole tower notices - it is in absolutely no hurry.',
      },
      {
        protagonist: 'a dragon who has taken up hoarding gift-shop souvenirs instead of gold',
        antagonist: 'the knight sent to slay him who cannot find a single coin to justify the job',
        synopsis: '{protagonist} has to talk {antagonist} out of a fight that makes increasingly less financial sense the longer they argue about it.',
      },
      {
        protagonist: 'a reluctant chosen one who would really rather someone else save the kingdom this time',
        antagonist: 'a prophecy that refuses to consider any other candidate',
        synopsis: '{protagonist} spends the whole quest trying to hand the sword off to literally anyone else.',
      },
      {
        protagonist: "a goblin accountant trying to balance the kingdom's increasingly absurd war budget",
        antagonist: 'a king who keeps declaring wars without checking with him first',
        synopsis: '{protagonist} has to find funding for the latest crusade declared by {antagonist}, using nothing but creative bookkeeping and pure dread.',
      },
      {
        protagonist: 'a fairy godmother running dangerously low on actual magic this season',
        antagonist: 'a client list that has no idea how thin the magic has gotten',
        synopsis: '{protagonist} has to fake one more happily-ever-after before anyone notices the wand is basically empty.',
      },
    ],
  },
  Thriller: {
    straight: [
      {
        protagonist: 'a journalist who stumbles onto a story someone will kill to bury',
        antagonist: 'the people making sure it stays buried',
        synopsis: '{protagonist} has forty-eight hours to get the story out before {antagonist} makes sure she never does.',
      },
      {
        protagonist: "a defense attorney who realizes her own client is innocent - and someone else isn't",
        antagonist: 'whoever set the real killer free',
        synopsis: '{protagonist} has to expose {antagonist} before the wrong person pays for it.',
      },
      {
        protagonist: "an insurance investigator who finds a claim that doesn't add up",
        antagonist: 'the person who built it to survive exactly this kind of scrutiny',
        synopsis: '{protagonist} pulls one thread and realizes {antagonist} has been three steps ahead the entire time.',
      },
      {
        protagonist: 'a witness relocated under a new identity that is starting to fall apart',
        antagonist: "the people who have been looking for her the whole time",
        synopsis: '{protagonist} has to figure out how {antagonist} found her before they finish the job.',
      },
      {
        protagonist: 'a detective closing in on a killer who knows exactly how the investigation works',
        antagonist: "a suspect who is always one step ahead of the case file",
        synopsis: "{protagonist} starts to realize {antagonist} isn't reacting to the investigation - he's running it.",
      },
      {
        protagonist: 'an analyst who finds a pattern in the data no one else was supposed to notice',
        antagonist: 'someone erasing it as fast as she finds it',
        synopsis: '{protagonist} has to prove what {antagonist} is hiding, before the evidence disappears for good.',
      },
      {
        protagonist: 'a hostage negotiator working the one case where the hostage-taker keeps asking for her by name',
        antagonist: 'someone from her own past she never expected to hear from again',
        synopsis: '{protagonist} has to figure out what {antagonist} actually wants before the negotiation runs out of time.',
      },
      {
        protagonist: 'a bank auditor who finds a decades-old account that was never supposed to be found',
        antagonist: 'the people who have kept it hidden for exactly that long',
        synopsis: '{protagonist} pulls one thread and realizes {antagonist} will do anything to keep it buried.',
      },
      {
        protagonist: "a former intelligence officer pulled back in for one debrief that isn't what it claims to be",
        antagonist: 'her own agency, for reasons no one will explain,',
        synopsis: '{protagonist} has to figure out why {antagonist} wants her back before she becomes the next loose end.',
      },
    ],
    romance: [
      {
        protagonist: "an art dealer who falls for the man buying up her gallery's most suspicious inventory",
        antagonist: null,
        synopsis: '{protagonist} has to decide whether to trust him before she finds out exactly what he is really collecting.',
      },
      {
        protagonist: 'a bodyguard assigned to protect the one client she swore she would never work for again',
        antagonist: null,
        synopsis: '{protagonist} has to keep him alive without letting old feelings compromise the job.',
      },
      {
        protagonist: 'a woman who starts falling for the detective investigating her missing husband',
        antagonist: null,
        synopsis: '{protagonist} has to decide how much of what she is feeling is real, and how much is exactly what someone wants her to feel.',
      },
      {
        protagonist: 'an interpreter falling for a diplomat she is increasingly sure is passing secrets through her translations',
        antagonist: null,
        synopsis: '{protagonist} has to decide whether to expose him before she becomes complicit in whatever he is really doing.',
      },
      {
        protagonist: 'a witness protection handler who breaks every rule falling for the witness she is assigned to relocate',
        antagonist: null,
        synopsis: '{protagonist} has to get them both out safely before the attraction gets either of them killed.',
      },
    ],
    action: [
      {
        protagonist: 'an off-duty federal agent who stumbles into a bank robbery mid-negotiation',
        antagonist: 'a crew that planned around every contingency except her',
        synopsis: '{protagonist} has to improvise a way out before {antagonist} realizes the plan just changed.',
      },
      {
        protagonist: 'a courier for a black-market data broker who decides to read the files for once',
        antagonist: 'the buyer who paid to make sure nobody ever did',
        synopsis: '{protagonist} has to outrun {antagonist} across three countries before the delivery deadline arrives without her.',
      },
      {
        protagonist: 'a retired operative pulled back in when her old cover identity resurfaces in someone else\'s crime scene',
        antagonist: 'whoever is using her old life as a weapon against her new one',
        synopsis: '{protagonist} has to hunt down {antagonist} before her past finishes destroying the life she built to escape it.',
      },
      {
        protagonist: 'a cargo pilot who realizes mid-flight that her plane is carrying something other than what the manifest says',
        antagonist: "the buyers waiting at the other end who won't take kindly to questions",
        synopsis: '{protagonist} has one flight left to decide whether to deliver the cargo or expose {antagonist} instead.',
      },
      {
        protagonist: 'a private security contractor guarding a whistleblower everyone wants silenced',
        antagonist: 'the operatives sent to make sure that testimony never happens',
        synopsis: '{protagonist} has one night to get the whistleblower to safety before {antagonist} runs out of patience.',
      },
    ],
  },
};

// --- Expanded 'straight' pools (script-generation variety, rec #2) --------
// Additional genre 'straight' log-lines, folded into PREMISE_BANKS below so
// each genre's default pool is ~25 deep rather than 9. Most generated scripts
// fall back to 'straight' (an 'Original' story type, or a flavor tone with no
// authored bucket), so this is the single biggest lever on how often the same
// synopsis is seen. Kept separate from the literal above purely so this one
// change reads as one block; the generator sees a single merged pool.
const ADDITIONAL_STRAIGHT: Record<Genre, Premise[]> = {
  Action: [
    { protagonist: 'a stubborn small-town sheriff', antagonist: 'a cartel convoy that just rolled into her county', synopsis: '{protagonist} is the only thing standing between {antagonist} and a clean getaway across the border.' },
    { protagonist: 'a getaway driver double-crossed after the score', antagonist: 'the crew that left him holding the blame', synopsis: '{protagonist} has one tank of gas and a long night to settle up with {antagonist}.' },
    { protagonist: 'an armored-truck guard who survives a rigged inside job', antagonist: 'the men on his own crew who set him up to die', synopsis: '{protagonist} walks away from the wreck with a target on his back and every reason to hunt {antagonist} down.' },
    { protagonist: 'a decorated soldier framed for a massacre he tried to stop', antagonist: 'the commander who gave the order', synopsis: '{protagonist} breaks custody to drag the truth about {antagonist} into the light.' },
    { protagonist: 'a bounty hunter escorting a prisoner across hostile country', antagonist: 'everyone who wants that prisoner dead before he can talk', synopsis: '{protagonist} has three hundred miles and no allies to keep her bounty breathing past {antagonist}.' },
    { protagonist: 'a dockworker who sees the wrong crate come off the wrong ship', antagonist: 'the smuggling syndicate that owns the waterfront', synopsis: '{protagonist} becomes the loose end {antagonist} will burn down half the harbor to tie off.' },
    { protagonist: 'a burned-out prison guard caught in a coordinated breakout', antagonist: 'the crew that planned the riot as cover', synopsis: '{protagonist} is locked inside with the inmates and one shot at stopping {antagonist} before the walls come down.' },
    { protagonist: 'a helicopter pilot forced to fly a job at gunpoint', antagonist: 'the hijackers holding her passengers', synopsis: '{protagonist} has to outfly {antagonist} without putting a single life on board into the ground.' },
    { protagonist: 'a washed-up prizefighter pulled back in to work as muscle', antagonist: 'the crime family that owns his debts', synopsis: '{protagonist} takes one last job for {antagonist} and finds out too late what it really costs.' },
    { protagonist: 'a demolitions expert blackmailed into rigging a building', antagonist: 'the crew who kidnapped his daughter to guarantee it', synopsis: '{protagonist} plays along just long enough to turn the charge back on {antagonist}.' },
    { protagonist: 'a park ranger deep in the backcountry', antagonist: 'a poaching outfit that turns out to be running something far worse', synopsis: '{protagonist} knows the mountain better than {antagonist} - and she is about to make them regret coming up it.' },
    { protagonist: 'a night-shift paramedic who picks up the wrong patient', antagonist: 'the hitmen who need that patient to never reach a hospital', synopsis: '{protagonist} keeps a dying stranger alive across a city while {antagonist} closes every road out.' },
    { protagonist: 'a train conductor on a packed overnight express', antagonist: 'the armed crew that seizes the front cars', synopsis: '{protagonist} works his way car by car to take back the train from {antagonist} before it reaches the end of the line.' },
    { protagonist: 'a retired stuntman hired for a shoot that turns out to be a front', antagonist: 'the fixers using the production to launder a war', synopsis: '{protagonist} realizes the blanks are real and goes off-script to bring {antagonist} down.' },
    { protagonist: 'a disgraced bodyguard given one chance at redemption', antagonist: 'the assassins hired to reach the client he swore to protect', synopsis: '{protagonist} stands between a marked man and {antagonist}, and this time he does not intend to fail.' },
    { protagonist: 'a lone customs officer at a remote crossing', antagonist: 'a trafficking ring that wants the border to stay a blind spot', synopsis: '{protagonist} refuses the payoff and turns one checkpoint into the last thing standing against {antagonist}.' },
  ],
  Comedy: [
    { protagonist: 'two mismatched coworkers who accidentally get promoted over their boss', antagonist: null, synopsis: '{protagonist} have to run a department neither of them understands before anyone notices they have no idea what they are doing.' },
    { protagonist: 'a control-freak older sister planning the wedding of the decade', antagonist: null, synopsis: "{protagonist} watches her perfect plans unravel one catastrophe at a time - and slowly realizes she is the catastrophe." },
    { protagonist: 'a small-time con artist who fakes his way into a corporate retreat', antagonist: null, synopsis: '{protagonist} just has to keep the act going for one weekend, which is one weekend longer than he has ever managed.' },
    { protagonist: 'a burned-out food critic forced to run the failing diner he once destroyed', antagonist: null, synopsis: '{protagonist} has ninety days to save the place, and no idea how to do anything but complain about it.' },
    { protagonist: 'a rideshare driver who picks up three strangers with one very bad plan', antagonist: null, synopsis: '{protagonist} agrees to one quick detour and spends all night trying to get out of it.' },
    { protagonist: 'a substitute teacher hiding from the mob in a high school', antagonist: null, synopsis: '{protagonist} has to survive a semester of teenagers, which turns out to be far more dangerous than the people chasing him.' },
    { protagonist: 'a hopeless romantic who accidentally RSVPs to the wrong wedding', antagonist: null, synopsis: '{protagonist} decides to just go with it, and the lie snowballs into the best week of her life.' },
    { protagonist: 'two rival food-truck owners forced to share one parking spot', antagonist: null, synopsis: '{protagonist} declare all-out war over a stretch of curb, and lose their minds long before either loses the corner.' },
    { protagonist: 'an anxious new dad who lies about knowing how to do literally anything', antagonist: null, synopsis: '{protagonist} keeps digging the hole deeper until the whole neighborhood is somehow depending on skills he does not have.' },
    { protagonist: 'a demoted executive exiled to the worst office in the company', antagonist: null, synopsis: '{protagonist} sets out to prove everyone wrong and instead becomes the disaster the whole floor rallies around.' },
    { protagonist: 'a middle child who volunteers to host the family reunion to look responsible', antagonist: null, synopsis: '{protagonist} has one weekend to fake having his life together in front of everyone who knows he does not.' },
    { protagonist: 'a wedding band that gets double-booked for two weddings at once', antagonist: null, synopsis: '{protagonist} sprint between two receptions across town, certain nobody will notice, which is where they are wrong.' },
    { protagonist: 'a self-help guru who has never actually helped anyone', antagonist: null, synopsis: '{protagonist} takes on one impossible client and has to become the person he has only ever pretended to be.' },
    { protagonist: 'a house-sitter who throws one small party that gets slightly out of hand', antagonist: null, synopsis: "{protagonist} has until the owners' flight lands to put a mansion back together, and the party is not over yet." },
    { protagonist: 'a bumbling city inspector sent to shut down a beloved neighborhood institution', antagonist: null, synopsis: '{protagonist} arrives to condemn the place and ends up its most hopeless, devoted defender.' },
    { protagonist: 'a lifelong pessimist who wins a trip he is convinced is a scam', antagonist: null, synopsis: '{protagonist} spends the whole vacation waiting for the catch and nearly misses the best thing that ever happened to him.' },
  ],
  Drama: [
    { protagonist: 'three estranged siblings summoned home to sell their late mother\'s house', antagonist: null, synopsis: '{protagonist} have one week under one roof to divide an inheritance and everything they never said to each other.' },
    { protagonist: 'a factory town doctor who stays long after the work leaves', antagonist: null, synopsis: '{protagonist} keeps a dying community on its feet while quietly running out of reasons to stay.' },
    { protagonist: 'a retired teacher who receives a letter from a student she failed decades ago', antagonist: null, synopsis: '{protagonist} sets out to make one thing right and reopens a chapter she thought she had closed for good.' },
    { protagonist: 'a young carer raising younger siblings after their parents are gone', antagonist: null, synopsis: '{protagonist} holds a family together at the cost of the life she was supposed to be starting.' },
    { protagonist: 'an aging fisherman working a coast the catch has abandoned', antagonist: null, synopsis: '{protagonist} refuses to sell the boat, even as the town and his own family drift out from under him.' },
    { protagonist: 'a translator who begins keeping the secrets she is paid to pass along', antagonist: null, synopsis: '{protagonist} watches other people\'s lives change on her words and finally has to reckon with her own.' },
    { protagonist: 'two old friends who reconnect at the funeral of the third', antagonist: null, synopsis: '{protagonist} spend a single day retracing a friendship, and everything it cost them to let it lapse.' },
    { protagonist: 'a recovering addict working the night desk at a shelter', antagonist: null, synopsis: '{protagonist} tries to save one stranger and finds his own way back through the door in the process.' },
    { protagonist: 'a widowed farmer teaching his grandson the land he can no longer work', antagonist: null, synopsis: '{protagonist} has one last season to pass on everything he knows before the farm changes hands.' },
    { protagonist: 'a concert pianist whose hands are beginning to fail her', antagonist: null, synopsis: '{protagonist} chases one final performance while quietly making peace with the silence coming after it.' },
    { protagonist: 'a social worker assigned the case she is least equipped to survive', antagonist: null, synopsis: '{protagonist} fights for a family the system has already given up on, and nearly loses herself doing it.' },
    { protagonist: 'a middle-aged man who returns to the hometown he swore he had escaped', antagonist: null, synopsis: '{protagonist} comes back to bury his father and stays to face everything he ran from.' },
    { protagonist: 'a night-shift nurse in a ward nobody visits', antagonist: null, synopsis: '{protagonist} becomes the last companion to the forgotten, and finds a family she never expected.' },
    { protagonist: 'a former athlete coaching in the town that once worshipped him', antagonist: null, synopsis: '{protagonist} tries to give one struggling kid what he wasted, and confronts the ruin of his own promise.' },
    { protagonist: 'a woman sorting the belongings of the husband she is not sure she knew', antagonist: null, synopsis: '{protagonist} uncovers a second life in the boxes he left behind and has to decide who she was married to.' },
    { protagonist: 'a young immigrant working three jobs to bring the rest of his family over', antagonist: null, synopsis: '{protagonist} carries the hopes of everyone back home on a life he is barely holding together himself.' },
  ],
  Horror: [
    { protagonist: 'a family that inherits a farmhouse far cheaper than it should be', antagonist: 'whatever the last owners left sealed in the cellar', synopsis: '{protagonist} settle into their new home before {antagonist} makes it clear the price included them.', settings: ['HauntedLocation', 'RuralWilderness'] },
    { protagonist: 'a hospice nurse taking a live-in job at a remote estate', antagonist: 'the thing her dying patient is so terrified of dying alone with', synopsis: '{protagonist} realizes the old woman is not afraid of death - she is afraid of what {antagonist} has been waiting for.' },
    { protagonist: 'a group of urban explorers who break into a shuttered asylum', antagonist: 'the something that has been kept in, not out', synopsis: '{protagonist} film their way deeper inside until {antagonist} makes sure none of them film their way out.', settings: ['HauntedLocation'] },
    { protagonist: 'a new mother alone in a house that will not stay quiet', antagonist: 'the presence that only moves when she looks away', synopsis: "{protagonist} can't convince anyone that {antagonist} is real until it is far too late to run." },
    { protagonist: 'a caretaker wintering over at an isolated lighthouse', antagonist: 'what starts answering the foghorn from the water', synopsis: '{protagonist} keeps the light burning as {antagonist} draws closer with every night the storm traps him there.' },
    { protagonist: 'a sleep researcher studying a patient who refuses to dream', antagonist: 'the thing waiting on the other side of sleep', synopsis: '{protagonist} pushes the experiment too far and lets {antagonist} follow her back out.' },
    { protagonist: 'a delivery driver whose last drop of the night is a house that is not on any map', antagonist: 'the people who live there and were expecting him', synopsis: '{protagonist} takes one wrong turn and spends the night trying to leave a place {antagonist} has no intention of letting him go.' },
    { protagonist: 'a estranged son who returns to care for his ailing father', antagonist: 'whatever his father has been talking to in the empty room upstairs', synopsis: '{protagonist} comes home to make amends and finds {antagonist} has already moved in.' },
    { protagonist: 'a summer-camp counselor at a lake with a long local silence around it', antagonist: 'what the town stopped talking about years ago', synopsis: '{protagonist} learns why nobody swims after dark once {antagonist} starts taking the campers one by one.', settings: ['RuralWilderness', 'SmallTown'] },
    { protagonist: 'a widow who starts hearing her late husband through the baby monitor', antagonist: 'the voice that only sounds like him', synopsis: '{protagonist} follows the voice of the man she lost straight into whatever {antagonist} truly is.' },
    { protagonist: 'a tenant who discovers a door in her apartment that was not there before', antagonist: 'the neighbors who insist it has always been locked', synopsis: '{protagonist} opens it once, and {antagonist} spend the rest of the film making her wish she had not.' },
    { protagonist: 'a documentary crew filming a family with an unusual nightly ritual', antagonist: 'the reason the ritual can never be skipped', synopsis: '{protagonist} keep rolling as {antagonist} shows them exactly what the ritual has been holding back.' },
    { protagonist: 'a diver salvaging a wreck nobody else will touch', antagonist: 'what the crew of that ship became before they went down', synopsis: '{protagonist} goes deeper than she should and lets {antagonist} follow the air line back up.', settings: ['UnderwaterEnvironment'] },
    { protagonist: 'a boy convinced the new house is trying to keep his family inside', antagonist: 'the parents who cannot see what he sees', synopsis: '{protagonist} is the only one who understands {antagonist} until it is nearly too late to matter.', settings: ['HauntedLocation', 'SuburbanCommunity'] },
    { protagonist: 'a paramedic haunted by a patient he could not save', antagonist: 'the dead who have started riding along on his calls', synopsis: '{protagonist} keeps answering the radio as {antagonist} makes every shift another descent.' },
    { protagonist: 'a beekeeper on an isolated farm as her hives begin behaving wrong', antagonist: 'the thing in the far field the bees are answering to', synopsis: '{protagonist} traces the swarm to its source and finds {antagonist} has been waiting for someone to come looking.', settings: ['RuralWilderness'] },
  ],
  Romance: [
    { protagonist: 'two rivals forced to plan their best friends\' wedding together', antagonist: null, synopsis: '{protagonist} spend months at each other\'s throats over seating charts and slowly forget why they were ever enemies.' },
    { protagonist: 'a big-city architect sent to save a small-town bakery from demolition', antagonist: null, synopsis: '{protagonist} arrives to tear the place down and falls for everything - and everyone - she was sent to replace.', settings: ['SmallTown'] },
    { protagonist: 'a widowed single father and the tutor he hires for his daughter', antagonist: null, synopsis: '{protagonist} lets someone back into a house that has been quiet for years, and is not ready for what it opens up.' },
    { protagonist: 'two strangers who keep getting each other\'s mail', antagonist: null, synopsis: '{protagonist} fall for the person on the page long before either works up the nerve to knock.' },
    { protagonist: 'a chef and the food critic who once ruined her', antagonist: null, synopsis: '{protagonist} are thrown together on one impossible project and discover the fight was never really about the food.' },
    { protagonist: 'a wedding photographer who has stopped believing in any of it', antagonist: null, synopsis: '{protagonist} shoots one more ceremony and meets the one person who makes her want to be in front of the camera again.' },
    { protagonist: 'two former sweethearts reunited as reluctant co-workers', antagonist: null, synopsis: '{protagonist} pick up an argument they abandoned a decade ago and find out neither ever finished it.' },
    { protagonist: 'a marine biologist and the fisherman whose livelihood her research threatens', antagonist: null, synopsis: '{protagonist} stand on opposite sides of a dying harbor and fall for each other anyway.', settings: ['SmallTown'] },
    { protagonist: 'a homebody set up on a blind date that goes gloriously, disastrously wrong', antagonist: null, synopsis: '{protagonist} write the night off as a catastrophe and cannot stop thinking about it for weeks.' },
    { protagonist: 'a touring musician and the innkeeper who puts him up for one snowed-in night', antagonist: null, synopsis: '{protagonist} has a bus to catch in the morning and every reason, by dawn, to miss it.' },
    { protagonist: 'two competing florists on the same wedding-season street', antagonist: null, synopsis: '{protagonist} sabotage each other all season and realize far too late they were the perfect match all along.' },
    { protagonist: 'a heartbroken novelist who moves to a coast to disappear', antagonist: null, synopsis: '{protagonist} sets out to be alone and meets the one person who makes solitude feel like a mistake.' },
    { protagonist: 'a pragmatic wedding planner who falls for the groom\'s skeptical brother', antagonist: null, synopsis: '{protagonist} has one wedding to survive without admitting the only person she wants is standing beside the aisle.' },
    { protagonist: 'a nurse and the patient she is not supposed to get attached to', antagonist: null, synopsis: '{protagonist} breaks every rule she has ever kept for a chance that might not last past the ward.' },
    { protagonist: 'two people who agree to be each other\'s fake date for one family event', antagonist: null, synopsis: '{protagonist} rehearse a relationship so convincingly that they forget which parts were pretend.' },
    { protagonist: 'a returning soldier and the pen pal who wrote to him through the worst of it', antagonist: null, synopsis: '{protagonist} finally meet in person and have to see whether the letters told the whole truth.' },
  ],
  'Sci-Fi': [
    { protagonist: 'a maintenance tech on a derelict deep-space relay', antagonist: 'the signal that has started answering back', synopsis: '{protagonist} is the only crew left awake when {antagonist} decides the station has been quiet long enough.', settings: ['SpacecraftOrStation'] },
    { protagonist: 'a memory technician who edits trauma out of paying clients', antagonist: 'the memory that refuses to be deleted', synopsis: '{protagonist} takes on one impossible case and finds {antagonist} rewriting her instead.', settings: ['FuturisticCity'] },
    { protagonist: 'the last botanist on a dying colony ship', antagonist: 'a captain who would rather ration hope than grow it', synopsis: '{protagonist} keeps one garden alive against {antagonist} because it is the only future left aboard.', settings: ['SpacecraftOrStation'] },
    { protagonist: 'a courier smuggling data across a partitioned megacity', antagonist: 'the corporation that owns everyone the data would expose', synopsis: '{protagonist} has one night to deliver the truth before {antagonist} erases the city\'s memory of it.', settings: ['FuturisticCity'] },
    { protagonist: 'a xenolinguist first to reach a silent alien structure', antagonist: 'the militaries racing to weaponize it before it can be understood', synopsis: '{protagonist} tries to make first contact while {antagonist} prepares to make it the last.', settings: ['AlienWorld'] },
    { protagonist: 'a terraforming engineer on a world that is starting to push back', antagonist: 'the company deadline that will get everyone killed to meet it', synopsis: '{protagonist} realizes the planet is alive and has to stop {antagonist} before it wakes all the way up.', settings: ['AlienWorld'] },
    { protagonist: 'a synthetic caretaker who begins to suspect she is more than her programming', antagonist: 'the makers who will recall her the moment they find out', synopsis: '{protagonist} has to decide what she is before {antagonist} decides it for her.' },
    { protagonist: 'a salvage crew that boards a ship missing for forty years', antagonist: 'whatever kept the crew from ever calling for help', synopsis: '{protagonist} strip the wreck for parts until {antagonist} makes it clear the ship was never actually empty.', settings: ['SpacecraftOrStation'] },
    { protagonist: 'a scientist who wakes each morning one day further out of sync with the world', antagonist: 'the experiment that came loose inside her own timeline', synopsis: '{protagonist} races to undo {antagonist} before she drifts somewhere no one can follow.' },
    { protagonist: 'a rig worker on a mining platform above a gas giant', antagonist: 'the thing the drills brought up from below the clouds', synopsis: '{protagonist} and a skeleton crew fight to survive {antagonist} with a rescue days that might as well be years away.', settings: ['SpacecraftOrStation'] },
    { protagonist: 'a border agent at a checkpoint between two versions of the same city', antagonist: 'the people crossing over who are not supposed to exist', synopsis: '{protagonist} lets one traveler through and unravels the wall {antagonist} depends on.', settings: ['FuturisticCity'] },
    { protagonist: 'a pilot ferrying refugees off a drowning coastal world', antagonist: 'the blockade deciding who is worth saving', synopsis: '{protagonist} makes one last run past {antagonist} with more lives aboard than the ship was built to hold.' },
    { protagonist: 'an archivist guarding the last uncensored record of history', antagonist: 'the regime rewriting everything the archive contradicts', synopsis: '{protagonist} has to get the truth out of the vault before {antagonist} makes it never have happened.' },
    { protagonist: 'a deep-sea researcher in a habitat beneath a frozen ocean', antagonist: 'the intelligence moving in the dark water outside the glass', synopsis: '{protagonist} tries to communicate with {antagonist} before her own crew provokes it past the point of no return.', settings: ['UnderwaterEnvironment'] },
    { protagonist: 'a technician who discovers her whole settlement is a controlled experiment', antagonist: 'the observers who will reset everything if she tells anyone', synopsis: '{protagonist} has to wake her neighbors up before {antagonist} starts the world over.' },
    { protagonist: 'a stranded surveyor waiting out a storm on an unmapped moon', antagonist: 'the local life that has decided she is the anomaly', synopsis: '{protagonist} has to last until the skies clear while {antagonist} learns faster than she can hide.', settings: ['AlienWorld'] },
  ],
  Fantasy: [
    { protagonist: 'a village blacksmith who pulls a cursed blade from the river', antagonist: 'the old power that has been waiting centuries for a hand to hold it', synopsis: '{protagonist} takes up a weapon that wants a wielder, and {antagonist} intends to make sure it never lets go.', settings: ['MedievalKingdom', 'FantasyRealm'] },
    { protagonist: 'a reluctant map-maker who charts a road that should not exist', antagonist: 'whatever the road was built to keep people from reaching', synopsis: '{protagonist} follows her own map to its end and finds {antagonist} has been expecting a cartographer.', settings: ['FantasyRealm'] },
    { protagonist: 'the youngest of three heirs, raised to be forgotten', antagonist: 'the sibling who will burn the realm to keep the throne', synopsis: '{protagonist} is the only claim left standing between the kingdom and {antagonist}.', settings: ['MedievalKingdom'] },
    { protagonist: 'a hedge-witch hiding her gift in a town that hangs its kind', antagonist: 'the witch-finder who has finally come to her door', synopsis: '{protagonist} must choose between staying hidden and facing {antagonist} to save the neighbors who would turn on her.', settings: ['MedievalKingdom', 'HistoricalCity'] },
    { protagonist: 'a stable boy who understands the language of the last living dragon', antagonist: 'the court that wants the dragon as a weapon', synopsis: '{protagonist} has to free his impossible friend before {antagonist} turns it into the end of everything.', settings: ['MedievalKingdom', 'FantasyRealm'] },
    { protagonist: 'a ferryman who carries souls across a river between worlds', antagonist: 'the passenger who refuses to stay on the far shore', synopsis: '{protagonist} breaks his one rule for {antagonist} and unbalances the crossing for everyone.', settings: ['FantasyRealm'] },
    { protagonist: 'a disgraced knight guarding a child who is more than she seems', antagonist: 'the order that once trusted him, now hunting them both', synopsis: '{protagonist} takes his last charge across a hostile realm with {antagonist} closing on every road.', settings: ['MedievalKingdom'] },
    { protagonist: 'a clockmaker\'s apprentice who repairs a device that stops time', antagonist: 'the guild that will kill to own it', synopsis: '{protagonist} holds a frozen moment in her hands while {antagonist} tears the city apart to take it.', settings: ['HistoricalCity'] },
    { protagonist: 'a bard who learns the song he inherited is a spell half-finished', antagonist: 'the thing the song was written to bind', synopsis: '{protagonist} has to complete a melody a hundred years overdue before {antagonist} finishes breaking free.', settings: ['FantasyRealm', 'MedievalKingdom'] },
    { protagonist: 'a healer bound by oath to save even the enemy at her table', antagonist: 'the warlord she could end with a single wrong tincture', synopsis: '{protagonist} must decide what her oath is worth with {antagonist} recovering under her own roof.', settings: ['MedievalKingdom'] },
    { protagonist: 'twin thieves who steal the wrong relic from the wrong temple', antagonist: 'the god whose sleep they just interrupted', synopsis: '{protagonist} have to return what they took before {antagonist} wakes the rest of the way to collect it.', settings: ['FantasyRealm'] },
    { protagonist: 'a lamplighter in a city where the dark is genuinely alive', antagonist: 'the shadow spreading faster than the lamps can hold it', synopsis: '{protagonist} keeps the last streets burning while {antagonist} swallows the ones behind him.', settings: ['HistoricalCity', 'FantasyRealm'] },
    { protagonist: 'a queen\'s food-taster who can see the poison others cannot', antagonist: 'the court conspiracy she is the only one positioned to expose', synopsis: '{protagonist} risks every meal to unmask {antagonist} before the crown falls.', settings: ['MedievalKingdom'] },
    { protagonist: 'a shepherd whose flock leads him to a door in the hillside', antagonist: 'the bargain the folk on the other side are eager to strike', synopsis: '{protagonist} steps through once and spends the tale trying to undo what he promised {antagonist}.', settings: ['FantasyRealm', 'RuralWilderness'] },
    { protagonist: 'an exiled prince disguised as a common soldier', antagonist: 'the usurper wearing his family\'s crown', synopsis: '{protagonist} rises through the ranks of his own stolen army to reach {antagonist}.', settings: ['MedievalKingdom', 'HistoricalBattlefield'] },
    { protagonist: 'a girl who trades her name to a spirit for a single wish', antagonist: 'the spirit that intends to keep far more than the name', synopsis: '{protagonist} has to win back everything she is before {antagonist} finishes collecting it.', settings: ['FantasyRealm'] },
  ],
  Thriller: [
    { protagonist: 'a defense attorney who realizes her client is innocent - and being framed by someone powerful', antagonist: 'the people who need this verdict to go their way', synopsis: '{protagonist} has one trial to expose {antagonist} before an innocent man goes down for them.' },
    { protagonist: 'an air-traffic controller who receives a threat only she can hear', antagonist: 'the caller holding a plane full of strangers hostage from the ground', synopsis: '{protagonist} has to keep {antagonist} talking and a jet in the air without anyone in the tower knowing why.' },
    { protagonist: 'a forensic accountant who finds one number that should not exist', antagonist: 'the firm that will bury her with the money she uncovered', synopsis: '{protagonist} follows the thread until {antagonist} realizes she has pulled it far enough to hang them.' },
    { protagonist: 'a hotel night manager who checks in a guest travelling under a dead man\'s name', antagonist: 'the people hunting whoever is wearing it', synopsis: '{protagonist} gets pulled into a manhunt across one long night while {antagonist} closes in floor by floor.', settings: ['SingleInteriorLocation'] },
    { protagonist: 'a witness relocated to a town that turns out to be watching her back', antagonist: 'the handler she is no longer sure she can trust', synopsis: '{protagonist} realizes her new life is a cage and {antagonist} holds the only key.', settings: ['SmallTown'] },
    { protagonist: 'a translator who overhears a plot inside a diplomatic summit', antagonist: 'the delegation that knows she heard it', synopsis: '{protagonist} has to reach someone she can trust before {antagonist} makes sure she never repeats a word.', settings: ['GlobalMultiLocation'] },
    { protagonist: 'a rideshare passenger who realizes the driver is not taking her home', antagonist: 'the man behind the wheel and whoever hired him', synopsis: '{protagonist} has the length of a wrong route to outthink {antagonist} and get out alive.' },
    { protagonist: 'a data analyst who predicts a crime the police refuse to believe is coming', antagonist: 'the killer whose pattern only she can see', synopsis: '{protagonist} races her own forecast to stop {antagonist} before the next name on the list is real.' },
    { protagonist: 'a locksmith blackmailed into one perfect break-in', antagonist: 'the client who never intended to let him walk away after', synopsis: '{protagonist} has to out-plan {antagonist} from inside the very job they forced on him.' },
    { protagonist: 'a small-town journalist reopening a case everyone wants left closed', antagonist: 'the people who made sure it closed the first time', synopsis: '{protagonist} keeps digging as {antagonist} makes it clearer every day what happens to people who dig.', settings: ['SmallTown'] },
    { protagonist: 'a body-double for a public figure who witnesses the attempt meant for the real one', antagonist: 'the conspiracy that would rather the wrong person had died', synopsis: '{protagonist} has to survive being mistaken for a target while unmasking {antagonist}.' },
    { protagonist: 'a security guard reviewing footage that shows something that never happened', antagonist: 'whoever went to the trouble of editing him out of it', synopsis: '{protagonist} pulls at the tape until {antagonist} decides he has seen the version he was not meant to.', settings: ['SingleInteriorLocation'] },
    { protagonist: 'a nurse who suspects a beloved colleague is quietly killing patients', antagonist: 'the doctor no one will hear a word against', synopsis: '{protagonist} has to prove what she knows about {antagonist} before she becomes the story that discredits it.', settings: ['SingleInteriorLocation'] },
    { protagonist: 'an insurance investigator whose routine claim keeps not adding up', antagonist: 'the family that staged far more than a fire', synopsis: '{protagonist} unravels {antagonist} one inconsistency at a time, right up until they notice her doing it.' },
    { protagonist: 'a marathon of a man trying to get home during a citywide blackout', antagonist: 'the people who arranged the dark to reach him in it', synopsis: '{protagonist} crosses a lightless city one block at a time while {antagonist} hunts him through it.', settings: ['ContemporaryCity'] },
    { protagonist: 'a therapist whose new patient describes a murder that has not happened yet', antagonist: 'the patient she cannot tell whether to save or stop', synopsis: '{protagonist} has to decide what {antagonist} really is before the session becomes a confession.' },
  ],
};

for (const genre of Object.keys(ADDITIONAL_STRAIGHT) as Genre[]) {
  PREMISE_BANKS[genre].straight = [...(PREMISE_BANKS[genre].straight ?? []), ...ADDITIONAL_STRAIGHT[genre]];
}

// --- Story-type log-lines (script-generation variety, rec #2) -------------
// Keyed by Story Type rather than genre. A specific hook (a Heist, a Sports
// story, a Biography) is the strongest concept signal a script carries, so
// when a generated script has one, its synopsis is drawn from here instead of
// the genre pool (engine/premiseGenerator.ts:selectPool) - a heist reads like
// a heist whatever genre it sits in. Written to stay genre-neutral for that
// reason. 'Original' (the common case) has no entry and falls through to the
// genre/tone banks above. Setting tags nudge selection the same way.
export const STORY_TYPE_PREMISES: Partial<Record<StoryType, Premise[]>> = {
  Heist: [
    { protagonist: 'a retired thief assembling one last crew for an impossible score', antagonist: 'the former partner who now runs security for the target', synopsis: '{protagonist} has to get in, get out, and get past {antagonist} - the one person who knows exactly how she works.' },
    { protagonist: 'a card counter recruited to rob the casino that banned him', antagonist: 'the house that never loses and never forgets', synopsis: '{protagonist} plans the perfect night against {antagonist}, where a single tell ends everything.' },
    { protagonist: 'a demolitions specialist pulled into a vault job that is too clean to be real', antagonist: 'the mastermind using the whole crew as a distraction', synopsis: '{protagonist} realizes mid-heist that {antagonist} is stealing something else entirely, and they are the cover.' },
    { protagonist: 'a museum curator blackmailed into helping steal her own exhibit', antagonist: 'the collector who owns her secret', synopsis: '{protagonist} plays the inside woman for {antagonist} while quietly planning to rob the robbers.' },
    { protagonist: 'a getaway crew whose flawless plan survives everything but each other', antagonist: 'the split nobody can agree on once the money is real', synopsis: '{protagonist} pull off the score and spend the rest of the night surviving {antagonist}.' },
  ],
  Crime: [
    { protagonist: 'a low-level driver climbing fast through a crumbling crime family', antagonist: 'the boss who mistakes ambition for loyalty', synopsis: '{protagonist} rises through the ranks until the only way up runs straight through {antagonist}.' },
    { protagonist: 'a detective and the informant she cannot afford to trust or lose', antagonist: 'the organization they are both trying to survive', synopsis: '{protagonist} works an impossible case from the inside while {antagonist} tightens the net on them both.' },
    { protagonist: 'two brothers on opposite sides of the same investigation', antagonist: 'the empire that made one and is hunted by the other', synopsis: '{protagonist} are pulled toward a reckoning neither wants as {antagonist} forces the choice.' },
    { protagonist: 'a fixer who cleans up after the city\'s worst, until one job he cannot bury', antagonist: 'the client whose mess is finally too big to hide', synopsis: '{protagonist} has to decide whether to protect {antagonist} or finally save himself.', settings: ['ContemporaryCity'] },
    { protagonist: 'a shopkeeper who refuses to pay the neighborhood\'s protection', antagonist: 'the crew that runs the block', synopsis: '{protagonist} draws a line on his own doorstep and turns one storefront into a stand against {antagonist}.' },
  ],
  Mystery: [
    { protagonist: 'a detective called to a locked-room death that has no possible solution', antagonist: 'the killer hiding in plain sight among the guests', synopsis: '{protagonist} has to reason out how {antagonist} did the impossible before they do it again.', settings: ['SingleInteriorLocation'] },
    { protagonist: 'a journalist reinvestigating a disappearance the town buried', antagonist: 'the neighbors who all agreed on the same lie', synopsis: '{protagonist} pulls one loose thread until {antagonist} realizes the whole story is unraveling.', settings: ['SmallTown'] },
    { protagonist: 'an insurance investigator working a death that pays out a little too neatly', antagonist: 'the survivor whose grief is just slightly rehearsed', synopsis: '{protagonist} circles {antagonist} one inconsistency at a time toward the truth of what happened.' },
    { protagonist: 'a retired inspector dragged back for one final unsolved case', antagonist: 'the suspect who got away the first time', synopsis: '{protagonist} reopens the wound of the one that beat her to finally corner {antagonist}.' },
    { protagonist: 'a stranger who wakes with no memory in a town expecting someone', antagonist: 'the past that is catching up faster than the answers', synopsis: '{protagonist} races to learn who he is before {antagonist} decides for him.' },
  ],
  Sports: [
    { protagonist: 'a washed-up coach handed the worst team in the league', antagonist: 'the front office that wants them to lose', synopsis: '{protagonist} turns a roster of castoffs into a threat nobody - least of all {antagonist} - saw coming.' },
    { protagonist: 'an aging champion facing the young rival who idolized him', antagonist: 'the successor who fights exactly like he used to', synopsis: '{protagonist} has one more title run to prove he is more than the shadow {antagonist} is chasing.' },
    { protagonist: 'an underdog from nowhere who talks their way onto the roster', antagonist: 'the star who will not share the spotlight', synopsis: '{protagonist} earns a shot at the big time and has to survive {antagonist} to keep it.' },
    { protagonist: 'a disgraced athlete attempting an impossible comeback', antagonist: 'the doubt of everyone who watched her fall', synopsis: '{protagonist} trains in secret for one last shot at silencing {antagonist} for good.' },
    { protagonist: 'a scrappy team from a forgotten town chasing a title nobody thinks they can win', antagonist: 'the dynasty that has owned the trophy for a generation', synopsis: '{protagonist} carry a whole community\'s hopes into a run at dethroning {antagonist}.', settings: ['SmallTown'] },
  ],
  Biography: [
    { protagonist: 'a self-taught genius who changes a field that will not have her', antagonist: 'the establishment determined to write her out of it', synopsis: '{protagonist} fights for the credit and the future she earned against {antagonist}.' },
    { protagonist: 'a small-time performer clawing toward the fame that will nearly destroy them', antagonist: 'the price of everything they gave up to get there', synopsis: '{protagonist} rises higher than anyone expected and pays {antagonist} in full.' },
    { protagonist: 'an unlikely leader who rises from nothing to the center of a movement', antagonist: 'the powers that need the movement to fail', synopsis: '{protagonist} carries a cause further than anyone thought possible, with {antagonist} closing in at every step.' },
    { protagonist: 'a pioneer who spends a life chasing one impossible achievement', antagonist: 'the doubters and the years running out', synopsis: '{protagonist} gives everything for a single dream while {antagonist} insists it cannot be done.' },
    { protagonist: 'two rivals whose decades-long feud reshapes an entire industry', antagonist: 'each other, at the height of their powers', synopsis: '{protagonist} push one another to greatness and ruin, unable to stop until {antagonist} is beaten.' },
  ],
  War: [
    { protagonist: 'a green lieutenant handed a squad that has already given up', antagonist: 'an objective command has written them off to take', synopsis: '{protagonist} has to lead men who expect to die into {antagonist} and bring some of them home.', settings: ['HistoricalBattlefield', 'ModernWarzone'] },
    { protagonist: 'a medic trying to keep his humanity in a war determined to take it', antagonist: 'the orders that treat the wounded as arithmetic', synopsis: '{protagonist} saves who he can while {antagonist} keeps redrawing the line he refuses to cross.', settings: ['HistoricalBattlefield', 'ModernWarzone'] },
    { protagonist: 'a translator caught between the army she serves and the people she is from', antagonist: 'a mission that will force her to choose', synopsis: '{protagonist} carries both sides of a war inside her as {antagonist} makes neutrality impossible.', settings: ['ModernWarzone'] },
    { protagonist: 'a small unit cut off far behind enemy lines', antagonist: 'the long way back through everything that wants them dead', synopsis: '{protagonist} have only each other for the impossible walk home past {antagonist}.', settings: ['HistoricalBattlefield', 'ModernWarzone'] },
    { protagonist: 'a resistance courier smuggling people out of an occupied city', antagonist: 'the occupier tightening the net street by street', synopsis: '{protagonist} runs one more group past {antagonist} knowing the next checkpoint could be the last.', settings: ['HistoricalCity'] },
  ],
  Superhero: [
    { protagonist: 'a reluctant newcomer who inherits a power he never wanted', antagonist: 'the villain who understands that power better than he does', synopsis: '{protagonist} has to become what the city needs before {antagonist} shows it what the power can really do.', settings: ['ContemporaryCity', 'FuturisticCity'] },
    { protagonist: 'a retired hero pulled back for a threat only she can answer', antagonist: 'an old enemy who has been waiting for exactly this', synopsis: '{protagonist} puts the mask back on one last time to stop {antagonist}.', settings: ['ContemporaryCity'] },
    { protagonist: 'two rival protectors forced to share one city', antagonist: 'the enemy playing them against each other', synopsis: '{protagonist} have to trust each other before {antagonist} uses their feud to burn everything down.', settings: ['ContemporaryCity', 'FuturisticCity'] },
    { protagonist: 'a hero whose greatest mistake comes back wearing a cape', antagonist: 'the protege they failed, now their darkest reflection', synopsis: '{protagonist} has to answer for the past as {antagonist} turns it into a weapon.' },
    { protagonist: 'an ordinary person who is the only one immune to a villain\'s control', antagonist: 'the mastermind who owns everyone else in the city', synopsis: '{protagonist} becomes the last free will standing between a captive city and {antagonist}.', settings: ['FuturisticCity', 'ContemporaryCity'] },
  ],
  Musical: [
    { protagonist: 'a small-town singer who bets everything on one shot at the big stage', antagonist: 'the industry that chews up voices like hers', synopsis: '{protagonist} chases the spotlight and learns what {antagonist} really charges for it.' },
    { protagonist: 'two performers who fall in love while competing for the same part', antagonist: 'the ambition neither is willing to give up', synopsis: '{protagonist} have to choose between the duet and the solo as {antagonist} pulls them apart.' },
    { protagonist: 'a burned-out music teacher and the class nobody believed in', antagonist: 'a school ready to cut the program for good', synopsis: '{protagonist} builds one last show to prove {antagonist} wrong before the curtain falls for good.', settings: ['SchoolOrUniversity'] },
    { protagonist: 'a street musician discovered on the worst night of his life', antagonist: 'the fame that arrives faster than he can handle it', synopsis: '{protagonist} rides a sudden rise toward a reckoning with {antagonist}.' },
    { protagonist: 'a fading star and the young talent hired to replace her', antagonist: 'time, and an audience that has already moved on', synopsis: '{protagonist} passes the stage to a successor while making one last peace with {antagonist}.' },
  ],
  ComingOfAge: [
    { protagonist: 'a teenager spending one last summer with friends before everything scatters', antagonist: null, synopsis: '{protagonist} chases a perfect final season, knowing none of them will be the same by the time it ends.', settings: ['SmallTown', 'SuburbanCommunity'] },
    { protagonist: 'a quiet outsider who falls in with the wrong, wonderful crowd', antagonist: null, synopsis: '{protagonist} finally finds where she belongs, right as it threatens to cost her everything she was.' },
    { protagonist: 'a kid sent to spend the summer with a relative he barely knows', antagonist: null, synopsis: '{protagonist} arrives a stranger and leaves someone new, changed by a season he never wanted.' },
    { protagonist: 'a graduate paralyzed on the edge of a future everyone else has planned', antagonist: null, synopsis: '{protagonist} has one summer to figure out whose life she is actually about to start living.', settings: ['SchoolOrUniversity'] },
    { protagonist: 'two best friends whose friendship is tested by the first real secret between them', antagonist: null, synopsis: '{protagonist} learn the hard way that growing up sometimes means growing apart.' },
  ],
};
