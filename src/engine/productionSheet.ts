import { ALL_TALENT_ROLES, MANDATORY_TALENT_ROLES } from '../data/talentGeneration';
import { assignmentCost } from './person';
import { characterForRoleSlot } from './castRequirements';
import { CHARACTER_ARCHETYPE_LABELS } from '../data/scriptTagLabels';
import { TALENT_PRESENTATION } from '../data/talentPresentation';
import { estimateDelivery } from './deliveryEstimate';
import { effectivePairChemistry, pairHistory } from './pairHistory';
import type { FilmDraft, Person, ProductionRole, ProjectWorkspaceSection, ScriptCharacter, TalentPairing } from '../types';

/**
 * The production sheet's contents, derived rather than laid out.
 *
 * The workspace used to be five tabs, which cost the player the two things a
 * package screen is for: they could not see the shape of the decision, and
 * they could not see where the holes were - you had to open Cast & Crew to
 * discover you had no composer. The sheet shows every slot at once, so this
 * function's only job is to say what the slots ARE and what state each is in.
 *
 * Pure, and separate from the component, for the usual reason: what counts as
 * a slot, and what counts as filled, is a rule about the game rather than a
 * detail of rendering - so it is testable without a DOM, and the sheet cannot
 * quietly disagree with the readiness meter about whether something is done.
 */

export type SlotState =
  /** Filled, and nothing more is needed. */
  | 'set'
  /** Empty and required before greenlight. */
  | 'open'
  /** Empty, allowed to stay empty - shown so its absence is a visible choice rather than an oversight. */
  | 'optional';

export interface SheetSlot {
  id: string;
  /** What the slot is for - the printed label on the form. */
  label: string;
  state: SlotState;
  /** Who or what occupies it, or null while it is still a blank rule. */
  occupant: string | null;
  /** What it costs, where the slot has a cost at all. */
  cost: number | null;
  /** The one thing worth saying about this slot right now. */
  note: string | null;
  /** Where the depth for this slot lives. */
  section: ProjectWorkspaceSection;
  /** For a person slot, the role whose drawer this opens. */
  role?: ProductionRole;
  /** For a cast slot, the specific character being cast. */
  characterId?: string;
}

export interface SheetGroup {
  /** The form's own headings - printed once, in this order, always. */
  title: 'Above the line' | 'Below the line' | 'The plan' | 'The release';
  /**
   * Which of the form's two columns this group is printed in. Data rather than
   * layout because the groups are wildly uneven - four slots above the line
   * against ten below - and a plain two-column grid row-aligns them, leaving a
   * column of dead paper under the short one. Pairing a short group with a
   * long one is a decision about the form, so it lives with the form.
   */
  column: 1 | 2;
  slots: SheetSlot[];
}

/** Cast and the director are the names that sell the picture; the rest is the crew list. */
const ABOVE_THE_LINE: ProductionRole[] = ['Director', 'Lead Actor', 'Supporting Actor', 'Writer'];

function castingSlots(draft: FilmDraft, role: 'Lead Actor' | 'Supporting Actor'): SheetSlot[] {
  const prominence = role === 'Lead Actor' ? 'Lead' : 'Supporting';
  const characters: ScriptCharacter[] = (draft.script?.cast ?? []).filter((c: ScriptCharacter) => c.prominence === prominence);

  // No script characters at this prominence: fall back to one unnamed slot, so
  // the form still shows the hole rather than silently omitting the role.
  if (characters.length === 0) {
    const hired = draft.talent.filter((a) => a.role === role);
    if (hired.length === 0) {
      return [{ id: `role:${role}`, label: role, state: 'open', occupant: null, cost: null, note: 'No character written for this slot', section: 'cast-and-crew', role }];
    }
    return hired.map((a) => ({
      id: `role:${role}:${a.person.id}`,
      label: role,
      state: 'set' as const,
      occupant: a.person.identity.name,
      cost: assignmentCost(a),
      note: null,
      section: 'cast-and-crew' as const,
      role,
    }));
  }

  // Assignments made before slot binding (and rival/legacy ones) carry no
  // characterId, and the documented reader behaviour is to fall back to the
  // positional mapping - Script.cast guarantees Lead-then-Supporting order, so
  // the nth hire in a role is the nth character of that prominence
  // (engine/castRequirements.ts). Without this the sheet shows an empty slot
  // for somebody who is actually cast, and disagrees with readiness, which
  // counts hires against the required number rather than against bindings.
  const unbound = draft.talent.filter((a) => a.role === role && a.characterId === undefined);
  const positional = new Map<string, (typeof unbound)[number]>();
  unbound.forEach((assignment, index) => {
    const character = draft.script ? characterForRoleSlot(draft.script, role, index) : null;
    if (character) positional.set(character.id, assignment);
  });

  return characters.map((character) => {
    const hired =
      draft.talent.find((a) => a.role === role && a.characterId === character.id) ?? positional.get(character.id);
    return {
      id: `character:${character.id}`,
      label: character.name,
      state: hired ? ('set' as const) : ('open' as const),
      occupant: hired ? hired.person.identity.name : null,
      cost: hired ? assignmentCost(hired) : null,
      // The written label, never the enum: a raw `TragicVillain` is an internal
      // value, and player-facing text does not show those (CLAUDE.md). Same
      // table the casting brief and the IP library already read from.
      note: hired ? null : `${role} · ${CHARACTER_ARCHETYPE_LABELS[character.archetype]}`,
      section: 'cast-and-crew' as const,
      role,
      characterId: character.id,
    };
  });
}

function crewSlot(draft: FilmDraft, role: ProductionRole): SheetSlot {
  const hired = draft.talent.find((a) => a.role === role);
  const required = MANDATORY_TALENT_ROLES.includes(role);
  return {
    id: `role:${role}`,
    label: role,
    state: hired ? 'set' : required ? 'open' : 'optional',
    occupant: hired ? hired.person.identity.name : null,
    cost: hired ? assignmentCost(hired) : null,
    note: hired ? null : required ? null : 'Optional',
    section: 'cast-and-crew',
    role,
  };
}

export function deriveProductionSheet(draft: FilmDraft): SheetGroup[] {
  const aboveTheLine: SheetSlot[] = [
    crewSlot(draft, 'Director'),
    ...castingSlots(draft, 'Lead Actor'),
    ...castingSlots(draft, 'Supporting Actor'),
    crewSlot(draft, 'Writer'),
  ];

  const belowTheLine: SheetSlot[] = ALL_TALENT_ROLES.filter((role) => !ABOVE_THE_LINE.includes(role)).map((role) => crewSlot(draft, role));

  belowTheLine.push({
    id: 'stunt-team',
    label: 'Stunt Team',
    state: draft.stuntTeamId ? 'set' : 'optional',
    occupant: draft.stuntTeamId ? 'Attached' : null,
    cost: null,
    note: draft.stuntTeamId ? null : 'Optional',
    section: 'production',
  });

  const producerCount = draft.attachedProducerIds?.length ?? 0;
  belowTheLine.push({
    id: 'producers',
    label: 'Producers',
    state: producerCount > 0 ? 'set' : 'optional',
    occupant: producerCount > 0 ? `${producerCount} attached` : null,
    cost: null,
    note: producerCount > 0 ? null : 'Optional',
    section: 'producers',
  });

  const plan: SheetSlot[] = [
    {
      id: 'title',
      label: 'Title',
      state: draft.title.trim() ? 'set' : 'open',
      occupant: draft.title.trim() || null,
      cost: null,
      note: draft.title.trim() ? null : 'Still using the script’s own name',
      section: 'overview',
    },
    {
      id: 'audience',
      label: 'Target audience',
      state: draft.targetAudience ? 'set' : 'open',
      occupant: draft.targetAudience,
      cost: null,
      note: null,
      section: 'overview',
    },
    {
      id: 'production-plan',
      label: 'Production plan',
      state: draft.productionChoices ? 'set' : 'open',
      occupant: draft.productionChoices ? 'Planned' : null,
      cost: null,
      note: draft.productionChoices ? null : 'Shoot length and spend follow from this',
      section: 'production',
    },
    {
      id: 'cast-budget',
      label: 'Cast & crew budget',
      state: draft.castCrewBudget != null ? 'set' : 'optional',
      occupant: draft.castCrewBudget != null ? 'Set' : null,
      cost: draft.castCrewBudget ?? null,
      note: draft.castCrewBudget != null ? null : 'Per-role targets stay manual until this is set',
      section: 'cast-and-crew',
    },
  ];

  const release: SheetSlot[] = [
    {
      id: 'release-date',
      label: 'Release date',
      state: draft.announcedReleaseDay != null ? 'set' : 'optional',
      occupant: draft.announcedReleaseDay != null ? 'Announced' : null,
      cost: null,
      note: draft.announcedReleaseDay != null ? null : 'Unannounced — the film keeps full flexibility',
      section: 'overview',
    },
    {
      id: 'campaign',
      label: 'Campaign',
      state: draft.campaignCommitment ? 'set' : 'optional',
      occupant: draft.campaignCommitment ? 'Booked' : null,
      cost: draft.campaignCommitment?.amount ?? null,
      note: draft.campaignCommitment ? null : 'Nothing booked yet',
      section: 'overview',
    },
  ];

  return [
    { title: 'Above the line', column: 1, slots: aboveTheLine },
    { title: 'The plan', column: 1, slots: plan },
    { title: 'Below the line', column: 2, slots: belowTheLine },
    { title: 'The release', column: 2, slots: release },
  ];
}

/** The counts the readiness meter renders as segments. */
export function summariseSheet(groups: SheetGroup[]): { set: number; open: number; optional: number; total: number } {
  const slots = groups.flatMap((g) => g.slots);
  return {
    set: slots.filter((s) => s.state === 'set').length,
    open: slots.filter((s) => s.state === 'open').length,
    optional: slots.filter((s) => s.state === 'optional').length,
    total: slots.length,
  };
}

/* ------------------------------------------------------------------------
   WHAT AN EMPTY SLOT SAYS

   A blank line on the form is the least informative thing on the sheet, and
   it is also where the whole simulation is hiding. Compatibility, pair
   history, creative tension and director appeal are surfaced only inside the
   two hiring drawers - the player sees them at the instant they hire someone
   and never again, so the package's relational shape is invisible on the very
   screen meant to be its map.

   Three readings of one absence, all derived from what the engines already
   return rather than from anything new:

     · what holding it open costs
     · which relationships cannot be read until it is filled
     · when it has to be filled to keep the date the film has claimed

   And one reading of a presence, which is the same problem from the other
   side: a filled slot says who is in it and nothing about how they sit with
   everybody else already attached.
   ------------------------------------------------------------------------ */

/** Whose chemistry a given role is read against - mirrors engine/creativeTension.ts's own pairing rules exactly. */
function partnersFor(role: ProductionRole, draft: FilmDraft): Person[] {
  const of = (r: ProductionRole) => draft.talent.filter((a) => a.role === r).map((a) => a.person);
  const principals = [...of('Lead Actor'), ...of('Supporting Actor')];
  const director = of('Director')[0];

  switch (role) {
    // performancePairs: the director against each principal. craftPairs: the
    // director against their editor and cinematographer.
    case 'Director':
      return [...principals, ...of('Editor'), ...of('Cinematographer')];
    // performancePairs: this actor against the director, and against every
    // other principal already cast.
    case 'Lead Actor':
    case 'Supporting Actor':
      return [...(director ? [director] : []), ...principals];
    // craftPairs: only against the director.
    case 'Editor':
    case 'Cinematographer':
      return director ? [director] : [];
    default:
      return [];
  }
}

export interface SlotReading {
  /** What holding this slot open costs, in words. Null when it costs nothing. */
  blocks: string | null;
  /** How many chemistry pairings cannot be read at all until somebody is in this slot. */
  unreadablePairs: number;
  /** The last day this can be filled without the announced date slipping. Null when no date is claimed. */
  offerNeededBy: number | null;
}

export function readOpenSlot(slot: SheetSlot, draft: FilmDraft, today: number): SlotReading | null {
  if (slot.state === 'set') return null;

  const mandatory = slot.state === 'open';
  // An optional slot blocks nothing, so what it "costs" is simply the thing
  // that role does, quoted verbatim from the copy the hiring drawer already
  // shows. Deliberately not reworded into an absence ("No one ...") - the
  // hooks are not all verb phrases, and transforming them produced sentences
  // like "No one optional - only matters for effects-heavy films".
  const blocks = slot.role
    ? mandatory
      ? 'Holds the shoot'
      : TALENT_PRESENTATION[slot.role].hook
    : mandatory
      ? 'Holds the greenlight'
      : null;

  // An optional slot never holds the shoot, so it never has a deadline of its
  // own - only the mandatory ones burn the film's slack by staying open.
  const estimate = mandatory ? estimateDelivery(draft, today) : null;
  const offerNeededBy = estimate?.slackDays != null && estimate.slackDays > 0 ? today + estimate.slackDays : null;

  return {
    blocks,
    unreadablePairs: slot.role ? partnersFor(slot.role, draft).length : 0,
    offerNeededBy,
  };
}

export interface FilledSlotReading {
  /** How this person sits with the people already attached, in words. Null when there is nothing worth saying. */
  chemistry: string | null;
  /** How many of their pairings on this film they have a real track record on. */
  provenPairings: number;
}

export function readFilledSlot(slot: SheetSlot, draft: FilmDraft, pairings: TalentPairing[]): FilledSlotReading | null {
  if (slot.state !== 'set' || !slot.role) return null;
  const person = draft.talent.find(
    (a) => a.role === slot.role && (slot.characterId ? a.characterId === slot.characterId : true) && a.person.identity.name === slot.occupant,
  )?.person;
  if (!person) return null;

  const partners = partnersFor(slot.role, draft).filter((p) => p.id !== person.id);
  if (partners.length === 0) return { chemistry: null, provenPairings: 0 };

  const histories = partners.map((partner) => pairHistory(pairings, person.id, partner.id)).filter((h): h is NonNullable<typeof h> => h !== null);
  const worst = partners.reduce<{ partner: Person; value: number } | null>((acc, partner) => {
    const value = effectivePairChemistry(person, partner, pairings);
    return acc === null || value < acc.value ? { partner, value } : acc;
  }, null);
  const best = partners.reduce<{ partner: Person; value: number } | null>((acc, partner) => {
    const value = effectivePairChemistry(person, partner, pairings);
    return acc === null || value > acc.value ? { partner, value } : acc;
  }, null);

  // Qualitative, and named rather than numeric (CLAUDE.md): the player is told
  // who the relationship is with and which way it runs, never the scalar.
  let chemistry: string | null = null;
  if (worst && worst.value <= -CHEMISTRY_NOTE_THRESHOLD) chemistry = `Friction with ${worst.partner.identity.name}`;
  else if (best && best.value >= CHEMISTRY_NOTE_THRESHOLD) chemistry = `Works well with ${best.partner.identity.name}`;

  return { chemistry, provenPairings: histories.length };
}

/** Below this, a pairing is ordinary enough not to be worth a line on the form. */
const CHEMISTRY_NOTE_THRESHOLD = 0.35;

/* ------------------------------------------------------------------------
   THE DESK'S READ

   One line, in the game's own voice, about where this package actually
   stands - take 04's trade-paper narration rationed to a single sentence.
   Rationed is the whole point: a paper that editorialises on every row is
   noise, and one that says nothing is a spreadsheet.

   Derived, never authored per-project: it reads the same slots the form does,
   so it cannot say the package is cast while the form shows six blank lines.
   ------------------------------------------------------------------------ */

export function deskRead(draft: FilmDraft, groups: SheetGroup[]): string {
  const slots = groups.flatMap((g) => g.slots);
  const openOf = (label: string) => slots.some((s) => s.label === label && s.state === 'open');
  const filled = (role: ProductionRole) => draft.talent.some((a) => a.role === role);
  const principals = draft.talent.filter((a) => a.role === 'Lead Actor' || a.role === 'Supporting Actor').length;
  const { set, open } = summariseSheet(groups);

  if (set === 0) return 'A screenplay and a blank call sheet. Nothing is attached and nothing is spent.';
  if (open === 0) return 'Every line on this sheet is filled. What happens next is a signature.';

  // The two cases where the package is lopsided in a way worth naming - a
  // director with nobody to point at, or a cast with nobody directing them.
  if (filled('Director') && principals === 0) return 'A director signed to a picture with no one in it yet.';
  if (principals > 0 && openOf('Director')) return 'A cast assembling around a chair nobody is sitting in.';

  // Deliberately no counts from here on. The readiness meter directly above
  // already owns the arithmetic, and the first cut had the voice saying "6 of
  // 13 lines filled" while the meter said "6 of 21 set" - two different
  // denominators, because the voice was counting only required slots. A
  // second scoreboard that can contradict the first is worse than no
  // scoreboard; the voice's job is the reading, not the tally.
  if (draft.announcedReleaseDay !== undefined) {
    return 'A date is claimed and the sheet is not finished. The calendar will not wait.';
  }
  if (open <= 2) return 'Nearly there. A short list of blanks stands between this and a signature.';
  return 'The picture is taking shape. Nothing is promised yet, and nothing is spent.';
}
