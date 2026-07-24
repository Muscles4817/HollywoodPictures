// @vitest-environment jsdom
// The Release button is correctly disabled until the test screening resolves,
// but a disabled <button>'s `title` tooltip doesn't surface in browsers, so the
// reason was effectively invisible next to the button. It's now stated in
// visible copy.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildStateWithReadyDraft } from '../../state/testFixtures';
import { asPlayerDraft, findProject } from '../../engine/project';
import type { GameState } from '../../state/gameState';
import type { Person, PersonPersonality, TalentAssignment } from '../../types';

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

function person(id: string, name: string, fame: number, personality: Partial<PersonPersonality> = {}): Person {
  return {
    id,
    identity: { name, appearanceTags: [] },
    personality: {
      professionalism: 60, ambition: 50, loyalty: 50, ego: 40, temperament: 55, pressureHandling: 60, controversy: 20, adaptability: 55,
      ...personality,
    },
    reputation: { fame, prestige: 40, industryRespect: 50, reliability: 60, currentHeat: 40 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: { actor: { role: 'Actor', active: true, experience: 50, roleReputation: 50, minimumSalary: 100_000, typicalSalary: 100_000, actingStyle: { characterTransformation: 50, emotionalPerformance: 50, charisma: 50, comedy: 50, physicalPerformance: 50 } } },
  };
}

const proStar = person('ava', 'Ava Reyes', 80, { controversy: 5, professionalism: 90, pressureHandling: 90 });
const wildcard = person('kip', 'Kip Danger', 70, { controversy: 95, professionalism: 20, pressureHandling: 15 });

/** A release-ready state whose focused draft has a known two-person cast and the given tour roster. */
function stateWithTour(tourCast?: string[]): GameState {
  const base = buildStateWithReadyDraft(1);
  const draft = asPlayerDraft(findProject(base.projects, base.focusedProjectId))!;
  const talent: TalentAssignment[] = [
    { role: 'Lead Actor', person: proStar },
    { role: 'Supporting Actor', person: wildcard },
  ];
  const patched = {
    ...draft,
    testScreeningResolved: true,
    testScreeningPendingChoice: null,
    talent,
    marketingChoices: { ...draft.marketingChoices!, pressTourCast: tourCast },
  };
  return { ...base, projects: [{ kind: 'player-in-progress', draft: patched }] } as GameState;
}

describe('MarketingRelease - press tour', () => {
  it('lists each cast member with a media-risk read and adds one to the tour on click', () => {
    dispatch.mockClear();
    mockState = stateWithTour();
    render(<MarketingRelease />);
    // A steady star reads Safe, a loose cannon reads Volatile.
    expect(screen.getByText('Safe')).toBeInTheDocument();
    expect(screen.getByText('Volatile')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ava Reyes/ }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_MARKETING_CHOICES', choices: expect.objectContaining({ pressTourCast: ['ava'] }) }),
    );
  });

  it('drops a tourer already on the roster when their row is clicked again', () => {
    dispatch.mockClear();
    mockState = stateWithTour(['ava']);
    render(<MarketingRelease />);
    fireEvent.click(screen.getByRole('button', { name: /Ava Reyes/ }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_MARKETING_CHOICES', choices: expect.objectContaining({ pressTourCast: [] }) }),
    );
  });
});

describe('MarketingRelease - distributor deal clears self-marketing', () => {
  /**
   * A release-ready Wide, self-distributed state with the player's own channel
   * campaign set - the situation before they hand the film to a distributor.
   * The fixture studio owns a distribution arm, so a Wide release defaults to
   * self-distribution; the channel sliders are shown and its spend is charged.
   */
  function stateWithSelfMarketedWide(): GameState {
    const base = stateWithScreening(true);
    const draft = asPlayerDraft(findProject(base.projects, base.focusedProjectId))!;
    const patched = {
      ...draft,
      marketingChoices: {
        ...draft.marketingChoices!,
        releaseType: 'Wide' as const,
        distributionMethod: 'self' as const,
        channelSpend: { trailers: 5_000_000, tv: 3_000_000, digital: 2_000_000, press: 0 },
        marketingSpend: 10_000_000,
      },
    };
    return { ...base, projects: [{ kind: 'player-in-progress', draft: patched }] } as GameState;
  }

  /** The non-self-distribute offer buttons in the Distribution card. */
  function distributorOfferButtons(): HTMLButtonElement[] {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('button.distributor-offer')).filter(
      (b) => !b.textContent?.includes('Self-Distribute'),
    );
  }

  it('zeroes the channel spend (returning the money to the budget) when a distributor is picked', () => {
    dispatch.mockClear();
    mockState = stateWithSelfMarketedWide();
    render(<MarketingRelease />);

    const offers = distributorOfferButtons();
    expect(offers.length).toBeGreaterThan(0);
    fireEvent.click(offers[0]);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_MARKETING_CHOICES',
        choices: expect.objectContaining({
          distributionMethod: 'distributor',
          marketingSpend: 0,
          channelSpend: { trailers: 0, tv: 0, digital: 0, press: 0 },
        }),
      }),
    );
  });

  it('restores the default self-marketing split when a distributor deal is abandoned for a Limited release', () => {
    dispatch.mockClear();
    const base = stateWithScreening(true);
    const draft = asPlayerDraft(findProject(base.projects, base.focusedProjectId))!;
    const patched = {
      ...draft,
      marketingChoices: {
        ...draft.marketingChoices!,
        releaseType: 'Wide' as const,
        distributionMethod: 'distributor' as const,
        channelSpend: { trailers: 0, tv: 0, digital: 0, press: 0 },
        marketingSpend: 0,
      },
    };
    mockState = { ...base, projects: [{ kind: 'player-in-progress', draft: patched }] } as GameState;
    render(<MarketingRelease />);

    fireEvent.click(screen.getByRole('button', { name: 'Limited' }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_MARKETING_CHOICES',
        choices: expect.objectContaining({
          releaseType: 'Limited',
          marketingSpend: 3_000_000,
          channelSpend: { trailers: 2_000_000, tv: 0, digital: 1_000_000, press: 0 },
        }),
      }),
    );
  });
});

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
