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
import { getCrewCareer } from './person';
import { logAmount } from './interpolate';
import { computeActorAppeal, resolveOfferResponse } from './castingAppeal';
import { actorMeetsCharacterGender } from './casting';
import { WEEK_LENGTH_DAYS } from './opportunities';
import { clamp, pick, randInt, type RandomFn } from './random';

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

// Casting Director (Phase D, design review section 11) - "volume" and
// "curation" are kept as genuinely independent effects, per that section's
// own framing ("not simply increase applicant volume"): a bigger batch is
// one thing, a batch skewed harder toward whoever actually suits the role
// is another. skillT is 0 with nobody hired (the existing unbiased,
// wide-variance sampling), rising toward 1 at skill 100.
const CASTING_DIRECTOR_MAX_BATCH_BONUS = 2;
const CASTING_DIRECTOR_MAX_CURATION_EXPONENT = 1.6;
// "Discovery" - a skilled Casting Director occasionally surfaces a
// genuinely well-suited but low-fame unknown who wouldn't naturally have
// floated to the top of a fame-correlated appeal score. Never guaranteed,
// even at max skill - the fantasy is "saves the producer time," not
// "flips a switch that finds a star every week."
const DISCOVERY_MAX_CHANCE = 0.35;
const DISCOVERY_FAME_CEILING = 25;
const DISCOVERY_SUITABILITY_FLOOR = 60;

// Interested Talent (Phase D, design review section 6) - the reverse of
// Direct Approach: a small, mostly-empty-handed sample of the unattached
// pool is checked each week against the exact same acceptance threshold
// Direct Approach itself uses, and whoever would already say yes is
// surfaced without the player ever having searched for them. Deliberately
// rare (MAX_HITS caps it at one per tick) - this is reputation quietly
// working *for* the player, not a second applicant flood layered on top
// of Open Casting's own.
const INTERESTED_TALENT_SAMPLE_SIZE = 6;
const INTERESTED_TALENT_MAX_HITS = 1;

let nextCallId = 1;

/** A fresh, empty casting call for one Character. */
export function openCastingCall(characterId: string, role: 'Lead Actor' | 'Supporting Actor', openedOnDay: GameDay): FilmDraft['castingCalls'][number] {
  return {
    id: `casting-call-${nextCallId++}`,
    characterId,
    role,
    openedOnDay,
    nextApplicantCheckDay: openedOnDay + WEEK_LENGTH_DAYS,
    applicants: [],
    rejectionCount: 0,
    dismissedApplicantIds: [],
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
 * filtered after the fact. `castingDirectorSkill` is undefined with nobody
 * hired for the role - the baseline, unbiased, wide-variance sampling the
 * design review's section 11 describes; a skilled one both widens the
 * batch and skews it toward the top of the appeal distribution, plus an
 * occasional low-fame "discovery" pick outside the normal weighting
 * entirely.
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
  castingDirectorSkill: number | undefined,
  rng: RandomFn,
): Person[] {
  const eligible = talentPool.filter((p) => !excludeIds.has(p.id) && actorMeetsCharacterGender(p.identity.gender, character.castingGender));
  if (eligible.length === 0) return [];

  const skillT = clamp((castingDirectorSkill ?? 0) / 100, 0, 1);
  const weightFloor = MIN_APPLICANT_WEIGHT + rejectionCount * WEIGHT_FLOOR_PER_REJECTION;
  const curationExponent = 1 + skillT * (CASTING_DIRECTOR_MAX_CURATION_EXPONENT - 1);

  const appealByPersonId = new Map(
    eligible.map((person) => [
      person.id,
      computeActorAppeal(person, character, script, studio, director, currentTalent, offeredSalary, plannedStartDay),
    ]),
  );

  // Casting Appeal Rework - a candidate this offer/schedule can't actually
  // reach (below their effective salary floor, genuinely unavailable, or no
  // matching career at all) is excluded from the pool entirely, not merely
  // floored to MIN_APPLICANT_WEIGHT. `weightFloor` still applies to
  // everyone who *does* clear these gates - it's what keeps a
  // low-suitability-but-affordable candidate from being drowned out, the
  // no-softlock widening this constant was always meant for.
  const eligibleWithAppeal = eligible.filter((person) => {
    const appeal = appealByPersonId.get(person.id);
    return appeal !== undefined && appeal !== null && !appeal.belowSalaryFloor && appeal.schedule.status !== 'unavailable';
  });
  if (eligibleWithAppeal.length === 0) return [];

  const weighted = eligibleWithAppeal.map((person) => {
    const rawWeight = Math.max(weightFloor, appealByPersonId.get(person.id)!.overall);
    return { person, weight: Math.pow(rawWeight, curationExponent) };
  });

  const maxBatch = APPLICANT_BATCH_SIZE[1] + Math.min(MAX_REJECTION_BATCH_BONUS, rejectionCount) + Math.round(skillT * CASTING_DIRECTOR_MAX_BATCH_BONUS);
  const batchSize = Math.min(randInt(rng, APPLICANT_BATCH_SIZE[0], maxBatch), weighted.length);
  const batch = weightedSampleWithoutReplacement(rng, weighted, batchSize);

  if (castingDirectorSkill && rng() < skillT * DISCOVERY_MAX_CHANCE) {
    const batchIds = new Set(batch.map((p) => p.id));
    const discoveryPool = eligibleWithAppeal.filter((p) => {
      if (batchIds.has(p.id) || p.reputation.fame > DISCOVERY_FAME_CEILING) return false;
      return (appealByPersonId.get(p.id)?.suitability ?? 0) >= DISCOVERY_SUITABILITY_FLOOR;
    });
    if (discoveryPool.length > 0) batch.push(pick(rng, discoveryPool));
  }

  return batch;
}

/**
 * Interested Talent (Phase D, design review section 6) - checks a small
 * sample of the currently-unattached pool against the same acceptance
 * threshold Direct Approach itself uses (engine/castingAppeal.ts:resolveOfferResponse),
 * and returns whoever would already say yes. The reverse of Direct
 * Approach: instead of the player naming one person and rolling their
 * response, this rolls many people and keeps whoever clears the bar
 * unprompted.
 */
export function generateInterestedTalent(
  character: ScriptCharacter,
  script: Script,
  studio: Studio,
  director: Person | undefined,
  currentTalent: TalentAssignment[],
  offeredSalary: Money,
  plannedStartDay: GameDay,
  talentPool: Person[],
  excludeIds: Set<string>,
  rng: RandomFn,
): Person[] {
  const eligible = talentPool.filter((p) => !excludeIds.has(p.id) && actorMeetsCharacterGender(p.identity.gender, character.castingGender));
  if (eligible.length === 0) return [];

  const sampleSize = Math.min(INTERESTED_TALENT_SAMPLE_SIZE, eligible.length);
  const pool = [...eligible];
  const sample: Person[] = [];
  for (let i = 0; i < sampleSize; i++) {
    const index = randInt(rng, 0, pool.length - 1);
    sample.push(pool[index]);
    pool.splice(index, 1);
  }

  const hits: Person[] = [];
  for (const person of sample) {
    if (hits.length >= INTERESTED_TALENT_MAX_HITS) break;
    const appeal = computeActorAppeal(person, character, script, studio, director, currentTalent, offeredSalary, plannedStartDay);
    // resolveOfferResponse's own schedule/salary-floor gates already exclude
    // anyone this offer genuinely can't reach - no separate eligibility
    // filter needed here (Casting Appeal Rework).
    if (!appeal) continue;
    if (resolveOfferResponse(appeal, person).status === 'accepted') hits.push(person);
  }
  return hits;
}

/** Whether the Character at this call already has someone cast - the same slot-index positional read HireTalent.tsx's CharacterCastingRow already does, reused here so a filled role stops generating pointless further applicants, and by components/common/Inbox.tsx to know which calls are actually still worth surfacing. */
export function isCharacterCast(draft: FilmDraft, character: ScriptCharacter, role: 'Lead Actor' | 'Supporting Actor'): boolean {
  if (!draft.script) return false;
  const roleAssignments = draft.talent.filter((a) => a.role === role);
  // Explicit binding is authoritative when present (slot-bound casting) - this
  // Character is cast iff someone is bound to it, regardless of hire order.
  if (roleAssignments.some((a) => a.characterId === character.id)) return true;
  // Legacy positional fallback: only unbound assignments (no characterId) map
  // by ordinal, exactly as before, so pre-binding drafts read identically.
  const unbound = roleAssignments.filter((a) => a.characterId === undefined);
  if (unbound.length === 0) return false;
  const sameProminence = draft.script.cast.filter((c) => c.prominence === character.prominence);
  const slotIndex = sameProminence.findIndex((c) => c.id === character.id);
  return slotIndex >= 0 && slotIndex < unbound.length;
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
 * The weekly tick for one draft's whole set of casting calls - due calls
 * each get one fresh batch of Open Casting applicants plus a shot at
 * Interested Talent, folded onto whatever's already accumulated; calls not
 * yet due, or whose Character is already cast, are left untouched. Called
 * from state/studioReducer.ts's ADVANCE_DAY case for the focused draft and
 * every backgrounded one, the same real-time beat everything else
 * week-driven in this codebase already rides.
 */
export function tickCastingCalls(draft: FilmDraft, totalDays: number, studio: Studio, talentPool: Person[], rng: RandomFn): FilmDraft {
  if (!draft.script || draft.castingCalls.length === 0) return draft;
  const script = draft.script;
  const director = findAssignedPerson(draft.talent, 'Director');
  const castingDirector = findAssignedPerson(draft.talent, 'Casting Director');
  const castingDirectorSkill = castingDirector ? getCrewCareer(castingDirector, 'Casting Director')?.skill : undefined;
  let changed = false;

  const updatedCalls = draft.castingCalls.map((call) => {
    if (call.nextApplicantCheckDay > totalDays) return call;
    const character = script.cast.find((c) => c.id === call.characterId);
    if (!character || isCharacterCast(draft, character, call.role)) return call;

    changed = true;
    // Dismissed applicants stay out of every future batch - a dismissal is the
    // player saying "not this person for this role," so they shouldn't keep
    // re-applying and re-cluttering the list week after week.
    const alreadyInvolvedIds = new Set([
      ...draft.talent.map((a) => a.person.id),
      ...call.applicants.map((a) => a.person.id),
      ...call.dismissedApplicantIds,
    ]);
    const range = ROLE_GENERATION_PROFILES[professionForProductionRole(call.role)].salaryRange;
    const offeredSalary = draft.talentTargetPriceByRole[call.role] ?? logAmount(0.5, range);
    // No real "planned shoot start day" exists pre-Greenlight (development-pipeline
    // doc) - `totalDays` (today) stands in for "would they be free to start
    // now," matching how every other hire in this game is instant rather
    // than scheduled in advance. Revisit if/when a real target start date
    // exists to read instead.
    const openApplicants = generateCastingApplicants(
      character,
      script,
      studio,
      director,
      draft.talent,
      offeredSalary,
      totalDays,
      talentPool,
      alreadyInvolvedIds,
      call.rejectionCount,
      castingDirectorSkill,
      rng,
    );

    const excludingThisWeeksApplicants = new Set([...alreadyInvolvedIds, ...openApplicants.map((p) => p.id)]);
    const interestedTalent = generateInterestedTalent(
      character,
      script,
      studio,
      director,
      draft.talent,
      offeredSalary,
      totalDays,
      talentPool,
      excludingThisWeeksApplicants,
      rng,
    );

    return {
      ...call,
      applicants: [
        ...call.applicants,
        ...openApplicants.map((person) => ({ person, appliedOnDay: totalDays, channel: 'OpenCasting' as const })),
        ...interestedTalent.map((person) => ({ person, appliedOnDay: totalDays, channel: 'InterestedTalent' as const })),
      ],
      nextApplicantCheckDay: totalDays + WEEK_LENGTH_DAYS,
    };
  });

  if (!changed) return draft;
  return { ...draft, castingCalls: updatedCalls };
}
