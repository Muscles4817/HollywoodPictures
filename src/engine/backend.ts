// Backend participation (talent profit-sharing) - the pure model behind the
// negotiation term sheet and the settlement of what a star's points pay out.
// See docs/DESIGN_REVIEW_studio_financial_model.md §4.
//
// Two halves:
//  - OFFERS: what structured deals a bankable star will accept in place of a flat
//    fee (deriveBackendOffers). Derived from the star's own standing, never
//    rolled - the same "derive, don't store" pattern the rest of the sim uses.
//  - LIABILITIES: what those points actually pay, phased to arrive with the
//    revenue they are a share of (buildBackendLiabilities), materialised once a
//    film's receipts are known (its run has finished).
//
// Scope: gross-points and escalators. Net-profit points are typed but not yet
// settled (they need cumulative-recoup tracking) - deferred, and skipped by the
// settlement below.
import type { BackendBase, BackendDeal, BackendLiability, Money, Person } from '../types';
import { BACKEND_BANKABILITY_WEIGHTS, BACKEND_ELIGIBILITY, BACKEND_TERMS } from '../data/backend';
import { clamp } from './random';

// --- Willingness & offers ---------------------------------------------------

/** 0-1 read of how bankable a star is - fame-led, lifted by current heat and ego. Drives how aggressive their points/discount terms are. */
export function bankability(person: Person): number {
  const { fame, currentHeat } = person.reputation;
  const { ego } = person.personality;
  const w = BACKEND_BANKABILITY_WEIGHTS;
  return clamp((fame * w.fame + currentHeat * w.currentHeat + ego * w.ego) / 100, 0, 1);
}

/** Whether this person is bankable enough to command backend at all (a mid-tier actor is not). */
export function backendEligible(person: Person): boolean {
  return person.reputation.fame >= BACKEND_ELIGIBILITY.fameFloor || person.reputation.currentHeat >= BACKEND_ELIGIBILITY.heatFloor;
}

/** One structured alternative to a flat fee that a star will accept. Pure numbers; the UI composes the term-sheet prose. */
export interface BackendOffer {
  structure: 'grossPoints' | 'escalators';
  /** The reduced guaranteed fee (charged up front like any salary). */
  guaranteedFee: Money;
  /** Percentage points of the base; 0 for a pure-escalator offer. */
  points: number;
  base: BackendBase;
  escalators?: { grossThreshold: Money; bonus: Money }[];
}

/** How far above the eligibility floor this star sits, 0-1 - scales their terms. */
function termStrength(person: Person): number {
  const b = bankability(person) * 100;
  const floor = BACKEND_ELIGIBILITY.fameFloor;
  return clamp((b - floor) / (100 - floor), 0, 1);
}

/**
 * The structured deals a star will accept instead of a flat fee, given the flat
 * quote they'd otherwise command. Empty for talent who aren't bankable enough -
 * they simply take scale. The hotter the star, the more points they ask and the
 * more guarantee they trade for them.
 */
export function deriveBackendOffers(person: Person, flatQuote: Money): BackendOffer[] {
  if (!backendEligible(person) || flatQuote <= 0) return [];
  const t = termStrength(person);
  const T = BACKEND_TERMS;

  const points = Math.round(T.minPoints + t * (T.maxPoints - T.minPoints));
  const discount = T.minFeeDiscount + t * (T.maxFeeDiscount - T.minFeeDiscount);
  const grossPoints: BackendOffer = {
    structure: 'grossPoints',
    guaranteedFee: Math.round(flatQuote * (1 - discount)),
    points,
    base: 'studioGross',
  };

  const escalators: BackendOffer = {
    structure: 'escalators',
    guaranteedFee: Math.round(flatQuote * (1 - T.escalatorFeeDiscount)),
    points: 0,
    base: 'studioGross',
    escalators: T.escalatorThresholds.map((grossThreshold, i) => ({
      grossThreshold,
      bonus: Math.round(flatQuote * T.escalatorBonusFractions[i]),
    })),
  };

  return [grossPoints, escalators];
}

/** Freeze an accepted offer into the deal stored on the assignment. */
export function backendDealFromOffer(offer: BackendOffer, person: Person): BackendDeal {
  return {
    personId: person.id,
    personName: person.identity.name,
    points: offer.points,
    base: offer.base,
    ...(offer.escalators ? { escalators: offer.escalators } : {}),
  };
}

// --- Liabilities (settlement) ----------------------------------------------

export interface BackendLiabilityInput {
  filmId: string;
  filmTitle: string;
  deals: BackendDeal[];
  /** Studio's theatrical receipts (FilmResults.studioRevenue). */
  theatricalStudioRevenue: number;
  /** Worldwide gross (FilmResults.totalBoxOffice), for escalator thresholds. */
  worldwideGross: number;
  /** The film's scheduled ancillary payouts - gross points ride these too. */
  ancillaryPayouts: { dueDay: number; amount: number }[];
  /** The day the theatrical run finished (anchor for theatrical points + escalators). */
  finishDay: number;
}

/**
 * Materialise a film's backend deals into dated, negative-signed cash
 * liabilities, phased to arrive with the revenue each is a share of: gross points
 * take a cut of the theatrical receipts (at finish) and of every ancillary payout
 * (on its own day); escalators pay their bonus once, at finish, for each crossed
 * gross threshold. Aggregated per due day so the ledger stays legible.
 * Net-profit deals are skipped (not settled yet).
 */
export function buildBackendLiabilities(input: BackendLiabilityInput): BackendLiability[] {
  const byDay = new Map<number, number>();
  const names = new Set<string>();
  const add = (day: number, amount: number) => {
    if (amount > 0) byDay.set(day, (byDay.get(day) ?? 0) + amount);
  };

  for (const deal of input.deals) {
    if (deal.base === 'studioGross' && deal.points > 0) {
      const rate = deal.points / 100;
      add(input.finishDay, rate * Math.max(0, input.theatricalStudioRevenue));
      for (const payout of input.ancillaryPayouts) add(payout.dueDay, rate * Math.max(0, payout.amount));
      names.add(deal.personName);
    }
    for (const esc of deal.escalators ?? []) {
      if (input.worldwideGross >= esc.grossThreshold) {
        add(input.finishDay, esc.bonus);
        names.add(deal.personName);
      }
    }
  }

  const personName = names.size === 1 ? [...names][0] : `${names.size} participants`;
  return [...byDay.entries()]
    .map(([dueDay, amount]) => ({
      filmId: input.filmId,
      filmTitle: input.filmTitle,
      personName,
      dueDay,
      amount: -Math.round(amount),
    }))
    .filter((l) => l.amount < 0);
}

/** The whole lifetime backend a set of deals implies for a finished film - for the money dossier's deduction line (derived, not stored). */
export function totalBackendForFilm(input: BackendLiabilityInput): number {
  return buildBackendLiabilities(input).reduce((sum, l) => sum + l.amount, 0);
}
