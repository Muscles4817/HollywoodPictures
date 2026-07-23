// Acting Model (docs/DESIGN_REVIEW_acting_model.md).
//
// An actor has a reliable FLOOR (what they deliver self-directed) and a
// director-unlockable HEADROOM (extra a director can pull out). A director's
// HANDS-ON-NESS is leverage on the director<->actor match: a hands-on director
// unlocks a high-headroom actor on a good match, but drags a performance BELOW
// its floor on a bad one. A hands-off director leaves the actor at their floor,
// regardless of match. Role-fit gates the headroom fully (you can't unlock a
// great performance in the wrong role) and the floor partially.
//
// The point of the model: direction genuinely matters (per-actor, not a flat
// constant), fame != craft (craft is independent of fame/salary), and the two
// actor types' curves cross - the dependable pro wins without a director, the
// auteur-magnet wins with the right one.
import type { ActingStyle, Person } from '../types';
import { computeActorAbility } from '../types';
import { getActorCareer, getDirectorCareer } from './person';
import { computeCompatibility, deriveToneFromActingStyle } from './compatibility';
import { clamp } from './random';

// --- Tunables --------------------------------------------------------------

/** Role-fit's grip on the reliable floor: a miscast actor keeps this fraction of it (a pro is still decent slightly off-type). Headroom, by contrast, is gated by fit in full. */
const FIT_FLOOR_GATE = 0.7;
/** Even a hands-off director provides a little unlock (a good environment, a few notes); hands-on-ness scales up from here. Kept small so a hands-off director leaves a performance genuinely near its floor - the aim barely moves the needle - which is the whole point of the hands-on axis. */
const BASE_INFLUENCE = 0.12;
/** A forcefully-imposed *wrong* read hurts, but less than a right one helps - the negative side of aim is scaled down, keeping the tails asymmetric. */
const MISMATCH_PENALTY_SCALE = 0.6;
/** The most performance a director can unlock on top of the floor. */
const HEADROOM_CAP = 45;

// --- Craft (floor + headroom), decoupled from fame -------------------------

// Floor is a fame-independent map of overall craft; headroom is driven by the
// style's spikiness. Both are derived from actingStyle, which the generator
// draws from rng ALONE (never the salary/fame band) and the handcrafted roster
// authors to reflect real skill - so craft is decoupled from fame either way,
// and "the most famous and expensive" has no automatic claim on the best craft.
const FLOOR_MIN = 40;
const FLOOR_ABILITY_SPAN = 52; // ability~[30,65] -> floor ~[40, 78]
/** Bigger spikiness multiplier so a one-note specialist's ceiling clears a dependable all-rounder's: it's what makes the two archetypes' curves cross. */
const HEADROOM_SPIKINESS_SCALE = 62;

/**
 * Craft (floor + headroom) derived from an actor's acting style - the single
 * source of truth, used for every actor (the generator and the handcrafted
 * roster both just author the style; §9 of the design doc calls for deriving
 * craft "from their existing stats").
 *
 * Floor is the self-directed baseline: it rises with overall craft (mean ability
 * across the style axes), fame-independent because the style itself is. Headroom
 * is what a director can unlock on top, driven by the style's SPIKINESS - a
 * specialist with one towering strength has more locked potential than a
 * well-rounded pro. The two are distinct axes of the same profile (mean vs
 * spread): a maxed-everywhere actor is high-floor/low-headroom (a dependable
 * pro), a one-note specialist is lower-floor/high-headroom (a director-dependent
 * magnet whose best clears the pro's) - which is what makes their curves cross.
 */
export function deriveCraftFromStyle(style: ActingStyle): { floor: number; headroom: number } {
  const ability = computeActorAbility(style); // fame-independent (style is rng/authored, never the salary band)
  const dims = [style.characterTransformation, style.emotionalPerformance, style.charisma, style.comedy, style.physicalPerformance];
  const variance = Math.sqrt(dims.reduce((s, d) => s + (d - ability) ** 2, 0) / dims.length);

  const floor = clamp(FLOOR_MIN + ((ability - 30) / 35) * FLOOR_ABILITY_SPAN, FLOOR_MIN, 80);
  const spikiness = clamp(variance / 32, 0, 1);
  const headroom = clamp(3 + spikiness * HEADROOM_SPIKINESS_SCALE, 3, HEADROOM_CAP);
  return { floor, headroom };
}

/**
 * Craft (floor + headroom) from three independent [0,1) units - floor and
 * headroom as INDEPENDENT axes. A triangular floor centred mid-scale (two units
 * averaged) and a right-skewed headroom (a squared unit) so MOST actors are
 * low-headroom (dependable, director-agnostic) while a minority carry the large
 * headroom of a director-dependent magnet - the two only rarely both maxed, the
 * archetype spread §9 calls for.
 */
function craftFromUnits(floorA: number, floorB: number, head: number): { floor: number; headroom: number } {
  const floor = 44 + ((floorA + floorB) / 2) * 36; // triangular, 44-80, centred ~62
  const headroom = clamp(3 + head ** 2 * 42, 3, HEADROOM_CAP); // right-skewed, most low
  return { floor, headroom };
}

/**
 * Craft for a generated actor, derived from a stable seed string via id-hash -
 * NOT from the rng stream, so authoring craft doesn't shift every downstream
 * draw (which would silently reshuffle the whole talent pool and break unrelated
 * seed-specific tests). Deterministic (same seed -> same craft), and decoupled
 * from fame: the seed is built from fame-INDEPENDENT entropy (the acting style),
 * and hashing erases any magnitude relationship regardless. Style-spikiness is
 * deliberately not the driver - the style generator makes every actor spiky,
 * which would saturate a spikiness-based headroom and erase the dependable-pro
 * archetype; independent hash units restore the full 2D craft space.
 * (Handcrafted talent instead derives craft from its authored style - see
 * deriveCraftFromStyle.)
 */
export function deriveCraftSeeded(seed: string): { floor: number; headroom: number } {
  return craftFromUnits(stableUnit(`${seed}:fa`), stableUnit(`${seed}:fb`), stableUnit(`${seed}:hd`));
}

/** An actor's craft floor + headroom - the authored values when present, else a fame-independent default. */
export function actorCraft(person: Person): { floor: number; headroom: number } {
  const career = getActorCareer(person);
  if (!career) return { floor: 40, headroom: 8 };
  if (career.craftFloor != null && career.craftHeadroom != null) {
    return { floor: career.craftFloor, headroom: Math.min(career.craftHeadroom, HEADROOM_CAP) };
  }
  return deriveCraftFromStyle(career.actingStyle);
}

// --- Director hands-on-ness -------------------------------------------------

/** A stable 0..1 value from an id - a deterministic stand-in for an unauthored trait (not rng; same person always reads the same). */
function stableUnit(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // >>> 0 to unsigned, then to [0,1).
  return ((h >>> 0) % 100000) / 100000;
}

/** Hands-on-ness from a single [0,1) unit - the shared curve, centred a little below neutral with real spread. */
export function deriveHandsOnFromUnit(unit: number): number {
  return clamp(0.25 + unit * 0.6, 0, 1);
}

/** Hands-on-ness for a generated director, from a stable seed string via id-hash (no rng consumption, so authoring it doesn't shift the downstream stream) - deterministic and stable per director. */
export function deriveHandsOnSeeded(seed: string): number {
  return deriveHandsOnFromUnit(stableUnit(seed));
}

/** How forcefully a director shapes performances (0..1). Authored value when present, else a stable per-director default (hand-tune the marquee names later). */
export function directorHandsOn(person: Person): number {
  const career = getDirectorCareer(person);
  if (!career) return 0.5;
  if (career.handsOn != null) return clamp(career.handsOn, 0, 1);
  return deriveHandsOnFromUnit(stableUnit(person.id));
}

// --- Qualitative reads (engine returns a category; presentation owns the prose) ---

/** The player-facing craft archetype an actor reads as. */
export type ActorArchetype = 'dependable' | 'director-dependent' | 'all-rounder';
/** A director's approach to shaping performances. */
export type DirectorTouch = 'hands-on' | 'balanced' | 'hands-off';
/** How a specific director<->actor pairing reads on the tonal match that drives the unlock. */
export type PairingRead = 'strong' | 'neutral' | 'risky';

const MAGNET_HEADROOM = 25; // at/above this, the director-dependent magnet archetype
const DEPENDABLE_HEADROOM = 15; // below this (and a solid floor), a dependable pro
const DEPENDABLE_FLOOR = 60;

/** Which craft archetype an actor reads as, from their floor + headroom (see the design doc's 2D craft space). */
export function actorArchetype(person: Person): ActorArchetype {
  const { floor, headroom } = actorCraft(person);
  if (headroom >= MAGNET_HEADROOM) return 'director-dependent';
  if (floor >= DEPENDABLE_FLOOR && headroom < DEPENDABLE_HEADROOM) return 'dependable';
  return 'all-rounder';
}

/** How forcefully a director shapes performances, as a band. */
export function directorTouch(person: Person): DirectorTouch {
  const h = directorHandsOn(person);
  if (h >= 0.6) return 'hands-on';
  if (h <= 0.35) return 'hands-off';
  return 'balanced';
}

/** How a director<->actor pairing reads (the tonal match that signs the unlock: a strong match unlocks headroom, a mismatch risks dragging below floor). */
export function directorActorPairing(director: Person, actor: Person): PairingRead {
  const style = getActorCareer(actor)?.actingStyle;
  if (!style) return 'neutral';
  const aim = directorActorAim(director, style); // [-1, 1]
  if (aim >= 0.25) return 'strong';
  if (aim <= -0.2) return 'risky';
  return 'neutral';
}

// --- The unlock ------------------------------------------------------------

/** How well the director's approach suits THIS actor (director ToneProfile vs the actor's derived tone), centred: +1 a strong match, -1 a confident mismatch, 0 neutral. */
function directorActorAim(director: Person | undefined, actorStyle: ActingStyle): number {
  const dc = director && getDirectorCareer(director);
  if (!dc) return 0;
  const match = computeCompatibility(dc.toneProfile, deriveToneFromActingStyle(actorStyle)); // 0-100
  return clamp((match - 50) / 50, -1, 1);
}

/**
 * The performance an actor actually delivers on this film - the heart of the
 * model. Starts from the fit-gated floor, then a director's PUSH (hands-on-ness
 * x skill) moves it toward the fit-gated headroom, signed by AIM: a well-aimed
 * push unlocks the headroom (a career-best), a mis-aimed one drags the
 * performance below its floor (a confidently wrong read). A hands-off director
 * (low push) leaves it near the floor regardless of match.
 *
 * `roleFit` is the actor<->role suitability on a 0-100 scale (the existing
 * style<->script<->character fit) - it gates the available headroom in full and
 * the floor in part, so a brilliant actor badly miscast still underdelivers.
 */
export function computeRealizedPerformance(actor: Person, director: Person | undefined, roleFit: number): number {
  const { floor, headroom } = actorCraft(actor);
  const fit = clamp(roleFit / 100, 0, 1);

  const effFloor = floor * (FIT_FLOOR_GATE + (1 - FIT_FLOOR_GATE) * fit);
  const availHeadroom = headroom * fit;

  const skill = (director && getDirectorCareer(director)?.skill) ?? 50;
  const handsOn = director ? directorHandsOn(director) : 0.5;
  const push = (BASE_INFLUENCE + handsOn * (1 - BASE_INFLUENCE)) * (skill / 100);

  const actorStyle = getActorCareer(actor)?.actingStyle;
  const aim = actorStyle ? directorActorAim(director, actorStyle) : 0;
  const signedAim = aim >= 0 ? aim : aim * MISMATCH_PENALTY_SCALE;

  return clamp(effFloor + availHeadroom * push * signedAim, 0, 100);
}
