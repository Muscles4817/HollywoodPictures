// Sets & Design facet (docs/DESIGN_REVIEW_production_redesign.md) — the model
// must reach every corner of the 2×2 for legible reasons, and substitution
// between money and time must be bounded by ambition.
import { describe, it, expect } from 'vitest';
import {
  computeSetsAmbition,
  computeSetsFacet,
  designerAsk,
  designerConfidence,
  realiseSetsQuality,
  setsOutlook,
  NO_DESIGNER_SKILL,
  type SetsFacetInput,
} from './setsFacet';
import type { Script } from '../types';

function script(primarySetting: string, scale: Script['scale']): Script {
  return { primarySetting, scale } as unknown as Script;
}

// Money endpoints (£, over ENVIRONMENT_BUDGET_RANGE 20k–50M).
const LAVISH = 30_000_000;
const CHEAP = 120_000;

/** prepDays that fully/under-serve the designer's ask for a given ambition+skill. */
function patient(ambition: number, skill: number) { return Math.round(designerAsk(ambition, skill).neededDays * 1.25); }
function rushed(ambition: number, skill: number) { return Math.round(designerAsk(ambition, skill).neededDays * 0.25); }

function facet(over: Partial<SetsFacetInput> & { ambition: number }): number {
  return computeSetsFacet({ moneyAmount: LAVISH, prepDays: patient(over.ambition, 80), designerSkill: 80, ...over }).quality;
}

describe('computeSetsAmbition', () => {
  it('a built-world epic is far more demanding than a single-room intimate drama', () => {
    const epic = computeSetsAmbition(script('FuturisticCity', 'Epic'));
    const intimate = computeSetsAmbition(script('SingleInteriorLocation', 'Intimate'));
    expect(epic).toBeGreaterThan(intimate + 30);
    expect(intimate).toBeLessThan(40);
    expect(epic).toBeGreaterThan(70);
  });
});

describe('the 2×2 (moderate ambition)', () => {
  const A = 45;

  it('lots + skilled + time beats lots + rushed + weak designer (money wasted when badly run)', () => {
    const amazing = computeSetsFacet({ ambition: A, moneyAmount: LAVISH, prepDays: patient(A, 85), designerSkill: 85 }).quality;
    const bungled = computeSetsFacet({ ambition: A, moneyAmount: LAVISH, prepDays: rushed(A, 20), designerSkill: 20 }).quality;
    expect(amazing).toBeGreaterThan(bungled + 15);
  });

  it('little + skilled + patient looks better than little + rushed + weak (clever solutions)', () => {
    const clever = computeSetsFacet({ ambition: A, moneyAmount: CHEAP, prepDays: patient(A, 90), designerSkill: 90 }).quality;
    const cheap = computeSetsFacet({ ambition: A, moneyAmount: CHEAP, prepDays: rushed(A, 25), designerSkill: 25 }).quality;
    expect(clever).toBeGreaterThan(cheap + 12);
  });

  it('a skilled, patient, cheap build can beat a lavish but rushed & badly-led one', () => {
    const cleverCheap = computeSetsFacet({ ambition: A, moneyAmount: CHEAP, prepDays: patient(A, 90), designerSkill: 90 }).quality;
    const lavishRushed = computeSetsFacet({ ambition: A, moneyAmount: LAVISH, prepDays: rushed(A, 20), designerSkill: 20 }).quality;
    expect(cleverCheap).toBeGreaterThan(lavishRushed);
  });
});

describe('ambition bounds the substitution (spec §3.2)', () => {
  it('on LOW ambition, cheap + skilled + patient FULLY matches lavish + skilled + patient', () => {
    const A = 20;
    const cheapClever = computeSetsFacet({ ambition: A, moneyAmount: CHEAP, prepDays: patient(A, 90), designerSkill: 90 }).quality;
    const lavish = computeSetsFacet({ ambition: A, moneyAmount: LAVISH, prepDays: patient(A, 90), designerSkill: 90 }).quality;
    expect(cheapClever).toBeGreaterThanOrEqual(lavish - 3); // matches (within rounding)
  });

  it('on HIGH ambition, cheap + skilled + patient CANNOT fully match lavish — the money floor bites', () => {
    const A = 90;
    const cheapClever = computeSetsFacet({ ambition: A, moneyAmount: CHEAP, prepDays: patient(A, 95), designerSkill: 95 }).quality;
    const lavish = computeSetsFacet({ ambition: A, moneyAmount: LAVISH, prepDays: patient(A, 95), designerSkill: 95 }).quality;
    expect(lavish).toBeGreaterThan(cheapClever + 12); // spectacle genuinely needs the spend
  });

  it('on HIGH ambition, all the money in the world still cannot rescue a rushed build — the time floor bites', () => {
    const A = 90;
    const rushedRich = computeSetsFacet({ ambition: A, moneyAmount: LAVISH, prepDays: rushed(A, 95), designerSkill: 95 }).quality;
    const properlyTimed = computeSetsFacet({ ambition: A, moneyAmount: LAVISH, prepDays: patient(A, 95), designerSkill: 95 }).quality;
    expect(properlyTimed).toBeGreaterThan(rushedRich + 12);
  });
});

describe('skill and stretch', () => {
  it('a hired designer beats no designer, all else equal (below saturation)', () => {
    // A demanding build on a mid budget + fixed, merely-adequate time — the
    // regime where the designer's skill actually decides the outcome (rather
    // than money+time alone saturating the ceiling).
    const A = 70;
    const money = 1_500_000;
    const days = 18;
    const withDesigner = computeSetsFacet({ ambition: A, moneyAmount: money, prepDays: days, designerSkill: 88 }).quality;
    const none = computeSetsFacet({ ambition: A, moneyAmount: money, prepDays: days, designerSkill: NO_DESIGNER_SKILL }).quality;
    expect(withDesigner).toBeGreaterThan(none + 5);
  });

  it('under-resourcing an ambitious build yields high stretch; comfortably funding it yields low stretch', () => {
    const A = 80;
    const starved = computeSetsFacet({ ambition: A, moneyAmount: CHEAP, prepDays: rushed(A, 30), designerSkill: 30 });
    const comfortable = computeSetsFacet({ ambition: A, moneyAmount: LAVISH, prepDays: patient(A, 90), designerSkill: 90 });
    expect(starved.stretch).toBeGreaterThan(0.4);
    expect(comfortable.stretch).toBeLessThan(0.15);
  });

  it('designerConfidence reads the facet: comfortable = confident, starved = set-up-to-fail', () => {
    expect(designerConfidence(facet2(80, LAVISH, patient(80, 90), 90))).toBe('confident');
    expect(designerConfidence(facet2(80, CHEAP, rushed(80, 30), 30))).toBe('set-up-to-fail');
  });
});

describe('realiseSetsQuality — base + execution swing (spec §3.3)', () => {
  const A = 80;
  // A comfortably-funded build (low stretch) vs an over-reaching one (high stretch).
  const comfortable = () => computeSetsFacet({ ambition: A, moneyAmount: LAVISH, prepDays: patient(A, 90), designerSkill: 90 });
  const overreach = () => computeSetsFacet({ ambition: A, moneyAmount: CHEAP, prepDays: rushed(A, 90), designerSkill: 90 });

  it('a well-funded build barely moves with the shoot; an over-reaching one swings hard', () => {
    const c = comfortable();
    const o = overreach();
    const comfortableSwing = Math.abs(realiseSetsQuality(c, 90, 10) - realiseSetsQuality(c, 90, -10));
    const overreachSwing = Math.abs(realiseSetsQuality(o, 90, 10) - realiseSetsQuality(o, 90, -10));
    expect(overreachSwing).toBeGreaterThan(comfortableSwing + 12);
  });

  it('on an over-reaching build, an elite designer booms where a weak one busts (same events)', () => {
    const o = overreach(); // computed at high skill, but the swing tilt reads the skill arg
    const elite = realiseSetsQuality(o, 95, 0);
    const weak = realiseSetsQuality(o, 20, 0);
    expect(elite).toBeGreaterThan(weak);
  });

  it('a neutral-skill forecast with no set events delivers exactly the deterministic base', () => {
    // skill 50 → no tilt, signal 0 → no roll → zero swing at any stretch.
    const c = comfortable();
    expect(realiseSetsQuality(c, 50, 0)).toBe(c.quality);
  });

  it('a well-funded build stays close to its base even with a rough set break (tight band)', () => {
    const c = comfortable();
    expect(Math.abs(realiseSetsQuality(c, 70, -10) - c.quality)).toBeLessThan(5);
  });

  it('setsOutlook reads spread from stretch and lean from skill', () => {
    expect(setsOutlook(comfortable(), 90).spread).toBe('tight');
    const o = overreach();
    expect(o.stretch).toBeGreaterThan(0.35);
    expect(setsOutlook(o, 90)).toEqual({ spread: 'wide', lean: 'promising' });
    expect(setsOutlook(o, 30)).toEqual({ spread: 'wide', lean: 'precarious' });
  });
});

function facet2(ambition: number, moneyAmount: number, prepDays: number, designerSkill: number) {
  return computeSetsFacet({ ambition, moneyAmount, prepDays, designerSkill });
}

// keep `facet` referenced (used above as a quick single-number helper elsewhere in dev)
void facet;
