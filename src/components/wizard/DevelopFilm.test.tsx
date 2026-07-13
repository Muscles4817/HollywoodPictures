// @vitest-environment jsdom
//
// Screenplay redesign (docs/DESIGN.md) - a real render of the redesigned
// screenplay card, standing in for a manual browser check (no Playwright/
// browser-automation dependency is set up in this project - see
// OutcomeInspector.test.tsx for the same jsdom+StudioProvider pattern this
// borrows). Catches exactly the class of bug tsc can't: a null-reference or
// missing-import inside ScriptDetails that only surfaces at render time.
// Development-pipeline doc: DevelopFilm.tsx no longer generates or picks a
// script itself - a Project's script is inherited wholesale from the Asset
// it was created from (state/gameState.ts:createDraftFromAsset), so this
// file builds that Asset/Project directly via CREATE_PROJECT_FROM_ASSET
// rather than the old START_NEW_FILM/SET_GENRE/SELECT_SCRIPT sequence.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudioProvider } from '../../state/StudioContext';
import { DevelopFilm } from './DevelopFilm';
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
  const asset: Asset = { id: `asset-${result.script.id}`, script: result.script, source: 'Studio Original', acquisitionCost: result.script.cost, acquiredOnDay: 1 };
  const state: GameState = {
    studio: { ...createInitialStudio(10_000_000), assets: [asset] },
    screen: 'dashboard',
    projects: [],
    focusedProjectId: null,
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

describe('DevelopFilm - the redesigned screenplay card renders without crashing', () => {
  it('renders the concept/production/commercial descriptors, for every genre', () => {
    for (const genre of ['Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Thriller'] as const) {
      const state = stateWithFocusedAssetDraft(1, genre);
      saveState(state);
      const { unmount } = render(
        <StudioProvider>
          <DevelopFilm />
        </StudioProvider>,
      );
      expect(screen.getAllByText(/Priced for|A modest, straightforward production\./).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Commercially:|Middling, unremarkable commercial potential\./).length).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });

  it('shows the Target Audience pre-fill hint for the inherited script', () => {
    const state = stateWithFocusedAssetDraft(2, 'Action');
    saveState(state);
    render(
      <StudioProvider>
        <DevelopFilm />
      </StudioProvider>,
    );
    expect(screen.getByText((text) => text.startsWith('Pre-filled from'))).toBeInTheDocument();
  });
});

describe('DevelopFilm - presentation polish pass (docs/DESIGN.md)', () => {
  it('groups the five quality stats under "Writing"/"Creative" headings, and shows "Intended Audience"/"Screenplay Cost" instead of the old "Written For"/"Cost" wording', () => {
    const state = stateWithFocusedAssetDraft(3, 'Action');
    saveState(state);
    render(
      <StudioProvider>
        <DevelopFilm />
      </StudioProvider>,
    );
    expect(screen.getAllByText('Writing').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Creative').length).toBeGreaterThanOrEqual(1);
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
        <DevelopFilm />
      </StudioProvider>,
    );
    expect(screen.queryByText(/Production Style:/)).not.toBeInTheDocument();
  });

  it('shows every quality stat as a star rating, not a bare number, within the Writing/Creative groups', () => {
    const state = stateWithFocusedAssetDraft(5, 'Action');
    saveState(state);
    render(
      <StudioProvider>
        <DevelopFilm />
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
        <DevelopFilm />
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
    expect(SETTING_LABELS.SciFi).toBe('Sci-Fi');
    expect(ARCHETYPE_LABELS.CrowdPleaser).toBe('Crowd-Pleaser');
    expect(ARCHETYPE_LABELS.OriginalVision).toBe('Original Vision');
    expect(ARCHETYPE_LABELS.GenreFormula).toBe('Genre Formula');
  });
});
