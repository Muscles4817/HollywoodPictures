// Tunable data for backend participation (talent profit-sharing). A bankable
// star can trade a slice of guaranteed fee for a share of the film's receipts
// and/or milestone bonuses. See docs/DESIGN_REVIEW_studio_financial_model.md §4
// and engine/backend.ts. Rebalance here, not in the formulas.

/**
 * Who can command backend at all. Only genuinely bankable talent will trade cash
 * for points - a mid-tier actor takes scale. Eligibility blends fame with current
 * heat, so a red-hot actor a touch under the fame floor still qualifies, and a
 * once-famous but cold one drops off.
 */
export const BACKEND_ELIGIBILITY = {
  fameFloor: 62, // below this fame you generally can't get points...
  heatFloor: 72, // ...unless you're this hot right now.
} as const;

/**
 * The terms a star offers, scaled by how bankable they are (0 at the floor, 1 at
 * the top). Hotter, more ego-driven stars ask for more points and give a bigger
 * cut of guarantee - they believe in the upside and want more of it.
 */
export const BACKEND_TERMS = {
  // Gross-points structure: swap guarantee for a percentage of studio receipts.
  minPoints: 3,
  maxPoints: 9,
  minFeeDiscount: 0.35, // reduce the guaranteed fee by 35%..
  maxFeeDiscount: 0.65, // ..up to 65% for the most bankable.
  // Escalator structure: a smaller guarantee cut plus one-time milestone bonuses.
  escalatorFeeDiscount: 0.15,
  escalatorThresholds: [600_000_000, 900_000_000] as const, // worldwide gross triggers
  escalatorBonusFractions: [0.5, 1.0] as const, // each bonus as a multiple of the flat quote
} as const;

/** Weights blending a person's stats into a 0-1 bankability read (engine/backend.ts). */
export const BACKEND_BANKABILITY_WEIGHTS = {
  fame: 0.55,
  currentHeat: 0.3,
  ego: 0.15,
} as const;
