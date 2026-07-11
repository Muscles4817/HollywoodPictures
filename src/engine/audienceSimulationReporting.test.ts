import { describe, it, expect } from 'vitest';
import { advanceToWeekWithDiagnostics, MAX_SIMULATION_WEEKS } from './audienceSimulationStep';
import { deriveAudienceSimulationFixedState, type ReleaseSimulationInputs } from './audienceSimulationInputs';
import { maxInterestedAudience } from './audienceSimulation';
import {
  AVERAGE_TICKET_PRICE,
  buildWeeklyReport,
  diagnoseRunShape,
  runModel,
  REPRESENTATIVE_SCENARIO_MATRIX,
  type ReportingScenario,
} from './audienceSimulationReporting';

const scenario: ReportingScenario = {
  name: 'test scenario',
  description: 'a plain mid-tier scenario for reporting tests',
  buzzScore: 50,
  marketingSpend: 20_000_000,
  scriptMarketability: 50,
  scriptOriginality: 40,
  scriptIntendedAudience: 'Mass Market',
  targetAudience: 'Mass Market',
  genre: 'Action',
  releaseWindow: 'Quiet Month',
  releaseType: 'Wide',
  criticScore: 60,
  audienceScore: 62,
};

describe('buildWeeklyReport - the people-to-money boundary', () => {
  it('weeklyGross and cumulativeGross are exactly admissions * AVERAGE_TICKET_PRICE, nothing else recomputed', () => {
    const fixed = deriveAudienceSimulationFixedState({ ...scenario });
    const { diagnostics } = advanceToWeekWithDiagnostics(fixed, [], MAX_SIMULATION_WEEKS);
    const report = buildWeeklyReport(diagnostics);
    expect(report).toHaveLength(diagnostics.length);
    for (let i = 0; i < report.length; i++) {
      expect(report[i].weeklyGross).toBeCloseTo(diagnostics[i].weeklyAdmissions * AVERAGE_TICKET_PRICE, 6);
      expect(report[i].cumulativeGross).toBeCloseTo(diagnostics[i].cumulativeTicketsSold * AVERAGE_TICKET_PRICE, 6);
      // Every other field is passed through untouched from the diagnostics trace.
      expect(report[i].week).toBe(diagnostics[i].week);
      expect(report[i].womInfluence).toBe(diagnostics[i].womInfluence);
    }
  });

  it('cumulativeGross is non-decreasing across the run, matching cumulativeTicketsSold', () => {
    const fixed = deriveAudienceSimulationFixedState({ ...scenario, criticScore: 90, audienceScore: 92 });
    const { diagnostics } = advanceToWeekWithDiagnostics(fixed, [], MAX_SIMULATION_WEEKS);
    const report = buildWeeklyReport(diagnostics);
    for (let i = 1; i < report.length; i++) {
      expect(report[i].cumulativeGross).toBeGreaterThanOrEqual(report[i - 1].cumulativeGross);
    }
  });
});

describe('runModel - live-model reporting path', () => {
  it('openingGross is week 1 gross, and totalGross matches the final cumulative gross', () => {
    const result = runModel(scenario);
    const fixed = deriveAudienceSimulationFixedState({ ...scenario });
    const { diagnostics } = advanceToWeekWithDiagnostics(fixed, [], MAX_SIMULATION_WEEKS);
    const report = buildWeeklyReport(diagnostics);
    expect(result.openingGross).toBeCloseTo(report[0].weeklyGross, 6);
    expect(result.totalGross).toBeCloseTo(report[report.length - 1].cumulativeGross, 6);
    expect(result.runWeeks).toBe(report.length);
  });

  it('is fully deterministic - the model has no randomness at all', () => {
    const a = runModel(scenario);
    const b = runModel(scenario);
    expect(a).toEqual(b);
  });

  it('legs (totalGross / openingGross) is a sane positive multiple', () => {
    const result = runModel({ ...scenario, criticScore: 85, audienceScore: 88 });
    expect(result.legs).toBeGreaterThanOrEqual(1);
  });
});

describe('the representative scenario matrix', () => {
  it('runs every scenario without throwing and returns a sane result for each', () => {
    for (const s of REPRESENTATIVE_SCENARIO_MATRIX) {
      const result = runModel(s);
      expect(result.totalGross).toBeGreaterThanOrEqual(0);
      expect(result.runWeeks).toBeGreaterThan(0);
      expect(Number.isFinite(result.legs)).toBe(true);
    }
  });

  it('every scenario in the matrix produces a valid AudienceSimulationFixedState (Streaming excluded, all fields in range)', () => {
    for (const s of REPRESENTATIVE_SCENARIO_MATRIX) {
      expect(() => deriveAudienceSimulationFixedState({ ...s })).not.toThrow();
    }
  });

  it('the blockbuster scenario clearly outgrosses the flop scenario - a basic sanity floor for the matrix itself', () => {
    const blockbuster = REPRESENTATIVE_SCENARIO_MATRIX.find((s) => s.name === 'Summer blockbuster')!;
    const flop = REPRESENTATIVE_SCENARIO_MATRIX.find((s) => s.name === 'Overhyped flop')!;
    expect(runModel(blockbuster).totalGross).toBeGreaterThan(runModel(flop).totalGross);
  });
});

function runInputs(inputs: ReleaseSimulationInputs) {
  const fixed = deriveAudienceSimulationFixedState(inputs);
  const { diagnostics } = advanceToWeekWithDiagnostics(fixed, [], MAX_SIMULATION_WEEKS);
  return { fixed, diagnostics, ceiling: maxInterestedAudience(fixed) };
}

describe('diagnoseRunShape - the plain-language "why" behind a trajectory', () => {
  it('an empty run (no weeks) produces no labels', () => {
    expect(diagnoseRunShape({ totalAddressableAudience: 1000 }, 500, [])).toEqual([]);
  });

  it('front-loaded event film, poor reception: labelled "Opened strongly" and "Collapsed", never "Grew"', () => {
    const { fixed, diagnostics, ceiling } = runInputs({
      buzzScore: 90,
      marketingSpend: 100_000_000,
      scriptMarketability: 50,
      scriptOriginality: 30,
      scriptIntendedAudience: 'Mass Market',
      targetAudience: 'Mass Market',
      genre: 'Action',
      releaseWindow: 'Quiet Month',
      releaseType: 'Wide',
      criticScore: 25,
      audienceScore: 20,
    });
    const labels = diagnoseRunShape(fixed, ceiling, diagnostics).map((d) => d.label);
    expect(labels).toContain('Opened strongly');
    expect(labels).toContain('Collapsed');
    expect(labels).not.toContain('Grew');
  });

  it('a sleeper hit: labelled "Grew", never "Collapsed"', () => {
    const { fixed, diagnostics, ceiling } = runInputs({
      buzzScore: 15,
      marketingSpend: 300_000,
      scriptMarketability: 40,
      scriptOriginality: 70,
      scriptIntendedAudience: 'Niche',
      targetAudience: 'Niche',
      genre: 'Drama',
      releaseWindow: 'Quiet Month',
      releaseType: 'Limited',
      criticScore: 92,
      audienceScore: 95,
    });
    const labels = diagnoseRunShape(fixed, ceiling, diagnostics).map((d) => d.label);
    expect(labels).toContain('Grew');
    expect(labels).not.toContain('Collapsed');
  });

  it('a niche acclaimed film with almost no expansion capacity: labelled "Remained niche"', () => {
    const { fixed, diagnostics, ceiling } = runInputs({
      buzzScore: 20,
      marketingSpend: 500_000,
      scriptMarketability: 30,
      scriptOriginality: 2,
      scriptIntendedAudience: 'Niche',
      targetAudience: 'Niche',
      genre: 'Drama',
      releaseWindow: 'Quiet Month',
      releaseType: 'Festival First',
      criticScore: 96,
      audienceScore: 94,
    });
    const labels = diagnoseRunShape(fixed, ceiling, diagnostics).map((d) => d.label);
    expect(labels).toContain('Remained niche');
  });

  it('every detail string is non-empty and label set has no duplicates', () => {
    for (const s of REPRESENTATIVE_SCENARIO_MATRIX) {
      const { fixed, diagnostics, ceiling } = runInputs(s);
      const diagnosis = diagnoseRunShape(fixed, ceiling, diagnostics);
      const labels = diagnosis.map((d) => d.label);
      expect(new Set(labels).size).toBe(labels.length);
      for (const d of diagnosis) expect(d.detail.length).toBeGreaterThan(0);
    }
  });
});
