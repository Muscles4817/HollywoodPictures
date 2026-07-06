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
