// @vitest-environment jsdom
// The studio overview is where the Brand notice is read (market realism
// Phase 3, docs/DESIGN_notification_contract.md §2.2): showing it there is what
// acknowledges it.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildStateWithReadyDraft } from '../state/testFixtures';
import type { GameState } from '../state/gameState';

const dispatch = vi.fn();
let mockState: GameState;
vi.mock('../state/StudioContext', () => ({ useStudio: () => ({ state: mockState, dispatch }) }));

import { Dashboard } from './Dashboard';

describe('Dashboard - the Brand notice', () => {
  it('shows the notice under Brand and marks it read', () => {
    const base = buildStateWithReadyDraft(3);
    mockState = { ...base, focusedProjectId: null, studio: { ...base.studio, brandNotice: { day: base.totalDays, direction: 'fading' } } };
    render(<Dashboard />);
    expect(screen.getByText("Your studio's name is fading. It has been a while since a release of yours was widely seen.")).toBeInTheDocument();
    expect(dispatch).toHaveBeenCalledWith({ type: 'ACKNOWLEDGE_BRAND_NOTICE' });
  });

  it('does not acknowledge what it is not showing', () => {
    dispatch.mockClear();
    const base = buildStateWithReadyDraft(3);
    mockState = { ...base, focusedProjectId: null, studio: { ...base.studio, brandNotice: undefined } };
    render(<Dashboard />);
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'ACKNOWLEDGE_BRAND_NOTICE' });
  });
});
