// Star power tunables (docs/DESIGN_REVIEW_star_power.md §3.1, phase 1).
//
// Fame is recognition: people have heard of this person. Draw is bankability:
// people go to a film BECAUSE of this person, in a particular genre. The
// research (docs/domain/17-star-power-and-its-decline.md §4.2) puts real draw
// in a small top tier, earned through openings and bound to genre. Every
// constant here shapes that tier; none of them touches the box office yet.
import type { ActingStyle, Genre } from '../types';

/**
 * Fame below which a person has no draw at all, however good their record.
 * Recognition is necessary for draw, not sufficient.
 */
export const DRAW_FAME_FLOOR = 65;

/**
 * Exponent of the fame curve above the floor: readiness = ((fame - floor) /
 * (100 - floor)) ^ exponent. Convex, so the curve is nearly flat through the
 * 70s and steep through the 90s - the "steep threshold" in `17` §4.2.
 * At 2.5: fame 80 -> ~0.12, 90 -> ~0.43, 95 -> ~0.68, 100 -> 1.
 */
export const DRAW_FAME_EXPONENT = 2.5;

/**
 * How much heat can swing draw either way. Heat is read as MOMENTUM - how far
 * someone runs above or below their own standing (currentHeat - fame) - not as
 * a second fame reading: a fame-95 star at heat 95 is simply where they are.
 * At +/-HEAT_MOMENTUM_SPAN the swing is the full fraction. (Generated talent
 * starts at heat == fame, so the world opens neutral; phase 3 moves heat with
 * results.)
 */
export const DRAW_HEAT_SWING = 0.15;
export const HEAT_MOMENTUM_SPAN = 40;

/**
 * Which parts of an actor's craft make audiences accept them in a genre - the
 * persona a star is bound to (`12` §3.3 item 3). Weights per genre sum to 1.
 * Used as the fallback where an actor has no lead record in a genre, and as
 * the genre picker for the seeded record.
 */
export const GENRE_PERSONA_WEIGHTS: Record<Genre, Partial<Record<keyof ActingStyle, number>>> = {
  Action: { physicalPerformance: 0.6, charisma: 0.4 },
  Comedy: { comedy: 0.7, charisma: 0.3 },
  Drama: { emotionalPerformance: 0.6, characterTransformation: 0.4 },
  Horror: { emotionalPerformance: 0.5, physicalPerformance: 0.5 },
  Romance: { charisma: 0.6, emotionalPerformance: 0.4 },
  'Sci-Fi': { physicalPerformance: 0.4, charisma: 0.3, characterTransformation: 0.3 },
  Fantasy: { charisma: 0.4, physicalPerformance: 0.3, characterTransformation: 0.3 },
  Thriller: { emotionalPerformance: 0.4, charisma: 0.3, physicalPerformance: 0.3 },
};

/**
 * What a persona fit alone is worth, with no record in the genre: at a perfect
 * fit, this fraction of a fully proven draw. Low on purpose - an unproven star
 * is a forecast, and the market discounts forecasts.
 */
export const PERSONA_PROOF_WEIGHT = 0.35;

/**
 * How much a proven record in one genre carries into another genre, as a
 * fraction of that record's value. A proven draw is somewhat proven
 * everywhere; mostly they are proven where they opened films.
 */
export const RECORD_SPILLOVER_WEIGHT = 0.3;

/**
 * Confidence in a genre record grows with outings: n / (n + this). At 1 the
 * first outing counts half, five outings count ~83%. Low n is the "is it a
 * pattern yet" question from `12` §3.3 item 4.
 */
export const RECORD_CONFIDENCE_HALF = 2;

/**
 * Each older outing counts this fraction of the one after it. The market
 * discounts fast (`12` §3.3 item 4): the last film matters most.
 */
export const RECORD_RECENCY_DECAY = 0.7;

/**
 * How much of a pre-sold film's opening is credited to its lead. At presold 1
 * (a franchise sequel), the outing counts for this fraction less - the
 * "star opening or franchise opening with a person in front of it" argument.
 */
export const PRESOLD_CREDIT_DISCOUNT = 0.6;

/** Most outings a lead record holds; older ones fall off. */
export const LEAD_RECORD_LENGTH = 5;

/**
 * Seeding the record at game start (no stored record yet). The world should
 * open with a few established draws and plenty of famous-but-unproven names,
 * not with every famous actor equally bankable.
 */
export const SEEDED_RECORD = {
  /** Fame below which someone has had no lead outings to speak of. */
  leadFameFloor: 40,
  /** Fame span over which outing count ramps from 0 to full. */
  leadFameSpan: 50,
  /** Age at which a lead career can begin, and the years over which a full record accumulates. */
  careerStartAge: 20,
  fullRecordYears: 20,
  /** Outing scores centre on (fame - this) / scoreFameSpan: famous people mostly got famous by opening films. */
  scoreFameCentre: 85,
  scoreFameSpan: 30,
  /** Half-width of the per-outing hashed noise on the score. */
  scoreNoise: 0.55,
  /** Chance an outing is in the actor's best-fit genre rather than the second. */
  bestGenreShare: 0.7,
  /** Hashed presold level is drawn from [0, this]. */
  maxPresold: 0.8,
} as const;

/**
 * Draw at or above which a person counts as a bankable star in the tier
 * diagnostic and (later) in presentation. The design target is ~15-30 actors
 * at or above this in their best genre, per 900-actor pool.
 */
export const BANKABLE_DRAW = 0.35;
