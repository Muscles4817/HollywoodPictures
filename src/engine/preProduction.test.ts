// Pre-production engine helpers (the day-by-day prep phase, types/index.ts:
// PreProductionState): the event roller, the starting-risk delta prep hands the
// shoot, and the quality events prep hands the finished film.
import { describe, it, expect } from 'vitest';
import { rollPreProductionDayEvent, computePrepRiskDelta, applyPrepRiskDelta, prepQualityEvents } from './production';
import { computeExecutionProfile } from './productionExecution';
import { createRng } from './random';
import type { PreProductionState, Person, PersonPersonality, ProductionChoices, ProductionEvent, ProductionRole, StaticProductionRisk, TalentAssignment } from '../types';

function person(id: string, over: Partial<PersonPersonality> = {}): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50, ...over },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {},
  };
}

const TALENT: TalentAssignment[] = [
  { role: 'Director' as ProductionRole, person: person('dir') },
  { role: 'Lead Actor' as ProductionRole, person: person('lead') },
];

const CHOICES: ProductionChoices = { shootingBudgetAmount: 500_000, setQualityAmount: 500_000, practicalEffectsAmount: 500_000, vfxAmount: 500_000, runtimeIntensity: 0.5 };

function prepWith(events: ProductionEvent[]): PreProductionState {
  return { status: 'finished', recommendedDays: 20, daysElapsed: 20, events, runningCost: 0, pendingChoice: null };
}

function ev(over: Partial<ProductionEvent>): ProductionEvent {
  return { id: 'e', description: 'e', severity: 'low', costDelta: 0, qualityDelta: 0, buzzDelta: 0, delayDaysDelta: 0, ...over };
}

describe('rollPreProductionDayEvent', () => {
  it('mostly rolls nothing, but produces prep-bank events over many days', () => {
    let events = 0;
    let choices = 0;
    const usedIds = new Set<string>();
    for (let day = 0; day < 400; day++) {
      const rolled = rollPreProductionDayEvent(TALENT, null, usedIds, createRng(day));
      if (!rolled) continue;
      if ('event' in rolled) { events++; usedIds.add(rolled.event.id); expect(rolled.event.id.startsWith('preprod-')).toBe(true); }
      else { choices++; usedIds.add(rolled.pendingChoice.templateId); expect(rolled.pendingChoice.templateId.startsWith('preprod-')).toBe(true); }
    }
    expect(events).toBeGreaterThan(0);
    expect(choices).toBeGreaterThan(0); // the bank has interactive prep decisions too
  });

  it('never repeats a template already used this prep', () => {
    const usedIds = new Set<string>();
    const seen: string[] = [];
    for (let day = 0; day < 400; day++) {
      const rolled = rollPreProductionDayEvent(TALENT, null, usedIds, createRng(day + 1000));
      if (!rolled) continue;
      const id = 'event' in rolled ? rolled.event.id : rolled.pendingChoice.templateId;
      expect(usedIds.has(id)).toBe(false);
      seen.push(id);
      usedIds.add(id);
    }
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('computePrepRiskDelta', () => {
  it('sums the prep events’ riskDelta', () => {
    expect(computePrepRiskDelta(prepWith([ev({ riskDelta: -8 }), ev({ riskDelta: -4 })]))).toBe(-12);
    expect(computePrepRiskDelta(prepWith([ev({ riskDelta: 5 }), ev({ riskDelta: 3 })]))).toBe(8);
  });

  it('clamps to a bounded swing and is zero for no prep / no risk events', () => {
    expect(computePrepRiskDelta(null)).toBe(0);
    expect(computePrepRiskDelta(prepWith([ev({ qualityDelta: 5 })]))).toBe(0);
    expect(computePrepRiskDelta(prepWith(Array.from({ length: 10 }, () => ev({ riskDelta: -20 }))))).toBe(-25);
    expect(computePrepRiskDelta(prepWith(Array.from({ length: 10 }, () => ev({ riskDelta: 20 }))))).toBe(25);
  });
});

describe('applyPrepRiskDelta', () => {
  const base: StaticProductionRisk = { moraleRisk: 50, safetyRisk: 50, technicalComplexity: 50, budgetRisk: 50 };
  it('lowers every dimension for good prep and raises them for bad, clamped 0-100', () => {
    expect(applyPrepRiskDelta(base, -15)).toEqual({ moraleRisk: 35, safetyRisk: 35, technicalComplexity: 35, budgetRisk: 35 });
    expect(applyPrepRiskDelta(base, 20)).toEqual({ moraleRisk: 70, safetyRisk: 70, technicalComplexity: 70, budgetRisk: 70 });
    expect(applyPrepRiskDelta({ moraleRisk: 5, safetyRisk: 95, technicalComplexity: 50, budgetRisk: 50 }, -10)).toEqual({ moraleRisk: 0, safetyRisk: 85, technicalComplexity: 40, budgetRisk: 40 });
  });
  it('is a no-op at delta 0', () => {
    expect(applyPrepRiskDelta(base, 0)).toBe(base);
  });
});

describe('prepQualityEvents (the finished-film merge)', () => {
  it('keeps only nonzero-quality prep events and zeroes their cost/buzz/delay (already charged live)', () => {
    const prep = prepWith([
      ev({ id: 'preprod-locations-locked-early', riskDelta: -8, qualityDelta: 0 }), // logistical: no film-quality effect
      ev({ id: 'preprod-table-read-revelation', qualityDelta: 5, costDelta: 40_000, buzzDelta: 3, delayDaysDelta: 2, impact: 'script' }),
    ]);
    const merged = prepQualityEvents(prep);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('preprod-table-read-revelation');
    expect(merged[0].qualityDelta).toBe(5);
    expect(merged[0].costDelta).toBe(0);
    expect(merged[0].buzzDelta).toBe(0);
    expect(merged[0].delayDaysDelta).toBe(0);
  });

  it('a positive prep quality event lifts the finished-film execution profile', () => {
    const prep = prepWith([ev({ id: 'preprod-table-read-revelation', qualityDelta: 6, impact: 'script' })]);
    const withPrep = computeExecutionProfile({ events: prepQualityEvents(prep), shootingRatio: 1, talent: TALENT, productionChoices: CHOICES });
    const withoutPrep = computeExecutionProfile({ events: [], shootingRatio: 1, talent: TALENT, productionChoices: CHOICES });
    expect(withPrep.scriptExecution).toBeGreaterThan(withoutPrep.scriptExecution);
    expect(withPrep.overall).toBeGreaterThan(withoutPrep.overall);
  });
});
