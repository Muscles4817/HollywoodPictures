// Casting Redesign, Phase 2 (uncertainty) - reading the DEAL before you make it.
// Phase 1 gave casting a real negotiation, but the player plays it blind: they
// move a salary slider with no sense of what the actor will want or whether
// they'll say yes. Meanwhile the craft-fit read has been uncertainty-aware for a
// while (engine/talentCardPresentation.ts:deriveFitRead - a perceived fit over a
// confidence band, sharpened by a hired Casting Director). This module extends
// that SAME uncertainty model to the money: a confidence-banded estimate of the
// actor's asking price, and a qualitative read of how a given offer would land.
//
// It reuses, never re-derives:
//   - the asking-price centre (engine/castingNegotiation.ts:askingPriceCentre) -
//     the same number the real roll lands within ±10% of, so the estimate band
//     is honest about the roll it's predicting;
//   - the confidence tier + studio-side assist (deriveFitConfidence /
//     deriveFitReadAssist) - so a Casting Director or a working history sharpens
//     the price read exactly as it already sharpens the fit read. One
//     uncertainty model, one thing to buy your way out of it with.
//
// Deterministic and derived (no RNG, no stored estimate) - re-read every render
// from live state, like every other card read.
import type { Money, Person } from '../types';
import { askingPriceCentre, ASKING_WOBBLE_FRACTION } from './castingNegotiation';
import { computeAcceptanceThreshold, computeSalaryFit, overallWithSalaryFit, type ActorAppealResult } from './castingAppeal';
import { deriveFitConfidence, type FitConfidence, type FitReadAssist, NO_ASSIST } from './talentCardPresentation';
import { NO_RELATIONSHIP, relationshipRefuses, type RelationshipStanding } from './relationships';
import { getActorCareer } from './person';

// How wide the estimated asking band is, as a ±fraction of the centre, per
// confidence tier - harsh when you can't read them (a low-confidence estimate is
// a genuinely vague "somewhere in this wide range"), tight when you can. Floored
// at the roll's own ±10% wobble below, because even a perfect read can't predict
// the wobble exactly. First-draft, tunable.
const ESTIMATE_SPREAD: Record<FitConfidence, number> = { high: 0.15, medium: 0.34, low: 0.58 };
// A little extra tightening from a strong assist WITHIN a tier, so a Casting
// Director keeps adding value even once they've promoted the tier. Bounded, and
// the wobble floor still applies.
const ESTIMATE_ASSIST_SHAVE = 0.25;

export interface AskingEstimate {
  low: Money;
  high: Money;
  confidence: FitConfidence;
}

/**
 * The band the actor's asking price likely falls in - centred on the same
 * deterministic centre the real roll lands near, widened by how hard they are to
 * read and narrowed by a Casting Director / working history. Never tighter than
 * the roll's own wobble, never below the effective floor.
 */
export function estimateAskingRange(person: Person, effectiveMinimum: Money, typicalSalary: Money, assist: FitReadAssist = NO_ASSIST): AskingEstimate {
  const centre = askingPriceCentre(person, effectiveMinimum, typicalSalary);
  const confidence = deriveFitConfidence(person, assist).tier;
  const spread = Math.max(ASKING_WOBBLE_FRACTION, ESTIMATE_SPREAD[confidence] * (1 - assist.level * ESTIMATE_ASSIST_SHAVE));
  return {
    low: Math.round(Math.max(effectiveMinimum, centre * (1 - spread))),
    high: Math.round(centre * (1 + spread)),
    confidence,
  };
}

// How a given offer reads against what it would take to land the actor - a
// qualitative ladder, never a percentage (house style). 'no' is a hard wall
// (schedule/relationship); 'long-shot' means either the project itself doesn't
// sell them or the offer is nowhere near; up through 'likely'.
export type AcceptanceOdds = 'no' | 'long-shot' | 'stretch' | 'even' | 'likely';

// Where the offer sits relative to the asking centre for the middle bands.
const EVEN_RATIO = 0.9; // within ~10% of the likely ask - could go either way
const STRETCH_RATIO = 0.6; // this far below the ask is a real stretch, but not an insult

/**
 * How a given offer would land, as a qualitative read - the odds half of the
 * pre-offer estimate. Mirrors resolveNegotiation's own logic (schedule/
 * relationship gates, then "would full pay even sell them," then offer vs. ask),
 * but against the DETERMINISTIC asking centre rather than the hidden roll, so it
 * never leaks the exact number the negotiation will use. Deterministic.
 */
export function estimateAcceptanceOdds(
  appeal: ActorAppealResult,
  person: Person,
  offeredSalary: Money,
  relationship: RelationshipStanding = NO_RELATIONSHIP,
): AcceptanceOdds {
  if (appeal.schedule.status !== 'available') return 'no';
  if (relationshipRefuses(relationship)) return 'no';

  const career = getActorCareer(person);
  const typicalSalary = career?.typicalSalary ?? offeredSalary;
  const centre = askingPriceCentre(person, appeal.effectiveMinimum, typicalSalary);
  const threshold = computeAcceptanceThreshold(person, relationship);

  // Would paying their likely ask even clear their bar? If not, the role/studio
  // itself doesn't sell them and money won't fix it - a long shot at any price.
  const overallAtCentre = overallWithSalaryFit(appeal, computeSalaryFit(centre, appeal.effectiveMinimum, typicalSalary));
  if (overallAtCentre < threshold) return 'long-shot';

  // The current offer already clears the bar - they'd very likely take it.
  if (appeal.overall >= threshold) return 'likely';

  // Interested, but the money isn't there yet - how far off is the offer?
  const ratio = centre > 0 ? offeredSalary / centre : 0;
  if (ratio >= EVEN_RATIO) return 'even';
  if (ratio >= STRETCH_RATIO) return 'stretch';
  return 'long-shot';
}

export interface DealEstimate {
  asking: AskingEstimate;
  odds: AcceptanceOdds;
}

/**
 * The whole pre-offer read for one candidate at the current offered salary - the
 * estimated asking band and how this offer would land. null only if the person
 * has no actor career (no fee to estimate). One call for the card to render.
 */
export function estimateDeal(
  appeal: ActorAppealResult,
  person: Person,
  offeredSalary: Money,
  assist: FitReadAssist = NO_ASSIST,
  relationship: RelationshipStanding = NO_RELATIONSHIP,
): DealEstimate | null {
  const career = getActorCareer(person);
  if (!career) return null;
  return {
    asking: estimateAskingRange(person, appeal.effectiveMinimum, career.typicalSalary, assist),
    odds: estimateAcceptanceOdds(appeal, person, offeredSalary, relationship),
  };
}
