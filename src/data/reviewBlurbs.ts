// Short review blurbs, bucketed by critic/audience reception quadrant.
// The engine picks a couple from the matching bucket for flavor text.
export const REVIEW_BLURBS = {
  lovedByBoth: [
    '"A triumph on every level." - critics and crowds agree.',
    '"Rare: a film that satisfies the head and the heart."',
    'Packed houses, standing ovations, no notes.',
  ],
  criticsLovedAudiencesShrugged: [
    '"Exquisite craft" say critics, though ticket buyers found it a slog.',
    'An arthouse darling that never found its mass audience.',
    '"Brilliant, if you have the patience for it."',
  ],
  audiencesLovedCriticsShrugged: [
    '"Critics were sniffy, but audiences had a blast." - box office report.',
    'Word of mouth carried this one far past the reviews.',
    '"Who cares what the critics think, this is a good time."',
  ],
  disliked: [
    '"A misfire from start to finish."',
    'Walkouts reported at several screenings.',
    '"Neither the critics nor the crowd were fooled."',
  ],
  mixed: [
    '"Has its moments, but never quite comes together."',
    'A perfectly serviceable watch, nothing more.',
    '"You could do worse for a Friday night."',
  ],
};

export type ReviewBucket = keyof typeof REVIEW_BLURBS;

export function pickReviewBucket(criticScore: number, audienceScore: number): ReviewBucket {
  const criticGood = criticScore >= 65;
  const audienceGood = audienceScore >= 65;
  const criticBad = criticScore < 40;
  const audienceBad = audienceScore < 40;

  if (criticGood && audienceGood) return 'lovedByBoth';
  if (criticBad && audienceBad) return 'disliked';
  if (criticGood && !audienceGood) return 'criticsLovedAudiencesShrugged';
  if (audienceGood && !criticGood) return 'audiencesLovedCriticsShrugged';
  return 'mixed';
}
