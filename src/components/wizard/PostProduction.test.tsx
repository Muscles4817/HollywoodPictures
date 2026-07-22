// @vitest-environment jsdom
//
// Post-Production Redesign, Phase A/B
// (docs/DESIGN_REVIEW_post_production_redesign.md sections 1-2) - a real
// render of the provisional-forecast card and the test-screening decision
// card, standing in for a manual browser check (see
// ProjectOverview.test.tsx/ProductionRun.test.tsx for the same
// jsdom+StudioProvider pattern this borrows). Catches exactly the class of
// bug tsc can't - a null-reference or formatting bug that only surfaces at
// render time.
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
import { generateTestScreeningPendingChoice } from '../../engine/testScreening';
import type { FilmDraft } from '../../types';

beforeEach(() => {
  localStorage.clear();
});

function stateOnPostProductionScreen(overrides: Partial<FilmDraft>): { state: GameState; draft: FilmDraft } {
  const studio = createInitialStudio(10_000_000);
  const { result: talentPool, nextSeed } = withRng(1, (rng) => generateTalentPool(rng));
  const draft: FilmDraft = {
    ...withRng(2, (rng) => buildReadyDraft(rng)).result,
    // buildReadyDraft is release-ready (screening already resolved); these
    // forecast tests are specifically about the *pending* pre-screening
    // state, so reset those two fields to the unresolved baseline unless a
    // test overrides them.
    testScreeningResolved: false,
    postProductionFinalReadyDay: null,
    ...overrides,
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
  it('shows the screening-ready forecast once FINISH_PHOTOGRAPHY has computed one', () => {
    const { state } = stateOnPostProductionScreen({ postProductionScreeningReadyDay: 45 });
    saveState(state);
    render(
      <StudioProvider>
        <PostProduction />
      </StudioProvider>,
    );
    expect(screen.getByText('Test Screening (preview)')).toBeInTheDocument();
    expect(screen.getByText(`Ready around ${formatGameDate(45)}`)).toBeInTheDocument();
  });

  it('never describes the estimate as the film being ready for release - it is explicitly the test screening', () => {
    const { state } = stateOnPostProductionScreen({ postProductionScreeningReadyDay: 45 });
    saveState(state);
    render(
      <StudioProvider>
        <PostProduction />
      </StudioProvider>,
    );
    expect(screen.queryByText(/ready for release/i)).not.toBeInTheDocument();
    expect(screen.getByText(/a test screening will surface here/)).toBeInTheDocument();
  });

  it('renders no forecast card at all if the estimate is somehow still null (defensive - should never happen once photography has finished)', () => {
    const { state } = stateOnPostProductionScreen({ postProductionScreeningReadyDay: null });
    saveState(state);
    render(
      <StudioProvider>
        <PostProduction />
      </StudioProvider>,
    );
    expect(screen.queryByText('Test Screening (preview)')).not.toBeInTheDocument();
  });

  it('hides the forecast card once the screening has actually resolved', () => {
    const { state } = stateOnPostProductionScreen({ postProductionScreeningReadyDay: 45, testScreeningResolved: true });
    saveState(state);
    render(
      <StudioProvider>
        <PostProduction />
      </StudioProvider>,
    );
    expect(screen.queryByText('Test Screening (preview)')).not.toBeInTheDocument();
  });
});

describe('PostProduction - the test-screening decision', () => {
  it('renders the pending screening as a decision card with all four choices, and blocks Continue to Marketing', () => {
    const { state, draft } = stateOnPostProductionScreen({ postProductionScreeningReadyDay: 45 });
    const pendingChoice = withRng(3, (rng) => generateTestScreeningPendingChoice(draft, rng)).result;
    const stateWithPending: GameState = {
      ...state,
      projects: [playerDraftToProject({ ...draft, testScreeningPendingChoice: pendingChoice })],
    };
    saveState(stateWithPending);
    render(
      <StudioProvider>
        <PostProduction />
      </StudioProvider>,
    );
    expect(screen.getByText('A Decision Is Needed')).toBeInTheDocument();
    expect(screen.getByText('Release As-Is')).toBeInTheDocument();
    expect(screen.getByText('Re-edit')).toBeInTheDocument();
    expect(screen.getByText('Pickups')).toBeInTheDocument();
    expect(screen.getByText('Major Reshoots')).toBeInTheDocument();
    expect(screen.getByText('Continue to Marketing')).toBeDisabled();
  });

  it('does not render a decision card and leaves Continue to Marketing enabled when nothing is pending', () => {
    const { state } = stateOnPostProductionScreen({ postProductionScreeningReadyDay: 45 });
    saveState(state);
    render(
      <StudioProvider>
        <PostProduction />
      </StudioProvider>,
    );
    expect(screen.queryByText('A Decision Is Needed')).not.toBeInTheDocument();
    expect(screen.getByText('Continue to Marketing')).not.toBeDisabled();
  });

  it('shows the cost and time of each screening option so the player can weigh it', () => {
    const { state, draft } = stateOnPostProductionScreen({ postProductionScreeningReadyDay: 45 });
    const pendingChoice = withRng(3, (rng) => generateTestScreeningPendingChoice(draft, rng)).result;
    const stateWithPending: GameState = {
      ...state,
      projects: [playerDraftToProject({ ...draft, testScreeningPendingChoice: pendingChoice })],
    };
    saveState(stateWithPending);
    render(
      <StudioProvider>
        <PostProduction />
      </StudioProvider>,
    );
    // Release As-Is is free and instant...
    expect(screen.getByText('No added cost')).toBeInTheDocument();
    expect(screen.getByText('No delay')).toBeInTheDocument();
    // ...each editing round shows a real time cost the player can see up front.
    expect(screen.getAllByText(/^Time:/).length).toBeGreaterThanOrEqual(3);
  });
});

describe('PostProduction - a recut in progress', () => {
  it('shows the recut-in-progress card (with the next-screening estimate) and no decision card', () => {
    const { state } = stateOnPostProductionScreen({ postProductionScreeningReadyDay: 45, postProductionEditingUntilDay: 60 });
    saveState(state);
    render(
      <StudioProvider>
        <PostProduction />
      </StudioProvider>,
    );
    expect(screen.getByText('Re-cut in progress')).toBeInTheDocument();
    expect(screen.getByText(`Next screening around ${formatGameDate(60)}`)).toBeInTheDocument();
    expect(screen.queryByText('A Decision Is Needed')).not.toBeInTheDocument();
    // The pre-first-screening forecast card is gone once a recut is underway.
    expect(screen.queryByText('Test Screening (preview)')).not.toBeInTheDocument();
  });
});
