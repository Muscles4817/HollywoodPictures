// Backend participation reducer wiring: ACCEPT_BACKEND_OFFER signs a bankable
// star to a structured deal (reduced guarantee + points), stamping the deal onto
// the assignment. See engine/backend.ts.
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildReadyAsset } from './testFixtures';
import { createInitialStudio, type GameState } from './gameState';
import { withRng } from '../engine/random';
import { generateTalentPool } from '../engine/talentGenerator';
import { findProject, asPlayerDraft } from '../engine/project';
import { deriveBackendOffers } from '../engine/backend';
import type { Person, ScriptCharacter } from '../types';

function buildStar(id: string, gender: 'Male' | 'Female'): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [], gender, dateOfBirth: undefined },
    personality: { professionalism: 50, ambition: 60, loyalty: 50, ego: 70, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 88, prestige: 70, industryRespect: 70, reliability: 60, currentHeat: 75 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {
      actor: {
        role: 'Actor', active: true, experience: 70, roleReputation: 70,
        minimumSalary: 2_000_000, typicalSalary: 20_000_000,
        actingStyle: { characterTransformation: 75, emotionalPerformance: 75, charisma: 80, comedy: 70, physicalPerformance: 75 },
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
  } as unknown as GameState;
  s = studioReducer(s, { type: 'CREATE_PROJECT_FROM_ASSET', assetId: result.asset.id });
  const script = asPlayerDraft(findProject(s.projects, s.focusedProjectId))!.script!;
  const lead = script.cast.find((c) => c.prominence === 'Lead')!;
  return { state: s, lead };
}

describe('ACCEPT_BACKEND_OFFER', () => {
  it('signs the star at the reduced guarantee and stamps the backend deal, charging nothing yet', () => {
    const { state, lead } = uncastState(7);
    const gender = lead.castingGender === 'Female' ? 'Female' : 'Male';
    const star = buildStar('Nova Sterling', gender);
    const offers = deriveBackendOffers(star, 20_000_000);
    expect(offers.length).toBeGreaterThan(0);
    const grossOffer = offers[0];

    const cashBefore = state.studio.cash;
    const after = studioReducer(state, { type: 'ACCEPT_BACKEND_OFFER', characterId: lead.id, role: 'Lead Actor', person: star, offer: grossOffer });

    const draft = asPlayerDraft(findProject(after.projects, after.focusedProjectId))!;
    const hire = draft.talent.find((a) => a.person.id === 'Nova Sterling');
    expect(hire).toBeDefined();
    expect(hire!.agreedSalary).toBe(grossOffer.guaranteedFee);
    expect(hire!.backendDeal?.points).toBe(grossOffer.points);
    expect(hire!.backendDeal?.base).toBe('studioGross');
    expect(hire!.backendDeal?.personName).toBe('Nova Sterling');
    // Nothing is charged at signing - the guarantee is charged at greenlight.
    expect(after.studio.cash).toBe(cashBefore);
  });
});
