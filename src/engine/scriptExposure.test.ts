import { describe, it, expect } from 'vitest';
import { createRng } from './random';
import { generateScriptOptions } from './scriptGenerator';
import { deriveScriptExposure, exposureSeverity, scriptRiskContribution, toneDiffusion } from './scriptExposure';
import { computeStaticProductionRisk } from './production';
import type { ProductionChoices, Script, TalentAssignment, ToneProfile } from '../types';

const FOCUSED_TONE: ToneProfile = { action: 10, comedy: 5, romance: 5, suspense: 5, drama: 80, spectacle: 5 };
const DIFFUSE_TONE: ToneProfile = { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 };

function script(overrides: Partial<Script> = {}): Script {
  return { ...generateScriptOptions('Drama', createRng(1), 1)[0], toneProfile: FOCUSED_TONE, ...overrides };
}

const SOLID = { structure: 80, characters: 80, dialogue: 80 };
const THIN = { structure: 20, characters: 20, dialogue: 20 };

describe('deriveScriptExposure', () => {
  it('leaves a solid draft carrying nothing at all', () => {
    // A good script should carry no production penalty, not merely a smaller one.
    expect(deriveScriptExposure(script(SOLID))).toEqual([]);
  });

  it('names a typed, ordered concern per thin axis rather than one lumped modifier', () => {
    const exposures = deriveScriptExposure(script(THIN));
    const kinds = exposures.map((e) => e.kind);
    expect(kinds).toContain('structural-instability');
    expect(kinds).toContain('character-ambiguity');
    expect(kinds).toContain('dialogue-rawness');
    // Every one arrives with its own player-facing cause (Principle 4).
    for (const exposure of exposures) expect(exposure.cause.length).toBeGreaterThan(0);
    // Most severe first, so "the thing to worry about" is the head.
    const severities = exposures.map((e) => e.severity);
    expect([...severities].sort((a, b) => b - a)).toEqual(severities);
  });

  it('isolates each axis - a weak structure does not read as weak characters', () => {
    const exposures = deriveScriptExposure(script({ structure: 15, characters: 85, dialogue: 85 }));
    expect(exposureSeverity(exposures, 'structural-instability')).toBeGreaterThan(0.5);
    expect(exposureSeverity(exposures, 'character-ambiguity')).toBe(0);
    expect(exposureSeverity(exposures, 'dialogue-rawness')).toBe(0);
  });

  it('reads tonal instability off the profile shape, not its magnitude', () => {
    expect(toneDiffusion(FOCUSED_TONE)).toBe(0);
    expect(toneDiffusion(DIFFUSE_TONE)).toBeGreaterThan(0);
    // Doubling every tone changes nothing about how settled the film is.
    const doubled = Object.fromEntries(Object.entries(DIFFUSE_TONE).map(([k, v]) => [k, v * 2])) as ToneProfile;
    expect(toneDiffusion(doubled)).toBe(toneDiffusion(DIFFUSE_TONE));
  });
});

describe('scriptRiskContribution - typed, not scalar', () => {
  it('routes each weakness to the dimension it logically touches', () => {
    const structural = scriptRiskContribution(deriveScriptExposure(script({ structure: 15, characters: 85, dialogue: 85 })));
    expect(structural.technical).toBeGreaterThan(0);
    expect(structural.budget).toBeGreaterThan(0); // coverage inflation
    expect(structural.morale).toBe(0); // an unresolved structure is not a morale problem

    const human = scriptRiskContribution(deriveScriptExposure(script({ structure: 85, characters: 15, dialogue: 15 })));
    expect(human.morale).toBeGreaterThan(0); // actor objections, pages changing on the day
    expect(human.technical).toBe(0);
    expect(human.budget).toBe(0);
  });
});

describe('computeStaticProductionRisk reads the screenplay', () => {
  // A deliberately lean plan: budgetRisk clamps at 0 for a well-funded Drama,
  // which would hide the screenplay's own contribution to it.
  const CHOICES = {
    shootingBudgetAmount: 400_000, setQualityAmount: 80_000, vfxAmount: 80_000,
    practicalEffectsAmount: 80_000, contingencyReserveAmount: 40_000,
  } as ProductionChoices;
  const talent: TalentAssignment[] = [];

  it('separates two scripts of equal complexity but different craft', () => {
    // The gap this closes: craft carried NO production risk, so these two
    // entered photography on mechanically identical terms.
    const solid = computeStaticProductionRisk(talent, script({ ...SOLID, complexity: 50 }), CHOICES, 'Drama');
    const thin = computeStaticProductionRisk(talent, script({ ...THIN, complexity: 50 }), CHOICES, 'Drama');

    expect(thin.moraleRisk).toBeGreaterThan(solid.moraleRisk);
    expect(thin.technicalComplexity).toBeGreaterThan(solid.technicalComplexity);
    expect(thin.budgetRisk).toBeGreaterThan(solid.budgetRisk);
    // Safety is physical - the screenplay's prose has nothing to do with it.
    expect(thin.safetyRisk).toBe(solid.safetyRisk);
  });

  it('leaves the reading unchanged for a solid draft', () => {
    // Not a penalty everyone pays a little of: a competent script contributes zero.
    const a = computeStaticProductionRisk(talent, script({ ...SOLID, complexity: 50 }), CHOICES, 'Drama');
    const b = computeStaticProductionRisk(talent, script({ structure: 95, characters: 95, dialogue: 95, complexity: 50 }), CHOICES, 'Drama');
    expect(a).toEqual(b);
  });
});
