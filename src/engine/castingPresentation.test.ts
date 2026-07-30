// Casting Redesign (docs/DESIGN_REVIEW_casting_redesign.md section 7) - no
// dedicated test coverage existed for this file before it was added.
import { describe, it, expect } from 'vitest';
import { candidateStrengthSignals, directorStrengthSignals, describeApplicantInterest, describeDirectorInterest, describeDirectorRejection, describeOfferRejection, describeScheduleRejection, describeCastAffinity, castAffinityTone } from './castingPresentation';
import type { ActorAppealFactors, ActorScheduleAssessment, OfferRejectionReason } from './castingAppeal';
import type { DirectorAppealFactors, DirectorOfferRejectionReason } from './directorAppeal';
import type { CastAffinity } from './pairHistory';

function partner(name: string): Person {
  return { id: name, identity: { name, appearanceTags: [] } } as unknown as Person;
}
function affinity(over: Partial<CastAffinity> = {}): CastAffinity {
  return { partner: partner('Jane Vane'), partnerRole: 'Director', chemistry: 0.6, films: 0, ...over };
}

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
import { describeSignatureGift, describeFameCraftContrast, describeCounterOffer, describeCounterReason, describeDealClosed, describeAskingEstimate, describeAcceptanceOdds, describeOpenCastingForecast, describeAuditionResult } from './castingPresentation';

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

describe('describeCastAffinity / castAffinityTone (Phase 4 - the cast-affinity chip)', () => {
  it('leads with a proven partnership and names the partner when there is shared history', () => {
    const line = describeCastAffinity(affinity({ films: 2, chemistry: 0.5 }));
    expect(line).toContain('Proven partnership');
    expect(line).toContain('twice');
    expect(line).toContain('director');
    expect(line).toContain('Jane Vane');
  });

  it('reads a fresh positive pairing as a natural fit', () => {
    const line = describeCastAffinity(affinity({ films: 0, chemistry: 0.5 }));
    expect(line).toContain('natural fit');
    expect(line).toContain('Jane Vane');
  });

  it('warns on a fresh negative pairing', () => {
    expect(describeCastAffinity(affinity({ films: 0, chemistry: -0.5 }))).toContain('clash');
  });

  it('reads a soured shared history distinctly from a fresh clash', () => {
    expect(describeCastAffinity(affinity({ films: 2, chemistry: -0.5 }))).toContain("didn't gel");
  });

  it('tones positive vs negative by the sign of the chemistry', () => {
    expect(castAffinityTone(affinity({ chemistry: 0.4 }))).toBe('positive');
    expect(castAffinityTone(affinity({ chemistry: -0.4 }))).toBe('negative');
  });

  it('never leaks a raw number into the prose', () => {
    const line = describeCastAffinity(affinity({ films: 2, chemistry: 0.73 }));
    expect(line).not.toMatch(/0\.73|73/);
  });
});

describe('negotiation prose (Phase E)', () => {
  it('embeds the UI-formatted counter figure and never a raw stat number', () => {
    const line = describeCounterOffer(actor('c', {}, { fame: 40 }), '$2.5M');
    expect(line).toContain('$2.5M');
    expect(line).toMatch(/holding out/i);
    // no leaked internal stat values (fame/heat/ego are all 40-50 here)
    expect(line).not.toMatch(/\b(40|50)\b/);
  });

  it('reads a hot-streak hold distinctly from a humble one', () => {
    const base = actor('hot', {}, { fame: 55 });
    const hotActor: Person = { ...base, reputation: { ...base.reputation, currentHeat: 90 } };
    const hot = describeCounterReason(hotActor);
    const humble = describeCounterReason(actor('humble', {}, { fame: 30 }));
    expect(hot).not.toBe(humble);
    expect(hot).toMatch(/moment/i);
  });

  it('calls out a below-quote close, but stays plain for a standard one', () => {
    expect(describeDealClosed(true)).toMatch(/under their usual quote/i);
    expect(describeDealClosed(false)).not.toMatch(/under their usual quote/i);
  });
});

describe('pre-offer estimate prose (Phase 2)', () => {
  it('hedges the asking-price band by confidence, embedding the UI-formatted range', () => {
    expect(describeAskingEstimate('£2M–£4M', 'high')).toContain('£2M–£4M');
    expect(describeAskingEstimate('£2M–£4M', 'high')).toMatch(/should want/i);
    expect(describeAskingEstimate('£2M–£4M', 'low')).toMatch(/guess/i);
    // the hedge differs by confidence
    expect(describeAskingEstimate('£2M–£4M', 'high')).not.toBe(describeAskingEstimate('£2M–£4M', 'low'));
  });

  it('maps acceptance odds to a labelled, toned signal', () => {
    expect(describeAcceptanceOdds('likely').tone).toBe('positive');
    expect(describeAcceptanceOdds('even').tone).toBe('warning');
    expect(describeAcceptanceOdds('long-shot').tone).toBe('blocked');
    expect(describeAcceptanceOdds('likely').label).toMatch(/land them/i);
    expect(describeAcceptanceOdds('no').label.length).toBeGreaterThan(0);
  });
});

describe('describeOpenCastingForecast (Phase 5)', () => {
  it('gives a volume+field estimate and a confidence line, tuned by the read', () => {
    const low = describeOpenCastingForecast({ weeklyLow: 1, weeklyHigh: 3, quality: 'deep', confidence: 'low' });
    expect(low.estimate).toMatch(/1–3 applicants a week/);
    expect(low.estimate).toMatch(/deep field/i);
    expect(low.confidence).toMatch(/without a casting director/i);

    const high = describeOpenCastingForecast({ weeklyLow: 1, weeklyHigh: 5, quality: 'thin', confidence: 'high' });
    expect(high.confidence).toMatch(/confident/i);
    expect(high.estimate).toMatch(/thin field/i);
  });
});

describe('describeAuditionResult', () => {
  it('names the actor and character, and grades a great read differently from a poor one', () => {
    const great = describeAuditionResult('Ava Stone', 'Celine', 'p1', 95);
    const poor = describeAuditionResult('Ava Stone', 'Celine', 'p1', 20);
    expect(great).toMatch(/Ava Stone/);
    expect(great).toMatch(/Celine/);
    expect(great).not.toBe(poor);
  });

  it('every variant of every grade interpolates both the actor and the character', () => {
    // 200 ids spread the stable hash across the whole pool of each grade, so this
    // effectively checks every line carries both tokens (no bare/ungrounded copy).
    for (const score of [95, 80, 65, 50, 20]) {
      for (let i = 0; i < 200; i++) {
        const line = describeAuditionResult('Nova Vale', 'Marlowe', `id-${i}`, score);
        expect(line).toMatch(/Nova Vale/);
        expect(line).toMatch(/Marlowe/);
      }
    }
  });

  it('is deterministic for the same read (no RNG)', () => {
    expect(describeAuditionResult('Ava Stone', 'Celine', 'p1', 80)).toBe(describeAuditionResult('Ava Stone', 'Celine', 'p1', 80));
  });

  it('draws excellent and poor reads from separate, non-overlapping pools', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `p${i}`);
    const excellent = new Set(ids.map((id) => describeAuditionResult('Actor', 'Role', id, 95)));
    const poor = new Set(ids.map((id) => describeAuditionResult('Actor', 'Role', id, 20)));
    for (const line of excellent) expect(poor.has(line)).toBe(false);
  });

  it('offers a wide, varied pool of phrasings within a grade', () => {
    const ids = Array.from({ length: 300 }, (_, i) => `person-${i}`);
    const distinct = new Set(ids.map((id) => describeAuditionResult('Actor', 'Role', id, 95)));
    // ~10 variants per grade; the hash should surface most of them across 300 ids.
    expect(distinct.size).toBeGreaterThanOrEqual(8);
  });
});
