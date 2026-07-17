export function calculateStarRating(
  value: number,
  max = 100,
): number {
  return Math.max(
    0,
    Math.min(5, Math.round((value / max) * 10) / 2),
  );
}

/**
 * Turns a 0-100 "should I hire this person" score into the qualitative
 * verdict a casting card leads with (Talent Card UX Redesign) - the player's
 * real question is "should I hire them," not "what's their number," so this
 * is the headline reading a compatibility score becomes on the card, star
 * rating alongside it. Same five-tier shape as deriveMatchQualityLabel below,
 * worded for a hiring decision rather than a single stat's match quality.
 */
export function deriveHiringVerdict(score: number): string {
  if (score >= 90) return 'Excellent Match';
  if (score >= 75) return 'Strong Choice';
  if (score >= 60) return 'Good Fit';
  if (score >= 40) return 'Risky Choice';
  return 'Poor Fit';
}

/**
 * Same idea as deriveHiringVerdict, worded for one dimension of a
 * match/fit breakdown (e.g. "Comedy: Weak Match") rather than the overall
 * hiring decision - keeps a per-axis breakdown reading as "how well does
 * this one thing line up" instead of reusing hiring-decision language that
 * only makes sense about the whole person.
 */
export function deriveMatchQualityLabel(score: number): string {
  if (score >= 90) return 'Perfect Match';
  if (score >= 75) return 'Strong Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Weak Match';
  return 'Poor Match';
}