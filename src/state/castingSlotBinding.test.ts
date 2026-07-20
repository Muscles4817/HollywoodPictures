// Slot-bound casting (docs/DESIGN_REVIEW_casting_slot_binding.md, PR 1 -
// model + engine). Binding each actor to a specific ScriptCharacter via
// TalentAssignment.characterId, instead of inferring the character from array
// position, is what lets a player cast characters in any order and recast one
// without disturbing the others. These tests cover the invisible engine half:
//   - the reducer writes and honours the binding (incl. out-of-order + recast)
//   - the acting score reads the binding, with an exact positional fallback so
//     pre-binding casts score identically (the property that keeps PR 1 green)
//   - isCharacterCast is binding-based, order-independent
//
// The Inception Test Script (2 leads, 4 supporting, mixed genders) is the
// fixture - a real multi-character ensemble, so slot order actually matters.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { createInitialStudio, createDraftFromAsset, type GameState } from './gameState';
import { withRng } from '../engine/random';
import { generateTalentPool } from '../engine/talentGenerator';
import { playerDraftToProject, findProject, asPlayerDraft } from '../engine/project';
import { computeActingScore } from '../engine/scoring';
import { isCharacterCast } from '../engine/castingCalls';
import { TEST_SCRIPT_ASSETS } from '../data/testScripts';
import type { ActingStyle, FilmDraft, Person, ProductionRole, TalentAssignment } from '../types';

const inceptionAsset = TEST_SCRIPT_ASSETS.find((a) => a.script.id === 'test-script-inception')!;
const script = inceptionAsset.script;
const characterId = (name: string) => script.cast.find((c) => c.name === name)!.id;

function mkActor(id: string, gender: 'Male' | 'Female', style: Partial<ActingStyle> = {}): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [], gender, dateOfBirth: { year: -35, month: 1, day: 1 } },
    personality: { professionalism: 60, ambition: 50, loyalty: 50, ego: 40, temperament: 50, pressureHandling: 50, controversy: 20, adaptability: 50 },
    reputation: { fame: 60, prestige: 55, industryRespect: 60, reliability: 70, currentHeat: 55 },
    primaryRole: 'Actor',
    careers: {
      actor: {
        role: 'Actor', active: true, experience: 50, roleReputation: 55, minimumSalary: 1_000_000, typicalSalary: 1_000_000,
        actingStyle: { characterTransformation: 60, emotionalPerformance: 60, charisma: 60, comedy: 40, physicalPerformance: 50, ...style },
      },
    },
    availability: { commitments: [] },
    traits: [],
  };
}

/** A GameState with an Inception draft focused and empty-cast, ready to dispatch TOGGLE_TALENT_FOR_ROLE against. */
function stateWithInceptionDraft(): GameState {
  const draft = createDraftFromAsset(inceptionAsset, {});
  const talentPool = withRng(1, (rng) => generateTalentPool(rng)).result;
  return {
    studio: createInitialStudio(400_000_000),
    screen: 'marketing',
    projects: [playerDraftToProject(draft)],
    focusedProjectId: draft.id,
    projectWorkspaceSection: 'overview',
    rngSeed: 2,
    totalDays: 1,
    talentPool,
    rivalStudios: [],
    opportunities: [],
    nextOpportunityCheckDay: 1,
    viewingRivalStudioName: null,
    viewingProductionId: null,
  };
}

function draftOf(state: GameState): FilmDraft {
  return asPlayerDraft(findProject(state.projects, state.focusedProjectId))!;
}

function cast(state: GameState, role: ProductionRole, person: Person, cid?: string): GameState {
  return studioReducer(state, { type: 'TOGGLE_TALENT_FOR_ROLE', role, person, characterId: cid });
}

describe('slot-bound casting — reducer', () => {
  it('binds an actor to the Character the action names', () => {
    const s = cast(stateWithInceptionDraft(), 'Lead Actor', mkActor('dicaprio', 'Male'), characterId('Dom Cobb'));
    const talent = draftOf(s).talent;
    expect(talent).toHaveLength(1);
    expect(talent[0]).toMatchObject({ role: 'Lead Actor', characterId: characterId('Dom Cobb') });
    expect(talent[0].person.id).toBe('dicaprio');
  });

  it('casts characters OUT OF ORDER — a male Supporting role that the old positional gate would have rejected first', () => {
    // Eames (Supporting slot 1, Male) cast as the FIRST supporting hire.
    // Under the old positional rule the first supporting hire mapped to slot 0
    // = Ariadne (Female), so a male actor was gender-rejected. With binding,
    // gender is checked against Eames directly and it goes through.
    const eames = mkActor('hardy', 'Male');
    const bound = cast(stateWithInceptionDraft(), 'Supporting Actor', eames, characterId('Eames'));
    expect(draftOf(bound).talent).toHaveLength(1);
    expect(draftOf(bound).talent[0]).toMatchObject({ characterId: characterId('Eames') });

    // Same actor, same "first supporting hire", but UNBOUND (legacy path):
    // positional slot 0 = Ariadne (Female) → rejected, no-op.
    const unbound = studioReducer(stateWithInceptionDraft(), { type: 'TOGGLE_TALENT_FOR_ROLE', role: 'Supporting Actor', person: eames });
    expect(draftOf(unbound).talent).toHaveLength(0);
  });

  it('recasts a single Character — swaps the actor, leaves every other binding untouched', () => {
    let s = stateWithInceptionDraft();
    s = cast(s, 'Lead Actor', mkActor('dicaprio', 'Male'), characterId('Dom Cobb'));
    s = cast(s, 'Lead Actor', mkActor('gordon-levitt', 'Male'), characterId('Arthur'));
    // Recast Dom Cobb with a different actor.
    s = cast(s, 'Lead Actor', mkActor('someone-else', 'Male'), characterId('Dom Cobb'));

    const talent = draftOf(s).talent;
    expect(talent).toHaveLength(2); // still exactly two leads - a swap, not an append
    const cobb = talent.filter((t) => t.characterId === characterId('Dom Cobb'));
    expect(cobb).toHaveLength(1); // never double-booked
    expect(cobb[0].person.id).toBe('someone-else');
    // Arthur's binding is undisturbed by the Dom Cobb recast.
    expect(talent.find((t) => t.characterId === characterId('Arthur'))!.person.id).toBe('gordon-levitt');
  });

  it('rejects a gender-mismatched actor for the bound Character', () => {
    // Mal is written Female; a male actor bound to her is refused.
    const s = cast(stateWithInceptionDraft(), 'Supporting Actor', mkActor('wrong-gender', 'Male'), characterId('Mal'));
    expect(draftOf(s).talent).toHaveLength(0);
  });
});

describe('slot-bound casting — acting score', () => {
  // Distinct styles so who-plays-whom actually moves the per-character fit,
  // making order-independence and parity meaningful rather than trivially true.
  const cobb = mkActor('cobb', 'Male', { characterTransformation: 95, emotionalPerformance: 90 });
  const arthur = mkActor('arthur', 'Male', { charisma: 90, physicalPerformance: 70 });
  const ariadne = mkActor('ariadne', 'Female', { emotionalPerformance: 88, charisma: 80 });
  const eames = mkActor('eames', 'Male', { comedy: 85, charisma: 75 });
  const fischer = mkActor('fischer', 'Male', { emotionalPerformance: 70 });
  const mal = mkActor('mal', 'Female', { characterTransformation: 85, emotionalPerformance: 92 });

  const bound = (person: Person, role: ProductionRole, name: string): TalentAssignment => ({ role, person, characterId: characterId(name) });

  // In cast order: leads [Dom Cobb, Arthur], supporting [Ariadne, Eames, Fischer, Mal].
  const inOrderBound: TalentAssignment[] = [
    bound(cobb, 'Lead Actor', 'Dom Cobb'),
    bound(arthur, 'Lead Actor', 'Arthur'),
    bound(ariadne, 'Supporting Actor', 'Ariadne'),
    bound(eames, 'Supporting Actor', 'Eames'),
    bound(fischer, 'Supporting Actor', 'Robert Fischer'),
    bound(mal, 'Supporting Actor', 'Mal'),
  ];
  // Same people, same bindings, shuffled array order within each role group.
  const shuffledBound: TalentAssignment[] = [
    bound(arthur, 'Lead Actor', 'Arthur'),
    bound(cobb, 'Lead Actor', 'Dom Cobb'),
    bound(mal, 'Supporting Actor', 'Mal'),
    bound(fischer, 'Supporting Actor', 'Robert Fischer'),
    bound(ariadne, 'Supporting Actor', 'Ariadne'),
    bound(eames, 'Supporting Actor', 'Eames'),
  ];
  // The legacy shape: the in-order cast with NO characterId at all.
  const inOrderUnbound: TalentAssignment[] = inOrderBound.map(({ role, person }) => ({ role, person }));

  it('is independent of array order once bound (the whole point of the feature)', () => {
    expect(computeActingScore(shuffledBound, script)).toBeCloseTo(computeActingScore(inOrderBound, script), 10);
  });

  it('matches the legacy positional result exactly for an in-order cast (fallback parity)', () => {
    // Binding an in-order cast changes nothing: characterId resolves to the
    // same Character the position would have. This is what keeps every
    // pre-existing scoring/box-office test green.
    expect(computeActingScore(inOrderBound, script)).toBe(computeActingScore(inOrderUnbound, script));
  });
});

describe('slot-bound casting — isCharacterCast', () => {
  it('reports a Character cast by its binding regardless of hire order', () => {
    // Cast only Mal (the LAST supporting slot). Binding-based: Mal is cast,
    // Ariadne (the first slot) is not - the inverse of the old positional read,
    // where one supporting hire would have marked slot 0 (Ariadne) as filled.
    const s = studioReducer(stateWithInceptionDraft(), { type: 'TOGGLE_TALENT_FOR_ROLE', role: 'Supporting Actor', person: mkActor('mal', 'Female'), characterId: characterId('Mal') });
    const draft = draftOf(s);
    const mal = script.cast.find((c) => c.name === 'Mal')!;
    const ariadne = script.cast.find((c) => c.name === 'Ariadne')!;
    expect(isCharacterCast(draft, mal, 'Supporting Actor')).toBe(true);
    expect(isCharacterCast(draft, ariadne, 'Supporting Actor')).toBe(false);
  });
});
