import { describe, it, expect } from 'vitest';
import type { BackendDeal, Person } from '../types';
import { backendDealFromOffer, backendEligible, buildBackendLiabilities, deriveBackendOffers } from './backend';

/** Minimal Person carrying only the fields the backend model reads. */
function person(fame: number, currentHeat: number, ego: number, name = 'Nova Sterling', id = 'p1'): Person {
  return { id, identity: { name }, reputation: { fame, currentHeat }, personality: { ego } } as unknown as Person;
}

const QUOTE = 30_000_000;

describe('backend eligibility & offers', () => {
  it('offers nothing to a mid-tier actor (below the fame and heat floors)', () => {
    const actor = person(45, 40, 50);
    expect(backendEligible(actor)).toBe(false);
    expect(deriveBackendOffers(actor, QUOTE)).toEqual([]);
  });

  it('lets a red-hot actor qualify even a touch under the fame floor', () => {
    expect(backendEligible(person(55, 80, 50))).toBe(true); // heat floor path
  });

  it('offers a bankable star gross-points and escalator structures, both discounting the guarantee', () => {
    const star = person(85, 70, 65);
    const offers = deriveBackendOffers(star, QUOTE);
    expect(offers.map((o) => o.structure)).toEqual(['grossPoints', 'escalators']);

    const gross = offers[0];
    expect(gross.points).toBeGreaterThan(0);
    expect(gross.base).toBe('studioGross');
    expect(gross.guaranteedFee).toBeLessThan(QUOTE); // traded cash for points

    const esc = offers[1];
    expect(esc.points).toBe(0);
    expect(esc.escalators).toHaveLength(2);
    expect(esc.escalators![0].grossThreshold).toBeLessThan(esc.escalators![1].grossThreshold);
    expect(esc.escalators![1].bonus).toBeGreaterThan(esc.escalators![0].bonus);
    expect(esc.guaranteedFee).toBeLessThan(QUOTE);
    expect(esc.guaranteedFee).toBeGreaterThan(gross.guaranteedFee); // escalator keeps more guarantee than points
  });

  it('scales terms with bankability — a hotter star asks more points for a bigger cut', () => {
    const mid = deriveBackendOffers(person(70, 55, 55), QUOTE)[0];
    const hot = deriveBackendOffers(person(96, 92, 85), QUOTE)[0];
    expect(hot.points).toBeGreaterThan(mid.points);
    expect(hot.guaranteedFee).toBeLessThan(mid.guaranteedFee); // gives up more cash for the upside
  });

  it('freezes an accepted offer into the stored deal', () => {
    const star = person(85, 70, 65);
    const deal = backendDealFromOffer(deriveBackendOffers(star, QUOTE)[0], star);
    expect(deal.personId).toBe('p1');
    expect(deal.personName).toBe('Nova Sterling');
    expect(deal.base).toBe('studioGross');
    expect(deal.points).toBeGreaterThan(0);
  });
});

describe('buildBackendLiabilities — phased, signed negative', () => {
  const grossDeal: BackendDeal = { personId: 'p', personName: 'Nova', points: 10, base: 'studioGross' };

  it('takes points off theatrical receipts and every ancillary payout, on their own days', () => {
    const liabilities = buildBackendLiabilities({
      filmId: 'f', filmTitle: 'Titan', deals: [grossDeal],
      theatricalStudioRevenue: 100_000_000, worldwideGross: 800_000_000,
      ancillaryPayouts: [{ dueDay: 1200, amount: 50_000_000 }, { dueDay: 1300, amount: 20_000_000 }],
      finishDay: 1000,
    });
    const byDay = Object.fromEntries(liabilities.map((l) => [l.dueDay, l.amount]));
    expect(byDay[1000]).toBe(-10_000_000); // 10% of theatrical
    expect(byDay[1200]).toBe(-5_000_000); // 10% of that window
    expect(byDay[1300]).toBe(-2_000_000);
    expect(liabilities.every((l) => l.amount < 0 && l.personName === 'Nova')).toBe(true);
  });

  it('pays an escalator bonus once for each crossed gross threshold, at finish', () => {
    const escDeal: BackendDeal = {
      personId: 'p', personName: 'Nova', points: 0, base: 'studioGross',
      escalators: [{ grossThreshold: 600_000_000, bonus: 5_000_000 }, { grossThreshold: 900_000_000, bonus: 10_000_000 }],
    };
    const liabilities = buildBackendLiabilities({
      filmId: 'f', filmTitle: 'Titan', deals: [escDeal],
      theatricalStudioRevenue: 0, worldwideGross: 800_000_000, ancillaryPayouts: [], finishDay: 1000,
    });
    // Only the $600M threshold cleared ($800M < $900M).
    expect(liabilities).toEqual([{ filmId: 'f', filmTitle: 'Titan', personName: 'Nova', dueDay: 1000, amount: -5_000_000 }]);
  });

  it('aggregates multiple participants sharing a day', () => {
    const liabilities = buildBackendLiabilities({
      filmId: 'f', filmTitle: 'Titan',
      deals: [grossDeal, { personId: 'q', personName: 'Vega', points: 5, base: 'studioGross' }],
      theatricalStudioRevenue: 100_000_000, worldwideGross: 100_000_000, ancillaryPayouts: [], finishDay: 1000,
    });
    expect(liabilities).toHaveLength(1);
    expect(liabilities[0].amount).toBe(-15_000_000); // (10% + 5%) of $100M
    expect(liabilities[0].personName).toBe('2 participants');
  });

  it('does not settle net-profit points (deferred)', () => {
    const netDeal: BackendDeal = { personId: 'p', personName: 'Nova', points: 10, base: 'netProfit' };
    expect(buildBackendLiabilities({
      filmId: 'f', filmTitle: 'Titan', deals: [netDeal],
      theatricalStudioRevenue: 100_000_000, worldwideGross: 800_000_000, ancillaryPayouts: [{ dueDay: 1200, amount: 50_000_000 }], finishDay: 1000,
    })).toEqual([]);
  });
});
