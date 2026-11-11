// Star power, phase 1 (docs/DESIGN_REVIEW_star_power.md §3.1): DRAW, derived.
//
// Fame (Person.reputation.fame) is recognition. Draw, computed here, is how
// many people go to a film because of this person - per genre, 0..1. It is
// built from three things the research names (docs/domain/17 §4.2, §3.3):
//
//   readiness  - a steep curve on fame: nobody below the floor has draw, and
//                it rises sharply only through the 90s.
//   proof      - the lead record in this genre (openings, recency-weighted,
//                pre-sold films credited less), falling back to persona fit
//                and a little spillover from other genres where there is none.
//   heat       - current momentum, a modest swing either way.
//
// draw = readiness x proof x heat factor.
//
// Pure: no rng, no state. Where an actor has no stored record yet (phase 3
// writes one), a stable SEEDED record is derived from who they are, hashed off
// their identity so the same person always reads the same. Nothing here
// touches the box office yet - phase 2 wires draw in.
import { getPersonAge, type ActingStyle, type ActorCareer, type Genre, type LeadOuting, type Person } from '../types';
import { GENRES } from '../data/genres';
import {
  BANKABLE_DRAW,
  DRAW_FAME_EXPONENT,
  DRAW_FAME_FLOOR,
  DRAW_HEAT_SWING,
  HEAT_MOMENTUM_SPAN,
  GENRE_PERSONA_WEIGHTS,
  LEAD_RECORD_LENGTH,
  PERSONA_PROOF_WEIGHT,
  PRESOLD_CREDIT_DISCOUNT,
  RECORD_CONFIDENCE_HALF,
  RECORD_RECENCY_DECAY,
  RECORD_SPILLOVER_WEIGHT,
  SEEDED_RECORD,
} from '../data/starPower';
import { getActorCareer } from './person';
import { clamp, hashUnit } from './random';

/** Fame's contribution to draw, 0..1: zero at or below the floor, convex above it. */
export function fameReadiness(fame: number): number {
  const t = clamp((fame - DRAW_FAME_FLOOR) / (100 - DRAW_FAME_FLOOR), 0, 1);
  return t ** DRAW_FAME_EXPONENT;
}

/** Heat's multiplier on draw, read as momentum against standing: 1 at heat == fame, 1 +/- DRAW_HEAT_SWING at +/-HEAT_MOMENTUM_SPAN. */
export function heatFactor(currentHeat: number, fame: number): number {
  return 1 + DRAW_HEAT_SWING * clamp((currentHeat - fame) / HEAT_MOMENTUM_SPAN, -1, 1);
}

/** How well this acting style suits a genre's persona, 0..1. */
export function personaFit(style: ActingStyle, genre: Genre): number {
  const weights = GENRE_PERSONA_WEIGHTS[genre];
  let sum = 0;
  let total = 0;
  for (const [key, weight] of Object.entries(weights) as [keyof ActingStyle, number][]) {
    sum += style[key] * weight;
    total += weight;
  }
  return total > 0 ? clamp(sum / total / 100, 0, 1) : 0;
}

/** Genres ordered best persona fit first. Ties keep GENRES order, so the result is stable. */
function genresByPersonaFit(style: ActingStyle): Genre[] {
  return [...GENRES].sort((a, b) => personaFit(style, b) - personaFit(style, a));
}

/** The string every hashed roll for this person is salted with: identity, not the run-order-dependent id. */
function identitySalt(person: Person): string {
  const dob = person.identity.dateOfBirth;
  return `star:${person.identity.name}:${dob ? `${dob.year}-${dob.month}-${dob.day}` : 'x'}`;
}

/** The game's day-one date; DOBs are expressed relative to it (types: PersonIdentity). */
const GAME_START = { year: 1, month: 1, day: 1 };

/**
 * Years of lead career before the game starts, as a 0..1 share of a full
 * record. Read from age at game start, so the world opens with its
 * established draws older (`17` §4.2: the top tier is small and ageing) -
 * they have had the years to build a record. Without a DOB, falls back to
 * experience.
 */
function careerShare(person: Person, career: ActorCareer): number {
  const age = getPersonAge(person.identity.dateOfBirth, GAME_START);
  if (age === undefined) return clamp(career.experience / 100, 0, 1);
  return clamp((age - SEEDED_RECORD.careerStartAge) / SEEDED_RECORD.fullRecordYears, 0, 1);
}

/**
 * A stable stand-in for the lead record an actor would have had before the
 * game starts. Outing count ramps with fame and career length; scores centre on
 * fame (famous people mostly got famous by opening films) with hashed noise,
 * so some famous names come out unproven and a few lesser ones come out
 * solid. Genres follow persona: mostly the best fit, sometimes the second.
 * Newest outing last, matching how phase 3 will append.
 */
export function deriveSeededLeadRecord(person: Person, career: ActorCareer): LeadOuting[] {
  const { fame } = person.reputation;
  const s = SEEDED_RECORD;
  const leadReach = clamp((fame - s.leadFameFloor) / s.leadFameSpan, 0, 1);
  const count = Math.round(LEAD_RECORD_LENGTH * leadReach * careerShare(person, career));
  if (count === 0) return [];

  const salt = identitySalt(person);
  const [best, second] = genresByPersonaFit(career.actingStyle);
  const centre = (fame - s.scoreFameCentre) / s.scoreFameSpan;
  // A per-person bias as well as per-outing noise: a career is a pattern,
  // not five independent coin flips.
  const personBias = (hashUnit(`${salt}:bias`) * 2 - 1) * s.scoreNoise;

  const record: LeadOuting[] = [];
  for (let i = 0; i < count; i++) {
    const noise = (hashUnit(`${salt}:score:${i}`) * 2 - 1) * s.scoreNoise * 0.6;
    record.push({
      day: 0,
      genre: hashUnit(`${salt}:genre:${i}`) < s.bestGenreShare ? best : second,
      openingScore: clamp(centre + personBias + noise, -1, 1),
      presold: hashUnit(`${salt}:presold:${i}`) * s.maxPresold,
    });
  }
  return record;
}

/** The record draw reads: the stored one when phase 3 has written it, else the seeded one. */
export function leadRecordOf(person: Person): LeadOuting[] {
  const career = getActorCareer(person);
  if (!career) return [];
  return career.leadRecord ?? deriveSeededLeadRecord(person, career);
}

interface GenreRecordRead {
  /** Credit-weighted mean opening score mapped to 0..1 (0.5 = an ordinary opening). */
  value: number;
  /** n / (n + RECORD_CONFIDENCE_HALF), on credit-weighted outings. */
  confidence: number;
}

/** The record's read for one genre, or null if no outings in it. */
function readGenreRecord(record: LeadOuting[], genre: Genre): GenreRecordRead | null {
  let weightedScore = 0;
  let weightTotal = 0;
  let effectiveCount = 0;
  // Newest last: walk backwards so recency weight starts at 1.
  let recency = 1;
  for (let i = record.length - 1; i >= 0; i--) {
    const outing = record[i];
    if (outing.genre === genre) {
      const credit = 1 - PRESOLD_CREDIT_DISCOUNT * clamp(outing.presold, 0, 1);
      const w = recency * credit;
      weightedScore += outing.openingScore * w;
      weightTotal += w;
      effectiveCount += credit;
    }
    recency *= RECORD_RECENCY_DECAY;
  }
  if (weightTotal <= 0) return null;
  const meanScore = weightedScore / weightTotal;
  return {
    value: clamp((meanScore + 1) / 2, 0, 1),
    confidence: effectiveCount / (effectiveCount + RECORD_CONFIDENCE_HALF),
  };
}

/**
 * How proven this actor is as a draw in this genre, 0..1. With no record in
 * the genre: persona fit at PERSONA_PROOF_WEIGHT, plus a spillover from their
 * best record elsewhere. With a record: that prior, blended toward the
 * record's value by confidence - so two strong openings outweigh persona, and
 * two flops pull proof below what an unproven actor of the same persona has.
 */
export function proofInGenre(style: ActingStyle, record: LeadOuting[], genre: Genre): number {
  let bestElsewhere = 0;
  for (const other of GENRES) {
    if (other === genre) continue;
    const read = readGenreRecord(record, other);
    if (read) bestElsewhere = Math.max(bestElsewhere, read.value * read.confidence);
  }
  const prior = PERSONA_PROOF_WEIGHT * personaFit(style, genre) + RECORD_SPILLOVER_WEIGHT * bestElsewhere;
  const own = readGenreRecord(record, genre);
  if (!own) return clamp(prior, 0, 1);
  return clamp(own.confidence * own.value + (1 - own.confidence) * prior, 0, 1);
}

/** This person's draw as a lead in one genre, 0..1. 0 for anyone without an Actor career. */
export function computeStarDraw(person: Person, genre: Genre): number {
  const career = getActorCareer(person);
  if (!career) return 0;
  const readiness = fameReadiness(person.reputation.fame);
  if (readiness === 0) return 0;
  const proof = proofInGenre(career.actingStyle, leadRecordOf(person), genre);
  return clamp(readiness * proof * heatFactor(person.reputation.currentHeat, person.reputation.fame), 0, 1);
}

/** Draw in every genre, and the best one. */
export function computeStarDrawProfile(person: Person): { byGenre: Record<Genre, number>; bestGenre: Genre; best: number } {
  const byGenre = {} as Record<Genre, number>;
  let bestGenre: Genre = GENRES[0];
  let best = -1;
  for (const genre of GENRES) {
    const d = computeStarDraw(person, genre);
    byGenre[genre] = d;
    if (d > best) {
      best = d;
      bestGenre = genre;
    }
  }
  return { byGenre, bestGenre, best: Math.max(best, 0) };
}

/** Whether this person is a bankable star in their best genre (BANKABLE_DRAW). */
export function isBankableStar(person: Person): boolean {
  return computeStarDrawProfile(person).best >= BANKABLE_DRAW;
}
