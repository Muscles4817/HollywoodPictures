// @vitest-environment jsdom
//
// Slot-bound casting, PR 2 - the UI unlock (docs/DESIGN_REVIEW_casting_slot_binding.md).
// With characters bound explicitly rather than by array position, the Cast &
// Crew hub no longer gates casting in order: every Character row is
// independently castable, so none of them shows the old "Waiting - cast X
// first" blocked state, even with nobody hired yet. Same jsdom + StudioProvider
// pattern as CastingDrawer.test.tsx.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

describe('HireTalent - budget allocation table (Phase 1b)', () => {
  it('lists per-role allocations with lock toggles that pin a role against the auto-split', () => {
    saveState(stateWithInceptionDraft());
    render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );

    const lockDirector = screen.getByRole('button', { name: 'Lock Director budget' });
    expect(lockDirector).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(lockDirector);
    expect(screen.getByRole('button', { name: 'Unlock Director budget' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('HireTalent - curated activity feed (Phase 2b)', () => {
  it('renders recent meaningful staffing events, newest first, and stays hidden when the log is empty', () => {
    // Empty log: no feed at all.
    saveState(stateWithInceptionDraft());
    const { unmount } = render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );
    expect(screen.queryByText('Recent activity')).not.toBeInTheDocument();
    unmount();

    // Seed a couple of meaningful events onto the draft.
    const seeded = stateWithInceptionDraft();
    const project = seeded.projects[0];
    if (project.kind === 'player-in-progress') {
      project.draft.staffingLog = [
        { day: 1, kind: 'audition', subject: 'Dom Cobb', personName: 'Screen Tester' },
        { day: 3, kind: 'attached', subject: 'Dom Cobb', personName: 'Marquee Star', amount: 5_000_000 },
      ];
    }
    saveState(seeded);
    render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
    expect(screen.getByText('Marquee Star')).toBeInTheDocument();
    expect(screen.getByText('Screen Tester')).toBeInTheDocument();
  });
});

describe('HireTalent - crew suitability read (Workstream II fit-read floor)', () => {
  it('shows a qualitative demand read on the modelled department-head rows', () => {
    saveState(stateWithInceptionDraft());
    render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );
    const board = screen.getByText('Shoot begins as soon as the cast is set.').closest('.staffing-board') as HTMLElement;
    // Inception is VFX/design-heavy: the VFX Supervisor row carries a demand read.
    const vfxRow = within(board).getByText(/VFX Supervisor/).closest('tr') as HTMLElement;
    const read = vfxRow.querySelector('.staffing-suitability') as HTMLElement;
    expect(read).toBeInTheDocument();
    expect(read.textContent).toMatch(/demand/i);
    // Qualitative only — no raw score digits leak into the read.
    expect(read.textContent).not.toMatch(/\d/);
  });

  it('surfaces the Execution Strategy method choice on the hub and persists a change', () => {
    saveState(stateWithInceptionDraft());
    render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );
    // Every film exposes the environment-method axis.
    const envSelect = screen.getByLabelText('Environment method') as HTMLSelectElement;
    expect(envSelect).toBeInTheDocument();
    fireEvent.change(envSelect, { target: { value: 'fullyDigital' } });
    // The choice persists (re-render reflects it) — the producer decision took.
    expect((screen.getByLabelText('Environment method') as HTMLSelectElement).value).toBe('fullyDigital');
  });

  it('surfaces a Stunts & Practical read on the hub, unstaffed by default', () => {
    saveState(stateWithInceptionDraft());
    render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );
    const board = screen.getByText('Shoot begins as soon as the cast is set.').closest('.staffing-board') as HTMLElement;
    const stunts = board.querySelector('.staffing-stunts') as HTMLElement;
    expect(stunts).toBeInTheDocument();
    expect(stunts.textContent).toMatch(/Stunts & Practical/);
    expect(stunts.textContent).toMatch(/No stunt team/);
    expect(stunts.textContent).toMatch(/demand/i);
  });
});

describe('HireTalent - live staffing board (Phase 2a)', () => {
  it('shows the shoot window and per-role lifecycle, and opens a character into casting', () => {
    saveState(stateWithInceptionDraft());
    render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );

    const board = screen.getByText('Shoot begins as soon as the cast is set.').closest('.staffing-board') as HTMLElement;
    // Every role starts Unstaffed on this fresh draft.
    expect(within(board).getAllByText('Unstaffed').length).toBeGreaterThan(0);

    // Open the Dom Cobb row from the board -> the casting drawer for that character.
    const domRow = within(board).getByText(/Dom Cobb/).closest('tr') as HTMLElement;
    fireEvent.click(within(domRow).getByRole('button', { name: 'Open' }));
    expect(screen.getByText(/Who plays Dom Cobb/)).toBeInTheDocument();
  });
});
