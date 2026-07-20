// @vitest-environment jsdom
//
// A real render of the Talent Database - list -> search -> open an actor ->
// reveal the Dev hidden-stats section. Same jsdom + StudioProvider pattern as
// PostProduction.test.tsx / CastingDrawer.test.tsx.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioProvider } from '../state/StudioContext';
import { TalentDatabase } from './TalentDatabase';
import { createInitialStudio, type GameState } from '../state/gameState';
import { saveState } from '../state/persistence';
import { generateTalentPool, generateTalentCandidates } from '../engine/talentGenerator';
import { withRng } from '../engine/random';
import type { Person } from '../types';

beforeEach(() => {
  localStorage.clear();
});

function named(base: Person, name: string, gender: 'Male' | 'Female'): Person {
  return { ...base, id: `actor-${name}`, identity: { ...base.identity, name, gender } };
}

function stateWithActors(): GameState {
  return withRng(1, (rng) => {
    const talentPool = generateTalentPool(rng);
    const [a, b, c] = generateTalentCandidates('Actor', rng, 3);
    talentPool.Actor = [named(a, 'Zara Quinn', 'Female'), named(b, 'Marcus Vale', 'Male'), named(c, 'Nadia Okafor', 'Female')];
    return {
      studio: createInitialStudio(50_000_000),
      screen: 'talent-database' as const,
      projects: [],
      focusedProjectId: null,
      projectWorkspaceSection: 'overview' as const,
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

function renderPage() {
  saveState(stateWithActors());
  render(
    <StudioProvider>
      <TalentDatabase />
    </StudioProvider>,
  );
}

describe('TalentDatabase', () => {
  it('lists all actors and filters by name search', () => {
    renderPage();
    expect(screen.getByText('Zara Quinn')).toBeInTheDocument();
    expect(screen.getByText('Marcus Vale')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search by name…'), { target: { value: 'zara' } });
    expect(screen.getByText('Zara Quinn')).toBeInTheDocument();
    expect(screen.queryByText('Marcus Vale')).not.toBeInTheDocument();
  });

  it('opens an actor to a detail page with public stats and filmography', () => {
    renderPage();
    fireEvent.click(screen.getByText('Nadia Okafor'));
    expect(screen.getByRole('heading', { name: 'Nadia Okafor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Standing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Acting Range' })).toBeInTheDocument();
    expect(screen.getByText(/Filmography/)).toBeInTheDocument();
    // Public stats include Fame and the acting axes.
    expect(screen.getByText('Fame')).toBeInTheDocument();
    expect(screen.getByText('Charisma')).toBeInTheDocument();
  });

  it('reveals hidden dev stats (with an explanatory info sign) only after expanding the Dev section', () => {
    renderPage();
    fireEvent.click(screen.getByText('Marcus Vale'));

    // A personality stat only lives in the Dev section - hidden until expanded.
    expect(screen.queryByText('Professionalism')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Dev — hidden stats/));
    expect(screen.getByText('Professionalism')).toBeInTheDocument();
    expect(screen.getByText('Ego')).toBeInTheDocument();

    // The Ego info sign carries an explanation of what it affects in-game.
    const egoRow = screen.getByText('Ego').closest('.td-stat-row');
    expect(egoRow?.querySelector('.info-tip')?.getAttribute('aria-label')).toMatch(/appeal bar|morale/i);
  });
});
