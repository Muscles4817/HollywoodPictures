// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { studioReducer } from '../state/studioReducer';
import { buildStateWithReadyDraft, buildReadyAsset } from '../state/testFixtures';
import { createRng } from '../engine/random';
import type { GameState } from '../state/gameState';
import type { Opportunity } from '../types';

// A reducer-backed mock: the acquired-card receipt is deliberately gated on the
// purchase having actually landed (the Opportunity becomes an Asset under the
// same id), so a dispatch stub that never moves state would test nothing.
let mockState: GameState;
const dispatch = vi.fn((action) => {
  mockState = studioReducer(mockState, action);
});
vi.mock('../state/StudioContext', () => ({ useStudio: () => ({ state: mockState, dispatch }) }));

import { OpportunityMarket } from './OpportunityMarket';

function listing(seed: number, overrides: Partial<Opportunity> = {}): Opportunity {
  const asset = buildReadyAsset(createRng(seed));
  return {
    id: `opp-${seed}`,
    source: 'Spec Screenplay',
    script: { ...asset.script, title: `Listing ${seed}` },
    acquisitionCost: 250_000,
    expiresOnDay: 30,
    postedOnDay: 1,
    bids: [],
    ...overrides,
  };
}

function marketState(opportunities: Opportunity[]): GameState {
  const base = buildStateWithReadyDraft(1);
  return {
    ...base,
    screen: 'opportunity-market',
    focusedProjectId: null,
    opportunities,
    nextOpportunityCheckDay: base.totalDays + 3,
  };
}

describe('OpportunityMarket — acquisition feedback', () => {
  // Block body on purpose: mockClear() returns the mock, and an expression-bodied
  // arrow would hand that back to vitest as a cleanup hook - which it then calls
  // with no action, straight into the reducer.
  beforeEach(() => {
    dispatch.mockClear();
  });

  it('leaves a receipt in the acquired listing’s slot instead of the card vanishing', () => {
    mockState = marketState([listing(1)]);
    render(<OpportunityMarket />);

    expect(screen.getByText('Listing 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Acquire' }));

    expect(dispatch).toHaveBeenCalledWith({ type: 'ACQUIRE_OPPORTUNITY', opportunityId: 'opp-1' });
    // The title is still on screen - the card became a receipt rather than
    // disappearing out from under the tap.
    expect(screen.getByText('Listing 1')).toBeInTheDocument();
    expect(screen.getByText('Acquired')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acquire' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Asset Library' })).toBeInTheDocument();
  });

  it('states what was paid and what the studio is left holding', () => {
    mockState = marketState([listing(2, { acquisitionCost: 400_000 })]);
    const cashBefore = mockState.studio.cash;
    render(<OpportunityMarket />);

    fireEvent.click(screen.getByRole('button', { name: 'Acquire' }));

    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('£400,000')).toBeInTheDocument();
    // The balance shown is the post-purchase one - the figure the player cannot
    // otherwise see from deep in the grid.
    expect(mockState.studio.cash).toBe(cashBefore - 400_000);
  });

  it('keeps the receipt in the slot its listing held', () => {
    mockState = marketState([listing(1), listing(2), listing(3)]);
    render(<OpportunityMarket />);

    const titlesBefore = screen.getAllByText(/^Listing \d$/).map((node) => node.textContent);
    fireEvent.click(screen.getAllByRole('button', { name: 'Acquire' })[1]);

    expect(screen.getAllByText(/^Listing \d$/).map((node) => node.textContent)).toEqual(titlesBefore);
  });

  it('dismisses a receipt without disturbing the rest of the grid', () => {
    mockState = marketState([listing(1), listing(2)]);
    render(<OpportunityMarket />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Acquire' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Dismiss the receipt for Listing 1/ }));

    expect(screen.queryByText('Listing 1')).not.toBeInTheDocument();
    expect(screen.getByText('Listing 2')).toBeInTheDocument();
  });

  it('shows the receipt rather than an empty state when the last listing is bought', () => {
    mockState = marketState([listing(1)]);
    render(<OpportunityMarket />);

    fireEvent.click(screen.getByRole('button', { name: 'Acquire' }));

    expect(screen.queryByText(/Nothing available right now/)).not.toBeInTheDocument();
    expect(screen.getByText('Acquired')).toBeInTheDocument();
  });

  it('does not claim an acquisition the reducer refused', () => {
    // Contested (a rival has bid): the reducer's ACQUIRE_OPPORTUNITY guard
    // no-ops, so there must be no receipt. Dispatched directly, since a
    // contested listing shows the bidding controls instead of Acquire.
    mockState = marketState([
      listing(1, { bids: [{ bidderId: 'rival-1', bidderName: 'Rival', amount: 300_000 }] }),
    ]);
    render(<OpportunityMarket />);

    fireEvent.click(screen.getByRole('button', { name: 'Outbid' }));

    expect(screen.queryByText('Acquired')).not.toBeInTheDocument();
  });
});
