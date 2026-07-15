// @vitest-environment jsdom
//
// QoL pass (docs/DESIGN.md): (1) the Contingency Reserve should visibly be
// consumed live during filming, not just summarized once the shoot wraps;
// (2) the screenplay should stay visible throughout filming, not just
// before it starts. First test coverage for this component. (The day
// counter/pause control this file used to test here moved to the global
// Header - components/common/Header.tsx - once it stopped being
// screen-scoped, so it's no longer this component's own concern.)
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { ProductionRun } from './ProductionRun';
import { createInitialStudio, type GameState } from '../../state/gameState';
import { buildReadyDraft } from '../../state/testFixtures';
import { saveState } from '../../state/persistence';
import { generateTalentPool } from '../../engine/talentGenerator';
import { withRng } from '../../engine/random';
import { playerDraftToProject } from '../../engine/project';
import type { FilmDraft, PhotographyState } from '../../types';

beforeEach(() => {
  localStorage.clear();
});

function stateWithInProgressShoot(
  photographyOverrides: Partial<PhotographyState> = {},
  viewingProductionId: string | null = null,
): { state: GameState; draft: FilmDraft } {
  const studio = createInitialStudio(10_000_000);
  const { result: talentPool, nextSeed } = withRng(1, (rng) => generateTalentPool(rng));
  const draft: FilmDraft = {
    ...withRng(2, (rng) => buildReadyDraft(rng)).result,
    ...(viewingProductionId ? { id: viewingProductionId } : {}),
    photography: { status: 'in-progress', recommendedDays: 40, daysElapsed: 10, events: [], runningCost: 300_000, pendingChoice: null, ...photographyOverrides },
  };
  const state: GameState = {
    studio,
    screen: 'production',
    projects: [playerDraftToProject(draft)],
    focusedProjectId: viewingProductionId ? null : draft.id,
    rngSeed: nextSeed,
    totalDays: 1,
    talentPool,
    rivalStudios: [],
    opportunities: [],
    nextOpportunityCheckDay: 1,
    viewingRivalStudioName: null,
    viewingProductionId,
  };
  return { state, draft };
}

describe('ProductionRun - Contingency Reserve visible live during filming', () => {
  it('shows Contingency Remaining and a Contingency Reserve Consumed bar while the shoot is in progress', () => {
    const { state } = stateWithInProgressShoot();
    saveState(state);
    render(
      <StudioProvider>
        <ProductionRun />
      </StudioProvider>,
    );
    // contingencyAmount 500,000 (testFixtures.ts PRODUCTION_CHOICES) - runningCost 300,000 = 200,000 remaining.
    expect(screen.getByText('Contingency Remaining')).toBeInTheDocument();
    expect(screen.getByText('£200,000')).toBeInTheDocument();
    expect(screen.getByText('Contingency Reserve Consumed')).toBeInTheDocument();
  });

  it('shows an overrun warning once running cost exceeds the reserve', () => {
    const { state } = stateWithInProgressShoot({ runningCost: 650_000 });
    saveState(state);
    render(
      <StudioProvider>
        <ProductionRun />
      </StudioProvider>,
    );
    expect(screen.getByText(/Contingency Reserve exhausted/)).toBeInTheDocument();
  });
});

describe('ProductionRun - the screenplay stays visible throughout filming', () => {
  it("shows the script's own ScriptSummaryCard while the shoot is in progress", () => {
    const { state, draft } = stateWithInProgressShoot();
    saveState(state);
    render(
      <StudioProvider>
        <ProductionRun />
      </StudioProvider>,
    );
    expect(screen.getByText(draft.script!.title)).toBeInTheDocument();
    expect(screen.getByText(draft.script!.synopsis)).toBeInTheDocument();
  });
});
