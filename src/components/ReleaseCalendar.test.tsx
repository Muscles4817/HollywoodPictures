// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { buildReadyDraft } from '../state/testFixtures';
import { createInitialStudio, type GameState } from '../state/gameState';
import { withRng } from '../engine/random';
import type { Project, RivalProductionInProgress, RivalStudio } from '../types';

const dispatch = vi.fn();
let mockState: GameState;
vi.mock('../state/StudioContext', () => ({ useStudio: () => ({ state: mockState, dispatch }) }));

// Imported after the mock is declared.
import { ReleaseCalendar } from './ReleaseCalendar';

const rivalStudio: RivalStudio = {
  id: 'rival-studio-0',
  name: 'Test Rival Pictures',
  tier: 'Indie',
  cash: 1_000_000,
  brand: 30,
  prestige: 30,
  lifetimeRevenue: 0,
  lifetimeExpenditure: 0,
  nextSpawnCheckDay: 1,
};

function rivalProduction(releaseDay: number): RivalProductionInProgress {
  const { result: draft } = withRng(200, (rng) => buildReadyDraft(rng));
  return {
    id: 'rival-prod',
    rivalStudioId: 'rival-studio-0',
    scale: 'Medium',
    genre: draft.genre!,
    script: draft.script!,
    talent: draft.talent,
    productionChoices: draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!,
    marketingChoices: draft.marketingChoices!,
    targetAudience: draft.targetAudience!,
    releaseDay,
  };
}

/** A player scheduled film with a known title and an Epic script (→ 'Large'). */
function playerScheduled(releaseDay: number): Project {
  const { result: draft } = withRng(201, (rng) => buildReadyDraft(rng));
  const withKnownScript = {
    ...draft,
    title: 'My Big Movie',
    script: { ...draft.script!, scale: 'Epic' as const },
  };
  return { kind: 'scheduled', draft: withKnownScript, releaseDay };
}

/**
 * Player film and rival film sharing the same release month (day 40). `today`
 * defaults to day 5 - before the rival's marketing rollout begins (release day
 * 40 minus the ~30-day lead ≈ day 10), so the rival is still under wraps and
 * its title/cast are masked. Pass a later `today` to see it announced.
 */
function stateSameMonth(today = 5): GameState {
  return {
    studio: { ...createInitialStudio(10_000_000), name: 'My Studio' },
    projects: [playerScheduled(40), { kind: 'rival-in-progress', production: rivalProduction(40) }],
    rivalStudios: [rivalStudio],
    totalDays: today,
  } as unknown as GameState;
}

describe('ReleaseCalendar - player vs rival differentiation', () => {
  it('flags the player film with a "Your Film" badge and shows its normalized scale', () => {
    mockState = stateSameMonth();
    render(<ReleaseCalendar />);
    // The title shows on the card (and again in the sidebar "next release").
    expect(screen.getAllByText('My Big Movie').length).toBeGreaterThan(0);
    expect(screen.getByText('Your Film')).toBeInTheDocument();
    // Epic script normalizes to the shared 'Large' tier chip.
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('shows the rival studio name and does not badge the rival as the player', () => {
    mockState = stateSameMonth();
    render(<ReleaseCalendar />);
    // Before its campaign begins, the rival title is masked as "<scale> <genre> film".
    expect(screen.getByText(/Medium .* film/)).toBeInTheDocument();
    expect(screen.getAllByText(/Test Rival Pictures/).length).toBeGreaterThan(0);
    // Only one "Your Film" badge (the player's), not one per card.
    expect(screen.getAllByText('Your Film')).toHaveLength(1);
  });

  it('keeps a rival under wraps before its campaign, then reveals its real title and cast once it begins', () => {
    // The rival's real title/cast, reproduced from the same deterministic draft.
    const { result: rivalDraft } = withRng(200, (rng) => buildReadyDraft(rng));
    const rivalTitle = rivalDraft.script!.title;
    const rivalLead = rivalDraft.talent.find((a) => a.role === 'Lead Actor')!.person.identity.name;

    // Day 5: still shooting - masked, no real title, an "under wraps" note.
    mockState = stateSameMonth(5);
    const { unmount } = render(<ReleaseCalendar />);
    expect(screen.getByText(/Medium .* film/)).toBeInTheDocument();
    expect(screen.queryByText(rivalTitle)).not.toBeInTheDocument();
    expect(screen.getAllByText(/under wraps/).length).toBeGreaterThan(0);
    unmount();

    // Day 15: the marketing rollout has begun (campaign starts ~day 10) - the
    // real title and cast are now public, and the mask is gone.
    mockState = stateSameMonth(15);
    render(<ReleaseCalendar />);
    expect(screen.queryByText(/Medium .* film/)).not.toBeInTheDocument();
    expect(screen.getAllByText(rivalTitle).length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(rivalLead))).toBeInTheDocument();
  });
});

describe('ReleaseCalendar - month sections and competition', () => {
  it('renders one month section for releases sharing a month, with a release count and competition read', () => {
    mockState = stateSameMonth();
    const { container } = render(<ReleaseCalendar />);
    // Exactly one month section - empty months are never rendered.
    const monthTitles = container.querySelectorAll('.release-month__title');
    expect(monthTitles).toHaveLength(1);
    expect(monthTitles[0].textContent).toMatch(/·\s*Year/);
    const meta = container.querySelector('.release-month__meta')!;
    expect(meta).toHaveTextContent('2 releases');
    // Two releases in a month reads as "Some competition".
    expect(meta).toHaveTextContent('Some competition');
  });
});

describe('ReleaseCalendar - clickable release cards', () => {
  it('expands an inline detail panel when a card is clicked', () => {
    mockState = stateSameMonth();
    render(<ReleaseCalendar />);
    const card = screen.getByRole('button', { name: /My Big Movie/ });
    expect(screen.queryByText('Expected')).not.toBeInTheDocument();
    fireEvent.click(card);
    // The detail panel (scoped to the card) exposes the fields structured for
    // future navigation. 'Audience' also labels a toolbar filter, so scope it.
    expect(within(card).getByText('Expected')).toBeInTheDocument();
    expect(within(card).getByText('Audience')).toBeInTheDocument();
  });
});

describe('ReleaseCalendar - industry sidebar', () => {
  it('summarizes the slate: next release, statistics, and upcoming events', () => {
    mockState = stateSameMonth();
    render(<ReleaseCalendar />);
    expect(screen.getByText('Next Release')).toBeInTheDocument();
    expect(screen.getByText(/until/)).toHaveTextContent('My Big Movie');

    const stats = screen.getByText('Industry Statistics').closest('.sidebar-card')! as HTMLElement;
    // Scope to the specific row - both "Your releases" and "Rival releases" are 1.
    const yourRow = within(stats).getByText('Your releases').closest('.stat-row')! as HTMLElement;
    expect(within(yourRow).getByText('1')).toBeInTheDocument();

    expect(screen.getByText('Upcoming Industry Events')).toBeInTheDocument();
  });
});

describe('ReleaseCalendar - filter toolbar', () => {
  it('offers a Reset Filters control that is disabled until a filter is narrowed', () => {
    mockState = stateSameMonth();
    render(<ReleaseCalendar />);
    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeDisabled();
  });

  it('shows an empty-state message when nothing is scheduled anywhere', () => {
    mockState = {
      studio: { ...createInitialStudio(10_000_000), name: 'My Studio' },
      projects: [],
      rivalStudios: [],
      totalDays: 10,
    } as unknown as GameState;
    render(<ReleaseCalendar />);
    expect(screen.getByText(/Nothing scheduled or in production/)).toBeInTheDocument();
  });
});
