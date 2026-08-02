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
import { getTypicalSalaryForRole } from '../../engine/person';
import { formatMoney } from '../common/Money';

beforeEach(() => {
  localStorage.clear();
});

const inceptionAsset = TEST_SCRIPT_ASSETS.find((a) => a.script.id === 'test-script-inception')!;

const FLAT_TONE = { action: 40, comedy: 40, romance: 40, suspense: 40, drama: 40, spectacle: 40 };
function practicalDirector() {
  return {
    identity: { name: 'Chris Practical', appearanceTags: [], gender: 'Male', dateOfBirth: undefined },
    personality: { professionalism: 60, ambition: 60, loyalty: 60, ego: 40, temperament: 60, pressureHandling: 60, controversy: 20, adaptability: 60 },
    reputation: { fame: 60, prestige: 60, industryRespect: 60, reliability: 70, currentHeat: 40 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Director',
    careers: {
      director: {
        role: 'Director', active: true, experience: 70, roleReputation: 70, minimumSalary: 1_000_000, typicalSalary: 4_000_000,
        skill: 80, toneProfile: FLAT_TONE,
        productionStyle: {
          effectsStrategy: { practical: 0.9, digital: 0.1 },
          environmentStrategy: { studio: 0.45, location: 0.45, digital: 0.1 },
        },
      },
    },
  } as unknown as Parameters<typeof playerDraftToProject>[0]['talent'][number]['person'];
}

function stateWithInceptionDraft(withDirector = false): GameState {
  const draft = createDraftFromAsset(inceptionAsset, {}, 1);
  if (withDirector) {
    // A practical director + a digital-leaning PD -> a Director↔PD philosophy clash.
    const digitalPD = {
      id: 'pd-digital', identity: { name: 'Dana Digital', appearanceTags: [], gender: 'Female', dateOfBirth: undefined },
      personality: { professionalism: 60, ambition: 60, loyalty: 60, ego: 40, temperament: 60, pressureHandling: 60, controversy: 20, adaptability: 60 },
      reputation: { fame: 55, prestige: 55, industryRespect: 55, reliability: 65, currentHeat: 35 },
      availability: { commitments: [] }, traits: [], primaryRole: 'Production Designer',
      careers: { productionDesigner: { role: 'Production Designer', active: true, experience: 60, roleReputation: 60, minimumSalary: 1, typicalSalary: 1, skill: 65, philosophy: { digitalAffinity: 0.95, stylisation: 0.6 } } },
    } as unknown as typeof draft.talent[number]['person'];
    draft.talent = [
      ...draft.talent,
      { role: 'Director', person: practicalDirector() } as typeof draft.talent[number],
      { role: 'Production Designer', person: digitalPD } as typeof draft.talent[number],
    ];
    draft.executionStrategy = { creatureMethod: 'fullyCG', environmentMethod: 'fullyDigital' };
  }
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

describe('HireTalent - cast card shows the negotiated fee, not the standard quote', () => {
  it('displays a hired actor\'s agreedSalary on their character card, not their typicalSalary', () => {
    const seeded = stateWithInceptionDraft();
    const project = seeded.projects[0];
    // Pick a real pool actor whose standard quote differs from what we sign
    // them for, so the two figures can't accidentally coincide.
    const star = seeded.talentPool.Actor.find((p) => getTypicalSalaryForRole(p, 'Lead Actor') !== 3_000_000)!;
    const typical = getTypicalSalaryForRole(star, 'Lead Actor');
    if (project.kind === 'player-in-progress') {
      const domCobb = project.draft.script!.cast.find((c) => c.name === 'Dom Cobb')!;
      project.draft.talent = [
        ...project.draft.talent,
        { role: 'Lead Actor', person: star, characterId: domCobb.id, agreedSalary: 3_000_000 } as typeof project.draft.talent[number],
      ];
    }
    saveState(seeded);
    render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );

    // The Dom Cobb card reads the negotiated fee, never the actor's standard quote.
    const domCard = screen.getByText(star.identity.name).closest('.card') as HTMLElement;
    expect(within(domCard).getByText(/£3,000,000/)).toBeInTheDocument();
    expect(within(domCard).queryByText(formatMoney(typical))).not.toBeInTheDocument();
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

  it('shows the Director-approach compatibility read when a director is attached, and hides it otherwise', () => {
    // No director: no compatibility read, but the approach control still renders.
    saveState(stateWithInceptionDraft(false));
    const { unmount } = render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );
    expect(document.querySelector('.director-approach')).not.toBeInTheDocument();
    unmount();

    // A practical director on a fully-CG/fully-digital production -> friction.
    saveState(stateWithInceptionDraft(true));
    render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );
    const read = document.querySelector('.director-approach') as HTMLElement;
    expect(read).toBeInTheDocument();
    expect(read.className).toMatch(/director-approach--friction/);
    expect(read.textContent).toMatch(/pulling against|friction/i);
  });

  it('surfaces the crew collaboration edges among attached heads (Director↔PD clash)', () => {
    saveState(stateWithInceptionDraft(true));
    render(
      <StudioProvider>
        <HireTalent />
      </StudioProvider>,
    );
    expect(screen.getByText('Creative collaboration')).toBeInTheDocument();
    const edges = document.querySelectorAll('.crew-collab__edge');
    expect(edges.length).toBeGreaterThan(0);
    const text = Array.from(edges).map((e) => e.textContent).join(' ');
    expect(text).toMatch(/Director & Production Designer/);
    expect(text).not.toMatch(/\d/); // qualitative only
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
