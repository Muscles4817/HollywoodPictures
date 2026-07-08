import type { Genre } from '../types';

// Templates for randomized production events. The engine picks a handful of
// these per shoot, biased by an overall risk score, then rolls a concrete
// delta within each range. Ranges are intentionally modest so no single
// event can single-handedly sink or save a film.
export interface ProductionEventTemplate {
  id: string;
  description: string;
  polarity: 'positive' | 'negative';
  costRange: [number, number]; // currency delta; negative = savings
  qualityRange: [number, number]; // -100..100 scale
  buzzRange: [number, number]; // -100..100 scale
  delayRiskRange: [number, number]; // -100..100 scale, informational
}

export const POSITIVE_EVENT_TEMPLATES: ProductionEventTemplate[] = [
  {
    id: 'pos-lead-nailed-scene',
    description: 'The lead actor nailed a famously difficult scene in one take.',
    polarity: 'positive',
    costRange: [0, 0],
    qualityRange: [4, 10],
    buzzRange: [5, 12],
    delayRiskRange: [-5, 0],
  },
  {
    id: 'pos-cheap-solution',
    description: 'The crew found a clever low-cost solution to a tricky shot.',
    polarity: 'positive',
    costRange: [-400_000, -100_000],
    qualityRange: [1, 5],
    buzzRange: [0, 3],
    delayRiskRange: [-5, 0],
  },
  {
    id: 'pos-improvised-moment',
    description: 'The supporting actor improvised a moment that stole the scene.',
    polarity: 'positive',
    costRange: [0, 0],
    qualityRange: [3, 8],
    buzzRange: [4, 10],
    delayRiskRange: [0, 0],
  },
  {
    id: 'pos-early-buzz',
    description: 'A local news crew covered the shoot, generating early buzz.',
    polarity: 'positive',
    costRange: [0, 0],
    qualityRange: [0, 0],
    buzzRange: [6, 14],
    delayRiskRange: [0, 0],
  },
  {
    id: 'pos-wrapped-early',
    description: 'The unit wrapped a full day ahead of schedule.',
    polarity: 'positive',
    costRange: [-300_000, -80_000],
    qualityRange: [0, 2],
    buzzRange: [0, 2],
    delayRiskRange: [-10, -5],
  },
  {
    id: 'pos-chemistry',
    description: 'The cast developed real chemistry that elevated every scene together.',
    polarity: 'positive',
    costRange: [0, 0],
    qualityRange: [5, 9],
    buzzRange: [3, 8],
    delayRiskRange: [0, 0],
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
    delayRiskRange: [8, 18],
  },
  {
    id: 'neg-bad-weather',
    description: 'Bad weather delayed filming for several days.',
    polarity: 'negative',
    costRange: [150_000, 700_000],
    qualityRange: [-2, 0],
    buzzRange: [0, 0],
    delayRiskRange: [10, 20],
  },
  {
    id: 'neg-vfx-harder',
    description: 'A key VFX sequence turned out to be much harder than expected.',
    polarity: 'negative',
    costRange: [300_000, 1_200_000],
    qualityRange: [-6, -1],
    buzzRange: [-3, 0],
    delayRiskRange: [10, 20],
  },
  {
    id: 'neg-onset-tension',
    description: 'On-set tension flared between two big egos.',
    polarity: 'negative',
    costRange: [50_000, 300_000],
    qualityRange: [-8, -2],
    buzzRange: [-8, -2],
    delayRiskRange: [5, 12],
  },
  {
    id: 'neg-equipment-failure',
    description: 'An equipment malfunction halted production for a day.',
    polarity: 'negative',
    costRange: [100_000, 500_000],
    qualityRange: [-2, 0],
    buzzRange: [0, 0],
    delayRiskRange: [8, 15],
  },
  {
    id: 'neg-location-fell-through',
    description: 'An unexpected location fell through at the last minute.',
    polarity: 'negative',
    costRange: [200_000, 600_000],
    qualityRange: [-4, -1],
    buzzRange: [-2, 0],
    delayRiskRange: [8, 16],
  },
  {
    id: 'neg-star-clash',
    description: 'The director and lead star clashed over how to play a key scene.',
    polarity: 'negative',
    costRange: [0, 250_000],
    qualityRange: [-10, -3],
    buzzRange: [-6, -1],
    delayRiskRange: [5, 10],
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
      buzzRange: [8, 15],
      delayRiskRange: [0, 0],
    },
    {
      id: 'genre-action-neg-stunt-reshoot',
      description: 'A major stunt had to be re-shot after a near-miss on set.',
      polarity: 'negative',
      costRange: [300_000, 900_000],
      qualityRange: [-6, -1],
      buzzRange: [-4, 0],
      delayRiskRange: [10, 20],
    },
  ],
  Comedy: [
    {
      id: 'genre-comedy-pos-improv-riff',
      description: "An improvised riff between the leads had the whole crew in stitches - it's staying in the cut.",
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [4, 9],
      buzzRange: [5, 10],
      delayRiskRange: [0, 0],
    },
    {
      id: 'genre-comedy-neg-bit-not-landing',
      description: "A big comedic set-piece just isn't landing in dailies, no matter how many takes.",
      polarity: 'negative',
      costRange: [50_000, 200_000],
      qualityRange: [-8, -3],
      buzzRange: [-3, 0],
      delayRiskRange: [5, 10],
    },
  ],
  Drama: [
    {
      id: 'genre-drama-pos-raw-take',
      description: 'The lead delivered a raw, one-take performance that stunned the crew into silence.',
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [6, 12],
      buzzRange: [3, 8],
      delayRiskRange: [0, 0],
    },
    {
      id: 'genre-drama-neg-flat-centerpiece',
      description: "The emotional centerpiece scene keeps falling flat - the director's called for rewrites.",
      polarity: 'negative',
      costRange: [80_000, 300_000],
      qualityRange: [-7, -2],
      buzzRange: [0, 0],
      delayRiskRange: [6, 14],
    },
  ],
  Horror: [
    {
      id: 'genre-horror-pos-practical-gag',
      description: 'A practical gore effect looked so convincing a crew member actually flinched.',
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [5, 10],
      buzzRange: [6, 12],
      delayRiskRange: [0, 0],
    },
    {
      id: 'genre-horror-neg-prop-malfunction',
      description: "A key prop malfunctioned mid-scare, ruining what should've been the film's best jump scare.",
      polarity: 'negative',
      costRange: [100_000, 400_000],
      qualityRange: [-6, -1],
      buzzRange: [-3, 0],
      delayRiskRange: [5, 12],
    },
  ],
  Romance: [
    {
      id: 'genre-romance-pos-chemistry',
      description: "The two leads have real off-screen chemistry, and it's radiating off the screen.",
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [5, 10],
      buzzRange: [4, 9],
      delayRiskRange: [0, 0],
    },
    {
      id: 'genre-romance-neg-no-chemistry',
      description: 'The leads have zero chemistry on camera, and no amount of direction is fixing it.',
      polarity: 'negative',
      costRange: [0, 150_000],
      qualityRange: [-8, -3],
      buzzRange: [-4, 0],
      delayRiskRange: [0, 5],
    },
  ],
  'Sci-Fi': [
    {
      id: 'genre-scifi-pos-vfx-test',
      description: 'A VFX test render came back looking better than anyone expected.',
      polarity: 'positive',
      costRange: [-200_000, 0],
      qualityRange: [5, 10],
      buzzRange: [5, 10],
      delayRiskRange: [0, 0],
    },
    {
      id: 'genre-scifi-neg-vfx-redo',
      description: "A critical VFX shot needs a full redo after the studio's supervisor flagged it as unconvincing.",
      polarity: 'negative',
      costRange: [400_000, 1_200_000],
      qualityRange: [-6, -1],
      buzzRange: [-2, 0],
      delayRiskRange: [12, 22],
    },
  ],
  Fantasy: [
    {
      id: 'genre-fantasy-pos-designs-turning-heads',
      description: "The costume and creature designs are turning heads on set - concept art is already leaking online.",
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [3, 7],
      buzzRange: [6, 12],
      delayRiskRange: [0, 0],
    },
    {
      id: 'genre-fantasy-neg-set-collapse',
      description: 'An elaborate set piece collapsed overnight and needs to be rebuilt.',
      polarity: 'negative',
      costRange: [300_000, 900_000],
      qualityRange: [-4, -1],
      buzzRange: [0, 0],
      delayRiskRange: [10, 20],
    },
  ],
  Thriller: [
    {
      id: 'genre-thriller-pos-climax-cut',
      description: "The editor cut together a rough version of the climax and it's genuinely gripping.",
      polarity: 'positive',
      costRange: [0, 0],
      qualityRange: [5, 10],
      buzzRange: [3, 8],
      delayRiskRange: [0, 0],
    },
    {
      id: 'genre-thriller-neg-twist-not-landing',
      description: "The plot's central twist isn't landing in test cuts - it's reading as confusing rather than surprising.",
      polarity: 'negative',
      costRange: [50_000, 200_000],
      qualityRange: [-7, -2],
      buzzRange: [-3, 0],
      delayRiskRange: [5, 12],
    },
  ],
};
