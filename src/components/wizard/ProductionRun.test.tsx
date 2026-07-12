// @vitest-environment jsdom
//
// QoL pass (docs/DESIGN.md): (1) the Contingency Reserve should visibly be
// consumed live during filming, not just summarized once the shoot wraps;
// (2) the day counter/pause control should be available on this page while
// checking on a backgrounded production, mirroring the fix to the pause bug
// where opening this screen froze that production's day count; (3) the
// screenplay should stay visible throughout filming, not just before it
// starts. First test coverage for this component.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { ProductionRun } from './ProductionRun';
import { createInitialStudio, type GameState } from '../../state/gameState';
import { buildReadyDraft } from '../../state/testFixtures';
import { saveState } from '../../state/persistence';
import { withRng } from '../../engine/random';
import type { FilmDraft, PhotographyState } from '../../types';

beforeEach(() => {
  localStorage.clear();
});

const NOOP_TICK_PROPS = { paused: false, onTogglePause: () => {}, tickNonce: 0, speedMultiplier: 1 as const, onSetSpeedMultiplier: () => {} };

function stateWithInProgressShoot(photographyOverrides: Partial<PhotographyState> = {}, viewingProductionId: string | null = null): GameState {
  const { result: studio, nextSeed } = withRng(1, (rng) => createInitialStudio(rng, 10_000_000));
  const draft: FilmDraft = {
    ...withRng(2, (rng) => buildReadyDraft(rng)).result,
    photography: { status: 'in-progress', recommendedDays: 40, daysElapsed: 10, events: [], runningCost: 300_000, pendingChoice: null, ...photographyOverrides },
  };
  return {
    studio: viewingProductionId ? { ...studio, productionsInProgress: [{ ...draft, id: viewingProductionId }] } : studio,
    screen: 'production',
    draft: viewingProductionId ? null : draft,
    rngSeed: nextSeed,
    viewingRivalStudioName: null,
    viewingProductionId,
  };
}

describe('ProductionRun - Contingency Reserve visible live during filming', () => {
  it('shows Contingency Remaining and a Contingency Reserve Consumed bar while the shoot is in progress', () => {
    const state = stateWithInProgressShoot();
    saveState(state);
    render(
      <StudioProvider>
        <ProductionRun {...NOOP_TICK_PROPS} />
      </StudioProvider>,
    );
    // contingencyAmount 500,000 (testFixtures.ts PRODUCTION_CHOICES) - runningCost 300,000 = 200,000 remaining.
    expect(screen.getByText('Contingency Remaining')).toBeInTheDocument();
    expect(screen.getByText('£200,000')).toBeInTheDocument();
    expect(screen.getByText('Contingency Reserve Consumed')).toBeInTheDocument();
  });

  it('shows an overrun warning once running cost exceeds the reserve', () => {
    const state = stateWithInProgressShoot({ runningCost: 650_000 });
    saveState(state);
    render(
      <StudioProvider>
        <ProductionRun {...NOOP_TICK_PROPS} />
      </StudioProvider>,
    );
    expect(screen.getByText(/Contingency Reserve exhausted/)).toBeInTheDocument();
  });
});

describe('ProductionRun - the screenplay stays visible throughout filming', () => {
  it("shows the script's own ScriptSummaryCard while the shoot is in progress", () => {
    const state = stateWithInProgressShoot();
    saveState(state);
    render(
      <StudioProvider>
        <ProductionRun {...NOOP_TICK_PROPS} />
      </StudioProvider>,
    );
    expect(screen.getByText(state.draft!.script!.title)).toBeInTheDocument();
    expect(screen.getByText(state.draft!.script!.synopsis)).toBeInTheDocument();
  });
});

describe('ProductionRun - day counter/pause control while viewing a backgrounded production', () => {
  it('shows the TimeTickIndicator (Pause Time / speed controls) when viewing a background production', () => {
    const state = stateWithInProgressShoot({}, 'bg-prod-1');
    saveState(state);
    render(
      <StudioProvider>
        <ProductionRun {...NOOP_TICK_PROPS} />
      </StudioProvider>,
    );
    expect(screen.getByText('Pause Time')).toBeInTheDocument();
  });

  it('does not show the TimeTickIndicator while running the live draft\'s own shoot - it has its own dedicated tick instead', () => {
    const state = stateWithInProgressShoot();
    saveState(state);
    render(
      <StudioProvider>
        <ProductionRun {...NOOP_TICK_PROPS} />
      </StudioProvider>,
    );
    expect(screen.queryByText('Pause Time')).not.toBeInTheDocument();
  });
});
