// Workstream II, Layer 2 — persisting the producer's Execution Strategy.
// SET_EXECUTION_STRATEGY merges a partial method patch onto the focused draft,
// so each axis can be set independently and the rest keep their (lean-derived)
// defaults.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildReadyAsset } from './testFixtures';
import { createInitialStudio, type GameState } from './gameState';
import { withRng } from '../engine/random';
import { generateTalentPool } from '../engine/talentGenerator';
import { findProject, asPlayerDraft } from '../engine/project';

function focusedState(seed: number): GameState {
  const { result, nextSeed } = withRng(seed, (rng) => ({ talentPool: generateTalentPool(rng), asset: buildReadyAsset(rng) }));
  let s: GameState = {
    studio: { ...createInitialStudio(50_000_000), assets: [result.asset] },
    screen: 'dashboard', projects: [], focusedProjectId: null, projectWorkspaceSection: 'overview',
    rngSeed: nextSeed, totalDays: 1, talentPool: result.talentPool, rivalStudios: [],
    opportunities: [], nextOpportunityCheckDay: 1, viewingRivalStudioName: null, viewingProductionId: null,
  };
  return studioReducer(s, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: result.asset.id });
}
const draftOf = (s: GameState) => asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;

describe('SET_EXECUTION_STRATEGY', () => {
  it('merges a partial patch, setting one axis without disturbing another', () => {
    const s0 = focusedState(1);
    expect(draftOf(s0).executionStrategy).toBeUndefined();

    const s1 = studioReducer(s0, { type: 'SET_EXECUTION_STRATEGY', patch: { creatureMethod: 'fullyCG' } });
    expect(draftOf(s1).executionStrategy).toEqual({ creatureMethod: 'fullyCG' });

    const s2 = studioReducer(s1, { type: 'SET_EXECUTION_STRATEGY', patch: { environmentMethod: 'location' } });
    expect(draftOf(s2).executionStrategy).toEqual({ creatureMethod: 'fullyCG', environmentMethod: 'location' });

    // Re-setting an axis overwrites just that axis.
    const s3 = studioReducer(s2, { type: 'SET_EXECUTION_STRATEGY', patch: { creatureMethod: 'animatronic' } });
    expect(draftOf(s3).executionStrategy).toEqual({ creatureMethod: 'animatronic', environmentMethod: 'location' });
  });

  it('is a no-op when there is no focused draft', () => {
    const s0 = focusedState(2);
    const noFocus = { ...s0, focusedProjectId: null };
    expect(studioReducer(noFocus, { type: 'SET_EXECUTION_STRATEGY', patch: { creatureMethod: 'hybrid' } })).toBe(noFocus);
  });
});
