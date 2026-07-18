// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildStateWithReadyDraft } from '../../state/testFixtures';
import { asPlayerDraft, playerDraftToProject } from '../../engine/project';
import { computeCommittedSpend } from '../../state/selectors';
import type { GameState } from '../../state/gameState';
import type { Person, ProducerSpecialty } from '../../types';

const dispatch = vi.fn();
let mockState: GameState;

vi.mock('../../state/StudioContext', () => ({
  useStudio: () => ({ state: mockState, dispatch }),
}));

import { ProjectProducers } from './ProjectProducers';

let idCounter = 0;
function makeProducer(specialty: ProducerSpecialty, typicalSalary = 300_000): Person {
  return {
    id: `pool-${idCounter++}`,
    identity: { name: `${specialty} Person`, appearanceTags: [] },
    personality: { professionalism: 60, ambition: 55, loyalty: 50, ego: 30, temperament: 50, pressureHandling: 55, controversy: 18, adaptability: 55 },
    reputation: { fame: 40, prestige: 40, industryRespect: 60, reliability: 70, currentHeat: 40 },
    primaryRole: 'Producer',
    careers: { producer: { specialty, skill: 60, genreAffinity: ['Action'], typicalSalary } },
    availability: { commitments: [] },
    traits: [],
  };
}

function baseState(opts: { pool?: Person[]; tier?: number; bench?: string[] } = {}): GameState {
  const s = buildStateWithReadyDraft(1);
  return {
    ...s,
    producerPool: opts.pool ?? [],
    studio: {
      ...s.studio,
      productionOffice: opts.tier ? { tier: opts.tier, benchProducerIds: opts.bench ?? [] } : null,
    },
  };
}

function setFocusedAttached(s: GameState, ids: string[]): GameState {
  return {
    ...s,
    projects: s.projects.map((proj) => {
      const draft = asPlayerDraft(proj);
      return draft ? playerDraftToProject({ ...draft, attachedProducerIds: ids }) : proj;
    }),
  };
}

describe('ProjectProducers', () => {
  beforeEach(() => dispatch.mockClear());

  it('prompts to open a Production Office when locked', () => {
    mockState = baseState();
    render(<ProjectProducers />);
    expect(screen.getByText(/Open a Production Office/)).toBeInTheDocument();
  });

  it('prompts to hire when the office is open but the bench is empty', () => {
    mockState = baseState({ tier: 1, bench: [] });
    render(<ProjectProducers />);
    expect(screen.getByText(/bench is empty/)).toBeInTheDocument();
  });

  it('attaches a bench producer to the focused film', () => {
    const p = makeProducer('Line');
    mockState = baseState({ pool: [p], tier: 1, bench: [p.id] });
    render(<ProjectProducers />);
    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'ATTACH_PRODUCER', producerId: p.id });
  });

  it('detaches an already-attached producer', () => {
    const p = makeProducer('Creative');
    mockState = setFocusedAttached(baseState({ pool: [p], tier: 1, bench: [p.id] }), [p.id]);
    render(<ProjectProducers />);
    fireEvent.click(screen.getByRole('button', { name: 'Detach' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'DETACH_PRODUCER', producerId: p.id });
  });
});

describe('computeCommittedSpend includes attached producer fees', () => {
  it('adds each attached producer per-film fee to the projected spend', () => {
    const p = makeProducer('Executive', 400_000);
    const s = setFocusedAttached(baseState({ pool: [p], tier: 1, bench: [p.id] }), [p.id]);
    const draft = asPlayerDraft(s.projects[0])!;
    const withoutPool = computeCommittedSpend(draft, []);
    const withPool = computeCommittedSpend(draft, [p]);
    expect(withPool - withoutPool).toBe(400_000);
  });
});
