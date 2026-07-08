import type { Genre, Tone } from '../types';

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
