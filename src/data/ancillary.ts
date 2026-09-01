// Tunable data for the ancillary-revenue model (a film's post-theatrical life):
// home entertainment & digital, television/streaming licensing, merchandising,
// and the long-tail catalogue. See docs/DESIGN_REVIEW_studio_financial_model.md.
//
// The numbers below feed a derived profile (engine/ancillary.ts) that computes a
// film's post-theatrical potential on demand from attributes it already carries.
// The profile itself credits no cash and stores no state, but the revenue is
// real and paid - state/ancillarySettlement.ts materialises it into dated
// payouts for the player and credits a rival's afterlife as a lump.
// Rebalancing the whole system is meant to happen here and in the
// constants at the top of engine/ancillary.ts, never by threading magic numbers
// through logic (CLAUDE.md "Conventions worth keeping").
import type { Genre } from '../types';

/**
 * Per-genre ancillary signature - the one piece of genre data the redesign adds,
 * because GenreProfile (data/genres.ts) carries no family/merch/longevity flags
 * today. Each is a *multiplier* around 1.0 (merch is deliberately wider-range,
 * it is the sharpest genre differentiator):
 *  - homeEnt: rewatch/collectibility skew (Fantasy/Sci-Fi high, Drama low).
 *  - merch: toy/apparel/licensing potential (Fantasy/Sci-Fi high, Drama ~0) -
 *    this is what makes "adult dramas don't sell merch" fall out of the data.
 *  - catalogueBias: tendency toward a durable library tail (prestige-leaning and
 *    family-perennial genres higher).
 */
export interface GenreAncillaryProfile {
  homeEnt: number;
  /** TV, streaming and library licensing appetite. The reference's sharpest genre signal after merch, and the one this table used to be missing entirely. */
  licensing: number;
  merch: number;
  catalogueBias: number; // 0-1
}

// `homeEnt` was inverted relative to the reference and is now corrected. The
// old curve ran 1.5 for Fantasy down to 0.6 for Drama, on the reasoning that
// spectacle genres are more re-watched and collectible. The revenue-mix table in
// docs/domain/11-money-accounting-and-participations.md §3.4 says otherwise: home
// and digital is 10-15% of lifetime revenue for a four-quadrant tentpole and an
// animated family franchise, and 15-20% for horror, comedy and adult prestige -
// nearly flat, and if anything tilted AWAY from the big spectacle titles, whose
// lifetime is dominated by licensing and consumer products instead. A blockbuster
// sells more discs in absolute terms because it sold more tickets; it does not
// sell more per ticket sold, which is what this multiplier means.
//
// `merch` and `catalogueBias` keep their shape - the reference supports both (CP
// is 20-35% of an animated family franchise's lifetime and ~0 for every adult
// category; library value is what keeps prestige and franchise titles earning).
export const GENRE_ANCILLARY: Record<Genre, GenreAncillaryProfile> = {
  Action: { homeEnt: 0.85, licensing: 0.85, merch: 3.5, catalogueBias: 0.5 },
  'Sci-Fi': { homeEnt: 0.85, licensing: 0.85, merch: 4.5, catalogueBias: 0.7 },
  Fantasy: { homeEnt: 0.85, licensing: 0.8, merch: 5.0, catalogueBias: 0.8 },
  Horror: { homeEnt: 1.15, licensing: 1.05, merch: 1.2, catalogueBias: 0.6 },
  Comedy: { homeEnt: 1.15, licensing: 1.3, merch: 0.8, catalogueBias: 0.4 },
  Thriller: { homeEnt: 1.1, licensing: 1.2, merch: 0.6, catalogueBias: 0.4 },
  Romance: { homeEnt: 1.1, licensing: 1.35, merch: 0.3, catalogueBias: 0.5 },
  Drama: { homeEnt: 1.15, licensing: 1.5, merch: 0.05, catalogueBias: 0.7 },
};

/**
 * Each window's take for a *typical* film, as a fraction of its reach base (see
 * engine/ancillary.ts:reachBase). The attribute multipliers do the
 * differentiating; keep these low so the median film's afterlife stays modest
 * and only the right films print (the §3.7 calibration invariant). catalogue is
 * a *per-surviving-year* rate, not a one-shot.
 *
 * All four scaled by 0.41 against the ratified whole-P&L calibration
 * (docs/DESIGN_box_office_calibration_targets_v2_draft.md §5). These rates were
 * calibrated once before, against per-archetype ratios chosen by judgment; the
 * measured result was post-theatrical revenue worth **109% of theatrical
 * rentals** across the field, where the real figure from the four worked studio
 * P&Ls in docs/domain/11-money-accounting-and-participations.md §6.1 is 32-50%
 * (0.37 micro-budget horror, 0.45 mid-budget comedy, 0.73 prestige - flagged
 * there as "unusually high" - and 0.32 animated family, 0.52 counting consumer
 * products). Home entertainment alone was running at 50% of rentals and
 * licensing at another 42%, when in reality the two TOGETHER are most of the
 * downstream.
 *
 * Scaled UNIFORMLY on purpose: it is the level that was wrong, not the shape.
 * The genre and attribute multipliers keep every relative difference they had,
 * which is what the ratified target requires ("a flat rate would itself be
 * wrong" - family and animation genuinely do earn a larger downstream share).
 */
const POST_THEATRICAL_RECALIBRATION = 0.41;

// Re-weighted between windows against docs/domain/11 §3.4's revenue-mix table.
// Expressed as shares of post-theatrical revenue, that table runs home/digital
// 22-47%, licensing 30-70% and consumer products 0-48% depending on film type,
// averaging around 33 / 52 / 15 across a mainstream slate. The model was
// measured at 46 / 40 / 14 with the catalogue tail at under 1% - home
// entertainment over-weighted, and the library window, which §3 calls "the
// reliably profitable part of a studio" and the reason "loss-making prestige
// films still get made", effectively absent. Home comes down, licensing up, and
// the catalogue rate up several-fold so the library tail is a real channel
// rather than a rounding error.
export const WINDOW_BASE_RATES = {
  homeEntertainment: 0.105 * POST_THEATRICAL_RECALIBRATION,
  licensing: 0.23 * POST_THEATRICAL_RECALIBRATION,
  merchandising: 0.017 * POST_THEATRICAL_RECALIBRATION,
  catalogueAnnual: 0.036 * POST_THEATRICAL_RECALIBRATION,
} as const;

/**
 * Catalogue longevity shaping. A film below the floor is forgotten (no tail at
 * all); above it, `years = round(base + span·longevity)` with each year decaying
 * by DECAY. So a beloved award winner pays a small dividend for ~15 years; a
 * forgettable film pays nothing after its licensing wave.
 */
export const CATALOGUE = {
  // Lowered 0.25 -> 0.16: at the old floor a well-reviewed drama that won
  // nothing scored below it and was treated as forgotten, which is the opposite
  // of the film type the reference says library revenue exists for.
  minLongevity: 0.16,
  minYears: 3,
  spanYears: 12,
  decay: 0.85,
} as const;

/**
 * The reach base: how much post-theatrical value a film's theatrical run
 * establishes. `floor`/`audienceLift` are the word-of-mouth lift - a beloved
 * film over-indexes downstream relative to its box office.
 *
 * `grossExponent` makes it CONCAVE in worldwide gross rather than proportional
 * to it - see engine/ancillary.ts:computeReachBase for why, and for the
 * measurement that forced it. `referenceGross` is the anchor the curve pivots
 * around, set at the field's median wide-release gross so this redistributes
 * between big and small films without moving the field-wide level.
 */
export const REACH_BASE = {
  floor: 0.85,
  audienceLift: 0.3,
  referenceGross: 150_000_000,
  grossExponent: 0.77,
} as const;

/**
 * When each window's money arrives, as day offsets from the theatrical run's end
 * (Stage 2 of the design). Each non-catalogue window is split into installments
 * whose fractions sum to 1; this is what turns ancillary into a cash-flow
 * planning tool rather than one lump cheque. Merchandising leads (toys ship with
 * the film), then home entertainment, then the two licensing waves (pay-TV, then
 * streaming/free-TV). Catalogue pays once a year for its longevity span, starting
 * a year out. Tunable.
 */
export const ANCILLARY_TIMING = {
  merchandising: [
    { dayOffset: 0, fraction: 0.4 },
    { dayOffset: 120, fraction: 0.6 },
  ],
  homeEntertainment: [
    { dayOffset: 90, fraction: 0.5 },
    { dayOffset: 180, fraction: 0.3 },
    { dayOffset: 270, fraction: 0.2 },
  ],
  licensing: [
    { dayOffset: 210, fraction: 0.5 },
    { dayOffset: 480, fraction: 0.5 },
  ],
  catalogueFirstYearOffset: 365,
  catalogueYearLength: 365,
} as const;

/**
 * When the retroactive awards premium arrives, as day offsets from the ceremony
 * that granted it (state/ancillarySettlement.ts). A win lands AFTER a film's run
 * has finished and its ancillary is already scheduled; the incremental licensing
 * and catalogue value it unlocks is paid as a follow-on, not instantly - a
 * re-licensing bump, then a lift to the library tail. Tunable.
 */
export const AWARDS_PREMIUM_TIMING = {
  licensingOffset: 120,
  catalogueOffset: 240,
} as const;
