// People decide (docs/DESIGN_talent_model.md §4.7, stage 8).
//
// Everything before this treated people as things that get hired. They are also
// the ones choosing. Four things are added to what a person weighs, the same
// way for everyone and whoever is offering:
//
//   - What it does for them. Everyone has a type, read from what they have
//     done lately. Someone content likes their type and takes it gladly; an
//     ambitious person with some standing tires of the fourth version of the
//     part that made them and goes looking for the one that stretches them,
//     even for less money.
//   - Whether it is beneath them: a big name with an ego and a small part or a
//     small film. Waived for a stretch they want.
//   - Whether they want to work at all: a break after too many films back to
//     back or a bomb that was pinned on them.
//   - Where they are in their career: working, then selective, then
//     semi-retired, at an age that is their own. Leaving the business follows
//     from the last phase (engine/careerTurnover.ts).
//
// A director they revere or a studio they are close to can still coax someone
// off a break or out of retirement. Deterministic: decisions are hashed from
// who they are and what they were offered, never drawn from the shared stream.

import type { ActingStyle, Person, RecentWork, ScriptCharacter, ScriptScale } from '../types';
import { ACTING_STYLE_AXES } from '../data/actingStyle';
import { ACTING_STYLE_TO_CHARACTER_TRAIT } from './compatibility';
import { gameDateFromTotalDays, formatGameDateWithMonth, DAYS_PER_YEAR } from './calendar';
import { hashUnit } from './random';
import { getPriorCredits } from './person';

// --- Tunables ----------------------------------------------------------------

/** The age people start to slow down, before their own temperament and luck move it. Directors peak late (docs/domain/12 §4.7). */
export const SLOWDOWN_AGE = { actor: 59, director: 67, crew: 59 } as const;
/** How far ambition moves it, and how far it varies person to person, in years. */
const AMBITION_YEARS = 5;
const PERSONAL_SPREAD_YEARS = 12;
/** An action star has to change type or stop sooner. */
const PHYSICAL_TYPE_YEARS = 5;
/** Years from selective to semi-retired. */
export const SEMI_RETIRE_AFTER = 7;

/** Films kept in the recent record. */
const RECENT_WORK_KEPT = 6;
/** Standing (the higher of fame and heat) from which someone can afford to be choosy about their type. */
export const ESTABLISHED_STANDING = 45;
const AMBITIOUS = 60;
const CONTENT = 45;
/** Tired of a type: per film in the current run, and at most. */
const TYPECAST_PER_FILM = 4;
const MAX_TYPECAST = 16;
const GLAD_OF_THE_WORK = 5;
const WANTS_THE_STRETCH = 8;
/** An ambitious person takes a stretch for less (docs/domain/12 §4.6). */
export const STRETCH_FLOOR_DISCOUNT = 0.85;
/** A big name with an ego, offered something small. */
const BIG_NAME = 70;
const EGO_FOR_BENEATH = 60;
const BENEATH_PER_STEP = 7;
/** Selective: the part and the people matter more, so an ordinary offer appeals less. */
const SELECTIVE_PENALTY = 8;

/** Breaks: a base chance after any film, more for each film past two in two years, and after a bomb pinned on them. */
const BREAK_BASE = 0.03;
const BREAK_PER_EXTRA_FILM = 0.07;
const BUSY_WINDOW_DAYS = 2 * DAYS_PER_YEAR;
const BREAK_AFTER_BLAME = 0.2;
const BREAK_LATE_CAREER = 0.05;
/** The driven and the professional keep going. */
const DRIVE_DAMPING = 0.6;
const BREAK_MIN_DAYS = 150;
const BREAK_EXTRA_DAYS = 400;

/** How tempting an offer must be to bring someone off a break, or out of retirement. */
const LURE_FOR_BREAK = 0.7;
const LURE_FOR_RETIRED = 0.6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const COUNT_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

// --- Phases ------------------------------------------------------------------

export type CareerPhase = 'working' | 'selective' | 'semi-retired';

function ageOn(person: Person, day: number): number | null {
  const born = person.identity.dateOfBirth;
  return born ? gameDateFromTotalDays(day).year - born.year : null;
}

function slowdownBase(person: Person): number {
  if (person.primaryRole === 'Actor') return SLOWDOWN_AGE.actor;
  if (person.primaryRole === 'Director') return SLOWDOWN_AGE.director;
  return SLOWDOWN_AGE.crew;
}

/** The age this particular person starts to slow down. */
export function slowdownAge(person: Person): number {
  const ambition = ((person.personality.ambition - 50) / 50) * AMBITION_YEARS;
  const luck = (hashUnit(`${person.id}|slowdown`) - 0.5) * PERSONAL_SPREAD_YEARS;
  const physical = person.careers.actor && actorType(person).axis === 'physicalPerformance' ? PHYSICAL_TYPE_YEARS : 0;
  return slowdownBase(person) + ambition + luck - physical;
}

/** Working, selective or semi-retired, on this day. Someone with no recorded age is working. */
export function careerPhase(person: Person, day: number): CareerPhase {
  const age = ageOn(person, day);
  if (age === null) return 'working';
  const from = slowdownAge(person);
  if (age >= from + SEMI_RETIRE_AFTER) return 'semi-retired';
  if (age >= from) return 'selective';
  return 'working';
}

export function isOnBreak(person: Person, day: number): boolean {
  return person.breakUntilDay !== undefined && person.breakUntilDay > day;
}

// --- Type --------------------------------------------------------------------

export interface ActorType {
  /** What they are known for: the attribute their parts lean on. */
  axis: keyof ActingStyle;
  /** How many of their most recent parts in a row were that. */
  run: number;
  /** Read from films made in this world, rather than inferred from their strengths. */
  fromRecord: boolean;
}

/** The attribute a part leans on most. */
export function partAxis(character: ScriptCharacter): keyof ActingStyle {
  let best: keyof ActingStyle = ACTING_STYLE_AXES[0];
  for (const axis of ACTING_STYLE_AXES) {
    if (character.traits[ACTING_STYLE_TO_CHARACTER_TRAIT[axis]] > character.traits[ACTING_STYLE_TO_CHARACTER_TRAIT[best]]) best = axis;
  }
  return best;
}

/**
 * An actor's type: what their recent parts have mostly leaned on. With too
 * little record in this world it is what they are naturally strongest at, and
 * an established veteran is assumed to have been doing it for a while.
 */
export function actorType(person: Person): ActorType {
  const parts = (person.recentWork ?? []).map((w) => w.part).filter((p): p is keyof ActingStyle => p !== undefined);
  if (parts.length >= 2) {
    const counts = new Map<keyof ActingStyle, number>();
    for (const p of parts) counts.set(p, (counts.get(p) ?? 0) + 1);
    // Most common; ties go to the most recent.
    const axis = parts.reduce((best, p) => ((counts.get(p) ?? 0) > (counts.get(best) ?? 0) ? p : best), parts[0]);
    let run = 0;
    while (run < parts.length && parts[run] === axis) run += 1;
    return { axis, run, fromRecord: true };
  }
  const style = person.careers.actor?.actingStyle;
  const axis = style ? ACTING_STYLE_AXES.reduce((best, a) => (style[a] > style[best] ? a : best), ACTING_STYLE_AXES[0]) : 'charisma';
  const veteran = getPriorCredits(person) >= 8 && standing(person) >= ESTABLISHED_STANDING;
  const run = parts.length === 1 && parts[0] === axis ? 1 : 0;
  return { axis, run: veteran ? Math.max(run, 2) : run, fromRecord: false };
}

const TYPE_NOUN: Record<keyof ActingStyle, string> = {
  characterTransformation: 'transformation',
  emotionalPerformance: 'dramatic',
  charisma: 'charm-led',
  comedy: 'comic',
  physicalPerformance: 'action',
};

function standing(person: Person): number {
  return Math.max(person.reputation.fame, person.reputation.currentHeat);
}

// --- What they weigh ---------------------------------------------------------

export type CareerPullReason = 'typecast' | 'beneath' | 'selective';

export interface CareerPull {
  /** Added to how appealing the offer is. */
  delta: number;
  /** The biggest thing against it, when there is one. */
  reason: CareerPullReason | null;
  /** One line for the card: why this offer pulls or pushes. Never numbers. */
  note: string | null;
  /** This is the stretch they are after: they will take it for less. */
  stretch: boolean;
}

export interface OfferShape {
  /** For an actor, what the part leans on. */
  axis?: keyof ActingStyle;
  scale: ScriptScale;
  /** A lead part (or the director's chair), rather than a supporting one. */
  lead: boolean;
}

const NO_PULL: CareerPull = { delta: 0, reason: null, note: null, stretch: false };

/** How the offer sits with where this person is in their career. */
export function careerPull(person: Person, offer: OfferShape, day: number): CareerPull {
  const { ambition, ego } = person.personality;
  const established = standing(person) >= ESTABLISHED_STANDING;
  let delta = 0;
  let reason: CareerPullReason | null = null;
  let note: string | null = null;
  let stretch = false;

  if (offer.axis && person.careers.actor) {
    const type = actorType(person);
    if (offer.axis === type.axis) {
      if (ambition >= AMBITIOUS && established && type.run >= 2) {
        delta -= Math.min(MAX_TYPECAST, TYPECAST_PER_FILM * type.run);
        reason = 'typecast';
        note = type.fromRecord
          ? `Has played ${COUNT_WORD[type.run] ?? type.run} ${TYPE_NOUN[type.axis]} parts running and wants something else.`
          : `Known for ${TYPE_NOUN[type.axis]} parts and tired of them.`;
      } else if (ambition < CONTENT) {
        delta += GLAD_OF_THE_WORK;
        note = "Glad of the work: it's what they do.";
      }
    } else if (ambition >= AMBITIOUS && established) {
      delta += WANTS_THE_STRETCH;
      stretch = true;
      note = 'Wants exactly this: something different from what made their name.';
    }
  }

  if (!stretch && standing(person) >= BIG_NAME && ego >= EGO_FOR_BENEATH) {
    const steps = (offer.scale === 'Intimate' ? 1 : 0) + (offer.lead ? 0 : 1);
    if (steps > 0) {
      const d = -steps * BENEATH_PER_STEP * ((ego - 40) / 60);
      delta += d;
      if (!reason) {
        reason = 'beneath';
        note = offer.lead ? 'Thinks a film this size is beneath them.' : 'Thinks a part this size is beneath them.';
      }
    }
  }

  if (careerPhase(person, day) === 'selective') {
    delta -= SELECTIVE_PENALTY;
    if (!reason) reason = 'selective';
    if (!note) note = 'Works rarely now, and only for the right project.';
  }

  return delta === 0 && !note ? NO_PULL : { delta, reason, note, stretch };
}

export type UnwillingReason = 'on-break' | 'retired';

export interface Unwilling {
  reason: UnwillingReason;
  text: string;
}

/**
 * How tempting an offer is beyond its terms, 0..1: a director they revere, or
 * a studio they are close to. What it takes to coax someone back.
 */
export function offerLure(director: Person | undefined, warmth: number): number {
  const revered = director ? clamp((director.reputation.industryRespect - 60) / 30, 0, 1) : 0;
  const close = clamp(warmth / 60, 0, 1);
  return Math.max(revered, close);
}

/** A hard no before terms are even read: on a break, or retired, and the offer is not enough to change that. */
export function unwillingToWork(person: Person, day: number, lure = 0): Unwilling | null {
  if (isOnBreak(person, day) && lure < LURE_FOR_BREAK) {
    return { reason: 'on-break', text: `Taking time away from films until ${formatGameDateWithMonth(person.breakUntilDay!)}.` };
  }
  if (careerPhase(person, day) === 'semi-retired' && lure < LURE_FOR_RETIRED) {
    return { reason: 'retired', text: 'Says they have retired. People say that.' };
  }
  return null;
}

/** Where they are, for the card. Null for someone simply working. */
export function describeCareerStatus(person: Person, day: number): string | null {
  if (isOnBreak(person, day)) return `Taking time away from films until ${formatGameDateWithMonth(person.breakUntilDay!)}.`;
  const phase = careerPhase(person, day);
  if (phase === 'semi-retired') return 'Says they have retired. People say that. The right director might change their mind.';
  if (phase === 'selective') return 'Works rarely now, and only for the right project.';
  return null;
}

// --- After a film --------------------------------------------------------------

/** Add a finished film to their record. */
export function recordWork(person: Person, work: RecentWork): Person {
  return { ...person, recentWork: [work, ...(person.recentWork ?? [])].slice(0, RECENT_WORK_KEPT) };
}

/**
 * Whether a film that just finished sends them on a break, and until when.
 * Read after the film is in their record. Undefined: they carry on.
 */
export function decideBreak(person: Person, filmId: string, day: number): number | undefined {
  if (isOnBreak(person, day)) return undefined;
  const recent = (person.recentWork ?? []).filter((w) => day - w.day <= BUSY_WINDOW_DAYS);
  const blamed = recent[0]?.blamed ?? false;
  const age = ageOn(person, day);
  let chance = BREAK_BASE + BREAK_PER_EXTRA_FILM * Math.max(0, recent.length - 2) + (blamed ? BREAK_AFTER_BLAME : 0) + (age !== null && age >= 60 ? BREAK_LATE_CAREER : 0);
  const drive = (person.personality.professionalism + person.personality.ambition) / 200;
  chance *= 1 - DRIVE_DAMPING * drive;
  if (hashUnit(`${person.id}|break|${filmId}`) >= chance) return undefined;
  return day + BREAK_MIN_DAYS + Math.floor(hashUnit(`${person.id}|break-length|${filmId}`) * BREAK_EXTRA_DAYS);
}

/** A person someone can approach today: not on a break, not retired. For rivals and the crew pool, which have no lure to offer. */
export function isTakingWork(person: Person, day: number): boolean {
  return unwillingToWork(person, day) === null;
}
