// The shared craft-facet core (docs/DESIGN_REVIEW_production_redesign.md, step 4).
// Every facet (Sets, VFX, Practical, later Cinematography/Score/Edit) runs on
// this model, so its invariants are tested once here on raw inputs:
//   - the 2×2 is reachable for legible reasons (spend/skill/time all matter),
//   - money's weight SCALES WITH AMBITION — cheap can match lavish on a modest
//     job but not on spectacle (the money floor bites),
//   - time has its own floor on ambitious work (money can't buy back a rush),
//   - diminishing returns on both inputs, and an over-deliver headroom.
import { describe, it, expect } from 'vitest';
import { computeFacet, facetConfidence } from './facetModel';

/** money-t (0..1 dial): a full spend, a modest-but-not-starved spend, a starvation budget. */
const LAVISH = 1.0;
const MODEST = 0.25;
const STARVED = 0.05;
/** time-ratio (fraction of the head's recommended time): ample, adequate, rushed. */
const PATIENT = 1.15;
const RUSHED = 0.2;
/** skill (0-100). */
const SKILLED = 90;
const WEAK = 25;

const q = (ambition: number, moneyT: number, timeRatio: number, skill: number) =>
  computeFacet({ ambition, moneyT, timeRatio, skill }).quality;

describe('the 2×2 is reachable at moderate ambition', () => {
  const A = 45;

  it('spend lots + run it well beats spend lots + bungle it (money wasted when badly run)', () => {
    const amazing = q(A, LAVISH, PATIENT, 85);
    const bungled = q(A, LAVISH, RUSHED, WEAK);
    expect(amazing).toBeGreaterThan(bungled + 15);
  });

  it('spend little + clever & patient beats spend little + rushed & weak', () => {
    const clever = q(A, MODEST, PATIENT, SKILLED);
    const cheap = q(A, MODEST, RUSHED, WEAK);
    expect(clever).toBeGreaterThan(cheap + 12);
  });

  it('a clever, patient, cheap build can beat a lavish but rushed & badly-run one', () => {
    const cleverCheap = q(A, MODEST, PATIENT, SKILLED);
    const lavishBungled = q(A, LAVISH, RUSHED, WEAK);
    expect(cleverCheap).toBeGreaterThan(lavishBungled);
  });
});

describe("ambition scales money's weight (spec §3.2)", () => {
  it('the lavish-over-cheap advantage GROWS with ambition', () => {
    const gapLow = q(20, LAVISH, PATIENT, SKILLED) - q(20, MODEST, PATIENT, SKILLED);
    const gapHigh = q(90, LAVISH, PATIENT, 95) - q(90, MODEST, PATIENT, 95);
    expect(gapLow).toBeLessThan(12); // modest budget nearly matches lavish on a low-demand job
    expect(gapHigh).toBeGreaterThan(gapLow + 15); // ...but spectacle genuinely needs the spend
  });

  it('on HIGH ambition all the money in the world cannot rescue a rushed job — the time floor bites', () => {
    const A = 90;
    const rushedRich = q(A, LAVISH, RUSHED, 95);
    const patientRich = q(A, LAVISH, PATIENT, 95);
    expect(patientRich).toBeGreaterThan(rushedRich + 12);
  });
});

describe('skill multiplies capability (below saturation)', () => {
  it('a skilled head beats a weak one, all else equal', () => {
    // A demanding-ish job on a mid budget + adequate time — the regime where
    // skill decides the outcome rather than money+time saturating the ceiling.
    const skilled = q(70, 0.4, 1, SKILLED);
    const weak = q(70, 0.4, 1, 40);
    expect(skilled).toBeGreaterThan(weak + 6);
  });
});

describe('diminishing returns on money', () => {
  it('the same spend step buys more quality when starting low than when already well-funded', () => {
    const A = 60;
    const lowStep = q(A, 0.3, 1, 80) - q(A, 0.1, 1, 80);
    const highStep = q(A, 0.8, 1, 80) - q(A, 0.6, 1, 80);
    expect(lowStep).toBeGreaterThan(highStep);
  });
});

describe('stretch and confidence', () => {
  it('under-resourcing an ambitious job yields high stretch; comfortably funding it yields low stretch', () => {
    const starved = computeFacet({ ambition: 80, moneyT: STARVED, timeRatio: RUSHED, skill: 30 });
    const comfortable = computeFacet({ ambition: 80, moneyT: LAVISH, timeRatio: PATIENT, skill: SKILLED });
    expect(starved.stretch).toBeGreaterThan(0.4);
    expect(comfortable.stretch).toBeLessThan(0.15);
  });

  it('facetConfidence reads the facet: comfortable = confident, starved = set-up-to-fail', () => {
    expect(facetConfidence(computeFacet({ ambition: 80, moneyT: LAVISH, timeRatio: PATIENT, skill: SKILLED }))).toBe('confident');
    expect(facetConfidence(computeFacet({ ambition: 80, moneyT: STARVED, timeRatio: RUSHED, skill: 30 }))).toBe('set-up-to-fail');
  });
});

describe('over-delivery headroom', () => {
  it('a fully-resourced team on a low-demand job over-delivers past the nominal ceiling', () => {
    const result = computeFacet({ ambition: 15, moneyT: LAVISH, timeRatio: 1.3, skill: 100 });
    expect(result.realisation).toBeGreaterThan(1);
    expect(result.quality).toBeGreaterThan(80);
  });
});
