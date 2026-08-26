// @vitest-environment jsdom
//
// Delegated Staffing (docs/DESIGN_REVIEW_delegated_staffing.md) - the player's
// side of the loop: the board row's "Hand to ..." verb, the confirm panel, and
// the accept/veto card. Same jsdom + StudioProvider pattern as
// HireTalentCasting.test.tsx.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { HireTalent } from './HireTalent';
import { createInitialStudio, createDraftFromAsset, type GameState } from '../../state/gameState';
import { saveState, loadState } from '../../state/persistence';
import { generateTalentPool } from '../../engine/talentGenerator';
import { withRng } from '../../engine/random';
import { playerDraftToProject, asPlayerDraft } from '../../engine/project';
import { getTypicalSalaryForRole } from '../../engine/person';
import { TEST_SCRIPT_ASSETS } from '../../data/testScripts';
import type { Person, StaffingBrief } from '../../types';

beforeEach(() => {
  localStorage.clear();
});

const asset = TEST_SCRIPT_ASSETS.find((a) => a.script.id === 'test-script-inception')!;
const ROLE = 'Cinematographer' as const;

function lineProducer(id = 'prod-1'): Person {
  return {
    id,
    identity: { name: 'Marcus Reed', appearanceTags: [] },
    personality: { professionalism: 60, ambition: 55, loyalty: 50, ego: 30, temperament: 50, pressureHandling: 55, controversy: 18, adaptability: 55 },
    reputation: { fame: 40, prestige: 40, industryRespect: 60, reliability: 90, currentHeat: 40 },
    primaryRole: 'Producer',
    careers: { producer: { specialty: 'Line', skill: 70, genreAffinity: [], typicalSalary: 300_000 } },
    availability: { commitments: [] },
    traits: [],
  };
}

/** A focused Cast & Crew screen with an attached Line Producer and, optionally, a brief already in flight. */
function stateWith(opts: { attached?: boolean; brief?: (pool: GameState['talentPool']) => StaffingBrief; producerInPool?: boolean } = {}): GameState {
  const producer = lineProducer();
  const draft = createDraftFromAsset(asset, {}, 1);
  const talentPool = withRng(1, (rng) => generateTalentPool(rng)).result;
  draft.talentTargetPriceByRole = { ...draft.talentTargetPriceByRole, [ROLE]: 4_000_000 };
  if (opts.attached !== false) draft.attachedProducerIds = [producer.id];
  if (opts.brief) draft.staffingBriefs = [opts.brief(talentPool)];
  return {
    studio: { ...createInitialStudio(400_000_000), productionOffice: { tier: 3, benchProducerIds: [producer.id] } },
    screen: 'workspace',
    projects: [playerDraftToProject(draft)],
    focusedProjectId: draft.id,
    projectWorkspaceSection: 'cast-and-crew',
    rngSeed: 2,
    totalDays: 10,
    talentPool,
    producerPool: opts.producerInPool === false ? [] : [producer],
    rivalStudios: [],
    opportunities: [],
    nextOpportunityCheckDay: 1,
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
}

function show(state: GameState) {
  saveState(state);
  render(
    <StudioProvider>
      <HireTalent />
    </StudioProvider>,
  );
}

const liveBrief = (): StaffingBrief => ({
  id: 'b1',
  role: ROLE,
  producerId: 'prod-1',
  allocation: 4_000_000,
  issuedOnDay: 5,
  estimatedDays: 12,
  dueOnDay: 17,
  status: 'out',
  briefsUsed: 1,
});

/** A brief that came back with the pool's first cinematographer, signed under their standing quote. */
const returnedBrief = (pool: GameState['talentPool']): StaffingBrief => {
  const person = pool.Cinematographer[0];
  return {
    ...liveBrief(),
    status: 'returned',
    candidate: {
      personId: person.id,
      fee: Math.round(getTypicalSalaryForRole(person, ROLE) * 0.7),
      pitch: ['Under what you gave me.'],
    },
  };
};

describe('the board row offers the slot to an attached Line Producer', () => {
  it('shows the hand-over verb on a delegable crew row', () => {
    show(stateWith());
    expect(screen.getAllByRole('button', { name: /Hand to Marcus/ }).length).toBeGreaterThan(0);
  });

  it('offers nothing when no producer is attached to this film', () => {
    show(stateWith({ attached: false }));
    expect(screen.queryByRole('button', { name: /Hand to/ })).not.toBeInTheDocument();
  });
});

describe('the confirm panel', () => {
  it("shows the producer's read and their day estimate, then sends them out", () => {
    show(stateWith());
    fireEvent.click(screen.getAllByRole('button', { name: /Hand to Marcus/ })[0]);

    // The allocation IS the brief, and they say what it will buy.
    expect(screen.getByLabelText(`Budget handed over for ${ROLE}`)).toHaveValue(4_000_000);
    expect(screen.getByText(/days/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hand it over' }));
    const draft = asPlayerDraft(loadState()!.projects[0])!;
    expect(draft.staffingBriefs).toHaveLength(1);
    expect(draft.staffingBriefs![0]).toMatchObject({ role: ROLE, status: 'out', allocation: 4_000_000 });
  });
});

describe('while a brief is out', () => {
  it('reports the search on the row and offers to pull it', () => {
    show(stateWith({ brief: liveBrief }));
    expect(screen.getByText(/is out looking for a cinematographer/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pull the brief' }));
    expect(asPlayerDraft(loadState()!.projects[0])!.staffingBriefs![0].status).toBe('declined');
  });
});

describe('when they come back with a name', () => {
  it('shows the pick, what it saved, and hires them on accept', () => {
    const state = stateWith({ brief: returnedBrief });
    const candidate = state.talentPool.Cinematographer[0];
    show(state);

    expect(screen.getByText(/has a cinematographer for you/)).toBeInTheDocument();
    expect(screen.getByText(candidate.identity.name)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Take them' }));
    const draft = asPlayerDraft(loadState()!.projects[0])!;
    const hire = draft.talent.find((a) => a.role === ROLE)!;
    expect(hire.person.id).toBe(candidate.id);
    // The negotiated fee, not the standing quote - that is the point of them.
    expect(hire.agreedSalary).toBe(returnedBrief(state.talentPool).candidate!.fee);
    expect(hire.agreedSalary).toBeLessThan(getTypicalSalaryForRole(candidate, ROLE));
  });

  it('leaves the slot empty on a veto', () => {
    show(stateWith({ brief: returnedBrief }));
    fireEvent.click(screen.getByRole('button', { name: /^Pass/ }));
    const draft = asPlayerDraft(loadState()!.projects[0])!;
    expect(draft.talent.some((a) => a.role === ROLE)).toBe(false);
    expect(draft.staffingBriefs![0].status).toBe('declined');
  });

  it('still renders if the producer was fired between coming back and being answered', () => {
    // Their pick stands - it is already made - but everything that reads THEM
    // has to tolerate their absence.
    show(stateWith({ brief: returnedBrief, producerInPool: false }));
    expect(screen.getByText(/has a cinematographer for you/)).toBeInTheDocument();
  });
});
