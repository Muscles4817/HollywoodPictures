// Where a person is in their career on the day the world begins
// (docs/DESIGN_talent_model.md, stage 1).
//
// Until this existed a person's age was rolled on its own and related to
// nothing: a 22-year-old could carry a GBP 20M quote, and a career's
// `experience` was a copy of its `skill`. This derives the three things a
// career actually has - how long it has run, how many films that made, and how
// seasoned that makes the person - from the role and from where they sit in its
// fee range, so that age, experience, credits and fee agree with each other.
//
// The link between fee and years is deliberately loose and differs by job, as
// it does in the real business (docs/domain/12 §4, §8). An actor can be famous
// young, so fee says little about their age. A head of department gets there by
// a ladder ten to twenty years long, so fee says a lot. Directors sit between.
// Either way plenty of cheap people are veterans who never broke through, and
// that is kept.
//
// Stage 1 changes no ability and no fee: skill, fame and salary are generated
// exactly as before. It only makes the career around them coherent, which the
// later stages (careers that move, ability read from a track record) build on.
//
// Pure: plain data in, plain data out.
import type { TalentProfession } from '../types';

export interface CareerShape {
  /** The youngest and oldest a person plausibly starts working in this role. */
  startAge: [number, number];
  /** The longest a career in the role runs. */
  spanYears: number;
  /**
   * 0..1 - how much of a career's length is explained by fee position. The rest
   * is the person's own roll, which is what leaves room for the young star and
   * the veteran who never got expensive.
   */
  feeLink: number;
  /** Finished films a working year typically yields in this role. */
  creditsPerYear: number;
  /**
   * Above 1 skews the person's own roll toward short careers. Acting is a young
   * pool with a long thin tail of veterans; a head of department has already
   * climbed a ladder to get the job, so those pools are not skewed.
   */
  newcomerSkew?: number;
}

export const CAREER_SHAPES: Record<TalentProfession | 'Producer', CareerShape> = {
  Actor: { startAge: [18, 30], spanYears: 45, feeLink: 0.2, creditsPerYear: 1.1, newcomerSkew: 1.7 },
  Director: { startAge: [26, 38], spanYears: 38, feeLink: 0.45, creditsPerYear: 0.35 },
  Writer: { startAge: [24, 36], spanYears: 38, feeLink: 0.45, creditsPerYear: 0.4 },
  Cinematographer: { startAge: [28, 40], spanYears: 34, feeLink: 0.5, creditsPerYear: 0.8 },
  Composer: { startAge: [25, 38], spanYears: 38, feeLink: 0.5, creditsPerYear: 1.0 },
  Editor: { startAge: [28, 40], spanYears: 34, feeLink: 0.5, creditsPerYear: 0.8 },
  'VFX Supervisor': { startAge: [28, 40], spanYears: 30, feeLink: 0.5, creditsPerYear: 0.6 },
  'Casting Director': { startAge: [27, 38], spanYears: 34, feeLink: 0.5, creditsPerYear: 1.4 },
  'Production Designer': { startAge: [30, 42], spanYears: 32, feeLink: 0.5, creditsPerYear: 0.6 },
  Producer: { startAge: [26, 40], spanYears: 36, feeLink: 0.5, creditsPerYear: 0.7 },
};

/** Nobody in the pool is older than this on day one. */
export const MAX_STARTING_AGE = 80;
/** Years in a role at which a person is as seasoned as they will get. */
export const FULLY_EXPERIENCED_YEARS = 25;

export interface CareerHistory {
  age: number;
  yearsActive: number;
  /** Finished films before the game began. */
  priorCredits: number;
  /** 0-100: how seasoned they are in the role. Years, not ability. */
  experience: number;
}

/** 0-100 experience for a number of years worked in the role. */
export function experienceFromYears(years: number): number {
  return Math.round(Math.min(1, Math.max(0, years) / FULLY_EXPERIENCED_YEARS) * 100);
}

/**
 * A person's career so far.
 *
 * @param feePosition 0..1, where they sit in the role's fee range.
 * @param startRoll   0..1, their own roll for how young they started.
 * @param yearsRoll   0..1, their own roll for how long they have been at it.
 * @param creditsRoll 0..1, their own roll for how prolific they have been.
 */
export function deriveCareerHistory(
  role: TalentProfession | 'Producer',
  feePosition: number,
  startRoll: number,
  yearsRoll: number,
  creditsRoll: number,
): CareerHistory {
  const shape = CAREER_SHAPES[role];
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const startAge = Math.round(shape.startAge[0] + (shape.startAge[1] - shape.startAge[0]) * clamp01(startRoll));
  const ownRoll = Math.pow(clamp01(yearsRoll), shape.newcomerSkew ?? 1);
  const position = shape.feeLink * clamp01(feePosition) + (1 - shape.feeLink) * ownRoll;
  const yearsActive = Math.max(0, Math.min(Math.round(shape.spanYears * position), MAX_STARTING_AGE - startAge));
  // Between 60% and 140% of the typical output for the years worked.
  const priorCredits = Math.round(yearsActive * shape.creditsPerYear * (0.6 + 0.8 * clamp01(creditsRoll)));
  return { age: startAge + yearsActive, yearsActive, priorCredits, experience: experienceFromYears(yearsActive) };
}
