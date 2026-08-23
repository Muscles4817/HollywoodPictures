// Can the cast actually come back? (docs/REFERENCE_post_production_economics.md
// section 5, "Cast availability and recall premiums".)
//
// Additional photography was priced but never REFUSED: a reshoot could always
// be bought, given enough cash. Real productions frequently cannot buy one at
// any price, because the principals contracted elsewhere the moment this film
// wrapped and are physically on another set. That is the single most common
// reason a studio fixes a bad preview in the edit instead of reshooting it.
//
// This is the same perishable-commitment idea as project clocks
// (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md section 3.1), landing
// in post: the package the film assembled at greenlight has since dispersed, and
// what the studio can still do about a bad screening depends on who it can get
// back. Rivals genuinely compete for the same people
// (engine/rivalStudios.ts books from the shared pool), so this is a real
// consequence of a real market, not a die roll.
//
// Derived ON DEMAND rather than frozen into the stored PendingEventChoice: a
// player can sit on a screening decision for weeks, and who is free changes
// underneath them while they do. Both the UI and the reducer's authoritative
// guard call this, so they can never disagree.
//
// Pure: plain data in, plain data out.
import type { FilmDraft, GameDay, Money, Person, ProductionRole, TalentProfession } from '../types';
import { filterAssignedPeople, professionForProductionRole } from '../data/helpers';
import { getTypicalSalaryForRole, isPersonAvailableForCommitment } from './person';

/** Which principals an editing option needs back in front of a camera, and for how long. */
export interface ReshootRequirement {
  roles: readonly ProductionRole[];
  filmingDays: number;
}

/**
 * Keyed by EventChoiceTemplate id. Only options involving new PHOTOGRAPHY appear
 * here - a re-edit needs nobody back, which is exactly why it stays available
 * when a reshoot cannot happen. Kept in step with engine/testScreening.ts's own
 * PICKUPS / MAJOR_RESHOOTS specs, which price the same work.
 */
export const RESHOOT_REQUIREMENTS: Record<string, ReshootRequirement> = {
  pickups: { roles: ['Lead Actor'], filmingDays: 4 },
  'major-reshoots': { roles: ['Lead Actor', 'Supporting Actor', 'Director'], filmingDays: 16 },
};

export interface ReshootBlocker {
  personId: string;
  name: string;
  role: ProductionRole;
  /** The first day they are clear of the work holding them up. */
  freeFromDay: GameDay;
  /** Days of their other commitment still to run. Drives whether, and at what price, they can be released. */
  remainingDays: number;
  /** What the other production would want to release them - null when they cannot be moved at any price. */
  buyOutCost: Money | null;
}

/** Releasing every blocked principal - available only when each of them individually can be. */
export interface ReshootBuyOut {
  /** Cash on top of the option's own cost. */
  cost: Money;
  names: string[];
}

export interface ReshootAvailability {
  available: boolean;
  /** Who cannot make the window, and when they free up. Empty when available. */
  blockers: ReshootBlocker[];
  /** The earliest day the whole required group could actually start - `from` when they are all free now. */
  earliestStartDay: GameDay;
  /**
   * Buying every blocked principal out of their other job, or null when at
   * least one of them cannot be moved at any price. Null when nothing is
   * blocked, too - there is nothing to buy.
   */
  buyOut: ReshootBuyOut | null;
}

// --- Buying a principal out ------------------------------------------------
// (docs/REFERENCE_post_production_economics.md section 5, option 2.)
//
// A studio can sometimes pay the other production to release someone for a
// fortnight. What it is really paying for is that production's DISRUPTION - its
// idle crew days, its schedule rework - so the price tracks how much of their
// commitment is still to run, and past a point no money is enough, because the
// ask stops being "let them go early" and becomes "shut your film down".
//
// That ceiling is the whole design. If a buy-out always worked, refusal would
// collapse back into a price and time would be buyable with cash again - which
// is exactly the failure the project-clocks work exists to avoid
// (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md section 2,
// "incommensurable scarcity"). Sometimes the answer has to be no.

/** Past this many days still to run on their other job, no money moves them - you would be shutting that production down. */
const MAX_BUY_OUT_REMAINING_DAYS = 30;
/** Share of their per-film fee to release someone who is nearly finished elsewhere... */
const BUY_OUT_MIN_RATE = 0.15;
/** ...and to release someone right at the ceiling, with a month still to run. */
const BUY_OUT_MAX_RATE = 0.75;

/**
 * What the other production wants to let this person go, or null when the
 * disruption is too deep to buy. Scales from BUY_OUT_MIN_RATE to
 * BUY_OUT_MAX_RATE of their own fee across how much of their commitment remains -
 * so buying out someone who wraps next week is a formality, and someone with a
 * month left is ruinous.
 */
function buyOutCostFor(person: Person, role: ProductionRole, remainingDays: number): Money | null {
  if (remainingDays > MAX_BUY_OUT_REMAINING_DAYS) return null;
  const depth = Math.min(1, Math.max(0, remainingDays / MAX_BUY_OUT_REMAINING_DAYS));
  const rate = BUY_OUT_MIN_RATE + (BUY_OUT_MAX_RATE - BUY_OUT_MIN_RATE) * depth;
  return Math.round(getTypicalSalaryForRole(person, role) * rate);
}

/**
 * The live Person for an assignment. FilmDraft.talent holds SNAPSHOTS taken when
 * each person was hired, so their commitments there predate everything that has
 * happened since - including this film's own greenlight booking and any rival's
 * later one. Reading the live pool is what makes the check mean anything, and
 * it mirrors how GREENLIGHT_PROJECT already resolves its own cast.
 */
function livePerson(person: Person, talentPool: Record<TalentProfession, Person[]>, role: ProductionRole): Person {
  return talentPool[professionForProductionRole(role)]?.find((t) => t.id === person.id) ?? person;
}

/**
 * Whether `choiceId` can actually be taken on `from`, given who is free.
 * Returns null for options needing no new photography (a re-edit, accepting the
 * cut, reverting) - they are never blocked by availability.
 */
export function reshootAvailability(
  draft: FilmDraft,
  talentPool: Record<TalentProfession, Person[]>,
  from: GameDay,
  choiceId: string,
): ReshootAvailability | null {
  const requirement = RESHOOT_REQUIREMENTS[choiceId];
  if (!requirement) return null;

  const blockers: ReshootBlocker[] = [];
  for (const role of requirement.roles) {
    for (const assigned of filterAssignedPeople(draft.talent, role)) {
      const person = livePerson(assigned, talentPool, role);
      const proposed = { projectId: draft.id, role, startDay: from, endDay: from + requirement.filmingDays };
      if (isPersonAvailableForCommitment(person, proposed)) continue;
      // Only OTHER projects hold someone up - this film's own commitment is
      // what they were doing here, and isPersonAvailableForCommitment already
      // ignores it by projectId for the same reason.
      const clashingEnd = person.availability.commitments
        .filter((c) => c.projectId !== draft.id && c.startDay <= proposed.endDay && c.endDay >= proposed.startDay)
        .reduce((latest, c) => Math.max(latest, c.endDay), from);
      const remainingDays = Math.max(0, clashingEnd - from + 1);
      blockers.push({
        personId: person.id,
        name: person.identity.name,
        role,
        freeFromDay: clashingEnd + 1,
        remainingDays,
        buyOutCost: buyOutCostFor(person, role, remainingDays),
      });
    }
  }

  // All or nothing: one principal who cannot be moved closes photography off
  // however affordable everyone else is, because you cannot shoot the scene
  // without them.
  const everyoneMovable = blockers.length > 0 && blockers.every((b) => b.buyOutCost !== null);
  return {
    available: blockers.length === 0,
    blockers,
    earliestStartDay: blockers.reduce((latest, b) => Math.max(latest, b.freeFromDay), from),
    buyOut: everyoneMovable
      ? {
          cost: blockers.reduce((sum, b) => sum + (b.buyOutCost ?? 0), 0),
          names: blockers.map((b) => b.name),
        }
      : null,
  };
}

/** A one-line, player-facing account of why a reshoot cannot happen as planned - named causes, never a bare refusal. */
export function describeReshootBlockers(availability: ReshootAvailability): string {
  const names = availability.blockers.map((b) => `${b.name} (${b.role})`);
  const who =
    names.length === 1 ? names[0]
    : names.length === 2 ? `${names[0]} and ${names[1]}`
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const are = availability.blockers.length === 1 ? 'is' : 'are';
  const base = `${who} ${are} shooting elsewhere — not free until day ${availability.earliestStartDay}.`;
  return availability.buyOut
    ? `${base} Their production would release ${availability.blockers.length === 1 ? 'them' : 'them all'} for a price.`
    : `${base} ${availability.blockers.length === 1 ? 'That production' : 'Those productions'} cannot let ${availability.blockers.length === 1 ? 'them' : 'them'} go at any price.`;
}

/**
 * What stands in the way of each editing option right now, keyed by choice id -
 * the shape components/common/OnSetDecisionCard.tsx renders directly.
 *
 * A constraint is either a hard refusal (`blocked`) or a surcharge the option
 * can still be taken at (`surcharge`), never both. Recomputed on each render
 * rather than stored, so the card always reflects who is free TODAY.
 */
export interface ReshootConstraint {
  /** True when the option cannot be taken at all right now. */
  blocked: boolean;
  /** Cash on top of the option's own cost, when it can be taken by buying people out. */
  surcharge?: Money;
  /** The player-facing explanation, shown either way. */
  note: string;
}

export function reshootChoiceConstraints(
  draft: FilmDraft,
  talentPool: Record<TalentProfession, Person[]>,
  from: GameDay,
): Record<string, ReshootConstraint> {
  const constraints: Record<string, ReshootConstraint> = {};
  for (const choiceId of Object.keys(RESHOOT_REQUIREMENTS)) {
    const availability = reshootAvailability(draft, talentPool, from, choiceId);
    if (!availability || availability.available) continue;
    constraints[choiceId] = availability.buyOut
      ? { blocked: false, surcharge: availability.buyOut.cost, note: describeReshootBlockers(availability) }
      : { blocked: true, note: describeReshootBlockers(availability) };
  }
  return constraints;
}

/**
 * The buy-out cash this option needs on top of its own rolled cost - 0 when
 * nobody is blocked. Returns null when the option cannot be taken at all, which
 * the reducer treats as a refusal.
 */
export function reshootSurcharge(
  draft: FilmDraft,
  talentPool: Record<TalentProfession, Person[]>,
  from: GameDay,
  choiceId: string,
): Money | null {
  const availability = reshootAvailability(draft, talentPool, from, choiceId);
  if (!availability || availability.available) return 0;
  return availability.buyOut ? availability.buyOut.cost : null;
}
