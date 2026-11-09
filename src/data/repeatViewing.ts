// Repeat viewing (docs/domain/10-theatrical-release-and-box-office.md §16;
// docs/DESIGN_REVIEW_box_office_variance_diagnosis.md §7a fix 3).
//
// "The very biggest grosses in history are not explained by more people going;
// they are explained by the same people going again." It is a second audience at
// zero acquisition cost - and the only realistic way a film's admissions exceed
// its reachable audience. Typical repeat share of admissions (reference §16.1):
//
//   ordinary wide release                 2-5%
//   well-liked franchise title            8-15%
//   family/animation in a holiday corridor 10-20%
//   genuine cultural phenomenon           20-35%
//
// Modelled as: each week a share of the PREVIOUS week's first-time viewers come
// back once. That share is a small base for every film plus a repeatable film's
// extra, gated on how much audiences actually loved it (films people admire are
// not re-attended; films people love are). With a weekly return rate R the
// repeat share of admissions is roughly R / (1 + R): R 0.03 -> 3%, 0.18 -> 15%,
// 0.5 -> 33%.

import type { Genre, TargetAudience } from '../types';

/** Return rate every film gets regardless of repeatability - the "ordinary wide release" 2-5%. */
export const REPEAT_BASE_RATE = 0.03;
/** The extra return rate a maximally repeatable, maximally loved film earns on top (up to ~39% of admissions at the very top). Calibrated against the market: liked franchise and family films land at ~11% median, loved films 16% median / 22% p90 / 27% max - the reference bands. */
export const REPEAT_MAX_EXTRA_RATE = 0.6;

/**
 * Delivered reception (the same 70/30 audience/critic blend word of mouth reads)
 * below which nobody goes twice, and at which the full extra rate applies. Repeat
 * viewing is "films people love", so the gate opens late.
 */
export const REPEAT_RECEPTION_FLOOR = 60;
export const REPEAT_RECEPTION_FULL = 88;
/** Convexity of the reception gate - most well-liked films get a little, only the beloved get a lot. */
export const REPEAT_RECEPTION_EXPONENT = 1.5;

// What makes a film repeatable (reference §16.2): spectacle that rewards a
// better screen, density, social obligation (families), fandom identity,
// emotional re-experience, music. Combined as a weighted blend, 0..1.

/** Genre's own pull toward a second viewing (spectacle, density, emotion). There is no musical/animation genre; Fantasy and Sci-Fi carry the "see it again in IMAX" case. */
export const GENRE_REPEATABILITY: Record<Genre, number> = {
  Fantasy: 0.8,
  'Sci-Fi': 0.7,
  Action: 0.6,
  Romance: 0.5, // emotional re-experience
  Comedy: 0.4, // density of jokes
  Horror: 0.3,
  Drama: 0.3,
  Thriller: 0.3,
};

/** Who it's for: families run on social obligation, teens on fandom; adult audiences rarely return. */
export const AUDIENCE_REPEATABILITY: Record<TargetAudience, number> = {
  Families: 1.0,
  Teens: 0.8,
  'Mass Market': 0.5,
  Niche: 0.5, // fandom identity
  Adults: 0.2,
  Critics: 0.2,
};

/** Weights of the four repeatability drivers (sum 1). */
export const REPEATABILITY_WEIGHTS = { genre: 0.3, audience: 0.25, spectacle: 0.3, fandom: 0.15 } as const;
