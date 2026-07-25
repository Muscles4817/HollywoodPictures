// Talent<->talent pairing memory - the persistent counterpart to the personality
// baseline in engine/creativeTension.ts. Phase 0/1 gave a fresh pairing a
// chemistry read from personality alone; this module remembers how a specific
// pair's shared films ACTUALLY went, and lets that realised track record modulate
// the read: a director and their regular lead who keep making good films together
// read as more reliable chemistry than personality alone guessed, a pairing whose
// films kept going sideways reads as less. It narrows the read around a known
// quantity - it is not a flat bonus; the combined value is still only the
// selection weight engine/production.ts already uses (SIMULATION_PHILOSOPHY.md -
// upside is earned in execution, and variance lives in the production).
//
// The read side of the persistent TalentPairing list (types/index.ts), plus the
// one place a film's key pairings are recorded when it releases. Pure: plain data
// in, plain data out; pairing strength is always recomputed from the flat list on
// read, never stored.
import type { ChemistryDimension, Film, GameDay, Person, PersonId, ProductionRole, TalentAssignment, TalentPairing } from '../types';
import { clamp } from './random';
import { craftPairs, keyCreativePairs, pairChemistry, performancePairs } from './creativeTension';

/** The 3 neutral stars a film with no recorded production-execution outcome contributes - a shoot we know nothing about reads as neither smooth nor troubled. */
const NEUTRAL_SHOOT_STARS = 3;

/** The two ids in canonical order (lower first), so (A,B) and (B,A) are one pairing. */
function orderedPair(a: PersonId, b: PersonId): [PersonId, PersonId] {
  return a <= b ? [a, b] : [b, a];
}

/** The dedup identity of one pairing record - a (personA, personB, film) tuple. Re-seeing the same released film every settlement pass must never double-record it. */
export function pairingKey(a: PersonId, b: PersonId, filmId: string): string {
  const [personA, personB] = orderedPair(a, b);
  return `${personA}::${personB}::${filmId}`;
}

/** The film's reception as one 0-100 number - the critic/audience blend behind "did it do well." */
function receptionOf(film: Film): number {
  return clamp((film.results.criticScore + film.results.audienceScore) / 2, 0, 100);
}

/**
 * Idempotently fold one released film's key pairings into the running world
 * history. Records every pairing engine/creativeTension.ts:keyCreativePairs reads
 * - director<->principal and principal<->principal - so exactly the pairs whose
 * chemistry the sim cares about are the ones it remembers. Safe to call with the
 * same film on every settlement pass: an already-recorded (pair, film) is skipped.
 */
export function recordFilmPairings(existing: TalentPairing[], film: Film, day: GameDay): TalentPairing[] {
  const reception = receptionOf(film);
  const shootSmoothness = film.results.productionExecution?.stars ?? NEUTRAL_SHOOT_STARS;
  const seen = new Set(existing.map((p) => pairingKey(p.personA, p.personB, p.filmId)));
  const additions: TalentPairing[] = [];
  for (const [a, b] of keyCreativePairs(film.talent)) {
    const key = pairingKey(a.id, b.id, film.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const [personA, personB] = orderedPair(a.id, b.id);
    additions.push({ personA, personB, filmId: film.id, day, reception, shootSmoothness });
  }
  return additions.length === 0 ? existing : [...existing, ...additions];
}

/** Reconcile the pairing history against every player film settled this pass. Idempotent - see recordFilmPairings. */
export function recordPlayerFilmPairings(existing: TalentPairing[], playerFilms: Film[], day: GameDay): TalentPairing[] {
  return playerFilms.reduce((acc, film) => recordFilmPairings(acc, film, day), existing);
}

// --- The read: history -> a modulation of the personality baseline -----------

// How each shared film's own impression is weighed. Shoot smoothness ("was the
// room a good place to be") carries more than reception ("did the film do well")
// for a PAIRING - chemistry is about how two people worked together, which the
// shoot reflects more directly than the box office. The mirror weighting of
// engine/relationships.ts, which leans the other way because a studio remembers
// the hit more than the shoot. First-draft, tunable.
const RECEPTION_WEIGHT = 0.4;
const SMOOTHNESS_WEIGHT = 0.6;

/** One shared film's impression, -1 (a flop that blew up) .. +1 (a hit that shot smoothly), from its stored release-day signals alone. */
function pairingFilmSentiment(p: TalentPairing): number {
  const receptionComponent = clamp((p.reception - 50) / 50, -1, 1); // 50 reception is neutral
  const smoothnessComponent = clamp((p.shootSmoothness - NEUTRAL_SHOOT_STARS) / 2, -1, 1); // 3 stars neutral; 5 -> +1, 1 -> -1
  return receptionComponent * RECEPTION_WEIGHT + smoothnessComponent * SMOOTHNESS_WEIGHT;
}

/** A pair's remembered track record: how many films they've shared and the average impression (-1..1), or null if they're strangers. */
export interface PairHistory {
  films: number;
  /** -1 (their films kept going wrong) .. +1 (they keep making good films smoothly). */
  strength: number;
}

/** The shared history of one pair, read fresh from the flat list. Null when they've never worked together. */
export function pairHistory(pairings: TalentPairing[], a: PersonId, b: PersonId): PairHistory | null {
  const [personA, personB] = orderedPair(a, b);
  const own = pairings.filter((p) => p.personA === personA && p.personB === personB);
  if (own.length === 0) return null;
  const strength = clamp(own.reduce((sum, p) => sum + pairingFilmSentiment(p), 0) / own.length, -1, 1);
  return { films: own.length, strength };
}

// How far a long shared history can pull the effective chemistry away from the
// personality baseline toward the pair's realised track record. At MAX_HISTORY_WEIGHT
// a duo with HISTORY_SATURATION_FILMS or more together is read mostly on their
// record; below that the personality prior still dominates. Bounded well under 1
// so personality always keeps a say - a proven duo can't be a total unknown.
const MAX_HISTORY_WEIGHT = 0.6;
const HISTORY_SATURATION_FILMS = 3;

/** One pairing's effective chemistry, signed -1..1: the personality baseline (pairChemistry) blended toward the pair's realised track record in proportion to how much history they have. Identical to the baseline for a fresh pairing. */
export function effectivePairChemistry(a: Person, b: Person, pairings: TalentPairing[]): number {
  const base = pairChemistry(a, b);
  const history = pairHistory(pairings, a.id, b.id);
  if (!history) return base;
  const weight = (Math.min(history.films, HISTORY_SATURATION_FILMS) / HISTORY_SATURATION_FILMS) * MAX_HISTORY_WEIGHT;
  return clamp(base * (1 - weight) + history.strength * weight, -1, 1);
}

/**
 * How much natural chemistry the key creatives bring in one dimension once their
 * shared history is folded in, 0-100 - the history-aware counterpart to
 * engine/creativeTension.ts:computePairChemistry. `dimension` selects which
 * partnerships count: 'performance' (cast - director<->principal and co-stars,
 * the default) or 'craft' (director<->editor and director<->cinematographer),
 * so cast chemistry and crew chemistry route to their own on-set beats. Uses the
 * single BEST pairing in that dimension, reads only the positive pole, and
 * reduces EXACTLY to the personality-only read when `pairings` is empty - so a
 * first-time cast, a rival, and every pre-history save are unchanged.
 */
export function computeEffectivePairChemistry(talent: TalentAssignment[], pairings: TalentPairing[], dimension: ChemistryDimension = 'performance'): number {
  const pairs = dimension === 'craft' ? craftPairs(talent) : performancePairs(talent);
  let best = 0;
  for (const [a, b] of pairs) {
    best = Math.max(best, effectivePairChemistry(a, b, pairings));
  }
  return Math.round(best * 100);
}

// --- The casting-card read: a candidate's affinity with the signed cast -------

/** The one pairing worth flagging when a candidate is weighed for a role - who on the current cast they'd pair with, how they read, and whether it's a proven partnership. */
export interface CastAffinity {
  /** The already-signed person this is about. */
  partner: Person;
  /** Their role on the current film, for naming ("your director"). */
  partnerRole: ProductionRole;
  /** Effective chemistry, signed -1..1 - personality baseline folded with any shared history. */
  chemistry: number;
  /** How many films the candidate and partner have shared (0 = personality read only). */
  films: number;
}

// A pairing with real shared history is worth flagging even when it reads only
// mildly; a personality-only hunch needs to be strong before it earns a line on
// the card, so a fresh cast isn't littered with faint guesses.
const AFFINITY_HISTORY_MIN = 0.1;
const AFFINITY_PERSONALITY_MIN = 0.3;

/**
 * The single most notable pairing a candidate would form with the already-signed
 * cast, or null if none clears the bar. Considers exactly the pairings the
 * chemistry model cares about (engine/creativeTension.ts:keyCreativePairs) that
 * involve the candidate - so an actor is read against the director and their
 * co-stars, an editor against the director, and a Writer/Composer (who pair with
 * nobody) never surfaces one. Prefers a pairing with shared HISTORY (the "proven
 * partnership" read); a personality-only pairing must read strongly to show.
 */
export function notableCastAffinity(candidate: Person, role: ProductionRole, signed: TalentAssignment[], pairings: TalentPairing[]): CastAffinity | null {
  const others = signed.filter((a) => a.person.id !== candidate.id);
  const hypothetical: TalentAssignment[] = [...others, { role, person: candidate }];
  const roleOf = new Map(others.map((a) => [a.person.id, a.role] as const));

  let best: CastAffinity | null = null;
  let bestScore = -Infinity;
  for (const [a, b] of keyCreativePairs(hypothetical)) {
    const partner = a.id === candidate.id ? b : b.id === candidate.id ? a : null;
    if (!partner) continue; // pair not involving the candidate
    const partnerRole = roleOf.get(partner.id);
    if (!partnerRole) continue;
    const chemistry = effectivePairChemistry(a, b, pairings);
    const films = pairHistory(pairings, candidate.id, partner.id)?.films ?? 0;
    // History wins ties and near-ties, so a proven partnership is what the card
    // leads with even if a stranger reads a hair stronger on personality alone.
    const score = Math.abs(chemistry) + (films > 0 ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { partner, partnerRole, chemistry, films };
    }
  }
  if (!best) return null;
  const floor = best.films > 0 ? AFFINITY_HISTORY_MIN : AFFINITY_PERSONALITY_MIN;
  return Math.abs(best.chemistry) >= floor ? best : null;
}
