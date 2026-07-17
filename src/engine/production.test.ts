import { describe, it, expect } from 'vitest';
import { computeRecommendedPreProductionDays, computeRecommendedShootDays, computeStaticProductionRisk } from './production';
import { generateScriptOptions } from './scriptGenerator';
import { generateTalentCandidates } from './talentGenerator';
import { withRng } from './random';
import { PRACTICAL_EFFECTS_RANGE, VFX_RANGE } from '../data/production';
import type { ProductionChoices, Script, TalentAssignment } from '../types';

function baseChoices(overrides: Partial<ProductionChoices> = {}): ProductionChoices {
  return {
    contingencyAmount: 500_000,
    setQualityAmount: 500_000,
    practicalEffectsAmount: PRACTICAL_EFFECTS_RANGE.min,
    vfxAmount: VFX_RANGE.min,
    runtimeIntensity: 0.5,
    ...overrides,
  };
}

function baseScript(seed: number, overrides: Partial<Script> = {}): Script {
  const { result: script } = withRng(seed, (rng) => generateScriptOptions('Action', rng, 1)[0]);
  return { ...script, ...overrides };
}

function assignmentsOfSize(seed: number, count: number): TalentAssignment[] {
  const { result: director } = withRng(seed, (rng) => generateTalentCandidates('Director', rng, 1)[0]);
  const assignments: TalentAssignment[] = [{ role: 'Director', person: director }];
  const { result: actors } = withRng(seed + 1, (rng) => generateTalentCandidates('Actor', rng, Math.max(0, count - 1)));
  actors.forEach((person, i) => assignments.push({ role: i === 0 ? 'Lead Actor' : 'Supporting Actor', person }));
  return assignments.slice(0, count);
}

describe('computeRecommendedPreProductionDays', () => {
  it('is always a positive whole number of days', () => {
    const script = baseScript(1, { scale: 'Medium' });
    const days = computeRecommendedPreProductionDays(assignmentsOfSize(1, 6), script, baseChoices());
    expect(days).toBeGreaterThan(0);
    expect(Number.isInteger(days)).toBe(true);
  });

  it('scales up with script scale: Epic needs more pre-production than Medium needs more than Intimate, all else equal', () => {
    const talent = assignmentsOfSize(2, 6);
    const choices = baseChoices();
    const intimateDays = computeRecommendedPreProductionDays(talent, baseScript(2, { scale: 'Intimate' }), choices);
    const mediumDays = computeRecommendedPreProductionDays(talent, baseScript(2, { scale: 'Medium' }), choices);
    const epicDays = computeRecommendedPreProductionDays(talent, baseScript(2, { scale: 'Epic' }), choices);
    expect(mediumDays).toBeGreaterThan(intimateDays);
    expect(epicDays).toBeGreaterThan(mediumDays);
  });

  it('a bigger cast needs more pre-production than a smaller one, all else equal', () => {
    const script = baseScript(3, { scale: 'Medium' });
    const choices = baseChoices();
    const smallCastDays = computeRecommendedPreProductionDays(assignmentsOfSize(3, 6), script, choices);
    const bigCastDays = computeRecommendedPreProductionDays(assignmentsOfSize(3, 12), script, choices);
    expect(bigCastDays).toBeGreaterThan(smallCastDays);
  });

  it('heavier effects ambition (practical + VFX) needs more pre-production than a minimal-effects plan, all else equal', () => {
    const script = baseScript(4, { scale: 'Medium' });
    const talent = assignmentsOfSize(4, 6);
    const minimalDays = computeRecommendedPreProductionDays(talent, script, baseChoices());
    const ambitiousDays = computeRecommendedPreProductionDays(
      talent,
      script,
      baseChoices({ practicalEffectsAmount: PRACTICAL_EFFECTS_RANGE.max, vfxAmount: VFX_RANGE.max }),
    );
    expect(ambitiousDays).toBeGreaterThan(minimalDays);
  });

  it('does not read runtimeIntensity or contingency/setQuality spend at all - only scale, cast size, and effects ambition drive it', () => {
    const script = baseScript(5, { scale: 'Medium' });
    const talent = assignmentsOfSize(5, 6);
    const days = computeRecommendedPreProductionDays(talent, script, baseChoices({ runtimeIntensity: 0 }));
    const daysAtMaxRuntime = computeRecommendedPreProductionDays(talent, script, baseChoices({ runtimeIntensity: 1 }));
    const daysAtHighSpend = computeRecommendedPreProductionDays(
      talent,
      script,
      baseChoices({ contingencyAmount: 20_000_000, setQualityAmount: 20_000_000 }),
    );
    expect(daysAtMaxRuntime).toBe(days);
    expect(daysAtHighSpend).toBe(days);
  });
});

// Character and Setting Foundations milestone
// (docs/CHARACTER_AND_SETTING_FOUNDATIONS.md section 8) - a travel-heavy,
// logistically complex Setting Archetype should add real schedule and risk
// pressure beyond what complexity/cast/effects ambition already capture.
describe('computeRecommendedShootDays - Setting Archetype influence', () => {
  it('a Global Multi-Location setting needs more shoot days than a Single Interior Location setting, all else equal', () => {
    const talent = assignmentsOfSize(8, 6);
    const choices = baseChoices();
    const contained = baseScript(8, { primarySetting: 'SingleInteriorLocation' });
    const travelHeavy = baseScript(8, { primarySetting: 'GlobalMultiLocation' });
    expect(computeRecommendedShootDays(talent, travelHeavy, choices)).toBeGreaterThan(
      computeRecommendedShootDays(talent, contained, choices),
    );
  });
});

describe('computeStaticProductionRisk - Setting Archetype influence', () => {
  it('a logistically demanding setting (Underwater) carries more safety risk than a contained one (Single Interior Location), all else equal', () => {
    const talent = assignmentsOfSize(9, 6);
    const choices = baseChoices();
    const contained = baseScript(9, { primarySetting: 'SingleInteriorLocation' });
    const demanding = baseScript(9, { primarySetting: 'UnderwaterEnvironment' });
    const containedRisk = computeStaticProductionRisk(talent, contained, choices, 'Action');
    const demandingRisk = computeStaticProductionRisk(talent, demanding, choices, 'Action');
    expect(demandingRisk.safetyRisk).toBeGreaterThan(containedRisk.safetyRisk);
  });

  it('an ambitious setting (Futuristic City) underfunded relative to a minimal spend carries more budget risk than a modest setting at the same spend', () => {
    const talent = assignmentsOfSize(10, 6);
    const minimalSpend = baseChoices({ practicalEffectsAmount: PRACTICAL_EFFECTS_RANGE.min, vfxAmount: VFX_RANGE.min, contingencyAmount: 0, setQualityAmount: 0 });
    const modest = baseScript(10, { primarySetting: 'SuburbanCommunity' });
    const ambitious = baseScript(10, { primarySetting: 'FuturisticCity' });
    const modestRisk = computeStaticProductionRisk(talent, modest, minimalSpend, 'Action');
    const ambitiousRisk = computeStaticProductionRisk(talent, ambitious, minimalSpend, 'Action');
    expect(ambitiousRisk.budgetRisk).toBeGreaterThan(modestRisk.budgetRisk);
  });
});
