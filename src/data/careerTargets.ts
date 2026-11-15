// The career bands the market-realism work aims at
// (docs/IMPLEMENTATION_PLAN_market_realism.md §1.3). Read by the career gate
// (state/careerGate.ts), which measures scripted player studios over a
// ten-year career. "Kinder than the real industry": a careful studio should
// usually grow, sometimes shrink, and never run away.

export interface CareerBands {
  /** Careers ending below starting cash, of the seeds run: [min, max]. */
  shrinkers: [number, number];
  /** Largest year-end cash / starting cash. */
  maxEndMultiple: number;
  /** Median year-end cash / starting cash: [min, max]. */
  medianEndMultiple: [number, number];
  /** Share of finished films (all careers pooled) that lose money all-in (cinema profit plus after-market), percent: [min, max]. */
  filmsLosingAllInPct: [number, number];
  /** Minimum share of career film profit earned by the best fifth of films, percent (median across careers). */
  topFifthShareOfProfitPct: number;
}

/** Careful and Steady, at Mid-Major and Major, ten years, seeds 101-110. */
export const CAREFUL_BIG_STUDIO_BANDS: CareerBands = {
  shrinkers: [1, 3],
  maxEndMultiple: 4,
  medianEndMultiple: [1, 2.5],
  filmsLosingAllInPct: [35, 45],
  topFifthShareOfProfitPct: 100,
};
