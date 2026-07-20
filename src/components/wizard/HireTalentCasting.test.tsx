// @vitest-environment jsdom
//
// Slot-bound casting, PR 2 - the UI unlock (docs/DESIGN_REVIEW_casting_slot_binding.md).
// With characters bound explicitly rather than by array position, the Cast &
// Crew hub no longer gates casting in order: every Character row is
// independently castable, so none of them shows the old "Waiting - cast X
// first" blocked state, even with nobody hired yet. Same jsdom + StudioProvider
// pattern as CastingDrawer.test.tsx.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { HireTalent } from './HireTalent';
import { createInitialStudio, createDraftFromAsset, type GameState } from '../../state/gameState';
import { saveState } from '../../state/persistence';
import { generateTalentPool } from '../../engine/talentGenerator';
import { withRng } from '../../engine/random';
import { playerDraftToProject } from '../../engine/project';
import { TEST_SCRIPT_ASSETS } from '../../data/testScripts';

beforeEach(() => {
  localStorage.clear();
});

const inceptionAsset = TEST_SCRIPT_ASSETS.find((a) => a.script.id === 'test-script-inception')!;

function stateWithInceptionDraft(): GameState {
  const draft = createDraftFromAsset(inceptionAsset, {});
  const talentPool = withRng(1, (rng) => generateTalentPool(rng)).result;
  return {
    studio: createInitialStudio(400_000_000),
    screen: 'workspace',
    projects: [playerDraftToProject(draft)],
    focusedProjectId: draft.id,
    projectWorkspaceSection: 'cast-and-crew',
    rngSeed: 2,
    totalDays: 1,
    talentPool,
    rivalStudios: [],
    opportunities: [],
    nextOpportunityCheckDay: 1,
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
}

describe('HireTalent - slot-bound casting has no in-order gate', () => {
  it('shows every Character as independently castable, with no "waiting on an earlier role" state', () => {
    saveState(stateWithInceptionDraft());
    render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );

    // All six Inception characters are present as their own rows - leads and
    // supporting alike, regardless of position.
    for (const name of ['Dom Cobb', 'Arthur', 'Ariadne', 'Eames', 'Robert Fischer', 'Mal']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }

    // The old append-order gate is gone: no row is blocked waiting on an
    // earlier same-prominence role, and every uncast character just reads
    // "Not yet cast" rather than "Waiting - cast X first".
    expect(screen.queryByText(/Waiting/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cast .* first/i)).not.toBeInTheDocument();
    // Five leads/supporting are uncast (six characters, none hired) - each
    // shows the plain uncast state, none a blocked one.
    expect(screen.getAllByText('Not yet cast').length).toBe(6);
  });
});
