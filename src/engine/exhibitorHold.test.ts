// The exhibitor hold (docs/IMPLEMENTATION_PLAN_market_realism.md Phase 3): a
// studio exhibitors trust keeps a softening film on its screens a little
// longer, for the first weeks of the run only.
import { describe, expect, it } from 'vitest';
import { deriveAudienceSimulationFixedState, type ReleaseSimulationInputs } from './audienceSimulationInputs';
import { advanceToWeekWithDiagnostics, computeHoldRelief } from './audienceSimulationStep';

// A soft Wide release: plenty of screens, little appetite for it.
const SOFT_WIDE: ReleaseSimulationInputs = {
  buzzScore: 70,
  marketingSpend: 40_000_000,
  directorFame: 50,
  leadFame: 50,
  studioBrand: 50,
  scriptAccessibility: 40,
  scriptHookStrength: 35,
  scriptCrossoverPotential: 20,
  scriptSpectacle: 50,
  scriptIntendedAudience: 'Mass Market',
  targetAudience: 'Mass Market',
  genre: 'Action',
  releaseWindow: 'Quiet Month',
  releaseType: 'Wide',
  competitiveCrowding: 0,
  criticScore: 30,
  audienceScore: 35,
  productionBudgetCost: 8_000_000,
};

const fixedFor = (exhibitorStanding?: number) => deriveAudienceSimulationFixedState({ ...SOFT_WIDE, ...(exhibitorStanding === undefined ? {} : { exhibitorStanding }) });

describe('computeHoldRelief', () => {
  const trusted = fixedFor(1);
  it('is 0 with no standing', () => {
    expect(computeHoldRelief(fixedFor(), 2, -0.1)).toBe(0);
    expect(computeHoldRelief(fixedFor(0), 2, -0.1)).toBe(0);
  });
  it('is 0 for a film gaining screens', () => {
    expect(computeHoldRelief(trusted, 2, 0.05)).toBe(0);
    expect(computeHoldRelief(trusted, 2, 0)).toBe(0);
  });
  it('is 0 after week three', () => {
    expect(computeHoldRelief(trusted, 4, -0.1)).toBe(0);
  });
  it('is the full relief at full standing in week two, and scales with standing', () => {
    expect(computeHoldRelief(trusted, 2, -0.1)).toBe(0.5);
    expect(computeHoldRelief(fixedFor(0.5), 2, -0.1)).toBe(0.25);
  });
  it('leaves a direct-simulation fixed state (no standing given) without the field', () => {
    expect(fixedFor().exhibitorStanding).toBeUndefined();
  });
});

describe('a soft Wide release from a trusted studio keeps its screens a little longer', () => {
  const run = (standing: number) => advanceToWeekWithDiagnostics(fixedFor(standing), [], 12).diagnostics;
  const strong = run(0.9);
  const weak = run(0.1);

  it('the film really is soft: it loses screens on performance early', () => {
    expect(weak[0].performanceAdjustment).toBeLessThan(0);
  });

  it('keeps more screens in weeks two and three', () => {
    expect(strong[1].availabilityFraction).toBeGreaterThan(weak[1].availabilityFraction);
    expect(strong[2].availabilityFraction).toBeGreaterThan(weak[2].availabilityFraction);
  });

  it('gets no relief from week four on, for either studio', () => {
    for (let i = 3; i < Math.min(strong.length, weak.length); i++) {
      expect(strong[i].holdRelief).toBe(0);
      expect(weak[i].holdRelief).toBe(0);
    }
    expect(strong[1].holdRelief).toBeGreaterThan(weak[1].holdRelief);
  });
});

// docs/IMPLEMENTATION_PLAN_market_realism.md Phase 3: Brand makes marketing go
// somewhat further, not three times further, centred on the market's mean.
import { inferStudioBrandFromMarketingEfficiency } from './audienceSimulationInputs';

describe('marketing efficiency by Brand', () => {
  const efficiency = (studioBrand: number) => deriveAudienceSimulationFixedState({ ...SOFT_WIDE, studioBrand }).marketingEfficiency;
  it('matches the old range at the market\'s mean Brand (63), within 0.005', () => {
    expect(Math.abs(efficiency(63) - (0.3 + 0.7 * 0.63))).toBeLessThanOrEqual(0.005);
  });
  it('makes the top at most 1.6 times the bottom', () => {
    expect(efficiency(100) / efficiency(0)).toBeLessThanOrEqual(1.6);
    expect(efficiency(100)).toBeGreaterThan(efficiency(0));
  });
  it('inverts exactly', () => {
    for (const brand of [0, 10, 37, 63, 100]) expect(inferStudioBrandFromMarketingEfficiency(efficiency(brand))).toBeCloseTo(brand, 9);
  });
});
