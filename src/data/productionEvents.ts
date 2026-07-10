import type { Genre, EventChoiceTemplate } from '../types';

// Templates for randomized production events. The engine picks a handful of
// these per shoot, biased by an overall risk score, then rolls a concrete
// delta within each range. Ranges are intentionally modest so no single
// event can single-handedly sink or save a film.
//
// Buzz is deliberately absent from most templates: something the public
// could never see (a great take in dailies, an internal VFX review, a
// smooth department meeting) has no business moving pre-release hype, no
// matter how good it feels on set. Buzz only shows up on events with an
// actual public angle - a leak, a paparazzi moment, a stunt visible enough
// to make local news, trade-press chatter about a departure or financing
// trouble. See docs/DESIGN.md 5.x for the full reasoning.
//
// `delayDaysRange` is a real, consumed mechanic (see
// engine/production.ts:rollDayEvent and state/studioReducer.ts) - extra
// shoot days this event actually costs, on top of the day it happened on.
// Always >= 0: a positive event happening doesn't retroactively un-shoot a
// day, so only negative-polarity templates carry a nonzero range.
interface SimpleProductionEventTemplate {
  id: string;
  description: string;
  polarity: 'positive' | 'negative';
  interactive?: false;
  costRange: [number, number];
  qualityRange: [number, number];
  buzzRange: [number, number];
  delayDaysRange: [number, number];
}

// An event that pauses photography and hands the player a real decision,
// instead of auto-resolving - see types/index.ts:PendingEventChoice and
// state/studioReducer.ts:RESOLVE_EVENT_CHOICE. Each choice rolls its own
// outcome independently and is free to touch only one resource (see the
// EventChoiceTemplate docs) - there's no base cost/quality/buzz/delay range
// on the template itself, since the player's pick decides which of those
// actually applies, not a shared roll underneath every option.
interface InteractiveProductionEventTemplate {
  id: string;
  situation: string;
  polarity: 'positive' | 'negative';
  interactive: true;
  choices: EventChoiceTemplate[];
}

export type ProductionEventTemplate = SimpleProductionEventTemplate | InteractiveProductionEventTemplate;

export const POSITIVE_EVENT_TEMPLATES: ProductionEventTemplate[] = [
  {
    id: 'pos-lead-nailed-scene',
    description: 'The lead actor nailed a famously difficult scene in one take.',
    polarity: 'positive',
    costRange: [0, 0],
    qualityRange: [4, 10],
    buzzRange: [0, 0], // nobody outside dailies sees a good take happen
    delayDaysRange: [0, 0],
  },
  {
    id: 'pos-cheap-solution',
    description: 'The crew found a clever low-cost solution to a tricky shot.',
    polarity: 'positive',
    costRange: [-400_000, -100_000],
    qualityRange: [1, 5],
    buzzRange: [0, 0],
    delayDaysRange: [0, 0],
  },
  {
    id: 'pos-improvised-moment',
    description: 'The supporting actor improvised a moment that stole the scene.',
    polarity: 'positive',
    costRange: [0, 0],
    qualityRange: [3, 8],
    buzzRange: [0, 0],
    delayDaysRange: [0, 0],
  },
  {
    id: 'pos-early-buzz',
    description: 'A local news crew covered the shoot, generating early buzz.',
    polarity: 'positive',
    costRange: [0, 0],
    qualityRange: [0, 0],
    buzzRange: [6, 14], // genuinely public - press coverage
    delayDaysRange: [0, 0],
  },
  {
    id: 'pos-wrapped-early',
    description: 'The unit wrapped a full day ahead of schedule.',
    polarity: 'positive',
    costRange: [-300_000, -80_000],
    qualityRange: [0, 2],
    buzzRange: [0, 0],
    delayDaysRange: [0, 0],
  },
  {
    id: 'pos-chemistry',
    description: "The cast developed real chemistry, and their goofing-around between takes is turning up on social media.",
    polarity: 'positive',
    costRange: [0, 0],
    qualityRange: [5, 9],
    buzzRange: [2, 5], // the leak is the public angle, not the chemistry itself
    delayDaysRange: [0, 0],
  },
];

export const NEGATIVE_EVENT_TEMPLATES: ProductionEventTemplate[] = [
  {
    id: 'neg-director-over-schedule',
    description: 'The director went over schedule chasing one more perfect take.',
    polarity: 'negative',
    costRange: [200_000, 900_000],
    qualityRange: [0, 3],
    buzzRange: [0, 0],
    delayDaysRange: [1, 2],
  },
  {
    id: 'neg-bad-weather',
    description: 'Bad weather delayed filming for several days.',
    polarity: 'negative',
    costRange: [150_000, 700_000],
    qualityRange: [-2, 0],
    buzzRange: [0, 0],
    delayDaysRange: [2, 4],
  },
  {
    id: 'neg-vfx-harder',
    description: 'A key VFX sequence turned out to be much harder than expected.',
    polarity: 'negative',
    costRange: [300_000, 1_200_000],
    qualityRange: [-6, -1],
    buzzRange: [0, 0],
    delayDaysRange: [1, 3],
  },
  {
    id: 'neg-onset-tension',
    description: 'On-set tension flared between two big egos - and word is already getting around.',
    polarity: 'negative',
    costRange: [50_000, 300_000],
    qualityRange: [-8, -2],
    buzzRange: [-8, -2], // exactly the kind of thing tabloids run with
    delayDaysRange: [0, 1],
  },
  {
    id: 'neg-equipment-failure',
    description: 'An equipment malfunction halted production for a day.',
    polarity: 'negative',
    costRange: [100_000, 500_000],
    qualityRange: [-2, 0],
    buzzRange: [0, 0],
    delayDaysRange: [1, 1],
  },
  {
    id: 'neg-location-fell-through',
    description: 'An unexpected location fell through at the last minute.',
    polarity: 'negative',
    costRange: [200_000, 600_000],
    qualityRange: [-4, -1],
    buzzRange: [0, 0],
    delayDaysRange: [1, 3],
  },
  {
    id: 'neg-star-clash',
    description: 'The director and lead star clashed over how to play a key scene, and it leaked to the trade press.',
    polarity: 'negative',
    costRange: [0, 250_000],
    qualityRange: [-10, -3],
    buzzRange: [-4, -1],
    delayDaysRange: [0, 1],
  },
];

// Extra events layered on top of the generic pool above, only in play when
// the film's genre matches - these are what actually go right or wrong on
// THIS kind of shoot (a stunt gag, a VFX shot, a punchline that isn't
// landing) rather than generic set drama. Each genre gets one of each
// polarity so a genre-flavored event isn't guaranteed to be good or bad news.
export const GENRE_EVENT_TEMPLATES: Partial<Record<Genre, ProductionEventTemplate[]>> = {
  Action: [
    {
      id: 'genre-action-pos-stunt-gag',
      description: 'A stunt performer pulled off a death-defying gag that will anchor the trailer.',
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [5, 10],
      buzzRange: [8, 15], // explicitly trailer-bound, public-facing footage
      delayDaysRange: [0, 0],
    },
    {
      id: 'genre-action-neg-stunt-reshoot',
      description: 'A major stunt had to be re-shot after a near-miss on set.',
      polarity: 'negative',
      costRange: [300_000, 900_000],
      qualityRange: [-6, -1],
      buzzRange: [-4, 0], // a near-miss is newsworthy
      delayDaysRange: [1, 2],
    },
  ],
  Comedy: [
    {
      id: 'genre-comedy-pos-improv-riff',
      description: "An improvised riff between the leads had the whole crew in stitches - it's staying in the cut.",
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [4, 9],
      buzzRange: [0, 0],
      delayDaysRange: [0, 0],
    },
    {
      id: 'genre-comedy-neg-bit-not-landing',
      description: "A big comedic set-piece just isn't landing in dailies, no matter how many takes.",
      polarity: 'negative',
      costRange: [50_000, 200_000],
      qualityRange: [-8, -3],
      buzzRange: [0, 0],
      delayDaysRange: [1, 2],
    },
  ],
  Drama: [
    {
      id: 'genre-drama-pos-raw-take',
      description: 'The lead delivered a raw, one-take performance that stunned the crew into silence.',
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [6, 12],
      buzzRange: [0, 0],
      delayDaysRange: [0, 0],
    },
    {
      id: 'genre-drama-neg-flat-centerpiece',
      description: "The emotional centerpiece scene keeps falling flat - the director's called for rewrites.",
      polarity: 'negative',
      costRange: [80_000, 300_000],
      qualityRange: [-7, -2],
      buzzRange: [0, 0],
      delayDaysRange: [1, 3],
    },
  ],
  Horror: [
    {
      id: 'genre-horror-pos-practical-gag',
      description: 'A practical gore effect looked so convincing a crew member actually flinched.',
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [5, 10],
      buzzRange: [0, 0],
      delayDaysRange: [0, 0],
    },
    {
      id: 'genre-horror-neg-prop-malfunction',
      description: "A key prop malfunctioned mid-scare, ruining what should've been the film's best jump scare.",
      polarity: 'negative',
      costRange: [100_000, 400_000],
      qualityRange: [-6, -1],
      buzzRange: [0, 0],
      delayDaysRange: [1, 2],
    },
  ],
  Romance: [
    {
      id: 'genre-romance-pos-chemistry',
      description: "The two leads have real off-screen chemistry, and fan-shot photos from set are already circulating.",
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [5, 10],
      buzzRange: [2, 5],
      delayDaysRange: [0, 0],
    },
    {
      id: 'genre-romance-neg-no-chemistry',
      description: 'The leads have zero chemistry on camera, and no amount of direction is fixing it.',
      polarity: 'negative',
      costRange: [0, 150_000],
      qualityRange: [-8, -3],
      buzzRange: [0, 0],
      delayDaysRange: [1, 2],
    },
  ],
  'Sci-Fi': [
    {
      id: 'genre-scifi-pos-vfx-test',
      description: 'A VFX test render came back looking better than anyone expected.',
      polarity: 'positive',
      costRange: [-200_000, 0],
      qualityRange: [5, 10],
      buzzRange: [0, 0],
      delayDaysRange: [0, 0],
    },
    {
      id: 'genre-scifi-neg-vfx-redo',
      description: "A critical VFX shot needs a full redo after the studio's supervisor flagged it as unconvincing.",
      polarity: 'negative',
      costRange: [400_000, 1_200_000],
      qualityRange: [-6, -1],
      buzzRange: [0, 0],
      delayDaysRange: [2, 4],
    },
  ],
  Fantasy: [
    {
      id: 'genre-fantasy-pos-designs-turning-heads',
      description: "The costume and creature designs are turning heads on set - concept art is already leaking online.",
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [3, 7],
      buzzRange: [6, 12], // explicitly a leak
      delayDaysRange: [0, 0],
    },
    {
      id: 'genre-fantasy-neg-set-collapse',
      description: 'An elaborate set piece collapsed overnight and needs to be rebuilt.',
      polarity: 'negative',
      costRange: [300_000, 900_000],
      qualityRange: [-4, -1],
      buzzRange: [-3, 0], // visible mishap, local coverage plausible
      delayDaysRange: [2, 4],
    },
  ],
  Thriller: [
    {
      id: 'genre-thriller-pos-climax-cut',
      description: "The editor cut together a rough version of the climax and it's genuinely gripping.",
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [5, 10],
      buzzRange: [0, 0],
      delayDaysRange: [0, 0],
    },
    {
      id: 'genre-thriller-neg-twist-not-landing',
      description: "The plot's central twist isn't landing in test cuts - it's reading as confusing rather than surprising.",
      polarity: 'negative',
      costRange: [50_000, 200_000],
      qualityRange: [-7, -2],
      buzzRange: [0, 0],
      delayDaysRange: [0, 1],
    },
  ],
};

// Four of these come from computeStaticProductionRisk (known before a
// single day of filming); schedulePressure is computed live, fresh each
// day, from how photography is actually going
// (engine/production.ts:computeSchedulePressure) - both feed the same
// per-day event pool (engine/production.ts:rollDayEvent) the same way.
export type RiskDimension = 'schedulePressure' | 'moraleRisk' | 'safetyRisk' | 'technicalComplexity' | 'budgetRisk';

// A second layer of contextual events, mixed into the pool alongside the
// genre templates above whenever a production's risk reads clearly high or
// low on a given dimension - the mechanism a planning choice actually uses
// to shape what happens on set, rather than only nudging the overall
// positive/negative odds. Each dimension gets its own negative bank (fires
// when that dimension is high) and positive bank (fires when it's low) -
// see engine/production.ts:addDimensionTemplates for the threshold logic.
// Every dimension also carries one or two interactive templates, mixed in
// alongside the simple ones - a real decision on top of the routine events,
// not a replacement for them.
export const RISK_DIMENSION_EVENT_TEMPLATES: Record<
  RiskDimension,
  { positive: ProductionEventTemplate[]; negative: ProductionEventTemplate[] }
> = {
  schedulePressure: {
    negative: [
      {
        id: 'risk-schedule-neg-frantic-day',
        description: 'The schedule slipped and three scenes had to be crammed into a single frantic day.',
        polarity: 'negative',
        costRange: [100_000, 400_000],
        qualityRange: [-8, -3],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-schedule-neg-exhausted-crew',
        description: 'Exhausted after back-to-back night shoots, the crew started missing marks.',
        polarity: 'negative',
        costRange: [50_000, 200_000],
        qualityRange: [-6, -2],
        buzzRange: [0, 0],
        delayDaysRange: [0, 1],
      },
      {
        id: 'risk-schedule-neg-scene-cut-for-time',
        description: 'A scene had to be cut for time, leaving a gap the editor will have to paper over.',
        polarity: 'negative',
        costRange: [0, 0],
        qualityRange: [-7, -2],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-schedule-neg-ad-quit',
        description: 'The first assistant director quit mid-shoot, citing an impossible schedule - word reached the trades within a day.',
        polarity: 'negative',
        costRange: [100_000, 350_000],
        qualityRange: [-5, -1],
        buzzRange: [-3, -1],
        delayDaysRange: [1, 3],
      },
      {
        id: 'int-schedule-stubborn-scene',
        situation: "A pivotal scene isn't coming together and the unit is already behind. The 1st AD needs a call.",
        polarity: 'negative',
        interactive: true,
        choices: [
          {
            id: 'cut-losses',
            label: 'Cut your losses',
            description: 'Print what you have and move on. Costs nothing but the scene will be weaker for it.',
            costRange: [0, 0],
            qualityRange: [-6, -3],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'throw-money',
            label: 'Bring in extra crew and lighting',
            description: 'Pay to get it right without losing more days.',
            costRange: [100_000, 300_000],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'take-the-time',
            label: 'Give it the rest of the day',
            description: "Protect the scene, but the schedule slips further.",
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [1, 2],
          },
        ],
      },
      {
        id: 'int-schedule-crew-exhausted',
        situation: 'The unit is days behind and the crew is running on fumes. How do you want to handle the pace?',
        polarity: 'negative',
        interactive: true,
        choices: [
          {
            id: 'push-through',
            label: 'Push through on the current schedule',
            description: 'Free, but a tired crew makes mistakes.',
            costRange: [0, 0],
            qualityRange: [-5, -2],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'second-unit',
            label: 'Bring in a second unit',
            description: 'Buys back the schedule at a real price.',
            costRange: [300_000, 700_000],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'rest-day',
            label: 'Give everyone a rest day',
            description: 'No cost, no quality risk - just falls further behind.',
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [1, 1],
          },
        ],
      },
    ],
    positive: [
      {
        id: 'risk-schedule-pos-generous-time',
        description: 'A generous schedule let the crew get every shot exactly right without rushing.',
        polarity: 'positive',
        costRange: [-100_000, 0],
        qualityRange: [4, 9],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-schedule-pos-wrapped-early',
        description: 'The unit wrapped with days to spare, giving everyone room to breathe.',
        polarity: 'positive',
        costRange: [-200_000, -50_000],
        qualityRange: [2, 6],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-schedule-pos-extra-take',
        description: 'A relaxed pace let the director try one more take that turned out to be the best one.',
        polarity: 'positive',
        costRange: [0, 50_000],
        qualityRange: [5, 10],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-schedule-pos-caught-continuity',
        description: 'With no schedule pressure, the crew caught a continuity error before it became a problem.',
        polarity: 'positive',
        costRange: [-50_000, 0],
        qualityRange: [3, 6],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
    ],
  },
  moraleRisk: {
    negative: [
      {
        id: 'risk-morale-neg-shouting-match',
        description: 'A screaming match between two department heads shut down the set for an afternoon.',
        polarity: 'negative',
        costRange: [50_000, 250_000],
        qualityRange: [-8, -3],
        buzzRange: [-6, -2],
        delayDaysRange: [0, 1],
      },
      {
        id: 'risk-morale-neg-no-shows',
        description: 'An unreliable crew member no-showed twice in one week, forcing scenes to be reshuffled.',
        polarity: 'negative',
        costRange: [80_000, 300_000],
        qualityRange: [-4, -1],
        buzzRange: [0, 0],
        delayDaysRange: [1, 2],
      },
      {
        id: 'risk-morale-neg-public-blowup',
        description: 'Simmering resentment on set boiled over into a very public shouting match.',
        polarity: 'negative',
        costRange: [0, 100_000],
        qualityRange: [-6, -2],
        buzzRange: [-8, -3],
        delayDaysRange: [0, 1],
      },
      {
        id: 'risk-morale-neg-walked-off',
        description: 'A key crew member walked off the job over a dispute with the director.',
        polarity: 'negative',
        costRange: [100_000, 400_000],
        qualityRange: [-7, -3],
        buzzRange: [-4, -1],
        delayDaysRange: [1, 3],
      },
      {
        id: 'int-morale-blowup',
        situation: 'Two department heads had a screaming match on set. Word is already spreading.',
        polarity: 'negative',
        interactive: true,
        choices: [
          {
            id: 'let-it-blow-over',
            label: 'Let it blow over quietly',
            description: 'No intervention - it gets out anyway.',
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [-6, -2],
            delayDaysRange: [0, 0],
          },
          {
            id: 'bring-in-mediator',
            label: 'Bring in a mediator',
            description: 'Pay to resolve it privately before it spreads further.',
            costRange: [50_000, 150_000],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'replace-one',
            label: 'Replace one of them',
            description: 'Decisive, but finding and onboarding a replacement costs real time.',
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [1, 2],
          },
        ],
      },
    ],
    positive: [
      {
        id: 'risk-morale-pos-bonded-cast',
        description: 'The cast and crew have genuinely bonded, and it shows on their social media.',
        polarity: 'positive',
        costRange: [-50_000, 0],
        qualityRange: [4, 9],
        buzzRange: [2, 5],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-morale-pos-set-party',
        description: "A crew member's birthday turned into an impromptu set party, and photos are already circulating online.",
        polarity: 'positive',
        costRange: [5_000, 20_000],
        qualityRange: [1, 3],
        buzzRange: [2, 4],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-morale-pos-no-hiccups',
        description: 'Everyone showed up prepared and professional - not a single scheduling hiccup all week.',
        polarity: 'positive',
        costRange: [-100_000, -20_000],
        qualityRange: [3, 7],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-morale-pos-lockstep',
        description: 'The director and department heads are working in lockstep - decisions that used to take days now take minutes.',
        polarity: 'positive',
        costRange: [-80_000, 0],
        qualityRange: [3, 6],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'int-morale-bonding',
        situation: 'The cast has genuinely bonded and morale is sky-high. There\'s a window to make the most of it.',
        polarity: 'positive',
        interactive: true,
        choices: [
          {
            id: 'keep-low-key',
            label: 'Keep it low-key',
            description: 'A steady, private benefit to the work itself.',
            costRange: [0, 0],
            qualityRange: [2, 4],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'press-day',
            label: 'Get the press in for a feel-good story',
            description: 'Pure publicity play - no effect on the film itself.',
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [8, 15],
            delayDaysRange: [0, 0],
          },
          {
            id: 'reward-day-off',
            label: 'Reward the cast with a day off',
            description: 'Banks the goodwill, but costs a shoot day.',
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [1, 1],
          },
        ],
      },
    ],
  },
  safetyRisk: {
    negative: [
      {
        id: 'risk-safety-neg-stunt-hospital',
        description: 'A stunt went wrong and a performer was taken to the hospital, shutting down filming for two days.',
        polarity: 'negative',
        costRange: [300_000, 900_000],
        qualityRange: [-8, -2],
        buzzRange: [-5, 0],
        delayDaysRange: [2, 2],
      },
      {
        id: 'risk-safety-neg-explosion-too-big',
        description: 'An unrehearsed practical explosion went bigger than planned, damaging the set.',
        polarity: 'negative',
        costRange: [200_000, 700_000],
        qualityRange: [-4, 0],
        buzzRange: [-3, 0],
        delayDaysRange: [1, 3],
      },
      {
        id: 'risk-safety-neg-rig-failed-inspection',
        description: 'A rushed stunt rig failed safety inspection at the last minute, forcing an expensive re-rig.',
        polarity: 'negative',
        costRange: [150_000, 500_000],
        qualityRange: [-3, 0],
        buzzRange: [0, 0],
        delayDaysRange: [1, 2],
      },
      {
        id: 'risk-safety-neg-insurance-claim',
        description: 'An on-set injury during a practical effects sequence led to a costly insurance claim.',
        polarity: 'negative',
        costRange: [250_000, 800_000],
        qualityRange: [-5, -1],
        buzzRange: [-3, -1],
        delayDaysRange: [0, 1],
      },
      {
        id: 'int-safety-near-miss',
        situation: 'A near-miss on a practical effects rig has rattled the crew. How do you respond?',
        polarity: 'negative',
        interactive: true,
        choices: [
          {
            id: 'stand-down',
            label: 'Full safety stand-down and re-certify everything',
            description: 'No cost or quality hit, but the whole rig gets re-checked before anyone goes near it again.',
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [1, 3],
          },
          {
            id: 'quiet-word',
            label: 'Quiet word and carry on',
            description: "Costs nothing, but crew talk about it gets out and reads as reckless.",
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [-4, -1],
            delayDaysRange: [0, 0],
          },
          {
            id: 'independent-inspectors',
            label: 'Bring in independent safety inspectors',
            description: 'Pay for a clean bill of health without losing shoot days.',
            costRange: [150_000, 400_000],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
        ],
      },
    ],
    positive: [
      {
        id: 'risk-safety-pos-flawless-stunt',
        description: 'A genuinely dangerous stunt was pulled off flawlessly thanks to meticulous safety planning.',
        polarity: 'positive',
        costRange: [0, 100_000],
        qualityRange: [6, 11],
        buzzRange: [6, 12],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-safety-pos-zero-incidents',
        description: "The practical effects team's safety-first approach meant zero incidents on a physically demanding shoot.",
        polarity: 'positive',
        costRange: [-50_000, 0],
        qualityRange: [3, 6],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-safety-pos-fight-first-take',
        description: 'A well-rehearsed fight sequence came together perfectly on the first take.',
        polarity: 'positive',
        costRange: [-30_000, 0],
        qualityRange: [4, 8],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-safety-pos-contingency-paid-off',
        description: "The stunt coordinator's contingency plan meant a minor mishap barely slowed things down.",
        polarity: 'positive',
        costRange: [-20_000, 20_000],
        qualityRange: [1, 3],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'int-safety-risky-stunt',
        situation: 'The next stunt is more dangerous than what was budgeted for safety. The coordinator wants direction.',
        polarity: 'positive',
        interactive: true,
        choices: [
          {
            id: 'do-as-planned',
            label: 'Do it as planned',
            description: 'The full, riskier version - impressive if it lands.',
            costRange: [0, 0],
            qualityRange: [4, 8],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'extra-safety',
            label: 'Add extra safety measures',
            description: 'Pay to do it the way it was planned, safely.',
            costRange: [100_000, 300_000],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'scale-back',
            label: 'Scale back the stunt',
            description: 'Free and safe, but less impressive on screen.',
            costRange: [0, 0],
            qualityRange: [-3, -1],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
        ],
      },
    ],
  },
  technicalComplexity: {
    negative: [
      {
        id: 'risk-technical-neg-shot-rebuilt',
        description: "A complex effects sequence isn't rendering the way anyone hoped, and now it needs to be rebuilt from scratch.",
        polarity: 'negative',
        costRange: [300_000, 1_000_000],
        qualityRange: [-5, -1],
        buzzRange: [0, 0],
        delayDaysRange: [2, 4],
      },
      {
        id: 'risk-technical-neg-expensive-workaround',
        description: "The technical team hit a wall trying to pull off an ambitious sequence, and the workaround isn't cheap.",
        polarity: 'negative',
        costRange: [250_000, 800_000],
        qualityRange: [-4, -1],
        buzzRange: [0, 0],
        delayDaysRange: [1, 2],
      },
      {
        id: 'risk-technical-neg-unusable-footage',
        description: 'A miscommunication between the effects team and the editors cost a full week of unusable footage.',
        polarity: 'negative',
        costRange: [150_000, 600_000],
        qualityRange: [-6, -2],
        buzzRange: [0, 0],
        delayDaysRange: [4, 6],
      },
      {
        id: 'risk-technical-neg-sequence-simplified',
        description: 'An overly ambitious sequence proved too complicated to finish on schedule and had to be simplified.',
        polarity: 'negative',
        costRange: [100_000, 400_000],
        qualityRange: [-5, -2],
        buzzRange: [0, 0],
        delayDaysRange: [1, 2],
      },
      {
        id: 'int-technical-vfx-struggle',
        situation: "A complex VFX sequence isn't coming together and the supervisor needs a decision.",
        polarity: 'negative',
        interactive: true,
        choices: [
          {
            id: 'more-artists',
            label: 'Throw more artists at it',
            description: 'Pay to keep the shot as ambitious as planned.',
            costRange: [300_000, 700_000],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'simplify-shot',
            label: 'Simplify the shot',
            description: 'Free, but the sequence loses some of its ambition.',
            costRange: [0, 0],
            qualityRange: [-5, -2],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'give-vendor-time',
            label: 'Give the vendor more time',
            description: 'No cost or quality hit, but the schedule absorbs it.',
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [2, 4],
          },
        ],
      },
    ],
    positive: [
      {
        id: 'risk-technical-pos-smoother-than-expected',
        description: 'A technically ambitious sequence came together far more smoothly than anyone expected.',
        polarity: 'positive',
        costRange: [-100_000, 0],
        qualityRange: [5, 10],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-technical-pos-cheaper-solution',
        description: 'The effects team found an elegant, cheaper solution to a shot everyone assumed would be a nightmare.',
        polarity: 'positive',
        costRange: [-300_000, -80_000],
        qualityRange: [3, 7],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-technical-pos-few-revisions',
        description: 'Meticulous pre-production planning meant a complicated sequence needed almost no revisions.',
        polarity: 'positive',
        costRange: [-50_000, 0],
        qualityRange: [3, 6],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-technical-pos-test-render',
        description: "A test render of the film's most complex shot came back looking better than anyone hoped.",
        polarity: 'positive',
        costRange: [0, 50_000],
        qualityRange: [4, 8],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'int-technical-breakthrough',
        situation: 'The effects team found a genuinely clever solution to the film\'s hardest shot. Worth pushing further?',
        polarity: 'positive',
        interactive: true,
        choices: [
          {
            id: 'bank-the-win',
            label: 'Bank the win, move on',
            description: "Don't over-invest - take the savings and keep moving.",
            costRange: [-100_000, -30_000],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'push-further',
            label: 'Push it further for the money shot',
            description: 'No extra cost, but squeezes real quality out of the breakthrough.',
            costRange: [0, 0],
            qualityRange: [5, 9],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'tease-it',
            label: 'Let the team show it off online',
            description: 'A work-in-progress reel makes the rounds - pure publicity, no effect on the film.',
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [6, 12],
            delayDaysRange: [0, 0],
          },
        ],
      },
    ],
  },
  budgetRisk: {
    negative: [
      {
        id: 'risk-budget-neg-ran-out',
        description: 'The production quietly ran out of contingency money halfway through the shoot.',
        polarity: 'negative',
        costRange: [200_000, 600_000],
        qualityRange: [-6, -2],
        buzzRange: [0, 0],
        delayDaysRange: [0, 1],
      },
      {
        id: 'risk-budget-neg-corners-cut',
        description: 'Corners had to be cut on a sequence the film really needed to look convincing.',
        polarity: 'negative',
        costRange: [-100_000, 0],
        qualityRange: [-8, -3],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-budget-neg-insurance-flagged',
        description: 'An insurance review flagged the production as under-resourced for what it\'s attempting, and premiums went up.',
        polarity: 'negative',
        costRange: [100_000, 350_000],
        qualityRange: [0, 0],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-budget-neg-emergency-financing',
        description: 'The studio had to scramble for emergency completion financing mid-shoot, and it made the trade press.',
        polarity: 'negative',
        costRange: [300_000, 900_000],
        qualityRange: [-3, 0],
        buzzRange: [-4, -1],
        delayDaysRange: [0, 1],
      },
      {
        id: 'int-budget-thin',
        situation: 'The contingency reserve is running thinner than planned with more of the shoot still ahead.',
        polarity: 'negative',
        interactive: true,
        choices: [
          {
            id: 'cut-scene',
            label: 'Cut a scene to save money',
            description: 'Free, but the film loses something it needed.',
            costRange: [0, 0],
            qualityRange: [-6, -3],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'emergency-financing',
            label: 'Request emergency financing',
            description: 'Solves the crunch, at the price of fees and interest.',
            costRange: [150_000, 400_000],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'delay-lesser-shots',
            label: 'Quietly delay the less essential shots',
            description: 'No cost or quality hit - just costs time.',
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [1, 2],
          },
        ],
      },
    ],
    positive: [
      {
        id: 'risk-budget-pos-under-reserve',
        description: 'The production came in comfortably under its contingency reserve, with room to spare for polish.',
        polarity: 'positive',
        costRange: [-150_000, -30_000],
        qualityRange: [3, 7],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-budget-pos-seized-opportunity',
        description: 'A healthy budget cushion meant an unexpected creative opportunity could be seized without a second thought.',
        polarity: 'positive',
        costRange: [20_000, 100_000],
        qualityRange: [4, 8],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-budget-pos-fixed-it-right',
        description: 'Being properly resourced for once let the crew fix a problem right the first time instead of patching it later.',
        polarity: 'positive',
        costRange: [-50_000, 0],
        qualityRange: [2, 5],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'risk-budget-pos-cushion-absorbed-overrun',
        description: "The production's financial cushion meant nobody panicked when a routine cost overrun hit.",
        polarity: 'positive',
        costRange: [0, 0],
        qualityRange: [1, 3],
        buzzRange: [0, 0],
        delayDaysRange: [0, 0],
      },
      {
        id: 'int-budget-opportunity',
        situation: 'The production is running comfortably under its contingency reserve. There\'s room to do something with the surplus.',
        polarity: 'positive',
        interactive: true,
        choices: [
          {
            id: 'bank-it',
            label: 'Bank it',
            description: 'Pure savings, no other effect.',
            costRange: [-150_000, -50_000],
            qualityRange: [0, 0],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'polish-pass',
            label: 'Invest in one more polish pass',
            description: 'Spend the cushion on the film itself.',
            costRange: [0, 0],
            qualityRange: [3, 6],
            buzzRange: [0, 0],
            delayDaysRange: [0, 0],
          },
          {
            id: 'publicity-moment',
            label: 'Fund a splashy publicity moment',
            description: 'Spend the cushion on getting people talking instead.',
            costRange: [0, 0],
            qualityRange: [0, 0],
            buzzRange: [6, 12],
            delayDaysRange: [0, 0],
          },
        ],
      },
    ],
  },
};
