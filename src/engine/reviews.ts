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
  CRITIC_DEPARTMENT_LINES,
  AUDIENCE_DEPARTMENT_LINES,
  reviewBand,
  type Department,
  type ReviewValence,
} from '../data/reviewBlurbs';
import { genreSignatureDepartment } from './genreWeights';
import { clamp, pick, pickMany, randInt, weightedPick, type RandomFn } from './random';

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

// A department has to clearly stand apart from the middle of the pack before a
// review reaches for it by name - the same thresholds the results screen's
// strengths/weaknesses read (engine/premiereReport.ts), so what a review
// singles out and what the "Reaction" card lists never contradict each other.
const STANDOUT_STRONG = 68;
const STANDOUT_WEAK = 45;

// Which departments each voice tends to talk about. Critics reach for writing,
// direction and craft; audiences for the cast, the spectacle and the pacing -
// so the two voices teach the player to read different signals from the same
// film (the redesign's core idea). Weights, not hard filters: a strong-enough
// standout in any department can still surface for either voice.
const CRITIC_DEPARTMENT_AFFINITY: Record<Department, number> = {
  script: 3,
  direction: 3,
  acting: 2,
  production: 2,
  postProduction: 2,
};
const AUDIENCE_DEPARTMENT_AFFINITY: Record<Department, number> = {
  acting: 3,
  direction: 3,
  production: 3,
  script: 2,
  postProduction: 1,
};

interface AspectCandidate {
  department: Department;
  valence: ReviewValence;
  score: number;
}

/** Generic first, aspect second, alternating - so a film's reviews open with an overall impression, then a specific note, and don't always read the same way. */
function interleave<T>(primary: T[], secondary: T[]): T[] {
  const out: T[] = [];
  const max = Math.max(primary.length, secondary.length);
  for (let i = 0; i < max; i++) {
    if (i < primary.length) out.push(primary[i]);
    if (i < secondary.length) out.push(secondary[i]);
  }
  return out;
}

/**
 * The premiere reviews the redesign leans on to teach the player: a blend of
 * overall-impression quotes (drawn from the score-band bank, exactly as
 * pickScoredReviews always has) and department-anchored quotes that name a
 * clear standout - great or poor - so repeated notes about, say, weak pacing
 * or incredible effects become a pattern worth learning. The two voices weight
 * different departments (CRITIC/AUDIENCE_DEPARTMENT_AFFINITY), so critics and
 * audiences genuinely emphasise different things. Each aspect quote's own star
 * rating tracks the department it's about, not the film's overall score, so a
 * critic panning cheap effects reads lower than the mean - the stars carry
 * real information. Deterministic given the same rng; a perfectly balanced
 * film (no standouts) falls back to all generic quotes, unchanged.
 */
export function composeScoredReviews(params: {
  overallScore: number;
  voice: 'critic' | 'audience';
  departments: DepartmentScores;
  rng: RandomFn;
  count?: number;
}): ReviewQuote[] {
  const { overallScore, voice, departments, rng, count = 3 } = params;
  const deptLines = voice === 'critic' ? CRITIC_DEPARTMENT_LINES : AUDIENCE_DEPARTMENT_LINES;
  const affinity = voice === 'critic' ? CRITIC_DEPARTMENT_AFFINITY : AUDIENCE_DEPARTMENT_AFFINITY;

  const entries: Array<{ department: Department; score: number }> = [
    { department: 'script', score: departments.scriptScore },
    { department: 'direction', score: departments.directionScore },
    { department: 'acting', score: departments.actingScore },
    { department: 'production', score: departments.productionScore },
    { department: 'postProduction', score: departments.postProductionScore },
  ];

  const candidates: AspectCandidate[] = entries.flatMap((e): AspectCandidate[] => {
    if (e.score >= STANDOUT_STRONG) return [{ department: e.department, valence: 'praise', score: e.score }];
    if (e.score < STANDOUT_WEAK) return [{ department: e.department, valence: 'pan', score: e.score }];
    return [];
  });

  // Include up to two aspect-anchored quotes, but always leave at least one
  // generic quote for the overall impression - a film's reviews shouldn't read
  // like a department report card.
  const aspectTarget = Math.max(0, Math.min(candidates.length, count - 1, 2));

  const pool = [...candidates];
  const chosen: AspectCandidate[] = [];
  while (chosen.length < aspectTarget && pool.length > 0) {
    const weights: Partial<Record<Department, number>> = {};
    for (const c of pool) weights[c.department] = affinity[c.department];
    const department = weightedPick(rng, pool.map((c) => c.department), weights);
    const idx = pool.findIndex((c) => c.department === department);
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }

  const usedText = new Set<string>();
  const aspectQuotes: ReviewQuote[] = chosen.map((c) => {
    const bank = deptLines[c.department][c.valence];
    const options = bank.filter((t) => !usedText.has(t));
    const text = pick(rng, options.length > 0 ? options : bank);
    usedText.add(text);
    return { text, score: clamp(c.score + randInt(rng, -QUOTE_SCORE_JITTER, QUOTE_SCORE_JITTER), 0, 100) };
  });

  const genericQuotes = pickScoredReviews(overallScore, voice, rng, count - aspectQuotes.length);
  return interleave(genericQuotes, aspectQuotes).slice(0, count);
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
