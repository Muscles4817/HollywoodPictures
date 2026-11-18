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
import { PREP_SLIP_BUYOUT_RATE, PREP_SLIP_LEAVE_SHARE } from '../../data/prep';
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
  cash: number;
  changes: CrewChange[];
}

const PAY_OR_PLAY: ReadonlySet<ProductionRole> = new Set(['Director', 'Lead Actor', 'Supporting Actor']);

export function leaveShareForSlip(totalSlip: number): number {
  return PREP_SLIP_LEAVE_SHARE.find((b) => totalSlip >= b.minDays)?.share ?? 0;
}

const overlaps = (c: PersonCommitment, start: number, end: number) => c.startDay <= end && start <= c.endDay;

export function applySlip(input: SlipInput): SlipResult {
  const { draft, oldEnd, newEnd, today } = input;
  if (newEnd <= oldEnd) return { draft, pool: input.pool, cash: 0, changes: [] };
  const live = (a: TalentAssignment) => input.pool[professionForProductionRole(a.role)]?.find((p) => p.id === a.person.id) ?? a.person;
  const others = (p: Person) => p.availability.commitments.filter((c) => c.projectId !== draft.id);

  const clash: TalentAssignment[] = [];
  const inDemand: TalentAssignment[] = [];
  for (const a of draft.talent) {
    const p = live(a);
    const elsewhere = others(p);
    if (elsewhere.some((c) => overlaps(c, oldEnd + 1, newEnd))) clash.push(a);
    else if (elsewhere.some((c) => c.endDay >= today)) inDemand.push(a);
  }
  const ranked = [...inDemand].sort(
    (x, y) => others(live(y)).length - others(live(x)).length || live(y).reputation.fame - live(x).reputation.fame || x.person.id.localeCompare(y.person.id),
  );
  const movedOn = ranked.slice(0, Math.round(leaveShareForSlip(input.totalSlip) * ranked.length));
  const leaving = [...clash.map((a) => ({ a, reason: 'clash' as const })), ...movedOn.map((a) => ({ a, reason: 'moved-on' as const }))];
  if (leaving.length === 0) return { draft, pool: input.pool, cash: 0, changes: [] };

  let pool = { ...input.pool };
  let talent = [...draft.talent];
  let cash = 0;
  const changes: CrewChange[] = [];
  const onFilm = new Set(draft.talent.map((a) => a.person.id));
  for (const { a, reason } of leaving) {
    const profession = professionForProductionRole(a.role);
    const window: PersonCommitment = { projectId: draft.id, role: a.role, startDay: today, endDay: newEnd };
    const free = (pool[profession] ?? []).filter((p) => !onFilm.has(p.id) && isPersonAvailableForCommitment(p, window));
    const replacement = findCandidatesNearPrice(free, a.role, assignmentCost(a), 1).candidates[0];
    if (!replacement) {
      // Nobody free: buy them out of the other job and keep them.
      const buyout = Math.round(assignmentCost(a) * PREP_SLIP_BUYOUT_RATE);
      cash += buyout;
      changes.push({ day: today, role: a.role, leftName: a.person.identity.name, replacementName: null, cost: buyout, reason, acknowledged: false });
      continue;
    }
    const fee = getTypicalSalaryForRole(replacement, a.role);
    const refund = PAY_OR_PLAY.has(a.role) ? 0 : Math.round(assignmentCost(a) * (1 - input.worked));
    cash += fee - refund;
    onFilm.add(replacement.id);
    pool[profession] = (pool[profession] ?? []).map((p) => {
      if (p.id === a.person.id) return { ...p, availability: { commitments: p.availability.commitments.filter((c) => c.projectId !== draft.id) } };
      if (p.id === replacement.id) return { ...p, availability: { commitments: [...p.availability.commitments, window] } };
      return p;
    });
    const replacedPerson = pool[profession].find((p) => p.id === replacement.id)!;
    talent = talent.map((t) => (t === a ? { role: a.role, person: replacedPerson, characterId: a.characterId } : t));
    changes.push({ day: today, role: a.role, leftName: a.person.identity.name, replacementName: replacement.identity.name, cost: fee - refund, reason, acknowledged: false });
  }
  return { draft: { ...draft, talent, crewChanges: [...(draft.crewChanges ?? []), ...changes] }, pool, cash, changes };
}

/** Plain words for one change, for the prep log and the Inbox. */
export function crewChangeText(c: CrewChange): string {
  const why = c.reason === 'clash' ? 'their next job now overlaps the film' : 'the film slipped and they took confirmed work';
  const lead = c.role === 'Lead Actor' ? ' Losing a lead is the expensive case: the studio still owes the departing star.' : '';
  if (!c.replacementName) return `${c.leftName} (${c.role}) had to be bought out of another job to stay - ${why}.`;
  return `${c.leftName} (${c.role}) left - ${why}. ${c.replacementName} replaces them.${lead}`;
}
