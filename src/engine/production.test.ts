import { describe, it, expect } from 'vitest';
import { computeRecommendedPostProductionDays, computeRecommendedPreProductionDays, computeRecommendedShootDays, computeStaticProductionRisk, footageLowerBound, footageUpperBound } from './production';
import { editCoverageCeiling } from './productionDials';
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

/** An Editor TalentAssignment with a forced skill value, for exercising computeRecommendedPostProductionDays' own skill sensitivity directly rather than hoping a generated candidate happens to land at a useful value. */
function editorWithSkill(seed: number, skill: number): TalentAssignment {
  const { result: editor } = withRng(seed, (rng) => generateTalentCandidates('Editor', rng, 1)[0]);
  return { role: 'Editor', person: { ...editor, careers: { ...editor.careers, editor: { ...editor.careers.editor!, skill } } } };
}

/** Same idea as editorWithSkill, for VFX Supervisor. */
function vfxSupervisorWithSkill(seed: number, skill: number): TalentAssignment {
  const { result: vfxSupervisor } = withRng(seed, (rng) => generateTalentCandidates('VFX Supervisor', rng, 1)[0]);
  return {
    role: 'VFX Supervisor',
    person: { ...vfxSupervisor, careers: { ...vfxSupervisor.careers, vfxSupervisor: { ...vfxSupervisor.careers.vfxSupervisor!, skill } } },
  };
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

// Post-Production Redesign, Phase A
// (docs/DESIGN_REVIEW_post_production_redesign.md section 1).
describe('computeRecommendedPostProductionDays', () => {
  it('is always a positive whole number of days', () => {
    const talent = [...assignmentsOfSize(20, 6), editorWithSkill(20, 50)];
    const days = computeRecommendedPostProductionDays(talent, baseChoices());
    expect(days).toBeGreaterThan(0);
    expect(Number.isInteger(days)).toBe(true);
  });

  it('a Long-intensity film needs more post-production than a Short one, all else equal', () => {
    const talent = [...assignmentsOfSize(21, 6), editorWithSkill(21, 50)];
    const shortDays = computeRecommendedPostProductionDays(talent, baseChoices({ runtimeIntensity: 0 }));
    const longDays = computeRecommendedPostProductionDays(talent, baseChoices({ runtimeIntensity: 1 }));
    expect(longDays).toBeGreaterThan(shortDays);
  });

  it('heavier VFX ambition needs more post-production than minimal VFX spend, all else equal', () => {
    const talent = [...assignmentsOfSize(22, 6), editorWithSkill(22, 50)];
    const minimalVfxDays = computeRecommendedPostProductionDays(talent, baseChoices({ vfxAmount: VFX_RANGE.min }));
    const heavyVfxDays = computeRecommendedPostProductionDays(talent, baseChoices({ vfxAmount: VFX_RANGE.max }));
    expect(heavyVfxDays).toBeGreaterThan(minimalVfxDays);
  });

  it('does not read practicalEffectsAmount at all - only vfxAmount drives the VFX component', () => {
    const talent = [...assignmentsOfSize(23, 6), editorWithSkill(23, 50)];
    const minimalPractical = computeRecommendedPostProductionDays(talent, baseChoices({ practicalEffectsAmount: PRACTICAL_EFFECTS_RANGE.min }));
    const heavyPractical = computeRecommendedPostProductionDays(talent, baseChoices({ practicalEffectsAmount: PRACTICAL_EFFECTS_RANGE.max }));
    expect(heavyPractical).toBe(minimalPractical);
  });

  it('a stronger Editor produces a shorter estimate than a weaker one, all else equal', () => {
    const choices = baseChoices({ runtimeIntensity: 1 });
    const base = assignmentsOfSize(24, 6);
    const weakEditorDays = computeRecommendedPostProductionDays([...base, editorWithSkill(24, 0)], choices);
    const strongEditorDays = computeRecommendedPostProductionDays([...base, editorWithSkill(24, 100)], choices);
    expect(strongEditorDays).toBeLessThan(weakEditorDays);
  });

  it('a stronger VFX Supervisor produces a shorter estimate than a weaker one, when VFX ambition is high', () => {
    const choices = baseChoices({ vfxAmount: VFX_RANGE.max });
    const base = [...assignmentsOfSize(25, 6), editorWithSkill(25, 50)];
    const weakVfxSupDays = computeRecommendedPostProductionDays([...base, vfxSupervisorWithSkill(25, 0)], choices);
    const strongVfxSupDays = computeRecommendedPostProductionDays([...base, vfxSupervisorWithSkill(25, 100)], choices);
    expect(strongVfxSupDays).toBeLessThan(weakVfxSupDays);
  });

  it('VFX Supervisor skill barely moves the estimate when VFX ambition is minimal - the term it scales is already close to zero', () => {
    const choices = baseChoices({ vfxAmount: VFX_RANGE.min });
    const base = [...assignmentsOfSize(26, 6), editorWithSkill(26, 50)];
    const weakVfxSupDays = computeRecommendedPostProductionDays([...base, vfxSupervisorWithSkill(26, 0)], choices);
    const strongVfxSupDays = computeRecommendedPostProductionDays([...base, vfxSupervisorWithSkill(26, 100)], choices);
    expect(weakVfxSupDays - strongVfxSupDays).toBeLessThanOrEqual(2);
  });

  it('works correctly with no VFX Supervisor hired - lands strictly between a weak (skill 0) and a neutral (skill 50) hired one', () => {
    const choices = baseChoices({ vfxAmount: VFX_RANGE.max });
    const base = [...assignmentsOfSize(27, 6), editorWithSkill(27, 50)];
    const noSupervisorDays = computeRecommendedPostProductionDays(base, choices);
    const weakSupervisorDays = computeRecommendedPostProductionDays([...base, vfxSupervisorWithSkill(27, 0)], choices);
    const neutralSupervisorDays = computeRecommendedPostProductionDays([...base, vfxSupervisorWithSkill(27, 50)], choices);
    expect(noSupervisorDays).toBeLessThan(weakSupervisorDays);
    expect(noSupervisorDays).toBeGreaterThan(neutralSupervisorDays);
  });

  it('never compresses below, or stretches beyond, the documented bounds across extreme combinations', () => {
    const weakestCrew = [...assignmentsOfSize(28, 6), editorWithSkill(28, 100)];
    const cheapestFilm = baseChoices({ runtimeIntensity: 0, vfxAmount: VFX_RANGE.min });
    const floor = computeRecommendedPostProductionDays(weakestCrew, cheapestFilm);
    expect(floor).toBeGreaterThanOrEqual(14);

    const strongestDemandNoSupervisor = [...assignmentsOfSize(29, 6), editorWithSkill(29, 0)];
    const mostAmbitiousFilm = baseChoices({ runtimeIntensity: 1, vfxAmount: VFX_RANGE.max });
    const ceiling = computeRecommendedPostProductionDays(strongestDemandNoSupervisor, mostAmbitiousFilm);
    expect(ceiling).toBeLessThanOrEqual(95);
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

describe('footage band (footageLowerBound / footageUpperBound)', () => {
  it('brackets the recommended schedule below and above', () => {
    const recommended = 40;
    const lower = footageLowerBound(recommended);
    const upper = footageUpperBound(recommended);
    expect(lower).toBeLessThan(recommended);
    expect(upper).toBeGreaterThan(recommended);
    // 0.6x / 2.5x of the recommended schedule.
    expect(lower).toBe(24);
    expect(upper).toBe(100);
  });
});

describe('editCoverageCeiling', () => {
  it('never caps the edit once the recommended footage is shot (ratio >= 1)', () => {
    expect(editCoverageCeiling(1)).toBe(100);
    expect(editCoverageCeiling(1.8)).toBe(100);
  });

  it('caps the edit progressively harder the thinner the shoot is', () => {
    const atLowerBound = editCoverageCeiling(0.6);
    const midway = editCoverageCeiling(0.8);
    expect(atLowerBound).toBeLessThan(midway);
    expect(midway).toBeLessThan(100);
    // At the lower bound the ceiling sits at the base edit floor.
    expect(atLowerBound).toBeCloseTo(55, 5);
  });
})
