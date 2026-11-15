import { describe, it, expect } from 'vitest';
import { crossedRunningCostDay, quarterlyRunningCost, runningCostLines, yearlyRunningCost, RUNNING_COST_INTERVAL_DAYS } from './runningCosts';
import { createInitialStudio } from '../state/gameState';
import { studioReducer } from '../state/studioReducer';
import { buildStateWithReadyDraft } from '../state/testFixtures';
import type { Studio } from '../types';

const bare = createInitialStudio(10_000_000);
const big: Studio = {
  ...bare,
  distributionArm: { tier: 3, internationalTier: 3 },
  productionOffice: { tier: 3, benchProducerIds: [], marketResearchTier: 3 } as Studio['productionOffice'],
};

describe('running costs - the cost of being big', () => {
  it('a studio with no facilities pays nothing', () => {
    expect(yearlyRunningCost(bare)).toBe(0);
    expect(runningCostLines(bare)).toEqual([]);
  });

  it('a fully built studio pays for every facility, by tier', () => {
    const lines = runningCostLines(big).map((l) => l.label);
    expect(lines).toEqual(['Distribution arm', 'International distribution', 'Production office', 'Market research']);
    expect(yearlyRunningCost(big)).toBeGreaterThan(20_000_000);
    expect(yearlyRunningCost({ ...big, distributionArm: { tier: 1, internationalTier: 0 } })).toBeLessThan(yearlyRunningCost(big));
  });

  it('is billed a quarter at a time', () => {
    expect(quarterlyRunningCost(big)).toBeCloseTo(yearlyRunningCost(big) / (365 / RUNNING_COST_INTERVAL_DAYS), -2);
    expect(crossedRunningCostDay(RUNNING_COST_INTERVAL_DAYS - 1, RUNNING_COST_INTERVAL_DAYS)).toBe(true);
    expect(crossedRunningCostDay(10, 20)).toBe(false);
  });

  it('the reducer charges the bill, once, when the calendar crosses a quarter, and logs it', () => {
    const base = buildStateWithReadyDraft(3);
    const state = { ...base, totalDays: RUNNING_COST_INTERVAL_DAYS - 1, studio: { ...base.studio, ...big, cash: 50_000_000, cashLedger: [] } };
    const after = studioReducer(state, { type: 'ADVANCE_DAY' });
    const entry = (after.studio.cashLedger ?? []).find((e) => e.reason.startsWith('Running costs'));
    expect(entry?.amount).toBe(-quarterlyRunningCost(big));
    const next = studioReducer(after, { type: 'ADVANCE_DAY' });
    expect((next.studio.cashLedger ?? []).filter((e) => e.reason.startsWith('Running costs'))).toHaveLength(1);
  });
});
