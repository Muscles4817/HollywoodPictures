import type { Genre } from '../types';
import {
  pickReviewBucket,
  REVIEW_BLURBS,
  DEPARTMENT_CRITICISM,
  DEPARTMENT_PRAISE,
  GENRE_SIGNATURE_CRITICISM,
  GENRE_SIGNATURE_PRAISE,
  type Department,
} from '../data/reviewBlurbs';
import { genreSignatureDepartment } from './genreWeights';
import { pick, pickMany, type RandomFn } from './random';

/** Picks a couple of flavor-text review blurbs matching the critic/audience reception. */
export function pickReviewBlurbs(criticScore: number, audienceScore: number, rng: RandomFn, count = 2): string[] {
  const bucket = pickReviewBucket(criticScore, audienceScore);
  return pickMany(rng, REVIEW_BLURBS[bucket], count);
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
