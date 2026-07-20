import { describe, it, expect } from 'vitest';
import {
  marketResearchTier,
  nextMarketResearchTier,
  marketResearchUpgradeCost,
  bandFractionForTier,
  trackingBand,
} from './marketResearch';
import {
  MARKET_RESEARCH_BAND_BY_TIER,
  MARKET_RESEARCH_MAX_TIER,
  MARKET_RESEARCH_UPGRADE_COST_BY_TIER,
} from '../data/marketResearch';
import type { ProductionOffice, Studio } from '../types';

function studioWith(office: ProductionOffice | null): Studio {
  // Only the fields these helpers touch matter; the rest is never read here.
  return { productionOffice: office } as Studio;
}

describe('marketResearchTier', () => {
  it('is 0 with no office, and 0 for an office that never bought in', () => {
    expect(marketResearchTier(studioWith(null))).toBe(0);
    expect(marketResearchTier(studioWith({ tier: 1, benchProducerIds: [] }))).toBe(0);
  });

  it('reads the stored level when present', () => {
    expect(marketResearchTier(studioWith({ tier: 2, benchProducerIds: [], marketResearchTier: 2 }))).toBe(2);
  });
});

describe('nextMarketResearchTier / marketResearchUpgradeCost', () => {
  it('are null with no office - research is a department that needs the building first', () => {
    expect(nextMarketResearchTier(studioWith(null))).toBeNull();
    expect(marketResearchUpgradeCost(studioWith(null))).toBeNull();
  });

  it('offers level 1 (bought, not milestone-gated) for a fresh unlocked office', () => {
    const s = studioWith({ tier: 1, benchProducerIds: [] });
    expect(nextMarketResearchTier(s)).toBe(1);
    expect(marketResearchUpgradeCost(s)).toBe(MARKET_RESEARCH_UPGRADE_COST_BY_TIER[1]);
  });

  it('are null once the department is maxed', () => {
    const s = studioWith({ tier: 1, benchProducerIds: [], marketResearchTier: MARKET_RESEARCH_MAX_TIER });
    expect(nextMarketResearchTier(s)).toBeNull();
    expect(marketResearchUpgradeCost(s)).toBeNull();
  });
});

describe('trackingBand', () => {
  it('brackets the true figure symmetrically at the level-0 baseline width', () => {
    const band = trackingBand(0, 20_000_000);
    expect(band.fraction).toBe(MARKET_RESEARCH_BAND_BY_TIER[0]);
    expect(band.low).toBe(20_000_000 * (1 - MARKET_RESEARCH_BAND_BY_TIER[0]));
    expect(band.high).toBe(20_000_000 * (1 + MARKET_RESEARCH_BAND_BY_TIER[0]));
  });

  it('tightens as the level rises but never collapses to a point', () => {
    const wide = trackingBand(0, 20_000_000);
    const tight = trackingBand(MARKET_RESEARCH_MAX_TIER, 20_000_000);
    const widthOf = (b: { low: number; high: number }) => b.high - b.low;
    expect(widthOf(tight)).toBeLessThan(widthOf(wide));
    expect(widthOf(tight)).toBeGreaterThan(0);
  });

  it('never reports negative dollars for a degenerate (zero/negative) opening', () => {
    const zero = trackingBand(0, 0);
    expect(zero.low).toBe(0);
    expect(zero.high).toBe(0);
    const negative = trackingBand(0, -5_000_000); // defensive: should never be fed one, never emits one
    expect(negative.low).toBe(0);
    expect(negative.high).toBe(0);
  });

  it('bandFractionForTier falls back to the baseline for an unknown level', () => {
    expect(bandFractionForTier(999)).toBe(MARKET_RESEARCH_BAND_BY_TIER[0]);
  });
});
