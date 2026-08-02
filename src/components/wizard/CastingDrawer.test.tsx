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

// Unique id per name - the shared talent pool keys people by id, and the drawer
// now caches appeal by id, so distinct people must have distinct ids (real
// generated talent always does; these hand-built fixtures have to opt in).
function actorId(name: string): string {
  return `actor-${name.replace(/\s+/g, '-').toLowerCase()}`;
}

// Direct Approach now gates who's scoutable by fame (only famous names show
// without a Casting Director), so hand-built fixture actors get a clearly-famous
// fame unless a test is specifically about the fame gate - otherwise they'd be
// hidden and every unrelated Direct Approach test would break.
const SCOUTABLE_FAME = 60;

function actorNamed(base: Person, name: string, gender: 'Male' | 'Female'): Person {
  return {
    ...base,
    id: actorId(name),
    identity: { ...base.identity, name, gender },
    reputation: { ...base.reputation, fame: SCOUTABLE_FAME },
    careers: { ...base.careers, actor: { ...base.careers.actor!, minimumSalary: SALARY, typicalSalary: SALARY } },
  };
}

/** A Female actor with a custom typical/minimum salary and a unique id. */
function femaleActor(base: Person, name: string, salary: number): Person {
  return {
    ...base,
    id: actorId(name),
    identity: { ...base.identity, name, gender: 'Female' },
    reputation: { ...base.reputation, fame: SCOUTABLE_FAME },
    careers: { ...base.careers, actor: { ...base.careers.actor!, minimumSalary: salary, typicalSalary: salary } },
  };
}

/** A hired Casting Director (crew) for the draft's talent - unlocks the Phase 7 "Casting Director's take". */
function castingDirectorPerson(skill: number): Person {
  return {
    id: 'cd-casey',
    identity: { name: 'Casey Director', appearanceTags: [], gender: 'Female' },
    personality: { professionalism: 60, ambition: 50, loyalty: 50, ego: 40, temperament: 60, pressureHandling: 60, controversy: 20, adaptability: 60 },
    reputation: { fame: 20, prestige: 55, industryRespect: 60, reliability: 70, currentHeat: 20 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Casting Director',
    careers: { castingDirector: { role: 'Casting Director', active: true, experience: 60, roleReputation: 60, minimumSalary: 100_000, typicalSalary: 300_000, skill } },
  } as unknown as Person;
}

/** A Female-lead, no-talent draft at the given offered salary (the pool is set on talentPool.Actor by the caller). */
function draftWithActors(rng: Parameters<typeof buildReadyDraft>[0], offered: number, extras: Partial<Parameters<typeof playerDraftToProject>[0]> = {}) {
  const readyDraft = buildReadyDraft(rng);
  const leadCharacter: ScriptCharacter = { ...readyDraft.script!.cast.find((c) => c.prominence === 'Lead')!, castingGender: 'Female', castingAgeBand: 'Any' };
  const script = { ...readyDraft.script!, cast: [leadCharacter, ...readyDraft.script!.cast.filter((c) => c.id !== leadCharacter.id)] };
  return { ...readyDraft, script, talent: [], talentTargetPriceByRole: { 'Lead Actor': offered }, ...extras };
}

function wrapState(studio: ReturnType<typeof createInitialStudio>, talentPool: ReturnType<typeof generateTalentPool>, draft: ReturnType<typeof buildReadyDraft>): GameState {
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
}

function characterOf(state: GameState): ScriptCharacter {
  return (state.projects[0] as { draft: { script: { cast: ScriptCharacter[] } } }).draft.script.cast[0];
}

function renderDrawer(state: GameState) {
  saveState(state);
  render(
    <StudioProvider>
      <CastingDrawer character={characterOf(state)} role="Lead Actor" onClose={() => {}} />
    </StudioProvider>,
  );
}

describe('CastingDrawer - Direct Approach fame gate', () => {
  function stateWithFames(actors: { name: string; fame: number }[], withCD: boolean): GameState {
    return withRng(4, (rng) => {
      const studio = createInitialStudio(50_000_000);
      const talentPool = generateTalentPool(rng);
      const base = generateTalentCandidates('Actor', rng, 1)[0];
      talentPool.Actor = actors.map((a) => ({
        ...base,
        id: actorId(a.name),
        identity: { ...base.identity, name: a.name, gender: 'Female' as const },
        reputation: { ...base.reputation, fame: a.fame },
        careers: { ...base.careers, actor: { ...base.careers.actor!, minimumSalary: SALARY, typicalSalary: SALARY } },
      }));
      const talent = withCD ? [{ person: castingDirectorPerson(95), role: 'Casting Director' as const }] : [];
      return wrapState(studio, talentPool, draftWithActors(rng, SALARY, { talent }));
    }).result;
  }

  const FAMOUS = { name: 'Famous Fran', fame: 70 };
  const OBSCURE = { name: 'Obscure Odette', fame: 35 };

  it('scouts only famous names when no casting director is hired', () => {
    renderDrawer(stateWithFames([FAMOUS, OBSCURE], false));
    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    expect(screen.getByText('Famous Fran')).toBeInTheDocument();
    expect(screen.queryByText('Obscure Odette')).not.toBeInTheDocument();
  });

  it('surfaces lesser-known names once a casting director is hired', () => {
    renderDrawer(stateWithFames([FAMOUS, OBSCURE], true));
    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    expect(screen.getByText('Famous Fran')).toBeInTheDocument();
    expect(screen.getByText('Obscure Odette')).toBeInTheDocument();
  });
});

describe('CastingDrawer - discovery controls', () => {
  it('shows scoutable actors regardless of price (the salary bar is only the offer), and a name search narrows', () => {
    const state = withRng(3, (rng) => {
      const studio = createInitialStudio(50_000_000);
      const talentPool = generateTalentPool(rng);
      const base = generateTalentCandidates('Actor', rng, 1)[0];
      talentPool.Actor = [femaleActor(base, 'Near Nancy', 5_000_000), femaleActor(base, 'Far Fiona', 40_000_000)];
      return wrapState(studio, talentPool, draftWithActors(rng, 5_000_000));
    }).result;
    renderDrawer(state);

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    // Both show - Direct Approach is no longer a price window; the far-priced
    // actor is scoutable just the same, since the salary bar is only your offer.
    expect(screen.getByText('Near Nancy')).toBeInTheDocument();
    expect(screen.getByText('Far Fiona')).toBeInTheDocument();

    // A name search narrows the field to the match.
    fireEvent.change(screen.getByLabelText('Search candidates by name'), { target: { value: 'Far' } });
    expect(screen.getByText('Far Fiona')).toBeInTheDocument();
    expect(screen.queryByText('Near Nancy')).not.toBeInTheDocument();
  });

  it('flags an over-budget candidate and hides it under the "Affordable only" filter', () => {
    const state = withRng(5, (rng) => {
      const studio = createInitialStudio(5_500_000);
      const talentPool = generateTalentPool(rng);
      const base = generateTalentCandidates('Actor', rng, 1)[0];
      talentPool.Actor = [femaleActor(base, 'Cheap Cathy', 3_000_000), femaleActor(base, 'Costly Cora', 9_000_000)];
      // Zero out production + marketing so committed spend is ~0 and only the
      // candidate's own salary decides affordability against the £5.5M cash.
      const draft = draftWithActors(rng, 5_000_000, {
        productionChoices: { shootingBudgetAmount: 0, setQualityAmount: 0, practicalEffectsAmount: 0, vfxAmount: 0, runtimeIntensity: 0 },
      });
      draft.marketingChoices = { ...draft.marketingChoices!, marketingSpend: 0 };
      return wrapState(studio, talentPool, draft);
    }).result;
    renderDrawer(state);

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    const costlyCard = screen.getByText('Costly Cora').closest('.card') as HTMLElement;
    const cheapCard = screen.getByText('Cheap Cathy').closest('.card') as HTMLElement;
    // Affordability now reads off TalentStats' salary traffic-light dot rather than a separate chip.
    expect(within(costlyCard).getByText('Over budget')).toBeInTheDocument();
    expect(within(cheapCard).queryByText('Over budget')).not.toBeInTheDocument();

    // The filter hides the over-budget pick, keeps the affordable one.
    fireEvent.click(screen.getByLabelText('Affordable only'));
    expect(screen.getByText('Cheap Cathy')).toBeInTheDocument();
    expect(screen.queryByText('Costly Cora')).not.toBeInTheDocument();
  });

  it('sorts by fee, cheapest first, when the player picks the Fee sort', () => {
    const state = withRng(6, (rng) => {
      const studio = createInitialStudio(50_000_000);
      const talentPool = generateTalentPool(rng);
      const base = generateTalentCandidates('Actor', rng, 1)[0];
      talentPool.Actor = [femaleActor(base, 'Dearer Dana', 8_000_000), femaleActor(base, 'Budget Beth', 3_000_000)];
      return wrapState(studio, talentPool, draftWithActors(rng, 5_000_000));
    }).result;
    renderDrawer(state);

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    // Fee defaults to ascending (cheapest first).
    fireEvent.change(screen.getByLabelText('Sort candidates'), { target: { value: 'fee' } });
    const order = screen.getAllByText(/(Dearer Dana|Budget Beth)/).map((el) => el.textContent);
    expect(order[0]).toBe('Budget Beth'); // cheapest first
    expect(order[1]).toBe('Dearer Dana');

    // Flipping the direction toggle reverses it - priciest first.
    fireEvent.click(screen.getByRole('button', { name: /switch to high to low/i }));
    const reversed = screen.getAllByText(/(Dearer Dana|Budget Beth)/).map((el) => el.textContent);
    expect(reversed[0]).toBe('Dearer Dana');
    expect(reversed[1]).toBe('Budget Beth');
  });

  it('paginates the Direct Approach pool instead of dumping or capping it', () => {
    const state = withRng(7, (rng) => {
      const studio = createInitialStudio(500_000_000);
      const talentPool = generateTalentPool(rng);
      const base = generateTalentCandidates('Actor', rng, 1)[0];
      // 30 scoutable actors -> more than one page of 24.
      talentPool.Actor = Array.from({ length: 30 }, (_, i) => femaleActor(base, `Actor Number ${i}`, 1_000_000));
      return wrapState(studio, talentPool, draftWithActors(rng, 1_000_000));
    }).result;
    renderDrawer(state);

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    expect(screen.getByText(/Page 1 of 2 · 30 actors/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText(/Page 2 of 2 · 30 actors/)).toBeInTheDocument();
  });

  it('renders the role brief pane (what the part needs) alongside the candidates', () => {
    const state = withRng(9, (rng) => {
      const studio = createInitialStudio(50_000_000);
      const talentPool = generateTalentPool(rng);
      const base = generateTalentCandidates('Actor', rng, 1)[0];
      talentPool.Actor = [femaleActor(base, 'Brief Test', 3_000_000)];
      return wrapState(studio, talentPool, draftWithActors(rng, 3_000_000));
    }).result;
    renderDrawer(state);

    const brief = document.querySelector('.casting-brief');
    expect(brief).not.toBeNull();
    expect(brief!.textContent).toContain('The role');
    expect(brief!.textContent).toContain('What the part needs');
    // The demand axes read in the same terms as a candidate's fit breakdown.
    expect(brief!.textContent).toContain('Emotional Performance');
  });
});

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
    const leadCharacter: ScriptCharacter = { ...readyDraft.script!.cast.find((c) => c.prominence === 'Lead')!, castingGender: 'Female', castingAgeBand: 'Any' };
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
    const leadCharacter: ScriptCharacter = { ...readyDraft.script!.cast.find((c) => c.prominence === 'Lead')!, castingGender: 'Female', castingAgeBand: 'Any' };
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
    const leadCharacter: ScriptCharacter = { ...readyDraft.script!.cast.find((c) => c.prominence === 'Lead')!, castingGender: 'Female', castingAgeBand: 'Any' };
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

describe('CastingDrawer - waiting for a booked actor (Phase 6)', () => {
  it('offers to wait for a booked actor, which delays the shoot and frees them to be cast', () => {
    const state = stateWithMixedAvailability(); // Bella Booked is committed until day 400
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    const bella = screen.getByText('Bella Booked').closest('.card') as HTMLElement;
    fireEvent.click(within(bella).getByRole('button', { name: /Wait for them/ }));

    // A production-level delay banner appears, and Bella is now castable.
    expect(screen.getByText(/Shoot delayed/)).toBeInTheDocument();
    const bellaAfter = screen.getByText('Bella Booked').closest('.card') as HTMLElement;
    expect(within(bellaAfter).queryByRole('button', { name: /Wait for them/ })).not.toBeInTheDocument();
    expect(within(bellaAfter).getByRole('button', { name: /Make Offer/ })).toBeEnabled();

    // Resetting the delay puts the wait decision back.
    fireEvent.click(screen.getByRole('button', { name: 'Start as soon as cast' }));
    const bellaReset = screen.getByText('Bella Booked').closest('.card') as HTMLElement;
    expect(within(bellaReset).getByRole('button', { name: /Wait for them/ })).toBeInTheDocument();
  });
});

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
    expect(within(freeCard).getByRole('button', { name: /Make Offer/ })).toBeEnabled();
    expect(within(bookedCard).getByRole('button', { name: /Make Offer/ })).toBeDisabled();
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
      id: actorId(name),
      identity: { ...base.identity, name, gender: 'Female' },
      reputation: { ...base.reputation, fame: SCOUTABLE_FAME },
      careers: { ...base.careers, actor: { ...base.careers.actor!, minimumSalary: salary, typicalSalary: salary } },
    });
    talentPool.Actor = [priced('Ava Affordable', SALARY), priced('Priya Pricey', 9_000_000)];

    const readyDraft = buildReadyDraft(rng);
    const leadCharacter: ScriptCharacter = { ...readyDraft.script!.cast.find((c) => c.prominence === 'Lead')!, castingGender: 'Female', castingAgeBand: 'Any' };
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
  it('flags a below-salary-floor candidate with a "Below their floor" heads-up, but still lets you make the offer (they counter, not hard-reject)', () => {
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
    // The below-floor actor: a heads-up chip, but the offer is still actionable -
    // under negotiation a below-floor offer draws a counter rather than a wall.
    expect(within(priceyCard).getByText('Below their floor')).toBeInTheDocument();
    expect(within(priceyCard).getByRole('button', { name: /Make Offer/ })).toBeEnabled();
    // The at-offer actor carries no such heads-up and can be offered.
    expect(within(affordableCard).queryByText('Below their floor')).not.toBeInTheDocument();
    expect(within(affordableCard).getByRole('button', { name: /Make Offer/ })).toBeEnabled();
  });

  it('shows a pre-offer read (expected ask + odds) on a candidate before any offer is made', () => {
    const state = stateWithBelowFloorCandidate();
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    const card = screen.getByText('Ava Affordable').closest('.card') as HTMLElement;
    // The estimate block renders, hedging the expected ask with one of its openers.
    expect(card.querySelector('.candidate-estimate')).toBeTruthy();
    expect(card.textContent).toMatch(/want|guess/i);
  });

  it('shortlists a candidate from Direct Approach and shows them under the Shortlist tab', () => {
    const state = stateWithBelowFloorCandidate();
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    const card = screen.getByText('Ava Affordable').closest('.card') as HTMLElement;
    // Add to shortlist; the toggle flips to the "on" state.
    fireEvent.click(within(card).getByRole('button', { name: '☆ Shortlist' }));
    expect(within(card).getByRole('button', { name: '★ Shortlisted' })).toBeInTheDocument();

    // The Shortlist tab now carries a count, and shows the shortlisted candidate.
    fireEvent.click(screen.getByRole('button', { name: 'Shortlist (1)' }));
    const shortlistCard = screen.getByText('Ava Affordable').closest('.card') as HTMLElement;
    expect(within(shortlistCard).getByRole('button', { name: /Make Offer/ })).toBeInTheDocument();
    expect(within(shortlistCard).getByRole('button', { name: '★ Shortlisted' })).toBeInTheDocument();
  });

  it('shows an Open Casting forecast before the call is opened', () => {
    const state = stateWithBelowFloorCandidate(); // no casting call open -> pre-open panel
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    // The default Open Casting tab, with no call yet, previews the forecast.
    expect(screen.getByText(/Expect about/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open the Call' })).toBeInTheDocument();
  });

  it('filters the Direct Approach list by a facet (gender)', () => {
    const state = stateWithBelowFloorCandidate(); // Ava and Priya are both Female
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    expect(screen.getByText('Ava Affordable')).toBeInTheDocument();
    // Filter to men - both female candidates drop out.
    fireEvent.change(screen.getByLabelText('Filter by gender'), { target: { value: 'Male' } });
    expect(screen.queryByText('Ava Affordable')).not.toBeInTheDocument();
    // Back to women - they return.
    fireEvent.change(screen.getByLabelText('Filter by gender'), { target: { value: 'Female' } });
    expect(screen.getByText('Ava Affordable')).toBeInTheDocument();
  });

it("shows the Casting Director's take on a candidate once a casting director is hired", () => {
    const state = stateWithBelowFloorCandidate();
    const proj = state.projects[0];
    if (proj && 'draft' in proj) proj.draft.talent = [{ person: castingDirectorPerson(85), role: 'Casting Director' } as unknown as (typeof proj.draft.talent)[number]];
    const character = proj && 'draft' in proj ? proj.draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    const card = screen.getByText('Ava Affordable').closest('.card') as HTMLElement;
    expect(within(card).getByText(/Casting director.s take/i)).toBeInTheDocument();
  });

  it('arranges a screen test from a candidate card and shows it in progress', () => {
    const state = stateWithBelowFloorCandidate();
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    const card = screen.getByText('Ava Affordable').closest('.card') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Audition' }));
    // The button flips to an in-progress, disabled countdown.
    const updated = screen.getByText('Ava Affordable').closest('.card') as HTMLElement;
    const auditioning = within(updated).getByRole('button', { name: /Auditioning/ });
    expect(auditioning).toBeInTheDocument();
    expect(auditioning).toBeDisabled();
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

describe('CastingDrawer - Pin to Compare', () => {
  it('offers Pin to Compare in Direct Approach (previously missing) and swaps the grid for a head-to-head once two are pinned', () => {
    const state = stateWithFemaleLead();
    const character = state.projects[0] && 'draft' in state.projects[0] ? state.projects[0].draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));

    // The pin action exists on the actor flow at all - the reported gap.
    const fionaCard = screen.getByText('Fiona Female').closest('.card') as HTMLElement;
    fireEvent.click(within(fionaCard).getByRole('button', { name: 'Pin to Compare' }));

    // One pinned: still browsing, and the pinned card now reads as pinned.
    expect(screen.queryByText('Comparing two candidates')).not.toBeInTheDocument();

    const franCard = screen.getByText('Fran Female').closest('.card') as HTMLElement;
    fireEvent.click(within(franCard).getByRole('button', { name: 'Pin to Compare' }));

    // Two pinned: the browse grid gives way to the dedicated comparison view,
    // which opens with a recommendation rather than two cloned cards.
    expect(screen.getByText('Comparing two candidates')).toBeInTheDocument();
    expect(screen.getByText('Recommendation')).toBeInTheDocument();
  });

  it("surfaces the casting director's take as a compare row when a CD is hired", () => {
    const state = stateWithFemaleLead();
    const proj = state.projects[0];
    if (proj && 'draft' in proj) proj.draft.talent = [{ person: castingDirectorPerson(90), role: 'Casting Director' } as unknown as (typeof proj.draft.talent)[number]];
    const character = proj && 'draft' in proj ? proj.draft.script!.cast[0] : null;
    saveState(state);

    render(
      <StudioProvider>
        <CastingDrawer character={character!} role="Lead Actor" onClose={() => {}} />
      </StudioProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    fireEvent.click(within(screen.getByText('Fiona Female').closest('.card') as HTMLElement).getByRole('button', { name: 'Pin to Compare' }));
    fireEvent.click(within(screen.getByText('Fran Female').closest('.card') as HTMLElement).getByRole('button', { name: 'Pin to Compare' }));

    expect(screen.getByText('Comparing two candidates')).toBeInTheDocument();
    // The CD-take row is present only because a casting director is on the production.
    expect(screen.getByText('Casting director')).toBeInTheDocument();
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

describe('CastingDrawer - per-candidate offers (Phase 1a)', () => {
  it('gives each candidate its own offer, independent of the others, and relabels the role slider as advertised', () => {
    const state = withRng(7, (rng) => {
      const studio = createInitialStudio(50_000_000);
      const talentPool = generateTalentPool(rng);
      const base = generateTalentCandidates('Actor', rng, 1)[0];
      talentPool.Actor = [femaleActor(base, 'Alpha Actor', 5_000_000), femaleActor(base, 'Beta Actor', 5_000_000)];
      return wrapState(studio, talentPool, draftWithActors(rng, 5_000_000));
    }).result;
    renderDrawer(state);

    // The role slider is now the advertised budget, not "the offer".
    expect(screen.getByLabelText('Advertised Salary for this Role')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));
    const alpha = screen.getByText('Alpha Actor').closest('.card') as HTMLElement;
    const beta = screen.getByText('Beta Actor').closest('.card') as HTMLElement;
    const offerButton = (card: HTMLElement) => within(card).getByRole('button', { name: /Make Offer/ });

    // Both start at the same advertised default.
    expect(offerButton(alpha).textContent).toBe(offerButton(beta).textContent);

    // Raise Alpha's own offer to the top of the range - Beta's is untouched.
    const alphaOffer = within(alpha).getByLabelText('Your offer') as HTMLInputElement;
    fireEvent.change(alphaOffer, { target: { value: alphaOffer.max } });
    expect(offerButton(alpha).textContent).not.toBe(offerButton(beta).textContent);
  });

  it("anchors each candidate's default offer to their own price, not the advertised budget", () => {
    const ADVERTISED = 20_000_000;
    const state = withRng(7, (rng) => {
      const studio = createInitialStudio(200_000_000);
      const talentPool = generateTalentPool(rng);
      const base = generateTalentCandidates('Actor', rng, 1)[0];
      // A cheap actor and a pricey one under the SAME high advertised budget.
      talentPool.Actor = [femaleActor(base, 'Cheap Actor', 500_000), femaleActor(base, 'Pricey Actor', 20_000_000)];
      return wrapState(studio, talentPool, draftWithActors(rng, ADVERTISED));
    }).result;
    renderDrawer(state);
    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));

    const offerAmount = (card: HTMLElement) =>
      Number((within(card).getByRole('button', { name: /Make Offer/ }).textContent ?? '').replace(/[^0-9]/g, ''));
    const cheap = screen.getByText('Cheap Actor').closest('.card') as HTMLElement;
    const pricey = screen.getByText('Pricey Actor').closest('.card') as HTMLElement;

    // The cheap actor's pre-set offer sits near their own low price, nowhere near
    // the £20m advertised budget - so you can't accidentally offer them millions.
    expect(offerAmount(cheap)).toBeLessThan(3_000_000);
    // The default scales with the actor, and neither starts above the budget.
    expect(offerAmount(cheap)).toBeLessThan(offerAmount(pricey));
    expect(offerAmount(pricey)).toBeLessThanOrEqual(ADVERTISED);
  });

  it('never pre-sets an offer above the advertised budget, even for a pricey actor', () => {
    const ADVERTISED = 1_000_000;
    const state = withRng(7, (rng) => {
      const studio = createInitialStudio(200_000_000);
      const talentPool = generateTalentPool(rng);
      const base = generateTalentCandidates('Actor', rng, 1)[0];
      // A £20m actor advertised at only £1m: their fair price is well above the
      // budget, so the default must cap at the budget rather than pre-load £20m.
      talentPool.Actor = [femaleActor(base, 'Pricey Actor', 20_000_000)];
      return wrapState(studio, talentPool, draftWithActors(rng, ADVERTISED));
    }).result;
    renderDrawer(state);
    fireEvent.click(screen.getByRole('button', { name: 'Direct Approach' }));

    const pricey = screen.getByText('Pricey Actor').closest('.card') as HTMLElement;
    const offer = Number((within(pricey).getByRole('button', { name: /Make Offer/ }).textContent ?? '').replace(/[^0-9]/g, ''));
    expect(offer).toBe(ADVERTISED);
  });
});
