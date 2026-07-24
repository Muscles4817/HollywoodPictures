// Casting Redesign (docs/DESIGN_REVIEW_casting_redesign.md section 7) - no
// dedicated test coverage existed for this file before it was added.
import { describe, it, expect } from 'vitest';
import { candidateStrengthSignals, directorStrengthSignals, describeApplicantInterest, describeDirectorInterest, describeDirectorRejection, describeOfferRejection, describeScheduleRejection } from './castingPresentation';
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

describe('candidateStrengthSignals', () => {
  const labels = (f: Partial<ActorAppealFactors>, director?: string) => candidateStrengthSignals(factors(f), director).map((s) => s.label);

  it('returns no chips when nothing is notably strong', () => {
    expect(candidateStrengthSignals(factors({ suitability: 40, brandFit: 20, prestigeFit: 20, salaryFit: 40, attachmentMomentum: 40 }))).toEqual([]);
  });

  it('surfaces a notable role fit as "Great fit"', () => {
    expect(labels({ suitability: 90, brandFit: 10, prestigeFit: 10, salaryFit: 40, attachmentMomentum: 40 })).toEqual(['Great fit']);
  });

  it('names the attached director on an attachment draw', () => {
    expect(labels({ attachmentMomentum: 92, suitability: 40, salaryFit: 40, brandFit: 10, prestigeFit: 10 }, 'Nolan')).toEqual(['Keen to work with Nolan']);
  });

  it('falls back to "Likes the lineup" for an attachment draw with no director attached', () => {
    expect(labels({ attachmentMomentum: 92, suitability: 40, salaryFit: 40, brandFit: 10, prestigeFit: 10 })).toEqual(['Likes the lineup']);
  });

  it('collapses brandFit + prestigeFit into a single "Likes your studio" chip', () => {
    const result = labels({ brandFit: 45, prestigeFit: 45, suitability: 40, salaryFit: 40, attachmentMomentum: 40 });
    expect(result).toEqual(['Likes your studio']);
  });

  it('caps at three chips and keeps the strongest, all positive-toned', () => {
    const signals = candidateStrengthSignals(factors({ suitability: 95, salaryFit: 92, attachmentMomentum: 90, brandFit: 45, prestigeFit: 45 }));
    expect(signals).toHaveLength(3);
    expect(signals.every((s) => s.tone === 'positive')).toBe(true);
    expect(signals[0].label).toBe('Great fit'); // strongest first
  });
});

describe('directorStrengthSignals', () => {
  it('surfaces a notable script fit and collapses reputation into one chip, capped and positive', () => {
    const signals = directorStrengthSignals(directorFactors({ scriptFit: 95, salaryFit: 90, brandFit: 45, prestigeFit: 45 }));
    const strs = signals.map((s) => s.label);
    expect(strs).toContain('Loves the script');
    expect(strs).toContain('Happy with the pay');
    expect(strs.filter((l) => l === 'Likes your studio')).toHaveLength(1); // reputation collapsed, not doubled
    expect(signals.every((s) => s.tone === 'positive')).toBe(true);
    expect(signals.length).toBeLessThanOrEqual(3);
  });

  it('returns nothing when no factor is notable', () => {
    expect(directorStrengthSignals(directorFactors({ scriptFit: 40, salaryFit: 40, brandFit: 20, prestigeFit: 20 }))).toEqual([]);
  });
});

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

// Actor identity reads (user request: the card should lead with WHO an actor
// is, not a role-fit score). describeSignatureGift/describeFameCraftContrast
// turn the engine categories (signatureGift/fameCraftContrast) into copy; the
// categorization itself is tested in actingModel.test.ts, so these check the
// null passthrough, stability, and that different gifts read differently.
import type { ActingStyle, Person } from '../types';
import { describeSignatureGift, describeFameCraftContrast } from './castingPresentation';

function actor(id: string, style: Partial<ActingStyle>, over: { fame?: number; craftFloor?: number; craftHeadroom?: number } = {}): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: over.fame ?? 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {
      actor: {
        role: 'Actor', active: true, experience: 50, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 100_000,
        actingStyle: { characterTransformation: 40, emotionalPerformance: 40, charisma: 40, comedy: 40, physicalPerformance: 40, ...style },
        craftFloor: over.craftFloor, craftHeadroom: over.craftHeadroom,
      },
    },
  };
}

describe('describeSignatureGift', () => {
  it('returns a non-empty line for an actor with a standout gift', () => {
    expect(describeSignatureGift(actor('a', { comedy: 90 }))).toBeTruthy();
  });

  it('is null for a rounded actor with no standout (the card leads with craft instead)', () => {
    expect(describeSignatureGift(actor('a', {}))).toBeNull();
  });

  it('is stable for a given person (same id -> same line, no rng)', () => {
    const a = actor('stable-actor', { charisma: 90 });
    expect(describeSignatureGift(a)).toBe(describeSignatureGift(a));
  });

  it('reads differently for different gift axes', () => {
    const comic = describeSignatureGift(actor('a', { comedy: 90 }));
    const physical = describeSignatureGift(actor('b', { physicalPerformance: 90 }));
    expect(comic).not.toBe(physical);
  });
});

describe('describeFameCraftContrast', () => {
  it('names the coaster trade for a famous, limited actor', () => {
    expect(describeFameCraftContrast(actor('a', {}, { fame: 82, craftFloor: 40, craftHeadroom: 10 }))).toBeTruthy();
  });

  it('is null when fame and craft roughly agree', () => {
    expect(describeFameCraftContrast(actor('a', {}, { fame: 50, craftFloor: 62, craftHeadroom: 10 }))).toBeNull();
  });

  it('reads the three contrasts as three distinct lines', () => {
    const coaster = describeFameCraftContrast(actor('a', {}, { fame: 82, craftFloor: 40, craftHeadroom: 10 }));
    const undiscovered = describeFameCraftContrast(actor('b', {}, { fame: 20, craftFloor: 78, craftHeadroom: 20 }));
    const star = describeFameCraftContrast(actor('c', {}, { fame: 82, craftFloor: 78, craftHeadroom: 20 }));
    expect(new Set([coaster, undiscovered, star]).size).toBe(3);
  });
});
