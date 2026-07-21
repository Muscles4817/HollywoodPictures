// Press Tours - pure logic (docs/DESIGN_REVIEW_marketing_campaign.md, "press
// tours" / D). Turns a tour roster (marketingChoices.pressTourCast, resolved
// against the film's assigned talent) into its deterministic Buzz delta, cash
// cost, and an aggregate volatility the readout widens its projection band by.
// Plain data in, plain data out - no React, no state, no RNG (the box office is
// fully deterministic; literal gaffe *events* are a later increment). Tunables
// live in data/pressTour.ts.
import type { Money, Person, PersonId, TalentAssignment } from '../types';
import { clamp } from './random';
import {
  PRESS_TOUR_BASE_COST_PER_PERSON,
  PRESS_TOUR_BUZZ_PER_PERSON,
  PRESS_TOUR_FAME_COST_AT_100,
  PRESS_TOUR_MAX_BUZZ_SWING,
  PRESS_TOUR_RISK_SENSITIVITY,
  PRESS_TOUR_RISK_WEIGHTS,
  PRESS_TOUR_STACK_DECAY,
} from '../data/pressTour';

/**
 * The people actually on the tour: those assigned-talent Persons whose id is in
 * `ids`, de-duped (one person holds at most one seat even if assigned twice) and
 * in talent order. Stale ids (someone no longer cast) are silently dropped.
 */
export function tourers(talent: TalentAssignment[], ids: readonly PersonId[] | undefined): Person[] {
  if (!ids || ids.length === 0) return [];
  const wanted = new Set(ids);
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const { person } of talent) {
    if (wanted.has(person.id) && !seen.has(person.id)) {
      seen.add(person.id);
      out.push(person);
    }
  }
  return out;
}

/** A person's media risk, 0 (unshakeable pro) .. 1 (loose cannon), from controversy / professionalism / pressure-handling. */
export function personMediaRisk(person: Person): number {
  const p = person.personality;
  const w = PRESS_TOUR_RISK_WEIGHTS;
  const total = w.controversy + w.professionalism + w.pressureHandling;
  const risk =
    (w.controversy * (p.controversy / 100) +
      w.professionalism * (1 - p.professionalism / 100) +
      w.pressureHandling * (1 - p.pressureHandling / 100)) /
    total;
  return clamp(risk, 0, 1);
}

/** One tourer's raw Buzz contribution: fame upside, cut - or flipped negative - by their media risk. */
function contribution(person: Person): number {
  const fameUpside = (person.reputation.fame / 100) * PRESS_TOUR_BUZZ_PER_PERSON;
  return fameUpside * (1 - PRESS_TOUR_RISK_SENSITIVITY * personMediaRisk(person));
}

/**
 * The deterministic expected Buzz delta from the tour - each tourer's
 * fame-vs-risk contribution, decay-stacked strongest-first for diminishing
 * returns, clamped to a sane swing. Can be negative when a volatile roster is a
 * net liability. Zero when nobody tours.
 */
export function pressTourBuzzDelta(talent: TalentAssignment[], ids: readonly PersonId[] | undefined): number {
  const stacked = tourers(talent, ids)
    .map(contribution)
    .sort((a, b) => b - a)
    .reduce((sum, value, index) => sum + value * PRESS_TOUR_STACK_DECAY ** index, 0);
  return clamp(stacked, -PRESS_TOUR_MAX_BUZZ_SWING, PRESS_TOUR_MAX_BUZZ_SWING);
}

/** Cash cost of sending one person: a flat base plus a fame-scaled premium. */
export function pressTourCostForPerson(person: Person): Money {
  return Math.round(PRESS_TOUR_BASE_COST_PER_PERSON + (person.reputation.fame / 100) * PRESS_TOUR_FAME_COST_AT_100);
}

/** Total cash cost of the tour - the sum of each tourer's cost. Zero when nobody tours. */
export function pressTourCost(talent: TalentAssignment[], ids: readonly PersonId[] | undefined): Money {
  return tourers(talent, ids).reduce((sum, person) => sum + pressTourCostForPerson(person), 0);
}

/**
 * The roster's aggregate volatility, 0..1 - a fame-weighted average of the
 * tourers' media risk, so a marquee name's risk counts for more than a bit
 * player's. Feeds the projection band in the Marketing readout (D1b); it has no
 * effect on the deterministic Buzz/opening. Zero when nobody tours.
 */
export function pressTourVolatility(talent: TalentAssignment[], ids: readonly PersonId[] | undefined): number {
  const cast = tourers(talent, ids);
  if (cast.length === 0) return 0;
  // +1 on every weight so an all-unknowns roster still averages rather than /0.
  const weight = (person: Person) => person.reputation.fame + 1;
  const weighted = cast.reduce((sum, person) => sum + personMediaRisk(person) * weight(person), 0);
  const weightSum = cast.reduce((sum, person) => sum + weight(person), 0);
  return clamp(weighted / weightSum, 0, 1);
}
