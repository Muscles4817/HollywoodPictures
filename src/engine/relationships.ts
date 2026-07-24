// Studio<->person working history - the read side of the persistent
// Collaboration list (types/index.ts:Collaboration), plus the one place a
// film's key collaborations are recorded when it releases.
//
// The problem this addresses (docs/DESIGN_REVIEW_domain_model.md, and the
// simulation's own "the studio has no memory of ever having worked with
// anyone" gap): every casting decision was context-free, so an actor you made
// a hit with last year was a stranger the next time. This module turns the
// accumulated history into a single relationship *standing* - loyalty vs.
// grudge - that engine/castingAppeal.ts and engine/directorAppeal.ts read as
// one more term in the one appeal function (SIMULATION_PHILOSOPHY.md Principle
// 7 - wire into the existing vocabulary, don't build a parallel system).
//
// Pure: plain data in, plain data out, no stored derived state. Relationship
// strength is always recomputed from the flat Collaboration list on read.
import type { Collaboration, Film, GameDay, Person, ProductionRole, TalentAssignment } from '../types';
import { clamp } from './random';

/**
 * The studioId a player collaboration is keyed by. The player's Studio has no
 * id field and can be renamed (RENAME_STUDIO), so neither its name nor its
 * object identity is a stable key - this sentinel is. A rival, by contrast,
 * already has a stable RivalStudio.id.
 */
export const PLAYER_STUDIO_ID = 'player';

/** The 3 neutral stars a film with no recorded production-execution outcome (rivals, pre-execution saves) contributes - a shoot we know nothing about reads as neither smooth nor troubled. */
const NEUTRAL_SHOOT_STARS = 3;

// The people whose history with the studio is worth remembering - the key
// creative hands a studio actually chooses to bring back or avoid, not every
// crew hire. A familiar face is a lead or a filmmaker; nobody re-hires (or
// holds a grudge against) a background grip.
const KEY_COLLABORATOR_ROLES: ReadonlySet<ProductionRole> = new Set<ProductionRole>(['Director', 'Lead Actor', 'Supporting Actor']);

/** The subset of a film's cast/crew whose collaboration is recorded - see KEY_COLLABORATOR_ROLES. */
export function keyCollaborators(talent: TalentAssignment[]): TalentAssignment[] {
  return talent.filter((a) => KEY_COLLABORATOR_ROLES.has(a.role));
}

/** The dedup identity of one collaboration - a (studio, person, film, role) tuple. Re-seeing the same released film every settlement pass must never double-record it. */
export function collaborationKey(studioId: string, personId: string, filmId: string, role: ProductionRole): string {
  return `${studioId}::${personId}::${filmId}::${role}`;
}

/** The film's reception as one 0-100 number - the critic/audience blend behind "did it do well." */
function receptionOf(film: Film): number {
  return clamp((film.results.criticScore + film.results.audienceScore) / 2, 0, 100);
}

/**
 * Idempotently fold one released film's key collaborations into the running
 * world history for `studioId`. Safe to call with the same film on every
 * settlement pass (a released film is re-seen every pass) - an already-recorded
 * (studio, person, film, role) is skipped, so this reconciles the list rather
 * than duplicating into it. Outcome signals are read once from the film's
 * release-day results and never revised, so a record is written once and left
 * alone for the rest of the game.
 */
export function recordFilmCollaborations(existing: Collaboration[], film: Film, studioId: string, day: GameDay): Collaboration[] {
  const reception = receptionOf(film);
  const shootSmoothness = film.results.productionExecution?.stars ?? NEUTRAL_SHOOT_STARS;
  const seen = new Set(existing.map((c) => collaborationKey(c.studioId, c.personId, c.filmId, c.role)));
  const additions: Collaboration[] = [];
  for (const assignment of keyCollaborators(film.talent)) {
    const key = collaborationKey(studioId, assignment.person.id, film.id, assignment.role);
    if (seen.has(key)) continue;
    seen.add(key);
    additions.push({
      studioId,
      personId: assignment.person.id,
      filmId: film.id,
      role: assignment.role,
      day,
      reception,
      shootSmoothness,
    });
  }
  return additions.length === 0 ? existing : [...existing, ...additions];
}

/** Reconcile the player's collaboration history against every player film settled this pass (engine/marketSettlement.ts). Idempotent - see recordFilmCollaborations. */
export function recordPlayerFilmCollaborations(existing: Collaboration[], playerFilms: Film[], day: GameDay): Collaboration[] {
  return playerFilms.reduce((acc, film) => recordFilmCollaborations(acc, film, PLAYER_STUDIO_ID, day), existing);
}

// --- The read: history -> a single relationship standing --------------------

export type RelationshipTier = 'none' | 'loyal' | 'warm' | 'neutral' | 'strained' | 'grudge';

/**
 * The whole studio<->person relationship, read fresh from the Collaboration
 * list - never stored. `warmth` is the -100..100 aggregate the appeal terms
 * read; `tier` is the qualitative band presentation reads (never raw warmth,
 * per the house style).
 */
export interface RelationshipStanding {
  /** How many films this studio and person have made together. 0 means strangers. */
  collaborations: number;
  /** -100 (deep grudge) .. +100 (fierce loyalty). 0 for strangers and for a history that nets out neutral. */
  warmth: number;
  tier: RelationshipTier;
  /** The most recent day they worked together, or null if never. */
  lastWorkedDay: GameDay | null;
}

export const NO_RELATIONSHIP: RelationshipStanding = { collaborations: 0, warmth: 0, tier: 'none', lastWorkedDay: null };

// How each film's own impression is weighed. Reception ("did it do well")
// carries a little more than shoot smoothness ("did it blow up") - a hit
// papers over a rough shoot to a degree, but a smooth, respectful shoot still
// counts for a lot. Both are first-draft, tunable, like every constant here.
const RECEPTION_WEIGHT = 0.6;
const SMOOTHNESS_WEIGHT = 0.4;

// How much repeat history amplifies whatever the average impression is - loyalty
// deepens and a grudge hardens the more films you've shared. Additive per film
// beyond the first, capped so a long, happy partnership saturates rather than
// running away.
const PER_EXTRA_FILM_AMPLIFY = 0.15;
const MAX_AMPLIFY_FILMS = 4;

// Tier cutoffs on warmth. Symmetric around neutral; `loyal`/`grudge` are the
// bands the appeal terms lean on hardest (a lower/higher effective offer, and
// at the extreme a refusal).
const WARMTH_LOYAL = 45;
const WARMTH_WARM = 15;
const WARMTH_STRAINED = -15;
const WARMTH_GRUDGE = -45;

/** One film's impression, -1 (a flop that blew up) .. +1 (a hit that shot smoothly), from its stored, release-day-knowable signals alone. */
function collaborationSentiment(c: Collaboration): number {
  const receptionComponent = clamp((c.reception - 50) / 50, -1, 1); // 50 reception is neutral
  const smoothnessComponent = clamp((c.shootSmoothness - NEUTRAL_SHOOT_STARS) / 2, -1, 1); // 3 stars is neutral; 5 -> +1, 1 -> -1
  return receptionComponent * RECEPTION_WEIGHT + smoothnessComponent * SMOOTHNESS_WEIGHT;
}

function tierForWarmth(warmth: number, collaborations: number): RelationshipTier {
  if (collaborations === 0) return 'none';
  if (warmth >= WARMTH_LOYAL) return 'loyal';
  if (warmth >= WARMTH_WARM) return 'warm';
  if (warmth <= WARMTH_GRUDGE) return 'grudge';
  if (warmth <= WARMTH_STRAINED) return 'strained';
  return 'neutral';
}

/**
 * The studio<->person relationship as of now, from their shared history. Pure
 * read over the flat Collaboration list - pass the already-filtered records for
 * this pair, or the whole list plus the ids (relationshipFor does the filter).
 */
export function computeRelationship(collaborations: Collaboration[], studioId: string, personId: string): RelationshipStanding {
  const own = collaborations.filter((c) => c.studioId === studioId && c.personId === personId);
  if (own.length === 0) return NO_RELATIONSHIP;

  const avgSentiment = own.reduce((sum, c) => sum + collaborationSentiment(c), 0) / own.length;
  const amplify = 1 + Math.min(own.length - 1, MAX_AMPLIFY_FILMS - 1) * PER_EXTRA_FILM_AMPLIFY;
  const warmth = clamp(avgSentiment * 100 * amplify, -100, 100);
  const lastWorkedDay = own.reduce<GameDay>((latest, c) => Math.max(latest, c.day), own[0].day);

  return {
    collaborations: own.length,
    warmth,
    tier: tierForWarmth(warmth, own.length),
    lastWorkedDay,
  };
}

/** Convenience: the player's standing with one person, keyed by PLAYER_STUDIO_ID. */
export function playerRelationshipWith(collaborations: Collaboration[], person: Person): RelationshipStanding {
  return computeRelationship(collaborations, PLAYER_STUDIO_ID, person.id);
}

// --- The appeal-term mappings (read by castingAppeal.ts / directorAppeal.ts) -

// The most a relationship swings the weighted `overall` appeal score, in
// points. Applied as a delta from neutral (0 for strangers), so it never
// destabilises the stranger baseline every existing weight was tuned against -
// a loyal collaborator simply finds the project a little more appealing, a
// grudge a little less.
const MAX_APPEAL_DELTA = 12;

/** How much a relationship nudges the weighted `overall` appeal, +/- points (0 for strangers). Loyalty makes the project more appealing; a grudge less. */
export function relationshipAppealDelta(standing: RelationshipStanding): number {
  return (standing.warmth / 100) * MAX_APPEAL_DELTA;
}

// The most a relationship moves the acceptance threshold, in points. Loyalty
// LOWERS the bar (an easier yes - they want to work with you again); a grudge
// RAISES it (a harder yes). Subtracted, so positive warmth lowers the
// threshold.
const MAX_THRESHOLD_SWING = 15;

/** How much a relationship shifts the acceptance threshold, subtracted from it - positive warmth (loyalty) lowers the bar, negative (grudge) raises it. 0 for strangers. */
export function relationshipThresholdDelta(standing: RelationshipStanding): number {
  return (standing.warmth / 100) * MAX_THRESHOLD_SWING;
}

// The salary floor swing. Loyalty discounts the effective minimum (they'll take
// a lower offer for a studio they trust); a grudge inflates it (pricier to lure
// them back). Bounded so neither runs away.
const MAX_LOYALTY_DISCOUNT = 0.25; // down to 75% of the floor for the most loyal
const MAX_GRUDGE_SURCHARGE = 0.5; // up to 150% of the floor for the deepest grudge

/**
 * The multiplier a relationship applies to an already-computed effective
 * minimum salary - < 1 for loyalty (accepts less), > 1 for a grudge (demands
 * more), exactly 1 for strangers. Orthogonal to the prestige-vs-paycheque
 * discount computeEffectiveMinimumSalary already applies: a personal loyalty
 * mate's-rate (or a grudge surcharge) is about *who's asking*, not the
 * project's prestige, so it stacks on top of that and applies even to a
 * PaychequeDriven person.
 */
export function relationshipSalaryMultiplier(standing: RelationshipStanding): number {
  if (standing.warmth >= 0) return 1 - (standing.warmth / 100) * MAX_LOYALTY_DISCOUNT;
  return 1 + (-standing.warmth / 100) * MAX_GRUDGE_SURCHARGE;
}

/**
 * Whether a relationship is so poisoned the person simply won't take the job at
 * any offer this studio could plausibly make - the "won't come back" end of a
 * grudge. Only the deepest grudge triggers it; a merely strained history still
 * lets a strong enough offer through. Read by resolveOfferResponse ahead of the
 * soft threshold, the same way the schedule/salary-floor hard gates are.
 */
const HARD_REFUSAL_WARMTH = -80;
export function relationshipRefuses(standing: RelationshipStanding): boolean {
  return standing.warmth <= HARD_REFUSAL_WARMTH;
}
