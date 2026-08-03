// Post-release per-actor performance surfacing (the "was casting X good?" read).
//
// The engine already computes each cast member's realised performance to score
// a film (engine/scoring.ts:computeCastPerformances) and then throws the
// per-actor detail away, keeping only the film-wide actingScore. That left the
// player unable to tell whether casting a given actor was inspired, fine, or a
// mistake. This module reads those same per-actor numbers back out and turns
// each into a qualitative CATEGORY - a performance band plus the dominant CAUSE
// (a signature gift that fit the part, a director who unlocked or misfired, a
// straight miscast). Prose lives in castPerformancePresentation.ts, per the
// house split (engine returns a category; presentation owns the words) - this
// file stays pure, deterministic, and number-free at its output edge.
import type { ActingStyle, Person, Script, TalentAssignment } from '../types';
import { findAssignedPerson } from '../data/helpers';
import { computeCastPerformances, type CastMemberPerformance } from './scoring';
import {
  actorArchetype,
  directorActorPairing,
  explainRealizedPerformance,
  signatureGift,
  type ActorArchetype,
  type DirectorTouch,
  directorTouch,
  type PairingRead,
  type RealizedPerformanceBreakdown,
} from './actingModel';

/** How a single cast member's realised performance reads - good, neutral, or bad, in five bands. */
export type PerformanceBand = 'inspired' | 'strong' | 'solid' | 'weak' | 'poor';

/** The three-way colour a band carries on a card - the player's "good / neutral / bad" ask. */
export type PerformanceTone = 'good' | 'neutral' | 'bad';

/**
 * The dominant reason a performance landed where it did - the named cause that
 * makes a band explainable rather than a bare verdict (SIMULATION_PHILOSOPHY.md
 * Principle 4). Presentation turns each into a sentence, optionally naming the
 * actor's signature gift.
 */
export type PerformanceCause =
  | 'gift-realized' // a standout - their signature strength was what the part called for
  | 'director-unlocked' // a standout the director pulled out of them (strong pairing)
  | 'well-fitted' // a good turn from a natural fit, no single towering strength
  | 'steady' // a dependable, unremarkable performance
  | 'director-flat' // a director-dependent talent given too little direction - potential untapped
  | 'miscast' // the role pulled against what they do best (a fit failure)
  | 'director-misfire' // a mismatched director's read fought their instincts
  | 'limited'; // the part simply asked for more than they had to give

/** One cast member's qualitative post-release read - band, cause, and their gift axis (for naming), never a raw number. */
export interface CastPerformanceRead {
  personId: string;
  name: string;
  role: 'Lead Actor' | 'Supporting Actor';
  band: PerformanceBand;
  tone: PerformanceTone;
  cause: PerformanceCause;
  /** The actor's signature acting-style axis, when one stands out - lets presentation name the strength that was realised or wasted. */
  giftAxis: keyof ActingStyle | null;
}

// Band thresholds on the realised 0-100 performance. The scale is genre-neutral
// (genre changes how much acting MATTERS to quality, not the performance value
// itself), so these read the same across films: a well-cast, well-directed lead
// lands strong/inspired, a fit-gated miscast bottoms out poor. Tuned to the
// realistic spread the model produces (effFloor ~28-80, plus up to ~+40 of
// unlocked headroom): most solid casting sits 55-75.
const INSPIRED = 80;
const STRONG = 66;
const SOLID = 52;
const WEAK = 40;

function bandFor(performance: number): PerformanceBand {
  if (performance >= INSPIRED) return 'inspired';
  if (performance >= STRONG) return 'strong';
  if (performance >= SOLID) return 'solid';
  if (performance >= WEAK) return 'weak';
  return 'poor';
}

const BAND_TONE: Record<PerformanceBand, PerformanceTone> = {
  inspired: 'good',
  strong: 'good',
  solid: 'neutral',
  weak: 'bad',
  poor: 'bad',
};

// Role-fit tiers used to tell "miscast" (a fit failure) apart from "limited"
// (fit was fine, the craft just wasn't there). Aligned with the fit reads the
// casting card already shows, so the post-release story matches the pre-cast one.
const FIT_HIGH = 66;
const FIT_LOW = 48;

function causeFor(
  band: PerformanceBand,
  roleFit: number,
  pairing: PairingRead,
  directorDependent: boolean,
  hasGift: boolean,
): PerformanceCause {
  const fitHigh = roleFit >= FIT_HIGH;
  const fitLow = roleFit <= FIT_LOW;
  // A high-headroom talent whose director didn't pull the extra out of them -
  // the acting model's central "direction matters" case, worth naming on its own.
  const untappedByDirector = directorDependent && pairing !== 'strong';

  if (band === 'inspired' || band === 'strong') {
    if (hasGift && fitHigh) return 'gift-realized';
    if (pairing === 'strong') return 'director-unlocked';
    return 'well-fitted';
  }
  if (band === 'solid') {
    if (untappedByDirector) return 'director-flat';
    return 'steady';
  }
  // weak / poor
  if (fitLow) return 'miscast';
  if (pairing === 'risky') return 'director-misfire';
  if (untappedByDirector) return 'director-flat';
  return 'limited';
}

/** Turn one scored cast member (engine/scoring.ts) into its qualitative read - band + tone + named cause. */
export function readCastMemberPerformance(member: CastMemberPerformance, director: Person | undefined): CastPerformanceRead {
  const actor = member.assignment.person;
  const band = bandFor(member.performance);
  const gift = signatureGift(actor);
  const pairing = director ? directorActorPairing(director, actor) : 'neutral';
  const directorDependent = actorArchetype(actor) === 'director-dependent';
  const cause = causeFor(band, member.roleFit, pairing, directorDependent, gift !== null);
  return {
    personId: actor.id,
    name: actor.identity.name,
    role: member.role,
    band,
    tone: BAND_TONE[band],
    cause,
    giftAxis: gift?.axis ?? null,
  };
}

/**
 * Every cast member's post-release performance read for a finished film - the
 * per-actor answer to "was casting them a good call?", leads first then
 * supporting. Pure and deterministic: recomputed on demand from the film's own
 * talent + script (both stored on Film), so nothing per-actor need be persisted.
 */
export function readCastPerformances(talent: TalentAssignment[], script: Script): CastPerformanceRead[] {
  const director = findAssignedPerson(talent, 'Director');
  return computeCastPerformances(talent, script).map((m) => readCastMemberPerformance(m, director));
}

// --- Dev-only decomposition -------------------------------------------------
// The full numeric story behind each performance, for the dev inspectors
// (ReleaseResults' balancing panel, OutcomeInspector) - the player only ever
// sees the qualitative read above; this is where a developer reads *exactly*
// how well an actor did and why. Raw numbers throughout, by design.

/** One cast member's raw performance decomposition plus the qualitative read the player sees - dev views only. */
export interface CastPerformanceDetail {
  personId: string;
  name: string;
  role: 'Lead Actor' | 'Supporting Actor';
  roleFit: number; // 0-100, the fit that gated floor & headroom
  breakdown: RealizedPerformanceBreakdown; // every term behind the realised number
  archetype: ActorArchetype; // dependable / director-dependent / all-rounder
  pairing: PairingRead; // director<->actor tonal match (strong / neutral / risky)
  directorTouch: DirectorTouch | null; // hands-on / balanced / hands-off (null when no director)
  giftAxis: keyof ActingStyle | null;
  read: CastPerformanceRead; // the band + cause the player is shown
}

/**
 * Every cast member's full numeric performance breakdown for a film - the raw
 * dev-inspector view. Pure and deterministic like readCastPerformances, just
 * without hiding the numbers.
 */
export function explainCastPerformances(talent: TalentAssignment[], script: Script): CastPerformanceDetail[] {
  const director = findAssignedPerson(talent, 'Director');
  return computeCastPerformances(talent, script).map((m) => {
    const actor = m.assignment.person;
    return {
      personId: actor.id,
      name: actor.identity.name,
      role: m.role,
      roleFit: m.roleFit,
      breakdown: explainRealizedPerformance(actor, director, m.roleFit),
      archetype: actorArchetype(actor),
      pairing: director ? directorActorPairing(director, actor) : 'neutral',
      directorTouch: director ? directorTouch(director) : null,
      giftAxis: signatureGift(actor)?.axis ?? null,
      read: readCastMemberPerformance(m, director),
    };
  });
}
