import type { Genre, ReviewQuote } from '../types';
import {
  pickReviewBucket,
  REVIEW_BLURBS,
  DEPARTMENT_CRITICISM,
  DEPARTMENT_PRAISE,
  GENRE_SIGNATURE_CRITICISM,
  GENRE_SIGNATURE_PRAISE,
  CRITIC_REVIEW_LINES,
  AUDIENCE_REVIEW_LINES,
  reviewBand,
  type Department,
} from '../data/reviewBlurbs';
import { genreSignatureDepartment } from './genreWeights';
import { clamp, pick, pickMany, randInt, type RandomFn } from './random';

/** Picks a couple of flavor-text review blurbs matching the critic/audience reception. */
export function pickReviewBlurbs(criticScore: number, audienceScore: number, rng: RandomFn, count = 2): string[] {
  const bucket = pickReviewBucket(criticScore, audienceScore);
  return pickMany(rng, REVIEW_BLURBS[bucket], count);
}

// How far an individual quote's own displayed score can jitter from the real
// score it's drawn from - enough that three "reviewers" don't all print the
// identical number, not so much it can wander into a genuinely different
// band's territory except right at a boundary (accepted as a realistic
// quirk, not a bug - real reviewers disagree with the consensus sometimes).
const QUOTE_SCORE_JITTER = 8;

/**
 * `count` individually-rated quotes for the Premiere Reveal
 * (components/wizard/PremiereReveal.tsx) - distinct from pickReviewBlurbs
 * above, which stays a single shared-pool bucket for the historical dossier.
 * `voice` picks which of the two banks (data/reviewBlurbs.ts) to draw from;
 * every quote's own line is picked from the band `score` falls into
 * (reviewBand), and each gets its own jittered display score so three
 * reviewers agree with the real reception without printing the same number.
 */
export function pickScoredReviews(score: number, voice: 'critic' | 'audience', rng: RandomFn, count = 3): ReviewQuote[] {
  const bank = voice === 'critic' ? CRITIC_REVIEW_LINES : AUDIENCE_REVIEW_LINES;
  const lines = pickMany(rng, bank[reviewBand(score)], count);
  return lines.map((text) => ({
    text,
    score: clamp(score + randInt(rng, -QUOTE_SCORE_JITTER, QUOTE_SCORE_JITTER), 0, 100),
  }));
}

export interface DepartmentScores {
  scriptScore: number;
  directionScore: number;
  actingScore: number;
  productionScore: number;
  postProductionScore: number;
}

const CRITICISM_THRESHOLD = 45; // weakest department below this gets called out
const PRAISE_THRESHOLD = 70; // strongest department needs to clear this to get praised
const NOTHING_WRONG_FLOOR = 55; // ...and nothing can be weaker than this, or that's what gets mentioned instead

/**
 * A single line calling out the film's clear weak point (or, failing that,
 * its clear strong point) rather than generic praise/criticism - the same
 * idea as pickReviewBlurbs but grounded in which department actually earned
 * it. Prefers a genre-flavored line when the department in question is the
 * one this genre's audience cares about most (see genreSignatureDepartment)
 * and falls back to a generic department line otherwise. Returns null when
 * nothing stands out enough to be worth a dedicated line.
 */
export function pickDepartmentBlurb(scores: DepartmentScores, genre: Genre, rng: RandomFn): string | null {
  const entries: Array<{ department: Department; score: number }> = [
    { department: 'script', score: scores.scriptScore },
    { department: 'direction', score: scores.directionScore },
    { department: 'acting', score: scores.actingScore },
    { department: 'production', score: scores.productionScore },
    { department: 'postProduction', score: scores.postProductionScore },
  ];

  const weakest = entries.reduce((min, e) => (e.score < min.score ? e : min));
  const strongest = entries.reduce((max, e) => (e.score > max.score ? e : max));
  const signature = genreSignatureDepartment(genre);

  if (weakest.score < CRITICISM_THRESHOLD) {
    const genreLines = weakest.department === signature ? GENRE_SIGNATURE_CRITICISM[genre] : undefined;
    return pick(rng, genreLines ?? DEPARTMENT_CRITICISM[weakest.department]);
  }

  if (strongest.score >= PRAISE_THRESHOLD && weakest.score >= NOTHING_WRONG_FLOOR) {
    const genreLines = strongest.department === signature ? GENRE_SIGNATURE_PRAISE[genre] : undefined;
    return pick(rng, genreLines ?? DEPARTMENT_PRAISE[strongest.department]);
  }

  return null;
}
