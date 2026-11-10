// Word of mouth is set by the gap between promise and delivery
// (docs/domain/16-critics-reviews-and-word-of-mouth.md §8.1, docs/domain/10 §4.3, §7.1;
// docs/DESIGN_REVIEW_box_office_variance_diagnosis.md §7a fix 2).
//
// The reference: "The transmission rate is set by the expectation gap, not by
// quality in the abstract - which is why an honestly sold modest film out-legs
// an over-sold good one." And the most reliable producer of a good multiple is
// "a film that over-delivers on a modest promise".
//
// The promise is the film's pre-release Buzz. The delivery is the same
// audience-weighted reception blend word of mouth already reads. Expected
// reception rises with Buzz; word of mouth's strength is scaled by how far
// delivery beat or missed it.
//
// Measured before this existed (6 seeds x 8 years, wide releases): Buzz is
// saturated (median 80, 38% of wide releases at 90-99) while delivered
// reception is flat at ~60 across every Buzz level - so a maximally hyped film
// that delivers an ordinary 60 paid nothing for the gap. Because the typical
// film IS hyped, the neutral point sits at the market median: this rewards and
// punishes deviation from what a film of that hype typically delivers, rather
// than taxing every hyped film.

/** Expected reception (0-100) for a film with zero Buzz. */
export const EXPECTED_RECEPTION_BASE = 46;
/** Expected reception points added per point of Buzz (Buzz 80, the market median, expects 60.4 - what the median wide release delivers - so the typical film is neutral; Buzz 25 expects 50.5, Buzz 98 expects 63.6). */
export const EXPECTED_RECEPTION_PER_BUZZ = 0.18;
/** Word-of-mouth multiplier change per EXPECTATION_GAP_SPAN points of over- or under-delivery. */
export const EXPECTATION_GAP_WEIGHT = 0.1;
/** Reception points that count as one unit of expectation gap. */
export const EXPECTATION_GAP_SPAN = 10;
/** Bounds on the expectation multiplier - a disappointment still gets some word of mouth, a delight can't run away. */
export const EXPECTATION_FACTOR_MIN = 0.7;
export const EXPECTATION_FACTOR_MAX = 1.2;
