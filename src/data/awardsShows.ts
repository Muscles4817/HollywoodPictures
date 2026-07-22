// The tentpole awards shows and their profiles (docs/DESIGN_REVIEW_awards_season.md,
// "Precursor ceremonies"). Pure tuning data; engine/awards.ts resolves them and
// the reducer schedules/pays them out. Ordered earliest ceremony first, which
// is also the order momentum accumulates in across a season.
import type { AwardCategory, AwardShowId } from '../types';
import { AWARD_CATEGORIES } from './awards';

export interface AwardShowProfile {
  id: AwardShowId;
  /** Full player-facing name. */
  name: string;
  /** Compact name for tight UI (chips, summaries). */
  shortName: string;
  /** Days after the year boundary this ceremony resolves on. Strictly increasing across the array. */
  ceremonyOffsetDays: number;
  /** The categories this show awards. */
  categories: readonly AwardCategory[];
  /** Payoff magnitude relative to the Academy Awards (Academy = 1). Precursors carry real, smaller stakes. */
  payoffScale: number;
  /** How strongly this show's results push contenders at every later ceremony. The flagship resolves last, so its own weight is never consumed. */
  momentumWeight: number;
}

// The Golden Globes split Best Picture and lead acting into Drama vs
// Musical/Comedy, and skip the crafts save Original Score.
const GOLDEN_GLOBES_CATEGORIES: readonly AwardCategory[] = [
  'best-picture-drama',
  'best-picture-comedy',
  'best-director',
  'best-screenplay',
  'best-actor-drama',
  'best-actress-drama',
  'best-actor-comedy',
  'best-actress-comedy',
  'best-supporting-actor',
  'best-supporting-actress',
  'best-original-score',
];

// The Screen Actors Guild honours performances only.
const SAG_CATEGORIES: readonly AwardCategory[] = [
  'best-actor',
  'best-actress',
  'best-supporting-actor',
  'best-supporting-actress',
];

// The Golden Globes open the season; the Academy Awards close it. Anything
// added here is picked up automatically by the reducer's season scheduling
// and the Awards page, as long as the array stays sorted by ceremonyOffsetDays.
export const AWARD_SHOWS: readonly AwardShowProfile[] = [
  {
    id: 'golden-globes',
    name: 'Golden Globes',
    shortName: 'Globes',
    ceremonyOffsetDays: 10,
    categories: GOLDEN_GLOBES_CATEGORIES,
    payoffScale: 0.4,
    momentumWeight: 1.0,
  },
  {
    id: 'sag',
    name: 'SAG Awards',
    shortName: 'SAG',
    ceremonyOffsetDays: 20,
    categories: SAG_CATEGORIES,
    payoffScale: 0.3,
    momentumWeight: 0.8,
  },
  {
    id: 'bafta',
    name: 'BAFTA Film Awards',
    shortName: 'BAFTA',
    ceremonyOffsetDays: 32,
    categories: AWARD_CATEGORIES,
    payoffScale: 0.5,
    momentumWeight: 1.2,
  },
  {
    id: 'academy',
    name: 'The Academy Awards',
    shortName: 'Oscars',
    ceremonyOffsetDays: 45,
    categories: AWARD_CATEGORIES,
    payoffScale: 1.0,
    momentumWeight: 0, // the flagship resolves last - nothing consumes its momentum
  },
];

const SHOW_BY_ID: Record<AwardShowId, AwardShowProfile> = Object.fromEntries(
  AWARD_SHOWS.map((show) => [show.id, show]),
) as Record<AwardShowId, AwardShowProfile>;

export function awardShow(id: AwardShowId): AwardShowProfile {
  return SHOW_BY_ID[id];
}
