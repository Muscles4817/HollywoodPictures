// Central tuning knobs for the simulation. All weights are on a 0-1 scale
// and each weighted group should sum to 1 so scores stay on a 0-100 scale.

// Production and random events are no longer independent top-level terms -
// see engine/scoring.ts:computeQualityBreakdown's dependency chain.
// Production's influence now flows entirely through the "captured footage"
// ceiling that gates Post-Production, and events are folded directly into
// Production's own raw score as a modifier, rather than moving Quality
// Score on their own. QualityBreakdown/FilmResults still report a raw
// productionScore/eventsScore for display - see that file's own comments.
export interface QualityWeights {
  script: number;
  direction: number;
  acting: number;
  postProduction: number;
}

// Final Quality Score = weighted average of these sub-scores, for a genre of
// exactly-average script/acting importance. Real films use
// engine/genreWeights.ts:computeQualityWeights instead, which tilts script/
// acting per genre (a Drama leans harder on script+acting than an Action
// film does) - this is just the reference point that tilts from.
export const BASE_QUALITY_WEIGHTS: QualityWeights = {
  script: 0.25,
  direction: 0.25,
  acting: 0.25,
  postProduction: 0.25,
};

// Critic Score leans on craft: quality, originality, direction, edit style.
export const CRITIC_WEIGHTS = {
  quality: 0.45,
  originality: 0.2,
  direction: 0.2,
  editStyle: 0.15,
};

// Audience Score leans on entertainment value: genre fit, star power, pacing.
// Marketing deliberately isn't a term here - marketing builds awareness
// (Buzz -> Opening Weekend, see engine/boxOffice.ts), it doesn't make
// people who've actually seen the film like it any more than they would
// have otherwise, so it has no business informing this score.
export const AUDIENCE_WEIGHTS = {
  genreFit: 0.3,
  actorFame: 0.2,
  entertainment: 0.3,
  production: 0.2,
};

// Box office is a multiplicative chain rather than a weighted sum, and Brand/
// Prestige are each single formulas rather than a chain - see
// engine/boxOffice.ts and engine/reputation.ts, and the "Box Office" /
// "Brand Recognition and Prestige" sections of docs/DESIGN.md for the full
// formulas.
