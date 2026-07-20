// Casting Redesign (docs/DESIGN_REVIEW_casting_redesign.md section 7) - no
// dedicated test coverage existed for this file before it was added.
import { describe, it, expect } from 'vitest';
import { describeApplicantInterest, describeDirectorInterest, describeDirectorRejection, describeOfferRejection, describeScheduleRejection } from './castingPresentation';
import type { ActorAppealFactors, ActorScheduleAssessment, OfferRejectionReason } from './castingAppeal';
import type { DirectorAppealFactors, DirectorOfferRejectionReason } from './directorAppeal';

function factors(overrides: Partial<ActorAppealFactors> = {}): ActorAppealFactors {
  return {
    suitability: 50, brandFit: 50, prestigeFit: 50, salaryFit: 50, attachmentMomentum: 50,
    ...overrides,
  };
}

function directorFactors(overrides: Partial<DirectorAppealFactors> = {}): DirectorAppealFactors {
  return { scriptFit: 50, brandFit: 50, prestigeFit: 50, salaryFit: 50, ...overrides };
}

describe('describeApplicantInterest', () => {
  it('falls back to a neutral line when nothing is notably high', () => {
    const description = describeApplicantInterest(factors({ suitability: 40, brandFit: 40, prestigeFit: 40, salaryFit: 40, attachmentMomentum: 40 }));
    expect(description).toBe('Applying on spec - nothing about this pitch stands out to them yet.');
  });

  it('names the single standout factor when only one is notably high', () => {
    const description = describeApplicantInterest(factors({ suitability: 95, brandFit: 40, prestigeFit: 40, salaryFit: 40, attachmentMomentum: 40 }));
    expect(description).toContain('Drawn to the role itself');
  });

  it('never names more than two factors, even when several are notably high', () => {
    const description = describeApplicantInterest(factors({ suitability: 95, brandFit: 90, prestigeFit: 90, salaryFit: 90, attachmentMomentum: 90 }));
    const namedFactorCount = (description.match(/ and /g) ?? []).length + 1;
    expect(namedFactorCount).toBeLessThanOrEqual(2);
  });

  it('always returns a non-empty sentence', () => {
    for (const suitability of [0, 25, 50, 75, 100]) {
      expect(describeApplicantInterest(factors({ suitability })).length).toBeGreaterThan(0);
    }
  });

  // Casting Appeal Rework - naming the actual attached director, instead of
  // the generic "drawn in by who else is already attached" line, when
  // attachmentMomentum is the standout factor.
  it('names the attached director specifically when attachmentMomentum is the standout factor and a name is given', () => {
    const description = describeApplicantInterest(
      factors({ suitability: 40, brandFit: 40, prestigeFit: 40, salaryFit: 40, attachmentMomentum: 95 }),
      'Christopher Nolan',
    );
    expect(description).toContain('Christopher Nolan');
  });

  it('falls back to the generic momentum line when no director name is given', () => {
    const description = describeApplicantInterest(
      factors({ suitability: 40, brandFit: 40, prestigeFit: 40, salaryFit: 40, attachmentMomentum: 95 }),
    );
    expect(description).toContain('who else is already attached');
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

describe('describeScheduleRejection', () => {
  it('surfaces delayDays for a requires-delay assessment', () => {
    const assessment: ActorScheduleAssessment = { status: 'requires-delay', availableFromDay: 150, delayDays: 40 };
    expect(describeScheduleRejection(assessment)).toContain('40 days');
  });

  it('uses the singular "day" for a one-day delay', () => {
    const assessment: ActorScheduleAssessment = { status: 'requires-delay', availableFromDay: 101, delayDays: 1 };
    expect(describeScheduleRejection(assessment)).toContain('1 day,');
  });

  it('falls back to the generic schedule line for unavailable', () => {
    const assessment: ActorScheduleAssessment = { status: 'unavailable', availableFromDay: 500, delayDays: 400 };
    expect(describeScheduleRejection(assessment)).toBe(describeOfferRejection('schedule'));
  });
});

describe('describeDirectorInterest', () => {
  it('falls back to a neutral line when nothing is notably high', () => {
    const description = describeDirectorInterest(directorFactors({ scriptFit: 40, brandFit: 40, prestigeFit: 40, salaryFit: 40 }));
    expect(description).toBe('Considering it on spec - nothing about this pitch stands out to them yet.');
  });

  it('names the single standout factor when only one is notably high', () => {
    const description = describeDirectorInterest(directorFactors({ scriptFit: 95, brandFit: 40, prestigeFit: 40, salaryFit: 40 }));
    expect(description).toContain('excited by this script');
  });
});

describe('describeDirectorRejection', () => {
  const reasons: DirectorOfferRejectionReason[] = ['prestige-gate', 'script-fit', 'brand-prestige-mismatch', 'salary', 'schedule'];

  it('returns a distinct, non-empty sentence for every reason', () => {
    const descriptions = reasons.map(describeDirectorRejection);
    expect(new Set(descriptions).size).toBe(reasons.length);
    for (const d of descriptions) expect(d.length).toBeGreaterThan(0);
  });

  it('gives the prestige-gate reason its own distinct wording from a plain reputation mismatch', () => {
    expect(describeDirectorRejection('prestige-gate')).not.toBe(describeDirectorRejection('brand-prestige-mismatch'));
  });
});
