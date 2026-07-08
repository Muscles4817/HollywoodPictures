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
        antagonist: "whatever has been running the station without a crew for years",
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
        synopsis: '{protagonist} has to figure out who {antagonist} is before the next log is hers.',
      },
      {
        protagonist: "a pilot who wakes up to find the rest of the crew missing and the ship's records wiped",
        antagonist: 'whoever or whatever did the wiping',
        synopsis: '{protagonist} has less than a day of oxygen to find out what {antagonist} does not want her to remember.',
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
    ],
  },
};
