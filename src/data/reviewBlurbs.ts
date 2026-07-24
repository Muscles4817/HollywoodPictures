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

// --- Individually-rated Premiere Reveal quotes (engine/reviews.ts:pickScoredReviews) ---
//
// Distinct from REVIEW_BLURBS above (that bank is bucketed by the *combined*
// critic+audience quadrant and stays ungraded flavor text for the historical
// dossier, FilmDetailModal.tsx). These two banks are each keyed by a single
// voice's own score alone, six bands per voice, so a "critic" quote and a
// "fan" quote can land in different bands on the same film - exactly the
// point, since the two audiences don't always agree.
export type ReviewBand = 'savaged' | 'poor' | 'mixed' | 'solid' | 'excellent' | 'triumph';

/** Which band a single 0-100 score falls into - shared by both voice banks below. */
export function reviewBand(score: number): ReviewBand {
  if (score < 25) return 'savaged';
  if (score < 45) return 'poor';
  if (score < 60) return 'mixed';
  if (score < 75) return 'solid';
  if (score < 90) return 'excellent';
  return 'triumph';
}

// Analytical, trade-press voice - the same register REVIEW_BLURBS/DEPARTMENT_CRITICISM already write in.
export const CRITIC_REVIEW_LINES: Record<ReviewBand, string[]> = {
  savaged: [
    'A staggering miscalculation from frame one.',
    'Fails on nearly every level a film can fail on.',
    'There is no version of this that works.',
    'A career low for everyone involved.',
    'It is hard to imagine who this was made for.',
    'An interminable slog with nothing to recommend it.',
    'The rare film with no redeeming feature to point to.',
  ],
  poor: [
    'Undercooked and overlong.',
    "The ambition is visible; the execution isn't.",
    'A frustrating watch that never finds its footing.',
    'More miss than hit, and not for lack of trying.',
    'Sporadically interesting, mostly inert.',
    'The pieces are here; the film around them never arrives.',
    'You can feel the better film trapped inside this one.',
  ],
  mixed: [
    'Competent, occasionally clever, ultimately forgettable.',
    'Has a handful of good ideas buried in a middling film.',
    'Neither a disaster nor a success - just there.',
    'Worth a matinee, not much more.',
    'Perfectly watchable, entirely disposable.',
    'It works often enough to frustrate you when it doesn’t.',
    'A middleweight that never quite punches above itself.',
  ],
  solid: [
    'A well-made, confident piece of studio filmmaking.',
    'Delivers exactly what it promises, and does it well.',
    'Sturdy craft carries this one further than its premise alone would.',
    'Not groundbreaking, but genuinely well done.',
    'A satisfying, well-oiled piece of entertainment.',
    'Knows exactly what it is and executes it cleanly.',
    'The kind of dependable film that ages better than the flashy ones.',
  ],
  excellent: [
    'Sharp, assured, and frequently exhilarating.',
    'A genuine achievement in nearly every department.',
    'This is the kind of filmmaking studios should be proud of.',
    'Confident from the first frame to the last.',
    'Ambitious and, remarkably, in full command of that ambition.',
    'A film that earns every one of its big swings.',
    'Rich, precise, and quietly moving.',
  ],
  triumph: [
    'An instant classic.',
    'Filmmaking at the absolute top of its craft.',
    'This is the film of the year, full stop.',
    'Rarely does a film this ambitious land this cleanly.',
    'The kind of picture careers are measured against.',
    'A near-flawless marriage of craft and feeling.',
    'They will be studying this one for a long time.',
  ],
};

// Casual, first-person, word-of-mouth voice - the same register REVIEW_BLURBS's "audiencesLovedCriticsShrugged" lines already reach for.
export const AUDIENCE_REVIEW_LINES: Record<ReviewBand, string[]> = {
  savaged: [
    'Walked out halfway through. Never again.',
    "Worst theater experience I've had in years.",
    'Save your money, seriously.',
    'I want those two hours back.',
    'Checked my watch about forty times.',
    'We were laughing at it, not with it.',
    'Genuinely one of the worst I’ve sat through.',
  ],
  poor: [
    'Kind of a slog, not gonna lie.',
    'Expected way more than this.',
    'Fell asleep twice. That says it all.',
    "Wouldn't recommend it to a friend.",
    'Wanted to like it, just couldn’t.',
    'Left feeling pretty let down.',
    'Not terrible, but I wouldn’t bother.',
  ],
  mixed: [
    "It's fine. Wouldn't watch it again though.",
    'Some good parts, mostly just okay.',
    'Decent popcorn flick, nothing special.',
    'Fun enough for a Friday night, forget it by Monday.',
    'Glad I saw it once. Once.',
    'Waited-for-streaming energy, honestly.',
    'Perfectly okay. That’s about it.',
  ],
  solid: [
    'Really enjoyed this one, honestly!',
    'Solid watch, would recommend to friends.',
    'Better than I expected going in.',
    'Had a great time, no complaints.',
    'Way more fun than I thought it’d be.',
    'Good night out at the movies.',
    'Would happily watch it again.',
  ],
  excellent: [
    'Loved every minute of this!',
    "One of the best theater experiences I've had all year.",
    'Already planning to see it again.',
    'Everyone in the theater was buzzing after.',
    'Still thinking about it days later.',
    'Dragged my whole group back for a second viewing.',
    'Honestly did not want it to end.',
  ],
  triumph: [
    "Best movie I've seen in years, hands down.",
    'Standing ovation. Need I say more.',
    'Perfect. Absolutely perfect.',
    'This is why I go to the movies.',
    'I cried, I cheered, I saw it three times.',
    'A forever favourite. No notes.',
    'The whole theater was on its feet.',
  ],
};

// --- Department-anchored review lines (engine/reviews.ts:composeScoredReviews) ---
//
// The reviews the redesign leans on to *teach* the player: when one department
// clearly stands out - great or poor - a quote reaches for it by name, so
// repeated notes about (say) weak pacing or incredible effects become the
// pattern a player learns to read. Critics and audiences describe the SAME
// department in their own register (a critic notes "the screenplay's
// structure"; a viewer says "the story pulled me in"), and the two voices
// weight different departments (engine/reviews.ts), so they teach different
// signals - exactly the point.
export type ReviewValence = 'praise' | 'pan';

export const CRITIC_DEPARTMENT_LINES: Record<Department, Record<ReviewValence, string[]>> = {
  script: {
    praise: [
      'The screenplay is sharp, and its structure never sags.',
      'A genuinely intelligent script anchors the whole picture.',
      'The writing crackles from scene to scene.',
    ],
    pan: [
      'The screenplay is the weak link - thin and underwritten.',
      'A muddled script keeps undercutting everything around it.',
      'The dialogue lands with a thud more often than not.',
    ],
  },
  direction: {
    praise: [
      'Assured direction gives every scene real purpose.',
      'The director stages the whole thing with total control.',
      'Confident, unfussy direction holds it together.',
    ],
    pan: [
      'The direction is flat, and the pacing suffers for it.',
      'A tonally uncertain hand behind the camera.',
      'The film never finds a rhythm - and that’s on the direction.',
    ],
  },
  acting: {
    praise: [
      'The performances are the film’s clear highlight.',
      'A cast operating at the very top of its game.',
      'The lead turns are worth the price of admission alone.',
    ],
    pan: [
      'The performances rarely rise above serviceable.',
      'A miscast ensemble drains the drama out of it.',
      'The acting is stiff exactly where it needs to breathe.',
    ],
  },
  production: {
    praise: [
      'Handsome production design does real dramatic work.',
      'The craft on display is genuinely impressive.',
      'Every frame is meticulously mounted.',
    ],
    pan: [
      'The production values betray the budget at every turn.',
      'It looks conspicuously cheap for what it’s attempting.',
      'The effects undercut the very spectacle they’re reaching for.',
    ],
  },
  postProduction: {
    praise: [
      'Crisp editing and a strong score sharpen every beat.',
      'The cut is tight and the sound design immaculate.',
      'Impeccably assembled in the edit.',
    ],
    pan: [
      'Choppy editing keeps breaking the spell.',
      'The cut feels unfinished and the score forgettable.',
      'A ragged edit robs the film of its momentum.',
    ],
  },
};

export const AUDIENCE_DEPARTMENT_LINES: Record<Department, Record<ReviewValence, string[]>> = {
  script: {
    praise: [
      'The story really pulled me in.',
      'Didn’t see half the twists coming - loved it.',
      'Such a smart, satisfying story.',
    ],
    pan: [
      'The story just didn’t make much sense.',
      'Some of the dialogue was rough, not gonna lie.',
      'Plot had holes you could drive a truck through.',
    ],
  },
  direction: {
    praise: [
      'Gripping the whole way through.',
      'So well paced I never once looked away.',
      'It just flew by.',
    ],
    pan: [
      'Dragged so much in the middle.',
      'Kept losing my attention, honestly.',
      'Felt way longer than it actually was.',
    ],
  },
  acting: {
    praise: [
      'The two leads had unreal chemistry.',
      'The cast was so good together.',
      'I fell for these characters completely.',
    ],
    pan: [
      'Couldn’t buy the cast together at all.',
      'The acting kept taking me out of it.',
      'Zero chemistry between the leads.',
    ],
  },
  production: {
    praise: [
      'Looked absolutely incredible on the big screen.',
      'The effects were unreal.',
      'So worth seeing in a proper theater.',
    ],
    pan: [
      'The effects looked kind of cheap.',
      'You could tell where they saved money.',
      'Didn’t exactly look like the blockbuster it wanted to be.',
    ],
  },
  postProduction: {
    praise: [
      'The soundtrack was a whole vibe.',
      'Every scene just flowed into the next.',
      'Slick from start to finish.',
    ],
    pan: [
      'The editing was kind of all over the place.',
      'Some scenes cut so abruptly it was jarring.',
      'The music did not fit the film at all.',
    ],
  },
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
