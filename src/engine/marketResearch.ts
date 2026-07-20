// Market Research - pure logic (docs/DESIGN_REVIEW_marketing_campaign.md,
// "tracking-as-a-service"). Reads/derives the studio's research level and turns
// a true projected-opening figure into the band the player is actually shown.
// Plain data in, plain data out - no React, no state. Tunables live in
// data/marketResearch.ts.
import type { Money, Studio } from '../types';
import {
  MARKET_RESEARCH_BAND_BY_TIER,
  MARKET_RESEARCH_MAX_TIER,
  MARKET_RESEARCH_UPGRADE_COST_BY_TIER,
} from '../data/marketResearch';

/** The studio's current Market Research level (0 when no office, or none bought). */
export function marketResearchTier(studio: Studio): number {
  return studio.productionOffice?.marketResearchTier ?? 0;
}

/**
 * The level this studio could next buy/upgrade to, or null if it can't - either
 * the Production Office isn't unlocked yet (research is a department of it) or
 * the department is already maxed. Level 1 is bought like the rest; only the
 * office building itself is milestone-gated.
 */
export function nextMarketResearchTier(studio: Studio): number | null {
  if (studio.productionOffice == null) return null;
  const tier = marketResearchTier(studio);
  return tier < MARKET_RESEARCH_MAX_TIER ? tier + 1 : null;
}

/** Cash cost to reach the next research level, or null if there is no next level. */
export function marketResearchUpgradeCost(studio: Studio): Money | null {
  const next = nextMarketResearchTier(studio);
  return next != null ? (MARKET_RESEARCH_UPGRADE_COST_BY_TIER[next] ?? null) : null;
}

/** The band half-width fraction for a research level - falls back to the level-0 baseline. */
export function bandFractionForTier(tier: number): number {
  return MARKET_RESEARCH_BAND_BY_TIER[tier] ?? MARKET_RESEARCH_BAND_BY_TIER[0];
}

export interface TrackingBand {
  low: Money;
  high: Money;
  /** The band's half-width as a fraction of the true figure - 0.35 baseline down to 0.04 at max. */
  fraction: number;
}

/**
 * Turn a true projected-opening figure into the range the player sees at a
 * given research level. Symmetric in dollars around `trueOpening`, tightening
 * as the level rises; the low end is clamped at 0. Always a band, never a
 * single guaranteed number - even at the top level tracking buys confidence,
 * not certainty.
 */
export function trackingBand(tier: number, trueOpening: number): TrackingBand {
  const fraction = bandFractionForTier(tier);
  const halfWidth = Math.max(0, trueOpening) * fraction;
  return {
    low: Math.max(0, trueOpening - halfWidth),
    high: Math.max(0, trueOpening + halfWidth),
    fraction,
  };
}
