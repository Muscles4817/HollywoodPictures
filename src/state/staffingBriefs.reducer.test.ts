import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft, conformActorGenderToSlot } from './testFixtures';
import type { GameState } from './gameState';
import { asPlayerDraft, findProject, deriveInboxItems, inboxBadgeCount } from '../engine/project';
import { getTypicalSalaryForRole } from '../engine/person';
import { effectiveRoleCapacity } from '../engine/castRequirements';
import { deriveProjectReadiness } from '../engine/projectReadiness';
import { professionForProductionRole } from '../data/helpers';
import { MANDATORY_TALENT_ROLES } from '../data/talentGeneration';
import { MAX_BRIEFS_PER_ROLE } from '../data/producers';
import type { FilmDraft, Person, ProducerSpecialty, ProductionRole, StaffingBrief } from '../types';

const ROLE: ProductionRole = 'Cinematographer';
const ALLOCATION = 5_000_000;

let idCounter = 0;
function makeProducer(specialty: ProducerSpecialty = 'Line'): Person {
  return {
    id: `producer-${idCounter++}`,
    identity: { name: 'Marcus Reed', appearanceTags: [] },
    personality: { professionalism: 60, ambition: 55, loyalty: 50, ego: 30, temperament: 50, pressureHandling: 55, controversy: 18, adaptability: 55 },
    reputation: { fame: 40, prestige: 40, industryRespect: 60, reliability: 100, currentHeat: 40 },
    primaryRole: 'Producer',
    careers: { producer: { specialty, skill: 70, genreAffinity: [], typicalSalary: 300_000 } },
    availability: { commitments: [] },
    traits: [],
  };
}

/** A focused, pre-greenlight draft with an empty Cinematographer slot and an attached Line Producer. */
function stateWithAttachedProducer(seed = 5, specialty: ProducerSpecialty = 'Line') {
  const producer = makeProducer(specialty);
  const base = buildStateWithReadyDraft(seed);
  const ready = asPlayerDraft(findProject(base.projects, base.focusedProjectId))!;
  const draft: FilmDraft = {
    ...ready,
    photography: null,
    greenlitOnDay: null,
    talent: ready.talent.filter((a) => a.role !== ROLE),
    attachedProducerIds: [producer.id],
    talentTargetPriceByRole: { ...ready.talentTargetPriceByRole, [ROLE]: ALLOCATION },
  };
  const state: GameState = {
    ...base,
    producerPool: [producer],
    studio: { ...base.studio, productionOffice: { tier: 3, benchProducerIds: [producer.id] } },
    projects: base.projects.map((p) => ('draft' in p && p.draft.id === draft.id ? { ...p, draft } : p)),
  };
  return { state, producer };
}

const focused = (s: GameState): FilmDraft => asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;
const briefs = (s: GameState): StaffingBrief[] => focused(s).staffingBriefs ?? [];

function issue(s: GameState, producerId: string, role: ProductionRole = ROLE): GameState {
  return studioReducer(s, { type: 'ISSUE_STAFFING_BRIEF', role, producerId, allocation: ALLOCATION });
}

/** Advance until every live brief has come back (they are all due within a few weeks). */
function advanceUntilReturned(s: GameState, maxDays = 60): GameState {
  let next = s;
  for (let i = 0; i < maxDays; i++) {
    if (briefs(next).some((b) => b.status === 'returned')) return next;
    next = studioReducer(next, { type: 'ADVANCE_DAY' });
  }
  return next;
}

describe('ISSUE_STAFFING_BRIEF', () => {
  it('sends the producer out and logs it', () => {
    const { state, producer } = stateWithAttachedProducer();
    const after = issue(state, producer.id);
    expect(briefs(after)).toHaveLength(1);
    expect(briefs(after)[0]).toMatchObject({ role: ROLE, producerId: producer.id, allocation: ALLOCATION, status: 'out', briefsUsed: 1 });
    expect(focused(after).staffingLog?.some((e) => e.kind === 'brief' && e.subject === ROLE)).toBe(true);
  });

  it('advances the rng seed - the return day is rolled here, once', () => {
    const { state, producer } = stateWithAttachedProducer();
    expect(issue(state, producer.id).rngSeed).not.toBe(state.rngSeed);
  });

  it('no-ops for a Creative Producer - crew briefs are a Line Producer job', () => {
    const { state, producer } = stateWithAttachedProducer(5, 'Creative');
    expect(briefs(issue(state, producer.id))).toHaveLength(0);
  });

  it('no-ops for a role that is not delegable', () => {
    const { state, producer } = stateWithAttachedProducer();
    expect(briefs(issue(state, producer.id, 'Director'))).toHaveLength(0);
  });

  it('no-ops while a brief on that role is already out', () => {
    const { state, producer } = stateWithAttachedProducer();
    const once = issue(state, producer.id);
    expect(briefs(issue(once, producer.id))).toHaveLength(1);
  });
});

describe('the daily tick', () => {
  it('brings the producer back on ADVANCE_DAY, with a name', () => {
    const { state, producer } = stateWithAttachedProducer();
    const returned = advanceUntilReturned(issue(state, producer.id));
    const brief = briefs(returned)[0];
    expect(brief.status).toBe('returned');
    expect(brief.candidate?.personId).toBeTruthy();
    expect(brief.candidate!.fee).toBeLessThanOrEqual(ALLOCATION);
  });

  it('keeps running for a backgrounded project the player has left', () => {
    const { state, producer } = stateWithAttachedProducer();
    const out = issue(state, producer.id);
    // Leaving the workspace must not freeze the search - the same promise
    // casting calls and backgrounded shoots already make.
    const backgrounded: GameState = { ...out, focusedProjectId: null };
    let s = backgrounded;
    for (let i = 0; i < 60; i++) {
      const draft = s.projects.map((p) => asPlayerDraft(p)).find((d) => d?.staffingBriefs?.length);
      if (draft?.staffingBriefs?.[0].status === 'returned') break;
      s = studioReducer(s, { type: 'ADVANCE_DAY' });
    }
    const draft = s.projects.map((p) => asPlayerDraft(p)).find((d) => d?.staffingBriefs?.length);
    expect(draft?.staffingBriefs?.[0].status).toBe('returned');
  });

  it('surfaces the returned brief in the Inbox and its badge', () => {
    const { state, producer } = stateWithAttachedProducer();
    const returned = advanceUntilReturned(issue(state, producer.id));
    // The Inbox deliberately excludes the focused project (its own screen shows
    // it), so read it as the player would from the Dashboard.
    const away: GameState = { ...returned, focusedProjectId: null };
    const items = deriveInboxItems(away.projects, null, away.totalDays);
    expect(items.briefsReturned).toHaveLength(1);
    expect(items.briefsReturned[0].briefs[0].status).toBe('returned');
    expect(inboxBadgeCount(away.projects, null, away.totalDays)).toBeGreaterThan(0);
  });
});

describe('ACCEPT_BRIEF_CANDIDATE', () => {
  it('hires their pick at the fee they negotiated', () => {
    const { state, producer } = stateWithAttachedProducer();
    const returned = advanceUntilReturned(issue(state, producer.id));
    const brief = briefs(returned)[0];
    const after = studioReducer(returned, { type: 'ACCEPT_BRIEF_CANDIDATE', briefId: brief.id });

    const hire = focused(after).talent.find((a) => a.role === ROLE);
    expect(hire).toBeDefined();
    expect(hire!.person.id).toBe(brief.candidate!.personId);
    // The negotiated price is what the studio pays - agreedSalary is what
    // engine/person.ts:assignmentCost and the Greenlight charge both read.
    expect(hire!.agreedSalary).toBe(brief.candidate!.fee);
    expect(briefs(after)[0].status).toBe('accepted');
    expect(focused(after).staffingLog?.some((e) => e.kind === 'attached' && e.subject === ROLE)).toBe(true);
  });

  it('can come in under the standing fee - the concrete thing delegation buys', () => {
    const { state, producer } = stateWithAttachedProducer();
    const returned = advanceUntilReturned(issue(state, producer.id));
    const brief = briefs(returned)[0];
    const person = returned.talentPool[professionForProductionRole(ROLE)].find((p) => p.id === brief.candidate!.personId)!;
    expect(brief.candidate!.fee).toBeLessThan(getTypicalSalaryForRole(person, ROLE));
  });

  it('no-ops if the player filled the slot by hand while they were out', () => {
    const { state, producer } = stateWithAttachedProducer();
    const returned = advanceUntilReturned(issue(state, producer.id));
    const someoneElse = returned.talentPool.Cinematographer.find((p) => p.id !== briefs(returned)[0].candidate!.personId)!;
    const filled = studioReducer(returned, { type: 'SET_TALENT_FOR_ROLE', role: ROLE, person: someoneElse });
    const after = studioReducer(filled, { type: 'ACCEPT_BRIEF_CANDIDATE', briefId: briefs(filled)[0].id });
    expect(focused(after).talent.find((a) => a.role === ROLE)!.person.id).toBe(someoneElse.id);
  });
});

describe('REJECT_BRIEF_CANDIDATE - vetoing is not a free reroll', () => {
  it('empties the slot again and spends the brief', () => {
    const { state, producer } = stateWithAttachedProducer();
    const returned = advanceUntilReturned(issue(state, producer.id));
    const after = studioReducer(returned, { type: 'REJECT_BRIEF_CANDIDATE', briefId: briefs(returned)[0].id });
    expect(briefs(after)[0].status).toBe('declined');
    expect(focused(after).talent.some((a) => a.role === ROLE)).toBe(false);
  });

  it('closes the slot to delegation once the cap is spent', () => {
    const { state, producer } = stateWithAttachedProducer();
    let s = state;
    for (let i = 0; i < MAX_BRIEFS_PER_ROLE; i++) {
      s = advanceUntilReturned(issue(s, producer.id));
      s = studioReducer(s, { type: 'REJECT_BRIEF_CANDIDATE', briefId: briefs(s).find((b) => b.status === 'returned')!.id });
    }
    expect(briefs(s)).toHaveLength(MAX_BRIEFS_PER_ROLE);
    // The producer will not take another brief on this slot...
    s = issue(s, producer.id);
    expect(briefs(s)).toHaveLength(MAX_BRIEFS_PER_ROLE);
    // ...but the role stays hand-hireable, forever.
    const byHand = studioReducer(s, { type: 'SET_TALENT_FOR_ROLE', role: ROLE, person: s.talentPool.Cinematographer[0] });
    expect(focused(byHand).talent.some((a) => a.role === ROLE)).toBe(true);
  });
});

describe('WITHDRAW_STAFFING_BRIEF', () => {
  it('pulls a live brief, and it still counts against the cap', () => {
    const { state, producer } = stateWithAttachedProducer();
    const out = issue(state, producer.id);
    const after = studioReducer(out, { type: 'WITHDRAW_STAFFING_BRIEF', briefId: briefs(out)[0].id });
    expect(briefs(after)[0].status).toBe('declined');
    expect(focused(after).staffingLog?.some((e) => e.note === 'brief withdrawn')).toBe(true);
  });
});

describe('a brief cannot outlive the attachment that authorised it', () => {
  it('DETACH_PRODUCER pulls their live briefs', () => {
    const { state, producer } = stateWithAttachedProducer();
    const out = issue(state, producer.id);
    const after = studioReducer(out, { type: 'DETACH_PRODUCER', producerId: producer.id });
    expect(briefs(after)[0].status).toBe('declined');
    expect(focused(after).attachedProducerIds).toEqual([]);
  });

  it('FIRE_PRODUCER pulls their live briefs everywhere', () => {
    const { state, producer } = stateWithAttachedProducer();
    const out = issue(state, producer.id);
    const after = studioReducer(out, { type: 'FIRE_PRODUCER', producerId: producer.id });
    expect(briefs(after)[0].status).toBe('declined');
    expect(after.studio.productionOffice!.benchProducerIds).toEqual([]);
  });

  it('GREENLIGHT_PROJECT pulls whatever is still out - the package freezes there', () => {
    const { state, producer } = stateWithAttachedProducer();
    // Staff the rest of the film so the readiness gate actually opens, leaving
    // the delegated slot deliberately empty (an optional-or-empty crew slot is
    // an already-modelled state, so it must not block the greenlight).
    let s = state;
    const script = focused(s).script!;
    for (const role of MANDATORY_TALENT_ROLES) {
      const needed = effectiveRoleCapacity(role, script).min;
      const already = focused(s).talent.filter((a) => a.role === role).length;
      for (let i = already; i < needed; i++) {
        const profession = professionForProductionRole(role);
        const taken = new Set(focused(s).talent.map((a) => a.person.id));
        const candidate = [...s.talentPool[profession]]
          .filter((p) => !taken.has(p.id))
          .sort((a, b) => getTypicalSalaryForRole(a, role) - getTypicalSalaryForRole(b, role))[0];
        s = studioReducer(s, { type: 'TOGGLE_TALENT_FOR_ROLE', role, person: conformActorGenderToSlot(candidate, script, role, i) });
      }
    }
    s = issue(s, producer.id, 'Production Designer'); // optional slot, so readiness stays open
    expect(briefs(s)[0].status).toBe('out');
    expect(deriveProjectReadiness(focused(s), s.studio.cash).ready).toBe(true);

    const greenlit = studioReducer(s, { type: 'GREENLIGHT_PROJECT' });
    expect(greenlit.screen).toBe('pre-production');
    expect(briefs(greenlit)[0].status).toBe('declined');
  });
});
