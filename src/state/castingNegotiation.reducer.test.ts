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
import type { ActingStyle, Person, RoleNegotiation, ScriptCharacter, TalentAssignment } from '../types';

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

function withDraftTalent(s: GameState, talent: TalentAssignment[]): GameState {
  return {
    ...s,
    projects: s.projects.map((p) =>
      p.kind === 'player-in-progress' && p.draft.id === s.focusedProjectId ? { ...p, draft: { ...p.draft, talent } } : p,
    ),
  };
}

function castingDirector(id: string, skill: number): Person {
  return {
    id,
    identity: { name: id, appearanceTags: [], gender: 'Female', dateOfBirth: undefined },
    personality: { professionalism: 50, ambition: 50, loyalty: 50, ego: 50, temperament: 50, pressureHandling: 50, controversy: 50, adaptability: 50 },
    reputation: { fame: 50, prestige: 50, industryRespect: 50, reliability: 50, currentHeat: 50 },
    availability: { commitments: [] },
    traits: [],
    primaryRole: 'Casting Director',
    careers: {
      castingDirector: { role: 'Casting Director', active: true, experience: 50, roleReputation: 50, minimumSalary: 50_000, typicalSalary: 200_000, skill },
    },
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

describe('casting director benefit is captured at cast time (greenlight-locked)', () => {
  it('a hired CD gets the actor to quote a lower asking price for the same deal', () => {
    // Same actor, same seed - so the asking-price wobble is identical - and the
    // only difference is whether a skilled casting director is attached. A
    // below-ask offer draws a negotiation whose stored askingPrice we can read.
    const build = () => {
      const { state, lead } = uncastState(55);
      const actor = buildActor('cd-vs-nocd', matchingGender(lead), { min: 2_000_000, typical: 6_000_000, personality: { ego: 40, ambition: 40 }, reputation: { fame: 40, currentHeat: 40 } });
      return { state, lead, actor };
    };
    const offer = 2_500_000;

    const noCd = build();
    const noCdAfter = studioReducer(noCd.state, { type: 'MAKE_OFFER', characterId: noCd.lead.id, role: 'Lead Actor', person: noCd.actor, offeredSalary: offer });
    const noCdAsk = (draftOf(noCdAfter).negotiations ?? []).find((n) => n.personId === noCd.actor.id)!.askingPrice;

    const withCd = build();
    const cdState = withDraftTalent(withCd.state, [{ role: 'Casting Director', person: castingDirector('cd-x', 100) }]);
    const cdAfter = studioReducer(cdState, { type: 'MAKE_OFFER', characterId: withCd.lead.id, role: 'Lead Actor', person: withCd.actor, offeredSalary: offer });
    const cdAsk = (draftOf(cdAfter).negotiations ?? []).find((n) => n.personId === withCd.actor.id)!.askingPrice;

    expect(cdAsk).toBeLessThan(noCdAsk);
  });

  it('locks the signed fee at cast time: removing the CD before greenlight does not change it', () => {
    const { state, lead } = uncastState(56);
    const actor = buildActor('cd-locked', matchingGender(lead), { min: 2_000_000, typical: 6_000_000 });
    const cd = castingDirector('cd-remove', 100);
    const cdState = withDraftTalent(state, [{ role: 'Casting Director', person: cd }]);

    // Sign at a clearly-generous fee so acceptance is certain.
    const signed = studioReducer(cdState, { type: 'MAKE_OFFER', characterId: lead.id, role: 'Lead Actor', person: actor, offeredSalary: 6_000_000 });
    const lockedFee = draftOf(signed).talent.find((a) => a.person.id === actor.id)!.agreedSalary!;
    expect(lockedFee).toBe(6_000_000);

    // Remove the casting director, as the feared exploit would - the signed fee
    // is stored on the assignment, so it is unchanged, and the greenlight cost
    // tally (computeTalentCost sums agreedSalary) cannot be recomputed cheaper.
    const cdRemoved = withDraftTalent(signed, draftOf(signed).talent.filter((a) => a.person.id !== cd.id));
    const feeAfter = draftOf(cdRemoved).talent.find((a) => a.person.id === actor.id)!.agreedSalary!;
    expect(feeAfter).toBe(lockedFee);
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

  it('auto-shortlists the auditionee so they can be found again', () => {
    const { state, lead } = uncastState(31);
    const actor = buildActor('audition-shortlist', matchingGender(lead));
    const after = studioReducer(state, { type: 'REQUEST_AUDITION', characterId: lead.id, role: 'Lead Actor', personId: actor.id });
    expect((draftOf(after).shortlist ?? []).some((s) => s.characterId === lead.id && s.personId === actor.id)).toBe(true);
  });
});

describe('ACKNOWLEDGE_AUDITIONS', () => {
  function atDay(s: GameState, day: number): GameState {
    return { ...s, totalDays: day };
  }

  it('marks a ready audition acknowledged but leaves a still-pending one alone', () => {
    const { state, lead } = uncastState(32);
    const actor = buildActor('ack', matchingGender(lead));
    const requested = studioReducer(state, { type: 'REQUEST_AUDITION', characterId: lead.id, role: 'Lead Actor', personId: actor.id });
    const readyOnDay = (draftOf(requested).auditions ?? [])[0].readyOnDay;

    // Before it completes, acknowledging does nothing (no-op -> same reference).
    const early = studioReducer(requested, { type: 'ACKNOWLEDGE_AUDITIONS' });
    expect(early).toBe(requested);

    // Once the clock passes readyOnDay, acknowledging marks it seen.
    const later = atDay(requested, readyOnDay + 1);
    const acked = studioReducer(later, { type: 'ACKNOWLEDGE_AUDITIONS', characterId: lead.id });
    expect((draftOf(acked).auditions ?? [])[0].acknowledged).toBe(true);

    // And a second acknowledge is a no-op.
    expect(studioReducer(acked, { type: 'ACKNOWLEDGE_AUDITIONS', characterId: lead.id })).toBe(acked);
  });
});

describe('SET_SHOOT_DELAY', () => {
  it('pushes the planned shoot start, clamps negatives to zero, and no-ops when unchanged', () => {
    const { state } = uncastState(40);
    const delayed = studioReducer(state, { type: 'SET_SHOOT_DELAY', offsetDays: 30 });
    expect(draftOf(delayed).plannedStartOffsetDays).toBe(30);

    // From a delayed state, a negative offset clamps back to 0.
    const clamped = studioReducer(delayed, { type: 'SET_SHOOT_DELAY', offsetDays: -5 });
    expect(draftOf(clamped).plannedStartOffsetDays).toBe(0);

    const again = studioReducer(delayed, { type: 'SET_SHOOT_DELAY', offsetDays: 30 });
    expect(again).toBe(delayed); // unchanged -> same reference
  });
});
