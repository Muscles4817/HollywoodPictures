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
import type { FilmDraft, GameDay, Person, ProductionRole, TalentProfession } from '../types';
import { filterAssignedPeople, professionForProductionRole } from '../data/helpers';
import { isPersonAvailableForCommitment } from './person';

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
}

export interface ReshootAvailability {
  available: boolean;
  /** Who cannot make the window, and when they free up. Empty when available. */
  blockers: ReshootBlocker[];
  /** The earliest day the whole required group could actually start - `from` when they are all free now. */
  earliestStartDay: GameDay;
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
      blockers.push({ personId: person.id, name: person.identity.name, role, freeFromDay: clashingEnd + 1 });
    }
  }

  return {
    available: blockers.length === 0,
    blockers,
    earliestStartDay: blockers.reduce((latest, b) => Math.max(latest, b.freeFromDay), from),
  };
}

/** A one-line, player-facing account of why a reshoot cannot happen - named causes, never a bare refusal. */
export function describeReshootBlockers(availability: ReshootAvailability): string {
  const names = availability.blockers.map((b) => `${b.name} (${b.role})`);
  const who =
    names.length === 1 ? names[0]
    : names.length === 2 ? `${names[0]} and ${names[1]}`
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${who} ${availability.blockers.length === 1 ? 'is' : 'are'} shooting elsewhere — not free until day ${availability.earliestStartDay}.`;
}

/**
 * Every currently-blocked editing option, as `choiceId -> player-facing reason` -
 * the shape components/common/OnSetDecisionCard.tsx renders directly. An empty
 * object means nothing is blocked. Recomputed on each render rather than stored,
 * so the card always reflects who is free TODAY.
 */
export function blockedReshootChoices(
  draft: FilmDraft,
  talentPool: Record<TalentProfession, Person[]>,
  from: GameDay,
): Record<string, string> {
  const blocked: Record<string, string> = {};
  for (const choiceId of Object.keys(RESHOOT_REQUIREMENTS)) {
    const availability = reshootAvailability(draft, talentPool, from, choiceId);
    if (availability && !availability.available) blocked[choiceId] = describeReshootBlockers(availability);
  }
  return blocked;
}
