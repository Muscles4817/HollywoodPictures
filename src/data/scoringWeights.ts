// Central tuning knobs for the simulation. All weights are on a 0-1 scale
// and each weighted group should sum to 1 so scores stay on a 0-100 scale.

export interface QualityWeights {
  script: number;
  direction: number;
  acting: number;
  postProduction: number;
  production: number;
  randomEvents: number;
}

// Final Quality Score = weighted average of these sub-scores, for a genre of
// exactly-average script/acting/production importance. Real films use
// engine/genreWeights.ts:computeQualityWeights instead, which tilts these
// per genre (a Drama leans harder on script+acting, an Action film leans
// harder on production) - this is just the reference point that tilts from.
export const BASE_QUALITY_WEIGHTS: QualityWeights = {
  script: 0.2,
  direction: 0.2,
  acting: 0.2,
  postProduction: 0.2,
  production: 0.1,
  randomEvents: 0.1,
};

// Critic Score leans on craft: quality, originality, direction, edit style.
export const CRITIC_WEIGHTS = {
  quality: 0.45,
  originality: 0.2,
  direction: 0.2,
  editStyle: 0.15,
};

// Audience Score leans on entertainment value: genre fit, star power, pacing/marketing.
export const AUDIENCE_WEIGHTS = {
  genreFit: 0.25,
  actorFame: 0.2,
  entertainment: 0.25,
  marketing: 0.15,
  production: 0.15,
};

// Box office and reputation are each a multiplicative chain rather than a
// weighted sum - see engine/boxOffice.ts and engine/reputation.ts, and the
// "Box Office" / "Reputation" sections of docs/DESIGN.md for the full formula.
