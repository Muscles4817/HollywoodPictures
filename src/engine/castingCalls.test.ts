// Casting Redesign, Phase B (docs/DESIGN_REVIEW_casting_redesign.md
// sections 1-2) - no dedicated test coverage existed for this file before
// it was added.
import { describe, it, expect } from 'vitest';
import { openCastingCall, generateCastingApplicants, tickCastingCalls, WEEK_LENGTH_DAYS } from './castingCalls';
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
    expect(call.channel).toBe('OpenCasting');
    expect(call.openedOnDay).toBe(10);
    expect(call.nextApplicantCheckDay).toBe(10 + WEEK_LENGTH_DAYS);
    expect(call.applicants).toEqual([]);
  });

  it('gives every call a distinct id', () => {
    const a = openCastingCall('char-1', 'Lead Actor', 1);
    const b = openCastingCall('char-2', 'Supporting Actor', 1);
    expect(a.id).not.toBe(b.id);
  });
});

describe('generateCastingApplicants', () => {
  it('returns no applicants when the whole pool is excluded', () => {
    const draft = draftFor(1);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(1, 5);
    const rng = createRng(1);
    const applicants = generateCastingApplicants(
      character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(pool.map((p) => p.id)), rng,
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
      const applicants = generateCastingApplicants(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, excluded, rng);
      expect(applicants.some((p) => excluded.has(p.id))).toBe(false);
    }
  });

  it('never returns duplicate people within one batch', () => {
    const draft = draftFor(3);
    const character = leadCharacter(draft.script!);
    const pool = actorPool(3, 8);
    const rng = createRng(3);
    const applicants = generateCastingApplicants(character, draft.script!, studio(), undefined, [], 1_000_000, 1, pool, new Set(), rng);
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
