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
import { AWARD_CATEGORIES } from '../data/awards';
import type { AwardCategory, AwardNomination, AwardShowId, AwardsCeremony, Person } from '../types';
import { formatWinnerMarquee, type AwardTally, type PersonAwardSummary } from '../state/selectors';

beforeEach(() => {
  localStorage.clear();
});

function named(base: Person, name: string, gender: 'Male' | 'Female'): Person {
  return { ...base, id: `actor-${name}`, identity: { ...base.identity, name, gender } };
}

function ceremonyWith(show: AwardShowId, noms: Partial<Record<AwardCategory, AwardNomination[]>>): AwardsCeremony {
  const categories = Object.fromEntries(AWARD_CATEGORIES.map((c) => [c, [] as AwardNomination[]])) as Record<AwardCategory, AwardNomination[]>;
  return { show, year: 1, ceremonyDay: 365, categories: { ...categories, ...noms } };
}

function stateWithActors(awardsHistory: AwardsCeremony[] = []): GameState {
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
      awards: { season: null, history: awardsHistory, nextSeasonDay: 99_999 },
    };
  }).result;
}

function renderPage(awardsHistory: AwardsCeremony[] = []) {
  saveState(stateWithActors(awardsHistory));
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
    // Person-level Standing, and the career-level "As an Actor" panel (headings
    // now carry a short descriptive note, so match on the leading label).
    expect(screen.getByRole('heading', { name: /Standing/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /As an Actor/ })).toBeInTheDocument();
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

  it('shows a winner marquee (Academy wins) and a per-show Awards panel for a winner', () => {
    renderPage([
      ceremonyWith('academy', {
        'best-actor': [
          { filmId: 'f1', personId: 'actor-Zara Quinn', awardScore: 92, won: true },
          { filmId: 'f2', personId: 'actor-Zara Quinn', awardScore: 88, won: true },
        ],
        'best-supporting-actress': [
          { filmId: 'f3', personId: 'actor-Zara Quinn', awardScore: 70, won: false },
        ],
      }),
      ceremonyWith('bafta', {
        'best-actor': [{ filmId: 'f1', personId: 'actor-Zara Quinn', awardScore: 90, won: true }],
      }),
    ]);
    fireEvent.click(screen.getByText('Zara Quinn'));

    // Header marquee announces the two Academy wins - the BAFTA win doesn't inflate it.
    expect(screen.getByText(/Two-time Best Actor winner/)).toBeInTheDocument();
    // Awards panel with the per-show breakdown (3 Academy + 1 BAFTA = 3 wins, 4 nominations).
    expect(screen.getByRole('heading', { name: 'Awards' })).toBeInTheDocument();
    expect(screen.getByText(/3 wins · 4 nominations/)).toBeInTheDocument();
    expect(screen.getByText('The Academy Awards')).toBeInTheDocument();
    expect(screen.getByText('BAFTA Film Awards')).toBeInTheDocument();
  });

  it('shows no marquee or Awards panel for an actor with no nominations', () => {
    renderPage();
    fireEvent.click(screen.getByText('Marcus Vale'));
    expect(screen.queryByText(/winner/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Awards' })).not.toBeInTheDocument();
  });
});

describe('TalentDatabase - all professions', () => {
  it('lists non-actor talent and opens a director to a director-specific profile', () => {
    const state = withRng(1, (rng) => {
      const talentPool = generateTalentPool(rng);
      const [director] = generateTalentCandidates('Director', rng, 1);
      talentPool.Director = [{ ...director, id: 'dir-1', identity: { ...director.identity, name: 'Rhea Kapoor' } }];
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
        awards: { season: null, history: [], nextSeasonDay: 99_999 },
      };
    }).result;
    saveState(state);
    render(
      <StudioProvider>
        <TalentDatabase />
      </StudioProvider>,
    );

    // A director now appears in the (all-professions) list...
    fireEvent.click(screen.getByText('Rhea Kapoor'));
    // ...and opens to a profession-specific career panel, not the actor one.
    expect(screen.getByRole('heading', { name: /As a Director/ })).toBeInTheDocument();
    expect(screen.getByText('Directing skill')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /As an Actor/ })).not.toBeInTheDocument();
  });
});

describe('formatWinnerMarquee', () => {
  // The marquee reads off Academy wins only (academyByCategory) - byShow is
  // irrelevant to it, so a minimal fixture just fills the category breakdown.
  const summary = (academyByCategory: PersonAwardSummary['academyByCategory']): PersonAwardSummary => {
    const cells = Object.values(academyByCategory) as AwardTally[];
    return {
      wins: cells.reduce((n, c) => n + c.wins, 0),
      nominations: cells.reduce((n, c) => n + c.nominations, 0),
      byShow: {},
      academyByCategory,
    };
  };

  it('returns null for an actor with Academy nominations but no wins', () => {
    expect(formatWinnerMarquee(summary({ 'best-actor': { wins: 0, nominations: 3 } }))).toBeNull();
  });

  it('drops the count prefix for a single win', () => {
    expect(formatWinnerMarquee(summary({ 'best-actor': { wins: 1, nominations: 2 } }))).toBe('Best Actor winner');
  });

  it('spells out repeat wins in one category', () => {
    expect(formatWinnerMarquee(summary({ 'best-actress': { wins: 3, nominations: 4 } }))).toBe('Three-time Best Actress winner');
  });

  it('joins multiple winning categories, most wins first', () => {
    expect(
      formatWinnerMarquee(
        summary({
          'best-supporting-actor': { wins: 1, nominations: 1 },
          'best-actor': { wins: 2, nominations: 3 },
        }),
      ),
    ).toBe('Two-time Best Actor winner · Best Supporting Actor winner');
  });
});
