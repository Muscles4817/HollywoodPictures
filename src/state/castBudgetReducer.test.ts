// Reducer wiring for the master Target Cast & Crew Budget dial and its
// per-role re-split (engine/castBudget.ts). The split math itself is unit-tested
// in engine/castBudget.test.ts; these tests cover the state plumbing:
//   - SET_TALENT_BUDGET_SPLIT stores the budget on the draft and seeds targets
//     by importance (lead > editor), not evenly.
//   - a hire made above its suggested target shrinks the pot, so a still-open
//     role's target drops on the very next hire - the "next dial accounts for
//     what you already spent" behaviour.
//   - with no master budget set, hiring leaves the per-role dials alone.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { createInitialStudio, createDraftFromAsset, type GameState } from './gameState';
import { withRng } from '../engine/random';
import { generateTalentPool } from '../engine/talentGenerator';
import { playerDraftToProject, findProject, asPlayerDraft } from '../engine/project';
import { conformActorGenderToSlot } from './testFixtures';
import { TEST_SCRIPT_ASSETS } from '../data/testScripts';
import type { Person } from '../types';

const inceptionAsset = TEST_SCRIPT_ASSETS.find((a) => a.script.id === 'test-script-inception')!;
const script = inceptionAsset.script;

function pricedActor(id: string, typicalSalary: number): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [], gender: 'Female', dateOfBirth: { year: -35, month: 1, day: 1 } },
    personality: { professionalism: 60, ambition: 50, loyalty: 50, ego: 40, temperament: 50, pressureHandling: 50, controversy: 20, adaptability: 50 },
    reputation: { fame: 60, prestige: 55, industryRespect: 60, reliability: 70, currentHeat: 55 },
    primaryRole: 'Actor',
    careers: {
      actor: {
        role: 'Actor', active: true, experience: 50, roleReputation: 55, minimumSalary: typicalSalary, typicalSalary,
        actingStyle: { characterTransformation: 60, emotionalPerformance: 60, charisma: 60, comedy: 40, physicalPerformance: 50 },
      },
    },
    availability: { commitments: [] },
    traits: [],
  };
}

function focusedState(): GameState {
  const draft = createDraftFromAsset(inceptionAsset, {}, 1);
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
    collaborations: [],
    awards: { history: [], season: null, nextSeasonDay: 366 },
    bidNotifications: [],
    viewingRivalStudioName: null,
    viewingProductionId: null,
  } as GameState;
}

const targetsOf = (s: GameState) => asPlayerDraft(findProject(s.projects, s.focusedProjectId))!.talentTargetPriceByRole;

describe('SET_TALENT_BUDGET_SPLIT (reducer)', () => {
  it('stores the master budget on the draft and seeds targets by importance', () => {
    const after = studioReducer(focusedState(), { type: 'SET_TALENT_BUDGET_SPLIT', totalBudget: 12_000_000 });
    const draft = asPlayerDraft(findProject(after.projects, after.focusedProjectId))!;
    expect(draft.castCrewBudget).toBe(12_000_000);
    expect(draft.talentTargetPriceByRole['Lead Actor']!).toBeGreaterThan(draft.talentTargetPriceByRole['Editor']!);
  });

  it('retargets the roles left over after a hire made above its suggested slice', () => {
    let s = focusedState();
    s = studioReducer(s, { type: 'SET_TALENT_BUDGET_SPLIT', totalBudget: 12_000_000 });
    const suggestedLead = targetsOf(s)['Lead Actor']!;
    const editorBefore = targetsOf(s)['Editor']!;

    // Cast a lead for well above what the dial suggested.
    const leadCharacterId = script.cast.find((c) => c.prominence === 'Lead')!.id;
    const bigStar = conformActorGenderToSlot(pricedActor('big-star', suggestedLead + 4_000_000), script, 'Lead Actor', 0);
    s = studioReducer(s, { type: 'TOGGLE_TALENT_FOR_ROLE', role: 'Lead Actor', person: bigStar, characterId: leadCharacterId });

    // The overspend comes out of the shared pot, so the still-open editor slot
    // is now targeted lower than before.
    expect(targetsOf(s)['Editor']!).toBeLessThan(editorBefore);
  });

  it('leaves per-role dials untouched on hire when no master budget was ever set', () => {
    let s = focusedState();
    const editorBefore = targetsOf(s)['Editor']!;
    const leadCharacterId = script.cast.find((c) => c.prominence === 'Lead')!.id;
    const star = conformActorGenderToSlot(pricedActor('star', 3_000_000), script, 'Lead Actor', 0);
    s = studioReducer(s, { type: 'TOGGLE_TALENT_FOR_ROLE', role: 'Lead Actor', person: star, characterId: leadCharacterId });
    expect(targetsOf(s)['Editor']!).toBe(editorBefore);
  });
});

describe('DISMISS_BID_NOTIFICATION / DISMISS_ALL_BID_NOTIFICATIONS (reducer)', () => {
  const withNotes = (): GameState => ({
    ...focusedState(),
    bidNotifications: [
      { id: 'a', kind: 'won', opportunityId: 'x', scriptTitle: 'X', amount: 1, day: 1, read: true },
      { id: 'b', kind: 'lost', opportunityId: 'y', scriptTitle: 'Y', amount: 2, day: 2, read: true },
    ],
  });

  it('removes a single notification by id', () => {
    const after = studioReducer(withNotes(), { type: 'DISMISS_BID_NOTIFICATION', id: 'a' });
    expect((after.bidNotifications ?? []).map((n) => n.id)).toEqual(['b']);
  });

  it('no-ops (same state) when the id is not present', () => {
    const s = withNotes();
    expect(studioReducer(s, { type: 'DISMISS_BID_NOTIFICATION', id: 'nope' })).toBe(s);
  });

  it('clears the whole store', () => {
    const after = studioReducer(withNotes(), { type: 'DISMISS_ALL_BID_NOTIFICATIONS' });
    expect(after.bidNotifications).toEqual([]);
  });
});
