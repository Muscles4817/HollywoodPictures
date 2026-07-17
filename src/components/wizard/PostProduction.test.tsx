// @vitest-environment jsdom
//
// Post-Production Redesign, Phase A
// (docs/DESIGN_REVIEW_post_production_redesign.md section 1) - a real render
// of the provisional-forecast card, standing in for a manual browser check
// (see ProjectOverview.test.tsx/ProductionRun.test.tsx for the same
// jsdom+StudioProvider pattern this borrows). Catches exactly the class of
// bug tsc can't - a null-reference or formatting bug that only surfaces at
// render time - and specifically guards against the forecast reading as
// enforced when it isn't yet (Phase A's own explicit restraint).
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { PostProduction } from './PostProduction';
import { createInitialStudio, type GameState } from '../../state/gameState';
import { buildReadyDraft } from '../../state/testFixtures';
import { saveState } from '../../state/persistence';
import { generateTalentPool } from '../../engine/talentGenerator';
import { withRng } from '../../engine/random';
import { playerDraftToProject } from '../../engine/project';
import { formatGameDate } from '../../engine/calendar';
import type { FilmDraft } from '../../types';

beforeEach(() => {
  localStorage.clear();
});

function stateOnPostProductionScreen(postProductionEstimatedCompletionDay: number | null): { state: GameState; draft: FilmDraft } {
  const studio = createInitialStudio(10_000_000);
  const { result: talentPool, nextSeed } = withRng(1, (rng) => generateTalentPool(rng));
  const draft: FilmDraft = {
    ...withRng(2, (rng) => buildReadyDraft(rng)).result,
    postProductionEstimatedCompletionDay,
  };
  const state: GameState = {
    studio,
    screen: 'post-production',
    projects: [playerDraftToProject(draft)],
    focusedProjectId: draft.id,
    projectWorkspaceSection: 'overview',
    rngSeed: nextSeed,
    totalDays: 1,
    talentPool,
    rivalStudios: [],
    opportunities: [],
    nextOpportunityCheckDay: 1,
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
  return { state, draft };
}

describe('PostProduction - the provisional post-production forecast', () => {
  it('shows the estimated ready date once FINISH_PHOTOGRAPHY has computed one', () => {
    const { state, draft } = stateOnPostProductionScreen(45);
    saveState(state);
    render(
      <StudioProvider>
        <PostProduction />
      </StudioProvider>,
    );
    expect(screen.getByText('Estimated Post-Production Length (preview)')).toBeInTheDocument();
    expect(screen.getByText(`Ready around ${formatGameDate(45)}`)).toBeInTheDocument();
    void draft;
  });

  it("is honest that the forecast isn't enforced yet - the existing instant form still completes normally", () => {
    const { state } = stateOnPostProductionScreen(45);
    saveState(state);
    render(
      <StudioProvider>
        <PostProduction />
      </StudioProvider>,
    );
    expect(screen.getByText(/not enforced yet/)).toBeInTheDocument();
    expect(screen.getByText(/still completes the moment you continue to Marketing/)).toBeInTheDocument();
    // The real, still-instant form is still there, untouched.
    expect(screen.getByText('Edit Style')).toBeInTheDocument();
    expect(screen.getByText('Continue to Marketing')).toBeInTheDocument();
  });

  it('renders no forecast card at all if the estimate is somehow still null (defensive - should never happen once photography has finished)', () => {
    const { state } = stateOnPostProductionScreen(null);
    saveState(state);
    render(
      <StudioProvider>
        <PostProduction />
      </StudioProvider>,
    );
    expect(screen.queryByText('Estimated Post-Production Length (preview)')).not.toBeInTheDocument();
  });
});
