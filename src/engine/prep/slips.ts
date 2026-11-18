// What a slip in the start date does to a film's people
// (docs/IMPLEMENTATION_PLAN_preproduction_realism.md Phase 5; 04 §9.6).
//
// When prep grows - a fix that takes prep time - the shoot starts later and the
// film's window moves. People are not on hold forever: anyone whose next job
// now overlaps the new window leaves (the hard clash); and the further the film
// has slipped in all, the more of those who are in demand elsewhere take the
// confirmed job instead - the best-booked first ("they are the good ones").
//
// Whoever leaves is replaced from the people free for the new window, nearest
// their fee (the same candidate search a mid-shoot recast uses). Cast and the
// director are pay-or-play: the studio moved the dates, so it still owes them,
// and the replacement is paid on top - a lead leaving is the expensive case.
// Crew are paid for the time they worked; the unworked part of their fee comes
// back. If nobody can replace someone, the production buys them out of the
// other job and keeps them. Pure: the reducer applies the result.
import type { FilmDraft, Person, PersonCommitment, ProductionRole, TalentAssignment, TalentProfession } from '../../types';
import { PREP_SLIP_BUYOUT_RATE, PREP_SLIP_FAME_WEIGHT, PREP_SLIP_LEAVE_SHARE } from '../../data/prep';
import { personCastingAge, personMeetsCharacterAge, personMeetsCharacterGender } from '../casting';
import { keyedRoll } from './roll';
import { professionForProductionRole } from '../../data/helpers';
import { assignmentCost, getTypicalSalaryForRole, isPersonAvailableForCommitment } from '../person';
import { findCandidatesNearPrice } from '../talentFilter';

export interface CrewChange {
  day: number;
  role: ProductionRole;
  leftName: string;
  replacementName: string | null;
  /** Net cash this change cost the studio (negative = money back). */
  cost: number;
  reason: 'clash' | 'moved-on';
  /** True once the player has seen it (the Inbox card clears). */
  acknowledged: boolean;
  /** Who came in, and the film's total slip when they did: they signed up to the moved dates, so only later slip can lose them. */
  replacementId?: string;
  atSlip?: number;
}

export interface SlipInput {
  draft: FilmDraft;
  /** The film's expected end before and after the slip. */
  oldEnd: number;
  newEnd: number;
  /** How far the film has slipped in all, in days. */
  totalSlip: number;
  today: number;
  /** Share of the film's engagement already worked (0..1), for crew refunds. */
  worked: number;
  pool: Record<TalentProfession, Person[]>;
}

export interface SlipResult {
  draft: FilmDraft;
  pool: Record<TalentProfession, Person[]>;
  /** Cash to charge now. */
  cash: number;
  /**
   * What the slip cost the film beyond the fees its talent list now shows: the
   * departed's owed fee (less a crew refund) and any buyout. Added to prep's
   * running cost so the film's own books carry it (the replacement's fee is in
   * the talent cost already).
   */
  booksCost: number;
  changes: CrewChange[];
}

const PAY_OR_PLAY: ReadonlySet<ProductionRole> = new Set(['Director', 'Lead Actor', 'Supporting Actor']);
/** The writer's work is delivered before prep; a slip does not cost the film its writer. */
const UNMOVED_BY_SLIPS: ReadonlySet<ProductionRole> = new Set(['Writer']);

export function leaveShareForSlip(totalSlip: number): number {
  return PREP_SLIP_LEAVE_SHARE.find((b) => totalSlip >= b.minDays)?.share ?? 0;
}

const overlaps = (c: PersonCommitment, start: number, end: number) => c.startDay <= end && start <= c.endDay;

/**
 * Whether someone in demand elsewhere takes the other job at this total slip.
 * Each person has one fixed roll for the film (keyed on its seed), so as the
 * slip grows the share leaving grows to exactly the table's share - a run of
 * small slips never compounds past it. Someone who joined as a replacement
 * signed up to the dates as they then were, so only the slip since counts for
 * them. The best known are likelier to go ("they are the good ones", 04 §9.6):
 * fame scales the roll - a stable reading, so nobody flips with each new booking.
 */
function movesOn(draft: FilmDraft, person: Person, totalSlip: number): boolean {
  const joinedAt = Math.max(0, ...(draft.crewChanges ?? []).filter((c) => c.replacementId === person.id).map((c) => c.atSlip ?? 0));
  const before = leaveShareForSlip(joinedAt);
  const share = (leaveShareForSlip(totalSlip) - before) / Math.max(1e-9, 1 - before);
  if (share <= 0) return false;
  const roll = keyedRoll(`${draft.preProduction?.seed ?? 0}|slip|${person.id}`);
  return roll * (1 + PREP_SLIP_FAME_WEIGHT * (0.5 - person.reputation.fame / 100)) < share;
}

export function applySlip(input: SlipInput): SlipResult {
  const { draft, oldEnd, newEnd, today } = input;
  const none = { draft, pool: input.pool, cash: 0, booksCost: 0, changes: [] };
  if (newEnd <= oldEnd) return none;
  const live = (a: TalentAssignment) => input.pool[professionForProductionRole(a.role)]?.find((p) => p.id === a.person.id) ?? a.person;
  const others = (p: Person) => p.availability.commitments.filter((c) => c.projectId !== draft.id);

  const leaving: Array<{ a: TalentAssignment; reason: CrewChange['reason']; clashing: PersonCommitment[] }> = [];
  for (const a of draft.talent) {
    if (UNMOVED_BY_SLIPS.has(a.role)) continue;
    const p = live(a);
    const elsewhere = others(p);
    const clashing = elsewhere.filter((c) => overlaps(c, oldEnd + 1, newEnd));
    if (clashing.length > 0) leaving.push({ a, reason: 'clash', clashing });
    else {
      const upcoming = elsewhere.filter((c) => c.endDay >= today);
      if (upcoming.length > 0 && movesOn(draft, p, input.totalSlip)) leaving.push({ a, reason: 'moved-on', clashing: [] });
    }
  }
  if (leaving.length === 0) return none;

  const pool = { ...input.pool };
  let talent = [...draft.talent];
  let cash = 0;
  let booksCost = 0;
  const changes: CrewChange[] = [];
  const onFilm = new Set(draft.talent.map((a) => a.person.id));
  const character = (a: TalentAssignment) => (a.characterId ? draft.script?.cast.find((c) => c.id === a.characterId) ?? null : null);
  for (const { a, reason, clashing } of leaving) {
    const profession = professionForProductionRole(a.role);
    const window: PersonCommitment = { projectId: draft.id, role: a.role, startDay: today, endDay: newEnd };
    const role = character(a);
    // The same hard gates a casting call applies: free for the new window, and
    // able to play the character (gender, and not absurdly outside its age).
    const free = (pool[profession] ?? []).filter(
      (p) => !onFilm.has(p.id) && isPersonAvailableForCommitment(p, window) && personMeetsCharacterGender(p, role) && personMeetsCharacterAge(p, role, today),
    );
    const replacement = findCandidatesNearPrice(free, a.role, assignmentCost(a), 1).candidates[0];
    if (!replacement) {
      // Nobody can replace them: buy them out of the clashing job and keep them.
      // That job is released, so the clash does not come back on the next slip.
      // (Someone only moving on, with no clash, simply stays.)
      if (reason !== 'clash') continue;
      const buyout = Math.round(assignmentCost(a) * PREP_SLIP_BUYOUT_RATE);
      cash += buyout;
      booksCost += buyout;
      const clashIds = new Set(clashing);
      pool[profession] = (pool[profession] ?? []).map((p) => (p.id === a.person.id ? { ...p, availability: { commitments: p.availability.commitments.filter((c) => !clashIds.has(c)) } } : p));
      changes.push({ day: today, role: a.role, leftName: a.person.identity.name, replacementName: null, cost: buyout, reason, acknowledged: false });
      continue;
    }
    const fee = getTypicalSalaryForRole(replacement, a.role);
    const owed = PAY_OR_PLAY.has(a.role) ? assignmentCost(a) : Math.round(assignmentCost(a) * input.worked);
    // Cash now: the replacement's fee, less what comes back of the departed's
    // (nothing for pay-or-play; the unworked part for crew).
    const refund = assignmentCost(a) - owed;
    cash += fee - refund;
    booksCost += owed;
    onFilm.add(replacement.id);
    pool[profession] = (pool[profession] ?? []).map((p) => {
      if (p.id === a.person.id) return { ...p, availability: { commitments: p.availability.commitments.filter((c) => c.projectId !== draft.id) } };
      if (p.id === replacement.id) return { ...p, availability: { commitments: [...p.availability.commitments, window] } };
      return p;
    });
    const replacedPerson = pool[profession].find((p) => p.id === replacement.id)!;
    const ageAtCasting = role ? personCastingAge(replacedPerson, today) : undefined;
    talent = talent.map((t) => (t === a ? { role: a.role, person: replacedPerson, ...(a.characterId ? { characterId: a.characterId } : {}), ...(ageAtCasting !== undefined ? { ageAtCasting } : {}) } : t));
    changes.push({ day: today, role: a.role, leftName: a.person.identity.name, replacementName: replacement.identity.name, cost: fee - refund, reason, acknowledged: false, replacementId: replacement.id, atSlip: input.totalSlip });
  }
  if (changes.length === 0) return none;
  return { draft: { ...draft, talent, crewChanges: [...(draft.crewChanges ?? []), ...changes] }, pool, cash, booksCost, changes };
}

/** Plain words for one change, for the prep log and the Inbox. */
export function crewChangeText(c: CrewChange): string {
  const why = c.reason === 'clash' ? 'their next job now overlaps the film' : 'the film slipped and they took confirmed work';
  const lead = c.role === 'Lead Actor' ? ' Losing a lead is the expensive case: the studio still owes the departing star.' : '';
  if (!c.replacementName) return `${c.leftName} (${c.role}) was bought out of another job to stay - ${why}, and nobody free could replace them.`;
  return `${c.leftName} (${c.role}) left - ${why}. ${c.replacementName} replaces them.${lead}`;
}
