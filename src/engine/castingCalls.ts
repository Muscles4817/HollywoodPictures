// Casting Redesign, Phase B (docs/DESIGN_REVIEW_casting_redesign.md
// sections 1-2) - Open Casting. Applicants trickle in on the same weekly
// beat engine/opportunities.ts already established for the Opportunity
// Market (WEEK_LENGTH_DAYS, a `nextGenerationCheckDay`-style field checked
// lazily rather than looped/caught-up on a big calendar jump - a call that
// was due three weeks ago still only produces one fresh batch the next
// time it's checked, exactly like settleOpportunities's own behavior, not
// three retroactive ones).
import type { FilmDraft, GameDay, Money, Person, Script, ScriptCharacter, Studio, TalentAssignment } from '../types';
import { ROLE_GENERATION_PROFILES } from '../data/talentGeneration';
import { professionForProductionRole, findAssignedPerson } from '../data/helpers';
import { logAmount } from './interpolate';
import { computeActorAppeal } from './castingAppeal';
import { WEEK_LENGTH_DAYS } from './opportunities';
import { randInt, type RandomFn } from './random';

export { WEEK_LENGTH_DAYS };

// How many applicants show up in one weekly batch for a single Character's
// call - smaller than the Opportunity Market's own [3, 6] batch (that's
// the whole studio's script market; this is one role on one production).
// First-draft, tunable like every other batch-size constant in this
// simulation.
const APPLICANT_BATCH_SIZE: [number, number] = [1, 3];

// A floor on sampling weight so nobody is ever *literally* impossible to
// see apply, even with poor computed appeal - the world should occasionally
// surprise the player, not just confirm the math.
const MIN_APPLICANT_WEIGHT = 5;

// No-softlock widening (design review section 9), the Open Casting half -
// engine/castingAppeal.ts's computeAcceptanceThreshold softens who'll say
// yes; this softens who shows up in the first place. Each rejection this
// Character has accumulated both grows the batch (a wider net) and flattens
// the appeal-weighted curve (a floor rising toward the middle of the pack
// means low-suitability/low-reputation-fit people stop being drowned out) -
// "introducing stronger unknown talent" from the design brief falls out of
// the same floor rising, not a separate mechanic.
const MAX_REJECTION_BATCH_BONUS = 3;
const WEIGHT_FLOOR_PER_REJECTION = 4;

let nextCallId = 1;

/** A fresh, empty Open Casting call for one Character - the only channel that exists yet (design review section 10). */
export function openCastingCall(characterId: string, role: 'Lead Actor' | 'Supporting Actor', openedOnDay: GameDay): FilmDraft['castingCalls'][number] {
  return {
    id: `casting-call-${nextCallId++}`,
    characterId,
    role,
    channel: 'OpenCasting',
    openedOnDay,
    nextApplicantCheckDay: openedOnDay + WEEK_LENGTH_DAYS,
    applicants: [],
    rejectionCount: 0,
  };
}

/** Finds this Character's existing call, or opens a fresh one - Direct Approach (Phase C) can target someone before Open Casting has ever been used, but still needs somewhere to track rejectionCount for the no-softlock widening below. */
export function findOrOpenCastingCall(calls: FilmDraft['castingCalls'], characterId: string, role: 'Lead Actor' | 'Supporting Actor', today: GameDay): FilmDraft['castingCalls'][number] {
  return calls.find((c) => c.characterId === characterId) ?? openCastingCall(characterId, role, today);
}

function weightedSampleWithoutReplacement(rng: RandomFn, entries: Array<{ person: Person; weight: number }>, count: number): Person[] {
  const pool = [...entries];
  const result: Person[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let roll = rng() * total;
    let index = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      if (roll < pool[j].weight) {
        index = j;
        break;
      }
      roll -= pool[j].weight;
    }
    result.push(pool[index].person);
    pool.splice(index, 1);
  }
  return result;
}

/**
 * One weekly batch of applicants for a single Character - sampled with
 * probability weighted toward higher computeActorAppeal (engine/castingAppeal.ts),
 * not drawn uniformly, so who shows up already reflects Suitability, the
 * studio's Brand/Prestige fit, salary, and schedule rather than being
 * filtered after the fact. No Casting Director exists yet (Phase D), so
 * this is always the unbiased, wide-variance version of sampling the
 * design review's section 11 describes as the baseline.
 */
export function generateCastingApplicants(
  character: ScriptCharacter,
  script: Script,
  studio: Studio,
  director: Person | undefined,
  currentTalent: TalentAssignment[],
  offeredSalary: Money,
  plannedStartDay: GameDay,
  talentPool: Person[],
  excludeIds: Set<string>,
  rejectionCount: number,
  rng: RandomFn,
): Person[] {
  const eligible = talentPool.filter((p) => !excludeIds.has(p.id));
  if (eligible.length === 0) return [];
  const weightFloor = MIN_APPLICANT_WEIGHT + rejectionCount * WEIGHT_FLOOR_PER_REJECTION;
  const weighted = eligible.map((person) => ({
    person,
    weight: Math.max(
      weightFloor,
      computeActorAppeal(person, character, script, studio, director, currentTalent, offeredSalary, plannedStartDay)?.overall ?? weightFloor,
    ),
  }));
  const maxBatch = APPLICANT_BATCH_SIZE[1] + Math.min(MAX_REJECTION_BATCH_BONUS, rejectionCount);
  const batchSize = Math.min(randInt(rng, APPLICANT_BATCH_SIZE[0], maxBatch), weighted.length);
  return weightedSampleWithoutReplacement(rng, weighted, batchSize);
}

/** Whether the Character at this call already has someone cast - the same slot-index positional read HireTalent.tsx's CharacterCastingRow already does, reused here so a filled role stops generating pointless further applicants, and by components/common/Inbox.tsx to know which calls are actually still worth surfacing. */
export function isCharacterCast(draft: FilmDraft, character: ScriptCharacter, role: 'Lead Actor' | 'Supporting Actor'): boolean {
  if (!draft.script) return false;
  const sameProminence = draft.script.cast.filter((c) => c.prominence === character.prominence);
  const slotIndex = sameProminence.findIndex((c) => c.id === character.id);
  const hiredCount = draft.talent.filter((a) => a.role === role).length;
  return slotIndex >= 0 && slotIndex < hiredCount;
}

/** Every open call on this draft that has at least one applicant waiting and whose Character isn't cast yet - what components/common/Inbox.tsx surfaces as "new casting options" for a backgrounded production the player isn't currently looking at. */
export function castingCallsAwaitingReview(draft: FilmDraft): FilmDraft['castingCalls'] {
  if (!draft.script) return [];
  const script = draft.script;
  return draft.castingCalls.filter((call) => {
    if (call.applicants.length === 0) return false;
    const character = script.cast.find((c) => c.id === call.characterId);
    return character !== undefined && !isCharacterCast(draft, character, call.role);
  });
}

/**
 * The weekly tick for one draft's whole set of Open Casting calls - due
 * calls each get one fresh batch of applicants, folded onto whatever's
 * already accumulated; calls not yet due, or whose Character is already
 * cast, are left untouched. Called from state/studioReducer.ts's
 * ADVANCE_DAY case for the focused draft and every backgrounded one, the
 * same real-time beat everything else week-driven in this codebase already
 * rides.
 */
export function tickCastingCalls(draft: FilmDraft, totalDays: number, studio: Studio, talentPool: Person[], rng: RandomFn): FilmDraft {
  if (!draft.script || draft.castingCalls.length === 0) return draft;
  const script = draft.script;
  const director = findAssignedPerson(draft.talent, 'Director');
  let changed = false;

  const updatedCalls = draft.castingCalls.map((call) => {
    if (call.nextApplicantCheckDay > totalDays) return call;
    const character = script.cast.find((c) => c.id === call.characterId);
    if (!character || isCharacterCast(draft, character, call.role)) return call;

    changed = true;
    const excludeIds = new Set([...draft.talent.map((a) => a.person.id), ...call.applicants.map((a) => a.person.id)]);
    const range = ROLE_GENERATION_PROFILES[professionForProductionRole(call.role)].salaryRange;
    const offeredSalary = draft.talentTargetPriceByRole[call.role] ?? logAmount(0.5, range);
    // No real "planned shoot start day" exists pre-Greenlight (development-pipeline
    // doc) - `totalDays` (today) stands in for "would they be free to start
    // now," matching how every other hire in this game is instant rather
    // than scheduled in advance. Revisit if/when a real target start date
    // exists to read instead.
    const newApplicants = generateCastingApplicants(
      character,
      script,
      studio,
      director,
      draft.talent,
      offeredSalary,
      totalDays,
      talentPool,
      excludeIds,
      call.rejectionCount,
      rng,
    );

    return {
      ...call,
      applicants: [...call.applicants, ...newApplicants.map((person) => ({ person, appliedOnDay: totalDays }))],
      nextApplicantCheckDay: totalDays + WEEK_LENGTH_DAYS,
    };
  });

  if (!changed) return draft;
  return { ...draft, castingCalls: updatedCalls };
}
