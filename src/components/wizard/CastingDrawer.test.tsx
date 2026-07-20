// @vitest-environment jsdom
//
// Casting Redesign - the Direct Approach tab must only surface actors who can
// actually play the character, i.e. whose gender matches the one the role is
// written for (engine/casting.ts). Open Casting already filters its generated
// applicants; this is the parallel guard for the browse-and-offer list, and a
// regression test for the reported "click a female role, see a sea of male
// actors" bug. Same jsdom + StudioProvider pattern as PostProduction.test.tsx.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { CastingDrawer } from './CastingDrawer';
import { createInitialStudio, type GameState } from '../../state/gameState';
import { buildReadyDraft } from '../../state/testFixtures';
import { saveState } from '../../state/persistence';
import { generateTalentPool, generateTalentCandidates } from '../../engine/talentGenerator';
import { withRng } from '../../engine/random';
import { playerDraftToProject } from '../../engine/project';
import type { Person, ScriptCharacter } from '../../types';

beforeEach(() => {
  localStorage.clear();
});

const SALARY = 5_000_000;

function actorNamed(base: Person, name: string, gender: 'Male' | 'Female'): Person {
  return {
    ...base,
    identity: { ...base.identity, name, gender },
    careers: { ...base.careers, actor: { ...base.careers.actor!, minimumSalary: SALARY, typicalSalary: SALARY } },
  };
}

function stateWithFemaleLead(): GameState {
  return withRng(1, (rng) => {
    const studio = createInitialStudio(50_000_000);
    const talentPool = generateTalentPool(rng);
    const base = generateTalentCandidates('Actor', rng, 1)[0];

    // A deterministic, all-same-salary Actor pool so every one of them falls
    // inside Direct Approach's price window - isolating the gender filter as
    // the only thing that can exclude anyone.
    talentPool.Actor = [
      actorNamed(base, 'Fiona Female', 'Female'),
      actorNamed(base, 'Fran Female', 'Female'),
      actorNamed(base, 'Marcus Male', 'Male'),
      actorNamed(base, 'Martin Male', 'Male'),
    ];

    const readyDraft = buildReadyDraft(rng);
    // A Female Lead character; no actors hired yet. Every Character is
    // independently castable (slot-bound casting), so Direct Approach is
    // actionable for this one regardless of order.
    const leadCharacter: ScriptCharacter = { ...readyDraft.script!.cast.find((c) => c.prominence === 'Lead')!, castingGender: 'Female' };
    const script = { ...readyDraft.script!, cast: [leadCharacter, ...readyDraft.script!.cast.filter((c) => c.id !== leadCharacter.id)] };
    const draft = {
      ...readyDraft,
      script,
      talent: [],
      talentTargetPriceByRole: { 'Lead Actor': SALARY },
    };

    return {
      studio,
      screen: 'workspace' as const,
      projects: [playerDraftToProject(draft)],
      focusedProjectId: draft.id,
      projectWorkspaceSection: 'cast-and-crew' as const,
      rngSeed: 2,
      totalDays: 1,
      talentPool,
      rivalStudios: [],
      opportunities: [],
      nextOpportunityCheckDay: 1,
      viewingRivalStudioName: null,
      viewingProductionId: null,
    };
  }).result;
}

describe('CastingDrawer - Direct Approach gender filter', () => {
  it('lists only actors whose gender matches a gendered role, not every actor', () => {
    const state = stateWithFemaleLead();
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));

    // The two female actors are offered; neither male actor appears.
    expect(screen.getByText('Fiona Female')).toBeInTheDocument();
    expect(screen.getByText('Fran Female')).toBeInTheDocument();
    expect(screen.queryByText('Marcus Male')).not.toBeInTheDocument();
    expect(screen.queryByText('Martin Male')).not.toBeInTheDocument();
  });
});
