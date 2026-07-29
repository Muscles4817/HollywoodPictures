// Casting Redesign, Phase E (docs/DESIGN_REVIEW_casting_redesign.md section
// 13) - negotiation/counter-offers, the future work the earlier phases were
// deliberately shaped to accept as an *addition*. Phase C made an offer a
// binary the moment it was made: appeal.overall cleared the actor's threshold
// or it didn't (engine/castingAppeal.ts:resolveOfferResponse). That produced no
// interesting decision - the player set one slider and got a yes/no. This
// module turns the money half of that into a back-and-forth:
//
//   - offer clears their bar            -> accepted, at what you offered
//   - they'd say yes for the right money -> countered, at a price between your
//                                           offer and their own asking quote
//   - the project itself doesn't sell them, or the offer is insultingly low
//                                        -> rejected, with the real reason
//
// Two deliberate design choices, both to stay inside SIMULATION_PHILOSOPHY.md:
//
// 1. The accept/counter/reject decision (resolveNegotiation) is DETERMINISTIC
//    given the actor's asking price - it's a legible comparison of your offer
//    against a number the player can see and manage, exactly as Phase C's
//    accept/decline was (Principle 2 - "variance lives in the production, or it
//    doesn't exist," no hidden end-of-process dice roll). The "sometimes you
//    get lucky and land them below their usual quote" that the brief asks for
//    lives entirely in computeAskingPrice's bounded, seeded wobble around a
//    DERIVED centre - so the luck is endogenous (a function of who they are and
//    this project) and, once rolled, a stable number the player negotiates
//    against, not a coin flip on the accept button.
//
// 2. Everything is DERIVED from Person/appeal fields that already exist - the
//    asking price from typicalSalary/minimumSalary + selectiveness + heat, the
//    counter's meeting point from the same selectiveness read - never a new
//    stored "negotiation stat" (the codebase's "derive, don't store" rule).
//    The one thing that IS stored is the outcome of a resolved offer (the
//    rolled asking price + the counter), because a counter the player can
//    respond to has to hold still between renders - that persistence lives in
//    the reducer, not here; this module stays pure.
//
// Non-money conditions from the brief (script revisions, schedule shifts,
// attached-talent demands) are NOT here yet - they depend on systems that are
// themselves later phases (a shift-dates flow is Phase 6). NegotiationOutcome
// is a discriminated union so those land as new variants, not a rewrite, the
// same way this landed on top of OfferResponse.
import type { Money, Person } from '../types';
import {
  computeAcceptanceThreshold,
  computeSalaryFit,
  computeSelectiveness,
  offerBlameReason,
  overallWithSalaryFit,
  type ActorAppealResult,
  type OfferRejectionReason,
} from './castingAppeal';
import { getActorCareer } from './person';
import { NO_RELATIONSHIP, relationshipRefuses, type RelationshipStanding } from './relationships';
import { clamp, randFloat, type RandomFn } from './random';

// --- Asking price -----------------------------------------------------------

// How much a hot, selective actor asks ABOVE their typicalSalary - a genuine
// star in demand doesn't quote their standard fee for everyone. First-draft,
// tunable. Applied only past the high end of the demand curve (see below), so
// an ordinary working actor never asks above typical.
const MAX_PREMIUM_ABOVE_TYPICAL = 0.25;
// Where on the demand curve the premium starts biting - below this an actor
// quotes between their (discounted) floor and typical; above it they start
// asking a premium over typical.
const PREMIUM_DEMAND_ONSET = 0.6;
// The bounded, seeded wobble around the derived asking centre - the ONLY
// randomness in this whole module, and the source of "sometimes you get lucky."
// +/-10%: enough to matter (a lucky read can shave a real chunk off the quote,
// an unlucky one adds one), never enough to swamp the derived signal.
const ASKING_WOBBLE = 0.1;
// How much a star's own demand tilts their quote toward heat vs. their standing
// selectiveness - currentHeat ("hot right NOW") weighted a little under the
// fuller selectiveness read (fame + heat + ego + ambition).
const HEAT_DEMAND_WEIGHT = 0.4;

/**
 * How much in demand this actor reads as being right now, 0 (an unknown, or a
 * humble working actor) to 1 (a white-hot, ego-driven star) - blends the
 * standing selectiveness read (engine/castingAppeal.ts, itself fame + heat +
 * ego + ambition) with currentHeat weighted again, so an actor having a moment
 * quotes harder than their baseline fame alone would say.
 */
function demandLevel(person: Person): number {
  const selectiveness = computeSelectiveness(person);
  const blended = selectiveness * (1 - HEAT_DEMAND_WEIGHT) + person.reputation.currentHeat * HEAT_DEMAND_WEIGHT;
  return clamp(blended / 100, 0, 1);
}

/**
 * The actor's opening quote for THIS specific deal - what they'll ask for
 * before any back-and-forth. Derived, not stored, and re-rolled fresh each time
 * a negotiation is opened (the reducer persists the rolled figure so it holds
 * still while the player responds):
 *
 *   - anchored between their effective floor (already discounted for a
 *     prestigious project / a loyal relationship - see
 *     computeEffectiveMinimumSalary) and their typicalSalary, sitting near the
 *     floor for a low-demand actor and up at typical for a selective one. This
 *     is where "secure someone below their usual quote" comes from: a
 *     less-selective actor, or one drawn to a prestige project, genuinely opens
 *     below typical.
 *   - plus a premium ABOVE typical for the hottest, most ego-driven stars.
 *   - times a bounded seeded wobble (ASKING_WOBBLE) - the luck.
 *
 * Never returns below the effective floor: no wobble or low-demand read makes
 * an actor quote under the minimum they'd actually take.
 */
export function computeAskingPrice(person: Person, effectiveMinimum: Money, typicalSalary: Money, rng: RandomFn): Money {
  const centre = askingPriceCentre(person, effectiveMinimum, typicalSalary);
  const wobble = 1 + randFloat(rng, -ASKING_WOBBLE, ASKING_WOBBLE);
  // Never below the real floor; never runaway above a hot star's premium.
  const ceiling = typicalSalary * (1 + MAX_PREMIUM_ABOVE_TYPICAL) * (1 + ASKING_WOBBLE);
  return Math.round(clamp(centre * wobble, effectiveMinimum, ceiling));
}

/**
 * The deterministic centre of an actor's asking price - everything
 * computeAskingPrice derives BEFORE the seeded ±10% wobble is applied. Split out
 * so the pre-offer estimate (engine/castingEstimate.ts) can band around the same
 * centre the real roll lands near, without seeing (or re-rolling) the wobble
 * itself. Never below the effective floor.
 */
export function askingPriceCentre(person: Person, effectiveMinimum: Money, typicalSalary: Money): Money {
  const demand = demandLevel(person);
  // Centre between the (discounted) floor and typical: the midpoint of that band
  // for a zero-demand actor, rising to typicalSalary itself at full demand.
  const floorToTypical = Math.max(0, typicalSalary - effectiveMinimum);
  const bandMidpoint = effectiveMinimum + floorToTypical * 0.5;
  const centre = bandMidpoint + (typicalSalary - bandMidpoint) * demand;
  // Premium over typical, only past the onset of the demand curve.
  const premiumT = clamp((demand - PREMIUM_DEMAND_ONSET) / (1 - PREMIUM_DEMAND_ONSET), 0, 1);
  const premium = typicalSalary * MAX_PREMIUM_ABOVE_TYPICAL * premiumT;
  return Math.max(centre + premium, effectiveMinimum);
}

/** The seeded wobble bound (±fraction) the real asking price can land either side of the centre - so an estimate's band never claims to be tighter than the roll itself can be. */
export const ASKING_WOBBLE_FRACTION = ASKING_WOBBLE;

// --- Resolving one offer against an asking price ----------------------------

/**
 * The outcome of one offer in a negotiation. `accepted` carries the salary the
 * deal actually closes at (what the player offered - a real, negotiated fee,
 * unlike Phase C where the paid amount was always the static typicalSalary).
 * `countered` carries the actor's counter and the fact it's a money ask.
 * `rejected` reuses the exact OfferRejectionReason vocabulary Phase C's
 * describeOfferRejection already turns into prose.
 */
export type NegotiationOutcome =
  | { status: 'accepted'; agreedSalary: Money }
  | { status: 'countered'; counterSalary: Money; reason: 'salary' }
  | { status: 'rejected'; reason: OfferRejectionReason };

// An offer this far below the actor's own effective floor isn't a negotiating
// position, it's an insult - they walk rather than counter. Keeps `rejected` a
// real, reachable money outcome (not every lowball becomes a polite counter),
// and gives the player the feedback to come back seriously.
const INSULT_FLOOR_RATIO = 0.6;

// How far an actor moves off their asking price toward the player's offer when
// they counter - the lower bound (a humble actor meets you closer to the
// middle) and the span added by selectiveness (a big ego barely budges, holding
// their counter up near their full ask). Both first-draft, tunable.
const COUNTER_MIN_HOLD = 0.45;
const COUNTER_HOLD_RANGE = 0.45;

/** Where between the offer and the asking price an actor's counter lands - 0.45 (meets you closer to the middle) up to 0.90 (barely moves off their ask), rising with how selective/ego-driven they read. */
function counterHoldFraction(person: Person): number {
  return COUNTER_MIN_HOLD + COUNTER_HOLD_RANGE * (computeSelectiveness(person) / 100);
}

function computeCounterSalary(offeredSalary: Money, askingPrice: Money, person: Person, effectiveMinimum: Money): Money {
  const hold = counterHoldFraction(person);
  const counter = offeredSalary + (askingPrice - offeredSalary) * hold;
  // Never below the offer (that wouldn't be a counter) or the actor's floor;
  // never above their own opening ask.
  return Math.round(clamp(counter, Math.max(offeredSalary, effectiveMinimum), askingPrice));
}

/**
 * Resolves one offer in a money negotiation - the three-way successor to
 * resolveOfferResponse (which stays as the binary the applicant-pool weighting
 * and any non-negotiated path still use). Deterministic given `askingPrice`;
 * the only randomness in the system is computeAskingPrice's wobble, rolled
 * once when the negotiation opened and passed back in here unchanged on every
 * subsequent offer.
 *
 * Ordering mirrors resolveOfferResponse's hard-gates-first discipline: an
 * unavailable schedule or a poisoned relationship ends it before money is even
 * considered (there's no shift-the-dates flow yet - Phase 6 - so a schedule
 * conflict is still a rejection, not a delay negotiation).
 *
 *   1. schedule / relationship hard gates            -> rejected
 *   2. even paying their full ask wouldn't clear their bar
 *      (the role/studio itself doesn't sell them)    -> rejected (real reason)
 *   3. the current offer already clears their bar     -> accepted, at the offer
 *   4. offer insultingly below their floor            -> rejected (salary)
 *   5. otherwise - interested, money's the only gap   -> countered
 */
export function resolveNegotiation(
  appeal: ActorAppealResult,
  person: Person,
  offeredSalary: Money,
  askingPrice: Money,
  relationship: RelationshipStanding = NO_RELATIONSHIP,
): NegotiationOutcome {
  if (appeal.schedule.status !== 'available') return { status: 'rejected', reason: 'schedule' };
  if (relationshipRefuses(relationship)) return { status: 'rejected', reason: 'relationship' };

  const threshold = computeAcceptanceThreshold(person, relationship);
  const typicalSalary = getActorCareer(person)?.typicalSalary ?? askingPrice;

  // Would paying their full asking price be enough to land them? If not, money
  // isn't the problem - the role or the studio itself doesn't clear their bar,
  // and no counter will fix that. Blame the real (usually non-salary) reason.
  const salaryFitAtAsking = computeSalaryFit(askingPrice, appeal.effectiveMinimum, typicalSalary);
  const overallAtAsking = overallWithSalaryFit(appeal, salaryFitAtAsking);
  if (overallAtAsking < threshold) {
    return { status: 'rejected', reason: offerBlameReason(appeal) };
  }

  // They'd say yes for the right money. Is the current offer already enough?
  if (appeal.overall >= threshold) {
    return { status: 'accepted', agreedSalary: offeredSalary };
  }

  // Interested, but the money isn't there yet. An insulting lowball is a walk;
  // anything in real negotiating range gets a counter.
  if (offeredSalary < appeal.effectiveMinimum * INSULT_FLOOR_RATIO) {
    return { status: 'rejected', reason: 'salary' };
  }
  const counterSalary = computeCounterSalary(offeredSalary, askingPrice, person, appeal.effectiveMinimum);
  if (counterSalary <= offeredSalary) {
    // Nothing left to ask for (offer already at/above their ask) - take it.
    return { status: 'accepted', agreedSalary: offeredSalary };
  }
  return { status: 'countered', counterSalary, reason: 'salary' };
}
