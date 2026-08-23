import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft, buildReadyAsset } from './testFixtures';
import { createRng } from '../engine/random';
import { assetAcceptsDevelopmentPass, deriveAssetStatus } from '../engine/project';
import type { GameState } from './gameState';
import type { Asset, Script } from '../types';

/** A state with one genuinely available (un-projected) Asset added, and a large cash reserve. */
function stateWithAvailableAsset(seed: number): { state: GameState; asset: Asset } {
  const base = buildStateWithReadyDraft(seed);
  const asset = buildReadyAsset(createRng(seed + 500));
  const state: GameState = {
    ...base,
    studio: { ...base.studio, cash: 50_000_000, assets: [...base.studio.assets, asset] },
  };
  return { state, asset };
}

describe('REWRITE_ASSET', () => {
  it('commissions a pass: charges the fee, books the writer, and stamps pendingRewrite', () => {
    const { state, asset } = stateWithAvailableAsset(1);
    expect(deriveAssetStatus(asset, state.projects).status).toBe('available');
    const writer = state.talentPool.Writer[0];

    const after = studioReducer(state, { type: 'REWRITE_ASSET', assetId: asset.id, kind: 'polish', writerId: writer.id });
    const updated = after.studio.assets.find((a) => a.id === asset.id)!;

    expect(updated.pendingRewrite).toBeDefined();
    expect(updated.pendingRewrite!.kind).toBe('polish');
    expect(updated.pendingRewrite!.readyOnDay).toBeGreaterThan(state.totalDays);
    expect(after.studio.cash).toBe(state.studio.cash - updated.pendingRewrite!.fee);

    const bookedWriter = after.talentPool.Writer.find((w) => w.id === writer.id)!;
    expect(bookedWriter.availability.commitments.length).toBeGreaterThan(0);
    // A development-log entry records the commission.
    expect(updated.developmentHistory?.at(-1)?.summary).toContain('commissioned');
  });

  it('is a no-op when the studio cannot afford the fee', () => {
    const { state, asset } = stateWithAvailableAsset(2);
    const poor: GameState = { ...state, studio: { ...state.studio, cash: 0 } };
    const result = studioReducer(poor, { type: 'REWRITE_ASSET', assetId: asset.id, kind: 'rewrite', writerId: state.talentPool.Writer[0].id });
    expect(result).toBe(poor);
  });

  it('is a no-op for an unknown writer, and while a pass is already in progress', () => {
    const { state, asset } = stateWithAvailableAsset(3);
    expect(studioReducer(state, { type: 'REWRITE_ASSET', assetId: asset.id, kind: 'polish', writerId: 'nobody' })).toBe(state);

    const once = studioReducer(state, { type: 'REWRITE_ASSET', assetId: asset.id, kind: 'polish', writerId: state.talentPool.Writer[0].id });
    const twice = studioReducer(once, { type: 'REWRITE_ASSET', assetId: asset.id, kind: 'polish', writerId: state.talentPool.Writer[1].id });
    expect(twice).toBe(once); // already pending
  });

  // The coexistence contract (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md
  // section 1.1). A pass and a project's commitments used to be mutually
  // exclusive, which put development in the one phase of the game where nothing
  // could be lost - the reason waiting was strictly dominant.
  it('allows starting a Project while a pass is mid-flight, and lands the new head on the draft', () => {
    const { state, asset } = stateWithAvailableAsset(4);
    const rewriting = studioReducer(state, { type: 'REWRITE_ASSET', assetId: asset.id, kind: 'rewrite', writerId: state.talentPool.Writer[0].id });

    const withProject = studioReducer(rewriting, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: asset.id });
    expect(withProject).not.toBe(rewriting); // no longer a no-op
    const projectId = withProject.focusedProjectId!;
    const draftOf = (s: GameState) =>
      s.projects.find((p) => p.kind === 'player-in-progress' && p.draft.id === projectId) as { draft: { script: Script | null } };
    expect(draftOf(withProject).draft.script!.id).toBe(asset.script.id);

    const readyOnDay = withProject.studio.assets.find((a) => a.id === asset.id)!.pendingRewrite!.readyOnDay;
    let s = withProject;
    for (let day = s.totalDays; day <= readyOnDay + 1; day++) s = studioReducer(s, { type: 'ADVANCE_DAY' });

    // The pass landed on the Asset AND flowed through to the live draft, which
    // is still pre-photography - it is not holding the stale head it was
    // created from (engine/rewrite.ts:draftAtAssetHead).
    const head = s.studio.assets.find((a) => a.id === asset.id)!.script;
    expect(head.id).not.toBe(asset.script.id);
    expect(draftOf(s).draft.script!.id).toBe(head.id);
  });

  it('refuses a pass once photography has begun - the screenplay is frozen', () => {
    const { state } = stateWithAvailableAsset(6);
    // The fixture's own draft is release-ready (photography finished), so its
    // Asset is past the point a pass can touch it.
    const shotAssetId = (state.projects[0] as { draft: { assetId: string } }).draft.assetId;
    expect(assetAcceptsDevelopmentPass(state.studio.assets.find((a) => a.id === shotAssetId)!, state.projects)).toBe(false);

    const attempt = studioReducer(state, { type: 'REWRITE_ASSET', assetId: shotAssetId, kind: 'polish', writerId: state.talentPool.Writer[0].id });
    expect(attempt).toBe(state);
  });

  it('lands the new head Script when the pass completes, via the calendar', () => {
    const { state, asset } = stateWithAvailableAsset(5);
    const writer = state.talentPool.Writer[0];
    let s = studioReducer(state, { type: 'REWRITE_ASSET', assetId: asset.id, kind: 'rewrite', writerId: writer.id });
    const readyOnDay = s.studio.assets.find((a) => a.id === asset.id)!.pendingRewrite!.readyOnDay;

    for (let day = s.totalDays; day <= readyOnDay + 1; day++) s = studioReducer(s, { type: 'ADVANCE_DAY' });

    const done = s.studio.assets.find((a) => a.id === asset.id)!;
    expect(done.pendingRewrite).toBeUndefined();
    expect(done.revisions).toHaveLength(1);
    expect(done.revisions![0]).toEqual(asset.script); // the pre-rewrite head is preserved
    expect(done.writerIds).toContain(writer.id);
  });
});
