// @vitest-environment jsdom
//
// Post-Production Redesign, Phase C (docs/DESIGN_REVIEW_post_production_redesign.md
// section 3) - WizardSteps used to be a purely visual step indicator; now
// self-contained (fetches its own state, same pattern
// components/common/BudgetTracker.tsx already established) and clickable
// for reachable steps. First test coverage for this component - a real
// render, standing in for a manual browser check (see
// ProjectOverview.test.tsx/PostProduction.test.tsx for the same
// jsdom+StudioProvider pattern this borrows).
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioProvider, useStudio } from '../../state/StudioContext';
import { WizardSteps } from './WizardSteps';
import { createInitialStudio, type GameState } from '../../state/gameState';
import { buildReadyDraft } from '../../state/testFixtures';
import { saveState } from '../../state/persistence';
import { generateTalentPool } from '../../engine/talentGenerator';
import { withRng } from '../../engine/random';
import { playerDraftToProject } from '../../engine/project';
import { generateTestScreeningPendingChoice } from '../../engine/testScreening';
import type { FilmDraft, WizardStep } from '../../types';

beforeEach(() => {
  localStorage.clear();
});

function stateWithDraft(seed: number, current: WizardStep, overrides: Partial<FilmDraft>): GameState {
  const { result: talentPool, nextSeed } = withRng(seed, (rng) => generateTalentPool(rng));
  const draft: FilmDraft = { ...withRng(seed + 1, (rng) => buildReadyDraft(rng)).result, ...overrides };
  return {
    studio: createInitialStudio(10_000_000),
    screen: current,
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
}

describe('WizardSteps - reachable-step navigation', () => {
  it('renders every step as plain, non-interactive text while still shooting', () => {
    const state = stateWithDraft(1, 'production', { photography: { status: 'in-progress', recommendedDays: 40, daysElapsed: 5, events: [], runningCost: 0, pendingChoice: null } });
    saveState(state);
    render(<StudioProvider><WizardSteps current="production" /></StudioProvider>);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('post-production and marketing render as clickable buttons once photography has finished', () => {
    const state = stateWithDraft(2, 'production', {});
    saveState(state);
    render(<StudioProvider><WizardSteps current="production" /></StudioProvider>);
    expect(screen.getByRole('button', { name: /Post-Production/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Market & Release/ })).toBeInTheDocument();
  });

  // WizardSteps' `current` is a prop from its parent (each real WizardStep
  // screen passes its own identity, see WizardHeader's callers) - it can't
  // observe its own navigation by re-deriving `current` from state. This
  // tiny wrapper mirrors what actually drives a real transition (App.tsx's
  // screen switch swapping which screen - and therefore which `current` -
  // is mounted) closely enough to prove the click really dispatches
  // GO_TO_STEP and the calendar/screen state genuinely changes.
  function ReactiveWizardSteps() {
    const { state } = useStudio();
    return <WizardSteps current={state.screen as WizardStep} />;
  }

  it('clicking a reachable step dispatches GO_TO_STEP and actually navigates', () => {
    const state = stateWithDraft(3, 'production', {});
    saveState(state);
    render(<StudioProvider><ReactiveWizardSteps /></StudioProvider>);
    fireEvent.click(screen.getByRole('button', { name: /Market & Release/ }));
    // Once navigated, WizardSteps re-renders with "marketing" as current -
    // no longer its own clickable button (a step never links to itself) -
    // and "Film It" (production) becomes clickable instead, proving the
    // screen genuinely changed rather than the click being a no-op.
    expect(screen.queryByRole('button', { name: /Market & Release/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Film It/ })).toBeInTheDocument();
  });

  it('marketing is not clickable while a test screening is pending an unresolved choice - post-production still is', () => {
    const base = withRng(4, (rng) => buildReadyDraft(rng)).result;
    const pendingChoice = withRng(5, (rng) => generateTestScreeningPendingChoice(base, rng)).result;
    const state = stateWithDraft(4, 'production', { testScreeningPendingChoice: pendingChoice, testScreeningResolved: false });
    saveState(state);
    render(<StudioProvider><WizardSteps current="production" /></StudioProvider>);
    expect(screen.getByRole('button', { name: /Post-Production/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Market & Release/ })).not.toBeInTheDocument();
  });

  it('"Results" never renders as a clickable button, even once everything else is reachable', () => {
    const state = stateWithDraft(6, 'production', {});
    saveState(state);
    render(<StudioProvider><WizardSteps current="production" /></StudioProvider>);
    expect(screen.queryByRole('button', { name: /Results/ })).not.toBeInTheDocument();
  });

  it('the current step is never clickable, even when it would otherwise qualify as reachable', () => {
    const state = stateWithDraft(7, 'post-production', {});
    saveState(state);
    render(<StudioProvider><WizardSteps current="post-production" /></StudioProvider>);
    expect(screen.queryByRole('button', { name: /Post-Production/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Market & Release/ })).toBeInTheDocument();
  });
});
