import { describe, it, expect } from 'vitest';
import { campaignWriteOff, campaignWriteOffFraction, commitmentAfterMove, describeCampaignWriteOff } from './campaignCommitment';
import type { CampaignCommitment } from '../types';

const TODAY = 500;
const commitment = (amount: number, forReleaseDay: number): CampaignCommitment =>
  ({ amount, committedOnDay: TODAY - 30, forReleaseDay });

describe('campaignWriteOffFraction', () => {
  it('is never free, however far out the date', () => {
    // Cancellation terms, forfeited placements, the agency's own work. Moving a
    // date always costs something.
    expect(campaignWriteOffFraction(10_000)).toBeGreaterThan(0);
    expect(campaignWriteOffFraction(400)).toBeGreaterThan(0);
  });

  it('is flat outside the buying window - nothing has been placed yet', () => {
    // Beyond the ramp only cancellation terms apply, so a date 200 days out and
    // one 400 days out cost the same to abandon. That is the point of committing
    // early being cheap to reverse and late being ruinous.
    expect(campaignWriteOffFraction(400)).toBe(campaignWriteOffFraction(200));
  });

  it('rises strictly once the campaign is being bought, and never exceeds all of it', () => {
    let previous = campaignWriteOffFraction(151);
    for (const days of [120, 90, 60, 30, 7, 0]) {
      const f = campaignWriteOffFraction(days);
      expect(f).toBeGreaterThan(previous);
      expect(f).toBeLessThanOrEqual(1);
      previous = f;
    }
  });

  it('writes off essentially everything on the eve of release', () => {
    expect(campaignWriteOffFraction(0)).toBe(1);
  });
});

describe('campaignWriteOff', () => {
  it('is zero when nothing is committed', () => {
    expect(campaignWriteOff(undefined, TODAY)).toBe(0);
    expect(campaignWriteOff(commitment(0, TODAY + 200), TODAY)).toBe(0);
  });

  it('costs far more to move a near date than a distant one', () => {
    const near = campaignWriteOff(commitment(10_000_000, TODAY + 20), TODAY);
    const far = campaignWriteOff(commitment(10_000_000, TODAY + 300), TODAY);
    expect(near).toBeGreaterThan(far * 3);
  });
});

describe('commitmentAfterMove', () => {
  it('carries what survives to the new date and remembers what did not', () => {
    // The campaign is not abandoned by a move, it is re-pointed at a cost.
    const before = commitment(10_000_000, TODAY + 200);
    const after = commitmentAfterMove(before, TODAY + 400, TODAY);
    expect(after.forReleaseDay).toBe(TODAY + 400);
    expect(after.amount).toBeLessThan(before.amount);
    expect(after.amount).toBeGreaterThan(0);
    expect(after.writtenOff).toBe(campaignWriteOff(before, TODAY));
  });

  it('accumulates the cost of repeated shuffling', () => {
    // Each move is charged on what is left, so the losses compound - which is
    // what makes a date a commitment rather than a preference.
    const first = commitmentAfterMove(commitment(10_000_000, TODAY + 200), TODAY + 300, TODAY);
    const second = commitmentAfterMove(first, TODAY + 500, TODAY);
    expect(second.writtenOff!).toBeGreaterThan(first.writtenOff!);
    expect(second.amount).toBeLessThan(first.amount);
  });
});

describe('describeCampaignWriteOff', () => {
  it('names the price rather than merely refusing', () => {
    expect(describeCampaignWriteOff(undefined, TODAY)).toBeNull();
    const text = describeCampaignWriteOff(commitment(5_000_000, TODAY + 60), TODAY)!;
    expect(text).toMatch(/\d+%/);
    expect(text).toContain('cannot follow');
  });
});
