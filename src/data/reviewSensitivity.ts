// How much a film's reviews move its OPENING weekend
// (docs/domain/16-critics-reviews-and-word-of-mouth.md §6, docs/domain/10 §6;
// docs/DESIGN_REVIEW_box_office_variance_diagnosis.md §7).
//
// The reference is explicit that the effect is real but highly conditional:
//   - adult drama / prestige: very high - reviews ARE the awareness mechanism
//   - wide adult drama or mid-budget comedy/thriller: a large critical gap moves
//     the opening "something in the range of 10-25%"
//   - horror: essentially review-insensitive
//   - pre-sold franchise / event: "a few percent at most" on the opening (the
//     damage lands in week two, through word of mouth, which the simulation
//     already reads critic score into)
//   - and the rule of thumb: sensitivity rises with how deliberately the viewer
//     has to choose, and with their age.
//
// Effect = sensitivity x review signal, applied to week-1 attendance only.
// Sensitivity is the fraction of the opening a FULL critical swing moves; the
// signal runs -1..+1 around the market's median critic score, so a market of
// ordinary reviews is left where it was and only the spread moves.

import type { Genre, TargetAudience } from '../types';

/** Base share of the opening a full critical swing moves, by genre. */
export const GENRE_REVIEW_SENSITIVITY: Record<Genre, number> = {
  Drama: 0.25, // reviews are the campaign
  Romance: 0.15,
  Thriller: 0.15,
  Comedy: 0.15, // "mid-budget comedy/thriller: moderate"
  'Sci-Fi': 0.1,
  Fantasy: 0.08,
  Action: 0.06, // event-leaning: the audience has largely decided
  Horror: 0, // "essentially review-insensitive"
};

/** Who the film is sold to: older and deliberate audiences read reviews; teens largely don't. */
export const AUDIENCE_REVIEW_MULTIPLIER: Record<TargetAudience, number> = {
  Critics: 1.4,
  Adults: 1.3,
  Niche: 1.2,
  Families: 1.0, // the parents deciding read them; the children don't
  'Mass Market': 1.0,
  Teens: 0.6,
};

/**
 * How far being pre-sold damps review sensitivity: at full franchise recognition
 * or full event scale the opening keeps only 1 - this of its sensitivity. A
 * tentpole "moves by a few percent at most".
 */
export const PRESOLD_REVIEW_DAMPING = 0.8;

// Release pattern decides HOW reviews act, not just how much (docs/domain/16 §6.1-6.2):
//   - Wide: reviews as PERMISSION - the audience already knows the film; reviews
//     license or withhold the marginal viewer on opening weekend. A week-1
//     attendance multiplier.
//   - Limited (platform/specialty): reviews as AWARENESS - "the reviews are the
//     campaign", and they keep working as the film expands. A multiplier on the
//     film's ongoing outside-awareness rate, so it reaches every week of the run
//     rather than spiking week 1 (which would erase the sleeper shape a platform
//     release lives by).
//   - Festival First: none of this - it already has its own critic gate on
//     expansion (criticLedExpansionWeight).
/** Weight of the week-1 (permission) effect, by release type. */
export const OPENING_REVIEW_WEIGHT = { Wide: 1.0, Limited: 0, 'Festival First': 0 } as const;
/** Weight of the ongoing-awareness effect, by release type - specialty releases live on their reviews, so above 1. */
export const AWARENESS_REVIEW_WEIGHT = { Wide: 0, Limited: 1.5, 'Festival First': 0 } as const;

/**
 * Of the opening-weekend viewers that bad reviews hold back, the share lost to
 * the theatrical run altogether - they wait for the home window rather than
 * come later (docs/domain/16 §6.1 "now happy to wait", §6.2: bad reviews push the
 * audience into the later window). The rest stay interested and can still be
 * won by word of mouth. Without this a pan only delays its audience, while a
 * rave's bigger opening compounds through word of mouth - a one-sided effect.
 */
export const REVIEW_WAITERS_LOST_SHARE = 0.5;

/** The market's median wide-release critic score (measured, 6 seeds x 8 years: p10 32, p50 51, p90 69). Reviews at the median move nothing. */
export const REVIEW_SIGNAL_PIVOT = 51;
/** Critic points from the pivot that count as a full (+-1) critical consensus. */
export const REVIEW_SIGNAL_SPAN = 20;
