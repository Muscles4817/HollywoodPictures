// Casting Redesign (docs/DESIGN_REVIEW_casting_redesign.md section 7) - no
// dedicated test coverage existed for this file before it was added.
import { describe, it, expect } from 'vitest';
import { describeApplicantInterest, describeOfferRejection } from './castingPresentation';
import type { ActorAppealFactors, OfferRejectionReason } from './castingAppeal';

function factors(overrides: Partial<ActorAppealFactors> = {}): ActorAppealFactors {
  return {
    suitability: 50, brandFit: 50, prestigeFit: 50, salaryFit: 50, scheduleFit: 50, attachmentMomentum: 50,
    ...overrides,
  };
}

describe('describeApplicantInterest', () => {
  it('falls back to a neutral line when nothing is notably high', () => {
    const description = describeApplicantInterest(factors({ suitability: 40, brandFit: 40, prestigeFit: 40, salaryFit: 40, scheduleFit: 40, attachmentMomentum: 40 }));
    expect(description).toBe('Applying on spec - nothing about this pitch stands out to them yet.');
  });

  it('names the single standout factor when only one is notably high', () => {
    const description = describeApplicantInterest(factors({ suitability: 95, brandFit: 40, prestigeFit: 40, salaryFit: 40, scheduleFit: 40, attachmentMomentum: 40 }));
    expect(description).toContain('Drawn to the role itself');
  });

  it('never names more than two factors, even when several are notably high', () => {
    const description = describeApplicantInterest(factors({ suitability: 95, brandFit: 90, prestigeFit: 90, salaryFit: 90, scheduleFit: 90, attachmentMomentum: 90 }));
    const namedFactorCount = (description.match(/ and /g) ?? []).length + 1;
    expect(namedFactorCount).toBeLessThanOrEqual(2);
  });

  it('always returns a non-empty sentence', () => {
    for (const suitability of [0, 25, 50, 75, 100]) {
      expect(describeApplicantInterest(factors({ suitability })).length).toBeGreaterThan(0);
    }
  });
});

describe('describeOfferRejection', () => {
  const reasons: OfferRejectionReason[] = ['suitability', 'brand-prestige-mismatch', 'salary', 'schedule'];

  it('returns a distinct, non-empty sentence for every reason', () => {
    const descriptions = reasons.map(describeOfferRejection);
    expect(new Set(descriptions).size).toBe(reasons.length);
    for (const d of descriptions) expect(d.length).toBeGreaterThan(0);
  });

  it('always starts with the same "they passed" framing', () => {
    for (const reason of reasons) {
      expect(describeOfferRejection(reason)).toMatch(/^They passed - /);
    }
  });
});
