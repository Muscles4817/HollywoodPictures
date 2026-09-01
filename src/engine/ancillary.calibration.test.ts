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
// Every band below is anchored on the four worked studio P&Ls in
// docs/domain/11-money-accounting-and-participations.md §6.1, which are stated
// in exactly the units measured here (lifetime post-theatrical over theatrical
// rentals): 0.369 for a micro-budget horror, 0.448 for a mid-budget comedy,
// 0.735 for a prestige drama - flagged there as an "unusually high share: TV and
// library" - and 0.324 for an animated family franchise, rising to 0.525 once
// consumer products are counted. §5.2's greenlight model sits at 0.495.
//
// The ORDERING is the point of these bands, and it used to be inverted. The
// model ranked a merch franchise highest (0.91) and a prestige drama lowest
// (0.21); the reference ranks them the other way round, and §3.4's revenue-mix
// table says why - an adult drama earns 35-45% of its lifetime revenue in
// licensing, the largest share of any film type, "which is why studios kept
// making them long after their theatrical economics stopped working". Three
// defects produced the inversion, each fixed at its source:
//
//  - the reach base was LINEAR in worldwide gross, so post-theatrical was a
//    fixed share of gross and the ordering fell out of whichever multiplier had
//    the widest range, which was merchandising (engine/ancillary.ts:computeReachBase);
//  - `licensing` had no genre term at all, so the reference's second-widest
//    genre signal could not be expressed (data/ancillary.ts:GENRE_ANCILLARY);
//  - `longevity` never read criticScore, so a well-reviewed film that won
//    nothing scored below CATALOGUE.minLongevity and got no library tail -
//    deleting exactly the channel that makes prestige earn (LONGEVITY_WEIGHTS).
//
// A second-order note kept deliberately: `homeEnt`'s genre curve was also
// inverted (1.5 Fantasy to 0.6 Drama) against a reference where home and digital
// is nearly flat across film types and tilts slightly AWAY from spectacle.

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
  it('a merch-franchise blockbuster earns a large downstream share, but not the largest', () => {
    // Still the model's top archetype, but no longer at "clears well above its
    // theatrical rentals": docs/domain/11 §6.1D's animated family franchise -
    // the closest real analogue - earns 0.32x its rentals downstream, 0.52x
    // counting consumer products, and it is described there as a large success.
    // Reference: §6.1D's animated family franchise, 0.525 counting consumer
    // products. This fixture is a top-decile merch title (franchise recognition
    // 82, lead merch potential 78) so it sits at the upper end of that.
    expect(ratio(BLOCKBUSTER)).toBeGreaterThanOrEqual(0.45);
    expect(ratio(BLOCKBUSTER)).toBeLessThanOrEqual(0.68);
  });

  it('a broad four-quadrant hit lands around half its theatrical rentals, well below the blockbuster', () => {
    // Reference: §3.4's four-quadrant tentpole row, the lowest post-theatrical
    // share of any type bar horror - its lifetime is dominated by theatrical.
    expect(ratio(BROAD_HIT)).toBeGreaterThanOrEqual(0.32);
    expect(ratio(BROAD_HIT)).toBeLessThanOrEqual(0.50);
  });

  it('keeps the median film modest — the afterlife is a fraction of theatrical', () => {
    // Reference: §6.1A's micro-budget horror at 0.369, the closest worked case
    // to an ordinary genre picture with no merch and no awards.
    expect(ratio(TYPICAL)).toBeGreaterThanOrEqual(0.28);
    expect(ratio(TYPICAL)).toBeLessThanOrEqual(0.45);
  });

  it('makes a prestige drama the BEST downstream earner on the slate — no merch, licensing + library tail', () => {
    // Reference: §6.1C's prestige awards film at 0.735 - the HIGHEST ratio in
    // the reference, not the lowest, and it earns it in licensing and library
    // rather than in any consumer-facing window.
    expect(ratio(DRAMA)).toBeGreaterThanOrEqual(0.60);
    expect(ratio(DRAMA)).toBeLessThanOrEqual(0.88);
  });

  it('never lets ancillary rescue a flop — the absolute afterlife stays negligible', () => {
    // A $35M film returns ~$16M in rentals; its whole afterlife measures ~$5.5M,
    // nowhere near enough to turn a real production-plus-marketing loss around -
    // a film grossing $35M cost more than $21M all in. Fenced on the absolute
    // figure, not on a ratio, for the reason the original calibration note gave
    // and the reach-base change has now made sharper: every window scales off
    // reach, so a small film's ratio floors out at the small-film level whatever
    // its quality. What must stay true is the number of dollars.
    expect(lifetime(FLOP)).toBeLessThan(9_000_000);
  });

  it('orders the archetypes the way the reference does — prestige first, the tentpole last', () => {
    // This ordering IS the contract, and it used to run the other way. The
    // reference is unambiguous: an adult drama earns the largest post-theatrical
    // share of any film type and a four-quadrant tentpole the smallest, because
    // a drama's downstream is a large multiple of a small theatrical take while
    // a tentpole's is a small multiple of an enormous one (docs/domain/11 §3.4
    // and the worked cases in §6.1).
    expect(ratio(DRAMA)).toBeGreaterThan(ratio(BLOCKBUSTER));
    expect(ratio(BLOCKBUSTER)).toBeGreaterThan(ratio(BROAD_HIT));
    expect(ratio(BROAD_HIT)).toBeGreaterThan(ratio(TYPICAL));

    // Deliberately NOT asserted: that the typical film out-ratios the flop.
    // Every window scales off reach, so a flop's RATIO floors out around the
    // small-film level structurally - the original calibration note said so, and
    // fenced the flop on its absolute afterlife instead, which is the assertion
    // above and the one that carries the "cannot ancillary your way out of a
    // flop" invariant.
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
