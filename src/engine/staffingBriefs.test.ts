import { describe, it, expect } from 'vitest';
import {
  briefsRemainingForRole,
  canDelegateRole,
  eligibleBriefCandidates,
  issueBrief,
  liveBriefForRole,
  producerCandidatePick,
  quoteBrief,
  tickStaffingBriefs,
  withdrawBriefs,
} from './staffingBriefs';
import { buildStateWithReadyDraft } from '../state/testFixtures';
import { asPlayerDraft, findProject } from './project';
import { getTypicalSalaryForRole } from './person';
import { createRng } from './random';
import { MAX_BRIEFS_PER_ROLE } from '../data/producers';
import type { FilmDraft, Person, ProducerSpecialty, StaffingBrief, Studio, TalentProfession } from '../types';

const ROLE = 'Cinematographer' as const;

let idCounter = 0;
function makeProducer(opts: { specialty?: ProducerSpecialty; skill?: number; reliability?: number; affinity?: FilmDraft['genre'][] } = {}): Person {
  return {
    id: `producer-${idCounter++}`,
    identity: { name: 'Marcus Reed', appearanceTags: [] },
    personality: { professionalism: 60, ambition: 55, loyalty: 50, ego: 30, temperament: 50, pressureHandling: 55, controversy: 18, adaptability: 55 },
    reputation: { fame: 40, prestige: 40, industryRespect: 60, reliability: opts.reliability ?? 100, currentHeat: 40 },
    primaryRole: 'Producer',
    careers: {
      producer: {
        specialty: opts.specialty ?? 'Line',
        skill: opts.skill ?? 60,
        genreAffinity: (opts.affinity ?? []).filter((g): g is NonNullable<FilmDraft['genre']> => g != null),
        typicalSalary: 300_000,
      },
    },
    availability: { commitments: [] },
    traits: [],
  };
}

const OPEN_OFFICE = (bench: string[]): Studio['productionOffice'] => ({ tier: 3, benchProducerIds: bench });

/**
 * A pre-greenlight draft with the Cinematographer slot empty and one attached
 * producer - the situation the whole mechanic is about.
 */
function fixture(opts: { producer?: Person; seed?: number } = {}) {
  const producer = opts.producer ?? makeProducer();
  const state = buildStateWithReadyDraft(opts.seed ?? 7);
  const ready = asPlayerDraft(findProject(state.projects, state.focusedProjectId))!;
  const draft: FilmDraft = {
    ...ready,
    photography: null,
    greenlitOnDay: null,
    talent: ready.talent.filter((a) => a.role !== ROLE),
    attachedProducerIds: [producer.id],
    talentTargetPriceByRole: { ...ready.talentTargetPriceByRole, [ROLE]: 5_000_000 },
  };
  const studio: Studio = { ...state.studio, productionOffice: OPEN_OFFICE([producer.id]) };
  return { draft, studio, producer, pool: [producer], talentPool: state.talentPool as Record<TalentProfession, Person[]>, today: state.totalDays };
}

function withBrief(draft: FilmDraft, brief: StaffingBrief): FilmDraft {
  return { ...draft, staffingBriefs: [...(draft.staffingBriefs ?? []), brief] };
}

describe('canDelegateRole', () => {
  it('lets an attached Line Producer take an empty crew slot', () => {
    const { draft, studio, pool, producer } = fixture();
    expect(canDelegateRole(draft, studio, pool, ROLE, producer.id)).toBe(true);
  });

  it('refuses while the Production Office is locked', () => {
    const { draft, studio, pool, producer } = fixture();
    expect(canDelegateRole(draft, { ...studio, productionOffice: null }, pool, ROLE, producer.id)).toBe(false);
  });

  it('refuses roles that are deliberately not delegable', () => {
    const { draft, studio, pool, producer } = fixture();
    for (const role of ['Director', 'Lead Actor', 'Writer', 'Casting Director'] as const) {
      expect(canDelegateRole(draft, studio, pool, role, producer.id)).toBe(false);
    }
  });

  it('refuses a producer who is not a Line Producer', () => {
    const creative = makeProducer({ specialty: 'Creative' });
    const { draft, studio } = fixture({ producer: creative });
    expect(canDelegateRole(draft, studio, [creative], ROLE, creative.id)).toBe(false);
  });

  it('refuses a producer who is on the bench but not attached to this film', () => {
    const { draft, studio, pool, producer } = fixture();
    expect(canDelegateRole({ ...draft, attachedProducerIds: [] }, studio, pool, ROLE, producer.id)).toBe(false);
  });

  it('refuses a slot that is already filled', () => {
    const { draft, studio, pool, producer, talentPool } = fixture();
    const filled = { ...draft, talent: [...draft.talent, { role: ROLE, person: talentPool.Cinematographer[0] }] };
    expect(canDelegateRole(filled, studio, pool, ROLE, producer.id)).toBe(false);
  });

  it('refuses a second brief while one is still out', () => {
    const { draft, studio, pool, producer, talentPool, today } = fixture();
    const rng = createRng(1);
    const out = withBrief(draft, issueBrief('b1', producer, ROLE, 5_000_000, draft, talentPool, today, rng));
    expect(liveBriefForRole(out, ROLE)).not.toBeNull();
    expect(canDelegateRole(out, studio, pool, ROLE, producer.id)).toBe(false);
  });
});

describe('the brief cap - vetoing is not a free reroll', () => {
  it('closes the slot to delegation after MAX_BRIEFS_PER_ROLE, however they ended', () => {
    const { draft, studio, pool, producer, talentPool, today } = fixture();
    const rng = createRng(2);
    let d = draft;
    for (let i = 0; i < MAX_BRIEFS_PER_ROLE; i++) {
      const brief = issueBrief(`b${i}`, producer, ROLE, 5_000_000, d, talentPool, today, rng);
      d = withBrief(d, { ...brief, status: 'declined' });
    }
    expect(briefsRemainingForRole(d, ROLE)).toBe(0);
    expect(canDelegateRole(d, studio, pool, ROLE, producer.id)).toBe(false);
  });

  it('counts a withdrawn brief too - withdraw-and-reissue is the same loophole', () => {
    const { draft, producer, talentPool, today } = fixture();
    const rng = createRng(3);
    const issued = withBrief(draft, issueBrief('b1', producer, ROLE, 5_000_000, draft, talentPool, today, rng));
    const pulled = withdrawBriefs(issued, () => true);
    expect(pulled.staffingBriefs![0].status).toBe('declined');
    expect(briefsRemainingForRole(pulled, ROLE)).toBe(MAX_BRIEFS_PER_ROLE - 1);
  });

  it('leaves other roles untouched', () => {
    const { draft, studio, pool, producer, talentPool, today } = fixture();
    const rng = createRng(4);
    let d = draft;
    for (let i = 0; i < MAX_BRIEFS_PER_ROLE; i++) {
      d = withBrief(d, { ...issueBrief(`b${i}`, producer, ROLE, 5_000_000, d, talentPool, today, rng), status: 'declined' });
    }
    expect(canDelegateRole(d, studio, pool, 'Editor', producer.id)).toBe(true);
  });
});

describe('issueBrief', () => {
  it('commits the schedule up front: a perfectly reliable producer is back exactly when they said', () => {
    const { draft, producer, talentPool, today } = fixture({ producer: makeProducer({ skill: 100, reliability: 100 }) });
    const brief = issueBrief('b1', producer, ROLE, 5_000_000, draft, talentPool, today, createRng(5));
    expect(brief.dueOnDay - brief.issuedOnDay).toBe(brief.estimatedDays);
  });

  it('an unreliable producer overruns the day they quoted', () => {
    const flaky = makeProducer({ skill: 60, reliability: 1 });
    const { draft, talentPool, today } = fixture({ producer: flaky });
    // rng() near 1 puts them at the top of their overrun band.
    const brief = issueBrief('b1', flaky, ROLE, 5_000_000, draft, talentPool, today, () => 0.99);
    expect(brief.dueOnDay - brief.issuedOnDay).toBeGreaterThan(brief.estimatedDays);
  });

  it('a low-skill producer quotes a rosier number than they can hold', () => {
    const { draft, talentPool, today } = fixture();
    const poor = makeProducer({ skill: 5, reliability: 100 });
    const good = makeProducer({ skill: 100, reliability: 100 });
    const poorBrief = issueBrief('b1', poor, ROLE, 5_000_000, draft, talentPool, today, createRng(6));
    const goodBrief = issueBrief('b2', good, ROLE, 5_000_000, draft, talentPool, today, createRng(6));
    // The poor producer's quote understates their own honest search length...
    expect(poorBrief.estimatedDays).toBeLessThan(poorBrief.dueOnDay - poorBrief.issuedOnDay);
    // ...while the good one's is exact, and shorter in absolute terms too.
    expect(goodBrief.estimatedDays).toBe(goodBrief.dueOnDay - goodBrief.issuedOnDay);
    expect(goodBrief.estimatedDays).toBeLessThan(poorBrief.estimatedDays);
  });

  it('numbers the brief against the cap', () => {
    const { draft, producer, talentPool, today } = fixture();
    const first = issueBrief('b1', producer, ROLE, 5_000_000, draft, talentPool, today, createRng(7));
    const second = issueBrief('b2', producer, ROLE, 5_000_000, withBrief(draft, first), talentPool, today, createRng(7));
    expect(first.briefsUsed).toBe(1);
    expect(second.briefsUsed).toBe(2);
  });
});

describe('quoteBrief', () => {
  it('says nobody works for nothing', () => {
    const { draft, producer, talentPool, today } = fixture();
    expect(quoteBrief(producer, ROLE, 0, draft, talentPool, today).band).toBe('nobody');
  });

  it('reads a generous allocation as generous', () => {
    const { draft, producer, talentPool, today } = fixture();
    expect(quoteBrief(producer, ROLE, 500_000_000, draft, talentPool, today).band).toBe('generous');
  });

  it('is deterministic - the confirm panel can render it live', () => {
    const { draft, producer, talentPool, today } = fixture();
    const a = quoteBrief(producer, ROLE, 3_000_000, draft, talentPool, today);
    const b = quoteBrief(producer, ROLE, 3_000_000, draft, talentPool, today);
    expect(a).toEqual(b);
  });
});

describe('producerCandidatePick', () => {
  it('is deterministic for a fixed rng', () => {
    const { draft, producer, talentPool, today } = fixture();
    const a = producerCandidatePick(producer, ROLE, 5_000_000, draft, talentPool, today, createRng(11));
    const b = producerCandidatePick(producer, ROLE, 5_000_000, draft, talentPool, today, createRng(11));
    expect(a).toEqual(b);
  });

  it('never comes back over the allocation', () => {
    const { draft, producer, talentPool, today } = fixture();
    for (let seed = 0; seed < 40; seed++) {
      const pick = producerCandidatePick(producer, ROLE, 1_200_000, draft, talentPool, today, createRng(seed));
      if (pick) expect(pick.fee).toBeLessThanOrEqual(1_200_000);
    }
  });

  it('comes back empty-handed when nothing in the pool fits the money', () => {
    const { draft, producer, talentPool, today } = fixture();
    expect(producerCandidatePick(producer, ROLE, 1, draft, talentPool, today, createRng(12))).toBeNull();
  });

  it('never offers someone already on the film', () => {
    const { draft, talentPool, today } = fixture();
    const alreadyOn = talentPool.Cinematographer[0];
    const busy = { ...draft, talent: [...draft.talent, { role: 'Editor' as const, person: alreadyOn }] };
    expect(eligibleBriefCandidates(busy, talentPool, ROLE, today).some((p) => p.id === alreadyOn.id)).toBe(false);
  });

  it('buys VALUE, not the cheapest body alive - the regression the diagnostic harness caught', () => {
    // Ranking on a literal skill-per-pound ratio degenerates to 1/fee, because
    // fees span orders of magnitude where skill spans 1-100. It returned
    // near-worthless heads for pennies, which is not a trade - it is a joke.
    // data/producers.ts:BRIEF_PRICE_PENALTY prices quality on the same log
    // scale salaries actually live on; this pins that behaviour.
    const { draft, producer, talentPool, today } = fixture();
    const allocation = 8_000_000;
    const affordable = eligibleBriefCandidates(draft, talentPool, ROLE, today)
      .map((p) => ({ p, fee: getTypicalSalaryForRole(p, ROLE) }))
      .filter((c) => c.fee <= allocation);
    expect(affordable.length).toBeGreaterThan(4);
    const skillOf = (personId: string) =>
      talentPool.Cinematographer.find((p) => p.id === personId)!.careers.cinematographer!.skill;
    const poolAverageSkill = affordable.reduce((sum, c) => sum + skillOf(c.p.id), 0) / affordable.length;
    const cheapestFee = Math.min(...affordable.map((c) => c.fee));

    let picks = 0;
    let skillTotal = 0;
    let feeTotal = 0;
    for (let seed = 0; seed < 60; seed++) {
      const pick = producerCandidatePick(producer, ROLE, allocation, draft, talentPool, today, createRng(seed));
      if (!pick) continue;
      picks++;
      skillTotal += skillOf(pick.personId);
      feeTotal += pick.fee;
    }
    expect(picks).toBeGreaterThan(0);
    // Better than an average hire from the same field...
    expect(skillTotal / picks).toBeGreaterThan(poolAverageSkill);
    // ...and emphatically not just the cheapest person available.
    expect(feeTotal / picks).toBeGreaterThan(cheapestFee * 2);
  });

  it('skill sets the SPREAD - a poor producer is erratic where a good one is consistent', () => {
    const { draft, talentPool, today } = fixture();
    const distinctPicks = (skill: number) => {
      const p = makeProducer({ skill });
      const seen = new Set<string>();
      for (let seed = 0; seed < 60; seed++) {
        const pick = producerCandidatePick(p, ROLE, 8_000_000, draft, talentPool, today, createRng(seed));
        if (pick) seen.add(pick.personId);
      }
      return seen.size;
    };
    expect(distinctPicks(100)).toBeLessThan(distinctPicks(1));
  });

  it('brings the deal in under the standing fee', () => {
    const { draft, talentPool, today } = fixture();
    const feeFor = (skill: number) => {
      const p = makeProducer({ skill });
      const pick = producerCandidatePick(p, ROLE, 8_000_000, draft, talentPool, today, createRng(21));
      const person = talentPool.Cinematographer.find((c) => c.id === pick!.personId)!;
      return { fee: pick!.fee, standing: getTypicalSalaryForRole(person, ROLE) };
    };
    const good = feeFor(100);
    expect(good.fee).toBeLessThan(good.standing);
  });
});

describe('tickStaffingBriefs', () => {
  it('does nothing before the day they said they would be back', () => {
    const { draft, producer, talentPool, pool, today } = fixture();
    const brief = issueBrief('b1', producer, ROLE, 5_000_000, draft, talentPool, today, createRng(31));
    const out = withBrief(draft, brief);
    const ticked = tickStaffingBriefs(out, brief.dueOnDay - 1, talentPool, pool, createRng(32));
    expect(ticked).toBe(out); // identity: an untouched draft is never copied
  });

  it('comes back with a name on the day it is due', () => {
    const { draft, producer, talentPool, pool, today } = fixture();
    const brief = issueBrief('b1', producer, ROLE, 5_000_000, draft, talentPool, today, createRng(33));
    const ticked = tickStaffingBriefs(withBrief(draft, brief), brief.dueOnDay, talentPool, pool, createRng(34));
    const returned = ticked.staffingBriefs![0];
    expect(returned.status).toBe('returned');
    expect(returned.candidate?.personId).toBeTruthy();
  });

  it('returns empty-handed rather than over budget when the money buys nobody', () => {
    const { draft, producer, talentPool, pool, today } = fixture();
    const brief = issueBrief('b1', producer, ROLE, 1, draft, talentPool, today, createRng(35));
    const ticked = tickStaffingBriefs(withBrief(draft, brief), brief.dueOnDay, talentPool, pool, createRng(36));
    expect(ticked.staffingBriefs![0].status).toBe('returned');
    expect(ticked.staffingBriefs![0].candidate).toBeUndefined();
  });

  it('drops a brief whose slot the player filled by hand meanwhile', () => {
    const { draft, producer, talentPool, pool, today } = fixture();
    const brief = issueBrief('b1', producer, ROLE, 5_000_000, draft, talentPool, today, createRng(37));
    const filledMeanwhile = {
      ...withBrief(draft, brief),
      talent: [...draft.talent, { role: ROLE, person: talentPool.Cinematographer[0] }],
    };
    const ticked = tickStaffingBriefs(filledMeanwhile, brief.dueOnDay, talentPool, pool, createRng(38));
    expect(ticked.staffingBriefs![0].status).toBe('declined');
  });

  it('brings nothing back for a producer who has since been fired', () => {
    const { draft, producer, talentPool, today } = fixture();
    const brief = issueBrief('b1', producer, ROLE, 5_000_000, draft, talentPool, today, createRng(39));
    const ticked = tickStaffingBriefs(withBrief(draft, brief), brief.dueOnDay, talentPool, [], createRng(40));
    expect(ticked.staffingBriefs![0].status).toBe('declined');
  });

  it('is a no-op for a draft that has never delegated anything', () => {
    const { draft, talentPool, pool } = fixture();
    expect(tickStaffingBriefs(draft, 999, talentPool, pool, createRng(41))).toBe(draft);
  });
});
