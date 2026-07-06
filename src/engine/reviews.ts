import { pickReviewBucket, REVIEW_BLURBS } from '../data/reviewBlurbs';
import { pickMany, type RandomFn } from './random';

/** Picks a couple of flavor-text review blurbs matching the critic/audience reception. */
export function pickReviewBlurbs(criticScore: number, audienceScore: number, rng: RandomFn, count = 2): string[] {
  const bucket = pickReviewBucket(criticScore, audienceScore);
  return pickMany(rng, REVIEW_BLURBS[bucket], count);
}
