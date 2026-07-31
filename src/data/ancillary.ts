// Tunable data for the ancillary-revenue model (a film's post-theatrical life):
// home entertainment & digital, television/streaming licensing, merchandising,
// and the long-tail catalogue. See docs/DESIGN_REVIEW_studio_financial_model.md.
//
// This is Stage 1 of that design: the numbers below feed a *derived, inert*
// profile (engine/ancillary.ts) that computes a film's post-theatrical potential
// on demand from attributes it already carries - no cash is credited, no state
// is stored. Rebalancing the whole system is meant to happen here and in the
// constants at the top of engine/ancillary.ts, never by threading magic numbers
// through logic (CLAUDE.md "Conventions worth keeping").
import type { Genre } from '../types';

/**
 * Per-genre ancillary signature - the one piece of genre data the redesign adds,
 * because GenreProfile (data/genres.ts) carries no family/merch/longevity flags
 * today. Each is a *multiplier* around 1.0 (merch is deliberately wider-range,
 * it is the sharpest genre differentiator):
 *  - homeEnt: rewatch/collectibility skew (Fantasy/Sci-Fi high, Drama low).
 *  - merch: toy/apparel/licensing potential (Fantasy/Sci-Fi high, Drama ~0) -
 *    this is what makes "adult dramas don't sell merch" fall out of the data.
 *  - catalogueBias: tendency toward a durable library tail (prestige-leaning and
 *    family-perennial genres higher).
 */
export interface GenreAncillaryProfile {
  homeEnt: number;
  merch: number;
  catalogueBias: number; // 0-1
}

export const GENRE_ANCILLARY: Record<Genre, GenreAncillaryProfile> = {
  Action: { homeEnt: 1.4, merch: 3.5, catalogueBias: 0.5 },
  'Sci-Fi': { homeEnt: 1.4, merch: 4.5, catalogueBias: 0.7 },
  Fantasy: { homeEnt: 1.5, merch: 5.0, catalogueBias: 0.8 },
  Horror: { homeEnt: 1.1, merch: 1.2, catalogueBias: 0.6 },
  Comedy: { homeEnt: 1.0, merch: 0.8, catalogueBias: 0.4 },
  Thriller: { homeEnt: 1.0, merch: 0.6, catalogueBias: 0.4 },
  Romance: { homeEnt: 0.8, merch: 0.3, catalogueBias: 0.5 },
  Drama: { homeEnt: 0.6, merch: 0.05, catalogueBias: 0.7 },
};

/**
 * Each window's take for a *typical* film, as a fraction of its reach base (see
 * engine/ancillary.ts:reachBase). The attribute multipliers do the
 * differentiating; keep these low so the median film's afterlife stays modest
 * and only the right films print (the §3.7 calibration invariant). catalogue is
 * a *per-surviving-year* rate, not a one-shot.
 */
export const WINDOW_BASE_RATES = {
  homeEntertainment: 0.1,
  licensing: 0.13,
  merchandising: 0.015,
  catalogueAnnual: 0.006,
} as const;

/**
 * Catalogue longevity shaping. A film below the floor is forgotten (no tail at
 * all); above it, `years = round(base + span·longevity)` with each year decaying
 * by DECAY. So a beloved award winner pays a small dividend for ~15 years; a
 * forgettable film pays nothing after its licensing wave.
 */
export const CATALOGUE = {
  minLongevity: 0.25,
  minYears: 3,
  spanYears: 12,
  decay: 0.85,
} as const;

/** Word-of-mouth lift on the reach base: a beloved film over-indexes downstream relative to its box office (audienceScore/100 scales this). */
export const REACH_BASE = {
  floor: 0.85,
  audienceLift: 0.3,
} as const;
