// Market Research department - tunable numbers (docs/DESIGN_REVIEW_marketing_campaign.md,
// "tracking-as-a-service"). A purchasable, upgradable wing of the Production
// Office that sharpens the Marketing screen's Projected Opening readout. Same
// "plain data here, pure logic in engine/marketResearch.ts, wired in later"
// discipline as data/producers.ts. Charged out of studio cash, like an office
// upgrade.

// Highest level the department reaches. Level 0 is "no research bought" - the
// free baseline, available to everyone (see MARKET_RESEARCH_BAND_BY_TIER), not
// a level you're at.
export const MARKET_RESEARCH_MAX_TIER = 3;

// Cash cost to *reach* each level. Unlike the office's own tier 1 (a
// milestone-gated unlock, not bought), research level 1 is purchased like the
// levels above it - the office building just has to exist first.
export const MARKET_RESEARCH_UPGRADE_COST_BY_TIER: Record<number, number> = {
  1: 750_000,
  2: 2_000_000,
  3: 5_000_000,
};

// Half-width of the Projected Opening band, as a fraction of the true figure,
// at each level. Level 0 (no research) is a wide gut-feel range; each level
// narrows it. Never reaches zero - tracking buys confidence, never a guarantee
// (the honesty theme the campaign-angle mechanic already leans on).
export const MARKET_RESEARCH_BAND_BY_TIER: Record<number, number> = {
  0: 0.35,
  1: 0.2,
  2: 0.1,
  3: 0.04,
};

// A short label for what each level delivers, for the Office UI (F2) and the
// Marketing readout (F3).
export const MARKET_RESEARCH_TIER_LABEL: Record<number, string> = {
  0: 'No tracking',
  1: 'Basic tracking',
  2: 'Full tracking',
  3: 'Predictive analytics',
};
