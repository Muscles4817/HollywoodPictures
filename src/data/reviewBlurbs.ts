import type { Genre } from '../types';

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

export type Department = 'script' | 'direction' | 'acting' | 'production' | 'postProduction';

// Generic lines calling out the single weakest or strongest department, used
// when nothing genre-specific applies (see GENRE_SIGNATURE_CRITICISM/PRAISE
// below for the genre-flavored versions of script/acting/production).
export const DEPARTMENT_CRITICISM: Record<Department, string[]> = {
  script: [
    'The screenplay never quite finds its footing.',
    'Thin, undercooked writing undermines everything else.',
    'The plot holes are hard to ignore.',
  ],
  direction: [
    'Flat, uninspired direction saps the energy from scene after scene.',
    'The director never settles on a consistent tone.',
    "Pacing is the film's biggest enemy, and that's on the director's chair.",
  ],
  acting: [
    'Wooden performances drag every scene down.',
    'The cast never quite convinces.',
    'Line readings feel phoned in from start to finish.',
  ],
  production: [
    'Cut-rate sets and effects undercut every big moment.',
    'The film looks noticeably cheaper than it should.',
    'Production values never rise above serviceable.',
  ],
  postProduction: [
    'Choppy editing and a forgettable score do the film no favors.',
    'The cut feels rushed, like nobody had time for a second pass.',
    'Post-production polish is sorely missing.',
  ],
};

export const DEPARTMENT_PRAISE: Record<Department, string[]> = {
  script: [
    'A genuinely sharp, well-structured screenplay carries the whole film.',
    'The writing is easily the best thing about it.',
    'Smart, well-paced plotting from start to finish.',
  ],
  direction: [
    'Confident, assured direction holds everything together.',
    'Every scene shows a director in full control of the material.',
    'The direction elevates even the weaker moments.',
  ],
  acting: [
    'Performances that elevate the material at every turn.',
    'The cast is firing on all cylinders.',
    'Note-perfect performances across the board.',
  ],
  production: [
    'Handsome, well-mounted production values throughout.',
    'Money on the screen, in the best way.',
    'The sets and effects work do real heavy lifting here.',
  ],
  postProduction: [
    'A tight cut and a score that actually works.',
    'Sharp editing keeps the film moving.',
    'The post-production polish shows in every frame.',
  ],
};

// Genre-flavored variants of the script/acting/production lines above, used
// instead of the generic ones when the department in question is the one a
// genre's audience actually cares most about (see
// engine/genreWeights.ts:genreSignatureDepartment) - cheap effects sting more
// on a Sci-Fi film than a Drama, wooden chemistry sinks a Romance harder than
// an Action film.
export const GENRE_SIGNATURE_CRITICISM: Partial<Record<Genre, string[]>> = {
  Action: [
    'The action set pieces look cut-rate without the budget to back them up.',
    'Big stunts deserved a bigger effects budget.',
  ],
  Comedy: [
    'The cast can never quite sell the jokes.',
    'Comic timing needed stronger performances to really land.',
  ],
  Drama: [
    "The screenplay never earns the emotional weight it's reaching for.",
    'Dramatic stakes fall flat on the page before anyone even steps on set.',
  ],
  Horror: [
    "The scares never build to anything because the script doesn't do the legwork.",
    'Jump scares can only carry a thin script so far.',
  ],
  Romance: [
    'The leads never generate the chemistry this story needs.',
    'Without believable chemistry between the leads, the romance never lands.',
  ],
  'Sci-Fi': [
    'The world never feels real without the VFX budget to back it up.',
    'Cut-rate effects undercut the sense of scale a Sci-Fi film needs.',
  ],
  Fantasy: [
    'The world-building needed a bigger effects budget to feel believable.',
    'Cheap-looking effects undercut an otherwise ambitious world.',
  ],
  Thriller: [
    'The plotting never generates real tension - the script does the genre no favors.',
    'A thriller lives or dies on its plotting, and this one never quite tightens the screws.',
  ],
};

export const GENRE_SIGNATURE_PRAISE: Partial<Record<Genre, string[]>> = {
  Action: [
    'The action set pieces have real scale and impact.',
    'Money on screen where an action film needs it most - the stunts and effects.',
  ],
  Comedy: [
    'The cast has the comic timing to sell every joke.',
    'These performances are what make the comedy actually work.',
  ],
  Drama: [
    'A screenplay with the emotional depth a real drama needs.',
    'The writing earns every dramatic beat it reaches for.',
  ],
  Horror: [
    'A genuinely well-constructed horror screenplay, not just a string of jump scares.',
    'The script builds dread patiently instead of just going for cheap shocks.',
  ],
  Romance: [
    'The leads have the kind of chemistry that makes a romance actually work.',
    'Every scene between the two leads crackles.',
  ],
  'Sci-Fi': [
    'The visual effects fully sell this world.',
    'This is what a Sci-Fi budget is supposed to buy.',
  ],
  Fantasy: [
    'The effects and production design fully realize this world.',
    'This is a Fantasy that actually looks like it cost what it needed to.',
  ],
  Thriller: [
    'Tight, tension-building plotting from start to finish.',
    'The script keeps tightening the screws exactly when it needs to.',
  ],
};

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
