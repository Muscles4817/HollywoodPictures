// @vitest-environment jsdom
//
// Casting Redesign - the Direct Approach tab must only surface actors who can
// actually play the character, i.e. whose gender matches the one the role is
// written for (engine/casting.ts). Open Casting already filters its generated
// applicants; this is the parallel guard for the browse-and-offer list, and a
// regression test for the reported "click a female role, see a sea of male
// actors" bug. Same jsdom + StudioProvider pattern as PostProduction.test.tsx.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { CastingDrawer } from './CastingDrawer';
import { createInitialStudio, type GameState } from '../../state/gameState';
import { buildReadyDraft } from '../../state/testFixtures';
import { saveState } from '../../state/persistence';
import { generateTalentPool, generateTalentCandidates } from '../../engine/talentGenerator';
import { openCastingCall } from '../../engine/castingCalls';
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

function stateWithOpenCastingApplicant(channel: 'OpenCasting' | 'InterestedTalent' = 'OpenCasting'): GameState {
  return withRng(11, (rng) => {
    const studio = createInitialStudio(50_000_000);
    const talentPool = generateTalentPool(rng);
    const base = generateTalentCandidates('Actor', rng, 1)[0];
    const applicant = actorNamed(base, 'Fiona Female', 'Female');

    const readyDraft = buildReadyDraft(rng);
    const leadCharacter: ScriptCharacter = { ...readyDraft.script!.cast.find((c) => c.prominence === 'Lead')!, castingGender: 'Female' };
    const script = { ...readyDraft.script!, cast: [leadCharacter, ...readyDraft.script!.cast.filter((c) => c.id !== leadCharacter.id)] };
    const call = {
      ...openCastingCall(leadCharacter.id, 'Lead Actor', 1),
      applicants: [{ person: applicant, appliedOnDay: 1, channel }],
    };
    const draft = {
      ...readyDraft,
      script,
      talent: [],
      talentTargetPriceByRole: { 'Lead Actor': SALARY },
      castingCalls: [call],
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

describe('CastingDrawer - dismissing an Open Casting applicant', () => {
  it('offers a Dismiss button that clears the applicant off the list', () => {
    const state = stateWithOpenCastingApplicant();
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    // The applicant is listed (Open Casting is the default tab)...
    expect(screen.getByText('Fiona Female')).toBeInTheDocument();
    // ...with a Dismiss action alongside Cast.
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    // Dispatch removes them, so the card is gone and the empty-state shows.
    expect(screen.queryByText('Fiona Female')).not.toBeInTheDocument();
    expect(screen.getByText(/no applicants yet/i)).toBeInTheDocument();
  });
});

/** A Female-lead draft whose pool has one free and one booked (until day 400) female actor, both in the price window. */
function stateWithMixedAvailability(): GameState {
  return withRng(1, (rng) => {
    const studio = createInitialStudio(50_000_000);
    const talentPool = generateTalentPool(rng);
    const base = generateTalentCandidates('Actor', rng, 1)[0];
    const free = actorNamed(base, 'Fiona Free', 'Female');
    const booked: Person = {
      ...actorNamed(base, 'Bella Booked', 'Female'),
      availability: { commitments: [{ projectId: 'other-film', role: 'Lead Actor', startDay: 1, endDay: 400 }] },
    };
    talentPool.Actor = [free, booked];

    const readyDraft = buildReadyDraft(rng);
    const leadCharacter: ScriptCharacter = { ...readyDraft.script!.cast.find((c) => c.prominence === 'Lead')!, castingGender: 'Female' };
    const script = { ...readyDraft.script!, cast: [leadCharacter, ...readyDraft.script!.cast.filter((c) => c.id !== leadCharacter.id)] };
    const draft = { ...readyDraft, script, talent: [], talentTargetPriceByRole: { 'Lead Actor': SALARY } };

    return {
      studio,
      screen: 'workspace' as const,
      projects: [playerDraftToProject(draft)],
      focusedProjectId: draft.id,
      projectWorkspaceSection: 'cast-and-crew' as const,
      rngSeed: 2,
      totalDays: 10,
      talentPool,
      rivalStudios: [],
      opportunities: [],
      nextOpportunityCheckDay: 1,
      viewingRivalStudioName: null,
      viewingProductionId: null,
    };
  }).result;
}

describe('CastingDrawer - "Available now only" filter', () => {
  it('hides actors booked elsewhere from Direct Approach when the filter is on, and shows them when off', () => {
    const state = stateWithMixedAvailability();
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));

    // By default (filter off) both the free and the booked actor are listed.
    expect(screen.getByText('Fiona Free')).toBeInTheDocument();
    expect(screen.getByText('Bella Booked')).toBeInTheDocument();

    // Turning the filter on drops the booked actor, keeps the free one.
    fireEvent.click(screen.getByLabelText('Available now only'));
    expect(screen.getByText('Fiona Free')).toBeInTheDocument();
    expect(screen.queryByText('Bella Booked')).not.toBeInTheDocument();
  });

  it('disables the offer for a booked actor (the schedule gate would hard-reject it), while a free actor stays actionable', () => {
    const state = stateWithMixedAvailability();
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));

    const freeCard = screen.getByText('Fiona Free').closest('.card') as HTMLElement;
    const bookedCard = screen.getByText('Bella Booked').closest('.card') as HTMLElement;
    // The free actor can be offered; the booked one's Make Offer is disabled.
    expect(within(freeCard).getByRole('button', { name: 'Make Offer' })).toBeEnabled();
    expect(within(bookedCard).getByRole('button', { name: 'Make Offer' })).toBeDisabled();
    // And the card explains why, without promising a delayed hire.
    expect(within(bookedCard).getByText(/You can't cast them until then/)).toBeInTheDocument();
  });
});

/** A Female-lead draft whose pool holds one at-offer actor and one who wants nearly double (still inside the price window, but below their floor at this offer). */
function stateWithBelowFloorCandidate(): GameState {
  return withRng(1, (rng) => {
    const studio = createInitialStudio(50_000_000);
    const talentPool = generateTalentPool(rng);
    const base = generateTalentCandidates('Actor', rng, 1)[0];
    const priced = (name: string, salary: number): Person => ({
      ...base,
      identity: { ...base.identity, name, gender: 'Female' },
      careers: { ...base.careers, actor: { ...base.careers.actor!, minimumSalary: salary, typicalSalary: salary } },
    });
    talentPool.Actor = [priced('Ava Affordable', SALARY), priced('Priya Pricey', 9_000_000)];

    const readyDraft = buildReadyDraft(rng);
    const leadCharacter: ScriptCharacter = { ...readyDraft.script!.cast.find((c) => c.prominence === 'Lead')!, castingGender: 'Female' };
    const script = { ...readyDraft.script!, cast: [leadCharacter, ...readyDraft.script!.cast.filter((c) => c.id !== leadCharacter.id)] };
    const draft = { ...readyDraft, script, talent: [], talentTargetPriceByRole: { 'Lead Actor': SALARY } };

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

describe('CastingDrawer - candidate reasoning chips', () => {
  it('flags a below-salary-floor candidate with a "Wants more pay" blocker and a disabled offer, while an at-offer actor stays actionable', () => {
    const state = stateWithBelowFloorCandidate();
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));

    const affordableCard = screen.getByText('Ava Affordable').closest('.card') as HTMLElement;
    const priceyCard = screen.getByText('Priya Pricey').closest('.card') as HTMLElement;
    // The below-floor actor: a blocker chip and a disabled offer (it would be hard-rejected).
    expect(within(priceyCard).getByText('Wants more pay')).toBeInTheDocument();
    expect(within(priceyCard).getByRole('button', { name: 'Make Offer' })).toBeDisabled();
    // The at-offer actor carries no such blocker and can be offered.
    expect(within(affordableCard).queryByText('Wants more pay')).not.toBeInTheDocument();
    expect(within(affordableCard).getByRole('button', { name: 'Make Offer' })).toBeEnabled();
  });

  it('shows a "Sought you out" chip for an applicant who reached out directly (InterestedTalent)', () => {
    const state = stateWithOpenCastingApplicant('InterestedTalent');
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    // Open Casting is the default tab; the direct-interest draw reads as a chip.
    expect(screen.getByText('Sought you out')).toBeInTheDocument();
  });
});

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
