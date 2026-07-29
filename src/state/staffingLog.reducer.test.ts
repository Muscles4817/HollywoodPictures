// Workstream I, Phase 2b - the curated staffing activity feed. These tests pin
// the contract the user was explicit about: the feed records decisions and
// changes that MATTER (offers signed, auditions arranged, roles locked) and
// never becomes an indiscriminate log of UI churn (a budget-split slider drag
// must NOT append an event).
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildReadyAsset } from './testFixtures';
import { createInitialStudio, type GameState } from './gameState';
import { withRng } from '../engine/random';
import { generateTalentPool } from '../engine/talentGenerator';
import { findProject, asPlayerDraft } from '../engine/project';
import type { Person, ScriptCharacter } from '../types';

function buildActor(id: string, gender: 'Male' | 'Female'): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [], gender, dateOfBirth: undefined },
    personality: { professionalism: 50, ambition: 10, loyalty: 50, ego: 10, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 10, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 10 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {
      actor: {
        role: 'Actor', active: true, experience: 50, roleReputation: 50,
        minimumSalary: 200_000, typicalSalary: 1_000_000,
        actingStyle: { characterTransformation: 70, emotionalPerformance: 70, charisma: 70, comedy: 70, physicalPerformance: 70 },
      },
    },
  } as unknown as Person;
}

function uncastState(seed: number): { state: GameState; lead: ScriptCharacter } {
  const { result, nextSeed } = withRng(seed, (rng) => ({ talentPool: generateTalentPool(rng), asset: buildReadyAsset(rng) }));
  let s: GameState = {
    studio: { ...createInitialStudio(50_000_000), brand: 80, prestige: 80, assets: [result.asset] },
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
  const lead = script.cast.find((c) => c.prominence === 'Lead')!;
  return { state: s, lead };
}

function matchingGender(lead: ScriptCharacter): 'Male' | 'Female' {
  return lead.castingGender === 'Male' || lead.castingGender === 'Female' ? lead.castingGender : 'Female';
}

const draftOf = (s: GameState) => asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;
const log = (s: GameState) => draftOf(s).staffingLog ?? [];

describe('staffing activity feed - meaningful events ARE recorded', () => {
  it('logs an attached event when an offer signs an actor', () => {
    const { state, lead } = uncastState(11);
    const actor = buildActor('signable', matchingGender(lead));
    const after = studioReducer(state, { type: 'MAKE_OFFER', characterId: lead.id, role: 'Lead Actor', person: actor, offeredSalary: 20_000_000 });
    expect(draftOf(after).talent.some((a) => a.person.id === actor.id)).toBe(true); // precondition: signed
    const events = log(after);
    expect(events.some((e) => e.kind === 'attached' && e.personName === 'signable')).toBe(true);
  });

  it('logs an audition event when a screen test is arranged', () => {
    const { state, lead } = uncastState(30);
    const actor = buildActor('tester', matchingGender(lead));
    const after = studioReducer(state, { type: 'REQUEST_AUDITION', characterId: lead.id, role: 'Lead Actor', personId: actor.id, personName: actor.identity.name });
    expect(log(after).some((e) => e.kind === 'audition' && e.personName === 'tester')).toBe(true);
  });

  it('logs a budget event when a role budget is locked, and nothing when the lock state is unchanged', () => {
    const { state } = uncastState(40);
    const locked = studioReducer(state, { type: 'SET_ROLE_BUDGET_LOCK', role: 'Director', locked: true });
    expect(log(locked).some((e) => e.kind === 'budget' && e.subject === 'Director')).toBe(true);

    // Re-locking an already-locked role is a no-op: no duplicate event.
    const again = studioReducer(locked, { type: 'SET_ROLE_BUDGET_LOCK', role: 'Director', locked: true });
    expect(log(again)).toHaveLength(log(locked).length);
  });
});

describe('staffing activity feed - UI churn is NOT recorded', () => {
  it('does not log an event when the master budget slider is dragged', () => {
    const { state } = uncastState(50);
    const before = log(state).length;
    const after = studioReducer(state, { type: 'SET_TALENT_BUDGET_SPLIT', totalBudget: 12_345_678 });
    // The split may retarget every role, but that is not a "decision that matters".
    expect(log(after)).toHaveLength(before);
  });
});
