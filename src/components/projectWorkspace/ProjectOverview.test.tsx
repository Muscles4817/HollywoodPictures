// @vitest-environment jsdom
//
// Screenplay redesign (docs/DESIGN.md) - a real render of the redesigned
// screenplay card, standing in for a manual browser check (no Playwright/
// browser-automation dependency is set up in this project - see
// OutcomeInspector.test.tsx for the same jsdom+StudioProvider pattern this
// borrows). Catches exactly the class of bug tsc can't: a null-reference or
// missing-import inside ScriptDetails that only surfaces at render time.
// Retargeted from the retired DevelopFilm.tsx onto ProjectOverview.tsx - the
// Producer Workspace's landing page absorbed DevelopFilm's title/script/
// target-audience content wholesale (PRODUCER_WORKSPACE_DESIGN.md), so this
// is the same regression coverage, just against its new home. Development-
// pipeline doc: a Project's script is inherited wholesale from the Asset it
// was created from (state/gameState.ts:createDraftFromAsset), so this file
// builds that Asset/Project directly via CREATE_PROJECT_FROM_ASSET rather
// than the old START_NEW_FILM/SET_GENRE/SELECT_SCRIPT sequence.
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { ProjectOverview } from './ProjectOverview';
import { studioReducer } from '../../state/studioReducer';
import { createInitialStudio, type GameState } from '../../state/gameState';
import { generateTalentPool } from '../../engine/talentGenerator';
import { generateScriptOptions } from '../../engine/scriptGenerator';
import { saveState } from '../../state/persistence';
import { withRng } from '../../engine/random';
import { ARCHETYPE_LABELS, STORY_TYPE_LABELS, SETTING_LABELS } from '../../data/scriptTagLabels';
import type { Asset, Genre } from '../../types';

beforeEach(() => {
  localStorage.clear();
});

function stateWithFocusedAssetDraft(seed: number, genre: Genre): GameState {
  const { result, nextSeed } = withRng(seed, (rng) => ({
    talentPool: generateTalentPool(rng),
    script: generateScriptOptions(genre, rng, 1)[0],
  }));
  const asset: Asset = { id: `asset-${result.script.id}`, script: result.script, provenance: 'Founding', acquisitionCost: result.script.cost, acquiredOnDay: 1 };
  const state: GameState = {
    studio: { ...createInitialStudio(10_000_000), assets: [asset] },
    screen: 'dashboard',
    projects: [],
    focusedProjectId: null,
    projectWorkspaceSection: 'overview',
    rngSeed: nextSeed,
    totalDays: 1,
    talentPool: result.talentPool,
    rivalStudios: [],
    opportunities: [],
    nextOpportunityCheckDay: 1,
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
  return studioReducer(state, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: asset.id });
}

describe('ProjectOverview - the redesigned screenplay card renders without crashing', () => {
  it('renders the concept/production/commercial descriptors, for every genre', () => {
    for (const genre of ['Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Thriller'] as const) {
      const state = stateWithFocusedAssetDraft(1, genre);
      saveState(state);
      const { unmount } = render(
        <StudioProvider>
          <ProjectOverview />
        </StudioProvider>,
      );
      expect(screen.getAllByText(/commercial potential|commercial ceiling keeps the price down/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Commercially:|Middling, unremarkable commercial potential\./).length).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });

  it('shows the Target Audience pre-fill hint for the inherited script', () => {
    const state = stateWithFocusedAssetDraft(2, 'Action');
    saveState(state);
    render(
      <StudioProvider>
        <ProjectOverview />
      </StudioProvider>,
    );
    expect(screen.getByText((text) => text.startsWith('Pre-filled from'))).toBeInTheDocument();
  });
});

describe('ProjectOverview - presentation polish pass (docs/DESIGN.md)', () => {
  it('groups the quality stats under "Writing"/"Concept" headings, and shows "Intended Audience"/"Screenplay Cost" instead of the old "Written For"/"Cost" wording', () => {
    const state = stateWithFocusedAssetDraft(3, 'Action');
    saveState(state);
    render(
      <StudioProvider>
        <ProjectOverview />
      </StudioProvider>,
    );
    expect(screen.getAllByText('Writing').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Concept').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Intended Audience:', { exact: false }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Written For:', { exact: false })).not.toBeInTheDocument();
    expect(screen.getAllByText('Screenplay Cost:', { exact: false }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/^Cost:/)).not.toBeInTheDocument();
  });

  it('no longer shows the old "Production Style: Leans..." line', () => {
    const state = stateWithFocusedAssetDraft(4, 'Action');
    saveState(state);
    render(
      <StudioProvider>
        <ProjectOverview />
      </StudioProvider>,
    );
    expect(screen.queryByText(/Production Style:/)).not.toBeInTheDocument();
  });

  it('shows every quality stat as a star rating, not a bare number, within the Writing/Concept groups', () => {
    const state = stateWithFocusedAssetDraft(5, 'Action');
    saveState(state);
    render(
      <StudioProvider>
        <ProjectOverview />
      </StudioProvider>,
    );
    // One script x 5 stats = 5 star-rating widgets.
    expect(document.querySelectorAll('.star-rating').length).toBeGreaterThanOrEqual(5);
  });

  it('renders production-requirement tags drawn from the concept - never the raw camelCase enum values', () => {
    const state = stateWithFocusedAssetDraft(6, 'Action');
    saveState(state);
    render(
      <StudioProvider>
        <ProjectOverview />
      </StudioProvider>,
    );
    expect(screen.queryByText('ComingOfAge')).not.toBeInTheDocument();
    expect(screen.queryByText('CrowdPleaser')).not.toBeInTheDocument();
    expect(screen.queryByText('SciFi')).not.toBeInTheDocument();
    expect(screen.queryByText('OriginalVision')).not.toBeInTheDocument();
    expect(screen.queryByText('GenreFormula')).not.toBeInTheDocument();
  });

  it('formats camelCase/PascalCase tag values into readable prose', () => {
    expect(STORY_TYPE_LABELS.ComingOfAge).toBe('Coming of Age');
    expect(SETTING_LABELS.PostApocalypticWasteland).toBe('Post-Apocalyptic Wasteland');
    expect(ARCHETYPE_LABELS.CrowdPleaser).toBe('Crowd-Pleaser');
    expect(ARCHETYPE_LABELS.OriginalVision).toBe('Original Vision');
    expect(ARCHETYPE_LABELS.GenreFormula).toBe('Genre Formula');
  });
});

describe('ProjectOverview - the release-date card surfaces what should decide the date', () => {
  // The card used to offer eighteen months and say one thing about them (how
  // crowded they were), so a studio could claim a date two months out for a
  // film that had not begun pre-production with nothing on screen saying a
  // word about it. Every axis that actually decides the choice is now named:
  // whether the film can be finished, whether the campaign gets runway, what
  // the season is worth to this genre, and who else is opening.
  function renderCard(seed: number, genre: Genre = 'Action') {
    const state = stateWithFocusedAssetDraft(seed, genre);
    saveState(state);
    return render(
      <StudioProvider>
        <ProjectOverview />
      </StudioProvider>,
    );
  }

  it('states when the film is projected finished, and the first date with a full campaign', () => {
    renderCard(30);
    expect(screen.getByText('Projected finished')).toBeInTheDocument();
    expect(screen.getByText('Earliest date with a full campaign')).toBeInTheDocument();
    // And what is still ahead of it, so the projection is explained rather than asserted.
    expect(screen.getByText(/Still ahead:/)).toBeInTheDocument();
  });

  it('marks the months the film cannot possibly be finished by', () => {
    const { container } = renderCard(31);
    const unreachable = container.querySelectorAll('.release-month-cell--unreachable');
    // A project that has not begun pre-production cannot make a date a couple
    // of months out - so the near months must be marked, and the far ones not.
    expect(unreachable.length).toBeGreaterThan(0);
    expect(unreachable.length).toBeLessThan(container.querySelectorAll('.release-month-cell').length);
    for (const cell of unreachable) expect(cell).toHaveTextContent('Not finished');
  });

  it('does not forbid an unreachable date - studios announce dates they miss', () => {
    // Announcing a date the film will not make is the whole premise of the
    // feature (design review section 9.1). It is marked, never disabled.
    const { container } = renderCard(32);
    for (const cell of container.querySelectorAll('.release-month-cell--unreachable')) {
      expect(cell).not.toBeDisabled();
    }
  });

  it('always offers months the film can actually make', () => {
    // A grid whose every cell was struck through as unreachable would offer no
    // real choice at all - and an effects-led epic can need the better part of
    // two years between here and a finished print.
    const { container } = renderCard(35, 'Sci-Fi');
    const cells = container.querySelectorAll('.release-month-cell');
    const unreachable = container.querySelectorAll('.release-month-cell--unreachable');
    expect(cells.length - unreachable.length).toBeGreaterThanOrEqual(6);
  });

  it('reads the season for this genre on every month, not just a bonus star', () => {
    const { container } = renderCard(33, 'Horror');
    const seasons = container.querySelectorAll('.release-month-cell__season');
    expect(seasons.length).toBe(container.querySelectorAll('.release-month-cell').length);
    // Eighteen months must contain at least one Halloween, the prime frame for Horror.
    expect(container.querySelectorAll('.release-month-cell__season--prime').length).toBeGreaterThan(0);
  });

  it('does not let an unreachable month advertise a prime season', () => {
    // A struck-through cell was still shouting "Prime season" in bold green,
    // pulling the eye toward a date the film cannot make. Below the verdict,
    // every reading on such a cell is moot and goes quiet.
    const { container } = renderCard(36, 'Action');
    for (const cell of container.querySelectorAll('.release-month-cell--unreachable')) {
      expect(cell.querySelector('.release-month-cell__season--prime')).toBeNull();
    }
    // ...while a month the film CAN make still reads its season normally.
    const reachable = [...container.querySelectorAll('.release-month-cell')]
      .filter((c) => !c.classList.contains('release-month-cell--unreachable'));
    expect(reachable.length).toBeGreaterThan(0);
    expect(reachable.some((c) => c.querySelector('.release-month-cell__season'))).toBe(true);
  });

  it('says an empty calendar is unknown, never clear', () => {
    // This fixture has no rivals at all, so nothing is knowable on any date. A
    // zero crowding score there is the absence of information, not the absence
    // of competition - measured over two simulated in-game years, nothing is
    // knowable past ~356 days while this grid offers eighteen months and more.
    const { container } = renderCard(37);
    const cells = [...container.querySelectorAll('.release-month-cell')];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.querySelector('.release-month-cell__crowding')).toHaveTextContent('Nothing known yet');
    }
    expect(container.querySelectorAll('.release-month-cell__crowding--clear')).toHaveLength(0);
  });

  it('explains what "nothing known yet" means once such a date is claimed', () => {
    const { container } = renderCard(38);
    fireEvent.click(container.querySelector('.release-month-cell') as HTMLButtonElement);
    expect(screen.getByText(/No studio has scheduled anything this far ahead/)).toBeInTheDocument();
    // ...and names no competitor, because there is none to name.
    expect(container.querySelector('.date-reading__field')).toBeNull();
  });

  it('warns in words once a date is claimed, naming the worst problem with it', () => {
    const { container } = renderCard(34);
    // Claim the first month offered - the one the film has no chance of making.
    const firstMonth = container.querySelector('.release-month-cell') as HTMLButtonElement;
    fireEvent.click(firstMonth);

    expect(screen.getByText('Can the film make it')).toBeInTheDocument();
    expect(screen.getByText('Campaign runway')).toBeInTheDocument();
    expect(screen.getByText('Season')).toBeInTheDocument();
    expect(screen.getByText('The field')).toBeInTheDocument();
    expect(screen.getByText(/will not be finished by this date/)).toBeInTheDocument();
  });
});
