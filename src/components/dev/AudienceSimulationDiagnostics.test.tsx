// @vitest-environment jsdom
//
// Comp Pressure fix (components/dev/OutcomeInspector.tsx) - AsReleasedDiagnostics
// is the new half of this file's split; direct component-level coverage
// since it needs no StudioProvider (a pure prop-driven component, unlike
// OutcomeInspector.tsx itself).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AsReleasedDiagnostics } from './AudienceSimulationDiagnostics';
import { createAudienceSimulationFixedState, type AudienceSimulationFixedState } from '../../engine/audienceSimulation';
import type { BoxOfficeWeek } from '../../types';

function fixed(overrides: Partial<AudienceSimulationFixedState> = {}): AudienceSimulationFixedState {
  return createAudienceSimulationFixedState({
    totalAddressableAudience: 1_000_000,
    baseInterestFraction: 0.25,
    marketingEfficiency: 0.6,
    crossoverCapacityFraction: 0.15,
    conversionPacingBaseline: 0.12,
    externalWeeklyAwarenessRate: 0.15,
    criticScore: 70,
    audienceScore: 75,
    initialAwareCount: 0,
    initialAvailabilityFraction: 0.9,
    availabilityBaseWeeklyDecay: 0.15,
    criticLedExpansionWeight: 0,
    ...overrides,
  });
}

describe('AsReleasedDiagnostics', () => {
  it('shows the empty-run message, not a crash, when no weeks have settled yet', () => {
    render(<AsReleasedDiagnostics fixed={fixed()} weeks={[]} />);
    expect(screen.getByText('No weeks settled yet.')).toBeInTheDocument();
  });

  it('shows no legacy-data caveat when every week has a recorded competitivePressure', () => {
    const weeks: BoxOfficeWeek[] = [{ week: 1, gross: 1_000_000, competitivePressure: 0 }, { week: 2, gross: 800_000, competitivePressure: 0.2 }];
    render(<AsReleasedDiagnostics fixed={fixed()} weeks={weeks} />);
    expect(screen.queryByText(/wasn't recorded/)).not.toBeInTheDocument();
  });

  it("shows the legacy-data caveat when a week predates competitivePressure tracking, rather than silently presenting an assumed 0 as a real reading", () => {
    const weeks: BoxOfficeWeek[] = [{ week: 1, gross: 1_000_000 }, { week: 2, gross: 800_000, competitivePressure: 0.2 }];
    render(<AsReleasedDiagnostics fixed={fixed()} weeks={weeks} />);
    expect(screen.getByText(/wasn't recorded/)).toBeInTheDocument();
  });
});
