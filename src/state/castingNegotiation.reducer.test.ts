// Casting Redesign, Phase E - the reducer wiring for negotiation
// (MAKE_OFFER / ACCEPT_COUNTER / WALK_AWAY_NEGOTIATION) and the negotiated-fee
// money path (TalentAssignment.agreedSalary flowing through computeTalentCost).
import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildReadyAsset } from './testFixtures';
import { createInitialStudio, type GameState } from './gameState';
import { withRng } from '../engine/random';
import { generateTalentPool } from '../engine/talentGenerator';
import { findProject, asPlayerDraft } from '../engine/project';
import { computeTalentCost } from '../engine/cost';
import type { ActingStyle, Person, RoleNegotiation, ScriptCharacter } from '../types';

function buildActor(
  id: string,
  gender: 'Male' | 'Female',
  opts: { min?: number; typical?: number; personality?: Partial<Person['personality']>; reputation?: Partial<Person['reputation']>; actingStyle?: Partial<ActingStyle> } = {},
): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [], gender, dateOfBirth: undefined },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50, ...opts.personality },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50, ...opts.reputation },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Actor',
    careers: {
      actor: {
        role: 'Actor', active: true, experience: 50, roleReputation: 50,
        minimumSalary: opts.min ?? 200_000, typicalSalary: opts.typical ?? 1_000_000,
        actingStyle: { characterTransformation: 70, emotionalPerformance: 70, charisma: 70, comedy: 70, physicalPerformance: 70, ...opts.actingStyle },
      },
    },
  };
}

/** A workspace state with a focused, uncast draft; studio brand/prestige boosted so an obviously generous offer reliably clears the acceptance bar. Returns the first Lead character too. */
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

function draftOf(s: GameState) {
  return asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;
}

function withNegotiations(s: GameState, negotiations: RoleNegotiation[]): GameState {
  return {
    ...s,
    projects: s.projects.map((p) =>
      p.kind === 'player-in-progress' && p.draft.id === s.focusedProjectId ? { ...p, draft: { ...p.draft, negotiations } } : p,
    ),
  };
}

describe('MAKE_OFFER', () => {
  it('a clearly generous offer signs the actor at that fee, and it is the fee charged (not typicalSalary)', () => {
    const { state, lead } = uncastState(11);
    const actor = buildActor('rich-offer', matchingGender(lead), { typical: 1_000_000, personality: { ego: 10, ambition: 10 }, reputation: { fame: 10, currentHeat: 10 } });
    const after = studioReducer(state, { type: 'MAKE_OFFER', characterId: lead.id, role: 'Lead Actor', person: actor, offeredSalary: 20_000_000 });

    const draft = draftOf(after);
    const hire = draft.talent.find((a) => a.person.id === actor.id);
    expect(hire).toBeDefined();
    expect(hire!.agreedSalary).toBe(20_000_000);
    expect(hire!.characterId).toBe(lead.id);
    // The negotiated fee, not the $1M typical, is what the cost sum charges.
    expect(computeTalentCost(draft.talent)).toBeGreaterThanOrEqual(20_000_000);
    // Negotiation record is cleared once signed.
    expect((draft.negotiations ?? []).some((n) => n.personId === actor.id)).toBe(false);
  });

  it('is deterministic and reproducible for a given seed', () => {
    const { state, lead } = uncastState(12);
    const actor = buildActor('repro', matchingGender(lead), { typical: 8_000_000, personality: { ego: 90, ambition: 90 }, reputation: { fame: 90, currentHeat: 90 } });
    const offer = { type: 'MAKE_OFFER', characterId: lead.id, role: 'Lead Actor', person: actor, offeredSalary: 1_000_000 } as const;
    const a = studioReducer(state, offer);
    const b = studioReducer(state, offer);
    expect(draftOf(a).negotiations).toEqual(draftOf(b).negotiations);
    expect(draftOf(a).talent).toEqual(draftOf(b).talent);
  });

  it('a non-accepted offer persists a negotiation whose asking price is stable across re-offers (and consumes the RNG only once)', () => {
    const { state, lead } = uncastState(13);
    // A pricey, selective star + an insulting lowball -> not accepted, so a record is stored.
    const actor = buildActor('lowballed', matchingGender(lead), { min: 5_000_000, typical: 15_000_000, personality: { ego: 95, ambition: 95 }, reputation: { fame: 95, currentHeat: 95 } });
    const offer = { type: 'MAKE_OFFER', characterId: lead.id, role: 'Lead Actor', person: actor, offeredSalary: 1 } as const;

    const first = studioReducer(state, offer);
    const rec1 = (draftOf(first).negotiations ?? []).find((n) => n.personId === actor.id);
    expect(rec1).toBeDefined();
    expect(rec1!.askingPrice).toBeGreaterThan(0);
    expect(draftOf(first).talent.some((a) => a.person.id === actor.id)).toBe(false); // not signed

    const second = studioReducer(first, offer);
    const rec2 = (draftOf(second).negotiations ?? []).find((n) => n.personId === actor.id);
    expect(rec2!.askingPrice).toBe(rec1!.askingPrice); // stable target to negotiate against
    expect(second.rngSeed).toBe(first.rngSeed); // reusing an open negotiation rolls nothing new
  });
});

describe('ACCEPT_COUNTER', () => {
  it('signs the actor at the counter figure and clears the negotiation', () => {
    const { state, lead } = uncastState(14);
    const actor = buildActor('counter-accept', matchingGender(lead), { typical: 4_000_000 });
    const negotiation: RoleNegotiation = {
      characterId: lead.id, personId: actor.id, role: 'Lead Actor',
      askingPrice: 3_000_000, lastOfferedSalary: 1_000_000, status: 'countered', counterSalary: 2_500_000,
    };
    const seeded = withNegotiations(state, [negotiation]);

    const after = studioReducer(seeded, { type: 'ACCEPT_COUNTER', characterId: lead.id, person: actor });
    const draft = draftOf(after);
    const hire = draft.talent.find((a) => a.person.id === actor.id);
    expect(hire?.agreedSalary).toBe(2_500_000);
    expect(hire?.characterId).toBe(lead.id);
    expect(draft.negotiations ?? []).toHaveLength(0);
  });

  it('is a no-op with no standing counter for the pair', () => {
    const { state, lead } = uncastState(15);
    const actor = buildActor('no-counter', matchingGender(lead));
    const after = studioReducer(state, { type: 'ACCEPT_COUNTER', characterId: lead.id, person: actor });
    expect(after).toBe(state);
  });
});

describe('WALK_AWAY_NEGOTIATION', () => {
  it('drops the negotiation record', () => {
    const { state, lead } = uncastState(16);
    const actor = buildActor('walk', matchingGender(lead));
    const negotiation: RoleNegotiation = {
      characterId: lead.id, personId: actor.id, role: 'Lead Actor',
      askingPrice: 3_000_000, lastOfferedSalary: 1_000_000, status: 'countered', counterSalary: 2_500_000,
    };
    const seeded = withNegotiations(state, [negotiation]);
    const after = studioReducer(seeded, { type: 'WALK_AWAY_NEGOTIATION', characterId: lead.id, personId: actor.id });
    expect(draftOf(after).negotiations ?? []).toHaveLength(0);
  });

  it('is a no-op when there is nothing to walk away from', () => {
    const { state, lead } = uncastState(17);
    const after = studioReducer(state, { type: 'WALK_AWAY_NEGOTIATION', characterId: lead.id, personId: 'nobody' });
    expect(after).toBe(state);
  });
});

describe('TOGGLE_SHORTLIST', () => {
  it('adds a candidate to the character shortlist, and removes them when toggled again', () => {
    const { state, lead } = uncastState(20);
    const actor = buildActor('short-1', matchingGender(lead));

    const added = studioReducer(state, { type: 'TOGGLE_SHORTLIST', characterId: lead.id, role: 'Lead Actor', personId: actor.id });
    expect((draftOf(added).shortlist ?? []).some((s) => s.characterId === lead.id && s.personId === actor.id)).toBe(true);

    const removed = studioReducer(added, { type: 'TOGGLE_SHORTLIST', characterId: lead.id, role: 'Lead Actor', personId: actor.id });
    expect((draftOf(removed).shortlist ?? []).some((s) => s.personId === actor.id)).toBe(false);
  });

  it('holds several candidates for one character at once (parallel backups)', () => {
    const { state, lead } = uncastState(21);
    const a = buildActor('short-a', matchingGender(lead));
    const b = buildActor('short-b', matchingGender(lead));
    let s = studioReducer(state, { type: 'TOGGLE_SHORTLIST', characterId: lead.id, role: 'Lead Actor', personId: a.id });
    s = studioReducer(s, { type: 'TOGGLE_SHORTLIST', characterId: lead.id, role: 'Lead Actor', personId: b.id });
    const ids = (draftOf(s).shortlist ?? []).filter((e) => e.characterId === lead.id).map((e) => e.personId);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });

  it('signing one candidate leaves the others on the shortlist as backups', () => {
    const { state, lead } = uncastState(22);
    const signed = buildActor('signed', matchingGender(lead), { typical: 1_000_000, personality: { ego: 10, ambition: 10 }, reputation: { fame: 10, currentHeat: 10 } });
    const backup = buildActor('backup', matchingGender(lead));
    let s = studioReducer(state, { type: 'TOGGLE_SHORTLIST', characterId: lead.id, role: 'Lead Actor', personId: signed.id });
    s = studioReducer(s, { type: 'TOGGLE_SHORTLIST', characterId: lead.id, role: 'Lead Actor', personId: backup.id });
    // Sign `signed` with a generous offer.
    s = studioReducer(s, { type: 'MAKE_OFFER', characterId: lead.id, role: 'Lead Actor', person: signed, offeredSalary: 20_000_000 });
    expect(draftOf(s).talent.some((a) => a.person.id === signed.id)).toBe(true); // signed
    // The backup is still shortlisted.
    expect((draftOf(s).shortlist ?? []).some((e) => e.personId === backup.id)).toBe(true);
  });
});

describe('REQUEST_AUDITION', () => {
  it('schedules a screen test with a completion day in the future, once', () => {
    const { state, lead } = uncastState(30);
    const actor = buildActor('audition-1', matchingGender(lead));
    const after = studioReducer(state, { type: 'REQUEST_AUDITION', characterId: lead.id, role: 'Lead Actor', personId: actor.id });
    const rec = (draftOf(after).auditions ?? []).find((a) => a.characterId === lead.id && a.personId === actor.id);
    expect(rec).toBeDefined();
    expect(rec!.readyOnDay).toBeGreaterThan(after.totalDays);
    expect(rec!.requestedOnDay).toBe(after.totalDays);

    // Re-requesting the same pair is a no-op (you don't audition someone twice).
    const again = studioReducer(after, { type: 'REQUEST_AUDITION', characterId: lead.id, role: 'Lead Actor', personId: actor.id });
    expect((draftOf(again).auditions ?? []).filter((a) => a.personId === actor.id)).toHaveLength(1);
  });
});
