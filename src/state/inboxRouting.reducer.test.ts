// The Inbox's Cast & Crew beats: their read state (ACKNOWLEDGE_CASTING_APPLICANTS
// / ACKNOWLEDGE_DIRECTOR_PITCHES) and the deep-links that take the player to the
// exact drawer a notification was about (REVIEW_CASTING_CALL /
// REVIEW_DIRECTOR_PITCHES -> GameState.castCrewFocus).
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildReadyAsset } from './testFixtures';
import { createInitialStudio, type GameState } from './gameState';
import { withRng } from '../engine/random';
import { generateTalentPool } from '../engine/talentGenerator';
import { findProject, asPlayerDraft, deriveInboxItems } from '../engine/project';
import { generateDirectorPitch } from '../engine/directorPitch';
import type { CastingApplicant, FilmDraft, Person, ScriptCharacter } from '../types';

/** A pre-Greenlight project, focused, plus its Lead character and the world's talent pool. */
function workspaceState(seed: number): { state: GameState; lead: ScriptCharacter; pool: Record<string, Person[]> } {
  const { result, nextSeed } = withRng(seed, (rng) => ({ talentPool: generateTalentPool(rng), asset: buildReadyAsset(rng) }));
  let s: GameState = {
    studio: { ...createInitialStudio(50_000_000), assets: [result.asset] },
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
  s = studioReducer(s, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: result.asset.id });
  const script = asPlayerDraft(findProject(s.projects, s.focusedProjectId))!.script!;
  return { state: s, lead: script.cast.find((c) => c.prominence === 'Lead')!, pool: result.talentPool };
}

function draftOf(s: GameState, projectId = s.focusedProjectId): FilmDraft {
  return asPlayerDraft(findProject(s.projects, projectId))!;
}

function patchDraft(s: GameState, projectId: string, patch: Partial<FilmDraft>): GameState {
  return {
    ...s,
    projects: s.projects.map((p) =>
      p.kind === 'player-in-progress' && p.draft.id === projectId ? { ...p, draft: { ...p.draft, ...patch } } : p,
    ),
  };
}

/** Two applicants waiting on `characterId`, none of them seen yet. */
function applicants(pool: Person[]): CastingApplicant[] {
  return [
    { person: pool[0], appliedOnDay: 1, channel: 'OpenCasting' },
    { person: pool[1], appliedOnDay: 1, channel: 'InterestedTalent' },
  ];
}

describe('ACKNOWLEDGE_CASTING_APPLICANTS', () => {
  it('marks one Character\'s applicants seen, clearing that Inbox beat without casting anybody', () => {
    const { state, lead, pool } = workspaceState(1);
    const projectId = state.focusedProjectId!;
    const opened = studioReducer(state, { type: 'OPEN_CASTING_CALL', characterId: lead.id, role: 'Lead Actor' });
    const call = draftOf(opened).castingCalls.find((c) => c.characterId === lead.id)!;
    const waiting = patchDraft(opened, projectId, {
      castingCalls: [{ ...call, applicants: applicants(pool.Actor) }],
    });

    // The beat is live for the focused project (it clears on read, not on focus).
    expect(deriveInboxItems(waiting.projects, waiting.focusedProjectId).casting).toHaveLength(1);

    const acked = studioReducer(waiting, { type: 'ACKNOWLEDGE_CASTING_APPLICANTS', characterId: lead.id });
    expect(draftOf(acked).castingCalls[0].applicants.every((a) => a.acknowledged)).toBe(true);
    expect(deriveInboxItems(acked.projects, acked.focusedProjectId).casting).toEqual([]);
    // Nobody was cast - only the read state changed.
    expect(draftOf(acked).talent).toEqual(draftOf(waiting).talent);
    // A second acknowledge is a no-op.
    expect(studioReducer(acked, { type: 'ACKNOWLEDGE_CASTING_APPLICANTS', characterId: lead.id })).toBe(acked);
  });

  it('leaves another Character\'s applicants alone', () => {
    const { state, lead, pool } = workspaceState(2);
    const projectId = state.focusedProjectId!;
    const supporting = draftOf(state).script!.cast.find((c) => c.prominence === 'Supporting')!;
    let s = studioReducer(state, { type: 'OPEN_CASTING_CALL', characterId: lead.id, role: 'Lead Actor' });
    s = studioReducer(s, { type: 'OPEN_CASTING_CALL', characterId: supporting.id, role: 'Supporting Actor' });
    s = patchDraft(s, projectId, {
      castingCalls: draftOf(s).castingCalls.map((c) => ({ ...c, applicants: applicants(pool.Actor) })),
    });

    const acked = studioReducer(s, { type: 'ACKNOWLEDGE_CASTING_APPLICANTS', characterId: lead.id });
    const byCharacter = new Map(draftOf(acked).castingCalls.map((c) => [c.characterId, c] as const));
    expect(byCharacter.get(lead.id)!.applicants.every((a) => a.acknowledged)).toBe(true);
    expect(byCharacter.get(supporting.id)!.applicants.some((a) => a.acknowledged)).toBe(false);
    // So the other role is still waiting on the player.
    expect(deriveInboxItems(acked.projects, acked.focusedProjectId).casting[0].calls).toHaveLength(1);
  });
});

describe('ACKNOWLEDGE_DIRECTOR_PITCHES', () => {
  it('marks every landed pitch read, clearing the bake-off beat without deciding the round', () => {
    const { state, pool } = workspaceState(3);
    const projectId = state.focusedProjectId!;
    const script = draftOf(state).script!;
    const pitches = pool.Director.slice(0, 2).map((director) => generateDirectorPitch(director, script));
    const landed = patchDraft(state, projectId, {
      directorPitches: { openedOnDay: 1, advertisedFee: 1_000_000, pending: [], submitted: pitches },
    });
    expect(deriveInboxItems(landed.projects, landed.focusedProjectId).directorPitches).toHaveLength(1);

    const acked = studioReducer(landed, { type: 'ACKNOWLEDGE_DIRECTOR_PITCHES' });
    expect(draftOf(acked).directorPitches!.submitted.every((p) => p.acknowledged)).toBe(true);
    expect(deriveInboxItems(acked.projects, acked.focusedProjectId).directorPitches).toEqual([]);
    // The round is still open and still undecided.
    expect(draftOf(acked).directorPitches!.submitted).toHaveLength(2);
    expect(draftOf(acked).selectedDirectorPitch).toBeUndefined();
    expect(studioReducer(acked, { type: 'ACKNOWLEDGE_DIRECTOR_PITCHES' })).toBe(acked);
  });

  it('is a no-op with no open round', () => {
    const { state } = workspaceState(4);
    expect(studioReducer(state, { type: 'ACKNOWLEDGE_DIRECTOR_PITCHES' })).toBe(state);
  });
});

describe('REVIEW_CASTING_CALL / REVIEW_DIRECTOR_PITCHES', () => {
  it('focuses the project and lands on Cast & Crew with the Character\'s drawer requested', () => {
    const { state, lead } = workspaceState(5);
    const projectId = state.focusedProjectId!;
    const unfocused = studioReducer(state, { type: 'RETURN_TO_DASHBOARD' });
    expect(unfocused.focusedProjectId).toBeNull();

    const routed = studioReducer(unfocused, { type: 'REVIEW_CASTING_CALL', projectId, characterId: lead.id });
    expect(routed.focusedProjectId).toBe(projectId);
    expect(routed.screen).toBe('workspace');
    expect(routed.projectWorkspaceSection).toBe('cast-and-crew');
    expect(routed.castCrewFocus).toEqual({ kind: 'character', characterId: lead.id });
  });

  it('works within the project the player is already in - that is exactly when the drawer is not on screen', () => {
    const { state, lead } = workspaceState(6);
    const projectId = state.focusedProjectId!;
    const onOverview = studioReducer(state, { type: 'OPEN_PROJECT_WORKSPACE_SECTION', section: 'overview' });
    const routed = studioReducer(onOverview, { type: 'REVIEW_CASTING_CALL', projectId, characterId: lead.id });
    expect(routed.projectWorkspaceSection).toBe('cast-and-crew');
    expect(routed.castCrewFocus).toEqual({ kind: 'character', characterId: lead.id });
  });

  it('refuses while a DIFFERENT project is focused, same guard RESUME_PROJECT enforces', () => {
    const { state, lead } = workspaceState(7);
    const projectId = state.focusedProjectId!;
    const elsewhere = { ...state, focusedProjectId: 'some-other-project' };
    expect(studioReducer(elsewhere, { type: 'REVIEW_CASTING_CALL', projectId, characterId: lead.id })).toBe(elsewhere);
  });

  it('routes to the Director bake-off the same way', () => {
    const { state } = workspaceState(8);
    const projectId = state.focusedProjectId!;
    const unfocused = studioReducer(state, { type: 'RETURN_TO_DASHBOARD' });
    const routed = studioReducer(unfocused, { type: 'REVIEW_DIRECTOR_PITCHES', projectId });
    expect(routed.focusedProjectId).toBe(projectId);
    expect(routed.projectWorkspaceSection).toBe('cast-and-crew');
    expect(routed.castCrewFocus).toEqual({ kind: 'director-pitches' });
  });

  it('the request is one-shot: consuming it, or navigating away, clears it', () => {
    const { state, lead } = workspaceState(9);
    const projectId = state.focusedProjectId!;
    const routed = studioReducer(state, { type: 'REVIEW_CASTING_CALL', projectId, characterId: lead.id });

    const consumed = studioReducer(routed, { type: 'CLEAR_CAST_CREW_FOCUS' });
    expect(consumed.castCrewFocus).toBeNull();
    expect(studioReducer(consumed, { type: 'CLEAR_CAST_CREW_FOCUS' })).toBe(consumed);

    // Navigating anywhere abandons an unconsumed request too, so it can never
    // pop a drawer open after the player has moved on.
    expect(studioReducer(routed, { type: 'RETURN_TO_DASHBOARD' }).castCrewFocus).toBeNull();
  });
});
