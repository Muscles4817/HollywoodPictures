// @vitest-environment jsdom
//
// Production Redesign (docs/DESIGN_REVIEW_production_redesign.md §16, step 6):
// the planning screen carries a conversation card for every craft facet — Sets,
// VFX, and Stunts/Practical — each with its head's confidence read, and the
// Practical card lets the player hire a Stunt Team from the world pool.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { ProductionPlanning } from './ProductionPlanning';
import { buildStateWithReadyDraft } from '../../state/testFixtures';
import { saveState } from '../../state/persistence';
import { generateStuntTeamPool } from '../../engine/stuntTeams';
import { withRng } from '../../engine/random';

beforeEach(() => localStorage.clear());

function renderPlanningWithStuntPool() {
  const base = buildStateWithReadyDraft(1);
  const stuntTeamPool = withRng(42, (rng) => generateStuntTeamPool(rng)).result;
  saveState({ ...base, screen: 'production', stuntTeamPool });
  render(
    <StudioProvider>
      <ProductionPlanning />
    </StudioProvider>,
  );
  return stuntTeamPool;
}

describe('ProductionPlanning — craft-facet conversation cards', () => {
  it('renders a conversation card for each craft facet', () => {
    renderPlanningWithStuntPool();
    expect(screen.getByText('Production Design')).toBeInTheDocument();
    expect(screen.getByText('Visual Effects')).toBeInTheDocument();
    expect(screen.getByText('Stunts & Practical Effects')).toBeInTheDocument();
  });

  it('offers the world Stunt Team roster to hire, and attaching one sticks', () => {
    const pool = renderPlanningWithStuntPool();
    const select = screen.getByLabelText('Stunt Team') as HTMLSelectElement;
    // The "no team" option plus every team in the pool are selectable.
    expect(select.options.length).toBe(pool.length + 1);
    const team = [...pool].sort((a, b) => b.skill - a.skill)[0];
    fireEvent.change(select, { target: { value: team.id } });
    // The selection persists (round-trips through the reducer/context) and the
    // team's specialties + fee surface.
    expect((screen.getByLabelText('Stunt Team') as HTMLSelectElement).value).toBe(team.id);
  });
});
