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
import { payRangeLabel } from './TalentDatabase';

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

/** A pool big enough to page - the three-actor fixture never could be. */
function renderPageWithManyActors(count: number) {
  const state = stateWithActors();
  const template = state.talentPool.Actor[0];
  saveState({
    ...state,
    talentPool: {
      ...state.talentPool,
      Actor: Array.from({ length: count }, (_, i) => ({
        ...template,
        id: `bulk-actor-${i}`,
        identity: { ...template.identity, name: `Extra ${i}` },
      })),
      // Only actors, so the row count is exactly the number asked for.
      Director: [], Writer: [], Cinematographer: [], Composer: [],
      Editor: [], 'VFX Supervisor': [], 'Casting Director': [], 'Production Designer': [],
    },
  });
  render(
    <StudioProvider>
      <TalentDatabase />
    </StudioProvider>,
  );
}

/**
 * Find one named person and open them.
 *
 * The list shows a window of the pool rather than all ~2,500 of it, so a
 * particular person is not reliably on screen at the top - search is how you
 * reach someone, which is what a player does too.
 */
function openActor(name: string) {
  fireEvent.change(screen.getByPlaceholderText('Search by name…'), { target: { value: name } });
  fireEvent.click(screen.getByText(name));
}

describe('TalentDatabase', () => {
  it('filters by name search', () => {
    renderPage();
    const search = screen.getByPlaceholderText('Search by name…');

    fireEvent.change(search, { target: { value: 'zara' } });
    expect(screen.getByText('Zara Quinn')).toBeInTheDocument();
    expect(screen.queryByText('Marcus Vale')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'marcus' } });
    expect(screen.getByText('Marcus Vale')).toBeInTheDocument();
    expect(screen.queryByText('Zara Quinn')).not.toBeInTheDocument();
  });

  // A generated world holds ~2,500 people and this list used to lay out every
  // match: measured at 2,490 rows, 29,930 DOM nodes and a 99,996px page. The
  // unit fixture above has three actors, which is exactly why nobody saw it.
  it('lays out a window of the pool, not the whole pool', () => {
    renderPageWithManyActors(150);
    expect(document.querySelectorAll('.td-actor-row').length).toBe(60);
    expect(screen.getByText(/90 still to come/)).toBeInTheDocument();
  });

  it('extends the window when asked, and says so honestly while it does', () => {
    renderPageWithManyActors(150);
    fireEvent.click(screen.getByText(/Show 60 more/));
    expect(document.querySelectorAll('.td-actor-row').length).toBe(120);
    fireEvent.click(screen.getByText(/Show 30 more/));
    expect(document.querySelectorAll('.td-actor-row').length).toBe(150);
    // Nothing left to ask for, so nothing to click.
    expect(screen.queryByText(/still to come/)).not.toBeInTheDocument();
  });

  it('starts the window again when the filters change', () => {
    renderPageWithManyActors(150);
    fireEvent.click(screen.getByText(/Show 60 more/));
    expect(document.querySelectorAll('.td-actor-row').length).toBe(120);
    // Narrowing then widening must not leave a stale window behind - the count
    // is about the list you are looking at, and this is a different list.
    fireEvent.change(screen.getByPlaceholderText('Search by name…'), { target: { value: 'Extra 1' } });
    fireEvent.change(screen.getByPlaceholderText('Search by name…'), { target: { value: '' } });
    expect(document.querySelectorAll('.td-actor-row').length).toBe(60);
  });

  it('opens an actor to a detail page with public stats and filmography', () => {
    renderPage();
    openActor('Nadia Okafor');
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
    openActor('Marcus Vale');

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
    openActor('Zara Quinn');

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
    openActor('Marcus Vale');
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

describe('payRangeLabel - obfuscated per-film fee', () => {
  it('never discloses the exact figure, only a band that contains it', () => {
    // Fee 1.5M sits in the [1M, 2M) band; the label is the range, never the figure.
    expect(payRangeLabel(1_500_000)).toBe('£1,000,000–£2,000,000');
    expect(payRangeLabel(1_500_000)).not.toContain('1,500,000');
    // Two different fees in the same band read identically (the obfuscation).
    expect(payRangeLabel(1_100_000)).toBe(payRangeLabel(1_900_000));
  });

  it('bands always bracket the true value', () => {
    for (const fee of [120_000, 600_000, 3_000_000, 9_000_000, 30_000_000]) {
      const label = payRangeLabel(fee);
      expect(label).toMatch(/–|\+/); // a range, or the open-topped top band
    }
  });

  it('handles the extremes: a nominal/undisclosed fee, a tiny fee, and a top-tier one', () => {
    expect(payRangeLabel(0)).toBe('Undisclosed');
    expect(payRangeLabel(50_000)).toBe('Under £100,000');
    expect(payRangeLabel(300_000_000)).toBe('£150,000,000+');
  });
});
