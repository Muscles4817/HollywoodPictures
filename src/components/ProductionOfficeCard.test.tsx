// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { GameState } from '../state/gameState';
import type { Person, ProducerSpecialty, Studio } from '../types';

const dispatch = vi.fn();
let mockState: GameState;

vi.mock('../state/StudioContext', () => ({
  useStudio: () => ({ state: mockState, dispatch }),
}));

// Imported after the mock is declared.
import { ProductionOfficeCard } from './ProductionOfficeCard';

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

function makeState(opts: { studio?: Partial<Studio>; pool?: Person[] } = {}): GameState {
  return {
    studio: { name: 'S', cash: 50_000_000, brand: 20, prestige: 20, assets: [], productionOffice: null, ...opts.studio },
    projects: [],
    producerPool: opts.pool ?? [],
  } as unknown as GameState;
}

describe('ProductionOfficeCard - locked', () => {
  beforeEach(() => dispatch.mockClear());

  it('shows the milestone and disables unlock until it is met', () => {
    mockState = makeState({ studio: { brand: 20 } }); // 0 films, low brand
    render(<ProductionOfficeCard />);
    expect(screen.getByText('Production Office')).toBeInTheDocument();
    const unlock = screen.getByRole('button', { name: 'Milestone not met' });
    expect(unlock).toBeDisabled();
  });

  it('enables unlock once Brand clears the threshold and dispatches on click', () => {
    mockState = makeState({ studio: { brand: 40 } });
    render(<ProductionOfficeCard />);
    const unlock = screen.getByRole('button', { name: 'Open the Production Office' });
    expect(unlock).toBeEnabled();
    fireEvent.click(unlock);
    expect(dispatch).toHaveBeenCalledWith({ type: 'UNLOCK_PRODUCTION_OFFICE' });
  });
});

describe('ProductionOfficeCard - unlocked', () => {
  beforeEach(() => dispatch.mockClear());

  it('offers an affordable upgrade and dispatches on click', () => {
    mockState = makeState({ studio: { cash: 50_000_000, productionOffice: { tier: 1, benchProducerIds: [] } } });
    render(<ProductionOfficeCard />);
    const upgrade = screen.getByRole('button', { name: /Upgrade to Tier 2/ });
    expect(upgrade).toBeEnabled();
    fireEvent.click(upgrade);
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPGRADE_PRODUCTION_OFFICE' });
  });

  it('hires an available producer from the manage modal', () => {
    const p = makeProducer('Line');
    mockState = makeState({ studio: { cash: 50_000_000, productionOffice: { tier: 1, benchProducerIds: [] } }, pool: [p] });
    render(<ProductionOfficeCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage producers' }));

    const dialog = screen.getByText('Available to hire').closest('.modal-content') as HTMLElement;
    const hire = within(dialog).getByRole('button', { name: /Hire/ });
    fireEvent.click(hire);
    expect(dispatch).toHaveBeenCalledWith({ type: 'HIRE_PRODUCER', producerId: p.id });
  });

  it('fires a benched producer from the manage modal', () => {
    const p = makeProducer('Creative');
    mockState = makeState({ studio: { cash: 50_000_000, productionOffice: { tier: 2, benchProducerIds: [p.id] } }, pool: [p] });
    render(<ProductionOfficeCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage producers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fire' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'FIRE_PRODUCER', producerId: p.id });
  });

  it('offers to buy the first Market Research level and dispatches on click', () => {
    mockState = makeState({ studio: { cash: 50_000_000, productionOffice: { tier: 1, benchProducerIds: [] } } });
    render(<ProductionOfficeCard />);
    const buy = screen.getByRole('button', { name: /Buy Basic tracking/ });
    expect(buy).toBeEnabled();
    fireEvent.click(buy);
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPGRADE_MARKET_RESEARCH' });
  });

  it('shows the fully-upgraded note at the top research level instead of a button', () => {
    mockState = makeState({ studio: { cash: 50_000_000, productionOffice: { tier: 1, benchProducerIds: [], marketResearchTier: 3 } } });
    render(<ProductionOfficeCard />);
    expect(screen.getByText(/Fully upgraded/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tracking/ })).not.toBeInTheDocument();
  });
});
