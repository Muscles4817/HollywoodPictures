// @vitest-environment jsdom
// The Release button is correctly disabled until the test screening resolves,
// but a disabled <button>'s `title` tooltip doesn't surface in browsers, so the
// reason was effectively invisible next to the button. It's now stated in
// visible copy.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildStateWithReadyDraft } from '../../state/testFixtures';
import { asPlayerDraft, findProject } from '../../engine/project';
import type { GameState } from '../../state/gameState';

const dispatch = vi.fn();
let mockState: GameState;
vi.mock('../../state/StudioContext', () => ({ useStudio: () => ({ state: mockState, dispatch }) }));

// Imported after the mock is declared.
import { MarketingRelease } from './MarketingRelease';

/** A release-ready state, with the focused draft's screening flag forced to `resolved`. */
function stateWithScreening(resolved: boolean): GameState {
  const base = buildStateWithReadyDraft(1);
  const draft = asPlayerDraft(findProject(base.projects, base.focusedProjectId))!;
  const patched = { ...draft, testScreeningResolved: resolved, testScreeningPendingChoice: null };
  return { ...base, projects: [{ kind: 'player-in-progress', draft: patched }] } as GameState;
}

/** A release-ready state (screening resolved) with an office at the given research level, or no office when null. */
function stateWithResearch(researchTier: number | null): GameState {
  const base = stateWithScreening(true);
  if (researchTier == null) return base;
  return {
    ...base,
    studio: { ...base.studio, productionOffice: { tier: 1, benchProducerIds: [], marketResearchTier: researchTier } },
  } as GameState;
}

describe('MarketingRelease - projected opening tracking band', () => {
  it('shows the projection as a range with a baseline note nudging Market Research when the studio has none', () => {
    mockState = stateWithResearch(null); // no office, no research
    render(<MarketingRelease />);
    expect(screen.getByText('Projected Opening Weekend')).toBeInTheDocument();
    expect(screen.getByText(/buy Market Research in the Production Office/i)).toBeInTheDocument();
  });

  it('reflects a purchased research level and drops the buy nudge', () => {
    mockState = stateWithResearch(2); // 'Full tracking'
    render(<MarketingRelease />);
    expect(screen.getByText(/Full tracking/)).toBeInTheDocument();
    expect(screen.queryByText(/buy Market Research/i)).not.toBeInTheDocument();
  });
});

describe('MarketingRelease - test-screening gate messaging', () => {
  it('states in visible copy why the Release button is locked while the screening is out, and disables it', () => {
    mockState = stateWithScreening(false);
    render(<MarketingRelease />);
    expect(screen.getByText(/release month is set below/i)).toBeInTheDocument();
    const release = screen.getByRole('button', { name: /Release Film|Schedule for/ });
    expect(release).toBeDisabled();
  });

  it('drops the note and enables the Release button once the screening has resolved', () => {
    mockState = stateWithScreening(true);
    render(<MarketingRelease />);
    expect(screen.queryByText(/release month is set below/i)).not.toBeInTheDocument();
    const release = screen.getByRole('button', { name: /Release Film|Schedule for/ });
    expect(release).toBeEnabled();
  });
});

describe('MarketingRelease - affordability gate', () => {
  /** A release-ready state (screening resolved) whose studio has less cash than the marketing campaign costs. */
  function stateWithCash(cash: number): GameState {
    const base = stateWithScreening(true);
    return { ...base, studio: { ...base.studio, cash } } as GameState;
  }

  it('disables the Release button and flags the campaign as over budget when it costs more than the studio has', () => {
    mockState = stateWithCash(1_000); // far below any real marketing spend
    render(<MarketingRelease />);
    const release = screen.getByRole('button', { name: /Release Film|Schedule for/ });
    expect(release).toBeDisabled();
    expect(screen.getByText(/Over budget/i)).toBeInTheDocument();
  });

  it('enables the Release button when the studio can cover the campaign', () => {
    mockState = stateWithCash(500_000_000); // ample cash
    render(<MarketingRelease />);
    const release = screen.getByRole('button', { name: /Release Film|Schedule for/ });
    expect(release).toBeEnabled();
    expect(screen.queryByText(/Over budget/i)).not.toBeInTheDocument();
  });
});
