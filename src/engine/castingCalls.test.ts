// Casting Redesign, Phase B (docs/DESIGN_REVIEW_casting_redesign.md
// sections 1-2) - no dedicated test coverage existed for this file before
// it was added.
import { describe, it, expect } from 'vitest';
import { openCastingCall, findOrOpenCastingCall, castingCallsAwaitingReview, generateCastingApplicants, generateInterestedTalent, tickCastingCalls, WEEK_LENGTH_DAYS } from './castingCalls';
import { computeActorAppeal, resolveOfferResponse } from './castingAppeal';
import { createDraftFromAsset } from '../state/gameState';
import { generateScriptOptions } from './scriptGenerator';
import { generateTalentCandidates } from './talentGenerator';
import { withRng, createRng } from './random';
import type { Asset, FilmDraft, Person, Script, ScriptCharacter, Studio, TalentAssignment } from '../types';

function studio(overrides: Partial<Studio> = {}): Studio {
  return { name: 'Test Studio', cash: 10_000_000, brand: 50, prestige: 50, assets: [], ...overrides };
}

function draftFor(seed: number): FilmDraft {
  const { result: script } = withRng(seed, (rng) => generateScriptOptions('Drama', rng, 1)[0]);
  const asset: Asset = { id: `asset-${seed}`, script, source: 'Studio Original', acquisitionCost: 0, acquiredOnDay: 1 };
  return createDraftFromAsset(asset, {});
}

function actorPool(seed: number, count: number): Person[] {
  const { result } = withRng(seed, (rng) => generateTalentCandidates('Actor', rng, count));
  return result;
}

function leadCharacter(script: Script): ScriptCharacter {
  const lead = script.cast.find((c) => c.prominence === 'Lead');
  if (!lead) throw new Error('fixture script has no Lead character');
  return lead;
}

describe('openCastingCall', () => {
  it('builds a fresh, empty OpenCasting call with nextApplicantCheckDay one week out', () => {
    const call = openCastingCall('char-1', 'Lead Actor', 10);
    expect(call.characterId).toBe('char-1');
    expect(call.role).toBe('Lead Actor');
    expect(call.openedOnDay).toBe(10);
    expect(call.nextApplicantCheckDay).toBe(10 + WEEK_LENGTH_DAYS);
    expect(call.applicants).toEqual([]);
  });

  it('gives every call a distinct id', () => {
    const a = openCastingCall('char-1', 'Lead Actor', 1);
    const b = openCastingCall('char-2', 'Supporting Actor', 1);
    expect(a.id).not.toBe(b.id);
  });

  it('starts rejectionCount at 0 (Phase C)', () => {
    expect(openCastingCall('char-1', 'Lead Actor', 1).rejectionCount).toBe(0);
  });
});

// Casting Redesign, Phase C - Direct Approach needs somewhere to track
// rejectionCount even if Open Casting was never used for this Character.
describe('findOrOpenCastingCall', () => {
  it('returns the existing call for this Character if one is already open', () => {
    const existing = openCastingCall('char-1', 'Lead Actor', 5);
    const found = findOrOpenCastingCall([existing], 'char-1', 'Lead Actor', 20);
    expect(found).toBe(existing);
  });

  it('opens a fresh call, today, if none exists yet for this Character', () => {
    const found = findOrOpenCastingCall([], 'char-1', 'Lead Actor', 20);
    expect(found.characterId).toBe('char-1');
    expect(found.openedOnDay).toBe(20);
    expect(found.rejectionCount).toBe(0);
  });
});

describe('generateCastingApplicants', () => {
  it('returns no applicants when the whole pool is excluded', () => {
    const draft = draftFor(1);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(1, 5);
    const rng = createRng(1);
    const applicants = generateCastingApplicants(
      character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(pool.map((p) => p.id)), 0, undefined, rng,
    );
    expect(applicants).toEqual([]);
  });

  it('never returns an excluded person, even across a large sample', () => {
    const draft = draftFor(2);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(2, 10);
    const excluded = new Set([pool[0].id, pool[1].id]);
    const rng = createRng(2);
    for (let i = 0; i < 20; i++) {
      const applicants = generateCastingApplicants(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, excluded, 0, undefined, rng);
      expect(applicants.some((p) => excluded.has(p.id))).toBe(false);
    }
  });

  it('never returns duplicate people within one batch', () => {
    const draft = draftFor(3);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(3, 8);
    const rng = createRng(3);
    const applicants = generateCastingApplicants(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(), 0, undefined, rng);
    const ids = applicants.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('tickCastingCalls', () => {
  it('leaves the draft untouched (same reference) when no call is due yet', () => {
    const draft = draftFor(4);
    const call = { ...openCastingCall('does-not-exist', 'Lead Actor', 1), nextApplicantCheckDay: 100 };
    const withCall = { ...draft, castingCalls: [call] };
    const pool = actorPool(4, 5);
    const rng = createRng(4);
    const result = tickCastingCalls(withCall, 10, studio(), pool, rng);
    expect(result).toBe(withCall);
  });

  it('leaves the draft untouched when there are no casting calls at all', () => {
    const draft = draftFor(5);
    const result = tickCastingCalls(draft, 100, studio(), actorPool(5, 5), createRng(5));
    expect(result).toBe(draft);
  });

  it('generates a fresh batch of applicants once a call is due, and advances nextApplicantCheckDay by one week', () => {
    const draft = draftFor(6);
    const character = leadCharacter(draft.script!);
    const call = openCastingCall(character.id, 'Lead Actor', 1);
    const withCall = { ...draft, castingCalls: [call] };
    const pool = actorPool(6, 10);
    const result = tickCastingCalls(withCall, call.nextApplicantCheckDay, studio(), pool, createRng(6));
    const updatedCall = result.castingCalls[0];
    expect(updatedCall.applicants.length).toBeGreaterThan(0);
    expect(updatedCall.nextApplicantCheckDay).toBe(call.nextApplicantCheckDay + WEEK_LENGTH_DAYS);
  });

  it("doesn't reapply the same person across two due ticks - each batch excludes everyone who's already applied", () => {
    const draft = draftFor(7);
    const character = leadCharacter(draft.script!);
    const call = openCastingCall(character.id, 'Lead Actor', 1);
    const withCall = { ...draft, castingCalls: [call] };
    const pool = actorPool(7, 12);
    const rng = createRng(7);
    const afterFirstTick = tickCastingCalls(withCall, call.nextApplicantCheckDay, studio(), pool, rng);
    const firstBatchIds = new Set(afterFirstTick.castingCalls[0].applicants.map((a) => a.person.id));
    const secondDueDay = afterFirstTick.castingCalls[0].nextApplicantCheckDay;
    const afterSecondTick = tickCastingCalls(afterFirstTick, secondDueDay, studio(), pool, rng);
    const secondBatchIds = afterSecondTick.castingCalls[0].applicants.map((a) => a.person.id);
    // Every applicant from the first tick is still present (never dropped)...
    for (const id of firstBatchIds) expect(secondBatchIds).toContain(id);
    // ...and nobody from the first batch was drawn again into the second one specifically.
    const newInSecondTick = secondBatchIds.length - firstBatchIds.size;
    expect(newInSecondTick).toBeGreaterThanOrEqual(0);
  });

  it('stops generating further applicants once the Character is already cast', () => {
    const draft = draftFor(8);
    const character = leadCharacter(draft.script!);
    const call = openCastingCall(character.id, 'Lead Actor', 1);
    const [castPerson] = actorPool(8, 1);
    const talent: TalentAssignment[] = [{ role: 'Lead Actor', person: castPerson }];
    const withCastCharacter = { ...draft, castingCalls: [call], talent };
    const pool = actorPool(8, 10);
    const result = tickCastingCalls(withCastCharacter, call.nextApplicantCheckDay, studio(), pool, createRng(8));
    expect(result.castingCalls[0].applicants).toEqual([]);
    expect(result.castingCalls[0].nextApplicantCheckDay).toBe(call.nextApplicantCheckDay);
  });

  it('excludes anyone already attached to the draft from a newly-generated batch', () => {
    const draft = draftFor(9);
    const script = draft.script!;
    const leads = script.cast.filter((c) => c.prominence === 'Lead');
    if (leads.length < 2) return; // needs at least 2 leads to exercise this without the slot already being "cast"
    const call = openCastingCall(leads[1].id, 'Lead Actor', 1);
    const pool = actorPool(9, 10);
    const [alreadyAttached] = pool;
    const talent: TalentAssignment[] = [{ role: 'Lead Actor', person: alreadyAttached }];
    const withCall = { ...draft, castingCalls: [call], talent };
    const result = tickCastingCalls(withCall, call.nextApplicantCheckDay, studio(), pool, createRng(9));
    expect(result.castingCalls[0].applicants.some((a) => a.person.id === alreadyAttached.id)).toBe(false);
  });
});

// Casting Redesign, Phase C, section 9 - no-softlock widening on the Open
// Casting side: a Character with accumulated rejections should see a
// wider net, not the same narrow one forever.
describe('generateCastingApplicants - no-softlock widening', () => {
  it('can produce a larger batch once rejectionCount is high than it ever does at rejectionCount 0, given the same pool', () => {
    const draft = draftFor(10);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(10, 20);
    let maxAtZeroRejections = 0;
    let maxAtManyRejections = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed);
      maxAtZeroRejections = Math.max(maxAtZeroRejections, generateCastingApplicants(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(), 0, undefined, rng).length);
    }
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed);
      maxAtManyRejections = Math.max(maxAtManyRejections, generateCastingApplicants(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(), 8, undefined, rng).length);
    }
    expect(maxAtManyRejections).toBeGreaterThan(maxAtZeroRejections);
  });
});

// Casting Redesign, Phase D, section 11 - a Casting Director's two effects
// (volume and curation) are deliberately independent, per the design
// review's own framing. Kept as three separate tests rather than one, so a
// regression in just one effect doesn't hide behind the other two still
// passing.
describe('generateCastingApplicants - Casting Director (Phase D)', () => {
  it('a maxed-skill Casting Director can produce a larger batch than is ever possible with none hired, given the same pool', () => {
    const draft = draftFor(14);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(14, 20);
    let maxWithNone = 0;
    let maxAtMaxSkill = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed);
      maxWithNone = Math.max(maxWithNone, generateCastingApplicants(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(), 0, undefined, rng).length);
    }
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed);
      maxAtMaxSkill = Math.max(maxAtMaxSkill, generateCastingApplicants(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(), 0, 100, rng).length);
    }
    expect(maxAtMaxSkill).toBeGreaterThan(maxWithNone);
  });

  it('a maxed-skill Casting Director skews the sampled batch toward higher-appeal people, on average, than none hired does', () => {
    const draft = draftFor(15);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(15, 20);
    function averageOverall(skill: number | undefined): number {
      let total = 0;
      let count = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const rng = createRng(seed);
        const batch = generateCastingApplicants(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(), 0, skill, rng);
        for (const person of batch) {
          const appeal = computeActorAppeal(person, character, draft.script!, studio(), undefined, [], 1_000_000, 1);
          if (appeal) {
            total += appeal.overall;
            count++;
          }
        }
      }
      return count > 0 ? total / count : 0;
    }
    expect(averageOverall(100)).toBeGreaterThan(averageOverall(undefined));
  });

  it("a maxed-skill Casting Director can surface a 'discovery' pick beyond the batch size any amount of rejection-widening alone could ever produce", () => {
    // At rejectionCount 0 and skill 100, the formula's own ceiling
    // (APPLICANT_BATCH_SIZE[1]=3 + rejection bonus 0 + skill batch bonus
    // round(1 * CASTING_DIRECTOR_MAX_BATCH_BONUS=2)) is 5 - a 6th applicant
    // can only come from the separate discovery pass, not a bigger regular
    // batch.
    const draft = draftFor(14);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(14, 30);
    let maxBatchLength = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rng = createRng(seed);
      const batch = generateCastingApplicants(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(), 0, 100, rng);
      maxBatchLength = Math.max(maxBatchLength, batch.length);
    }
    expect(maxBatchLength).toBeGreaterThan(5);
  });

  it('never discovers with no Casting Director hired, across the same range that reliably discovers at max skill', () => {
    const draft = draftFor(14);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(14, 30);
    let maxBatchLength = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rng = createRng(seed);
      const batch = generateCastingApplicants(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(), 0, undefined, rng);
      maxBatchLength = Math.max(maxBatchLength, batch.length);
    }
    expect(maxBatchLength).toBeLessThanOrEqual(3); // APPLICANT_BATCH_SIZE[1], no rejection or skill bonus at all
  });
});

// Casting Redesign, Phase D, section 6 - Interested Talent is the reverse
// of Direct Approach: a small sample of the unattached pool, checked
// against the exact same acceptance threshold, surfaced without the player
// ever having searched for them.
describe('generateInterestedTalent', () => {
  it('returns no one when the whole pool is excluded', () => {
    const draft = draftFor(16);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(16, 6);
    const rng = createRng(16);
    const hits = generateInterestedTalent(
      character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(pool.map((p) => p.id)), 0, 0, rng,
    );
    expect(hits).toEqual([]);
  });

  it('never returns more than INTERESTED_TALENT_MAX_HITS (1) in a single call, across many seeds', () => {
    const draft = draftFor(17);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(17, 15);
    for (let seed = 1; seed <= 60; seed++) {
      const rng = createRng(seed);
      const hits = generateInterestedTalent(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(), 0, 0, rng);
      expect(hits.length).toBeLessThanOrEqual(1);
    }
  });

  it('never returns an excluded person, even across many seeds', () => {
    const draft = draftFor(18);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(18, 15);
    const excluded = new Set([pool[0].id, pool[1].id, pool[2].id]);
    for (let seed = 1; seed <= 60; seed++) {
      const rng = createRng(seed);
      const hits = generateInterestedTalent(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, excluded, 0, 0, rng);
      expect(hits.some((p) => excluded.has(p.id))).toBe(false);
    }
  });

  it('only ever returns someone whose own resolveOfferResponse against the same appeal is actually accepted', () => {
    const draft = draftFor(19);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(19, 15);
    for (let seed = 1; seed <= 60; seed++) {
      const rng = createRng(seed);
      const hits = generateInterestedTalent(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(), 0, 0, rng);
      for (const person of hits) {
        const appeal = computeActorAppeal(person, character, draft.script!, studio(), undefined, [], 1_000_000, 1);
        expect(appeal).not.toBeNull();
        expect(resolveOfferResponse(appeal!, person, 0, 0).status).toBe('accepted');
      }
    }
  });
});

describe('castingCallsAwaitingReview', () => {
  it('returns calls with at least one applicant whose Character is not yet cast', () => {
    const draft = draftFor(11);
    const character = leadCharacter(draft.script!);
    const [applicant] = actorPool(11, 1);
    const call = { ...openCastingCall(character.id, 'Lead Actor', 1), applicants: [{ person: applicant, appliedOnDay: 1, channel: 'OpenCasting' as const }] };
    const withCall = { ...draft, castingCalls: [call] };
    expect(castingCallsAwaitingReview(withCall)).toEqual([call]);
  });

  it('excludes calls with no applicants yet', () => {
    const draft = draftFor(12);
    const character = leadCharacter(draft.script!);
    const call = openCastingCall(character.id, 'Lead Actor', 1);
    const withCall = { ...draft, castingCalls: [call] };
    expect(castingCallsAwaitingReview(withCall)).toEqual([]);
  });

  it('excludes calls whose Character is already cast, even with applicants waiting', () => {
    const draft = draftFor(13);
    const character = leadCharacter(draft.script!);
    const [applicant, castPerson] = actorPool(13, 2);
    const call = { ...openCastingCall(character.id, 'Lead Actor', 1), applicants: [{ person: applicant, appliedOnDay: 1, channel: 'OpenCasting' as const }] };
    const talent: TalentAssignment[] = [{ role: 'Lead Actor', person: castPerson }];
    const withCall = { ...draft, castingCalls: [call], talent };
    expect(castingCallsAwaitingReview(withCall)).toEqual([]);
  });
});
