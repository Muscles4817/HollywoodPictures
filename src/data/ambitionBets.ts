// Ambition bets: reception reads REACH x DELIVERY on each thing a plan reached
// for (docs/DESIGN_REVIEW_ambition_and_delivery.md §2.1; SIMULATION_PHILOSOPHY.md
// Principle 1). A safe plan reaches for little, so how its shoot went barely
// moves its reception; an ambitious one is a bet in both directions.
//
// Concept (originality) already works this way (engine/scoring.ts
// CRITIC_AMBITION_GAIN / AUD_ALIENATION). These add the other two dimensions.
// Delivery is always read from the recorded shoot - never rolled - and centred
// on the MEASURED median shoot, so the typical film does not move; only the
// tails widen. (A previous attempt raised execution's gain directly and lifted
// the median instead of widening the spread: DESIGN_REVIEW_reception_model.md
// §4.5, attempt 2.)

// --- Structure: an intricate script that holds together, or confuses ---------

/** Script complexity (1-100) below which a film reaches for nothing structurally; reach saturates SPAN above it. Measured over rival plans: p50 28, p95 61. */
export const STRUCTURE_REACH_FLOOR = 30;
export const STRUCTURE_REACH_SPAN = 30;
/** Median performanceCapture and postExecution over 16 plans x 30 shoots - delivery is measured from these, so a median shoot is neutral. */
export const STRUCTURE_PERFORMANCE_MEDIAN = 1.048;
export const STRUCTURE_POST_MEDIAN = 0.969;
/** Multiplier distance from the median that counts as a full (+-1) delivery. p5..p95 of the two run ~0.84..1.15 and ~0.67..1.10. */
export const STRUCTURE_DELIVERY_SPAN = 0.1;
/** Critics reward an intricate film that holds together and mark down one that doesn't - two-sided. Below the concept bet's 18: structure is a craft ambition, not a whole film's identity. */
export const CRITIC_STRUCTURE_GAIN = 10;
/** Audiences punish a film that confuses them and barely reward one that merely holds together - one-sided, like AUD_ALIENATION. */
export const AUD_CONFUSION = 12;

// --- Spectacle: an event, or "it looks cheap" ---------------------------------

/** Facet ambition (0-100, weighted by the genre's effects importance) below which a film reaches for no spectacle; reach saturates SPAN above it. */
export const SPECTACLE_REACH_FLOOR = 35;
export const SPECTACLE_REACH_SPAN = 35;
/** Realised-minus-planned facet quality points (the facet execution swing) that count as a full (+-1) delivery. Measured swings run about -3..+5. */
export const SPECTACLE_DELIVERY_SPAN = 4;
/** Audiences read spectacle both ways: the effects were the draw, or they looked unfinished. */
export const AUD_SPECTACLE_GAIN = 10;
/** Critics notice it far less - a small mirror. */
export const CRITIC_SPECTACLE_GAIN = 3;
