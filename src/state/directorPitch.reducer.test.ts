// Director bake-off (Phase B2 - docs/DESIGN_director_pitch_and_bakeoff.md): the
// reducer flow. Open a pitch round, let pitches land on the day tick, then select
// one (attaching that director and freezing the winning pitch) or pass.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildReadyAsset } from './testFixtures';
import { createInitialStudio, type GameState } from './gameState';
import { withRng } from '../engine/random';
import { generateTalentPool } from '../engine/talentGenerator';
import { findProject, asPlayerDraft } from '../engine/project';
import type { Person, ToneProfile } from '../types';

const FLAT_TONE: ToneProfile = { action: 50, comedy: 50, romance: 50, suspense: 50, drama: 50, spectacle: 50 };

function workingDirector(id: string): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [] },
    personality: { professionalism: 50, ambition: 40, loyalty: 50, ego: 40, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 20, prestige: 45, industryRespect: 45, reliability: 50, currentHeat: 20 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Director',
    careers: {
      director: {
        role: 'Director', active: true, experience: 50, roleReputation: 50, minimumSalary: 200_000, typicalSalary: 2_000_000,
        skill: 55,
        toneProfile: { ...FLAT_TONE },
        productionStyle: { environmentStrategy: { studio: 0.34, location: 0.33, digital: 0.33 }, effectsStrategy: { practical: 0.5, digital: 0.5 } },
      },
    },
  } as unknown as Person;
}

const ADVERTISED_FEE = 1_500_000;

function baseState(seed: number): GameState {
  const { result, nextSeed } = withRng(seed, (rng) => ({ talentPool: generateTalentPool(rng), asset: buildReadyAsset(rng) }));
  // Inject eager working directors so the field is deterministic regardless of
  // what the generator rolled.
  const injected = ['pitch-a', 'pitch-b', 'pitch-c'].map(workingDirector);
  let s: GameState = {
    studio: { ...createInitialStudio(50_000_000), brand: 80, prestige: 80, assets: [result.asset] },
    screen: 'dashboard',
    projects: [],
    focusedProjectId: null,
    projectWorkspaceSection: 'overview',
    rngSeed: nextSeed,
    totalDays: 1,
    talentPool: { ...result.talentPool, Director: [...injected, ...result.talentPool.Director] },
    rivalStudios: [],
    opportunities: [],
    nextOpportunityCheckDay: 1,
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
  s = studioReducer(s, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: result.asset.id });
  return s;
}

const draftOf = (s: GameState) => asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;

function advance(s: GameState, days: number): GameState {
  let next = s;
  for (let i = 0; i < days; i++) next = studioReducer(next, { type: 'ADVANCE_DAY' });
  return next;
}

describe('OPEN_DIRECTOR_PITCHES', () => {
  it('opens a round with a scheduled field and no submissions yet', () => {
    const opened = studioReducer(baseState(1), { type: 'OPEN_DIRECTOR_PITCHES', advertisedFee: ADVERTISED_FEE });
    const process = draftOf(opened).directorPitches;
    expect(process).toBeTruthy();
    expect(process!.pending.length).toBeGreaterThan(0);
    expect(process!.submitted).toEqual([]);
    expect(process!.advertisedFee).toBe(ADVERTISED_FEE);
  });

  it('no-ops when a round is already open', () => {
    const opened = studioReducer(baseState(2), { type: 'OPEN_DIRECTOR_PITCHES', advertisedFee: ADVERTISED_FEE });
    const again = studioReducer(opened, { type: 'OPEN_DIRECTOR_PITCHES', advertisedFee: 9_000_000 });
    expect(draftOf(again).directorPitches!.advertisedFee).toBe(ADVERTISED_FEE);
  });
});

describe('the bake-off flow through the day tick', () => {
  it('lands pitches over time, and selecting one attaches that director and freezes the pitch', () => {
    const opened = studioReducer(baseState(3), { type: 'OPEN_DIRECTOR_PITCHES', advertisedFee: ADVERTISED_FEE });
    expect(draftOf(opened).talent.some((a) => a.role === 'Director')).toBe(false); // precondition

    // Pitches take a few weeks; advance well past the max delay (7 + 14).
    const ticked = advance(opened, 25);
    const process = draftOf(ticked).directorPitches!;
    expect(process.submitted.length).toBeGreaterThan(0);
    expect(process.pending).toEqual([]);

    const chosen = process.submitted[0];
    const selected = studioReducer(ticked, { type: 'SELECT_DIRECTOR_PITCH', directorId: chosen.directorId });
    const draft = draftOf(selected);
    const director = draft.talent.find((a) => a.role === 'Director');
    expect(director?.person.id).toBe(chosen.directorId);
    expect(director?.agreedSalary).toBe(ADVERTISED_FEE);
    expect(draft.selectedDirectorPitch?.directorId).toBe(chosen.directorId);
    expect(draft.directorPitches).toBeUndefined(); // round closed
  });

  it('passing on the round closes it without hiring', () => {
    const opened = studioReducer(baseState(4), { type: 'OPEN_DIRECTOR_PITCHES', advertisedFee: ADVERTISED_FEE });
    const passed = studioReducer(advance(opened, 25), { type: 'PASS_ON_PITCHES' });
    expect(draftOf(passed).directorPitches).toBeUndefined();
    expect(draftOf(passed).talent.some((a) => a.role === 'Director')).toBe(false);
  });
});
