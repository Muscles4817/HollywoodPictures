// @vitest-environment jsdom
//
// Casting Appeal Rework - before this, Director hiring here was pure
// instant-click with no interest step at all. First component-level
// coverage for that new director accept/reject wiring (the engine-level
// mechanics are covered in engine/directorAppeal.test.ts) - a real render,
// standing in for a manual browser check (mirrors components/common/WizardSteps.test.tsx's
// own jsdom+StudioProvider pattern).
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { RoleHiringDrawer } from './RoleHiringDrawer';
import { createInitialStudio, type GameState } from '../../state/gameState';
import { buildReadyDraft } from '../../state/testFixtures';
import { saveState } from '../../state/persistence';
import { generateTalentPool } from '../../engine/talentGenerator';
import { withRng } from '../../engine/random';
import { playerDraftToProject } from '../../engine/project';
import type { FilmDraft, Person } from '../../types';

beforeEach(() => {
  localStorage.clear();
});

function highFameDirector(): Person {
  return {
    id: 'a-lister-director',
    identity: { name: 'A-Lister Director', appearanceTags: [] },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 95, prestige: 95, industryRespect: 90, reliability: 80, currentHeat: 90 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Director',
    careers: {
      director: {
        role: 'Director', active: true, experience: 90, roleReputation: 90,
        minimumSalary: 5_000_000, typicalSalary: 5_000_000, skill: 90,
        toneProfile: { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 },
        productionStyle: { environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33 }, effectsStrategy: { practical: 0.5, digital: 0.5 } },
      },
    },
  };
}

/** A GameState with no Director hired yet, and a single fame-95 director candidate priced exactly at the Target Price slider so findCandidatesNearPrice always includes them. */
function stateWithNoDirector(seed: number, studioPrestige: number): GameState {
  const { result: talentPool, nextSeed } = withRng(seed, (rng) => generateTalentPool(rng));
  const base = withRng(seed + 1, (rng) => buildReadyDraft(rng)).result;
  const draft: FilmDraft = {
    ...base,
    talent: base.talent.filter((a) => a.role !== 'Director'),
    talentTargetPriceByRole: { ...base.talentTargetPriceByRole, Director: 5_000_000 },
  };
  return {
    studio: { ...createInitialStudio(10_000_000), prestige: studioPrestige },
    screen: 'production',
    projects: [playerDraftToProject(draft)],
    focusedProjectId: draft.id,
    projectWorkspaceSection: 'cast-and-crew',
    rngSeed: nextSeed,
    totalDays: 1,
    talentPool: { ...talentPool, Director: [...talentPool.Director, highFameDirector()] },
    rivalStudios: [],
    opportunities: [],
    nextOpportunityCheckDay: 1,
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
}

describe('RoleHiringDrawer - director interest (Casting Appeal Rework)', () => {
  it('blocks a high-fame director at a low-prestige studio: a disabled card that never attaches', () => {
    const state = stateWithNoDirector(1, 20); // createInitialStudio's own starting prestige
    saveState(state);
    render(
      <StudioProvider>
        <RoleHiringDrawer role="Director" onClose={() => {}} />
      </StudioProvider>,
    );
    // The prestige gate is a doomed offer, so the card is disabled up front
    // (docs/DESIGN_REVIEW_casting_ux.md) rather than clickable-then-rejected.
    const card = screen.getByText('A-Lister Director').closest('.card') as HTMLElement;
    expect(card).toHaveClass('card-disabled');
    // Clicking the disabled card does nothing - never attached, no "accepted".
    fireEvent.click(screen.getByText('A-Lister Director'));
    expect(screen.queryByText(/accepted/)).not.toBeInTheDocument();
  });

  it('shows a prestige-gate chip on the candidate card before it is even clicked', () => {
    const state = stateWithNoDirector(2, 20);
    saveState(state);
    render(
      <StudioProvider>
        <RoleHiringDrawer role="Director" onClose={() => {}} />
      </StudioProvider>,
    );
    // The generated pool may include more than one high-fame director who'd
    // also fail this studio's prestige gate - the point is that our
    // specific injected candidate is one of them, not that they're the only one.
    expect(screen.getAllByText('Wants more prestige').length).toBeGreaterThan(0);
  });

  it('attaches the same director once studio prestige clears the gate', () => {
    const state = stateWithNoDirector(3, 90);
    saveState(state);
    render(
      <StudioProvider>
        <RoleHiringDrawer role="Director" onClose={() => {}} />
      </StudioProvider>,
    );
    fireEvent.click(screen.getByText('A-Lister Director'));
    expect(screen.getByText(/A-Lister Director accepted\./)).toBeInTheDocument();
  });
});
