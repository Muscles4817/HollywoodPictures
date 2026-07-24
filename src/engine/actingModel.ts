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
import { ACTING_STYLE_AXES } from '../data/actingStyle';
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

// --- Signature gift: what an actor is uniquely good at ---------------------
//
// The card's whole "why hire X over Y" problem is that role fit - a per-role
// number - dominates, and everything that makes an actor a distinct *person*
// stays buried. An actor's acting style is spiky by construction
// (talentGenerator.ts:generateSignatureProfile rolls 1-2 signature axes high),
// so most actors HAVE a standout - a thing they're known for, independent of
// any one role. Surfacing it turns "a 4.5-star role fit" into "a magnetic
// comic talent" - an identity the player remembers, not a score they sort by.

/** An actor's standout acting-style axis - the thing they're known for - when one clearly stands out. */
export interface SignatureGift {
  axis: keyof ActingStyle;
  /** 'defining' - a towering, single signature; 'notable' - a real strength, but not their whole identity. */
  tier: 'defining' | 'notable';
}

const GIFT_NOTABLE = 62; // below this on every axis, no single standout - a rounded (or simply limited) actor
const GIFT_DEFINING = 78; // a towering signature...
const GIFT_LEAD_GAP = 10; // ...that also clears the next-best axis by this much (a single signature, not a two-way tie)

/**
 * The acting-style axis an actor is uniquely gifted at, if one clearly stands
 * out - the "known for X" read, independent of any specific role (unlike role
 * fit). null for a rounded or simply limited actor with no standout axis, and
 * for non-actors. Derived from the same ActingStyle the performance model reads,
 * so it never disagrees with what the actor can actually do.
 */
export function signatureGift(person: Person): SignatureGift | null {
  const style = getActorCareer(person)?.actingStyle;
  if (!style) return null;
  const ranked = ACTING_STYLE_AXES.map((axis) => ({ axis, value: style[axis] })).sort((a, b) => b.value - a.value);
  const [top, second] = ranked;
  if (top.value < GIFT_NOTABLE) return null;
  const tier = top.value >= GIFT_DEFINING && top.value - second.value >= GIFT_LEAD_GAP ? 'defining' : 'notable';
  return { axis: top.axis, tier };
}

// --- Fame vs craft: the marquee-vs-performance trade ------------------------
//
// Fame and craft are already generated on separate axes (fame from the salary
// band, craft from the fame-independent style/seed - see deriveCraftSeeded), so
// the two genuinely diverge. That divergence IS the trade-off the design wants a
// player to feel (docs/DESIGN_REVIEW_acting_model.md §7): a famous coaster buys
// an opening weekend, an undiscovered talent buys quality cheaply. This names it
// when it's real, and stays quiet when fame and craft roughly agree.

/** Where an actor's fame and their craft ceiling notably diverge - the trade a savvy player reads. */
export type FameCraftContrast = 'coaster' | 'undiscovered' | 'star-and-craft';

const FAME_HIGH = 62;
const FAME_LOW = 40;
const PEAK_CRAFT_HIGH = 80; // best achievable craft (floor + fully-unlocked headroom)
const PEAK_CRAFT_LOW = 68;

/**
 * How an actor's fame lines up against their craft ceiling: a famous 'coaster'
 * (name outruns craft), an 'undiscovered' talent (craft outruns name), or a
 * genuine 'star-and-craft' (both high). null when the two roughly agree - there's
 * no notable trade to point out - and for non-actors. Craft ceiling is
 * floor+headroom (the best a great director could unlock), so a high-headroom
 * unknown reads as undiscovered even though their self-directed floor is modest.
 */
export function fameCraftContrast(person: Person): FameCraftContrast | null {
  const career = getActorCareer(person);
  if (!career) return null;
  const fame = person.reputation.fame;
  const { floor, headroom } = actorCraft(person);
  const peakCraft = clamp(floor + headroom, 0, 100);
  const fameHigh = fame >= FAME_HIGH;
  const fameLow = fame <= FAME_LOW;
  const craftHigh = peakCraft >= PEAK_CRAFT_HIGH;
  const craftLow = peakCraft <= PEAK_CRAFT_LOW;
  if (fameHigh && craftLow) return 'coaster';
  if (fameLow && craftHigh) return 'undiscovered';
  if (fameHigh && craftHigh) return 'star-and-craft';
  return null;
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
