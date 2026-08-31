import { describe, it, expect } from 'vitest';
import { deriveAncillaryProfile, type AncillaryAttributes } from './ancillary';
import { deriveBackendOffers, buildBackendLiabilities } from './backend';
import { STUDIO_BOX_OFFICE_SHARE } from './boxOfficeRun';
import type { Person } from '../types';

// Encodes the whole-lifetime ancillary bands the data in data/ancillary.ts is
// tuned to, as ratios of lifetime ancillary to theatrical rentals, across a
// spread of representative films. A regression fence around the calibration - a
// data change that moves an archetype out of band should trip here, on purpose.
//
// Every band below was restated against the ratified whole-P&L calibration
// (docs/DESIGN_box_office_calibration_targets_v2_draft.md §5), which puts
// post-theatrical revenue at 35-55% of theatrical rentals field-wide. The
// original §3.7 bands (blockbuster 1.8-2.5x, broad hit 1.0-1.6x, typical
// 0.45-1.0x, prestige 0.4-0.65x) were chosen by judgment before any real
// reference was to hand, and measured 109% of rentals across the field. The four
// worked studio P&Ls in docs/domain/11-money-accounting-and-participations.md
// §6.1 put the real figure at 0.37 (micro-budget horror), 0.45 (mid-budget
// comedy), 0.73 (prestige, flagged there as "unusually high share: TV and
// library") and 0.32 rising to 0.52 counting consumer products (animated
// family), with §5.2's greenlight model at 0.50.
//
// Two things about that reference are worth stating, because the bands below
// only correct one of them. The LEVEL was 2-3x too high, and is now right. The
// ORDERING is still the model's own: it ranks a merch-franchise blockbuster
// highest and a prestige drama lowest, where the reference cases run the other
// way round - a prestige film's downstream is a larger multiple of a small
// theatrical take, and a blockbuster's is a smaller multiple of a huge one.
// Correcting that is a reshaping of the multiplier weights, not a rescale, and
// was deliberately NOT smuggled into a pass whose ratified mandate was the
// aggregate ratio ("a flat rate would itself be wrong" - the genre variation is
// meant to survive). It is the open question filed against §5.

type Archetype = { name: string; attrs: AncillaryAttributes; gross: number };

const A = (partial: Partial<AncillaryAttributes>): AncillaryAttributes => ({
  genre: 'Action', targetAudience: 'Mass Market', audienceScore: 60, criticScore: 55, accessibility: 60,
  franchiseRecognition: 0, leadMerchandisePotential: 30, originality: 50, studioPrestige: 35,
  releaseWindow: 'Quiet Month', awards: { wins: 0, nominations: 0 }, ...partial,
});

const BLOCKBUSTER: Archetype = { name: 'blockbuster', gross: 750_000_000, attrs: A({ genre: 'Fantasy', targetAudience: 'Teens', audienceScore: 80, criticScore: 65, accessibility: 72, franchiseRecognition: 82, leadMerchandisePotential: 78, studioPrestige: 55, releaseWindow: 'Summer' }) };
const BROAD_HIT: Archetype = { name: 'broad hit', gross: 420_000_000, attrs: A({ genre: 'Action', audienceScore: 78, criticScore: 68, accessibility: 75, franchiseRecognition: 35, leadMerchandisePotential: 55, studioPrestige: 50, releaseWindow: 'Summer' }) };
const TYPICAL: Archetype = { name: 'typical wide', gross: 120_000_000, attrs: A({ genre: 'Thriller', audienceScore: 62, criticScore: 58, accessibility: 62 }) };
const DRAMA: Archetype = { name: 'prestige drama', gross: 60_000_000, attrs: A({ genre: 'Drama', targetAudience: 'Adults', audienceScore: 76, criticScore: 82, accessibility: 40, leadMerchandisePotential: 6, originality: 65, studioPrestige: 45, releaseWindow: 'Awards Season' }) };
const FLOP: Archetype = { name: 'flop', gross: 35_000_000, attrs: A({ genre: 'Comedy', audienceScore: 42, criticScore: 40, accessibility: 55, leadMerchandisePotential: 20, studioPrestige: 25 }) };

function ratio(a: Archetype): number {
  return deriveAncillaryProfile(a.attrs, a.gross).lifetimeTotal / (STUDIO_BOX_OFFICE_SHARE * a.gross);
}
function lifetime(a: Archetype): number {
  return deriveAncillaryProfile(a.attrs, a.gross).lifetimeTotal;
}

describe('ancillary calibration — §3.7 lifetime bands', () => {
  it('a merch-franchise blockbuster earns the largest downstream share on the slate', () => {
    // Still the model's top archetype, but no longer at "clears well above its
    // theatrical rentals": docs/domain/11 §6.1D's animated family franchise -
    // the closest real analogue - earns 0.32x its rentals downstream, 0.52x
    // counting consumer products, and it is described there as a large success.
    expect(ratio(BLOCKBUSTER)).toBeGreaterThanOrEqual(0.7);
    expect(ratio(BLOCKBUSTER)).toBeLessThanOrEqual(1.05);
  });

  it('a broad four-quadrant hit lands around half its theatrical rentals, well below the blockbuster', () => {
    expect(ratio(BROAD_HIT)).toBeGreaterThanOrEqual(0.38);
    expect(ratio(BROAD_HIT)).toBeLessThanOrEqual(0.66);
  });

  it('keeps the median film modest — the afterlife is a fraction of theatrical', () => {
    expect(ratio(TYPICAL)).toBeGreaterThanOrEqual(0.18);
    expect(ratio(TYPICAL)).toBeLessThanOrEqual(0.41);
  });

  it('makes a prestige drama earn downstream but modestly — no merch, licensing + tail', () => {
    expect(ratio(DRAMA)).toBeGreaterThanOrEqual(0.16);
    expect(ratio(DRAMA)).toBeLessThanOrEqual(0.28);
  });

  it('never lets ancillary rescue a flop — the absolute afterlife stays negligible', () => {
    // A $35M film returns ~$16M in rentals; its whole afterlife is a few $M,
    // nowhere near enough to turn a real production+marketing loss around. Now
    // ~$2.5M rather than ~$6M, the whole system having been scaled to the
    // ratified post-theatrical ratio - the invariant this asserts is unchanged
    // and further from the line than it was.
    expect(lifetime(FLOP)).toBeLessThan(6_000_000);
    expect(ratio(FLOP)).toBeLessThan(ratio(TYPICAL));
  });

  it('orders the archetypes as a clean descending afterlife curve', () => {
    expect(ratio(BLOCKBUSTER)).toBeGreaterThan(ratio(BROAD_HIT));
    expect(ratio(BROAD_HIT)).toBeGreaterThan(ratio(TYPICAL));
    expect(ratio(TYPICAL)).toBeGreaterThan(ratio(FLOP));
    // The drama sits in the modest band, below the broad hit.
    expect(ratio(DRAMA)).toBeLessThan(ratio(BROAD_HIT));
  });
});

describe('backend calibration — the deal is a genuine bet', () => {
  function star(fame: number, heat: number, ego: number): Person {
    return { id: 's', identity: { name: 'Star' }, reputation: { fame, currentHeat: heat }, personality: { ego } } as unknown as Person;
  }
  const QUOTE = 25_000_000;
  const grossOffer = deriveBackendOffers(star(90, 85, 75), QUOTE)[0]; // reduced fee + gross points

  /** Total the studio pays a gross-points star over a film's life (guarantee + points on all receipts). */
  function pointsCost(theatricalStudioRevenue: number, ancillaryLifetime: number): number {
    const liabilities = buildBackendLiabilities({
      filmId: 'f', filmTitle: 'F', deals: [{ personId: 's', personName: 'Star', points: grossOffer.points, base: 'studioGross' }],
      theatricalStudioRevenue, worldwideGross: 0, ancillaryPayouts: [{ dueDay: 0, amount: ancillaryLifetime }], finishDay: 0,
    });
    return grossOffer.guaranteedFee - liabilities.reduce((sum, l) => sum + l.amount, 0); // guarantee + |points|
  }

  it('points cost the studio LESS than a flat fee on a flop (you saved cash you needed)', () => {
    // A modest film: small receipts, so the points barely trigger.
    expect(pointsCost(12_000_000, 4_000_000)).toBeLessThan(QUOTE);
  });

  it('points cost the studio MORE than a flat fee on a hit (the star shares the upside)', () => {
    // A blockbuster: big theatrical + ancillary receipts, so the points dwarf the saved guarantee.
    expect(pointsCost(320_000_000, 650_000_000)).toBeGreaterThan(QUOTE);
  });
});
